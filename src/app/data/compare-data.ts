import type { SalesDefaults } from './settings-data';
import {
  additionalRebateForYear,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  defaultRateFor,
  minDownpaymentCash,
  monthlyPayment,
  rebateForYear,
  type DownpaymentType,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
} from './calculator-data';

/** The loan setup every car in a comparison shares, so the cars are compared like for like. */
export type CompareSetup = {
  downpaymentType: DownpaymentType;
  /** % of the price (percent) or RM (amount), same as the Calculator's Downpayment field. */
  downpaymentValue: number;
  tenureMonths: number;
  rateType: RateType;
  ncd: number;
  /** Count each car's additional rebate. Absent = the account's "Additional Rebate starts ticked" setting. */
  includeAdditionalRebate?: boolean;
};

/** A car's own quote figures that override its defaults — only ever set for the car handed over
 *  from the Calculator, so its column matches the quote the SA just gave. */
export type CompareOverrides = {
  /** The quote's base rebate (before any additional rebate). */
  rebate?: number;
  /** The quote's additional rebate amount — counted only while the comparison includes it. */
  additionalRebate?: number;
  insuranceDetails?: InsuranceQuotationDetails;
  /** Only applies while the comparison is on this rate type — a flat rate is never reused as an EIR. */
  rate?: { type: RateType; value: number };
};

export type CompareQuote = {
  price: number;
  rebate: number;
  insurance: number;
  totalDue: number;
  downpayment: number;
  loan: number;
  /** Null when quoting EIR and neither the car nor the account has one. */
  rate: number | null;
  /** Null when the rate is missing; 0 for a cash deal. */
  monthly: number | null;
  /** The rate type actually quoted — differs from the setup's only with `flatWhenNoEir`. */
  rateType: RateType;
};

export type ComparePricing = {
  defaults: SalesDefaults;
  /** The car's saved insurance quotation (SettingsService.getVehicleInsurance). */
  insuranceFor: (vehicle: Vehicle) => InsuranceQuotationDetails;
  /** Forces the additional rebate on or off over the setup's own choice. The customer link passes
   *  false: that extra is only ever granted by the SA by hand, never shown to customers. */
  includeAdditionalRebate?: boolean;
  /** The customer link can't ask for a bank's EIR, so a car with no EIR anywhere is quoted on its
   *  flat rate instead (labelled flat) rather than left without a monthly figure. */
  flatWhenNoEir?: boolean;
};

/**
 * Prices one car exactly the way the Calculator does for a fresh quote — the model year's rebate
 * (plus its additional rebate when the comparison includes it), the car's saved insurance at
 * the chosen NCD with the loan sized on 0% NCD, its minimum downpayment, and its own promo rate —
 * so a comparison never disagrees with the Calculator.
 */
export function quoteForComparison(vehicle: Vehicle, year: number, setup: CompareSetup, pricing: ComparePricing, overrides: CompareOverrides = {}): CompareQuote {
  const withAdditional = pricing.includeAdditionalRebate ?? setup.includeAdditionalRebate ?? pricing.defaults.additionalRebateByDefault ?? true;
  const baseRebate = overrides.rebate ?? rebateForYear(vehicle, year);
  const additionalRebate = overrides.additionalRebate ?? additionalRebateForYear(vehicle, year);
  const rebate = baseRebate + (withAdditional ? additionalRebate : 0);

  const insuranceDetails = overrides.insuranceDetails ?? pricing.insuranceFor(vehicle);
  const insurance = computeInsuranceBreakdown(insuranceDetails, setup.ncd).totalDue;
  const loanBasisInsurance = computeInsuranceBreakdown(insuranceDetails, 0).totalDue;

  const totals = computeQuotationTotals({
    basePrice: vehicle.price,
    effectiveRebate: rebate,
    insuranceAmount: insurance,
    loanBasisInsuranceAmount: loanBasisInsurance,
    downpaymentType: setup.downpaymentType,
    downpaymentValue: setup.downpaymentValue,
    minDownpaymentCash: minDownpaymentCash(vehicle.minDownpayment, vehicle.price),
  });

  const rateType: RateType =
    pricing.flatWhenNoEir && setup.rateType === 'effective' && !overrides.rate && defaultRateFor(vehicle, 'effective', pricing.defaults) === null
      ? 'flat'
      : setup.rateType;
  const rate = overrides.rate && overrides.rate.type === rateType ? overrides.rate.value : defaultRateFor(vehicle, rateType, pricing.defaults);
  const monthly = totals.loanAmount === 0 ? 0 : rate === null ? null : monthlyPayment(totals.loanAmount, rate, setup.tenureMonths, rateType);

  return {
    price: vehicle.price,
    rebate,
    insurance,
    totalDue: totals.totalAmountDue,
    downpayment: totals.downpaymentCash,
    loan: totals.loanAmount,
    rate,
    monthly,
    rateType,
  };
}
