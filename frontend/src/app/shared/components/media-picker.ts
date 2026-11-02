import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MediaApi } from '../../core/api/admin-api';
import { ApiError, MediaDto } from '../../core/api/models';
import { ToastService } from '../../core/ui/toast.service';
import { debounced } from '../util/paged-list';
import { IconComponent } from './icon';
import { EmptyStateComponent, ErrorStateComponent } from './states';

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_PDF = 50 * 1024 * 1024;

/** Library browser + uploader used inside a modal. Emits the chosen file (also right after a successful upload). */
@Component({
  selector: 'app-media-picker',
  imports: [IconComponent, TranslocoPipe, EmptyStateComponent, ErrorStateComponent],
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1">
        <app-icon name="search" class="pointer-events-none absolute inset-y-0 start-3 text-muted" />
        <input type="search" class="input ps-9" [placeholder]="'media.search' | transloco" (input)="search($any($event.target).value)" />
      </div>
      <label class="btn btn-primary cursor-pointer">
        <app-icon [name]="uploading() ? 'loader-circle' : 'upload'" [class.animate-spin]="uploading()" />
        {{ 'media.upload' | transloco }}
        <input type="file" class="sr-only" [accept]="accept()" (change)="onFile($event)" [disabled]="uploading()" />
      </label>
    </div>
    <p class="hint">{{ 'media.limits' | transloco }}</p>

    <div class="mt-4" [attr.aria-busy]="loading()">
      @if (error(); as e) {
        <app-error-state [message]="e.message" (retry)="load(0)" />
      } @else if (loading() && !items().length) {
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">@for (i of [1,2,3,4,5,6,7,8]; track i) { <div class="skeleton aspect-square"></div> }</div>
      } @else if (!items().length) {
        <app-empty-state icon="images" title="media.empty" hint="media.emptyHint" />
      } @else {
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          @for (m of items(); track m.id) {
            <li>
              <button type="button" class="group block w-full overflow-hidden rounded-lg border border-line bg-surface text-start transition hover:border-primary hover:shadow-card focus-visible:border-primary" (click)="picked.emit(m)">
                <span class="grid aspect-square place-items-center bg-canvas">
                  @if (m.kind === 'IMAGE') { <img [src]="m.thumbnailUrl ?? m.url" [alt]="m.translations.fr?.altText ?? m.originalName" class="size-full object-cover" loading="lazy" /> }
                  @else { <app-icon name="file-text" class="text-4xl text-primary" /> }
                </span>
                <span class="block truncate px-2 py-1.5 text-xs font-medium" [attr.title]="m.originalName">{{ m.originalName }}</span>
              </button>
            </li>
          }
        </ul>
        @if (page() + 1 < totalPages()) {
          <div class="mt-4 text-center"><button type="button" class="btn btn-secondary btn-sm" (click)="load(page() + 1)" [disabled]="loading()">{{ 'common.loadMore' | transloco }}</button></div>
        }
      }
    </div>`,
})
export class MediaPickerComponent implements OnInit {
  private readonly api = inject(MediaApi);
  private readonly toast = inject(ToastService);
  readonly kind = input<'IMAGE' | 'PDF' | null>(null);
  readonly picked = output<MediaDto>();

  protected readonly items = signal<MediaDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly uploading = signal(false);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  private q = '';
  protected readonly search = debounced((v: string) => { this.q = v; this.load(0); });

  protected accept() { return this.kind() === 'PDF' ? 'application/pdf' : this.kind() === 'IMAGE' ? 'image/jpeg,image/png,image/gif,image/webp' : 'image/jpeg,image/png,image/gif,image/webp,application/pdf'; }

  ngOnInit() { this.load(0); }

  protected load(page: number) {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ q: this.q, kind: this.kind() ?? undefined, page, size: 16 }).subscribe({
      next: (p) => { this.items.set(page === 0 ? p.content : [...this.items(), ...p.content]); this.page.set(p.page); this.totalPages.set(p.totalPages); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  protected onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const isPdf = file.type === 'application/pdf';
    if (file.size > (isPdf ? MAX_PDF : MAX_IMAGE)) { this.toast.error('media.tooLarge'); return; }
    this.uploading.set(true);
    this.api.upload(file).subscribe({
      next: (m) => { this.uploading.set(false); this.toast.success('media.uploaded'); this.picked.emit(m); },
      error: (e: ApiError) => { this.uploading.set(false); this.toast.error(e.code === 'UNSUPPORTED_FILE_TYPE' ? 'media.badType' : e.message); },
    });
  }
}
