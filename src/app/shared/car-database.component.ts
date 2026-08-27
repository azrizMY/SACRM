import { Component, EventEmitter, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { InsuranceQuotationEditorComponent } from './insurance-quotation-editor.component';
import { SettingsService } from './settings.service';
import { VehicleCatalogService } from './vehicle-catalog.service';
import { basicPremiumDefault, modelVariantLabel, modelsForBrand, variantLabel, variantsForModel, yearsForVariant, type Vehicle } from '../data/calculator-data';

type OptionalNumericField = 'interestRate' | 'basicPremium' | 'addBenefits' | 'rebate' | 'additionalRebate';

type PricingForm = {
  brand: string;
  model: string;
  variant: string;
  year: number;
  price: number | null;
  interestRate: number | null;
  basicPremium: number | null;
  addBenefits: number | null;
  rebate: number | null;
  additionalRebate: number | null;
};

function blankForm(brand: string): PricingForm {
  return {
    brand,
    model: '',
    variant: '',
    year: new Date().getFullYear(),
    price: null,
    interestRate: null,
    basicPremium: null,
    addBenefits: null,
    rebate: null,
    additionalRebate: null,
  };
}

/**
 * Pure financing table: price, interest rate override, rebate, additional rebate, and itemized
 * insurance — one row per model year, for variants that already exist in the Brand & Model
 * Catalog. Brand/model/variant identity (and spec) is edited there, not here; this only ever adds
 * a new year/price row onto an existing variant. Backed by VehicleCatalogService, which persists
 * the whole catalog and keeps every other page in sync.
 */
@Component({
  selector: 'app-car-database',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, InsuranceQuotationEditorComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></button>
      <div class="relative flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <!-- Header -->
        <div class="flex flex-wrap items-start gap-3 border-b border-border p-4">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <app-icon name="wallet" [size]="16" />
          </span>
          <div class="flex flex-col">
            <span class="text-sm font-semibold">Car Database</span>
            <span class="text-xs text-muted-foreground">
              Price, interest rate, rebate, and insurance figures for cars already in the Brand &amp; Model Catalog — edit any cell, it saves
              instantly. Feeds the Calculator and Customer Manager.
            </span>
          </div>
          <button type="button" (click)="close.emit()" aria-label="Close" class="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div role="tablist" aria-label="Brand filter" class="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="brandFilter() === 'All'"
              (click)="brandFilter.set('All')"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="brandFilter() === 'All' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              All ({{ catalog.vehicles().length }})
            </button>
            @for (b of catalog.brands(); track b) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="brandFilter() === b"
                (click)="brandFilter.set(b)"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                [ngClass]="brandFilter() === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                {{ b }} ({{ countFor(b) }})
              </button>
            }
          </div>

          <div class="relative ml-auto w-full sm:w-56">
            <app-icon name="search" [size]="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Model or variant…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              class="h-9 w-full rounded-md border border-input bg-input pl-8 pr-3 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>

          <button
            type="button"
            (click)="openAdd()"
            class="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <app-icon name="plus" [size]="14" />
            Add Pricing
          </button>
        </div>

        <!-- Rows: table on tablet/desktop, cards on mobile -->
        <div class="min-h-0 flex-1 overflow-auto">
          <table class="hidden w-full caption-bottom text-xs sm:table">
            <thead class="sticky top-0 z-10 bg-card">
              <tr class="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                @if (brandFilter() === 'All') { <th class="h-9 whitespace-nowrap px-3 align-middle">Brand</th> }
                <th class="sticky left-0 z-20 h-9 whitespace-nowrap bg-card px-3 align-middle">Model</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Variant</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Year</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Price (RM)</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Interest %</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Basic Premium</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Rebate</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle">Additional Rebate</th>
                <th class="h-9 whitespace-nowrap px-3 align-middle text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (v of rows(); track v.id) {
                <tr class="group border-b border-border/60 transition-colors hover:bg-muted/30">
                  @if (brandFilter() === 'All') { <td class="p-2 align-middle text-xs">{{ v.brand }}</td> }
                  <td class="sticky left-0 z-[5] bg-card p-2 align-middle text-xs font-medium transition-colors group-hover:bg-muted/30">{{ v.model }}</td>
                  <td class="p-2 align-middle text-xs">{{ variantLabel(v.variant) || '-' }}</td>
                  <td class="p-1 align-middle">
                    <input type="number" min="1900" step="1" [ngModel]="v.year" (ngModelChange)="onNumberChange(v, 'year', $event)" class="h-8 w-16 rounded border border-transparent bg-transparent px-1.5 text-xs tabular outline-none focus:border-ring focus:bg-input" />
                  </td>
                  <td class="p-1 align-middle">
                    <input type="number" min="0" step="100" [ngModel]="v.price" (ngModelChange)="onNumberChange(v, 'price', $event)" class="h-8 w-24 rounded border border-transparent bg-transparent px-1.5 text-xs tabular outline-none focus:border-ring focus:bg-input" />
                  </td>
                  <td class="p-1 align-middle">
                    <input type="number" min="0" step="0.1" [ngModel]="v.interestRate ?? null" (ngModelChange)="onOptionalNumberChange(v, 'interestRate', $event)" placeholder="Default" class="h-8 w-20 rounded border border-transparent bg-transparent px-1.5 text-xs tabular outline-none focus:border-ring focus:bg-input" />
                  </td>
                  <td class="p-1 align-middle">
                    <input type="number" min="0" step="1" [ngModel]="v.basicPremium ?? null" (ngModelChange)="onOptionalNumberChange(v, 'basicPremium', $event)" placeholder="Auto" class="h-8 w-24 rounded border border-transparent bg-transparent px-1.5 text-xs tabular outline-none focus:border-ring focus:bg-input" />
                  </td>
                  <td class="p-1 align-middle">
                    <input type="number" min="0" step="500" [ngModel]="v.rebate ?? null" (ngModelChange)="onOptionalNumberChange(v, 'rebate', $event)" placeholder="Default" class="h-8 w-24 rounded border border-transparent bg-transparent px-1.5 text-xs tabular outline-none focus:border-ring focus:bg-input" />
                  </td>
                  <td class="p-1 align-middle">
                    <input type="number" min="0" step="500" [ngModel]="v.additionalRebate ?? null" (ngModelChange)="onOptionalNumberChange(v, 'additionalRebate', $event)" placeholder="—" class="h-8 w-24 rounded border border-transparent bg-transparent px-1.5 text-xs tabular outline-none focus:border-ring focus:bg-input" />
                  </td>
                  <td class="p-1 align-middle text-right">
                    <div class="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        (click)="toggleInsurance(v.id)"
                        title="Itemized insurance quotation"
                        aria-label="Edit insurance details"
                        class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        [ngClass]="expandedId() === v.id ? 'border-primary text-primary' : ''"
                      >
                        <app-icon name="shield-check" [size]="13" />
                      </button>
                      @if (isOnlyYearFor(v)) {
                        <span
                          title="This is the only pricing row for this variant — remove the whole variant from the Brand & Model Catalog instead."
                          class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground/40"
                        >
                          <app-icon name="trash" [size]="13" />
                        </span>
                      } @else {
                        <button type="button" (click)="requestDelete(v)" title="Remove this year's pricing" aria-label="Remove this year's pricing" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                          <app-icon name="trash" [size]="13" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
                @if (expandedId() === v.id) {
                  <tr class="border-b border-border/60 bg-muted/20">
                    <td [attr.colspan]="totalColumns()" class="p-4">
                      <app-insurance-quotation-editor [vehicle]="v" [ncdPct]="ncdPct()" [fallbackBasicPremium]="fallbackBasicPremiumFor(v)" />
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td [attr.colspan]="totalColumns()" class="p-8 text-center text-sm text-muted-foreground">No pricing rows match. Add a model in the Brand &amp; Model Catalog first, then price it here.</td></tr>
              }
            </tbody>
          </table>

          <!-- Mobile cards -->
          <div class="flex flex-col gap-3 p-3 sm:hidden">
            @for (v of rows(); track v.id) {
              <div class="overflow-hidden rounded-lg border border-border">
                <div class="flex items-start justify-between gap-2 border-b border-border bg-muted/30 p-3">
                  <div class="flex min-w-0 flex-col gap-0.5">
                    @if (brandFilter() === 'All') {
                      <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ v.brand }}</span>
                    }
                    <span class="truncate text-sm font-semibold">
                      {{ v.model }}
                      <span class="font-normal text-muted-foreground">{{ variantLabel(v.variant) || '-' }}</span>
                    </span>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      (click)="toggleInsurance(v.id)"
                      title="Itemized insurance quotation"
                      aria-label="Edit insurance details"
                      class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      [ngClass]="expandedId() === v.id ? 'border-primary text-primary' : ''"
                    >
                      <app-icon name="shield-check" [size]="13" />
                    </button>
                    @if (isOnlyYearFor(v)) {
                      <span
                        title="This is the only pricing row for this variant — remove the whole variant from the Brand & Model Catalog instead."
                        class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground/40"
                      >
                        <app-icon name="trash" [size]="13" />
                      </span>
                    } @else {
                      <button type="button" (click)="requestDelete(v)" title="Remove this year's pricing" aria-label="Remove this year's pricing" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                        <app-icon name="trash" [size]="13" />
                      </button>
                    }
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 p-3">
                  <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                    Year
                    <input type="number" min="1900" step="1" [ngModel]="v.year" (ngModelChange)="onNumberChange(v, 'year', $event)" class="h-9 rounded border border-border bg-input px-2 text-sm tabular text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                    Price (RM)
                    <input type="number" min="0" step="100" [ngModel]="v.price" (ngModelChange)="onNumberChange(v, 'price', $event)" class="h-9 rounded border border-border bg-input px-2 text-sm tabular text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                    Interest %
                    <input type="number" min="0" step="0.1" [ngModel]="v.interestRate ?? null" (ngModelChange)="onOptionalNumberChange(v, 'interestRate', $event)" placeholder="Default" class="h-9 rounded border border-border bg-input px-2 text-sm tabular text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                    Basic Premium
                    <input type="number" min="0" step="1" [ngModel]="v.basicPremium ?? null" (ngModelChange)="onOptionalNumberChange(v, 'basicPremium', $event)" placeholder="Auto" class="h-9 rounded border border-border bg-input px-2 text-sm tabular text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                    Rebate
                    <input type="number" min="0" step="500" [ngModel]="v.rebate ?? null" (ngModelChange)="onOptionalNumberChange(v, 'rebate', $event)" placeholder="Default" class="h-9 rounded border border-border bg-input px-2 text-sm tabular text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                    Add'l Rebate
                    <input type="number" min="0" step="500" [ngModel]="v.additionalRebate ?? null" (ngModelChange)="onOptionalNumberChange(v, 'additionalRebate', $event)" placeholder="—" class="h-9 rounded border border-border bg-input px-2 text-sm tabular text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                @if (expandedId() === v.id) {
                  <div class="border-t border-border bg-muted/20 p-3">
                    <app-insurance-quotation-editor [vehicle]="v" [ncdPct]="ncdPct()" [fallbackBasicPremium]="fallbackBasicPremiumFor(v)" />
                  </div>
                }
              </div>
            } @empty {
              <p class="p-8 text-center text-sm text-muted-foreground">No pricing rows match. Add a model in the Brand &amp; Model Catalog first, then price it here.</p>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Add Pricing -->
    @if (adding()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeAdd()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Add Pricing</span>
            <button type="button" (click)="closeAdd()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            @if (catalog.brands().length === 0) {
              <p class="text-sm text-muted-foreground">No brands yet — add one in the Brand &amp; Model Catalog first.</p>
            } @else {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Brand
                  <select [ngModel]="form.brand" (ngModelChange)="onFormBrandChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (b of catalog.brands(); track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Model
                  <select [ngModel]="form.model" (ngModelChange)="onFormModelChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (m of modelsForFormBrand(); track m) { <option [value]="m">{{ m }}</option> }
                  </select>
                </label>
              </div>
              @if (modelsForFormBrand().length === 0) {
                <p class="text-xs text-muted-foreground">This brand has no models yet — add one in the Brand &amp; Model Catalog first.</p>
              } @else {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Variant
                  <select [(ngModel)]="form.variant" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (v of variantsForFormModel(); track v) { <option [value]="v">{{ variantLabel(v) || '-' }}</option> }
                  </select>
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Model Year
                    <input type="number" min="1900" step="1" [(ngModel)]="form.year" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Price (RM)
                    <input type="number" min="0" step="100" [(ngModel)]="form.price" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Optional overrides</p>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Interest Rate (%)
                    <input type="number" min="0" step="0.1" [(ngModel)]="form.interestRate" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Basic Premium (RM)
                    <input type="number" min="0" step="1" [(ngModel)]="form.basicPremium" placeholder="Auto from price" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Add Benefits (RM)
                  <input type="number" min="0" step="1" [(ngModel)]="form.addBenefits" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Rebate (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="form.rebate" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Additional Rebate (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="form.additionalRebate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
              }
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeAdd()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitAdd()" [disabled]="!canSubmitAdd()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              Add Pricing
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete confirm -->
    @if (deleteTarget(); as target) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="cancelDelete()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              Remove this year's pricing?
            </span>
            <p class="text-sm text-muted-foreground">
              This permanently removes the <strong class="text-foreground">{{ target.year }}</strong> pricing row for
              <strong class="text-foreground">{{ target.brand }} {{ modelVariantLabel(target.model, target.variant) }}</strong>, including its
              saved insurance quotation. The variant itself stays in the Brand &amp; Model Catalog. This can't be undone.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="cancelDelete()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="confirmDelete()" class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90">
              Remove
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CarDatabaseComponent {
  @Output() close = new EventEmitter<void>();

  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;

  brandFilter = signal('All');
  search = signal('');
  expandedId = signal<string | null>(null);

  adding = signal(false);
  form: PricingForm = blankForm('');

  deleteTargetId = signal<string | null>(null);
  deleteTarget = computed(() => this.catalog.vehicles().find((v) => v.id === this.deleteTargetId()) ?? null);

  ncdPct = computed(() => this.settingsService.settings().salesDefaults.ncd);

  rows = computed(() => {
    const all = this.catalog.vehicles();
    const brand = this.brandFilter();
    const q = this.search().trim().toLowerCase();
    return all.filter((v) => (brand === 'All' || v.brand === brand) && (!q || `${v.model} ${v.variant}`.toLowerCase().includes(q)));
  });

  constructor(
    public catalog: VehicleCatalogService,
    private settingsService: SettingsService,
  ) {
    const brands = this.catalog.brands();
    if (brands.length > 0) this.brandFilter.set(brands[0]);
  }

  countFor(brand: string): number {
    return this.catalog.vehicles().filter((v) => v.brand === brand).length;
  }

  /** Identity columns (brand when unfiltered, model, variant, year) + 5 finance columns + actions. */
  totalColumns(): number {
    return (this.brandFilter() === 'All' ? 4 : 3) + 5 + 1;
  }

  fallbackBasicPremiumFor(v: Vehicle): number {
    return basicPremiumDefault(v.price, this.settingsService.settings().salesDefaults.basicPremiumRatePct);
  }

  isOnlyYearFor(v: Vehicle): boolean {
    return yearsForVariant(v.brand, v.model, v.variant).length <= 1;
  }

  toggleInsurance(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  onNumberChange(v: Vehicle, field: 'price' | 'year', value: string) {
    const n = Number(value);
    this.catalog.updateVehicle(v.id, { [field]: Number.isFinite(n) ? n : 0 });
  }

  onOptionalNumberChange(v: Vehicle, field: OptionalNumericField, value: string) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      this.catalog.updateVehicle(v.id, { [field]: undefined });
      return;
    }
    const n = Number(trimmed);
    this.catalog.updateVehicle(v.id, { [field]: Number.isFinite(n) ? n : undefined });
  }

  openAdd() {
    const defaultBrand = this.brandFilter() !== 'All' ? this.brandFilter() : (this.catalog.brands()[0] ?? '');
    this.form = blankForm(defaultBrand);
    this.adding.set(true);
  }

  closeAdd() {
    this.adding.set(false);
  }

  modelsForFormBrand(): string[] {
    return modelsForBrand(this.form.brand);
  }

  variantsForFormModel(): string[] {
    return variantsForModel(this.form.brand, this.form.model);
  }

  onFormBrandChange(brand: string) {
    this.form.brand = brand;
    this.form.model = modelsForBrand(brand)[0] ?? '';
    this.form.variant = variantsForModel(brand, this.form.model)[0] ?? '';
  }

  onFormModelChange(model: string) {
    this.form.model = model;
    this.form.variant = variantsForModel(this.form.brand, model)[0] ?? '';
  }

  canSubmitAdd(): boolean {
    return !!this.form.brand && !!this.form.model && !!this.form.year && this.form.year > 1900 && !!this.form.price && this.form.price > 0;
  }

  submitAdd() {
    if (!this.canSubmitAdd()) return;
    const template = this.catalog
      .vehicles()
      .find((v) => v.brand === this.form.brand && v.model === this.form.model && v.variant === this.form.variant);
    if (!template) return;
    this.catalog.addVehicle({
      brand: this.form.brand,
      model: this.form.model,
      variant: this.form.variant,
      year: this.form.year,
      price: this.form.price!,
      engine: template.engine,
      seater: template.seater,
      transmission: template.transmission,
      powertrain: template.powertrain,
      drivetrain: template.drivetrain,
      interestRate: this.form.interestRate ?? undefined,
      basicPremium: this.form.basicPremium ?? undefined,
      addBenefits: this.form.addBenefits ?? undefined,
      rebate: this.form.rebate ?? undefined,
      additionalRebate: this.form.additionalRebate ?? undefined,
    });
    this.brandFilter.set(this.form.brand);
    this.closeAdd();
  }

  requestDelete(v: Vehicle) {
    this.deleteTargetId.set(v.id);
  }

  cancelDelete() {
    this.deleteTargetId.set(null);
  }

  confirmDelete() {
    const id = this.deleteTargetId();
    if (!id) return;
    if (this.expandedId() === id) this.expandedId.set(null);
    this.catalog.removeVehicle(id);
    this.deleteTargetId.set(null);
  }
}
