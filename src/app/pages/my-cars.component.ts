import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IconComponent, type IconName } from '../shared/icon.component';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { brandStyle } from '../data/dashboard-data';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import { VEHICLES, formatRM, latestVehiclePerVariant, modelVariantLabel, variantLabel, type Vehicle } from '../data/calculator-data';
import { loadAllBrochures } from '../shared/brochure-store';

type CustomBrochure = { fileName: string; blob: Blob; rawUrl: string; url: SafeResourceUrl };
type SortKey = 'brand' | 'model' | 'variant' | 'engine' | 'powertrain' | 'seater' | 'transmission';
type SortDir = 'asc' | 'desc';
type Column = { key: SortKey; label: string; align?: 'right' };

const COLUMNS: Column[] = [
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'powertrain', label: 'Powertrain' },
  { key: 'engine', label: 'Engine' },
  { key: 'transmission', label: 'Transmission' },
  { key: 'seater', label: 'Seater', align: 'right' },
];

const POWERTRAIN_BADGE: Record<Vehicle['powertrain'], string> = {
  ICE: 'border-border bg-muted/40 text-muted-foreground',
  HEV: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  PHEV: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
  BEV: 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

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
  imports: [CommonModule, IconComponent, BrandMarkComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 pb-16">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-balance text-xl font-semibold tracking-tight">My Cars</h2>
          <p class="text-pretty text-sm text-muted-foreground">
            Browse the uploaded brochure for every model, filter by brand, and download or view on the spot.
          </p>
        </div>
      </div>

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
                  <td class="p-4 align-middle">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                      [ngClass]="powertrainBadge(v.powertrain)"
                    >
                      {{ v.powertrain }}
                    </span>
                  </td>
                  <td class="p-4 align-middle text-muted-foreground">{{ v.engine }}</td>
                  <td class="p-4 align-middle text-muted-foreground">{{ v.transmission }}</td>
                  <td class="p-4 text-right align-middle tabular">{{ v.seater }}</td>
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
              <div class="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold" [ngClass]="powertrainBadge(v.powertrain)">
                  {{ v.powertrain }}
                </span>
                <span class="text-xs text-muted-foreground">{{ v.engine }}</span>
                <span class="text-xs text-muted-foreground">&middot; {{ v.transmission }}</span>
                <span class="text-xs text-muted-foreground">&middot; {{ v.seater }} seater</span>
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
            <iframe [src]="brochure.url" title="Brochure" class="h-[70vh] w-full"></iframe>
          </div>
        </div>
      </div>
    }
    }
  `,
})
export class MyCarsComponent implements OnDestroy {
  fmt = (v: number) => formatRM(v);
  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;

  /** One row per brand+model+variant — a car added under a second model year (Car Database) is
   *  the same brochure/spec, so it shouldn't show as a second row here. */
  allVehicles: Vehicle[] = latestVehiclePerVariant(VEHICLES);
  brandFilters = ['All', ...Array.from(new Set(this.allVehicles.map((v) => v.brand)))];
  columns = COLUMNS;

  /** Starts on the account's Default Brand (Account Settings → Dashboard), not "All". */
  private readonly initialBrandFilter = inject(SettingsService).settings().dashboardTarget.brand;
  brandFilter = signal(this.initialBrandFilter);
  // Brand column is hidden whenever the starting filter isn't "All" — fall back off it so a
  // column is highlighted from the very first render, same rule as selectBrandFilter() below.
  sortKey = signal<SortKey>(this.initialBrandFilter === 'All' ? 'brand' : 'model');
  sortDir = signal<SortDir>('asc');
  openKey = signal<string | null>(null);
  selected = signal<Set<string>>(new Set());
  customBrochures = signal<Record<string, CustomBrochure>>({});
  shareFallbackNotice = signal(false);

  constructor(
    private sanitizer: DomSanitizer,
    public advisor: AdvisorService,
  ) {
    loadAllBrochures().then((stored) => {
      const map: Record<string, CustomBrochure> = {};
      for (const [key, entry] of Object.entries(stored)) {
        const rawUrl = URL.createObjectURL(entry.blob);
        map[key] = { fileName: entry.fileName, blob: entry.blob, rawUrl, url: this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl) };
      }
      this.customBrochures.set(map);
    });
  }

  ngOnDestroy() {
    for (const entry of Object.values(this.customBrochures())) URL.revokeObjectURL(entry.rawUrl);
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

  /** Same key scheme the Brand & Model Catalog uploads under — brand::model::variant, independent
   *  of model year, since a brochure covers the whole variant, not one year's pricing row. */
  private brochureKey(v: Vehicle): string {
    return `${v.brand}::${v.model}::${v.variant}`;
  }

  brochureFor(v: Vehicle): CustomBrochure | null {
    return this.customBrochures()[this.brochureKey(v)] ?? null;
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

  powertrainBadge(powertrain: Vehicle['powertrain']): string {
    return POWERTRAIN_BADGE[powertrain];
  }

  tileGradient(brand: string): string {
    const style = brandStyle(brand);
    return `radial-gradient(circle at 30% 20%, ${style.bg}, transparent 70%), linear-gradient(145deg, ${style.bg}, color-mix(in oklch, ${style.bg}, black 55%))`;
  }

  private canShareFile(file: File): boolean {
    return !!(navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare?.({ files: [file] });
  }

  async sendBrochureFile(v: Vehicle) {
    const custom = this.brochureFor(v);
    if (!custom) return;
    const file = new File([custom.blob], custom.fileName, { type: custom.blob.type || 'application/pdf' });

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

    this.downloadBlob(custom.rawUrl, custom.fileName);
    this.shareFallbackNotice.set(true);
    setTimeout(() => this.shareFallbackNotice.set(false), 5000);
  }

  openBrochure(id: string) {
    this.openKey.set(id);
  }

  closeBrochure() {
    this.openKey.set(null);
  }

  private downloadBlob(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadOne(v: Vehicle) {
    const custom = this.brochureFor(v);
    if (custom) this.downloadBlob(custom.rawUrl, custom.fileName);
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
}
