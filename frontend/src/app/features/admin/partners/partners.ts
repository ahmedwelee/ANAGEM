import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PartnersApi } from '../../../core/api/admin-api';
import { ApiError, LANGS, Lang, MediaDto, PartnerAdmin, PartnerRequest } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { MediaFieldComponent } from '../../../shared/components/media-field';
import { ModalComponent } from '../../../shared/components/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { URL_PATTERN } from '../../../shared/util/forms';

@Component({
  selector: 'app-partners',
  imports: [ReactiveFormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, ModalComponent, MediaFieldComponent, FieldErrorComponent, ApiErrorBannerComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent],
  templateUrl: './partners.html',
})
export class PartnersComponent {
  private readonly api = inject(PartnersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly langs = LANGS;

  protected readonly items = signal<PartnerAdmin[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly editing = signal<PartnerAdmin | 'new' | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<ApiError | null>(null);
  protected readonly canManage = computed(() => this.auth.can('PARTNER_MANAGE'));

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    websiteUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(URL_PATTERN)] }),
    logo: new FormControl<MediaDto | null>(null),
    sortOrder: new FormControl(0, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    names: new FormGroup({ fr: new FormControl('', { nonNullable: true }), ar: new FormControl('', { nonNullable: true }), en: new FormControl('', { nonNullable: true }) }),
  });

  constructor() { this.load(); }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({ next: (p) => { this.items.set(p); this.loading.set(false); }, error: (e: ApiError) => { this.error.set(e); this.loading.set(false); } });
  }

  protected open(p: PartnerAdmin | 'new') {
    this.formError.set(null);
    this.form.reset({ name: '', websiteUrl: '', logo: null, sortOrder: (this.items().length + 1) * 10, active: true, names: { fr: '', ar: '', en: '' } });
    if (p !== 'new') this.form.reset({ name: p.name, websiteUrl: p.websiteUrl ?? '', logo: p.logo, sortOrder: p.sortOrder, active: p.active, names: { fr: p.translations.fr?.name ?? '', ar: p.translations.ar?.name ?? '', en: p.translations.en?.name ?? '' } });
    this.editing.set(p);
  }

  protected save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const translations: Partial<Record<Lang, { name: string }>> = {};
    for (const l of LANGS) if (v.names[l].trim()) translations[l] = { name: v.names[l].trim() };
    const body: PartnerRequest = { name: v.name.trim(), websiteUrl: v.websiteUrl.trim() || null, logoId: v.logo?.id ?? null, sortOrder: v.sortOrder, active: v.active, translations };
    const cur = this.editing();
    this.saving.set(true);
    this.formError.set(null);
    (cur && cur !== 'new' ? this.api.update(cur.id, body) : this.api.create(body)).subscribe({
      next: () => { this.saving.set(false); this.editing.set(null); this.toast.success('common.saved'); this.load(); },
      error: (e: ApiError) => { this.saving.set(false); this.formError.set(e); },
    });
  }

  protected async remove(p: PartnerAdmin) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: p.name }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(p.id).subscribe({ next: () => { this.toast.success('common.deleted'); this.load(); }, error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)) });
  }
}
