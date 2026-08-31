import { AfterViewInit, Component, computed, effect, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { InsuranceQuotationEditorComponent } from '../shared/insurance-quotation-editor.component';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { FINANCING_TYPE_OPTIONS, SOURCE_TYPES, TO_BE_CONFIRMED_COLOUR, type FinancingType } from '../data/customer-data';
import { todayStr } from '../shared/date-utils';
import {
  NCD_OPTIONS,
  DEFAULT_REBATE,
  VEHICLES,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  formatRM,
  modelVariantLabel,
  monthlyPayment,
  roundCents,
  yearsForVariant,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';
import { buildQuotationPdfBytes, downloadBlob } from '../shared/pdf-writer';
import { posterFontsReady } from '../shared/poster-theme';
import { classicTemplate } from '../shared/poster-template-classic';
import { compactMyTemplate } from '../shared/poster-template-my';
import type { PosterData } from '../shared/poster-data';
import type { PosterTemplate, PosterTemplateId } from '../shared/poster-templates';

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
          class="flex-col gap-2 xl:sticky xl:top-4 xl:col-span-2 xl:flex xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain"
          [ngClass]="mobileTab() === 'preview' ? 'flex' : 'hidden'"
        >
          @if (templates.length > 1) {
            <div role="radiogroup" aria-label="Poster template" class="flex shrink-0 gap-1.5 self-start rounded-xl border border-border bg-muted/40 p-1.5">
              @for (t of templates; track t.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="selectedTemplateId() === t.id"
                  (click)="selectedTemplateId.set(t.id)"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                  [ngClass]="selectedTemplateId() === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  {{ t.label }}
                </button>
              }
            </div>
          }
          <div class="shrink-0 overflow-hidden rounded-xl shadow-md">
            <canvas #posterCanvas class="block w-full h-auto"></canvas>
          </div>

          <button
            type="button"
            (click)="copyPosterImage()"
            [disabled]="copyingPoster()"
            class="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <app-icon [name]="posterCopied() ? 'check' : 'clipboard-check'" [size]="15" />
            {{ copyingPoster() ? 'Copying…' : posterCopied() ? 'Copied!' : 'Copy Image' }}
          </button>

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

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <span class="text-xs font-medium text-muted-foreground">Rate Type</span>
              <div role="radiogroup" aria-label="Rate Type" class="flex gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="rateType() === 'flat'"
                  (click)="setRateType('flat')"
                  class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                  [ngClass]="rateType() === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  Flat
                </button>
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="rateType() === 'effective'"
                  (click)="setRateType('effective')"
                  class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                  [ngClass]="rateType() === 'effective' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  EIR
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label for="interestRateInput" class="text-xs font-medium text-muted-foreground">{{ rateType() === 'flat' ? 'Flat Rate (%)' : 'Effective Rate (%)' }}</label>
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
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-muted-foreground">Tenure Selection</span>
                <span class="text-xs font-semibold tabular text-foreground">{{ posterTenureSummary() }}</span>
              </div>
              <div role="group" aria-label="Repayment table tenures (years)" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
                @for (y of posterYearOptions; track y) {
                  <button
                    type="button"
                    [attr.aria-pressed]="posterTenureYears().includes(y)"
                    (click)="togglePosterYear(y)"
                    class="flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition-colors"
                    [ngClass]="posterTenureYears().includes(y) ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    {{ y }}
                  </button>
                }
              </div>
              <span class="text-[11px] text-muted-foreground">Pick 3 tenures to show in the repayment table above.</span>
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
                (ngModelChange)="onCustomTenureInput($event)"
                class="h-10 w-full rounded-lg border border-input bg-input/30 px-3 text-sm font-medium tabular outline-none transition-colors focus:border-ring"
              />
              <span class="text-[11px] text-muted-foreground">Type any month count to use as the chosen tenure — this replaces the repayment table above with just this one, until you pick a tenure button again.</span>
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
            @if (leadFinancingType !== 'Cash') {
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Tenure
                <select
                  [ngModel]="highlightedTenure()"
                  (ngModelChange)="selectRepaymentTenure($event)"
                  class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                >
                  @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label }} &middot; {{ fmt2(monthlyForTenure(t.months)) }}/mo</option> }
                </select>
              </label>
            }
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
export class CalculatorComponent implements AfterViewInit {
  @ViewChild('posterCanvas') posterCanvasRef?: ElementRef<HTMLCanvasElement>;
  copyingPoster = signal(false);
  /** Brief "Copied!" confirmation on the button after a successful clipboard write. */
  posterCopied = signal(false);
  /** Set once fonts.google.com's Barlow Semi Condensed + Inter are ready to paint — the draw
   *  effect waits on this so the very first frame never falls back to a system font. */
  private fontsReady = signal(false);

