import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CategoriesApi, NewsApi } from '../../../core/api/admin-api';
import { ApiError, CategoryAdmin, LANGS, Lang, MediaDto, NewsAdmin, NewsDetail, NewsRequest, NewsText } from '../../../core/api/models';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { LangTabsComponent } from '../../../shared/components/lang-tabs';
import { MediaFieldComponent } from '../../../shared/components/media-field';
import { ModalComponent } from '../../../shared/components/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor';
import { ErrorStateComponent } from '../../../shared/components/states';
import { StatusActionsComponent } from '../../../shared/components/status-actions';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { ContentFormPage } from '../../../shared/util/content-form';
import { SLUG_PATTERN, pickText, readTranslations, translationGroup, writeTranslations } from '../../../shared/util/forms';

@Component({
  selector: 'app-news-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, LangTabsComponent, RichTextEditorComponent, MediaFieldComponent, StatusActionsComponent, FieldErrorComponent, ApiErrorBannerComponent, ErrorStateComponent, ModalComponent, AppDatePipe],
  templateUrl: './news-form.html',
})
export class NewsFormComponent extends ContentFormPage<NewsAdmin, NewsRequest> {
  protected override readonly api = inject(NewsApi);
  protected override readonly listRoute = '/admin/news';
  protected readonly langs = LANGS;
  protected readonly categories = signal<CategoryAdmin[]>([]);
  protected readonly previewOpen = signal(false);
  protected readonly previewData = signal<NewsDetail | null>(null);
  protected readonly previewError = signal<ApiError | null>(null);

  protected override readonly form = new FormGroup({
    slug: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(180), Validators.pattern(SLUG_PATTERN)] }),
    categoryId: new FormControl<number | null>(null),
    featured: new FormControl(false, { nonNullable: true }),
    tagsText: new FormControl('', { nonNullable: true }),
    featuredImage: new FormControl<MediaDto | null>(null),
    translations: translationGroup(['title', 'summary', 'content', 'seoTitle', 'seoDescription'], {
      title: [Validators.maxLength(300)], summary: [Validators.maxLength(1000)], seoTitle: [Validators.maxLength(300)], seoDescription: [Validators.maxLength(500)],
    }),
  });

  constructor() {
    super();
    this.init();
    inject(CategoriesApi).list('NEWS').subscribe({ next: (c) => this.categories.set(c.filter((x) => x.active)), error: () => undefined });
  }

  protected dirOf(l: Lang) { return l === 'ar' ? 'rtl' : 'ltr'; }
  protected catName(c: CategoryAdmin) { return pickText(c.translations, this.lang.lang(), 'name') || c.slug; }
  protected tr(l: Lang) { return this.form.controls.translations.get(l); }

  protected override displayName(): string { return pickText(this.entity()?.translations, this.lang.lang(), 'title') || this.entity()?.slug || ''; }

  protected override patch(e: NewsAdmin): void {
    this.form.patchValue({ slug: e.slug, categoryId: e.categoryId, featured: e.featured, tagsText: e.tags.join(', '), featuredImage: e.featuredImage }, { emitEvent: false });
    writeTranslations(this.form.controls.translations, e.translations);
  }

  protected override buildRequest(): NewsRequest {
    const v = this.form.getRawValue();
    return {
      slug: v.slug.trim() || null,
      categoryId: v.categoryId,
      featuredImageId: v.featuredImage?.id ?? null,
      featured: v.featured,
      tags: [...new Set(v.tagsText.split(/[,،;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))],
      translations: readTranslations<NewsText>(this.form.controls.translations),
    };
  }

  protected openPreview() {
    const id = this.entity()?.id;
    if (!id) return;
    this.previewData.set(null);
    this.previewError.set(null);
    this.previewOpen.set(true);
    this.api.preview(id, this.activeLang()).subscribe({ next: (p) => this.previewData.set(p), error: (e: ApiError) => this.previewError.set(e) });
  }
}
