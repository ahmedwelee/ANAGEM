import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { SiteStore } from '../../../core/seo/site.store';
import { PublicShellComponent } from './public-shell';

@Component({ template: '<p id="page">page</p>' })
class DummyPage {}

describe('PublicShellComponent', () => {
  let fixture: ComponentFixture<PublicShellComponent>;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;
  const langLinks = () => [...el().querySelectorAll<HTMLAnchorElement>('nav[aria-label="public.languages"] a')];

  async function open(url = '/ar', settings: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), provideRouter([{ path: '**', component: DummyPage }])] });
    TestBed.inject(SiteStore).settings.set(settings);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PublicShellComponent);
    await router.navigateByUrl(url);
    await fixture.whenStable();
  }

  it('renders the page inside the main landmark and offers a skip link', async () => {
    await open();
    expect(el().querySelector('main#main #page')).not.toBeNull();
    expect(el().querySelector('a[href="#main"]')).not.toBeNull();
  });

  it('the Home entries of the menu and the footer lead to the bare language address, never to "/ar/" (which showed "Page not found")', async () => {
    await open('/ar/news');
    const homeLinks = [...el().querySelectorAll<HTMLAnchorElement>('nav[aria-label="public.mainNav"] a, footer a')].filter((a) => text(a) === 'public.nav.home');
    expect(homeLinks.length).toBeGreaterThanOrEqual(2); // menu and footer
    for (const a of homeLinks) expect(a.getAttribute('href')).toBe('/ar');
  });

  it('lists the main sections of the site, in the visitor language', async () => {
    await open('/ar');
    const nav = el().querySelector('nav[aria-label="public.mainNav"]')!;
    const top = [...nav.querySelectorAll(':scope > div > ul > li')].map((li) => text(li.querySelector(':scope > a, :scope > button')));
    expect(top).toEqual(['public.nav.home', 'public.nav.association', 'public.nav.publications', 'public.nav.events', 'public.nav.members', 'public.nav.resources', 'public.nav.contact']);
    expect(nav.querySelector('a[href="/ar/members"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/ar/magazine"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/ar/events?scope=PAST"]')).not.toBeNull();
  });

  it('switches language on the same page, keeping the address and the query', async () => {
    await open('/ar/news?tag=colloque');
    expect(langLinks().map((a) => a.getAttribute('href'))).toEqual(['/fr/news?tag=colloque', '/ar/news?tag=colloque', '/en/news?tag=colloque']);
    expect(langLinks().map((a) => a.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    expect(langLinks().map((a) => a.getAttribute('hreflang'))).toEqual(['fr', 'ar', 'en']);
  });

  it('keeps nested addresses when switching language', async () => {
    await open('/en/publications/7');
    expect(langLinks().map((a) => a.getAttribute('href'))).toEqual(['/fr/publications/7', '/ar/publications/7', '/en/publications/7']);
  });

  it('shows the association contact details only when they are filled in', async () => {
    await open('/ar', {});
    expect(el().querySelector('a[href^="mailto:"]')).toBeNull();
    expect(el().querySelector('a[href^="tel:"]')).toBeNull();
    TestBed.resetTestingModule();
    await open('/ar', { 'contact.email': 'contact@example.org', 'contact.phone': '+212 5 00 00 00 00', 'contact.address': 'Rabat' });
    expect(el().querySelector('a[href="mailto:contact@example.org"]')).not.toBeNull();
    expect(el().querySelector('a[href="tel:+212500 00 00 00"]') ?? el().querySelector('a[href^="tel:"]')).not.toBeNull();
    expect(el().textContent).toContain('Rabat');
  });

  it('replaces the page with the maintenance message when maintenance mode is on', async () => {
    await open('/ar', { 'maintenance.enabled': true, 'maintenance.message': 'Retour demain.' });
    expect(el().querySelector('#page')).toBeNull();
    expect(el().querySelector('main h1')?.textContent).toContain('public.maintenanceTitle');
    expect(el().querySelector('main')?.textContent).toContain('Retour demain.');
  });

  it('sends the visitor to the search page with what was typed', async () => {
    await open('/ar');
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const input = el().querySelector<HTMLInputElement>('form[role="search"] input')!;
    input.value = '  atlas ';
    el().querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    expect(nav).toHaveBeenCalledWith(['/', 'ar', 'search'], { queryParams: { q: 'atlas' } });
    nav.mockClear();
    input.value = '   ';
    el().querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    expect(nav).not.toHaveBeenCalled();
  });

  it('opens and closes the phone menu, and closes it after moving to another page', async () => {
    await open('/ar');
    const burger = el().querySelector<HTMLButtonElement>('button[aria-controls="pub-menu"]')!;
    expect(burger.getAttribute('aria-expanded')).toBe('false');
    burger.click();
    await fixture.whenStable();
    expect(burger.getAttribute('aria-expanded')).toBe('true');
    await router.navigateByUrl('/ar/news');
    await fixture.whenStable();
    expect(burger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens one sub-menu at a time on touch screens', async () => {
    await open('/ar');
    const toggles = [...el().querySelectorAll<HTMLButtonElement>('nav[aria-label="public.mainNav"] button[aria-expanded]')].filter((b) => b.getAttribute('aria-controls') !== 'pub-menu');
    expect(toggles.length).toBeGreaterThanOrEqual(3);
    toggles[0].click();
    await fixture.whenStable();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    toggles[1].click();
    await fixture.whenStable();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
    toggles[1].click();
    await fixture.whenStable();
    expect(toggles[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('shows social links only for the networks the association filled in', async () => {
    await open('/ar', { 'social.linkedin': 'https://www.linkedin.com/company/anagem', 'social.x': 'https://x.com/anagem' });
    const footer = el().querySelector('footer')!;
    const links = [...footer.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')].map((a) => a.getAttribute('href'));
    expect(links).toContain('https://www.linkedin.com/company/anagem');
    expect(links).toContain('https://x.com/anagem');
    expect(links.some((l) => l?.includes('facebook'))).toBe(false);
  });
});
