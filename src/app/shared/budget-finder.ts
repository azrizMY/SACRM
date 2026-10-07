import {
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  defaultRateFor,
  loanForMonthlyPayment,
  minDownpaymentCash,
  monthlyPayment,
  rebateForYear,
  roundCents,
  type InsuranceQuotationDetails,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';

/**
 * Budget Finder: "what monthly suits you?" turned around into "here's the deposit each car needs to
 * get there". It never judges whether anyone qualifies — every car gets a deposit, and approval is
 * left to the advisor and the bank. Each figure is the same quote the Calculator or the customer
 * link would give for that car at that deposit and tenure.
 */

/** The advisor's quoting rules — the same ones their Calculator and customer link use. */
export type BudgetRules = {
  defaultRateType: RateType;
  interestRate: number;
  effectiveRate?: number;
  basicPremiumRatePct: number;
  /** Settings → Loan Rounding. Round up makes a full loan truly full: no deposit at all. */
  loanRounding?: 'down' | 'up';
  ncd: number;
  /** The car's saved insurance quotation, or its default from the basic premium. */
  insuranceFor: (vehicle: Vehicle, fallbackBasicPremium: number) => InsuranceQuotationDetails;
};

/** The most the customer can put down: an amount, 'fullLoan' (nothing beyond the loan's own RM100
 *  rounding — exactly what a full loan costs in the Calculator), or null for no limit. */
export type CashLimit = number | 'fullLoan' | null;

export type BudgetMatch = {
  vehicle: Vehicle;
  year: number;
  /** Car + insurance − rebate: what the customer pays in total. */
  totalDue: number;
  /** The deposit this quote uses: what brings the car to the budget, or — when that's more than the
   *  customer's maximum deposit — the maximum itself (never below the car's own minimum). */
  deposit: number;
  /** True when the deposit needed for the budget is within the maximum deposit (or none was given). */
  fits: boolean;
  loan: number;
  monthly: number;
  rate: number;
  rateType: RateType;
  /** The car's own minimum deposit (Price Settings) is why the deposit can't go lower. */
  minimumApplies: boolean;
};

/** The rate a quote would use: the car's own promo rate, else the advisor's default. An EIR default
 *  with no EIR set anywhere falls back to flat (same as the customer link), so a figure is never
 *  shown at a made-up rate. */
function rateFor(vehicle: Vehicle, rules: BudgetRules): { rate: number; rateType: RateType } {
  const defaults = { interestRate: rules.interestRate, effectiveRate: rules.effectiveRate };
  const preferred = rules.defaultRateType;
  const rateType: RateType = preferred === 'effective' && defaultRateFor(vehicle, 'effective', defaults) === null ? 'flat' : preferred;
  return { rate: defaultRateFor(vehicle, rateType, defaults) ?? rules.interestRate, rateType };
}

export function budgetMatch(vehicle: Vehicle, monthlyBudget: number, tenureMonths: number, rules: BudgetRules, cashLimit: CashLimit = null): BudgetMatch {
  const year = Math.max(...vehicle.years.map((y) => y.year));
  const basePrice = vehicle.price;
  const rebate = rebateForYear(vehicle, year);
  const details = rules.insuranceFor(vehicle, vehicle.basicPremium ?? basicPremiumDefault(basePrice, rules.basicPremiumRatePct));
  const insurance = computeInsuranceBreakdown(details, rules.ncd).totalDue;
  const loanBasisInsurance = computeInsuranceBreakdown(details, 0).totalDue;
  const totalDue = roundCents(Math.max(0, basePrice - rebate) + insurance);
  const { rate, rateType } = rateFor(vehicle, rules);
  const minimum = minDownpaymentCash(vehicle.minDownpayment, basePrice);

  // The biggest loan the budget covers; the rest is the deposit. Loans go in RM100 steps, rounded
  // down so the monthly never ends up above the budget.
  const maxLoan = loanForMonthlyPayment(Math.max(0, monthlyBudget), rate, tenureMonths, rateType);
  // Loans go in RM100 steps: for the budget the loan rounds down (monthly never above it); at the
  // maximum deposit it rounds up (deposit never above the maximum).
  const quoteAt = (downpayment: number, withMinimum: boolean, rounding: 'down' | 'up' = 'down') =>
    computeQuotationTotals({
      basePrice,
      effectiveRebate: rebate,
      insuranceAmount: insurance,
      loanBasisInsuranceAmount: loanBasisInsurance,
      downpaymentType: 'amount',
      downpaymentValue: roundCents(Math.max(0, downpayment)),
      minDownpaymentCash: withMinimum ? minimum : 0,
      loanRounding: rounding,
    });
  let forBudget = quoteAt(totalDue - maxLoan, true);
  // Round up: when the budget covers the whole car, finance all of it (the loan rounds up past the
  // total). The deposit is shown as zero, never as cash back.
  if (rules.loanRounding === 'up') {
    const full = quoteAt(0, true, 'up');
    if (full.loanAmount <= maxLoan + 0.005 && full.loanAmount > forBudget.loanAmount) forBudget = full;
  }
  const needed = Math.max(0, forBudget.downpaymentCash);
  // More than the customer can put down: quote at their maximum instead, so they still see the car.
  const rounding = rules.loanRounding ?? 'down';
  // A full loan, financed the way the advisor's Loan Rounding says (down leaves under RM100 to pay).
  const fullLoan = () => quoteAt(0, true, rounding);
  const limit = cashLimit === 'fullLoan' ? Math.max(0, quoteAt(0, false, rounding).downpaymentCash) : cashLimit;
  const fits = limit === null || needed <= limit + 0.005;
  const totals = fits ? forBudget : cashLimit === 'fullLoan' ? fullLoan() : quoteAt(limit!, true, 'up');
  const unclamped = fits ? quoteAt(totalDue - maxLoan, false) : cashLimit === 'fullLoan' ? quoteAt(0, false, rounding) : quoteAt(limit!, false, 'up');
  return {
    vehicle,
    year,
    totalDue,
    deposit: Math.max(0, totals.downpaymentCash),
    fits,
    loan: totals.loanAmount,
    monthly: monthlyPayment(totals.loanAmount, rate, tenureMonths, rateType),
    rate,
    rateType,
    minimumApplies: totals.downpaymentCash > unclamped.downpaymentCash,
  };
}

/** Every car: the ones within the maximum deposit first — smallest deposit first, and among equal
 *  deposits the monthly closest to the budget (the most car for the money) — then the rest quoted
 *  at the maximum deposit, lowest monthly first. Nothing is left out. */
export function budgetMatches(vehicles: Vehicle[], monthlyBudget: number, tenureMonths: number, rules: BudgetRules, cashLimit: CashLimit = null): BudgetMatch[] {
  return vehicles
    .map((v) => budgetMatch(v, monthlyBudget, tenureMonths, rules, cashLimit))
    .sort((a, b) => Number(b.fits) - Number(a.fits) || (a.fits ? Math.floor(a.deposit / 100) - Math.floor(b.deposit / 100) || b.monthly - a.monthly : a.monthly - b.monthly));
}
