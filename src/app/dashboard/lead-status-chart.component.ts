import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerService } from '../shared/customer.service';
import { statusBreakdown } from '../data/dashboard-stats';
import type { CustomerStatus } from '../data/customer-data';

const STATUS_COLOR: Record<CustomerStatus, string> = {
  Lead: 'var(--chart-4)',
  Booked: 'var(--warning)',
  'In Progress': 'oklch(0.65 0.19 300)',
  Delivered: 'var(--success)',
  Cancelled: 'var(--muted-foreground)',
};

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 82;
const R_INNER = 58;

@Component({
  selector: 'app-lead-status-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1 px-6">
        <h3 class="font-semibold leading-none">Lead status breakdown</h3>
        <p class="text-sm text-muted-foreground">Distribution across the pipeline</p>
      </div>
      <div class="px-6">
        @if (total() > 0) {
          <div class="flex flex-col items-center gap-6 sm:flex-row">
            <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size" class="shrink-0">
              @for (seg of segments(); track seg.status) {
                <path
                  [attr.d]="seg.path"
                  [attr.fill]="seg.fill"
                  stroke="var(--card)" stroke-width="2"
                  [attr.opacity]="hover() === null || hover() === seg.status ? 1 : 0.55"
                  class="transition-opacity"
                  (mouseenter)="hover.set(seg.status)"
                  (mouseleave)="hover.set(null)"
                />
              }
              <text [attr.x]="cx" [attr.y]="cy" text-anchor="middle" dominant-baseline="middle"
                class="fill-foreground font-mono font-semibold tabular" style="font-size: 24px">{{ total() }}</text>
              <text [attr.x]="cx" [attr.y]="cy + 20" text-anchor="middle" dominant-baseline="middle"
                class="fill-muted-foreground" style="font-size: 12px">customers</text>
            </svg>

            <ul class="flex w-full flex-1 flex-col gap-2.5">
              @for (d of data(); track d.status) {
                <li class="flex items-center gap-2.5 text-sm">
                  <span class="size-2.5 shrink-0 rounded-[3px]" [style.background]="d.fill"></span>
                  <span class="text-muted-foreground">{{ d.status }}</span>
                  <span class="ml-auto font-mono font-medium tabular">{{ d.count }}</span>
                  <span class="w-10 text-right font-mono text-xs text-muted-foreground tabular">{{ pct(d.count) }}%</span>
                </li>
              }
            </ul>
          </div>
        } @else {
          <p class="py-10 text-center text-sm text-muted-foreground">No customers yet.</p>
        }
      </div>
    </div>
  `,
})
export class LeadStatusChartComponent {
  size = SIZE;
  cx = CX;
  cy = CY;

  constructor(private customers: CustomerService) {}

  data = computed(() => statusBreakdown(this.customers.records()).map((d) => ({ ...d, fill: STATUS_COLOR[d.status] })));
  total = computed(() => this.data().reduce((s, d) => s + d.count, 0));

  hover = signal<CustomerStatus | null>(null);

  segments = computed(() => {
    const total = this.total();
    if (total === 0) return [];
    const gap = 0.03; // radians of padding between segments
    let angle = -Math.PI / 2;
    return this.data()
      .filter((d) => d.count > 0)
      .map((d) => {
        const frac = d.count / total;
        const start = angle + gap / 2;
        const end = angle + frac * Math.PI * 2 - gap / 2;
        angle += frac * Math.PI * 2;
        return { status: d.status, fill: d.fill, path: this.arc(start, end) };
      });
  });

  pct(count: number): number {
    const total = this.total();
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  private point(r: number, a: number): [number, number] {
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }

  private arc(start: number, end: number): string {
    const large = end - start > Math.PI ? 1 : 0;
    const [x0o, y0o] = this.point(R_OUTER, start);
    const [x1o, y1o] = this.point(R_OUTER, end);
    const [x1i, y1i] = this.point(R_INNER, end);
    const [x0i, y0i] = this.point(R_INNER, start);
    return [
      `M${x0o},${y0o}`,
      `A${R_OUTER},${R_OUTER} 0 ${large} 1 ${x1o},${y1o}`,
      `L${x1i},${y1i}`,
      `A${R_INNER},${R_INNER} 0 ${large} 0 ${x0i},${y0i}`,
      'Z',
    ].join(' ');
  }
}
