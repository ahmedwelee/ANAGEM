import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './icon';

/** Accessible modal built on the native <dialog> (focus trap, Esc to close, inert background). */
@Component({
  selector: 'app-modal',
  imports: [IconComponent, TranslocoPipe],
  template: `
    <dialog #dlg (close)="closed.emit()" (click)="onBackdrop($event)" [attr.aria-label]="title() | transloco"
      class="m-auto max-h-[92vh] w-[min(94vw,var(--w))] overflow-hidden rounded-card border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-primary-deep/45 backdrop:backdrop-blur-[2px]"
      [style.--w]="width()">
      <div class="flex max-h-[92vh] flex-col">
        <header class="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 class="text-base font-bold text-primary-dark">{{ title() | transloco }}</h2>
          <button type="button" class="btn btn-ghost btn-icon" (click)="dlg.close()" [attr.aria-label]="'common.close' | transloco"><app-icon name="x" /></button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto p-5"><ng-content /></div>
        <footer class="empty:hidden flex flex-wrap justify-end gap-2 border-t border-line bg-canvas px-5 py-3"><ng-content select="[modal-footer]" /></footer>
      </div>
    </dialog>`,
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly width = input('36rem');
  readonly closed = output<void>();
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const d = this.dlg().nativeElement;
      if (this.open() && !d.open) d.showModal();
      else if (!this.open() && d.open) d.close();
    });
  }

  onBackdrop(e: MouseEvent) { if (e.target === this.dlg().nativeElement) this.dlg().nativeElement.close(); }
}
