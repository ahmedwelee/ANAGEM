import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CategoriesApi, EventsApi } from '../../../core/api/admin-api';
import { CategoryAdmin, EVENT_TYPES, EventAdmin, EventRequest, EventText, EventType, LANGS, Lang, MediaDto } from '../../../core/api/models';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { LangTabsComponent } from '../../../shared/components/lang-tabs';
import { MediaFieldComponent } from '../../../shared/components/media-field';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { RichTextEditorComponent } from '../../../shared/components/rich-text-editor';
import { ErrorStateComponent } from '../../../shared/components/states';
import { StatusActionsComponent } from '../../../shared/components/status-actions';
import { ContentFormPage } from '../../../shared/util/content-form';
import { SLUG_PATTERN, URL_PATTERN, pickText, readTranslations, translationGroup, writeTranslations } from '../../../shared/util/forms';
import { isoToZoned, zonedToIso } from '../../../shared/util/zoned-time';

const endAfterStart = (g: AbstractControl): ValidationErrors | null => {
  const s = String(g.get('startsAt')?.value ?? ''), e = String(g.get('endsAt')?.value ?? '');
  return s && e && e < s ? { endBeforeStart: true } : null;
};

@Component({
  selector: 'app-event-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, LangTabsComponent, RichTextEditorComponent, MediaFieldComponent, StatusActionsComponent, FieldErrorComponent, ApiErrorBannerComponent, ErrorStateComponent],
  templateUrl: './event-form.html',
})
export class EventFormComponent extends ContentFormPage<EventAdmin, EventRequest> {
  protected override readonly api = inject(EventsApi);
  protected override readonly listRoute = '/admin/events';
  protected readonly langs = LANGS;
  protected readonly types = EVENT_TYPES;
  protected readonly categories = signal<CategoryAdmin[]>([]);

  protected override readonly form = new FormGroup({
    slug: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(180), Validators.pattern(SLUG_PATTERN)] }),
    type: new FormControl<EventType>('CONFERENCE', { nonNullable: true }),
    allDay: new FormControl(false, { nonNullable: true }),
    startsAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endsAt: new FormControl('', { nonNullable: true }),
    registrationUrl: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500), Validators.pattern(URL_PATTERN)] }),
    categoryId: new FormControl<number | null>(null),
    featured: new FormControl(false, { nonNullable: true }),
    image: new FormControl<MediaDto | null>(null),
    programFile: new FormControl<MediaDto | null>(null),
    translations: translationGroup(['title', 'description', 'location', 'organizer'], { title: [Validators.maxLength(300)], location: [Validators.maxLength(300)], organizer: [Validators.maxLength(300)] }),
  }, { validators: endAfterStart });

  constructor() {
    super();
    this.init();
    inject(CategoriesApi).list('EVENT').subscribe({ next: (c) => this.categories.set(c.filter((x) => x.active)), error: () => undefined });
  }

  protected dirOf(l: Lang) { return l === 'ar' ? 'rtl' : 'ltr'; }
  protected catName(c: CategoryAdmin) { return pickText(c.translations, this.lang.lang(), 'name') || c.slug; }
  protected tr(l: Lang) { return this.form.controls.translations.get(l); }
  protected override displayName() { return pickText(this.entity()?.translations, this.lang.lang(), 'title') || this.entity()?.slug || ''; }

  /** Switching "all day" converts the entered values between date and date+time forms. */
  protected onAllDayChange() {
    const day = this.form.controls.allDay.value;
    for (const c of [this.form.controls.startsAt, this.form.controls.endsAt]) c.setValue(day ? c.value.slice(0, 10) : c.value && c.value.length === 10 ? c.value + 'T09:00' : c.value);
  }

  protected override patch(e: EventAdmin): void {
    this.form.patchValue({
      slug: e.slug, type: e.type, allDay: e.allDay, startsAt: isoToZoned(e.startsAt, undefined, e.allDay), endsAt: isoToZoned(e.endsAt, undefined, e.allDay),
      registrationUrl: e.registrationUrl ?? '', categoryId: e.categoryId, featured: e.featured, image: e.image, programFile: e.programFile,
    }, { emitEvent: false });
    writeTranslations(this.form.controls.translations, e.translations);
  }

  protected override buildRequest(): EventRequest {
    const v = this.form.getRawValue();
    return {
      slug: v.slug.trim() || null, type: v.type, allDay: v.allDay, startsAt: zonedToIso(v.startsAt) ?? '', endsAt: v.endsAt ? zonedToIso(v.endsAt) : null,
      registrationUrl: v.registrationUrl.trim() || null, categoryId: v.categoryId, imageId: v.image?.id ?? null, programFileId: v.programFile?.id ?? null, featured: v.featured,
      translations: readTranslations<EventText>(this.form.controls.translations),
    };
  }
}
