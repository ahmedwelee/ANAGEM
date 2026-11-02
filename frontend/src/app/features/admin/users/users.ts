import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UsersApi } from '../../../core/api/admin-api';
import { ApiError, DEFAULT_LANG, PermissionDto, RoleDto, UserDto } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmService } from '../../../core/ui/confirm.service';
import { ToastService } from '../../../core/ui/toast.service';
import { ApiErrorBannerComponent } from '../../../shared/components/api-error-banner';
import { FieldErrorComponent } from '../../../shared/components/field-error';
import { IconComponent } from '../../../shared/components/icon';
import { ModalComponent } from '../../../shared/components/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header';
import { ErrorStateComponent, SkeletonRowsComponent } from '../../../shared/components/states';
import { apiErrorMessage } from '../../../shared/util/api-error';
import { AppDatePipe } from '../../../shared/util/app-date.pipe';

type Modal = { kind: 'create' } | { kind: 'edit'; user: UserDto } | { kind: 'reset'; user: UserDto } | null;

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, FormsModule, TranslocoPipe, IconComponent, PageHeaderComponent, ModalComponent, FieldErrorComponent, ApiErrorBannerComponent, ErrorStateComponent, SkeletonRowsComponent, AppDatePipe],
  templateUrl: './users.html',
})
export class UsersComponent {
  private readonly api = inject(UsersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly t = inject(TranslocoService);
  protected readonly auth = inject(AuthService);

  protected readonly tab = signal<'users' | 'roles'>(this.auth.can('USER_MANAGE') ? 'users' : 'roles');
  protected readonly users = signal<UserDto[]>([]);
  protected readonly roles = signal<RoleDto[]>([]);
  protected readonly permissions = signal<PermissionDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly modal = signal<Modal>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<ApiError | null>(null);
  protected readonly showPw = signal(false);
  protected readonly canUsers = computed(() => this.auth.can('USER_MANAGE'));
  protected readonly canRoles = computed(() => this.auth.can('ROLE_MANAGE'));

  protected readonly userForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    roleName: new FormControl('EDITOR', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true }),
    enabled: new FormControl(true, { nonNullable: true }),
    preferredLocale: new FormControl<string>(DEFAULT_LANG, { nonNullable: true }),
  });

  /** Draft permission sets per role id (checkbox matrix). */
  protected draft = new Map<number, Set<string>>();
  protected readonly dirtyRoles = signal<number[]>([]);
  protected readonly savingRoles = signal(false);

  constructor() { this.load(); }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    const done = () => this.loading.set(false);
    const fail = (e: ApiError) => { this.error.set(e); this.loading.set(false); };
    if (this.canUsers()) this.api.list().subscribe({ next: (u) => this.users.set(u), error: fail });
    this.api.roles().subscribe({
      next: (r) => { this.roles.set(r); this.draft = new Map(r.map((x) => [x.id, new Set(x.permissions)])); this.dirtyRoles.set([]); if (!this.canRoles()) done(); },
      error: fail,
    });
    if (this.canRoles()) this.api.permissions().subscribe({ next: (p) => { this.permissions.set(p); done(); }, error: fail });
    else if (this.canUsers()) setTimeout(done, 0);
  }

  protected isSelf(u: UserDto) { return u.id === this.auth.user()?.id; }
  protected isSelfEdit() { const m = this.modal(); return !!m && m.kind === 'edit' && this.isSelf(m.user); }

  // ----- users -----
  protected openCreate() {
    this.formError.set(null);
    this.userForm.reset({ email: '', fullName: '', roleName: 'EDITOR', password: this.generatePassword(), enabled: true, preferredLocale: DEFAULT_LANG });
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(12), Validators.maxLength(128)]);
    this.userForm.controls.email.enable();
    this.showPw.set(true);
    this.modal.set({ kind: 'create' });
  }
  protected openEdit(u: UserDto) {
    this.formError.set(null);
    this.userForm.reset({ email: u.email, fullName: u.fullName, roleName: u.role, password: '', enabled: u.enabled, preferredLocale: u.preferredLocale });
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.email.disable();
    this.modal.set({ kind: 'edit', user: u });
  }
  protected openReset(u: UserDto) {
    this.formError.set(null);
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(12), Validators.maxLength(128)]);
    this.userForm.controls.password.setValue(this.generatePassword());
    this.showPw.set(true);
    this.modal.set({ kind: 'reset', user: u });
  }
  protected generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const buf = crypto.getRandomValues(new Uint32Array(18));
    return Array.from(buf, (n) => chars[n % chars.length]).join('');
  }
  protected regenerate() { this.userForm.controls.password.setValue(this.generatePassword()); this.showPw.set(true); }
  protected copyPw() { navigator.clipboard?.writeText(this.userForm.controls.password.value).then(() => this.toast.success('common.copied'), () => undefined); }

  protected submit() {
    const m = this.modal();
    if (!m) return;
    const v = this.userForm.getRawValue();
    this.formError.set(null);
    if (m.kind === 'reset') {
      this.userForm.controls.password.markAsTouched();
      if (this.userForm.controls.password.invalid) return;
      this.run(this.api.resetPassword(m.user.id, v.password), 'users.passwordReset');
      return;
    }
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid) return;
    if (m.kind === 'create') this.run(this.api.create({ email: v.email.trim(), fullName: v.fullName.trim(), roleName: v.roleName, password: v.password, preferredLocale: v.preferredLocale }), 'common.saved');
    else this.run(this.api.update(m.user.id, { fullName: v.fullName.trim(), roleName: this.isSelf(m.user) ? undefined : v.roleName, enabled: this.isSelf(m.user) ? undefined : v.enabled, preferredLocale: v.preferredLocale }), 'common.saved');
  }

  private run(call: ReturnType<UsersApi['list']> | ReturnType<UsersApi['create']> | ReturnType<UsersApi['resetPassword']>, okKey: string) {
    this.saving.set(true);
    (call as import('rxjs').Observable<unknown>).subscribe({
      next: () => { this.saving.set(false); this.modal.set(null); this.toast.success(okKey); this.load(); },
      error: (e: ApiError) => { this.saving.set(false); this.formError.set(e); },
    });
  }

  protected async remove(u: UserDto) {
    const ok = await this.confirm.ask({ title: 'common.deleteTitle', message: 'users.deleteConfirm', params: { name: u.fullName }, confirmLabel: 'common.delete', danger: true });
    if (!ok) return;
    this.api.delete(u.id).subscribe({ next: () => { this.toast.success('common.deleted'); this.load(); }, error: (e: ApiError) => this.toast.error(apiErrorMessage(this.t, e)) });
  }

  // ----- roles -----
  protected has(roleId: number, code: string) { return this.draft.get(roleId)?.has(code) ?? false; }
  protected toggle(role: RoleDto, code: string, on: boolean) {
    const s = this.draft.get(role.id) ?? new Set<string>();
    on ? s.add(code) : s.delete(code);
    this.draft.set(role.id, s);
    const changed = this.roles().filter((r) => !r.systemRole || r.name !== 'SUPER_ADMIN').filter((r) => { const a = [...(this.draft.get(r.id) ?? [])].sort().join(); return a !== [...r.permissions].sort().join(); }).map((r) => r.id);
    this.dirtyRoles.set(changed);
  }
  protected saveRoles() {
    const ids = this.dirtyRoles();
    if (!ids.length) return;
    this.savingRoles.set(true);
    const next = (i: number) => {
      if (i >= ids.length) { this.savingRoles.set(false); this.toast.success('common.saved'); this.load(); return; }
      this.api.setRolePermissions(ids[i], [...(this.draft.get(ids[i]) ?? [])]).subscribe({ next: () => next(i + 1), error: (e: ApiError) => { this.savingRoles.set(false); this.toast.error(apiErrorMessage(this.t, e)); } });
    };
    next(0);
  }
}
