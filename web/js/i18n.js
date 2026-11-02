/* Lightweight runtime i18n. Dictionaries live in i18n/{fr,ar,en}.json (flat keys, Transloco-compatible). */
(function () {
  const LANGS = { fr: { dir: 'ltr', locale: 'fr-FR' }, ar: { dir: 'rtl', locale: 'ar-MA' }, en: { dir: 'ltr', locale: 'en-GB' } };
  const cache = {};
  let current = 'fr';

  const load = async (l) => {
    if (cache[l]) return cache[l];
    try { const r = await fetch(`i18n/${l}.json`); cache[l] = r.ok ? await r.json() : {}; } catch { cache[l] = {}; }
    return cache[l];
  };
  const t = (key) => cache[current]?.[key] ?? cache.fr?.[key];

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      const k = n.dataset.i18n, v = t(k);
      if (v != null) n.textContent = v;
      n.toggleAttribute('data-missing', cache[current]?.[k] == null && current !== 'fr');
    });
    document.querySelectorAll('[data-i18n-attr]').forEach((n) => {
      n.dataset.i18nAttr.split(/\s+/).forEach((pair) => { const [attr, key] = pair.split(':'); const v = t(key); if (v != null) n.setAttribute(attr, v); });
    });
    const title = t('meta.title'); if (title) document.title = title;
    const desc = t('meta.desc'); if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
    document.querySelectorAll('.lang__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === current)));
  }

  async function setLang(l, { persist = true } = {}) {
    if (!LANGS[l]) l = 'fr';
    await Promise.all([load('fr'), load(l)]);
    current = l;
    const root = document.documentElement;
    root.lang = l; root.dir = LANGS[l].dir;
    apply();
    if (persist) {
      try { localStorage.setItem('anagem.lang', l); } catch {}
      const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u);
    }
    document.dispatchEvent(new CustomEvent('anagem:lang', { detail: { lang: l } }));
  }

  function initialLang() {
    const q = new URL(location.href).searchParams.get('lang'); if (LANGS[q]) return q;
    try { const s = localStorage.getItem('anagem.lang'); if (LANGS[s]) return s; } catch {}
    return 'fr';
  }

  window.AnagemI18n = { t, setLang, initialLang, locale: () => LANGS[current].locale, lang: () => current };
})();
