import { quoteShareText } from './quote-share-text';
import type { PosterData } from './poster-data';

const base: PosterData = {
  lang: 'en',
  brand: 'Chery',
  modelTitle: 'Chery O5',
  year: 2026,
  dateStr: '',
  logoUrl: null,
  carImageUrl: null,
  colours: [],
  colourSurcharges: {},
  sellingPrice: 120689.18,
  downpayment: 12089.18,
  loanAmount: 108600,
  isCashPurchase: false,
  advisor: { name: 'Sample Advisor', role: 'Sales Consultant', initials: 'SA', photoUrl: null, phoneDisplay: '', bio: '' },
  otrPrice: 116800,
  ncdPct: 0,
  insurance: 3889.18,
  rebate: 0,
  totalAmountDue: 120689.18,
  rateLabel: '2.3% FLAT',
  interestRatePct: 2.3,
  tenureRows: [
    { label: '9 Yrs', months: 108, monthly: 1213.71, isLowest: true },
    { label: '7 Yrs', months: 84, monthly: 1501.12, isLowest: false },
  ],
};

describe('quoteShareText', () => {
  it('lists price, insurance, rebate, downpayment, loan, rate and monthly', () => {
    const text = quoteShareText(base, 'flat', 'en');
    expect(text).toContain('*Chery O5 (2026)*');
    expect(text).toContain('Car price (OTR): RM 116,800.00');
    expect(text).toContain('Insurance (0% NCD): RM 3,889.18');
    expect(text).toContain('Rebate: - RM 0.00');
    expect(text).toContain('*Total price: RM 120,689.18*');
    expect(text).toContain('Downpayment: RM 12,089.18');
    expect(text).toContain('Loan amount: RM 108,600.00');
    expect(text).toContain('Interest rate: 2.3% flat');
    expect(text).toContain('9 years: RM 1,213.71');
    expect(text).toContain('7 years: RM 1,501.12');
  });

  it('never includes the advisor name or role', () => {
    const text = quoteShareText(base, 'flat', 'en');
    expect(text).not.toContain('Sample Advisor');
    expect(text).not.toContain('Sales Consultant');
  });

  it('drops the loan lines for a cash purchase', () => {
    const text = quoteShareText({ ...base, isCashPurchase: true, loanAmount: 0 }, 'flat', 'en');
    expect(text).toContain('Cash purchase, no loan.');
    expect(text).not.toContain('Loan amount');
    expect(text).not.toContain('Monthly instalment');
  });

  it('writes Malay when the WhatsApp language is Malay', () => {
    const text = quoteShareText(base, 'effective', 'ms');
    expect(text).toContain('Harga kereta (OTR): RM 116,800.00');
    expect(text).toContain('Kadar faedah: 2.3% EIR');
    expect(text).toContain('9 tahun: RM 1,213.71');
  });
});
