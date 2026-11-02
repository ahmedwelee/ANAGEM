import { Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LANGS, Lang, TranslationStatus } from '../../core/api/models';

/** FR / AR / EN tabs for translated forms; a dot shows whether that language is filled in. */
@Component({
  selector: 'app-lang-tabs',
  imports: [TranslocoPipe],
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="'common.languages' | transloco">
      @for (l of langs; track l) {
        <button type="button" role="tab" class="tab" [attr.aria-selected]="active() === l" (click)="active.set(l)">
          <span class="size-2 rounded-full" [class]="dot(l)"></span>
          {{ 'lang.' + l | transloco }}
        </button>
      }
    </div>`,
})
export class LangTabsComponent {
  protected readonly langs = LANGS;
  readonly active = model.required<Lang>();
  /** Per-language fill state computed by the form (true = something typed). */
  readonly filled = input<Partial<Record<Lang, boolean>>>({});
  readonly status = input<TranslationStatus[] | null>(null);

  protected dot(l: Lang): string {
    const st = this.status()?.find((s) => s.locale === l);
    if (st) return st.complete ? 'bg-accent' : st.present ? 'bg-warn' : 'bg-line-strong';
    return this.filled()[l] ? 'bg-accent' : 'bg-line-strong';
  }
}
