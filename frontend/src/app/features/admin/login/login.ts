import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError, LANGS, Lang } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslocoPipe, IconComponent, FieldErrorComponent],
  templateUrl: './login.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly lang = inject(LangService);
  protected readonly langs = LANGS;

  readonly redirect = input<string | undefined>();
  protected readonly loading = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected setLang(l: Lang) { void this.lang.set(l); }

  protected submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorKey.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email.trim(), password).subscribe({
      next: (r) => {
        this.loading.set(false);
        void this.lang.set(r.user.preferredLocale);
        const target = this.redirect();
        void this.router.navigateByUrl(target && target.startsWith('/admin') && !target.startsWith('/admin/login') ? target : '/admin');
      },
      error: (e: ApiError) => {
        this.loading.set(false);
        this.errorKey.set(e.code === 'INVALID_CREDENTIALS' ? 'login.invalid' : e.code === 'RATE_LIMITED' ? 'login.tooMany' : e.code === 'NETWORK' ? 'common.network' : 'login.failed');
      },
    });
  }
}
