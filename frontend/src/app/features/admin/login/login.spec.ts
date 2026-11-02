import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { loginResponse, provideAppTesting } from '../../../../testing/test-providers';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
  });
  afterEach(() => localStorage.clear());

  const el = () => fixture.nativeElement as HTMLElement;
  const type = (id: string, value: string) => { const i = el().querySelector<HTMLInputElement>('#' + id)!; i.value = value; i.dispatchEvent(new Event('input')); };
  const submit = async () => { el().querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit')); await fixture.whenStable(); };
  const alert = () => el().querySelector('[role="alert"]')?.textContent?.trim();

  it('does not call the server until the form is valid, and says what is wrong', async () => {
    await submit();
    http.expectNone('/api/auth/login');
    const errors = [...el().querySelectorAll('.field-error')].map((e) => e.textContent?.trim());
    expect(errors).toEqual(['validation.required', 'validation.required']);

    type('email', 'not-an-email'); type('password', 'x');
    await submit();
    http.expectNone('/api/auth/login');
    expect(el().querySelector('.field-error')?.textContent?.trim()).toBe('validation.email');
  });

  it('signs in with the trimmed e-mail and goes to the dashboard', async () => {
    type('email', '  editor@anagem.test '); type('password', 'secret');
    await submit();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'editor@anagem.test', password: 'secret' });
    req.flush(loginResponse(['CONTENT_WRITE']));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it.each([
    ['/admin/news/3', '/admin/news/3'],
    ['/admin/login', '/admin'],
    ['https://evil.example/admin', '/admin'],
    ['//evil.example', '/admin'],
    ['/public', '/admin'],
  ])('redirect=%s leads to %s (no open redirects)', async (redirect, expected) => {
    fixture.componentRef.setInput('redirect', redirect);
    type('email', 'a@b.test'); type('password', 'x');
    await submit();
    http.expectOne('/api/auth/login').flush(loginResponse([]));
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(expected);
  });

  it.each([
    [401, 'INVALID_CREDENTIALS', 'login.invalid'],
    [429, 'RATE_LIMITED', 'login.tooMany'],
    [500, 'INTERNAL', 'login.failed'],
  ])('shows the right message for a %s (%s)', async (status, code, key) => {
    type('email', 'a@b.test'); type('password', 'x');
    await submit();
    http.expectOne('/api/auth/login').flush({ code, message: 'm' }, { status, statusText: 's' });
    await fixture.whenStable();
    expect(alert()).toContain(key);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('can reveal and hide the password', async () => {
    const pw = () => el().querySelector<HTMLInputElement>('#password')!;
    expect(pw().type).toBe('password');
    el().querySelector<HTMLButtonElement>('#password + button')!.click();
    await fixture.whenStable();
    expect(pw().type).toBe('text');
  });
});
