import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { params } from './api.util';
import { ContentApi } from './content-api';
import * as M from './models';

@Injectable({ providedIn: 'root' })
export class NewsApi extends ContentApi<M.NewsListItem, M.NewsAdmin, M.NewsRequest> {
  constructor() { super(inject(HttpClient), '/api/admin/news'); }
  preview(id: number, lang: M.Lang): Observable<M.NewsDetail> { return this.http.get<M.NewsDetail>(`${this.base}/${id}/preview`, { params: params({ lang }) }); }
}

@Injectable({ providedIn: 'root' })
export class PublicationsApi extends ContentApi<M.PublicationListItem, M.PublicationAdmin, M.PublicationRequest> {
  constructor() { super(inject(HttpClient), '/api/admin/publications'); }
}

@Injectable({ providedIn: 'root' })
export class EventsApi extends ContentApi<M.EventListItem, M.EventAdmin, M.EventRequest> {
  constructor() { super(inject(HttpClient), '/api/admin/events'); }
}

@Injectable({ providedIn: 'root' })
export class ResourcesApi extends ContentApi<M.ResourceListItem, M.ResourceAdmin, M.ResourceRequest> {
  constructor() { super(inject(HttpClient), '/api/admin/resources'); }
}

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private http = inject(HttpClient);
  list(type?: M.CategoryType): Observable<M.CategoryAdmin[]> { return this.http.get<M.CategoryAdmin[]>('/api/admin/categories', { params: params({ type }) }); }
  create(b: M.CategoryRequest) { return this.http.post<M.CategoryAdmin>('/api/admin/categories', b); }
  update(id: number, b: M.CategoryRequest) { return this.http.put<M.CategoryAdmin>(`/api/admin/categories/${id}`, b); }
  delete(id: number) { return this.http.delete<void>(`/api/admin/categories/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class MediaApi {
  private http = inject(HttpClient);
  list(q: { q?: string; kind?: string; page?: number; size?: number }): Observable<M.Page<M.MediaDto>> { return this.http.get<M.Page<M.MediaDto>>('/api/admin/media', { params: params(q) }); }
  upload(file: File): Observable<M.MediaDto> { const f = new FormData(); f.append('file', file, file.name); return this.http.post<M.MediaDto>('/api/admin/media/upload', f); }
  get(id: string): Observable<M.MediaDto> { return this.http.get<M.MediaDto>(`/api/admin/media/${id}`); }
  update(id: string, translations: M.Translations<M.MediaText>) { return this.http.put<M.MediaDto>(`/api/admin/media/${id}`, { translations }); }
  delete(id: string, force = false) { return this.http.delete<void>(`/api/admin/media/${id}`, { params: params({ force }) }); }
}

@Injectable({ providedIn: 'root' })
export class PartnersApi {
  private http = inject(HttpClient);
  list() { return this.http.get<M.PartnerAdmin[]>('/api/admin/partners'); }
  create(b: M.PartnerRequest) { return this.http.post<M.PartnerAdmin>('/api/admin/partners', b); }
  update(id: number, b: M.PartnerRequest) { return this.http.put<M.PartnerAdmin>(`/api/admin/partners/${id}`, b); }
  delete(id: number) { return this.http.delete<void>(`/api/admin/partners/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class SiteApi {
  private http = inject(HttpClient);
  sections() { return this.http.get<M.HomepageSection[]>('/api/admin/homepage/sections'); }
  updateSection(key: string, body: { enabled?: boolean; sortOrder?: number; content: Record<string, unknown> }) { return this.http.put<M.HomepageSection>(`/api/admin/homepage/sections/${key}`, body); }
  settings() { return this.http.get<M.Setting[]>('/api/admin/settings'); }
  updateSettings(settings: Record<string, unknown>) { return this.http.put<M.Setting[]>('/api/admin/settings', { settings }); }
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private http = inject(HttpClient);
  list() { return this.http.get<M.UserDto[]>('/api/admin/users'); }
  create(b: { email: string; fullName: string; roleName: string; password: string; preferredLocale?: string }) { return this.http.post<M.UserDto>('/api/admin/users', b); }
  update(id: number, b: { fullName?: string; roleName?: string; enabled?: boolean; preferredLocale?: string }) { return this.http.put<M.UserDto>(`/api/admin/users/${id}`, b); }
  resetPassword(id: number, newPassword: string) { return this.http.post<void>(`/api/admin/users/${id}/reset-password`, { newPassword }); }
  delete(id: number) { return this.http.delete<void>(`/api/admin/users/${id}`); }
  roles() { return this.http.get<M.RoleDto[]>('/api/admin/roles'); }
  permissions() { return this.http.get<M.PermissionDto[]>('/api/admin/permissions'); }
  setRolePermissions(roleId: number, permissions: string[]) { return this.http.put<M.RoleDto>(`/api/admin/roles/${roleId}/permissions`, { permissions }); }
}

@Injectable({ providedIn: 'root' })
export class OpsApi {
  private http = inject(HttpClient);
  stats() { return this.http.get<M.DashboardStats>('/api/admin/dashboard/statistics'); }
  recent(limit = 12) { return this.http.get<M.AuditLog[]>('/api/admin/dashboard/recent-activity', { params: params({ limit }) }); }
  audit(q: Record<string, string | number | null | undefined>) { return this.http.get<M.Page<M.AuditLog>>('/api/admin/audit-logs', { params: params(q) }); }
  messages(q: { status?: string; page?: number; size?: number }) { return this.http.get<M.Page<M.ContactMessage>>('/api/admin/contact-messages', { params: params(q) }); }
  setMessageStatus(id: number, status: M.ContactStatus) { return this.http.patch<M.ContactMessage>(`/api/admin/contact-messages/${id}`, { status }); }
  deleteMessage(id: number) { return this.http.delete<void>(`/api/admin/contact-messages/${id}`); }
}
