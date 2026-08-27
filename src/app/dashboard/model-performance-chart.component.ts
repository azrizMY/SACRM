import { AfterViewInit, Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { modelPerfForBrand, type ModelPerf } from '../data/dashboard-stats';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';

type Period = 'month' | 'year';

const H = 280;
const PAD = { top: 8, right: 8, bottom: 24, left: 32 };
const MAX_BAR = 40;
const MAX_BARS_SHOWN = 8;

@Component({
  selector: 'app-model-performance-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 px-6">
        <div class="flex flex-col gap-1">
          <h3 class="font-semibold leading-none">Performance by model</h3>
          <p class="text-sm text-muted-foreground">
            {{ brand() }} &middot; units sold &middot; {{ period() === 'month' ? 'this month' : 'this year' }}
          </p>
        </div>
        <div role="radiogroup" aria-label="Period" class="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="period() === 'month'"
            (click)="period.set('month')"
            class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
            [ngClass]="period() === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
          >
            Month
          </button>
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="period() === 'year'"
            (click)="period.set('year')"
            class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
            [ngClass]="period() === 'year' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
          >
            Year
          </button>
        </div>
      </div>
      <div class="px-6">
        <div class="relative w-full" #host [style.height.px]="height">
          <svg [attr.width]="width()" [attr.height]="height" (mouseleave)="hover.set(null)">
            <!-- Grid + y ticks -->
            @for (t of yTicks(); track t.value) {
              <line
                [attr.x1]="pad.left" [attr.x2]="width() - pad.right"
                [attr.y1]="t.y" [attr.y2]="t.y"
                stroke="var(--border)" stroke-dasharray="3 3"
              />
              <text
                [attr.x]="pad.left - 8" [attr.y]="t.y + 3"
                text-anchor="end" class="fill-muted-foreground" style="font-size: 11px"
              >{{ t.value }}</text>
            }

            <!-- Bars -->
            @for (b of bars(); track b.model; let i = $index) {
              <rect
                [attr.x]="b.x" [attr.y]="b.y"
                [attr.width]="b.w" [attr.height]="b.h"
                rx="6" fill="var(--chart-1)"
                [attr.opacity]="hover() === null || hover() === i ? 1 : 0.55"
                class="transition-opacity"
                (mouseenter)="hover.set(i)" (click)="hover.set(hover() === i ? null : i)"
              />
              <text
                [attr.x]="b.cx" [attr.y]="height - 6"
                text-anchor="middle" class="fill-muted-foreground" style="font-size: 10px"
              >{{ b.label }}</text>
            }
          </svg>

          @if (hover() !== null) {
            <div
              class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              [style.left.px]="bars()[hover()!].cx"
              [style.top.px]="Math.max(bars()[hover()!].y - 8, 8)"
            >
              <p class="mb-0.5 font-medium">{{ bars()[hover()!].model }}</p>
              <p class="text-muted-foreground">{{ bars()[hover()!].brand }}</p>
              <p class="font-mono font-medium tabular">{{ bars()[hover()!].units }} units</p>
            </div>
          }

          @if (!bars().length) {
            <div class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No models for this filter.
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ModelPerformanceChartComponent implements AfterViewInit, OnDestroy {
  host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  width = signal(600);
  height = H;
  pad = PAD;
  Math = Math;

  private ro?: ResizeObserver;

  constructor(
    private customers: CustomerService,
    private settingsService: SettingsService,
  ) {}

  brand = computed(() => this.settingsService.settings().dashboardTarget.brand);

  period = signal<Period>('month');
  hover = signal<number | null>(null);

  private unitsOf = (m: ModelPerf) => (this.period() === 'month' ? m.unitsMonth : m.unitsYear);

  filtered = computed(() => {
    const list = modelPerfForBrand(this.customers.records(), this.brand());
    return [...list].sort((a, b) => this.unitsOf(b) - this.unitsOf(a)).slice(0, MAX_BARS_SHOWN);
  });

  yMax = computed(() => {
    const max = Math.max(1, ...this.filtered().map((m) => this.unitsOf(m)));
    return Math.ceil(max / 5) * 5 || 5;
  });

  bars = computed(() => {
    const w = this.width();
    const data = this.filtered();
    const plotW = w - this.pad.left - this.pad.right;
    const plotH = this.height - this.pad.top - this.pad.bottom;
    const n = data.length;
    const slot = n ? plotW / n : plotW;
    const barW = Math.min(slot * 0.55, MAX_BAR);
    const yMax = this.yMax();
    return data.map((d, i) => {
      const units = this.unitsOf(d);
      const cx = this.pad.left + slot * i + slot / 2;
      const h = (units / yMax) * plotH;
      return { ...d, units, cx, x: cx - barW / 2, w: barW, h, y: this.pad.top + plotH - h, label: this.truncateLabel(d.model, slot) };
    });
  });

  /** Keeps model-name labels from overlapping when many bars share a narrow slot (e.g. mobile widths). */
  private truncateLabel(text: string, slotWidth: number): string {
    const approxCharPx = 5.5;
    const maxChars = Math.max(3, Math.floor(slotWidth / approxCharPx));
    if (text.length <= maxChars) return text;
    return text.slice(0, Math.max(1, maxChars - 1)) + '…';
  }

  yTicks = computed(() => {
    const plotH = this.height - this.pad.top - this.pad.bottom;
    const steps = 4;
    const yMax = this.yMax();
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = Math.round((yMax / steps) * i);
      const y = this.pad.top + plotH - (value / yMax) * plotH;
      return { value, y };
    });
  });

  ngAfterViewInit(): void {
    const el = this.host().nativeElement;
    this.ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) this.width.set(w);
    });
    this.ro.observe(el);
    this.width.set(el.clientWidth || 600);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }
}
