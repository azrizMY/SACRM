import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { InsuranceQuotationEditorComponent } from '../shared/insurance-quotation-editor.component';
import { brandStyle } from '../data/dashboard-data';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { FINANCING_TYPE_OPTIONS, SOURCE_TYPES, TO_BE_CONFIRMED_COLOUR, type FinancingType } from '../data/customer-data';
import { todayStr } from '../shared/date-utils';
import {
  NCD_OPTIONS,
  DEFAULT_REBATE,
  TENURE_OPTIONS,
  VEHICLES,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  eirApprox,
  formatRM,
  modelVariantLabel,
  monthlyFlat,
  roundCents,
  variantLabel,
  yearsForVariant,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type Vehicle,
} from '../data/calculator-data';
import { buildQuotationPdfBytes, downloadBlob } from '../shared/pdf-writer';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, InsuranceQuotationEditorComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <!-- Mobile Preview/Customize switcher -->
      <div class="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-col gap-2 bg-background px-4 pb-2 pt-4 md:-top-6 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 xl:hidden">
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
          class="flex-col gap-2 xl:sticky xl:top-4 xl:col-span-2 xl:flex"
          [ngClass]="mobileTab() === 'preview' ? 'flex' : 'hidden'"
        >
          <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-md">
            <!-- Letterhead -->
            <div class="relative overflow-hidden p-4" [style.background]="tileGradient()">
              <div class="pointer-events-none absolute inset-0 bg-black/10"></div>
              <div class="relative flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  @if (brandLogo(); as logo) {
                    <img [src]="logo" [alt]="selectedVehicle().brand" class="size-11 shrink-0 rounded-lg object-cover" />
                  }
                  <div class="flex flex-col gap-1">
                    @if (!brandLogo()) {
                      <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">{{ selectedVehicle().brand }}</span>
                    }
                    <h2 class="text-balance text-xl font-bold leading-tight tracking-tight text-white">
                      {{ modelVariantLabel(selectedVehicle().model, selectedVehicle().variant) }}
                    </h2>
                    <span class="text-[13px] font-medium text-white/75 tabular">{{ modelYear() }} Model</span>
                  </div>
                </div>

                <div class="flex flex-col items-end gap-1 text-right">
                  <span class="text-[10px] font-medium text-white/60">{{ quoteDate() }}</span>
                  <div class="flex items-center gap-2">
                    <div class="flex flex-col items-end leading-tight">
                      <span class="text-xs font-semibold text-white">{{ advisor.profile().name }}</span>
                      <span class="text-[11px] text-white/70">{{ advisor.profile().role }} &middot; {{ advisor.profile().phoneDisplay }}</span>
                    </div>
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white ring-1 ring-inset ring-white/25">{{ advisor.initials() }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3 p-4">
              <!-- Hero price -->
              <div class="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
                <div class="flex items-center gap-3">
                  <span
                    class="flex size-11 shrink-0 items-center justify-center rounded-xl border"
                    [style.background]="'color-mix(in oklch, ' + brandAccent() + ', transparent 85%)'"
                    [style.color]="brandAccent()"
                    [style.borderColor]="'color-mix(in oklch, ' + brandAccent() + ', transparent 70%)'"
                  >
                    <app-icon name="sparkles" [size]="20" />
                  </span>
                  <div class="flex flex-col">
                    <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selling Price</span>
                    <span class="text-2xl font-bold tabular tracking-tight sm:text-[1.75rem]">{{ fmt2(allInPrice()) }}</span>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2.5">
                  <div class="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2">
                    <span class="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <app-icon name="wallet" [size]="11" />
                      Downpayment
                    </span>
                    <span class="text-base font-semibold tabular">{{ fmt2(downpaymentCash()) }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2">
                    <span class="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <app-icon name="gauge" [size]="11" />
                      Loan Amount
                    </span>
                    <span class="text-base font-semibold tabular">{{ fmt2(loanAmount()) }}</span>
                  </div>
                </div>
              </div>

              <!-- Price breakdown -->
              <div class="overflow-hidden rounded-lg border border-border">
                <table class="w-full border-collapse text-sm">
                  <thead>
                    <tr class="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th class="px-3 py-2.5 font-semibold">Price Breakdown</th>
                      <th class="px-3 py-2.5 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    <tr>
                      <td class="px-3 py-2.5 text-muted-foreground">OTR Price <span class="text-[10px]">(without insurance)</span></td>
                      <td class="px-3 py-2.5 text-right font-medium tabular">{{ fmt2(basePrice()) }}</td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 text-muted-foreground">Insurance <span class="text-[10px]">({{ ncd() }}% NCD)</span></td>
                      <td class="px-3 py-2.5 text-right font-medium tabular">+ {{ fmt2(insurance()) }}</td>
                    </tr>
                    <tr>
                      <td class="px-3 py-2.5 text-muted-foreground">Rebate</td>
                      <td class="px-3 py-2.5 text-right font-medium tabular text-[var(--success)]">&minus; {{ fmt2(effectiveRebate()) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="border-t border-border bg-primary/5">
                      <td class="px-3 py-3 text-sm font-semibold">Total Amount Due</td>
                      <td class="px-3 py-3 text-right text-sm font-bold tabular text-primary">{{ fmt2(allInPrice()) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Offers -->
              @if (offers().length > 0) {
                <div class="overflow-hidden rounded-lg border border-border">
                  <div class="border-b border-border bg-muted/40 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What&rsquo;s Included</div>
                  <div class="flex flex-wrap gap-x-4 gap-y-1.5 p-3">
                    @for (o of offers(); track o) {
                      <span class="flex items-center gap-1.5 text-xs">
                        <app-icon name="check" [size]="12" class="shrink-0 text-[var(--success)]" />
                        {{ o }}
                      </span>
                    }
                  </div>
                </div>
              }

              <!-- Repayment table -->
              <div class="overflow-hidden rounded-lg border border-border">
                <div class="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Monthly Estimate</span>
                  <span class="font-semibold normal-case tracking-normal text-foreground">
                    {{ interestRate() }}% fixed <span class="text-muted-foreground/70">&middot; ~{{ eir().toFixed(2) }}% EIR</span>
                  </span>
                </div>
                <table class="w-full border-collapse text-sm">
                  <thead>
                    <tr class="border-b border-border text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <th class="px-3 py-2 font-medium">Tenure</th>
                      <th class="px-3 py-2 text-right font-medium">Monthly Payment</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border/60">
                    @for (row of repaymentRows(); track row.months) {
                      <tr [ngClass]="row.months === highlightedTenure() ? 'bg-primary/8' : ''">
                        <td class="px-3 py-2.5 font-medium">
                          <span class="flex items-center gap-2">
                            {{ row.label }}
                            @if (row.months === highlightedTenure()) {
                              <span class="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Selected</span>
                            }
                          </span>
                        </td>
                        <td class="px-3 py-2.5 text-right font-semibold tabular">{{ fmt2(row.monthly) }}/mo</td>
                      </tr>
                    }
                    @if (isCustomTenure()) {
                      <tr class="bg-primary/8">
                        <td class="px-3 py-2.5 font-medium">
                          <span class="flex items-center gap-2">
                            Custom &middot; {{ selectedTenureLabel() }}
                            <span class="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Selected</span>
                          </span>
                        </td>
                        <td class="px-3 py-2.5 text-right font-semibold tabular">{{ fmt2(selectedTenureMonthly()) }}/mo</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p class="flex items-center justify-center gap-1.5 text-center text-[10px] leading-relaxed text-muted-foreground">
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
              <button
                type="button"
                (click)="openLeadModal()"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
              >
                <app-icon name="plus" [size]="13" />
                Add Lead
              </button>
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

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="flex flex-col gap-2">
                <label for="brandSelect" class="text-xs font-medium text-muted-foreground">Brand</label>
                <select
                  id="brandSelect"
                  [ngModel]="selectedBrand()"
                  (ngModelChange)="onBrandChange($event)"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                >
                  @for (b of brands; track b) {
                    <option [value]="b">{{ b }}</option>
                  }
                </select>
              </div>

              <div class="flex flex-col gap-2">
                <label for="modelSelect" class="text-xs font-medium text-muted-foreground">Model</label>
                <select
                  id="modelSelect"
                  [ngModel]="selectedModelName()"
                  (ngModelChange)="onModelChange($event)"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                >
                  @for (m of modelsForBrand(); track m) {
                    <option [value]="m">{{ m }}</option>
                  }
                </select>
              </div>

              <div class="flex flex-col gap-2">
                <label for="variantSelect" class="text-xs font-medium text-muted-foreground">Variant</label>
                <select
                  id="variantSelect"
                  [ngModel]="selectedVariant()"
                  (ngModelChange)="onVariantChange($event)"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                >
                  @for (v of variantsForModel(); track v) {
                    <option [value]="v">{{ variantLabel(v) || '-' }}</option>
                  }
                </select>
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
                <span class="text-[11px] text-muted-foreground">This car is in the database under both years — each has its own price and rebate.</span>
              </div>
            } @else {
              <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <app-icon name="calendar" [size]="12" />
                Only listed for {{ modelYear() }} in the Car Database.
              </span>
            }
          </div>

          <!-- Price setup -->
          <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price Setup</span>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label for="rebateInput" class="text-xs font-medium text-muted-foreground">Rebate (RM)</label>
                <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" [ngClass]="rebateIsManual() ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-muted text-muted-foreground'">
                  {{ rebateIsManual() ? 'Manual' : 'Default' }}
                </span>
              </div>
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 focus-within:border-ring">
                <span class="text-sm font-medium text-muted-foreground">RM</span>
                <input
                  id="rebateInput"
                  type="number"
                  min="0"
                  step="500"
                  inputmode="numeric"
                  [ngModel]="rebateInput()"
                  (ngModelChange)="onRebateChange($event)"
                  class="w-full bg-transparent text-sm font-medium tabular outline-none"
                />
              </div>
              <button
                type="button"
                (click)="resetRebate()"
                [disabled]="!rebateIsManual()"
                class="w-fit rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
              >
                Reset to default
              </button>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label for="additionalRebateInput" class="text-xs font-medium text-muted-foreground">Additional Rebate (RM)</label>
                <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" [ngClass]="additionalRebateIsManual() ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-muted text-muted-foreground'">
                  {{ additionalRebateIsManual() ? 'Manual' : 'Default' }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  [ngModel]="additionalRebateEnabled()"
                  (ngModelChange)="onAdditionalRebateEnabledChange($event)"
                  aria-label="Include additional rebate"
                  class="size-4 shrink-0 rounded border-input accent-primary"
                />
                <div
                  class="flex flex-1 items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 focus-within:border-ring"
                  [class.opacity-50]="!additionalRebateEnabled()"
                >
                  <span class="text-sm font-medium text-muted-foreground">RM</span>
                  <input
                    id="additionalRebateInput"
                    type="number"
                    min="0"
                    step="500"
                    inputmode="numeric"
                    [disabled]="!additionalRebateEnabled()"
                    [ngModel]="additionalRebateValue()"
                    (ngModelChange)="onAdditionalRebateChange($event)"
                    class="w-full bg-transparent text-sm font-medium tabular outline-none disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <button
                type="button"
                (click)="resetAdditionalRebate()"
                [disabled]="!additionalRebateIsManual()"
                class="w-fit rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
              >
                Reset to default
              </button>
            </div>
          </div>

          <!-- Insurance -->
          <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Insurance</span>
                <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" [ngClass]="insuranceIsManual() ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-muted text-muted-foreground'">
                  {{ insuranceIsManual() ? 'Manual' : 'Default' }}
                </span>
              </div>
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
              <div class="flex items-center justify-between">
                <label for="interestRateInput" class="text-xs font-medium text-muted-foreground">Fixed Interest Rate (%)</label>
                <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" [ngClass]="interestRateIsManual() ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-muted text-muted-foreground'">
                  {{ interestRateIsManual() ? 'Manual' : 'Default' }}
                </span>
              </div>
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 focus-within:border-ring">
                <input
                  id="interestRateInput"
                  type="number"
                  min="0"
                  step="0.1"
                  [ngModel]="interestRate()"
                  (ngModelChange)="onInterestRateChange($event)"
                  class="w-full bg-transparent text-sm font-medium tabular outline-none"
                />
                <span class="text-sm font-medium text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                (click)="resetInterestRate()"
                [disabled]="!interestRateIsManual()"
                class="w-fit rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
              >
                Reset to default
              </button>
            </div>

            <div class="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
              <span>EIR equivalent (based on selected tenure)</span>
              <span class="text-sm font-semibold tabular text-foreground">~{{ eir().toFixed(2) }}%</span>
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
              <span class="text-[11px] text-muted-foreground">
                @if (downpaymentType() === 'percent') {
                  Rebate is applied to reduce the cash downpayment needed.
                } @else {
                  Rebate reduces the car price separately, not counted as cash deposit.
                }
              </span>
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
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotation Summary</span>

            <div class="flex flex-col gap-2">
              <span class="text-xs font-medium text-muted-foreground">Tenure Selection</span>
              <div role="radiogroup" aria-label="Tenure selection" class="grid grid-cols-4 gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
                @for (t of tenureOptions; track t.months) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="t.months === highlightedTenure()"
                    (click)="highlightedTenure.set(t.months)"
                    class="rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors"
                    [ngClass]="t.months === highlightedTenure() ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    {{ t.label }}
                  </button>
                }
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label for="customTenureMonthsInput" class="text-xs font-medium text-muted-foreground">Custom Tenure (Months)</label>
              <input
                id="customTenureMonthsInput"
                type="number"
                min="1"
                max="120"
                step="1"
                [ngModel]="highlightedTenure()"
                (ngModelChange)="highlightedTenure.set(+$event || 1)"
                class="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm font-medium tabular outline-none transition-colors focus:border-ring"
              />
              <span class="text-[11px] text-muted-foreground">Type any month count to use as the chosen tenure — this is what the quotation and PDF use.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Lead modal -->
    @if (leadModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeLeadModal()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Add Lead</span>
            <button type="button" (click)="closeLeadModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 p-4">
            <p class="text-[11px] text-muted-foreground">
              {{ selectedVehicle().brand }} {{ selectedVehicle().model }} &middot; {{ fmt(downpaymentCash()) }} downpayment &middot; {{ ncd() }}% NCD
            </p>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Name
              <input type="text" [(ngModel)]="leadName" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Phone No
              <input type="tel" [(ngModel)]="leadPhone" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Source Type
              <select [(ngModel)]="leadSource" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (s of sourceTypes; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Financing Type
              <select [(ngModel)]="leadFinancingType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
              </select>
            </label>
            <p class="text-[11px] text-muted-foreground">
              Save the lead, download a quotation PDF, or message this customer on WhatsApp — do any or all of them, in any order.
            </p>
            @if (leadSaved()) {
              <span class="flex items-center gap-1.5 text-[11px] font-medium text-[var(--success)]">
                <app-icon name="check" [size]="12" />
                Lead saved
              </span>
            }
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeLeadModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Close</button>
            <button
              type="button"
              (click)="submitLead()"
              [disabled]="!leadName || !leadPhone"
              class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon name="plus" [size]="13" />
              Save Lead
            </button>
            <button
              type="button"
              (click)="generateQuotation()"
              [disabled]="!leadName || !leadPhone"
              class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon name="download" [size]="13" />
              Generate Quotation
            </button>
            <button
              type="button"
              (click)="openWhatsAppForLead()"
              [disabled]="!leadName || !leadPhone"
              class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <app-icon name="message-circle" [size]="13" />
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Insurance Breakdown modal -->
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
          <div class="overflow-y-auto p-4">
            <app-insurance-quotation-editor
              [vehicle]="selectedVehicle()"
              [ncdPct]="ncd()"
              [fallbackBasicPremium]="autoBasicPremium()"
              mode="quote"
              [initialDetails]="insuranceDetails()"
              (saved)="onInsuranceSaved($event)"
            />
          </div>
        </div>
      </div>
    }
  `,
})
export class CalculatorComponent {
  ncdOptions = NCD_OPTIONS;
  tenureOptions = TENURE_OPTIONS;
  fmt = (v: number) => formatRM(v);
  /** Always shows exactly 2 decimals (even .00) plus thousands separators, matching the Total Due
   *  line in Insurance Breakdown — formatRM's toLocaleString would otherwise drop cents on whole
   *  numbers and show up to 3 fraction digits on others. Used throughout the Quote Preview. */
  fmt2 = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;

  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));

  private settingsService = inject(SettingsService);

  selectedBrand = signal(this.preferredVehicle().brand);
  selectedModelName = signal(this.preferredVehicle().model);
  selectedVariant = signal(this.preferredVehicle().variant);
  mobileTab = signal<'preview' | 'customize'>('preview');
  /** Read from the preferred car's own database row, never assumed — a car listed only under
   *  2025 starts on 2025, not "the current year." */
  modelYear = signal(this.preferredVehicle().year);
  private rebateManual = signal<number | null>(null);
  private additionalRebateManual = signal<number | null>(null);
  private additionalRebateEnabledManual = signal<boolean | null>(null);
  ncd = signal(this.settingsService.settings().salesDefaults.ncd);
  private interestRateManual = signal<number | null>(null);
  downpaymentType = signal<DownpaymentType>('percent');
  downpaymentValue = signal(this.settingsService.settings().salesDefaults.downpaymentPct);
  highlightedTenure = signal(TENURE_OPTIONS[0].months);

  /** Per-quotation insurance override — set only via the Insurance Breakdown modal or "Customer
   *  Arranges Own Insurance". Never written to the Car Finance Database, so one customer declining
   *  or self-arranging coverage never changes what the next customer for this same car sees. */
  private insuranceOverride = signal<InsuranceQuotationDetails | null>(null);

  insuranceBreakdownOpen = signal(false);

  openInsuranceBreakdown() {
    this.insuranceBreakdownOpen.set(true);
  }

  closeInsuranceBreakdown() {
    this.insuranceBreakdownOpen.set(false);
  }

  modelsForBrand = computed(() =>
    Array.from(new Set(VEHICLES.filter((v) => v.brand === this.selectedBrand()).map((v) => v.model))),
  );
  /** Unique variant names — a variant can have several rows, one per model year. */
  variantsForModel = computed(() =>
    Array.from(
      new Set(VEHICLES.filter((v) => v.brand === this.selectedBrand() && v.model === this.selectedModelName()).map((v) => v.variant)),
    ),
  );

  /** Every model year actually in the database for this exact brand/model/variant, newest first —
   *  never assumed, so a lone "2025" row shows only 2025 and a newly added "2027" row shows up on
   *  its own. Drives the Model Year switch: nothing to switch when there's only one. */
  availableYears = computed(() => yearsForVariant(this.selectedBrand(), this.selectedModelName(), this.selectedVariant()));

  private matchingVehicles = computed(() =>
    VEHICLES.filter((v) => v.brand === this.selectedBrand() && v.model === this.selectedModelName() && v.variant === this.selectedVariant()),
  );
  /** The exact year-row in effect — falls back to whatever's available if the selected year doesn't
   *  exist for this variant (e.g. right after switching to a variant with a different year lineup). */
  selectedVehicle = computed(() => {
    const rows = this.matchingVehicles();
    return rows.find((v) => v.year === this.modelYear()) ?? rows[0] ?? VEHICLES[0];
  });
  basePrice = computed(() => this.selectedVehicle().price);

  /** The account's Default Brand (Account Settings → Dashboard) starts every fresh quote — falls
   *  back to the catalog's first car if that brand has no vehicles. */
  private preferredVehicle(): Vehicle {
    const brand = this.settingsService.settings().dashboardTarget.brand;
    return VEHICLES.find((v) => v.brand === brand) ?? VEHICLES[0];
  }

  onBrandChange(brand: string) {
    this.selectedBrand.set(brand);
    const firstModel = VEHICLES.find((v) => v.brand === brand)!.model;
    this.onModelChange(firstModel);
  }

  onModelChange(model: string) {
    this.selectedModelName.set(model);
    const firstVariant = VEHICLES.find((v) => v.brand === this.selectedBrand() && v.model === model)!.variant;
    this.onVariantChange(firstVariant);
  }

  onVariantChange(variant: string) {
    this.selectedVariant.set(variant);
    // Prefer whatever year the SA was already looking at if this variant also has it (e.g.
    // switching between two 2025-and-2026 variants of the same model keeps the chosen year);
    // otherwise fall back to this variant's own newest year.
    const years = yearsForVariant(this.selectedBrand(), this.selectedModelName(), variant);
    if (!years.includes(this.modelYear())) this.modelYear.set(years[0]);
    // A different car has its own real insurance premium and promo rate — carrying over an
    // override from the previous car would silently misprice this one, so switching cars starts
    // fresh from its own database default / promo rate.
    this.insuranceOverride.set(null);
    this.interestRateManual.set(null);
    this.loanAmountDraft.set(null);
  }

  /** The model's own dealer rebate, when known, beats the standard starting rebate. */
  autoRebate = computed(() => this.selectedVehicle().rebate ?? DEFAULT_REBATE);
  rebateIsManual = computed(() => this.rebateManual() !== null);
  rebateInput = computed(() => this.rebateManual() ?? this.autoRebate());

  /** The model's own additional-rebate promo, when known, pre-fills and enables this by default. */
  autoAdditionalRebate = computed(() => this.selectedVehicle().additionalRebate ?? 0);
  additionalRebateIsManual = computed(() => this.additionalRebateManual() !== null);
  additionalRebateValue = computed(() => this.additionalRebateManual() ?? this.autoAdditionalRebate());

  autoAdditionalRebateEnabled = computed(() => (this.selectedVehicle().additionalRebate ?? 0) > 0);
  additionalRebateEnabled = computed(() => this.additionalRebateEnabledManual() ?? this.autoAdditionalRebateEnabled());

  // No separate "prior-year bonus" — switching Model Year switches selectedVehicle() to that
  // year's own database row, so rebateInput() (via autoRebate) already reflects that year's figure.
  effectiveRebate = computed(() => this.rebateInput() + (this.additionalRebateEnabled() ? this.additionalRebateValue() : 0));

  onRebateChange(value: number) {
    this.rebateManual.set(Math.max(0, +value || 0));
  }

  resetRebate() {
    this.rebateManual.set(null);
  }

  onAdditionalRebateEnabledChange(value: boolean) {
    this.additionalRebateEnabledManual.set(value);
  }

  onAdditionalRebateChange(value: number) {
    this.additionalRebateManual.set(Math.max(0, +value || 0));
  }

  resetAdditionalRebate() {
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
  }

  insuranceRatePct = computed(() => this.settingsService.settings().salesDefaults.basicPremiumRatePct);
  /** The insurer's exact Basic Premium for this model, when known, beats the %-of-RRP estimate. */
  autoBasicPremium = computed(() => this.selectedVehicle().basicPremium ?? basicPremiumDefault(this.basePrice(), this.insuranceRatePct()));

  /** The car's saved itemized insurance quotation (Basic Premium, Premium All Rider, Additional
   *  Coverages, Stamp Duty, Service Tax, EPR) from the Car Finance Database — the starting point
   *  for every quote, editable from Account Settings → Car Database. */
  insuranceDatabaseDefault = computed(() => this.settingsService.getVehicleInsurance(this.selectedVehicle(), this.autoBasicPremium()));
  insuranceIsManual = computed(() => this.insuranceOverride() !== null);
  /** The details actually in effect for this quote — the per-quote override when the SA has set
   *  one, otherwise the car's database default. This is what gets snapshotted onto the lead. */
  insuranceDetails = computed(() => this.insuranceOverride() ?? this.insuranceDatabaseDefault());
  insuranceBreakdown = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), this.ncd()));
  /** The full itemized charge — everything the SA sees under Insurance Breakdown, not just Basic Premium. */
  insurance = computed(() => this.insuranceBreakdown().totalDue);

  onInsuranceSaved(details: InsuranceQuotationDetails) {
    this.insuranceOverride.set(details);
    this.closeInsuranceBreakdown();
  }

  /** The model's own promo interest rate, when known, beats the SA's general default. */
  autoInterestRate = computed(() => this.selectedVehicle().interestRate ?? this.settingsService.settings().salesDefaults.interestRate);
  interestRateIsManual = computed(() => this.interestRateManual() !== null);
  interestRate = computed(() => this.interestRateManual() ?? this.autoInterestRate());

  onInterestRateChange(value: number) {
    this.interestRateManual.set(Math.max(0, +value || 0));
  }

  resetInterestRate() {
    this.interestRateManual.set(null);
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

  // The Loan Amount field mustn't fight the SA mid-keystroke: since loanAmount() is always
  // floored to the nearest RM100, binding the input straight to it would snap "82400" back to
  // "82000" (or worse) after every digit typed, before they've finished. A draft signal holds
  // whatever's currently typed, unrounded, and only commits (floors + updates downpayment) on
  // blur/Enter — so the field shows exactly what was typed while editing.
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

  eir = computed(() => eirApprox(this.interestRate(), this.highlightedTenure()));

  repaymentRows = computed(() =>
    TENURE_OPTIONS.map((t) => ({ ...t, monthly: monthlyFlat(this.loanAmount(), this.interestRate(), t.months) })),
  );

  /** The tenure actually chosen (a preset or a custom month count) — what the PDF/quotation quote on, not the full comparison table. */
  isCustomTenure = computed(() => !TENURE_OPTIONS.some((t) => t.months === this.highlightedTenure()));
  selectedTenureLabel = computed(() => TENURE_OPTIONS.find((t) => t.months === this.highlightedTenure())?.label ?? `${this.highlightedTenure()} mo`);
  selectedTenureMonthly = computed(() => monthlyFlat(this.loanAmount(), this.interestRate(), this.highlightedTenure()));

  offers = computed(() => this.settingsService.getVehicleOffers(this.selectedVehicle().id));

  brandAccent = computed(() => brandStyle(this.selectedVehicle().brand).bg);
  brandLogo = computed(() => this.settingsService.getBrandLogo(this.selectedVehicle().brand));

  tileGradient = computed(() => {
    const style = brandStyle(this.selectedVehicle().brand);
    return `radial-gradient(ellipse at 20% 15%, ${style.bg}, transparent 75%), linear-gradient(145deg, ${style.bg}, color-mix(in oklch, ${style.bg}, black 55%))`;
  });

  quoteDate = computed(() => new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }));

  sourceTypes = SOURCE_TYPES;
  financingTypeOptions = FINANCING_TYPE_OPTIONS;
  leadModalOpen = signal(false);
  leadSaved = signal(false);
  leadName = '';
  leadPhone = '';
  leadSource = SOURCE_TYPES[0];
  leadFinancingType: FinancingType = 'Loan';

  constructor(
    private customers: CustomerService,
    public advisor: AdvisorService,
  ) {}

  openLeadModal() {
    this.leadName = '';
    this.leadPhone = '';
    this.leadSource = SOURCE_TYPES[0];
    this.leadFinancingType = 'Loan';
    this.leadSaved.set(false);
    this.leadModalOpen.set(true);
  }

  closeLeadModal() {
    this.leadModalOpen.set(false);
  }

  // Save Lead and Generate Quotation both need the lead persisted, but must not create a
  // duplicate record if the advisor clicks both — this guard makes the save idempotent
  // per modal session instead of tracking a returned record id.
  private async saveLeadRecord() {
    if (this.leadSaved()) return;
    const vehicle = this.selectedVehicle();
    await this.customers.addLead({
      name: this.leadName,
      phone: this.leadPhone,
      brand: vehicle.brand,
      model: vehicle.model,
      variant: vehicle.variant,
      yearMade: this.modelYear(),
      colour: TO_BE_CONFIRMED_COLOUR,
      sourceType: this.leadSource,
      financingType: this.leadFinancingType,
      date: todayStr(),
      quotation: {
        rebate: this.rebateInput(),
        additionalRebateEnabled: this.additionalRebateEnabled(),
        additionalRebateValue: this.additionalRebateValue(),
        ncd: this.ncd(),
        interestRate: this.interestRate(),
        downpaymentType: this.downpaymentType(),
        downpaymentValue: this.downpaymentValue(),
        tenureMonths: this.highlightedTenure(),
        basicPremium: this.insuranceDetails().basicPremium,
        insuranceDetails: this.insuranceDetails(),
      },
    });
    this.leadSaved.set(true);
  }

  async submitLead() {
    await this.saveLeadRecord();
  }

  async generateQuotation() {
    await this.saveLeadRecord();
    const advisor = this.advisor.profile();
    const vehicle = this.selectedVehicle();
    const bytes = buildQuotationPdfBytes({
      brand: vehicle.brand,
      model: vehicle.model,
      variant: vehicle.variant,
      customerName: this.leadName,
      customerPhone: this.leadPhone,
      advisorName: advisor.name,
      advisorRole: advisor.role,
      dateStr: todayStr(),
      basePrice: this.basePrice(),
      effectiveRebate: this.effectiveRebate(),
      ncd: this.ncd(),
      insuranceAmount: this.insurance(),
      allInPrice: this.allInPrice(),
      isCash: this.leadFinancingType === 'Cash',
      downpaymentCash: this.downpaymentCash(),
      loanAmount: this.loanAmount(),
      interestRate: this.interestRate(),
      eir: this.eir(),
      repaymentRows: [{ label: this.selectedTenureLabel(), monthly: this.selectedTenureMonthly() }],
      insuranceBreakdown: this.insuranceBreakdown(),
    });
    downloadBlob(bytes, this.quotationFileName(), 'application/pdf');
  }

  openWhatsAppForLead() {
    const vehicle = this.selectedVehicle();
    const msg =
      `Hi ${this.leadName}, thank you for your interest in the ${vehicle.brand} ${modelVariantLabel(vehicle.model, vehicle.variant)}. ` +
      `Selling price ${this.fmt(this.allInPrice())}, downpayment ${this.fmt(this.downpaymentCash())}. ` +
      `Let me know if you have any questions!`;
    const phone = this.leadPhone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  private quotationFileName(): string {
    const v = this.selectedVehicle();
    const who = this.leadName || 'Customer';
    return `Quotation-${v.brand}-${v.model}-${who}.pdf`.replace(/\s+/g, '-');
  }

  reset() {
    const defaults = this.settingsService.settings().salesDefaults;
    const preferred = this.preferredVehicle();
    this.selectedBrand.set(preferred.brand);
    this.selectedModelName.set(preferred.model);
    this.selectedVariant.set(preferred.variant);
    this.modelYear.set(preferred.year);
    this.rebateManual.set(null);
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
    this.ncd.set(defaults.ncd);
    this.interestRateManual.set(null);
    this.downpaymentType.set('percent');
    this.downpaymentValue.set(defaults.downpaymentPct);
    this.highlightedTenure.set(TENURE_OPTIONS[0].months);
    this.insuranceOverride.set(null);
    this.loanAmountDraft.set(null);
  }
}
