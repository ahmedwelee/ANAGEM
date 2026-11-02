import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { authInterceptor } from '../app/core/auth/auth.interceptor';

/** Empty dictionaries: `translate(key)` returns the key, so specs assert on translation keys instead of copy that editors may change. */
class KeyLoader implements TranslocoLoader {
  getTranslation() { return of({}); }
}

export function provideAppTesting(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([authInterceptor])),   // same error mapping as the app: failures arrive as ApiError
    provideHttpClientTesting(),
    provideRouter([]),
    provideTransloco({ config: { availableLangs: ['fr', 'ar', 'en'], defaultLang: 'fr', fallbackLang: 'fr', reRenderOnLangChange: true, prodMode: true }, loader: KeyLoader }),
  ];
}

export function fakeUser(permissions: string[], overrides: Record<string, unknown> = {}) {
  return { id: 1, email: 'editor@anagem.test', fullName: 'Test User', role: 'EDITOR', permissions, enabled: true, preferredLocale: 'fr' as const, lastLoginAt: null, createdAt: '2026-01-01T00:00:00Z', ...overrides };
}

export function loginResponse(permissions: string[], expiresInMs = 3_600_000) {
  return { accessToken: 'tok-123', tokenType: 'Bearer', expiresAt: new Date(Date.now() + expiresInMs).toISOString(), user: fakeUser(permissions) };
}
