import { Component, HostListener, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { NumberFieldComponent } from '../shared/number-field.component';
import { InsuranceQuotationEditorComponent } from '../shared/insurance-quotation-editor.component';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { brandInitials, brandLogo, brandStyle } from '../data/dashboard-data';
import { basicPremiumDefault, computeInsuranceBreakdown, formatRM, minDownpaymentCash, modelVariantLabel, type Vehicle, type VehicleYear } from '../data/calculator-data';

/** Everything the editor panel can change for one variant — price and rates live here, since
 *  they're the same regardless of which year is in stock; Rebate and Additional Rebate both live
 *  per model year instead (see VehicleYear) since either can differ year to year independently of
 *  the other. Basic Premium and Add Benefits aren't here — they're set via the Itemized Insurance
 *  Quotation section instead, which already covers them. */
type PanelForm = {
  price: number;
  /** The car's own flat rate; null means "follow the account default rate". */
  interestRate: number | null;
  effectiveRate: number | null;
  /** Minimum cash downpayment; 0 = none (Full Loan allowed). */
  minDpType: 'amount' | 'percent';
  minDpValue: number;
  /** Working copy of the variant's model years — edited in place, newest first, only written back
   *  through VehicleCatalogService on Save. */
  years: VehicleYear[];
};

function pickForm(v: Vehicle): PanelForm {
  return {
    price: v.price,
    interestRate: v.interestRate ?? null,
    effectiveRate: v.effectiveRate ?? null,
    minDpType: v.minDownpayment?.type ?? 'amount',
    minDpValue: v.minDownpayment?.value ?? 0,
    years: v.years.map((y) => ({ ...y })).sort((a, b) => b.year - a.year),
  };
}

/** Order- and undefined/null-insensitive comparison key, so typing a value back to what it was
 *  clears the unsaved state. */
function formKey(f: PanelForm): string {
  // The unit only matters once there is a minimum — 0 is "none" in either unit.
  return JSON.stringify([f.price, f.interestRate, f.effectiveRate, f.minDpValue > 0 ? f.minDpType : null, f.minDpValue, yearsKey(f)]);
}

function yearsKey(f: PanelForm): string {
  return JSON.stringify(f.years.map((y) => [y.year, y.rebate ?? null, y.additionalRebate ?? null]));
}

type ModelGroup = { key: string; model: string; rows: Vehicle[] };
type BrandGroup = { brand: string; models: ModelGroup[] };
type PendingAction = { kind: 'close' } | { kind: 'open'; id: string };

/**
 * One place for every variant's pricing (price, rates, itemized insurance) plus which model years
 * it's available in and each year's rebate. Brand, model, and variant identity is hardcoded by the
 * developer in calculator-data.ts, not editable here; this page only edits pricing and manages
 * model years (e.g. adding an older year a showroom still has in stock).
 *
 * The list is grouped by brand then model (collapsible), and reads as a table when there's room
 * (container query) or as stacked rows on a phone. The account's default flat rate is edited at the
 * top and applies to every car that hasn't been given its own rate.
 *
 * The editor is a side panel on tablet/desktop (full-screen sheet on phones) that stages every
 * edit locally — price, rates, and the whole years list — and only writes through
 * VehicleCatalogService on Save; leaving with unsaved edits (closing, or switching to another car)
 * prompts save-or-discard. The itemized insurance quotation keeps its own Save button inside its
 * section, independent of the panel's Save/Reset.
 */
@Component({
  selector: 'app-price-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, NumberFieldComponent, InsuranceQuotationEditorComponent],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-4 transition-[margin] duration-300" [ngClass]="selected() ? 'xl:mr-[476px]' : ''">
      <!-- Intro -->
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-bold tracking-tight">Price Settings</h2>
        <p class="text-pretty text-sm text-muted-foreground">
          Prices, rates and rebates for every car you sell.
          <button type="button" (click)="showHelp.set(!showHelp())" [attr.aria-expanded]="showHelp()" class="font-medium text-primary hover:underline">
            {{ showHelp() ? 'Hide details' : 'How pricing works' }}
          </button>
        </p>
        @if (showHelp()) {
          <p class="text-pretty rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            Price, rates, and insurance are shared across every year of a variant — set them once, then add older model years still in showroom stock with
            just their own rebate. Every car uses your default flat rate below unless you give it its own. Brands and models are set up by your developer.
          </p>
        }
      </div>

      <!-- Default rates live in Settings; this line just shows them and keeps the bulk reset -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <app-icon name="percent" [size]="13" />
        <span>
          Default rate <span class="tabular font-semibold text-foreground">{{ defaultRate() }}%</span> flat
          · EIR <span class="tabular font-semibold text-foreground">{{ defaultEir() != null ? defaultEir() + '%' : 'not set' }}</span>
          · <a routerLink="/settings" class="font-medium text-primary hover:underline">change in Settings</a>
        </span>
        @if (customRateCount() > 0) {
          <span>·</span>
          <button type="button" (click)="onlyCustomRate.set(!onlyCustomRate())" class="font-medium text-primary hover:underline">
            {{ onlyCustomRate() ? 'show all cars' : customRateCount() + (customRateCount() === 1 ? ' car has its own rate' : ' cars have their own rate') }}
          </button>
          @if (resetAllConfirm()) {
            <span class="ml-auto flex items-center gap-2">
              Put {{ customRateCount() === 1 ? 'it' : 'all ' + customRateCount() }} back on the default?
              <button type="button" (click)="resetAllConfirm.set(false)" class="rounded-lg px-3 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
              <button type="button" (click)="resetAllRatesToDefault()" class="rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground">Reset all</button>
            </span>
          } @else {
            <button type="button" (click)="resetAllConfirm.set(true)" class="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="rotate-ccw" [size]="13" />
              Reset all to default
            </button>
          }
        }
      </div>

      <!-- Filters (stick to the top while scrolling the list) -->
      <div class="sticky -top-4 z-20 -mx-4 flex flex-col gap-2 bg-background px-4 py-2 md:-top-6 md:-mx-6 md:px-6">
        <div class="relative">
          <app-icon name="search" [size]="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search car…"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            class="h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground outline-none"
          />
        </div>
        <div class="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
          <button
            type="button"
            [attr.aria-selected]="brandFilter() === 'All'"
            (click)="brandFilter.set('All')"
            class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="brandFilter() === 'All' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            All ({{ catalog.vehicles().length }})
          </button>
          @for (b of catalog.brands(); track b) {
            <button
              type="button"
              [attr.aria-selected]="brandFilter() === b"
              (click)="brandFilter.set(b)"
              class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="brandFilter() === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              <ng-container [ngTemplateOutlet]="brandMark" [ngTemplateOutletContext]="{ $implicit: b, size: 'size-4 text-[8px]' }" />
              {{ b }} ({{ countForBrand(b) }})
            </button>
          }
        </div>
      </div>

      <!-- List -->
      <div class="@container flex flex-col gap-5">
        @if (groups().length) {
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ navRows().length }} {{ navRows().length === 1 ? 'car' : 'cars' }}{{ onlyCustomRate() ? ' with their own rate' : '' }}</span>
            <button type="button" (click)="toggleAllGroups()" class="font-medium hover:text-foreground">
              {{ collapsed().size ? 'Expand all' : 'Collapse all' }}
            </button>
          </div>
        }

        @for (brandGroup of groups(); track brandGroup.brand) {
          <div class="flex flex-col gap-2.5">
            @if (brandFilter() === 'All') {
              <div class="flex items-center gap-2">
                <ng-container [ngTemplateOutlet]="brandMark" [ngTemplateOutletContext]="{ $implicit: brandGroup.brand, size: 'size-5 text-[9px]' }" />
                <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ brandGroup.brand }}</span>
              </div>
            }
            @for (modelGroup of brandGroup.models; track modelGroup.key) {
              <section class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
                <button
                  type="button"
                  (click)="toggleGroup(modelGroup.key)"
                  [attr.aria-expanded]="!collapsed().has(modelGroup.key)"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                >
                  <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ modelGroup.model }}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">{{ modelGroup.rows.length }} {{ modelGroup.rows.length === 1 ? 'variant' : 'variants' }}</span>
                  <app-icon
                    name="chevron-down"
                    [size]="16"
                    [class]="'shrink-0 text-muted-foreground transition-transform duration-200 ' + (collapsed().has(modelGroup.key) ? '-rotate-90' : '')"
                  />
                </button>

                @if (!collapsed().has(modelGroup.key)) {
                  <!-- Column headers (table layout only) -->
                  <div class="hidden border-t border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground @2xl:grid @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7.5rem_6.5rem_6rem_1rem] @2xl:gap-3">
                    <span>Variant</span>
                    <span>Years &amp; rebates</span>
                    <span class="text-right">Price</span>
                    <span class="text-right">Insurance</span>
                    <span class="text-right">Flat rate</span>
                    <span></span>
                  </div>
                  <div class="divide-y divide-border border-t border-border">
                    @for (v of modelGroup.rows; track v.id) {
                      <button
                        type="button"
                        [id]="'ps-row-' + v.id"
                        (click)="requestOpen(v.id)"
                        class="flex w-full min-w-0 flex-col gap-2 px-4 py-3 text-left transition-colors @2xl:grid @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_7.5rem_6.5rem_6rem_1rem] @2xl:items-center @2xl:gap-3"
                        [ngClass]="v.id === selectedId() ? 'bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-accent/40'"
                      >
                        <span class="flex min-w-0 items-center justify-between gap-2">
                          <span class="truncate text-sm font-semibold">{{ v.variant || v.model }}</span>
                          <app-icon name="chevron-right" [size]="16" class="shrink-0 text-muted-foreground @2xl:hidden" />
                        </span>

                        <span class="flex flex-wrap gap-1">
                          @for (y of yearChips(v); track y.year) {
                            <span class="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular">
                              {{ y.year }}
                              @if (y.rebate > 0) {
                                <span class="font-medium text-[var(--success)]">−{{ fmtCompact(y.rebate) }}</span>
                              }
                            </span>
                          }
                        </span>

                        <span class="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground @2xl:contents">
                          <span class="@2xl:text-right">
                            <span class="@2xl:hidden">Price </span>
                            <strong class="font-semibold text-foreground tabular">{{ fmt(v.price) }}</strong>
                          </span>
                          <span class="@2xl:text-right">
                            <span class="@2xl:hidden">Insurance </span>
                            <strong class="font-semibold text-foreground tabular">{{ fmt(savedInsuranceTotalFor(v)) }}</strong>
                          </span>
                          <span class="flex flex-col @2xl:items-end">
                            <span>
                              <span class="@2xl:hidden">Rate </span>
                              @if (v.interestRate != null) {
                                <strong class="font-semibold text-foreground tabular">{{ v.interestRate }}%</strong>
                              } @else {
                                <span class="tabular">{{ defaultRate() }}% <span class="text-muted-foreground/70">default</span></span>
                              }
                            </span>
                            @if (v.effectiveRate != null) {
                              <span class="text-[11px] tabular">EIR {{ v.effectiveRate }}%</span>
                            }
                          </span>
                        </span>

                        <app-icon name="chevron-right" [size]="16" class="hidden shrink-0 text-muted-foreground @2xl:block" />
                      </button>
                    }
                  </div>
                }
              </section>
            }
          </div>
        } @empty {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <p class="text-sm font-semibold">No cars match</p>
            <p class="text-xs text-muted-foreground">Try a different name or brand.</p>
            <button type="button" (click)="clearFilters()" class="mt-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">Clear filters</button>
          </div>
        }
      </div>
    </div>

    <!-- Editor: full-screen sheet on phones, side panel from md up. Below xl a backdrop dims the
         list; from xl the list shifts left and stays usable, so another row can be picked directly. -->
    @if (selected(); as v) {
      <button type="button" aria-label="Close editor" class="ps-backdrop fixed inset-0 z-40 hidden bg-black/60 md:block xl:hidden" (click)="requestClose()"></button>
      <aside
        role="dialog"
        [attr.aria-label]="'Edit ' + modelVariantLabel(v.model, v.variant)"
        class="ps-drawer fixed inset-0 z-50 flex flex-col bg-card text-card-foreground md:left-auto md:w-[460px] md:border-l md:border-border md:shadow-[0_0_60px_-10px_oklch(0_0_0/80%)]"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 border-b border-border px-4 py-3">
          <ng-container [ngTemplateOutlet]="brandMark" [ngTemplateOutletContext]="{ $implicit: v.brand, size: 'size-8 text-[10px]' }" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-bold">{{ modelVariantLabel(v.model, v.variant) }}</span>
            <span class="text-xs text-muted-foreground tabular">{{ v.brand }} · {{ navIndex() + 1 }} of {{ navRows().length }}</span>
          </div>
          <div class="flex shrink-0 items-center">
            <button type="button" (click)="step(-1)" [disabled]="navIndex() <= 0" aria-label="Previous car" title="Previous car (Alt+↑)" class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30">
              <app-icon name="arrow-up" [size]="15" />
            </button>
            <button type="button" (click)="step(1)" [disabled]="navIndex() >= navRows().length - 1" aria-label="Next car" title="Next car (Alt+↓)" class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30">
              <app-icon name="arrow-down" [size]="15" />
            </button>
            <button type="button" (click)="requestClose()" aria-label="Close" title="Close (Esc)" class="ml-1 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
        </div>

        <div class="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <!-- Pricing -->
          <section class="flex flex-col gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Price</span>
            <app-number-field prefix="RM" ariaLabel="Price" [value]="form().price" (valueChange)="setPrice($event)" />
            @if (form().price !== baseline().price) {
              <span class="text-[11px] text-muted-foreground">was <span class="tabular line-through">{{ fmt(baseline().price) }}</span></span>
            }
          </section>

          <!-- Rates -->
          <section class="flex flex-col gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Interest rates</span>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between gap-2">
                  <label for="ps-flat" class="text-xs font-medium text-muted-foreground">Flat rate</label>
                  @if (form().interestRate != null) {
                    <button type="button" (click)="setRate('interestRate', null)" class="text-[11px] font-medium text-primary hover:underline">Use default</button>
                  }
                </div>
                <app-number-field inputId="ps-flat" suffix="%" [value]="form().interestRate" [placeholder]="'Default ' + defaultRate()" (valueChange)="setRate('interestRate', $event)" />
                <span class="text-[11px] text-muted-foreground">
                  @if (form().interestRate !== baseline().interestRate) {
                    was {{ baseline().interestRate != null ? baseline().interestRate + '%' : 'default' }}
                  } @else if (form().interestRate == null) {
                    Follows your default ({{ defaultRate() }}%)
                  } @else {
                    This car's own rate
                  }
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <label for="ps-eir" class="text-xs font-medium text-muted-foreground">Effective rate (EIR)</label>
                <app-number-field
                  inputId="ps-eir"
                  suffix="%"
                  [value]="form().effectiveRate"
                  [placeholder]="defaultEir() != null ? 'Default ' + defaultEir() : 'Not set'"
                  (valueChange)="setRate('effectiveRate', $event)"
                />
                @if (form().effectiveRate !== baseline().effectiveRate) {
                  <span class="text-[11px] text-muted-foreground">was {{ baseline().effectiveRate != null ? baseline().effectiveRate + '%' : 'not set' }}</span>
                }
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground">EIR is quoted separately by the bank — it isn't calculated from the flat rate.</p>
          </section>

          <!-- Minimum downpayment -->
          <section class="flex flex-col gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Minimum downpayment</span>
            <div class="flex gap-2">
              <app-number-field
                class="min-w-0 flex-1"
                ariaLabel="Minimum downpayment"
                [prefix]="form().minDpType === 'amount' ? 'RM' : ''"
                [suffix]="form().minDpType === 'percent' ? '%' : ''"
                [decimals]="form().minDpType === 'percent' ? 2 : 0"
                [value]="form().minDpValue"
                (valueChange)="setMinDownpayment({ value: $event })"
              />
              <div role="radiogroup" aria-label="Minimum downpayment unit" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                @for (u of minDpUnits; track u.value) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="form().minDpType === u.value"
                    (click)="setMinDownpayment({ type: u.value })"
                    class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                    [ngClass]="form().minDpType === u.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                  >
                    {{ u.label }}
                  </button>
                }
              </div>
            </div>
            <p class="text-[11px] text-muted-foreground">
              @if (form().minDpValue > 0) {
                Downpayment is at least
                <span class="font-semibold text-foreground">{{ fmt(minDpPreview()) }}</span>{{ form().minDpType === 'percent' ? ' (' + form().minDpValue + '% of the car price)' : '' }} before rebate — a rebate counts towards it, so one that covers it leaves only the RM100 loan rounding.
              } @else {
                0 = no minimum — Full Loan allowed.
              }
            </p>
          </section>

          <!-- Model years -->
          <section class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Model years</span>
              @if (yearsChanged()) {
                <span class="rounded-full bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">Edited</span>
              }
            </div>
            <div class="hidden grid-cols-[5.5rem_1fr_1fr_2.25rem] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Year</span>
              <span>Rebate</span>
              <span>Additional rebate</span>
              <span></span>
            </div>
            @for (y of form().years; track $index) {
              <div class="grid grid-cols-[1fr_auto] items-end gap-2 rounded-lg bg-muted/40 p-2.5 sm:grid-cols-[5.5rem_1fr_1fr_2.25rem] sm:bg-transparent sm:p-0">
                <label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  <span class="sm:sr-only">Model year</span>
                  <app-number-field
                    ariaLabel="Model year"
                    [grouping]="false"
                    [decimals]="0"
                    [value]="y.year"
                    [invalid]="duplicateYearIndexes().has($index)"
                    (valueChange)="setYearField($index, 'year', $event)"
                  />
                </label>
                <button
                  type="button"
                  (click)="removeYear($index)"
                  [disabled]="form().years.length <= 1"
                  title="Remove this model year"
                  aria-label="Remove this model year"
                  class="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] disabled:pointer-events-none disabled:opacity-30 sm:order-last"
                >
                  <app-icon name="trash" [size]="14" />
                </button>
                <div class="col-span-2 grid grid-cols-2 gap-2 sm:contents">
                  <label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    <span class="sm:sr-only">Rebate</span>
                    <app-number-field prefix="RM" ariaLabel="Rebate" [decimals]="0" [value]="y.rebate ?? null" placeholder="0" (valueChange)="setYearField($index, 'rebate', $event)" />
                  </label>
                  <label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                    <span class="sm:sr-only">Additional rebate</span>
                    <app-number-field prefix="RM" ariaLabel="Additional rebate" [decimals]="0" [value]="y.additionalRebate ?? null" placeholder="—" (valueChange)="setYearField($index, 'additionalRebate', $event)" />
                  </label>
                </div>
              </div>
            }
            @if (duplicateYearIndexes().size > 0) {
              <p class="flex items-center gap-1.5 text-[11px] text-[var(--destructive)]">
                <app-icon name="alert-triangle" [size]="12" class="shrink-0" />
                Two model years can't share the same year — pick a different year for each.
              </p>
            }
            <button
              type="button"
              (click)="addYear()"
              class="flex w-fit items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <app-icon name="plus" [size]="12" />
              Add older year
            </button>
          </section>

          <!-- Itemized insurance quotation (saved by its own button, not the panel's Save) -->
          <section class="flex flex-col gap-2">
            <button
              type="button"
              (click)="insuranceExpanded.set(!insuranceExpanded())"
              [attr.aria-expanded]="insuranceExpanded()"
              class="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <app-icon name="shield-check" [size]="15" class="shrink-0 text-muted-foreground" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-xs font-semibold">Itemized insurance quotation</span>
                <span class="text-[11px] text-muted-foreground tabular">Total due {{ fmt(savedInsuranceTotalFor(v)) }}</span>
              </span>
              <span class="shrink-0 rounded-full bg-[var(--chart-4)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--chart-4)]">Saves separately</span>
              <app-icon name="chevron-down" [size]="14" [class]="'shrink-0 transition-transform duration-200 ' + (insuranceExpanded() ? '' : '-rotate-90')" />
            </button>
            @if (insuranceExpanded()) {
              <p class="text-[11px] text-muted-foreground">Use the Save button inside this section — the panel's Save, Reset and Discard don't include insurance.</p>
              <div class="rounded-lg bg-muted/30 p-3">
                <app-insurance-quotation-editor [vehicle]="v" [ncdPct]="ncdPct()" [fallbackBasicPremium]="fallbackBasicPremiumFor(v)" />
              </div>
            }
          </section>
        </div>

        <!-- Footer: status + actions -->
        <div class="flex items-center gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span class="flex min-w-0 flex-1 flex-col text-xs">
            @if (dirty()) {
              <span class="flex items-center gap-1.5 font-semibold text-[var(--warning)]"><app-icon name="alert-triangle" [size]="13" /> Unsaved changes</span>
            } @else if (savedFlash()) {
              <span class="flex items-center gap-1.5 font-semibold text-[var(--success)]"><app-icon name="check" [size]="13" /> Saved</span>
            } @else {
              <span class="text-muted-foreground">No changes</span>
            }
            <span class="hidden text-[10px] text-muted-foreground/70 md:block">Ctrl+S save · Esc close · Alt+↑↓ switch car</span>
          </span>
          <button type="button" (click)="resetForm()" [disabled]="!dirty()" class="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40">
            Reset
          </button>
          <button type="button" (click)="save()" [disabled]="!dirty() || !canSave()" class="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            Save
          </button>
        </div>
      </aside>
    }

    <!-- Unsaved changes when leaving the car (closing, or switching to another) -->
    @if (pending(); as action) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button type="button" aria-label="Cancel" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="pending.set(null)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="alert-triangle" [size]="15" />
              Save changes first?
            </span>
            <p class="text-sm text-muted-foreground">
              You've edited this car's pricing and haven't saved it yet. Save it, or discard it and {{ action.kind === 'open' ? 'switch cars' : 'close' }}.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="pending.set(null)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="resolvePending(false)" class="rounded-md border border-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
              Discard
            </button>
            <button type="button" (click)="resolvePending(true)" [disabled]="!canSave()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Brand logo (or coloured initials) at a given size -->
    <ng-template #brandMark let-brand let-size="size">
      <span class="flex shrink-0 items-center justify-center overflow-hidden rounded-full" [ngClass]="size" [style.backgroundColor]="brandLogoFor(brand) ? 'transparent' : styleFor(brand).bg">
        @if (brandLogoFor(brand); as logo) {
          <img [src]="logo" [alt]="brand" class="size-full object-cover" />
        } @else {
          <span class="font-bold" [style.color]="styleFor(brand).fg">{{ initialsFor(brand) }}</span>
        }
      </span>
    </ng-template>
  `,
  styles: `
    .ps-drawer {
      animation: ps-sheet-in 0.35s var(--ease-out-expo) backwards;
    }
    .ps-backdrop {
      animation: ps-fade 0.2s ease-out backwards;
    }
    @media (min-width: 768px) {
      .ps-drawer {
        animation-name: ps-slide-in;
      }
    }
    @keyframes ps-sheet-in {
      from {
        opacity: 0;
        transform: translateY(24px);
      }
    }
    @keyframes ps-slide-in {
      from {
        opacity: 0;
        transform: translateX(48px);
      }
    }
    @keyframes ps-fade {
      from {
        opacity: 0;
      }
    }
  `,
})
export class PriceSettingsComponent {
  modelVariantLabel = modelVariantLabel;
  fmt = (v: number) => formatRM(v);
  fmtCompact = (v: number) => formatRM(v, { compact: true });

  search = signal('');
  brandFilter = signal('All');
  onlyCustomRate = signal(false);
  showHelp = signal(false);
  /** Model groups the user folded away, keyed "brand|model". */
  collapsed = signal<Set<string>>(new Set());

  ncdPct = computed(() => this.settingsService.settings().salesDefaults.ncd);

  constructor(
    public catalog: VehicleCatalogService,
    private settingsService: SettingsService,
  ) {}

  readonly minDpUnits = [
    { value: 'amount' as const, label: 'RM' },
    { value: 'percent' as const, label: '%' },
  ];

  // ---------- Default rates (flat + EIR) ----------

  defaultRate = computed(() => this.settingsService.settings().salesDefaults.interestRate);
  /** The account's default EIR, or null when none is set (EIR quotes then ask for the bank's rate). */
  defaultEir = computed(() => this.settingsService.settings().salesDefaults.effectiveRate ?? null);
  customRateCount = computed(() => this.catalog.vehicles().filter((v) => v.interestRate != null).length);

  resetAllConfirm = signal(false);

  /** Clears every car's own flat rate so the whole catalog follows the default. EIR and every
   *  other field are left alone. An open editor is re-baselined too, so it doesn't show the
   *  cleared rate as an unsaved edit or write the old rate back on its next Save. */
  resetAllRatesToDefault() {
    for (const v of this.catalog.vehicles()) {
      if (v.interestRate != null) this.catalog.updateVehicle(v.id, { interestRate: undefined });
    }
    if (this.selectedId()) {
      this.form.update((f) => ({ ...f, interestRate: null }));
      this.baseline.update((f) => ({ ...f, interestRate: null }));
    }
    this.resetAllConfirm.set(false);
    this.onlyCustomRate.set(false);
  }

  // ---------- List ----------

  private filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const brand = this.brandFilter();
    const onlyCustom = this.onlyCustomRate();
    return this.catalog
      .vehicles()
      .filter(
        (v) =>
          (brand === 'All' || v.brand === brand) &&
          (!onlyCustom || v.interestRate != null) &&
          (!q || `${v.brand} ${v.model} ${v.variant}`.toLowerCase().includes(q)),
      );
  });

  countForBrand(brand: string): number {
    return this.catalog.vehicles().filter((v) => v.brand === brand).length;
  }

  groups = computed((): BrandGroup[] => {
    const byBrand = new Map<string, Map<string, Vehicle[]>>();
    for (const v of this.filteredRows()) {
      if (!byBrand.has(v.brand)) byBrand.set(v.brand, new Map());
      const models = byBrand.get(v.brand)!;
      if (!models.has(v.model)) models.set(v.model, []);
      models.get(v.model)!.push(v);
    }
    return Array.from(byBrand.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([brand, models]) => ({
        brand,
        models: Array.from(models.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([model, rows]) => ({
            key: `${brand}|${model}`,
            model,
            rows: rows.sort((a, b) => a.variant.localeCompare(b.variant)),
          })),
      }));
  });

  /** Every listed car in display order (collapsed groups included) — drives Prev/Next. */
  navRows = computed(() => this.groups().flatMap((b) => b.models.flatMap((m) => m.rows)));
  navIndex = computed(() => this.navRows().findIndex((v) => v.id === this.selectedId()));

  toggleGroup(key: string) {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  toggleAllGroups() {
    if (this.collapsed().size) this.collapsed.set(new Set());
    else this.collapsed.set(new Set(this.groups().flatMap((b) => b.models.map((m) => m.key))));
  }

  clearFilters() {
    this.search.set('');
    this.brandFilter.set('All');
    this.onlyCustomRate.set(false);
  }

  /** Newest-first model years with their combined rebate, for the list's year chips. */
  yearChips(v: Vehicle): { year: number; rebate: number }[] {
    return v.years
      .map((y) => ({ year: y.year, rebate: (y.rebate ?? 0) + (y.additionalRebate ?? 0) }))
      .sort((a, b) => b.year - a.year);
  }

  fallbackBasicPremiumFor(v: Vehicle): number {
    return basicPremiumDefault(v.price, this.settingsService.settings().salesDefaults.basicPremiumRatePct);
  }

  /** The full Total Due this car's saved quotation (or its default, if never edited) actually
   *  works out to — same figure the Itemized Insurance Quotation panel shows, not just the
   *  Basic Premium line, so the list row matches what a customer would actually be charged. */
  savedInsuranceTotalFor(v: Vehicle): number {
    const details = this.settingsService.getVehicleInsurance(v, this.fallbackBasicPremiumFor(v));
    return computeInsuranceBreakdown(details, this.ncdPct()).totalDue;
  }

  // ---------- Editor panel ----------

  selectedId = signal<string | null>(null);
  selected = computed(() => this.catalog.vehicles().find((v) => v.id === this.selectedId()) ?? null);
  form = signal<PanelForm>({ price: 0, interestRate: null, effectiveRate: null, minDpType: 'amount', minDpValue: 0, years: [] });
  /** Snapshot of the car as last loaded/saved. Compared against instead of selected(), because the
   *  catalog mutates vehicle objects in place, so selected() keeps the same reference after a save. */
  baseline = signal<PanelForm>({ price: 0, interestRate: null, effectiveRate: null, minDpType: 'amount', minDpValue: 0, years: [] });
  dirty = computed(() => formKey(this.form()) !== formKey(this.baseline()));
  yearsChanged = computed(() => yearsKey(this.form()) !== yearsKey(this.baseline()));
  savedFlash = signal(false);
  insuranceExpanded = signal(false);
  /** Leaving a car with unsaved edits waits here for Save / Discard / Cancel. */
  pending = signal<PendingAction | null>(null);

  private open(id: string) {
    const v = this.catalog.vehicles().find((x) => x.id === id);
    if (!v) return;
    this.selectedId.set(id);
    this.form.set(pickForm(v));
    this.baseline.set(pickForm(v));
    this.savedFlash.set(false);
    this.insuranceExpanded.set(false);
    document.getElementById('ps-row-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  requestOpen(id: string) {
    if (id === this.selectedId()) return;
    if (this.selectedId() && this.dirty()) {
      this.pending.set({ kind: 'open', id });
      return;
    }
    this.open(id);
  }

  requestClose() {
    if (this.dirty()) {
      this.pending.set({ kind: 'close' });
      return;
    }
    this.selectedId.set(null);
  }

  step(delta: number) {
    const target = this.navRows()[this.navIndex() + delta];
    if (target) this.requestOpen(target.id);
  }

  resolvePending(saveFirst: boolean) {
    const action = this.pending();
    if (!action) return;
    if (saveFirst) {
      if (!this.canSave()) return;
      this.save();
    }
    this.pending.set(null);
    if (action.kind === 'open') this.open(action.id);
    else this.selectedId.set(null);
  }

  setPrice(value: number | null) {
    this.form.update((f) => ({ ...f, price: value ?? 0 }));
  }

  setMinDownpayment(patch: { type?: 'amount' | 'percent'; value?: number | null }) {
    this.form.update((f) => {
      const type = patch.type ?? f.minDpType;
      let value = patch.value !== undefined ? Math.max(0, patch.value ?? 0) : f.minDpValue;
      if (type === 'percent') value = Math.min(value, 100);
      return { ...f, minDpType: type, minDpValue: value };
    });
  }

  /** The minimum as RM for this car's current price — shown beside a % minimum. */
  minDpPreview(): number {
    const f = this.form();
    return minDownpaymentCash({ type: f.minDpType, value: f.minDpValue }, f.price);
  }

  setRate(field: 'interestRate' | 'effectiveRate', value: number | null) {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  // ---------- Model years ----------

  setYearField(index: number, field: 'year' | 'rebate' | 'additionalRebate', value: number | null) {
    this.form.update((f) => ({
      ...f,
      years: f.years.map((y, i) => {
        if (i !== index) return y;
        if (field === 'year') return value == null ? y : { ...y, year: value };
        return { ...y, [field]: value ?? undefined };
      }),
    }));
  }

  /** Defaults to one year older than whatever's already listed — this is for a showroom's older
   *  stock, not a future model year. */
  addYear() {
    this.form.update((f) => {
      const oldest = f.years.length > 0 ? Math.min(...f.years.map((y) => y.year)) : new Date().getFullYear();
      return { ...f, years: [...f.years, { year: oldest - 1 }] };
    });
  }

  removeYear(index: number) {
    this.form.update((f) => (f.years.length <= 1 ? f : { ...f, years: f.years.filter((_, i) => i !== index) }));
  }

  /** Indexes of year rows whose year value collides with another row's — flags every row in the
   *  clash, not just the second one, so it's obvious which two need fixing. */
  duplicateYearIndexes = computed(() => {
    const years = this.form().years;
    const counts = new Map<number, number>();
    for (const y of years) counts.set(y.year, (counts.get(y.year) ?? 0) + 1);
    const indexes = new Set<number>();
    years.forEach((y, i) => {
      if ((counts.get(y.year) ?? 0) > 1) indexes.add(i);
    });
    return indexes;
  });

  canSave(): boolean {
    return this.form().years.length > 0 && this.duplicateYearIndexes().size === 0;
  }

  resetForm() {
    this.form.set(this.baseline());
  }

  save() {
    const v = this.selected();
    if (!v || !this.canSave()) return;
    const f = this.form();
    this.catalog.updateVehicle(v.id, {
      price: f.price,
      interestRate: f.interestRate ?? undefined,
      effectiveRate: f.effectiveRate ?? undefined,
      minDownpayment: f.minDpValue > 0 ? { type: f.minDpType, value: f.minDpValue } : undefined,
      years: f.years.map((y) => ({ year: y.year, rebate: y.rebate ?? undefined, additionalRebate: y.additionalRebate ?? undefined })),
    });
    this.baseline.set(f);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  // ---------- Keyboard ----------

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (!this.selectedId()) return;
    if (this.pending()) {
      if (e.key === 'Escape') this.pending.set(null);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (this.dirty()) this.save();
    } else if (e.key === 'Escape') {
      this.requestClose();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.step(e.key === 'ArrowUp' ? -1 : 1);
    }
  }

  // ---------- Brand display ----------

  brandLogoFor(brand: string): string | null {
    return brandLogo(brand);
  }

  styleFor(brand: string) {
    return brandStyle(brand);
  }

  initialsFor(brand: string): string {
    return brandInitials(brand);
  }
}
