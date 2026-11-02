import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { IconComponent } from '../../../shared/components/icon';
import { markNotFound } from '../shared/public-ui';

@Component({
  selector: 'app-public-not-found',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  template: `
    <div class="mx-auto my-24 max-w-md px-6 text-center"><span class="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-primary-soft text-3xl text-primary"><app-icon name="compass" /></span>
      <h1 class="text-2xl font-extrabold text-primary-dark">{{ 'errors.notFoundTitle' | transloco }}</h1><p class="mt-2 text-muted">{{ 'errors.notFoundHint' | transloco }}</p>
      <a [routerLink]="['/', lang.lang()]" class="btn btn-primary mt-6">{{ 'public.backHome' | transloco }}</a></div>`,
})
export class PublicNotFoundComponent {
  protected readonly lang = inject(LangService);
  constructor() {
    markNotFound();
    inject(SeoService).set({ title: '404', path: '', lang: this.lang.lang(), noindex: true, siteName: inject(SiteStore).siteName });
  }
}
