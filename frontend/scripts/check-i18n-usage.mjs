// Lists translation keys used in src/app that are missing from public/i18n/fr.json.
// Dynamic keys ('status.' + x) are checked as prefixes: the prefix object must exist.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dict = JSON.parse(readFileSync('public/i18n/fr.json', 'utf8'));
const NS = Object.keys(dict);
const get = (path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(ts|html)$/.test(f) && !f.endsWith('.spec.ts') && files.push(p); } };
walk('src/app');

const missing = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/['"]([a-zA-Z_]+(?:\.[A-Za-z_0-9]+)+)(\.?)['"]/g)) {
    const key = m[1];
    if (!NS.includes(key.split('.')[0]) || key.startsWith('form.controls') || key === 'events.timezone') continue;       // not a translation key (e.g. 'file.ts', 'icons.svg')
    const dynamicPrefix = m[2] === '.';
    const hit = get(key);
    if (hit === undefined && !dynamicPrefix) (missing.get(key) ?? missing.set(key, new Set()).get(key)).add(f.replace('src/app/', ''));
  }
  for (const m of src.matchAll(/['"]([a-zA-Z_]+(?:\.[A-Za-z_0-9]+)*\.)['"]\s*\+/g)) {   // 'status.' + x
    if (!NS.includes(m[1].split('.')[0])) continue;   // e.g. 'social.' + k is a settings key
    if (get(m[1].slice(0, -1)) === undefined) (missing.get(m[1] + '*') ?? missing.set(m[1] + '*', new Set()).get(m[1] + '*')).add(f.replace('src/app/', ''));
  }
}
if (!missing.size) console.log('i18n usage: all keys found');
else { for (const [k, fs] of missing) console.log(`MISSING ${k}  <- ${[...fs].join(', ')}`); process.exitCode = 1; }
