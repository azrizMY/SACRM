import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { BrandIconComponent } from '../shared/brand-icon.component';
import { hasShowroom, showroomMapsHref, showroomWazeHref, socialEntries } from '../data/social-data';
import { TourService, type TourStep } from '../shared/tour.service';
import { fetchPublicQuote, type PublicQuoteBundle } from '../shared/public-quote-api';
import { posterFontsReady } from '../shared/poster-theme';
import { classicTemplate } from '../shared/poster-template-classic';
import type { PosterData } from '../shared/poster-data';
import { brandLogo, formatMalaysianPhone } from '../data/dashboard-data';
import { DEFAULT_EPR, defaultInsuranceQuotation } from '../data/calculator-data';
import {
  DEFAULT_VEHICLES,
  NCD_OPTIONS,
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
  rebateForYear,
  roundCents,
  variantLabel,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
  type VehicleOverride,
  vehicleTitle,
} from '../data/calculator-data';

/** The full 1-9 year range the tenure picker offers — same range as the Calculator's own poster
 *  year buttons, just single-select here instead of "pick 3 for a comparison table". */
const TENURE_YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 1);

type PageSection = 'quote' | 'profile' | 'cars';

@Component({
  selector: 'app-public-quote',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BrandIconComponent],
  template: `
    @if (loading()) {
      <div class="flex min-h-screen items-center justify-center">
        <app-icon name="refresh-cw" [size]="24" class="animate-spin text-muted-foreground" />
      </div>
    } @else if (notFound()) {
      <div class="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <app-icon name="x-circle" [size]="28" class="text-muted-foreground" />
        <h1 class="text-lg font-semibold">This link isn't valid</h1>
        <p class="max-w-xs text-sm text-muted-foreground">Please check the link your sales advisor sent you, or ask them to resend it.</p>
      </div>
    } @else {
      <!-- Desktop side menu (mobile/tablet use the bottom tab bar) -->
      <aside class="glass fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r border-border px-4 py-6 xl:flex">
        <div class="flex flex-col items-center gap-2 px-2 text-center">
          @if (bundle()!.advisor.photoUrl; as photo) {
            <img [src]="photo" alt="" class="size-16 rounded-full object-cover ring-2 ring-primary/60 ring-offset-2 ring-offset-background" />
          } @else {
            <span class="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white/90" [style.background]="avatarGradient">{{ advisorInitials() }}</span>
          }
          <div class="flex min-w-0 max-w-full flex-col gap-0.5">
            <span class="truncate text-sm font-semibold">{{ bundle()!.advisor.name }}</span>
            @if (bundle()!.advisor.role; as role) {
              <span class="truncate text-xs text-muted-foreground">{{ role }}</span>
            }
          </div>
        </div>
        <nav role="tablist" aria-label="Page sections" aria-orientation="vertical" class="flex flex-col gap-1">
          @for (t of sections; track t.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="section() === t.id"
              (click)="selectSection(t.id)"
              class="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200"
              [ngClass]="section() === t.id ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              @if (section() === t.id) {
                <span class="absolute inset-y-2 -left-4 w-[3px] rounded-r-full bg-primary"></span>
              }
              <app-icon [name]="t.icon" [size]="18" />
              {{ t.label }}
            </button>
          }
        </nav>
      </aside>

      <div class="xl:pl-60">
      <div [class.hidden]="section() !== 'quote'">
      <div class="mx-auto flex max-w-7xl flex-col gap-6 p-4 pb-24 md:p-6 md:pb-24 xl:pb-6 2xl:max-w-[1800px]">
        <!-- Mobile Preview/Customize switcher -->
        <!-- Pinned flush to the top (pulled up over the page's own top padding) so no strip of the
             background glow shows above it. -->
        <div class="sticky top-0 z-10 -mx-4 -mt-4 flex flex-col gap-2 border-b border-border bg-background px-4 pb-2 pt-4 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 xl:hidden">
          <div class="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            @if (isCashPurchase()) {
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Selling price</span>
              <span class="text-sm font-bold tabular">{{ fmt2(allInPrice()) }}</span>
            } @else {
              <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Monthly · {{ tenureYears() }} yrs</span>
              <span class="text-sm font-bold tabular text-primary">{{ fmt2(monthlyInstalment()) }}</span>
            }
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

        <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] 2xl:gap-8">
          <!-- Quote preview -->
          <div
            class="flex-col gap-2 xl:sticky xl:top-4 xl:flex"
            [ngClass]="mobileTab() === 'preview' ? 'flex' : 'hidden'"
          >
            <div data-tour="quote-preview" class="shrink-0 overflow-hidden rounded-xl shadow-md xl:mx-auto">
              <canvas #posterCanvas class="block h-auto w-full xl:mx-auto xl:w-auto xl:max-w-full xl:max-h-[calc(100vh-6.5rem)]"></canvas>
            </div>
            @if (bundle()!.advisor.phoneWa) {
              <button
                type="button"
                data-tour="quote-whatsapp"
                (click)="openWhatsAppToAdvisor()"
                class="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 xl:hidden"
              >
                <app-icon name="message-circle" [size]="16" />
                WhatsApp Me Here
              </button>
            }
            <p class="shrink-0 text-balance text-center text-[10px] leading-relaxed text-muted-foreground">
              <app-icon name="info" [size]="12" class="mr-1 inline-block align-[-2px]" />
              Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here.
            </p>

            <!-- Phones/tablets: Follow Me below the disclaimer (desktop shows it in the Customize column) -->
            <!-- A compact one-row card so it fits the gap above the bottom bar without making the
                 page much longer than the stacked desktop version would. -->
            @if (socials().length) {
              <div class="flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground xl:hidden">
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="text-xs font-bold">Follow Me</span>
                  <span class="truncate text-[11px] text-muted-foreground">Latest promos &amp; new arrivals</span>
                </span>
                @for (s of socials(); track s.id) {
                  <a
                    [href]="s.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="s.label + ' (opens in a new tab)'"
                    [title]="s.label"
                    class="rounded-lg outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <app-brand-icon [name]="s.id" [size]="34" [tile]="true" />
                  </a>
                }
              </div>
            }
          </div>

          <!-- The SA's social links (same set as Profile's "Follow Me"), compact -->
          <ng-template #followMe>
            @if (socials().length) {
              <section class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground">
                <span class="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Follow Me</span>
                <div class="flex flex-wrap justify-center gap-x-1 gap-y-3">
                  @for (s of socials(); track s.id) {
                    <a
                      [href]="s.href"
                      target="_blank"
                      rel="noopener noreferrer"
                      [attr.aria-label]="s.label + ' (opens in a new tab)'"
                      class="group flex w-16 flex-col items-center gap-1 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <app-brand-icon [name]="s.id" [size]="42" [tile]="true" class="transition-transform group-hover:scale-105 group-active:scale-95" />
                      <span class="w-full truncate text-center text-[10px] font-medium text-muted-foreground group-hover:text-foreground">{{ s.label }}</span>
                    </a>
                  }
                </div>
              </section>
            }
          </ng-template>

          <!-- Customize quote -->
          <div
            class="flex-col gap-4 xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1 2xl:static 2xl:max-h-none 2xl:overflow-visible 2xl:pr-0"
            [ngClass]="mobileTab() === 'customize' ? 'flex' : 'hidden'"
          >
            <div class="flex items-center justify-between">
              <h3 class="shrink-0 whitespace-nowrap text-base font-semibold leading-none">Customize Quote</h3>
              <div class="flex items-center gap-1">
                @if (bundle()!.advisor.phoneWa) {
                  <button
                    type="button"
                    data-tour="quote-whatsapp"
                    (click)="openWhatsAppToAdvisor()"
                    class="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent xl:flex"
                  >
                    <app-icon name="message-circle" [size]="13" />
                    WhatsApp Me Here
                  </button>
                }
                <button
                  type="button"
                  (click)="startTour()"
                  aria-label="How this page works"
                  title="How this page works"
                  class="flex shrink-0 items-center rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="info" [size]="15" />
                </button>
                <button
                  type="button"
                  (click)="reset()"
                  class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="refresh-cw" [size]="13" />
                  Reset
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-4 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-4">
              <div class="flex flex-col gap-4">
              <!-- Select car -->
              <div data-tour="quote-car" class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
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

              @if (selectedVehicle().colours; as colours) {
                <div class="flex flex-col gap-2">
                  <label for="colourSelect" class="text-xs font-medium text-muted-foreground">Colour</label>
                  <select
                    id="colourSelect"
                    [ngModel]="selectedColour()"
                    (ngModelChange)="selectedColour.set($event)"
                    class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                  >
                    <option [ngValue]="null">Not Confirmed</option>
                    @for (c of colours; track c) { <option [ngValue]="c">{{ colourOptionLabel(c) }}</option> }
                  </select>
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

            <!-- Desktop: Follow Me under Insurance — on wide screens this lands beside Tenure -->
            <div class="hidden xl:block">
              <ng-container [ngTemplateOutlet]="followMe" />
            </div>
              </div>

              <div class="flex flex-col gap-4">
            <!-- Interest Rate -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interest Rate</span>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Interest Rate</span>
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 opacity-80">
                  <span class="text-sm font-medium tabular">{{ interestRate() }}%</span>
                  <span class="text-xs text-muted-foreground">{{ rateType() === 'flat' ? 'Flat' : 'EIR' }}</span>
                </div>
              </div>
            </div>

            <!-- Loan setup -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loan Setup</span>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Downpayment</span>
                <div data-tour="quote-downpayment" role="group" aria-label="Quick downpayment presets" class="grid grid-cols-2 gap-1.5">
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
                    {{ minDownpayment() > 0 ? 'Minimum' : 'Full Loan' }}
                  </button>
                </div>
                <div class="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    [attr.max]="downpaymentType() === 'percent' ? 100 : null"
                    [step]="downpaymentType() === 'percent' ? 1 : 500"
                    [ngModel]="downpaymentValue()"
                    (ngModelChange)="downpaymentValue.set(+$event || 0)"
                    (blur)="commitDownpayment()"
                    (keydown.enter)="commitDownpayment()"
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
                @if (minDownpayment() > 0) {
                  @if (downpaymentRaisedToMin()) {
                    <div class="flex items-start gap-2 rounded-lg bg-[var(--warning)]/12 px-3 py-2 text-[11px] text-foreground">
                      <app-icon name="alert-triangle" [size]="13" class="mt-px shrink-0 text-[var(--warning)]" />
                      <span>This car needs a <strong>{{ fmt(minDownpayment()) }}</strong> minimum downpayment (rebate counts towards it) — raised to meet it.</span>
                    </div>
                  } @else {
                    <span class="text-[11px] text-muted-foreground">Minimum downpayment for this car: {{ fmt(minDownpayment()) }} before rebate</span>
                  }
                }
              </div>

              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border"></div>
                <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">or</span>
                <div class="h-px flex-1 bg-border"></div>
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

              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border"></div>
                <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">or</span>
                <div class="h-px flex-1 bg-border"></div>
              </div>

              <div class="flex flex-col gap-2">
                <label for="monthlyInstallmentInput" class="text-xs font-medium text-muted-foreground">Monthly Installment (RM)</label>
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input/30 px-3 py-2 focus-within:border-ring">
                  <span class="text-sm font-medium text-muted-foreground">RM</span>
                  <input
                    id="monthlyInstallmentInput"
                    type="number"
                    min="0"
                    step="10"
                    inputmode="numeric"
                    [ngModel]="monthlyInstallmentDisplay()"
                    (ngModelChange)="onMonthlyInstallmentInput($event)"
                    (blur)="commitMonthlyInstallment()"
                    (keydown.enter)="commitMonthlyInstallment()"
                    class="w-full bg-transparent text-sm font-medium tabular outline-none"
                  />
                </div>
                <span class="text-[11px] text-muted-foreground">Targets the {{ tenureYears() }} Yrs tenure and works backwards to the loan amount and deposit.</span>
              </div>
            </div>

            <!-- Tenure -->
            <div data-tour="quote-tenure" class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
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
        </div>
      </div>
      </div>

      @if (section() === 'profile') {
        <div class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-28 md:p-6 md:pb-28 xl:py-8">
          <!-- Advisor card -->
          <section class="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
            <div class="h-24 bg-gradient-to-br from-primary/70 via-primary/25 to-card sm:h-28"></div>
            <div class="-mt-12 flex flex-col items-center gap-3 px-5 pb-5 text-center sm:-mt-14">
              @if (bundle()!.advisor.photoUrl; as photo) {
                <img [src]="photo" alt="" class="size-24 rounded-full object-cover ring-4 ring-card sm:size-28" />
              } @else {
                <span class="flex size-24 items-center justify-center rounded-full text-3xl font-bold text-white/90 ring-4 ring-card sm:size-28" [style.background]="avatarGradient">
                  {{ advisorInitials() }}
                </span>
              }
              <div class="flex flex-col items-center gap-1.5">
                <h1 class="text-balance text-xl font-semibold tracking-tight">{{ bundle()!.advisor.name }}</h1>
                @if (bundle()!.advisor.role; as role) {
                  <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{{ role }}</span>
                }
                @if (bundle()!.advisor.phoneDisplay; as phone) {
                  <span class="text-sm tabular text-muted-foreground">{{ formatPhone(phone) }}</span>
                }
              </div>
              @if (bundle()!.advisor.bio; as bio) {
                <p class="max-w-md whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">{{ bio }}</p>
              }
              @if (callHref() || profileWhatsAppHref()) {
                <div class="grid w-full auto-cols-fr grid-flow-col gap-2 pt-1">
                  @if (callHref(); as href) {
                    <a
                      [href]="href"
                      class="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                      <app-icon name="phone" [size]="16" />
                      Call
                    </a>
                  }
                  @if (profileWhatsAppHref(); as href) {
                    <a
                      [href]="href"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-95"
                    >
                      <app-brand-icon name="whatsapp" [size]="16" />
                      WhatsApp
                    </a>
                  }
                </div>
              }
            </div>
          </section>

          <!-- Showroom -->
          @if (showroom(); as s) {
            <section class="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div class="flex items-start gap-3">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <app-icon name="map-pin" [size]="18" />
                </span>
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visit the Showroom</span>
                  <span class="text-sm font-semibold">{{ s.name || 'Showroom' }}</span>
                  @if (s.address; as address) {
                    <p class="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{{ address }}</p>
                  }
                </div>
              </div>
              <div class="grid auto-cols-fr grid-flow-col gap-2">
                @if (showroomMapsHref(); as href) {
                  <a
                    [href]="href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <app-brand-icon name="googlemaps" [size]="16" class="text-[#4285F4]" />
                    Google Maps
                  </a>
                }
                @if (showroomWazeHref(); as href) {
                  <a
                    [href]="href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <app-brand-icon name="waze" [size]="16" class="text-[#33CCFF]" />
                    Waze
                  </a>
                }
              </div>
            </section>
          }

          <!-- Social media -->
          @if (socials().length) {
            <section class="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <span class="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Follow Me</span>
              <div class="flex flex-wrap justify-center gap-x-2 gap-y-4">
                @for (s of socials(); track s.id) {
                  <a
                    [href]="s.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="s.label + ' (opens in a new tab)'"
                    class="group flex w-[4.5rem] flex-col items-center gap-1.5 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <app-brand-icon [name]="s.id" [size]="52" [tile]="true" class="transition-transform group-hover:scale-105 group-active:scale-95" />
                    <span class="w-full truncate text-center text-[11px] font-medium text-muted-foreground group-hover:text-foreground">{{ s.label }}</span>
                  </a>
                }
              </div>
            </section>
          }

          <button
            type="button"
            (click)="selectSection('cars')"
            class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-left text-card-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <span class="flex items-center gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <app-icon name="car" [size]="18" />
              </span>
              <span class="flex flex-col gap-0.5">
                <span class="text-sm font-semibold">Browse cars &amp; brochures</span>
                <span class="text-xs text-muted-foreground">See every model and open its brochure.</span>
              </span>
            </span>
            <app-icon name="chevron-right" [size]="18" class="shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            (click)="selectSection('quote')"
            class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-left text-card-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <span class="flex items-center gap-3">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <app-icon name="calculator" [size]="18" />
              </span>
              <span class="flex flex-col gap-0.5">
                <span class="text-sm font-semibold">Build your own quote</span>
                <span class="text-xs text-muted-foreground">See your monthly instalment in under a minute.</span>
              </span>
            </span>
            <app-icon name="chevron-right" [size]="18" class="shrink-0 text-muted-foreground" />
          </button>
        </div>
      }

      <!-- Cars: the SA's lineup with brochures, grouped by model. View + quote only — no Share here,
           since this page is the customer's, not the SA's. -->
      @if (section() === 'cars') {
        <div class="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-28 md:p-6 md:pb-28 xl:py-8">
          <div class="flex flex-col gap-1">
            <h1 class="text-xl font-bold tracking-tight">Cars &amp; brochures</h1>
            <p class="text-sm text-muted-foreground">Browse the lineup, open a brochure, or get a quote for any car.</p>
          </div>

          @if (carsBrands().length > 1) {
            <div role="tablist" aria-label="Brand" class="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
              @for (b of carsBrands(); track b) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="carsBrand() === b"
                  (click)="selectCarsBrand(b)"
                  class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                  [ngClass]="carsBrand() === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  {{ b }}
                </button>
              }
            </div>
          }

          @for (g of carGroupsForBrowse(); track g.key) {
            <section class="flex flex-col gap-3">
              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 class="text-lg font-bold tracking-tight">{{ vehicleTitle(g.brand, g.model) }}</h2>
                <span class="text-xs text-muted-foreground">
                  {{ g.cars.length }} {{ g.cars.length === 1 ? 'variant' : 'variants' }} · from
                  <span class="font-semibold text-foreground tabular">{{ fmt(g.fromPrice) }}</span>
                </span>
              </div>
              <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 md:mx-0 md:scroll-px-0 md:px-0">
                @for (v of g.cars; track v.id) {
                  <article class="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[220px] flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
                    <div class="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[oklch(0.9_0.005_280)]">
                      @if (v.photoUrl) {
                        <img [src]="v.photoUrl" [alt]="modelVariantLabel(v.model, v.variant)" loading="lazy" class="h-full w-full object-contain p-2.5" />
                      } @else {
                        <app-icon name="car" [size]="28" class="text-muted-foreground" />
                      }
                      @if (browseRebate(v) > 0) {
                        <span class="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow">
                          Rebate {{ fmt(browseRebate(v)) }}
                        </span>
                      }
                    </div>
                    <div class="flex flex-1 flex-col gap-2.5 p-3">
                      <div class="flex min-w-0 flex-col gap-1">
                        <span class="truncate text-sm font-bold">{{ variantText(v.variant) || v.model }}</span>
                        <span class="text-xs text-muted-foreground"><span class="font-semibold text-foreground tabular">{{ fmt(v.price) }}</span> OTR</span>
                      </div>
                      <div class="mt-auto flex gap-2">
                        @if (v.brochureUrl) {
                          <a
                            [href]="v.brochureUrl"
                            target="_blank"
                            rel="noopener"
                            class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                          >
                            <app-icon name="file-text" [size]="13" />
                            Brochure
                          </a>
                        }
                        <button
                          type="button"
                          (click)="quoteThisCar(v)"
                          class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/12 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          <app-icon name="calculator" [size]="13" />
                          Quote
                        </button>
                      </div>
                    </div>
                  </article>
                }
              </div>
            </section>
          }
        </div>
      }
      </div>

      <!-- Mobile/tablet bottom tab bar -->
      <nav
        aria-label="Page sections"
        class="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] xl:hidden"
      >
        <div role="tablist" class="mx-auto flex max-w-md">
          @for (t of sections; track t.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="section() === t.id"
              (click)="selectSection(t.id)"
              class="flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition-colors"
              [ngClass]="section() === t.id ? 'text-primary' : 'text-muted-foreground'"
            >
              <span class="flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300" [ngClass]="section() === t.id ? 'logo-chip scale-105' : ''">
                <app-icon [name]="t.icon" [size]="20" />
              </span>
              {{ t.label }}
            </button>
          }
        </div>
      </nav>

      @if (insuranceBreakdownOpen()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeInsuranceBreakdown()"></button>
          <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <div class="flex items-center gap-3 border-b border-border p-4">
              <div class="flex flex-col">
                <span class="text-sm font-semibold">Insurance Breakdown</span>
                <span class="text-[11px] text-muted-foreground">{{ vehicleTitle(selectedVehicle().brand, modelVariantLabel(selectedVehicle().model, selectedVehicle().variant)) }}</span>
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
                @if (insuranceBreakdown().mode === 'flat') {
                  <div class="flex flex-col divide-y divide-border/60">
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">Insurance Price</span>
                      <span class="tabular">{{ (insuranceBreakdown().flatPrice ?? 0).toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">&minus;NCD ({{ insuranceBreakdown().ncdPct }}%)</span>
                      <span class="tabular">{{ insuranceBreakdown().ncdAmount.toFixed(2) }}</span>
                    </div>
                  </div>
                } @else {
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
                }
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
  private tour = inject(TourService);

  loading = signal(true);
  notFound = signal(false);
  bundle = signal<PublicQuoteBundle | null>(null);
  private token = '';
  /** True on the `/quote/:token/brand` route — same page and same data, just with the Brand
   *  select hidden and never switched away from the SA's Primary Brand, for a link the SA wants
   *  to hand out for one specific brand only. */
  singleBrandMode = this.route.snapshot.data['singleBrand'] === true;
  mobileTab = signal<'preview' | 'customize'>('preview');

  sections: { id: PageSection; label: string; icon: IconName }[] = [
    // Quote is the page's main feature, so it always sits in the middle of the tab bar.
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'quote', label: 'Quote', icon: 'calculator' },
    { id: 'cars', label: 'Cars', icon: 'car' },
  ];

  // ---------- Cars (browse + brochures) ----------

  vehicleTitle = vehicleTitle;
  variantText = variantLabel;
  /** Brands the Cars section can show — just the SA's Primary Brand on the single-brand link. */
  carsBrands = computed(() => {
    const defaultBrand = this.bundle()?.defaultBrand;
    return this.singleBrandMode && defaultBrand && this.brands().includes(defaultBrand) ? [defaultBrand] : this.brands();
  });
  private carsBrandPick = signal<string | null>(null);
  carsBrand = computed(() => {
    const brands = this.carsBrands();
    const pick = this.carsBrandPick();
    if (pick && brands.includes(pick)) return pick;
    const defaultBrand = this.bundle()?.defaultBrand;
    return defaultBrand && brands.includes(defaultBrand) ? defaultBrand : (brands[0] ?? '');
  });
  selectCarsBrand(brand: string) {
    this.carsBrandPick.set(brand);
  }

  /** One group per model of the chosen brand, in catalog order. */
  carGroupsForBrowse = computed(() => {
    const groups: { key: string; brand: string; model: string; cars: Vehicle[]; fromPrice: number }[] = [];
    for (const v of this.vehicles().filter((x) => x.brand === this.carsBrand())) {
      const key = `${v.brand}|${v.model}`;
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, brand: v.brand, model: v.model, cars: [], fromPrice: v.price }));
      g.cars.push(v);
      g.fromPrice = Math.min(g.fromPrice, v.price);
    }
    return groups;
  });

  /** The base rebate for this variant's newest model year — the same rebate the Quote applies
   *  (Additional Rebate never applies on the public link). */
  browseRebate(v: Vehicle): number {
    return rebateForYear(v, Math.max(...v.years.map((y) => y.year)));
  }

  /** Jumps to the Quote section with this exact car already selected. */
  quoteThisCar(v: Vehicle) {
    this.selectedBrand.set(v.brand);
    this.selectModelVariant(v.model, v.variant);
    this.selectSection('quote');
  }
  section = signal<PageSection>('profile');

  selectSection(id: PageSection) {
    const changed = this.section() !== id;
    this.section.set(id);
    window.scrollTo({ top: 0, behavior: changed ? 'instant' : 'smooth' });
    // First visit to the Quote tab on this device gets the walkthrough.
    if (id === 'quote' && changed && !this.tour.hasSeen('quote')) {
      // Only if they're still on Quote once the delay is up — not over whichever section they moved to.
      setTimeout(() => {
        if (this.section() === 'quote') void this.startTour();
      }, 400);
    }
  }

  avatarGradient =
    'radial-gradient(circle at 30% 20%, var(--primary), transparent 70%), linear-gradient(145deg, var(--primary), color-mix(in oklch, var(--primary), black 55%))';

  callHref = computed(() => {
    const advisor = this.bundle()?.advisor;
    const wa = (advisor?.phoneWa ?? '').replace(/[^0-9]/g, '');
    if (wa) return `tel:+${wa}`;
    const local = (advisor?.phoneDisplay ?? '').replace(/[^0-9+]/g, '');
    return local ? `tel:${local}` : null;
  });

  profileWhatsAppHref = computed(() => {
    const advisor = this.bundle()?.advisor;
    const wa = (advisor?.phoneWa ?? '').replace(/[^0-9]/g, '');
    if (!wa) return null;
    const text = `Hi ${advisor!.name}, I came across your profile and would like to know more.`;
    return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  });

  showroom = computed(() => {
    const s = this.bundle()?.advisor.showroom;
    return hasShowroom(s) ? s! : null;
  });
  showroomMapsHref = computed(() => showroomMapsHref(this.showroom()));
  showroomWazeHref = computed(() => showroomWazeHref(this.showroom()));
  socials = computed(() => socialEntries(this.bundle()?.advisor.socials));

  fmt = (v: number) => formatRM(v);
  fmt2 = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  modelVariantLabel = modelVariantLabel;
  formatPhone = formatMalaysianPhone;
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
  /** Not every car has factory colours hardcoded (see Vehicle.colours) — starts on the first one
   *  when it does, null otherwise, and resets the same way whenever the car changes (see
   *  onVariantChange). Purely a price input here — the poster still lists every option
   *  regardless of which one is picked (see PosterData.colours). */
  selectedColour = signal<string | null>(null);
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
  // A colour surcharge (e.g. the Omoda C9 lineup's Matte Grey) is shown as a note next to the
  // colour — both here and on the poster's "Available in:" list — but no longer added to the
  // price; a colour is purely cosmetic now, never something that changes what the customer pays.
  basePrice = computed(() => this.selectedVehicle().price);

  /** e.g. "Matte Grey (+RM 3,000)" — shows the colour's note right in the dropdown, informational
   *  only now (see basePrice above). */
  colourOptionLabel(colour: string): string {
    const surcharge = colourSurchargeFor(this.selectedVehicle(), colour);
    return surcharge > 0 ? `${colour} (+RM ${surcharge.toLocaleString('en-MY')})` : colour;
  }

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
    this.monthlyInstallmentDraft.set(null);
    // A different car has its own colour lineup — carrying over the previous car's pick could
    // silently select a colour (and its surcharge) this car doesn't even offer. Starts on "Not
    // Confirmed" rather than assuming the first colour, since a customer hasn't actually chosen
    // one yet — see the colour select's own default option.
    this.selectedColour.set(null);
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
  private rateDefaults = computed(() => {
    const d = this.bundle()?.salesDefaults;
    return { interestRate: d?.interestRate ?? 2.5, effectiveRate: d?.effectiveRate };
  });
  /** The SA's default Rate Type — except that an EIR quote on a car with no EIR anywhere (neither
   *  its own nor an account default) falls back to quoting flat, labelled as flat. The customer
   *  can't be asked for the bank's rate here, and a flat figure passed off as EIR would understate
   *  the instalment. */
  rateType = computed((): RateType => {
    const preferred = this.bundle()?.salesDefaults.defaultRateType ?? 'flat';
    return preferred === 'effective' && defaultRateFor(this.selectedVehicle(), 'effective', this.rateDefaults()) === null ? 'flat' : preferred;
  });
  interestRate = computed(() => defaultRateFor(this.selectedVehicle(), this.rateType(), this.rateDefaults()) ?? this.rateDefaults().interestRate);

  insuranceRatePct = computed(() => this.bundle()?.salesDefaults.basicPremiumRatePct ?? 3.27);
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
  /** Same insurance quotation at 0% NCD — what the loan is sized against, so dialling in a better
   *  NCD only shrinks the downpayment (see computeQuotationTotals's loanBasisInsuranceAmount). */
  loanBasisInsurance = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), 0).totalDue);

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
      loanBasisInsuranceAmount: this.loanBasisInsurance(),
      downpaymentType: this.downpaymentType(),
      downpaymentValue: this.downpaymentValue(),
      minDownpaymentCash: this.minDownpayment(),
    }),
  );
  /** This variant's minimum downpayment (set by the advisor in Price Settings), before rebate; 0 = none. */
  minDownpayment = computed(() => minDownpaymentCash(this.selectedVehicle().minDownpayment, this.basePrice()));
  /** Cash still needed to meet the minimum once the rebate is counted towards it. */
  minCashNeeded = computed(() => roundCents(Math.max(0, this.minDownpayment() - this.effectiveRebate())));
  /** True when what was entered fell short of the minimum and the quote was raised to it. */
  downpaymentRaisedToMin = computed(() => {
    if (this.minDownpayment() <= 0 || this.totals().loanAmount === 0) return false;
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
  isCashPurchase = computed(() => this.loanAmount() === 0);
  monthlyInstalment = computed(() => monthlyPayment(this.loanAmount(), this.interestRate(), this.tenureMonths(), this.rateType()));

  // Same draft/commit pattern as the Calculator's own Loan Amount field: loanAmount() is always
  // floored to the nearest RM100, so binding the input straight to it would snap a mid-typed value
  // back before the customer finishes — a draft signal holds the raw typed number until blur/Enter.
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
   *  customer is done typing, so it never sits there showing a number that was never actually
   *  charged. */
  commitDownpayment() {
    if (this.downpaymentType() === 'percent') {
      this.downpaymentValue.set(Math.min(Math.max(0, this.downpaymentValue()), 100));
    } else {
      this.downpaymentValue.set(this.totals().downpaymentCash);
    }
  }
  loanAmountDisplay = computed(() => this.loanAmountDraft() ?? this.loanAmount());

  onLoanAmountInput(value: number) {
    this.loanAmountDraft.set(Math.max(0, +value || 0));
  }

  commitLoanAmount() {
    const draft = this.loanAmountDraft();
    if (draft !== null) {
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - draft)));
      this.monthlyInstallmentDraft.set(null);
    }
    this.loanAmountDraft.set(null);
  }

  /** Same draft/commit pattern as Loan Amount above — holds whatever's typed until blur/Enter,
   *  then works backwards from "I want to pay about RM X/month" (at the selected tenure) to the
   *  loan amount that implies, and from there to the deposit. */
  private monthlyInstallmentDraft = signal<number | null>(null);
  /** Once committed, shows the instalment the loan actually settled on — not necessarily what was
   *  typed, since the loan behind it is floored to the nearest RM100 (see commitMonthlyInstallment)
   *  the same way a manually-typed Loan Amount is. Closest achievable, not exact. */
  monthlyInstallmentDisplay = computed(() => this.monthlyInstallmentDraft() ?? roundCents(this.monthlyInstalment()));

  onMonthlyInstallmentInput(value: number) {
    this.monthlyInstallmentDraft.set(Math.max(0, +value || 0));
  }

  commitMonthlyInstallment() {
    const draft = this.monthlyInstallmentDraft();
    if (draft !== null) {
      const impliedLoan = loanForMonthlyPayment(draft, this.interestRate(), this.tenureMonths(), this.rateType());
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - impliedLoan)));
      this.loanAmountDraft.set(null);
    }
    this.monthlyInstallmentDraft.set(null);
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
      // Same as the Calculator's own preferredVehicle() — starts on the SA's Primary Brand
      // (Profile & Settings → Quote Preferences) when that brand actually has a car in this catalog,
      // falling back to the catalog's first car otherwise.
      const preferred = vehicles.find((v) => v.brand === bundle.defaultBrand) ?? vehicles[0];
      this.selectedBrand.set(preferred.brand);
      this.selectedModelName.set(preferred.model);
      this.selectedVariant.set(preferred.variant);
      // Starts on "Not Confirmed" rather than assuming the first colour — see onVariantChange.
      this.selectedColour.set(null);
      this.modelYear.set(Math.max(...preferred.years.map((y) => y.year)));
      this.ncd.set(bundle.salesDefaults.ncd);
      this.downpaymentType.set('percent');
      this.downpaymentValue.set(bundle.salesDefaults.downpaymentPct);
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** The customer-facing walkthrough — also replayable from the Guide button. The "WhatsApp Me Here"
   *  step matters most: it's a small text button, and it's how a customer sends the quote on. */
  startTour() {
    const advisor = this.bundle()?.advisor.name || 'your advisor';
    const showPreview = () => {
      this.section.set('quote');
      this.mobileTab.set('preview');
    };
    const showCustomize = () => {
      this.section.set('quote');
      this.mobileTab.set('customize');
    };
    const steps: TourStep[] = [
      {
        title: 'Build your own quote',
        body: 'Change the car, downpayment and repayment period, and your quote updates instantly. This quick guide takes under a minute.',
        before: showPreview,
      },
      {
        target: 'quote-preview',
        title: 'Your live quote',
        body: 'This is your quote. It updates as you change anything in the Customize tab.',
        before: showPreview,
      },
      {
        target: 'quote-car',
        title: 'Pick your car',
        body: 'Choose the brand, model and colour you are interested in.',
        before: showCustomize,
      },
      {
        target: 'quote-downpayment',
        title: 'Set your downpayment',
        body: 'Tap 10% or Full Loan for a quick setup, or type your own amount.',
        before: showCustomize,
      },
      {
        target: 'quote-tenure',
        title: 'Choose how long to pay',
        body: 'Pick the number of years. Your monthly instalment updates straight away.',
        before: showCustomize,
      },
      {
        target: 'quote-whatsapp',
        title: `Send it to ${advisor}`,
        body: `Happy with the numbers? Tap "WhatsApp Me Here" to send this exact quote to ${advisor}, who will confirm the final figures with you.`,
        before: showPreview,
        skipIfMissing: true,
        doneLabel: 'Got it',
      },
    ];
    return this.tour.start('quote', steps);
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
      colours: vehicle.colours ?? [],
      colourSurcharges: vehicle.colourSurcharges ?? {},
      sellingPrice: this.allInPrice(),
      downpayment: this.downpaymentCash(),
      loanAmount: this.loanAmount(),
      isCashPurchase: this.isCashPurchase(),
      advisor: {
        name: advisor.name,
        role: advisor.role,
        initials: this.advisorInitials(),
        photoUrl: advisor.photoUrl ?? null,
        phoneDisplay: advisor.phoneDisplay,
        // The bio is shown on the Profile tab, not on the customer's quote poster.
        bio: '',
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
      `Hi ${this.bundle()!.advisor.name}, I'm interested in the ${vehicleTitle(vehicle.brand, modelVariantLabel(vehicle.model, vehicle.variant))} (${this.modelYear()}).`,
      '',
      "Here's the quote I put together:",
      // Only mentioned for cars that actually offer a colour choice — see the Colour select's own
      // @if (selectedVehicle().colours; ...) guard. "Not confirmed yet" (rather than omitting the
      // line) since the advisor still needs to know a colour is expected, just not picked.
      ...(vehicle.colours ? [`- Colour: ${this.selectedColour() ?? 'Not confirmed yet'}`] : []),
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
    this.monthlyInstallmentDraft.set(null);
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
