import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiError, Page } from '../../core/api/models';

/** Loading/paging state for an admin list screen (signals, so it works with zoneless change detection). */
export class PagedList<T> {
  readonly items = signal<T[]>([]);
  readonly page = signal(0);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);

  constructor(private readonly fetch: (page: number, size: number) => Observable<Page<T>>, readonly size = 20) {}

  load(page = this.page()): void {
    this.loading.set(true);
    this.error.set(null);
    this.fetch(page, this.size).subscribe({
      next: (p) => { this.items.set(p.content); this.page.set(p.page); this.total.set(p.totalElements); this.totalPages.set(p.totalPages); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }
}

/** Debounces a callback (search boxes). */
export function debounced<A extends unknown[]>(fn: (...a: A) => void, ms = 300): (...a: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
