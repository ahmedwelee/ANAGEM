(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const I = window.AnagemI18n;

  /* ---------- Toast for features not wired to the backend yet ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('.toast'); if (!el) return;
    el.textContent = msg; el.hidden = false; el.classList.remove('is-out');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.add('is-out'); setTimeout(() => (el.hidden = true), 320); }, 3200);
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-soon]:not(form)')) { e.preventDefault(); toast(I.t('soon.msg')); } });
  $$('form[data-soon]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); toast(I.t('soon.msg')); }));

  /* ---------- Sticky header: top bar + brand band scroll away, nav stays ---------- */
  const header = $('.site-header');
  const stickyOffset = () => { header.style.top = -($('.topbar').offsetHeight + $('.brandbar').offsetHeight) + 'px'; };
  const onScroll = () => header.classList.toggle('is-stuck', scrollY > $('.topbar').offsetHeight + $('.brandbar').offsetHeight);
  addEventListener('resize', stickyOffset); addEventListener('scroll', onScroll, { passive: true });
  stickyOffset(); onScroll(); document.fonts?.ready.then(stickyOffset);

  /* ---------- Navigation: burger + dropdowns (hover via CSS, click/keyboard via JS) ---------- */
  const burger = $('.burger'), menu = $('#menu');
  const closeSubs = () => $$('.has-sub.is-open').forEach((li) => { li.classList.remove('is-open'); $('.menu__link', li).setAttribute('aria-expanded', 'false'); });
  burger.addEventListener('click', () => { const o = !menu.classList.contains('is-open'); menu.classList.toggle('is-open', o); burger.setAttribute('aria-expanded', String(o)); });
  $$('.has-sub > .menu__link').forEach((b) => b.addEventListener('click', () => {
    const li = b.parentElement, open = !li.classList.contains('is-open');
    closeSubs(); li.classList.toggle('is-open', open); b.setAttribute('aria-expanded', String(open));
  }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.mainnav')) closeSubs(); });
  $$('.submenu a, .menu__link[href]').forEach((a) => a.addEventListener('click', () => { closeSubs(); menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSubs(); menu.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); } });

  /* ---------- Language ---------- */
  $$('.lang__btn').forEach((b) => b.addEventListener('click', () => I.setLang(b.dataset.lang)));

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting && en.boundingClientRect.top > 0) return;
    en.target.classList.add('is-in');
    if (en.target.id === 'colloque') $('#map-mini')?.classList.add('is-drawn');
    io.unobserve(en.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((n) => io.observe(n));

  /* ---------- Maps ---------- */
  window.AnagemMap.renderMap($('#map-root'));
  window.AnagemMap.renderMap($('#map-mini'), { mini: true });
  setTimeout(() => $('#map-root').classList.add('is-drawn'), 350);
  const hm = $('.hero__map'), mr = $('#map-root');
  hm.addEventListener('pointermove', (e) => {
    const r = hm.getBoundingClientRect();
    mr.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2) + 'deg');
    mr.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 9).toFixed(2) + 'deg');
  });
  hm.addEventListener('pointerleave', () => { mr.style.setProperty('--ry', '0deg'); mr.style.setProperty('--rx', '0deg'); });

  /* ---------- Language-dependent rendering ---------- */
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const day = (iso) => new Date(iso + 'T00:00:00');
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const statusOf = (s, e) => (day(e) < today() ? 'past' : day(s) > today() ? 'upcoming' : 'ongoing');
  const dtf = (o) => new Intl.DateTimeFormat(I.locale(), o);

  function splitTitle() {
    const h = $('.hero__title'), words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', words.join(' '));
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${esc(w)}</span>`).join(' ');
  }
  function renderNews() {
    $$('time[data-date]').forEach((t) => { t.textContent = dtf({ day: 'numeric', month: 'long', year: 'numeric' }).format(day(t.dataset.date)); });
  }
  function renderEvents() {
    const list = $('#events-list'), items = $$('.event', list);
    items.forEach((li) => {
      const s = day(li.dataset.start), e = day(li.dataset.end), st = statusOf(li.dataset.start, li.dataset.end);
      li.dataset.status = st; li.classList.toggle('is-past', st === 'past'); li.classList.remove('is-next');
      const d = li.dataset.start === li.dataset.end ? s.getDate() : `${s.getDate()}–${e.getDate()}`;
      const m = dtf({ month: 'short' }).format(s).replace(/\./g, '').toUpperCase();
      $('.event__date', li).innerHTML = `<b>${d}</b><i>${esc(m)}</i><s>${s.getFullYear()}</s>`;
      $('.event__status', li).textContent = I.t('ev.status.' + st);
    });
    const up = items.filter((li) => li.dataset.status !== 'past').sort((a, b) => a.dataset.start.localeCompare(b.dataset.start));
    const past = items.filter((li) => li.dataset.status === 'past').sort((a, b) => b.dataset.end.localeCompare(a.dataset.end));
    up[0]?.classList.add('is-next');
    const out = [...up];
    if (up.length && past.length) { const d = document.createElement('li'); d.className = 'events__divider'; d.textContent = I.t('events.recent'); out.push(d); }
    list.replaceChildren(...out, ...past);
  }
  function renderFeature() {
    const f = $('#colloque'), st = statusOf(f.dataset.start, f.dataset.end);
    $('[data-feature-label]').textContent = I.t(st === 'past' ? 'feature.label.past' : st === 'ongoing' ? 'feature.label.ongoing' : 'feature.label.next');
    const badge = $('[data-feature-badge]'); badge.hidden = st === 'upcoming'; badge.textContent = I.t('ev.status.' + (st === 'past' ? 'past' : 'ongoing'));
    const f1 = dtf({ day: 'numeric', month: 'long', year: 'numeric' }), a = day(f.dataset.start), b = day(f.dataset.end);
    $('[data-feature-dates]').textContent = f1.formatRange ? f1.formatRange(a, b) : `${f1.format(a)} – ${f1.format(b)}`;
  }
  document.addEventListener('anagem:lang', () => { splitTitle(); renderNews(); renderEvents(); renderFeature(); stickyOffset(); });

  I.setLang(I.initialLang(), { persist: false });
})();
