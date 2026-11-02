import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SUPER_ADMIN, fail, respond, settle, signIn, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { Setting } from '../../../core/api/models';
import { ToastService } from '../../../core/ui/toast.service';
import { SettingsComponent } from './settings';

const API = '/api/admin/settings';
const s = (key: string, value: unknown, isPublic = true): Setting => ({ key, value, isPublic, updatedAt: '2026-10-01T09:00:00Z' });
const STORED: Setting[] = [
  s('site.name', { fr: 'ANAGEM', ar: 'الجمعية', en: '' }), s('site.short_name', 'ANAGEM'), s('site.tagline', null), s('contact.email', 'contact@anagem.test'), s('contact.phone', null),
  s('social.linkedin', null), s('locales.enabled', ['fr', 'ar', 'en']), s('locales.default', 'ar'), s('events.timezone', 'Africa/Casablanca'), s('maintenance.enabled', false), s('maintenance.message', null),
];

describe('SettingsComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<SettingsComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const save = () => [...el().querySelectorAll<HTMLButtonElement>('app-page-header button')].find((b) => text(b).includes('common.save'))!;
  const type = (selector: string, v: string) => { const i = el().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!; i.value = v; i.dispatchEvent(new Event('input')); };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(SUPER_ADMIN);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    respond(http, API, STORED);
    await settle(fixture);
  });

  it('shows the stored values and nothing to save yet', () => {
    expect(el().querySelector<HTMLInputElement>('#site\\.short_name')!.value).toBe('ANAGEM');
    expect(el().querySelector<HTMLInputElement>('#contact\\.email')!.value).toBe('contact@anagem.test');
    expect(el().querySelector<HTMLTextAreaElement>('textarea[aria-label="settings.keys.site.name ar"]')!.value).toBe('الجمعية');
    expect(el().querySelector<HTMLSelectElement>('#locales\\.default')!.value).toBe('ar');
    expect(save().disabled).toBe(true);
  });

  it('only shows the settings the server knows about', () => {
    expect(el().querySelector('#social\\.facebook')).toBeNull();
    expect(el().querySelector('#social\\.linkedin')).not.toBeNull();
  });

  it('counts the changes and sends only the changed settings', async () => {
    type('#contact\\.email', ' nouveau@anagem.test ');
    type('textarea[aria-label="settings.keys.site.name en"]', 'National Association of Moroccan Geographers');
    await settle(fixture);
    expect(save().disabled).toBe(false);
    expect(text(save())).toContain('2');
    save().click();
    await settle(fixture);
    const req = http.expectOne({ method: 'PUT', url: API });
    expect(req.request.body).toEqual({ settings: { 'contact.email': 'nouveau@anagem.test', 'site.name': { fr: 'ANAGEM', ar: 'الجمعية', en: 'National Association of Moroccan Geographers' } } });
    req.flush(STORED);
    await settle(fixture);
    expect(TestBed.inject(ToastService).toasts().at(-1)).toMatchObject({ kind: 'success', message: 'common.saved' });
    respond(http, API, STORED); // reloaded
  });

  it('treats an emptied field as null and typing back the old value as no change', async () => {
    type('#contact\\.email', '');
    await settle(fixture);
    save().click();
    await settle(fixture);
    expect(http.expectOne({ method: 'PUT', url: API }).request.body).toEqual({ settings: { 'contact.email': null } });
  });

  it('is clean again when a change is reverted', async () => {
    type('#site\\.short_name', 'AN');
    await settle(fixture);
    expect(save().disabled).toBe(false);
    type('#site\\.short_name', 'ANAGEM');
    await settle(fixture);
    expect(save().disabled).toBe(true);
  });

  it('switches maintenance mode with a real boolean', async () => {
    const toggle = [...el().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((c) => c.closest('label')?.textContent?.includes('maintenance.enabled'))!;
    toggle.click();
    await settle(fixture);
    save().click();
    await settle(fixture);
    expect(http.expectOne({ method: 'PUT', url: API }).request.body).toEqual({ settings: { 'maintenance.enabled': true } });
  });

  it('keeps the enabled languages in the usual order', async () => {
    const boxes = [...el().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((c) => c.closest('label')?.textContent?.includes('lang.'));
    expect(boxes).toHaveLength(3);
    boxes[1].click(); // switch Arabic off
    await settle(fixture);
    boxes[1].click(); // and on again
    await settle(fixture);
    expect(save().disabled).toBe(true); // same list, same order: no change
    boxes[0].click(); // switch French off
    await settle(fixture);
    save().click();
    await settle(fixture);
    expect(http.expectOne({ method: 'PUT', url: API }).request.body).toEqual({ settings: { 'locales.enabled': ['ar', 'en'] } });
  });

  it('shows the server reason when a value is refused and keeps the edits', async () => {
    type('#contact\\.email', 'broken@');
    await settle(fixture);
    save().click();
    await settle(fixture);
    http.expectOne({ method: 'PUT', url: API }).flush({ status: 400, code: 'INVALID_SETTING', message: 'contact.email: not a valid email address' }, { status: 400, statusText: 'Bad Request' });
    await settle(fixture);
    expect(el().querySelector('app-api-error-banner [role="alert"]')?.textContent).toContain('not a valid email address');
    expect(el().querySelector<HTMLInputElement>('#contact\\.email')!.value).toBe('broken@');
    expect(save().disabled).toBe(false);
  });
});

describe('SettingsComponent loading', () => {
  it('shows a loading error and retries', async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    signIn(SUPER_ADMIN);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
    fail(http, API, 500, 'INTERNAL_ERROR', 'Hors service');
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Hors service');
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, API, STORED);
    await settle(fixture);
    expect(el.querySelector('#site\\.short_name')).not.toBeNull();
  });
});
