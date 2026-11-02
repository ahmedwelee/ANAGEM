import { Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { ArcElement, BarController, BarElement, CategoryScale, Chart, ChartConfiguration, DoughnutController, Legend, LinearScale, Tooltip } from 'chart.js';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Legend, LinearScale, Tooltip);

/** Thin Chart.js wrapper: re-renders whenever `config` changes. Read colours from CSS variables so charts follow the design tokens. */
@Component({
  selector: 'app-chart',
  template: `<div class="relative size-full"><canvas #cv role="img" [attr.aria-label]="label()"></canvas></div>`,
  host: { class: 'block' },
})
export class ChartComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  readonly label = input('chart');
  private readonly cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const cfg = this.config();
      this.chart?.destroy();
      this.chart = new Chart(this.cv().nativeElement, { ...cfg, options: { responsive: true, maintainAspectRatio: false, ...cfg.options } });
    });
  }

  ngOnDestroy(): void { this.chart?.destroy(); }
}

/** Resolves a design token (e.g. '--c-primary') to its computed colour for Chart.js. */
export function token(name: string): string { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
