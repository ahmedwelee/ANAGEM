import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { mergeApplicationConfig, ApplicationConfig, Injectable } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { TRANSLOCO_LOADER, TranslocoLoader } from '@jsverse/transloco';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { HttpBackend } from '@angular/common/http';
import { API_ORIGIN, ApiOriginBackend } from './core/http/api-origin';
import { SITE_ORIGIN } from './core/seo/seo.service';

/** On the server the dictionaries are read from disk instead of fetched over HTTP: the built browser folder, or public/ when running `ng serve`. */
@Injectable()
class FileTranslocoLoader implements TranslocoLoader {
  async getTranslation(lang: string) {
    if (!/^(fr|ar|en)$/.test(lang)) return {};
    const candidates = [new URL(`../browser/i18n/${lang}.json`, import.meta.url), pathToFileURL(`${process.cwd()}/public/i18n/${lang}.json`)];
    for (const file of candidates) {
      try { return JSON.parse(await readFile(file, 'utf8')); } catch { /* try the next location */ }
    }
    return {};   // missing while the build extracts routes
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: TRANSLOCO_LOADER, useClass: FileTranslocoLoader },
    { provide: SITE_ORIGIN, useFactory: () => process.env['PUBLIC_BASE_URL'] ?? '' },
    { provide: HttpBackend, useClass: ApiOriginBackend },
    { provide: API_ORIGIN, useFactory: () => process.env['API_ORIGIN'] ?? 'http://localhost:8080' },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
