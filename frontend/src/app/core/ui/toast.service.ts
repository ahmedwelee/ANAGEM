import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string; params?: Record<string, unknown> }

/** Messages are translation keys (or already-localized text); the host component translates keys. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(message: string, params?: Record<string, unknown>) { this.push('success', message, params); }
  error(message: string, params?: Record<string, unknown>) { this.push('error', message, params, 8000); }
  info(message: string, params?: Record<string, unknown>) { this.push('info', message, params); }
  dismiss(id: number) { this.toasts.update((t) => t.filter((x) => x.id !== id)); }

  private push(kind: Toast['kind'], message: string, params?: Record<string, unknown>, ms = 4500) {
    const id = this.nextId++;
    this.toasts.update((t) => [...t.slice(-3), { id, kind, message, params }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
