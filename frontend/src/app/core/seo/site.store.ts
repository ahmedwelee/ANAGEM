import { Injectable, inject, signal } from '@angular/core';
import { Lang } from '../api/models';
import { PublicApi, Settings } from '../api/public-api';

/** Public site settings (name, contact, social links, maintenance flag) for the current language. Loaded once per language. */
@Injectable({ providedIn: 'root' })
export class SiteStore {
  private readonly api = inject(PublicApi);
  readonly settings = signal<Settings>({});
  private loaded: Lang | null = null;
  private pending: Promise<void> | null = null;

  /** Resolves once settings for `lang` are available (failures leave defaults so pages still render). */
  load(lang: Lang): Promise<void> {
    if (this.loaded === lang) return Promise.resolve();
    this.pending = new Promise<void>((resolve) =>
      this.api.settings(lang).subscribe({ next: (s) => { this.settings.set(s); this.loaded = lang; resolve(); }, error: () => resolve() }),
    );
    return this.pending;
  }

  text(key: string): string { const v = this.settings()[key]; return typeof v === 'string' ? v : ''; }
  get siteName(): string { return this.text('site.name') || 'ANAGEM'; }
}
