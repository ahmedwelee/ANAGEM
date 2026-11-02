import { Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/** Fades content in as it scrolls into view. Runs in the browser only, so server-rendered HTML is always fully visible. */
@Directive({ selector: '[appReveal]' })
export class RevealDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Stagger step (0-8). */
  readonly appReveal = input<number | string>(0);

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r = this.el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9 && r.bottom > 0) return; // already on screen at load: no animation, no flash
      this.el.style.setProperty('--d', String(this.appReveal() || 0));
      this.el.classList.add('reveal-js');
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting || e.boundingClientRect.top < 0) { this.el.classList.add('is-in'); io.unobserve(this.el); }
      }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      io.observe(this.el);
    });
  }
}
