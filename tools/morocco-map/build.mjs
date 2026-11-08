// Builds frontend/src/app/features/public/shared/morocco-regions.ts: the twelve regions of the Kingdom of Morocco (the 2015 regional
// division), southern provinces included, as drawn on the Moroccan national map.
//
//   cd tools/morocco-map && npm install && npm run build
//
// Source: tools/morocco-map/source/geoBoundaries-MAR-ADM1_simplified.geojson (geoBoundaries gbOpen, from OpenStreetMap; see source/README.md).
// The regions are joined into one topology so that two neighbours share the same border: the shared borders are thinned once (Douglas-Peucker
// in Mercator space), which keeps the regions fitting together with no gaps or overlaps. Each region also gets a "tone" (0, 1, 2...) such that
// two neighbours never have the same one, so the map can shade them differently.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';

const TOLERANCE = Number(process.env.TOLERANCE ?? 0.02); // degrees (about 2 km; under a pixel on the map): the largest deviation allowed from the source borders
const SRC = new URL('./source/geoBoundaries-MAR-ADM1_simplified.geojson', import.meta.url);
const OUT = new URL('../../frontend/src/app/features/public/shared/morocco-regions.ts', import.meta.url);

// ISO 3166-2:MA code -> key of the translated name (public.region.<key> in frontend/i18n-src/public.json)
const KEYS = {
  'MA-01': 'tangerTetouanAlHoceima', 'MA-02': 'oriental', 'MA-03': 'fesMeknes', 'MA-04': 'rabatSaleKenitra',
  'MA-05': 'beniMellalKhenifra', 'MA-06': 'casablancaSettat', 'MA-07': 'marrakechSafi', 'MA-08': 'draaTafilalet',
  'MA-09': 'soussMassa', 'MA-10': 'guelmimOuedNoun', 'MA-11': 'laayouneSakiaElHamra', 'MA-12': 'dakhlaOuedEdDahab',
};

const rad = Math.PI / 180;
const mercatorY = (lat) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const inverseY = (y) => (360 / Math.PI) * Math.atan(Math.exp((y * Math.PI) / 180)) - 90;
const sphericalAreaKm2 = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) { const [l1, p1] = ring[i], [l2, p2] = ring[(i + 1) % ring.length]; sum += (l2 - l1) * rad * (2 + Math.sin(p1 * rad) + Math.sin(p2 * rad)); }
  return Math.abs((sum * 6371.0088 * 6371.0088) / 2);
};
const signedPlanarArea = (ring) => ring.reduce((a, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return a + (x1 * y2 - x2 * y1); }, 0) / 2;

// 1. Read the twelve regions (one simple polygon each) and project them, so that distances are measured as on the map.
const source = JSON.parse(readFileSync(SRC, 'utf8'));
const objects = {};
for (const f of source.features) {
  const iso = f.properties.shapeISO;
  if (!(iso in KEYS)) throw new Error(`Unexpected region ${iso}`);
  if (f.geometry.type !== 'Polygon' || f.geometry.coordinates.length !== 1) throw new Error(`${iso}: expected one polygon without holes`);
  objects[iso] = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [f.geometry.coordinates[0].map(([lon, lat]) => [lon, mercatorY(lat)])] } };
}
if (Object.keys(objects).length !== 12) throw new Error('Expected the twelve regions of Morocco');

// 2. One topology: borders shared by two regions become one arc.
const topo = topology(objects);

