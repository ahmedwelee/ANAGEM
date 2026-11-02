// Types mirroring the backend DTOs (see docs/architecture/02-api-reference.md).
export type Lang = 'fr' | 'ar' | 'en';
export const LANGS: readonly Lang[] = ['fr', 'ar', 'en'];
/** The language the site opens in when the visitor has not chosen one (also the first fallback for untranslated content). */
export const DEFAULT_LANG: Lang = 'ar';
export type Translations<T> = Partial<Record<Lang, T>>;

export type ContentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export const CONTENT_STATUSES: readonly ContentStatus[] = ['DRAFT', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];
export type TimeStatus = 'UPCOMING' | 'ONGOING' | 'PAST';

export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }
export interface FieldIssue { field: string; message: string }
export interface ApiError { timestamp?: string; status: number; code: string; message: string; path?: string; fieldErrors?: FieldIssue[] }
export interface TranslationStatus { locale: Lang; present: boolean; complete: boolean; missingFields: string[] }
export interface StatusChange { status: ContentStatus; publishedAt?: string | null }

export interface MediaText { altText?: string | null; description?: string | null }
export interface MediaDto {
  id: string; originalName: string; contentType: string; kind: 'IMAGE' | 'PDF'; sizeBytes: number;
  width: number | null; height: number | null; url: string; thumbnailUrl: string | null;
  translations: Translations<MediaText>; createdAt: string; uploadedBy: string | null;
}

// ---- access ----
export interface UserDto {
  id: number; email: string; fullName: string; role: string; permissions: string[]; enabled: boolean;
  preferredLocale: Lang; lastLoginAt: string | null; createdAt: string;
}
export interface LoginResponse { accessToken: string; tokenType: string; expiresAt: string; user: UserDto }
export interface RoleDto { id: number; name: string; description: string; systemRole: boolean; permissions: string[] }
export interface PermissionDto { code: string; description: string }

// ---- content ----
export interface NewsText { title?: string; summary?: string; content?: string; seoTitle?: string; seoDescription?: string }
export interface NewsRequest {
  slug?: string | null; categoryId?: number | null; featuredImageId?: string | null; featured?: boolean; tags?: string[];
  translations: Translations<NewsText>;
}
export interface NewsAdmin {
  id: number; slug: string; status: ContentStatus; publishedAt: string | null; featured: boolean; categoryId: number | null;
  featuredImage: MediaDto | null; tags: string[]; translations: Translations<NewsText>; translationStatus: TranslationStatus[];
  authorName: string | null; version: number; createdAt: string; updatedAt: string;
}
export interface NewsListItem {
  id: number; slug: string; status: ContentStatus; publishedAt: string | null; featured: boolean; categoryId: number | null; categoryName: string | null;
  title: string; titleLocale: Lang | null; translationStatus: TranslationStatus[]; authorName: string | null; updatedAt: string;
}

export type PublicationKind = 'MAGAZINE_ISSUE' | 'BOOK' | 'PROCEEDINGS' | 'REPORT' | 'OTHER';
export const PUBLICATION_KINDS: readonly PublicationKind[] = ['MAGAZINE_ISSUE', 'BOOK', 'PROCEEDINGS', 'REPORT', 'OTHER'];
export interface TitledText { title?: string; description?: string }
export interface PublicationRequest {
  kind: PublicationKind; year: number; issueNumber?: string | null; categoryId?: number | null; coverImageId?: string | null;
  pdfFileId?: string | null; featured?: boolean; translations: Translations<TitledText>;
}
export interface PublicationAdmin {
  id: number; kind: PublicationKind; year: number; issueNumber: string | null; status: ContentStatus; publishedAt: string | null; featured: boolean;
  categoryId: number | null; coverImage: MediaDto | null; pdfFile: MediaDto | null; translations: Translations<TitledText>;
  translationStatus: TranslationStatus[]; authorName: string | null; version: number; createdAt: string; updatedAt: string;
}
export interface PublicationListItem {
  id: number; kind: PublicationKind; year: number; issueNumber: string | null; status: ContentStatus; publishedAt: string | null; featured: boolean;
  title: string; titleLocale: Lang | null; categoryName: string | null; translationStatus: TranslationStatus[]; updatedAt: string;
}

