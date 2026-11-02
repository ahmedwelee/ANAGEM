// Merges i18n-src/*.json ({ "fr": {...}, "ar": {...}, "en": {...} } per feature) into public/i18n/{fr,ar,en}.json.
// Reports keys that exist in one language but not in another.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const LANGS = ['fr', 'ar', 'en'];
const out = { fr: {}, ar: {}, en: {} };

const merge = (target, src) => {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object') merge((target[k] ??= {}), v);
    else target[k] = v;
  }
};
const flat = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

for (const file of readdirSync('i18n-src').filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(`i18n-src/${file}`, 'utf8'));
  for (const l of LANGS) if (data[l]) merge(out[l], data[l]);
}
let problems = 0;
const keys = Object.fromEntries(LANGS.map((l) => [l, new Set(flat(out[l]))]));
for (const l of LANGS) for (const k of keys.fr) if (!keys[l].has(k)) { console.error(`[i18n] missing in ${l}: ${k}`); problems++; }
for (const l of LANGS) writeFileSync(`public/i18n/${l}.json`, JSON.stringify(out[l], null, 1));
console.log(`i18n: ${keys.fr.size} keys x ${LANGS.length} languages${problems ? `, ${problems} MISSING` : ''}`);
if (problems) process.exitCode = 1;
