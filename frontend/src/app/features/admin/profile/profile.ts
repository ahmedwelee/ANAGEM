import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';

const matches = (g: AbstractControl): ValidationErrors | null => (g.get('next')?.value === g.get('confirm')?.value ? null : { mismatch: true });

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, FieldErrorComponent, ApiErrorBannerComponent, AppDatePipe],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  private readonly toast = inject(ToastService);
  protected readonly saving = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly show = signal(false);
  protected readonly form = new FormGroup({
    current: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    next: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)] }),
    confirm: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: matches });

  protected submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(v.current, v.next).subscribe({
      next: () => { this.saving.set(false); this.toast.success('profile.changed'); this.auth.clear(); location.assign('/admin/login'); },
      error: (e: ApiError) => { this.saving.set(false); this.error.set(e); },
    });
  }
}
