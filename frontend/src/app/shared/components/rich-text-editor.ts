import { Component, ElementRef, OnDestroy, effect, forwardRef, inject, input, signal, viewChild, AfterViewInit } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import { MediaDto } from '../../core/api/models';
import { IconComponent } from './icon';
import { MediaPickerComponent } from './media-picker';
import { ModalComponent } from './modal';

interface Tool { id: string; icon: string; run: (e: Editor) => void; active?: (e: Editor) => boolean; sepAfter?: boolean }

const TOOLS: Tool[] = [
  { id: 'h2', icon: 'heading-2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { id: 'h3', icon: 'heading-3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }), sepAfter: true },
  { id: 'bold', icon: 'bold', run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { id: 'italic', icon: 'italic', run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { id: 'underline', icon: 'underline', run: (e) => e.chain().focus().toggleUnderline().run(), active: (e) => e.isActive('underline'), sepAfter: true },
  { id: 'bulletList', icon: 'list', run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { id: 'orderedList', icon: 'list-ordered', run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  { id: 'quote', icon: 'quote', run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote'), sepAfter: true },
  { id: 'table', icon: 'table', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), active: (e) => e.isActive('table') },
];

/** Rich text control (TipTap). Honors the language direction so Arabic is edited right-to-left. Output is sanitized again by the backend. */
@Component({
  selector: 'app-rich-text-editor',
  imports: [IconComponent, TranslocoPipe, FormsModule, ModalComponent, MediaPickerComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditorComponent), multi: true }],
  template: `
    <div class="overflow-hidden rounded-lg border border-line-strong bg-surface transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
      <div class="flex flex-wrap items-center gap-0.5 border-b border-line bg-canvas p-1.5" role="toolbar" [attr.aria-label]="'editor.toolbar' | transloco">
        @for (t of tools; track t.id) {
          <button type="button" class="btn btn-ghost btn-icon btn-sm" [class.bg-primary-soft]="isActive(t)" [attr.aria-pressed]="isActive(t)"
            [attr.title]="'editor.' + t.id | transloco" [attr.aria-label]="'editor.' + t.id | transloco" [disabled]="disabled()" (click)="run(t)"><app-icon [name]="t.icon" /></button>
          @if (t.sepAfter) { <span class="mx-1 h-5 w-px bg-line-strong"></span> }
        }
        <button type="button" class="btn btn-ghost btn-icon btn-sm" [class.bg-primary-soft]="isLink()" [attr.title]="'editor.link' | transloco" [attr.aria-label]="'editor.link' | transloco" [disabled]="disabled()" (click)="toggleLink()"><app-icon name="link" /></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" [attr.title]="'editor.image' | transloco" [attr.aria-label]="'editor.image' | transloco" [disabled]="disabled()" (click)="imageOpen.set(true)"><app-icon name="image-plus" /></button>
        <span class="mx-1 h-5 w-px bg-line-strong"></span>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" [attr.title]="'editor.undo' | transloco" [attr.aria-label]="'editor.undo' | transloco" [disabled]="disabled()" (click)="editor?.chain()?.focus()?.undo()?.run()"><app-icon name="undo-2" class="rtl:-scale-x-100" /></button>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" [attr.title]="'editor.redo' | transloco" [attr.aria-label]="'editor.redo' | transloco" [disabled]="disabled()" (click)="editor?.chain()?.focus()?.redo()?.run()"><app-icon name="redo-2" class="rtl:-scale-x-100" /></button>
      </div>

      @if (linkOpen()) {
        <div class="flex flex-wrap items-center gap-2 border-b border-line bg-primary-light px-3 py-2">
          <input type="text" class="input h-9 min-w-56 flex-1" dir="ltr" [(ngModel)]="linkUrl" [ngModelOptions]="{ standalone: true }" placeholder="https://" (keydown.enter)="$event.preventDefault(); applyLink()" />
          <button type="button" class="btn btn-primary btn-sm" (click)="applyLink()">{{ 'editor.apply' | transloco }}</button>
          @if (isLink()) { <button type="button" class="btn btn-danger-ghost btn-sm" (click)="removeLink()">{{ 'editor.unlink' | transloco }}</button> }
          <button type="button" class="btn btn-ghost btn-sm" (click)="linkOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
        </div>
      }
      @if (inTable()) {
        <div class="flex flex-wrap items-center gap-1 border-b border-line bg-primary-light px-3 py-1.5 text-xs">
          <span class="me-1 font-semibold text-primary-dark">{{ 'editor.table' | transloco }}:</span>
          <button type="button" class="btn btn-secondary btn-sm" (click)="table('addRowAfter')">+ {{ 'editor.row' | transloco }}</button>
          <button type="button" class="btn btn-secondary btn-sm" (click)="table('deleteRow')">− {{ 'editor.row' | transloco }}</button>
          <button type="button" class="btn btn-secondary btn-sm" (click)="table('addColumnAfter')">+ {{ 'editor.column' | transloco }}</button>
          <button type="button" class="btn btn-secondary btn-sm" (click)="table('deleteColumn')">− {{ 'editor.column' | transloco }}</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" (click)="table('deleteTable')"><app-icon name="trash-2" />{{ 'editor.deleteTable' | transloco }}</button>
        </div>
      }
      <div #host class="rte-content max-h-[32rem] overflow-y-auto"></div>
    </div>

    <app-modal [open]="imageOpen()" title="editor.imageTitle" width="52rem" (closed)="imageOpen.set(false)">
      @if (imageOpen()) { <app-media-picker kind="IMAGE" (picked)="insertImage($event)" /> }
    </app-modal>`,
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  protected readonly tools = TOOLS;
  readonly dir = input<'ltr' | 'rtl'>('ltr');
  readonly lang = input('fr');
  readonly placeholder = input('');
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  protected editor?: Editor;
  protected readonly tick = signal(0);
  protected readonly disabled = signal(false);
  protected readonly linkOpen = signal(false);
  protected readonly imageOpen = signal(false);
  protected linkUrl = '';
  private pending = '';
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      const attrs = { dir: this.dir(), lang: this.lang(), 'aria-label': this.placeholder() || 'editor' };
      this.editor?.setOptions({ editorProps: { attributes: attrs } });
    });
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.host().nativeElement,
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } } }),
        Image.configure({ inline: false }),
        Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
        Placeholder.configure({ placeholder: () => this.placeholder() }),
      ],
      content: this.pending,
      editorProps: { attributes: { dir: this.dir(), lang: this.lang() } },
      onUpdate: ({ editor }) => { this.onChange(editor.isEmpty ? '' : editor.getHTML()); this.tick.update((n) => n + 1); },
      onSelectionUpdate: () => this.tick.update((n) => n + 1),
      onBlur: () => this.onTouched(),
    });
    if (this.disabled()) this.editor.setEditable(false, false);
  }

  ngOnDestroy(): void { this.editor?.destroy(); }

  writeValue(v: string | null): void {
    this.pending = v ?? '';
    if (this.editor && this.editor.getHTML() !== this.pending) this.editor.commands.setContent(this.pending, { emitUpdate: false });
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); this.editor?.setEditable(!d, false); }

  protected isActive(t: Tool): boolean { this.tick(); return !!this.editor && !!t.active?.(this.editor); }
  protected isLink(): boolean { this.tick(); return !!this.editor?.isActive('link'); }
  protected inTable(): boolean { this.tick(); return !!this.editor?.isActive('table'); }
  protected run(t: Tool) { if (this.editor) t.run(this.editor); }

  protected toggleLink() {
    if (!this.editor) return;
    this.linkUrl = (this.editor.getAttributes('link')['href'] as string | undefined) ?? '';
    this.linkOpen.update((o) => !o);
  }
  protected applyLink() {
    const raw = this.linkUrl.trim();
    if (!this.editor) return;
    if (!raw) { this.removeLink(); return; }
    const href = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(raw) ? raw : 'https://' + raw;
    this.editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    this.linkOpen.set(false);
  }
  protected removeLink() { this.editor?.chain().focus().extendMarkRange('link').unsetLink().run(); this.linkOpen.set(false); }
  protected table(cmd: 'addRowAfter' | 'deleteRow' | 'addColumnAfter' | 'deleteColumn' | 'deleteTable') { (this.editor?.chain().focus() as unknown as Record<string, () => { run: () => void }>)[cmd]?.().run(); }

  protected insertImage(m: MediaDto) {
    const l = this.lang() as 'fr' | 'ar' | 'en';
    const alt = m.translations[l]?.altText ?? m.translations.fr?.altText ?? '';
    this.editor?.chain().focus().setImage({ src: m.url, alt }).run();
    this.imageOpen.set(false);
  }
}
