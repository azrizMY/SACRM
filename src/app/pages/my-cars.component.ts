import { AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../shared/icon.component';
import { brandLogo, brandStyle } from '../data/dashboard-data';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import type { SalesDefaults } from '../data/settings-data';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { TopbarExtraService } from '../shared/topbar-extra.service';
import {
  VEHICLES,
  additionalRebateForYear,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  minDownpaymentCash,
  defaultRateFor,
  formatRM,
  modelVariantLabel,
  monthlyPayment,
  rebateForYear,
  variantLabel,
  vehicleTitle,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';
import { assembleImagePdfBytes, downloadBlob as downloadPdfBytes, type PdfImagePage } from '../shared/pdf-writer';
import { posterFontsReady } from '../shared/poster-theme';
import { simpleBrochureTemplate } from '../shared/poster-brochure-template-simple';
import { groupedBrochureTemplate } from '../shared/poster-brochure-template-grouped';
import type { BrochureTemplate, BrochureTemplateId } from '../shared/poster-brochure-templates';
import type { BrochureData, BrochureRow } from '../shared/poster-brochure-data';

type OfferTab = 'preview' | 'settings';

@Component({
  selector: 'app-my-cars',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 pb-16">

      @if (pageMode() === 'specs') {
        @if (shareFallbackNotice()) {
          <div class="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm">
            <app-icon name="download" [size]="14" class="shrink-0" />
            Your browser can't hand files to WhatsApp directly — brochure downloaded. Attach it in WhatsApp Desktop/Web.
          </div>
        }

        <!-- Search + brand filter -->
        <div class="flex flex-col gap-3">
          <div class="relative sm:max-w-sm">
            <app-icon name="search" [size]="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search model or variant…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              class="h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground outline-none"
            />
          </div>
          <div role="tablist" aria-label="Filter by brand" class="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
            @for (b of brandFilters; track b) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="b === brandFilter()"
                (click)="brandFilter.set(b)"
                class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                [ngClass]="b === brandFilter() ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                {{ b }}
                <span class="tabular opacity-70">{{ countForBrand(b) }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Car cards -->
        @if (filteredCars().length) {
          <!-- One section per model, so a row never mixes models (Saga, then S70, then X50…) -->
          <div class="flex flex-col gap-8">
          @for (g of modelGroups(); track g.key) {
          <section class="flex flex-col gap-3">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 class="text-lg font-bold tracking-tight">{{ vehicleTitle(g.brand, g.model) }}</h3>
              <span class="text-xs text-muted-foreground">
                {{ g.cars.length }} {{ g.cars.length === 1 ? 'variant' : 'variants' }} · from
                <span class="font-semibold text-foreground tabular">{{ fmt(g.fromPrice) }}</span>
              </span>
            </div>
          <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 md:mx-0 md:scroll-px-0 md:px-0">
            @for (v of g.cars; track v.id) {
              <article class="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[220px] lift group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
                <!-- Photo on a light stage, like a showroom shot -->
                <div class="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[oklch(0.9_0.005_280)]">
                  @if (v.photoUrl) {
                    <img
                      [src]="v.photoUrl"
                      [alt]="modelVariantLabel(v.model, v.variant)"
                      loading="lazy"
                      class="h-full w-full object-contain p-2.5 transition-transform duration-500 group-hover:scale-105"
                    />
                  } @else {
                    <div class="flex h-full w-full items-center justify-center" [style.background]="tileGradient(v.brand)">
                      <app-icon name="car" [size]="28" class="text-white/80" />
                    </div>
                  }
                  @if (currentRebate(v) > 0) {
                    <span class="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow">
                      Rebate {{ fmt(currentRebate(v)) }}
                    </span>
                  }
                </div>

                <div class="flex flex-1 flex-col gap-2.5 p-3">
                  <div class="flex min-w-0 flex-col gap-1">
                    <span class="truncate text-sm font-bold">{{ variantLabel(v.variant) || v.model }}</span>
                    <span class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span class="font-semibold text-foreground tabular">{{ fmt(v.price) }}</span>
                      <span>OTR</span>
                      @for (y of yearsOf(v); track y) {
                        <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular text-foreground">{{ y }}</span>
                      }
                    </span>
                  </div>

                  <div class="mt-auto flex gap-2">
                    @if (brochureFor(v)) {
                      <button type="button" (click)="openBrochure(v)" class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
                        <app-icon name="file-text" [size]="13" />
                        View
                      </button>
                      <button type="button" (click)="sendBrochureFile(v)" class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#25D366]/12 py-1.5 text-xs font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20">
                        <app-icon name="share" [size]="13" />
                        Share
                      </button>
                    } @else {
                      <span class="flex flex-1 items-center justify-center rounded-lg bg-muted/40 py-2 text-xs text-muted-foreground">No brochure yet</span>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
          </section>
          }
          </div>
        } @else {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <p class="text-sm font-semibold">No cars match</p>
            <button type="button" (click)="search.set(''); brandFilter.set('All')" class="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">Clear filters</button>
          </div>
        }
      }

      @if (pageMode() === 'offers') {
        @if (offerShareFallbackNotice()) {
          <div class="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm">
            <app-icon name="download" [size]="14" class="shrink-0" />
            Your browser can't hand files to WhatsApp directly — offer sheet downloaded. Attach it in WhatsApp Desktop/Web.
          </div>
        }

        <!-- Phones: switch between the sheet and its settings instead of scrolling past every page -->
        <div role="tablist" aria-label="Offer sheet view" class="flex rounded-lg bg-card p-1 xl:hidden">
          @for (t of offerTabs; track t.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="offerMobileTab() === t.id"
              (click)="offerMobileTab.set(t.id)"
              class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="offerMobileTab() === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            >
              {{ t.label }}
            </button>
          }
        </div>

        <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
          <!-- Offer sheet preview — an A5 page renders at its natural height, no inner scroll. -->
          <div class="flex-col gap-3 xl:sticky xl:top-4 xl:col-span-2 xl:flex" [ngClass]="offerMobileTab() === 'preview' ? 'flex' : 'hidden'">
            @if (offerSheetTemplates.length > 1) {
              <div role="radiogroup" aria-label="Offer sheet template" class="flex w-full shrink-0 gap-1.5 rounded-xl bg-card p-1.5">
                @for (t of offerSheetTemplates; track t.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="selectedOfferTemplateId() === t.id"
                    (click)="selectedOfferTemplateId.set(t.id)"
                    class="flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition-colors"
                    [ngClass]="selectedOfferTemplateId() === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    {{ t.label }}
                  </button>
                }
              </div>
            }
            @if (offerRows().length === 0) {
              <p class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {{ offerBrand() }} has no cars in the Car Database yet — add some in Price Settings first.
              </p>
            }

            <div #offerContainer class="flex flex-col gap-4" [class.opacity-60]="offerRendering()"></div>

            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                (click)="downloadOfferSheetPdf()"
                [disabled]="offerBusy() || offerRows().length === 0"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                <app-icon name="download" [size]="15" />
                {{ offerRendering() ? 'Updating…' : downloadingOfferSheet() ? 'Preparing…' : 'Download PDF' }}
              </button>
              <button
                type="button"
                (click)="shareOfferSheetPdf()"
                [disabled]="offerBusy() || offerRows().length === 0"
                class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <app-icon name="share" [size]="15" />
                {{ sharingOfferSheet() ? 'Sharing…' : 'Share' }}
              </button>
            </div>
          </div>

          <!-- Offer sheet settings -->
          <div class="flex-col gap-4 xl:sticky xl:top-4 xl:col-span-1 xl:flex" [ngClass]="offerMobileTab() === 'settings' ? 'flex' : 'hidden'">
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sheet</span>
              <div class="flex flex-col gap-2">
                <label for="offerTitleInput" class="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  id="offerTitleInput"
                  type="text"
                  [ngModel]="offerTitle()"
                  (ngModelChange)="offerTitle.set($event)"
                  placeholder="e.g. September 2026 Offers"
                  class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none"
                />
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Brand</span>
                <div class="flex flex-wrap gap-1.5">
                  @for (b of brands; track b) {
                    <button
                      type="button"
                      [attr.aria-pressed]="offerBrand() === b"
                      (click)="offerBrand.set(b)"
                      class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                      [ngClass]="offerBrand() === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ b }}
                    </button>
                  }
                </div>
                <span class="text-[11px] text-muted-foreground">Every model, variant, and year of this brand gets its own row.</span>
              </div>
            </div>

            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</span>
              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium text-muted-foreground">Compare 3 tenures</span>
                  <span class="text-xs font-semibold tabular text-foreground">{{ offerTenureSummary() }}</span>
                </div>
                <div role="group" aria-label="Offer sheet tenures" class="grid grid-cols-9 gap-1">
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
                <span class="text-[11px] text-muted-foreground">Each row's "from" monthly figure is the lowest instalment among these tenures.</span>
              </div>

              <label class="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
                <span class="flex flex-col">
                  <span class="text-xs font-semibold text-foreground">Include Additional Rebate</span>
                  <span class="text-[11px] text-muted-foreground">Adds each car's promo top-up to its rebate.</span>
                </span>
                <input
                  type="checkbox"
                  [ngModel]="offerIncludeAdditionalRebate()"
                  (ngModelChange)="offerIncludeAdditionalRebate.set($event)"
                  class="size-4 shrink-0 rounded border-input accent-primary"
                />
              </label>

              <p class="text-[11px] text-muted-foreground">
                Monthly figures use your default down payment and rate (Price Settings). Insurance is quoted at 0% NCD.
              </p>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Brochures / Offer Sheet switcher — projected into the topbar (see TopbarExtraService)
         instead of rendered here, so it sits beside the page title up top. -->
    <ng-template #modeSwitcherTpl>
      <div role="tablist" aria-label="Brochures mode" class="flex w-fit shrink-0 rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="pageMode() === 'specs'"
          (click)="pageMode.set('specs')"
          class="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
          [ngClass]="pageMode() === 'specs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
        >
          Brochures
        </button>
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="pageMode() === 'offers'"
          (click)="pageMode.set('offers')"
          class="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
          [ngClass]="pageMode() === 'offers' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
        >
          Offers
        </button>
      </div>
    </ng-template>

    <!-- Brochure modal -->
    @if (openVehicle(); as v) {
    @if (brochureFor(v); as brochure) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close brochure" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeBrochure()"></button>

        <div class="relative flex h-[94vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border bg-gradient-to-br from-primary/12 via-card to-card p-4">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border"
              [style.background]="tileGradient(v.brand)"
            >
              <app-icon name="car" [size]="20" class="text-white/90" />
            </div>
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-semibold">{{ vehicleTitle(v.brand, v.model) }}</span>
              <span class="truncate text-[11px] text-muted-foreground">{{ variantLabel(v.variant) ? variantLabel(v.variant) + ' · ' : '' }}{{ fmt(v.price) }}</span>
            </div>
            <button
              type="button"
              (click)="downloadOne(v)"
              aria-label="Download brochure"
              title="Download"
              class="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="download" [size]="16" />
            </button>
            <button
              type="button"
              (click)="closeBrochure()"
              aria-label="Close"
              class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <div class="flex-1 bg-muted/20">
            <iframe [src]="safeBrochureUrl(brochure)" title="Brochure" class="h-full w-full"></iframe>
          </div>
        </div>
      </div>
    }
    }
  `,
})
export class MyCarsComponent implements AfterViewInit, OnDestroy {
  fmt = (v: number) => formatRM(v);
  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;
  vehicleTitle = vehicleTitle;

  private catalog = inject(VehicleCatalogService);

  /** One row per brand+model+variant already — every model year of a variant lives on the same
   *  row (see Vehicle.years), so VEHICLES itself is already one row per variant. Reads through
   *  VehicleCatalogService (not the raw VEHICLES import) so a price/rebate saved in Price Settings
   *  shows up here without needing a full page reload — brand/model/variant identity itself never
   *  changes at runtime, so the brand lists below can stay static off VEHICLES directly. */
  allVehicles = computed(() => this.catalog.vehicles());
  brandFilters = ['All', ...Array.from(new Set(VEHICLES.map((v) => v.brand)))];
  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));

  private settingsService = inject(SettingsService);

  /** "Brochures" is the existing per-car brochure table below; "Offer Sheet" is a combined,
   *  generated multi-model page for a whole brand — different enough (many vehicles, print-
   *  resolution A5 pages, no single-car context) that it gets its own top-level mode. */
  pageMode = signal<'specs' | 'offers'>('specs');

  /** Starts on the account's Primary Brand (Profile & Settings → Quote Preferences), not "All". */
  private readonly initialBrandFilter = this.settingsService.settings().dashboardTarget.brand;
  brandFilter = signal(this.initialBrandFilter);
  search = signal('');
  openKey = signal<string | null>(null);
  shareFallbackNotice = signal(false);

  @ViewChild('offerContainer') offerContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('modeSwitcherTpl') private modeSwitcherTpl?: TemplateRef<unknown>;
  private topbarExtra = inject(TopbarExtraService);

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
    // rendering N print-resolution A5 canvases isn't free and the Brochures tab doesn't need it.
    effect(() => {
      if (!this.fontsReady() || this.pageMode() !== 'offers') return;
      this.selectedOfferTemplateId(); // tracked so switching templates alone triggers a redraw
      const data = this.buildOfferSheetData();
      this.renderOfferSheet(data);
    });
  }

  ngAfterViewInit() {
    this.topbarExtra.content.set(this.modeSwitcherTpl ?? null);
  }

  ngOnDestroy() {
    this.topbarExtra.content.set(null);
  }

  /** Kept in catalog declaration order — the catalog is hand-ordered by spec (e.g. Lite → Prime →
   *  Premium → Flagship), which an alphabetical sort would scatter. */
  filteredCars = computed(() => {
    const q = this.search().trim().toLowerCase();
    const brand = this.brandFilter();
    return this.allVehicles().filter(
      (v) => (brand === 'All' || v.brand === brand) && (!q || `${v.brand} ${v.model} ${v.variant}`.toLowerCase().includes(q)),
    );
  });

  /** Filtered cars split into one group per brand + model, in catalog order, so each model gets
   *  its own section (and row) instead of models running together in one grid. */
  modelGroups = computed(() => {
    const groups: { key: string; brand: string; model: string; cars: Vehicle[]; fromPrice: number }[] = [];
    for (const v of this.filteredCars()) {
      const key = `${v.brand}|${v.model}`;
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, brand: v.brand, model: v.model, cars: [], fromPrice: v.price };
        groups.push(g);
      }
      g.cars.push(v);
      g.fromPrice = Math.min(g.fromPrice, v.price);
    }
    return groups;
  });

  countForBrand(brand: string): number {
    return brand === 'All' ? this.allVehicles().length : this.allVehicles().filter((v) => v.brand === brand).length;
  }

  /** Newest-first model years on file for this variant. */
  yearsOf(v: Vehicle): number[] {
    return v.years.map((y) => y.year).sort((a, b) => b - a);
  }

  /** This variant's rebate (plus any additional rebate) for the year an offer sheet would quote. */
  currentRebate(v: Vehicle): number {
    const year = this.offerYearFor(v);
    return rebateForYear(v, year) + additionalRebateForYear(v, year);
  }

  openVehicle = computed(() => this.allVehicles().find((v) => v.id === this.openKey()) ?? null);

  /** Static file path the developer set on this variant (see Vehicle.brochureUrl), or null. */
  brochureFor(v: Vehicle): string | null {
    return v.brochureUrl ?? null;
  }

  safeBrochureUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }


  tileGradient(brand: string): string {
    const style = brandStyle(brand);
    return `radial-gradient(circle at 30% 20%, ${style.bg}, transparent 70%), linear-gradient(145deg, ${style.bg}, color-mix(in oklch, ${style.bg}, black 55%))`;
  }

  private canShareFile(file: File): boolean {
    return !!(navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare?.({ files: [file] });
  }

  private brochureFileName(v: Vehicle): string {
    return `${v.brand}-${modelVariantLabel(v.model, v.variant)}-Brochure.pdf`.replace(/\s*\|\s*/g, '-').replace(/\s+/g, '-');
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

  /** In-page viewer on tablet/desktop. On phones a PDF inside an iframe is unreliable (iOS often
   *  shows only the first page and won't scroll), so it opens in the phone's own PDF viewer. */
  openBrochure(v: Vehicle) {
    const url = this.brochureFor(v);
    if (!url) return;
    if (matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1024px)').matches) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    this.openKey.set(v.id);
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

  // ---------- Offer Sheet ----------

  tenureYearOptions = Array.from({ length: 9 }, (_, i) => i + 1);

  offerBrand = signal(this.initialBrandFilter);
  offerTitle = signal(`${new Date().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })} Offers`);
  /** Exactly 3 tenure years, each getting its own monthly-instalment column on the offer sheet. */
  offerTenureYears = signal<number[]>([5, 7, 9]);
  offerIncludeAdditionalRebate = signal(this.settingsService.settings().salesDefaults.additionalRebateByDefault ?? true);
  downloadingOfferSheet = signal(false);
  sharingOfferSheet = signal(false);
  offerShareFallbackNotice = signal(false);
  /** True while the pages are being rebuilt after a settings change — Download/Share wait for it,
   *  so a half-rebuilt sheet can never be saved or sent. */
  offerRendering = signal(false);
  offerBusy = computed(() => this.offerRendering() || this.downloadingOfferSheet() || this.sharingOfferSheet());

  offerTabs: { id: OfferTab; label: string }[] = [
    { id: 'preview', label: 'Preview' },
    { id: 'settings', label: 'Settings' },
  ];
  offerMobileTab = signal<OfferTab>('preview');
  offerTenureSummary = computed(() => [...this.offerTenureYears()].sort((a, b) => a - b).map((y) => `${y}y`).join(' · '));

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

  /** Shared per-vehicle row builder for both offer-sheet row sets below. `noRebate: true`
   *  (Financing Price List only) prices the whole row — selling price, downpayment, loan, monthly —
   *  with zero rebate applied: it's a plain full-price list, not a promo sheet. With rebate at 0 the
   *  normal 'percent' downpayment formula already lands on the flat default-% of OTR with nothing
   *  to subtract, so no special-casing is needed there. */
  private buildOfferRow(v: Vehicle, defaults: SalesDefaults, includeAdditional: boolean, tenureYears: number[], noRebate: boolean): BrochureRow {
    const basicPremiumFallback = basicPremiumDefault(v.price, defaults.basicPremiumRatePct);
    const insuranceDetails = this.settingsService.getVehicleInsurance(v, basicPremiumFallback);
    // Forced to 0% regardless of any saved customer quote's NCD — a general offer sheet quotes
    // the sticker insurance figure, not whichever NCD the last customer happened to have.
    const insurance = computeInsuranceBreakdown(insuranceDetails, 0).totalDue;
    const year = this.offerYearFor(v);
    const rebate = noRebate ? 0 : rebateForYear(v, year) + (includeAdditional ? additionalRebateForYear(v, year) : 0);
    const totals = computeQuotationTotals({
      basePrice: v.price,
      effectiveRebate: rebate,
      insuranceAmount: insurance,
      downpaymentType: 'percent',
      downpaymentValue: defaults.downpaymentPct,
      minDownpaymentCash: minDownpaymentCash(v.minDownpayment, v.price),
    });
    // Same rule as the Calculator and the customer link: EIR only when an EIR actually exists (the
    // car's own or the account default); otherwise this row is quoted — and computed — as flat,
    // never a flat figure run through the EIR formula, which would understate the monthly.
    const eir = defaults.defaultRateType === 'effective' ? defaultRateFor(v, 'effective', defaults) : null;
    const rateType: RateType = eir !== null ? 'effective' : 'flat';
    const interestRate = eir ?? defaultRateFor(v, 'flat', defaults) ?? defaults.interestRate;
    const monthlyByTenure = tenureYears.map((y) => monthlyPayment(totals.loanAmount, interestRate, y * 12, rateType));
    return {
      model: v.model,
      modelTitle: modelVariantLabel(v.model, v.variant),
      variantText: variantLabel(v.variant),
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
  }

  /** Just the rows — read by the template to show/hide the "no cars" empty state without
   *  re-triggering a full BrochureData rebuild (brand logo lookup, advisor profile, etc). Feeds
   *  the Current Offers and Price List templates. */
  offerRows = computed<BrochureRow[]>(() => {
    const brand = this.offerBrand();
    const defaults = this.settingsService.settings().salesDefaults;
    const includeAdditional = this.offerIncludeAdditionalRebate();
    const tenureYears = this.offerTenureYears();
    return this.allVehicles()
      .filter((v) => v.brand === brand)
      .map((v) => this.buildOfferRow(v, defaults, includeAdditional, tenureYears, false));
  });

  /** Same rows as offerRows(), but with rebate zeroed out entirely — see buildOfferRow. Feeds the
   *  Financing Price List template only. */
  groupedOfferRows = computed<BrochureRow[]>(() => {
    const brand = this.offerBrand();
    const defaults = this.settingsService.settings().salesDefaults;
    const includeAdditional = this.offerIncludeAdditionalRebate();
    const tenureYears = this.offerTenureYears();
    return this.allVehicles()
      .filter((v) => v.brand === brand)
      .map((v) => this.buildOfferRow(v, defaults, includeAdditional, tenureYears, true));
  });

  private buildOfferSheetData(): BrochureData {
    const brand = this.offerBrand();
    const advisorProfile = this.advisor.profile();
    return {
      brand,
      logoUrl: brandLogo(brand),
      title: this.offerTitle(),
      tenureYears: this.offerTenureYears(),
      rows: this.selectedOfferTemplateId() === 'grouped' ? this.groupedOfferRows() : this.offerRows(),
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
    this.offerRendering.set(true);
    const template = this.currentOfferTemplate();
    const pages = template.paginateRows(data.rows);
    container.innerHTML = '';
    const canvases = pages.map(() => {
      const canvas = document.createElement('canvas');
      canvas.className = 'w-full h-auto rounded-xl shadow-lg bg-white';
      container.appendChild(canvas);
      return canvas;
    });
    try {
      for (let i = 0; i < pages.length; i++) {
        await template.renderPage(canvases[i], data, pages[i], i, pages.length);
        if (generation !== this.offerRenderGeneration) return;
      }
    } finally {
      // Only the newest rebuild clears the flag — an older one bailing out mustn't unlock the buttons.
      if (generation === this.offerRenderGeneration) this.offerRendering.set(false);
    }
  }

  /** Every offer-sheet layout this tab can render — all consuming the same BrochureData, so adding
   *  one is purely a new layout/renderer pair (see poster-brochure-templates.ts). */
  readonly offerSheetTemplates: BrochureTemplate[] = [simpleBrochureTemplate, groupedBrochureTemplate];
  selectedOfferTemplateId = signal<BrochureTemplateId>('simple');
  currentOfferTemplate = computed(() => this.offerSheetTemplates.find((t) => t.id === this.selectedOfferTemplateId()) ?? this.offerSheetTemplates[0]);

  private offerRenderGeneration = 0;

  /** Renders straight from the canvases already in the preview — they're already at print
   *  resolution (unlike a single quote poster's screen preview vs. higher-resolution export
   *  split), so there's no separate higher-quality render pass needed here. */
  private offerSheetFileName(): string {
    return `${this.offerBrand()}-Offer-Sheet.pdf`.replace(/\s*\|\s*/g, '-').replace(/\s+/g, '-');
  }

  /** Assembles the PDF from the canvases already in the preview, or null if there's nothing to export. */
  private async offerSheetPdfBytes(): Promise<Uint8Array | null> {
    const container = this.offerContainerRef?.nativeElement;
    const canvases = container ? Array.from(container.querySelectorAll('canvas')) : [];
    if (canvases.length === 0) return null;
    const pages: PdfImagePage[] = [];
    for (const canvas of canvases) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) continue;
      pages.push({
        jpegBytes: new Uint8Array(await blob.arrayBuffer()),
        widthPx: canvas.width,
        heightPx: canvas.height,
        widthPt: (canvas.width / 300) * 72,
        heightPt: (canvas.height / 300) * 72,
      });
    }
    return assembleImagePdfBytes(pages);
  }

  async downloadOfferSheetPdf() {
    if (this.offerBusy()) return;
    this.downloadingOfferSheet.set(true);
    try {
      const bytes = await this.offerSheetPdfBytes();
      if (bytes) downloadPdfBytes(bytes, this.offerSheetFileName(), 'application/pdf');
    } finally {
      this.downloadingOfferSheet.set(false);
    }
  }

  /** Hands the offer sheet PDF to the OS share sheet (WhatsApp, Telegram, email…) — same pattern
   *  as a brochure share; falls back to a download with a notice where file sharing isn't supported. */
  async shareOfferSheetPdf() {
    if (this.offerBusy()) return;
    this.sharingOfferSheet.set(true);
    try {
      const bytes = await this.offerSheetPdfBytes();
      if (!bytes) return;
      const file = new File([bytes], this.offerSheetFileName(), { type: 'application/pdf' });
      if (this.canShareFile(file)) {
        const advisor = this.advisor.profile();
        try {
          await navigator.share({ files: [file], title: this.offerTitle(), text: `${advisor.name}, ${advisor.role}` });
        } catch {
          /* cancelled or failed — nothing actionable, same as the brochure share */
        }
        return;
      }
      downloadPdfBytes(bytes, this.offerSheetFileName(), 'application/pdf');
      this.offerShareFallbackNotice.set(true);
      setTimeout(() => this.offerShareFallbackNotice.set(false), 5000);
    } finally {
      this.sharingOfferSheet.set(false);
    }
  }
}
