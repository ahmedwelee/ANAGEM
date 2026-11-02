import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContentStatus } from '../../core/api/models';

const CLASSES: Record<ContentStatus, string> = {
  DRAFT: 'badge-draft', PENDING_REVIEW: 'badge-review', SCHEDULED: 'badge-scheduled', PUBLISHED: 'badge-published', ARCHIVED: 'badge-archived',
};

@Component({
  selector: 'app-status-badge',
  imports: [TranslocoPipe],
  template: `<span class="badge" [class]="cls()">{{ 'status.' + status() | transloco }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<ContentStatus>();
  protected readonly cls = computed(() => CLASSES[this.status()]);
}
