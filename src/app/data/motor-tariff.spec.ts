import { DEFAULT_MOTOR_TARIFF, bandForCc, guessBand, tariffBasicPremium } from './motor-tariff';
import { resolveInsuranceDetails, VEHICLES } from './calculator-data';

describe('motor tariff', () => {
  it('works out the spec example: 1,498 cc, Peninsular, RM 114,000 sum insured → RM 3,243.50', () => {
    expect(tariffBasicPremium(114000, bandForCc(1498), 'peninsular')).toBe(3243.5);
  });

  it('counts a part-thousand as a full thousand', () => {
    // 113,500 over the first 1,000 → 114 thousands
    expect(tariffBasicPremium(114500, '1650', 'peninsular')).toBe(305.5 + 26 * 114);
  });

  it('uses the Sabah & Sarawak column and rate', () => {
    expect(tariffBasicPremium(114000, '1650', 'east')).toBe(Math.round((220 + 20.3 * 113) * 100) / 100);
  });

  it('uses a band’s own rate when it has one', () => {
    const tariff = { ...DEFAULT_MOTOR_TARIFF, bands: DEFAULT_MOTOR_TARIFF.bands.map((b) => (b.ccLimit === 1650 ? { ...b, perThousand: { peninsular: 28.3 } } : b)) };
    expect(tariffBasicPremium(114000, '1650', 'peninsular', tariff)).toBe(Math.round((305.5 + 28.3 * 113) * 100) / 100);
  });

  it('needs a sum insured and a band', () => {
    expect(tariffBasicPremium(null, '1650', 'peninsular')).toBeNull();
    expect(tariffBasicPremium(114000, null, 'peninsular')).toBeNull();
  });

  it('guesses a band from the variant name, and none for an EV', () => {
    expect(guessBand('Chery O5 1.5T')).toBe('1650');
    expect(guessBand('City 1.5L V')).toBe('1650');
    expect(guessBand('CR-V 2.0L e:HEV RS')).toBe('2200');
    expect(guessBand('J5 EV')).toBeNull();
  });

  it('applies the tariff only to a quotation set to follow it', () => {
    const car = VEHICLES[0];
    const saved = { basicPremium: 3268.99, premiumAllRider: 0, additionalCoverages: [], stampDuty: 10, serviceTaxPct: 8, epr: 94.24 };
    expect(resolveInsuranceDetails(car, saved, 0, 3243.5).basicPremium).toBe(3268.99);
    expect(resolveInsuranceDetails(car, { ...saved, basicPremiumSource: 'tariff' }, 0, 3243.5).basicPremium).toBe(3243.5);
    const fresh = resolveInsuranceDetails(car, undefined, 0, 3243.5);
    expect(fresh.mode).toBe('itemized');
    expect(fresh.basicPremiumSource).toBe('tariff');
    expect(fresh.basicPremium).toBe(3243.5);
  });
});