  ncdOptions = NCD_OPTIONS;
  fmt = (v: number) => formatRM(v);
  /** Always shows exactly 2 decimals (even .00) plus thousands separators, matching the Total Due
   *  line in Insurance Breakdown — formatRM's toLocaleString would otherwise drop cents on whole
   *  numbers and show up to 3 fraction digits on others. Used throughout the Quote Preview. */
  fmt2 = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  modelVariantLabel = modelVariantLabel;

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
  /** Rate Type — Flat or EIR (declining balance). Picked explicitly by the SA, never derived
   *  from the other: each uses its own instalment formula (see monthlyPayment()). Starts on the
   *  account's Default Rate Type (Account Settings → Quote Defaults). */
  rateType = signal<RateType>(this.settingsService.settings().salesDefaults.defaultRateType);
  downpaymentType = signal<DownpaymentType>('percent');
  downpaymentValue = signal(this.settingsService.settings().salesDefaults.downpaymentPct);
  highlightedTenure = signal(Math.max(...this.settingsService.settings().salesDefaults.defaultTenureYears) * 12);
  /** Which 3 tenure years (of 1-9) populate the on-screen repayment table / quote poster. Picking
   *  a button also sets highlightedTenure to that year and drops out of custom mode; typing a
   *  custom month count does the reverse — see togglePosterYear() / onCustomTenureInput(). Starts
   *  on the account's Default Tenure Selection (Account Settings → Quote Defaults). */
  posterYearOptions = Array.from({ length: 9 }, (_, i) => i + 1);
  /** Full 1-9 year range for the Add Lead modal's Tenure question — wider than the legacy 4-option
   *  TENURE_OPTIONS list, matching every year the poster picker above can actually show. */
  tenureOptions = this.posterYearOptions.map((y) => ({ months: y * 12, label: `${y} Yrs` }));
  posterTenureYears = signal<number[]>([...this.settingsService.settings().salesDefaults.defaultTenureYears]);
  /** True only while the Custom Tenure input is the active source of highlightedTenure — the
   *  repayment table then shows just that one row instead of the 3 poster tenures. */
  customTenureActive = signal(false);

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

