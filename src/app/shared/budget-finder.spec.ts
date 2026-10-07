import { VEHICLES, computeQuotationTotals, computeInsuranceBreakdown, defaultInsuranceQuotation, monthlyPayment, rebateForYear, type Vehicle } from '../data/calculator-data';
import { budgetMatch, budgetMatches, type BudgetRules } from './budget-finder';

/** Budget Finder: every figure must be the quote the advisor's Calculator would give — and no car
 *  is ever left out, whatever the budget or deposit. */
describe('budgetMatch', () => {
  const rules: BudgetRules = {
    defaultRateType: 'flat',
    interestRate: 2.3,
    effectiveRate: 4.3,
    basicPremiumRatePct: 3.27,
    ncd: 0,
    insuranceFor: (v, fallback) => defaultInsuranceQuotation(v, fallback),
  };
  const car = VEHICLES.find((v) => v.id === 'chery-o5-1-5t')!;

  it('the monthly never goes above the budget', () => {
    for (const budget of [600, 900, 1234, 2000]) {
      const m = budgetMatch(car, budget, 108, rules);
      expect(m.monthly).toBeLessThanOrEqual(budget);
      // …and only just under it: one more RM100 of loan would go over (unless the whole car is already financed).
      if (m.loan + 100 <= m.totalDue) expect(monthlyPayment(m.loan + 100, m.rate, 108, 'flat')).toBeGreaterThan(budget);
    }
  });

  it('matches the Calculator for the same deposit', () => {
    const m = budgetMatch(car, 900, 108, rules);
    const year = Math.max(...car.years.map((y) => y.year));
    const insurance = computeInsuranceBreakdown(defaultInsuranceQuotation(car, car.basicPremium ?? 0), 0).totalDue;
    const totals = computeQuotationTotals({
      basePrice: car.price,
      effectiveRebate: rebateForYear(car, year),
      insuranceAmount: insurance,
      loanBasisInsuranceAmount: insurance,
      downpaymentType: 'amount',
      downpaymentValue: m.deposit,
      loanRounding: 'down',
    });
    expect(totals.loanAmount).toBe(m.loan);
    expect(m.monthly).toBeCloseTo(monthlyPayment(totals.loanAmount, 2.3, 108, 'flat'), 2);
  });

  it('a bigger budget or a longer loan needs a smaller deposit', () => {
    expect(budgetMatch(car, 1500, 108, rules).deposit).toBeLessThan(budgetMatch(car, 900, 108, rules).deposit);
    expect(budgetMatch(car, 900, 108, rules).deposit).toBeLessThan(budgetMatch(car, 900, 60, rules).deposit);
  });

  it('respects the car’s own minimum deposit', () => {
    const withMin: Vehicle = { ...car, minDownpayment: { type: 'amount', value: 20000 } };
    const m = budgetMatch(withMin, 10000, 108, rules);
    expect(m.deposit).toBeGreaterThanOrEqual(20000 - rebateForYear(withMin, 2026));
    expect(m.minimumApplies).toBeTrue();
  });

  it('over the maximum deposit: still shown, quoted at the maximum', () => {
    const m = budgetMatch(car, 600, 108, rules, 5000);
    expect(m.fits).toBeFalse();
    expect(m.deposit).toBeLessThanOrEqual(5000);
    expect(m.deposit).toBeGreaterThan(4900);
    expect(m.monthly).toBeGreaterThan(600);
  });

  it('a car whose own minimum is above the maximum deposit: shown at its minimum, monthly can be under budget', () => {
    const withMin: Vehicle = { ...car, minDownpayment: { type: 'amount', value: 40000 } };
    const m = budgetMatch(withMin, 2000, 108, rules, 30000);
    expect(m.fits).toBeFalse();
    expect(m.minimumApplies).toBeTrue();
    expect(m.deposit).toBeGreaterThan(30000);
    expect(m.monthly).toBeLessThan(2000);
  });

  it('Loan Rounding "up": a full loan is truly full — no deposit, never cash back', () => {
    const up = { ...rules, loanRounding: 'up' as const };
    const m = budgetMatch(car, 3000, 108, up);
    expect(m.deposit).toBe(0);
    expect(m.loan).toBeGreaterThanOrEqual(m.totalDue);
    expect(m.monthly).toBeLessThanOrEqual(3000);
    // "down" keeps the small remainder as a real deposit
    expect(budgetMatch(car, 3000, 108, rules).deposit).toBeGreaterThan(0);
  });

  it('Loan Rounding "up" never takes the monthly over the budget', () => {
    const up = { ...rules, loanRounding: 'up' as const };
    for (const budget of [600, 900, 1234]) expect(budgetMatch(car, budget, 108, up).monthly).toBeLessThanOrEqual(budget);
  });

  it('"Full loan" as the cash: round down still pays the under-RM100 rounding, like the Calculator', () => {
    const fits = budgetMatch(car, 3000, 108, rules, 'fullLoan');
    expect(fits.fits).toBeTrue();
    expect(fits.deposit).toBeGreaterThan(0);
    expect(fits.deposit).toBeLessThan(100);
    const tooHigh = budgetMatch(car, 600, 108, rules, 'fullLoan');
    expect(tooHigh.fits).toBeFalse();
    expect(tooHigh.deposit).toBeLessThan(100);
    expect(tooHigh.monthly).toBeGreaterThan(600);
  });

  it('"Full loan" with round up: nothing to pay up front', () => {
    const up = { ...rules, loanRounding: 'up' as const };
    expect(budgetMatch(car, 3000, 108, up, 'fullLoan').deposit).toBe(0);
    expect(budgetMatch(car, 600, 108, up, 'fullLoan').deposit).toBe(0);
  });

  it('never leaves a car out, and lists the ones that fit first', () => {
    const list = budgetMatches(VEHICLES, 700, 108, rules, 10000);
    expect(list.length).toBe(VEHICLES.length);
    const firstMiss = list.findIndex((m) => !m.fits);
    if (firstMiss >= 0) expect(list.slice(firstMiss).every((m) => !m.fits)).toBeTrue();
  });
});
