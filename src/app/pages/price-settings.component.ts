import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { InsuranceQuotationEditorComponent } from '../shared/insurance-quotation-editor.component';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { brandInitials, brandLogo, brandStyle } from '../data/dashboard-data';
import { basicPremiumDefault, formatRM, modelVariantLabel, type Vehicle, type VehicleYear } from '../data/calculator-data';

/** Everything the editor panel can change for one variant — price and rates live here, since
 *  they're the same regardless of which year is in stock; Rebate and Additional Rebate both live
 *  per model year instead (see VehicleYear) since either can differ year to year independently of
 *  the other. Basic Premium and Add Benefits aren't here — they're set via the Itemized Insurance
 *  Quotation section instead, which already covers them. */
type PanelForm = {
  price: number;
  interestRate: number | null;
  effectiveRate: number | null;
  /** Working copy of the variant's model years — edited in place, newest first, only written back
   *  through VehicleCatalogService on Save. */
  years: VehicleYear[];
};

function pickForm(v: Vehicle): PanelForm {
  return {
    price: v.price,
    interestRate: v.interestRate ?? null,
    effectiveRate: v.effectiveRate ?? null,
    years: v.years.map((y) => ({ ...y })).sort((a, b) => b.year - a.year),
  };
}

type ModelGroup = { model: string; rows: Vehicle[] };
type BrandGroup = { brand: string; models: ModelGroup[] };

/**
 * One place for every variant's pricing (price, rates, itemized insurance) plus which model years
 * it's available in and each year's rebate — the merged replacement for the old Brand & Model
 * Catalog + Car Database pair. Brand, model, and variant identity is hardcoded by the developer in
 * calculator-data.ts, not editable here; this page only edits pricing and manages model years
 * (e.g. adding an older year a showroom still has in stock). Grouped by brand then model, one card
 * per variant; tap a card to edit it.
 *
 * The edit panel stages every edit locally — price, rates, and the whole years list — and only
 * writes through VehicleCatalogService on Save; closing with unsaved edits prompts save-or-discard.
 * The itemized insurance quotation stays instant, already its own action rather than a typed field.
 */
