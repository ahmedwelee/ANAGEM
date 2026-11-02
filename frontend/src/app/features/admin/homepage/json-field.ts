import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MediaApi } from '../../../core/api/admin-api';
import { DEFAULT_LANG, LANGS, Lang, MediaDto } from '../../../core/api/models';
import { IconComponent } from '../../../shared/components/icon';
import { LangTabsComponent } from '../../../shared/components/lang-tabs';
import { MediaFieldComponent } from '../../../shared/components/media-field';

type Obj = Record<string, unknown>;
type Holder = Record<string | number, unknown>;
const LANG_KEYS = new Set<string>(LANGS);

/** Clone of a value with every string emptied, used to create a missing language version with the same shape. */
export function blankLike(v: unknown): unknown {
  if (typeof v === 'string') return '';
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Obj).map(([k, x]) => [k, blankLike(x)]));
  return v;
}

/**
 * Structure-driven editor for the CMS JSON used by homepage sections. Objects that carry fr/ar/en keys become language tabs,
 * arrays become editable lists, and "…MediaId" fields use the media library. Edits mutate the draft object in place.
 */
@Component({
  selector: 'app-json-field',
  imports: [FormsModule, TranslocoPipe, IconComponent, LangTabsComponent, MediaFieldComponent, JsonFieldComponent],
  template: `
    @switch (kind()) {
      @case ('localized') {
        <div class="rounded-lg border border-line bg-surface">
          <p class="px-3 pt-2.5 text-xs font-bold tracking-wide text-primary-dark uppercase rtl:tracking-normal rtl:normal-case">{{ label() }}</p>
          <app-lang-tabs [(active)]="tab" />
          <div class="space-y-3 p-3">
            @let lv = langValue(tab());
            @if (isText(lv)) {
              <textarea class="input" rows="2" [ngModel]="lv" (ngModelChange)="setLang(tab(), $event)" [attr.dir]="tab() === 'ar' ? 'rtl' : 'ltr'"></textarea>
            } @else {
              @for (k of keysOf(lv); track k) { <app-json-field [parent]="asHolder(lv)" [key]="k" [dir]="tab() === 'ar' ? 'rtl' : 'ltr'" (changed)="changed.emit()" /> }
            }
          </div>
          @if (siblings().length) {
            <div class="space-y-3 border-t border-line p-3">@for (k of siblings(); track k) { <app-json-field [parent]="asHolder(value())" [key]="k" (changed)="changed.emit()" /> }</div>
          }
        </div>
      }
      @case ('object') {
        <fieldset class="space-y-3 rounded-lg border border-line p-3">
          <legend class="px-1 text-xs font-bold text-primary-dark">{{ label() }}</legend>
          @for (k of keysOf(value()); track k) { <app-json-field [parent]="asHolder(value())" [key]="k" [dir]="dir()" (changed)="changed.emit()" /> }
        </fieldset>
      }
      @case ('array') {
        <div class="space-y-3">
          <div class="flex items-center justify-between"><span class="text-xs font-bold tracking-wide text-primary-dark uppercase rtl:tracking-normal rtl:normal-case">{{ label() }}</span>
            <button type="button" class="btn btn-secondary btn-sm" (click)="addItem()"><app-icon name="plus" />{{ 'homepage.addItem' | transloco }}</button></div>
          @for (item of asArray(value()); track $index) {
            <div class="rounded-lg border border-line bg-canvas p-3">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-semibold text-muted">#{{ $index + 1 }}</span>
                <span class="flex gap-1">
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" [disabled]="$index === 0" (click)="move($index, -1)" [attr.aria-label]="'homepage.moveUp' | transloco"><app-icon name="chevron-up" /></button>
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" [disabled]="$index === asArray(value()).length - 1" (click)="move($index, 1)" [attr.aria-label]="'homepage.moveDown' | transloco"><app-icon name="chevron-down" /></button>
                  <button type="button" class="btn btn-danger-ghost btn-icon btn-sm" (click)="removeItem($index)" [attr.aria-label]="'common.remove' | transloco"><app-icon name="trash-2" /></button>
                </span>
              </div>
              <app-json-field [parent]="asHolder(value())" [key]="$index" [bare]="true" (changed)="changed.emit()" />
            </div>
          }
          @if (!asArray(value()).length) { <p class="rounded-lg border border-dashed border-line-strong p-4 text-center text-sm text-muted">{{ 'homepage.noItems' | transloco }}</p> }
        </div>
      }
      @case ('media') {
        <div><span class="label">{{ label() }}</span><app-media-field [ngModel]="media()" (ngModelChange)="onMedia($event)" kind="IMAGE" /></div>
      }
      @case ('boolean') {
        <label class="flex items-center gap-3 text-sm"><input type="checkbox" class="check" [ngModel]="value()" (ngModelChange)="set($event)" /><span class="font-semibold">{{ label() }}</span></label>
      }
      @case ('number') {
        <div><label class="label">{{ label() }}</label><input type="number" class="input" [ngModel]="value()" (ngModelChange)="set($event === null || $event === '' ? 0 : +$event)" /></div>
      }
      @default {
        <div>
          <label class="label">{{ label() }}</label>
          @if (long()) { <textarea class="input" rows="3" [ngModel]="text()" (ngModelChange)="setText($event)" [attr.dir]="dir()"></textarea> }
          @else { <input class="input" [ngModel]="text()" (ngModelChange)="setText($event)" [attr.dir]="isUrlLike() ? 'ltr' : dir()" /> }
          @if (hint()) { <p class="hint">{{ hint() }}</p> }
        </div>
      }
    }`,
})
export class JsonFieldComponent {
  private readonly t = inject(TranslocoService);
  private readonly mediaApi = inject(MediaApi);
  readonly parent = input.required<Holder>();
  readonly key = input.required<string | number>();
  readonly bare = input(false);
  readonly dir = input<'ltr' | 'rtl'>('ltr');
  readonly changed = output<void>();
  protected readonly tab = signal<Lang>(DEFAULT_LANG);
  protected readonly media = signal<MediaDto | null>(null);
  private mediaLoaded = false;

