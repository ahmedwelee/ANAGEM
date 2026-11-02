import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { MediaDto } from '../../core/api/models';
import { IconComponent } from './icon';
import { MediaPickerComponent } from './media-picker';
import { ModalComponent } from './modal';

/** Form control holding a MediaDto (or null): preview + choose / replace / remove. Save the id with `value?.id`. */
@Component({
  selector: 'app-media-field',
  imports: [IconComponent, TranslocoPipe, ModalComponent, MediaPickerComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MediaFieldComponent), multi: true }],
  template: `
    @if (variant() === 'portrait') {
      <div class="flex items-start gap-4">
        <div class="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-[4px_10px_10px_4px] border border-line bg-gradient-to-br from-primary-soft to-canvas shadow-card sm:w-36">
          @if (value(); as v) {
            @if (v.kind === 'IMAGE') { <img [src]="v.thumbnailUrl ?? v.url" alt="" class="absolute inset-0 size-full object-cover" /> }
          } @else {
            <button type="button" class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-primary transition hover:bg-surface/70" [disabled]="disabled()" (click)="open.set(true)">
              <app-icon name="image-plus" class="text-3xl" /><span class="text-sm font-semibold">{{ 'media.addImage' | transloco }}</span>
            </button>
          }
        </div>
        <div class="min-w-0 flex-1 space-y-2 text-sm">
          @if (value(); as v) {
            <span class="block truncate font-semibold" [attr.title]="v.originalName">{{ v.originalName }}</span><span class="block text-xs text-muted">{{ size(v) }}</span>
            <div class="flex flex-wrap gap-2 pt-1">
              <button type="button" class="btn btn-secondary btn-sm" [disabled]="disabled()" (click)="open.set(true)">{{ 'media.replace' | transloco }}</button>
              <button type="button" class="btn btn-danger-ghost btn-sm" [disabled]="disabled()" (click)="set(null)"><app-icon name="x" />{{ 'common.remove' | transloco }}</button>
            </div>
          } @else { <span class="text-muted">{{ 'media.none' | transloco }}</span> }
        </div>
      </div>
    } @else if (variant() === 'cover') {
      <div class="overflow-hidden rounded-lg border border-line bg-canvas">
        <div class="relative grid aspect-[16/7] place-items-center bg-gradient-to-br from-primary-soft to-canvas">
          @if (value(); as v) {
            @if (v.kind === 'IMAGE') { <img [src]="v.url" alt="" class="absolute inset-0 size-full object-cover" /> }
          } @else {
            <button type="button" class="flex flex-col items-center gap-2 rounded-lg px-6 py-4 text-primary transition hover:bg-surface/70" [disabled]="disabled()" (click)="open.set(true)">
              <app-icon name="image-plus" class="text-4xl" /><span class="font-semibold">{{ 'media.addImage' | transloco }}</span>
            </button>
          }
        </div>
        @if (value(); as v) {
          <div class="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2">
            <span class="min-w-0 flex-1 text-sm"><span class="block truncate font-semibold" [attr.title]="v.originalName">{{ v.originalName }}</span><span class="text-xs text-muted">{{ size(v) }}</span></span>
            <button type="button" class="btn btn-secondary btn-sm" [disabled]="disabled()" (click)="open.set(true)">{{ 'media.replace' | transloco }}</button>
            <button type="button" class="btn btn-danger-ghost btn-sm" [disabled]="disabled()" (click)="set(null)"><app-icon name="x" />{{ 'common.remove' | transloco }}</button>
          </div>
        }
      </div>
    } @else {
    <div class="flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-canvas p-3">
      <span class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-surface text-primary">
        @if (value(); as v) {
          @if (v.kind === 'IMAGE') { <img [src]="v.thumbnailUrl ?? v.url" alt="" class="size-full object-cover" /> } @else { <app-icon name="file-text" class="text-2xl" /> }
        } @else { <app-icon [name]="kind() === 'PDF' ? 'file-text' : 'image-plus'" class="text-2xl text-muted" /> }
      </span>
      <span class="min-w-0 flex-1 text-sm">
        @if (value(); as v) { <span class="block truncate font-semibold" [attr.title]="v.originalName">{{ v.originalName }}</span><span class="text-xs text-muted">{{ size(v) }}</span> }
        @else { <span class="text-muted">{{ 'media.none' | transloco }}</span> }
      </span>
      <button type="button" class="btn btn-secondary btn-sm" [disabled]="disabled()" (click)="open.set(true)">{{ (value() ? 'media.replace' : 'media.choose') | transloco }}</button>
      @if (value()) { <button type="button" class="btn btn-danger-ghost btn-sm btn-icon" [disabled]="disabled()" (click)="set(null)" [attr.aria-label]="'common.remove' | transloco"><app-icon name="x" /></button> }
    </div>
    }
    <app-modal [open]="open()" title="media.pickTitle" width="52rem" (closed)="open.set(false)">
      @if (open()) { <app-media-picker [kind]="kind()" (picked)="set($event); open.set(false)" /> }
    </app-modal>`,
})
export class MediaFieldComponent implements ControlValueAccessor {
  readonly kind = input<'IMAGE' | 'PDF' | null>(null);
  /** 'row' = compact thumbnail row; 'cover' = large 16:7 preview; 'portrait' = 3:4 book-cover preview. Cover and portrait show an "Add a picture" button when empty. */
  readonly variant = input<'row' | 'cover' | 'portrait'>('row');
  protected readonly value = signal<MediaDto | null>(null);
  protected readonly open = signal(false);
  protected readonly disabled = signal(false);
  private onChange: (v: MediaDto | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: MediaDto | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: MediaDto | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: MediaDto | null) { this.value.set(v); this.onChange(v); this.onTouched(); }
  protected size(m: MediaDto) { return m.sizeBytes > 1048576 ? (m.sizeBytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(m.sizeBytes / 1024)) + ' KB'; }
}