@Component({
  selector: 'app-price-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, InsuranceQuotationEditorComponent],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-semibold tracking-tight">Price Settings</h2>
        <p class="text-pretty text-sm text-muted-foreground">
          Price, rates, and insurance are shared across every year of a variant — set them once, then add older model years still in showroom stock with
          just their own rebate. Brands and models are set up by your developer.
        </p>
      </div>

      <!-- Brand filter -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
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
            [attr.aria-selected]="brandFilter() === b"
            (click)="brandFilter.set(b)"
            class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="brandFilter() === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            <span class="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full" [style.backgroundColor]="brandLogoFor(b) ? 'transparent' : styleFor(b).bg">
              @if (brandLogoFor(b); as logo) {
                <img [src]="logo" [alt]="b" class="size-full object-cover" />
              } @else {
                <span class="text-[8px] font-bold" [style.color]="styleFor(b).fg">{{ initialsFor(b) }}</span>
              }
            </span>
            {{ b }} ({{ countForBrand(b) }})
          </button>
        }
      </div>

      <!-- Search -->
      <div class="relative">
        <app-icon name="search" [size]="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search car…"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          class="h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring"
        />
      </div>

      <!-- List -->
      <div class="flex flex-col gap-5">
        @for (brandGroup of groups(); track brandGroup.brand) {
          <div class="flex flex-col gap-3">
            @if (brandFilter() === 'All') {
              <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ brandGroup.brand }}</span>
            }
            @for (modelGroup of brandGroup.models; track modelGroup.model) {
              <div class="flex flex-col gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{{ modelGroup.model }}</span>
                <div class="flex flex-col gap-2">
                  @for (v of modelGroup.rows; track v.id) {
                    <button
                      type="button"
                      (click)="openEditor(v)"
                      class="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/60"
                    >
                      <div class="flex min-w-0 flex-col gap-1">
                        <span class="truncate text-sm font-semibold text-foreground">
                          {{ modelVariantLabel(v.model, v.variant) }}
                          <span class="font-normal text-muted-foreground">— {{ yearsLabel(v) }}</span>
                        </span>
                        <span class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>Price <strong class="font-semibold text-foreground">{{ fmt(v.price) }}</strong></span>
                          <span>Insurance <strong class="font-semibold text-foreground">{{ v.basicPremium != null ? fmt(v.basicPremium) : 'Auto' }}</strong></span>
                          <span>Rate <strong class="font-semibold text-foreground">{{ v.interestRate != null ? v.interestRate + '%' : 'Default' }}</strong></span>
                        </span>
                      </div>
                      <app-icon name="chevron-right" [size]="16" class="shrink-0 text-muted-foreground" />
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        } @empty {
          <p class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cars match.
          </p>
        }
      </div>
    </div>

    <!-- Editor panel -->
    @if (selected(); as v) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="requestClose()"></button>
        <div class="relative flex h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-start justify-between gap-3 border-b border-border p-4">
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-sm font-semibold">{{ modelVariantLabel(v.model, v.variant) }}</span>
              <span class="text-xs text-muted-foreground">{{ v.brand }}</span>
            </div>
            <button type="button" (click)="requestClose()" aria-label="Close" class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <!-- Unsaved changes bar -->
          @if (dirty()) {
            <div class="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-2">
              <span class="flex items-center gap-1.5 text-xs font-medium text-primary">
                <app-icon name="alert-triangle" [size]="13" />
                Unsaved changes
              </span>
            </div>
          } @else if (savedFlash()) {
            <div class="flex items-center gap-1.5 border-b border-border bg-[var(--success)]/5 px-4 py-2 text-xs font-medium text-[var(--success)]">
              <app-icon name="check" [size]="13" />
              Saved
            </div>
          }

          <div class="flex flex-col gap-5 overflow-y-auto p-4">
            <!-- Pricing (shared across every model year) -->
            <div class="flex flex-col gap-3">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</span>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Price (RM)
                <input type="number" min="0" step="100" [ngModel]="form().price" (ngModelChange)="setPrice($event)" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Interest Rate — Flat (%)
                  <input type="number" min="0" step="0.1" [ngModel]="form().interestRate" (ngModelChange)="setOptionalField('interestRate', $event)" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Effective Rate — EIR (%)
                  <input type="number" min="0" step="0.1" [ngModel]="form().effectiveRate" (ngModelChange)="setOptionalField('effectiveRate', $event)" placeholder="Not set" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
                </label>
              </div>
              <p class="text-[11px] text-muted-foreground">
                Effective rate is a separate, independently-quoted figure — not calculated from the flat rate above. Basic Premium and Add Benefits are set
                in the Itemized Insurance Quotation below.
              </p>
            </div>

            <!-- Model years — Rebate and Additional Rebate can each differ year to year -->
            <div class="flex flex-col gap-2">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Model Years</span>
              <div class="flex flex-col gap-2">
                @for (y of form().years; track $index) {
                  <div class="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        min="1900"
                        step="1"
                        [ngModel]="y.year"
                        (ngModelChange)="setYearField($index, 'year', $event)"
                        class="h-10 w-24 shrink-0 rounded-lg border bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring"
                        [ngClass]="duplicateYearIndexes().has($index) ? 'border-[var(--destructive)]' : 'border-input'"
                      />
                      <span class="text-xs text-muted-foreground">Model Year</span>
                      <button
                        type="button"
                        (click)="removeYear($index)"
                        [disabled]="form().years.length <= 1"
                        title="Remove this model year"
                        aria-label="Remove this model year"
                        class="ml-auto flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)] disabled:pointer-events-none disabled:opacity-30"
                      >
                        <app-icon name="trash" [size]="13" />
                      </button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Rebate (RM)
                        <input
                          type="number"
                          min="0"
                          step="500"
                          [ngModel]="y.rebate ?? null"
                          (ngModelChange)="setYearField($index, 'rebate', $event)"
                          placeholder="Use account default"
                          class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring"
                        />
                      </label>
                      <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                        Additional Rebate (RM)
                        <input
                          type="number"
                          min="0"
                          step="500"
                          [ngModel]="y.additionalRebate ?? null"
                          (ngModelChange)="setYearField($index, 'additionalRebate', $event)"
                          placeholder="—"
                          class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring"
                        />
                      </label>
                    </div>
                  </div>
                }
              </div>
              @if (duplicateYearIndexes().size > 0) {
                <p class="flex items-center gap-1.5 text-[11px] text-[var(--destructive)]">
                  <app-icon name="alert-triangle" [size]="12" class="shrink-0" />
                  Two model years can't share the same year — pick a different year for each.
                </p>
              }
              <button
                type="button"
                (click)="addYear()"
                class="flex w-fit items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <app-icon name="plus" [size]="12" />
                Add Year
              </button>
            </div>

            <!-- Itemized insurance quotation -->
            <div class="flex flex-col gap-2">
              <button
                type="button"
                (click)="toggleInsurance()"
                class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <span class="flex items-center gap-2">
                  <app-icon name="shield-check" [size]="14" />
                  Itemized Insurance Quotation
                </span>
                <app-icon [name]="insuranceExpanded() ? 'chevron-down' : 'chevron-right'" [size]="14" />
              </button>
              @if (insuranceExpanded()) {
                <div class="rounded-md border border-border bg-muted/20 p-3">
                  <app-insurance-quotation-editor [vehicle]="v" [ncdPct]="ncdPct()" [fallbackBasicPremium]="fallbackBasicPremiumFor(v)" />
                </div>
              }
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="resetForm()" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              Reset
            </button>
            <button type="button" (click)="save()" [disabled]="!canSave()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Unsaved changes on close -->
    @if (closeConfirm()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeConfirm.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="alert-triangle" [size]="15" />
              Save changes before closing?
            </span>
            <p class="text-sm text-muted-foreground">You've edited this car's pricing that hasn't been saved yet. Save it, or discard it and close.</p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeConfirm.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="discardAndClose()" class="rounded-md border border-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
              Discard &amp; Close
            </button>
            <button type="button" (click)="saveAndClose()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Save &amp; Close
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PriceSettingsComponent {
  modelVariantLabel = modelVariantLabel;
  fmt = (v: number) => formatRM(v);

  search = signal('');
  brandFilter = signal('All');

  ncdPct = computed(() => this.settingsService.settings().salesDefaults.ncd);

  // ---------- Editor panel ----------

  selectedId = signal<string | null>(null);
  selected = computed(() => this.catalog.vehicles().find((v) => v.id === this.selectedId()) ?? null);
  form = signal<PanelForm>({ price: 0, interestRate: null, effectiveRate: null, years: [] });
  dirty = signal(false);
  savedFlash = signal(false);
  closeConfirm = signal(false);

  insuranceExpanded = signal(false);

  constructor(
    public catalog: VehicleCatalogService,
    private settingsService: SettingsService,
  ) {}

  private filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const brand = this.brandFilter();
    return this.catalog
      .vehicles()
      .filter((v) => (brand === 'All' || v.brand === brand) && (!q || `${v.brand} ${v.model} ${v.variant}`.toLowerCase().includes(q)));
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
            model,
            rows: rows.sort((a, b) => a.variant.localeCompare(b.variant)),
          })),
      }));
  });

  /** Newest-first model years for the row label, e.g. "2026, 2025". */
  yearsLabel(v: Vehicle): string {
    return v.years
      .map((y) => y.year)
      .sort((a, b) => b - a)
      .join(', ');
  }

  fallbackBasicPremiumFor(v: Vehicle): number {
    return basicPremiumDefault(v.price, this.settingsService.settings().salesDefaults.basicPremiumRatePct);
  }

  // ---------- Editor panel ----------

  openEditor(v: Vehicle) {
    this.selectedId.set(v.id);
    this.form.set(pickForm(v));
    this.dirty.set(false);
    this.insuranceExpanded.set(false);
  }

  setPrice(value: string) {
    const n = Number(value);
    this.form.update((f) => ({ ...f, price: Number.isFinite(n) ? n : 0 }));
    this.dirty.set(true);
  }

  setOptionalField(field: 'interestRate' | 'effectiveRate', value: string) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      this.form.update((f) => ({ ...f, [field]: null }));
      this.dirty.set(true);
      return;
    }
    const n = Number(trimmed);
    this.form.update((f) => ({ ...f, [field]: Number.isFinite(n) ? n : null }));
    this.dirty.set(true);
  }

  // ---------- Model years ----------

  setYearField(index: number, field: 'year' | 'rebate' | 'additionalRebate', value: string) {
    const trimmed = String(value ?? '').trim();
    this.form.update((f) => ({
      ...f,
      years: f.years.map((y, i) => {
        if (i !== index) return y;
        if (field === 'year') {
          const n = Number(trimmed);
          return { ...y, year: Number.isFinite(n) ? n : y.year };
        }
        if (!trimmed) return { ...y, [field]: undefined };
        const n = Number(trimmed);
        return { ...y, [field]: Number.isFinite(n) ? n : y[field] };
      }),
    }));
    this.dirty.set(true);
  }

  /** Defaults to one year older than whatever's already listed — this is for a showroom's older
   *  stock, not a future model year. */
  addYear() {
    this.form.update((f) => {
      const oldest = f.years.length > 0 ? Math.min(...f.years.map((y) => y.year)) : new Date().getFullYear();
      return { ...f, years: [...f.years, { year: oldest - 1 }] };
    });
    this.dirty.set(true);
  }

  removeYear(index: number) {
    this.form.update((f) => (f.years.length <= 1 ? f : { ...f, years: f.years.filter((_, i) => i !== index) }));
    this.dirty.set(true);
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
    const v = this.selected();
    if (!v) return;
    this.form.set(pickForm(v));
    this.dirty.set(false);
  }

  save() {
    const v = this.selected();
    if (!v || !this.canSave()) return;
    const f = this.form();
    this.catalog.updateVehicle(v.id, {
      price: f.price,
      interestRate: f.interestRate ?? undefined,
      effectiveRate: f.effectiveRate ?? undefined,
      years: f.years.map((y) => ({ year: y.year, rebate: y.rebate ?? undefined, additionalRebate: y.additionalRebate ?? undefined })),
    });
    this.dirty.set(false);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  requestClose() {
    if (this.dirty()) {
      this.closeConfirm.set(true);
      return;
    }
    this.selectedId.set(null);
  }

  saveAndClose() {
    this.save();
    this.closeConfirm.set(false);
    this.selectedId.set(null);
  }

  discardAndClose() {
    this.closeConfirm.set(false);
    this.dirty.set(false);
    this.selectedId.set(null);
  }

  toggleInsurance() {
    this.insuranceExpanded.set(!this.insuranceExpanded());
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
