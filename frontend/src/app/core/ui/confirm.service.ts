import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions { title: string; message: string; confirmLabel?: string; danger?: boolean; params?: Record<string, unknown> }

/** Promise-based confirmation dialog (destructive actions must always ask). Rendered by <app-confirm-host>. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => this.request.set({ ...options, resolve }));
  }

  answer(ok: boolean) {
    const r = this.request();
    this.request.set(null);
    r?.resolve(ok);
  }
}
