import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SiteApi } from '../../../core/api/admin-api';
import { ApiError, LANGS, Lang, MediaDto, Setting } from '../../../core/api/models';
import { ToastService } from '../../../core/ui/toast.service';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { IconComponent } from '../../../shared/components/icon';
import { MediaFieldComponent } from '../../../shared/components/media-field';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { MediaApi } from '../../../core/api/admin-api';

type FieldType = 'localized' | 'text' | 'email' | 'url' | 'bool' | 'langs' | 'lang' | 'media' | 'tz';
interface Field { key: string; type: FieldType }
interface Group { id: string; icon: string; fields: Field[] }

const GROUPS: Group[] = [
  { id: 'identity', icon: 'globe', fields: [{ key: 'site.name', type: 'localized' }, { key: 'site.short_name', type: 'text' }, { key: 'site.tagline', type: 'localized' }, { key: 'site.logo_media_id', type: 'media' }] },
  { id: 'contact', icon: 'mail', fields: [{ key: 'contact.email', type: 'email' }, { key: 'contact.phone', type: 'text' }, { key: 'contact.address', type: 'localized' }, { key: 'contact.map_url', type: 'url' }] },
  { id: 'social', icon: 'link', fields: [{ key: 'social.linkedin', type: 'url' }, { key: 'social.facebook', type: 'url' }, { key: 'social.x', type: 'url' }, { key: 'social.youtube', type: 'url' }] },
  { id: 'seo', icon: 'search', fields: [{ key: 'seo.default_title', type: 'localized' }, { key: 'seo.default_description', type: 'localized' }, { key: 'seo.og_image_media_id', type: 'media' }] },
  { id: 'languages', icon: 'languages', fields: [{ key: 'locales.enabled', type: 'langs' }, { key: 'locales.default', type: 'lang' }, { key: 'events.timezone', type: 'tz' }] },
  { id: 'maintenance', icon: 'triangle-alert', fields: [{ key: 'maintenance.enabled', type: 'bool' }, { key: 'maintenance.message', type: 'localized' }] },
  { id: 'membership', icon: 'users', fields: [{ key: 'membership.applications_enabled', type: 'bool' }] },
];

@Component({
  selector: 'app-settings',
  imports: [FormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, MediaFieldComponent, ErrorStateComponent, SkeletonRowsComponent, ApiErrorBannerComponent],
  templateUrl: './settings.html',
})
export class SettingsComponent {
  private readonly api = inject(SiteApi);
  private readonly mediaApi = inject(MediaApi);
  private readonly toast = inject(ToastService);
  protected readonly groups = GROUPS;
  protected readonly langs = LANGS;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly saveError = signal<ApiError | null>(null);
  protected values: Record<string, unknown> = {};
  private original: Record<string, unknown> = {};
  protected readonly dirtyKeys = signal<string[]>([]);
  protected readonly media = signal<Record<string, MediaDto | null>>({});

  constructor() { this.load(); }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.settings().subscribe({
      next: (list: Setting[]) => {
        this.original = Object.fromEntries(list.map((s) => [s.key, structuredClone(s.value)]));
        this.values = structuredClone(this.original);
        for (const g of GROUPS) for (const f of g.fields) if (f.type === 'localized' && f.key in this.values && (typeof this.values[f.key] !== 'object' || !this.values[f.key])) this.values[f.key] = { fr: '', ar: '', en: '' }; // only settings the server has: an unknown key would be reported as changed and refused
        for (const key of ['site.logo_media_id', 'seo.og_image_media_id']) { const id = this.values[key]; if (typeof id === 'string' && id) this.mediaApi.get(id).subscribe({ next: (m) => this.media.update((o) => ({ ...o, [key]: m })), error: () => undefined }); }
        this.dirtyKeys.set([]);
        this.loading.set(false);
      },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  protected loc(key: string): Record<Lang, string> { return this.values[key] as Record<Lang, string>; }
  protected str(key: string): string { const v = this.values[key]; return typeof v === 'string' ? v : ''; }
  protected has(key: string): boolean { return key in this.values; }
  protected enabledLangs(): string[] { return (this.values['locales.enabled'] as string[]) ?? []; }
  protected langOn(l: Lang): boolean { return this.enabledLangs().includes(l); }

  protected setStr(key: string, v: string) { this.values[key] = v; this.refresh(); }
  protected setLoc(key: string, l: Lang, v: string) { this.loc(key)[l] = v; this.refresh(); }
  protected setBool(key: string, v: boolean) { this.values[key] = v; this.refresh(); }
  protected toggleLang(l: Lang, on: boolean) {
    const cur = new Set(this.enabledLangs());
    on ? cur.add(l) : cur.delete(l);
    this.values['locales.enabled'] = LANGS.filter((x) => cur.has(x));
    this.refresh();
  }
  protected setMedia(key: string, m: MediaDto | null) { this.media.update((o) => ({ ...o, [key]: m })); this.values[key] = m?.id ?? null; this.refresh(); }

  private normalized(key: string): unknown {
    const v = this.values[key];
    if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
    if (v && typeof v === 'object' && !Array.isArray(v)) { const o = Object.fromEntries(Object.entries(v as Record<string, string>).map(([k, x]) => [k, (x ?? '').trim()])); return Object.values(o).every((x) => !x) ? null : o; }
    return v;
  }
  private refresh() {
    this.dirtyKeys.set(Object.keys(this.values).filter((k) => JSON.stringify(this.normalized(k)) !== JSON.stringify(this.normalizedOriginal(k))));
  }
  private normalizedOriginal(k: string): unknown {
    const v = this.original[k];
    if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
    if (v && typeof v === 'object' && !Array.isArray(v)) { const o = Object.fromEntries(Object.entries(v as Record<string, string>).map(([kk, x]) => [kk, (x ?? '').trim()])); return Object.values(o).every((x) => !x) ? null : o; }
    return v;
  }

  protected save() {
    const keys = this.dirtyKeys();
    if (!keys.length) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.api.updateSettings(Object.fromEntries(keys.map((k) => [k, this.normalized(k)]))).subscribe({
      next: () => { this.saving.set(false); this.toast.success('common.saved'); this.load(); },
      error: (e: ApiError) => { this.saving.set(false); this.saveError.set(e); },
    });
  }
}
