import { Component, computed, inject, input } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../core/api/models';
import { apiErrorMessage } from '../util/api-error';
import { IconComponent } from './icon';

@Component({
  selector: 'app-api-error-banner',
  imports: [IconComponent],
  template: `
    @if (error(); as e) {
      <div class="mb-5 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
        <app-icon name="circle-alert" class="mt-0.5 text-lg" />
        <div>
          <p class="font-semibold">{{ text() }}</p>
          @if (e.fieldErrors?.length) { <ul class="mt-1 list-disc ps-5 text-xs">@for (f of e.fieldErrors; track f.field) { <li><span class="font-mono" dir="ltr">{{ f.field }}</span>: {{ f.message }}</li> }</ul> }
        </div>
      </div>
    }`,
})
export class ApiErrorBannerComponent {
  private readonly t = inject(TranslocoService);
  readonly error = input<ApiError | null>(null);
  protected readonly text = computed(() => { const e = this.error(); return e ? apiErrorMessage(this.t, e) : ''; });
}
