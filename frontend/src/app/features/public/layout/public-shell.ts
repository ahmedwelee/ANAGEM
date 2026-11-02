import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { LANGS, Lang } from '../../../core/api/models';
import { LangService } from '../../../core/i18n/lang.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';

interface Item { path: string; label: string; query?: Record<string, string> }
interface Menu { label: string; path: string; exact?: boolean; items?: Item[] }

@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, IconComponent],
  templateUrl: './public-shell.html',
})
export class PublicShellComponent {
  private readonly router = inject(Router);
  protected readonly site = inject(SiteStore);
  protected readonly lang = inject(LangService);
  protected readonly langs = LANGS;
  protected readonly year = new Date().getFullYear();
  protected readonly menuOpen = signal(false);
  protected readonly openSub = signal<string | null>(null);

  protected readonly menu: Menu[] = [
    { label: 'public.nav.home', path: '', exact: true },
    { label: 'public.nav.association', path: 'about', items: [{ path: 'about', label: 'public.nav.about' }, { path: 'news', label: 'public.nav.news' }] },
    { label: 'public.nav.publications', path: 'publications', items: [{ path: 'publications', label: 'public.nav.allPublications' }, { path: 'magazine', label: 'public.nav.magazine' }] },
    { label: 'public.nav.events', path: 'events', items: [{ path: 'events', label: 'public.nav.upcoming' }, { path: 'events', label: 'public.nav.past', query: { scope: 'PAST' } }] },
    { label: 'public.nav.members', path: 'members' },
    { label: 'public.nav.resources', path: 'resources' },
    { label: 'public.nav.contact', path: 'contact' },
  ];

  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  /** Same page in another language: swap the first URL segment, keep the rest. */
  protected readonly switchLinks = computed(() => {
    const [path, query = ''] = this.url().split('?');
    const rest = path.split('/').slice(2).join('/');
    return Object.fromEntries(LANGS.map((l) => [l, { path: `/${l}${rest ? '/' + rest : ''}`, query: Object.fromEntries(new URLSearchParams(query)) }])) as Record<Lang, { path: string; query: Record<string, string> }>;
  });

  protected readonly maintenance = computed(() => this.site.settings()['maintenance.enabled'] === true);
  protected readonly socials = computed(() => ['linkedin', 'facebook', 'x', 'youtube'].map((k) => ({ k, url: this.site.text('social.' + k) })).filter((s) => s.url));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => { this.menuOpen.set(false); this.openSub.set(null); });
  }

  protected search(ev: Event, input: HTMLInputElement) {
    ev.preventDefault();
    const q = input.value.trim();
    if (q) void this.router.navigate(['/', this.lang.lang(), 'search'], { queryParams: { q } });
  }

  protected toggleSub(label: string) { this.openSub.set(this.openSub() === label ? null : label); }
  protected iconFor(k: string) { return k === 'x' ? 'x-social' : k; }
}
