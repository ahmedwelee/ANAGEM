import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client }, // the dashboard is behind a login: nothing to render for crawlers
  { path: '**', renderMode: RenderMode.Server }, // public pages are rendered per request so content, meta tags and language are always fresh
];
