import {
  DEFAULT_EPR,
  VEHICLES,
  additionalRebateForYear,
  basicPremiumDefault,
  colourSurchargeFor,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  defaultInsuranceQuotation,
  defaultRateFor,
  loanForMonthlyPayment,
  minDownpaymentCash,
  monthlyEffective,
  monthlyFlat,
  monthlyPayment,
  rebateForYear,
  roundCents,
  type InsuranceQuotationDetails,
  type QuotationTotalsInput,
  type Vehicle,
} from './calculator-data';

/** These figures go straight onto customer quotes and posters. Each expected value is worked out
 *  by hand in the comment beside it, so a failure points at the rule that changed. */

const car = (patch: Partial<Vehicle> = {}): Vehicle => ({
  id: 'test-car',
  brand: 'Test',
  model: 'Sedan',
  variant: '1.5',
  price: 100_000,
  years: [{ year: 2026 }],
  ...patch,
});

describe('monthly instalment', () => {
  it('flat rate: (principal + principal × rate × years) / months', () => {
    // 100,000 × 2.5% × 9 = 22,500 interest → 122,500 / 108
    expect(monthlyFlat(100_000, 2.5, 108)).toBeCloseTo(1134.26, 2);
    // 88,920 × 2.6% × 9 = 20,807.28 → 109,727.28 / 108
    expect(monthlyFlat(88_920, 2.6, 108)).toBeCloseTo(1015.99, 2);
  });

  it('flat rate: zero, negative principal and negative rate are safe', () => {
    expect(monthlyFlat(0, 2.5, 108)).toBe(0);
    expect(monthlyFlat(-5_000, 2.5, 108)).toBe(0);
    expect(monthlyFlat(108_000, -1, 108)).toBe(1000);
  });

  it('effective rate: standard amortising formula', () => {
    // 100,000 at 3% p.a. over 60 months is the textbook 1,796.87
    expect(monthlyEffective(100_000, 3, 60)).toBeCloseTo(1796.87, 2);
    // 0% just splits the principal
    expect(monthlyEffective(60_000, 0, 60)).toBe(1000);
    expect(monthlyEffective(60_000, 3, 0)).toBe(0);
  });

  it('routes to the right formula for the rate type', () => {
    expect(monthlyPayment(100_000, 3, 60, 'flat')).toBe(monthlyFlat(100_000, 3, 60));
    expect(monthlyPayment(100_000, 3, 60, 'effective')).toBe(monthlyEffective(100_000, 3, 60));
    // An EIR is always the cheaper monthly for the same headline number
    expect(monthlyPayment(100_000, 3, 60, 'effective')).toBeLessThan(monthlyPayment(100_000, 3, 60, 'flat'));
  });

  it('reverse calc (target monthly → loan) is the exact inverse', () => {
    for (const rateType of ['flat', 'effective'] as const) {
      for (const [loan, rate, months] of [
        [88_920, 2.6, 108],
        [150_000, 3.1, 84],
        [45_000, 0, 60],
      ]) {
        const monthly = monthlyPayment(loan, rate, months, rateType);
        expect(loanForMonthlyPayment(monthly, rate, months, rateType)).toBeCloseTo(loan, 6);
      }
    }
  });
});

