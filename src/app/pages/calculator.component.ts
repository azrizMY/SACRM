

import { AfterViewInit, Component, computed, effect, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { InsuranceQuotationEditorComponent } from '../shared/insurance-quotation-editor.component';
import { NumberFieldComponent } from '../shared/number-field.component';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { CUSTOMER_STATUS_META, FINANCING_TYPE_OPTIONS, TO_BE_CONFIRMED_COLOUR, type CustomerRecord, type FinancingType } from '../data/customer-data';
import { todayStr } from '../shared/date-utils';
import { DEFAULT_LEAD_SOURCE } from '../data/settings-data';
import { translate } from '../shared/i18n-core';
import { brandLogo, toMalaysianWhatsAppNumber } from '../data/dashboard-data';
import {
  NCD_OPTIONS,
  VEHICLES,
  basicPremiumDefault,
  colourSurchargeFor,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  minDownpaymentCash,
  defaultRateFor,
  formatRM,
  loanForMonthlyPayment,
  modelVariantLabel,
  monthlyPayment,
  additionalRebateForYear,
  rebateForYear,
  roundCents,
  vehicleTitle,
  yearsForVariant,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';
import { downloadBlob } from '../shared/pdf-writer';
import { posterFontsReady } from '../shared/poster-theme';
import { classicTemplate } from '../shared/poster-template-classic';
import { compactMyTemplate } from '../shared/poster-template-my';
import { promoTemplate, squareTemplate } from '../shared/poster-template-social';
import type { PosterData } from '../shared/poster-data';
import type { PosterTemplate, PosterTemplateId } from '../shared/poster-templates';
import { TranslatePipe } from '../shared/i18n';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, NumberFieldComponent, InsuranceQuotationEditorComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <!-- Mobile Preview/Customize switcher -->
      <div class="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-col gap-2 border-b border-border bg-background px-4 pb-2 pt-4 md:-top-6 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 xl:hidden">
        <!-- Live monthly (same as the customer link), so changes on Customize show without switching to Preview -->
        <div class="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
          @if (isCashPurchase()) {
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ "Selling price" | t }}</span>
            <span class="text-sm font-bold tabular">{{ fmt2(allInPrice()) }}</span>
          } @else {
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Monthly · {{ selectedTenureLabel() }}</span>
            <span class="text-sm font-bold tabular" [ngClass]="rateMissing() ? 'text-[var(--warning)]' : 'text-primary'">
              {{ rateMissing() ? ('Rate needed' | t) : fmt2(selectedTenureMonthly()) }}
            </span>
          }
        </div>
        <div role="tablist" [attr.aria-label]="'Quote view' | t" class="flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mobileTab() === 'preview'"
            (click)="mobileTab.set('preview')"
            class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="mobileTab() === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
          >
            {{ "Preview" | t }}
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mobileTab() === 'customize'"
            (click)="mobileTab.set('customize')"
            class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="mobileTab() === 'customize' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
          >
            {{ "Customize" | t }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <!-- Quote preview — no internal scroll cap, same as the Brochures offer sheet preview: the
             poster is a fixed shape, so it just renders at its natural height and the page scrolls
             as a whole instead of a scrollbar sitting on the preview column itself. -->
        <div
          class="flex-col gap-2 xl:sticky xl:top-4 xl:col-span-2 xl:flex"
          [ngClass]="mobileTab() === 'preview' ? 'flex' : 'hidden'"
        >
          @if (availableTemplates().length > 1) {
            <div role="radiogroup" [attr.aria-label]="'Poster template' | t" class="flex w-full shrink-0 gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1.5">
              @for (t of availableTemplates(); track t.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="selectedTemplateId() === t.id"
                  (click)="selectedTemplateId.set(t.id)"
                  class="flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-center transition-colors"
                  [ngClass]="selectedTemplateId() === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  {{ t.label | t }}
                </button>
              }
            </div>
          }
          <div class="relative mx-auto w-full shrink-0 overflow-hidden rounded-xl shadow-md" [ngClass]="previewWidthClass()">
            <canvas #posterCanvas class="block w-full h-auto" [class.blur-sm]="rateMissing()"></canvas>
            @if (rateMissing()) {
              <!-- The poster would otherwise show a 0% EIR and an instalment that isn't real -->
              <div class="absolute inset-0 flex items-center justify-center bg-black/55 p-6">
                <div class="flex max-w-xs flex-col items-center gap-2 rounded-xl bg-card px-5 py-4 text-center shadow-xl">
                  <app-icon name="alert-triangle" [size]="20" class="text-[var(--warning)]" />
                  <span class="text-sm font-bold">{{ "EIR needed" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Enter the bank's effective rate under Interest Rate to finish this quote." | t }}</span>
                </div>
              </div>
            }
          </div>

          @if (rateMissing()) {
            <div class="flex items-start gap-2.5 rounded-lg bg-[var(--warning)]/12 px-4 py-3 text-sm text-foreground">
              <app-icon name="alert-triangle" [size]="16" class="mt-0.5 shrink-0 text-[var(--warning)]" />
              <span class="flex-1">
                {{ "No EIR is set for this car — enter the bank's effective rate under" | t }} <strong>{{ "Interest Rate" | t }}</strong> {{ "before sharing. The monthly figures above aren't real until you do." | t }}
              </span>
            </div>
          }

          @if (posterShareFallbackNotice()) {
            <div class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-4 py-2.5 text-sm">
              <app-icon name="download" [size]="14" class="shrink-0" />
              {{ "Your browser can't hand files to WhatsApp directly — quote downloaded. Attach it in WhatsApp Desktop/Web." | t }}
            </div>
          }

          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              (click)="copyPosterImage()"
              [disabled]="copyingPoster() || rateMissing()"
              class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon [name]="posterCopied() ? 'check' : 'clipboard-check'" [size]="15" />
              {{ copyingPoster() ? ('Copying…' | t) : posterCopied() ? ('Copied!' | t) : ('Copy Image' | t) }}
            </button>
            <button
              type="button"
              (click)="sharePosterImage()"
              [disabled]="sharingPoster() || rateMissing()"
              class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon name="share" [size]="15" />
              {{ sharingPoster() ? ('Sharing…' | t) : ('Share' | t) }}
            </button>
          </div>

          <p class="flex shrink-0 items-center justify-center gap-1.5 text-center text-[10px] leading-relaxed text-muted-foreground">
            <app-icon name="info" [size]="12" class="shrink-0" />
            {{ "Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here." | t }}
          </p>
        </div>

        <!-- Customize quote -->
        <div
          class="flex-col gap-4 xl:sticky xl:top-4 xl:col-span-1 xl:flex xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
          [ngClass]="mobileTab() === 'customize' ? 'flex' : 'hidden'"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-none">{{ "Customize Quote" | t }}</h3>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="openLeadModal()"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent"
              >
                <app-icon name="plus" [size]="13" />
                {{ "Add Lead" | t }}
              </button>
              <button
                type="button"
                (click)="reset()"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <app-icon name="refresh-cw" [size]="13" />
                {{ "Reset" | t }}
              </button>
            </div>
          </div>

          <!-- Select car -->
          <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Select Car" | t }}</span>

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
        </div>
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

    <!-- Add Lead modal -->
    @if (leadModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeLeadModal()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">{{ "Add Lead" | t }}</span>
            <button type="button" (click)="closeLeadModal()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 p-4">
            <p class="text-[11px] text-muted-foreground">
              {{ vehicleTitle(selectedVehicle().brand, selectedVehicle().model) }} &middot; {{ fmt(downpaymentCash()) }} downpayment &middot; {{ ncd() }}% NCD
            </p>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ "Name" | t }}
              <input type="text" [(ngModel)]="leadName" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ "Phone No" | t }}
              <input type="tel" [(ngModel)]="leadPhone" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            @if (existingLeadForPhone(); as dup) {
              <div class="flex items-start gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2.5 text-[11px] text-foreground">
                <app-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0 text-[var(--warning)]" />
                <span>
                  {{ "This number is already saved as" | t }} <strong class="text-foreground">{{ dup.name }}</strong> ({{ statusMeta[dup.status].label | t }}) —
                  <a [routerLink]="['/leads']" [queryParams]="{ customer: dup.id }" (click)="closeLeadModal()" class="font-medium text-primary hover:underline">{{ "open them in Customer Manager" | t }}</a>
                  {{ "instead of saving a new lead here." | t }}
                </span>
              </div>
            }
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ "Source Type" | t }}
              <select [(ngModel)]="leadSource" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (s of sourceTypes(); track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ "Financing Type" | t }}
              <select [(ngModel)]="leadFinancingType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label | t }}</option> }
              </select>
            </label>
            @if (leadFinancingType !== 'Cash') {
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Tenure" | t }}
                <select
                  [ngModel]="highlightedTenure()"
                  (ngModelChange)="selectRepaymentTenure($event)"
                  class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                >
                  @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label | t }} &middot; {{ fmt2(monthlyForTenure(t.months)) }}/mo</option> }
                </select>
              </label>
            }
            @if (leadSaved()) {
              <span class="flex items-center gap-1.5 text-[11px] font-medium text-[var(--success)]">
                <app-icon name="check" [size]="12" />
                {{ "Lead saved" | t }}
              </span>
            }
            @if (whatsAppImageCopied()) {
              <span class="flex items-center gap-1.5 text-[11px] font-medium text-[var(--success)]">
                <app-icon name="check" [size]="12" />
                {{ "Quote image copied — paste it (Ctrl/Cmd+V) into the WhatsApp chat" | t }}
              </span>
            }
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeLeadModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Close" | t }}</button>
            <button
              type="button"
              (click)="submitLead()"
              [disabled]="!leadName || !leadPhone || !!existingLeadForPhone()"
              class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon name="plus" [size]="13" />
              {{ "Save Lead" | t }}
            </button>
            <button
              type="button"
              (click)="saveAndWhatsApp()"
              [disabled]="!leadName || !leadPhone || sendingWhatsApp() || !!existingLeadForPhone() || rateMissing()"
              [title]="rateMissing() ? 'Enter the EIR first — the quote image would show an incomplete rate' : 'Save this lead and open WhatsApp with the quote image copied'"
              class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <app-icon name="message-circle" [size]="13" />
              {{ sendingWhatsApp() ? ('Copying image…' | t) : ('Save & WhatsApp' | t) }}
            </button>
          </div>
        </div>
      </div>
    }

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
export class CalculatorComponent implements AfterViewInit {
  @ViewChild('posterCanvas') posterCanvasRef?: ElementRef<HTMLCanvasElement>;

