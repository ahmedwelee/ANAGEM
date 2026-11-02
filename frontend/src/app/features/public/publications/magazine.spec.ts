import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { fail, mediaRef, pageOf, publicationCard, respond, settle, text } from '../../../../testing/fixtures';
import { provideAppTesting } from '../../../../testing/test-providers';
import { MagazineComponent } from './magazine';

const PUBS = '/api/public/publications';

describe('MagazineComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<MagazineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MagazineComponent);
    await fixture.whenStable();
  });

  it('asks only for issues of the journal, 30 at most', async () => {
    const [req] = respond(http, PUBS, pageOf([]));
    expect(req.request.params.get('kind')).toBe('MAGAZINE_ISSUE');
    expect(req.request.params.get('size')).toBe('30');
  });

  it('puts the newest issue on top with its cover and PDF, and the others in the archive', async () => {
    respond(http, PUBS, pageOf([
      publicationCard({ id: 12, title: 'Numéro 12', issueNumber: '12', year: 2026, coverImage: mediaRef({ url: '/api/public/media/c12' }), pdfDownloadUrl: '/api/public/media/p12?download=true' }),
      publicationCard({ id: 11, title: 'Numéro 11', issueNumber: '11', year: 2025 }),
      publicationCard({ id: 10, title: 'Numéro 10', issueNumber: '10', year: 2025 }),
    ]));
    await settle(fixture);
    const latest = el().querySelector('section[aria-label="public.latestIssue"]')!;
    expect(text(latest.querySelector('h2'))).toBe('Numéro 12');
    expect(latest.querySelector('img')?.getAttribute('src')).toBe('/api/public/media/c12');
    expect(latest.querySelector('a[href="/ar/publications/12"]')).not.toBeNull();
    expect(latest.querySelector('a[href="/api/public/media/p12?download=true"]')).not.toBeNull();
    expect([...el().querySelectorAll('article h3')].map((h) => text(h))).toEqual(['Numéro 11', 'Numéro 10']);
    expect(el().textContent).toContain('public.archive');
  });

  it('has no archive section when there is a single issue', async () => {
    respond(http, PUBS, pageOf([publicationCard()]));
    await settle(fixture);
    expect(el().textContent).not.toContain('public.archive');
    expect(el().querySelectorAll('article')).toHaveLength(0);
  });

  it('shows a friendly message when no issue has been published yet', async () => {
    respond(http, PUBS, pageOf([]));
    await settle(fixture);
    expect(el().textContent).toContain('public.noIssues');
  });

  it('shows an error and loads again on retry', async () => {
    fail(http, PUBS, 500, 'INTERNAL_ERROR', 'Erreur serveur');
    await settle(fixture);
    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Erreur serveur');
    el().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle(fixture);
    respond(http, PUBS, pageOf([publicationCard({ title: 'Enfin' })]));
    await settle(fixture);
    expect(el().textContent).toContain('Enfin');
  });
});
