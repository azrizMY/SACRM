import { AfterViewInit, Component, ElementRef, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { monthlyPipelineTrend } from '../data/dashboard-stats';
import { CustomerService } from '../shared/customer.service';

const H = 280;
const PAD = { top: 8, right: 8, bottom: 24, left: 32 };

type Stage = { key: 'lead' | 'booked' | 'inProgress' | 'delivered'; label: string; color: string };

const STAGES: Stage[] = [
  { key: 'lead', label: 'Lead', color: 'var(--chart-4)' },
  { key: 'booked', label: 'Booked', color: 'var(--warning)' },
  { key: 'inProgress', label: 'In Progress', color: 'oklch(0.65 0.19 300)' },
  { key: 'delivered', label: 'Delivered', color: 'var(--success)' },
];

@Component({
  selector: 'app-units-sold-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-3 px-6">
        <div class="flex flex-col gap-1">
          <h3 class="font-semibold leading-none">Pipeline trend</h3>
          <p class="text-sm text-muted-foreground">Lead, Booked, In Progress &amp; Delivered, month by month</p>
        </div>
        <ul class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          @for (s of stages; track s.key) {
            <li class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="size-2 rounded-[2px]" [style.background]="s.color"></span>{{ s.label }}
            </li>
          }
        </ul>
      </div>
      <div class="px-6">
        <div class="relative w-full" #host [style.height.px]="height">
          <svg [attr.width]="width()" [attr.height]="height" class="overflow-visible" (mouseleave)="hover.set(null)">
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

            <!-- x labels -->
            @for (p of points(); track p.month) {
              <text
                [attr.x]="p.x" [attr.y]="height - 6"
                text-anchor="middle" class="fill-muted-foreground" style="font-size: 11px"
              >{{ p.month }}</text>
            }

            <!-- Lines -->
            @for (s of stages; track s.key) {
              <path [attr.d]="lines()[s.key]" fill="none" [attr.stroke]="s.color" stroke-width="2" />
            }

            <!-- Hover -->
            @if (hover() !== null) {
              <line
                [attr.x1]="points()[hover()!].x" [attr.x2]="points()[hover()!].x"
                [attr.y1]="pad.top" [attr.y2]="height - pad.bottom"
                stroke="var(--border)"
              />
              @for (s of stages; track s.key) {
                <circle
                  [attr.cx]="points()[hover()!].x" [attr.cy]="points()[hover()!].y[s.key]"
                  r="3.5" [attr.fill]="s.color" stroke="var(--card)" stroke-width="2"
                />
              }
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
              [style.top.px]="Math.max(topY(hover()!) - 12, 8)"
            >
              <p class="mb-1 font-medium">{{ points()[hover()!].month }}</p>
              @for (s of stages; track s.key) {
                <div class="flex items-center justify-between gap-4">
                  <span class="flex items-center gap-1.5 text-muted-foreground">
                    <span class="size-2 rounded-[2px]" [style.background]="s.color"></span>{{ s.label }}
                  </span>
                  <span class="font-mono font-medium tabular">{{ data()[hover()!][s.key] }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class UnitsSoldChartComponent implements AfterViewInit, OnDestroy {
  host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  width = signal(600);
  height = H;
  pad = PAD;
  Math = Math;
  stages = STAGES;

  private ro?: ResizeObserver;

  constructor(private customers: CustomerService) {}

  data = computed(() => monthlyPipelineTrend(this.customers.records()));
  hover = signal<number | null>(null);

  yMax = computed(() => {
    const max = Math.max(1, ...this.data().map((d) => Math.max(d.lead, d.booked, d.inProgress, d.delivered)));
    return Math.ceil(max / 5) * 5 || 5;
  });

  points = computed(() => {
    const w = this.width();
    const plotW = w - this.pad.left - this.pad.right;
    const plotH = this.height - this.pad.top - this.pad.bottom;
    const data = this.data();
    const yMax = this.yMax();
    const n = data.length;
    const y = (v: number) => this.pad.top + plotH - (v / yMax) * plotH;
    return data.map((d, i) => {
      const x = this.pad.left + (n === 1 ? 0 : (i / (n - 1)) * plotW);
      const yByStage: Record<Stage['key'], number> = {
        lead: y(d.lead),
        booked: y(d.booked),
        inProgress: y(d.inProgress),
        delivered: y(d.delivered),
      };
      return { ...d, x, y: yByStage };
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
      const value = Math.round((yMax / steps) * i);
      const y = this.pad.top + plotH - (value / yMax) * plotH;
      return { value, y };
    });
  });

  lines = computed(() => {
    const pts = this.points();
    const build = (key: Stage['key']) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y[key]}`).join(' ');
    return {
      lead: build('lead'),
      booked: build('booked'),
      inProgress: build('inProgress'),
      delivered: build('delivered'),
    } as Record<Stage['key'], string>;
  });

  /** Highest (smallest-y) stage point at this index, so the tooltip clears every line's marker. */
  topY(i: number): number {
    const y = this.points()[i].y;
    return Math.min(y.lead, y.booked, y.inProgress, y.delivered);
  }

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
