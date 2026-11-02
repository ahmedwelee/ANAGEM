import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './icon';

@Component({
  selector: 'app-pagination',
  imports: [IconComponent, TranslocoPipe],
  template: `
    @if (totalPages() > 1 || total() > 0) {
      <nav class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted" [attr.aria-label]="'common.pagination' | transloco">
        <span>{{ 'common.showing' | transloco: { from: from(), to: to(), total: total() } }}</span>
        <span class="flex items-center gap-1">
          <button type="button" class="btn btn-secondary btn-sm btn-icon" [disabled]="page() === 0" (click)="pageChange.emit(page() - 1)" [attr.aria-label]="'common.previous' | transloco"><app-icon name="chevron-left" class="rtl:-scale-x-100" /></button>
          <span class="px-2 tabular-nums">{{ page() + 1 }} / {{ Math.max(totalPages(), 1) }}</span>
          <button type="button" class="btn btn-secondary btn-sm btn-icon" [disabled]="page() + 1 >= totalPages()" (click)="pageChange.emit(page() + 1)" [attr.aria-label]="'common.next' | transloco"><app-icon name="chevron-right" class="rtl:-scale-x-100" /></button>
        </span>
      </nav>
    }`,
})
export class PaginationComponent {
  protected readonly Math = Math;
  readonly page = input.required<number>();
  readonly size = input(20);
  readonly total = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();
  protected readonly from = computed(() => (this.total() === 0 ? 0 : this.page() * this.size() + 1));
  protected readonly to = computed(() => Math.min((this.page() + 1) * this.size(), this.total()));
}
