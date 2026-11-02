import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-page-header',
  imports: [TranslocoPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="page-title">{{ title() | transloco }}</h1>
        @if (subtitle()) { <p class="mt-1 text-sm text-muted">{{ subtitle() | transloco }}</p> }
      </div>
      <div class="flex flex-wrap items-center gap-2 empty:hidden"><ng-content /></div>
    </header>`,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
