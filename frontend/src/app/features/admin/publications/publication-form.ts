import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CategoriesApi, PublicationsApi } from '../../../core/api/admin-api';
import { CategoryAdmin, LANGS, Lang, MediaDto, PUBLICATION_KINDS, PublicationAdmin, PublicationKind, PublicationRequest, TitledText } from '../../../core/api/models';
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
import { pickText, readTranslations, translationGroup, writeTranslations } from '../../../shared/util/forms';

@Component({
  selector: 'app-publication-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, LangTabsComponent, RichTextEditorComponent, MediaFieldComponent, StatusActionsComponent, FieldErrorComponent, ApiErrorBannerComponent, ErrorStateComponent, AppDatePipe],
  templateUrl: './publication-form.html',
})
export class PublicationFormComponent extends ContentFormPage<PublicationAdmin, PublicationRequest> {
  protected override readonly api = inject(PublicationsApi);
  protected override readonly listRoute = '/admin/publications';
  protected readonly langs = LANGS;
  protected readonly kinds = PUBLICATION_KINDS;
  protected readonly categories = signal<CategoryAdmin[]>([]);

  protected override readonly form = new FormGroup({
    kind: new FormControl<PublicationKind>('MAGAZINE_ISSUE', { nonNullable: true }),
    year: new FormControl<number>(new Date().getFullYear(), { nonNullable: true, validators: [Validators.required, Validators.min(1900), Validators.max(2100)] }),
    issueNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
    categoryId: new FormControl<number | null>(null),
    featured: new FormControl(false, { nonNullable: true }),
    coverImage: new FormControl<MediaDto | null>(null),
    pdfFile: new FormControl<MediaDto | null>(null),
    translations: translationGroup(['title', 'description'], { title: [Validators.maxLength(300)] }),
  });

  constructor() {
    super();
    this.init();
    inject(CategoriesApi).list('PUBLICATION').subscribe({ next: (c) => this.categories.set(c.filter((x) => x.active)), error: () => undefined });
  }

  protected dirOf(l: Lang) { return l === 'ar' ? 'rtl' : 'ltr'; }
  protected catName(c: CategoryAdmin) { return pickText(c.translations, this.lang.lang(), 'name') || c.slug; }
  protected tr(l: Lang) { return this.form.controls.translations.get(l); }
  protected override displayName() { return pickText(this.entity()?.translations, this.lang.lang(), 'title'); }

  protected override patch(e: PublicationAdmin): void {
    this.form.patchValue({ kind: e.kind, year: e.year, issueNumber: e.issueNumber ?? '', categoryId: e.categoryId, featured: e.featured, coverImage: e.coverImage, pdfFile: e.pdfFile }, { emitEvent: false });
    writeTranslations(this.form.controls.translations, e.translations);
  }

  protected override buildRequest(): PublicationRequest {
    const v = this.form.getRawValue();
    return {
      kind: v.kind, year: v.year, issueNumber: v.issueNumber.trim() || null, categoryId: v.categoryId, featured: v.featured,
      coverImageId: v.coverImage?.id ?? null, pdfFileId: v.pdfFile?.id ?? null,
      translations: readTranslations<TitledText>(this.form.controls.translations),
    };
  }
}
