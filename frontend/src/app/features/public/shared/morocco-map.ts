import { Component, afterNextRender, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MOROCCO_OUTLINE } from './morocco-outline';

/** The SVG is forced left-to-right: text-anchor start/end flip on RTL pages and would push the Arabic labels onto each other. The Arabic text itself still shapes and reads right-to-left. */
export const CITIES: { k: string; ll: [number, number]; side: 'r' | 'l' | 't'; hl?: boolean }[] = [
  { k: 'tanger', ll: [-5.81, 35.77], side: 'r' }, { k: 'oujda', ll: [-1.91, 34.68], side: 'l' }, { k: 'kenitra', ll: [-6.58, 34.26], side: 't', hl: true }, { k: 'fes', ll: [-5.0, 34.03], side: 'r' },
  { k: 'rabat', ll: [-6.84, 34.02], side: 'l' }, { k: 'casablanca', ll: [-7.62, 33.57], side: 'l' }, { k: 'marrakech', ll: [-7.98, 31.63], side: 'r' }, { k: 'agadir', ll: [-9.6, 30.43], side: 'l' },
  { k: 'laayoune', ll: [-13.2, 27.15], side: 'r' }, { k: 'dakhla', ll: [-15.93, 23.72], side: 'r' },
];
/** Mercator (conformal, like any atlas page of Morocco): the shape of the country is not stretched. K = pixels per degree of longitude. */
const LON0 = -17.6, LON1 = -0.6, LAT0 = 20.4, LAT1 = 36.1, K = 35;
const mercator = (lat: number) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const W = Math.round((LON1 - LON0) * K), H = Math.round((mercator(LAT1) - mercator(LAT0)) * K);
export const project = ([lon, lat]: readonly [number, number]) => [(lon - LON0) * K, (mercator(LAT1) - mercator(lat)) * K] as const;
export const MAP_SIZE = { width: W, height: H } as const;
const OFFSET = { r: [11, 5, 'start'], l: [-11, 5, 'end'], t: [0, -13, 'middle'] } as const;

@Component({
  selector: 'app-morocco-map',
  imports: [TranslocoPipe],
  host: { class: 'block', '[class.map-drawn]': 'drawn()', '[class.map-mini]': 'mini()' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="mx-auto h-full w-auto max-w-full overflow-visible" style="direction: ltr" role="img" [attr.aria-label]="'public.map' | transloco" focusable="false">
      <defs>
        <linearGradient id="mapFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--c-primary)" /><stop offset="1" stop-color="var(--c-primary-dark)" /></linearGradient>
        <pattern id="mapHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="7" stroke="#fff" stroke-opacity=".1" stroke-width="2" /></pattern>
      </defs>
      @if (!mini()) {
        <g fill="none" stroke="var(--c-primary)" stroke-opacity=".12" stroke-width=".7">
          @for (x of lons; track x) { <line [attr.x1]="x" y1="0" [attr.x2]="x" [attr.y2]="h" /> }
          @for (y of lats; track y) { <line x1="0" [attr.y1]="y" [attr.x2]="w" [attr.y2]="y" /> }
        </g>
      }
      <g [class.anim-float]="!mini()">
        <path [attr.d]="d" class="map-land" />
        @if (!mini()) { <path [attr.d]="d" class="map-hatch" fill="url(#mapHatch)" /> }
        @for (c of cities(); track c.k) {
          <g class="map-city" [class.hl]="c.hl" [style.--i]="c.i" [attr.transform]="'translate(' + c.x + ' ' + c.y + ')'">
            @if (c.hl) { <circle r="5" class="map-ring" /> }
            <circle [attr.r]="c.hl ? 6.5 : 5" class="dot" />
            @if (!mini()) { <text [attr.x]="c.tx" [attr.y]="c.ty" [attr.text-anchor]="c.anchor">{{ 'public.city.' + c.k | transloco }}</text> }
          </g>
        }
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
  protected readonly d = MOROCCO_OUTLINE.map((p, i) => (i ? 'L' : 'M') + project(p).map((n) => n.toFixed(1)).join(' ')).join('') + 'Z';
  protected readonly cities = computed(() =>
    CITIES.map((c, i) => ({ ...c, i, x: project(c.ll)[0].toFixed(1), y: project(c.ll)[1].toFixed(1), tx: OFFSET[c.side][0], ty: OFFSET[c.side][1], anchor: OFFSET[c.side][2] })).filter((c) => !this.mini() || c.hl),
  );

  constructor() { afterNextRender(() => setTimeout(() => this.drawn.set(true), 350)); }
}
