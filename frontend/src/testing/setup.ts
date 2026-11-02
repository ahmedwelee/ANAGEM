import { afterEach } from 'vitest'; // imported, not a global: this file must type-check under any tsconfig (editor, dev server, build)

/**
 * Browser features the app uses that jsdom does not implement. Loaded once for every spec (angular.json: test.options.setupFiles),
 * so individual specs do not need their own stubs.
 */
const g = globalThis as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// <dialog> (modals, media picker)
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.show ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
}

// scroll-reveal directive
g['IntersectionObserver'] ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
g['ResizeObserver'] ??= class { observe() {} unobserve() {} disconnect() {} };

// scrolling helpers called after paging / opening panels
if (typeof window !== 'undefined') {
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
}
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView ??= () => undefined;

// A signed-in session, the chosen language and the like live in storage: never let one test see another's.
afterEach(() => {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage unavailable */ }
});
