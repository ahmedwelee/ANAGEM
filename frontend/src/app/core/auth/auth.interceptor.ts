import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../api/models';
import { ToastService } from '../ui/toast.service';
import { AuthService } from './auth.service';

/** Turns any HTTP failure into the backend's ApiError shape (or a synthetic one when offline). */
export function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    const b = e.error as Partial<ApiError> | null;
    if (b && typeof b === 'object' && typeof b.code === 'string') return { status: e.status, code: b.code, message: b.message ?? e.message, fieldErrors: b.fieldErrors, path: b.path };
    return { status: e.status, code: e.status === 0 ? 'NETWORK' : 'HTTP_' + e.status, message: e.message };
  }
  return { status: 0, code: 'UNKNOWN', message: String(e) };
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const secured = (req.url.startsWith('/api/admin') || req.url.startsWith('/api/auth')) && !req.url.endsWith('/api/auth/login');
  const token = auth.token();
  const request = secured && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      const apiErr = toApiError(err);
      if (secured && apiErr.status === 401 && token) {
        auth.clear();
        toast.error('session.expired');
        void router.navigate(['/admin/login'], { queryParams: { redirect: router.url } });
      }
      return throwError(() => apiErr);
    }),
  );
};
