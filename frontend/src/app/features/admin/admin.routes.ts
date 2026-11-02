import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/guards';
import { unsavedChangesGuard } from '../../shared/util/content-form';

const guarded = (...permissions: string[]) => ({ canActivate: [permissionGuard], data: { permissions } });
const WRITE = guarded('CONTENT_WRITE');

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', ...guarded('DASHBOARD_VIEW'), loadComponent: () => import('./dashboard/dashboard').then((m) => m.DashboardComponent) },

  { path: 'news', ...WRITE, loadComponent: () => import('./news/news-list').then((m) => m.NewsListComponent) },
  { path: 'news/new', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./news/news-form').then((m) => m.NewsFormComponent) },
  { path: 'news/:id', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./news/news-form').then((m) => m.NewsFormComponent) },

  { path: 'publications', ...WRITE, loadComponent: () => import('./publications/publications-list').then((m) => m.PublicationsListComponent) },
  { path: 'publications/new', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./publications/publication-form').then((m) => m.PublicationFormComponent) },
  { path: 'publications/:id', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./publications/publication-form').then((m) => m.PublicationFormComponent) },

  { path: 'events', ...WRITE, loadComponent: () => import('./events/events-list').then((m) => m.EventsListComponent) },
  { path: 'events/new', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./events/event-form').then((m) => m.EventFormComponent) },
  { path: 'events/:id', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./events/event-form').then((m) => m.EventFormComponent) },

  { path: 'resources', ...WRITE, loadComponent: () => import('./resources/resources-list').then((m) => m.ResourcesListComponent) },
  { path: 'resources/new', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./resources/resource-form').then((m) => m.ResourceFormComponent) },
  { path: 'resources/:id', ...WRITE, canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./resources/resource-form').then((m) => m.ResourceFormComponent) },

  { path: 'categories', ...guarded('CATEGORY_MANAGE', 'CONTENT_WRITE'), loadComponent: () => import('./categories/categories').then((m) => m.CategoriesComponent) },
  { path: 'media', ...guarded('MEDIA_UPLOAD', 'CONTENT_WRITE'), loadComponent: () => import('./media/media-library').then((m) => m.MediaLibraryComponent) },

  { path: 'homepage', ...guarded('HOMEPAGE_MANAGE'), loadComponent: () => import('./homepage/homepage-editor').then((m) => m.HomepageEditorComponent) },
  { path: 'partners', ...guarded('PARTNER_MANAGE'), loadComponent: () => import('./partners/partners').then((m) => m.PartnersComponent) },
  { path: 'settings', ...guarded('SETTINGS_MANAGE'), loadComponent: () => import('./settings/settings').then((m) => m.SettingsComponent) },
  { path: 'messages', ...guarded('MESSAGES_VIEW'), loadComponent: () => import('./messages/messages').then((m) => m.MessagesComponent) },
  { path: 'users', ...guarded('USER_MANAGE', 'ROLE_MANAGE'), loadComponent: () => import('./users/users').then((m) => m.UsersComponent) },
  { path: 'audit', ...guarded('AUDIT_VIEW'), loadComponent: () => import('./audit/audit-log').then((m) => m.AuditLogComponent) },
  { path: 'profile', loadComponent: () => import('./profile/profile').then((m) => m.ProfileComponent) },

  { path: 'forbidden', loadComponent: () => import('./errors/errors').then((m) => m.ForbiddenComponent) },
  { path: '**', loadComponent: () => import('./errors/errors').then((m) => m.NotFoundComponent) },
];
