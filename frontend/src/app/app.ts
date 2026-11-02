import { Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ConfirmHostComponent } from './shared/components/confirm-host';
import { ToastHostComponent } from './shared/components/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, ConfirmHostComponent],
  template: `<router-outlet /><app-toast-host /><app-confirm-host />`,
})
export class App {
  constructor() {
    // Public pages set their own robots/SEO tags (SeoService); the admin area is never indexed.
    const meta = inject(Meta);
    inject(Router).events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (e.urlAfterRedirects.startsWith('/admin')) meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    });
  }
}
