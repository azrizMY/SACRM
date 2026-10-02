import { computeInsuranceBreakdown, computeQuotationTotals, monthlyPayment, type InsuranceQuotationDetails, type Vehicle } from './calculator-data';
import { quoteForComparison, type ComparePricing, type CompareSetup } from './compare-data';
import { DEFAULT_SETTINGS } from './settings-data';

/** The Compare page must never disagree with the Calculator for the same car and loan setup. */
describe('quoteForComparison', () => {
  const insurance: InsuranceQuotationDetails = {
    mode: 'flat',
    flatPrice: 2000,
    basicPremium: 0,
    premiumAllRider: 0,
    additionalCoverages: [],
    stampDuty: 10,
    serviceTaxPct: 8,
    epr: 0,
  };
  const pricing: ComparePricing = {
    defaults: { ...DEFAULT_SETTINGS.salesDefaults, interestRate: 2.5, effectiveRate: undefined, additionalRebateByDefault: true },
    insuranceFor: () => insurance,
  };
  const setup: CompareSetup = { downpaymentType: 'percent', downpaymentValue: 10, tenureMonths: 108, rateType: 'flat', ncd: 25 };
  const car: Vehicle = {
    id: 'c1',
    brand: 'Test',
    model: 'SUV',
    variant: 'Premium',
    price: 100_000,
    years: [{ year: 2026, rebate: 3000, additionalRebate: 1000 }, { year: 2025, rebate: 5000 }],
  };

  it('matches the Calculator for the same inputs', () => {
    const q = quoteForComparison(car, 2026, setup, pricing);
    const totals = computeQuotationTotals({
      basePrice: 100_000,
      effectiveRebate: 4000, // rebate + additional rebate (included by default)
      insuranceAmount: computeInsuranceBreakdown(insurance, 25).totalDue,
      loanBasisInsuranceAmount: computeInsuranceBreakdown(insurance, 0).totalDue,
      downpaymentType: 'percent',
      downpaymentValue: 10,
    });
    expect(q.rebate).toBe(4000);
    expect(q.insurance).toBe(1500); // 2,000 less 25% NCD
    expect(q.totalDue).toBe(totals.totalAmountDue);
    expect(q.downpayment).toBe(totals.downpaymentCash);
    expect(q.loan).toBe(totals.loanAmount);
    expect(q.rate).toBe(2.5);
    expect(q.monthly).toBe(monthlyPayment(totals.loanAmount, 2.5, 108, 'flat'));
  });

  it('uses the chosen model year, and skips the additional rebate when Settings say so', () => {
    expect(quoteForComparison(car, 2025, setup, pricing).rebate).toBe(5000);
    const noExtra = { ...pricing, defaults: { ...pricing.defaults, additionalRebateByDefault: false } };
    expect(quoteForComparison(car, 2026, setup, noExtra).rebate).toBe(3000);
  });

  it('the Include additional rebate switch overrides the account setting', () => {
    expect(quoteForComparison(car, 2026, { ...setup, includeAdditionalRebate: false }, pricing).rebate).toBe(3000);
    const noExtra = { ...pricing, defaults: { ...pricing.defaults, additionalRebateByDefault: false } };
    expect(quoteForComparison(car, 2026, { ...setup, includeAdditionalRebate: true }, noExtra).rebate).toBe(4000);
  });

  it("the car's own promo rate beats the account default", () => {
    expect(quoteForComparison({ ...car, interestRate: 1.88 }, 2026, setup, pricing).rate).toBe(1.88);
  });

  it('a quote handed over from the Calculator keeps its own rebate, insurance and rate', () => {
    const q = quoteForComparison(car, 2026, setup, pricing, {
      rebate: 6500,
      additionalRebate: 1500,
      insuranceDetails: { ...insurance, flatPrice: 3000 },
      rate: { type: 'flat', value: 2.1 },
    });
    expect(q.rebate).toBe(8000); // the quote's own base + additional rebate
    // …and its additional rebate still follows the switch.
    expect(quoteForComparison(car, 2026, { ...setup, includeAdditionalRebate: false }, pricing, { rebate: 6500, additionalRebate: 1500 }).rebate).toBe(6500);
    expect(q.insurance).toBe(2250);
    expect(q.rate).toBe(2.1);
  });

  it('a flat-rate override is never reused as an EIR', () => {
    const q = quoteForComparison(car, 2026, { ...setup, rateType: 'effective' }, pricing, { rate: { type: 'flat', value: 2.1 } });
    expect(q.rate).toBeNull(); // no EIR on the car or the account
    expect(q.monthly).toBeNull();
  });

  it('customer link: base rebate only — the additional rebate is never included', () => {
    // Even with the account set to include it by default, or the switch on, customer pricing excludes it.
    const customer = { ...pricing, includeAdditionalRebate: false };
    expect(quoteForComparison(car, 2026, setup, customer).rebate).toBe(3000);
    expect(quoteForComparison(car, 2026, { ...setup, includeAdditionalRebate: true }, customer).rebate).toBe(3000);
  });

  it('customer link: a car with no EIR is quoted on its flat rate instead of showing no monthly', () => {
    const customer = { ...pricing, flatWhenNoEir: true };
    const q = quoteForComparison(car, 2026, { ...setup, rateType: 'effective' }, customer);
    expect(q.rateType).toBe('flat');
    expect(q.rate).toBe(2.5);
    expect(q.monthly).not.toBeNull();
    // A car that has its own EIR keeps quoting EIR.
    expect(quoteForComparison({ ...car, effectiveRate: 4.1 }, 2026, { ...setup, rateType: 'effective' }, customer).rateType).toBe('effective');
  });

  it('a downpayment covering everything is a cash deal with RM0 monthly', () => {
    const q = quoteForComparison(car, 2026, { ...setup, downpaymentType: 'amount', downpaymentValue: 1_000_000 }, pricing);
    expect(q.loan).toBe(0);
    expect(q.monthly).toBe(0);
  });
});
