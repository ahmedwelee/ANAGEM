import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { params } from './api.util';
import { Lang, NewsDetail, Page } from './models';

export interface MediaRef { id: string; url: string; thumbnailUrl: string | null; altText: string | null; width: number | null; height: number | null; contentType: string }
export interface CategoryRef { id: number; slug: string; name: string }
export interface Localized { locale: Lang; fallback: boolean }

export interface NewsCard extends Localized { id: number; slug: string; title: string; summary: string | null; publishedAt: string; category: CategoryRef | null; tags: string[]; featured: boolean; image: MediaRef | null }
export interface EventCard extends Localized {
  id: number; slug: string; type: string; title: string; description: string | null; location: string | null; organizer: string | null; startsAt: string; endsAt: string | null;
  allDay: boolean; timezone: string; timeStatus: 'UPCOMING' | 'ONGOING' | 'PAST'; registrationUrl: string | null; category: CategoryRef | null; image: MediaRef | null;
  program: MediaRef | null; programDownloadUrl: string | null; featured: boolean;
}
export interface PublicationCard extends Localized {
  id: number; kind: string; year: number; issueNumber: string | null; title: string; description: string | null; publishedAt: string; category: CategoryRef | null;
  coverImage: MediaRef | null; pdf: MediaRef | null; pdfDownloadUrl: string | null; featured: boolean;
}
export interface ResourceCard extends Localized { id: number; kind: string; title: string; description: string | null; publishedAt: string; category: CategoryRef | null; file: MediaRef | null; downloadUrl: string | null; externalUrl: string | null }
export interface PartnerPublic { id: number; name: string; websiteUrl: string | null; logo: MediaRef | null }
export interface CategoryPublic { id: number; type: string; slug: string; name: string; description: string | null }

export type Settings = Record<string, unknown>;
export interface HomepageData {
  lang: Lang; sections: Record<string, any>; news: NewsCard[]; events: EventCard[]; featuredEvent: EventCard | null; magazine: PublicationCard | null; partners: PartnerPublic[]; settings: Settings;
}
export interface PageData { slug: string; content: Record<string, any>; updatedAt: string }
export interface ContactBody { name: string; email: string; subject?: string; message: string; locale: Lang; website?: string }

@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/public';

  homepage(lang: Lang) { return this.http.get<HomepageData>(`${this.base}/homepage`, { params: params({ lang }) }); }
  settings(lang: Lang) { return this.http.get<Settings>(`${this.base}/settings`, { params: params({ lang }) }); }
  page(slug: string, lang: Lang) { return this.http.get<PageData>(`${this.base}/pages/${slug}`, { params: params({ lang }) }); }
  categories(type: string, lang: Lang) { return this.http.get<CategoryPublic[]>(`${this.base}/categories`, { params: params({ type, lang }) }); }

  news(q: { lang: Lang; q?: string; category?: string; tag?: string; page?: number; size?: number }): Observable<Page<NewsCard>> { return this.http.get<Page<NewsCard>>(`${this.base}/news`, { params: params(q) }); }
  newsDetail(slug: string, lang: Lang) { return this.http.get<NewsDetail>(`${this.base}/news/${slug}`, { params: params({ lang }) }); }
  newsRelated(slug: string, lang: Lang) { return this.http.get<NewsCard[]>(`${this.base}/news/${slug}/related`, { params: params({ lang, limit: 3 }) }); }

  events(q: { lang: Lang; scope?: string; type?: string; q?: string; page?: number; size?: number }): Observable<Page<EventCard>> { return this.http.get<Page<EventCard>>(`${this.base}/events`, { params: params(q) }); }
  eventDetail(idOrSlug: string, lang: Lang) { return this.http.get<EventCard>(`${this.base}/events/${idOrSlug}`, { params: params({ lang }) }); }

  publications(q: { lang: Lang; q?: string; year?: number | string; categoryId?: number | string; kind?: string; page?: number; size?: number }): Observable<Page<PublicationCard>> { return this.http.get<Page<PublicationCard>>(`${this.base}/publications`, { params: params(q) }); }
  publicationYears() { return this.http.get<number[]>(`${this.base}/publications/years`); }
  publicationDetail(id: string, lang: Lang) { return this.http.get<PublicationCard>(`${this.base}/publications/${id}`, { params: params({ lang }) }); }

  resources(q: { lang: Lang; q?: string; kind?: string; categoryId?: number | string; page?: number; size?: number }): Observable<Page<ResourceCard>> { return this.http.get<Page<ResourceCard>>(`${this.base}/resources`, { params: params(q) }); }

  contact(body: ContactBody) { return this.http.post<{ received: boolean }>(`${this.base}/contact`, body); }
}
