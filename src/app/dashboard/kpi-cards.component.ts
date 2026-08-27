import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { IconComponent, type IconName } from '../shared/icon.component';
import { SparklineComponent } from '../shared/sparkline.component';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { formatRM } from '../data/calculator-data';
import { costSpentTotal, leadsPipelineStat, monthlyCommissionTrend, monthlyCostSpentTrend, monthlyLeadsCreatedTrend, monthlyUnitsSoldTrend, profitTotal, unitsSoldTotal } from '../data/dashboard-stats';

type CardTone = 'accent' | 'success' | 'loss' | 'neutral';
type Card = { id: string; label: string; display: string; tone: CardTone; icon: IconName; trend: number[] };

const TONE_VALUE: Record<CardTone, string> = {
  accent: 'text-foreground',
  success: 'text-[var(--success)]',
  loss: 'text-[var(--destructive)]',
  neutral: 'text-foreground',
};

const TONE_ICON_BG: Record<CardTone, string> = {
  accent: 'bg-primary/12 text-primary',
  success: 'bg-[var(--success)]/12 text-[var(--success)]',
  loss: 'bg-[var(--destructive)]/12 text-[var(--destructive)]',
  neutral: 'bg-muted text-muted-foreground',
};

const TONE_SPARK_COLOR: Record<CardTone, string> = {
  accent: 'var(--primary)',
  success: 'var(--success)',
  loss: 'var(--destructive)',
  neutral: 'var(--muted-foreground)',
};

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule, BrandMarkComponent, IconComponent, SparklineComponent],
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      @for (kpi of cards(); track kpi.id) {
        <div class="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium text-muted-foreground">{{ kpi.label }}</p>
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full" [ngClass]="iconBg[kpi.tone]">
              <app-icon [name]="kpi.icon" [size]="15" />
            </span>
          </div>
          <p class="mt-3 font-mono text-2xl font-semibold tracking-tight tabular" [ngClass]="toneValue[kpi.tone]">
            {{ kpi.display }}
          </p>
          <app-sparkline class="mt-3" [values]="kpi.trend" [color]="sparkColor[kpi.tone]" />
        </div>
      }

      <!-- Monthly target (brand set in Account Settings) -->
      <div class="flex flex-col rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:col-span-2 xl:col-span-1">
        <p class="text-xs font-medium text-muted-foreground">{{ targetBrand() }}'s Monthly Target</p>
        <div class="mt-3 flex items-center gap-2">
          <app-brand-mark [brand]="targetBrand()" class="size-6 text-[10px]" />
          <p class="font-mono text-2xl font-semibold tracking-tight tabular">
            {{ delivered() }}<span class="text-sm font-normal text-muted-foreground"> / {{ targetUnits() }} units</span>
          </p>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary" [style.width.%]="targetPct()"></div>
        </div>
        <div class="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground tabular">
          {{ targetBrand() }} &middot; {{ remaining() }} unit{{ remaining() === 1 ? '' : 's' }} remaining
        </div>
      </div>
    </div>
  `,
})
export class KpiCardsComponent {
  toneValue = TONE_VALUE;
  iconBg = TONE_ICON_BG;
  sparkColor = TONE_SPARK_COLOR;
  fmt = (v: number) => formatRM(v);

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
    const profit = profitTotal(records);
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
        display: this.fmt(profit.value),
        tone: profit.value >= 0 ? 'success' : 'loss',
        icon: 'trophy',
        trend: commissionTrend,
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
