import { PlatformLocation } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../testing/test-providers';
import { LangService } from './lang.service';

describe('LangService', () => {
  const setup = (pathname = '/') => {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), { provide: PlatformLocation, useValue: { pathname } }] });
    return TestBed.inject(LangService);
  };
  beforeEach(() => { localStorage.clear(); document.cookie = 'anagem_lang=; Max-Age=0; Path=/'; document.documentElement.removeAttribute('dir'); });

  it('switches <html lang> and dir, right-to-left for Arabic only', async () => {
    const svc = setup();
    await svc.set('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(svc.dir()).toBe('rtl');
    expect(svc.locale()).toBe('ar-MA');
    await svc.set('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(svc.locale()).toBe('en-GB');
  });

  it('remembers the admin language but not when told not to', async () => {
    const svc = setup();
    await svc.set('en');
    expect(localStorage.getItem('anagem.admin.lang')).toBe('en');
    await svc.set('ar', false);
    expect(localStorage.getItem('anagem.admin.lang')).toBe('en');
  });

  it('Arabic is the default language: nothing saved, or junk saved, means Arabic', async () => {
    expect(setup('/admin').lang()).toBe('ar');
    await TestBed.inject(LangService).init();
    expect(TestBed.inject(LangService).lang()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    TestBed.resetTestingModule();
    localStorage.setItem('anagem.admin.lang', 'de');
    await setup('/admin').init();
    expect(TestBed.inject(LangService).lang()).toBe('ar');
  });

  it('admin start-up still respects a language the user chose', async () => {
    localStorage.setItem('anagem.admin.lang', 'fr');
    await setup('/admin/news').init();
    expect(TestBed.inject(LangService).lang()).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('public start-up takes the language from the URL, whatever was saved for the admin', async () => {
    localStorage.setItem('anagem.admin.lang', 'fr');
    const svc = setup('/ar/news');
    await svc.init();
    expect(svc.lang()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('anagem.admin.lang')).toBe('fr');
  });

  it('public pages remember the language in a cookie so "/" can redirect next time', async () => {
    const svc = setup();
    await svc.setPublic('en');
    expect(document.cookie).toContain('anagem_lang=en');
    expect(svc.lang()).toBe('en');
  });
});
