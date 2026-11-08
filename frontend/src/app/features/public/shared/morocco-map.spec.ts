import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../../testing/test-providers';
import { settle } from '../../../../testing/fixtures';
import { MAP_SIZE, MoroccoMapComponent, project } from './morocco-map';
import { MOROCCO_REGIONS } from './morocco-regions';

type Point = readonly [number, number];
type Ring = readonly Point[];

/** Geographic facts the regions have to respect (WGS 84, degrees). */
const allPoints = MOROCCO_REGIONS.flatMap((r) => r.ring);
const lons = allPoints.map((p) => p[0]);
const lats = allPoints.map((p) => p[1]);
const region = (id: string) => MOROCCO_REGIONS.find((r) => r.id === id)!;
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

function inside([x, y]: Point, ring: Ring) {
  let in_ = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
}

/** Area on the sphere, km². */
function areaKm2(ring: Ring) {
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i], [l2, p2] = ring[(i + 1) % ring.length];
    sum += (l2 - l1) * rad * (2 + Math.sin(p1 * rad) + Math.sin(p2 * rad));
  }
  return Math.abs((sum * 6371.0088 * 6371.0088) / 2);
}

/** Two regions are neighbours when they share a stretch of border: the same points, since the borders were thinned together. */
const sharedPoints = (a: Ring, b: Ring) => a.filter((p) => b.some((q) => same(p, q))).length;
const neighbours = (a: string, b: string) => a !== b && sharedPoints(region(a).ring, region(b).ring) >= 2;

/** One well-known place inside each region (inland, so that the thinned coast cannot matter). */
const PLACES: [string, string, Point][] = [
  ['MA-01', 'Tétouan', [-5.37, 35.57]], ['MA-02', 'Oujda', [-1.91, 34.68]], ['MA-03', 'Fès', [-5.0, 34.03]], ['MA-04', 'Kénitra', [-6.58, 34.26]],
  ['MA-05', 'Béni Mellal', [-6.35, 32.34]], ['MA-06', 'Casablanca', [-7.55, 33.55]], ['MA-07', 'Marrakech', [-7.98, 31.63]], ['MA-08', 'Errachidia', [-4.43, 31.93]],
  ['MA-09', 'Taroudant', [-8.88, 30.47]], ['MA-10', 'Guelmim', [-10.06, 28.99]], ['MA-11', 'Laâyoune', [-13.2, 27.15]], ['MA-12', 'Dakhla', [-15.93, 23.72]],
];

