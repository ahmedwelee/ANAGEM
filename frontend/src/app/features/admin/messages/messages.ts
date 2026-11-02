import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { OpsApi } from '../../../core/api/admin-api';
import { ApiError, ContactMessage, ContactStatus } from '../../../core/api/models';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { IconComponent } from '../../../shared/components/icon';
import { ModalComponent } from '../../../shared/components/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { PaginationComponent } from '../../../shared/components/pagination';
import { EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';
import { PagedList } from '../../../shared/util/paged-list';

@Component({
  selector: 'app-messages',
  imports: [FormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, PaginationComponent, ModalComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent, AppDatePipe],
  templateUrl: './messages.html',
})
export class MessagesComponent {
  private readonly api = inject(OpsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly statuses: ContactStatus[] = ['NEW', 'READ', 'ARCHIVED'];
  protected status = '';
  protected readonly selected = signal<ContactMessage | null>(null);
  protected readonly list = new PagedList<ContactMessage>((page, size) => this.api.messages({ page, size, status: this.status }));

  constructor() { this.list.load(0); }
  protected onFilter() { this.list.load(0); }

  protected open(m: ContactMessage) {
    this.selected.set(m);
    if (m.status === 'NEW') this.setStatus(m, 'READ', false);
  }

  protected setStatus(m: ContactMessage, status: ContactStatus, notify = true) {
    this.api.setMessageStatus(m.id, status).subscribe({
      next: (u) => { this.list.items.update((a) => a.map((x) => (x.id === u.id ? u : x))); if (this.selected()?.id === u.id) this.selected.set(u); if (notify) this.toast.success('common.saved'); },
      error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)),
    });
  }

  protected async remove(m: ContactMessage) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'messages.deleteConfirm', params: { name: m.name }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.deleteMessage(m.id).subscribe({ next: () => { this.selected.set(null); this.toast.success('common.deleted'); this.list.load(); }, error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)) });
  }
}
