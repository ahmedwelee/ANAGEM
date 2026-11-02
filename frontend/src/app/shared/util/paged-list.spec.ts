import { of, throwError } from 'rxjs';
import { Page } from '../../core/api/models';
import { PagedList, debounced } from './paged-list';

const page = (content: number[], p = 0, total = 25): Page<number> => ({ content, page: p, size: 10, totalElements: total, totalPages: Math.ceil(total / 10) });

describe('PagedList', () => {
  it('loads a page and exposes paging state', () => {
    const fetch = vi.fn((p: number) => of(page([p], p)));
    const list = new PagedList<number>(fetch, 10);
    list.load(2);
    expect(fetch).toHaveBeenCalledWith(2, 10);
    expect(list.items()).toEqual([2]);
    expect(list.page()).toBe(2);
    expect(list.total()).toBe(25);
    expect(list.totalPages()).toBe(3);
    expect(list.loading()).toBe(false);
    expect(list.error()).toBeNull();
  });

  it('keeps the error and stops loading on failure, and clears it on the next success', () => {
    let fail = true;
    const list = new PagedList<number>(() => (fail ? throwError(() => ({ status: 500, code: 'X', message: 'boom' })) : of(page([1]))));
    list.load(0);
    expect(list.error()?.message).toBe('boom');
    expect(list.loading()).toBe(false);
    fail = false;
    list.load(0);
    expect(list.error()).toBeNull();
    expect(list.items()).toEqual([1]);
  });

  it('reloads the current page by default', () => {
    const fetch = vi.fn(() => of(page([], 3)));
    const list = new PagedList<number>(fetch, 5);
    list.load(3);
    list.load();
    expect(fetch).toHaveBeenLastCalledWith(3, 5);
  });
});

describe('debounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls once with the latest arguments', () => {
    const fn = vi.fn();
    const d = debounced(fn, 300);
    d('a'); d('ab'); d('abc');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('abc');
  });
});
