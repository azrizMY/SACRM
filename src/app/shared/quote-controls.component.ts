import { Component, EventEmitter, HostListener, Input, Output, computed, signal, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { InsuranceQuotationEditorComponent } from './insurance-quotation-editor.component';
import { NumberFieldComponent } from './number-field.component';
import { TranslatePipe } from './i18n';
import { QuoteEngine } from './quote-engine';
import { NCD_OPTIONS, VEHICLES, formatRM, modelVariantLabel, vehicleTitle, type InsuranceQuotationDetails } from '../data/calculator-data';

/**
 * Every quote setting — car, rebates, cash back, insurance, rate, down payment and tenure — as
 * the stack of cards the Calculator shows. Shared with the Live page so both always offer the
 * same settings; each passes in its own QuoteEngine.
 */
@Component({
  selector: 'app-quote-controls',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, NumberFieldComponent, InsuranceQuotationEditorComponent, TranslatePipe],
  host: { class: 'contents' },
  template: `
    <!-- Select car -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Select Car" | t }}</span>
        @if (showCompare) {
          <button type="button" (click)="compare.emit()" class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            <app-icon name="table" [size]="13" />
            {{ "Compare with other cars" | t }}
          </button>
        }
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label for="brandSelect" class="text-xs font-medium text-muted-foreground">{{ "Brand" | t }}</label>
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
          <span class="text-xs font-medium text-muted-foreground">{{ "Model" | t }}</span>
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
                      {{ item.label | t }}
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
      <span class="text-[11px] text-muted-foreground">{{ fmt(selectedVehicle().price) }} {{ "base price" | t }}</span>

      @if (availableYears().length > 1) {
        <div class="flex flex-col gap-2">
          <span class="text-xs font-medium text-muted-foreground">{{ "Model Year" | t }}</span>
          <div role="radiogroup" [attr.aria-label]="'Model year' | t" class="flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
            @for (y of availableYears(); track y) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="y === modelYear()"
                (click)="selectModelYear(y)"
                class="flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors"
                [ngClass]="y === modelYear() ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                {{ y }}
              </button>
            }
          </div>
          <span class="text-[11px] text-muted-foreground">{{ "This car is in the database under both years — each has its own price and rebate." | t }}</span>
        </div>
      } @else {
        <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <app-icon name="calendar" [size]="12" />
          {{ 'Only listed for {year} in the Car Database.' | t: { year: modelYear() } }}
        </span>
      }

      @if (colourPickable(); as colours) {
        <div class="flex flex-col gap-2">
          <label for="colourSelect" class="text-xs font-medium text-muted-foreground">{{ "Colour" | t }}</label>
          <select
            id="colourSelect"
            [ngModel]="selectedColour()"
            (ngModelChange)="selectedColour.set($event)"
            class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
          >
            @for (c of colours; track c) { <option [value]="c">{{ colourOptionLabel(c) }}</option> }
          </select>
        </div>
      }
    </div>

    <!-- Price setup -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Price Setup" | t }}</span>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label for="rebateInput" class="text-xs font-medium text-muted-foreground">{{ "Rebate" | t }}</label>
          <ng-container [ngTemplateOutlet]="sourceBadge" [ngTemplateOutletContext]="{ $implicit: rebateIsManual(), field: 'rebate' }" />
        </div>
        <app-number-field inputId="rebateInput" prefix="RM" [decimals]="0" [value]="rebateInput()" (valueChange)="onRebateChange($event)" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label for="additionalRebateInput" class="text-xs font-medium text-muted-foreground">{{ "Additional Rebate" | t }}</label>
          <ng-container
            [ngTemplateOutlet]="sourceBadge"
            [ngTemplateOutletContext]="{ $implicit: additionalRebateIsManual() || additionalRebateEnabled() !== autoAdditionalRebateEnabled(), field: 'additionalRebate' }"
          />
        </div>
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            [ngModel]="additionalRebateEnabled()"
            (ngModelChange)="onAdditionalRebateEnabledChange($event)"
            [attr.aria-label]="'Include additional rebate' | t"
            class="size-4 shrink-0 rounded border-input accent-primary"
          />
          <app-number-field
            class="flex-1"
            inputId="additionalRebateInput"
            prefix="RM"
            [decimals]="0"
            [disabled]="!additionalRebateEnabled()"
            [value]="additionalRebateValue()"
            (valueChange)="onAdditionalRebateChange($event)"
          />
        </div>
      </div>

      <!-- Rebate as cash back: the loan is sized on OTR + insurance and the rebate is paid back in cash -->
      @if (cashbackAllowed() && cashbackMax() > 0) {
        <div class="flex flex-col gap-2 rounded-lg border p-3 transition-colors" [ngClass]="cashbackOn() ? 'border-[var(--success)]/40 bg-[var(--success)]/10' : 'border-border'">
          <label class="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              [ngModel]="cashbackOn()"
              (ngModelChange)="setRebateAsCashback($event)"
              class="size-4 shrink-0 rounded border-input accent-primary"
            />
            <span class="text-sm font-medium">{{ "Give rebate as cash back" | t }}</span>
          </label>
          @if (cashbackOn()) {
            <div class="flex flex-col gap-1.5">
              <label for="cashbackAmountInput" class="text-xs font-medium text-muted-foreground">{{ "Cash back amount" | t }} <span class="font-normal">({{ "up to {max}" | t: { max: fmt(cashbackMax()) } }})</span></label>
              <app-number-field inputId="cashbackAmountInput" prefix="RM" [decimals]="0" [value]="cashbackAmount()" (valueChange)="onCashbackAmountChange($event)" />
            </div>
            <p class="text-xs leading-relaxed text-muted-foreground">
              {{ "Discount {discount} · Cash back {cash} from the dealer." | t: { discount: fmt(effectiveRebate() - totals().cashback), cash: fmt(totals().cashback) } }}
              @if (cashbackMonthlyIncrease() > 0) {
                <span class="font-semibold text-foreground">{{ "Monthly +{amount} vs taking the rebate as a discount." | t: { amount: fmt2(cashbackMonthlyIncrease()) } }}</span>
              }
            </p>
          } @else {
            <p class="text-xs text-muted-foreground">{{ "Customer takes the rebate as cash instead of a discount, on a full loan." | t }}</p>
          }
        </div>
      }
    </div>

    <!-- Insurance -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="insuranceOpen.set(!insuranceOpen())"
          [attr.aria-expanded]="insuranceOpen()"
          class="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Insurance" | t }}</span>
            <span class="truncate text-sm font-semibold tabular text-foreground">{{ fmt2(insurance()) }} <span class="font-normal text-muted-foreground">· {{ ncd() }}% NCD</span></span>
          </span>
          <app-icon name="chevron-down" [size]="16" [class]="'shrink-0 text-muted-foreground transition-transform duration-200 ' + (insuranceOpen() ? 'rotate-180' : '')" />
        </button>
        <ng-container [ngTemplateOutlet]="sourceBadge" [ngTemplateOutletContext]="{ $implicit: insuranceIsManual(), field: 'insurance' }" />
      </div>

      @if (insuranceOpen()) {
      <button
        type="button"
        (click)="openInsuranceBreakdown()"
        class="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-accent"
      >
        <app-icon name="settings" [size]="12" />
        {{ "Insurance Breakdown" | t }}
      </button>

      <div class="flex flex-col gap-2">
        <label for="ncdSelect" class="text-xs font-medium text-muted-foreground">
          <span class="inline-flex items-center gap-1">
            <app-icon name="percent" [size]="12" />
            {{ "NCD" | t }}
          </span>
        </label>
        <select
          id="ncdSelect"
          [ngModel]="ncd()"
          (ngModelChange)="ncd.set(+$event)"
          class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
        >
          @for (opt of ncdOptions; track opt.value) {
            <option [value]="opt.value">{{ opt.label | t }}</option>
          }
        </select>
      </div>

      }
    </div>

    <!-- Interest Rate -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="rateOpen.set(!rateExpanded())"
          [attr.aria-expanded]="rateExpanded()"
          class="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Interest Rate" | t }}</span>
            @if (rateMissing()) {
              <span class="text-sm font-semibold text-[var(--warning)]">{{ "EIR needed" | t }}</span>
            } @else {
              <span class="text-sm font-semibold tabular text-foreground">{{ interestRate() }}% <span class="font-normal text-muted-foreground">· {{ rateType() === 'flat' ? ('Flat' | t) : 'EIR' }}</span></span>
            }
          </span>
          <app-icon name="chevron-down" [size]="16" [class]="'shrink-0 text-muted-foreground transition-transform duration-200 ' + (rateExpanded() ? 'rotate-180' : '')" />
        </button>
        <ng-container [ngTemplateOutlet]="sourceBadge" [ngTemplateOutletContext]="{ $implicit: interestRateIsManual(), field: 'rate' }" />
      </div>

      @if (rateExpanded()) {
      <div class="flex flex-col gap-2">
        <span class="text-xs font-medium text-muted-foreground">{{ "Rate Type" | t }}</span>
        <div role="radiogroup" [attr.aria-label]="'Rate Type' | t" class="flex gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="rateType() === 'flat'"
            (click)="setRateType('flat')"
            class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            [ngClass]="rateType() === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            {{ "Flat" | t }}
          </button>
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="rateType() === 'effective'"
            (click)="setRateType('effective')"
            class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            [ngClass]="rateType() === 'effective' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            {{ "EIR" | t }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="interestRateInput" class="text-xs font-medium text-muted-foreground">{{ rateType() === 'flat' ? ('Flat rate' | t) : ('Effective rate (EIR)' | t) }}</label>
        <app-number-field
          inputId="interestRateInput"
          suffix="%"
          [value]="rateMissing() ? null : interestRate()"
          [invalid]="rateMissing()"
          placeholder="Bank's EIR"
          (valueChange)="onInterestRateChange($event)"
        />
        @if (rateMissing()) {
          <span class="text-[11px] text-[var(--warning)]">
            {{ "This car has no EIR and there's no default EIR — type the bank's rate here, or set a default EIR in Price Settings." | t }}
          </span>
        }
      </div>
      }
    </div>

    <!-- Loan setup -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Loan Setup" | t }}</span>

      @if (cashbackOn()) {
        <!-- Cash back only makes sense on a full loan — a customer paying cash upfront would just
             take the rebate off that instead — so the downpayment is fixed while it's on. -->
        <div class="flex flex-col gap-1 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-3">
          <span class="text-sm font-semibold">{{ "Full loan — cash back is on" | t }}</span>
          <span class="text-xs leading-relaxed text-muted-foreground">
            {{ "Loan {loan} · Cash back {cash}. Untick cash back in Price Setup to set a downpayment." | t: { loan: fmt(loanAmount()), cash: fmt(totals().cashback) } }}
          </span>
        </div>
      } @else {
      <div class="flex flex-col gap-2">
        <span class="text-xs font-medium text-muted-foreground">{{ "Downpayment" | t }}</span>
        <div role="group" [attr.aria-label]="'Quick downpayment presets' | t" class="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            (click)="applyDownpaymentPreset('tenPercent')"
            class="rounded-lg border px-2 py-2 text-xs font-semibold transition-colors"
            [ngClass]="isDownpaymentPreset('tenPercent') ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            10%
          </button>
          <button
            type="button"
            (click)="applyDownpaymentPreset('fullLoan')"
            class="rounded-lg border px-2 py-2 text-xs font-semibold transition-colors"
            [ngClass]="isDownpaymentPreset('fullLoan') ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            {{ minDownpayment() > 0 ? ('Minimum' | t) : ('Full Loan' | t) }}
          </button>
        </div>
        <div class="flex gap-2">
          <app-number-field
            class="min-w-0 flex-1"
            ariaLabel="Downpayment"
            [prefix]="downpaymentType() === 'amount' ? 'RM' : ''"
            [suffix]="downpaymentType() === 'percent' ? '%' : ''"
            [value]="downpaymentValue()"
            (valueChange)="downpaymentValue.set($event ?? 0)"
            (committed)="commitDownpayment()"
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
              {{ "Amt" | t }}
            </button>
          </div>
        </div>
        @if (minDownpayment() > 0) {
          @if (downpaymentRaisedToMin()) {
            <div class="flex items-start gap-2 rounded-lg bg-[var(--warning)]/12 px-3 py-2 text-[11px] text-foreground">
              <app-icon name="alert-triangle" [size]="13" class="mt-px shrink-0 text-[var(--warning)]" />
              <span>{{ "This car needs a" | t }} <strong>{{ fmt(minDownpayment()) }}</strong> {{ "minimum downpayment (rebate counts towards it) — raised to meet it." | t }}</span>
            </div>
          } @else {
            <span class="text-[11px] text-muted-foreground">Minimum downpayment for this car: {{ fmt(minDownpayment()) }} {{ "before rebate" | t }}</span>
          }
        }
        @if (downpaymentRebateNote(); as n) {
          <div class="flex flex-col gap-0.5 rounded-lg bg-[var(--success)]/10 px-3 py-2 text-[11px] text-foreground">
            @if (n.covered) {
              <span><strong>{{ 'Rebates cover the {pct}% down payment.' | t: { pct: n.pct } }}</strong> {{ 'Customer pays {amount} (loan rounding only).' | t: { amount: fmt2(n.after) } }}</span>
            } @else {
              <span>{{ n.pct }}% is {{ fmt(n.before) }} — rebates of {{ fmt(n.rebate) }} {{ "bring it down to" | t }} <strong>{{ fmt2(n.after) }}</strong>.</span>
            }
          </div>
        } @else {
          <span class="text-[11px] text-muted-foreground">
            @if (downpaymentType() === 'percent') {
              Rebate is applied to reduce the cash downpayment needed.
            } @else {
              Rebate reduces the car price separately, not counted as cash deposit.
            }
          </span>
        }
      </div>

      <div class="flex items-center gap-3">
        <div class="h-px flex-1 bg-border"></div>
        <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "or" | t }}</span>
        <div class="h-px flex-1 bg-border"></div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="loanAmountInput" class="text-xs font-medium text-muted-foreground">{{ "Loan Amount" | t }}</label>
        <app-number-field
          inputId="loanAmountInput"
          prefix="RM"
          [decimals]="0"
          [value]="loanAmountDisplay()"
          (valueChange)="onLoanAmountInput($event)"
          (committed)="commitLoanAmount()"
        />
        @if (loanCapNote(); as note) {
          <span class="text-[11px] font-medium text-[var(--warning)]">{{ note }}</span>
        } @else {
          <span class="text-[11px] text-muted-foreground">{{ "Rounds down to the nearest RM100 once you finish typing — any remainder goes to the downpayment." | t }}</span>
        }
      </div>

      <div class="flex items-center gap-3">
        <div class="h-px flex-1 bg-border"></div>
        <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "or" | t }}</span>
        <div class="h-px flex-1 bg-border"></div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="monthlyInstallmentInput" class="text-xs font-medium text-muted-foreground">{{ "Monthly Installment" | t }}</label>
        <app-number-field
          inputId="monthlyInstallmentInput"
          prefix="RM"
          [value]="monthlyInstallmentDisplay()"
          (valueChange)="onMonthlyInstallmentInput($event)"
          (committed)="commitMonthlyInstallment()"
        />
        @if (monthlyCapNote(); as note) {
          <span class="text-[11px] font-medium text-[var(--warning)]">{{ note }}</span>
        } @else {
          <span class="text-[11px] text-muted-foreground">{{ 'Targets the {tenure} tenure and works backwards to the loan amount and deposit.' | t: { tenure: (monthlyInstallmentTenureLabel() | t) } }}</span>
        }
      </div>
      }
    </div>

    <!-- Tenure -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Quotation Summary" | t }}</span>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">{{ "Tenure Selection" | t }}</span>
          <span class="text-xs font-semibold tabular text-foreground">{{ posterTenureSummary() }}</span>
        </div>
        <div role="group" [attr.aria-label]="'Repayment table tenures (years)' | t" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
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
        <span class="text-[11px] text-muted-foreground">{{ "Pick 3 tenures to show in the repayment table above." | t }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <label for="customTenureMonthsInput" class="text-xs font-medium text-muted-foreground">{{ "Custom Tenure (Months)" | t }}</label>
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
        <span class="text-[11px] text-muted-foreground">{{ "Type any month count to use as the chosen tenure — this replaces the repayment table above with just this one, until you pick a tenure button again." | t }}</span>
      </div>
    </div>

    <!-- "Default" / tappable "Manual ↺" badge — tapping Manual puts just that field back on its default -->
    <ng-template #sourceBadge let-manual let-field="field">
      @if (manual) {
        <button
          type="button"
          (click)="resetField(field)"
          [title]="'Back to the default value' | t"
          class="flex shrink-0 items-center gap-1 rounded-md bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/25"
        >
          {{ "Manual" | t }}
          <app-icon name="rotate-ccw" [size]="10" />
        </button>
      } @else {
        <span class="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{{ "Default" | t }}</span>
      }
    </ng-template>

    <!-- Insurance Breakdown modal -->
    @if (insuranceBreakdownOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeInsuranceBreakdown()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <div class="flex flex-col">
              <span class="text-sm font-semibold">{{ "Insurance Breakdown" | t }}</span>
              <span class="text-[11px] text-muted-foreground">{{ vehicleTitle(selectedVehicle().brand, modelVariantLabel(selectedVehicle().model, selectedVehicle().variant)) }}</span>
            </div>
            <button type="button" (click)="closeInsuranceBreakdown()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
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
export class QuoteControlsComponent {
  @Input({ required: true }) q!: QuoteEngine;
  /** The Calculator offers "Compare with other cars"; the Live page doesn't. */
  @Input() showCompare = false;
  @Output() compare = new EventEmitter<void>();

  private host = inject(ElementRef);

  ncdOptions = NCD_OPTIONS;
  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));
  posterYearOptions = Array.from({ length: 9 }, (_, i) => i + 1);
  modelVariantLabel = modelVariantLabel;
  vehicleTitle = vehicleTitle;
  fmt = (v: number) => formatRM(v);
  /** Always 2 decimals plus thousands separators — same as the Calculator's Quote Preview. */
  fmt2 = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ---------- Screen-only state ----------

  carDropdownOpen = false;

  toggleCarDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.carDropdownOpen = !this.carDropdownOpen;
  }

  selectModelVariant(model: string, variant: string) {
    this.q.selectedModelName.set(model);
    this.q.onVariantChange(variant);
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

  // Insurance and Interest Rate are usually left on their defaults, so they fold into one-line
  // summaries; the rate section forces itself open while a rate is missing.
  insuranceOpen = signal(false);
  rateOpen = signal(false);
  rateExpanded = computed(() => this.rateOpen() || this.q.rateMissing());

  insuranceBreakdownOpen = signal(false);

  openInsuranceBreakdown() {
    this.insuranceBreakdownOpen.set(true);
  }

  closeInsuranceBreakdown() {
    this.insuranceBreakdownOpen.set(false);
  }

  onInsuranceSaved(details: InsuranceQuotationDetails) {
    this.q.setInsuranceOverride(details);
    this.closeInsuranceBreakdown();
  }

  // ---------- The quote (from the engine passed in) ----------

  get selectedBrand() {
    return this.q.selectedBrand;
  }

  get selectedModelName() {
    return this.q.selectedModelName;
  }

  get selectedVariant() {
    return this.q.selectedVariant;
  }

  get selectedColour() {
    return this.q.selectedColour;
  }

  get modelYear() {
    return this.q.modelYear;
  }

  get carGroups() {
    return this.q.carGroups;
  }

  get availableYears() {
    return this.q.availableYears;
  }

  get selectedVehicle() {
    return this.q.selectedVehicle;
  }

  get colourPickable() {
    return this.q.colourPickable;
  }

  get rebateIsManual() {
    return this.q.rebateIsManual;
  }

  get rebateInput() {
    return this.q.rebateInput;
  }

  get additionalRebateIsManual() {
    return this.q.additionalRebateIsManual;
  }

  get additionalRebateValue() {
    return this.q.additionalRebateValue;
  }

  get autoAdditionalRebateEnabled() {
    return this.q.autoAdditionalRebateEnabled;
  }

  get additionalRebateEnabled() {
    return this.q.additionalRebateEnabled;
  }

  get effectiveRebate() {
    return this.q.effectiveRebate;
  }

  get ncd() {
    return this.q.ncd;
  }

  get autoBasicPremium() {
    return this.q.autoBasicPremium;
  }

  get insuranceIsManual() {
    return this.q.insuranceIsManual;
  }

  get insuranceDetails() {
    return this.q.insuranceDetails;
  }

  get insurance() {
    return this.q.insurance;
  }

  get rateType() {
    return this.q.rateType;
  }

  get interestRateIsManual() {
    return this.q.interestRateIsManual;
  }

  get rateMissing() {
    return this.q.rateMissing;
  }

  get interestRate() {
    return this.q.interestRate;
  }

  get downpaymentType() {
    return this.q.downpaymentType;
  }

  get downpaymentValue() {
    return this.q.downpaymentValue;
  }

  get totals() {
    return this.q.totals;
  }

  get cashbackAllowed() {
    return this.q.cashbackAllowed;
  }

  get cashbackOn() {
    return this.q.cashbackOn;
  }

  get cashbackMax() {
    return this.q.cashbackMax;
  }

  get cashbackAmount() {
    return this.q.cashbackAmount;
  }

  get cashbackMonthlyIncrease() {
    return this.q.cashbackMonthlyIncrease;
  }

  get minDownpayment() {
    return this.q.minDownpayment;
  }

  get downpaymentRaisedToMin() {
    return this.q.downpaymentRaisedToMin;
  }

  get loanAmount() {
    return this.q.loanAmount;
  }

  get loanAmountDisplay() {
    return this.q.loanAmountDisplay;
  }

  get loanCapNote() {
    return this.q.loanCapNote;
  }

  get monthlyCapNote() {
    return this.q.monthlyCapNote;
  }

  get downpaymentRebateNote() {
    return this.q.downpaymentRebateNote;
  }

  get highlightedTenure() {
    return this.q.highlightedTenure;
  }

  get posterTenureYears() {
    return this.q.posterTenureYears;
  }

  get monthlyInstallmentTenureLabel() {
    return this.q.monthlyInstallmentTenureLabel;
  }

  get monthlyInstallmentDisplay() {
    return this.q.monthlyInstallmentDisplay;
  }

  get posterTenureSummary() {
    return this.q.posterTenureSummary;
  }

  onBrandChange(...args: Parameters<QuoteEngine['onBrandChange']>) {
    return this.q.onBrandChange(...args);
  }

  colourOptionLabel(...args: Parameters<QuoteEngine['colourOptionLabel']>) {
    return this.q.colourOptionLabel(...args);
  }

  selectModelYear(...args: Parameters<QuoteEngine['selectModelYear']>) {
    return this.q.selectModelYear(...args);
  }

  resetField(...args: Parameters<QuoteEngine['resetField']>) {
    return this.q.resetField(...args);
  }

  onRebateChange(...args: Parameters<QuoteEngine['onRebateChange']>) {
    return this.q.onRebateChange(...args);
  }

  onAdditionalRebateEnabledChange(...args: Parameters<QuoteEngine['onAdditionalRebateEnabledChange']>) {
    return this.q.onAdditionalRebateEnabledChange(...args);
  }

  onAdditionalRebateChange(...args: Parameters<QuoteEngine['onAdditionalRebateChange']>) {
    return this.q.onAdditionalRebateChange(...args);
  }

  onInterestRateChange(...args: Parameters<QuoteEngine['onInterestRateChange']>) {
    return this.q.onInterestRateChange(...args);
  }

  setRateType(...args: Parameters<QuoteEngine['setRateType']>) {
    return this.q.setRateType(...args);
  }

  setRebateAsCashback(...args: Parameters<QuoteEngine['setRebateAsCashback']>) {
    return this.q.setRebateAsCashback(...args);
  }

  onCashbackAmountChange(...args: Parameters<QuoteEngine['onCashbackAmountChange']>) {
    return this.q.onCashbackAmountChange(...args);
  }

  applyDownpaymentPreset(...args: Parameters<QuoteEngine['applyDownpaymentPreset']>) {
    return this.q.applyDownpaymentPreset(...args);
  }

  isDownpaymentPreset(...args: Parameters<QuoteEngine['isDownpaymentPreset']>) {
    return this.q.isDownpaymentPreset(...args);
  }

  commitDownpayment(...args: Parameters<QuoteEngine['commitDownpayment']>) {
    return this.q.commitDownpayment(...args);
  }

  onLoanAmountInput(...args: Parameters<QuoteEngine['onLoanAmountInput']>) {
    return this.q.onLoanAmountInput(...args);
  }

  commitLoanAmount(...args: Parameters<QuoteEngine['commitLoanAmount']>) {
    return this.q.commitLoanAmount(...args);
  }

  onMonthlyInstallmentInput(...args: Parameters<QuoteEngine['onMonthlyInstallmentInput']>) {
    return this.q.onMonthlyInstallmentInput(...args);
  }

  commitMonthlyInstallment(...args: Parameters<QuoteEngine['commitMonthlyInstallment']>) {
    return this.q.commitMonthlyInstallment(...args);
  }

  onCustomTenureInput(...args: Parameters<QuoteEngine['onCustomTenureInput']>) {
    return this.q.onCustomTenureInput(...args);
  }

  togglePosterYear(...args: Parameters<QuoteEngine['togglePosterYear']>) {
    return this.q.togglePosterYear(...args);
  }
}
