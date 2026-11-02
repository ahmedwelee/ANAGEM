import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { ContactComponent } from './contact';

describe('Public ContactComponent', () => {
  let fixture: ComponentFixture<ContactComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ContactComponent);
    await fixture.whenStable();
  });
  const el = () => fixture.nativeElement as HTMLElement;
  const fill = (id: string, value: string) => { const i = el().querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!; i.value = value; i.dispatchEvent(new Event('input')); };
  const submit = async () => { el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit')); await fixture.whenStable(); };
  const fillValid = () => { fill('c-name', '  Amina Alaoui '); fill('c-email', 'amina@example.org'); fill('c-subject', 'Adhésion'); fill('c-message', 'Bonjour, comment adhérer à l\'association ?'); };

  it('shows the contact form and no request is sent when it is invalid', async () => {
    await submit();
    http.expectNone('/api/public/contact');
    expect([...el().querySelectorAll('.field-error')].map((e) => e.textContent?.trim())).toEqual(['validation.required', 'validation.required', 'validation.required']);
  });

  it('rejects a message that is too short', async () => {
    fillValid(); fill('c-message', 'court');
    await submit();
    http.expectNone('/api/public/contact');
    expect(el().querySelector('.field-error')?.textContent).toContain('validation.minlength');
  });

  it('sends the trimmed message in the visitor language and confirms', async () => {
    await TestBed.inject(LangService).set('ar');
    fillValid();
    await submit();
    const req = http.expectOne('/api/public/contact');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Amina Alaoui', email: 'amina@example.org', subject: 'Adhésion', message: 'Bonjour, comment adhérer à l\'association ?', locale: 'ar', website: '' });
    req.flush({ received: true }, { status: 201, statusText: 'Created' });
    await fixture.whenStable();
    expect(el().textContent).toContain('public.contactSent');
    expect(el().querySelector('form')).toBeNull();
  });

  it('lets the visitor write another message after sending one', async () => {
    fillValid(); await submit();
    http.expectOne('/api/public/contact').flush({ received: true });
    await fixture.whenStable();
    [...el().querySelectorAll('button')].find((b) => b.textContent?.includes('public.sendAnother'))!.click();
    await fixture.whenStable();
    expect(el().querySelector('form')).not.toBeNull();
    expect(el().querySelector<HTMLInputElement>('#c-name')!.value).toBe('');
  });

  it('hides the honeypot from people and assistive technology', () => {
    const trap = el().querySelector('#c-website')!;
    expect(trap.getAttribute('tabindex')).toBe('-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it.each([[429, 'public.contactTooMany'], [400, 'public.contactError'], [500, 'public.contactError']])('explains a %s failure and keeps what was typed', async (status, key) => {
    fillValid(); await submit();
    http.expectOne('/api/public/contact').flush({ code: 'X', message: 'm' }, { status, statusText: 's' });
    await fixture.whenStable();
    expect(el().querySelector('[role="alert"]')?.textContent).toContain(key);
    expect(el().querySelector<HTMLInputElement>('#c-name')!.value).toBe('  Amina Alaoui ');
  });
});
