import type { ActivityEntry, CustomerRecord, CustomerStatus, QuotationDetails } from './customer-data';
import { TO_BE_CONFIRMED_COLOUR } from './customer-data';
import { TENURE_OPTIONS, VEHICLES, rebateForYear } from './calculator-data';
import { toLocalDateStr } from '../shared/date-utils';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
}

function tsAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const INTEREST_RATE_CYCLE = [2.9, 3.1, 3.3, 3.5, 3.7, 3.9];

type Spec = {
  name: string;
  phone: string;
  brand: string;
  model: string;
  variant: string;
  yearMade: number;
  sourceType: string;
  status: 'Lead' | 'Won' | 'Lost';
  createdDaysAgo: number;
  downpayment?: number;
  ncd?: number;

  // Lead
  colour?: string;

  bookedDaysAgo?: number;

  // Quotation inputs (absent ones fall back to defaults)
  financingType?: 'Cash' | 'Loan';
  loanTenureMonths?: number;
  loanInterestRate?: number;

  deliveredDaysAgo?: number;
  commission?: number;

  cancelReason?: string;
  cancelDaysAgo?: number;
  cancelNotes?: string;
};

// 34 records spanning a full year, distributed across every month rather than clustered.
// Proton is the majority brand (dealership's core volume line); Chery is the smaller
// secondary line — roughly a 2:1 split overall. Every delivered (Won) deal carries a non-zero
// commission (positive = profit, negative = loss) since costing now happens at delivery.
const SPECS: Spec[] = [
  // ---------- Won (20) — one per month backbone, plus a recent cluster ----------
  {
    name: 'Ahmad Fauzi', phone: '013-220 4471', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Won', createdDaysAgo: 357, downpayment: 4650, ncd: 25,
    colour: 'White', bookedDaysAgo: 351,
    deliveredDaysAgo: 350, commission: 1400,
  },
  {
    name: 'Nurul Huda', phone: '017-882 3390', brand: 'Chery', model: 'Omoda 5', variant: 'Standard', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Won', createdDaysAgo: 327, downpayment: 11600, ncd: 0,
    colour: 'Red', bookedDaysAgo: 321,
    deliveredDaysAgo: 320, commission: 2600,
  },
  {
    name: 'Wong Mei Ling', phone: '012-664 7712', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Won', createdDaysAgo: 297, downpayment: 12380, ncd: 30,
    colour: 'Blue', bookedDaysAgo: 291,
    deliveredDaysAgo: 290, commission: -900,
  },
  {
    name: 'Ravi Chandran', phone: '019-338 5561', brand: 'Proton', model: 'S70', variant: 'Executive', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Won', createdDaysAgo: 267, downpayment: 8200, ncd: 25,
    colour: 'Silver', bookedDaysAgo: 261,
    deliveredDaysAgo: 260, commission: 2000,
  },
  {
    name: 'Siti Aminah', phone: '016-772 9034', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Won', createdDaysAgo: 237, downpayment: 12980, ncd: 45,
    colour: 'Grey', bookedDaysAgo: 231,
    deliveredDaysAgo: 230, commission: 600,
  },
  {
    name: 'Tan Wei Jian', phone: '011-2345 8871', brand: 'Proton', model: 'X70', variant: 'Premium', yearMade: 2025,
    sourceType: 'TikTok', status: 'Won', createdDaysAgo: 207, downpayment: 12880, ncd: 0,
    colour: 'Black', bookedDaysAgo: 201,
    deliveredDaysAgo: 200, commission: -1200,
  },
  {
    name: 'Farah Izzati', phone: '014-556 2287', brand: 'Proton', model: 'Saga', variant: 'Premium', yearMade: 2025,
    sourceType: 'Instagram', status: 'Won', createdDaysAgo: 177, downpayment: 5580, ncd: 25,
    colour: 'White', bookedDaysAgo: 171,
    deliveredDaysAgo: 170, commission: -500,
  },
  {
    name: 'Chong Kah Weng', phone: '012-887 3345', brand: 'Chery', model: 'Tiggo 8 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Won', createdDaysAgo: 147, downpayment: 15580, ncd: 0,
    colour: 'Grey', bookedDaysAgo: 141,
    deliveredDaysAgo: 140, commission: 3300,
  },
  {
    name: 'Muhammad Hafiz', phone: '018-990 4456', brand: 'Proton', model: 'X50', variant: 'Standard', yearMade: 2025,
    sourceType: 'Phone Call', status: 'Won', createdDaysAgo: 117, downpayment: 7980, ncd: 0,
    colour: 'Silver', bookedDaysAgo: 111,
    deliveredDaysAgo: 110, commission: 1600,
  },
  {
    name: 'Lee Jia Xin', phone: '012-338 7765', brand: 'Proton', model: 'S70', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Won', createdDaysAgo: 87, downpayment: 10580, ncd: 25,
    colour: 'Blue', bookedDaysAgo: 81,
    deliveredDaysAgo: 80, commission: 2200,
  },
  {
    name: 'Kavitha Rajan', phone: '019-772 3312', brand: 'Chery', model: 'Omoda 5', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Won', createdDaysAgo: 57, downpayment: 14200, ncd: 38.33,
    colour: 'Red', bookedDaysAgo: 51,
    deliveredDaysAgo: 50, commission: 2900,
  },
  {
    name: 'Amir Hakim', phone: '017-660 2298', brand: 'Proton', model: 'X70', variant: 'Flagship X', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Won', createdDaysAgo: 42, downpayment: 14180, ncd: 0,
    colour: 'Grey', bookedDaysAgo: 36,
    deliveredDaysAgo: 35, commission: 3500,
  },
  // Recent cluster — last 30 days, deliberately repeats Saga and X50 so the model-ranking
  // widgets show a genuine leader rather than one lonely unit per brand.
  {
    name: 'Grace Tan', phone: '013-449 8821', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Won', createdDaysAgo: 31, downpayment: 4650, ncd: 0,
    colour: 'White', bookedDaysAgo: 27,
    deliveredDaysAgo: 25, commission: 1300,
  },
  {
    name: 'Zulaikha Roslan', phone: '011-3390 5567', brand: 'Chery', model: 'Omoda 5', variant: 'Standard', yearMade: 2025,
    sourceType: 'Instagram', status: 'Won', createdDaysAgo: 27, downpayment: 11600, ncd: 25,
    colour: 'Black', bookedDaysAgo: 23,
    deliveredDaysAgo: 21, commission: 2400,
  },
  {
    name: 'Devan Kumar', phone: '016-228 7734', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'TikTok', status: 'Won', createdDaysAgo: 23, downpayment: 12380, ncd: 0,
    colour: 'Silver', bookedDaysAgo: 19,
    deliveredDaysAgo: 17, commission: 2500,
  },
  {
    name: 'Nor Aisyah', phone: '019-556 0021', brand: 'Proton', model: 'Saga', variant: 'Premium', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Won', createdDaysAgo: 19, downpayment: 5580, ncd: 25,
    colour: 'Blue', bookedDaysAgo: 15,
    deliveredDaysAgo: 13, commission: -600,
  },
  {
    name: 'Faizal Rahman', phone: '017-338 9945', brand: 'Proton', model: 'X50', variant: 'Standard', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Won', createdDaysAgo: 15, downpayment: 7980, ncd: 0,
    colour: 'White', bookedDaysAgo: 11,
    deliveredDaysAgo: 9, commission: 1900,
  },
  {
    name: 'Michelle Wong', phone: '018-664 2287', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Instagram', status: 'Won', createdDaysAgo: 11, downpayment: 13950, ncd: 25,
    colour: 'Grey', bookedDaysAgo: 8,
    deliveredDaysAgo: 6, commission: 3400,
  },
  {
    name: 'Firdaus Adnan', phone: '013-665 2290', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Referral', status: 'Won', createdDaysAgo: 7, downpayment: 4650, ncd: 25,
    colour: 'Red', bookedDaysAgo: 5,
    deliveredDaysAgo: 3, commission: 1500,
  },
  {
    name: 'Aisyah Kamarul', phone: '019-449 8823', brand: 'Proton', model: 'X70', variant: 'Premium', yearMade: 2025,
    sourceType: 'Phone Call', status: 'Won', createdDaysAgo: 5, downpayment: 12880, ncd: 0,
    colour: 'Silver', bookedDaysAgo: 3,
    deliveredDaysAgo: 1, commission: 3200,
  },

  // ---------- Leads, booked but not yet delivered (7) ----------
  {
    name: 'Farhana Yusoff', phone: '016-330 4471', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Lead', createdDaysAgo: 40, downpayment: 12380, ncd: 25,
    colour: 'White', bookedDaysAgo: 28,
    financingType: 'Loan', loanTenureMonths: 84, loanInterestRate: 3.2,
  },
  {
    name: 'Imran Zulkifli', phone: '012-778 9034', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Lead', createdDaysAgo: 25, downpayment: 12980, ncd: 0,
    colour: 'Grey', bookedDaysAgo: 15,
    financingType: 'Loan', loanTenureMonths: 60, loanInterestRate: 3.5,
  },
  {
    name: 'Sarah Lim', phone: '019-225 6690', brand: 'Toyota', model: 'Vios', variant: 'E', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Lead', createdDaysAgo: 10, downpayment: 17900, ncd: 0,
    colour: 'Silver', bookedDaysAgo: 5,
    financingType: 'Cash',
  },
  {
    name: 'Azman Yusof', phone: '013-990 5512', brand: 'Proton', model: 'X70', variant: 'Premium', yearMade: 2025,
    sourceType: 'Phone Call', status: 'Lead', createdDaysAgo: 45, downpayment: 12880, ncd: 0,
    colour: 'White', bookedDaysAgo: 30,
  },
  {
    name: 'Suzana Kamal', phone: '019-228 6650', brand: 'Chery', model: 'Omoda 5', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Lead', createdDaysAgo: 35, downpayment: 14200, ncd: 38.33,
    colour: 'Red', bookedDaysAgo: 22,
  },
  {
    name: 'Jerald Anthony', phone: '012-556 8890', brand: 'Proton', model: 'Saga', variant: 'Premium', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Lead', createdDaysAgo: 25, downpayment: 5580, ncd: 0,
    colour: 'Silver', bookedDaysAgo: 15,
  },
  {
    name: 'Aina Sofea', phone: '017-449 3321', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Lead', createdDaysAgo: 18, downpayment: 12380, ncd: 25,
    colour: 'Blue', bookedDaysAgo: 10,
  },

  // ---------- Lost (4) ----------
  {
    name: 'Halimah Zainal', phone: '016-882 9934', brand: 'Proton', model: 'S70', variant: 'Executive', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Lost', createdDaysAgo: 50, downpayment: 8200, ncd: 25,
    colour: 'Grey', bookedDaysAgo: 38,
    cancelDaysAgo: 20, cancelReason: 'Loan Rejected',
    cancelNotes: 'Bank declined the application due to insufficient income documentation.',
  },
  {
    name: 'Vincent Lau', phone: '011-6672 4489', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'TikTok', status: 'Lost', createdDaysAgo: 40, downpayment: 12980, ncd: 0,
    colour: 'Black', bookedDaysAgo: 28,
    cancelDaysAgo: 14, cancelReason: 'Customer Changed Mind',
  },
  {
    name: 'Naveen Kumar', phone: '019-660 1128', brand: 'Proton', model: 'X50', variant: 'Standard', yearMade: 2025,
    sourceType: 'Referral', status: 'Lost', createdDaysAgo: 20, downpayment: 7980,
    cancelDaysAgo: 8, cancelReason: 'Bought Another Brand',
  },
  {
    name: 'Ah Kow Tan', phone: '017-225 6614', brand: 'Toyota', model: 'Corolla Altis', variant: '1.8G', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Lost', createdDaysAgo: 30, downpayment: 12850, ncd: 0,
    colour: 'Silver', bookedDaysAgo: 18,
    cancelDaysAgo: 4, cancelReason: 'Other',
    cancelNotes: 'Customer relocated overseas before the purchase could be completed.',
  },

  // ---------- Leads (3) ----------
  {
    name: 'Rizal Fitri', phone: '014-772 5590', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Lead', createdDaysAgo: 12, downpayment: 4650, ncd: 0,
    financingType: 'Loan', colour: TO_BE_CONFIRMED_COLOUR,
  },
  {
    name: 'Christine Yap', phone: '012-334 7723', brand: 'Chery', model: 'Omoda 5', variant: 'Standard', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Lead', createdDaysAgo: 7, downpayment: 11600, ncd: 0,
    financingType: 'Loan', colour: TO_BE_CONFIRMED_COLOUR,
  },
  {
    name: 'Puteri Nabila', phone: '017-990 4423', brand: 'Proton', model: 'X70', variant: 'Flagship X', yearMade: 2025,
    sourceType: 'Instagram', status: 'Lead', createdDaysAgo: 3, downpayment: 14180, ncd: 0,
    financingType: 'Cash', colour: 'Black',
  },
];

