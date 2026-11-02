import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { ContentStatus, StatusChange } from '../../core/api/models';
import { AppDatePipe } from '../util/app-date.pipe';
import { IconComponent } from './icon';
import { ModalComponent } from './modal';
import { StatusBadgeComponent } from './status-badge';

interface Action { to: ContentStatus; icon: string; label: string; primary?: boolean; needsPublish: boolean }

/** Workflow panel for a saved item. Who may do what is decided by the backend; the buttons simply hide what would be refused. */
@Component({
  selector: 'app-status-actions',
  imports: [IconComponent, TranslocoPipe, StatusBadgeComponent, ModalComponent, FormsModule, AppDatePipe],
  template: `
    <div class="card card-pad">
      <h2 class="section-title mb-3">{{ 'workflow.title' | transloco }}</h2>
      <div class="flex items-center gap-2">
        <app-status-badge [status]="status()" />
        @if (publishedAt() && (status() === 'PUBLISHED' || status() === 'SCHEDULED')) { <span class="text-xs text-muted">{{ publishedAt() | appDate: 'datetime' }}</span> }
      </div>
      <p class="mt-2 text-xs text-muted">{{ 'workflow.hint.' + status() | transloco }}</p>
      <div class="mt-4 flex flex-col gap-2">
        @for (a of actions(); track a.to) {
          <button type="button" class="btn w-full justify-start" [class]="a.primary ? 'btn-primary' : 'btn-secondary'" [disabled]="busy()" (click)="act(a)">
            <app-icon [name]="a.icon" />{{ a.label | transloco }}
          </button>
        }
        @if (canPublish() && (status() === 'DRAFT' || status() === 'PENDING_REVIEW' || status() === 'ARCHIVED')) {
          <button type="button" class="btn btn-secondary w-full justify-start" [disabled]="busy()" (click)="scheduleOpen.set(true)"><app-icon name="calendar-clock" />{{ 'workflow.schedule' | transloco }}</button>
        }
      </div>
    </div>
    <app-modal [open]="scheduleOpen()" title="workflow.scheduleTitle" width="26rem" (closed)="scheduleOpen.set(false)">
      <label class="label" for="sched">{{ 'workflow.scheduleAt' | transloco }}</label>
      <input id="sched" type="datetime-local" class="input" [(ngModel)]="when" [min]="minWhen" />
      <p class="hint">{{ 'workflow.scheduleHint' | transloco }}</p>
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" (click)="scheduleOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="btn btn-primary" [disabled]="!when" (click)="schedule()">{{ 'workflow.schedule' | transloco }}</button>
      </ng-container>
    </app-modal>`,
})
export class StatusActionsComponent {
  private readonly auth = inject(AuthService);
  readonly status = input.required<ContentStatus>();
  readonly publishedAt = input<string | null>(null);
  readonly busy = input(false);
  readonly change = output<StatusChange>();

  protected readonly canPublish = computed(() => this.auth.can('CONTENT_PUBLISH'));
  protected readonly scheduleOpen = signal(false);
  protected when = '';
  protected readonly minWhen = new Date(Date.now() + 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  protected readonly actions = computed<Action[]>(() => {
    const s = this.status(), pub = this.canPublish();
    const all: Action[] = [];
    if (s === 'DRAFT') {
      if (pub) all.push({ to: 'PUBLISHED', icon: 'rocket', label: 'workflow.publishNow', primary: true, needsPublish: true });
      else all.push({ to: 'PENDING_REVIEW', icon: 'send', label: 'workflow.submit', primary: true, needsPublish: false });
    } else if (s === 'PENDING_REVIEW') {
      if (pub) all.push({ to: 'PUBLISHED', icon: 'rocket', label: 'workflow.approvePublish', primary: true, needsPublish: true });
      all.push({ to: 'DRAFT', icon: 'rotate-ccw', label: pub ? 'workflow.backToDraft' : 'workflow.withdraw', needsPublish: false });
    } else if (pub) {
      if (s === 'SCHEDULED') all.push({ to: 'PUBLISHED', icon: 'rocket', label: 'workflow.publishNow', primary: true, needsPublish: true });
      if (s === 'ARCHIVED') all.push({ to: 'PUBLISHED', icon: 'rocket', label: 'workflow.publishNow', primary: true, needsPublish: true });
      if (s === 'PUBLISHED' || s === 'SCHEDULED') all.push({ to: 'DRAFT', icon: 'eye-off', label: 'workflow.unpublish', needsPublish: true });
      if (s !== 'ARCHIVED') all.push({ to: 'ARCHIVED', icon: 'archive', label: 'workflow.archive', needsPublish: true });
      if (s === 'ARCHIVED') all.push({ to: 'DRAFT', icon: 'rotate-ccw', label: 'workflow.restore', needsPublish: true });
    }
    return all;
  });

  protected act(a: Action) { this.change.emit({ status: a.to }); }
  protected schedule() {
    if (!this.when) return;
    this.scheduleOpen.set(false);
    this.change.emit({ status: 'SCHEDULED', publishedAt: new Date(this.when).toISOString() });
  }
}
