import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EventsApi } from '../../../core/api/admin-api';
import { ApiError, CONTENT_STATUSES, EVENT_TYPES, EventListItem } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { IconComponent } from '../../../shared/components/icon';
import { ListToolbarComponent } from '../../../shared/components/list-toolbar';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { PaginationComponent } from '../../../shared/components/pagination';
import { EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { StatusBadgeComponent } from '../../../shared/components/status-badge';
import { TranslationDotsComponent } from '../../../shared/components/translation-dots';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { PagedList } from '../../../shared/util/paged-list';

@Component({
  selector: 'app-events-list',
  imports: [FormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, StatusBadgeComponent, TranslationDotsComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent, AppDatePipe],
  templateUrl: './events-list.html',
})
export class EventsListComponent {
  private readonly api = inject(EventsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  protected readonly statuses = CONTENT_STATUSES;
  protected readonly types = EVENT_TYPES;
  protected q = '';
  protected status = '';
  protected type = '';
  protected scope = '';
  protected readonly list = new PagedList<EventListItem>((page, size) => this.api.list({ page, size, q: this.q, status: this.status, type: this.type, scope: this.scope, lang: this.lang.lang() }));

  constructor() { this.list.load(0); }

  protected onSearch(q: string) { this.q = q; this.list.load(0); }
  protected onFilter() { this.list.load(0); }

  protected async remove(e: EventListItem) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: e.title }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(e.id).subscribe({ next: () => { this.toast.success('common.deleted'); this.list.load(); }, error: (er: ApiError) => this.toast.error(apiErrorMessage(this.t, er)) });
  }
}
