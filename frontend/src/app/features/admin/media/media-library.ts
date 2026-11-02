import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MediaApi } from '../../../core/api/admin-api';
import { ApiError, DEFAULT_LANG, LANGS, Lang, MediaDto, MediaText } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { IconComponent } from '../../../shared/components/icon';
import { LangTabsComponent } from '../../../shared/components/lang-tabs';
import { ModalComponent } from '../../../shared/components/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { debounced } from '../../../shared/util/paged-list';

@Component({
  selector: 'app-media-library',
  imports: [ReactiveFormsModule, FormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, ModalComponent, LangTabsComponent, EmptyStateComponent, ErrorStateComponent, AppDatePipe],
  templateUrl: './media-library.html',
})
export class MediaLibraryComponent {
  private readonly api = inject(MediaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly langs = LANGS;

  protected readonly items = signal<MediaDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly total = signal(0);
  protected readonly uploading = signal<{ done: number; total: number } | null>(null);
  protected readonly dragging = signal(false);
  protected kind = '';
  private q = '';
  protected readonly search = debounced((v: string) => { this.q = v; this.load(0); });

  protected readonly selected = signal<MediaDto | null>(null);
  protected readonly activeLang = signal<Lang>(DEFAULT_LANG);
  protected readonly saving = signal(false);
  protected readonly form = new FormGroup({
    fr: new FormGroup({ altText: new FormControl('', { nonNullable: true }), description: new FormControl('', { nonNullable: true }) }),
    ar: new FormGroup({ altText: new FormControl('', { nonNullable: true }), description: new FormControl('', { nonNullable: true }) }),
    en: new FormGroup({ altText: new FormControl('', { nonNullable: true }), description: new FormControl('', { nonNullable: true }) }),
  });
  protected readonly canUpload = computed(() => this.auth.can('MEDIA_UPLOAD'));
  protected readonly canDelete = computed(() => this.auth.can('MEDIA_DELETE'));

  constructor() { this.load(0); }

  protected load(page: number) {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ q: this.q, kind: this.kind, page, size: 24 }).subscribe({
      next: (p) => { this.items.set(page === 0 ? p.content : [...this.items(), ...p.content]); this.page.set(p.page); this.totalPages.set(p.totalPages); this.total.set(p.totalElements); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  protected onFiles(files: FileList | File[] | null | undefined) {
    const list = Array.from(files ?? []);
    if (!list.length || !this.canUpload()) return;
    this.uploading.set({ done: 0, total: list.length });
    let ok = 0;
    const next = (i: number) => {
      if (i >= list.length) {
        this.uploading.set(null);
        if (ok) { this.toast.success('media.uploadedN', { n: ok }); this.load(0); }
        return;
      }
      this.api.upload(list[i]).subscribe({
        next: () => { ok++; this.uploading.set({ done: i + 1, total: list.length }); next(i + 1); },
        error: (e: ApiError) => { this.toast.error(`${list[i].name}: ${apiErrorMessage(this.t, e)}`); this.uploading.set({ done: i + 1, total: list.length }); next(i + 1); },
      });
    };
    next(0);
  }

  protected onPick(ev: Event) { const el = ev.target as HTMLInputElement; this.onFiles(el.files); el.value = ''; }
  protected onDrop(ev: DragEvent) { ev.preventDefault(); this.dragging.set(false); this.onFiles(ev.dataTransfer?.files); }

  protected open(m: MediaDto) {
    this.selected.set(m);
    for (const l of LANGS) this.form.get(l)?.reset({ altText: m.translations[l]?.altText ?? '', description: m.translations[l]?.description ?? '' });
  }

  protected saveMeta() {
    const m = this.selected();
    if (!m) return;
    const tr: Partial<Record<Lang, MediaText>> = {};
    for (const l of LANGS) { const v = this.form.get(l)?.getRawValue() as { altText: string; description: string }; if (v.altText.trim() || v.description.trim()) tr[l] = { altText: v.altText.trim() || null, description: v.description.trim() || null }; }
    this.saving.set(true);
    this.api.update(m.id, tr).subscribe({
      next: (u) => { this.saving.set(false); this.toast.success('common.saved'); this.items.update((a) => a.map((x) => (x.id === u.id ? u : x))); this.selected.set(u); },
      error: (e: ApiError) => { this.saving.set(false); this.toast.error(apiErrorMessage(this.t, e)); },
    });
  }

  protected async remove(m: MediaDto) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: m.originalName }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.doDelete(m, false);
  }

  private doDelete(m: MediaDto, force: boolean) {
    this.api.delete(m.id, force).subscribe({
      next: () => { this.toast.success('common.deleted'); this.selected.set(null); this.items.update((a) => a.filter((x) => x.id !== m.id)); this.total.update((n) => n - 1); },
      error: async (e: ApiError) => {
        if (e.code === 'MEDIA_IN_USE' && !force) {
          const go = await this.confirm.ask({ title: 'media.inUseTitle', message: 'media.inUseConfirm', confirmLabel: 'media.forceDelete', danger: true });
          if (go) this.doDelete(m, true);
        } else this.toast.error(apiErrorMessage(this.t, e));
      },
    });
  }

  protected copy(m: MediaDto) {
    const url = location.origin + m.url;
    navigator.clipboard?.writeText(url).then(() => this.toast.success('common.copied'), () => this.toast.error('common.network'));
  }

  protected size(m: MediaDto) { return m.sizeBytes > 1048576 ? (m.sizeBytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(m.sizeBytes / 1024)) + ' KB'; }
}