describe('insurance breakdown', () => {
  const itemized: InsuranceQuotationDetails = {
    mode: 'itemized',
    basicPremium: 2000,
    premiumAllRider: 0,
    additionalCoverages: [
      { label: 'Windscreen', amount: 100 },
      { label: 'Flood', amount: 50.5 },
    ],
    stampDuty: 10,
    serviceTaxPct: 8,
    epr: DEFAULT_EPR,
  };

  it('itemized: NCD off basic premium, then coverages, 8% tax, stamp duty and EPR', () => {
    const b = computeInsuranceBreakdown(itemized, 25);
    expect(b.ncdAmount).toBe(500); // 25% of 2,000
    expect(b.coveragesTotal).toBe(150.5);
    expect(b.grossPremium).toBe(1650.5); // 2,000 − 500 + 0 + 150.50
    expect(b.serviceTaxAmount).toBe(132.04); // 8% of 1,650.50
    expect(b.totalDue).toBe(1886.78); // 1,650.50 + 10 + 132.04 + 94.24
    expect(b.totalRounded).toBe(1887); // nearest 50 sen
  });

  it('itemized: the displayed total always equals the sum of the displayed lines', () => {
    for (const ncd of [0, 25, 30, 38.33, 45, 55]) {
      const b = computeInsuranceBreakdown({ ...itemized, basicPremium: 1234.57, premiumAllRider: 33.33 }, ncd);
      const lines = b.basicPremium - b.ncdAmount + b.premiumAllRider + b.coveragesTotal;
      expect(b.grossPremium).toBe(roundCents(lines));
      expect(b.totalDue).toBe(roundCents(b.grossPremium + b.stampDuty + b.serviceTaxAmount + b.epr));
    }
  });

  it('flat: only NCD comes off the insurer total', () => {
    const b = computeInsuranceBreakdown({ ...itemized, mode: 'flat', flatPrice: 1500 }, 30);
    expect(b.ncdAmount).toBe(450);
    expect(b.totalDue).toBe(1050);
    expect(b.serviceTaxAmount).toBe(0);
  });

  it('rounds the final amount to the nearest 50 sen', () => {
    const at = (flatPrice: number) => computeInsuranceBreakdown({ ...itemized, mode: 'flat', flatPrice }, 0).totalRounded;
    expect(at(1234.56)).toBe(1234.5);
    expect(at(1234.76)).toBe(1235);
    expect(at(1234.25)).toBe(1234.5);
  });

  it('a negative NCD is treated as none', () => {
    expect(computeInsuranceBreakdown(itemized, -10).ncdAmount).toBe(0);
  });

  it('a new car starts in flat mode, priced at what the itemized quote totals at 0% NCD', () => {
    const q = defaultInsuranceQuotation(car({ basicPremium: 1000, addBenefits: 200 }), 0);
    expect(q.mode).toBe('flat');
    // 1,000 + 200 = 1,200 gross; 8% tax 96; + 10 stamp + 94.24 EPR
    expect(q.flatPrice).toBe(1400.24);
  });

  it('suggested basic premium is the rate × price, never negative', () => {
    expect(basicPremiumDefault(100_000, 3.27)).toBeCloseTo(3270, 6);
    expect(basicPremiumDefault(-1, 3.27)).toBe(0);
  });
});

describe('quotation totals (downpayment and loan)', () => {
  const base: QuotationTotalsInput = {
    basePrice: 100_000,
    effectiveRebate: 0,
    insuranceAmount: 2000,
    downpaymentType: 'percent',
    downpaymentValue: 10,
  };

  it('10% downpayment on price + insurance', () => {
    expect(computeQuotationTotals(base)).toEqual({
      insuranceAmount: 2000,
      totalAmountDue: 102_000,
      downpaymentCash: 10_200, // 10% of 102,000
      loanAmount: 91_800,
    });
  });

  it('a rebate comes off the downpayment, not the loan', () => {
    const t = computeQuotationTotals({ ...base, effectiveRebate: 5000 });
    expect(t.totalAmountDue).toBe(97_000);
    expect(t.loanAmount).toBe(91_800); // unchanged
    expect(t.downpaymentCash).toBe(5200); // 10,200 − 5,000
  });

  it('a rebate bigger than the downpayment spills into a smaller loan', () => {
    const t = computeQuotationTotals({ ...base, effectiveRebate: 15_000 });
    expect(t.downpaymentCash).toBe(0);
    expect(t.loanAmount).toBe(87_000);
  });

  it('a better NCD shrinks the downpayment, while the loan stays sized on 0% NCD insurance', () => {
    const t = computeQuotationTotals({ ...base, insuranceAmount: 1500, loanBasisInsuranceAmount: 2000 });
    expect(t.totalAmountDue).toBe(101_500);
    expect(t.loanAmount).toBe(91_800);
    expect(t.downpaymentCash).toBe(9700);
  });

  it('loans are floored to RM100, with the remainder added to the downpayment', () => {
    const t = computeQuotationTotals({ ...base, basePrice: 100_050, insuranceAmount: 0 });
    expect(t.loanAmount).toBe(90_000); // 90,045 floored
    expect(t.downpaymentCash).toBe(10_050);
  });

  it('a typed cash downpayment is used as-is, and capped at the amount due', () => {
    expect(computeQuotationTotals({ ...base, downpaymentType: 'amount', downpaymentValue: 20_000 })).toEqual(
      jasmine.objectContaining({ downpaymentCash: 20_000, loanAmount: 82_000 }),
    );
    expect(computeQuotationTotals({ ...base, downpaymentType: 'amount', downpaymentValue: 500_000 })).toEqual(
      jasmine.objectContaining({ downpaymentCash: 102_000, loanAmount: 0 }),
    );
  });

  it("a variant's minimum downpayment caps the loan, less what the rebate covers", () => {
    const t = computeQuotationTotals({ ...base, downpaymentValue: 0, effectiveRebate: 3000, minDownpaymentCash: 10_000 });
    expect(t.totalAmountDue).toBe(99_000);
    expect(t.downpaymentCash).toBe(7000); // 10,000 minimum − 3,000 rebate
    expect(t.loanAmount).toBe(92_000);
  });

  it('a rebate at or above the minimum downpayment allows a full loan', () => {
    const t = computeQuotationTotals({ ...base, downpaymentValue: 0, effectiveRebate: 3000, minDownpaymentCash: 2000 });
    expect(t.downpaymentCash).toBe(0);
    expect(t.loanAmount).toBe(99_000);
  });

  it('always: loan is a whole RM100, never negative, and loan + downpayment = amount due', () => {
    const cases: QuotationTotalsInput[] = [];
    for (const basePrice of [41_500, 98_800, 128_888.88, 208_800])
      for (const effectiveRebate of [0, 1500, 8000])
        for (const insuranceAmount of [0, 1886.78, 3410.55])
          for (const [downpaymentType, downpaymentValue] of [
            ['percent', 0],
            ['percent', 10],
            ['percent', 33.3],
            ['amount', 12_345.67],
          ] as const)
            for (const minDownpaymentCash of [0, 5000])
              cases.push({ basePrice, effectiveRebate, insuranceAmount, downpaymentType, downpaymentValue, minDownpaymentCash });

    for (const c of cases) {
      const t = computeQuotationTotals(c);
      expect(t.loanAmount % 100).withContext(JSON.stringify(c)).toBe(0);
      expect(t.loanAmount).toBeGreaterThanOrEqual(0);
      expect(t.downpaymentCash).toBeGreaterThanOrEqual(0);
      expect(roundCents(t.loanAmount + t.downpaymentCash)).withContext(JSON.stringify(c)).toBe(t.totalAmountDue);
    }
  });
});

