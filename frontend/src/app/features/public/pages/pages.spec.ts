import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { fail, respond, routeWith, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { LangService } from '../../../core/i18n/lang.service';
import { CmsPageComponent } from './cms-page';
import { PublicNotFoundComponent } from './not-found';

const page = (content: Record<string, unknown>) => ({ slug: 'about', content, updatedAt: '2026-01-01T00:00:00Z' });

describe('CmsPageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CmsPageComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function open(slug = 'about') {
    TestBed.configureTestingModule({ providers: [...provideAppTesting(), routeWith({ data: { slug } })] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CmsPageComponent);
    await fixture.whenStable();
  }

  it('loads the page named by the route in the visitor language', async () => {
    await open('legal');
    const [req] = respond(http, '/api/public/pages/legal', page({ title: 'Mentions légales', body: '<p>Texte</p>' }));
    expect(req.request.params.get('lang')).toBe('ar');
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe('Mentions légales');
    expect(el().querySelector('.rte-content')?.textContent).toBe('Texte');
    expect(TestBed.inject(Title).getTitle()).toBe('Mentions légales — ANAGEM');
  });

  it('shows the association page: numbered objectives, bodies, a join call and the statutes download', async () => {
    await open();
    respond(http, '/api/public/pages/about', page({
      title: "L'association", intro: 'Présentation', objectivesTitle: 'Objectifs', objectives: [{ text: 'Promouvoir la géographie' }, { text: 'Former' }],
      structureTitle: 'Organes', bodies: [{ name: 'Assemblée générale', text: 'Organe souverain' }], joinTitle: 'Adhérer', join: 'Contactez-nous', statutesMediaId: '6f1c2d3e-0000-4000-8000-000000000001',
    }));
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe("L'association");
    const objectives = [...el().querySelectorAll('ol li')].map((li) => text(li));
    expect(objectives).toHaveLength(2);
    expect(objectives[0]).toMatch(/^1\s*Promouvoir la géographie$/);
    expect(objectives[1]).toMatch(/^2\s*Former$/);
    expect(text(el().querySelector('h3'))).toBe('Assemblée générale');
    expect(el().querySelector('a[href="/ar/contact"]')).not.toBeNull();
    expect(el().querySelector('a[href*="6f1c2d3e-0000-4000-8000-000000000001"]')).not.toBeNull();
    expect(el().textContent).not.toContain('public.pageEmpty');
  });

  it('shows the member categories', async () => {
    await open('members');
    respond(http, '/api/public/pages/members', page({ title: 'Membres', categoriesTitle: 'Catégories', categories: [{ name: 'Membres actifs', text: 'Géographes' }, { name: 'Membres honoraires', text: 'Personnalités' }] }));
    await settle(fixture);
    expect([...el().querySelectorAll('h3')].map((h) => text(h))).toEqual(['Membres actifs', 'Membres honoraires']);
  });

  it('says so when a page has a title but nothing written yet', async () => {
    await open('privacy');
    respond(http, '/api/public/pages/privacy', page({ title: 'Données personnelles' }));
    await settle(fixture);
    expect(el().textContent).toContain('public.pageEmpty');
  });

  it('does not run scripts hidden in a page body', async () => {
    await open('legal');
    respond(http, '/api/public/pages/legal', page({ title: 'Légal', body: '<p>ok</p><script>window.__cmsPwned=1</script><img src=x onerror="window.__cmsPwned=1">' }));
    await settle(fixture);
    expect(el().querySelector('.rte-content script')).toBeNull();
    expect(el().querySelector('.rte-content')?.innerHTML).not.toContain('onerror');
    expect((window as unknown as Record<string, unknown>)['__cmsPwned']).toBeUndefined();
  });

  it('handles an unknown page (404, kept out of the index) and a failing server differently', async () => {
    await open('nope');
    fail(http, '/api/public/pages/nope', 404, 'NOT_FOUND');
    await settle(fixture);
    expect(el().querySelector('h1')?.textContent).toContain('errors.notFoundTitle');
    expect(el().querySelector('a')?.getAttribute('href')).toBe('/ar');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');

    TestBed.resetTestingModule();
    await open('about');
    fail(http, '/api/public/pages/about', 500, 'INTERNAL_ERROR', 'Panne');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Panne');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, '/api/public/pages/about', page({ title: 'Rétabli', body: '<p>x</p>' }));
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe('Rétabli');
  });

  it('reloads the page in the new language', async () => {
    await open();
    respond(http, '/api/public/pages/about', page({ title: 'الجمعية', body: '<p>x</p>' }));
    await settle(fixture);
    await TestBed.inject(LangService).set('en');
    await settle(fixture);
    const [req] = respond(http, '/api/public/pages/about', page({ title: 'The association', body: '<p>x</p>' }));
    expect(req.request.params.get('lang')).toBe('en');
    await settle(fixture);
    expect(text(el().querySelector('h1'))).toBe('The association');
  });
});

describe('PublicNotFoundComponent', () => {
  it('explains the page does not exist, links home in the visitor language and stays out of the index', async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const fixture = TestBed.createComponent(PublicNotFoundComponent);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('errors.notFoundTitle');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/ar');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
    expect(TestBed.inject(Title).getTitle()).toBe('404 — ANAGEM');
  });
});