  /** Model + Variant combobox, grouped by model: e.g. "Tiggo Cross" heading over its "Turbo" /
   *  "Hybrid" variant rows, or a single self-titled row for a model with no variants (Chery O5). */
  carGroups = computed(() => {
    const brand = this.selectedBrand();
    return this.modelsForBrand().map((model) => ({
      model,
      items: Array.from(new Set(VEHICLES.filter((v) => v.brand === brand && v.model === model).map((v) => v.variant))).map((variant) => ({
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
    if (!this.host.nativeElement.contains(event.target)) {
      this.carDropdownOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.carDropdownOpen = false;
  }

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

  /** The model's own promo rate for whichever Rate Type is active, when known, beats the SA's
   *  general default — flat and effective are independently-quoted figures on the vehicle (see
   *  Vehicle.effectiveRate), so switching rate type looks up the matching field, not a conversion. */
  autoInterestRate = computed(() => {
    const vehicle = this.selectedVehicle();
    const fallback = this.settingsService.settings().salesDefaults.interestRate;
    return this.rateType() === 'effective' ? (vehicle.effectiveRate ?? fallback) : (vehicle.interestRate ?? fallback);
  });
  interestRateIsManual = computed(() => this.interestRateManual() !== null);
  interestRate = computed(() => this.interestRateManual() ?? this.autoInterestRate());

  onInterestRateChange(value: number) {
    this.interestRateManual.set(Math.max(0, +value || 0));
  }

  resetInterestRate() {
    this.interestRateManual.set(null);
  }

  /** Switching Rate Type drops any manual rate override — a flat-mode number typed in has no
   *  business surviving as an effective-mode number, so each type starts back at its own default. */
  setRateType(type: RateType) {
    this.rateType.set(type);
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

  /** Monthly payment for an arbitrary tenure, at the current loan amount/rate — powers the Add
   *  Lead modal's Tenure question, independent of repaymentRows' poster/custom set. */
  monthlyForTenure(months: number): number {
    return monthlyPayment(this.loanAmount(), this.interestRate(), months, this.rateType());
  }

  /** Exclusive with custom mode: while typing a custom tenure, this is just that one row — pick a
   *  tenure button to go back to the 3-tenure comparison (longest-first). */
  repaymentRows = computed(() => {
    if (this.customTenureActive()) {
      const m = this.highlightedTenure();
      return [{ months: m, label: this.selectedTenureLabel(), monthly: monthlyPayment(this.loanAmount(), this.interestRate(), m, this.rateType()) }];
    }
    const months = [...this.posterTenureYears()].sort((a, b) => b - a).map((y) => y * 12);
    return months.map((m) => ({ months: m, label: `${m / 12} Yrs`, monthly: monthlyPayment(this.loanAmount(), this.interestRate(), m, this.rateType()) }));
  });

  /** The tenure actually chosen (a preset or a custom month count) — what the PDF/quotation quote on. */
  selectedTenureLabel = computed(() => (this.highlightedTenure() % 12 === 0 ? `${this.highlightedTenure() / 12} Yrs` : `${this.highlightedTenure()} mo`));
  selectedTenureMonthly = computed(() => monthlyPayment(this.loanAmount(), this.interestRate(), this.highlightedTenure(), this.rateType()));

  posterTenureSummary = computed(() => [...this.posterTenureYears()].sort((a, b) => b - a).join(' · '));

  onCustomTenureInput(value: number) {
    this.highlightedTenure.set(+value || 1);
    this.customTenureActive.set(true);
  }

  /** Confirms which tenure Add Lead/the PDF quote on — click a row in the repayment table. */
  selectRepaymentTenure(months: number) {
    this.highlightedTenure.set(months);
    this.customTenureActive.set(false);
  }

  /** Keeps the poster selection at exactly 3 years: toggles off if already picked (min 1 stays
   *  selected), otherwise adds, replacing the oldest pick once 3 are already chosen. Purely
   *  changes which years are shown — it never confirms a tenure on its own (see
   *  selectRepaymentTenure) — except when the confirmed one just scrolled out of view (or was in
   *  custom mode), where it falls back to the new longest pick so a row is always shown Selected. */
  togglePosterYear(year: number) {
    const current = this.posterTenureYears();
    let next = current;
    if (current.includes(year)) {
      if (current.length > 1) next = current.filter((y) => y !== year);
    } else if (current.length < 3) {
      next = [...current, year];
    } else {
      next = [...current.slice(1), year];
    }
    this.posterTenureYears.set(next);
    if (this.customTenureActive() || !next.includes(this.highlightedTenure() / 12)) {
      this.customTenureActive.set(false);
      this.highlightedTenure.set(Math.max(...next) * 12);
    }
  }

  brandLogo = computed(() => this.settingsService.getBrandLogo(this.selectedVehicle().brand));

  /** Blank checklist items (mid-edit in Price Settings, not yet filled in) never reach the poster
   *  as an empty chip. */
  offers = computed(() => this.settingsService.getVehicleOffers(this.selectedVehicle().id).filter((o) => o.trim().length > 0));

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
    private host: ElementRef,
  ) {
    posterFontsReady().then(() => this.fontsReady.set(true));

    // Redraws the poster canvas whenever the data behind it, or the chosen template, changes.
    effect(() => {
      if (!this.fontsReady()) return;
      this.selectedTemplateId(); // tracked so switching templates alone triggers a redraw
      const data = this.buildPosterData();
      this.drawPoster(data);
    });
  }

  /** Every poster design the Quote Preview can render — all consuming the same PosterData, so
   *  adding one is purely a new layout/renderer pair (see poster-templates.ts), never a change to
   *  how data is gathered above. */
  readonly templates: PosterTemplate[] = [classicTemplate, compactMyTemplate];
  selectedTemplateId = signal<PosterTemplateId>('classic');
  currentTemplate = computed(() => this.templates.find((t) => t.id === this.selectedTemplateId()) ?? this.templates[0]);

  /** Assembles the plain data object the renderer draws from — nothing in poster-renderer.ts
   *  reads a component signal directly, so every figure on the poster traces back to here. */
  private buildPosterData(): PosterData {
    const vehicle = this.selectedVehicle();
    const advisorProfile = this.advisor.profile();
    return {
      brand: vehicle.brand,
      modelTitle: modelVariantLabel(vehicle.model, vehicle.variant),
      year: this.modelYear(),
      dateStr: this.quoteDate(),
      logoUrl: this.brandLogo(),
      carImageUrl: this.settingsService.getVariantPhoto(vehicle.brand, vehicle.model, vehicle.variant),

      sellingPrice: this.allInPrice(),
      downpayment: this.downpaymentCash(),
      loanAmount: this.loanAmount(),
      advisor: {
        name: advisorProfile.name,
        role: advisorProfile.role,
        initials: this.advisor.initials(),
        photoUrl: advisorProfile.photoUrl ?? null,
        phoneDisplay: advisorProfile.phoneDisplay,
      },

      otrPrice: this.basePrice(),
      ncdPct: this.ncd(),
      insurance: this.insurance(),
      rebate: this.effectiveRebate(),
      totalAmountDue: this.allInPrice(),

      rateLabel: `${this.interestRate()}% ${this.rateType() === 'flat' ? 'FLAT' : 'EIR'}`,
      interestRatePct: this.interestRate(),
      tenureRows: this.repaymentRows().map((row) => ({
        label: row.label,
        months: row.months,
        monthly: row.monthly,
        isLowest: row.months === Math.max(...this.repaymentRows().map((r) => r.months)),
      })),

      offers: this.offers(),
    };
  }

  /** Bumped on every draw call so an in-flight async redraw (image loads for the logo/car photo)
   *  never paints over the canvas after a newer redraw has already started — the last call to
   *  drawPoster() always wins. */
  private drawGeneration = 0;

  /** Live preview only — kept cheap and fixed at the spec's own 2x, since the on-screen canvas is
   *  shown at its full native ~900px design width (see the template's own-scroll preview column)
   *  rather than shrunk to fit a screen, so there's no HiDPI stretching to compensate for here.
   *  downloadPoster() renders its own higher-resolution copy separately — see renderPosterForExport
   *  — so preview quality and download quality are free to differ. */
  private static readonly PREVIEW_SCALE = 2;

  private async drawPoster(data: PosterData) {
    const canvas = this.posterCanvasRef?.nativeElement;
    if (!canvas) return;
    const generation = ++this.drawGeneration;
    await this.currentTemplate().render(canvas, data, CalculatorComponent.PREVIEW_SCALE, () => generation !== this.drawGeneration);
  }

  ngAfterViewInit() {
    if (this.fontsReady()) this.drawPoster(this.buildPosterData());
  }

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
        rateType: this.rateType(),
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
      rateType: this.rateType(),
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

  /** Download quality is independent of preview quality — a dedicated (never-visible) canvas
   *  rendered fresh at 3x the design grid, well above the on-screen preview's 2x, so a shared
   *  quote image still looks sharp after WhatsApp/social recompression even though the preview
   *  itself doesn't need to work that hard. */
  private static readonly EXPORT_SCALE = 3;

  private async renderPosterForExport(data: PosterData): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    // A fresh, never-visible canvas with no concurrent redraw risk — isStale can just say "never".
    await this.currentTemplate().render(canvas, data, CalculatorComponent.EXPORT_SCALE, () => false);
    return canvas;
  }

  /** Renders its own high-resolution copy of the poster rather than exporting whatever the
   *  on-screen preview happens to be showing — see renderPosterForExport. PNG rather than JPEG:
   *  the Clipboard API only reliably accepts image/png across browsers, and using the same format
   *  for the download fallback keeps this one render path shared between both. */
  private async renderPosterPngBlob(): Promise<Blob> {
    const canvas = await this.renderPosterForExport(this.buildPosterData());
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });
  }

  private async downloadPosterBlob(blob: Blob): Promise<void> {
    const v = this.selectedVehicle();
    downloadBlob(new Uint8Array(await blob.arrayBuffer()), `Quote-${v.brand}-${v.model}.png`.replace(/\s+/g, '-'), 'image/png');
  }

  /** Copies the poster straight onto the system clipboard so it can be pasted directly into
   *  WhatsApp/Telegram/email without a save-then-attach round trip for every new quotation — the
   *  whole point of switching this off download. Works standalone, with no lead saved and no
   *  name/phone typed in yet. Falls back to a plain download when the Clipboard API can't write
   *  images (older browser, non-secure context, or the user denies the permission prompt), so the
   *  quote is never unreachable, just less convenient to hand over in that case. */
  async copyPosterImage() {
    if (this.copyingPoster()) return;
    this.copyingPoster.set(true);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Passing the still-pending blob promise (rather than awaiting it first) is what Chrome/Edge
        // need to honour a clipboard write from inside this async click handler — awaiting the
        // render first can burn through the click's "user activation" window and get the write
        // silently rejected.
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': this.renderPosterPngBlob() })]);
        this.posterCopied.set(true);
        setTimeout(() => this.posterCopied.set(false), 2000);
      } else {
        await this.downloadPosterBlob(await this.renderPosterPngBlob());
      }
    } catch {
      try {
        await this.downloadPosterBlob(await this.renderPosterPngBlob());
      } catch {
        /* best-effort fallback only — nothing more we can do if this also fails */
      }
    } finally {
      this.copyingPoster.set(false);
    }
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
    this.rateType.set(defaults.defaultRateType);
    this.downpaymentType.set('percent');
    this.downpaymentValue.set(defaults.downpaymentPct);
    this.highlightedTenure.set(Math.max(...defaults.defaultTenureYears) * 12);
    this.posterTenureYears.set([...defaults.defaultTenureYears]);
    this.customTenureActive.set(false);
    this.insuranceOverride.set(null);
    this.loanAmountDraft.set(null);
  }
}
