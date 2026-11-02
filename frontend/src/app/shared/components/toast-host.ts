import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastService } from '../../core/ui/toast.service';
import { IconComponent } from './icon';

@Component({
  selector: 'app-toast-host',
  imports: [IconComponent, TranslocoPipe],
  template: `
    <div class="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:end-4 sm:w-96" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast pointer-events-auto flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-pop"
          [class.border-accent]="t.kind === 'success'" [class.border-danger]="t.kind === 'error'" [class.border-line-strong]="t.kind === 'info'" role="status">
          <app-icon class="mt-0.5 text-lg" [class.text-accent]="t.kind === 'success'" [class.text-danger]="t.kind === 'error'" [class.text-primary]="t.kind === 'info'"
            [name]="t.kind === 'success' ? 'circle-check' : t.kind === 'error' ? 'circle-alert' : 'info'" />
          <p class="flex-1 leading-snug">{{ t.message | transloco: t.params }}</p>
          <button type="button" class="text-muted hover:text-ink" (click)="toasts.dismiss(t.id)" [attr.aria-label]="'common.close' | transloco"><app-icon name="x" /></button>
        </div>
      }
    </div>`,
  styles: `.toast { animation: toast-in .35s var(--ease-out); } @keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(.97); } }`,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
