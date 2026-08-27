import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatRM } from '../data/calculator-data';
import { monthlyCommissionTrend } from '../data/dashboard-stats';
import { CustomerService } from '../shared/customer.service';

const H = 280;
const PAD = { top: 8, right: 8, bottom: 24, left: 48 };

@Component({
  selector: 'app-sales-trend-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1 px-6">
        <h3 class="font-semibold leading-none">Commission trend</h3>
        <p class="text-sm text-muted-foreground">Total commission earned, month by month</p>
      </div>
      <div class="px-6">
        <div class="relative w-full" #host [style.height.px]="height">
          <svg
            [attr.width]="width()"
            [attr.height]="height"
            class="overflow-visible"
            (mouseleave)="hover.set(null)"
          >
            <defs>
              <linearGradient id="fillCommission" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--chart-2)" stop-opacity="0.25" />
                <stop offset="100%" stop-color="var(--chart-2)" stop-opacity="0" />
              </linearGradient>
            </defs>

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
              >{{ t.label }}</text>
            }

            <!-- x labels -->
            @for (p of points(); track p.month) {
              <text
                [attr.x]="p.x" [attr.y]="height - 6"
                text-anchor="middle" class="fill-muted-foreground" style="font-size: 11px"
              >{{ p.month }}</text>
            }

            <!-- Area + line -->
            <path [attr.d]="area()" fill="url(#fillCommission)" />
            <path [attr.d]="line()" fill="none" stroke="var(--chart-2)" stroke-width="2" />

            <!-- Hover -->
            @if (hover() !== null) {
              <line
                [attr.x1]="points()[hover()!].x" [attr.x2]="points()[hover()!].x"
                [attr.y1]="pad.top" [attr.y2]="height - pad.bottom"
                stroke="var(--border)"
              />
              <circle [attr.cx]="points()[hover()!].x" [attr.cy]="points()[hover()!].y" r="3.5" fill="var(--chart-2)" stroke="var(--card)" stroke-width="2" />
            }

            <!-- Hover bands -->
            @for (p of points(); track p.month; let i = $index) {
              <rect
                [attr.x]="p.x - bandW() / 2" [attr.y]="pad.top"
                [attr.width]="bandW()" [attr.height]="height - pad.top - pad.bottom"
                fill="transparent" (mouseenter)="hover.set(i)"
              />
            }
          </svg>

          @if (hover() !== null) {
            <div
              class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              [style.left.px]="points()[hover()!].x"
              [style.top.px]="Math.max(points()[hover()!].y - 12, 8)"
            >
              <p class="mb-0.5 font-medium">{{ points()[hover()!].month }}</p>
              <div class="flex items-center justify-between gap-4">
                <span class="flex items-center gap-1.5 text-muted-foreground">
                  <span class="size-2 rounded-[2px]" style="background: var(--chart-2)"></span>Commission
                </span>
                <span class="font-mono font-medium tabular">{{ fmt(points()[hover()!].commission) }}</span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SalesTrendChartComponent implements AfterViewInit, OnDestroy {
  host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  width = signal(600);
  height = H;
  pad = PAD;
  Math = Math;

  private ro?: ResizeObserver;

  constructor(private customers: CustomerService) {}

  data = computed(() => monthlyCommissionTrend(this.customers.records()));
  yMax = computed(() => {
    const max = Math.max(1, ...this.data().map((d) => d.commission));
    return Math.ceil(max / 50000) * 50000 || 50000;
  });

  points = computed(() => {
    const w = this.width();
    const plotW = w - this.pad.left - this.pad.right;
    const plotH = this.height - this.pad.top - this.pad.bottom;
    const data = this.data();
    const yMax = this.yMax();
    const n = data.length;
    return data.map((d, i) => {
      const x = this.pad.left + (n === 1 ? 0 : (i / (n - 1)) * plotW);
      const y = this.pad.top + plotH - (d.commission / yMax) * plotH;
      return { ...d, x, y };
    });
  });

  bandW = computed(() => {
    const plotW = this.width() - this.pad.left - this.pad.right;
    return plotW / Math.max(this.data().length - 1, 1);
  });

  yTicks = computed(() => {
    const plotH = this.height - this.pad.top - this.pad.bottom;
    const steps = 4;
    const yMax = this.yMax();
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = (yMax / steps) * i;
      const y = this.pad.top + plotH - (value / yMax) * plotH;
      return { value, y, label: formatRM(value, { compact: true }).replace('RM ', '') };
    });
  });

  line = computed(() =>
    this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' '),
  );

  area = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const base = this.height - this.pad.bottom;
    const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    return `${top} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z`;
  });

  hover = signal<number | null>(null);

  fmt = (v: number) => formatRM(v);

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