export type EventType = 'CONFERENCE' | 'SEMINAR' | 'WORKSHOP' | 'STUDY_DAY' | 'FIELD_TRIP' | 'EXHIBITION' | 'GENERAL_ASSEMBLY' | 'MEETING' | 'OTHER';
export const EVENT_TYPES: readonly EventType[] = ['CONFERENCE', 'SEMINAR', 'WORKSHOP', 'STUDY_DAY', 'FIELD_TRIP', 'EXHIBITION', 'GENERAL_ASSEMBLY', 'MEETING', 'OTHER'];
export interface EventText { title?: string; description?: string; location?: string; organizer?: string }
export interface EventRequest {
  slug?: string | null; type: EventType; startsAt: string; endsAt?: string | null; allDay?: boolean; registrationUrl?: string | null;
  categoryId?: number | null; imageId?: string | null; programFileId?: string | null; featured?: boolean; translations: Translations<EventText>;
}
export interface EventAdmin {
  id: number; slug: string; type: EventType; startsAt: string; endsAt: string | null; allDay: boolean; registrationUrl: string | null; status: ContentStatus;
  publishedAt: string | null; featured: boolean; categoryId: number | null; image: MediaDto | null; programFile: MediaDto | null; translations: Translations<EventText>;
  translationStatus: TranslationStatus[]; timeStatus: TimeStatus; authorName: string | null; version: number; createdAt: string; updatedAt: string;
}
export interface EventListItem {
  id: number; slug: string; type: EventType; startsAt: string; endsAt: string | null; allDay: boolean; status: ContentStatus; publishedAt: string | null;
  featured: boolean; title: string; titleLocale: Lang | null; location: string | null; timeStatus: TimeStatus; translationStatus: TranslationStatus[]; updatedAt: string;
}

export type ResourceKind = 'DOCUMENT' | 'MAP' | 'RESEARCH' | 'REPORT' | 'OFFICIAL' | 'EDUCATIONAL';
export const RESOURCE_KINDS: readonly ResourceKind[] = ['DOCUMENT', 'MAP', 'RESEARCH', 'REPORT', 'OFFICIAL', 'EDUCATIONAL'];
export interface ResourceRequest { kind: ResourceKind; externalUrl?: string | null; categoryId?: number | null; fileId?: string | null; translations: Translations<TitledText> }
export interface ResourceAdmin {
  id: number; kind: ResourceKind; externalUrl: string | null; status: ContentStatus; publishedAt: string | null; categoryId: number | null; file: MediaDto | null;
  translations: Translations<TitledText>; translationStatus: TranslationStatus[]; authorName: string | null; version: number; createdAt: string; updatedAt: string;
}
export interface ResourceListItem {
  id: number; kind: ResourceKind; status: ContentStatus; publishedAt: string | null; title: string; titleLocale: Lang | null; categoryName: string | null;
  translationStatus: TranslationStatus[]; updatedAt: string;
}

// ---- site ----
export type CategoryType = 'NEWS' | 'PUBLICATION' | 'EVENT' | 'RESOURCE';
export const CATEGORY_TYPES: readonly CategoryType[] = ['NEWS', 'PUBLICATION', 'EVENT', 'RESOURCE'];
export interface CategoryText { name: string; description?: string | null }
export interface CategoryRequest { type: CategoryType; slug?: string | null; sortOrder?: number; active?: boolean; translations: Translations<CategoryText> }
export interface CategoryAdmin { id: number; type: CategoryType; slug: string; sortOrder: number; active: boolean; translations: Translations<CategoryText>; usageCount: number }

export interface PartnerRequest { name: string; websiteUrl?: string | null; logoId?: string | null; sortOrder?: number; active?: boolean; translations?: Translations<{ name: string }> }
export interface PartnerAdmin { id: number; name: string; websiteUrl: string | null; logo: MediaDto | null; sortOrder: number; active: boolean; translations: Translations<{ name: string }> }

export interface HomepageSection { id: number; key: string; enabled: boolean; sortOrder: number; content: Record<string, unknown>; version: number; updatedAt: string }
export interface Setting { key: string; value: unknown; isPublic: boolean; updatedAt: string }

// ---- operations ----
export type ContactStatus = 'NEW' | 'READ' | 'ARCHIVED';
export interface ContactMessage { id: number; name: string; email: string; subject: string | null; message: string; locale: string | null; status: ContactStatus; createdAt: string; handledAt: string | null }
export interface AuditLog { id: number; occurredAt: string; actorId: number | null; actorEmail: string | null; action: string; resourceType: string | null; resourceId: string | null; summary: string | null; ipAddress: string | null }

export interface StatusCounts { total: number; byStatus: Record<string, number> }
export interface TranslationGapReport { incomplete: number; items: { id: number; title: string; missingLocales: Lang[] }[] }
export interface DashboardStats {
  news: StatusCounts; publications: StatusCounts; resources: StatusCounts;
  events: StatusCounts & { upcoming: number; past: number };
  mediaFiles: number; newContactMessages: number; adminUsers: number | null;
  newsPerMonth: { month: string; count: number }[];
  translationGaps: Record<string, TranslationGapReport>;
}

export interface NewsDetail {
  id: number; slug: string; title: string; summary: string | null; content: string | null; seoTitle: string | null; seoDescription: string | null;
  publishedAt: string | null; category: { id: number; slug: string; name: string } | null; tags: string[]; featured: boolean;
  image: { id: string; url: string; thumbnailUrl: string | null; altText: string | null } | null; locale: Lang; fallback: boolean; availableLocales: Lang[];
}
