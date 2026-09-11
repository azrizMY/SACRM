import { formatRM } from './dashboard-data';

export type VehicleYear = {
  year: number;
  /** This model year's dealer rebate — not every car has one, so a year with none set is treated
   *  as RM 0 rebate, never a fallback nonzero amount (see rebateForYear()). */
  rebate?: number;
  /** This model year's additional rebate (e.g. a promo top-up) — pre-fills and enables Additional
   *  Rebate when set. Rebate and Additional Rebate can each differ independently year to year
   *  (e.g. clearance stock might get a bigger base rebate but no extra promo top-up, or vice
   *  versa), so both live per year rather than one being shared across the variant. */
  additionalRebate?: number;
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  variant: string;
  price: number;
  /** Vehicle-specific promo interest rate — overrides the SA's default when set. This is the flat
   *  rate; effectiveRate below is a separate, independently-quoted figure, not derived from it. */
  interestRate?: number;
  /** Vehicle-specific promo effective/reducing-balance rate (EIR) — set only when the bank quotes
   *  one for this car; not calculated from interestRate (see RateType). */
  effectiveRate?: number;
  /** Insurer's exact Basic Premium for this model — overrides the %-of-RRP estimate when set. */
  basicPremium?: number;
  /** Insurer's exact Additional Benefits (riders) total for this model. */
  addBenefits?: number;
  /** Static file path under `public/` (e.g. `/cars/proton-saga-standard.png`) for this variant's
   *  hero image on the Quote Preview poster — hardcoded by the developer, not uploaded at runtime. */
  photoUrl?: string;
  /** Static file path under `public/` (e.g. `/brochures/proton-saga.pdf`) for this variant's
   *  brochure — hardcoded by the developer. */
  brochureUrl?: string;
  /** Factory colour options for this exact variant, in the manufacturer's own order — not every
   *  model has this hardcoded yet (see coloursForVehicle), so callers fall back to the generic
   *  COLOUR_OPTIONS list (customer-data.ts) when absent. */
  colours?: string[];
  /** Per-colour price surcharge for this exact variant (e.g. a premium matte finish) — added on
   *  top of `price` when that exact colour is selected. Not every colour has one; a colour absent
   *  from this map (or the map itself absent) means RM0 surcharge. */
  colourSurcharges?: Record<string, number>;
  /** Every model year this variant is available in — e.g. an older year a showroom still has in
   *  stock — each with its own rebate and additional rebate (see VehicleYear); price, rates, and
   *  insurance are identical across a variant's model years, so they live once here instead.
   *  Always at least one entry. */
  years: VehicleYear[];
};

/** brand::model::variant — keys data that's shared across a whole variant (the itemized insurance
 *  quotation). */
export function variantKey(brand: string, model: string, variant: string): string {
  return `${brand}::${model}::${variant}`;
}

/** The one row for this exact brand/model/variant — every model year of a variant lives on the
 *  same row (see Vehicle.years), so there's never more than one match. */
export function findVehicle(brand: string, model: string, variant: string): Vehicle | null {
  return VEHICLES.find((v) => v.brand === brand && v.model === model && v.variant === variant) ?? null;
}

/** This exact variant's factory colour options, or null when this car has none hardcoded yet —
 *  callers fall back to the generic COLOUR_OPTIONS list (customer-data.ts) in that case. */
export function coloursForVehicle(brand: string, model: string, variant: string): string[] | null {
  return findVehicle(brand, model, variant)?.colours ?? null;
}

/** This exact colour's price surcharge on this vehicle, or 0 when it has none (including when no
 *  colour is selected at all). */
export function colourSurchargeFor(vehicle: Vehicle, colour: string | null): number {
  if (!colour) return 0;
  return vehicle.colourSurcharges?.[colour] ?? 0;
}

/** This model year's rebate, or 0 when this car has none set — not every car has a rebate, so an
 *  unset amount must never silently fall back to some other nonzero figure. */
