import { computed, inject, signal } from '@angular/core';
import { SettingsService } from './settings.service';
import {
  VEHICLES,
  additionalRebateForYear,
  basicPremiumDefault,
  colourSurchargeFor,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  defaultRateFor,
  downpaymentDisplay,
  formatRM,
  loanForMonthlyPayment,
  minDownpaymentCash,
  modelVariantLabel,
  monthlyPayment,
  rebateForYear,
  roundCents,
  yearsForVariant,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';

/**
 * One loan quote: the car, rebates, insurance, rate, down payment, cash back and tenures, with
 * every figure derived from them. The Calculator and the Live page each create their own, so a
 * fix to the quote maths lands in both — no second copy of it anywhere.
 *
 * Not a singleton service: each page creates its own with `new QuoteEngine()` while it's being
 * built (inside Angular's injection context, which is what lets it inject settings). Settings
 * must be the first field — every starting value below reads from it.
 */
export class QuoteEngine {
  private settingsService = inject(SettingsService);

  /** The account's Primary Brand (Profile & Settings → Quote Preferences) starts every fresh quote — falls
   *  back to the catalog's first car if that brand has no vehicles. */
  private preferredVehicle(): Vehicle {
    const brand = this.settingsService.settings().dashboardTarget.brand;
    return VEHICLES.find((v) => v.brand === brand) ?? VEHICLES[0];
  }

  // ---------- Car ----------

  selectedBrand = signal(this.preferredVehicle().brand);
  selectedModelName = signal(this.preferredVehicle().model);
  selectedVariant = signal(this.preferredVehicle().variant);
  /** Not every car has factory colours hardcoded (see Vehicle.colours) — starts on the first one
   *  when it does, null otherwise, and resets the same way whenever the car changes (see
   *  onVariantChange). Purely a price input here — the poster still lists every option
   *  regardless of which one is picked (see PosterData.colours). */
  selectedColour = signal<string | null>(this.preferredVehicle().colours?.[0] ?? null);
  /** Read from the preferred car's own database row, never assumed — a car listed only under
   *  2025 starts on 2025, not "the current year." */
  modelYear = signal(Math.max(...this.preferredVehicle().years.map((y) => y.year)));

  modelsForBrand = computed(() => Array.from(new Set(VEHICLES.filter((v) => v.brand === this.selectedBrand()).map((v) => v.model))));

  /** Model + Variant combobox, grouped by model: e.g. "Tiggo Cross" heading over its "Turbo" /
   *  "Hybrid" variant rows, or a single self-titled row for a model with no variants (Chery O5). */
  carGroups = computed(() => {
    const brand = this.selectedBrand();
    return this.modelsForBrand().map((model) => ({
      model,
      items: Array.from(new Set(VEHICLES.filter((v) => v.brand === brand && v.model === model).map((v) => v.variant))).map((variant) => ({
        variant,
        label: modelVariantLabel(model, variant),
      })),
    }));
  });

  /** Every model year actually in the database for this exact brand/model/variant, newest first —
   *  never assumed, so a lone "2025" row shows only 2025 and a newly added "2027" row shows up on
   *  its own. Drives the Model Year switch: nothing to switch when there's only one. */
  availableYears = computed(() => yearsForVariant(this.selectedBrand(), this.selectedModelName(), this.selectedVariant()));

  /** One row per variant now (see Vehicle.years) — falls back to the catalog's first car if this
   *  exact brand/model/variant combination doesn't exist (e.g. mid-switch). */
  selectedVehicle = computed(
    () =>
      VEHICLES.find((v) => v.brand === this.selectedBrand() && v.model === this.selectedModelName() && v.variant === this.selectedVariant()) ??
      VEHICLES[0],
  );
  // Colour surcharges (e.g. the Omoda C9 lineup's Matte Grey) are shown as a note next to the
  // colour — both here and on the poster's "Available in:" list — but no longer added to the
  // price; a colour is purely cosmetic now, never something that changes what the customer pays.
  basePrice = computed(() => this.selectedVehicle().price);

  /** The Colour field only appears when this car actually has a surcharge to show a note for
   *  (currently just the Omoda C9 lineup) — every other car's colours are informational only
   *  (see the poster's "Available in:" list), so a picker there would be a dropdown that does
   *  nothing. Data-driven off Vehicle.colourSurcharges rather than a hardcoded model check, so a
   *  future colour note on another car enables this automatically. */
  colourPickable = computed(() => {
    const vehicle = this.selectedVehicle();
    return Object.keys(vehicle.colourSurcharges ?? {}).length > 0 ? (vehicle.colours ?? []) : null;
  });

  onBrandChange(brand: string) {
    this.selectedBrand.set(brand);
    const firstModel = VEHICLES.find((v) => v.brand === brand)!.model;
    this.onModelChange(firstModel);
  }

  onModelChange(model: string) {
    this.selectedModelName.set(model);
    const firstVariant = VEHICLES.find((v) => v.brand === this.selectedBrand() && v.model === model)!.variant;
    this.onVariantChange(firstVariant);
  }

  onVariantChange(variant: string) {
    this.selectedVariant.set(variant);
    // Prefer whatever year the SA was already looking at if this variant also has it (e.g.
    // switching between two 2025-and-2026 variants of the same model keeps the chosen year);
    // otherwise fall back to this variant's own newest year.
    const years = yearsForVariant(this.selectedBrand(), this.selectedModelName(), variant);
    if (!years.includes(this.modelYear())) this.modelYear.set(years[0]);
    // A different car has its own real insurance premium and promo rate — carrying over an
    // override from the previous car would silently misprice this one, so switching cars starts
    // fresh from its own database default / promo rate.
    this.insuranceOverride.set(null);
    this.interestRateManual.set(null);
    this.loanAmountDraft.set(null);
    this.monthlyInstallmentDraft.set(null);
    this.clearRebateOverrides();
    // A different car has its own colour lineup — carrying over the previous car's pick could
    // silently select a colour (and its surcharge) this car doesn't even offer.
    this.selectedColour.set(this.selectedVehicle().colours?.[0] ?? null);
  }

  /** Jumps straight to a car (e.g. a favourite, or one handed over from Compare), keeping its year if given. */
  selectCar(brand: string, model: string, variant: string, year?: number) {
    this.selectedBrand.set(brand);
    this.selectedModelName.set(model);
    this.onVariantChange(variant);
    if (year != null && this.availableYears().includes(year)) this.selectModelYear(year);
  }

  /** e.g. "Matte Grey (+RM 3,000)" — surfaces a colour's surcharge right in the dropdown so the SA
   *  sees the cost before picking it, not just after. */
  colourOptionLabel(colour: string): string {
    const surcharge = colourSurchargeFor(this.selectedVehicle(), colour);
    return surcharge > 0 ? `${colour} (+RM ${surcharge.toLocaleString('en-MY')})` : colour;
  }

  // ---------- Rebates ----------

  private rebateManual = signal<number | null>(null);
  private additionalRebateManual = signal<number | null>(null);
  private additionalRebateEnabledManual = signal<boolean | null>(null);

  /** The model's own dealer rebate for the selected model year, when known, beats the standard
   *  starting rebate. */
  autoRebate = computed(() => rebateForYear(this.selectedVehicle(), this.modelYear()));
  rebateIsManual = computed(() => this.rebateManual() !== null);
  rebateInput = computed(() => this.rebateManual() ?? this.autoRebate());

  /** The model's own additional-rebate promo for the selected model year, when known, pre-fills
   *  and enables this by default — independent of Rebate above, since either can differ year to
   *  year on its own. */
  autoAdditionalRebate = computed(() => additionalRebateForYear(this.selectedVehicle(), this.modelYear()));
  additionalRebateIsManual = computed(() => this.additionalRebateManual() !== null);
  additionalRebateValue = computed(() => this.additionalRebateManual() ?? this.autoAdditionalRebate());

  /** Ticked when the car has an additional rebate and Settings says to include it by default. */
  autoAdditionalRebateEnabled = computed(
    () =>
      additionalRebateForYear(this.selectedVehicle(), this.modelYear()) > 0 && (this.settingsService.settings().salesDefaults.additionalRebateByDefault ?? true),
  );
  additionalRebateEnabled = computed(() => this.additionalRebateEnabledManual() ?? this.autoAdditionalRebateEnabled());

  // No separate "prior-year bonus" — switching Model Year switches selectedVehicle() to that
  // year's own database row, so rebateInput() (via autoRebate) already reflects that year's figure.
  effectiveRebate = computed(() => this.rebateInput() + (this.additionalRebateEnabled() ? this.additionalRebateValue() : 0));

  /** Rebates belong to a specific car and model year — a figure typed for one must never ride
   *  along silently onto another (same reasoning as insurance/rate in onVariantChange). */
  private clearRebateOverrides() {
    this.rebateManual.set(null);
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
  }

  selectModelYear(year: number) {
    if (year === this.modelYear()) return;
    this.modelYear.set(year);
    this.clearRebateOverrides();
  }

  // Per-field "back to default" — tapping a Manual badge undoes just that one field.
  resetField(field: 'rebate' | 'additionalRebate' | 'insurance' | 'rate') {
    if (field === 'rebate') this.resetRebate();
    else if (field === 'additionalRebate') this.resetAdditionalRebate();
    else if (field === 'insurance') this.resetInsurance();
    else this.resetInterestRate();
  }

  resetRebate() {
    this.rebateManual.set(null);
  }

  resetAdditionalRebate() {
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
  }

  resetInsurance() {
    this.insuranceOverride.set(null);
  }

  resetInterestRate() {
    this.interestRateManual.set(null);
  }

  onRebateChange(value: number | null) {
    this.rebateManual.set(Math.max(0, value ?? 0));
  }

  onAdditionalRebateEnabledChange(value: boolean) {
    this.additionalRebateEnabledManual.set(value);
  }

  onAdditionalRebateChange(value: number | null) {
    this.additionalRebateManual.set(Math.max(0, value ?? 0));
  }

  // ---------- Insurance ----------

  ncd = signal(this.settingsService.settings().salesDefaults.ncd);

  /** Per-quotation insurance override — set only via the Insurance Breakdown modal or "Customer
   *  Arranges Own Insurance". Never written to the Car Finance Database, so one customer declining
   *  or self-arranging coverage never changes what the next customer for this same car sees. */
  private insuranceOverride = signal<InsuranceQuotationDetails | null>(null);

  insuranceRatePct = computed(() => this.settingsService.settings().salesDefaults.basicPremiumRatePct);
  /** The insurer's exact Basic Premium for this model, when known, beats the %-of-RRP estimate. */
  autoBasicPremium = computed(() => this.selectedVehicle().basicPremium ?? basicPremiumDefault(this.basePrice(), this.insuranceRatePct()));

  /** The car's saved itemized insurance quotation (Basic Premium, Premium All Rider, Additional
   *  Coverages, Stamp Duty, Service Tax, EPR) from the Car Finance Database — the starting point
   *  for every quote, editable from Account Settings → Car Database. */
  insuranceDatabaseDefault = computed(() => this.settingsService.getVehicleInsurance(this.selectedVehicle(), this.autoBasicPremium()));
  insuranceIsManual = computed(() => this.insuranceOverride() !== null);
  /** The details actually in effect for this quote — the per-quote override when the SA has set
   *  one, otherwise the car's database default. This is what gets snapshotted onto the lead. */
  insuranceDetails = computed(() => this.insuranceOverride() ?? this.insuranceDatabaseDefault());
  insuranceBreakdown = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), this.ncd()));
  /** The full itemized charge — everything the SA sees under Insurance Breakdown, not just Basic Premium. */
  insurance = computed(() => this.insuranceBreakdown().totalDue);
  /** Same insurance quotation at 0% NCD — what the loan is sized against, so dialling in a better
   *  NCD only shrinks the downpayment (see computeQuotationTotals's loanBasisInsuranceAmount). */
  loanBasisInsurance = computed(() => computeInsuranceBreakdown(this.insuranceDetails(), 0).totalDue);

  setInsuranceOverride(details: InsuranceQuotationDetails) {
    this.insuranceOverride.set(details);
  }

  // ---------- Interest rate ----------

  private interestRateManual = signal<number | null>(null);
  /** Rate Type — Flat or EIR (declining balance). Picked explicitly by the SA, never derived
   *  from the other: each uses its own instalment formula (see monthlyPayment()). Starts on the
   *  account's Default Rate Type (Account Settings → Quote Defaults). */
  rateType = signal<RateType>(this.settingsService.settings().salesDefaults.defaultRateType);

  /** The model's own promo rate for whichever Rate Type is active, when known, beats the SA's
   *  general default — flat and effective are independently-quoted figures on the vehicle (see
   *  Vehicle.effectiveRate), so switching rate type looks up the matching field, not a conversion. */
  autoInterestRate = computed(() => defaultRateFor(this.selectedVehicle(), this.rateType(), this.settingsService.settings().salesDefaults));
  interestRateIsManual = computed(() => this.interestRateManual() !== null);
  /** Quoting EIR on a car with no EIR anywhere (its own or the account default) and none typed —
   *  the SA must enter the bank's rate; sharing is blocked until they do (see the preview column). */
  rateMissing = computed(() => this.interestRateManual() === null && this.autoInterestRate() === null);
  interestRate = computed(() => this.interestRateManual() ?? this.autoInterestRate() ?? 0);

  onInterestRateChange(value: number | null) {
    this.interestRateManual.set(value == null ? null : Math.max(0, value));
  }

  /** Switching Rate Type drops any manual rate override — a flat-mode number typed in has no
   *  business surviving as an effective-mode number, so each type starts back at its own default. */
  setRateType(type: RateType) {
    this.rateType.set(type);
    this.interestRateManual.set(null);
  }

  // ---------- Down payment, cash back, totals ----------

  downpaymentType = signal<DownpaymentType>('percent');
  downpaymentValue = signal(this.settingsService.settings().salesDefaults.downpaymentPct);

  totals = computed(() =>
    computeQuotationTotals({
      basePrice: this.basePrice(),
      effectiveRebate: this.effectiveRebate(),
      insuranceAmount: this.insurance(),
      loanBasisInsuranceAmount: this.loanBasisInsurance(),
      downpaymentType: this.quoteDp().type,
      downpaymentValue: this.quoteDp().value,
      minDownpaymentCash: this.minDownpayment(),
      loanRounding: this.loanRounding(),
      cashbackAmount: this.cashbackAmount(),
    }),
  );
  /** The downpayment the quote actually uses — always a full loan while cash back is on. */
  quoteDp = computed(() =>
    this.cashbackOn() ? { type: 'amount' as const, value: 0 } : { type: this.downpaymentType(), value: this.downpaymentValue() },
  );
  /** "Give rebate as cash back" — this quote only, off by default, never offered on the customer link. */
  rebateAsCashback = signal(false);
  /** Settings → Allow cash back. */
  cashbackAllowed = computed(() => this.settingsService.settings().salesDefaults.allowCashback ?? false);
  /** Cash back is in effect only while ticked and still allowed in Settings. */
  cashbackOn = computed(() => this.cashbackAllowed() && this.rebateAsCashback());
  /** How much of the rebate goes back as cash; null = all of it. The rest stays a discount. */
  private cashbackManual = signal<number | null>(null);
  /** The most that can go back as cash: whatever the rebate has left after covering the car's
   *  minimum downpayment, so the customer still pays nothing upfront. 0 = cash back not possible. */
  cashbackMax = computed(() => Math.max(0, this.effectiveRebate() - this.minDownpayment()));
  cashbackAmount = computed(() => (this.cashbackOn() ? Math.min(this.cashbackMax(), this.cashbackManual() ?? this.cashbackMax()) : 0));
  /** Cash back is always a full loan — see quoteDp; the downpayment set before comes back once it's off. */
  setRebateAsCashback(on: boolean) {
    this.rebateAsCashback.set(on);
  }

  onCashbackAmountChange(value: number | null) {
    this.cashbackManual.set(Math.max(0, value ?? 0));
  }
  /** How much more a month the customer pays for taking the rebate as cash rather than a discount. */
  cashbackMonthlyIncrease = computed(() => {
    if (!this.cashbackOn()) return 0;
    const asDiscount = computeQuotationTotals({
      basePrice: this.basePrice(),
      effectiveRebate: this.effectiveRebate(),
      insuranceAmount: this.insurance(),
      loanBasisInsuranceAmount: this.loanBasisInsurance(),
      downpaymentType: 'amount',
      downpaymentValue: 0,
      minDownpaymentCash: this.minDownpayment(),
      loanRounding: this.loanRounding(),
    });
    const m = (loan: number) => monthlyPayment(loan, this.interestRate(), this.highlightedTenure(), this.rateType());
    return Math.max(0, m(this.loanAmount()) - m(asDiscount.loanAmount));
  });
  /** Settings → Loan Rounding: which way the loan rounds to RM100. */
  loanRounding = computed(() => this.settingsService.settings().salesDefaults.loanRounding ?? 'down');
  /** This variant's minimum cash downpayment (Price Settings), 0 when it has none. */
  minDownpayment = computed(() => minDownpaymentCash(this.selectedVehicle().minDownpayment, this.basePrice()));
  /** Cash the customer must still put down to meet the minimum — the minimum is before rebate, so
   *  the rebate counts towards it. */
  minCashNeeded = computed(() => roundCents(Math.max(0, this.minDownpayment() - this.effectiveRebate())));
  /** True when what was entered fell short of the minimum and the quote was raised to it. */
  downpaymentRaisedToMin = computed(() => {
    const min = this.minDownpayment();
    if (min <= 0 || this.totals().loanAmount === 0) return false;
    const unclamped = computeQuotationTotals({
      basePrice: this.basePrice(),
      effectiveRebate: this.effectiveRebate(),
      insuranceAmount: this.insurance(),
      loanBasisInsuranceAmount: this.loanBasisInsurance(),
      downpaymentType: this.quoteDp().type,
      downpaymentValue: this.quoteDp().value,
      loanRounding: this.loanRounding(),
      cashbackAmount: this.cashbackAmount(),
    });
    return unclamped.downpaymentCash < this.totals().downpaymentCash;
  });

  allInPrice = computed(() => this.totals().totalAmountDue);
  downpaymentCash = computed(() => this.totals().downpaymentCash);
  /** The downpayment as shown — Cash Back when rounding the loan up took it negative. */
  dpDisplay = computed(() => downpaymentDisplay(this.downpaymentCash()));
  loanAmount = computed(() => this.totals().loanAmount);
  /** A straight cash deal, no financing at all — e.g. downpayment dialled up to 100%. Poster
   *  templates that show a loan/monthly breakdown need to know this so they can drop it. */
  isCashPurchase = computed(() => this.loanAmount() === 0);

  // The Loan Amount field mustn't fight the SA mid-keystroke: since loanAmount() is always
  // floored to the nearest RM100, binding the input straight to it would snap "82400" back to
  // "82000" (or worse) after every digit typed, before they've finished. A draft signal holds
  // whatever's currently typed, unrounded, and only commits (floors + updates downpayment) on
  // blur/Enter — so the field shows exactly what was typed while editing.
  private loanAmountDraft = signal<number | null>(null);

  /** One-tap downpayment setups: 10% of the price, or Full Loan (no cash down beyond the RM100
   *  rounding remainder). */
  applyDownpaymentPreset(preset: 'tenPercent' | 'fullLoan') {
    this.loanAmountDraft.set(null);
    this.monthlyInstallmentDraft.set(null);
    if (preset === 'tenPercent') {
      this.downpaymentType.set('percent');
      this.downpaymentValue.set(10);
    } else {
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(this.minCashNeeded());
    }
  }

  isDownpaymentPreset(preset: 'tenPercent' | 'fullLoan'): boolean {
    const type = this.downpaymentType();
    if (preset === 'tenPercent') return type === 'percent' && this.downpaymentValue() === 10;
    return type === 'amount' && this.downpaymentValue() === this.minCashNeeded();
  }

  /** Unlike Loan Amount/Monthly Installment (which need a draft signal so the derived, rounded
   *  figure doesn't fight a mid-keystroke value — see loanAmountDraft above), Downpayment IS the
   *  primary value, so it can bind straight to the signal and update everything else live, no
   *  draft needed. But in Amt mode, whatever cash figure was typed is never exactly what ends up
   *  charged: the loan behind it is floored to the nearest RM100 (see totals()), and that rounding
   *  remainder spills back into the cash downpayment — same "remainder goes to the downpayment"
   *  rule the Loan Amount field's own helper text already describes. The poster and the Loan
   *  Amount field both reflect that real, spilled-over figure; settle the field to match once the
   *  SA is done typing, so it never sits there showing a number that was never actually charged. */
  commitDownpayment() {
    if (this.downpaymentType() === 'percent') {
      this.downpaymentValue.set(Math.min(Math.max(0, this.downpaymentValue()), 100));
    } else {
      this.downpaymentValue.set(this.totals().downpaymentCash);
    }
  }
  loanAmountDisplay = computed(() => this.loanAmountDraft() ?? this.loanAmount());

  /** Shown under Loan Amount / Monthly Installment when what was typed couldn't be honoured in
   *  full (asked for more than the whole amount due) — cleared as soon as they type again. */
  loanCapNote = signal<string | null>(null);
  monthlyCapNote = signal<string | null>(null);

  onLoanAmountInput(value: number | null) {
    this.loanCapNote.set(null);
    this.loanAmountDraft.set(Math.max(0, value ?? 0));
  }

  commitLoanAmount() {
    const draft = this.loanAmountDraft();
    if (draft !== null) {
      if (draft > this.allInPrice()) {
        this.loanCapNote.set(`Capped at ${formatRM(this.allInPrice())} — the loan can't be more than the total amount due.`);
      }
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - draft)));
      this.monthlyInstallmentDraft.set(null);
    }
    this.loanAmountDraft.set(null);
  }

  /** The percent-mode down payment before rebates, and how rebates bring it down — rebates come
   *  off the cash down payment (see computeQuotationTotals), so "10%" can end up far below 10%. */
  downpaymentRebateNote = computed(() => {
    if (this.downpaymentType() !== 'percent' || this.effectiveRebate() <= 0 || this.isCashPurchase()) return null;
    const referenceTotal = this.basePrice() + this.loanBasisInsurance();
    const before = roundCents((Math.max(0, this.downpaymentValue()) / 100) * referenceTotal);
    return { pct: this.downpaymentValue(), before, rebate: this.effectiveRebate(), after: this.downpaymentCash(), covered: this.effectiveRebate() >= before };
  });

  // ---------- Tenure and monthly ----------

  highlightedTenure = signal(Math.max(...this.settingsService.settings().salesDefaults.defaultTenureYears) * 12);
  /** Which 3 tenure years (of 1-9) populate the on-screen repayment table / quote poster. Picking
   *  a button also sets highlightedTenure to that year and drops out of custom mode; typing a
   *  custom month count does the reverse — see togglePosterYear() / onCustomTenureInput(). Starts
   *  on the account's Default Tenure Selection (Account Settings → Quote Defaults). */
  posterTenureYears = signal<number[]>([...this.settingsService.settings().salesDefaults.defaultTenureYears]);
  /** True only while the Custom Tenure input is the active source of highlightedTenure — the
   *  repayment table then shows just that one row instead of the 3 poster tenures. */
  customTenureActive = signal(false);

  /** Same draft/commit pattern as the Loan Amount field above — holds whatever's typed until
   *  blur/Enter, then works backwards from "I want to pay about RM X/month" to the loan amount
   *  that implies, and from there to the deposit. Targets the longest of the 3 selected poster
   *  tenures (e.g. 5/7/9 picked → 9 years) — that's the worst-case, highest-instalment row in the
   *  repayment table above, so aiming the deposit at it keeps every shorter tenure under budget
   *  too. Falls back to whatever's typed into Custom Tenure while that's active, since the table
   *  then shows only that one row instead of the poster set. */
  private monthlyInstallmentDraft = signal<number | null>(null);
  monthlyInstallmentTenureMonths = computed(() => (this.customTenureActive() ? this.highlightedTenure() : Math.max(...this.posterTenureYears()) * 12));
  monthlyInstallmentTenureLabel = computed(() => {
    const m = this.monthlyInstallmentTenureMonths();
    return m % 12 === 0 ? `${m / 12} Yrs` : `${m} mo`;
  });
  /** Once committed, shows the instalment the loan actually settled on — not necessarily what was
   *  typed, since the loan behind it is floored to the nearest RM100 (see commitMonthlyInstallment)
   *  the same way a manually-typed Loan Amount is. Closest achievable, not exact. */
  monthlyInstallmentDisplay = computed(
    () => this.monthlyInstallmentDraft() ?? roundCents(monthlyPayment(this.loanAmount(), this.interestRate(), this.monthlyInstallmentTenureMonths(), this.rateType())),
  );

  onMonthlyInstallmentInput(value: number | null) {
    this.monthlyCapNote.set(null);
    this.monthlyInstallmentDraft.set(Math.max(0, value ?? 0));
  }

  commitMonthlyInstallment() {
    const draft = this.monthlyInstallmentDraft();
    if (draft !== null) {
      const impliedLoan = loanForMonthlyPayment(draft, this.interestRate(), this.monthlyInstallmentTenureMonths(), this.rateType());
      if (impliedLoan > this.allInPrice()) {
        this.monthlyCapNote.set(`${formatRM(draft)}/mo would cover more than the whole car — the loan is capped at the total amount due.`);
      }
      this.downpaymentType.set('amount');
      this.downpaymentValue.set(roundCents(Math.max(0, this.allInPrice() - impliedLoan)));
      this.loanAmountDraft.set(null);
    }
    this.monthlyInstallmentDraft.set(null);
  }

  /** Monthly payment for an arbitrary tenure, at the current loan amount/rate — powers the Add
   *  Lead modal's Tenure question, independent of repaymentRows' poster/custom set. */
  monthlyForTenure(months: number): number {
    return monthlyPayment(this.loanAmount(), this.interestRate(), months, this.rateType());
  }

  /** Exclusive with custom mode: while typing a custom tenure, this is just that one row — pick a
   *  tenure button to go back to the 3-tenure comparison (longest-first). */
  repaymentRows = computed(() => {
    if (this.customTenureActive()) {
      const m = this.highlightedTenure();
      return [{ months: m, label: this.selectedTenureLabel(), monthly: monthlyPayment(this.loanAmount(), this.interestRate(), m, this.rateType()) }];
    }
    const months = [...this.posterTenureYears()].sort((a, b) => b - a).map((y) => y * 12);
    return months.map((m) => ({ months: m, label: `${m / 12} Yrs`, monthly: monthlyPayment(this.loanAmount(), this.interestRate(), m, this.rateType()) }));
  });

  /** The tenure actually chosen (a preset or a custom month count) — what the PDF/quotation quote on. */
  selectedTenureLabel = computed(() => (this.highlightedTenure() % 12 === 0 ? `${this.highlightedTenure() / 12} Yrs` : `${this.highlightedTenure()} mo`));
  selectedTenureMonthly = computed(() => monthlyPayment(this.loanAmount(), this.interestRate(), this.highlightedTenure(), this.rateType()));

  posterTenureSummary = computed(() => [...this.posterTenureYears()].sort((a, b) => b - a).join(' · '));

  onCustomTenureInput(value: number) {
    this.highlightedTenure.set(Math.min(120, Math.max(1, Math.round(+value || 1))));
    this.customTenureActive.set(true);
  }

  /** Confirms which tenure Add Lead/the PDF quote on — click a row in the repayment table. */
  selectRepaymentTenure(months: number) {
    this.highlightedTenure.set(months);
    this.customTenureActive.set(false);
  }

  /** Keeps the poster selection at exactly 3 years: toggles off if already picked (min 1 stays
   *  selected), otherwise adds, replacing the oldest pick once 3 are already chosen. Purely
   *  changes which years are shown — it never confirms a tenure on its own (see
   *  selectRepaymentTenure) — except when the confirmed one just scrolled out of view (or was in
   *  custom mode), where it falls back to the new longest pick so a row is always shown Selected. */
  togglePosterYear(year: number) {
    const current = this.posterTenureYears();
    let next = current;
    if (current.includes(year)) {
      if (current.length > 1) next = current.filter((y) => y !== year);
    } else if (current.length < 3) {
      next = [...current, year];
    } else {
      next = [...current.slice(1), year];
    }
    this.posterTenureYears.set(next);
    if (this.customTenureActive() || !next.includes(this.highlightedTenure() / 12)) {
      this.customTenureActive.set(false);
      this.highlightedTenure.set(Math.max(...next) * 12);
    }
  }

  /** Back to the account's defaults for every figure — the car stays as it is (the Calculator's Reset). */
  reset() {
    const defaults = this.settingsService.settings().salesDefaults;
    this.rebateManual.set(null);
    this.additionalRebateManual.set(null);
    this.additionalRebateEnabledManual.set(null);
    this.ncd.set(defaults.ncd);
    this.interestRateManual.set(null);
    this.rateType.set(defaults.defaultRateType);
    this.downpaymentType.set('percent');
    this.downpaymentValue.set(defaults.downpaymentPct);
    this.highlightedTenure.set(Math.max(...defaults.defaultTenureYears) * 12);
    this.posterTenureYears.set([...defaults.defaultTenureYears]);
    this.customTenureActive.set(false);
    this.insuranceOverride.set(null);
    this.loanAmountDraft.set(null);
    this.monthlyInstallmentDraft.set(null);
    this.rebateAsCashback.set(false);
    this.cashbackManual.set(null);
  }
}
