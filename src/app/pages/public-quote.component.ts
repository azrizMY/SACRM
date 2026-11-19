import { CarShadowPipe } from '../shared/car-shadow';
import { applyAppColour } from '../shared/app-colour';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { SettingsService } from '../shared/settings.service';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { BrandIconComponent } from '../shared/brand-icon.component';
import { NumberFieldComponent } from '../shared/number-field.component';
import { I18nService, TranslatePipe, translate, type Lang } from '../shared/i18n';
import { CompareTableComponent, type CompareColumn } from '../shared/compare-table.component';
import { quoteForComparison, type ComparePricing, type CompareSetup } from '../data/compare-data';
import { DEFAULT_SETTINGS } from '../data/settings-data';
import { hasShowroom, showroomMapsHref, showroomWazeHref, socialEntries } from '../data/social-data';
import { TourService, type TourStep } from '../shared/tour.service';
import { fetchPublicQuote, type PublicQuoteBundle } from '../shared/public-quote-api';
import { posterFontsReady } from '../shared/poster-theme';
import { classicTemplate } from '../shared/poster-template-classic';
import type { PosterData } from '../shared/poster-data';
import { brandLogo, formatMalaysianPhone, formatRM2 } from '../data/dashboard-data';
import { resolveInsuranceDetails } from '../data/calculator-data';
import { DEFAULT_MOTOR_TARIFF, guessBand, tariffBasicPremium } from '../data/motor-tariff';
import {
  DEFAULT_VEHICLES,
  NCD_OPTIONS,
  basicPremiumDefault,
  colourSurchargeFor,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  minDownpaymentCash,
  defaultRateFor,
  downpaymentDisplay,
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
import { BudgetFinderComponent, type BudgetPick } from '../shared/budget-finder.component';
import { BrandChipsComponent } from '../shared/brand-chips.component';
import { ScrollRowComponent } from '../shared/scroll-row.component';
import { LinkActivityRecorder } from '../shared/link-activity-recorder';
import { DOWNPAYMENT_PRESETS, type DownpaymentPreset } from '../shared/quote-engine';
import type { BudgetRules } from '../shared/budget-finder';

/** The full 1-9 year range the tenure picker offers — same range as the Calculator's own poster
 *  year buttons, just single-select here instead of "pick 3 for a comparison table". */
const TENURE_YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 1);

type PageSection = 'quote' | 'profile' | 'budget' | 'compare' | 'cars';

