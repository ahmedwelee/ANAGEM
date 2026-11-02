import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { ChartConfiguration } from 'chart.js';
import { OpsApi } from '../../../core/api/admin-api';
import { ApiError, AuditLog, CONTENT_STATUSES, DashboardStats } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { ChartComponent, token } from '../../../shared/components/chart';
import { IconComponent } from '../../../shared/components/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/components/states';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';

interface StatCard { label: string; value: number; icon: string; hint?: string; link?: string; tone: 'primary' | 'accent' | 'warn' }

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslocoPipe, IconComponent, PageHeaderComponent, ChartComponent, ErrorStateComponent, EmptyStateComponent, AppDatePipe],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  private readonly ops = inject(OpsApi);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);

  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly activity = signal<AuditLog[]>([]);
  protected readonly error = signal<ApiError | null>(null);

  constructor() { this.load(); }

  protected load() {
    this.error.set(null);
    this.ops.stats().subscribe({ next: (s) => this.stats.set(s), error: (e: ApiError) => this.error.set(e) });
    this.ops.recent(10).subscribe({ next: (a) => this.activity.set(a), error: () => this.activity.set([]) });
  }

  protected firstName() { return (this.auth.user()?.fullName ?? '').split(' ')[0]; }

  protected readonly cards = computed<StatCard[]>(() => {
    const s = this.stats();
    if (!s) return [];
    const n = s.news.byStatus;
    const out: StatCard[] = [
      { label: 'dashboard.publishedNews', value: n['PUBLISHED'] ?? 0, icon: 'newspaper', tone: 'accent', link: '/admin/news' },
      { label: 'dashboard.totalNews', value: s.news.total, icon: 'newspaper', tone: 'primary', hint: this.t.translate('dashboard.scheduledHint', { n: n['SCHEDULED'] ?? 0 }) },
      { label: 'dashboard.drafts', value: n['DRAFT'] ?? 0, icon: 'pencil', tone: 'warn', hint: this.t.translate('dashboard.reviewHint', { n: n['PENDING_REVIEW'] ?? 0 }), link: '/admin/news' },
      { label: 'dashboard.publications', value: s.publications.total, icon: 'book-open', tone: 'primary', link: '/admin/publications' },
      { label: 'dashboard.events', value: s.events.total, icon: 'calendar-days', tone: 'primary', link: '/admin/events' },
      { label: 'dashboard.upcomingEvents', value: s.events.upcoming, icon: 'calendar-clock', tone: 'accent', link: '/admin/events' },
      { label: 'dashboard.media', value: s.mediaFiles, icon: 'images', tone: 'primary', link: '/admin/media' },
    ];
    if (this.auth.can('MESSAGES_VIEW')) out.push({ label: 'dashboard.newMessages', value: s.newContactMessages, icon: 'mail', tone: s.newContactMessages ? 'warn' : 'primary', link: '/admin/messages' });
    if (s.adminUsers !== null) out.push({ label: 'dashboard.adminUsers', value: s.adminUsers, icon: 'users', tone: 'primary', link: '/admin/users' });
    return out;
  });

  protected readonly monthChart = computed<ChartConfiguration | null>(() => {
    const s = this.stats();
    this.lang.lang();
    if (!s) return null;
    const known = new Map(s.newsPerMonth.map((m) => [m.month, m.count]));
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (11 - i), 1));
    const fmt = new Intl.DateTimeFormat(this.lang.locale(), { month: 'short' });
    return {
      type: 'bar',
      data: {
        labels: months.map((d) => fmt.format(d)),
        datasets: [{ label: this.t.translate('dashboard.chartNews'), data: months.map((d) => known.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) ?? 0), backgroundColor: token('--c-primary'), borderRadius: 6, maxBarThickness: 30 }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } },
    };
  });

  protected readonly statusChart = computed<ChartConfiguration | null>(() => {
    const s = this.stats();
    this.lang.lang();
    if (!s || s.news.total === 0) return null;
    const colors: Record<string, string> = { DRAFT: token('--c-line-strong'), PENDING_REVIEW: '#E0A21B', SCHEDULED: token('--c-primary'), PUBLISHED: token('--c-accent'), ARCHIVED: token('--c-primary-dark') };
    const present = CONTENT_STATUSES.filter((st) => (s.news.byStatus[st] ?? 0) > 0);
    return {
      type: 'doughnut',
      data: { labels: present.map((st) => this.t.translate('status.' + st)), datasets: [{ data: present.map((st) => s.news.byStatus[st] ?? 0), backgroundColor: present.map((st) => colors[st]), borderWidth: 2, borderColor: '#fff' }] },
      options: { cutout: '64%', plugins: { legend: { position: 'bottom', rtl: this.lang.dir() === 'rtl', labels: { usePointStyle: true, boxWidth: 8 } } } },
    };
  });

  protected readonly gaps = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const routes: Record<string, string> = { news: '/admin/news', publications: '/admin/publications', events: '/admin/events' };
    return Object.entries(s.translationGaps).flatMap(([type, r]) => r.items.map((i) => ({ ...i, type, route: `${routes[type] ?? '/admin'}/${i.id}` }))).slice(0, 8);
  });

  protected readonly gapTotal = computed(() => Object.values(this.stats()?.translationGaps ?? {}).reduce((n, r) => n + r.incomplete, 0));

  protected activityIcon(a: string): string {
    return ({ CREATE: 'plus', UPDATE: 'pencil', DELETE: 'trash-2', STATUS_CHANGE: 'rocket', UPLOAD: 'upload', LOGIN: 'log-out', SETTINGS_CHANGE: 'settings' } as Record<string, string>)[a] ?? 'info';
  }
}