export function rebateForYear(vehicle: Vehicle, year: number): number {
  return vehicle.years.find((y) => y.year === year)?.rebate ?? 0;
}

/** This model year's additional rebate, or 0 when this year has none. */
export function additionalRebateForYear(vehicle: Vehicle, year: number): number {
  return vehicle.years.find((y) => y.year === year)?.additionalRebate ?? 0;
}

/** Brand → model → variant catalog for the quotation calculator. Brands, models, and variants are
 *  hardcoded here by the developer, not editable at runtime — only pricing (incl. adding older
 *  model years still in dealer stock) is editable from Price Settings. Currently limited to Proton,
 *  Chery, and Jaecoo; other brands will be added back gradually. */
export const VEHICLES: Vehicle[] = [
  { id: 'proton-saga-standard', brand: 'Proton', model: 'Saga', variant: 'Standard', price: 38990, photoUrl: '/cars/proton-saga.png', brochureUrl: '/brochures/proton-saga.pdf', colours: ['Marine Blue', 'Space Grey', 'Ruby Red', 'Armour Silver', 'Snow White'], years: [{ year: 2026 }] },
  { id: 'proton-saga-executive', brand: 'Proton', model: 'Saga', variant: 'Executive', price: 44990, photoUrl: '/cars/proton-saga.png', brochureUrl: '/brochures/proton-saga.pdf', colours: ['Marine Blue', 'Space Grey', 'Ruby Red', 'Armour Silver', 'Snow White'], years: [{ year: 2026 }] },
  { id: 'proton-saga-premium', brand: 'Proton', model: 'Saga', variant: 'Premium', price: 49990, photoUrl: '/cars/proton-saga.png', brochureUrl: '/brochures/proton-saga.pdf', colours: ['Marine Blue', 'Space Grey', 'Ruby Red', 'Armour Silver', 'Snow White'], years: [{ year: 2026 }] },
  { id: 'proton-persona-standard', brand: 'Proton', model: 'Persona', variant: 'Standard', price: 47800, photoUrl: '/cars/proton-persona.png', brochureUrl: '/brochures/proton-persona.pdf', years: [{ year: 2026 }] },
  { id: 'proton-persona-executive', brand: 'Proton', model: 'Persona', variant: 'Executive', price: 53300, photoUrl: '/cars/proton-persona.png', brochureUrl: '/brochures/proton-persona.pdf', years: [{ year: 2026 }] },
  { id: 'proton-persona-premium', brand: 'Proton', model: 'Persona', variant: 'Premium', price: 58300, photoUrl: '/cars/proton-persona.png', brochureUrl: '/brochures/proton-persona.pdf', years: [{ year: 2026 }] },
  { id: 'proton-s70-executive', brand: 'Proton', model: 'S70', variant: 'Executive', price: 73800, photoUrl: '/cars/proton-s70.png', brochureUrl: '/brochures/proton-s70.pdf', colours: ['Quartz Black', 'Marine Blue', 'Space Grey', 'Snow White', 'Armour Silver', 'Ruby Red'], years: [{ year: 2026 }] },
  { id: 'proton-s70-premium', brand: 'Proton', model: 'S70', variant: 'Premium', price: 79800, photoUrl: '/cars/proton-s70.png', brochureUrl: '/brochures/proton-s70.pdf', colours: ['Quartz Black', 'Marine Blue', 'Space Grey', 'Snow White', 'Armour Silver', 'Ruby Red'], years: [{ year: 2026 }] },
  { id: 'proton-s70-flagship', brand: 'Proton', model: 'S70', variant: 'Flagship', price: 89800, photoUrl: '/cars/proton-s70.png', brochureUrl: '/brochures/proton-s70.pdf', colours: ['Quartz Black', 'Marine Blue', 'Space Grey', 'Snow White', 'Armour Silver', 'Ruby Red'], years: [{ year: 2026 }] },
  { id: 'proton-s70-flagship-x', brand: 'Proton', model: 'S70', variant: 'Flagship X', price: 94800, photoUrl: '/cars/proton-s70.png', brochureUrl: '/brochures/proton-s70.pdf', colours: ['Quartz Black', 'Marine Blue', 'Space Grey', 'Snow White', 'Armour Silver', 'Ruby Red'], years: [{ year: 2026 }] },
  { id: 'proton-x50-executive', brand: 'Proton', model: 'X50', variant: 'Executive', price: 89800, photoUrl: '/cars/proton-x50.png', brochureUrl: '/brochures/proton-x50.pdf', colours: ['Snow White', 'Jet Grey', 'Armour Silver', 'Marine Blue', 'Quartz Black'], years: [{ year: 2026 }] },
  { id: 'proton-x50-premium', brand: 'Proton', model: 'X50', variant: 'Premium', price: 101800, photoUrl: '/cars/proton-x50.png', brochureUrl: '/brochures/proton-x50.pdf', colours: ['Snow White', 'Jet Grey', 'Armour Silver', 'Marine Blue', 'Quartz Black'], years: [{ year: 2026 }] },
  { id: 'proton-x50-flagship', brand: 'Proton', model: 'X50', variant: 'Flagship', price: 113300, photoUrl: '/cars/proton-x50.png', brochureUrl: '/brochures/proton-x50.pdf', colours: ['Snow White', 'Jet Grey', 'Armour Silver', 'Marine Blue', 'Quartz Black'], years: [{ year: 2026 }] },
  { id: 'proton-x70-executive', brand: 'Proton', model: 'X70', variant: 'Executive', price: 106800, photoUrl: '/cars/proton-x70.png', brochureUrl: '/brochures/proton-x70.pdf', colours: ['Snow White', 'Armour Silver', 'Jet Grey', 'Marine Blue'], years: [{ year: 2026 }] },
  { id: 'proton-x70-premium', brand: 'Proton', model: 'X70', variant: 'Premium', price: 119800, photoUrl: '/cars/proton-x70.png', brochureUrl: '/brochures/proton-x70.pdf', colours: ['Snow White', 'Armour Silver', 'Jet Grey', 'Marine Blue'], years: [{ year: 2026 }] },
  { id: 'proton-x90-lite', brand: 'Proton', model: 'X90', variant: 'Lite', price: 106800, photoUrl: '/cars/proton-x90.png', brochureUrl: '/brochures/proton-x90.pdf', colours: ['Quartz Black', 'Marine Blue', 'Armour Silver', 'Snow White', 'Jet Grey'], years: [{ year: 2026 }] },
  { id: 'proton-x90-prime', brand: 'Proton', model: 'X90', variant: 'Prime', price: 116800, photoUrl: '/cars/proton-x90.png', brochureUrl: '/brochures/proton-x90.pdf', colours: ['Quartz Black', 'Marine Blue', 'Armour Silver', 'Snow White', 'Jet Grey'], years: [{ year: 2026 }] },
  { id: 'proton-x90-prime-x', brand: 'Proton', model: 'X90', variant: 'Prime X', price: 122800, photoUrl: '/cars/proton-x90.png', brochureUrl: '/brochures/proton-x90.pdf', colours: ['Quartz Black', 'Marine Blue', 'Armour Silver', 'Snow White', 'Jet Grey'], years: [{ year: 2026 }] },

  // Chery Malaysia lineup — synced from the dealer's own live pricing feed (chery-shared-data
  // .data-quotation.workers.dev), which also supplies the exact per-model Basic Premium,
  // Additional Benefits, and promo interest rate figures below. Tiggo 7 Pro and Tiggo 8 Pro
  // (ICE) are still sold alongside their PHEV siblings, not discontinued.
  { id: 'chery-o5-1-5t', brand: 'Chery', model: 'Chery O5', variant: '', price: 116800, interestRate: 2.3, basicPremium: 2789.07, addBenefits: 715.5, photoUrl: '/cars/chery-o5.png', brochureUrl: '/brochures/chery-o5.pdf', colours: ['Carbon Black', 'Phantom Grey', 'Khaki White', 'Blood Stone Red'], years: [{ year: 2026 }] },
  { id: 'chery-omoda-e5', brand: 'Chery', model: 'Omoda E5', variant: '', price: 146978, interestRate: 2.1, basicPremium: 3731.1, addBenefits: 775.5, photoUrl: '/cars/chery-omoda-e5.png', brochureUrl: '/brochures/chery-omoda-e5.pdf', years: [{ year: 2026 }] },
  { id: 'chery-tiggo-cross-turbo', brand: 'Chery', model: 'Tiggo Cross', variant: 'Turbo', price: 88800, interestRate: 2.3, basicPremium: 2206.67, addBenefits: 620.5, photoUrl: '/cars/chery-tiggo-cross-turbo.png', brochureUrl: '/brochures/chery-tiggo-cross.pdf', colours: ['Carbon Black', 'Phantom Grey', 'Khaki White', 'Blood Stone Red'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo-cross-hev', brand: 'Chery', model: 'Tiggo Cross', variant: 'Hybrid', price: 99800, interestRate: 2.3, basicPremium: 2435.47, addBenefits: 642.5, photoUrl: '/cars/chery-tiggo-cross-hybrid.png', brochureUrl: '/brochures/chery-tiggo-cross.pdf', colours: ['Carbon Black', 'Phantom Grey', 'Khaki White', 'Moonlight Silver'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo7-pro', brand: 'Chery', model: 'Tiggo 7', variant: 'Pro', price: 123800, interestRate: 2.3, basicPremium: 2934.67, addBenefits: 820.5, photoUrl: '/cars/chery-tiggo7-pro.png', brochureUrl: '/brochures/chery-tiggo7-pro.pdf', colours: ['Khaki White', 'Phantom Grey', 'Nasdaq Silver', 'Carbon Black'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo7-phev', brand: 'Chery', model: 'Tiggo 7', variant: 'PHEV', price: 129800, interestRate: 2.3, basicPremium: 3088.44, addBenefits: 832.5, photoUrl: '/cars/chery-tiggo7-phev.png', brochureUrl: '/brochures/chery-tiggo7-phev.pdf', colours: ['Phantom Grey', 'Khaki White', 'Blood Stone Red + Black Roof'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo8-1-6t', brand: 'Chery', model: 'Tiggo 8', variant: '', price: 129800, interestRate: 2.3, basicPremium: 3059.47, addBenefits: 832.5, photoUrl: '/cars/chery-tiggo8.png', brochureUrl: '/brochures/chery-tiggo8.pdf', colours: ['Dark Black', 'Khaki White'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo8-pro', brand: 'Chery', model: 'Tiggo 8', variant: 'Pro', price: 159800, interestRate: 2.3, basicPremium: 3710.35, addBenefits: 892.5, photoUrl: '/cars/chery-tiggo8-pro.png', brochureUrl: '/brochures/chery-tiggo8.pdf', colours: ['Dark Black', 'Khaki White', 'Aurora Green'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo8-phev', brand: 'Chery', model: 'Tiggo 8', variant: 'PHEV', price: 159800, interestRate: 2.3, basicPremium: 3710.35, addBenefits: 892.5, photoUrl: '/cars/chery-tiggo8-phev.png', brochureUrl: '/brochures/chery-tiggo8-phev.pdf', colours: ['Aurora Green', 'Khaki White', 'Carbon Black'], years: [{ year: 2026 }] },
  { id: 'chery-tiggo9', brand: 'Chery', model: 'Tiggo 9', variant: '', price: 179800, interestRate: 2.3, basicPremium: 4126.35, addBenefits: 1192.5, photoUrl: '/cars/chery-tiggo9.png', brochureUrl: '/brochures/chery-tiggo9.pdf', colours: ['Matte Grey', 'Carbon Black'], years: [{ year: 2026 }] },

  // Jaecoo Malaysia lineup — 2WD/AWD (or the unbadged J5) variants of a model share that model's
  // general e-brochure, while an EV/PHEV variant gets its own dedicated one.
  { id: 'jaecoo-j5', brand: 'Jaecoo', model: 'J5', variant: '', price: 108000, brochureUrl: '/brochures/jaecoo-j5.pdf', colours: ['Glacier Blue', 'Zircon Gray', 'Canyon Black', 'Snowy White'], years: [{ year: 2026 }] },
  { id: 'jaecoo-j5-ev', brand: 'Jaecoo', model: 'J5', variant: 'EV', price: 118800, brochureUrl: '/brochures/jaecoo-j5-ev.pdf', colours: ['Alpine Green', 'Fjord Grey', 'Carbon Crystal Black'], years: [{ year: 2026 }] },
  { id: 'jaecoo-j7-2wd', brand: 'Jaecoo', model: 'J7', variant: '2WD', price: 138800, brochureUrl: '/brochures/jaecoo-j7.pdf', colours: ['Model Green', 'Khaki White', 'Carbon Crystal Black', 'Moonlight Silver'], years: [{ year: 2026 }] },
  { id: 'jaecoo-j7-awd', brand: 'Jaecoo', model: 'J7', variant: 'AWD', price: 148800, brochureUrl: '/brochures/jaecoo-j7.pdf', colours: ['Model Green', 'Khaki White', 'Carbon Crystal Black', 'Moonlight Silver'], years: [{ year: 2026 }] },
  { id: 'jaecoo-j7-phev', brand: 'Jaecoo', model: 'J7', variant: 'PHEV', price: 158800, brochureUrl: '/brochures/jaecoo-j7-phev.pdf', colours: ['Carbon Crystal Black', 'Moonlight Silver', 'Olive Grey'], years: [{ year: 2026 }] },
  { id: 'jaecoo-j8-2wd', brand: 'Jaecoo', model: 'J8', variant: '2WD', price: 178800, brochureUrl: '/brochures/jaecoo-j8.pdf', colours: ['Carbon Crystal Black', 'Khaki White', 'Olive Grey'], years: [{ year: 2026 }] },
  { id: 'jaecoo-j8-awd', brand: 'Jaecoo', model: 'J8', variant: 'AWD', price: 198800, brochureUrl: '/brochures/jaecoo-j8.pdf', colours: ['Carbon Crystal Black + Black Roof', 'Khaki White + Black Roof', 'Olive Grey + Black Roof'], years: [{ year: 2026 }] },
  { id: 'jaecoo-omoda-c9-2wd', brand: 'Jaecoo', model: 'Omoda C9', variant: '2WD', price: 168800, brochureUrl: '/brochures/jaecoo-omoda-c9.pdf', colours: ['Matte Grey', 'Khaki White', 'Carbon Crystal Black'], colourSurcharges: { 'Matte Grey': 3000 }, years: [{ year: 2026 }] },
  { id: 'jaecoo-omoda-c9-awd', brand: 'Jaecoo', model: 'Omoda C9', variant: 'AWD', price: 188800, brochureUrl: '/brochures/jaecoo-omoda-c9.pdf', colours: ['Matte Grey', 'Khaki White', 'Carbon Crystal Black'], colourSurcharges: { 'Matte Grey': 3000 }, years: [{ year: 2026 }] },
  { id: 'jaecoo-omoda-c9-phev', brand: 'Jaecoo', model: 'Omoda C9', variant: 'PHEV', price: 208800, brochureUrl: '/brochures/jaecoo-omoda-c9-phev.pdf', colours: ['Matte Grey', 'Khaki White', 'Carbon Crystal Black'], colourSurcharges: { 'Matte Grey': 3000 }, years: [{ year: 2026 }] },
];

/** Factory-default catalog, snapshotted before any account's saved overrides are applied on top —
 *  kept only so a from-scratch reset is possible later; never mutated itself. Clones `years` too,
 *  since it's an array a reset must not still be sharing with the live (possibly edited) catalog. */
export const DEFAULT_VEHICLES: Vehicle[] = VEHICLES.map((v) => ({ ...v, years: v.years.map((y) => ({ ...y })) }));

/** Only the fields Price Settings can actually edit at runtime — price, rates, and model
 *  years/rebates. Brand/model/variant identity, insurance figures, and photo/brochure paths are
 *  hardcoded by the developer and never saved as an override. Persisted per-account via the Worker
 *  API (`/api/vehicle-overrides`) and applied onto this hardcoded catalog by
 *  VehicleCatalogService.loadOverrides() once the signed-in account is known — never at module
 *  load, since which overrides apply depends on who's logged in. */
export type VehicleOverride = Partial<Pick<Vehicle, 'price' | 'interestRate' | 'effectiveRate' | 'years'>>;

/** Unique models for a brand, in catalog order — used to drive cascading brand→model selects. */
export function modelsForBrand(brand: string): string[] {
  return Array.from(new Set(VEHICLES.filter((v) => v.brand === brand).map((v) => v.model)));
}

/** Unique variants for a brand+model, in catalog order — used to drive cascading model→variant
 *  selects. */
export function variantsForModel(brand: string, model: string): string[] {
  return Array.from(new Set(VEHICLES.filter((v) => v.brand === brand && v.model === model).map((v) => v.variant)));
}

/** Every model year this exact brand/model/variant is available in, newest first — never assumed
 *  or hardcoded, so a newly added year shows up on its own. Drives the Calculator's model-year
 *  switch: one year and there's nothing to switch, several and there is. */
export function yearsForVariant(brand: string, model: string, variant: string): number[] {
  return (
    findVehicle(brand, model, variant)
      ?.years.map((y) => y.year)
      .sort((a, b) => b - a) ?? []
  );
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

export type DownpaymentType = 'percent' | 'amount';

// ---------- Insurance ----------

/** Fallback Basic Premium rate (% of RRP) used until an SA saves their own default to their
 *  profile — only actually applies to a car without its own catalog figure (see Vehicle
 *  .basicPremium; Chery's models mostly have one already). Derived from a real Jaecoo J7 PHEV
 *  quote (RM5,195.15 basic premium on a RM158,800 car), not an arbitrary round number — still
 *  just a starting estimate, so an SA should override it per car (Price Settings) or per quote
 *  (Insurance Breakdown) once they know their dealer's actual package. */
export const DEFAULT_INSURANCE_RATE_PCT = 3.27;

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
  /** 'flat' (the default for a car with no saved quotation yet) or 'itemized' — which entry mode
   *  produced this quotation. Absent means 'itemized', since every quotation saved before this
   *  field existed was itemized — never silently reinterpret old data as flat. Deliberately not a
   *  discriminated union with the fields below: every consumer of this type already assumes every
   *  field below is always present, and keeping that true means adding Flat mode never requires
   *  touching those call sites. */
  mode?: 'flat' | 'itemized';
  /** Only meaningful when mode === 'flat' — the whole insurer-quoted total. NCD deducts straight
   *  from this; Premium All Rider/Additional Coverages/Stamp Duty/Service Tax/EPR below play no
   *  part in Flat mode (see computeInsuranceBreakdown). */
  flatPrice?: number;
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

/** Starting quotation for a car with no saved override yet — defaults to Flat mode (see
 *  InsuranceQuotationDetails.mode), pre-filled with what the itemized calc would have totalled at
 *  0% NCD, so the flat number is a sensible starting figure rather than RM0. The itemized fields
 *  are still populated underneath (carrying over the model's known Additional Benefits, e.g.
 *  Chery's live feed) so switching to Itemized mode later shows real numbers, not blanks. */
export function defaultInsuranceQuotation(vehicle: Vehicle, fallbackBasicPremium: number): InsuranceQuotationDetails {
  const itemized: InsuranceQuotationDetails = {
    mode: 'itemized',
    basicPremium: vehicle.basicPremium ?? Math.round(fallbackBasicPremium * 100) / 100,
    premiumAllRider: 0,
    additionalCoverages: vehicle.addBenefits ? [{ label: 'Additional Benefits', amount: vehicle.addBenefits }] : [],
    stampDuty: DEFAULT_STAMP_DUTY,
    serviceTaxPct: DEFAULT_SERVICE_TAX_PCT,
    epr: DEFAULT_EPR,
  };
  return { ...itemized, mode: 'flat', flatPrice: Math.round(computeInsuranceBreakdown(itemized, 0).totalDue * 100) / 100 };
}

/** Expands a saved quotation into the full labeled breakdown, at whatever NCD the quote is using.
 *  Flat mode (see InsuranceQuotationDetails.mode) skips every itemized field below Basic Premium —
 *  the flat price already stands in for the whole total, with only NCD deducted from it. */
export function computeInsuranceBreakdown(details: InsuranceQuotationDetails, ncdPct: number): InsuranceQuotationBreakdown {
  if (details.mode === 'flat') {
    const flatPrice = details.flatPrice ?? 0;
    const ncdAmount = flatPrice * (Math.max(0, ncdPct) / 100);
    const totalDue = flatPrice - ncdAmount;
    return {
      ...details,
      ncdPct,
      ncdAmount,
      coveragesTotal: 0,
      grossPremium: flatPrice,
      serviceTaxAmount: 0,
      totalDue,
      totalRounded: Math.round(totalDue * 2) / 2,
    };
  }
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

/** Rate Type — whether the quoted rate is a flat rate (interest on the original principal for
 *  the whole tenure, standard hire-purchase style) or an effective/reducing-balance rate (interest
 *  recalculated each month on the shrinking balance, standard term-loan style). Not derived from
 *  one another — the SA picks which one they were quoted and types that number directly. */
export type RateType = 'flat' | 'effective';

/** Flat-rate hire-purchase style monthly instalment. */
export function monthlyFlat(principal: number, annualRatePct: number, months: number): number {
  const p = Math.max(principal, 0);
  const years = months / 12;
  const totalInterest = p * (Math.max(annualRatePct, 0) / 100) * years;
  return (p + totalInterest) / months;
}

/** Effective/reducing-balance monthly instalment — standard amortizing-loan formula, interest
 *  recalculated each month on the remaining balance rather than the original principal. */
export function monthlyEffective(principal: number, annualRatePct: number, months: number): number {
  const p = Math.max(principal, 0);
  if (months <= 0) return 0;
  const r = Math.max(annualRatePct, 0) / 100 / 12;
  if (r === 0) return p / months;
  const factor = Math.pow(1 + r, months);
  return (p * r * factor) / (factor - 1);
}

/** Routes to the right instalment formula for whichever rate type the quote was given in. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number, rateType: RateType): number {
  return rateType === 'effective' ? monthlyEffective(principal, annualRatePct, months) : monthlyFlat(principal, annualRatePct, months);
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

/** Brand + model/variant label combined for display — most models don't repeat the brand name,
 *  but some (e.g. Chery's "Chery O5") already spell it out, which would otherwise render as
 *  "Chery Chery O5". Drops the brand prefix whenever the label already starts with it. */
export function vehicleTitle(brand: string, modelLabel: string): string {
  return modelLabel.toLowerCase().startsWith(brand.toLowerCase()) ? modelLabel : `${brand} ${modelLabel}`;
}

export { formatRM };
