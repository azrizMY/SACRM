import { Component, EventEmitter, HostListener, Input, Output, computed, signal, ElementRef, inject } from '@angular/core';
import { SettingsService } from './settings.service';
import { formatRM2 } from '../data/dashboard-data';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { InsuranceQuotationEditorComponent } from './insurance-quotation-editor.component';
import { NumberFieldComponent } from './number-field.component';
import { TranslatePipe } from './i18n';
import { QuoteEngine } from './quote-engine';
import { NCD_OPTIONS, formatRM, modelVariantLabel, vehicleTitle, type InsuranceQuotationDetails } from '../data/calculator-data';
import { VehicleCatalogService } from './vehicle-catalog.service';
import { BrandChipsComponent } from './brand-chips.component';

/**
 * Every quote setting — car, rebates, cash back, insurance, rate, down payment and tenure — as
 * the stack of cards the Calculator shows. Shared with the Live page so both always offer the
 * same settings; each passes in its own QuoteEngine.
 */
@Component({
  selector: 'app-quote-controls',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, NumberFieldComponent, InsuranceQuotationEditorComponent, TranslatePipe, BrandChipsComponent],
  host: { class: 'contents' },
  template: `
    <!-- Select car -->
    <div data-tour="calc-car" class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-foreground">{{ "Select Car" | t }}</span>
        @if (showCompare) {
          <button type="button" (click)="compare.emit()" class="-my-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft">
            <app-icon name="table" [size]="16" />
            {{ "Compare" | t }}
          </button>
        }
      </div>

      <!-- Brands as one row of chips (swipes sideways when they don't all fit); hidden with one brand -->
      @if (brands().length > 1) {
        <app-brand-chips [brands]="brands()" [selected]="selectedBrand()" (pick)="onBrandChange($event)" />
      }

      <div class="flex flex-col gap-2">
          <div class="relative">
            <button
              type="button"
              (click)="toggleCarDropdown($event)"
              [attr.aria-label]="('Model' | t) + ': ' + modelVariantLabel(selectedModelName(), selectedVariant())"
              class="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-input bg-input pl-3 pr-3 text-base text-foreground outline-none transition-colors focus:border-ring md:text-sm"
            >
              <span class="truncate font-semibold">{{ modelVariantLabel(selectedModelName(), selectedVariant()) }}</span>
              <span class="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                <span class="tabular">{{ fmt(selectedVehicle().price) }}</span>
                <app-icon name="chevron-down" [size]="18" />
              </span>
            </button>
            @if (carDropdownOpen) {
              <div class="absolute left-0 top-full z-50 mt-1 max-h-80 w-full min-w-[220px] overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg">
                @for (group of carGroups(); track group.model; let first = $first) {
                  <div class="px-3 pb-1 text-sm font-semibold text-foreground" [ngClass]="first ? 'pt-2' : 'pt-3'">{{ group.model }}</div>
                  @for (item of group.items; track item.variant) {
                    <button
                      type="button"
                      (click)="selectModelVariant(group.model, item.variant)"
                      class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      {{ item.label | t }}
                      @if (group.model === selectedModelName() && item.variant === selectedVariant()) {
                        <app-icon name="check" [size]="18" class="shrink-0 text-foreground" />
                      }
                    </button>
                  }
                }
              </div>
            }
          </div>
      </div>

      @if (availableYears().length > 1) {
        <div class="flex flex-col gap-2">
          <span class="text-sm font-semibold text-foreground">{{ "Model Year" | t }}</span>
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
          <span class="text-xs text-muted-foreground">{{ "This car is in the database under both years — each has its own price and rebate." | t }}</span>
        </div>
      }

      @if (colourPickable(); as colours) {
        <div class="flex flex-col gap-2">
          <label for="colourSelect" class="text-sm font-semibold text-foreground">{{ "Colour" | t }}</label>
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
      <span class="text-sm font-semibold text-foreground">{{ "Price Setup" | t }}</span>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label for="rebateInput" class="text-sm font-semibold text-foreground">{{ "Rebate" | t }}</label>
          <ng-container [ngTemplateOutlet]="sourceBadge" [ngTemplateOutletContext]="{ $implicit: rebateIsManual(), field: 'rebate' }" />
        </div>
        <app-number-field inputId="rebateInput" prefix="RM" [decimals]="0" [value]="rebateInput()" (valueChange)="onRebateChange($event)" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label for="additionalRebateInput" class="text-sm font-semibold text-foreground">{{ "Additional Rebate" | t }}</label>
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
              <label for="cashbackAmountInput" class="text-sm font-semibold text-foreground">{{ "Cash back amount" | t }} <span class="font-normal">({{ "up to {max}" | t: { max: fmt(cashbackMax()) } }})</span></label>
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

    <!-- Loan setup -->
    <div data-tour="calc-loan" class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-foreground">{{ "Loan Setup" | t }}</span>
        @if (!cashbackOn()) {<span class="flex items-center gap-1 text-xs text-muted-foreground"><app-icon name="refresh-cw" [size]="12" />{{ "Change any one" | t }}</span>}
      </div>

      @if (cashbackOn()) {
        <!-- Cash back only makes sense on a full loan — a customer paying cash upfront would just
             take the rebate off that instead — so the downpayment is fixed while it's on. -->
        <div class="flex flex-col gap-1 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-3 py-3">
          @if (totals().downpaymentCash >= 100) {
            <!-- A car with a minimum downpayment: that minimum is still paid in cash -->
            <span class="text-sm font-semibold">{{ "Cash back is on" | t }}</span>
            <span class="text-xs leading-relaxed text-muted-foreground">
              {{ "Minimum downpayment {dp} · Loan {loan} · Cash back {cash}. Untick cash back in Price Setup to set a different downpayment." | t: { dp: fmt(totals().downpaymentCash), loan: fmt(loanAmount()), cash: fmt(totals().cashback) } }}
            </span>
          } @else {
            <span class="text-sm font-semibold">{{ "Full loan — cash back is on" | t }}</span>
            <span class="text-xs leading-relaxed text-muted-foreground">
              {{ "Loan {loan} · Cash back {cash}. Untick cash back in Price Setup to set a downpayment." | t: { loan: fmt(loanAmount()), cash: fmt(totals().cashback) } }}
            </span>
          }
        </div>
      } @else {
      <!-- Draft B: the three ways to size the loan sit together; changing any one moves the other two -->
      <div role="group" [attr.aria-label]="'Quick downpayment presets' | t" class="flex flex-wrap gap-1.5">
        @for (p of downpaymentPresets; track $index) {
          <button
            type="button"
            (click)="applyDownpaymentPreset(p)"
            class="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors"
            [ngClass]="isDownpaymentPreset(p) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            {{ downpaymentPresetLabel(p) | t }}
          </button>
        }
      </div>

      <div class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 border-l-2 border-primary pl-3">
        <span class="text-sm font-medium text-muted-foreground">{{ "Downpayment" | t }}</span>
        <div class="flex gap-1.5">
          <app-number-field
            class="min-w-0 flex-1"
            ariaLabel="Downpayment"
            [prefix]="downpaymentType() === 'amount' ? 'RM' : ''"
            [suffix]="downpaymentType() === 'percent' ? '%' : ''"
            [value]="downpaymentValue()"
            (valueChange)="downpaymentValue.set($event ?? 0)"
            (committed)="commitDownpayment()"
          />
          <div class="flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              (click)="downpaymentType.set('percent')"
              class="rounded-md px-2 py-1 text-sm font-semibold transition-colors"
              [ngClass]="downpaymentType() === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
            >
              %
            </button>
            <button
              type="button"
              (click)="downpaymentType.set('amount')"
              class="rounded-md px-2 py-1 text-sm font-semibold transition-colors"
              [ngClass]="downpaymentType() === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
            >
              RM
            </button>
          </div>
        </div>

        <label for="loanAmountInput" class="text-sm font-medium text-muted-foreground">{{ "Loan Amount" | t }}</label>
        <app-number-field
          inputId="loanAmountInput"
          prefix="RM"
          [decimals]="0"
          [value]="loanAmountDisplay()"
          (valueChange)="onLoanAmountInput($event)"
          (committed)="commitLoanAmount()"
        />

        <label for="monthlyInstallmentInput" class="flex flex-col text-sm font-medium leading-tight text-muted-foreground">
          {{ "Monthly" | t }}
          <span class="text-xs font-normal">{{ monthlyInstallmentTenureLabel() | t }}</span>
        </label>
        <app-number-field
          inputId="monthlyInstallmentInput"
          prefix="RM"
          [value]="monthlyInstallmentDisplay()"
          (valueChange)="onMonthlyInstallmentInput($event)"
          (committed)="commitMonthlyInstallment()"
        />
      </div>

      @if (minDownpayment() > 0) {
        @if (downpaymentRaisedToMin()) {
          <div class="flex items-start gap-2 rounded-lg bg-[var(--warning)]/12 px-3 py-2 text-xs text-foreground">
            <app-icon name="alert-triangle" [size]="16" class="mt-px shrink-0 text-[var(--warning)]" />
            <span>{{ "This car needs a" | t }} <strong>{{ fmt(minDownpayment()) }}</strong> {{ "minimum downpayment (rebate counts towards it) — raised to meet it." | t }}</span>
          </div>
        } @else {
          <span class="text-xs text-muted-foreground">Minimum downpayment for this car: {{ fmt(minDownpayment()) }} {{ "before rebate" | t }}</span>
        }
      }
      @if (downpaymentRebateNote(); as n) {
        <div class="flex flex-col gap-0.5 rounded-lg bg-[var(--success)]/10 px-3 py-2 text-xs text-foreground">
          @if (n.covered) {
            <span><strong>{{ 'Rebates cover the {pct}% down payment.' | t: { pct: n.pct } }}</strong> {{ 'Customer pays {amount} (loan rounding only).' | t: { amount: fmt2(n.after) } }}</span>
          } @else {
            <span>{{ n.pct }}% is {{ fmt(n.before) }} — rebates of {{ fmt(n.rebate) }} {{ "bring it down to" | t }} <strong>{{ fmt2(n.after) }}</strong>.</span>
          }
        </div>
      }
      @if (loanCapNote(); as note) {
        <span class="text-xs font-medium text-[var(--warning)]">{{ note }}</span>
      }
      @if (monthlyCapNote(); as note) {
        <span class="text-xs font-medium text-[var(--warning)]">{{ note }}</span>
      }
      @if (!downpaymentRebateNote() && !loanCapNote() && !monthlyCapNote()) {
        <span class="text-xs text-muted-foreground">
          {{ (downpaymentType() === 'percent' ? 'Rebate lowers the cash downpayment.' : 'Rebate lowers the car price, not the deposit.') | t }}
          {{ 'Loan amount rounds down to RM100.' | t }}
        </span>
      }
      }
    </div>

    <!-- Insurance: the total up top; tap an NCD box; the full breakdown is behind "Edit insurance details" -->
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1">
        <div class="flex w-full items-center gap-2">
          <span class="min-w-0 flex-1 text-sm font-semibold text-foreground">{{ "Insurance" | t }}</span>
          <span class="fig whitespace-nowrap text-base">{{ fmt2(insurance()) }}</span>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          @if (ncdSaving() > 0) {
            <span class="tabular font-semibold text-[var(--success)]">{{ 'Save {amount}' | t: { amount: fmt2(ncdSaving()) } }}</span>
          } @else {
            <span>{{ 'No NCD' | t }}</span>
          }
          <span aria-hidden="true">·</span>
          <ng-container [ngTemplateOutlet]="sourceBadge" [ngTemplateOutletContext]="{ $implicit: insuranceIsManual(), field: 'insurance' }" />
        </div>
      </div>

        <div class="flex flex-col gap-2">
          <span id="ncdLabel" class="text-sm font-semibold text-foreground">{{ "No-claim discount (NCD)" | t }}</span>
          <div role="radiogroup" aria-labelledby="ncdLabel" class="grid grid-cols-3 gap-1.5">
            @for (opt of ncdOptions; track opt.value) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="ncd() === opt.value"
                (click)="ncd.set(opt.value)"
                class="flex flex-col items-center justify-center rounded-lg px-1 py-1.5 leading-tight transition-colors"
                [ngClass]="ncd() === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                <span class="text-sm font-bold tabular">{{ opt.value }}%</span>
                <span class="text-xs" [ngClass]="ncd() === opt.value ? 'text-primary-foreground/85' : ''">{{ ncdYear(opt) | t }}</span>
              </button>
            }
          </div>
        </div>

        <button type="button" (click)="openInsuranceBreakdown()" class="btn btn-outline w-full">
          <app-icon name="pencil" [size]="16" />
          {{ "Edit insurance details" | t }}
        </button>
    </div>

    <!-- Tenure -->
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <span class="text-sm font-semibold text-foreground">{{ "Tenure" | t }}</span>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-foreground">{{ "Tenure Selection" | t }}</span>
          <span class="text-xs font-semibold tabular text-foreground">{{ customTenureActive() ? ('{n} months' | t: { n: highlightedTenure() }) : posterTenureSummary() }}</span>
        </div>
        <div role="group" [attr.aria-label]="'Repayment table tenures (years)' | t" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
          @for (y of posterYearOptions; track y) {
            <button
              type="button"
              [attr.aria-pressed]="!customTenureActive() && posterTenureYears().includes(y)"
              (click)="togglePosterYear(y)"
              class="flex h-10 items-center justify-center rounded-full text-sm font-semibold transition-colors"
              [ngClass]="!customTenureActive() && posterTenureYears().includes(y) ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              {{ y }}
            </button>
          }
        </div>
        <span class="text-xs text-muted-foreground">{{ "Pick 3 tenures to show on the poster." | t }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <label for="customTenureMonthsInput" class="text-sm font-semibold text-foreground">{{ "Custom Tenure (Months)" | t }}</label>
        <input
          id="customTenureMonthsInput"
          type="number"
          min="1"
          max="120"
          step="1"
          [ngModel]="customTenureActive() ? highlightedTenure() : null"
          (ngModelChange)="$event !== null && $event !== '' && onCustomTenureInput($event)"
          [placeholder]="'e.g. 84' | t"
          class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm font-medium tabular outline-none transition-colors"
          [ngClass]="customTenureActive() ? 'border-brand bg-brand-soft' : ''"
        />
        <span class="text-xs text-muted-foreground">{{ "Optional. Any month count — the poster then shows just this one, until you pick a tenure above again." | t }}</span>
      </div>
    </div>

    <!-- Interest Rate: the rate up top; a quiet Flat / EIR switch; − / + beside the rate -->
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1">
        <div class="flex w-full items-center gap-2">
          <span class="min-w-0 flex-1 text-sm font-semibold text-foreground">{{ "Interest Rate" | t }}</span>
          @if (rateMissing()) {
            <span class="text-sm font-semibold text-[var(--warning)]">{{ "EIR needed" | t }}</span>
          } @else {
            <span class="fig whitespace-nowrap text-base">{{ rateLabel(interestRate()) }}%</span>
          }
        </div>
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{{ rateType() === 'flat' ? ('Flat rate' | t) : ('EIR (effective rate)' | t) }}</span>
          <span aria-hidden="true">·</span>
          <ng-container [ngTemplateOutlet]="sourceBadge" [ngTemplateOutletContext]="{ $implicit: interestRateIsManual(), field: 'rate' }" />
        </div>
      </div>

        <div role="radiogroup" [attr.aria-label]="'Rate Type' | t" class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="rateType() === 'flat'"
            (click)="setRateType('flat')"
            class="rounded-md px-2 py-1.5 text-sm font-semibold transition-colors"
            [ngClass]="rateType() === 'flat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          >
            {{ "Flat rate" | t }}
          </button>
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="rateType() === 'effective'"
            (click)="setRateType('effective')"
            class="rounded-md px-2 py-1.5 text-sm font-semibold transition-colors"
            [ngClass]="rateType() === 'effective' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          >
            {{ "EIR" | t }}
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <label for="interestRateInput" class="text-sm font-semibold text-foreground">{{ rateType() === 'flat' ? ('Flat rate' | t) : ('Effective rate (EIR)' | t) }}</label>
          <div class="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-1.5">
            <button
              type="button"
              (click)="stepRate(-1)"
              [disabled]="rateMissing() || interestRate() <= 0"
              [attr.aria-label]="'Lower the rate by 0.05%' | t"
              class="btn btn-outline h-10 p-0 text-lg"
            >−</button>
            <app-number-field
              inputId="interestRateInput"
              suffix="%"
              [value]="rateMissing() ? null : interestRate()"
              [invalid]="rateMissing()"
              placeholder="Bank's EIR"
              (valueChange)="onInterestRateChange($event)"
            />
            <button
              type="button"
              (click)="stepRate(1)"
              [attr.aria-label]="'Raise the rate by 0.05%' | t"
              class="btn btn-outline h-10 p-0 text-lg"
            >+</button>
          </div>
          @if (rateMissing()) {
            <span class="text-xs text-[var(--warning)]">
              {{ "This car has no EIR and there's no default EIR — type the bank's rate here, or set a default EIR in Price Settings." | t }}
            </span>
          } @else {
            <p class="text-xs leading-relaxed text-muted-foreground">
              {{ "Each tap changes it by 0.05%." | t }}
              @if (defaultRate(); as d) {
                {{ "The usual rate for this car is {rate}% (Price Settings). A change here is for this quote only." | t: { rate: rateLabel(d) } }}
              }
            </p>
          }
        </div>
    </div>

    <!-- "Default" / tappable "Manual ↺" badge — tapping Manual puts just that field back on its default -->
    <ng-template #sourceBadge let-manual let-field="field">
      @if (manual) {
        <button
          type="button"
          (click)="resetField(field)"
          [title]="'Back to the default value' | t"
          class="tap-auto flex shrink-0 items-center gap-1 rounded-md bg-[var(--warning)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/25"
        >
          {{ "Manual" | t }}
          <app-icon name="rotate-ccw" [size]="13" />
        </button>
      } @else {
        <span class="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">{{ "Default" | t }}</span>
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
              <span class="text-xs text-muted-foreground">{{ vehicleTitle(selectedVehicle().brand, modelVariantLabel(selectedVehicle().model, selectedVehicle().variant)) }}</span>
            </div>
            <button type="button" (click)="closeInsuranceBreakdown()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <div class="overflow-y-auto p-4">
            <app-insurance-quotation-editor
              [vehicle]="selectedVehicle()"
              [ncdPct]="ncd()"
              [fallbackBasicPremium]="autoBasicPremium()"
              mode="quote"
              [tariffPremium]="tariffPremium()"
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
  private settingsService = inject(SettingsService);

  /** Basic premium from the motor tariff for the selected car, or null when it can't be worked out. */
  tariffPremium(): number | null {
    return this.settingsService.tariffPremiumFor(this.selectedVehicle());
  }

  ncdOptions = NCD_OPTIONS;
  private catalog = inject(VehicleCatalogService);
  /** The brands this account sells, Primary Brand first — plus the car on screen's own brand if it
   *  isn't one of them (e.g. opened from an older comparison), so its chip is never missing. */
  brands = computed(() => {
    const sold = this.catalog.soldBrands();
    const current = this.q.selectedBrand();
    return sold.includes(current) ? sold : [...sold, current];
  });
  posterYearOptions = Array.from({ length: 9 }, (_, i) => i + 1);
  modelVariantLabel = modelVariantLabel;
  vehicleTitle = vehicleTitle;
  fmt = (v: number) => formatRM(v);
  /** Always 2 decimals plus thousands separators — same as the Calculator's Quote Preview. */
  fmt2 = formatRM2;

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


  insuranceBreakdownOpen = signal(false);


  /** "Year 2" under each NCD box (from the option's own label), "No NCD" for 0%. */
  ncdYear(opt: { value: number; label: string }): string {
    return opt.value === 0 ? 'No NCD' : (opt.label.split(' — ')[1] ?? '');
  }

  /** The rate this car starts on before any change on this quote, or null when it has none. */
  defaultRate = computed(() => this.q.autoInterestRate());

  /** 2.3 → "2.30": two decimals, so a 0.05 step is always visible. */
  rateLabel(rate: number): string {
    return rate.toFixed(2);
  }

  /** − / + beside the rate: 0.05% per tap, never below 0. */
  stepRate(direction: -1 | 1) {
    const base = this.q.rateMissing() ? 0 : this.q.interestRate();
    const next = Math.max(0, Math.round((base + direction * 0.05) * 100) / 100);
    this.q.onInterestRateChange(next);
  }

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

  /** How much less the insurance costs with the chosen NCD than with none (service tax included). */
  ncdSaving(): number {
    return Math.max(0, this.q.loanBasisInsurance() - this.q.insurance());
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

  /** A custom month count is in use (Custom Tenure), instead of the year buttons. */
  get customTenureActive() {
    return this.q.customTenureActive;
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

  get downpaymentPresets() {
    return this.q.downpaymentPresets;
  }

  downpaymentPresetLabel(...args: Parameters<QuoteEngine['downpaymentPresetLabel']>) {
    return this.q.downpaymentPresetLabel(...args);
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