  copyingPoster = signal(false);
  /** Brief "Copied!" confirmation on the button after a successful clipboard write. */
  posterCopied = signal(false);
  sendingWhatsApp = signal(false);
  /** Brief confirmation next to the WhatsApp button once the poster image lands on the clipboard. */
  whatsAppImageCopied = signal(false);
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
  vehicleTitle = vehicleTitle;
  roundCents = roundCents;
  statusMeta = CUSTOMER_STATUS_META;

  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));

  private settingsService = inject(SettingsService);

  selectedBrand = signal(this.preferredVehicle().brand);
  selectedModelName = signal(this.preferredVehicle().model);
  selectedVariant = signal(this.preferredVehicle().variant);
  /** Not every car has factory colours hardcoded (see Vehicle.colours) — starts on the first one
   *  when it does, null otherwise, and resets the same way whenever the car changes (see
   *  onVariantChange). Purely a price input here — the poster still lists every option
   *  regardless of which one is picked (see PosterData.colours). */
  selectedColour = signal<string | null>(this.preferredVehicle().colours?.[0] ?? null);
  mobileTab = signal<'preview' | 'customize'>('preview');
  /** Read from the preferred car's own database row, never assumed — a car listed only under
   *  2025 starts on 2025, not "the current year." */
  modelYear = signal(Math.max(...this.preferredVehicle().years.map((y) => y.year)));
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

  /** One row per variant now (see Vehicle.years) — falls back to the catalog's first car if this
   *  exact brand/model/variant combination doesn't exist (e.g. mid-switch). */
  selectedVehicle = computed(
    () =>
      VEHICLES.find((v) => v.brand === this.selectedBrand() && v.model === this.selectedModelName() && v.variant === this.selectedVariant()) ??
      VEHICLES[0],
  );
  // Colour surcharges (e.g. the Omoda C9 lineup's Matte Grey) are shown as a note next to the
  // colour — both here and on the poster's "Available in:" list — but no longer added to the
  // price; a colour is purely cosmetic now, never something that changes what the customer pays.
  basePrice = computed(() => this.selectedVehicle().price);

  /** The Colour field only appears when this car actually has a surcharge to show a note for
   *  (currently just the Omoda C9 lineup) — every other car's colours are informational only
   *  (see the poster's "Available in:" list), so a picker there would be a dropdown that does
   *  nothing. Data-driven off Vehicle.colourSurcharges rather than a hardcoded model check, so a
   *  future colour note on another car enables this automatically. */
  colourPickable = computed(() => {
    const vehicle = this.selectedVehicle();
    return Object.keys(vehicle.colourSurcharges ?? {}).length > 0 ? (vehicle.colours ?? []) : null;
  });

  /** The account's Primary Brand (Profile & Settings → Quote Preferences) starts every fresh quote — falls
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
    this.monthlyInstallmentDraft.set(null);
    this.clearRebateOverrides();
    // A different car has its own colour lineup — carrying over the previous car's pick could
    // silently select a colour (and its surcharge) this car doesn't even offer.
    this.selectedColour.set(this.selectedVehicle().colours?.[0] ?? null);
  }

  /** e.g. "Matte Grey (+RM 3,000)" — surfaces a colour's surcharge right in the dropdown so the SA
   *  sees the cost before picking it, not just after. */
  colourOptionLabel(colour: string): string {
    const surcharge = colourSurchargeFor(this.selectedVehicle(), colour);
    return surcharge > 0 ? `${colour} (+RM ${surcharge.toLocaleString('en-MY')})` : colour;
  }

  /** The model's own dealer rebate for the selected model year, when known, beats the standard
   *  starting rebate. */
  autoRebate = computed(() => rebateForYear(this.selectedVehicle(), this.modelYear()));
  rebateIsManual = computed(() => this.rebateManual() !== null);
  rebateInput = computed(() => this.rebateManual() ?? this.autoRebate());

  /** The model's own additional-rebate promo for the selected model year, when known, pre-fills
   *  and enables this by default — independent of Rebate above, since either can differ year to
   *  year on its own. */
  autoAdditionalRebate = computed(() => additionalRebateForYear(this.selectedVehicle(), this.modelYear()));
  additionalRebateIsManual = computed(() => this.additionalRebateManual() !== null);
  additionalRebateValue = computed(() => this.additionalRebateManual() ?? this.autoAdditionalRebate());

  /** Ticked when the car has an additional rebate and Settings says to include it by default. */
  autoAdditionalRebateEnabled = computed(
    () => additionalRebateForYear(this.selectedVehicle(), this.modelYear()) > 0 && (this.settingsService.settings().salesDefaults.additionalRebateByDefault ?? true),
  );
  additionalRebateEnabled = computed(() => this.additionalRebateEnabledManual() ?? this.autoAdditionalRebateEnabled());

  // No separate "prior-year bonus" — switching Model Year switches selectedVehicle() to that
  // year's own database row, so rebateInput() (via autoRebate) already reflects that year's figure.
  effectiveRebate = computed(() => this.rebateInput() + (this.additionalRebateEnabled() ? this.additionalRebateValue() : 0));

  /** Rebates belong to a specific car and model year — a figure typed for one must never ride
   *  along silently onto another (same reasoning as insurance/rate in onVariantChange). */
  private clearRebateOverrides() {
    this.rebateManual.set(null);
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
  }

  selectModelYear(year: number) {
    if (year === this.modelYear()) return;
    this.modelYear.set(year);
    this.clearRebateOverrides();
  }

  // Per-field "back to default" — tapping a Manual badge undoes just that one field.
  resetField(field: 'rebate' | 'additionalRebate' | 'insurance' | 'rate') {
    if (field === 'rebate') this.resetRebate();
    else if (field === 'additionalRebate') this.resetAdditionalRebate();
    else if (field === 'insurance') this.resetInsurance();
    else this.resetInterestRate();
  }

  resetRebate() {
    this.rebateManual.set(null);
  }

  resetAdditionalRebate() {
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
  }

  resetInsurance() {
    this.insuranceOverride.set(null);
  }

  resetInterestRate() {
    this.interestRateManual.set(null);
  }

  onRebateChange(value: number | null) {
    this.rebateManual.set(Math.max(0, value ?? 0));
  }

  onAdditionalRebateEnabledChange(value: boolean) {
    this.additionalRebateEnabledManual.set(value);
  }

  onAdditionalRebateChange(value: number | null) {
    this.additionalRebateManual.set(Math.max(0, value ?? 0));
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
  /** Same insurance quotation at 0% NCD — what the loan is sized against, so dialling in a better
   *  NCD only shrinks the downpayment (see computeQuotationTotals's loanBasisInsuranceAmount). */
  loanBasisInsurance = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), 0).totalDue);

  onInsuranceSaved(details: InsuranceQuotationDetails) {
    this.insuranceOverride.set(details);
    this.closeInsuranceBreakdown();
  }

  /** The model's own promo rate for whichever Rate Type is active, when known, beats the SA's
   *  general default — flat and effective are independently-quoted figures on the vehicle (see
   *  Vehicle.effectiveRate), so switching rate type looks up the matching field, not a conversion. */
  autoInterestRate = computed(() => defaultRateFor(this.selectedVehicle(), this.rateType(), this.settingsService.settings().salesDefaults));
  interestRateIsManual = computed(() => this.interestRateManual() !== null);
  /** Quoting EIR on a car with no EIR anywhere (its own or the account default) and none typed —
   *  the SA must enter the bank's rate; sharing is blocked until they do (see the preview column). */
  rateMissing = computed(() => this.interestRateManual() === null && this.autoInterestRate() === null);
  interestRate = computed(() => this.interestRateManual() ?? this.autoInterestRate() ?? 0);

  onInterestRateChange(value: number | null) {
    this.interestRateManual.set(value == null ? null : Math.max(0, value));
  }

  // Insurance and Interest Rate are usually left on their defaults, so they fold into one-line
  // summaries; the rate section forces itself open while a rate is missing.
  insuranceOpen = signal(false);
  rateOpen = signal(false);
  rateExpanded = computed(() => this.rateOpen() || this.rateMissing());

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
      loanBasisInsuranceAmount: this.loanBasisInsurance(),
      downpaymentType: this.downpaymentType(),
      downpaymentValue: this.downpaymentValue(),
      minDownpaymentCash: this.minDownpayment(),
    }),
  );
  /** This variant's minimum cash downpayment (Price Settings), 0 when it has none. */
  minDownpayment = computed(() => minDownpaymentCash(this.selectedVehicle().minDownpayment, this.basePrice()));
  /** Cash the customer must still put down to meet the minimum — the minimum is before rebate, so
   *  the rebate counts towards it. */
  minCashNeeded = computed(() => roundCents(Math.max(0, this.minDownpayment() - this.effectiveRebate())));
  /** True when what was entered fell short of the minimum and the quote was raised to it. */
  downpaymentRaisedToMin = computed(() => {
    const min = this.minDownpayment();
    if (min <= 0 || this.totals().loanAmount === 0) return false;
    const unclamped = computeQuotationTotals({
      basePrice: this.basePrice(),
      effectiveRebate: this.effectiveRebate(),
      insuranceAmount: this.insurance(),
      loanBasisInsuranceAmount: this.loanBasisInsurance(),
      downpaymentType: this.downpaymentType(),
      downpaymentValue: this.downpaymentValue(),
    });
    return unclamped.downpaymentCash < this.totals().downpaymentCash;
  });

  allInPrice = computed(() => this.totals().totalAmountDue);
  downpaymentCash = computed(() => this.totals().downpaymentCash);
  loanAmount = computed(() => this.totals().loanAmount);
  /** A straight cash deal, no financing at all — e.g. downpayment dialled up to 100%. Poster
   *  templates that show a loan/monthly breakdown need to know this so they can drop it. */
  isCashPurchase = computed(() => this.loanAmount() === 0);

  // The Loan Amount field mustn't fight the SA mid-keystroke: since loanAmount() is always
  // floored to the nearest RM100, binding the input straight to it would snap "82400" back to
  // "82000" (or worse) after every digit typed, before they've finished. A draft signal holds
  // whatever's currently typed, unrounded, and only commits (floors + updates downpayment) on
  // blur/Enter — so the field shows exactly what was typed while editing.
  private loanAmountDraft = signal<number | null>(null);

  /** One-tap downpayment setups: 10% of the price, or Full Loan (no cash down beyond the RM100
   *  rounding remainder). */
  applyDownpaymentPreset(preset: 'tenPercent' | 'fullLoan') {
    this.loanAmountDraft.set(null);
    this.monthlyInstallmentDraft.set(null);
    if (preset === 'tenPercent') {
      this.downpaymentType.set('percent');
      this.downpaymentValue.set(10);
    } else {
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(this.minCashNeeded());
    }
  }

  isDownpaymentPreset(preset: 'tenPercent' | 'fullLoan'): boolean {
    const type = this.downpaymentType();
    if (preset === 'tenPercent') return type === 'percent' && this.downpaymentValue() === 10;
    return type === 'amount' && this.downpaymentValue() === this.minCashNeeded();
  }

  /** Unlike Loan Amount/Monthly Installment (which need a draft signal so the derived, rounded
   *  figure doesn't fight a mid-keystroke value — see loanAmountDraft above), Downpayment IS the
   *  primary value, so it can bind straight to the signal and update everything else live, no
   *  draft needed. But in Amt mode, whatever cash figure was typed is never exactly what ends up
   *  charged: the loan behind it is floored to the nearest RM100 (see totals()), and that rounding
   *  remainder spills back into the cash downpayment — same "remainder goes to the downpayment"
   *  rule the Loan Amount field's own helper text already describes. The poster and the Loan
   *  Amount field both reflect that real, spilled-over figure; settle the field to match once the
   *  SA is done typing, so it never sits there showing a number that was never actually charged. */
  commitDownpayment() {
    if (this.downpaymentType() === 'percent') {
      this.downpaymentValue.set(Math.min(Math.max(0, this.downpaymentValue()), 100));
    } else {
      this.downpaymentValue.set(this.totals().downpaymentCash);
    }
  }
  loanAmountDisplay = computed(() => this.loanAmountDraft() ?? this.loanAmount());

  /** Shown under Loan Amount / Monthly Installment when what was typed couldn't be honoured in
   *  full (asked for more than the whole amount due) — cleared as soon as they type again. */
  loanCapNote = signal<string | null>(null);
  monthlyCapNote = signal<string | null>(null);

  onLoanAmountInput(value: number | null) {
    this.loanCapNote.set(null);
    this.loanAmountDraft.set(Math.max(0, value ?? 0));
  }

  commitLoanAmount() {
    const draft = this.loanAmountDraft();
    if (draft !== null) {
      if (draft > this.allInPrice()) {
        this.loanCapNote.set(`Capped at ${this.fmt(this.allInPrice())} — the loan can't be more than the total amount due.`);
      }
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - draft)));
      this.monthlyInstallmentDraft.set(null);
    }
    this.loanAmountDraft.set(null);
  }

  /** The percent-mode down payment before rebates, and how rebates bring it down — rebates come
   *  off the cash down payment (see computeQuotationTotals), so "10%" can end up far below 10%. */
  downpaymentRebateNote = computed(() => {
    if (this.downpaymentType() !== 'percent' || this.effectiveRebate() <= 0 || this.isCashPurchase()) return null;
    const referenceTotal = this.basePrice() + this.loanBasisInsurance();
    const before = roundCents((Math.max(0, this.downpaymentValue()) / 100) * referenceTotal);
    return { pct: this.downpaymentValue(), before, rebate: this.effectiveRebate(), after: this.downpaymentCash(), covered: this.effectiveRebate() >= before };
  });

  /** Same draft/commit pattern as the Loan Amount field above — holds whatever's typed until
   *  blur/Enter, then works backwards from "I want to pay about RM X/month" to the loan amount
   *  that implies, and from there to the deposit. Targets the longest of the 3 selected poster
   *  tenures (e.g. 5/7/9 picked → 9 years) — that's the worst-case, highest-instalment row in the
   *  repayment table above, so aiming the deposit at it keeps every shorter tenure under budget
   *  too. Falls back to whatever's typed into Custom Tenure while that's active, since the table
   *  then shows only that one row instead of the poster set. */
  private monthlyInstallmentDraft = signal<number | null>(null);
  monthlyInstallmentTenureMonths = computed(() =>
    this.customTenureActive() ? this.highlightedTenure() : Math.max(...this.posterTenureYears()) * 12,
  );
  monthlyInstallmentTenureLabel = computed(() => {
    const m = this.monthlyInstallmentTenureMonths();
    return m % 12 === 0 ? `${m / 12} Yrs` : `${m} mo`;
  });
  /** Once committed, shows the instalment the loan actually settled on — not necessarily what was
   *  typed, since the loan behind it is floored to the nearest RM100 (see commitMonthlyInstallment)
   *  the same way a manually-typed Loan Amount is. Closest achievable, not exact. */
  monthlyInstallmentDisplay = computed(() =>
    this.monthlyInstallmentDraft() ?? roundCents(monthlyPayment(this.loanAmount(), this.interestRate(), this.monthlyInstallmentTenureMonths(), this.rateType())),
  );

  onMonthlyInstallmentInput(value: number | null) {
    this.monthlyCapNote.set(null);
    this.monthlyInstallmentDraft.set(Math.max(0, value ?? 0));
  }

  commitMonthlyInstallment() {
    const draft = this.monthlyInstallmentDraft();
    if (draft !== null) {
      const impliedLoan = loanForMonthlyPayment(draft, this.interestRate(), this.monthlyInstallmentTenureMonths(), this.rateType());
      if (impliedLoan > this.allInPrice()) {
        this.monthlyCapNote.set(`${this.fmt(draft)}/mo would cover more than the whole car — the loan is capped at the total amount due.`);
      }
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - impliedLoan)));
      this.loanAmountDraft.set(null);
    }
    this.monthlyInstallmentDraft.set(null);
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
    this.highlightedTenure.set(Math.min(120, Math.max(1, Math.round(+value || 1))));
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

  brandLogoUrl = computed(() => brandLogo(this.selectedVehicle().brand));

  quoteDate = computed(() => new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }));

  sourceTypes = this.settingsService.leadSources;
  financingTypeOptions = FINANCING_TYPE_OPTIONS;
  leadModalOpen = signal(false);
  leadSaved = signal(false);
  leadName = '';
  leadPhone = '';
  leadSource = DEFAULT_LEAD_SOURCE;
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
  readonly templates: PosterTemplate[] = [classicTemplate, compactMyTemplate, squareTemplate, promoTemplate];
  /** The compact MY template's entire design is a monthly-payment figure — there's no sensible
   *  cash-buyer version of a poster whose headline is a monthly instalment, so it drops out of the
   *  picker entirely for a cash deal rather than needing its own cash layout. */
  availableTemplates = computed(() => {
    const data = this.buildPosterData();
    return this.templates.filter((t) => !(this.isCashPurchase() && t.id === 'compact-my') && (t.isAvailable?.(data) ?? true));
  });
  selectedTemplateId = signal<PosterTemplateId>('classic');
  currentTemplate = computed(() => this.availableTemplates().find((t) => t.id === this.selectedTemplateId()) ?? this.availableTemplates()[0]);
  /** Caps the preview's width for the social shapes, which would otherwise stretch to the full column. */
  previewWidthClass = computed(() => {
    switch (this.currentTemplate().aspect) {
      case 'square':
        return 'max-w-[520px]';
      case 'promo':
        return 'max-w-[440px]';
      default:
        return '';
    }
  });

  /** Assembles the plain data object the renderer draws from — nothing in poster-renderer.ts
   *  reads a component signal directly, so every figure on the poster traces back to here. */
  private buildPosterData(): PosterData {
    const vehicle = this.selectedVehicle();
    const advisorProfile = this.advisor.profile();
    const lang = this.settingsService.settings().salesDefaults.posterLanguage ?? 'en';
    return {
      lang,
      brand: vehicle.brand,
      modelTitle: modelVariantLabel(vehicle.model, vehicle.variant),
      year: this.modelYear(),
      dateStr: new Date().toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: '2-digit', month: 'short', year: 'numeric' }),
      logoUrl: this.brandLogoUrl(),
      carImageUrl: vehicle.photoUrl ?? null,
      colours: vehicle.colours ?? [],
      colourSurcharges: vehicle.colourSurcharges ?? {},

      sellingPrice: this.allInPrice(),
      downpayment: this.downpaymentCash(),
      loanAmount: this.loanAmount(),
      isCashPurchase: this.isCashPurchase(),
      advisor: {
        name: advisorProfile.name,
        role: advisorProfile.role,
        initials: this.advisor.initials(),
        photoUrl: advisorProfile.photoUrl ?? null,
        phoneDisplay: advisorProfile.phoneDisplay,
        bio: advisorProfile.bio,
      },

      otrPrice: this.basePrice(),
      ncdPct: this.ncd(),
      insurance: this.insurance(),
      rebate: this.effectiveRebate(),
      totalAmountDue: this.allInPrice(),

      rateLabel: `${this.interestRate()}% ${this.rateType() === 'flat' ? translate(lang, 'FLAT') : 'EIR'}`,
      interestRatePct: this.interestRate(),
      tenureRows: this.repaymentRows().map((row) => ({
        label: translate(lang, row.label),
        months: row.months,
        monthly: row.monthly,
        isLowest: row.months === Math.max(...this.repaymentRows().map((r) => r.months)),
      })),
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
    const defaults = this.settingsService.settings().salesDefaults;
    this.leadSource = defaults.leadSource ?? this.sourceTypes()[0] ?? DEFAULT_LEAD_SOURCE;
    // Matches whatever the quote is actually showing right now — a downpayment already dialled
    // to 100% is a cash deal, so the lead shouldn't default back to Hire Purchase just because
    // that's the modal's own baseline.
    this.leadFinancingType = this.isCashPurchase() ? 'Cash' : 'Loan';
    this.leadSaved.set(false);
    this.leadModalOpen.set(true);
  }

  closeLeadModal() {
    this.leadModalOpen.set(false);
  }

  /** Any existing customer (any stage) whose phone matches what's typed here — the Add Lead
   *  modal is for brand-new contacts only, so a match blocks Save Lead / WhatsApp entirely rather
   *  than risking a second record for someone already in the pipeline. */
  existingLeadForPhone(): CustomerRecord | undefined {
    if (!this.leadPhone) return undefined;
    const digits = toMalaysianWhatsAppNumber(this.leadPhone);
    return this.customers.records().find((r) => toMalaysianWhatsAppNumber(r.phone) === digits);
  }

  // Guards against creating a duplicate record if Save Lead is clicked more than once in the
  // same modal session, instead of tracking a returned record id.
  private async saveLeadRecord() {
    if (this.leadSaved() || this.existingLeadForPhone()) return;
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
    // Only closes once the lead actually saved — never on the early-return path (a duplicate
    // phone), where the modal needs to stay open so the SA can see and act on that warning.
    if (this.leadSaved()) this.closeLeadModal();
  }

  /**
   * Saves the lead and opens WhatsApp in one go. Order matters: the clipboard write and the
   * WhatsApp window both have to happen while the tap's user-activation is still fresh, so the
   * save (a network round-trip) runs alongside them rather than first; the modal closes once the
   * save has landed.
   */
  async saveAndWhatsApp() {
    if (this.sendingWhatsApp() || this.existingLeadForPhone()) return;
    const saving = this.saveLeadRecord();
    await this.openWhatsAppForLead();
    await saving;
    if (this.leadSaved()) this.closeLeadModal();
  }

  async openWhatsAppForLead() {
    if (this.sendingWhatsApp() || this.existingLeadForPhone()) return;
    this.sendingWhatsApp.set(true);
    try {
      const vehicle = this.selectedVehicle();
      const vehicleLabel = vehicleTitle(vehicle.brand, modelVariantLabel(vehicle.model, vehicle.variant));
      const msg =
        `Hi ${this.leadName}, thank you for your interest in the ${vehicleLabel}. ` +
        `Selling price ${this.fmt(this.allInPrice())}, downpayment ${this.fmt(this.downpaymentCash())}. ` +
        `Let me know if you have any questions!`;
      const phone = toMalaysianWhatsAppNumber(this.leadPhone);

      // Copy the poster image to the clipboard first so it's just a paste away once WhatsApp
      // opens — same "pass the still-pending blob promise" trick as copyPosterImage() so the
      // write is issued while the click's user-activation window is still open. Best-effort:
      // WhatsApp still opens with the text below even if the image copy fails or isn't supported.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': this.renderPosterPngBlob() })]);
          this.whatsAppImageCopied.set(true);
          setTimeout(() => this.whatsAppImageCopied.set(false), 2500);
        } catch {
          /* clipboard write not available/denied — WhatsApp still opens below */
        }
      }

      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } finally {
      this.sendingWhatsApp.set(false);
    }
  }

  /** Download quality is independent of preview quality — a dedicated (never-visible) canvas
   *  rendered fresh at 4x the design grid (900px design → 3600px output), well above the
   *  on-screen preview's 2x. Text, price figures, and every other vector/canvas-drawn element
   *  redraw natively at this resolution, so raising this constant genuinely sharpens the whole
   *  poster — it isn't just "the same blurry image, bigger". The one exception is the car photo
   *  itself: several source images in public/cars (notably the Proton lineup, ~640px wide) don't
   *  have enough real detail to stay crisp once stretched to fill their spot on the poster, and no
   *  export scale can fix that — only higher-resolution source photos can. */
  private static readonly EXPORT_SCALE = 4;

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

  private posterFileName(): string {
    const v = this.selectedVehicle();
    const t = this.currentTemplate();
    const suffix = t.aspect ? `-${t.label}` : '';
    return `Quote-${vehicleTitle(v.brand, v.model)}${suffix}.png`.replace(/\s*\|\s*/g, '-').replace(/\s+/g, '-');
  }

  private async downloadPosterBlob(blob: Blob): Promise<void> {
    downloadBlob(new Uint8Array(await blob.arrayBuffer()), this.posterFileName(), 'image/png');
  }

  private canShareFile(file: File): boolean {
    return !!(navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare?.({ files: [file] });
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
    this.settingsService.markQuoteShared();
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

  sharingPoster = signal(false);
  /** Shown only when the OS share sheet isn't available at all and the poster was downloaded as
   *  a plain fallback instead — same pattern as the Brochures page's file-share fallback. */
  posterShareFallbackNotice = signal(false);

  /** Hands the rendered poster PNG straight to the OS share sheet — same file-share pattern the
   *  Brochures page uses for its brochure PDFs, just a PNG instead of a PDF since the poster is a
   *  single rendered image, not a multi-page document. Reaches WhatsApp, Telegram, email, etc.
   *  directly, no manual save-then-attach round trip. Falls back to a plain download only when
   *  file sharing isn't supported at all; a cancelled or failed share attempt is left alone rather
   *  than forced into a download, matching sendBrochureFile's own behaviour. */
  async sharePosterImage() {
    if (this.sharingPoster()) return;
    this.sharingPoster.set(true);
    this.settingsService.markQuoteShared();
    try {
      const blob = await this.renderPosterPngBlob();
      const file = new File([blob], this.posterFileName(), { type: 'image/png' });
      if (this.canShareFile(file)) {
        const advisorProfile = this.advisor.profile();
        try {
          await navigator.share({ files: [file], title: 'Vehicle Quote', text: `${advisorProfile.name}, ${advisorProfile.role}` });
        } catch {
          /* cancelled or failed — nothing actionable here, same as the brochure share */
        }
        return;
      }
      await this.downloadPosterBlob(blob);
      this.posterShareFallbackNotice.set(true);
      setTimeout(() => this.posterShareFallbackNotice.set(false), 5000);
    } finally {
      this.sharingPoster.set(false);
    }
  }

  /** Resets every quote setting (rebate, insurance, rate, downpayment, tenure) back to this
   *  car's own defaults — leaves the selected brand/model/variant/year untouched, since switching
   *  cars is its own separate action, not something "Reset" should also do. */
  reset() {
    const defaults = this.settingsService.settings().salesDefaults;
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
    this.monthlyInstallmentDraft.set(null);
  }
}