describe('the twelve regions of Morocco (real boundary data, not a drawing)', () => {
  it('are the twelve regions of the 2015 division, each with a code and a name key', () => {
    expect(MOROCCO_REGIONS.map((r) => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => `MA-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(MOROCCO_REGIONS.map((r) => r.key)).size).toBe(12);
    expect(region('MA-04').key).toBe('rabatSaleKenitra');
    expect(region('MA-11').key).toBe('laayouneSakiaElHamra');
    expect(region('MA-12').key).toBe('dakhlaOuedEdDahab');
  });

  it('are detailed enough to show the coast and the borders, and small enough to ship', () => {
    expect(allPoints.length).toBeGreaterThan(700);
    expect(allPoints.length).toBeLessThan(2500);
    for (const r of MOROCCO_REGIONS) expect(r.ring.length, r.id).toBeGreaterThan(40);
  });

  it('reach the real extremes: Lagouira in the south, the Strait of Gibraltar in the north, the Dakhla peninsula in the west, Figuig in the east', () => {
    expect(Math.min(...lats)).toBeCloseTo(20.77, 1);
    expect(Math.max(...lats)).toBeCloseTo(35.92, 1);
    expect(Math.min(...lons)).toBeCloseTo(-17.1, 1);
    expect(Math.max(...lons)).toBeCloseTo(-1.0, 1);
  });

  it('cover the whole territory of the Kingdom, southern provinces included (a sanity range: a missing south or a wrong polygon is far outside)', () => {
    const km2 = MOROCCO_REGIONS.reduce((sum, r) => sum + areaKm2(r.ring), 0);
    expect(km2).toBeGreaterThan(640_000);
    expect(km2).toBeLessThan(760_000);
    expect(Math.min(...region('MA-12').ring.map((p) => p[1]))).toBeCloseTo(20.77, 1); // Dakhla-Oued Ed-Dahab reaches the south
    expect(Math.max(...region('MA-12').ring.map((p) => p[1]))).toBeLessThan(25);
    expect(Math.max(...region('MA-11').ring.map((p) => p[1]))).toBeLessThan(28.5);    // Laâyoune-Sakia El Hamra lies north of it, up to the Draa
    expect(areaKm2(region('MA-11').ring)).toBeGreaterThan(100_000);
  });

  it('have no repeated points and no jumps (a broken merge shows up as a long straight line)', () => {
    for (const r of MOROCCO_REGIONS) {
      for (let i = 1; i < r.ring.length; i++) {
        const [x1, y1] = r.ring[i - 1], [x2, y2] = r.ring[i];
        expect(x1 === x2 && y1 === y2, r.id).toBe(false);
        expect(Math.hypot(x2 - x1, y2 - y1), r.id).toBeLessThan(5); // the longest straight border segment (the southern borders) is a few degrees
      }
    }
  });

  it('put each well-known place in its own region, and in no other', () => {
    for (const [id, name, place] of PLACES) {
      expect(inside(place, region(id).ring), `${name} in ${id}`).toBe(true);
      for (const other of MOROCCO_REGIONS.filter((r) => r.id !== id)) expect(inside(place, other.ring), `${name} must not be in ${other.id}`).toBe(false);
    }
  });

  it('fit together: every region has neighbours with which it shares its border exactly, and none overlaps another', () => {
    for (const r of MOROCCO_REGIONS) {
      expect(MOROCCO_REGIONS.filter((o) => neighbours(r.id, o.id)).length, `${r.id} touches another region`).toBeGreaterThanOrEqual(1);
      for (const o of MOROCCO_REGIONS.filter((x) => x.id !== r.id)) {
        const strayPoints = r.ring.filter((p) => !o.ring.some((q) => same(p, q)) && inside(p, o.ring));
        expect(strayPoints, `${r.id} must not enter ${o.id}`).toEqual([]);
      }
    }
  });

  it('know their real neighbours: the north coast, the Atlantic coast and the south', () => {
    expect(neighbours('MA-04', 'MA-03')).toBe(true);  // Rabat-Salé-Kénitra and Fès-Meknès
    expect(neighbours('MA-04', 'MA-06')).toBe(true);  // ... and Casablanca-Settat
    expect(neighbours('MA-01', 'MA-02')).toBe(true);  // Tanger-Tétouan-Al Hoceïma and the Oriental
    expect(neighbours('MA-10', 'MA-11')).toBe(true);  // Guelmim-Oued Noun and Laâyoune-Sakia El Hamra
    expect(neighbours('MA-11', 'MA-12')).toBe(true);  // Laâyoune-Sakia El Hamra and Dakhla-Oued Ed-Dahab
    expect(neighbours('MA-01', 'MA-12')).toBe(false); // the two ends of the country do not touch
    expect(neighbours('MA-06', 'MA-09')).toBe(false);
  });

  it('give two neighbours different tones, so that the map shows where one region ends and the next begins', () => {
    for (const a of MOROCCO_REGIONS) {
      expect(Number.isInteger(a.tone) && a.tone >= 0 && a.tone <= 3, a.id).toBe(true);
      for (const b of MOROCCO_REGIONS) if (neighbours(a.id, b.id)) expect(a.tone, `${a.id} and ${b.id}`).not.toBe(b.tone);
    }
  });

});

describe('map projection', () => {
  it('puts north at the top and east to the right', () => {
    const [xa, ya] = project([-9, 25]), [xb, yb] = project([-6, 35]);
    expect(xb).toBeGreaterThan(xa);
    expect(yb).toBeLessThan(ya);
  });

  it('is conformal (Mercator): a small square on the ground stays a square on the map, so the country is not stretched', () => {
    for (const lat of [22, 28, 34]) {
      const [x1, y1] = project([-9, lat]), [x2, y2] = project([-8.9, lat]), [, y3] = project([-9, lat + 0.1 * Math.cos((lat * Math.PI) / 180)]);
      const east = Math.hypot(x2 - x1, y2 - y1), north = Math.abs(y3 - y1);
      expect(north / east).toBeCloseTo(1, 1);
    }
  });

  it('draws the whole country inside the picture', () => {
    for (const p of allPoints) {
      const [x, y] = project(p);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(MAP_SIZE.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(MAP_SIZE.height);
    }
  });
});

describe('MoroccoMapComponent', () => {
  async function render(mini = false) {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const fixture = TestBed.createComponent(MoroccoMapComponent);
    fixture.componentRef.setInput('mini', mini);
    await settle(fixture);
    return fixture.nativeElement as HTMLElement;
  }

  const regionPaths = (el: HTMLElement) => [...el.querySelectorAll<SVGPathElement>('path.map-region')];

  it('draws each of the twelve regions as its own closed shape, with every point of the data', async () => {
    const el = await render();
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`);
    const paths = regionPaths(el);
    expect(paths.map((p) => p.dataset['region']).sort()).toEqual(MOROCCO_REGIONS.map((r) => r.id));
    for (const p of paths) {
      const d = p.getAttribute('d')!;
      expect(d.startsWith('M')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
      expect((d.match(/[ML]/g) ?? []).length, p.dataset['region']).toBe(region(p.dataset['region']!).ring.length);
    }
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('public.map');
  });

  it('shows no city names, and no place names at all: the regions are only named in a tooltip', async () => {
    const el = await render();
    expect(el.querySelectorAll('text')).toHaveLength(0);
    expect(el.querySelectorAll('.map-city')).toHaveLength(0);
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('title').forEach((t) => t.remove());
    expect(copy.textContent!.trim()).toBe('');
  });

  it('names every region in a tooltip, in the language of the page', async () => {
    const el = await render();
    const titles = regionPaths(el).map((p) => p.querySelector('title')!.textContent);
    expect(titles.sort()).toEqual(MOROCCO_REGIONS.map((r) => `public.region.${r.key}`).sort());
  });


  it('gives each region the tone of the data, so that neighbours are shaded differently', async () => {
    const el = await render();
    for (const p of regionPaths(el)) expect(p.style.getPropertyValue('--t'), p.dataset['region']).toBe(String(region(p.dataset['region']!).tone));
  });

  it('shows the same regions, without grid or hatching, in the small version', async () => {
    const el = await render(true);
    expect(regionPaths(el)).toHaveLength(12);
    expect(el.querySelector('.map-hatch')).toBeNull();
    expect(el.querySelectorAll('svg > g > line')).toHaveLength(0);
    expect(el.querySelectorAll('text')).toHaveLength(0);
  });

  it('shows the grid and the hatching in the full version', async () => {
    const el = await render();
    expect(el.querySelector('.map-hatch')).not.toBeNull();
    expect(el.querySelectorAll('svg > g:first-of-type line').length).toBeGreaterThan(10);
  });
});
