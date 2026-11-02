import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of, tap } from 'rxjs';
import { LoginResponse, UserDto } from '../api/models';

const KEY = 'anagem.admin.session';
interface Session { token: string; expiresAt: string; user: UserDto }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(this.restore());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => {
    const s = this.session();
    return !!s && new Date(s.expiresAt).getTime() > Date.now();
  });

  can(permission: string): boolean { return this.isAuthenticated() && !!this.user()?.permissions.includes(permission); }
  canAny(...permissions: string[]): boolean { return permissions.length === 0 || permissions.some((p) => this.can(p)); }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((r) => this.set({ token: r.accessToken, expiresAt: r.expiresAt, user: r.user })),
    );
  }

  /** Re-reads the profile (permissions may have changed since sign-in). */
  refreshProfile(): Observable<UserDto | null> {
    return this.http.get<UserDto>('/api/auth/me').pipe(
      tap((u) => { const s = this.session(); if (s) this.set({ ...s, user: u }); }),
      catchError(() => of(null)),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>('/api/auth/change-password', { currentPassword, newPassword });
  }

  logout(redirect = true): void {
    if (this.token()) this.http.post('/api/auth/logout', {}).pipe(catchError(() => of(null))).subscribe();
    this.clear();
    if (redirect) void this.router.navigate(['/admin/login']);
  }

  /** Drops the local session without calling the server (used when the server already said 401). */
  clear(): void { this.set(null); }

  private set(s: Session | null): void {
    this.session.set(s);
    try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }

  private restore(): Session | null {
    try {
      const raw = localStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Session) : null;
      return s && new Date(s.expiresAt).getTime() > Date.now() ? s : null;
    } catch { return null; }
  }
}