@Component({
  selector: 'app-public-quote',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterLink, IconComponent, NumberFieldComponent, BrandIconComponent, TranslatePipe, CarShadowPipe, CompareTableComponent, BudgetFinderComponent, BrandChipsComponent, ScrollRowComponent],
  // Its own instance, pinned to the advisor's poster language rather than any UI language.
  providers: [I18nService],
  template: `
    @if (loading()) {
      <div class="flex min-h-screen items-center justify-center">
        <app-icon name="refresh-cw" [size]="24" class="animate-spin text-muted-foreground" />
      </div>
    } @else if (notFound()) {
      <div class="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <app-icon name="x-circle" [size]="28" class="text-muted-foreground" />
        <h1 class="text-lg font-semibold">{{ "This link isn't valid" | t }}</h1>
        <p class="max-w-xs text-sm text-muted-foreground">{{ "Please check the link your sales advisor sent you, or ask them to resend it." | t }}</p>
      </div>
    } @else {
      <!-- The menu: always open on a computer, behind the hamburger on a phone or tablet
           (same as the advisor's own app). -->
      <ng-template #menuBody let-drawer="drawer">
        <!-- Hidden (space kept) on Profile, which already shows the advisor large. -->
        <div class="flex flex-col items-center gap-2 px-2 text-center" [class.invisible]="!drawer && section() === 'profile'">
          @if (bundle()!.advisor.photoUrl; as photo) {
            <img [src]="photo" alt="" class="size-16 rounded-full object-cover ring-2 ring-brand/60 ring-offset-2 ring-offset-background" />
          } @else {
            <span class="flex size-16 items-center justify-center rounded-full text-base font-semibold logo-chip">{{ advisorInitials() }}</span>
          }
          <div class="flex min-w-0 max-w-full flex-col gap-0.5">
            <span class="truncate text-base font-bold">{{ bundle()!.advisor.name }}</span>
            @if (bundle()!.advisor.role; as role) {
              <span class="truncate text-sm text-sidebar-muted">{{ role }}</span>
            }
          </div>
        </div>
        <nav role="tablist" [attr.aria-label]="'Page sections' | t" aria-orientation="vertical" class="flex flex-col gap-1">
          @for (t of sections; track t.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="section() === t.id"
              (click)="selectSection(t.id)"
              class="group relative flex min-h-12 items-center gap-3 rounded-lg px-3.5 text-base transition-colors"
              [ngClass]="section() === t.id ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'"
            >
              <!-- Same "you are here" mark as the advisor's app menu: a grey row with a red bar -->
              @if (section() === t.id) {
                <span class="absolute inset-y-2 -left-4 w-[3px] rounded-r-full bg-primary" aria-hidden="true"></span>
              }
              <app-icon [name]="t.icon" [size]="20" [class]="section() === t.id ? 'text-brand' : ''" />
              {{ t.label | t }}
            </button>
          }
        </nav>
      </ng-template>

      <aside class="glass fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 px-4 py-6 text-sidebar-foreground xl:flex">
        <ng-container [ngTemplateOutlet]="menuBody" [ngTemplateOutletContext]="{ drawer: false }" />
      </aside>

      <!-- Phone / tablet: top bar with the hamburger. Fixed (not sticky): the page host is only a
           screen tall, so sticky would let it scroll away. The spacer keeps its room in the flow. -->
      <div class="h-14 xl:hidden" aria-hidden="true"></div>
      <header class="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-3 xl:hidden">
        <button
          type="button"
          class="-ml-1 flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent"
          [attr.aria-label]="'Open menu' | t"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(true)"
        >
          <app-icon name="menu" [size]="20" />
        </button>
        <h1 class="min-w-0 truncate text-lg font-bold tracking-tight">{{ sectionLabel() | t }}</h1>
      </header>

      @if (menuOpen()) {
        <div class="fixed inset-0 z-50 xl:hidden">
          <button type="button" [attr.aria-label]="'Close menu' | t" class="absolute inset-0 bg-black/60" (click)="menuOpen.set(false)"></button>
          <div class="glass animate-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-background px-4 py-6 text-sidebar-foreground">
            <button
              type="button"
              (click)="menuOpen.set(false)"
              [attr.aria-label]="'Close menu' | t"
              class="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <app-icon name="x" [size]="18" />
            </button>
            <ng-container [ngTemplateOutlet]="menuBody" [ngTemplateOutletContext]="{ drawer: true }" />
          </div>
        </div>
      }

      <div class="xl:pl-60">
      <div [class.hidden]="section() !== 'quote'">
      <!-- On a computer: the Calculator's layout — the poster takes two thirds with the WhatsApp button
           under it, and the settings are one scrolling column on the right.
           On a phone / tablet: one page, no switching — the advisor's rebate and rate pinned at the top, a compact
           quote card (tap for the full poster), the settings right under it, and the WhatsApp button
           pinned at the bottom. -->
      <div class="mx-auto flex max-w-7xl flex-col gap-3 p-4 md:p-6 xl:h-dvh xl:gap-6">

        <!-- Phone / tablet: this month's rebate, pinned flush under the top bar while
             scrolling (pulled up over the page's own top padding so no strip of the background glow
             shows above it). On a computer it's the card at the foot of the settings column. -->
        <div class="sticky top-14 z-10 -mx-4 -mt-4 border-b border-border bg-background px-4 py-3 md:-mx-6 md:-mt-6 md:px-6 xl:hidden">
          <div class="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <span>{{ "{month} rebate" | t: { month: rebateMonth() } }}</span>
            <strong class="tabular shrink-0 font-semibold text-foreground">{{ fmt(rebateInput()) }}</strong>
          </div>
        </div>

        <div class="grid grid-cols-1 items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-3 xl:grid-rows-[minmax(0,1fr)]">
          <!-- Quote preview: the whole poster on a computer (click for the full view); a compact quote card
               on a phone / tablet. The poster canvas is still drawn while hidden — the full view copies it. -->
          <div class="flex h-full min-h-0 flex-col gap-2 self-stretch xl:col-span-2">
            <div class="flex min-h-0 flex-col gap-2 rounded-xl xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
              <!-- Phone / tablet: a compact quote card in the poster's style — the figures only, no car
                   photo — so the settings start on the first screen. Tap it for the full poster. -->
              <button
                type="button"
                data-tour="quote-preview"
                (click)="openFullQuote()"
                [attr.aria-label]="'View full quote' | t"
                class="flex w-full shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 text-left text-card-foreground shadow-md transition-colors hover:border-control xl:hidden"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    <span class="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span class="h-2.5 w-0.5 -skew-x-12 bg-primary" aria-hidden="true"></span>
                      {{ "Vehicle loan estimate" | t }}
                    </span>
                    <span class="truncate text-base font-bold">{{ modelVariantLabel(selectedModelName(), selectedVariant()) }} · {{ modelYear() }}</span>
                  </div>
                  <span class="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                    <app-icon name="maximize" [size]="13" />
                    {{ "Full quote" | t }}
                  </span>
                </div>

                <div class="flex flex-col gap-0.5">
                  <span class="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{{ "Selling price" | t }}</span>
                  <span class="fig text-[1.75rem]">{{ fmt2(allInPrice()) }}</span>
                </div>

                @if (!isCashPurchase()) {
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-0.5 border-l-2 border-primary bg-muted/60 px-2.5 py-1.5">
                      <span class="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{{ "Downpayment" | t }}</span>
                      <span class="fig text-sm">{{ fmt2(downpaymentCash()) }}</span>
                    </div>
                    <div class="flex flex-col gap-0.5 border-l-2 border-primary bg-muted/60 px-2.5 py-1.5">
                      <span class="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{{ "Loan amount" | t }}</span>
                      <span class="fig text-sm">{{ fmt2(loanAmount()) }}</span>
                    </div>
                  </div>
                }

                <div class="flex flex-col text-xs">
                  <div class="flex items-center justify-between gap-3 border-b border-border py-1.5">
                    <span class="text-muted-foreground">{{ "OTR price" | t }}</span>
                    <span class="tabular font-semibold">{{ fmt2(basePrice()) }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3 border-b border-border py-1.5">
                    <span class="text-muted-foreground">{{ "Insurance" | t }} <span class="text-[0.625rem]">({{ ncd() }}% NCD)</span></span>
                    <span class="tabular font-semibold text-[var(--warning)]">+ {{ fmt2(insurance()) }}</span>
                  </div>
                  <div class="flex items-center justify-between gap-3 py-1.5">
                    <span class="text-muted-foreground">{{ "Rebate" | t }}</span>
                    <span class="tabular font-semibold text-[var(--success)]">− {{ fmt2(effectiveRebate()) }}</span>
                  </div>
                </div>

                @if (!isCashPurchase()) {
                  <div class="flex items-center justify-between gap-3 bg-primary px-3 py-2 text-primary-foreground [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]">
                    <span class="text-sm font-bold">{{ tenureYears() + ' Yrs' | t }} <span class="ml-1 text-xs font-medium opacity-80">{{ interestRate() }}% {{ rateType() === 'flat' ? ('Flat' | t) : 'EIR' }}</span></span>
                    <span class="fig text-lg">{{ fmt2(monthlyInstalment()) }}<span class="ml-0.5 text-xs font-semibold opacity-80">/{{ "mo" | t }}</span></span>
                  </div>
                }
              </button>

              <button
                type="button"
                data-tour="quote-preview"
                (click)="openFullQuote()"
                [attr.aria-label]="'View full quote' | t"
                class="group relative mx-auto w-full shrink-0 overflow-hidden rounded-xl border border-border text-left shadow-md max-xl:hidden xl:block"
              >
                <canvas #posterCanvas class="block h-auto w-full"></canvas>
                <span class="pointer-events-none absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <app-icon name="maximize" [size]="14" />
                  {{ "View full quote" | t }}
                </span>
              </button>
              <p class="hidden shrink-0 text-balance text-center text-xs leading-relaxed text-muted-foreground xl:block">
                <app-icon name="info" [size]="16" class="mr-1 inline-block align-[-2px]" />
                {{ "Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here." | t }}
              </p>
            </div>
            <!-- Where the Calculator has Save / Share -->
            @if (bundle()!.advisor.phoneWa) {
              <button
                type="button"
                data-tour="quote-whatsapp"
                (click)="openWhatsAppToAdvisor()"
                class="btn btn-lg flex w-full shrink-0 items-center justify-center gap-2 bg-[#25D366] text-white shadow-sm transition-[filter] hover:brightness-95 max-xl:hidden"
              >
                <app-brand-icon name="whatsapp" [size]="20" />
                {{ "WhatsApp Me Here" | t }}
              </button>
            }
          </div>

          <!-- Trade-in: a simple yes/no that goes into the WhatsApp message (the model is asked on WhatsApp) -->
          <ng-template #tradeInCard>
            @if (bundle()!.advisor.phoneWa) {
              <section class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
                <span class="text-sm font-semibold text-foreground">{{ "Trade-in" | t }}</span>
                <span class="text-sm font-medium">{{ "Do you have a car to trade in?" | t }}</span>
                <div role="group" [attr.aria-label]="'Do you have a car to trade in?' | t" class="grid grid-cols-2 gap-1.5">
                  @for (o of tradeInOptions; track o.label) {
                    <button
                      type="button"
                      (click)="tradeIn.set(o.value); activity?.record('trade_in', null, { tradeIn: o.value })"
                      [attr.aria-pressed]="tradeIn() === o.value"
                      class="rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors"
                      [ngClass]="tradeIn() === o.value ? 'border-brand bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ o.label | t }}
                    </button>
                  }
                </div>
                @if (tradeIn()) {
                  <span class="text-xs text-muted-foreground">{{ "This will be added to your WhatsApp message." | t }}</span>
                }
              </section>
            }
          </ng-template>

          <!-- Customize quote -->
          <div
            class="flex flex-col gap-4 xl:col-span-1 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
          >
            <div class="flex items-center justify-between gap-2">
              <h3 class="min-w-0 truncate text-base font-semibold leading-none">{{ "Customize Quote" | t }}</h3>
              <div class="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  (click)="startTour()"
                  [attr.aria-label]="'How this page works' | t"
                  [title]="'How this page works' | t"
                  class="flex shrink-0 items-center rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="info" [size]="18" />
                </button>
                <button
                  type="button"
                  (click)="reset()"
                  class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="refresh-cw" [size]="16" />
                  {{ "Reset" | t }}
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <div class="contents">
              <!-- Select car -->
              <div data-tour="quote-car" class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-semibold text-foreground">{{ "Select Car" | t }}</span>
                  <button type="button" (click)="openCompare()" class="-my-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft">
                    <app-icon name="table" [size]="16" />
                    {{ "Compare" | t }}
                  </button>
                </div>

              <!-- Brands as one row of chips (swipes sideways when they don't all fit); none on a one-brand link -->
              @if (!singleBrandMode && chipBrands().length > 1) {
                <app-brand-chips [brands]="chipBrands()" [selected]="selectedBrand()" (pick)="onBrandChange($event)" />
              }

                <div class="flex flex-col gap-2">
                  <div class="relative">
                    <button
                      type="button"
                      (click)="toggleCarDropdown($event)"
                      [attr.aria-label]="('Model' | t) + ': ' + modelVariantLabel(selectedModelName(), selectedVariant())"
                      class="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-input bg-input px-3 text-base text-foreground outline-none transition-colors focus:border-ring md:text-sm"
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
                  <label for="colourSelect" class="text-sm font-semibold text-foreground">{{ "Colour" | t }}</label>
                  <select
                    id="colourSelect"
                    [ngModel]="selectedColour()"
                    (ngModelChange)="selectedColour.set($event)"
                    class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                  >
                    <option [ngValue]="null">{{ "Not decided yet" | t }}</option>
                    @for (c of colours; track c) { <option [ngValue]="c">{{ colourOptionLabel(c) }}</option> }
                  </select>
                </div>
              }
            </div>

            <!-- Loan setup: same layout as the advisor's Calculator — the three ways to size the loan sit
                 together, and changing any one moves the other two -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-foreground">{{ "Loan Setup" | t }}</span>
                <span class="flex items-center gap-1 text-xs text-muted-foreground"><app-icon name="refresh-cw" [size]="12" />{{ "Change any one" | t }}</span>
              </div>

              <div data-tour="quote-downpayment" role="group" [attr.aria-label]="'Quick downpayment presets' | t" class="flex flex-wrap gap-1.5">
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
                  <span class="text-xs font-normal">{{ tenureYears() + ' Yrs' | t }}</span>
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
              } @else {
                <span class="text-xs text-muted-foreground">{{ 'Loan amount rounds down to RM100.' | t }}</span>
              }
            </div>

              </div>

              <div class="contents">
            <!-- Insurance: same as the Calculator — the total up top, NCD as tap boxes, and the
                 breakdown behind a button (view only here) -->
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
                <app-icon name="eye" [size]="16" />
                {{ "Insurance details" | t }}
              </button>
            </div>

            <!-- Tenure -->
            <div data-tour="quote-tenure" class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <span class="text-sm font-semibold text-foreground">{{ "Tenure" | t }}</span>
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-foreground">{{ "Tenure Selection" | t }}</span>
                  <span class="text-xs font-semibold tabular text-foreground">{{ tenureYears() }} {{ "Yrs" | t }}</span>
                </div>
                <div role="radiogroup" [attr.aria-label]="'Tenure (years)' | t" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
                  @for (y of tenureYearOptions; track y) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="tenureYears() === y"
                      (click)="selectTenureYear(y)"
                      class="flex h-10 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                      [ngClass]="tenureYears() === y ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ y }}
                    </button>
                  }
                </div>
                <span class="text-xs text-muted-foreground">{{ "Pick one tenure — this is what your monthly payment above is based on." | t }}</span>
              </div>
            </div>

            <!-- Trade-in: a last yes/no before sending -->
            <ng-container [ngTemplateOutlet]="tradeInCard" />

            <!-- Estimate note (on a computer it sits under the poster instead) -->
            <p class="text-balance text-center text-xs leading-relaxed text-muted-foreground xl:hidden">
              <app-icon name="info" [size]="16" class="mr-1 inline-block align-[-2px]" />
              {{ "Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here." | t }}
            </p>

            <!-- Bottom dock, pinned while scrolling: the WhatsApp button on a phone / tablet; on a computer
                 the advisor's rebate and rate card (WhatsApp sits under the poster there). -->
            <div class="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-border bg-background px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:-mx-6 md:-mb-6 md:px-6 xl:mx-0 xl:mb-0 xl:px-0 xl:pb-0">
              <div class="hidden flex-col gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-sm xl:flex">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted-foreground">{{ "Rebate" | t }}</span>
                  <span class="tabular font-semibold">{{ fmt(rebateInput()) }}</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-muted-foreground">{{ "Interest" | t }}</span>
                  <span class="tabular font-semibold">{{ interestRate() }}% {{ rateType() === 'flat' ? ('Flat' | t) : 'EIR' }}</span>
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ "Set by your advisor" | t }}
                </span>
              </div>
              @if (bundle()!.advisor.phoneWa) {
                <button
                  type="button"
                  data-tour="quote-whatsapp"
                  (click)="openWhatsAppToAdvisor()"
                  class="btn btn-lg flex w-full items-center justify-center gap-2 bg-[#25D366] text-white shadow-sm transition-[filter] hover:brightness-95 xl:hidden"
                >
                  <app-brand-icon name="whatsapp" [size]="20" />
                  {{ "WhatsApp Me Here" | t }}
                </button>
              }
            </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      @if (section() === 'profile') {
        <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:gap-5 md:p-6 xl:py-8">
          <!-- Advisor card: the advisor's cover photo (My Profile), or one of their cars, with their photo
               on its edge, then name, role and bio, with WhatsApp / Call beside them on wider screens. -->
          <section class="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
            <div class="relative bg-gradient-to-b from-white to-[oklch(0.9_0.005_280)]" [ngClass]="bundle()!.advisor.coverUrl ? 'aspect-[4/1]' : 'h-28 sm:h-36 md:h-44'">
              @if (bundle()!.advisor.coverUrl; as cover) {
                <img [src]="cover" alt="" class="absolute inset-0 size-full object-cover" />
              } @else if (featuredModels().length && featuredModels()[0].car.photoUrl) {
                <img [src]="featuredModels()[0]!.car.photoUrl! | carShadow" alt="" class="absolute inset-y-0 right-0 h-full w-2/3 object-contain object-right p-2 md:w-1/2 md:p-3" />
              }
              <div class="absolute -bottom-10 left-5 z-10 md:-bottom-12 md:left-7">
                @if (bundle()!.advisor.photoUrl; as photo) {
                  <img [src]="photo" alt="" class="size-20 rounded-full object-cover ring-4 ring-card md:size-24" />
                } @else {
                  <span class="flex size-20 items-center justify-center rounded-full text-2xl font-bold ring-4 ring-card md:size-24 logo-chip">{{ advisorInitials() }}</span>
                }
              </div>
            </div>

            <div class="grid gap-4 p-5 pt-12 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-6 md:p-7 md:pt-16">
              <div class="flex min-w-0 flex-col gap-1.5">
                <h1 class="text-balance text-xl font-semibold tracking-tight md:text-2xl">{{ bundle()!.advisor.name }}</h1>
                @if (bundle()!.advisor.role; as role) {
                  <span class="text-sm text-muted-foreground">{{ role }}@if (bundle()!.defaultBrand; as brand) { · {{ brand }}}</span>
                }
                @if (!callHref() && bundle()!.advisor.phoneDisplay) {
                  <span class="text-sm tabular text-muted-foreground">{{ formatPhone(bundle()!.advisor.phoneDisplay) }}</span>
                }
                @if (bundle()!.advisor.bio; as bio) {
                  <p class="mt-1 max-w-2xl whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">{{ bio }}</p>
                }
                @if (socials().length) {
                  <div class="mt-2 flex flex-wrap gap-2">
                    @for (s of socials(); track s.id) {
                      <a
                        [href]="s.href"
                        target="_blank"
                        rel="noopener noreferrer"
                        [attr.aria-label]="s.label + ' (opens in a new tab)'"
                        [title]="s.label | t"
                        class="rounded-xl outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
                      >
                        <app-brand-icon [name]="s.id" [size]="36" [tile]="true" />
                      </a>
                    }
                  </div>
                }
              </div>

              <!-- Get in touch: WhatsApp, full width on a phone and beside the name on wider screens. Call only
                   shows for an advisor without a WhatsApp number, so there's always a way to reach them. -->
              @if (callHref() || profileWhatsAppHref()) {
                <div class="flex flex-col gap-2 md:content-start">
                  @if (profileWhatsAppHref(); as href) {
                    <a
                      [href]="href"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="activity?.record('whatsapp_tapped')"
                      class="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white shadow-sm transition-[filter] hover:brightness-95"
                    >
                      <app-brand-icon name="whatsapp" [size]="18" />
                      WhatsApp
                    </a>
                  }
                  @if (!profileWhatsAppHref() && callHref(); as href) {
                    <a
                      [href]="href"
                      class="flex h-11 items-center justify-center gap-2 rounded-xl border border-control px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      <app-icon name="phone" [size]="18" />
                      <span class="truncate">{{ "Call" | t }}<span class="hidden tabular md:inline">{{ bundle()!.advisor.phoneDisplay ? ' ' + formatPhone(bundle()!.advisor.phoneDisplay) : '' }}</span></span>
                    </a>
                  }
                </div>
              }
            </div>
          </section>

          <!-- Start here: most customers open the link for a price, so the quote is one clear button -->
          <section class="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-5 md:flex-row md:items-center md:justify-between md:gap-6">
            <div class="flex flex-col gap-1">
              <h2 class="text-base font-semibold tracking-tight">{{ "See your monthly in 1 minute" | t }}</h2>
              <p class="text-sm text-muted-foreground">{{ "Pick a car, set your deposit and years." | t }}</p>
            </div>
            <div class="flex flex-col gap-2 md:items-end">
              <button type="button" (click)="selectSection('quote')" class="btn btn-primary btn-lg w-full md:w-auto md:px-8">
                <app-icon name="calculator" [size]="18" />
                {{ "Build my quote" | t }}
              </button>
              <button type="button" (click)="selectSection('budget')" class="self-center text-sm font-semibold text-brand hover:underline md:self-end">
                {{ "or find a car for your budget" | t }}
              </button>
            </div>
          </section>

          <!-- A few of the advisor's cars: one swipe row on a phone, four across on wider screens.
               A tap starts a quote for that car. -->
          @if (featuredModels().length) {
            <section class="flex flex-col gap-3">
              <div class="flex items-baseline justify-between gap-3">
                <h2 class="text-base font-semibold tracking-tight">{{ "Cars I sell" | t }}</h2>
                <button type="button" (click)="selectSection('cars')" class="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  {{ "See all" | t }}
                  <app-icon name="chevron-right" [size]="16" />
                </button>
              </div>
              <div class="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
                @for (f of featuredModels(); track f.key) {
                  <button
                    type="button"
                    (click)="quoteThisCar(f.car)"
                    class="group flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card text-left text-card-foreground shadow-sm transition-shadow hover:shadow-md md:w-auto"
                  >
                    <span class="flex aspect-[16/10] items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[oklch(0.9_0.005_280)]">
                      @if (f.car.photoUrl) {
                        <img [src]="f.car.photoUrl | carShadow" [alt]="vehicleTitle(f.brand, f.model)" loading="lazy" class="h-full min-h-0 w-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-[1.03]" />
                      } @else {
                        <app-icon name="car" [size]="28" class="text-muted-foreground" />
                      }
                    </span>
                    <span class="flex flex-col gap-0.5 p-3">
                      <span class="truncate text-sm font-bold">{{ vehicleTitle(f.brand, f.model) }}</span>
                      <span class="text-xs text-muted-foreground">{{ "from" | t }} <span class="font-semibold tabular text-foreground">{{ fmt(f.fromPrice) }}</span></span>
                      <span class="mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand">
                        <app-icon name="calculator" [size]="14" />
                        {{ "Get my monthly" | t }}
                      </span>
                    </span>
                  </button>
                }
              </div>
            </section>
          }

          <!-- Showroom: address with Google Maps / Waze -->
          @if (showroom(); as s) {
            <section class="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm md:flex-row md:items-center md:justify-between">
              <div class="flex items-start gap-3">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <app-icon name="map-pin" [size]="20" />
                </span>
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="text-sm font-semibold text-foreground">{{ "Visit the Showroom" | t }}</span>
                  <span class="text-sm font-semibold">{{ s.name || ('Showroom' | t) }}</span>
                  @if (s.address; as address) {
                    <p class="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{{ address }}</p>
                  }
                </div>
              </div>
              <div class="grid auto-cols-fr grid-flow-col gap-2 md:w-72 md:shrink-0">
                @if (showroomMapsHref(); as href) {
                  <a [href]="href" target="_blank" rel="noopener noreferrer" class="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-sm font-medium transition-colors hover:bg-accent">
                    <app-brand-icon name="googlemaps" [size]="18" class="text-[#4285F4]" />
                    {{ "Google Maps" | t }}
                  </a>
                }
                @if (showroomWazeHref(); as href) {
                  <a [href]="href" target="_blank" rel="noopener noreferrer" class="flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 px-3 text-sm font-medium transition-colors hover:bg-accent">
                    <app-brand-icon name="waze" [size]="18" class="text-[#33CCFF]" />
                    {{ "Waze" | t }}
                  </a>
                }
              </div>
            </section>
          }

          <a routerLink="/privacy" [queryParams]="{ lang: pageLang() }" target="_blank" class="self-center py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            {{ "Privacy Policy" | t }}
          </a>
        </div>
      }

      <!-- Budget: start from the monthly the customer is comfortable with — every car shows the deposit
           that gets it there. Never says anyone can't afford a car; doubts go to the advisor. -->
      @if (section() === 'budget') {
        <div class="mx-auto flex w-full max-w-5xl flex-col p-4 md:p-6 xl:py-8">
          <div class="flex flex-col gap-1 pb-5">
            <h1 class="text-base font-semibold tracking-tight">{{ "Find a car for your budget" | t }}</h1>
            <p class="text-sm text-muted-foreground">{{ "Start from the monthly you are comfortable with, and see the deposit for every car." | t }}</p>
          </div>
          <app-budget-finder [vehicles]="budgetVehicles()" [brands]="carsBrands()" [primaryBrand]="bundle()!.defaultBrand" [rules]="budgetRules()" [doubtHref]="qualifyWhatsAppHref()" (pick)="quoteFromBudget($event)" (searched)="activity?.record('budget_used', null, $event)" />
        </div>
      }

      <!-- Compare: up to 3 of the SA's cars side by side, on the same loan as this customer's quote
           (downpayment, tenure and NCD are the Quote tab's own, so the two stay in step). -->
      @if (section() === 'compare') {
        <div class="mx-auto flex w-full max-w-5xl flex-col p-4 md:p-6 xl:py-8">
          <div class="flex flex-col gap-1 pb-5">
            <h1 class="text-base font-semibold tracking-tight">{{ "Compare cars" | t }}</h1>
            <p class="text-sm text-muted-foreground">{{ "Choose up to 3 cars. Every car is quoted on the same loan." | t }}</p>
          </div>

          <section class="rounded-2xl bg-card p-4 text-card-foreground sm:p-5">
            <span class="mb-4 block text-sm font-semibold">{{ "Same loan for every car" | t }}</span>
            <div class="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
              <div class="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                <span class="text-xs text-muted-foreground">{{ "Downpayment" | t }}</span>
                <div class="flex gap-2">
                  <div class="flex shrink-0 rounded-full bg-muted/50 p-0.5 text-xs font-semibold">
                    @for (k of compareDpKinds; track k.id) {
                      <button type="button" (click)="setCompareDownpaymentType(k.id)" class="rounded-full px-3 py-1.5 transition-colors" [ngClass]="downpaymentType() === k.id ? 'bg-foreground text-background' : 'text-muted-foreground'">
                        {{ k.label }}
                      </button>
                    }
                  </div>
                  <input
                    type="number"
                    inputmode="decimal"
                    min="0"
                    [ngModel]="downpaymentValue()"
                    (ngModelChange)="downpaymentValue.set(Math.max(0, +$event || 0))"
                    [attr.aria-label]="'Downpayment' | t"
                    class="h-9 w-full min-w-0 rounded-full border border-input bg-input px-4 text-sm tabular text-foreground outline-none focus:border-ring"
                  />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="compareTenure" class="text-xs text-muted-foreground">{{ "Tenure" | t }}</label>
                <div class="relative">
                  <select
                    id="compareTenure"
                    [ngModel]="tenureYears()"
                    (ngModelChange)="tenureYears.set(+$event)"
                    class="h-9 w-full appearance-none rounded-full border border-input bg-input pl-3 pr-8 text-xs text-foreground outline-none focus:border-ring sm:pl-4 sm:text-sm"
                  >
                    @for (y of compareTenureYears; track y) {
                      <option [ngValue]="y">{{ y }} {{ (y === 1 ? "year" : "years") | t }}</option>
                    }
                  </select>
                  <app-icon name="chevron-down" [size]="18" class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label for="compareNcd" class="text-xs text-muted-foreground">NCD</label>
                <div class="relative">
                  <select
                    id="compareNcd"
                    [ngModel]="ncd()"
                    (ngModelChange)="ncd.set(+$event)"
                    class="h-9 w-full appearance-none rounded-full border border-input bg-input pl-3 pr-8 text-xs text-foreground outline-none focus:border-ring sm:pl-4 sm:text-sm"
                  >
                    @for (o of ncdOptions; track o.value) {
                      <option [ngValue]="o.value">{{ o.label | t }}</option>
                    }
                  </select>
                  <app-icon name="chevron-down" [size]="18" class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          </section>

          <app-compare-table
            [columns]="compareColumns()"
            [carGroups]="compareCarGroups()"
            [setup]="compareSetup()"
            actionLabel="Get this quote"
            quoteBadge="Current quote"
            stickyClass="top-14 -mx-4 mt-6 px-4 md:-mx-6 md:px-6 xl:top-0"
            (chooseCar)="chooseCompareCar($event.column, $event.vehicleId)"
            (remove)="removeCompareCar($event)"
            (setYear)="setCompareYear($event.index, $event.year)"
            (action)="quoteCompared($event)"
          />

          @if (compareColumns().length > 0) {
            <div class="mt-12 flex flex-col items-center gap-3 text-center">
              @if (bundle()!.advisor.phoneWa) {
                <button
                  type="button"
                  (click)="whatsAppComparison()"
                  class="flex items-center justify-center gap-2 rounded-full bg-[var(--success)] px-6 py-3 text-sm font-semibold text-[var(--success-foreground)] transition-transform active:scale-95"
                >
                  <app-icon name="message-circle" [size]="18" />
                  {{ "WhatsApp me about these cars" | t }}
                </button>
              }
              <p class="max-w-md text-pretty text-xs text-muted-foreground">{{ "Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here." | t }}</p>
            </div>
          }
        </div>
      }

      <!-- Cars:the SA's lineup with brochures, grouped by model. View + quote only — no Share here,
           since this page is the customer's, not the SA's. -->
      @if (section() === 'cars') {
        <div class="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6 xl:py-8">
          <div class="flex flex-col gap-1">
            <h1 class="text-base font-semibold tracking-tight">{{ "Cars & brochures" | t }}</h1>
            <p class="text-sm text-muted-foreground">{{ "Browse the lineup, open a brochure, or get a quote for any car." | t }}</p>
          </div>

          @if (carsBrands().length > 1) {
            <div role="tablist" [attr.aria-label]="'Brand' | t" class="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
              @for (b of carsBrands(); track b) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="carsBrand() === b"
                  (click)="selectCarsBrand(b)"
                  class="shrink-0 rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
                  [ngClass]="carsBrand() === b ? 'border-brand bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  {{ b }}
                </button>
              }
            </div>
          }

          @for (run of carsRuns(); track run.key) {
            @if (run.kind === 'model') {
              <section class="flex flex-col gap-3">
                <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 class="text-base font-semibold tracking-tight">{{ vehicleTitle(run.group.brand, run.group.model) }}</h2>
                  <span class="text-xs text-muted-foreground">
                    {{ run.group.cars.length }} {{ 'variants' | t }} · {{ 'from' | t }}
                    <span class="font-semibold text-foreground tabular">{{ fmt(run.group.fromPrice) }}</span>
                  </span>
                </div>
                <!-- One sideways row per model: the next card peeks in, with an arrow when more are hidden -->
                <app-scroll-row>
                  @for (v of run.group.cars; track v.id) {
                    <div class="grid w-[42%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-2.25rem)/4)] 2xl:w-[calc((100%-3rem)/5)]">
                      <ng-container *ngTemplateOutlet="browseCard; context: { $implicit: v, full: false }" />
                    </div>
                  }
                </app-scroll-row>
              </section>
            } @else {
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                @for (v of run.cars; track v.id) {
                  <ng-container *ngTemplateOutlet="browseCard; context: { $implicit: v, full: true }" />
                }
              </div>
            }
          }

          <ng-template #browseCard let-v let-full="full">
          <article class="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
            <div class="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[oklch(0.9_0.005_280)]">
              @if (v.photoUrl) {
                <img [src]="v.photoUrl | carShadow" [alt]="modelVariantLabel(v.model, v.variant)" loading="lazy" class="h-full w-full object-contain p-2.5" />
              } @else {
                <app-icon name="car" [size]="28" class="text-muted-foreground" />
              }
              @if (browseRebate(v) > 0) {
                <span class="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground shadow">
                  {{ 'Rebate {amount}' | t: { amount: fmt(browseRebate(v)) } }}
                </span>
              }
            </div>
            <div class="flex flex-1 flex-col gap-2.5 p-3">
              <div class="flex min-w-0 flex-col gap-1">
                <span class="truncate text-sm font-bold">{{ full ? modelVariantLabel(v.model, v.variant) : (variantText(v.variant) || v.model) }}</span>
                <span class="text-xs text-muted-foreground"><span class="font-semibold text-foreground tabular">{{ fmt(v.price) }}</span> {{ "OTR" | t }}</span>
              </div>
              <div class="mt-auto flex gap-2">
                @if (v.brochureUrl) {
                  <a
                    [href]="v.brochureUrl"
                    target="_blank"
                    rel="noopener"
                    (click)="activity?.record('brochure_opened', v.id)"
                    class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    <app-icon name="file-text" [size]="16" />
                    {{ "Brochure" | t }}
                  </a>
                }
                <button
                  type="button"
                  (click)="quoteThisCar(v)"
                  class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-soft py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
                >
                  <app-icon name="calculator" [size]="16" />
                  {{ "Quote" | t }}
                </button>
              </div>
            </div>
          </article>
          </ng-template>
        </div>
      }
      </div>

      <!-- Full quote: the poster at full width, scrollable, over everything -->
      @if (fullQuoteOpen()) {
        <div class="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" [attr.aria-label]="'Your quote' | t">
          <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
            <span class="text-base font-semibold text-white">{{ "Your quote" | t }}</span>
            <button type="button" (click)="fullQuoteOpen.set(false)" class="btn btn-outline border-white/30 text-white hover:bg-white/10">
              <app-icon name="x" [size]="16" />
              {{ "Close" | t }}
            </button>
          </div>
          <!-- Tap the poster to zoom in 2× (scroll around), tap again to fit -->
          <div class="min-h-0 flex-1 overflow-auto overscroll-contain px-3 pb-6" (click)="$event.target === $event.currentTarget && fullQuoteOpen.set(false)">
            <canvas
              #fullQuoteCanvas
              (click)="fullQuoteZoomed.set(!fullQuoteZoomed())"
              class="mx-auto block h-auto rounded-xl"
              [ngClass]="fullQuoteZoomed() ? 'w-[200%] max-w-none cursor-zoom-out' : 'w-full max-w-3xl cursor-zoom-in'"
            ></canvas>
          </div>
          <p class="shrink-0 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-xs text-white/70">
            {{ (fullQuoteZoomed() ? 'Tap the quote to fit it to the screen.' : 'Tap the quote to zoom in.') | t }}
          </p>
        </div>
      }

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
            <div class="flex flex-col gap-3 overflow-y-auto p-4">
              <p class="text-xs text-muted-foreground">{{ "View only — set by your advisor." | t }}</p>
              <div class="overflow-hidden rounded-lg border border-border text-xs">
                <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
                  <span>{{ "Premium Pricing" | t }}</span>
                  <span>{{ "RM" | t }}</span>
                </div>
                @if (insuranceBreakdown().mode === 'flat') {
                  <div class="flex flex-col divide-y divide-border/60">
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">{{ "Insurance Price" | t }}</span>
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
                      <span class="text-muted-foreground">{{ "Basic Premium" | t }}</span>
                      <span class="tabular">{{ insuranceBreakdown().basicPremium.toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">{{ "Premium All Rider" | t }}</span>
                      <span class="tabular">{{ insuranceBreakdown().premiumAllRider.toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">&minus;NCD ({{ insuranceBreakdown().ncdPct }}%)</span>
                      <span class="tabular">{{ insuranceBreakdown().ncdAmount.toFixed(2) }}</span>
                    </div>
                  </div>
                  @if (insuranceDetails().additionalCoverages.length > 0) {
                    <div class="bg-muted/40 px-3 py-1.5 font-semibold">{{ "+Additional Coverages" | t }}</div>
                    <div class="flex flex-col divide-y divide-border/60">
                      @for (item of insuranceDetails().additionalCoverages; track $index) {
                        <div class="flex items-center justify-between px-3 py-1.5">
                          <span class="text-muted-foreground">{{ item.label || ('Untitled coverage' | t) }}</span>
                          <span class="tabular">{{ item.amount.toFixed(2) }}</span>
                        </div>
                      }
                    </div>
                  }
                  <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
                    <span>{{ "Gross Premium" | t }}</span>
                    <span class="tabular">{{ insuranceBreakdown().grossPremium.toFixed(2) }}</span>
                  </div>
                  <div class="flex flex-col divide-y divide-border/60">
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">{{ "+Stamp Duty" | t }}</span>
                      <span class="tabular">{{ insuranceBreakdown().stampDuty.toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">+Service Tax ({{ insuranceBreakdown().serviceTaxPct }}%)</span>
                      <span class="tabular">{{ insuranceBreakdown().serviceTaxAmount.toFixed(2) }}</span>
                    </div>
                    <div class="flex items-center justify-between px-3 py-1.5">
                      <span class="text-muted-foreground">{{ "+EPR" | t }}</span>
                      <span class="tabular">{{ insuranceBreakdown().epr.toFixed(2) }}</span>
                    </div>
                  </div>
                }
                <div class="flex items-center justify-between bg-brand-soft px-3 py-2">
                  <span class="font-semibold text-brand">{{ "Total Due" | t }}</span>
                  <span class="font-bold tabular text-brand">{{ insuranceBreakdown().totalDue.toFixed(2) }}</span>
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
  /** This month's name in the page's language ("November" / "November", "Disember"…) for the pinned rebate line. */
  rebateMonth = computed(() => new Date().toLocaleDateString(this.i18n.lang() === 'ms' ? 'ms-MY' : 'en-MY', { month: 'long' }));

  /** The full-quote viewer (tap the poster). */
  fullQuoteOpen = signal(false);
  fullQuoteZoomed = signal(false);
  /** Copies the live poster into the viewer as it opens (drawImage, so a cross-origin car photo
   *  can't block it the way toDataURL would). */
  @ViewChild('fullQuoteCanvas') set fullQuoteCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const src = this.posterCanvasRef?.nativeElement;
    const dst = ref?.nativeElement;
    if (!src || !dst) return;
    dst.width = src.width;
    dst.height = src.height;
    dst.getContext('2d')?.drawImage(src, 0, 0);
  }

  openFullQuote() {
    this.fullQuoteZoomed.set(false);
    this.fullQuoteOpen.set(true);
  }

  /** Phone / tablet menu drawer (the hamburger). */
  menuOpen = signal(false);

  sections: { id: PageSection; label: string; icon: IconName }[] = [
    // Quote is the page's main feature, so it sits right after Profile; Compare leads on from it.
    { id: 'profile', label: 'Profile', icon: 'user' },
    { id: 'quote', label: 'Quote', icon: 'calculator' },
    { id: 'budget', label: 'Budget', icon: 'wallet' },
    { id: 'compare', label: 'Compare', icon: 'table' },
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

  /** Up to 4 models of the Primary Brand for the Profile page, each starting from its cheapest variant. */
  featuredModels = computed(() =>
    this.carGroupsForBrowse()
      .slice(0, 4)
      .map((g) => ({ ...g, car: g.cars.reduce((a, b) => (b.price < a.price ? b : a)) })),
  );

  /** The Cars section laid out: a model with several variants keeps its own titled, swipeable row;
   *  one-variant models next to each other share one grid instead of a lonely card per row. */
  carsRuns = computed(() => {
    type Group = { key: string; brand: string; model: string; cars: Vehicle[]; fromPrice: number };
    const runs: ({ kind: 'model'; key: string; group: Group } | { kind: 'singles'; key: string; cars: Vehicle[] })[] = [];
    for (const g of this.carGroupsForBrowse()) {
      if (g.cars.length > 1) {
        runs.push({ kind: 'model', key: g.key, group: g });
        continue;
      }
      const last = runs[runs.length - 1];
      if (last?.kind === 'singles') last.cars.push(g.cars[0]);
      else runs.push({ kind: 'singles', key: 'singles:' + g.key, cars: [g.cars[0]] });
    }
    return runs;
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

  /** Top bar title on a phone / tablet. */
  sectionLabel = computed(() => this.sections.find((t) => t.id === this.section())?.label ?? '');

  selectSection(id: PageSection) {
    this.menuOpen.set(false);
    const changed = this.section() !== id;
    if (id === 'compare' && this.compareSlots().length === 0) {
      const v = this.selectedVehicle();
      this.compareSlots.set([{ vehicleId: v.id, year: this.modelYear() }]);
    }
    this.section.set(id);
    window.scrollTo({ top: 0, behavior: changed ? 'instant' : 'smooth' });
    // No walkthrough pops up by itself: a customer came for a price, and the page already shows
    // one. The (i) button next to Reset starts it for anyone who wants it.
  }


  callHref = computed(() => {
    const advisor = this.bundle()?.advisor;
    const wa = (advisor?.phoneWa ?? '').replace(/[^0-9]/g, '');
    if (wa) return `tel:+${wa}`;
    const local = (advisor?.phoneDisplay ?? '').replace(/[^0-9+]/g, '');
    return local ? `tel:${local}` : null;
  });

  /** The advisor's WhatsApp-message language (Settings → Language), for everything sent to them. */
  waLang = computed<Lang>(() => {
    const d = this.bundle()?.salesDefaults;
    return d?.whatsappLanguage ?? d?.posterLanguage ?? 'en';
  });

  profileWhatsAppHref = computed(() => {
    const advisor = this.bundle()?.advisor;
    const wa = (advisor?.phoneWa ?? '').replace(/[^0-9]/g, '');
    if (!wa) return null;
    const text = translate(this.waLang(), 'Hi {advisor}, I came across your profile and would like to know more.', { advisor: advisor!.name });
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
  fmt2 = formatRM2;
  modelVariantLabel = modelVariantLabel;
  formatPhone = formatMalaysianPhone;
  ncdOptions = NCD_OPTIONS;
  /** "Year 2" under each NCD box (from the option's own label), "No NCD" for 0%. Same as the Calculator. */
  ncdYear(opt: { value: number; label: string }): string {
    return opt.value === 0 ? 'No NCD' : (opt.label.split(' — ')[1] ?? '');
  }

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
  /** The brand chips: the advisor's Primary Brand first, then the rest in catalog order. */
  chipBrands = computed(() => {
    const all = this.brands();
    const first = this.bundle()?.defaultBrand;
    return first && all.includes(first) ? [first, ...all.filter((b) => b !== first)] : all;
  });

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
    this.fullQuoteOpen.set(false);
    this.menuOpen.set(false);
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
    return { interestRate: d?.interestRate ?? 2.3, effectiveRate: d?.effectiveRate ?? 4.3 };
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
  insuranceDetails = computed((): InsuranceQuotationDetails => this.insuranceFor(this.selectedVehicle(), this.autoBasicPremium()));

  /** A car's quotation as the advisor has it, with the motor tariff applied the same way. */
  insuranceFor(vehicle: Vehicle, fallbackBasicPremium: number): InsuranceQuotationDetails {
    const d = this.bundle()?.salesDefaults;
    const tariff = d?.motorTariff ?? DEFAULT_MOTOR_TARIFF;
    const band = vehicle.ratingBand ?? guessBand(`${vehicle.model} ${vehicle.variant}`, tariff);
    const tariffPremium = tariffBasicPremium(vehicle.sumInsured, band, d?.insuranceRegion ?? 'peninsular', tariff);
    return resolveInsuranceDetails(vehicle, this.bundle()?.vehicleInsurance[vehicle.id], fallbackBasicPremium, tariffPremium);
  }
  insuranceBreakdown = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), this.ncd()));
  insurance = computed(() => this.insuranceBreakdown().totalDue);
  /** Same insurance quotation at 0% NCD — what the loan is sized against, so dialling in a better
   *  NCD only shrinks the downpayment (see computeQuotationTotals's loanBasisInsuranceAmount). */
  loanBasisInsurance = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), 0).totalDue);
  /** What the customer's NCD saves on insurance (shown as "Save RM…"). */
  ncdSaving = computed(() => Math.max(0, this.loanBasisInsurance() - this.insurance()));

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
      loanRounding: this.loanRounding(),
    }),
  );
  /** The advisor's Loan Rounding setting, so the customer's loan matches the advisor's own quote. */
  loanRounding = computed(() => this.bundle()?.salesDefaults.loanRounding ?? 'down');
  /** This variant's minimum downpayment (set by the advisor in Price Settings), before rebate; 0 = none. */
  minDownpayment = computed(() => minDownpaymentCash(this.selectedVehicle().minDownpayment, this.basePrice() + this.insurance()));
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
      loanRounding: this.loanRounding(),
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

  /** One-tap downpayment setups: 10% of the price, Full Loan (no cash down beyond the RM100
   *  rounding remainder, or the car's minimum downpayment), or an RM 10k deposit. */
  readonly downpaymentPresets = DOWNPAYMENT_PRESETS;

  applyDownpaymentPreset(preset: DownpaymentPreset) {
    this.loanAmountDraft.set(null);
    this.monthlyInstallmentDraft.set(null);
    if (preset === 'fullLoan') {
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(this.minCashNeeded());
    } else if ('percent' in preset) {
      this.downpaymentType.set('percent');
      this.downpaymentValue.set(preset.percent);
    } else {
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(preset.amount);
    }
  }

  isDownpaymentPreset(preset: DownpaymentPreset): boolean {
    const type = this.downpaymentType();
    if (preset === 'fullLoan') return type === 'amount' && this.downpaymentValue() === this.minCashNeeded();
    if ('percent' in preset) return type === 'percent' && this.downpaymentValue() === preset.percent;
    return type === 'amount' && this.downpaymentValue() === preset.amount;
  }

  /** "10%", "RM 10k", or "Full Loan" ("Minimum" for a car with a minimum downpayment). */
  downpaymentPresetLabel(preset: DownpaymentPreset): string {
    if (preset === 'fullLoan') return this.minDownpayment() > 0 ? 'Minimum' : 'Full Loan';
    if ('percent' in preset) return `${preset.percent}%`;
    return preset.amount >= 1000 ? `RM ${preset.amount / 1000}k` : `RM ${preset.amount}`;
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

  onLoanAmountInput(value: number | null) {
    this.loanAmountDraft.set(Math.max(0, value ?? 0));
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

  onMonthlyInstallmentInput(value: number | null) {
    this.monthlyInstallmentDraft.set(Math.max(0, value ?? 0));
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

  private i18n = inject(I18nService);
  /** The page's language (the advisor's poster language), passed on to the Privacy Policy link. */
  pageLang = computed(() => this.i18n.lang());

  /** Quote link activity — set once the link has loaded (see link-activity-recorder.ts). */
  activity: LinkActivityRecorder | null = null;

  /** The quote as it stands, for the advisor's Activity feed. */
  private quotePayload(): Record<string, unknown> {
    return {
      year: this.modelYear(),
      deposit: Math.round(this.downpaymentCash()),
      tenure: this.tenureYears(),
      monthly: Math.round(this.monthlyInstalment() * 100) / 100,
      cash: this.isCashPurchase(),
    };
  }

  private activityCar = '';
  private activityQuote = '';
  private activityCompare = '';
  private quoteTimer: ReturnType<typeof setTimeout> | null = null;
  private compareTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private host: ElementRef) {
    // The page takes the advisor's colour; leaving it puts back the signed-in account's own.
    effect(() => {
      const bundle = this.bundle();
      if (bundle) applyAppColour(bundle.salesDefaults.posterAccent);
    });
    const ownSettings = inject(SettingsService);
    inject(DestroyRef).onDestroy(() => applyAppColour(ownSettings.settings().salesDefaults.posterAccent));

    // Activity: a different car chosen (not the one the link opens on)
    effect(() => {
      const id = this.selectedVehicle().id;
      const loaded = !this.loading() && this.vehicles().length > 0;
      if (!loaded || !this.activity) return;
      if (!this.activityCar) {
        this.activityCar = id;
        return;
      }
      if (id === this.activityCar) return;
      this.activityCar = id;
      this.activity.record('car_viewed', id, { year: this.modelYear() });
    });
    // Activity: a quote the customer settled on (after a pause), once they've changed something
    effect(() => {
      const key = [this.selectedVehicle().id, this.modelYear(), this.downpaymentType(), this.downpaymentValue(), this.tenureYears(), this.ncd()].join('|');
      if (!this.activity || this.loading()) return;
      if (!this.activityQuote) {
        this.activityQuote = key;
        return;
      }
      if (this.quoteTimer) clearTimeout(this.quoteTimer);
      this.quoteTimer = setTimeout(() => {
        if (key === this.activityQuote) return;
        this.activityQuote = key;
        this.activity?.record('quote_built', this.selectedVehicle().id, this.quotePayload());
      }, 4000);
    });
    // Activity: two or three cars compared
    effect(() => {
      const ids = this.compareColumns().map((c) => c.vehicle.id);
      if (!this.activity || ids.length < 2) return;
      if (this.compareTimer) clearTimeout(this.compareTimer);
      this.compareTimer = setTimeout(() => {
        const key = ids.join(',');
        if (key === this.activityCompare) return;
        this.activityCompare = key;
        this.activity?.record('compare_used', null, { cars: ids });
      }, 3000);
    });

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
      this.i18n.use(bundle.salesDefaults.posterLanguage ?? 'en');
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
      this.activity = new LinkActivityRecorder(this.token, this.singleBrandMode ? 'brand' : 'all');
      this.activity.record('link_opened');
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
    const showPreview = () => this.section.set('quote');
    const showCustomize = showPreview;
    const steps: TourStep[] = [
      {
        title: this.i18n.t('Build your own quote'),
        body: this.i18n.t('Change the car, downpayment and repayment period, and your quote updates instantly. This quick guide takes under a minute.'),
        before: showPreview,
      },
      {
        target: 'quote-preview',
        title: this.i18n.t('Your live quote'),
        body: this.i18n.t('This is your quote. It updates as you change anything below. Tap it to see it in full.'),
        before: showPreview,
      },
      {
        target: 'quote-car',
        title: this.i18n.t('Pick your car'),
        body: this.i18n.t('Choose the brand, model and colour you are interested in.'),
        before: showCustomize,
      },
      {
        target: 'quote-downpayment',
        title: this.i18n.t('Set your downpayment'),
        body: this.i18n.t('Tap 10%, Full Loan or RM 10k for a quick setup, or type your own amount.'),
        before: showCustomize,
      },
      {
        target: 'quote-tenure',
        title: this.i18n.t('Choose how long to pay'),
        body: this.i18n.t('Pick the number of years. Your monthly instalment updates straight away.'),
        before: showCustomize,
      },
      {
        target: 'quote-whatsapp',
        title: this.i18n.t('Send it to {advisor}', { advisor }),
        body: this.i18n.t('Happy with the numbers? Tap "WhatsApp Me Here" to send this exact quote to {advisor}, who will confirm the final figures with you.', { advisor }),
        before: showPreview,
        skipIfMissing: true,
        doneLabel: this.i18n.t('Got it'),
      },
    ];
    const labels = { next: this.i18n.t('Next'), back: this.i18n.t('Back'), skip: this.i18n.t('Skip'), step: this.i18n.t('Step {n} of {total}') };
    return this.tour.start('quote', steps.map((s) => ({ ...s, labels })));
  }

  private buildPosterData(): PosterData {
    const vehicle = this.selectedVehicle();
    const advisor = this.bundle()!.advisor;
    const monthly = this.monthlyInstalment();
    const lang = this.i18n.lang();
    return {
      lang,
      accent: this.bundle()!.salesDefaults.posterAccent,
      brand: vehicle.brand,
      modelTitle: modelVariantLabel(vehicle.model, vehicle.variant),
      year: this.modelYear(),
      dateStr: this.quoteDate(),
      logoUrl: this.brandLogoUrl(),
      carImageUrl: vehicle.photoUrl ?? null,
      colours: vehicle.colours ?? [],
      colourSurcharges: vehicle.colourSurcharges ?? {},
      colourHex: vehicle.colourHex,
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
      rateLabel: `${this.interestRate()}% ${this.rateType() === 'flat' ? translate(lang, 'FLAT') : 'EIR'}`,
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
  /** "Do you have a car to trade in?" — only a yes/no; the advisor asks for the model on WhatsApp. */
  tradeIn = signal(false);
  readonly tradeInOptions = [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' },
  ];

  openWhatsAppToAdvisor() {
    const vehicle = this.selectedVehicle();
    this.activity?.record('whatsapp_tapped', vehicle.id, this.quotePayload());
    const W = (en: string, params?: Record<string, string | number>) => translate(this.waLang(), en, params);
    const dp = downpaymentDisplay(this.downpaymentCash());
    const lines = [
      W("Hi {advisor}, I'm interested in the {car} ({year}).", { advisor: this.bundle()!.advisor.name, car: vehicleTitle(vehicle.brand, modelVariantLabel(vehicle.model, vehicle.variant)), year: this.modelYear() }),
      '',
      W("Here's the quote I put together:"),
      // Only mentioned for cars that actually offer a colour choice — see the Colour select's own
      // @if (selectedVehicle().colours; ...) guard. "Not confirmed yet" (rather than omitting the
      // line) since the advisor still needs to know a colour is expected, just not picked.
      ...(vehicle.colours ? [W('- Colour: {colour}', { colour: this.selectedColour() ?? W('Not confirmed yet') })] : []),
      `- ${W(dp.label)}: ${this.fmt2(dp.amount)}`,
      W('- Loan Amount: {amount}', { amount: this.fmt2(this.loanAmount()) }),
      W('- Rebate: {amount}', { amount: this.fmt(this.rebateInput()) }),
      W('- Insurance ({ncd}% NCD): {amount}', { ncd: this.ncd(), amount: this.fmt2(this.insurance()) }),
      W('- Tenure: {years} Years', { years: this.tenureYears() }),
      ...(this.tradeIn() ? [W('- Trade-in: Yes, I have a car to trade in')] : []),
      '',
      W('Please get in touch with me!'),
    ];
    const phone = this.bundle()!.advisor.phoneWa.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  // ---------- Compare ----------

  readonly Math = Math;
  readonly compareTenureYears = TENURE_YEAR_OPTIONS;
  readonly compareDpKinds = [
    { id: 'percent' as const, label: '%' },
    { id: 'amount' as const, label: 'RM' },
  ];
  /** The cars in the Compare section's columns (vehicle id + model year), at most 3. */
  private compareSlots = signal<{ vehicleId: string; year: number }[]>([]);

  /** Same loan as this customer's quote — the Quote tab's own downpayment, tenure and NCD — on
   *  the advisor's default rate type (a car with no EIR anywhere falls back to flat, as on Quote). */
  compareSetup = computed<CompareSetup>(() => ({
    downpaymentType: this.downpaymentType(),
    downpaymentValue: this.downpaymentValue(),
    tenureMonths: this.tenureMonths(),
    rateType: this.bundle()?.salesDefaults.defaultRateType ?? 'flat',
    ncd: this.ncd(),
  }));

  /** Only the brands this link shows (just the Primary Brand on the single-brand link). */
  compareCarGroups = computed(() =>
    this.carsBrands().map((brand) => ({ brand, vehicles: this.vehicles().filter((v) => v.brand === brand) })),
  );

  compareColumns = computed<CompareColumn[]>(() => {
    const bundle = this.bundle();
    if (!bundle) return [];
    const setup = this.compareSetup();
    const pricing: ComparePricing = {
      defaults: {
        ...DEFAULT_SETTINGS.salesDefaults,
        interestRate: this.rateDefaults().interestRate,
        effectiveRate: this.rateDefaults().effectiveRate,
        loanRounding: this.loanRounding(),
      },
      insuranceFor: (v) => this.insuranceFor(v, v.basicPremium ?? basicPremiumDefault(v.price, this.insuranceRatePct())),
      // Customer-facing: the base rebate only, never the additional rebate — that's an extra only
      // the advisor grants by hand (same rule as the Quote tab).
      includeAdditionalRebate: false,
      flatWhenNoEir: true,
    };
    const current = this.selectedVehicle();
    return this.compareSlots().flatMap((slot, index) => {
      const vehicle = this.vehicles().find((v) => v.id === slot.vehicleId);
      if (!vehicle) return [];
      return [
        {
          index,
          vehicle,
          year: slot.year,
          years: vehicle.years.map((y) => y.year).sort((a, b) => b - a),
          fromQuote: vehicle.id === current.id && slot.year === this.modelYear(),
          quote: quoteForComparison(vehicle, slot.year, setup, pricing),
        },
      ];
    });
  });

  private newestYear(v: Vehicle): number {
    return Math.max(...v.years.map((y) => y.year));
  }

  /** From the Quote tab: the car being quoted becomes the first column (other picks stay). */
  openCompare() {
    const v = this.selectedVehicle();
    const others = this.compareSlots().filter((s) => s.vehicleId !== v.id);
    this.compareSlots.set([{ vehicleId: v.id, year: this.modelYear() }, ...others].slice(0, 3));
    this.selectSection('compare');
  }

  chooseCompareCar(column: number, vehicleId: string | null) {
    const list = this.compareSlots();
    if (vehicleId === null) return this.removeCompareCar(column);
    const v = this.vehicles().find((x) => x.id === vehicleId);
    if (!v || list.some((s, i) => s.vehicleId === vehicleId && i !== column)) return;
    const slot = { vehicleId, year: this.newestYear(v) };
    this.compareSlots.set(column < list.length ? list.map((s, i) => (i === column ? slot : s)) : [...list, slot].slice(0, 3));
  }

  removeCompareCar(index: number) {
    this.compareSlots.update((list) => list.filter((_, i) => i !== index));
  }

  setCompareYear(index: number, year: number) {
    this.compareSlots.update((list) => list.map((s, i) => (i === index ? { ...s, year } : s)));
  }

  /** "Get this quote" — back to the Quote tab on that car and model year. */
  // ---------- Budget ----------

  /** The cars this link shows (just the Primary Brand's on the single-brand link). */
  budgetVehicles = computed(() => {
    const brands = this.carsBrands();
    return this.vehicles().filter((v) => brands.includes(v.brand));
  });
  /** The advisor's own quoting rules — the same ones the Quote tab uses. */
  budgetRules = computed<BudgetRules>(() => {
    const d = this.bundle()?.salesDefaults;
    return {
      defaultRateType: d?.defaultRateType ?? 'flat',
      interestRate: d?.interestRate ?? 2.3,
      effectiveRate: d?.effectiveRate,
      basicPremiumRatePct: d?.basicPremiumRatePct ?? 3.27,
      ncd: this.ncd(),
      loanRounding: d?.loanRounding,
      insuranceFor: (vehicle, fallback) => this.insuranceFor(vehicle, fallback),
    };
  });

  /** "Not sure if you qualify?" — a WhatsApp to the advisor, so an unsure customer talks to them
   *  instead of quietly leaving. Null when the advisor has no WhatsApp number. */
  qualifyWhatsAppHref = computed(() => {
    const advisor = this.bundle()?.advisor;
    const wa = (advisor?.phoneWa ?? '').replace(/[^0-9]/g, '');
    if (!wa) return null;
    const text = translate(this.waLang(), 'Hi {advisor}, I am not sure if I qualify for a car loan. Could you check with the banks for me?', { advisor: advisor!.name });
    return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  });

  /** A car from Budget opens in Quote at the deposit and loan period it showed. */
  quoteFromBudget(pick: BudgetPick) {
    const v = this.vehicles().find((x) => x.id === pick.vehicleId);
    if (!v) return;
    this.selectedBrand.set(v.brand);
    this.selectModelVariant(v.model, v.variant);
    if (v.years.some((y) => y.year === pick.year)) this.modelYear.set(pick.year);
    this.downpaymentType.set('amount');
    this.downpaymentValue.set(pick.deposit);
    this.tenureYears.set(pick.tenureYears);
    this.selectSection('quote');
  }

  quoteCompared(c: CompareColumn) {
    this.selectedBrand.set(c.vehicle.brand);
    this.selectModelVariant(c.vehicle.model, c.vehicle.variant);
    if (c.years.includes(c.year)) this.modelYear.set(c.year);
    this.selectSection('quote');
  }

  setCompareDownpaymentType(type: DownpaymentType) {
    if (type === this.downpaymentType()) return;
    this.downpaymentType.set(type);
    this.downpaymentValue.set(type === 'percent' ? (this.bundle()?.salesDefaults.downpaymentPct ?? 10) : 10_000);
  }

  /** Sends the advisor the cars being compared, with each one's monthly, as a WhatsApp message. */
  whatsAppComparison() {
    this.activity?.record('whatsapp_tapped', null, {});
    const s = this.compareSetup();
    const dp = s.downpaymentType === 'percent' ? `${s.downpaymentValue}%` : this.fmt(s.downpaymentValue);
    const W = (en: string, params?: Record<string, string | number>) => translate(this.waLang(), en, params);
    const lines = [
      W("Hi {advisor}, I'm comparing these cars:", { advisor: this.bundle()!.advisor.name }),
      '',
      ...this.compareColumns().map((c) => {
        const name = vehicleTitle(c.vehicle.brand, modelVariantLabel(c.vehicle.model, c.vehicle.variant));
        const monthly = c.quote.monthly === null ? W('rate needed') : c.quote.monthly === 0 ? W('cash') : W('{amount}/month', { amount: this.fmt2(c.quote.monthly) });
        return `- ${name} (${c.year}): ${monthly}`;
      }),
      '',
      W('Based on {dp} downpayment, {years} years, {ncd}% NCD.', { dp, years: s.tenureMonths / 12, ncd: s.ncd }),
      '',
      W('Which one would you recommend?'),
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
    this.tradeIn.set(false);
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
