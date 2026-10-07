import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { TranslatePipe, translate } from '../shared/i18n';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { CompareService } from '../shared/compare.service';
import { CompareTableComponent, type CompareColumn } from '../shared/compare-table.component';
import { renderComparePoster } from '../shared/compare-poster';
import { downloadBlob } from '../shared/pdf-writer';
import { NCD_OPTIONS, additionalRebateForYear, basicPremiumDefault, modelVariantLabel, type RateType, type Vehicle } from '../data/calculator-data';
import { quoteForComparison, type CompareSetup } from '../data/compare-data';

/**
 * The SA's Compare page: up to 3 cars side by side on one shared loan setup — price and loan
 * figures only — with a Share image for WhatsApp. The table itself is CompareTableComponent,
 * shared with the customer link.
 */
@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [NgClass, FormsModule, IconComponent, TranslatePipe, CompareTableComponent],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col pb-10">
      <!-- The top bar already titles the page; this just says what it does. -->
      <p class="px-2 pb-5 text-center text-sm text-muted-foreground sm:pb-8 sm:text-base">{{ 'Choose up to 3 cars. Every car is quoted on the same loan.' | t }}</p>

      <!-- Shared loan setup -->
      <section class="rounded-2xl bg-card p-4 text-card-foreground sm:p-5">
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span class="text-sm font-semibold">{{ 'Same loan for every car' | t }}</span>
          <span class="text-xs text-muted-foreground">{{ "Rebates, insurance and rates are each car's own." | t }}</span>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
          <div class="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span class="text-xs text-muted-foreground">{{ 'Downpayment' | t }}</span>
            <div class="flex gap-2">
              <div class="flex shrink-0 rounded-full bg-muted/50 p-0.5 text-xs font-semibold">
                @for (k of dpKinds; track k.id) {
                  <button type="button" (click)="setDownpaymentType(k.id)" class="rounded-full px-3 py-1.5 transition-colors" [ngClass]="setup().downpaymentType === k.id ? 'bg-foreground text-background' : 'text-muted-foreground'">
                    {{ k.label }}
                  </button>
                }
              </div>
              <input
                type="number"
                inputmode="decimal"
                min="0"
                [ngModel]="setup().downpaymentValue"
                (ngModelChange)="patch({ downpaymentValue: Math.max(0, +$event || 0) })"
                [attr.aria-label]="'Downpayment' | t"
                class="h-9 w-full min-w-0 rounded-full border border-input bg-input px-4 text-sm tabular text-foreground outline-none focus:border-ring"
              />
            </div>
          </div>
          <div class="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <label for="compareTenure" class="text-xs text-muted-foreground">{{ 'Tenure' | t }}</label>
            <div class="relative">
              <select
                id="compareTenure"
                [ngModel]="setup().tenureMonths"
                (ngModelChange)="patch({ tenureMonths: +$event })"
                class="h-9 w-full appearance-none rounded-full border border-input bg-input pl-3 pr-8 text-xs text-foreground sm:pl-4 sm:text-sm outline-none focus:border-ring"
              >
                @for (y of tenureYears; track y) {
                  <option [ngValue]="y * 12">{{ y }} {{ (y === 1 ? 'year' : 'years') | t }}</option>
                }
              </select>
              <app-icon name="chevron-down" [size]="14" class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-muted-foreground">{{ 'Rate Type' | t }}</span>
            <div class="flex rounded-full bg-muted/50 p-0.5 text-xs font-semibold">
              @for (r of rateTypes; track r.id) {
                <button type="button" (click)="patch({ rateType: r.id })" class="flex-1 rounded-full px-3 py-2 transition-colors" [ngClass]="setup().rateType === r.id ? 'bg-foreground text-background' : 'text-muted-foreground'">
                  {{ r.label | t }}
                </button>
              }
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="compareNcd" class="text-xs text-muted-foreground">NCD</label>
            <div class="relative">
              <select
                id="compareNcd"
                [ngModel]="setup().ncd"
                (ngModelChange)="patch({ ncd: +$event })"
                class="h-9 w-full appearance-none rounded-full border border-input bg-input pl-3 pr-8 text-xs text-foreground sm:pl-4 sm:text-sm outline-none focus:border-ring"
              >
                @for (o of ncdOptions; track o.value) {
                  <option [ngValue]="o.value">{{ o.label | t }}</option>
                }
              </select>
              <app-icon name="chevron-down" [size]="14" class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      <app-compare-table
        [columns]="columns()"
        [carGroups]="carGroups()"
        [setup]="setup()"
        actionLabel="Open in Calculator"
        stickyClass="-top-4 -mx-4 mt-6 px-4 md:-top-6 md:-mx-6 md:px-6"
        (chooseCar)="chooseCar($event.column, $event.vehicleId)"
        (remove)="compare.remove($event)"
        (setYear)="compare.setYear($event.index, $event.year)"
        [showAdditionalRebate]="true"
        (toggleAdditionalRebate)="compare.setAdditionalRebate($event.index, $event.on)"
        (action)="openInCalculator($event)"
      />

      @if (columns().length > 0) {
        <!-- Share -->
        <div class="mt-12 flex flex-col items-center gap-3 text-center">
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              (click)="save()"
              [disabled]="columns().length < 2 || saving()"
              class="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon [name]="saved() ? 'check' : 'download'" [size]="15" />
              {{ (saving() ? 'Saving…' : saved() ? 'Saved!' : 'Save') | t }}
            </button>
            <button
              type="button"
              (click)="share()"
              [disabled]="columns().length < 2 || sharing()"
              class="btn-glow flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-50"
            >
              <app-icon name="share" [size]="15" />
              {{ (sharing() ? 'Preparing…' : 'Share comparison') | t }}
            </button>
          </div>
          @if (columns().length < 2) {
            <p class="text-xs text-muted-foreground">{{ 'Choose at least 2 cars to share a comparison.' | t }}</p>
          }
          @if (shareNotice()) {
            <p class="text-xs text-muted-foreground">{{ 'Saved the image to your downloads. Attach it in WhatsApp.' | t }}</p>
          }
          <p class="max-w-md text-pretty text-[11px] text-muted-foreground">{{ 'Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here.' | t }}</p>
        </div>
      } @else {
        <p class="mt-10 text-center text-sm text-muted-foreground">{{ 'Add 2 or 3 cars to compare their price, downpayment and monthly instalment.' | t }}</p>
      }
    </div>
  `,
})
export class CompareComponent {
  readonly compare = inject(CompareService);
  private settings = inject(SettingsService);
  private catalog = inject(VehicleCatalogService);
  private advisor = inject(AdvisorService);
  private router = inject(Router);

  readonly Math = Math;
  readonly ncdOptions = NCD_OPTIONS;
  readonly tenureYears = Array.from({ length: 9 }, (_, i) => i + 1);
  readonly dpKinds = [
    { id: 'percent' as const, label: '%' },
    { id: 'amount' as const, label: 'RM' },
  ];
  readonly rateTypes: { id: RateType; label: string }[] = [
    { id: 'flat', label: 'Flat' },
    { id: 'effective', label: 'EIR' },
  ];

  sharing = signal(false);
  shareNotice = signal(false);

  constructor() {
    if (!this.compare.setup()) {
      const d = this.settings.settings().salesDefaults;
      this.compare.setup.set({
        downpaymentType: 'percent',
        downpaymentValue: d.downpaymentPct,
        tenureMonths: Math.max(...d.defaultTenureYears) * 12,
        rateType: d.defaultRateType,
        ncd: d.ncd,
      });
    }
  }

  setup = computed(() => this.compare.setup()!);
  /** Where a car's own "Additional rebate" tick starts — the account's setting. */
  private additionalByDefault = computed(() => this.settings.settings().salesDefaults.additionalRebateByDefault ?? true);

  /** Every car, grouped by brand for the column dropdowns. */
  carGroups = computed(() => {
    const vehicles = this.catalog.vehicles();
    return this.catalog.brands().map((brand) => ({ brand, vehicles: vehicles.filter((v) => v.brand === brand) }));
  });

  columns = computed<CompareColumn[]>(() => {
    const vehicles = this.catalog.vehicles();
    const setup = this.setup();
    const pricing = {
      defaults: this.settings.settings().salesDefaults,
      insuranceFor: (v: Vehicle) =>
        this.settings.getVehicleInsurance(v, v.basicPremium ?? basicPremiumDefault(v.price, this.settings.settings().salesDefaults.basicPremiumRatePct)),
    };
    return this.compare.slots().flatMap((slot, index) => {
      const vehicle = vehicles.find((v) => v.id === slot.vehicleId);
      if (!vehicle) return [];
      return [
        {
          index,
          vehicle,
          year: slot.year,
          years: vehicle.years.map((y) => y.year).sort((a, b) => b - a),
          fromQuote: !!slot.overrides,
          additionalRebate: additionalRebateForYear(vehicle, slot.year),
          includeAdditionalRebate: slot.includeAdditionalRebate ?? this.additionalByDefault(),
          quote: quoteForComparison(
            vehicle,
            slot.year,
            { ...setup, includeAdditionalRebate: slot.includeAdditionalRebate ?? this.additionalByDefault() },
            pricing,
            slot.overrides,
          ),
        },
      ];
    });
  });

  patch(p: Partial<CompareSetup>) {
    this.compare.setup.set({ ...this.setup(), ...p });
  }

  /** Switching % ↔ RM converts nothing — it starts each kind on a sensible value instead. */
  setDownpaymentType(type: CompareSetup['downpaymentType']) {
    if (type === this.setup().downpaymentType) return;
    const d = this.settings.settings().salesDefaults;
    this.patch({ downpaymentType: type, downpaymentValue: type === 'percent' ? d.downpaymentPct : 10_000 });
  }

  chooseCar(column: number, vehicleId: string | null) {
    const v = vehicleId ? this.catalog.vehicles().find((x) => x.id === vehicleId) : null;
    this.compare.setCar(Math.min(column, this.compare.slots().length), v?.id ?? null, v ? Math.max(...v.years.map((y) => y.year)) : 0);
  }

  openInCalculator(c: CompareColumn) {
    this.compare.openInCalculator(c.vehicle.id, c.year);
    this.router.navigateByUrl('/calculator');
  }

  saving = signal(false);
  saved = signal(false);

  /** Saves the comparison image to the device. */
  async save() {
    if (this.saving() || this.columns().length < 2) return;
    this.saving.set(true);
    try {
      downloadBlob(new Uint8Array(await (await this.renderImage()).arrayBuffer()), this.imageName(), 'image/png');
      this.settings.markQuoteShared();
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
    } finally {
      this.saving.set(false);
    }
  }

  private imageName(): string {
    return `Compare-${this.columns()
      .map((c) => c.vehicle.model)
      .join('-vs-')}.png`.replace(/[^\w.-]+/g, '-');
  }

  async share() {
    if (this.sharing() || this.columns().length < 2) return;
    this.sharing.set(true);
    this.shareNotice.set(false);
    try {
      const blob = await this.renderImage();
      const name = `Compare-${this.columns()
        .map((c) => c.vehicle.model)
        .join('-vs-')}.png`.replace(/[^\w.-]+/g, '-');
      const file = new File([blob], name, { type: 'image/png' });
      const nav = navigator as { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: translate(this.settings.whatsappLang(), 'Car comparison') });
        } catch {
          /* cancelled */
        }
      } else {
        downloadBlob(new Uint8Array(await blob.arrayBuffer()), name, 'image/png');
        this.shareNotice.set(true);
      }
      this.settings.markQuoteShared();
    } finally {
      this.sharing.set(false);
    }
  }

  private async renderImage(): Promise<Blob> {
    const lang = this.settings.settings().salesDefaults.posterLanguage ?? 'en';
    const T = (en: string, params?: Record<string, string | number>) => translate(lang, en, params);
    const s = this.setup();
    const dp = s.downpaymentType === 'percent' ? `${s.downpaymentValue}%` : `RM ${s.downpaymentValue.toLocaleString('en-MY')}`;
    const years = s.tenureMonths / 12;
    const setupLine = [T('{dp} downpayment', { dp }), T('{n} years', { n: years }), s.rateType === 'flat' ? T('Flat rate') : 'EIR'].join('  ·  ');
    const profile = this.advisor.profile();

    const canvas = document.createElement('canvas');
    await renderComparePoster(canvas, {
      lang,
      accent: this.settings.settings().salesDefaults.posterAccent,
      frame: this.settings.settings().salesDefaults.posterFrame,
      setupLine,
      tenureYears: years,
      cars: this.columns().map((c) => ({
        brand: c.vehicle.brand,
        title: modelVariantLabel(c.vehicle.model, c.vehicle.variant),
        year: c.year,
        photoUrl: c.vehicle.photoUrl,
        price: c.quote.price,
        rebate: c.quote.rebate,
        downpayment: c.quote.downpayment,
        loan: c.quote.loan,
        monthly: c.quote.monthly,
      })),
      advisor: { name: profile.name, role: profile.role, phone: profile.phoneDisplay, photoUrl: profile.photoUrl },
    });
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png'));
  }
}
