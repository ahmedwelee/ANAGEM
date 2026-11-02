import { Component, computed, effect, input, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-field-error',
  imports: [TranslocoPipe],
  template: `@if (message(); as m) { <p class="field-error" role="alert">{{ m.key | transloco: m.params }}</p> }`,
})
export class FieldErrorComponent {
  readonly control = input<AbstractControl | null>(null);
  /** Server-side message for this field (from ApiError.fieldErrors), shown in addition to client validation. */
  readonly server = input<string | null>(null);

  /** touched/dirty/errors live on the control and are not signals: this counter is bumped by the control's own change events so the message re-renders. */
  private readonly changes = signal(0);

  constructor() {
    effect((onCleanup) => {
      const sub = this.control()?.events.subscribe(() => this.changes.update((n) => n + 1));
      onCleanup(() => sub?.unsubscribe());
    });
  }

  protected readonly message = computed(() => {
    this.changes();
    const c = this.control();
    if (c && c.invalid && (c.touched || c.dirty) && c.errors) {
      const [code, v] = Object.entries(c.errors)[0] as [string, Record<string, unknown> | true];
      const params = typeof v === 'object' ? v : {};
      return { key: 'validation.' + code, params };
    }
    const s = this.server();
    return s ? { key: s, params: {} } : null;
  });
}
