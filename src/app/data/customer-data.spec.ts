import { dealOutcome, dealProfit, totalCostSpent, type CostItem, type CustomerRecord } from './customer-data';

/** Cost Breakdown's profit figures. */
describe('deal profit', () => {
  const record = (patch: Partial<CustomerRecord>) => patch as CustomerRecord;
  const cost = (label: string, amount: number): CostItem => ({ id: label, label, amount });

  it('profit = commission − every cost logged on the deal', () => {
    const r = record({ commission: 2500, costItems: [cost('Tint', 800), cost('Petrol', 150.5)] });
    expect(totalCostSpent(r)).toBe(950.5);
    expect(dealProfit(r)).toBe(1549.5);
    expect(dealOutcome(r)).toBe('Won');
  });

  it('spending more than the commission is a Lost deal', () => {
    const r = record({ commission: 500, costItems: [cost('Gifts', 900)] });
    expect(dealProfit(r)).toBe(-400);
    expect(dealOutcome(r)).toBe('Lost');
  });

  it('no commission or costs yet counts as break-even, not a loss', () => {
    expect(dealProfit(record({}))).toBe(0);
    expect(dealOutcome(record({}))).toBe('Won');
  });
});
