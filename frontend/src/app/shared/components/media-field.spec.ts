import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MediaDto } from '../../core/api/models';
import { provideAppTesting } from '../../../testing/test-providers';
import { MediaFieldComponent } from './media-field';

const photo: MediaDto = { id: 'm1', originalName: 'rif.jpg', contentType: 'image/jpeg', kind: 'IMAGE', sizeBytes: 2_621_440, width: 1200, height: 800, url: '/api/public/media/m1', thumbnailUrl: '/api/public/media/m1/thumbnail', translations: {}, createdAt: '2026-01-01T00:00:00Z', uploadedBy: null };

@Component({ imports: [MediaFieldComponent, ReactiveFormsModule], template: `<app-media-field [formControl]="ctrl" kind="IMAGE" variant="cover" />` })
class Host { ctrl = new FormControl<MediaDto | null>(null); }

describe('MediaFieldComponent (cover variant: the news picture)', () => {
  let f: ComponentFixture<Host>;
  const el = () => f.nativeElement as HTMLElement;
  // the modal (a <dialog>) has buttons of its own: only look at the field itself
  const buttons = () => [...el().querySelectorAll<HTMLButtonElement>('app-media-field button')].filter((b) => !b.closest('dialog'));
  const label = (b: HTMLButtonElement) => b.textContent!.trim();

  beforeEach(async () => {
    // jsdom has no <dialog> support
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    f = TestBed.createComponent(Host);
    await f.whenStable();
  });

  it('invites the editor to add a picture when there is none', () => {
    expect(buttons().map(label)).toEqual(['media.addImage']);
    expect(el().querySelector('img')).toBeNull();
  });

  it('shows a large preview with replace and remove once a picture is chosen', async () => {
    f.componentInstance.ctrl.setValue(photo);
    await f.whenStable();
    expect(el().querySelector('app-media-field img')?.getAttribute('src')).toBe('/api/public/media/m1');
    expect(el().textContent).toContain('rif.jpg');
    expect(el().textContent).toContain('2.5 MB');
    expect(buttons().map(label)).toEqual(['media.replace', 'common.remove']);
  });

  it('removing the picture clears the form value and brings back the add button', async () => {
    f.componentInstance.ctrl.setValue(photo);
    await f.whenStable();
    buttons()[1].click();
    await f.whenStable();
    expect(f.componentInstance.ctrl.value).toBeNull();
    expect(buttons().map(label)).toEqual(['media.addImage']);
  });

  it('the add button opens the library/upload picker', async () => {
    buttons()[0].click();
    await f.whenStable();
    expect(el().querySelector('app-media-picker')).not.toBeNull();
  });

  it('is locked while the form is disabled', async () => {
    f.componentInstance.ctrl.disable();
    await f.whenStable();
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });
});

@Component({ imports: [MediaFieldComponent, ReactiveFormsModule], template: `<app-media-field [formControl]="cover" kind="IMAGE" variant="portrait" /><app-media-field [formControl]="pdf" kind="PDF" />` })
class PublicationHost { cover = new FormControl<MediaDto | null>(null); pdf = new FormControl<MediaDto | null>(null); }

describe('MediaFieldComponent (publication cover and PDF)', () => {
  let f: ComponentFixture<PublicationHost>;
  const field = (i: number) => (f.nativeElement as HTMLElement).querySelectorAll('app-media-field')[i];
  const btns = (i: number) => [...field(i).querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.closest('dialog')).map((b) => b.textContent!.trim());
  const pdfFile: MediaDto = { ...photo, id: 'p1', originalName: 'numero-12.pdf', contentType: 'application/pdf', kind: 'PDF', thumbnailUrl: null, url: '/api/public/media/p1' };

  beforeEach(async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); };
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    f = TestBed.createComponent(PublicationHost);
    await f.whenStable();
  });

  it('shows an add button on a book-cover shaped placeholder when there is no cover', () => {
    expect(btns(0)).toEqual(['media.addImage']);
    expect(field(0).querySelector('.aspect-\\[3\\/4\\]')).not.toBeNull();
  });

  it('shows the cover thumbnail with its details, replace and remove', async () => {
    f.componentInstance.cover.setValue(photo);
    await f.whenStable();
    expect(field(0).querySelector('img')?.getAttribute('src')).toBe('/api/public/media/m1/thumbnail');
    expect(field(0).textContent).toContain('rif.jpg');
    expect(btns(0)).toEqual(['media.replace', 'common.remove']);
    [...field(0).querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.includes('common.remove'))!.click();
    await f.whenStable();
    expect(f.componentInstance.cover.value).toBeNull();
  });

  it('keeps the PDF as a compact row with a file icon, not an image preview', async () => {
    f.componentInstance.pdf.setValue(pdfFile);
    await f.whenStable();
    expect(field(1).querySelector('img')).toBeNull();
    expect(field(1).textContent).toContain('numero-12.pdf');
    expect(btns(1)[0]).toBe('media.replace');
  });
});
