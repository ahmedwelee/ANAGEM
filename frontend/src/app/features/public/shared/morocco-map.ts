import { Component, afterNextRender, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** The SVG is forced left-to-right: text-anchor start/end flip on RTL pages and would push the Arabic labels onto each other. The Arabic text itself still shapes and reads right-to-left. */
/** Schematic outline of Morocco including the southern provinces. PLACEHOLDER: replace with ANAGEM's official cartography. */
const OUTLINE: [number, number][] = [
  [-5.92, 35.79], [-5.81, 35.80], [-5.56, 35.86], [-5.34, 35.88], [-5.27, 35.62], [-5.05, 35.38], [-4.60, 35.20], [-3.93, 35.26], [-3.30, 35.20], [-2.98, 35.43], [-2.93, 35.30], [-2.42, 35.12], [-2.21, 35.10],
  [-1.95, 34.95], [-1.78, 34.72], [-1.75, 34.45], [-1.80, 34.00], [-1.70, 33.40], [-1.45, 32.55], [-1.23, 32.10], [-2.20, 32.00], [-3.00, 31.65], [-3.70, 31.10], [-4.50, 30.45], [-5.20, 30.00], [-5.60, 29.60], [-6.60, 29.15], [-7.60, 28.70], [-8.67, 28.00], [-8.67, 27.67],
  [-8.67, 26.00], [-12.00, 26.00], [-12.00, 23.45], [-13.10, 21.33], [-16.30, 21.33], [-17.05, 20.77],
  [-16.95, 21.40], [-16.50, 22.40], [-15.95, 23.75], [-15.35, 24.70], [-14.85, 25.60], [-14.48, 26.12], [-13.43, 27.13], [-13.00, 27.67], [-12.93, 27.94], [-11.90, 28.20], [-11.12, 28.48], [-10.50, 28.95], [-10.17, 29.38], [-9.75, 29.95], [-9.65, 30.42], [-9.87, 30.64], [-9.80, 31.50], [-9.50, 32.00], [-9.25, 32.30], [-9.28, 32.55], [-8.50, 33.25], [-7.62, 33.60], [-6.85, 34.03], [-6.67, 34.26], [-6.16, 35.20], [-6.03, 35.47],
];
const CITIES: { k: string; ll: [number, number]; side: 'r' | 'l' | 't'; hl?: boolean }[] = [
  { k: 'tanger', ll: [-5.81, 35.78], side: 'r' }, { k: 'oujda', ll: [-1.91, 34.68], side: 'l' }, { k: 'kenitra', ll: [-6.58, 34.26], side: 't', hl: true }, { k: 'fes', ll: [-5.0, 34.03], side: 'r' },
  { k: 'rabat', ll: [-6.84, 34.02], side: 'l' }, { k: 'casablanca', ll: [-7.62, 33.57], side: 'l' }, { k: 'marrakech', ll: [-7.98, 31.63], side: 'r' }, { k: 'agadir', ll: [-9.6, 30.43], side: 'l' },
  { k: 'laayoune', ll: [-13.2, 27.15], side: 'r' }, { k: 'dakhla', ll: [-15.93, 23.72], side: 'r' },
];
const LON0 = -17.5, LON1 = -0.7, LAT0 = 20.5, LAT1 = 36.0, S = 40, KX = Math.cos((28.5 * Math.PI) / 180);
const W = Math.round((LON1 - LON0) * KX * S), H = Math.round((LAT1 - LAT0) * S);
const proj = ([lon, lat]: [number, number]) => [(lon - LON0) * KX * S, (LAT1 - lat) * S] as const;
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
  protected readonly lons = [-16, -14, -12, -10, -8, -6, -4, -2].map((l) => proj([l, 0])[0]);
  protected readonly lats = [22, 24, 26, 28, 30, 32, 34, 36].map((l) => proj([0, l])[1]);
  protected readonly d = OUTLINE.map((p, i) => (i ? 'L' : 'M') + proj(p).map((n) => n.toFixed(1)).join(' ')).join('') + 'Z';
  protected readonly cities = computed(() =>
    CITIES.map((c, i) => ({ ...c, i, x: proj(c.ll)[0].toFixed(1), y: proj(c.ll)[1].toFixed(1), tx: OFFSET[c.side][0], ty: OFFSET[c.side][1], anchor: OFFSET[c.side][2] })).filter((c) => !this.mini() || c.hl),
  );

  constructor() { afterNextRender(() => setTimeout(() => this.drawn.set(true), 350)); }
}
