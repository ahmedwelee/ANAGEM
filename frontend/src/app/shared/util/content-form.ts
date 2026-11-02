import { signal } from '@angular/core';
import { inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ContentApi } from '../../core/api/content-api';
import { ApiError, ContentStatus, Lang, StatusChange, TranslationStatus } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { apiErrorMessage } from './api-error';
import { filledLanguages, firstInvalidLanguage } from './forms';

export interface HasUnsavedChanges { hasUnsaved(): boolean }

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (c) =>
  c.hasUnsaved() ? inject(ConfirmService).ask({ title: 'common.unsavedTitle', message: 'common.unsavedChanges', confirmLabel: 'common.leave', danger: true }) : true;

export interface ContentEntity { id: number; status: ContentStatus; publishedAt: string | null; translationStatus: TranslationStatus[]; updatedAt: string }

/**
 * Shared behaviour of the news / publication / event / resource editors:
 * load, validate per language, save (create or update), workflow status changes, delete, unsaved-changes tracking.
 * Subclasses define the form and how it maps to the API; call `init()` at the end of their constructor.
 */
export abstract class ContentFormPage<TAdmin extends ContentEntity, TReq> implements HasUnsavedChanges {
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  protected readonly confirm = inject(ConfirmService);
  protected readonly transloco = inject(TranslocoService);
  protected readonly lang = inject(LangService);
  protected readonly auth = inject(AuthService);

  protected abstract readonly api: ContentApi<unknown, TAdmin, TReq>;
  protected abstract readonly listRoute: string;
  protected abstract readonly form: FormGroup;
  protected abstract patch(e: TAdmin): void;
  protected abstract buildRequest(): TReq;
  protected abstract displayName(): string;

  readonly entity = signal<TAdmin | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly statusBusy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly loadError = signal<ApiError | null>(null);
  readonly activeLang = signal<Lang>(this.lang.lang());
  readonly filled = signal<Partial<Record<Lang, boolean>>>({});
  readonly entityId: number | null = ((): number | null => { const p = this.route.snapshot.paramMap.get('id'); return p && /^\d+$/.test(p) ? Number(p) : null; })();
  readonly isNew = this.entityId === null;

  protected init(): void {
    this.form.valueChanges.subscribe(() => this.filled.set(filledLanguages(this.form.get('translations'))));
    if (!this.isNew) this.load();
  }

  hasUnsaved(): boolean { return this.form.dirty && !this.saving(); }

  load(): void {
    if (this.entityId === null) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.api.get(this.entityId).subscribe({
      next: (e) => { this.entity.set(e); this.patch(e); this.form.markAsPristine(); this.filled.set(filledLanguages(this.form.get('translations'))); this.loading.set(false); },
      error: (e: ApiError) => { this.loadError.set(e); this.loading.set(false); },
    });
  }

  /** Resolves true when saved (or nothing to save failed validation = false). */
  save(): Promise<boolean> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const bad = firstInvalidLanguage(this.form.get('translations'));
      if (bad) this.activeLang.set(bad);
      this.toast.error('form.invalid');
      setTimeout(() => document.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, select.ng-invalid')?.focus());
      return Promise.resolve(false);
    }
    this.saving.set(true);
    this.error.set(null);
    const id = this.entity()?.id;
    const req = this.buildRequest();
    const call = id ? this.api.update(id, req) : this.api.create(req);
    return new Promise<boolean>((resolve) =>
      call.subscribe({
        next: (e) => {
          this.saving.set(false);
          this.entity.set(e);
          this.patch(e);
          this.form.markAsPristine();
          this.toast.success('common.saved');
          if (!id) void this.router.navigate([this.listRoute, e.id], { replaceUrl: true });
          resolve(true);
        },
        error: (e: ApiError) => { this.saving.set(false); this.error.set(e); this.toast.error(apiErrorMessage(this.transloco, e)); resolve(false); },
      }),
    );
  }

  async changeStatus(change: StatusChange): Promise<void> {
    const id = this.entity()?.id;
    if (!id) return;
    if (this.form.dirty && !(await this.save())) return;
    this.statusBusy.set(true);
    this.api.setStatus(id, change).subscribe({
      next: (e) => { this.statusBusy.set(false); this.entity.set(e); this.toast.success('workflow.statusChanged'); },
      error: (e: ApiError) => { this.statusBusy.set(false); this.toast.error(apiErrorMessage(this.transloco, e)); },
    });
  }

  async remove(): Promise<void> {
    const id = this.entity()?.id;
    if (!id) return;
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: this.displayName() }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(id).subscribe({
      next: () => { this.form.markAsPristine(); this.toast.success('common.deleted'); void this.router.navigate([this.listRoute]); },
      error: (e: ApiError) => this.toast.error(apiErrorMessage(this.transloco, e)),
    });
  }
}
