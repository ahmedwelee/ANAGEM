import { Component, afterNextRender, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MOROCCO_REGIONS } from './morocco-regions';

/** Mercator (conformal, like any atlas page of Morocco): the shape of the country is not stretched. K = pixels per degree of longitude. */
const LON0 = -17.6, LON1 = -0.6, LAT0 = 20.4, LAT1 = 36.1, K = 35;
const mercator = (lat: number) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const W = Math.round((LON1 - LON0) * K), H = Math.round((mercator(LAT1) - mercator(LAT0)) * K);
export const project = ([lon, lat]: readonly [number, number]) => [(lon - LON0) * K, (mercator(LAT1) - mercator(lat)) * K] as const;
export const MAP_SIZE = { width: W, height: H } as const;

const pathOf = (ring: readonly (readonly [number, number])[]) => ring.map((p, i) => (i ? 'L' : 'M') + project(p).map((n) => n.toFixed(1)).join(' ')).join('') + 'Z';
const REGIONS = MOROCCO_REGIONS.map((r) => ({ id: r.id, key: r.key, tone: r.tone, d: pathOf(r.ring) }));

/** The twelve regions of the Kingdom, without any place names on the map; a region's name appears as a tooltip. */
@Component({
  selector: 'app-morocco-map',
  imports: [TranslocoPipe],
  host: { class: 'block', '[class.map-drawn]': 'drawn()', '[class.map-mini]': 'mini()' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="mx-auto h-full w-auto max-w-full overflow-visible" role="img" [attr.aria-label]="'public.map' | transloco" focusable="false">
      <defs>
        <pattern id="mapHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="#fff" stroke-opacity=".1" stroke-width="2" /></pattern>
      </defs>
      @if (!mini()) {
        <g fill="none" stroke="var(--c-primary)" stroke-opacity=".12" stroke-width=".7">
          @for (x of lons; track x) { <line [attr.x1]="x" y1="0" [attr.x2]="x" [attr.y2]="h" /> }
          @for (y of lats; track y) { <line x1="0" [attr.y1]="y" [attr.x2]="w" [attr.y2]="y" /> }
        </g>
      }
      <g [class.anim-float]="!mini()">
        @for (r of regions; track r.id) {
          <path class="map-region" [attr.data-region]="r.id" [style.--i]="$index" [style.--t]="r.tone" [attr.d]="r.d"><title>{{ 'public.region.' + r.key | transloco }}</title></path>
        }
        @if (!mini()) { <path [attr.d]="all" class="map-hatch" fill="url(#mapHatch)" /> }
      </g>
    </svg>`,
})
export class MoroccoMapComponent {
  readonly mini = input(false);
  protected readonly w = W;
  protected readonly h = H;
  protected readonly drawn = signal(false);
  protected readonly lons = [-16, -14, -12, -10, -8, -6, -4, -2].map((l) => project([l, 0])[0]);
  protected readonly lats = [22, 24, 26, 28, 30, 32, 34, 36].map((l) => project([0, l])[1]);
  protected readonly regions = REGIONS;
  protected readonly all = REGIONS.map((r) => r.d).join('');

  constructor() { afterNextRender(() => setTimeout(() => this.drawn.set(true), 350)); }
}
