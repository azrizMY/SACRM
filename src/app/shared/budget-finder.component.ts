import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';
import { BrandMarkComponent } from './brand-mark.component';
import { CarShadowPipe } from './car-shadow';
import { budgetMatches, type BudgetMatch, type BudgetRules, type CashLimit } from './budget-finder';
import { modelVariantLabel, type Vehicle } from '../data/calculator-data';

export type BudgetPick = { vehicleId: string; year: number; deposit: number; tenureYears: number };

const QUICK_BUDGETS = [500, 700, 900, 1200, 1500, 2000];
const QUICK_DEPOSITS: Exclude<CashLimit, null>[] = ['fullLoan', 5000, 10000, 20000, 30000];
const TENURES = [5, 7, 9];
/** Results shown before "Show more". */
const PAGE = 12;
/** Cars that need more than the maximum deposit are shown at that deposit only while their
 *  monthly stays within this much of the budget; further above, they're left out. */
const OVER_BUDGET_LIMIT = 200;

/**
 * "What monthly suits you?" — the customer (or the advisor, for them) types a comfortable monthly,
 * and every car shows the deposit that gets it there. Shared by the advisor's Budget Finder page
 * and the customer link's Budget tab. It never says anyone can't afford a car: every car has a
 * deposit, and anyone unsure is pointed to the advisor instead.
 */
