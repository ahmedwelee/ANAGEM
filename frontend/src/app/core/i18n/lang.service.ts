import { DOCUMENT, PlatformLocation } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoLoader, TranslocoService, Translation } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_LANG, LANGS, Lang } from '../api/models';

const KEY = 'anagem.admin.lang';
const LOCALES: Record<Lang, string> = { fr: 'fr-FR', ar: 'ar-MA', en: 'en-GB' };

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private http = inject(HttpClient);
  getTranslation(lang: string) { return this.http.get<Translation>(`/i18n/${lang}.json`); }
}

/** Admin interface language (FR / AR / EN). Sets <html lang dir> so Arabic renders right-to-left. */
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly transloco = inject(TranslocoService);
  private readonly doc = inject(DOCUMENT);
  private readonly location = inject(PlatformLocation);
  readonly lang = signal<Lang>(DEFAULT_LANG);
  readonly dir = computed<'ltr' | 'rtl'>(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  readonly locale = computed(() => LOCALES[this.lang()]);

  /** Called once at startup: loads the dictionary before the first render. Public URLs (/ar/…) decide their own language; the admin uses the saved one. */
  async init(): Promise<void> {
    const fromUrl = this.location.pathname.split('/')[1] ?? '';
    if ((LANGS as readonly string[]).includes(fromUrl)) return this.set(fromUrl as Lang, false);
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    await this.set((LANGS as readonly string[]).includes(stored ?? '') ? (stored as Lang) : DEFAULT_LANG, false);
  }

  /** Public site: the language is part of the URL; remember it in a cookie so `/` can redirect next time. */
  async setPublic(lang: Lang): Promise<void> {
    await this.set(lang, false);
    try { this.doc.cookie = `anagem_lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch { /* no cookies on the server */ }
  }

  async set(lang: Lang, persist = true): Promise<void> {
    this.transloco.setActiveLang(lang);
    try { await firstValueFrom(this.transloco.load(lang)); } catch { /* dictionary unavailable: keys fall back to their text */ }
    this.lang.set(lang);
    const root = this.doc.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (persist) { try { localStorage.setItem(KEY, lang); } catch { /* ignore */ } }
  }
}
