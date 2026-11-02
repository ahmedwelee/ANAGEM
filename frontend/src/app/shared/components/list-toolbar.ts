import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounced } from '../util/paged-list';
import { IconComponent } from './icon';

/** Search box + projected filter controls for list screens. */
@Component({
  selector: 'app-list-toolbar',
  imports: [IconComponent, TranslocoPipe],
  template: `
    <div class="flex flex-wrap items-center gap-3 border-b border-line p-4">
      <div class="relative min-w-52 flex-1 sm:max-w-sm">
        <app-icon name="search" class="pointer-events-none absolute inset-y-0 start-3 text-muted" />
        <input type="search" class="input ps-9" [placeholder]="placeholder() | transloco" [attr.aria-label]="placeholder() | transloco" (input)="emit($any($event.target).value)" />
      </div>
      <ng-content />
    </div>`,
})
export class ListToolbarComponent {
  readonly placeholder = input('common.search');
  readonly search = output<string>();
  protected readonly emit = debounced((v: string) => this.search.emit(v.trim()));
}