  protected readonly value = computed(() => this.parent()[this.key()]);
  protected readonly label = computed(() => {
    const k = String(this.key());
    const tr = this.t.translate('homepage.fields.' + k);
    return tr !== 'homepage.fields.' + k ? tr : k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  });
  protected readonly hint = computed(() => { const k = 'homepage.hints.' + String(this.key()); const tr = this.t.translate(k); return tr !== k ? tr : ''; });

  protected readonly kind = computed<'localized' | 'object' | 'array' | 'media' | 'boolean' | 'number' | 'text'>(() => {
    const v = this.value(), k = String(this.key());
    if (Array.isArray(v)) return 'array';
    if (v && typeof v === 'object') return Object.keys(v).some((x) => LANG_KEYS.has(x)) ? 'localized' : 'object';
    if (k.endsWith('MediaId')) { this.loadMedia(); return 'media'; }
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    return 'text';
  });

  protected readonly siblings = computed(() => { const v = this.value(); return v && typeof v === 'object' ? Object.keys(v as Obj).filter((k) => !LANG_KEYS.has(k)) : []; });
  protected readonly text = computed(() => { const v = this.value(); return v === null || v === undefined ? '' : String(v); });
  protected long() { const k = String(this.key()); return /description|text|tagline|message|rights/i.test(k) || this.text().length > 90; }
  protected isUrlLike() { return /url|icon|^key$/i.test(String(this.key())); }

  protected asHolder(v: unknown): Holder { return (v ?? {}) as Holder; }
  protected asArray(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
  protected isText(v: unknown): v is string { return typeof v === 'string'; }
  protected keysOf(v: unknown): string[] { return v && typeof v === 'object' ? Object.keys(v as Obj) : []; }

  /** Language version, created on first access from the shape of an existing one so every language can be filled in. */
  protected langValue(l: Lang): unknown {
    const holder = this.value() as Obj;
    if (holder[l] === undefined || holder[l] === null) {
      const template = LANGS.map((x) => holder[x]).find((x) => x !== undefined && x !== null);
      holder[l] = blankLike(template ?? '');
    }
    return holder[l];
  }
  protected setLang(l: Lang, v: string) { (this.value() as Obj)[l] = v; this.changed.emit(); }

  protected set(v: unknown) { this.parent()[this.key()] = v; this.changed.emit(); }
  protected setText(v: string) {
    const cur = this.value();
    this.set(cur === null && v === '' ? null : typeof cur === 'number' ? Number(v) : cur === null && /^\d+$/.test(v) ? Number(v) : v);
  }

  protected addItem() {
    const arr = this.asArray(this.value());
    arr.push(arr.length ? blankLike(arr[0]) : {});
    this.changed.emit();
  }
  protected removeItem(i: number) { this.asArray(this.value()).splice(i, 1); this.changed.emit(); }
  protected move(i: number, d: number) { const a = this.asArray(this.value()); const [x] = a.splice(i, 1); a.splice(i + d, 0, x); this.changed.emit(); }

  private loadMedia() {
    if (this.mediaLoaded) return;
    this.mediaLoaded = true;
    const id = this.value();
    if (typeof id === 'string' && id) this.mediaApi.get(id).subscribe({ next: (m) => this.media.set(m), error: () => undefined });
  }
  protected onMedia(m: MediaDto | null) { this.media.set(m); this.set(m?.id ?? null); }
}
