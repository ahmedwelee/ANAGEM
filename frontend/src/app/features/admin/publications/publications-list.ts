import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PublicationsApi } from '../../../core/api/admin-api';
import { ApiError, CONTENT_STATUSES, PUBLICATION_KINDS, PublicationListItem } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
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
  selector: 'app-publications-list',
  imports: [FormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, StatusBadgeComponent, TranslationDotsComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent, AppDatePipe],
  templateUrl: './publications-list.html',
})
export class PublicationsListComponent {
  private readonly api = inject(PublicationsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly statuses = CONTENT_STATUSES;
  protected readonly kinds = PUBLICATION_KINDS;
  protected q = '';
  protected status = '';
  protected kind = '';
  protected year = '';
  protected readonly list = new PagedList<PublicationListItem>((page, size) => this.api.list({ page, size, q: this.q, status: this.status, kind: this.kind, year: this.year, sort: 'publicationYear,desc' }));

  constructor() { this.list.load(0); }

  protected onSearch(q: string) { this.q = q; this.list.load(0); }
  protected onFilter() { this.list.load(0); }

  protected async remove(p: PublicationListItem) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: p.title }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(p.id).subscribe({
      next: () => { this.toast.success('common.deleted'); this.list.load(); },
      error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)),
    });
  }
}
