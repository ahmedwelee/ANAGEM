import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../testing/test-providers';
import { SiteStore } from './site.store';

describe('SiteStore', () => {
  const setup = () => { TestBed.configureTestingModule({ providers: provideAppTesting() }); return { store: TestBed.inject(SiteStore), http: TestBed.inject(HttpTestingController) }; };

  it('loads the settings once per language', async () => {
    const { store, http } = setup();
    const p = store.load('fr');
    http.expectOne('/api/public/settings?lang=fr').flush({ 'site.name': 'ANAGEM FR', 'contact.email': 'x@anagem.ma' });
    await p;
    expect(store.siteName).toBe('ANAGEM FR');
    expect(store.text('contact.email')).toBe('x@anagem.ma');
    await store.load('fr');
    http.expectNone('/api/public/settings?lang=fr');
    const q = store.load('ar');
    http.expectOne('/api/public/settings?lang=ar').flush({ 'site.name': 'أناجيم' });
    await q;
    expect(store.siteName).toBe('أناجيم');
  });

  it('still resolves when the API is down, so pages render with defaults', async () => {
    const { store, http } = setup();
    const p = store.load('fr');
    http.expectOne('/api/public/settings?lang=fr').flush('nope', { status: 500, statusText: 'Server Error' });
    await p;
    expect(store.siteName).toBe('ANAGEM');
    expect(store.text('contact.phone')).toBe('');
  });
});
