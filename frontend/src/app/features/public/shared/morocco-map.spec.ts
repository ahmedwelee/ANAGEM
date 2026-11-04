import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../../../testing/test-providers';
import { settle } from '../../../../testing/fixtures';
import { CITIES, MAP_SIZE, MoroccoMapComponent, project } from './morocco-map';
import { MOROCCO_OUTLINE } from './morocco-outline';

/** Geographic facts the outline has to respect (WGS 84, degrees). */
const lons = MOROCCO_OUTLINE.map((p) => p[0]);
const lats = MOROCCO_OUTLINE.map((p) => p[1]);

function inside([x, y]: readonly [number, number], ring: readonly (readonly [number, number])[]) {
  let in_ = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
}

/** Area on the sphere, km². */
function areaKm2(ring: readonly (readonly [number, number])[]) {
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i], [l2, p2] = ring[(i + 1) % ring.length];
    sum += (l2 - l1) * rad * (2 + Math.sin(p1 * rad) + Math.sin(p2 * rad));
  }
  return Math.abs((sum * 6371.0088 * 6371.0088) / 2);
}

describe('Morocco outline (real boundary data, not a drawing)', () => {
  it('is detailed enough to show the coast, and small enough to ship', () => {
    expect(MOROCCO_OUTLINE.length).toBeGreaterThan(250);
    expect(MOROCCO_OUTLINE.length).toBeLessThan(800);
  });

  it('reaches the real extremes: Lagouira in the south, the Strait of Gibraltar in the north, the Dakhla peninsula in the west, Figuig in the east', () => {
    expect(Math.min(...lats)).toBeCloseTo(20.77, 1);
    expect(Math.max(...lats)).toBeCloseTo(35.93, 1);
    expect(Math.min(...lons)).toBeCloseTo(-17.1, 1);
    expect(Math.max(...lons)).toBeCloseTo(-1.03, 1);
  });

  it('covers the whole territory of the Kingdom, southern provinces included (a sanity range: a missing south or a wrong polygon is far outside)', () => {
    const km2 = areaKm2(MOROCCO_OUTLINE);
    expect(km2).toBeGreaterThan(640_000);
    expect(km2).toBeLessThan(760_000);
    expect(lats.filter((l) => l < 26).length).toBeGreaterThan(20); // the south is drawn in detail, not cut off at the Draa
  });

  it('has no repeated points and no jumps (a broken merge shows up as a long straight line)', () => {
    for (let i = 1; i < MOROCCO_OUTLINE.length; i++) {
      const [x1, y1] = MOROCCO_OUTLINE[i - 1], [x2, y2] = MOROCCO_OUTLINE[i];
      expect(x1 === x2 && y1 === y2).toBe(false);
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeLessThan(5); // the longest straight border segment is a few degrees
    }
  });

  it('puts every city on the map inside the country', () => {
    for (const c of CITIES) expect(inside(c.ll, MOROCCO_OUTLINE), c.k).toBe(true);
  });

  it('keeps the cities in their real order: Tangier is north of Rabat, Oujda east of Fez, Dakhla is the southernmost', () => {
    const at = (k: string) => CITIES.find((c) => c.k === k)!.ll;
    expect(at('tanger')[1]).toBeGreaterThan(at('rabat')[1]);
    expect(at('oujda')[0]).toBeGreaterThan(at('fes')[0]);
    expect(Math.min(...CITIES.map((c) => c.ll[1]))).toBe(at('dakhla')[1]);
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
    for (const p of MOROCCO_OUTLINE) {
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

  it('draws the outline as one closed shape with every point of the data', async () => {
    const el = await render();
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`);
    const d = el.querySelector('path.map-land')!.getAttribute('d')!;
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/[ML]/g) ?? []).length).toBe(MOROCCO_OUTLINE.length);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('public.map');
  });

  it('marks and names every city, with the host city of the national meeting highlighted', async () => {
    const el = await render();
    expect(el.querySelectorAll('.map-city')).toHaveLength(CITIES.length);
    expect([...el.querySelectorAll('.map-city text')].map((t) => t.textContent)).toEqual(CITIES.map((c) => `public.city.${c.k}`));
    expect(el.querySelectorAll('.map-city.hl')).toHaveLength(1);
    expect(el.querySelector('.map-city.hl text')?.textContent).toBe('public.city.kenitra');
  });

  it('puts each marker where the projection says', async () => {
    const el = await render();
    const first = el.querySelector('.map-city')!.getAttribute('transform')!;
    const [x, y] = project(CITIES[0].ll);
    expect(first).toBe(`translate(${x.toFixed(1)} ${y.toFixed(1)})`);
  });

  it('shows only the highlighted city, without names or grid, in the small version', async () => {
    const el = await render(true);
    expect(el.querySelectorAll('.map-city')).toHaveLength(1);
    expect(el.querySelector('.map-city text')).toBeNull();
    expect(el.querySelector('.map-hatch')).toBeNull();
  });

  it('keeps the picture left to right on right-to-left pages so Arabic labels do not collide', async () => {
    const el = await render();
    expect(el.querySelector('svg')!.getAttribute('style')).toContain('direction: ltr');
  });
});
