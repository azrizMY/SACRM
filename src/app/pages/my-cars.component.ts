import { CarShadowPipe } from '../shared/car-shadow';
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent } from '../shared/icon.component';
import { brandStyle } from '../data/dashboard-data';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import { translate } from '../shared/i18n-core';
import { TranslatePipe } from '../shared/i18n';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import {
  additionalRebateForYear,
  formatRM,
  modelVariantLabel,
  rebateForYear,
  variantLabel,
  vehicleTitle,
  type Vehicle,
} from '../data/calculator-data';
import { BrandsHintComponent } from '../shared/brands-hint.component';
import { ScrollRowComponent } from '../shared/scroll-row.component';

@Component({
  selector: 'app-my-cars',
  standalone: true,
  imports: [BrandsHintComponent, CommonModule, FormsModule, IconComponent, CarShadowPipe, TranslatePipe, ScrollRowComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 pb-16">

        @if (shareFallbackNotice()) {
          <div class="flex items-center gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm">
            <app-icon name="download" [size]="18" class="shrink-0" />
            Your browser can't hand files to WhatsApp directly — brochure downloaded. Attach it in WhatsApp Desktop/Web.
          </div>
        }

        <app-brands-hint class="block empty:hidden" />

        <!-- Search + brand filter -->
        <div class="flex flex-col gap-3">
          <div data-tour="catalog-search" class="relative sm:max-w-md">
            <app-icon name="search" [size]="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              [placeholder]="'Search model or variant…' | t"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              class="h-10 w-full rounded-lg border border-input bg-input pl-10 pr-3 text-sm text-foreground"
            />
          </div>
          <!-- Brand chips only when there's more than one brand to pick between -->
          @if (brandFilters.length > 1) {
          <div role="tablist" aria-label="Filter by brand" class="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
            @for (b of brandFilters; track b) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="b === brandFilter()"
                (click)="brandFilter.set(b)"
                class="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors"
                [ngClass]="b === brandFilter() ? 'border-brand bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                {{ b }}
                <span class="tabular opacity-70">{{ countForBrand(b) }}</span>
              </button>
            }
          </div>
          }
        </div>

        <!-- Car cards -->
        @if (filteredCars().length) {
          <!-- A model with several variants gets its own titled row that scrolls sideways (the next card
               peeks in, with an arrow when more are hidden); one-variant models share one grid, so
               the page isn't one lonely card per row. -->
          <div class="flex flex-col gap-8">
          @for (run of catalogRuns(); track run.key) {
            @if (run.kind === 'model') {
              <section class="flex flex-col gap-3">
                <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 class="text-base font-semibold tracking-tight">{{ vehicleTitle(run.group.brand, run.group.model) }}</h3>
                  <span class="text-xs text-muted-foreground">
                    {{ run.group.cars.length }} {{ 'variants' | t }} · {{ 'from' | t }}
                    <span class="font-semibold text-foreground tabular">{{ fmt(run.group.fromPrice) }}</span>
                  </span>
                </div>
                <app-scroll-row>
                  @for (v of run.group.cars; track v.id) {
                    <div class="grid w-[42%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-1.5rem)/3)] 2xl:w-[calc((100%-2.25rem)/4)]">
                      <ng-container *ngTemplateOutlet="carCard; context: { $implicit: v, full: false }" />
                    </div>
                  }
                </app-scroll-row>
              </section>
            } @else {
              <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
                @for (v of run.cars; track v.id) {
                  <ng-container *ngTemplateOutlet="carCard; context: { $implicit: v, full: true }" />
                }
              </div>
            }
          }
          </div>

          <ng-template #carCard let-v let-full="full">
          <article class="lift group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
            <!-- Photo on a light stage, like a showroom shot -->
            <div class="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[oklch(0.9_0.005_280)]">
              @if (v.photoUrl) {
                <img
                  [src]="v.photoUrl | carShadow"
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
                <span class="absolute right-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground shadow">
                  {{ 'Rebate' | t }} {{ fmt(currentRebate(v)) }}
                </span>
              }
            </div>

            <div class="flex flex-1 flex-col gap-2.5 p-3">
              <div class="flex min-w-0 flex-col gap-1">
                <span class="truncate text-base font-semibold" [title]="full ? modelVariantLabel(v.model, v.variant) : (variantLabel(v.variant) || v.model)">{{ full ? modelVariantLabel(v.model, v.variant) : (variantLabel(v.variant) || v.model) }}</span>
                <span class="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  <span class="text-sm font-semibold text-foreground tabular">{{ fmt(v.price) }}</span>
                  <span>OTR</span>
                  @for (y of yearsOf(v); track y) {
                    <span class="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular text-foreground">{{ y }}</span>
                  }
                </span>
              </div>

              <div class="mt-auto flex gap-2">
                @if (brochureFor(v)) {
                  <button type="button" (click)="openBrochure(v)" class="btn btn-outline min-w-0 flex-1 gap-1.5 px-1.5">
                    <app-icon name="file-text" [size]="20" />
                    {{ 'View' | t }}
                  </button>
                  <button type="button" (click)="sendBrochureFile(v)" class="btn btn-whatsapp min-w-0 flex-1 gap-1.5 px-1.5">
                    <app-icon name="share" [size]="20" />
                    {{ 'Share' | t }}
                  </button>
                } @else {
                  <span class="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">{{ 'No brochure yet' | t }}</span>
                }
              </div>
            </div>
          </article>
          </ng-template>
        } @else {
          <div class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
            <p class="text-sm font-semibold">No cars match</p>
            <button type="button" (click)="search.set(''); brandFilter.set('All')" class="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent">Clear filters</button>
          </div>
        }
    </div>

    <!-- Brochure modal -->
    @if (openVehicle(); as v) {
    @if (brochureFor(v); as brochure) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close brochure" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeBrochure()"></button>

        <div class="relative flex h-[94vh] w-[94vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border bg-gradient-to-br from-brand-soft via-card to-card p-4">
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border"
              [style.background]="tileGradient(v.brand)"
            >
              <app-icon name="car" [size]="20" class="text-white/90" />
            </div>
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm font-semibold">{{ vehicleTitle(v.brand, v.model) }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ variantLabel(v.variant) ? variantLabel(v.variant) + ' · ' : '' }}{{ fmt(v.price) }}</span>
            </div>
            <button
              type="button"
              (click)="downloadOne(v)"
              aria-label="Download brochure"
              title="Download"
              class="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="download" [size]="18" />
            </button>
            <button
              type="button"
              (click)="closeBrochure()"
              aria-label="Close"
              class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="x" [size]="18" />
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
export class MyCarsComponent {
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
  allVehicles = computed(() => this.catalog.soldVehicles());
  /** Settings → Brands I sell, Primary Brand first; "All" means all of those. */
  get brandFilters(): string[] {
    const brands = this.catalog.soldBrands();
    return brands.length > 1 ? ['All', ...brands] : brands;
  }
  get brands(): string[] {
    return this.catalog.soldBrands();
  }

  private settingsService = inject(SettingsService);


  /** Starts on the account's Primary Brand (Profile & Settings → Quote Preferences), not "All". */
  private readonly initialBrandFilter = this.settingsService.settings().dashboardTarget.brand;
  brandFilter = signal(this.initialBrandFilter);
  search = signal('');
  openKey = signal<string | null>(null);
  shareFallbackNotice = signal(false);



  constructor(
    private sanitizer: DomSanitizer,
    public advisor: AdvisorService,
  ) {
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
  /** The catalog as rows to lay out: a model with several variants keeps its own titled section
   *  (so a row never mixes its variants with another model), while one-variant models next to
   *  each other share a single grid instead of each taking a whole row. */
  catalogRuns = computed(() => {
    const runs: ({ kind: 'model'; key: string; group: { key: string; brand: string; model: string; cars: Vehicle[]; fromPrice: number } } | { kind: 'singles'; key: string; cars: Vehicle[] })[] = [];
    for (const g of this.modelGroups()) {
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

  /** This variant's rebate (plus any additional rebate) for its current model year. */
  currentRebate(v: Vehicle): number {
    const year = this.rebateYearFor(v);
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
          await navigator.share({ files: [file], title: translate(this.settingsService.whatsappLang(), 'Car brochure') });
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

  /** The model year whose rebate the card shows: this calendar year when the catalog lists it,
   *  otherwise the latest year on file (e.g. a model that still only has last year's listing). */
  private rebateYearFor(v: Vehicle): number {
    const currentYear = new Date().getFullYear();
    const years = v.years.map((y) => y.year);
    return years.includes(currentYear) ? currentYear : Math.max(...years);
  }
}
