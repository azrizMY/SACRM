import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, type AppSettings } from '../data/settings-data';
import { VEHICLES, computeQuotationTotals, defaultInsuranceQuotation, monthlyPayment, type Vehicle } from '../data/calculator-data';
import { QuoteEngine } from './quote-engine';
import { SettingsService } from './settings.service';

/** The shared quote maths behind the Calculator and the Live page. */
describe('QuoteEngine', () => {
  function engine(patch: Partial<AppSettings['salesDefaults']> = {}): QuoteEngine {
    const settings = signal<AppSettings>({ ...DEFAULT_SETTINGS, salesDefaults: { ...DEFAULT_SETTINGS.salesDefaults, ...patch } });
    const stub = { settings, getVehicleInsurance: (v: Vehicle, fallback: number) => defaultInsuranceQuotation(v, fallback) };
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: stub }] });
    return TestBed.runInInjectionContext(() => new QuoteEngine());
  }

  afterEach(() => TestBed.resetTestingModule());

  it("starts on the account's preferred brand and default tenures", () => {
    const q = engine();
    expect(q.selectedBrand()).toBe(DEFAULT_SETTINGS.dashboardTarget.brand);
    expect(q.posterTenureYears()).toEqual(DEFAULT_SETTINGS.salesDefaults.defaultTenureYears);
    expect(q.highlightedTenure()).toBe(Math.max(...DEFAULT_SETTINGS.salesDefaults.defaultTenureYears) * 12);
  });

  it('totals are exactly the shared quotation maths', () => {
    const q = engine();
    const expected = computeQuotationTotals({
      basePrice: q.basePrice(),
      effectiveRebate: q.effectiveRebate(),
      insuranceAmount: q.insurance(),
      loanBasisInsuranceAmount: q.loanBasisInsurance(),
      downpaymentType: 'percent',
      downpaymentValue: DEFAULT_SETTINGS.salesDefaults.downpaymentPct,
      minDownpaymentCash: q.minDownpayment(),
      loanRounding: 'down',
    });
    expect(q.totals()).toEqual(expected);
    expect(q.selectedTenureMonthly()).toBe(monthlyPayment(expected.loanAmount, q.interestRate(), q.highlightedTenure(), q.rateType()));
  });

  it('switching car drops a typed rebate — it belonged to the previous car', () => {
    const q = engine();
    q.onRebateChange(5000);
    expect(q.rebateInput()).toBe(5000);
    const other = VEHICLES.find((v) => v.id !== q.selectedVehicle().id && v.brand === q.selectedBrand())!;
    q.selectCar(other.brand, other.model, other.variant);
    expect(q.rebateIsManual()).toBeFalse();
  });

  it('cash back forces a full loan and pays the rebate out instead of taking it off', () => {
    const q = engine({ allowCashback: true });
    q.onRebateChange(8000);
    const before = q.loanAmount();
    q.setRebateAsCashback(true);
    expect(q.quoteDp()).toEqual({ type: 'amount', value: 0 });
    expect(q.cashbackAmount()).toBe(q.cashbackMax());
    expect(q.loanAmount()).toBeGreaterThan(before);
  });

  it('cash back is ignored when Settings does not allow it', () => {
    const q = engine({ allowCashback: false });
    q.onRebateChange(8000);
    q.setRebateAsCashback(true);
    expect(q.cashbackOn()).toBeFalse();
    expect(q.cashbackAmount()).toBe(0);
  });

  it('reset puts every figure back to the defaults but keeps the car', () => {
    const q = engine();
    const other = VEHICLES.find((v) => v.id !== q.selectedVehicle().id && v.brand === q.selectedBrand())!;
    q.selectCar(other.brand, other.model, other.variant);
    q.onRebateChange(3000);
    q.downpaymentValue.set(30);
    q.togglePosterYear(3);
    q.reset();
    expect(q.selectedVehicle().id).toBe(other.id);
    expect(q.rebateIsManual()).toBeFalse();
    expect(q.downpaymentValue()).toBe(DEFAULT_SETTINGS.salesDefaults.downpaymentPct);
    expect(q.posterTenureYears()).toEqual(DEFAULT_SETTINGS.salesDefaults.defaultTenureYears);
  });

  it('each engine is its own quote — two pages never share figures', () => {
    const a = engine();
    const b = TestBed.runInInjectionContext(() => new QuoteEngine());
    a.onRebateChange(4000);
    expect(b.rebateIsManual()).toBeFalse();
  });
});