export function buildSeedRecords(): CustomerRecord[] {
  return SPECS.map((s, i) => {
    const createdAt = tsAgo(s.createdDaysAgo);
    const lostAt = s.cancelDaysAgo !== undefined ? tsAgo(s.cancelDaysAgo) : undefined;
    // A deal is won when the car is delivered.
    const wonDaysAgo = s.status === 'Won' ? s.deliveredDaysAgo : undefined;
    const wonAt = wonDaysAgo !== undefined ? tsAgo(wonDaysAgo) : undefined;
    const updatedAt = lostAt ?? wonAt ?? createdAt;

    const previousStatus: CustomerStatus | undefined = s.status === 'Lost' ? 'Lead' : undefined;

    const record: CustomerRecord = {
      id: crypto.randomUUID(),
      status: s.status,
      name: s.name,
      phone: s.phone,
      brand: s.brand,
      model: s.model,
      variant: s.variant,
      yearMade: s.yearMade,
      colour: s.colour ?? TO_BE_CONFIRMED_COLOUR,
      sourceType: s.sourceType,
      date: daysAgo(s.createdDaysAgo),
      financingType: s.financingType ?? 'Loan',
      quotation: seedQuotation(s, i),

      commission: s.commission,
      freeGifts:
        s.status === 'Won' || s.bookedDaysAgo !== undefined
          ? [
              { id: crypto.randomUUID(), name: 'Floor mats', done: true, estimate: 150, cost: 150 },
              { id: crypto.randomUUID(), name: 'Dashcam', done: s.deliveredDaysAgo !== undefined, estimate: 250, cost: s.deliveredDaysAgo !== undefined ? 230 : undefined },
              { id: crypto.randomUUID(), name: 'Roadtax holder', done: s.deliveredDaysAgo !== undefined || i % 2 === 0, estimate: 20, cost: s.deliveredDaysAgo !== undefined || i % 2 === 0 ? 20 : undefined },
            ]
          : undefined,

      cancelReason: s.cancelReason,
      cancelNotes: s.cancelNotes,
      previousStatus,

      activity: buildActivityTrail(s, { createdAt, wonAt, lostAt }),

      createdAt,
      updatedAt,
    };
    return record;
  });
}

