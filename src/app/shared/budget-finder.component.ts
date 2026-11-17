import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { I18nService, TranslatePipe } from './i18n';
import { BrandMarkComponent } from './brand-mark.component';
import { CarShadowPipe } from './car-shadow';
import { budgetMatches, type BudgetMatch, type BudgetRules, type CashLimit } from './budget-finder';
import { NCD_OPTIONS, modelVariantLabel, type Vehicle } from '../data/calculator-data';

export type BudgetPick = { vehicleId: string; year: number; deposit: number; tenureYears: number };

const QUICK_BUDGETS = [500, 700, 900, 1200, 1500, 2000];
const QUICK_DEPOSITS: Exclude<CashLimit, null>[] = ['fullLoan', 5000, 10000, 20000, 30000];
const TENURES = [5, 7, 9];
/** Cars shown per brand before "Show all". */
const PER_BRAND = 6;
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
  styles: `
    /* The big amounts: inputs are forced to 16px on phones (no iOS zoom), so size them here instead */
    .bf-amount {
      font-size: 1.875rem;
    }
    @media (min-width: 768px) {
      .bf-amount {
        font-size: 2.25rem;
      }
    }
  `,
  template: `
    <div class="flex flex-col gap-4">
      <!-- The budget: two amounts side by side, then loan period and brand on one row -->
      <div class="flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
          <!-- Monthly -->
          <label data-tour="budget-monthly" class="flex min-w-0 flex-col gap-3 bg-card p-5">
            <span class="text-sm font-semibold text-foreground">{{ 'Monthly instalment' | t }}</span>
            <span class="flex items-baseline gap-2">
              <span class="text-lg font-semibold text-muted-foreground">RM</span>
              <input
                type="text"
                inputmode="numeric"
                [value]="budget() > 0 ? grouped(budget()) : ''"
                (input)="budget.set(digits($event) ?? 0)"
                (blur)="refresh($event, budget() > 0 ? budget() : null)"
                [placeholder]="'Enter Amount' | t"
                [attr.aria-label]="'Monthly instalment' | t"
                class="bf-amount fig w-full min-w-0 rounded-md bg-transparent leading-tight text-foreground placeholder:text-muted-foreground/50"
              />
              <span class="shrink-0 text-sm text-muted-foreground">/ {{ 'month' | t }}</span>
            </span>
            <span class="grid grid-cols-3 gap-2">
              @for (b of quickBudgets; track b) {
                <button
                  type="button"
                  (click)="budget.set(b)"
                  [attr.aria-pressed]="budget() === b"
                  class="flex h-10 items-center justify-center whitespace-nowrap rounded-lg border px-2 text-sm font-semibold tabular-nums transition-colors"
                  [ngClass]="budget() === b ? 'border-brand bg-brand-soft text-foreground' : 'border-control text-foreground hover:bg-accent'"
                >
                  <span class="mr-1 text-xs font-medium text-muted-foreground">RM</span>{{ b.toLocaleString('en-MY') }}
                </button>
              }
            </span>
          </label>

          <!-- Maximum deposit (optional) -->
          <label data-tour="budget-cash" class="flex min-w-0 flex-col gap-3 bg-card p-5">
            <span class="flex items-center justify-between gap-2 text-sm font-semibold text-foreground">
              {{ 'Cash you can put down' | t }}
              <span class="text-sm font-medium text-muted-foreground">{{ 'Optional' | t }}</span>
            </span>
            <span class="flex items-baseline gap-2">
              <span class="text-lg font-semibold text-muted-foreground">RM</span>
              <input
                type="text"
                inputmode="numeric"
                [value]="cashAmount() === null ? '' : grouped(cashAmount()!)"
                (input)="maxDeposit.set(digits($event))"
                (blur)="refresh($event, cashAmount())"
                [placeholder]="(maxDeposit() === 'fullLoan' ? 'Full loan' : 'Enter Amount') | t"
                [attr.aria-label]="'Cash you can put down' | t"
                class="bf-amount fig w-full min-w-0 rounded-md bg-transparent leading-tight text-foreground placeholder:text-muted-foreground/50"
              />
            </span>
            <span class="grid grid-cols-3 gap-2">
              @for (d of quickDeposits; track d) {
                <button
                  type="button"
                  (click)="maxDeposit.set(maxDeposit() === d ? null : d)"
                  [attr.aria-pressed]="maxDeposit() === d"
                  class="flex h-10 items-center justify-center whitespace-nowrap rounded-lg border px-2 text-sm font-semibold tabular-nums transition-colors"
                  [ngClass]="maxDeposit() === d ? 'border-brand bg-brand-soft text-foreground' : 'border-control text-foreground hover:bg-accent'"
                >
                  @if (d === 'fullLoan') {
                    {{ 'Full loan' | t }}
                  } @else {
                    <span class="mr-1 text-xs font-medium text-muted-foreground">RM</span>{{ d.toLocaleString('en-MY') }}
                  }
                </button>
              }
            </span>
          </label>
        </div>

        <!-- Loan period and NCD together (they shape the loan); Brand on its own (it filters the list) -->
        <div class="flex flex-col gap-4 border-t border-border px-5 py-4 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3 md:py-3">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div data-tour="budget-period" class="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
            <span class="text-sm font-semibold text-foreground">{{ 'Loan period' | t }}</span>
            <div class="grid grid-cols-3 gap-2 md:flex">
              @for (y of tenures; track y) {
                <button
                  type="button"
                  (click)="tenureYears.set(y)"
                  [attr.aria-pressed]="tenureYears() === y"
                  class="flex h-10 items-center justify-center whitespace-nowrap rounded-lg border px-2 text-sm font-semibold tabular-nums transition-colors md:px-3"
                  [ngClass]="tenureYears() === y ? 'border-brand bg-brand-soft text-foreground' : 'border-control text-foreground hover:bg-accent'"
                >
                  {{ y }} {{ 'years' | t }}
                </button>
              }
            </div>
          </div>
          <label class="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
            <span class="text-sm font-semibold text-foreground">{{ 'NCD' | t }}</span>
            <select
              [value]="ncd()"
              (change)="ncd.set(+$any($event.target).value)"
              class="h-10 w-full min-w-0 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none md:w-auto"
            >
              @for (o of ncdOptions; track o.value) {
                <option [value]="o.value" [selected]="o.value === ncd()">{{ o.label | t }}</option>
              }
            </select>
          </label>
          </div>
          @if (brands.length > 1) {
            <label class="flex min-w-0 flex-col gap-1.5 border-t border-border pt-4 md:flex-row md:items-center md:gap-2 md:border-0 md:pt-0">
              <span class="text-sm font-semibold text-foreground">{{ 'Brand' | t }}</span>
              <select
                [value]="brand()"
                (change)="brand.set($any($event.target).value)"
                class="h-10 w-full min-w-0 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none md:w-auto"
              >
                @for (b of brandFilters(); track b) {
                  <option [value]="b">{{ b === '' ? ('All brands' | t) : b }}</option>
                }
              </select>
            </label>
          }
        </div>
      </div>

      <!-- Phones: the results start below the form, so a tap on an amount would otherwise seem to
           do nothing. This pill sticks to the bottom of the screen until the results scroll into
           view, then settles into place just above them. -->
      @if (budget() > 0 && matches().length > 0) {
        <button
          type="button"
          (click)="scrollToResults()"
          class="sticky z-20 flex items-center justify-center gap-2 self-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg md:hidden"
          [ngClass]="stickyBottom"
        >
          {{ (matches().length === 1 ? 'See 1 car' : 'See {n} cars') | t: { n: matches().length } }}
          <app-icon name="arrow-down" [size]="16" />
        </button>
      }

      @if (doubtHref) {
        <a
          [href]="doubtHref"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 rounded-2xl border border-[var(--success)]/30 bg-[var(--success)]/10 px-4 py-3 text-sm transition-colors hover:bg-[var(--success)]/15"
        >
          <app-icon name="message-circle" [size]="20" class="shrink-0 text-[var(--success)]" />
          <span>{{ 'Not sure if you qualify? WhatsApp me — I will check with the banks for you.' | t }}</span>
        </a>
      }

      <!-- Nothing to show until there's a monthly -->
      @if (budget() <= 0) {
        <div class="empty-state">
          <span class="empty-icon"><app-icon name="wallet" [size]="28" /></span>
          <h3>{{ 'How much each month?' | t }}</h3>
          <p>{{ 'Enter a monthly instalment to see every car that fits it.' | t }}</p>
        </div>
      }

      <!-- Every car: within the maximum deposit first, then the rest at the maximum deposit -->
      <div #results class="-mt-4 scroll-mt-4" aria-hidden="true"></div>
      @if (budget() > 0) {
        @if (maxDeposit() !== null) {
          <p class="text-sm">
            <span class="font-semibold">{{ fitCount() }}</span> {{ (fitCount() === 1 ? 'car fits both your monthly and your deposit.' : 'cars fit both your monthly and your deposit.') | t }}
            @if (matches().length > fitCount()) {
              <span class="text-muted-foreground">{{ (maxDeposit() === 'fullLoan' ? 'The others are shown on a full loan, up to RM 200 above your monthly.' : 'The others are shown at your maximum deposit, up to RM 200 above your monthly.') | t }}</span>
            }
          </p>
        }
        @for (g of groups(); track g.brand) {
          <section class="flex flex-col gap-3">
            <div class="flex items-center gap-3 border-b border-border pb-2 pt-2">
              <app-brand-mark [brand]="g.brand" class="size-8" />
              <h3 class="text-base font-bold">{{ g.brand }}</h3>
              <span class="text-xs text-muted-foreground">
                {{ g.cars.length }} {{ (g.cars.length === 1 ? 'car' : 'cars') | t }}@if (maxDeposit() !== null) { · {{ g.fit }} {{ 'fit' | t }}}
              </span>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          @for (m of visible(g); track m.vehicle.id) {
            <!-- One car: the photo, then the monthly as the headline. The whole card opens the quote. -->
            <button
              type="button"
              (click)="pick.emit({ vehicleId: m.vehicle.id, year: m.year, deposit: m.deposit, tenureYears: tenureYears() })"
              class="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left text-card-foreground shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="relative flex h-40 items-end justify-center bg-gradient-to-b from-white to-[#eceef1] px-6 pb-3 pt-8">
                @if (m.vehicle.photoUrl) {
                  <img [src]="m.vehicle.photoUrl | carShadow" alt="" class="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                } @else {
                  <app-brand-mark [brand]="m.vehicle.brand" class="mb-6 size-16 opacity-80" />
                }
                <span class="absolute left-3 top-3 rounded-full px-2.5 py-1.5 text-sm font-semibold" [ngClass]="badge(m).tone">{{ badge(m).text }}</span>
              </div>

              <div class="flex flex-1 flex-col gap-3 p-4">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="min-w-0 truncate text-base font-bold">{{ label(m) }}</span>
                  <span class="shrink-0 text-sm tabular-nums text-muted-foreground">{{ rm(m.totalDue) }}</span>
                </div>

                <div class="flex items-end justify-between gap-3">
                  <div class="flex flex-col">
                    <span class="flex items-baseline gap-1">
                      <span class="fig text-2xl"><span [class.hl]="!overBudget(m)">{{ rm(m.monthly) }}</span></span>
                      <span class="text-sm text-muted-foreground">/ {{ 'month' | t }}</span>
                    </span>
                    <span class="mt-1 text-xs text-muted-foreground">{{ tenureYears() }} {{ 'years' | t }} · {{ m.rate }}% {{ m.rateType === 'flat' ? ('flat' | t) : 'EIR' }}</span>
                  </div>
                  <div class="flex flex-col items-end text-right">
                    <span class="text-base font-bold tabular-nums">{{ fullLoan(m) ? ('Full loan' | t) : rm(m.deposit) }}</span>
                    <span class="text-xs text-muted-foreground">
                      @if (fullLoan(m)) {
                        {{ m.deposit > 0 ? rm(m.deposit) + ' ' + ('to round off the loan' | t) : ('No deposit' | t) }}
                      } @else {
                        {{ (m.minimumApplies ? 'Minimum deposit' : 'Deposit') | t }}
                      }
                    </span>
                  </div>
                </div>

                <span class="mt-auto flex items-center gap-1 border-t border-border pt-3 text-sm font-semibold text-foreground underline text-brand">
                  {{ openLabel | t }}
                  <app-icon name="chevron-right" [size]="18" class="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          }
            </div>
            @if (g.cars.length > PER_BRAND) {
              <button type="button" (click)="toggle(g.brand)" class="self-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-accent">
                {{ (expanded().has(g.brand) ? 'Show fewer' : 'Show all {n} {brand}') | t: { n: g.cars.length, brand: g.brand } }}
              </button>
            }
          </section>
        }
        <p class="text-center text-xs text-muted-foreground">{{ 'Estimates only. The bank decides the final loan.' | t }}</p>
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
    this.ncd.set(r.ncd);
  }
  /** Brands the customer can filter by; one brand hides the filter. */
  @Input() brands: string[] = [];
  /** The advisor's Primary Brand — its section comes first. */
  @Input() set primaryBrand(b: string | null | undefined) {
    this.primary.set(b ?? null);
  }
  private primary = signal<string | null>(null);
  /** Customer link only: where "Not sure if you qualify?" leads (the advisor's WhatsApp). */
  @Input() doubtHref: string | null = null;
  @Input() openLabel = 'See full quote';
  /** Where the phone "See N cars" pill sits — raised on the customer link, above its tab bar. */
  @Input() stickyBottom = 'bottom-4';
  @ViewChild('results') private resultsAnchor?: ElementRef<HTMLElement>;

  scrollToResults() {
    this.resultsAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  @Output() pick = new EventEmitter<BudgetPick>();
  /** A search the customer settled on (after a pause) — the monthly and the cash they entered. */
  @Output() searched = new EventEmitter<{ monthly: number; cash: number | null; fullLoan: boolean }>();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSearch = '';
  private searchWatch = effect(() => {
    const monthly = this.budget();
    const limit = this.maxDeposit();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (monthly <= 0) return;
    this.searchTimer = setTimeout(() => {
      const key = `${monthly}|${limit}`;
      if (key === this.lastSearch) return;
      this.lastSearch = key;
      this.searched.emit({ monthly, cash: typeof limit === 'number' ? limit : null, fullLoan: limit === 'fullLoan' });
    }, 2500);
  });

  readonly Math = Math;
  private i18n = inject(I18nService);
  readonly PER_BRAND = PER_BRAND;
  readonly quickBudgets = QUICK_BUDGETS;
  readonly quickDeposits = QUICK_DEPOSITS;
  readonly tenures = TENURES;

  private vehicleList = signal<Vehicle[]>([]);
  private ruleSet = signal<BudgetRules | null>(null);
  /** 0 until a monthly is entered — nothing is assumed for the customer. */
  budget = signal(0);
  /** The most cash the customer can put down — null means no limit. */
  maxDeposit = signal<CashLimit>(null);
  /** The typed amount for the box — empty for "No limit" and "Full loan", which show as its placeholder. */
  cashAmount = computed(() => {
    const d = this.maxDeposit();
    return typeof d === 'number' ? d : null;
  });
  tenureYears = signal(9);
  /** Starts at the advisor's default NCD; changing it here only affects this search. */
  ncd = signal(0);
  readonly ncdOptions = NCD_OPTIONS;
  brand = signal('');
  /** Brands opened with "Show all". */
  expanded = signal<Set<string>>(new Set());

  brandFilters = computed(() => ['', ...this.brands]);

  matches = computed<BudgetMatch[]>(() => {
    const rules = this.ruleSet();
    if (!rules || this.budget() <= 0) return [];
    const brand = this.brand();
    const cars = this.vehicleList().filter((v) => !brand || v.brand === brand);
    const budget = this.budget();
    return budgetMatches(cars, budget, this.tenureYears() * 12, { ...rules, ncd: this.ncd() }, this.maxDeposit()).filter((m) => m.fits || m.monthly - budget <= OVER_BUDGET_LIMIT);
  });
  fitCount = computed(() => this.matches().filter((m) => m.fits).length);
  /** The results by brand — the Primary Brand first, then catalog order; within a brand the order is
   *  the finder's own (fits first). */
  groups = computed(() => {
    const primary = this.primary();
    const catalogOrder = [...new Set(this.vehicleList().map((v) => v.brand))];
    const order = primary && catalogOrder.includes(primary) ? [primary, ...catalogOrder.filter((b) => b !== primary)] : catalogOrder;
    return order
      .map((brand) => {
        const cars = this.matches().filter((m) => m.vehicle.brand === brand);
        return { brand, cars, fit: cars.filter((m) => m.fits).length };
      })
      .filter((g) => g.cars.length > 0);
  });

  visible(g: { brand: string; cars: BudgetMatch[] }): BudgetMatch[] {
    return this.expanded().has(g.brand) ? g.cars : g.cars.slice(0, PER_BRAND);
  }

  toggle(brand: string) {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  }

  /** The little label on the photo. */
  badge(m: BudgetMatch): { text: string; tone: string } {
    // No cash entered: the cash is unknown, not unlimited — say what each car needs instead of "fits".
    if (this.maxDeposit() === null) {
      return this.fullLoan(m)
        ? { text: this.i18n.t('Full loan'), tone: 'bg-neutral-900/80 text-white' }
        : { text: this.i18n.t('Needs {amount} deposit', { amount: this.rm(m.deposit) }), tone: 'bg-neutral-900/80 text-white' };
    }
    if (this.overBudget(m)) return { text: `+${this.rm(m.monthly - this.budget())} ${this.i18n.t('above')}`, tone: 'bg-[var(--warning)] text-[var(--warning-foreground)]' };
    if (!m.fits) return { text: this.i18n.t('Min. deposit'), tone: 'bg-neutral-900/80 text-white' };
    return { text: this.i18n.t('Fits your budget'), tone: 'bg-[var(--success)] text-[var(--success-foreground)]' };
  }

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