@Component({
  selector: 'app-budget-finder',
  standalone: true,
  imports: [CommonModule, IconComponent, TranslatePipe, BrandMarkComponent, CarShadowPipe],
  template: `
    <div class="flex flex-col gap-4">
      <!-- The budget: two amounts side by side, then loan period and brand on one row -->
      <div class="flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="grid gap-px bg-border md:grid-cols-2">
          <!-- Monthly -->
          <label class="flex flex-col gap-3 bg-card p-5">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Monthly instalment' | t }}</span>
            <span class="flex items-baseline gap-2">
              <span class="text-lg font-semibold text-muted-foreground">RM</span>
              <input
                type="text"
                inputmode="numeric"
                [value]="grouped(budget())"
                (input)="budget.set(digits($event) ?? 0)"
                (blur)="refresh($event, budget())"
                [attr.aria-label]="'Monthly instalment' | t"
                style="font-size: 2.25rem"
                class="w-full min-w-0 bg-transparent font-bold leading-tight tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <span class="shrink-0 text-sm text-muted-foreground">/ {{ 'month' | t }}</span>
            </span>
            <span class="flex flex-wrap gap-1.5">
              @for (b of quickBudgets; track b) {
                <button
                  type="button"
                  (click)="budget.set(b)"
                  class="rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors"
                  [ngClass]="budget() === b ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'"
                >
                  {{ b.toLocaleString('en-MY') }}
                </button>
              }
            </span>
          </label>

          <!-- Maximum deposit (optional) -->
          <label class="flex flex-col gap-3 bg-card p-5">
            <span class="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {{ 'Cash you can put down' | t }}
              <span class="font-medium normal-case tracking-normal">{{ 'Optional' | t }}</span>
            </span>
            <span class="flex items-baseline gap-2">
              <span class="text-lg font-semibold text-muted-foreground">RM</span>
              <input
                type="text"
                inputmode="numeric"
                [value]="cashAmount() === null ? '' : grouped(cashAmount()!)"
                (input)="maxDeposit.set(digits($event))"
                (blur)="refresh($event, cashAmount())"
                [placeholder]="(maxDeposit() === 'fullLoan' ? 'Full loan' : 'Any amount') | t"
                [attr.aria-label]="'Cash you can put down' | t"
                style="font-size: 2.25rem"
                class="w-full min-w-0 bg-transparent font-bold leading-tight tabular-nums text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </span>
            <span class="flex flex-wrap gap-1.5">
              @for (d of quickDeposits; track d) {
                <button
                  type="button"
                  (click)="maxDeposit.set(maxDeposit() === d ? null : d)"
                  class="rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums transition-colors"
                  [ngClass]="maxDeposit() === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'"
                >
                  {{ d === 'fullLoan' ? ('Full loan' | t) : d.toLocaleString('en-MY') }}
                </button>
              }
            </span>
          </label>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-muted-foreground">{{ 'Loan period' | t }}</span>
            <div class="flex gap-1 rounded-lg bg-muted p-1">
              @for (y of tenures; track y) {
                <button
                  type="button"
                  (click)="tenureYears.set(y)"
                  class="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                  [ngClass]="tenureYears() === y ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                >
                  {{ y }} {{ 'years' | t }}
                </button>
              }
            </div>
          </div>
          @if (brands.length > 1) {
            <label class="flex items-center gap-2">
              <span class="text-xs font-medium text-muted-foreground">{{ 'Brand' | t }}</span>
              <select
                [value]="brand()"
                (change)="brand.set($any($event.target).value)"
                class="h-9 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
              >
                @for (b of brandFilters(); track b) {
                  <option [value]="b">{{ b === '' ? ('All brands' | t) : b }}</option>
                }
              </select>
            </label>
          }
        </div>
      </div>

      @if (doubtHref) {
        <a
          [href]="doubtHref"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 rounded-2xl border border-[var(--success)]/30 bg-[var(--success)]/10 px-4 py-3 text-sm transition-colors hover:bg-[var(--success)]/15"
        >
          <app-icon name="message-circle" [size]="18" class="shrink-0 text-[var(--success)]" />
          <span>{{ 'Not sure if you qualify? WhatsApp me — I will check with the banks for you.' | t }}</span>
        </a>
      }

      <!-- Every car: within the maximum deposit first, then the rest at the maximum deposit -->
      @if (budget() > 0) {
        @if (maxDeposit() !== null) {
          <p class="text-sm">
            <span class="font-semibold">{{ fitCount() }}</span> {{ 'cars fit both your monthly and your deposit.' | t }}
            @if (matches().length > fitCount()) {
              <span class="text-muted-foreground">{{ (maxDeposit() === 'fullLoan' ? 'The others are shown on a full loan, up to RM 200 above your monthly.' : 'The others are shown at your maximum deposit, up to RM 200 above your monthly.') | t }}</span>
            }
          </p>
        }
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (m of shown(); track m.vehicle.id) {
            <div class="flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 p-4">
                <span class="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  @if (m.vehicle.photoUrl) {
                    <img [src]="m.vehicle.photoUrl | carShadow" alt="" class="max-h-full max-w-full object-contain" />
                  } @else {
                    <app-brand-mark [brand]="m.vehicle.brand" class="size-9" />
                  }
                </span>
                <div class="flex min-w-0 flex-col">
                  <span class="truncate text-sm font-semibold">{{ label(m) }}</span>
                  <span class="text-xs text-muted-foreground">{{ m.vehicle.brand }} · {{ rm(m.totalDue) }}</span>
                </div>
              </div>
              <div class="grid grid-cols-2 border-t border-border">
                <div class="flex flex-col gap-0.5 p-4">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Deposit' | t }}</span>
                  <span class="text-lg font-bold tabular-nums">{{ fullLoan(m) ? ('Full loan' | t) : rm(m.deposit) }}</span>
                  @if (fullLoan(m) && m.deposit > 0) {
                    <span class="text-[11px] text-muted-foreground">{{ rm(m.deposit) }} {{ 'to round off the loan' | t }}</span>
                  }
                  @if (m.minimumApplies) {
                    <span class="text-[11px] text-muted-foreground">{{ 'Minimum for this car' | t }}</span>
                  }
                </div>
                <div class="flex flex-col gap-0.5 border-l border-border p-4">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Monthly' | t }}</span>
                  <span class="text-lg font-bold tabular-nums" [ngClass]="overBudget(m) ? 'text-foreground' : 'text-primary'">{{ rm(m.monthly) }}</span>
                  <!-- Only when it really is above: a car held back by its own minimum deposit can come in under the budget -->
                  @if (overBudget(m)) {
                    <span class="text-[11px] font-medium text-[var(--warning)]">{{ rm(m.monthly - budget()) }} {{ 'above your monthly' | t }}</span>
                  }
                  <span class="text-[11px] text-muted-foreground">{{ tenureYears() }} {{ 'years' | t }} · {{ m.rate }}% {{ m.rateType === 'flat' ? ('flat' | t) : 'EIR' }}</span>
                </div>
              </div>
              <button
                type="button"
                (click)="pick.emit({ vehicleId: m.vehicle.id, year: m.year, deposit: m.deposit, tenureYears: tenureYears() })"
                class="mt-auto flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-accent"
              >
                {{ openLabel | t }}
                <app-icon name="chevron-right" [size]="14" />
              </button>
            </div>
          }
        </div>
        @if (matches().length > shown().length) {
          <button type="button" (click)="limit.set(limit() + PAGE)" class="self-center rounded-lg border border-border px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent">
            {{ 'Show more cars' | t }} ({{ matches().length - shown().length }})
          </button>
        }
        <p class="text-center text-[11px] text-muted-foreground">{{ 'Estimates only. The bank decides the final loan.' | t }}</p>
      }
    </div>
  `,
})
export class BudgetFinderComponent {
  @Input({ required: true }) set vehicles(v: Vehicle[]) {
    this.vehicleList.set(v);
  }
  @Input({ required: true }) set rules(r: BudgetRules) {
    this.ruleSet.set(r);
  }
  /** Brands the customer can filter by; one brand hides the filter. */
  @Input() brands: string[] = [];
  /** Customer link only: where "Not sure if you qualify?" leads (the advisor's WhatsApp). */
  @Input() doubtHref: string | null = null;
  @Input() openLabel = 'See full quote';
  @Output() pick = new EventEmitter<BudgetPick>();

