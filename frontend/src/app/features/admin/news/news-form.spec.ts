import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NewsAdmin } from '../../../core/api/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ADMIN, EDITOR, fail, respond, routeWith, settle, signIn, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { NewsFormComponent } from './news-form';

const API = '/api/admin/news';
const CATEGORIES = '/api/admin/categories';

const article = (o: Partial<NewsAdmin> = {}): NewsAdmin => ({
  id: 5, slug: 'grand-colloque', status: 'DRAFT', publishedAt: null, featured: false, categoryId: 2, featuredImage: null, tags: ['kenitra', 'colloque'],
  translations: { fr: { title: 'Grand colloque', summary: 'Résumé', content: '<p>Texte</p>' }, ar: { title: 'ملتقى كبير' } },
  translationStatus: [{ locale: 'fr', present: true, complete: true, missingFields: [] }, { locale: 'ar', present: true, complete: true, missingFields: [] }, { locale: 'en', present: false, complete: false, missingFields: ['title'] }],
  authorName: 'Amina', version: 0, createdAt: '2026-09-01T09:00:00Z', updatedAt: '2026-09-02T09:00:00Z', ...o,
});

describe('NewsFormComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<NewsFormComponent>;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;
  const input = (id: string) => el().querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!;
  const type = (id: string, value: string) => { const i = input(id); i.value = value; i.dispatchEvent(new Event('input')); };
  const save = async () => { [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.save'))!.click(); await settle(fixture); };

  async function open(opts: { id?: string; permissions?: string[] } = {}) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), routeWith({ params: opts.id ? { id: opts.id } : {} })] });
    signIn(opts.permissions ?? ADMIN);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(NewsFormComponent);
    await fixture.whenStable();
  }

  describe('creating an article', () => {
    beforeEach(async () => {
      await open();
      respond(http, CATEGORIES, [
        { id: 2, type: 'NEWS', slug: 'colloques', sortOrder: 1, active: true, translations: { fr: { name: 'Colloques' } }, usageCount: 0 },
        { id: 3, type: 'NEWS', slug: 'archives', sortOrder: 2, active: false, translations: { fr: { name: 'Anciennes' } }, usageCount: 0 },
      ]);
      await settle(fixture);
    });

    it('starts empty with the picture card first, in new-article mode', () => {
      expect(el().querySelector('h1')?.textContent).toContain('news.new');
      expect(el().querySelector('app-media-field')).not.toBeNull();
      expect(el().querySelector('app-media-field')?.closest('.card')?.textContent).toContain('news.coverTitle');
      expect(el().querySelector('app-status-actions')).toBeNull(); // nothing to publish yet
      expect(el().querySelector('button .lucide-eye, app-page-header button[class*="secondary"]')).toBeNull(); // no preview before the first save
    });

    it('offers only active categories', () => {
      const options = [...el().querySelectorAll<HTMLOptionElement>('select option')].map((o) => text(o));
      expect(options.some((o) => o === 'Colloques')).toBe(true);
      expect(options.some((o) => o === 'Anciennes')).toBe(false);
    });

    it('refuses to save an empty article, says why, and sends nothing', async () => {
      await save();
      http.expectNone(API);
      expect(TestBed.inject(ToastService).toasts().at(-1)).toMatchObject({ kind: 'error', message: 'form.invalid' });
    });

    it('refuses a language that has text but no title', async () => {
      type('summary-fr', 'Un résumé sans titre');
      await save();
      http.expectNone(API);
      expect(el().querySelector('.field-error')).not.toBeNull();
    });

    it('creates the article from one language only, normalising the tags, then opens it', async () => {
      type('title-ar', '  عنوان الخبر ');
      const tags = el().querySelector<HTMLInputElement>('input[formControlName="tagsText"]')!;
      tags.value = 'Colloque, kénitra، Colloque; ';
      tags.dispatchEvent(new Event('input'));
      await save();
      const req = http.expectOne({ method: 'POST', url: API });
      expect(req.request.body.slug).toBeNull();
      expect(req.request.body.tags).toEqual(['colloque', 'kénitra']);
      expect(Object.keys(req.request.body.translations)).toEqual(['ar']);
      expect(req.request.body.translations.ar.title).toBe('عنوان الخبر');
      req.flush(article({ id: 9 }), { status: 201, statusText: 'Created' });
      await settle(fixture);
      expect(router.navigate).toHaveBeenCalledWith(['/admin/news', 9], { replaceUrl: true });
      expect(TestBed.inject(ToastService).toasts().at(-1)).toMatchObject({ kind: 'success', message: 'common.saved' });
    });

    it('keeps the form and shows the reason when the server refuses', async () => {
      type('title-fr', 'Titre');
      await save();
      http.expectOne({ method: 'POST', url: API }).flush({ status: 409, code: 'SLUG_TAKEN', message: 'Another article already uses this address' }, { status: 409, statusText: 'Conflict' });
      await settle(fixture);
      expect(el().querySelector('app-api-error-banner [role="alert"]')).not.toBeNull();
      expect(TestBed.inject(ToastService).toasts().at(-1)?.kind).toBe('error');
      expect(input('title-fr').value).toBe('Titre');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('warns about unsaved changes only after something was typed', () => {
      const form = fixture.componentInstance;
      expect(form.hasUnsaved()).toBe(false);
      type('title-fr', 'Brouillon');
      el().querySelector<HTMLInputElement>('#title-fr')!.dispatchEvent(new Event('blur'));
      expect(form.hasUnsaved()).toBe(true);
    });
  });

  describe('editing an article', () => {
    async function openEditing(permissions = ADMIN, entity = article()) {
      await open({ id: '5', permissions });
      respond(http, `${API}/5`, entity);
      respond(http, CATEGORIES, []);
      await settle(fixture);
    }

    it('loads the article into the form: texts in each language, tags, slug and workflow panel', async () => {
      await openEditing();
      expect(el().querySelector('h1')?.textContent).toContain('news.edit');
      expect(input('title-fr').value).toBe('Grand colloque');
      expect(input('title-ar').value).toBe('ملتقى كبير');
      expect(input('title-en').value).toBe('');
      expect(el().querySelector<HTMLInputElement>('input[formControlName="tagsText"]')!.value).toBe('kenitra, colloque');
      expect(el().querySelector('app-status-actions')).not.toBeNull();
    });

    it('sets each language box right-to-left only for Arabic', async () => {
      await openEditing();
      expect(input('title-ar').getAttribute('dir')).toBe('rtl');
      expect(input('title-fr').getAttribute('dir')).toBe('ltr');
      expect(input('title-en').getAttribute('dir')).toBe('ltr');
    });

    it('updates with PUT, sending only the filled languages', async () => {
      await openEditing();
      type('title-fr', 'Titre modifié');
      await save();
      const req = http.expectOne({ method: 'PUT', url: `${API}/5` });
      expect(req.request.body.translations.fr.title).toBe('Titre modifié');
      expect(req.request.body.translations.en).toBeUndefined();
      expect(req.request.body.categoryId).toBe(2);
      req.flush(article({ translations: { fr: { title: 'Titre modifié' } } }));
      await settle(fixture);
      expect(router.navigate).not.toHaveBeenCalled(); // already on the right page
      expect(fixture.componentInstance.hasUnsaved()).toBe(false);
    });

    it('says the article could not be loaded and retries', async () => {
      await open({ id: '5' });
      fail(http, `${API}/5`, 404, 'NOT_FOUND', 'News not found');
      respond(http, CATEGORIES, []);
      await settle(fixture);
      expect(el().querySelector('app-error-state')?.textContent).toContain('News not found');
      el().querySelector<HTMLButtonElement>('app-error-state button')!.click();
      await settle(fixture);
      respond(http, `${API}/5`, article());
      await settle(fixture);
      expect(input('title-fr').value).toBe('Grand colloque');
    });

    it('shows the preview in the chosen language', async () => {
      await openEditing();
      const preview = [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.preview'))!;
      preview.click();
      await settle(fixture);
      const [req] = respond(http, `${API}/5/preview`, { id: 5, slug: 'grand-colloque', title: 'Aperçu du colloque', summary: null, content: '<p>Contenu</p>', seoTitle: null, seoDescription: null, publishedAt: null, category: null, tags: [], featured: false, image: null, locale: 'ar', fallback: false, availableLocales: ['ar'] });
      expect(req.request.params.get('lang')).toBe('ar');
      await settle(fixture);
      expect(document.body.textContent).toContain('Aperçu du colloque');
    });

    it('submits for review when the writer is not a publisher, saving pending edits first', async () => {
      await openEditing(EDITOR);
      type('title-fr', 'Titre à relire');
      const submit = [...el().querySelectorAll<HTMLButtonElement>('app-status-actions button')].find((b) => text(b).includes('workflow.submit'))!;
      submit.click();
      await settle(fixture);
      http.expectOne({ method: 'PUT', url: `${API}/5` }).flush(article({ translations: { fr: { title: 'Titre à relire' } } }));
      await settle(fixture);
      const status = http.expectOne({ method: 'PATCH', url: `${API}/5/status` });
      expect(status.request.body).toEqual({ status: 'PENDING_REVIEW' });
      status.flush(article({ status: 'PENDING_REVIEW' }));
      await settle(fixture);
      expect(TestBed.inject(ToastService).toasts().at(-1)?.message).toBe('workflow.statusChanged');
      expect(el().querySelector('app-status-actions app-status-badge')?.textContent).toContain('PENDING_REVIEW');
    });

    it('does not change the status when saving the pending edits failed', async () => {
      await openEditing(EDITOR);
      type('title-fr', 'Titre');
      [...el().querySelectorAll<HTMLButtonElement>('app-status-actions button')].find((b) => text(b).includes('workflow.submit'))!.click();
      await settle(fixture);
      http.expectOne({ method: 'PUT', url: `${API}/5` }).flush({ status: 500, code: 'X', message: 'x' }, { status: 500, statusText: 'x' });
      await settle(fixture);
      http.expectNone({ method: 'PATCH', url: `${API}/5/status` });
    });

    it('lets an administrator delete only after confirming, then returns to the list', async () => {
      await openEditing();
      [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.delete'))!.click();
      const confirm = TestBed.inject(ConfirmService);
      expect(confirm.request()?.params).toEqual({ name: 'ملتقى كبير' }); // named in the admin's language (Arabic by default)
      confirm.answer(true);
      await settle(fixture);
      http.expectOne({ method: 'DELETE', url: `${API}/5` }).flush(null, { status: 204, statusText: 'No Content' });
      await settle(fixture);
      expect(router.navigate).toHaveBeenCalledWith(['/admin/news']);
    });

    it('does not offer delete to a writer', async () => {
      await openEditing(EDITOR);
      expect([...el().querySelectorAll('app-page-header button')].some((b) => text(b).includes('common.delete'))).toBe(false);
    });
  });
});
