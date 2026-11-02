import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CategoriesApi, ResourcesApi } from '../../../core/api/admin-api';
import { CategoryAdmin, LANGS, Lang, MediaDto, RESOURCE_KINDS, ResourceAdmin, ResourceKind, ResourceRequest, TitledText } from '../../../core/api/models';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { LangTabsComponent } from '../../../shared/components/lang-tabs';
import { MediaFieldComponent } from '../../../shared/components/media-field';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor';
import { ErrorStateComponent } from '../../../shared/components/states';
import { StatusActionsComponent } from '../../../shared/components/status-actions';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { ContentFormPage } from '../../../shared/util/content-form';
import { URL_PATTERN, pickText, readTranslations, translationGroup, writeTranslations } from '../../../shared/util/forms';

@Component({
  selector: 'app-resource-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, LangTabsComponent, RichTextEditorComponent, MediaFieldComponent, StatusActionsComponent, FieldErrorComponent, ApiErrorBannerComponent, ErrorStateComponent, AppDatePipe],
  templateUrl: './resource-form.html',
})
export class ResourceFormComponent extends ContentFormPage<ResourceAdmin, ResourceRequest> {
  protected override readonly api = inject(ResourcesApi);
  protected override readonly listRoute = '/admin/resources';
  protected readonly langs = LANGS;
  protected readonly kinds = RESOURCE_KINDS;
  protected readonly categories = signal<CategoryAdmin[]>([]);

  protected override readonly form = new FormGroup({
    kind: new FormControl<ResourceKind>('DOCUMENT', { nonNullable: true }),
    externalUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(URL_PATTERN)] }),
    categoryId: new FormControl<number | null>(null),
    file: new FormControl<MediaDto | null>(null),
    translations: translationGroup(['title', 'description'], { title: [Validators.maxLength(300)] }),
  });

  constructor() {
    super();
    this.init();
    inject(CategoriesApi).list('RESOURCE').subscribe({ next: (c) => this.categories.set(c.filter((x) => x.active)), error: () => undefined });
  }

  protected dirOf(l: Lang) { return l === 'ar' ? 'rtl' : 'ltr'; }
  protected catName(c: CategoryAdmin) { return pickText(c.translations, this.lang.lang(), 'name') || c.slug; }
  protected tr(l: Lang) { return this.form.controls.translations.get(l); }
  protected override displayName() { return pickText(this.entity()?.translations, this.lang.lang(), 'title'); }

  protected override patch(e: ResourceAdmin): void {
    this.form.patchValue({ kind: e.kind, externalUrl: e.externalUrl ?? '', categoryId: e.categoryId, file: e.file }, { emitEvent: false });
    writeTranslations(this.form.controls.translations, e.translations);
  }

  protected override buildRequest(): ResourceRequest {
    const v = this.form.getRawValue();
    return { kind: v.kind, externalUrl: v.externalUrl.trim() || null, categoryId: v.categoryId, fileId: v.file?.id ?? null, translations: readTranslations<TitledText>(this.form.controls.translations) };
  }
}