/** The quote each demo customer was given — the only financial record a customer has. */
function seedQuotation(s: Spec, i: number): QuotationDetails {
  const vehicle = VEHICLES.find((v) => v.brand === s.brand && v.model === s.model && v.variant === s.variant);
  return {
    rebate: vehicle ? rebateForYear(vehicle, s.yearMade) : 0,
    ncd: s.ncd ?? 0,
    interestRate: s.loanInterestRate ?? vehicle?.interestRate ?? pick(INTEREST_RATE_CYCLE, i),
    rateType: 'flat',
    downpaymentType: 'amount',
    downpaymentValue: s.downpayment ?? 0,
    tenureMonths: s.loanTenureMonths ?? pick(TENURE_OPTIONS, i).months,
  };
}

function buildActivityTrail(s: Spec, at: { createdAt: number; wonAt?: number; lostAt?: number }): ActivityEntry[] {
  const entries: { date: number; message: string }[] = [{ date: at.createdAt, message: 'Customer created' }];

  if (at.wonAt !== undefined) {
    entries.push({ date: at.wonAt, message: 'Status changed: Lead → Won' });
  }
  if (at.lostAt !== undefined) {
    entries.push({ date: at.lostAt, message: `Status changed: Lead → Lost (${s.cancelReason ?? ''})` });
  }

  return entries.sort((a, b) => a.date - b.date).map((e) => ({ id: crypto.randomUUID(), ...e }));
}
