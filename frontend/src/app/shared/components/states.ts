import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './icon';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent, TranslocoPipe],
  template: `
    <div class="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span class="grid size-14 place-items-center rounded-full bg-primary-soft text-2xl text-primary"><app-icon [name]="icon()" /></span>
      <p class="font-bold text-primary-dark">{{ title() | transloco }}</p>
      @if (hint()) { <p class="max-w-sm text-sm text-muted">{{ hint() | transloco }}</p> }
      <div class="mt-2 empty:hidden"><ng-content /></div>
    </div>`,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('common.noResults');
  readonly hint = input<string | null>(null);
}

@Component({
  selector: 'app-error-state',
  imports: [IconComponent, TranslocoPipe],
  template: `
    <div class="flex flex-col items-center gap-2 px-6 py-12 text-center" role="alert">
      <span class="grid size-14 place-items-center rounded-full bg-danger-soft text-2xl text-danger"><app-icon name="circle-alert" /></span>
      <p class="font-bold text-danger">{{ 'common.loadError' | transloco }}</p>
      @if (message()) { <p class="max-w-md text-sm text-muted">{{ message() }}</p> }
      <button type="button" class="btn btn-secondary btn-sm mt-2" (click)="retry.emit()"><app-icon name="refresh-cw" />{{ 'common.retry' | transloco }}</button>
    </div>`,
})
export class ErrorStateComponent {
  readonly message = input<string | null>(null);
  readonly retry = output<void>();
}

@Component({
  selector: 'app-skeleton-rows',
  template: `<div class="flex flex-col gap-3 p-4" aria-hidden="true">@for (r of rowsArr(); track r) { <div class="skeleton h-9"></div> }</div>`,
})
export class SkeletonRowsComponent {
  readonly rows = input(6);
  protected rowsArr() { return Array.from({ length: this.rows() }, (_, i) => i); }
}
