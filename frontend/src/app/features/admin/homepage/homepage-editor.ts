import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SiteApi } from '../../../core/api/admin-api';
import { ApiError, HomepageSection } from '../../../core/api/models';
import { ToastService } from '../../../core/ui/toast.service';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { IconComponent } from '../../../shared/components/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { JsonFieldComponent } from './json-field';

interface Draft { section: HomepageSection; content: Record<string, unknown>; holder: Record<string, unknown>; enabled: boolean; sortOrder: number; open: boolean; dirty: boolean; saving: boolean; error: ApiError | null }

@Component({
  selector: 'app-homepage-editor',
  imports: [FormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, JsonFieldComponent, ErrorStateComponent, SkeletonRowsComponent, ApiErrorBannerComponent, AppDatePipe],
  templateUrl: './homepage-editor.html',
})
export class HomepageEditorComponent {
  private readonly api = inject(SiteApi);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly Object = Object;
  protected readonly drafts = signal<Draft[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  constructor() { this.load(); }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.sections().subscribe({
      next: (s) => { this.drafts.set(s.map((x) => this.toDraft(x))); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  private toDraft(s: HomepageSection): Draft {
    const content = structuredClone(s.content);
    return { section: s, content, holder: { content }, enabled: s.enabled, sortOrder: s.sortOrder, open: false, dirty: false, saving: false, error: null };
  }

  protected hasLang(c: Record<string, unknown>) { return ['fr', 'ar', 'en'].some((k) => k in c); }
  protected touch(d: Draft) { d.dirty = true; this.drafts.update((a) => [...a]); }
  protected toggle(d: Draft) { d.open = !d.open; this.drafts.update((a) => [...a]); }
  protected reset(d: Draft) { Object.assign(d, this.toDraft(d.section), { open: true }); this.drafts.update((a) => [...a]); }

  protected save(d: Draft) {
    d.saving = true; d.error = null;
    this.drafts.update((a) => [...a]);
    this.api.updateSection(d.section.key, { enabled: d.enabled, sortOrder: d.sortOrder, content: d.content }).subscribe({
      next: (s) => { Object.assign(d, this.toDraft(s), { open: true }); this.toast.success('common.saved'); this.drafts.update((a) => [...a]); },
      error: (e: ApiError) => { d.saving = false; d.error = e; this.toast.error(apiErrorMessage(this.t, e)); this.drafts.update((a) => [...a]); },
    });
  }
}
