import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANGS, Lang } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { IconComponent } from '../../../shared/components/icon';

interface NavItem { path: string; icon: string; label: string; perms: string[]; exact?: boolean }
interface NavGroup { label: string | null; items: NavItem[] }

const NAV: NavGroup[] = [
  { label: null, items: [{ path: '/admin', icon: 'layout-dashboard', label: 'nav.dashboard', perms: ['DASHBOARD_VIEW'], exact: true }] },
  { label: 'nav.content', items: [
    { path: '/admin/news', icon: 'newspaper', label: 'nav.news', perms: ['CONTENT_WRITE'] },
    { path: '/admin/publications', icon: 'book-open', label: 'nav.publications', perms: ['CONTENT_WRITE'] },
    { path: '/admin/events', icon: 'calendar-days', label: 'nav.events', perms: ['CONTENT_WRITE'] },
    { path: '/admin/resources', icon: 'folder-open', label: 'nav.resources', perms: ['CONTENT_WRITE'] },
    { path: '/admin/media', icon: 'images', label: 'nav.media', perms: ['MEDIA_UPLOAD', 'CONTENT_WRITE'] },
    { path: '/admin/categories', icon: 'tags', label: 'nav.categories', perms: ['CATEGORY_MANAGE', 'CONTENT_WRITE'] },
  ] },
  { label: 'nav.site', items: [
    { path: '/admin/homepage', icon: 'layout-template', label: 'nav.homepage', perms: ['HOMEPAGE_MANAGE'] },
    { path: '/admin/partners', icon: 'handshake', label: 'nav.partners', perms: ['PARTNER_MANAGE'] },
    { path: '/admin/settings', icon: 'settings', label: 'nav.settings', perms: ['SETTINGS_MANAGE'] },
  ] },
  { label: 'nav.administration', items: [
    { path: '/admin/messages', icon: 'mail', label: 'nav.messages', perms: ['MESSAGES_VIEW'] },
    { path: '/admin/users', icon: 'users', label: 'nav.users', perms: ['USER_MANAGE', 'ROLE_MANAGE'] },
    { path: '/admin/audit', icon: 'history', label: 'nav.audit', perms: ['AUDIT_VIEW'] },
  ] },
];

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, TranslocoPipe],
  templateUrl: './admin-shell.html',
})
export class AdminShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  private readonly router = inject(Router);
  protected readonly langs = LANGS;
  protected readonly menuOpen = signal(false);
  protected readonly userMenu = signal(false);

  protected readonly groups = computed(() =>
    NAV.map((g) => ({ ...g, items: g.items.filter((i) => this.auth.canAny(...i.perms)) })).filter((g) => g.items.length),
  );

  protected setLang(l: Lang) { void this.lang.set(l); }
  protected logout() { this.userMenu.set(false); this.auth.logout(); }
  protected goProfile() { this.userMenu.set(false); void this.router.navigate(['/admin/profile']); }
  protected initials() { return (this.auth.user()?.fullName ?? '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join(''); }
}
