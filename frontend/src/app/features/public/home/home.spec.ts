import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideAppTesting } from '../../../../testing/test-providers';
import { HomepageData } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { HomeComponent } from './home';

const page = (lang: 'fr' | 'ar', title: string): HomepageData => ({ lang, sections: { HERO: { title, description: `desc ${lang}` } }, news: [], events: [], featuredEvent: null, magazine: null, partners: [], settings: {} });

describe('HomeComponent', () => {
  beforeEach(() => {
    // jsdom has no IntersectionObserver (used by the scroll-reveal directive)
    (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    TestBed.configureTestingModule({ providers: provideAppTesting() });
  });

  it('reloads in the new language when the visitor switches language (regression: the hero and title kept the old language after a switch)', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    // Arabic is the default, so that is what loads first
    http.expectOne('/api/public/homepage?lang=ar').flush(page('ar', 'الجغرافيا في خدمة المجال'));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.getAttribute('aria-label')).toContain('الجغرافيا');

    await TestBed.inject(LangService).set('fr');
    await fixture.whenStable();
    http.expectOne('/api/public/homepage?lang=fr').flush(page('fr', 'La géographie au service du territoire'));
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.getAttribute('aria-label')).toContain('La géographie');
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe('desc fr');
    expect(TestBed.inject(Meta).getTag('property="og:locale"')?.content).toBe('fr_MA');
  });
});