// 3. Thin every arc. Its two ends (where three regions meet, or the border meets the sea) are always kept.
function simplify(points, tolerance) {
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = points[a], [bx, by] = points[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tolerance && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const rawArcPoints = topo.arcs.reduce((n, a) => n + a.length, 0);
topo.arcs = topo.arcs.map((arc) => {
  const closed = arc.length > 3 && arc[0][0] === arc.at(-1)[0] && arc[0][1] === arc.at(-1)[1]; // a lone ring: split it so no corner is favoured
  if (!closed) return simplify(arc, TOLERANCE);
  const half = Math.floor(arc.length / 2);
  return [...simplify(arc.slice(0, half + 1), TOLERANCE), ...simplify(arc.slice(half), TOLERANCE).slice(1)];
});

// 4. Tones: neighbours (regions that share an arc) get different ones. Largest number of neighbours first, then the lowest tone still free.
const owners = new Map(); // arc index -> regions using it
for (const [iso, geometry] of Object.entries(topo.objects)) {
  for (const ref of geometry.arcs[0]) { const i = ref < 0 ? ~ref : ref; (owners.get(i) ?? owners.set(i, new Set()).get(i)).add(iso); }
}
const neighbours = Object.fromEntries(Object.keys(objects).map((iso) => [iso, new Set()]));
for (const set of owners.values()) for (const a of set) for (const b of set) if (a !== b) neighbours[a].add(b);
const tone = {};
for (const iso of Object.keys(neighbours).sort((a, b) => neighbours[b].size - neighbours[a].size || a.localeCompare(b))) {
  const taken = new Set([...neighbours[iso]].map((n) => tone[n]));
  let t = 0; while (taken.has(t)) t++;
  tone[iso] = t;
}

// 5. Rebuild each region, back in longitude/latitude, in a single direction, not repeated at the end.
const regions = Object.keys(KEYS).map((iso) => {
  const projected = feature(topo, topo.objects[iso]).geometry.coordinates[0];
  let ring = projected.slice(0, -1).map(([lon, y]) => [Math.round(lon * 1000) / 1000, Math.round(inverseY(y) * 1000) / 1000]);
  ring = ring.filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (signedPlanarArea(ring) > 0) ring.reverse();
  return { iso, key: KEYS[iso], tone: tone[iso], ring };
});

const all = regions.flatMap((r) => r.ring);
const lons = all.map((p) => p[0]), lats = all.map((p) => p[1]);
const total = regions.reduce((n, r) => n + sphericalAreaKm2(r.ring), 0);
console.log(`raw ${source.features.reduce((n, f) => n + f.geometry.coordinates[0].length, 0)} points -> ${all.length} points in 12 regions (shared border points before thinning: ${rawArcPoints}; tolerance ${TOLERANCE}°)`);
console.log(`longitude ${Math.min(...lons)} .. ${Math.max(...lons)}, latitude ${Math.min(...lats)} .. ${Math.max(...lats)}, total area ${Math.round(total).toLocaleString('en')} km²`);
console.log(`tones: ${Math.max(...Object.values(tone)) + 1} (` + regions.map((r) => `${r.iso}:${r.tone}`).join(' ') + ')');
for (const r of regions) console.log(`  ${r.iso} ${r.key.padEnd(24)} ${String(r.ring.length).padStart(3)} points  ${Math.round(sphericalAreaKm2(r.ring)).toLocaleString('en').padStart(8)} km²`);

const block = (ring) => { const rows = []; for (let i = 0; i < ring.length; i += 6) rows.push('      ' + ring.slice(i, i + 6).map(([lon, lat]) => `[${lon}, ${lat}]`).join(', ') + ','); return rows.join('\n'); };
writeFileSync(OUT, `// GENERATED by tools/morocco-map/build.mjs. Do not edit by hand: change the tool and run it again.
// The twelve regions of the Kingdom of Morocco (2015 regional division), southern provinces included, as on the Moroccan national map.
// Source: geoBoundaries (www.geoboundaries.org, gbOpen, Morocco ADM1), built from OpenStreetMap data: © OpenStreetMap contributors, ODbL 1.0
// (www.openstreetmap.org/copyright). Borders shared by two regions are thinned together to ${TOLERANCE}° (~${(TOLERANCE * 111).toFixed(1)} km), so neighbours still fit.
// This is open data, not ANAGEM's official cartography: replace it if the association supplies its own (docs/requirements, question 1).

export interface RegionShape {
  /** ISO 3166-2:MA code. */
  readonly id: string;
  /** Last part of the translation key: public.region.<key>. */
  readonly key: string;
  /** 0, 1, 2...: two neighbouring regions never share a tone, so they can be shaded differently. */
  readonly tone: number;
  /** [longitude, latitude] pairs (WGS 84), one direction, not repeated at the end. */
  readonly ring: readonly (readonly [number, number])[];
}

export const MOROCCO_REGIONS: readonly RegionShape[] = [
${regions.map((r) => `  {\n    id: '${r.iso}', key: '${r.key}', tone: ${r.tone},\n    ring: [\n${block(r.ring)}\n    ],\n  },`).join('\n')}
];
`);
console.log('written', OUT.pathname.split('/').slice(-4).join('/'));
