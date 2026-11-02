import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideAppTesting } from '../../../testing/test-providers';
import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('uses the dictionary entry for the error code when there is one', () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const t = TestBed.inject(TranslocoService);
    t.setTranslation({ apiErrors: { SLUG_TAKEN: 'Ce slug existe déjà' } }, 'fr');
    expect(apiErrorMessage(t, { status: 409, code: 'SLUG_TAKEN', message: 'Slug already used' })).toBe('Ce slug existe déjà');
  });

  it('falls back to the server message for unknown codes', () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const t = TestBed.inject(TranslocoService);
    expect(apiErrorMessage(t, { status: 500, code: 'SOMETHING_NEW', message: 'Server said no' })).toBe('Server said no');
  });
});