  readonly Math = Math;
  readonly PAGE = PAGE;
  readonly quickBudgets = QUICK_BUDGETS;
  readonly quickDeposits = QUICK_DEPOSITS;
  readonly tenures = TENURES;

  private vehicleList = signal<Vehicle[]>([]);
  private ruleSet = signal<BudgetRules | null>(null);
  budget = signal(900);
  /** The most cash the customer can put down — null means no limit. */
  maxDeposit = signal<CashLimit>(null);
  /** The typed amount for the box — empty for "No limit" and "Full loan", which show as its placeholder. */
  cashAmount = computed(() => {
    const d = this.maxDeposit();
    return typeof d === 'number' ? d : null;
  });
  tenureYears = signal(9);
  brand = signal('');
  limit = signal(PAGE);

  brandFilters = computed(() => ['', ...this.brands]);

  matches = computed<BudgetMatch[]>(() => {
    const rules = this.ruleSet();
    if (!rules || this.budget() <= 0) return [];
    const brand = this.brand();
    const cars = this.vehicleList().filter((v) => !brand || v.brand === brand);
    const budget = this.budget();
    return budgetMatches(cars, budget, this.tenureYears() * 12, rules, this.maxDeposit()).filter((m) => m.fits || m.monthly - budget <= OVER_BUDGET_LIMIT);
  });
  fitCount = computed(() => this.matches().filter((m) => m.fits).length);
  shown = computed(() => this.matches().slice(0, this.limit()));

  /** The monthly at this deposit is above the budget by at least RM1 (only possible when it doesn't fit). */
  overBudget(m: BudgetMatch): boolean {
    return !m.fits && m.monthly - this.budget() >= 0.5;
  }

  /** Financed in full: whatever deposit is left is only the loan's RM100 rounding. */
  fullLoan(m: BudgetMatch): boolean {
    return !m.minimumApplies && m.deposit < 100;
  }

  label(m: BudgetMatch): string {
    return modelVariantLabel(m.vehicle.model, m.vehicle.variant);
  }

  /** Whole ringgit with thousands separators, for the big amount inputs. */
  grouped(v: number): string {
    return Math.round(v).toLocaleString('en-MY');
  }

  /** Digits typed into an amount input, or null when it's empty. */
  digits(event: Event): number | null {
    const text = (event.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
    return text ? Math.min(Number(text), 9_999_999) : null;
  }

  /** On leaving an amount input, show the cleaned-up figure (separators back in). */
  refresh(event: Event, value: number | null) {
    (event.target as HTMLInputElement).value = value === null ? '' : this.grouped(value);
  }

  rm(v: number): string {
    return `RM ${Math.round(v).toLocaleString('en-MY')}`;
  }
}
