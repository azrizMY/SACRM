import { Component, computed, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent, type IconName } from '../shared/icon.component';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { brandLogo, brandStyle } from '../data/dashboard-data';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import {
  VEHICLES,
  additionalRebateForYear,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  formatRM,
  modelVariantLabel,
  monthlyPayment,
  rebateForYear,
  variantLabel,
  type Vehicle,
} from '../data/calculator-data';
import { assembleImagePdfBytes, downloadBlob as downloadPdfBytes, type PdfImagePage } from '../shared/pdf-writer';
import { posterFontsReady } from '../shared/poster-theme';
import { detailedBrochureTemplate } from '../shared/poster-brochure-template-detailed';
import { simpleBrochureTemplate } from '../shared/poster-brochure-template-simple';
import type { BrochureTemplate, BrochureTemplateId } from '../shared/poster-brochure-templates';
import type { BrochureData, BrochureRow } from '../shared/poster-brochure-data';

type SortKey = 'brand' | 'model' | 'variant';
type SortDir = 'asc' | 'desc';
type Column = { key: SortKey; label: string; align?: 'right' };

const COLUMNS: Column[] = [
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
];

function compareVehicles(a: Vehicle, b: Vehicle, key: SortKey, dir: SortDir): number {
  const av = a[key];
  const bv = b[key];
  let cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
  if (cmp === 0 && key !== 'model') cmp = a.model.localeCompare(b.model);
  if (cmp === 0 && key !== 'variant') cmp = a.variant.localeCompare(b.variant);
  return dir === 'asc' ? cmp : -cmp;
}

