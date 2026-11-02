import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { OpsApi } from '../../../core/api/admin-api';
import { AuditLog } from '../../../core/api/models';
import { IconComponent } from '../../../shared/components/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { PaginationComponent } from '../../../shared/components/pagination';
import { EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { PagedList, debounced } from '../../../shared/util/paged-list';

const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'UPLOAD', 'USER_CHANGE', 'ROLE_CHANGE', 'SETTINGS_CHANGE'];
const RESOURCES = ['NEWS', 'PUBLICATION', 'EVENT', 'RESOURCE', 'MEDIA', 'CATEGORY', 'PARTNER', 'USER', 'ROLE', 'SETTINGS', 'HOMEPAGE', 'CONTACT_MESSAGE'];

@Component({
  selector: 'app-audit-log',
  imports: [FormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, PaginationComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent, AppDatePipe],
  templateUrl: './audit-log.html',
})
export class AuditLogComponent {
  private readonly api = inject(OpsApi);
  protected readonly actions = ACTIONS;
  protected readonly resources = RESOURCES;
  protected actor = '';
  protected action = '';
  protected resourceType = '';
  protected from = '';
  protected to = '';
  protected readonly list = new PagedList<AuditLog>((page, size) => this.api.audit({
    page, size, actor: this.actor, action: this.action, resourceType: this.resourceType,
    from: this.from ? new Date(this.from + 'T00:00:00').toISOString() : null,
    to: this.to ? new Date(new Date(this.to + 'T00:00:00').getTime() + 86_400_000).toISOString() : null,
  }), 30);
  protected readonly onActor = debounced((v: string) => { this.actor = v.trim(); this.list.load(0); });

  constructor() { this.list.load(0); }
  protected onFilter() { this.list.load(0); }
  protected tone(a: string) { return a === 'DELETE' || a === 'LOGIN_FAILED' ? 'badge-danger' : a === 'CREATE' || a === 'UPLOAD' ? 'badge-published' : a.startsWith('LOGIN') || a === 'LOGOUT' ? 'badge-draft' : 'badge-info'; }
}