describe('per-car pricing helpers', () => {
  it('minimum downpayment as an amount or a % of price', () => {
    expect(minDownpaymentCash({ type: 'percent', value: 10 }, 98_800)).toBe(9880);
    expect(minDownpaymentCash({ type: 'amount', value: 5000 }, 98_800)).toBe(5000);
    expect(minDownpaymentCash(undefined, 98_800)).toBe(0);
    expect(minDownpaymentCash({ type: 'amount', value: 0 }, 98_800)).toBe(0);
  });

  it('rebates are per model year, and 0 when not set', () => {
    const v = car({ years: [{ year: 2025, rebate: 3000, additionalRebate: 1000 }, { year: 2026 }] });
    expect(rebateForYear(v, 2025)).toBe(3000);
    expect(additionalRebateForYear(v, 2025)).toBe(1000);
    expect(rebateForYear(v, 2026)).toBe(0);
    expect(additionalRebateForYear(v, 2026)).toBe(0);
    expect(rebateForYear(v, 2024)).toBe(0);
  });

  it('colour surcharges apply only to the listed colour', () => {
    const v = car({ colours: ['Matte Grey', 'White'], colourSurcharges: { 'Matte Grey': 3000 } });
    expect(colourSurchargeFor(v, 'Matte Grey')).toBe(3000);
    expect(colourSurchargeFor(v, 'White')).toBe(0);
    expect(colourSurchargeFor(v, null)).toBe(0);
  });

  it("rate: the car's own rate wins, else the account default; never a flat rate as an EIR", () => {
    const defaults = { interestRate: 2.5, effectiveRate: 4.2 };
    expect(defaultRateFor(car({ interestRate: 2.3 }), 'flat', defaults)).toBe(2.3);
    expect(defaultRateFor(car(), 'flat', defaults)).toBe(2.5);
    expect(defaultRateFor(car({ effectiveRate: 3.9 }), 'effective', defaults)).toBe(3.9);
    expect(defaultRateFor(car(), 'effective', defaults)).toBe(4.2);
    expect(defaultRateFor(car({ interestRate: 2.3 }), 'effective', { interestRate: 2.5 })).toBeNull();
  });

  it('roundCents removes floating-point drift', () => {
    expect(roundCents(457.5835999999981)).toBe(457.58);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe('car catalog', () => {
  it('every variant has a unique id, a price and at least one model year', () => {
    const ids = new Set<string>();
    for (const v of VEHICLES) {
      expect(ids.has(v.id)).withContext(`duplicate id ${v.id}`).toBeFalse();
      ids.add(v.id);
      expect(v.price).withContext(v.id).toBeGreaterThan(0);
      expect(v.years.length).withContext(v.id).toBeGreaterThan(0);
      expect(new Set(v.years.map((y) => y.year)).size).withContext(`${v.id} repeats a model year`).toBe(v.years.length);
    }
  });

  it('colour surcharges only name colours the car actually comes in', () => {
    for (const v of VEHICLES) {
      for (const colour of Object.keys(v.colourSurcharges ?? {})) {
        expect(v.colours ?? []).withContext(`${v.id}: surcharge for "${colour}"`).toContain(colour);
      }
    }
  });
});
