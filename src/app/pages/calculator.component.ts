

import { AfterViewInit, Component, computed, effect, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CompareService } from '../shared/compare.service';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import { brandLogo } from '../data/dashboard-data';
import {
  NCD_OPTIONS,
  VEHICLES,
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
  additionalRebateForYear,
  rebateForYear,
  roundCents,
  vehicleTitle,
  yearsForVariant,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';
import { downloadBlob } from '../shared/pdf-writer';
import { posterFontsReady } from '../shared/poster-theme';
import { classicTemplate } from '../shared/poster-template-classic';
import { compactMyTemplate } from '../shared/poster-template-my';
import { promoTemplate, squareTemplate } from '../shared/poster-template-social';
import type { PosterData } from '../shared/poster-data';
import { quotePosterData } from '../shared/quote-poster-data';
import type { PosterTemplate, PosterTemplateId } from '../shared/poster-templates';
import { TranslatePipe } from '../shared/i18n';
import { QuoteEngine } from '../shared/quote-engine';
import { QuoteControlsComponent } from '../shared/quote-controls.component';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, QuoteControlsComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6">
      <!-- Mobile Preview/Customize switcher -->
      <div class="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-col gap-2 border-b border-border bg-background px-4 pb-2 pt-4 md:-top-6 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 xl:hidden">
        <!-- Live monthly (same as the customer link), so changes on Customize show without switching to Preview -->
        <div class="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
          @if (isCashPurchase()) {
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ "Selling price" | t }}</span>
            <span class="text-sm font-bold tabular">{{ fmt2(allInPrice()) }}</span>
          } @else {
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Monthly · {{ selectedTenureLabel() }}</span>
            <span class="text-sm font-bold tabular" [ngClass]="rateMissing() ? 'text-[var(--warning)]' : 'text-primary'">
              {{ rateMissing() ? ('Rate needed' | t) : fmt2(selectedTenureMonthly()) }}
            </span>
          }
        </div>
        <div role="tablist" [attr.aria-label]="'Quote view' | t" class="flex rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mobileTab() === 'preview'"
            (click)="mobileTab.set('preview')"
            class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="mobileTab() === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
          >
            {{ "Preview" | t }}
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mobileTab() === 'customize'"
            (click)="mobileTab.set('customize')"
            class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="mobileTab() === 'customize' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
          >
            {{ "Customize" | t }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <!-- Quote preview — no internal scroll cap, same as the Brochures offer sheet preview: the
             poster is a fixed shape, so it just renders at its natural height and the page scrolls
             as a whole instead of a scrollbar sitting on the preview column itself. -->
        <div
          class="flex-col gap-2 xl:sticky xl:top-0 xl:col-span-2 xl:flex"
          [ngClass]="mobileTab() === 'preview' ? 'flex' : 'hidden'"
        >
          @if (availableTemplates().length > 1) {
            <div role="radiogroup" [attr.aria-label]="'Poster template' | t" class="flex w-full shrink-0 gap-1.5 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1.5">
              @for (t of availableTemplates(); track t.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="selectedTemplateId() === t.id"
                  (click)="selectedTemplateId.set(t.id)"
                  class="flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-center transition-colors"
                  [ngClass]="selectedTemplateId() === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                >
                  {{ t.label | t }}
                </button>
              }
            </div>
          }
          <div class="relative mx-auto w-full shrink-0 overflow-hidden rounded-xl shadow-md" [ngClass]="previewWidthClass()">
            <canvas #posterCanvas class="block w-full h-auto" [class.blur-sm]="rateMissing()"></canvas>
            @if (rateMissing()) {
              <!-- The poster would otherwise show a 0% EIR and an instalment that isn't real -->
              <div class="absolute inset-0 flex items-center justify-center bg-black/55 p-6">
                <div class="flex max-w-xs flex-col items-center gap-2 rounded-xl bg-card px-5 py-4 text-center shadow-xl">
                  <app-icon name="alert-triangle" [size]="20" class="text-[var(--warning)]" />
                  <span class="text-sm font-bold">{{ "EIR needed" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Enter the bank's effective rate under Interest Rate to finish this quote." | t }}</span>
                </div>
              </div>
            }
          </div>

          @if (rateMissing()) {
            <div class="flex items-start gap-2.5 rounded-lg bg-[var(--warning)]/12 px-4 py-3 text-sm text-foreground">
              <app-icon name="alert-triangle" [size]="16" class="mt-0.5 shrink-0 text-[var(--warning)]" />
              <span class="flex-1">
                {{ "No EIR is set for this car — enter the bank's effective rate under" | t }} <strong>{{ "Interest Rate" | t }}</strong> {{ "before sharing. The monthly figures above aren't real until you do." | t }}
              </span>
            </div>
          }

          @if (posterShareFallbackNotice()) {
            <div class="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/8 px-4 py-2.5 text-sm">
              <app-icon name="download" [size]="14" class="shrink-0" />
              {{ "Your browser can't hand files to WhatsApp directly — quote downloaded. Attach it in WhatsApp Desktop/Web." | t }}
            </div>
          }

          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              (click)="savePosterImage()"
              [disabled]="savingPoster() || rateMissing()"
              class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon [name]="posterSaved() ? 'check' : 'download'" [size]="15" />
              {{ savingPoster() ? ('Saving…' | t) : posterSaved() ? ('Saved!' | t) : ('Save' | t) }}
            </button>
            <button
              type="button"
              (click)="sharePosterImage()"
              [disabled]="sharingPoster() || rateMissing()"
              class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              <app-icon name="share" [size]="15" />
              {{ sharingPoster() ? ('Sharing…' | t) : ('Share' | t) }}
            </button>
          </div>

          <p class="flex shrink-0 items-center justify-center gap-1.5 text-center text-[10px] leading-relaxed text-muted-foreground">
            <app-icon name="info" [size]="12" class="shrink-0" />
            {{ "Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here." | t }}
          </p>
        </div>

        <!-- Customize quote -->
        <div
          class="flex-col gap-4 xl:sticky xl:top-0 xl:col-span-1 xl:flex xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1"
          [ngClass]="mobileTab() === 'customize' ? 'flex' : 'hidden'"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-none">{{ "Customize Quote" | t }}</h3>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="reset()"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <app-icon name="refresh-cw" [size]="13" />
                {{ "Reset" | t }}
              </button>
            </div>
          </div>

          <app-quote-controls [q]="q" [showCompare]="true" (compare)="compareWithOthers()" />
        </div>
      </div>
    </div>


  `,
})
export class CalculatorComponent implements AfterViewInit {
  @ViewChild('posterCanvas') posterCanvasRef?: ElementRef<HTMLCanvasElement>;
  savingPoster = signal(false);
  /** Brief "Saved!" confirmation on the button after the image is downloaded. */
  posterSaved = signal(false);
  /** Set once fonts.google.com's Barlow Semi Condensed + Inter are ready to paint — the draw
   *  effect waits on this so the very first frame never falls back to a system font. */
  private fontsReady = signal(false);

  fmt = (v: number) => formatRM(v);
  /** Always shows exactly 2 decimals (even .00) plus thousands separators, matching the Total Due
   *  line in Insurance Breakdown — formatRM's toLocaleString would otherwise drop cents on whole
   *  numbers and show up to 3 fraction digits on others. Used throughout the Quote Preview. */
  fmt2 = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  modelVariantLabel = modelVariantLabel;
  vehicleTitle = vehicleTitle;
  roundCents = roundCents;

  private settingsService = inject(SettingsService);
  private compare = inject(CompareService);
  private router = inject(Router);

  /** Opens the Compare page with this car as the first column, carrying this quote's own rebate,
   *  insurance and rate (plus its loan setup) so its figures match what the customer was just told. */
  compareWithOthers() {
    const v = this.selectedVehicle();
    this.compare.startFromQuote(
      {
        vehicleId: v.id,
        year: this.modelYear(),
        includeAdditionalRebate: this.additionalRebateEnabled(),
        overrides: {
          rebate: this.rebateInput(),
          additionalRebate: this.additionalRebateValue(),
          insuranceDetails: this.insuranceDetails(),
          rate: this.rateMissing() ? undefined : { type: this.rateType(), value: this.interestRate() },
        },
      },
      {
        downpaymentType: this.downpaymentType(),
        downpaymentValue: this.downpaymentValue(),
        tenureMonths: this.highlightedTenure(),
        rateType: this.rateType(),
        ncd: this.ncd(),
      },
    );
    this.router.navigateByUrl('/compare');
  }

  /** The quote itself — car, rebates, insurance, rate, down payment, cash back, tenures and every
   *  figure derived from them. Shared with the Live page (see QuoteEngine); the names below keep
   *  this page's template unchanged. */
  readonly q = new QuoteEngine();

  // ---------- Screen-only state (not part of the quote) ----------

  mobileTab = signal<'preview' | 'customize'>('preview');

  // ---------- The quote (from QuoteEngine) ----------

  selectedBrand = this.q.selectedBrand;
  selectedModelName = this.q.selectedModelName;
  selectedVariant = this.q.selectedVariant;
  selectedColour = this.q.selectedColour;
  modelYear = this.q.modelYear;
  modelsForBrand = this.q.modelsForBrand;
  carGroups = this.q.carGroups;
  availableYears = this.q.availableYears;
  selectedVehicle = this.q.selectedVehicle;
  basePrice = this.q.basePrice;
  colourPickable = this.q.colourPickable;
  onBrandChange = this.q.onBrandChange.bind(this.q);
  onModelChange = this.q.onModelChange.bind(this.q);
  onVariantChange = this.q.onVariantChange.bind(this.q);
  colourOptionLabel = this.q.colourOptionLabel.bind(this.q);

  autoRebate = this.q.autoRebate;
  rebateIsManual = this.q.rebateIsManual;
  rebateInput = this.q.rebateInput;
  autoAdditionalRebate = this.q.autoAdditionalRebate;
  additionalRebateIsManual = this.q.additionalRebateIsManual;
  additionalRebateValue = this.q.additionalRebateValue;
  autoAdditionalRebateEnabled = this.q.autoAdditionalRebateEnabled;
  additionalRebateEnabled = this.q.additionalRebateEnabled;
  effectiveRebate = this.q.effectiveRebate;
  selectModelYear = this.q.selectModelYear.bind(this.q);
  resetField = this.q.resetField.bind(this.q);
  resetRebate = this.q.resetRebate.bind(this.q);
  resetAdditionalRebate = this.q.resetAdditionalRebate.bind(this.q);
  resetInsurance = this.q.resetInsurance.bind(this.q);
  resetInterestRate = this.q.resetInterestRate.bind(this.q);
  onRebateChange = this.q.onRebateChange.bind(this.q);
  onAdditionalRebateEnabledChange = this.q.onAdditionalRebateEnabledChange.bind(this.q);
  onAdditionalRebateChange = this.q.onAdditionalRebateChange.bind(this.q);

  ncd = this.q.ncd;
  insuranceRatePct = this.q.insuranceRatePct;
  autoBasicPremium = this.q.autoBasicPremium;
  insuranceDatabaseDefault = this.q.insuranceDatabaseDefault;
  insuranceIsManual = this.q.insuranceIsManual;
  insuranceDetails = this.q.insuranceDetails;
  insuranceBreakdown = this.q.insuranceBreakdown;
  insurance = this.q.insurance;
  loanBasisInsurance = this.q.loanBasisInsurance;

  rateType = this.q.rateType;
  autoInterestRate = this.q.autoInterestRate;
  interestRateIsManual = this.q.interestRateIsManual;
  rateMissing = this.q.rateMissing;
  interestRate = this.q.interestRate;
  onInterestRateChange = this.q.onInterestRateChange.bind(this.q);
  setRateType = this.q.setRateType.bind(this.q);

  downpaymentType = this.q.downpaymentType;
  downpaymentValue = this.q.downpaymentValue;
  totals = this.q.totals;
  quoteDp = this.q.quoteDp;
  rebateAsCashback = this.q.rebateAsCashback;
  cashbackAllowed = this.q.cashbackAllowed;
  cashbackOn = this.q.cashbackOn;
  cashbackMax = this.q.cashbackMax;
  cashbackAmount = this.q.cashbackAmount;
  setRebateAsCashback = this.q.setRebateAsCashback.bind(this.q);
  onCashbackAmountChange = this.q.onCashbackAmountChange.bind(this.q);
  cashbackMonthlyIncrease = this.q.cashbackMonthlyIncrease;
  loanRounding = this.q.loanRounding;
  minDownpayment = this.q.minDownpayment;
  minCashNeeded = this.q.minCashNeeded;
  downpaymentRaisedToMin = this.q.downpaymentRaisedToMin;
  allInPrice = this.q.allInPrice;
  downpaymentCash = this.q.downpaymentCash;
  dpDisplay = this.q.dpDisplay;
  loanAmount = this.q.loanAmount;
  isCashPurchase = this.q.isCashPurchase;
  applyDownpaymentPreset = this.q.applyDownpaymentPreset.bind(this.q);
  isDownpaymentPreset = this.q.isDownpaymentPreset.bind(this.q);
  commitDownpayment = this.q.commitDownpayment.bind(this.q);
  loanAmountDisplay = this.q.loanAmountDisplay;
  loanCapNote = this.q.loanCapNote;
  monthlyCapNote = this.q.monthlyCapNote;
  onLoanAmountInput = this.q.onLoanAmountInput.bind(this.q);
  commitLoanAmount = this.q.commitLoanAmount.bind(this.q);
  downpaymentRebateNote = this.q.downpaymentRebateNote;

  highlightedTenure = this.q.highlightedTenure;
  posterTenureYears = this.q.posterTenureYears;
  customTenureActive = this.q.customTenureActive;
  monthlyInstallmentTenureMonths = this.q.monthlyInstallmentTenureMonths;
  monthlyInstallmentTenureLabel = this.q.monthlyInstallmentTenureLabel;
  monthlyInstallmentDisplay = this.q.monthlyInstallmentDisplay;
  onMonthlyInstallmentInput = this.q.onMonthlyInstallmentInput.bind(this.q);
  commitMonthlyInstallment = this.q.commitMonthlyInstallment.bind(this.q);
  monthlyForTenure = this.q.monthlyForTenure.bind(this.q);
  repaymentRows = this.q.repaymentRows;
  selectedTenureLabel = this.q.selectedTenureLabel;
  selectedTenureMonthly = this.q.selectedTenureMonthly;
  posterTenureSummary = this.q.posterTenureSummary;
  onCustomTenureInput = this.q.onCustomTenureInput.bind(this.q);
  selectRepaymentTenure = this.q.selectRepaymentTenure.bind(this.q);
  togglePosterYear = this.q.togglePosterYear.bind(this.q);

  brandLogoUrl = computed(() => brandLogo(this.selectedVehicle().brand));

  quoteDate = computed(() => new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }));


  constructor(
    public advisor: AdvisorService,
  ) {
    // "Open in Calculator" from the Compare page — start on that car instead of the primary brand's.
    const fromCompare = this.compare.takeCalculatorCar();
    const handed = fromCompare && VEHICLES.find((v) => v.id === fromCompare.vehicleId);
    if (handed) {
      this.selectedBrand.set(handed.brand);
      this.selectedModelName.set(handed.model);
      this.onVariantChange(handed.variant);
      if (handed.years.some((y) => y.year === fromCompare.year)) this.modelYear.set(fromCompare.year);
    }

    posterFontsReady().then(() => this.fontsReady.set(true));

    // Redraws the poster canvas whenever the data behind it, or the chosen template, changes.
    effect(() => {
      if (!this.fontsReady()) return;
      this.selectedTemplateId(); // tracked so switching templates alone triggers a redraw
      const data = this.buildPosterData();
      this.drawPoster(data);
    });

  }

  /** Every poster design the Quote Preview can render — all consuming the same PosterData, so
   *  adding one is purely a new layout/renderer pair (see poster-templates.ts), never a change to
   *  how data is gathered above. */
  readonly templates: PosterTemplate[] = [classicTemplate, compactMyTemplate, squareTemplate, promoTemplate];
  /** The compact MY template's entire design is a monthly-payment figure — there's no sensible
   *  cash-buyer version of a poster whose headline is a monthly instalment, so it drops out of the
   *  picker entirely for a cash deal rather than needing its own cash layout. */
  availableTemplates = computed(() => {
    const data = this.buildPosterData();
    return this.templates.filter((t) => !(this.isCashPurchase() && t.id === 'compact-my') && (t.isAvailable?.(data) ?? true));
  });
  selectedTemplateId = signal<PosterTemplateId>('classic');
  currentTemplate = computed(() => this.availableTemplates().find((t) => t.id === this.selectedTemplateId()) ?? this.availableTemplates()[0]);
  /** Caps the preview's width for the social shapes, which would otherwise stretch to the full column. */
  previewWidthClass = computed(() => {
    switch (this.currentTemplate().aspect) {
      case 'square':
        return 'max-w-[520px]';
      case 'promo':
        return 'max-w-[440px]';
      default:
        return '';
    }
  });

  /** Assembles the plain data object the renderer draws from — nothing in poster-renderer.ts
   *  reads a component signal directly, so every figure on the poster traces back to here. */
  private buildPosterData(): PosterData {
    const defaults = this.settingsService.settings().salesDefaults;
    return quotePosterData(this.q, this.advisor, defaults.posterLanguage ?? 'en', defaults.posterAccent);
  }

  /** Bumped on every draw call so an in-flight async redraw (image loads for the logo/car photo)
   *  never paints over the canvas after a newer redraw has already started — the last call to
   *  drawPoster() always wins. */
  private drawGeneration = 0;

  /** Live preview only — kept cheap and fixed at the spec's own 2x, since the on-screen canvas is
   *  shown at its full native ~900px design width (see the template's own-scroll preview column)
   *  rather than shrunk to fit a screen, so there's no HiDPI stretching to compensate for here.
   *  downloadPoster() renders its own higher-resolution copy separately — see renderPosterForExport
   *  — so preview quality and download quality are free to differ. */
  private static readonly PREVIEW_SCALE = 2;

  private async drawPoster(data: PosterData) {
    const canvas = this.posterCanvasRef?.nativeElement;
    if (!canvas) return;
    const generation = ++this.drawGeneration;
    await this.currentTemplate().render(canvas, data, CalculatorComponent.PREVIEW_SCALE, () => generation !== this.drawGeneration);
  }

  ngAfterViewInit() {
    if (this.fontsReady()) this.drawPoster(this.buildPosterData());
  }

  /** Download quality is independent of preview quality — a dedicated (never-visible) canvas
   *  rendered fresh at 4x the design grid (900px design → 3600px output), well above the
   *  on-screen preview's 2x. Text, price figures, and every other vector/canvas-drawn element
   *  redraw natively at this resolution, so raising this constant genuinely sharpens the whole
   *  poster — it isn't just "the same blurry image, bigger". The one exception is the car photo
   *  itself: several source images in public/cars (notably the Proton lineup, ~640px wide) don't
   *  have enough real detail to stay crisp once stretched to fill their spot on the poster, and no
   *  export scale can fix that — only higher-resolution source photos can. */
  private static readonly EXPORT_SCALE = 4;

  private async renderPosterForExport(data: PosterData): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    // A fresh, never-visible canvas with no concurrent redraw risk — isStale can just say "never".
    await this.currentTemplate().render(canvas, data, CalculatorComponent.EXPORT_SCALE, () => false);
    return canvas;
  }

  /** Renders its own high-resolution copy of the poster rather than exporting whatever the
   *  on-screen preview happens to be showing — see renderPosterForExport. PNG rather than JPEG:
   *  the Clipboard API only reliably accepts image/png across browsers, and using the same format
   *  for the download fallback keeps this one render path shared between both. */
  private async renderPosterPngBlob(): Promise<Blob> {
    const canvas = await this.renderPosterForExport(this.buildPosterData());
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });
  }

  private posterFileName(): string {
    const v = this.selectedVehicle();
    const t = this.currentTemplate();
    const suffix = t.aspect ? `-${t.label}` : '';
    return `Quote-${vehicleTitle(v.brand, v.model)}${suffix}.png`.replace(/\s*\|\s*/g, '-').replace(/\s+/g, '-');
  }

  private async downloadPosterBlob(blob: Blob): Promise<void> {
    downloadBlob(new Uint8Array(await blob.arrayBuffer()), this.posterFileName(), 'image/png');
  }

  private canShareFile(file: File): boolean {
    return !!(navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare?.({ files: [file] });
  }

  /** Saves the poster as a PNG to the device (Downloads, or the Photos/Files prompt on phones). */
  async savePosterImage() {
    if (this.savingPoster()) return;
    this.savingPoster.set(true);
    this.settingsService.markQuoteShared();
    try {
      await this.downloadPosterBlob(await this.renderPosterPngBlob());
      this.posterSaved.set(true);
      setTimeout(() => this.posterSaved.set(false), 2000);
    } catch {
      /* rendering failed — nothing to save */
    } finally {
      this.savingPoster.set(false);
    }
  }

  sharingPoster = signal(false);
  /** Shown only when the OS share sheet isn't available at all and the poster was downloaded as
   *  a plain fallback instead — same pattern as the Brochures page's file-share fallback. */
  posterShareFallbackNotice = signal(false);

  /** Hands the rendered poster PNG straight to the OS share sheet — same file-share pattern the
   *  Brochures page uses for its brochure PDFs, just a PNG instead of a PDF since the poster is a
   *  single rendered image, not a multi-page document. Reaches WhatsApp, Telegram, email, etc.
   *  directly, no manual save-then-attach round trip. Falls back to a plain download only when
   *  file sharing isn't supported at all; a cancelled or failed share attempt is left alone rather
   *  than forced into a download, matching sendBrochureFile's own behaviour. */
  async sharePosterImage() {
    if (this.sharingPoster()) return;
    this.sharingPoster.set(true);
    this.settingsService.markQuoteShared();
    try {
      const blob = await this.renderPosterPngBlob();
      const file = new File([blob], this.posterFileName(), { type: 'image/png' });
      if (this.canShareFile(file)) {
        const advisorProfile = this.advisor.profile();
        try {
          await navigator.share({ files: [file], title: 'Vehicle Quote', text: `${advisorProfile.name}, ${advisorProfile.role}` });
        } catch {
          /* cancelled or failed — nothing actionable here, same as the brochure share */
        }
        return;
      }
      await this.downloadPosterBlob(blob);
      this.posterShareFallbackNotice.set(true);
      setTimeout(() => this.posterShareFallbackNotice.set(false), 5000);
    } finally {
      this.sharingPoster.set(false);
    }
  }

  /** Resets every quote setting (rebate, insurance, rate, downpayment, tenure) back to this
   *  car's own defaults — leaves the selected brand/model/variant/year untouched, since switching
   *  cars is its own separate action, not something "Reset" should also do. */
  reset() {
    this.q.reset();
  }
}
