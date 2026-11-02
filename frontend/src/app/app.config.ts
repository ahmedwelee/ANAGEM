import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { DEFAULT_LANG } from './core/api/models';
import { authInterceptor } from './core/auth/auth.interceptor';
import { LangService, TranslocoHttpLoader } from './core/i18n/lang.service';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['fr', 'ar', 'en'],
        defaultLang: DEFAULT_LANG,
        fallbackLang: 'fr',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { logMissingKey: false },
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(() => inject(LangService).init()),
    // The API sends Cache-Control: no-store (Spring Security default); these public GETs are safe to hand from server to browser once. Requests with an Authorization header (admin) are never transferred.
    provideClientHydration(withHttpTransferCacheOptions({ includeNonCacheableRequests: true })),
  ],
};
