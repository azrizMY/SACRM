import {
  dealOutcome,
  dealProfit,
  giftBudgetReport,
  giftsStillToDo,
  totalCostSpent,
  withGiftCosts,
  type CostItem,
  type CustomerRecord,
  type FreeGiftItem,
} from './customer-data';

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

/** Promised gifts vs extra costs — what's spent, what's still to do, and budget vs actual. */
describe('gifts and extra costs', () => {
  const record = (patch: Partial<CustomerRecord>) => patch as CustomerRecord;
  const gift = (name: string, patch: Partial<FreeGiftItem> = {}): FreeGiftItem => ({ id: name, name, done: false, ...patch });
  const cost = (label: string, amount: number): CostItem => ({ id: label, label, amount });

  it('a promised gift costs nothing until it is done', () => {
    const r = record({ freeGifts: [gift('Tinted', { estimate: 350 })] });
    expect(totalCostSpent(r)).toBe(0);
    expect(giftsStillToDo(r)).toBe(350);
  });

  it('spent = done gifts at their real cost + extra costs', () => {
    const r = record({
      commission: 2000,
      freeGifts: [gift('Tinted', { estimate: 350, done: true, cost: 300 }), gift('Coating', { estimate: 400 })],
      costItems: [cost('Petrol', 50)],
    });
    expect(totalCostSpent(r)).toBe(350);
    expect(dealProfit(r)).toBe(1650);
  });

  it('over/under only counts gifts that are done', () => {
    const r = record({
      freeGifts: [gift('Tinted', { estimate: 350, done: true, cost: 300 }), gift('Coating', { estimate: 400 })],
      costItems: [cost('Petrol', 50)],
    });
    expect(giftBudgetReport(r)).toEqual({ budget: 750, actual: 300, variance: -50, remaining: 400, hidden: 50 });
  });

  it('a gift the dealer supplied (RM 0) is done and under budget by its estimate', () => {
    const r = record({ freeGifts: [gift('Perfume', { estimate: 30, done: true, cost: 0 })] });
    expect(totalCostSpent(r)).toBe(0);
    expect(giftBudgetReport(r)?.variance).toBe(-30);
  });

  it('old records: a cost logged under a gift name moves onto the gift, so nothing is counted twice', () => {
    const old = record({ freeGifts: [gift('Dashcam', { estimate: 250 })], costItems: [cost('dashcam ', 230), cost('Petrol', 50)] });
    const r = withGiftCosts(old);
    expect(r.freeGifts).toEqual([gift('Dashcam', { estimate: 250, done: true, cost: 230 })]);
    expect(r.costItems).toEqual([cost('Petrol', 50)]);
    expect(totalCostSpent(r)).toBe(totalCostSpent(old));
  });
});
