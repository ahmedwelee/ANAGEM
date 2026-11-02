import { HttpParams } from '@angular/common/http';

/** Builds query params, skipping null / undefined / empty values. */
export function params(values: Record<string, string | number | boolean | null | undefined>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  return p;
}
