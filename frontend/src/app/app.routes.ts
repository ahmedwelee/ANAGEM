import { Routes } from '@angular/router';
import { DEFAULT_LANG } from './core/api/models';
import { authGuard, guestGuard } from './core/auth/guards';
import { PUBLIC_ROUTES } from './features/public/public.routes';

export const routes: Routes = [
  { path: 'admin/login', canActivate: [guestGuard], title: 'ANAGEM', loadComponent: () => import('./features/admin/login/login').then((m) => m.LoginComponent) },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/layout/admin-shell').then((m) => m.AdminShellComponent),
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  { path: '', pathMatch: 'full', redirectTo: DEFAULT_LANG },
  ...PUBLIC_ROUTES,
];
