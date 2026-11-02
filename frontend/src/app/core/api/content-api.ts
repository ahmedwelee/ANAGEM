import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Page, StatusChange } from './models';
import { params } from './api.util';

/** CRUD + workflow client shared by news, publications, events and resources (same endpoint shape). */
export class ContentApi<TList, TAdmin, TRequest> {
  constructor(protected readonly http: HttpClient, protected readonly base: string) {}

  list(query: Record<string, string | number | boolean | null | undefined>): Observable<Page<TList>> {
    return this.http.get<Page<TList>>(this.base, { params: params(query) });
  }
  get(id: number): Observable<TAdmin> { return this.http.get<TAdmin>(`${this.base}/${id}`); }
  create(body: TRequest): Observable<TAdmin> { return this.http.post<TAdmin>(this.base, body); }
  update(id: number, body: TRequest): Observable<TAdmin> { return this.http.put<TAdmin>(`${this.base}/${id}`, body); }
  delete(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/${id}`); }
  setStatus(id: number, change: StatusChange): Observable<TAdmin> { return this.http.patch<TAdmin>(`${this.base}/${id}/status`, change); }
}
