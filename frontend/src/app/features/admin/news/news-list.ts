import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CategoriesApi, NewsApi } from '../../../core/api/admin-api';
import { ApiError, CONTENT_STATUSES, CategoryAdmin, NewsListItem } from '../../../core/api/models';
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
import { pickText } from '../../../shared/util/forms';
import { PagedList } from '../../../shared/util/paged-list';

@Component({
  selector: 'app-news-list',
  imports: [FormsModule, RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, ListToolbarComponent, PaginationComponent, StatusBadgeComponent, TranslationDotsComponent, EmptyStateComponent, ErrorStateComponent, SkeletonRowsComponent, AppDatePipe],
  templateUrl: './news-list.html',
})
export class NewsListComponent {
  private readonly api = inject(NewsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  protected readonly statuses = CONTENT_STATUSES;
  protected readonly categories = signal<CategoryAdmin[]>([]);
  protected q = '';
  protected status = '';
  protected categoryId = '';

  protected readonly list = new PagedList<NewsListItem>((page, size) => this.api.list({ page, size, q: this.q, status: this.status, categoryId: this.categoryId, lang: this.lang.lang() }));

  constructor() {
    this.list.load(0);
    inject(CategoriesApi).list('NEWS').subscribe({ next: (c) => this.categories.set(c), error: () => undefined });
  }

  protected onSearch(q: string) { this.q = q; this.list.load(0); }
  protected onFilter() { this.list.load(0); }
  protected catName(c: CategoryAdmin) { return pickText(c.translations, this.lang.lang(), 'name') || c.slug; }

  protected async remove(n: NewsListItem) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'common.deleteConfirm', params: { name: n.title }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(n.id).subscribe({
      next: () => { this.toast.success('common.deleted'); this.list.load(this.list.items().length === 1 && this.list.page() > 0 ? this.list.page() - 1 : this.list.page()); },
      error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)),
    });
  }
}