@Component({
  selector: 'app-my-cars',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, BrandMarkComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 pb-16">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-balance text-xl font-semibold tracking-tight">Brochures</h2>
          <p class="text-pretty text-sm text-muted-foreground">
            Browse each car's spec sheet, or generate a combined offer sheet for a whole brand.
          </p>
        </div>
      </div>

      <!-- Spec Sheets / Offer Sheet switcher -->
      <div role="tablist" aria-label="Brochures mode" class="flex w-fit rounded-lg border border-border bg-muted/30 p-1">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="pageMode() === 'specs'"
          (click)="pageMode.set('specs')"
          class="rounded-md px-4 py-1.5 text-xs font-semibold transition-colors"
          [ngClass]="pageMode() === 'specs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
        >
          Spec Sheets
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="pageMode() === 'offers'"
          (click)="pageMode.set('offers')"
          class="rounded-md px-4 py-1.5 text-xs font-semibold transition-colors"
          [ngClass]="pageMode() === 'offers' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
        >
          Offer Sheet
        </button>
      </div>

      @if (pageMode() === 'specs') {
        @if (shareFallbackNotice()) {
          <div class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-4 py-2.5 text-sm">
            <app-icon name="download" [size]="14" class="shrink-0" />
            Your browser can't hand files to WhatsApp directly — brochure downloaded. Attach it in WhatsApp Desktop/Web.
          </div>
        }

        <!-- Brand tabs -->
        <div role="tablist" aria-label="Filter by brand" class="flex flex-wrap items-center gap-1.5">
          @for (b of brandFilters; track b) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="b === brandFilter()"
              (click)="selectBrandFilter(b)"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="
                b === brandFilter()
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              "
            >
              {{ b }}
            </button>
          }
        </div>

        <!-- Bulk action bar -->
        @if (selected().size > 0) {
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/8 px-4 py-2.5">
            <span class="text-sm font-medium">{{ selected().size }} car{{ selected().size === 1 ? '' : 's' }} selected</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="downloadSelected()"
                class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <app-icon name="download" [size]="13" />
                Download Selected
              </button>
              <button
                type="button"
                (click)="clearSelection()"
                class="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <app-icon name="x" [size]="12" />
                Clear
              </button>
            </div>
          </div>
        }

        <!-- Table -->
        <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="hidden overflow-x-auto sm:block">
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th class="h-10 w-10 px-4 align-middle">
                    <input
                      type="checkbox"
                      [checked]="allSelected()"
                      (change)="toggleSelectAll()"
                      aria-label="Select all"
                      class="size-3.5 accent-[var(--primary)]"
                    />
                  </th>
                  @for (col of visibleColumns(); track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button
                        type="button"
                        (click)="toggleSort(col.key)"
                        class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground"
                        [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']"
                      >
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (v of filteredSorted(); track v.id) {
                  <tr class="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                    <td class="p-4 align-middle">
                      <input
                        type="checkbox"
                        [checked]="selected().has(v.id)"
                        (change)="toggleSelect(v.id)"
                        [attr.aria-label]="'Select ' + v.brand + ' ' + v.model + ' ' + v.variant"
                        class="size-3.5 accent-[var(--primary)]"
                      />
                    </td>
                    @if (brandFilter() === 'All') {
                      <td class="p-4 align-middle">
                        <span class="flex items-center gap-2">
                          <app-brand-mark [brand]="v.brand" />
                          <span class="text-sm">{{ v.brand }}</span>
                        </span>
                      </td>
                    }
                    <td class="p-4 align-middle font-medium">{{ modelVariantLabel(v.model, v.variant) }}</td>
                    <td class="p-4 text-right align-middle">
                      @if (brochureFor(v); as brochure) {
                        <div class="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            (click)="openBrochure(v.id)"
                            class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <app-icon name="file-text" [size]="13" />
                            View
                          </button>
                          <button
                            type="button"
                            (click)="downloadOne(v)"
                            class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <app-icon name="download" [size]="13" />
                            Download
                          </button>
                        </div>
                      } @else {
                        <span class="text-xs text-muted-foreground">No brochure</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="visibleColumns().length + 2" class="p-8 text-center text-sm text-muted-foreground">No cars match.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="flex flex-col gap-3 p-3 sm:hidden">
            @for (v of filteredSorted(); track v.id) {
              <div class="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div class="flex items-start gap-2">
                  <input
                    type="checkbox"
                    [checked]="selected().has(v.id)"
                    (change)="toggleSelect(v.id)"
                    [attr.aria-label]="'Select ' + v.brand + ' ' + v.model + ' ' + v.variant"
                    class="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <div class="flex min-w-0 flex-1 items-center gap-2">
                    <app-brand-mark [brand]="v.brand" />
                    <div class="flex min-w-0 flex-col">
                      <span class="truncate font-medium">{{ modelVariantLabel(v.model, v.variant) }}</span>
                      <span class="text-xs text-muted-foreground">{{ v.brand }}</span>
                    </div>
                  </div>
                </div>
                @if (brochureFor(v); as brochure) {
                  <div class="flex items-center gap-1.5 border-t border-border pt-2">
                    <button type="button" (click)="openBrochure(v.id)" class="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                      <app-icon name="file-text" [size]="13" />
                      View
                    </button>
                    <button type="button" (click)="downloadOne(v)" class="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                      <app-icon name="download" [size]="13" />
                      Download
                    </button>
                  </div>
                } @else {
                  <span class="border-t border-border pt-2 text-xs text-muted-foreground">No brochure</span>
                }
              </div>
            } @empty {
              <p class="p-8 text-center text-sm text-muted-foreground">No cars match.</p>
            }
          </div>
        </div>
      }

      @if (pageMode() === 'offers') {
        <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
          <!-- Offer sheet preview — no internal scroll cap like a quotation preview has: an offer
               sheet page is a fixed A5 shape, so it should just render at its natural height. -->
          <div class="flex flex-col gap-3 xl:sticky xl:top-4 xl:col-span-2">
            @if (offerSheetTemplates.length > 1) {
              <div role="radiogroup" aria-label="Offer sheet template" class="flex shrink-0 gap-1.5 self-start rounded-xl border border-border bg-muted/40 p-1.5">
                @for (t of offerSheetTemplates; track t.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="selectedOfferTemplateId() === t.id"
                    (click)="selectedOfferTemplateId.set(t.id)"
                    class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    [ngClass]="selectedOfferTemplateId() === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    {{ t.label }}
                  </button>
                }
              </div>
            }
            <button
              type="button"
              (click)="downloadOfferSheetPdf()"
              [disabled]="downloadingOfferSheet() || offerRows().length === 0"
              class="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <app-icon name="download" [size]="15" />
              {{ downloadingOfferSheet() ? 'Preparing…' : 'Download PDF' }}
            </button>

            @if (offerRows().length === 0) {
              <p class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {{ offerBrand() }} has no cars in the Car Database yet — add some in Price Settings first.
              </p>
            }

            <div #offerContainer class="flex flex-col gap-4"></div>
          </div>

          <!-- Offer sheet settings -->
          <div class="flex flex-col gap-4 xl:sticky xl:top-4 xl:col-span-1">
            <h3 class="text-base font-semibold leading-none">Offer Sheet Settings</h3>

            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div class="flex flex-col gap-2">
                <label for="offerTitleInput" class="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  id="offerTitleInput"
                  type="text"
                  [ngModel]="offerTitle()"
                  (ngModelChange)="offerTitle.set($event)"
                  placeholder="e.g. September 2026 Offers"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                />
              </div>

              <div class="flex flex-col gap-2">
                <label for="offerBrandSelect" class="text-xs font-medium text-muted-foreground">Brand</label>
                <select
                  id="offerBrandSelect"
                  [ngModel]="offerBrand()"
                  (ngModelChange)="offerBrand.set($event)"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                >
                  @for (b of brands; track b) {
                    <option [value]="b">{{ b }}</option>
                  }
                </select>
                <span class="text-[11px] text-muted-foreground">Every model, variant, and year of this brand gets its own row on the offer sheet.</span>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Compare 3 Tenures</span>
                <div role="group" aria-label="Offer sheet tenures" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
                  @for (y of tenureYearOptions; track y) {
                    <button
                      type="button"
                      [attr.aria-pressed]="offerTenureYears().includes(y)"
                      (click)="toggleOfferTenureYear(y)"
                      class="flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition-colors"
                      [ngClass]="offerTenureYears().includes(y) ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ y }}
                    </button>
                  }
                </div>
                <span class="text-[11px] text-muted-foreground">
                  @if (selectedOfferTemplateId() === 'detailed') {
                    Each row shows a monthly instalment column for each of these {{ offerTenureYears().length }} tenure years.
                  } @else {
                    Each row's "from" monthly figure uses the lowest instalment among these {{ offerTenureYears().length }} tenure years.
                  }
                </span>
              </div>

              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  [ngModel]="offerIncludeAdditionalRebate()"
                  (ngModelChange)="offerIncludeAdditionalRebate.set($event)"
                  class="size-4 shrink-0 rounded border-input accent-primary"
                />
                <span class="text-xs font-medium text-muted-foreground">Include Additional Rebate</span>
              </label>

              <p class="text-[11px] text-muted-foreground">
                @if (selectedOfferTemplateId() === 'detailed') {
                  Insurance is always shown at 0% NCD — a general offer sheet, not a specific customer's quote. Selling price and monthly use the account's default downpayment and rate settings.
                } @else {
                  OTR price and rebate only — no insurance is included in the Nett price shown. Monthly uses the account's default downpayment and rate settings.
                }
              </p>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Brochure modal -->
    @if (openVehicle(); as v) {
    @if (brochureFor(v); as brochure) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close brochure" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeBrochure()"></button>

        <div class="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border bg-gradient-to-br from-primary/12 via-card to-card p-4">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border"
              [style.background]="tileGradient(v.brand)"
            >
              <app-icon name="car" [size]="20" class="text-white/90" />
            </div>
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-semibold">{{ v.brand }} {{ v.model }}</span>
              <span class="truncate text-[11px] text-muted-foreground">{{ variantLabel(v.variant) ? variantLabel(v.variant) + ' · ' : '' }}{{ fmt(v.price) }}</span>
            </div>
            <button
              type="button"
              (click)="closeBrochure()"
              aria-label="Close"
              class="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <button
              type="button"
              (click)="downloadOne(v)"
              class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <app-icon name="download" [size]="13" />
              Download
            </button>
            <button
              type="button"
              (click)="sendBrochureFile(v)"
              class="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <app-icon name="message-circle" [size]="13" />
              Send via WhatsApp
            </button>
          </div>

          <div class="flex-1 overflow-y-auto bg-muted/20">
            <iframe [src]="safeBrochureUrl(brochure)" title="Brochure" class="h-[70vh] w-full"></iframe>
          </div>
        </div>
      </div>
    }
    }
  `,
})
export class MyCarsComponent {
  fmt = (v: number) => formatRM(v);
  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;

  /** One row per brand+model+variant already — every model year of a variant lives on the same
   *  row (see Vehicle.years), so VEHICLES itself is already one row per variant. */
  allVehicles: Vehicle[] = VEHICLES;
  brandFilters = ['All', ...Array.from(new Set(this.allVehicles.map((v) => v.brand)))];
  brands: string[] = Array.from(new Set(this.allVehicles.map((v) => v.brand)));
  columns = COLUMNS;

  private settingsService = inject(SettingsService);

  /** "Spec Sheets" is the existing per-car brochure table below; "Offer Sheet" is a combined,
   *  generated multi-model page for a whole brand — different enough (many vehicles, print-
   *  resolution A5 pages, no single-car context) that it gets its own top-level mode. */
  pageMode = signal<'specs' | 'offers'>('specs');

  /** Starts on the account's Default Brand (Account Settings → Dashboard), not "All". */
  private readonly initialBrandFilter = this.settingsService.settings().dashboardTarget.brand;
  brandFilter = signal(this.initialBrandFilter);
  // Brand column is hidden whenever the starting filter isn't "All" — fall back off it so a
  // column is highlighted from the very first render, same rule as selectBrandFilter() below.
  sortKey = signal<SortKey>(this.initialBrandFilter === 'All' ? 'brand' : 'model');
  sortDir = signal<SortDir>('asc');
  openKey = signal<string | null>(null);
  selected = signal<Set<string>>(new Set());
  shareFallbackNotice = signal(false);

  @ViewChild('offerContainer') offerContainerRef?: ElementRef<HTMLDivElement>;

  /** Set once fonts.google.com's Barlow Semi Condensed + Inter are ready to paint — the draw
   *  effect waits on this so the very first frame never falls back to a system font. */
  private fontsReady = signal(false);

  constructor(
    private sanitizer: DomSanitizer,
    public advisor: AdvisorService,
  ) {
    posterFontsReady().then(() => this.fontsReady.set(true));

    // Redraws every offer-sheet page whenever its own settings (brand/tenure/rebate toggle) or the
    // underlying vehicle data changes — only while the Offer Sheet tab is actually open, since
    // rendering N print-resolution A5 canvases isn't free and the Spec Sheets tab doesn't need it.
    effect(() => {
      if (!this.fontsReady() || this.pageMode() !== 'offers') return;
      this.selectedOfferTemplateId(); // tracked so switching templates alone triggers a redraw
      const data = this.buildOfferSheetData();
      this.renderOfferSheet(data);
    });
  }

  visibleColumns = computed(() => (this.brandFilter() === 'All' ? this.columns : this.columns.filter((c) => c.key !== 'brand')));

  filteredSorted = computed(() => {
    let list = this.brandFilter() === 'All' ? this.allVehicles : this.allVehicles.filter((v) => v.brand === this.brandFilter());
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...list].sort((a, b) => compareVehicles(a, b, key, dir));
  });

  allSelected = computed(() => {
    const list = this.filteredSorted();
    return list.length > 0 && list.every((v) => this.selected().has(v.id));
  });

  openVehicle = computed(() => this.allVehicles.find((v) => v.id === this.openKey()) ?? null);

  /** Static file path the developer set on this variant (see Vehicle.brochureUrl), or null. */
  brochureFor(v: Vehicle): string | null {
    return v.brochureUrl ?? null;
  }

  safeBrochureUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  selectBrandFilter(brand: string) {
    this.brandFilter.set(brand);
    // Brand column is hidden once filtered to one brand — fall back off it so a column stays highlighted.
    if (brand !== 'All' && this.sortKey() === 'brand') {
      this.sortKey.set('model');
      this.sortDir.set('asc');
    }
  }

  toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  sortIcon(key: SortKey): IconName {
    if (this.sortKey() !== key) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  toggleSelect(id: string) {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll() {
    const list = this.filteredSorted();
    const allOn = this.allSelected();
    this.selected.update((set) => {
      const next = new Set(set);
      for (const v of list) {
        if (allOn) next.delete(v.id);
        else next.add(v.id);
      }
      return next;
    });
  }

  clearSelection() {
    this.selected.set(new Set());
  }

  tileGradient(brand: string): string {
    const style = brandStyle(brand);
    return `radial-gradient(circle at 30% 20%, ${style.bg}, transparent 70%), linear-gradient(145deg, ${style.bg}, color-mix(in oklch, ${style.bg}, black 55%))`;
  }

  private canShareFile(file: File): boolean {
    return !!(navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare?.({ files: [file] });
  }

  private brochureFileName(v: Vehicle): string {
    return `${v.brand}-${modelVariantLabel(v.model, v.variant)}-Brochure.pdf`.replace(/\s+/g, '-');
  }

  async sendBrochureFile(v: Vehicle) {
    const url = this.brochureFor(v);
    if (!url) return;
    const fileName = this.brochureFileName(v);

    // WhatsApp needs an actual File to attach, not just a link — fetch the static PDF once so it
    // can be shared, falling back to a plain download if the share sheet isn't available.
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });
      if (this.canShareFile(file)) {
        const advisor = this.advisor.profile();
        try {
          await navigator.share({ files: [file], title: 'Redline Brochure', text: `${advisor.name}, ${advisor.role}` });
        } catch (err) {
          if ((err as DOMException)?.name !== 'AbortError') {
            /* share failed for a reason other than user cancellation — nothing actionable to do here */
          }
        }
        return;
      }
    } catch {
      /* fetch failed — fall through to a plain download below */
    }

    this.downloadUrlBlob(url, fileName);
    this.shareFallbackNotice.set(true);
    setTimeout(() => this.shareFallbackNotice.set(false), 5000);
  }

  openBrochure(id: string) {
    this.openKey.set(id);
  }

  closeBrochure() {
    this.openKey.set(null);
  }

  private downloadUrlBlob(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadOne(v: Vehicle) {
    const url = this.brochureFor(v);
    if (url) this.downloadUrlBlob(url, this.brochureFileName(v));
  }

  async downloadSelected() {
    const ids = this.selected();
    for (const v of this.allVehicles) {
      if (!ids.has(v.id)) continue;
      this.downloadOne(v);
      // Small stagger so the browser doesn't treat rapid-fire downloads as a popup flood.
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // ---------- Offer Sheet ----------

  tenureYearOptions = Array.from({ length: 9 }, (_, i) => i + 1);

  offerBrand = signal(this.initialBrandFilter);
  offerTitle = signal(`${new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })} Offers`);
  /** Exactly 3 tenure years, each getting its own monthly-instalment column on the offer sheet. */
  offerTenureYears = signal<number[]>([5, 7, 9]);
  offerIncludeAdditionalRebate = signal(true);
  downloadingOfferSheet = signal(false);

  /** Toggles one tenure year in/out of the 3 compared on the offer sheet. Below 3 selected, a
   *  click just adds the year; at 3 already selected, the oldest pick is bumped out (FIFO) so
   *  there's always a click that does something instead of the button going dead. */
  toggleOfferTenureYear(year: number): void {
    const current = this.offerTenureYears();
    if (current.includes(year)) {
      if (current.length > 1) this.offerTenureYears.set(current.filter((y) => y !== year).sort((a, b) => a - b));
    } else if (current.length < 3) {
      this.offerTenureYears.set([...current, year].sort((a, b) => a - b));
    } else {
      this.offerTenureYears.set([...current.slice(1), year].sort((a, b) => a - b));
    }
  }

  /** Which model year an offer sheet quotes for one variant: the current calendar year when the
   *  catalog lists it, otherwise whichever year is the latest on file (e.g. a model still only has
   *  last year's listing) — an offer sheet should never show a stale year next to a current one
   *  just because every variant happened to get its catalog entry refreshed at a different time. */
  private offerYearFor(v: Vehicle): number {
    const currentYear = new Date().getFullYear();
    const years = v.years.map((y) => y.year);
    return years.includes(currentYear) ? currentYear : Math.max(...years);
  }

  /** Just the rows — read by the template to show/hide the "no cars" empty state without
   *  re-triggering a full BrochureData rebuild (brand logo lookup, advisor profile, etc). */
  offerRows = computed<BrochureRow[]>(() => {
    const brand = this.offerBrand();
    const defaults = this.settingsService.settings().salesDefaults;
    const includeAdditional = this.offerIncludeAdditionalRebate();
    const tenureYears = this.offerTenureYears();
    return VEHICLES.filter((v) => v.brand === brand).map((v) => {
      const basicPremiumFallback = basicPremiumDefault(v.price, defaults.basicPremiumRatePct);
      const insuranceDetails = this.settingsService.getVehicleInsurance(v, basicPremiumFallback);
      // Forced to 0% regardless of any saved customer quote's NCD — a general offer sheet quotes
      // the sticker insurance figure, not whichever NCD the last customer happened to have.
      const insurance = computeInsuranceBreakdown(insuranceDetails, 0).totalDue;
      const year = this.offerYearFor(v);
      const rebate = rebateForYear(v, year) + (includeAdditional ? additionalRebateForYear(v, year) : 0);
      const totals = computeQuotationTotals({
        basePrice: v.price,
        effectiveRebate: rebate,
        insuranceAmount: insurance,
        downpaymentType: 'percent',
        downpaymentValue: defaults.downpaymentPct,
      });
      const interestRate = defaults.defaultRateType === 'effective' ? (v.effectiveRate ?? defaults.interestRate) : (v.interestRate ?? defaults.interestRate);
      const monthlyByTenure = tenureYears.map((y) => monthlyPayment(totals.loanAmount, interestRate, y * 12, defaults.defaultRateType));
      return {
        modelTitle: modelVariantLabel(v.model, v.variant),
        year,
        carImageUrl: v.photoUrl ?? null,
        otrPrice: v.price,
        insurance,
        sellingPrice: totals.totalAmountDue,
        rebate,
        downpayment: totals.downpaymentCash,
        loanAmount: totals.loanAmount,
        monthlyByTenure,
      };
    });
  });

  private buildOfferSheetData(): BrochureData {
    const brand = this.offerBrand();
    const advisorProfile = this.advisor.profile();
    return {
      brand,
      logoUrl: brandLogo(brand),
      title: this.offerTitle(),
      tenureYears: this.offerTenureYears(),
      rows: this.offerRows(),
      advisor: {
        name: advisorProfile.name,
        role: advisorProfile.role,
        phoneDisplay: advisorProfile.phoneDisplay,
        phoneWa: advisorProfile.phoneWa,
        photoUrl: advisorProfile.photoUrl ?? null,
      },
    };
  }

  private async renderOfferSheet(data: BrochureData): Promise<void> {
    let container = this.offerContainerRef?.nativeElement;
    if (!container) {
      // The very first time pageMode flips to 'offers', this effect can run before Angular has
      // finished creating the @if block's DOM, so the ViewChild isn't resolved yet on this same
      // synchronous tick — nothing else changes afterward to naturally retry it, so wait one tick
      // for change detection to catch up and look again.
      await new Promise((resolve) => setTimeout(resolve, 0));
      container = this.offerContainerRef?.nativeElement;
      if (!container) return;
    }
    const generation = ++this.offerRenderGeneration;
    const template = this.currentOfferTemplate();
    const pages = template.paginateRows(data.rows);
    container.innerHTML = '';
    const canvases = pages.map(() => {
      const canvas = document.createElement('canvas');
      canvas.className = 'w-full h-auto rounded-lg border border-border shadow-md bg-white';
      container.appendChild(canvas);
      return canvas;
    });
    for (let i = 0; i < pages.length; i++) {
      await template.renderPage(canvases[i], data, pages[i], i, pages.length);
      if (generation !== this.offerRenderGeneration) return;
    }
  }

  /** Every offer-sheet layout this tab can render — all consuming the same BrochureData, so adding
   *  one is purely a new layout/renderer pair (see poster-brochure-templates.ts). */
  readonly offerSheetTemplates: BrochureTemplate[] = [detailedBrochureTemplate, simpleBrochureTemplate];
  selectedOfferTemplateId = signal<BrochureTemplateId>('detailed');
  currentOfferTemplate = computed(() => this.offerSheetTemplates.find((t) => t.id === this.selectedOfferTemplateId()) ?? this.offerSheetTemplates[0]);

  private offerRenderGeneration = 0;

  /** Renders straight from the canvases already in the preview — they're already at print
   *  resolution (unlike a single quote poster's screen preview vs. higher-resolution export
   *  split), so there's no separate higher-quality render pass needed here. */
  async downloadOfferSheetPdf() {
    const container = this.offerContainerRef?.nativeElement;
    if (!container || this.downloadingOfferSheet()) return;
    const canvases = Array.from(container.querySelectorAll('canvas'));
    if (canvases.length === 0) return;
    this.downloadingOfferSheet.set(true);
    try {
      const pages: PdfImagePage[] = [];
      for (const canvas of canvases) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
        if (!blob) continue;
        const jpegBytes = new Uint8Array(await blob.arrayBuffer());
        pages.push({
          jpegBytes,
          widthPx: canvas.width,
          heightPx: canvas.height,
          widthPt: (canvas.width / 300) * 72,
          heightPt: (canvas.height / 300) * 72,
        });
      }
      const bytes = assembleImagePdfBytes(pages);
      downloadPdfBytes(bytes, `${this.offerBrand()}-Offer-Sheet.pdf`.replace(/\s+/g, '-'), 'application/pdf');
    } finally {
      this.downloadingOfferSheet.set(false);
    }
  }
}
