import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/admin/login'], { queryParams: { redirect: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/admin']) : true;
};

/** Route data: { permissions: ['CONTENT_WRITE', ...] } — any one of them grants access. Backend enforces the same rules. */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const needed = (route.data['permissions'] as string[] | undefined) ?? [];
  return auth.canAny(...needed) ? true : inject(Router).createUrlTree(['/admin/forbidden']);
};
