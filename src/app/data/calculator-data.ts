import { formatRM } from './dashboard-data';

export type Powertrain = 'ICE' | 'PHEV' | 'HEV' | 'BEV';

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  variant: string;
  /** Same brand/model/variant can exist as several rows, one per model year, each with its own
   *  price, rebate, and every other figure — clearance-year deals rarely match the current year's. */
  year: number;
  price: number;
  engine: string;
  seater: number;
  transmission: string;
  powertrain: Powertrain;
  drivetrain?: string;
  /** Vehicle-specific promo interest rate — overrides the SA's default when set. */
  interestRate?: number;
  /** Insurer's exact Basic Premium for this model — overrides the %-of-RRP estimate when set. */
  basicPremium?: number;
  /** Insurer's exact Additional Benefits (riders) total for this model. */
  addBenefits?: number;
  /** Model-specific dealer rebate — overrides DEFAULT_REBATE as the starting rebate when set. */
  rebate?: number;
  /** Model-specific additional rebate (e.g. a promo top-up) — pre-fills and enables Additional Rebate when set. */
  additionalRebate?: number;
};

/** Brand → model → variant catalog for the quotation calculator. */
export const VEHICLES: Vehicle[] = [
  { id: 'perodua-axia-se', brand: 'Perodua', model: 'Axia', variant: 'SE', year: 2026, price: 40200, engine: '1.0L', seater: 5, transmission: '4-Speed AT', powertrain: 'ICE' },
  { id: 'perodua-axia-av', brand: 'Perodua', model: 'Axia', variant: 'AV', year: 2026, price: 48200, engine: '1.0L', seater: 5, transmission: '4-Speed AT', powertrain: 'ICE' },
  { id: 'perodua-bezza-premium-x', brand: 'Perodua', model: 'Bezza', variant: '1.3 Premium X', year: 2026, price: 46800, engine: '1.3L', seater: 5, transmission: '4-Speed AT', powertrain: 'ICE' },
  { id: 'perodua-bezza-av', brand: 'Perodua', model: 'Bezza', variant: '1.3 AV', year: 2026, price: 52800, engine: '1.3L', seater: 5, transmission: '4-Speed AT', powertrain: 'ICE' },
  { id: 'perodua-myvi-x', brand: 'Perodua', model: 'Myvi', variant: '1.3 X', year: 2026, price: 54600, engine: '1.3L', seater: 5, transmission: 'D-CVT', powertrain: 'ICE' },
  { id: 'perodua-myvi-av', brand: 'Perodua', model: 'Myvi', variant: '1.5 AV', year: 2026, price: 58600, engine: '1.5L', seater: 5, transmission: 'D-CVT', powertrain: 'ICE' },
  { id: 'perodua-ativa-av', brand: 'Perodua', model: 'Ativa', variant: '1.0T AV', year: 2026, price: 65500, engine: '1.0L Turbo', seater: 5, transmission: 'D-CVT', powertrain: 'ICE' },
  { id: 'perodua-ativa-av-se', brand: 'Perodua', model: 'Ativa', variant: '1.0T AV SE', year: 2026, price: 68500, engine: '1.0L Turbo', seater: 5, transmission: 'D-CVT', powertrain: 'ICE' },

  { id: 'proton-saga-standard', brand: 'Proton', model: 'Saga', variant: 'Standard', year: 2026, price: 41500, engine: '1.3L', seater: 5, transmission: '4-Speed AT', powertrain: 'ICE' },
  { id: 'proton-saga-premium', brand: 'Proton', model: 'Saga', variant: 'Premium', year: 2026, price: 46500, engine: '1.3L', seater: 5, transmission: '4-Speed AT', powertrain: 'ICE' },
  { id: 'proton-s70-executive', brand: 'Proton', model: 'S70', variant: 'Executive', year: 2026, price: 78900, engine: '1.5L Turbo', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE' },
  { id: 'proton-s70-flagship', brand: 'Proton', model: 'S70', variant: 'Flagship', year: 2026, price: 92900, engine: '1.5L Turbo', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE' },
  { id: 'proton-x50-standard', brand: 'Proton', model: 'X50', variant: 'Standard', year: 2026, price: 79800, engine: '1.5L Turbo', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE' },
  { id: 'proton-x50-flagship', brand: 'Proton', model: 'X50', variant: 'Flagship', year: 2026, price: 103800, engine: '1.5L Turbo', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE' },
  { id: 'proton-x70-premium', brand: 'Proton', model: 'X70', variant: 'Premium', year: 2026, price: 108800, engine: '1.5L Turbo', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE' },
  { id: 'proton-x70-flagship-x', brand: 'Proton', model: 'X70', variant: 'Flagship X', year: 2026, price: 118000, engine: '1.5L Turbo', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE' },

  { id: 'toyota-vios-e', brand: 'Toyota', model: 'Vios', variant: 'E', year: 2026, price: 89500, engine: '1.5L', seater: 5, transmission: 'CVT', powertrain: 'ICE' },
  { id: 'toyota-vios-g', brand: 'Toyota', model: 'Vios', variant: 'G', year: 2026, price: 92500, engine: '1.5L', seater: 5, transmission: 'CVT', powertrain: 'ICE' },
  { id: 'toyota-corolla-1-8g', brand: 'Toyota', model: 'Corolla Altis', variant: '1.8G', year: 2026, price: 128500, engine: '1.8L', seater: 5, transmission: 'CVT', powertrain: 'ICE' },
  { id: 'toyota-corolla-1-8v', brand: 'Toyota', model: 'Corolla Altis', variant: '1.8V', year: 2026, price: 130500, engine: '1.8L', seater: 5, transmission: 'CVT', powertrain: 'ICE' },

  { id: 'honda-city-e', brand: 'Honda', model: 'City', variant: 'E', year: 2026, price: 105900, engine: '1.5L', seater: 5, transmission: 'CVT', powertrain: 'ICE' },
  { id: 'honda-city-rs', brand: 'Honda', model: 'City', variant: 'RS', year: 2026, price: 111500, engine: '1.5L', seater: 5, transmission: 'CVT', powertrain: 'ICE' },
  { id: 'honda-hrv-s', brand: 'Honda', model: 'HR-V', variant: 'e:HEV S', year: 2026, price: 128900, engine: '1.5L Hybrid', seater: 5, transmission: 'e-CVT', powertrain: 'HEV' },
  { id: 'honda-hrv-rs', brand: 'Honda', model: 'HR-V', variant: 'e:HEV RS', year: 2026, price: 148900, engine: '1.5L Hybrid', seater: 5, transmission: 'e-CVT', powertrain: 'HEV' },

  // Chery Malaysia lineup — synced from the dealer's own live pricing feed (chery-shared-data
  // .data-quotation.workers.dev), which also supplies the exact per-model Basic Premium,
  // Additional Benefits, and promo interest rate figures below. Tiggo 7 Pro and Tiggo 8 Pro
  // (ICE) are still sold alongside their PHEV siblings, not discontinued.
  { id: 'chery-tiggo-cross-turbo', brand: 'Chery', model: 'Tiggo Cross', variant: 'Turbo', year: 2026, price: 88800, engine: '1.5L Turbo', seater: 5, transmission: '6-Speed DCT', powertrain: 'ICE', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 2206.67, addBenefits: 620.5 },
  { id: 'chery-tiggo-cross-hev', brand: 'Chery', model: 'Tiggo Cross', variant: 'HEV CSH', year: 2026, price: 99800, engine: '1.5L Hybrid', seater: 5, transmission: 'DHT', powertrain: 'HEV', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 2435.47, addBenefits: 642.5 },
  { id: 'chery-o5-1-5t', brand: 'Chery', model: 'O5', variant: '1.5 Turbo', year: 2026, price: 116800, engine: '1.5L Turbo', seater: 5, transmission: '6-Speed DCT', powertrain: 'ICE', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 2789.07, addBenefits: 715.5 },
  { id: 'chery-tiggo7-pro', brand: 'Chery', model: 'Tiggo 7', variant: 'Pro', year: 2026, price: 123800, engine: '1.6L TGDi', seater: 5, transmission: '7-Speed DCT', powertrain: 'ICE', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 2934.67, addBenefits: 820.5 },
  { id: 'chery-tiggo7-phev', brand: 'Chery', model: 'Tiggo 7', variant: 'PHEV CSH', year: 2026, price: 129800, engine: '1.5L PHEV', seater: 5, transmission: 'DHT', powertrain: 'PHEV', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 3088.44, addBenefits: 832.5 },
  { id: 'chery-tiggo8-1-6t', brand: 'Chery', model: 'Tiggo 8', variant: '1.6 TGDi', year: 2026, price: 129800, engine: '1.6L TGDi', seater: 7, transmission: '7-Speed DCT', powertrain: 'ICE', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 3059.47, addBenefits: 832.5 },
  { id: 'chery-tiggo8-pro', brand: 'Chery', model: 'Tiggo 8', variant: 'Pro', year: 2026, price: 159800, engine: '2.0L TGDi', seater: 7, transmission: '7-Speed DCT', powertrain: 'ICE', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 3710.35, addBenefits: 892.5 },
  { id: 'chery-tiggo8-phev', brand: 'Chery', model: 'Tiggo 8', variant: 'PHEV CSH', year: 2026, price: 159800, engine: '1.5L PHEV', seater: 7, transmission: 'DHT', powertrain: 'PHEV', drivetrain: 'FWD', interestRate: 2.3, basicPremium: 3710.35, addBenefits: 892.5 },
  { id: 'chery-tiggo9-flexi', brand: 'Chery', model: 'Tiggo 9', variant: 'Flexi Package', year: 2026, price: 179800, engine: '2.0L TGDi', seater: 7, transmission: '7-Speed DCT', powertrain: 'ICE', drivetrain: 'AWD', interestRate: 2.3, basicPremium: 4126.35, addBenefits: 1192.5 },
  { id: 'chery-tiggo9-premium', brand: 'Chery', model: 'Tiggo 9', variant: 'Premium Package', year: 2026, price: 179800, engine: '2.0L TGDi', seater: 7, transmission: '7-Speed DCT', powertrain: 'ICE', drivetrain: 'AWD', interestRate: 2.3, basicPremium: 4126.35, addBenefits: 1192.5 },
  { id: 'chery-omoda-e5', brand: 'Chery', model: 'Omoda E5', variant: 'BEV', year: 2026, price: 146978, engine: '61 kWh Battery', seater: 5, transmission: 'Single-Speed EV', powertrain: 'BEV', drivetrain: 'FWD', interestRate: 2.1, basicPremium: 3731.1, addBenefits: 775.5 },
];

/** Factory-default catalog, snapshotted before any persisted overrides are applied below —
 *  kept only so a from-scratch reset is possible later; never mutated itself. */
export const DEFAULT_VEHICLES: Vehicle[] = VEHICLES.map((v) => ({ ...v }));

export const VEHICLE_CATALOG_STORAGE_KEY = 'redline-vehicle-catalog';

/** The car database (Account Settings → Car Database) is fully editable — cars and brands can be
 *  added, edited, and removed at runtime. VEHICLES is imported by name across the app, so instead
 *  of swapping the reference, any saved catalog is spliced into the same array in place, once, as
 *  soon as this module loads — every consumer sees the SA's own cars from their very first read. */
function loadSavedVehicleCatalog(): Vehicle[] | null {
  try {
    const raw = localStorage.getItem(VEHICLE_CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

const savedVehicleCatalog = loadSavedVehicleCatalog();
if (savedVehicleCatalog) {
  VEHICLES.length = 0;
  VEHICLES.push(...savedVehicleCatalog);
}

/** Unique models for a brand, in catalog order — used to drive cascading brand→model selects. */
export function modelsForBrand(brand: string): string[] {
  return Array.from(new Set(VEHICLES.filter((v) => v.brand === brand).map((v) => v.model)));
}

/** Unique variants for a brand+model, in catalog order — used to drive cascading model→variant
 *  selects. A variant can have several rows (one per model year), so this dedupes by name. */
export function variantsForModel(brand: string, model: string): string[] {
  return Array.from(new Set(VEHICLES.filter((v) => v.brand === brand && v.model === model).map((v) => v.variant)));
}

/** Every model year actually in the database for this exact brand/model/variant, newest first —
 *  never assumed or hardcoded, so a newly added "2027" row shows up on its own. Drives the
 *  Calculator's model-year switch: one year and there's nothing to switch, several and there is. */
export function yearsForVariant(brand: string, model: string, variant: string): number[] {
  return Array.from(new Set(VEHICLES.filter((v) => v.brand === brand && v.model === model && v.variant === variant).map((v) => v.year))).sort(
    (a, b) => b - a,
  );
}

/** One row per brand+model+variant, ignoring model year — the newest year stands in for the
 *  variant since spec/engine/brochure don't change year to year, only price/rebate do. For pages
 *  that browse the catalog itself (e.g. My Cars) rather than quote a specific model year. */
export function latestVehiclePerVariant(vehicles: Vehicle[] = VEHICLES): Vehicle[] {
  const byKey = new Map<string, Vehicle>();
  for (const v of vehicles) {
    const key = `${v.brand}::${v.model}::${v.variant}`;
    const existing = byKey.get(key);
    if (!existing || v.year > existing.year) byKey.set(key, v);
  }
  return Array.from(byKey.values());
}

export type ModelSummary = { key: string; brand: string; model: string; fromPrice: number };

/** Unique brand+model list with a starting price, derived from the variant catalog. */
export function modelSummaries(): ModelSummary[] {
  const byKey = new Map<string, ModelSummary>();
  for (const v of VEHICLES) {
    const key = `${v.brand}::${v.model}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { key, brand: v.brand, model: v.model, fromPrice: v.price });
    } else {
      existing.fromPrice = Math.min(existing.fromPrice, v.price);
    }
  }
  return Array.from(byKey.values());
}

export type NcdOption = { value: number; label: string };
export const NCD_OPTIONS: NcdOption[] = [
  { value: 0, label: '0% — No NCD' },
  { value: 25, label: '25% — Year 2' },
  { value: 30, label: '30% — Year 3' },
  { value: 38.33, label: '38.33% — Year 4' },
  { value: 45, label: '45% — Year 5' },
  { value: 55, label: '55% — Year 6+' },
];

export type TenureOption = { months: number; label: string };
export const TENURE_OPTIONS: TenureOption[] = [
  { months: 108, label: '9 Yrs' },
  { months: 84, label: '7 Yrs' },
  { months: 60, label: '5 Yrs' },
  { months: 36, label: '3 Yrs' },
];

/** General-purpose "what year is this customer's car" options (Customer Manager's Year Made
 *  field) — computed off today's date rather than hardcoded, so it never needs a manual bump.
 *  Unrelated to the Car Database's own per-car year rows; see yearsForVariant() for those. */
export const MODEL_YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1];
/** Standard dealer rebate a quote starts from, regardless of model — editable per quote from there. */
export const DEFAULT_REBATE = 3000;

export type DownpaymentType = 'percent' | 'amount';

// ---------- Insurance ----------

/** Fallback Basic Premium rate (% of RRP) used until an SA saves their own default to their profile. */
export const DEFAULT_INSURANCE_RATE_PCT = 3.6;

/** Auto-suggested Basic Premium — a simplified stand-in for the insurer's real rate table when the
 *  selected vehicle doesn't carry its own exact figure. */
export function basicPremiumDefault(rrp: number, ratePct: number): number {
  return Math.max(0, rrp * (ratePct / 100));
}

// ---------- Itemized insurance quotation — the official-style breakdown, saved per car in the Car
// Finance Database (or the Calculator's Insurance Breakdown), and the actual figure charged on a
// quote — Basic Premium, NCD, Premium All Rider, Additional Coverages, Stamp Duty, Service Tax,
// and EPR all count, not just Basic Premium. ----------

export type InsuranceCoverageItem = { label: string; amount: number };

export type InsuranceQuotationDetails = {
  basicPremium: number;
  premiumAllRider: number;
  additionalCoverages: InsuranceCoverageItem[];
  stampDuty: number;
  serviceTaxPct: number;
  /** Flat RM amount added on top of the total — e.g. EPR. */
  epr: number;
};

export type InsuranceQuotationBreakdown = InsuranceQuotationDetails & {
  ncdPct: number;
  ncdAmount: number;
  coveragesTotal: number;
  grossPremium: number;
  serviceTaxAmount: number;
  totalDue: number;
  /** Insurers round the final due amount to the nearest 50 sen. */
  totalRounded: number;
};

/** Malaysian motor policies: a flat RM10 stamp duty and 8% service tax, until the SA overrides them. */
export const DEFAULT_STAMP_DUTY = 10;
export const DEFAULT_SERVICE_TAX_PCT = 8;
export const DEFAULT_EPR = 94.24;

/** Starting itemized quotation for a car with no saved override yet — carries over the model's known
 *  Additional Benefits (e.g. Chery's live feed) as a single coverage line so totals stay consistent. */
export function defaultInsuranceQuotation(vehicle: Vehicle, fallbackBasicPremium: number): InsuranceQuotationDetails {
  return {
    basicPremium: vehicle.basicPremium ?? Math.round(fallbackBasicPremium * 100) / 100,
    premiumAllRider: 0,
    additionalCoverages: vehicle.addBenefits ? [{ label: 'Additional Benefits', amount: vehicle.addBenefits }] : [],
    stampDuty: DEFAULT_STAMP_DUTY,
    serviceTaxPct: DEFAULT_SERVICE_TAX_PCT,
    epr: DEFAULT_EPR,
  };
}

/** Expands a saved itemized quotation into the full labeled breakdown, at whatever NCD the quote is using. */
export function computeInsuranceBreakdown(details: InsuranceQuotationDetails, ncdPct: number): InsuranceQuotationBreakdown {
  const ncdAmount = details.basicPremium * (Math.max(0, ncdPct) / 100);
  const coveragesTotal = details.additionalCoverages.reduce((sum, c) => sum + c.amount, 0);
  const grossPremium = details.basicPremium - ncdAmount + details.premiumAllRider + coveragesTotal;
  const serviceTaxAmount = grossPremium * (details.serviceTaxPct / 100);
  const totalDue = grossPremium + details.stampDuty + serviceTaxAmount + details.epr;
  return {
    ...details,
    ncdPct,
    ncdAmount,
    coveragesTotal,
    grossPremium,
    serviceTaxAmount,
    totalDue,
    totalRounded: Math.round(totalDue * 2) / 2,
  };
}

export function downpaymentCashFor(
  basePrice: number,
  rebate: number,
  type: DownpaymentType,
  value: number,
  maxAmount: number,
): number {
  if (type === 'amount') return Math.max(0, Math.min(value, maxAmount));
  const pctAmount = (Math.max(0, value) / 100) * basePrice;
  return Math.max(0, pctAmount - rebate);
}

// ---------- Full quotation totals — shared by Calculator and Customer Manager so figures never drift ----------

export type QuotationTotalsInput = {
  basePrice: number;
  effectiveRebate: number;
  /** The full itemized insurance charge for this quote — see computeInsuranceBreakdown().totalDue. */
  insuranceAmount: number;
  downpaymentType: DownpaymentType;
  downpaymentValue: number;
};

export type QuotationTotals = {
  insuranceAmount: number;
  totalAmountDue: number;
  downpaymentCash: number;
  loanAmount: number;
};

/** Real money never has sub-cent fractions — floating-point arithmetic (percentages, repeated
 *  add/subtract) drifts past 2 decimals otherwise, e.g. 457.5835999999981 instead of 457.58. */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** OTR price after rebate, plus the full itemized insurance charge — the selling price shown to the customer. */
export function computeQuotationTotals(input: QuotationTotalsInput): QuotationTotals {
  const priceAfterRebate = Math.max(0, input.basePrice - input.effectiveRebate);
  const insuranceAmount = Math.max(0, input.insuranceAmount);
  const totalAmountDue = roundCents(priceAfterRebate + insuranceAmount);
  const rawDownpaymentCash = downpaymentCashFor(
    input.basePrice,
    input.effectiveRebate,
    input.downpaymentType,
    input.downpaymentValue,
    totalAmountDue,
  );
  const rawLoanAmount = Math.max(0, totalAmountDue - rawDownpaymentCash);
  // Banks disburse hire-purchase loans in RM100 increments, never more than what's owed — floor
  // to the nearest 100 and push whatever's left over into the downpayment, rounded to the cent.
  const loanAmount = Math.floor(rawLoanAmount / 100) * 100;
  const downpaymentCash = roundCents(Math.max(0, totalAmountDue - loanAmount));
  return { insuranceAmount, totalAmountDue, downpaymentCash, loanAmount };
}

/** Flat-rate hire-purchase style monthly instalment. */
export function monthlyFlat(principal: number, annualRatePct: number, months: number): number {
  const p = Math.max(principal, 0);
  const years = months / 12;
  const totalInterest = p * (Math.max(annualRatePct, 0) / 100) * years;
  return (p + totalInterest) / months;
}

/** Rough flat-rate → effective-rate conversion used to label the fixed rate. */
export function eirApprox(flatRatePct: number, months: number): number {
  if (months <= 0) return 0;
  return (2 * months * Math.max(flatRatePct, 0)) / (months + 1);
}

/** Not every model has more than one variant (e.g. Chery O5) — the SA can leave Variant blank or
 *  type "-" in the Car Database, and both mean "no variant" everywhere this is displayed. */
export function variantLabel(variant: string): string {
  const v = variant.trim();
  return v === '' || v === '-' ? '' : v;
}

/** Model and variant combined for display, e.g. "O5" alone or "Tiggo Cross Turbo" — skips the
 *  variant entirely instead of leaving a dangling space/dash when it's blank. */
export function modelVariantLabel(model: string, variant: string): string {
  const v = variantLabel(variant);
  return v ? `${model} ${v}` : model;
}

export { formatRM };
