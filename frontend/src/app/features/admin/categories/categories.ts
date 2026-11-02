import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CategoriesApi } from '../../../core/api/admin-api';
import { ApiError, CATEGORY_TYPES, CategoryAdmin, CategoryRequest, CategoryText, CategoryType, LANGS, Lang } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { LangTabsComponent } from '../../../shared/components/lang-tabs';
import { ModalComponent } from '../../../shared/components/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { SLUG_PATTERN, filledLanguages, pickText, readTranslations, translationGroup, writeTranslations } from '../../../shared/util/forms';

@Component({
  selector: 'app-categories',
  imports: [ReactiveFormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, ModalComponent, LangTabsComponent, FieldErrorComponent, ApiErrorBannerComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent],
  templateUrl: './categories.html',
})
export class CategoriesComponent {
  private readonly api = inject(CategoriesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  protected readonly types = CATEGORY_TYPES;
  protected readonly langs = LANGS;

  protected readonly type = signal<CategoryType>('NEWS');
  protected readonly all = signal<CategoryAdmin[]>([]);
  protected readonly items = computed(() => this.all().filter((c) => c.type === this.type()));
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly canManage = computed(() => this.auth.can('CATEGORY_MANAGE'));

  protected readonly editing = signal<CategoryAdmin | 'new' | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<ApiError | null>(null);
  protected readonly activeLang = signal<Lang>(this.lang.lang());
  protected readonly filled = signal<Partial<Record<Lang, boolean>>>({});
  protected readonly form = new FormGroup({
    slug: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120), Validators.pattern(SLUG_PATTERN)] }),
    sortOrder: new FormControl(0, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    translations: translationGroup(['name', 'description'], { name: [Validators.maxLength(150)], description: [Validators.maxLength(500)] }),
  });

  constructor() {
    this.load();
    this.form.valueChanges.subscribe(() => this.filled.set(filledLanguages(this.form.controls.translations)));
  }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({ next: (c) => { this.all.set(c); this.loading.set(false); }, error: (e: ApiError) => { this.error.set(e); this.loading.set(false); } });
  }

  protected name(c: CategoryAdmin) { return pickText(c.translations, this.lang.lang(), 'name') || c.slug; }
  protected dirOf(l: Lang) { return l === 'ar' ? 'rtl' : 'ltr'; }
  protected tr(l: Lang) { return this.form.controls.translations.get(l); }

  protected open(c: CategoryAdmin | 'new') {
    this.formError.set(null);
    this.activeLang.set(this.lang.lang());
    this.form.reset({ slug: '', sortOrder: this.items().length * 10, active: true });
    writeTranslations(this.form.controls.translations, c === 'new' ? {} : c.translations);
    if (c !== 'new') this.form.patchValue({ slug: c.slug, sortOrder: c.sortOrder, active: c.active });
    this.filled.set(filledLanguages(this.form.controls.translations));
    this.editing.set(c);
  }

  protected save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body: CategoryRequest = { type: this.type(), slug: v.slug.trim() || null, sortOrder: v.sortOrder, active: v.active, translations: readTranslations<CategoryText>(this.form.controls.translations) };
    const cur = this.editing();
    this.saving.set(true);
    this.formError.set(null);
    (cur && cur !== 'new' ? this.api.update(cur.id, body) : this.api.create(body)).subscribe({
      next: () => { this.saving.set(false); this.editing.set(null); this.toast.success('common.saved'); this.load(); },
      error: (e: ApiError) => { this.saving.set(false); this.formError.set(e); },
    });
  }

  protected toggleActive(c: CategoryAdmin) {
    this.api.update(c.id, { type: c.type, slug: c.slug, sortOrder: c.sortOrder, active: !c.active, translations: c.translations }).subscribe({
      next: () => this.load(), error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)),
    });
  }

  protected async remove(c: CategoryAdmin) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: this.name(c) }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(c.id).subscribe({ next: () => { this.toast.success('common.deleted'); this.load(); }, error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)) });
  }
}
