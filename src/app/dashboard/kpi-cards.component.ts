import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { IconComponent, type IconName } from '../shared/icon.component';
import { SparklineComponent } from '../shared/sparkline.component';
import { CountUpDirective } from '../shared/count-up.directive';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { formatRM } from '../data/calculator-data';
import { costSpentTotal, leadsPipelineStat, monthlyCommissionTrend, monthlyCostSpentTrend, monthlyLeadsCreatedTrend, monthlyUnitsSoldTrend, unitsSoldTotal } from '../data/dashboard-stats';
import { dealProfit } from '../data/customer-data';

type CardTone = 'accent' | 'success' | 'loss' | 'neutral';
type Card = { id: string; label: string; display: string; tone: CardTone; icon: IconName; trend: number[]; note?: string };

const TONE_VALUE: Record<CardTone, string> = {
  accent: 'text-foreground',
  success: 'text-[var(--success)]',
  loss: 'text-[var(--destructive)]',
  neutral: 'text-foreground',
};

const TONE_ICON_BG: Record<CardTone, string> = {
  accent: 'bg-primary/15 text-primary',
  success: 'bg-[var(--success)]/12 text-[var(--success)]',
  loss: 'bg-[var(--destructive)]/12 text-[var(--destructive)]',
  neutral: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]',
};

const TONE_SPARK_COLOR: Record<CardTone, string> = {
  accent: 'var(--primary)',
  success: 'var(--success)',
  loss: 'var(--destructive)',
  neutral: 'var(--chart-4)',
};

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule, BrandMarkComponent, IconComponent, SparklineComponent, CountUpDirective],
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      @for (kpi of cards(); track kpi.id; let i = $index) {
        <div
          class="lift animate-rise group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground"
          [style.--i]="i"
        >
          <div class="relative flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ kpi.label }}</p>
            <span class="flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" [ngClass]="iconBg[kpi.tone]">
              <app-icon [name]="kpi.icon" [size]="16" />
            </span>
          </div>
          <p class="relative mt-3 font-mono text-[1.65rem] font-bold leading-tight tracking-tight tabular" [ngClass]="toneValue[kpi.tone]" [appCountUp]="kpi.display"></p>
          @if (kpi.note) {
            <p class="relative mt-0.5 text-[11px] font-medium text-[var(--warning)]">{{ kpi.note }}</p>
          }
          <app-sparkline class="relative mt-3" [values]="kpi.trend" [color]="sparkColor[kpi.tone]" />
        </div>
      }

      <!-- Monthly target (brand set in Account Settings) -->
      <div
        class="lift animate-rise relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground sm:col-span-2 xl:col-span-1"
        [style.--i]="cards().length"
      >
        <div class="relative size-[72px] shrink-0">
          <svg viewBox="0 0 64 64" class="size-full -rotate-90">
            <defs>
              <linearGradient id="kpi-target-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="var(--primary)" />
                <stop offset="100%" stop-color="var(--primary-glow)" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" [attr.r]="ringR" fill="none" stroke="var(--muted)" stroke-width="6" />
            <circle
              class="target-ring"
              cx="32"
              cy="32"
              [attr.r]="ringR"
              fill="none"
              stroke="url(#kpi-target-ring)"
              stroke-width="6"
              stroke-linecap="round"
              [attr.stroke-dasharray]="ringC"
              [style.stroke-dashoffset]="ringC * (1 - targetPct() / 100)"
              [style.--ring-c]="ringC"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold tabular" [appCountUp]="targetPct().toFixed(0) + '%'"></span>
        </div>
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target</p>
          <span class="-mt-1 truncate text-[11px] text-muted-foreground">{{ targetBrand() }} · monthly</span>
          <div class="flex items-center gap-2">
            <span class="flex shrink-0 items-center justify-center rounded-full bg-white p-0.5">
              <app-brand-mark [brand]="targetBrand()" class="size-5 text-[9px]" />
            </span>
            <p class="font-mono text-2xl font-bold tracking-tight tabular">
              {{ delivered() }}<span class="text-sm font-normal text-muted-foreground"> / {{ targetUnits() }}</span>
            </p>
          </div>
          <p class="text-xs font-medium text-muted-foreground tabular">
            @if (remaining() === 0) {
              <span class="text-[var(--success)]">Target smashed! 🏁</span>
            } @else {
              {{ remaining() }} unit{{ remaining() === 1 ? '' : 's' }} to go
            }
          </p>
        </div>
      </div>
    </div>
  `,
  styles: `
    .target-ring {
      transition: stroke-dashoffset 1s var(--ease-out-expo);
      animation: kpi-ring-in 1.2s var(--ease-out-expo) 0.3s both;
    }
    @keyframes kpi-ring-in {
      from {
        stroke-dashoffset: var(--ring-c);
      }
    }
  `,
})
export class KpiCardsComponent {
  toneValue = TONE_VALUE;
  iconBg = TONE_ICON_BG;
  sparkColor = TONE_SPARK_COLOR;
  fmt = (v: number) => formatRM(v);
  readonly ringR = 26;
  readonly ringC = 2 * Math.PI * 26;

  constructor(
    private customers: CustomerService,
    private settingsService: SettingsService,
  ) {}

  targetBrand = computed(() => this.settingsService.settings().dashboardTarget.brand);
  targetUnits = computed(() => this.settingsService.settings().dashboardTarget.target);
  delivered = computed(() => this.customers.delivered().filter((r) => r.brand === this.targetBrand()).length);

  remaining = computed(() => Math.max(0, this.targetUnits() - this.delivered()));
  targetPct = computed(() => Math.min(100, (this.delivered() / this.targetUnits()) * 100));

  cards = computed<Card[]>(() => {
    const records = this.customers.records();
    const units = unitsSoldTotal(records);
    // Profit only counts delivered deals with a commission keyed in; the rest are shown as
    // pending rather than dragging the total down with costs and no commission yet.
    const delivered = this.customers.delivered();
    const settled = delivered.filter((r) => r.commission != null);
    const profitValue = settled.reduce((sum, r) => sum + dealProfit(r), 0);
    const pendingCommission = delivered.length - settled.length;
    const costSpent = costSpentTotal(records);
    const leads = leadsPipelineStat(records);

    const unitsTrend = monthlyUnitsSoldTrend(records).map((p) => p.units);
    const commissionTrend = monthlyCommissionTrend(records).map((p) => p.commission);
    const costTrend = monthlyCostSpentTrend(records).map((p) => p.cost);
    const leadsTrend = monthlyLeadsCreatedTrend(records).map((p) => p.units);

    return [
      {
        id: 'sales',
        label: 'Total units sold',
        display: `${units.value} unit${units.value === 1 ? '' : 's'}`,
        tone: 'accent',
        icon: 'car',
        trend: unitsTrend,
      },
      {
        id: 'profit',
        label: 'Total profit',
        display: this.fmt(profitValue),
        tone: profitValue >= 0 ? 'success' : 'loss',
        icon: 'trophy',
        trend: commissionTrend,
        note: pendingCommission > 0 ? `${pendingCommission} awaiting commission` : undefined,
      },
      {
        id: 'costSpent',
        label: 'Total cost spent',
        display: this.fmt(costSpent.value),
        tone: 'neutral',
        icon: 'gift',
        trend: costTrend,
      },
      {
        id: 'leads',
        label: 'Leads in pipeline',
        display: `${leads.value}`,
        tone: 'neutral',
        icon: 'users',
        trend: leadsTrend,
      },
    ];
  });
}
