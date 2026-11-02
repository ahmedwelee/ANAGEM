import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ModalComponent } from './modal';

@Component({
  selector: 'app-confirm-host',
  imports: [ModalComponent, TranslocoPipe],
  template: `
    @let r = confirm.request();
    <app-modal [open]="!!r" [title]="r?.title ?? ''" width="28rem" (closed)="confirm.answer(false)">
      @if (r) { <p class="text-sm leading-relaxed text-ink">{{ r.message | transloco: r.params }}</p> }
      <ng-container modal-footer>
        <button type="button" class="btn btn-secondary" (click)="confirm.answer(false)">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="btn" [class]="r?.danger ? 'btn-danger' : 'btn-primary'" (click)="confirm.answer(true)">{{ (r?.confirmLabel ?? 'common.confirm') | transloco }}</button>
      </ng-container>
    </app-modal>`,
})
export class ConfirmHostComponent {
  protected readonly confirm = inject(ConfirmService);
}
