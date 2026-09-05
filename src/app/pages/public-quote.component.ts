import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { fetchPublicQuote, type PublicQuoteBundle } from '../shared/public-quote-api';
import { posterFontsReady } from '../shared/poster-theme';
import { classicTemplate } from '../shared/poster-template-classic';
import type { PosterData } from '../shared/poster-data';
import { brandLogo } from '../data/dashboard-data';
import { DEFAULT_EPR, defaultInsuranceQuotation } from '../data/calculator-data';
import {
  DEFAULT_VEHICLES,
  NCD_OPTIONS,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  formatRM,
  modelVariantLabel,
  monthlyPayment,
  rebateForYear,
  roundCents,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type Vehicle,
  type VehicleOverride,
} from '../data/calculator-data';

/** The full 1-9 year range the tenure picker offers — same range as the Calculator's own poster
 *  year buttons, just single-select here instead of "pick 3 for a comparison table". */
const TENURE_YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 1);

@Component({
  selector: 'app-public-quote',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (loading()) {
      <div class="flex min-h-screen items-center justify-center bg-background">
        <app-icon name="refresh-cw" [size]="24" class="animate-spin text-muted-foreground" />
      </div>
    } @else if (notFound()) {
      <div class="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
        <app-icon name="x-circle" [size]="28" class="text-muted-foreground" />
        <h1 class="text-lg font-semibold">This link isn't valid</h1>
        <p class="max-w-xs text-sm text-muted-foreground">Please check the link your sales advisor sent you, or ask them to resend it.</p>
      </div>
    } @else {
      <div class="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
        <!-- Mobile Preview/Customize switcher -->
        <div class="sticky -top-4 z-10 -mx-4 flex flex-col gap-2 bg-background px-4 pb-2 pt-0 md:-mx-6 md:px-6 xl:hidden">
          <div class="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Due</span>
            <span class="text-sm font-bold tabular">{{ fmt2(allInPrice()) }}</span>
          </div>
          <div role="tablist" aria-label="Quote view" class="flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="mobileTab() === 'preview'"
              (click)="mobileTab.set('preview')"
              class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="mobileTab() === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            >
              Preview
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="mobileTab() === 'customize'"
              (click)="mobileTab.set('customize')"
              class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="mobileTab() === 'customize' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            >
              Customize
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
          <!-- Quote preview -->
          <div
            class="flex-col gap-2 xl:sticky xl:top-4 xl:col-span-2 xl:flex xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain"
            [ngClass]="mobileTab() === 'preview' ? 'flex' : 'hidden'"
          >
            <div class="shrink-0 overflow-hidden rounded-xl shadow-md">
              <canvas #posterCanvas class="block w-full h-auto"></canvas>
            </div>
            <p class="flex shrink-0 items-center justify-center gap-1.5 text-center text-[10px] leading-relaxed text-muted-foreground">
              <app-icon name="info" [size]="12" class="shrink-0" />
              Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here.
            </p>
          </div>

          <!-- Customize quote -->
          <div
            class="flex-col gap-4 xl:sticky xl:top-4 xl:col-span-1 xl:flex xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
            [ngClass]="mobileTab() === 'customize' ? 'flex' : 'hidden'"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold leading-none">Customize Quote</h3>
              <div class="flex items-center gap-1">
                @if (bundle()!.advisor.phoneWa) {
                  <button
                    type="button"
                    (click)="openWhatsAppToAdvisor()"
                    class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
                  >
                    <app-icon name="message-circle" [size]="13" />
                    WhatsApp Advisor
                  </button>
                }
                <button
                  type="button"
                  (click)="reset()"
                  class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="refresh-cw" [size]="13" />
                  Reset
                </button>
              </div>
            </div>

            <!-- Select car -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Select Car</span>

              <div class="grid grid-cols-1 gap-3" [ngClass]="singleBrandMode ? '' : 'sm:grid-cols-2'">
                @if (!singleBrandMode) {
                  <div class="flex flex-col gap-2">
                    <label for="brandSelect" class="text-xs font-medium text-muted-foreground">Brand</label>
                    <select
                      id="brandSelect"
                      [ngModel]="selectedBrand()"
                      (ngModelChange)="onBrandChange($event)"
                      class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                    >
                      @for (b of brands(); track b) {
                        <option [value]="b">{{ b }}</option>
                      }
                    </select>
                  </div>
                }

                <div class="flex flex-col gap-2">
                  <span class="text-xs font-medium text-muted-foreground">Model</span>
                  <div class="relative">
                    <button
                      type="button"
                      (click)="toggleCarDropdown($event)"
                      class="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                    >
                      <span class="truncate">{{ modelVariantLabel(selectedModelName(), selectedVariant()) }}</span>
                      <app-icon name="chevron-down" [size]="16" class="shrink-0 text-muted-foreground" />
                    </button>
                    @if (carDropdownOpen) {
                      <div class="absolute left-0 top-full z-50 mt-1 max-h-80 w-full min-w-[220px] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg">
                        @for (group of carGroups(); track group.model; let first = $first) {
                          <div class="px-3 pb-1 text-xs font-medium text-muted-foreground" [ngClass]="first ? 'pt-2' : 'pt-3'">{{ group.model }}</div>
                          @for (item of group.items; track item.variant) {
                            <button
                              type="button"
                              (click)="selectModelVariant(group.model, item.variant)"
                              class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                            >
                              {{ item.label }}
                              @if (group.model === selectedModelName() && item.variant === selectedVariant()) {
                                <app-icon name="check" [size]="14" class="shrink-0 text-foreground" />
                              }
                            </button>
                          }
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
              <span class="text-[11px] text-muted-foreground">{{ fmt(selectedVehicle().price) }} base price</span>

              @if (availableYears().length > 1) {
                <div class="flex flex-col gap-2">
                  <span class="text-xs font-medium text-muted-foreground">Model Year</span>
                  <div role="radiogroup" aria-label="Model year" class="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
                    @for (y of availableYears(); track y) {
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="y === modelYear()"
                        (click)="modelYear.set(y)"
                        class="flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors"
                        [ngClass]="y === modelYear() ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ y }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Price setup -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price Setup</span>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Rebate (RM)</span>
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 opacity-80">
                  <span class="text-sm font-medium text-muted-foreground">RM</span>
                  <span class="text-sm font-medium tabular">{{ rebateInput() }}</span>
                </div>
              </div>
            </div>

            <!-- Insurance -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Insurance</span>
                <button
                  type="button"
                  (click)="openInsuranceBreakdown()"
                  class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-accent"
                >
                  <app-icon name="settings" [size]="12" />
                  Insurance Breakdown
                </button>
              </div>

              <div class="flex flex-col gap-2">
                <label for="ncdSelect" class="text-xs font-medium text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    <app-icon name="percent" [size]="12" />
                    NCD
                  </span>
                </label>
                <select
                  id="ncdSelect"
                  [ngModel]="ncd()"
                  (ngModelChange)="ncd.set(+$event)"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                >
                  @for (opt of ncdOptions; track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
              </div>

              <div class="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                <span>Total Insurance Cost</span>
                <span class="text-sm font-semibold tabular text-foreground">{{ fmt2(insurance()) }}</span>
              </div>
            </div>

            <!-- Loan setup -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loan Setup</span>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Interest Rate</span>
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 opacity-80">
                  <span class="text-sm font-medium tabular">{{ interestRate() }}%</span>
                  <span class="text-xs text-muted-foreground">{{ rateType() === 'flat' ? 'Flat' : 'EIR' }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Downpayment</span>
                <div class="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    [attr.max]="downpaymentType() === 'percent' ? 100 : null"
                    [step]="downpaymentType() === 'percent' ? 1 : 500"
                    [ngModel]="downpaymentValue()"
                    (ngModelChange)="downpaymentValue.set(+$event || 0)"
                    class="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm font-medium tabular outline-none transition-colors focus:border-ring"
                  />
                  <div class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      (click)="downpaymentType.set('percent')"
                      class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                      [ngClass]="downpaymentType() === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                    >
                      %
                    </button>
                    <button
                      type="button"
                      (click)="downpaymentType.set('amount')"
                      class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                      [ngClass]="downpaymentType() === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                    >
                      Amt
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label for="loanAmountInput" class="text-xs font-medium text-muted-foreground">Loan Amount (RM)</label>
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 focus-within:border-ring">
                  <span class="text-sm font-medium text-muted-foreground">RM</span>
                  <input
                    id="loanAmountInput"
                    type="number"
                    min="0"
                    step="100"
                    inputmode="numeric"
                    [ngModel]="loanAmountDisplay()"
                    (ngModelChange)="onLoanAmountInput($event)"
                    (blur)="commitLoanAmount()"
                    (keydown.enter)="commitLoanAmount()"
                    class="w-full bg-transparent text-sm font-medium tabular outline-none"
                  />
                </div>
                <span class="text-[11px] text-muted-foreground">Rounds down to the nearest RM100 once you finish typing — any remainder goes to the downpayment.</span>
              </div>
            </div>

            <!-- Tenure -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tenure</span>
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium text-muted-foreground">Tenure Selection</span>
                  <span class="text-xs font-semibold tabular text-foreground">{{ tenureYears() }} Yrs</span>
                </div>
                <div role="radiogroup" aria-label="Tenure (years)" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
                  @for (y of tenureYearOptions; track y) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="tenureYears() === y"
                      (click)="selectTenureYear(y)"
                      class="flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition-colors"
                      [ngClass]="tenureYears() === y ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ y }}
                    </button>
                  }
                </div>
                <span class="text-[11px] text-muted-foreground">Pick one tenure — this is what your monthly payment above is based on.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      @if (insuranceBreakdownOpen()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeInsuranceBreakdown()"></button>
          <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <div class="flex items-center gap-3 border-b border-border p-4">
              <div class="flex flex-col">
                <span class="text-sm font-semibold">Insurance Breakdown</span>
                <span class="text-[11px] text-muted-foreground">{{ selectedVehicle().brand }} {{ modelVariantLabel(selectedVehicle().model, selectedVehicle().variant) }}</span>
              </div>
              <button type="button" (click)="closeInsuranceBreakdown()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                <app-icon name="x" [size]="16" />
              </button>
            </div>
            <div class="flex flex-col gap-3 overflow-y-auto p-4">
              <p class="text-[11px] text-muted-foreground">View only — set by your advisor.</p>
              <div class="overflow-hidden rounded-lg border border-border text-xs">
                <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
                  <span>Premium Pricing</span>
                  <span>RM</span>
                </div>
                <div class="flex flex-col divide-y divide-border/60">
                  <div class="flex items-center justify-between px-3 py-1.5">
                    <span class="text-muted-foreground">Basic Premium</span>
                    <span class="tabular">{{ insuranceBreakdown().basicPremium.toFixed(2) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-1.5">
                    <span class="text-muted-foreground">Premium All Rider</span>
                    <span class="tabular">{{ insuranceBreakdown().premiumAllRider.toFixed(2) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-1.5">
                    <span class="text-muted-foreground">&minus;NCD ({{ insuranceBreakdown().ncdPct }}%)</span>
                    <span class="tabular">{{ insuranceBreakdown().ncdAmount.toFixed(2) }}</span>
                  </div>
                </div>
                @if (insuranceDetails().additionalCoverages.length > 0) {
                  <div class="bg-muted/40 px-3 py-1.5 font-semibold">+Additional Coverages</div>
                  <div class="flex flex-col divide-y divide-border/60">
                    @for (item of insuranceDetails().additionalCoverages; track $index) {
                      <div class="flex items-center justify-between px-3 py-1.5">
                        <span class="text-muted-foreground">{{ item.label || 'Untitled coverage' }}</span>
                        <span class="tabular">{{ item.amount.toFixed(2) }}</span>
                      </div>
                    }
                  </div>
                }
                <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
                  <span>Gross Premium</span>
                  <span class="tabular">{{ insuranceBreakdown().grossPremium.toFixed(2) }}</span>
                </div>
                <div class="flex flex-col divide-y divide-border/60">
                  <div class="flex items-center justify-between px-3 py-1.5">
                    <span class="text-muted-foreground">+Stamp Duty</span>
                    <span class="tabular">{{ insuranceBreakdown().stampDuty.toFixed(2) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-1.5">
                    <span class="text-muted-foreground">+Service Tax ({{ insuranceBreakdown().serviceTaxPct }}%)</span>
                    <span class="tabular">{{ insuranceBreakdown().serviceTaxAmount.toFixed(2) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-1.5">
                    <span class="text-muted-foreground">+EPR</span>
                    <span class="tabular">{{ insuranceBreakdown().epr.toFixed(2) }}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between bg-primary/10 px-3 py-2">
                  <span class="font-semibold text-primary">Total Due <span class="font-normal text-muted-foreground">(Rounded: {{ fmt(insuranceBreakdown().totalRounded) }})</span></span>
                  <span class="font-bold tabular text-primary">{{ insuranceBreakdown().totalDue.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class PublicQuoteComponent implements OnInit {
  @ViewChild('posterCanvas') posterCanvasRef?: ElementRef<HTMLCanvasElement>;

  private route = inject(ActivatedRoute);

  loading = signal(true);
  notFound = signal(false);
  bundle = signal<PublicQuoteBundle | null>(null);
  private token = '';
  /** True on the `/quote/:token/brand` route — same page and same data, just with the Brand
   *  select hidden and never switched away from the SA's Default Brand, for a link the SA wants
   *  to hand out for one specific brand only. */
  singleBrandMode = this.route.snapshot.data['singleBrand'] === true;
  mobileTab = signal<'preview' | 'customize'>('preview');

  fmt = (v: number) => formatRM(v);
  fmt2 = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  modelVariantLabel = modelVariantLabel;
  ncdOptions = NCD_OPTIONS;

  advisorInitials = computed(() =>
    (this.bundle()?.advisor.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join(''),
  );

  /** This link's own catalog copy — cloned from the pristine defaults and patched with this
   *  account's saved overrides, never the app-wide mutable VEHICLES singleton (which belongs to
   *  whichever account is actually logged in, if any, in this same browser tab). */
  vehicles = signal<Vehicle[]>([]);
  brands = computed(() => Array.from(new Set(this.vehicles().map((v) => v.brand))));

  selectedBrand = signal('');
  selectedModelName = signal('');
  selectedVariant = signal('');
  modelYear = signal(0);
  ncd = signal(0);
  downpaymentType = signal<DownpaymentType>('percent');
  downpaymentValue = signal(0);

  /** Single-select tenure, unlike the Calculator's "pick 3 for a comparison table" poster picker —
   *  a customer builds one quote at a time, not a side-by-side comparison. */
  tenureYearOptions = TENURE_YEAR_OPTIONS;
  tenureYears = signal(9);
  tenureMonths = computed(() => this.tenureYears() * 12);
  selectTenureYear(year: number) {
    this.tenureYears.set(year);
  }

  modelsForBrand = computed(() => Array.from(new Set(this.vehicles().filter((v) => v.brand === this.selectedBrand()).map((v) => v.model))));

  carGroups = computed(() => {
    const brand = this.selectedBrand();
    return this.modelsForBrand().map((model) => ({
      model,
      items: Array.from(new Set(this.vehicles().filter((v) => v.brand === brand && v.model === model).map((v) => v.variant))).map((variant) => ({
        variant,
        label: modelVariantLabel(model, variant),
      })),
    }));
  });
  carDropdownOpen = false;

  toggleCarDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.carDropdownOpen = !this.carDropdownOpen;
  }

  selectModelVariant(model: string, variant: string) {
    this.selectedModelName.set(model);
    this.onVariantChange(variant);
    this.carDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target)) this.carDropdownOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.carDropdownOpen = false;
  }

  availableYears = computed(() => yearsForVariant2(this.vehicles(), this.selectedBrand(), this.selectedModelName(), this.selectedVariant()));

  selectedVehicle = computed(
    () =>
      this.vehicles().find((v) => v.brand === this.selectedBrand() && v.model === this.selectedModelName() && v.variant === this.selectedVariant()) ??
      this.vehicles()[0] ??
      DEFAULT_VEHICLES[0],
  );
  basePrice = computed(() => this.selectedVehicle().price);

  onBrandChange(brand: string) {
    this.selectedBrand.set(brand);
    const firstModel = this.vehicles().find((v) => v.brand === brand)!.model;
    this.onModelChange(firstModel);
  }

  onModelChange(model: string) {
    this.selectedModelName.set(model);
    const firstVariant = this.vehicles().find((v) => v.brand === this.selectedBrand() && v.model === model)!.variant;
    this.onVariantChange(firstVariant);
  }

  onVariantChange(variant: string) {
    this.selectedVariant.set(variant);
    const years = yearsForVariant2(this.vehicles(), this.selectedBrand(), this.selectedModelName(), variant);
    if (!years.includes(this.modelYear())) this.modelYear.set(years[0]);
    this.loanAmountDraft.set(null);
  }

  // Read-only on the public link — the SA controls this figure from the Car Database, a customer
  // never gets a manual override here (unlike the Calculator's own Rebate input).
  rebateInput = computed(() => rebateForYear(this.selectedVehicle(), this.modelYear()));

  // Additional Rebate never applies on the public link either — that's a negotiable extra only
  // the SA grants manually, so effectiveRebate here is just the (read-only) base Rebate.
  effectiveRebate = computed(() => this.rebateInput());

  /** Rate Type and the rate value are both locked to the SA's own default — never a manual input
   *  here, so a customer can't type in an unrealistically low rate for themselves. Mirrors the
   *  Calculator's own auto-rate lookup (vehicle's own promo rate for this type, else the SA's
   *  sales default), just with no override path. */
  rateType = computed(() => this.bundle()?.salesDefaults.defaultRateType ?? 'flat');
  interestRate = computed(() => {
    const vehicle = this.selectedVehicle();
    const fallback = this.bundle()?.salesDefaults.interestRate ?? 3.5;
    return this.rateType() === 'effective' ? (vehicle.effectiveRate ?? fallback) : (vehicle.interestRate ?? fallback);
  });

  insuranceRatePct = computed(() => this.bundle()?.salesDefaults.basicPremiumRatePct ?? 3.6);
  autoBasicPremium = computed(() => this.selectedVehicle().basicPremium ?? basicPremiumDefault(this.basePrice(), this.insuranceRatePct()));
  /** The car's saved itemized insurance quotation from the SA's own Car Database — read-only here,
   *  unlike the Calculator's own Insurance Breakdown, so there's no per-quote override layer on
   *  top of it. */
  insuranceDetails = computed((): InsuranceQuotationDetails => {
    const vehicle = this.selectedVehicle();
    const saved = this.bundle()?.vehicleInsurance[vehicle.id];
    if (!saved) return defaultInsuranceQuotation(vehicle, this.autoBasicPremium());
    return { ...saved, epr: saved.epr ?? DEFAULT_EPR };
  });
  insuranceBreakdown = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), this.ncd()));
  insurance = computed(() => this.insuranceBreakdown().totalDue);

  insuranceBreakdownOpen = signal(false);
  openInsuranceBreakdown() {
    this.insuranceBreakdownOpen.set(true);
  }
  closeInsuranceBreakdown() {
    this.insuranceBreakdownOpen.set(false);
  }

  totals = computed(() =>
    computeQuotationTotals({
      basePrice: this.basePrice(),
      effectiveRebate: this.effectiveRebate(),
      insuranceAmount: this.insurance(),
      downpaymentType: this.downpaymentType(),
      downpaymentValue: this.downpaymentValue(),
    }),
  );
  allInPrice = computed(() => this.totals().totalAmountDue);
  downpaymentCash = computed(() => this.totals().downpaymentCash);
  loanAmount = computed(() => this.totals().loanAmount);
  monthlyInstalment = computed(() => monthlyPayment(this.loanAmount(), this.interestRate(), this.tenureMonths(), this.rateType()));

  // Same draft/commit pattern as the Calculator's own Loan Amount field: loanAmount() is always
  // floored to the nearest RM100, so binding the input straight to it would snap a mid-typed value
  // back before the customer finishes — a draft signal holds the raw typed number until blur/Enter.
  private loanAmountDraft = signal<number | null>(null);
  loanAmountDisplay = computed(() => this.loanAmountDraft() ?? this.loanAmount());

  onLoanAmountInput(value: number) {
    this.loanAmountDraft.set(Math.max(0, +value || 0));
  }

  commitLoanAmount() {
    const draft = this.loanAmountDraft();
    if (draft !== null) {
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - draft)));
    }
    this.loanAmountDraft.set(null);
  }

  brandLogoUrl = computed(() => brandLogo(this.selectedVehicle().brand));
  quoteDate = computed(() => new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }));

  private fontsReady = signal(false);
  private drawGeneration = 0;
  private static readonly PREVIEW_SCALE = 2;

  constructor(private host: ElementRef) {
    // Redraws whenever anything the poster depends on changes — including `bundle`/`vehicles`
    // flipping from empty to populated once ngOnInit's fetch resolves. Unlike the Calculator (whose
    // canvas is always in the DOM), this page's canvas sits behind an `@if(loading())`/`@else`
    // branch that only exists once loading finishes — the very same signal writes that populate
    // `bundle`/`vehicles` also flip `loading`, so this effect can fire before Angular has finished
    // patching in the `@else` branch's canvas element. Deferring the actual draw to the next
    // animation frame guarantees change detection has already run by then.
    effect(() => {
      if (!this.fontsReady() || !this.bundle() || this.vehicles().length === 0) return;
      const data = this.buildPosterData();
      requestAnimationFrame(() => this.drawPoster(data));
    });
  }

  async ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    await posterFontsReady();
    this.fontsReady.set(true);
    if (!this.token) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    try {
      const bundle = await fetchPublicQuote(this.token);
      this.bundle.set(bundle);
      const vehicles = DEFAULT_VEHICLES.map((v) => ({ ...v, years: v.years.map((y) => ({ ...y })) }));
      for (const v of vehicles) {
        const override = bundle.vehicleOverrides[v.id] as VehicleOverride | undefined;
        if (override) Object.assign(v, override);
      }
      this.vehicles.set(vehicles);
      // Same as the Calculator's own preferredVehicle() — starts on the SA's Default Brand
      // (Account Settings → Dashboard) when that brand actually has a car in this catalog,
      // falling back to the catalog's first car otherwise.
      const preferred = vehicles.find((v) => v.brand === bundle.defaultBrand) ?? vehicles[0];
      this.selectedBrand.set(preferred.brand);
      this.selectedModelName.set(preferred.model);
      this.selectedVariant.set(preferred.variant);
      this.modelYear.set(Math.max(...preferred.years.map((y) => y.year)));
      this.ncd.set(bundle.salesDefaults.ncd);
      this.downpaymentValue.set(bundle.salesDefaults.downpaymentPct);
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private buildPosterData(): PosterData {
    const vehicle = this.selectedVehicle();
    const advisor = this.bundle()!.advisor;
    const monthly = this.monthlyInstalment();
    return {
      brand: vehicle.brand,
      modelTitle: modelVariantLabel(vehicle.model, vehicle.variant),
      year: this.modelYear(),
      dateStr: this.quoteDate(),
      logoUrl: this.brandLogoUrl(),
      carImageUrl: vehicle.photoUrl ?? null,
      sellingPrice: this.allInPrice(),
      downpayment: this.downpaymentCash(),
      loanAmount: this.loanAmount(),
      advisor: {
        name: advisor.name,
        role: advisor.role,
        initials: this.advisorInitials(),
        photoUrl: advisor.photoUrl ?? null,
        phoneDisplay: advisor.phoneDisplay,
      },
      otrPrice: this.basePrice(),
      ncdPct: this.ncd(),
      insurance: this.insurance(),
      rebate: this.effectiveRebate(),
      totalAmountDue: this.allInPrice(),
      rateLabel: `${this.interestRate()}% ${this.rateType() === 'flat' ? 'FLAT' : 'EIR'}`,
      interestRatePct: this.interestRate(),
      tenureRows: [{ label: `${this.tenureYears()} Yrs`, months: this.tenureMonths(), monthly, isLowest: true }],
    };
  }

  private async drawPoster(data: PosterData) {
    const canvas = this.posterCanvasRef?.nativeElement;
    if (!canvas) return;
    const generation = ++this.drawGeneration;
    await classicTemplate.render(canvas, data, PublicQuoteComponent.PREVIEW_SCALE, () => generation !== this.drawGeneration);
  }

  /** No name/phone form at all — the customer's own WhatsApp number reaches the SA automatically
   *  once they send the message, so there's nothing to separately capture. Everything they
   *  configured goes along as plain text instead of being posted anywhere. */
  openWhatsAppToAdvisor() {
    const vehicle = this.selectedVehicle();
    const lines = [
      `Hi ${this.bundle()!.advisor.name}, I'm interested in the ${vehicle.brand} ${modelVariantLabel(vehicle.model, vehicle.variant)} (${this.modelYear()}).`,
      '',
      "Here's the quote I put together:",
      `- Downpayment: ${this.fmt2(this.downpaymentCash())}`,
      `- Loan Amount: ${this.fmt2(this.loanAmount())}`,
      `- Rebate: ${this.fmt(this.rebateInput())}`,
      `- Insurance (${this.ncd()}% NCD): ${this.fmt2(this.insurance())}`,
      `- Tenure: ${this.tenureYears()} Years`,
      '',
      'Please get in touch with me!',
    ];
    const phone = this.bundle()!.advisor.phoneWa.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  /** Resets every quote setting (NCD, downpayment, tenure) back to this link's own starting
   *  defaults — leaves the selected car untouched, same as the Calculator's own Reset. Rebate,
   *  rate, and insurance are never manual here, so there's nothing to reset for those. */
  reset() {
    const bundle = this.bundle();
    if (!bundle) return;
    this.ncd.set(bundle.salesDefaults.ncd);
    this.downpaymentType.set('percent');
    this.downpaymentValue.set(bundle.salesDefaults.downpaymentPct);
    this.tenureYears.set(9);
    this.loanAmountDraft.set(null);
  }
}

/** Same lookup as yearsForVariant() in calculator-data.ts, but against this page's own local
 *  catalog copy (see `vehicles` above) instead of the app-wide VEHICLES singleton. */
function yearsForVariant2(vehicles: Vehicle[], brand: string, model: string, variant: string): number[] {
  return (
    vehicles
      .find((v) => v.brand === brand && v.model === model && v.variant === variant)
      ?.years.map((y) => y.year)
      .sort((a, b) => b - a) ?? []
  );
}
