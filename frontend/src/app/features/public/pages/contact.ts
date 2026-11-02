import { Component, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { LangService } from '../../../core/i18n/lang.service';
import { SeoService } from '../../../core/seo/seo.service';
import { SiteStore } from '../../../core/seo/site.store';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { PageBannerComponent } from '../shared/public-ui';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, TranslocoPipe, PageBannerComponent, FieldErrorComponent, IconComponent],
  template: `
    <app-page-banner [title]="'public.nav.contact' | transloco" [subtitle]="'public.contactSubtitle' | transloco" />
    <div class="mx-auto my-10 grid w-[min(100%-2rem,1100px)] gap-8 lg:grid-cols-[1fr_20rem]">
      <section class="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7" [attr.aria-label]="'public.nav.contact' | transloco">
        @if (sent()) {
          <div class="py-10 text-center" role="status"><span class="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-accent-soft text-3xl text-accent"><app-icon name="circle-check" /></span>
            <h2 class="text-xl font-extrabold text-primary-dark">{{ 'public.contactSent' | transloco }}</h2><p class="mx-auto mt-2 max-w-sm text-muted">{{ 'public.contactSentHint' | transloco }}</p>
            <button type="button" class="btn btn-secondary mt-6" (click)="again()">{{ 'public.sendAnother' | transloco }}</button></div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-5" novalidate>
            @if (error(); as e) { <div class="flex gap-3 rounded-lg bg-danger-soft p-3 text-sm text-danger" role="alert"><app-icon name="circle-alert" class="mt-0.5 text-lg" /><p>{{ e.status === 429 ? ('public.contactTooMany' | transloco) : ('public.contactError' | transloco) }}</p></div> }
            <div class="grid gap-5 sm:grid-cols-2">
              <div><label class="label" for="c-name">{{ 'public.fieldName' | transloco }} *</label><input id="c-name" class="input" formControlName="name" autocomplete="name" maxlength="150" /><app-field-error [control]="form.controls.name" /></div>
              <div><label class="label" for="c-email">{{ 'public.fieldEmail' | transloco }} *</label><input id="c-email" type="email" class="input" formControlName="email" autocomplete="email" maxlength="200" dir="ltr" /><app-field-error [control]="form.controls.email" /></div>
            </div>
            <div><label class="label" for="c-subject">{{ 'public.fieldSubject' | transloco }}</label><input id="c-subject" class="input" formControlName="subject" maxlength="200" /></div>
            <div><label class="label" for="c-message">{{ 'public.fieldMessage' | transloco }} *</label><textarea id="c-message" class="input" rows="7" formControlName="message" maxlength="5000"></textarea><app-field-error [control]="form.controls.message" /></div>
            <!-- Honeypot: hidden from people and assistive tech, bots fill it in and are silently dropped. -->
            <div class="absolute -start-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true"><label for="c-website">Website</label><input id="c-website" type="text" formControlName="website" tabindex="-1" autocomplete="off" /></div>
            <div class="flex items-center justify-between gap-3"><p class="text-xs text-muted">{{ 'public.contactPrivacy' | transloco }}</p>
              <button type="submit" class="btn btn-primary" [disabled]="sending()"><app-icon [name]="sending() ? 'loader-circle' : 'send'" [class.animate-spin]="sending()" class="rtl:-scale-x-100" />{{ 'public.send' | transloco }}</button></div>
          </form>
        }
      </section>
      <aside class="space-y-4 self-start" [attr.aria-label]="'public.contactInfo' | transloco">
        @if (site.text('contact.email'); as v) { <div class="flex gap-3 rounded-card border border-line bg-surface p-4"><app-icon name="mail" class="mt-0.5 text-xl text-primary" /><div class="min-w-0"><p class="text-sm font-semibold text-primary-dark">{{ 'public.fieldEmail' | transloco }}</p><a [href]="'mailto:' + v" class="text-sm break-words text-muted hover:text-primary hover:underline">{{ v }}</a></div></div> }
        @if (site.text('contact.phone'); as v) { <div class="flex gap-3 rounded-card border border-line bg-surface p-4"><app-icon name="phone" class="mt-0.5 text-xl text-primary" /><div><p class="text-sm font-semibold text-primary-dark">{{ 'public.phone' | transloco }}</p><a [href]="'tel:' + v" class="text-sm text-muted hover:text-primary hover:underline" dir="ltr">{{ v }}</a></div></div> }
        @if (site.text('contact.address'); as v) { <div class="flex gap-3 rounded-card border border-line bg-surface p-4"><app-icon name="map-pin" class="mt-0.5 text-xl text-primary" /><div><p class="text-sm font-semibold text-primary-dark">{{ 'public.address' | transloco }}</p><p class="text-sm whitespace-pre-line text-muted">{{ v }}</p></div></div> }
        @if (!site.text('contact.email') && !site.text('contact.phone') && !site.text('contact.address')) { <div class="rounded-card border border-dashed border-line-strong bg-surface p-4 text-sm text-muted">{{ 'public.contactInfoEmpty' | transloco }}</div> }
      </aside>
    </div>`,
})
export class ContactComponent {
  private readonly api = inject(PublicApi);
  private readonly seo = inject(SeoService);
  private readonly t = inject(TranslocoService);
  private readonly lang = inject(LangService);
  protected readonly site = inject(SiteStore);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    subject: ['', [Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    website: [''],
  });
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  constructor() {
    effect(() => {
      const l = this.lang.lang();
      untracked(() => this.seo.set({ title: this.t.translate('public.nav.contact'), description: this.t.translate('public.contactSubtitle'), path: '/contact', lang: l, siteName: this.site.siteName }));
    });
  }

  protected again() { this.form.reset(); this.sent.set(false); }

  protected submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true); this.error.set(null);
    const v = this.form.getRawValue();
    this.api.contact({ name: v.name.trim(), email: v.email.trim(), subject: v.subject.trim() || undefined, message: v.message.trim(), locale: this.lang.lang(), website: v.website }).subscribe({
      next: () => { this.sending.set(false); this.sent.set(true); this.form.reset(); },
      error: (e: ApiError) => { this.sending.set(false); this.error.set(e); },
    });
  }
}
