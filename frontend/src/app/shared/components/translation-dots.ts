import { Component, input } from '@angular/core';
import { TranslationStatus } from '../../core/api/models';

/** FR / AR / EN chips: green = complete, amber = started but incomplete, dashed = missing. */
@Component({
  selector: 'app-translation-dots',
  template: `
    <span class="inline-flex gap-1" role="list">
      @for (s of items(); track s.locale) {
        <span role="listitem" class="inline-flex h-5 min-w-7 items-center justify-center rounded px-1 text-[10px] font-bold uppercase" dir="ltr"
          [class]="s.complete ? 'bg-accent-soft text-accent' : s.present ? 'bg-warn-soft text-warn' : 'border border-dashed border-line-strong text-muted/70'"
          [attr.title]="s.complete ? s.locale + ' ✓' : s.locale + (s.missingFields.length ? ': ' + s.missingFields.join(', ') : '')">{{ s.locale }}</span>
      }
    </span>`,
})
export class TranslationDotsComponent {
  readonly items = input.required<TranslationStatus[]>();
}
