import type { ActivityEntry, CustomerRecord, CustomerStatus, DocumentStatus, PaymentStatus, RefundStatus } from './customer-data';
import { TO_BE_CONFIRMED_COLOUR } from './customer-data';
import { TENURE_OPTIONS, VEHICLES } from './calculator-data';
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

function priceFor(brand: string, model: string, variant: string): number {
  return VEHICLES.find((v) => v.brand === brand && v.model === model && v.variant === variant)?.price ?? 0;
}

/** RM0 is a deliberate demo case of "booking fee = Not Applicable" (see BOOKING_FEE_CYCLE). */
const BOOKING_FEE_CYCLE = [0, 300, 500, 800, 1000];

const DELIVERY_NOTE_CYCLE = [
  'Handed over with full tank and 2nd key.',
  'Customer briefed on first-service schedule.',
  'Minor touch-up done before handover; customer satisfied.',
  'Delivered on schedule, no outstanding items.',
];

const INTEREST_RATE_CYCLE = [2.9, 3.1, 3.3, 3.5, 3.7, 3.9];

type Spec = {
  name: string;
  phone: string;
  brand: string;
  model: string;
  variant: string;
  yearMade: number;
  sourceType: string;
  status: 'Lead' | 'Booked' | 'In Progress' | 'Delivered' | 'Cancelled';
  createdDaysAgo: number;
  downpayment?: number;
  ncd?: number;

  // Lead
  colour?: string;

  // Test drive (Lead-only event)
  testDriveDaysAgo?: number;
  drivingLicenceNo?: string;

  icNo?: string;
  documentStatus?: DocumentStatus;
  tradeInStatus?: string;
  tradeInVehicle?: string;
  tradeInValue?: number;
  bookedDaysAgo?: number;
  bookingFee?: number;

  // In Progress
  inProgressDaysAgo?: number;
  financingType?: 'Cash' | 'Loan';
  bankPanel?: string;
  loanTenureMonths?: number;
  loanInterestRate?: number;
  paymentStatus?: PaymentStatus;
  downPaymentStatus?: PaymentStatus;

  insuranceName?: string;
  plateNo?: string;
  deliveredDaysAgo?: number;
  commission?: number;

  cancelReason?: string;
  cancelDaysAgo?: number;
  cancelNotes?: string;
  refundStatus?: RefundStatus;
};

// 34 records spanning a full year, distributed across every month rather than clustered.
// Proton is the majority brand (dealership's core volume line); Chery is the smaller
// secondary line — roughly a 2:1 split overall. Every Delivered deal carries a non-zero
// commission (positive = Won, negative = Lost) since costing now happens at delivery.
const SPECS: Spec[] = [
  // ---------- Delivered (20) — one per month backbone, plus a recent cluster ----------
  {
    name: 'Ahmad Fauzi', phone: '013-220 4471', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Delivered', createdDaysAgo: 357, downpayment: 4650, ncd: 25,
    icNo: '890214-08-5521', colour: 'White', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Perodua Myvi 2015', tradeInValue: 12000, bookedDaysAgo: 351,
    bankPanel: 'Maybank', insuranceName: 'Etiqa', plateNo: 'VAA 2281', deliveredDaysAgo: 350, commission: 1400,
  },
  {
    name: 'Nurul Huda', phone: '017-882 3390', brand: 'Chery', model: 'Omoda 5', variant: 'Standard', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Delivered', createdDaysAgo: 327, downpayment: 11600, ncd: 0,
    icNo: '921030-14-6432', colour: 'Red', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 321,
    bankPanel: 'CIMB Bank', insuranceName: 'Allianz', plateNo: 'VAB 5510', deliveredDaysAgo: 320, commission: 2600,
  },
  {
    name: 'Wong Mei Ling', phone: '012-664 7712', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Delivered', createdDaysAgo: 297, downpayment: 12380, ncd: 30,
    icNo: '880521-10-4478', colour: 'Blue', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Proton Persona 2016', tradeInValue: 18500, bookedDaysAgo: 291,
    bankPanel: 'Public Bank', insuranceName: 'Tokio Marine', plateNo: 'VAC 7742', deliveredDaysAgo: 290, commission: -900,
  },
  {
    name: 'Ravi Chandran', phone: '019-338 5561', brand: 'Proton', model: 'S70', variant: 'Executive', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Delivered', createdDaysAgo: 267, downpayment: 8200, ncd: 25,
    icNo: '900112-07-3391', colour: 'Silver', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Honda City 2017', tradeInValue: 32000, bookedDaysAgo: 261,
    bankPanel: 'RHB Bank', insuranceName: 'Great Eastern General', plateNo: 'VAD 1129', deliveredDaysAgo: 260, commission: 2000,
  },
  {
    name: 'Siti Aminah', phone: '016-772 9034', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Delivered', createdDaysAgo: 237, downpayment: 12980, ncd: 45,
    icNo: '950630-01-2245', colour: 'Grey', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 231,
    bankPanel: 'Bank Islam', insuranceName: 'MSIG', plateNo: 'VAE 9930', deliveredDaysAgo: 230, commission: 600,
  },
  {
    name: 'Tan Wei Jian', phone: '011-2345 8871', brand: 'Proton', model: 'X70', variant: 'Premium', yearMade: 2025,
    sourceType: 'TikTok', status: 'Delivered', createdDaysAgo: 207, downpayment: 12880, ncd: 0,
    icNo: '930817-14-6690', colour: 'Black', documentStatus: 'APPROVE', tradeInStatus: 'Pending Evaluation', bookedDaysAgo: 201,
    bankPanel: 'AmBank', insuranceName: 'Berjaya Sompo', plateNo: 'VAF 3364', deliveredDaysAgo: 200, commission: -1200,
  },
  {
    name: 'Farah Izzati', phone: '014-556 2287', brand: 'Proton', model: 'Saga', variant: 'Premium', yearMade: 2025,
    sourceType: 'Instagram', status: 'Delivered', createdDaysAgo: 177, downpayment: 5580, ncd: 25,
    icNo: '970405-08-1123', colour: 'White', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 171,
    bankPanel: 'Hong Leong Bank', insuranceName: 'Zurich Malaysia', plateNo: 'VAG 6602', deliveredDaysAgo: 170, commission: -500,
  },
  {
    name: 'Chong Kah Weng', phone: '012-887 3345', brand: 'Chery', model: 'Tiggo 8 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Delivered', createdDaysAgo: 147, downpayment: 15580, ncd: 0,
    icNo: '890604-07-5518', colour: 'Grey', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Chery Tiggo 5X 2018', tradeInValue: 41000, bookedDaysAgo: 141,
    bankPanel: 'Maybank', insuranceName: 'Etiqa', plateNo: 'VAH 4415', deliveredDaysAgo: 140, commission: 3300,
  },
  {
    name: 'Muhammad Hafiz', phone: '018-990 4456', brand: 'Proton', model: 'X50', variant: 'Standard', yearMade: 2025,
    sourceType: 'Phone Call', status: 'Delivered', createdDaysAgo: 117, downpayment: 7980, ncd: 0,
    icNo: '940923-05-2287', colour: 'Silver', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 111,
    bankPanel: 'Bank Rakyat', insuranceName: 'Etiqa', plateNo: 'VAJ 4471', deliveredDaysAgo: 110, commission: 1600,
  },
  {
    name: 'Lee Jia Xin', phone: '012-338 7765', brand: 'Proton', model: 'S70', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Delivered', createdDaysAgo: 87, downpayment: 10580, ncd: 25,
    icNo: '910228-14-3345', colour: 'Blue', documentStatus: 'APPROVE', tradeInStatus: 'Pending Evaluation', bookedDaysAgo: 81,
    bankPanel: 'Public Bank', insuranceName: 'Tokio Marine', plateNo: 'VAK 8817', deliveredDaysAgo: 80, commission: 2200,
  },
  {
    name: 'Kavitha Rajan', phone: '019-772 3312', brand: 'Chery', model: 'Omoda 5', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Delivered', createdDaysAgo: 57, downpayment: 14200, ncd: 38.33,
    icNo: '960715-10-4462', colour: 'Red', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 51,
    bankPanel: 'CIMB Bank', insuranceName: 'Allianz', plateNo: 'VAL 5529', deliveredDaysAgo: 50, commission: 2900,
  },
  {
    name: 'Amir Hakim', phone: '017-660 2298', brand: 'Proton', model: 'X70', variant: 'Flagship X', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Delivered', createdDaysAgo: 42, downpayment: 14180, ncd: 0,
    icNo: '890604-07-1187', colour: 'Grey', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Proton X70 2019', tradeInValue: 68000, bookedDaysAgo: 36,
    bankPanel: 'RHB Bank', insuranceName: 'Great Eastern General', plateNo: 'VAM 6631', deliveredDaysAgo: 35, commission: 3500,
  },
  // Recent cluster — last 30 days, deliberately repeats Saga and X50 so the model-ranking
  // widgets show a genuine leader rather than one lonely unit per brand.
  {
    name: 'Grace Tan', phone: '013-449 8821', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Delivered', createdDaysAgo: 31, downpayment: 4650, ncd: 0,
    icNo: '920911-14-2298', colour: 'White', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 27,
    bankPanel: 'AmBank', insuranceName: 'MSIG', plateNo: 'VAN 9942', deliveredDaysAgo: 25, commission: 1300,
  },
  {
    name: 'Zulaikha Roslan', phone: '011-3390 5567', brand: 'Chery', model: 'Omoda 5', variant: 'Standard', yearMade: 2025,
    sourceType: 'Instagram', status: 'Delivered', createdDaysAgo: 27, downpayment: 11600, ncd: 25,
    icNo: '990117-08-3391', colour: 'Black', documentStatus: 'APPROVE', tradeInStatus: 'Pending Evaluation', bookedDaysAgo: 23,
    bankPanel: 'Bank Islam', insuranceName: 'Zurich Malaysia', plateNo: 'VAP 1123', deliveredDaysAgo: 21, commission: 2400,
  },
  {
    name: 'Devan Kumar', phone: '016-228 7734', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'TikTok', status: 'Delivered', createdDaysAgo: 23, downpayment: 12380, ncd: 0,
    icNo: '870325-10-6612', colour: 'Silver', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 19,
    bankPanel: 'Hong Leong Bank', insuranceName: 'Berjaya Sompo', plateNo: 'VAQ 4487', deliveredDaysAgo: 17, commission: 2500,
  },
  {
    name: 'Nor Aisyah', phone: '019-556 0021', brand: 'Proton', model: 'Saga', variant: 'Premium', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Delivered', createdDaysAgo: 19, downpayment: 5580, ncd: 25,
    icNo: '940802-14-5581', colour: 'Blue', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Perodua Axia 2016', tradeInValue: 9500, bookedDaysAgo: 15,
    bankPanel: 'Bank Rakyat', insuranceName: 'Etiqa', plateNo: 'VAR 7756', deliveredDaysAgo: 13, commission: -600,
  },
  {
    name: 'Faizal Rahman', phone: '017-338 9945', brand: 'Proton', model: 'X50', variant: 'Standard', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Delivered', createdDaysAgo: 15, downpayment: 7980, ncd: 0,
    icNo: '950116-07-4423', colour: 'White', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 11,
    bankPanel: 'Maybank', insuranceName: 'Allianz', plateNo: 'VAS 2298', deliveredDaysAgo: 9, commission: 1900,
  },
  {
    name: 'Michelle Wong', phone: '018-664 2287', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Instagram', status: 'Delivered', createdDaysAgo: 11, downpayment: 13950, ncd: 25,
    icNo: '960210-14-3376', colour: 'Grey', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 8,
    bankPanel: 'CIMB Bank', insuranceName: 'Tokio Marine', plateNo: 'VAT 5541', deliveredDaysAgo: 6, commission: 3400,
  },
  {
    name: 'Firdaus Adnan', phone: '013-665 2290', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Referral', status: 'Delivered', createdDaysAgo: 7, downpayment: 4650, ncd: 25,
    icNo: '990512-08-2246', colour: 'Red', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 5,
    bankPanel: 'Public Bank', insuranceName: 'Etiqa', plateNo: 'VAU 6650', deliveredDaysAgo: 3, commission: 1500,
  },
  {
    name: 'Aisyah Kamarul', phone: '019-449 8823', brand: 'Proton', model: 'X70', variant: 'Premium', yearMade: 2025,
    sourceType: 'Phone Call', status: 'Delivered', createdDaysAgo: 5, downpayment: 12880, ncd: 0,
    icNo: '910820-14-4471', colour: 'Silver', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Toyota Vios 2018', tradeInValue: 45000, bookedDaysAgo: 3,
    bankPanel: 'RHB Bank', insuranceName: 'Great Eastern General', plateNo: 'VAV 3321', deliveredDaysAgo: 1, commission: 3200,
  },

  // ---------- In Progress (3) — financing confirmed ----------
  {
    name: 'Farhana Yusoff', phone: '016-330 4471', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'In Progress', createdDaysAgo: 40, downpayment: 12380, ncd: 25,
    icNo: '930318-08-4462', colour: 'White', documentStatus: 'APPROVE', tradeInStatus: 'No Trade-in', bookedDaysAgo: 28, bookingFee: 500,
    inProgressDaysAgo: 10, financingType: 'Loan', bankPanel: 'Maybank', loanTenureMonths: 84, loanInterestRate: 3.2,
  },
  {
    name: 'Imran Zulkifli', phone: '012-778 9034', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'Walk-in', status: 'In Progress', createdDaysAgo: 25, downpayment: 12980, ncd: 0,
    icNo: '890814-10-2298', colour: 'Grey', documentStatus: 'APPROVE', tradeInStatus: 'Pending Evaluation', bookedDaysAgo: 15, bookingFee: 300,
    inProgressDaysAgo: 5, financingType: 'Loan', bankPanel: 'CIMB Bank', loanTenureMonths: 60, loanInterestRate: 3.5,
  },
  {
    name: 'Sarah Lim', phone: '019-225 6690', brand: 'Toyota', model: 'Vios', variant: 'E', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'In Progress', createdDaysAgo: 10, downpayment: 17900, ncd: 0,
    icNo: '970622-14-1123', colour: 'Silver', documentStatus: 'SUBMITTED', tradeInStatus: 'No Trade-in', bookedDaysAgo: 5, bookingFee: 0,
    inProgressDaysAgo: 2, financingType: 'Cash',
  },

  // ---------- Booked (4) ----------
  {
    name: 'Azman Yusof', phone: '013-990 5512', brand: 'Proton', model: 'X70', variant: 'Premium', yearMade: 2025,
    sourceType: 'Phone Call', status: 'Booked', createdDaysAgo: 45, downpayment: 12880, ncd: 0,
    icNo: '910520-08-4471', colour: 'White', documentStatus: 'SUBMITTED', tradeInStatus: 'No Trade-in', bookedDaysAgo: 30, bookingFee: 800,
  },
  {
    name: 'Suzana Kamal', phone: '019-228 6650', brand: 'Chery', model: 'Omoda 5', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Referral', status: 'Booked', createdDaysAgo: 35, downpayment: 14200, ncd: 38.33,
    icNo: '930412-10-2298', colour: 'Red', documentStatus: 'APPROVE', tradeInStatus: 'Confirmed', tradeInVehicle: 'Honda City 2019', tradeInValue: 9000, bookedDaysAgo: 22, bookingFee: 1000,
  },
  {
    name: 'Jerald Anthony', phone: '012-556 8890', brand: 'Proton', model: 'Saga', variant: 'Premium', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Booked', createdDaysAgo: 25, downpayment: 5580, ncd: 0,
    icNo: '880730-14-5523', colour: 'Silver', documentStatus: 'SUBMITTED', tradeInStatus: 'No Trade-in', bookedDaysAgo: 15, bookingFee: 0,
  },
  {
    name: 'Aina Sofea', phone: '017-449 3321', brand: 'Proton', model: 'X50', variant: 'Flagship', yearMade: 2025,
    sourceType: 'Facebook Ads', status: 'Booked', createdDaysAgo: 18, downpayment: 12380, ncd: 25,
    icNo: '970903-07-2245', colour: 'Blue', documentStatus: 'NO', tradeInStatus: 'Pending Evaluation', bookedDaysAgo: 10, bookingFee: 300,
  },

  // ---------- Cancelled (4) ----------
  {
    name: 'Halimah Zainal', phone: '016-882 9934', brand: 'Proton', model: 'S70', variant: 'Executive', yearMade: 2025,
    sourceType: 'Website Inquiry', status: 'Cancelled', createdDaysAgo: 50, downpayment: 8200, ncd: 25,
    icNo: '950208-08-1156', colour: 'Grey', documentStatus: 'SUBMITTED', tradeInStatus: 'No Trade-in', bookedDaysAgo: 38, bookingFee: 500,
    cancelDaysAgo: 20, cancelReason: 'Loan Rejected',
    cancelNotes: 'Bank declined the application due to insufficient income documentation.',
    refundStatus: 'Refunded',
  },
  {
    name: 'Vincent Lau', phone: '011-6672 4489', brand: 'Chery', model: 'Tiggo 7 Pro', variant: 'Comfort', yearMade: 2025,
    sourceType: 'TikTok', status: 'Cancelled', createdDaysAgo: 40, downpayment: 12980, ncd: 0,
    icNo: '900615-14-3390', colour: 'Black', documentStatus: 'SUBMITTED', tradeInStatus: 'Confirmed', tradeInVehicle: 'Chery Tiggo 5X 2017', tradeInValue: 35000, bookedDaysAgo: 28, bookingFee: 800,
    cancelDaysAgo: 14, cancelReason: 'Customer Changed Mind',
    refundStatus: 'Pending',
  },
  {
    name: 'Naveen Kumar', phone: '019-660 1128', brand: 'Proton', model: 'X50', variant: 'Standard', yearMade: 2025,
    sourceType: 'Referral', status: 'Cancelled', createdDaysAgo: 20, downpayment: 7980,
    cancelDaysAgo: 8, cancelReason: 'Bought Another Brand',
  },
  {
    name: 'Ah Kow Tan', phone: '017-225 6614', brand: 'Toyota', model: 'Corolla Altis', variant: '1.8G', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Cancelled', createdDaysAgo: 30, downpayment: 12850, ncd: 0,
    icNo: '900112-14-5523', colour: 'Silver', documentStatus: 'NO', tradeInStatus: 'No Trade-in', bookedDaysAgo: 18, bookingFee: 500,
    cancelDaysAgo: 4, cancelReason: 'Other',
    cancelNotes: 'Customer relocated overseas before the purchase could be completed.',
    refundStatus: 'Pending',
  },

  // ---------- Leads (3) ----------
  {
    name: 'Rizal Fitri', phone: '014-772 5590', brand: 'Proton', model: 'Saga', variant: 'Standard', yearMade: 2025,
    sourceType: 'Walk-in', status: 'Lead', createdDaysAgo: 12, downpayment: 4650, ncd: 0,
    financingType: 'Loan', colour: TO_BE_CONFIRMED_COLOUR,
    // Demo of the test-drive event: recorded a few days after the lead came in.
    testDriveDaysAgo: 8, drivingLicenceNo: 'D12345670', icNo: '881122-08-5567',
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
    const bookedAt = s.bookedDaysAgo !== undefined ? tsAgo(s.bookedDaysAgo) : undefined;
    const inProgressAt = s.inProgressDaysAgo !== undefined ? tsAgo(s.inProgressDaysAgo) : undefined;
    const deliveredAt = s.deliveredDaysAgo !== undefined ? tsAgo(s.deliveredDaysAgo) : undefined;
    const cancelledAt = s.cancelDaysAgo !== undefined ? tsAgo(s.cancelDaysAgo) : undefined;
    const updatedAt = cancelledAt ?? deliveredAt ?? inProgressAt ?? bookedAt ?? createdAt;

    // Every Delivered record went through financing confirmation at In Progress — derive it
    // uniformly instead of hand-typing loan terms on all 20 records.
    const isDeliveredLoan = s.status === 'Delivered';
    const price = priceFor(s.brand, s.model, s.variant);
    const loanAmount = isDeliveredLoan ? Math.max(0, price - (s.downpayment ?? 0)) : undefined;

    const bookingFee = s.bookingFee ?? (s.status === 'Lead' ? undefined : pick(BOOKING_FEE_CYCLE, i));

    const previousStatus: CustomerStatus | undefined =
      s.status === 'Cancelled' ? (bookedAt ? 'Booked' : 'Lead') : undefined;

    const hasContactDetails = s.status !== 'Lead' || s.testDriveDaysAgo !== undefined;
    const slug = s.name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');

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
      downpayment: s.downpayment,
      ncd: s.ncd,

      icNo: s.icNo,
      address: hasContactDetails ? `${12 + i}, Jalan Contoh ${1 + (i % 9)}, 5${i % 9}000 Kuala Lumpur` : undefined,
      email: hasContactDetails ? `${slug}@example.com` : undefined,
      drivingLicenceNo: s.drivingLicenceNo,
      testDriveDate: s.testDriveDaysAgo !== undefined ? daysAgo(s.testDriveDaysAgo) : undefined,

      documentStatus: s.documentStatus,
      bookingFee,

      financingType: isDeliveredLoan ? 'Loan' : s.financingType,
      bankPanel: s.bankPanel,
      loanAmount: s.bankPanel ? (loanAmount ?? Math.max(0, price - (s.downpayment ?? 0))) : undefined,
      loanTenureMonths: s.bankPanel ? (s.loanTenureMonths ?? pick(TENURE_OPTIONS, i).months) : s.loanTenureMonths,
      loanInterestRate: s.bankPanel ? (s.loanInterestRate ?? pick(INTEREST_RATE_CYCLE, i)) : s.loanInterestRate,
      paymentStatus: s.financingType === 'Cash' ? (s.paymentStatus ?? 'Partially Paid') : undefined,
      downPaymentStatus: s.bankPanel ? (s.downPaymentStatus ?? (s.status === 'Delivered' ? 'Fully Paid' : 'Partially Paid')) : undefined,

      tradeInStatus: s.tradeInStatus,
      tradeInVehicle: s.tradeInVehicle,
      tradeInValue: s.tradeInValue,

      insuranceName: s.insuranceName,
      plateNo: s.plateNo,
      deliveryDate: deliveredAt !== undefined ? daysAgo(s.deliveredDaysAgo!) : undefined,
      chassisNo: s.plateNo ? `CHS-${s.plateNo.replace(/\s+/g, '')}` : undefined,
      engineNo: s.plateNo ? `ENG-${s.plateNo.replace(/\s+/g, '')}` : undefined,
      deliveryNotes: s.status === 'Delivered' ? pick(DELIVERY_NOTE_CYCLE, i) : undefined,

      commission: s.commission,
      freeGifts:
        s.status === 'Delivered' || s.status === 'In Progress'
          ? [
              { id: crypto.randomUUID(), name: 'Floor mats', done: true },
              { id: crypto.randomUUID(), name: 'Dashcam', done: s.status === 'Delivered' },
              { id: crypto.randomUUID(), name: 'Roadtax holder', done: s.status === 'Delivered' || i % 2 === 0 },
            ]
          : undefined,

      cancelReason: s.cancelReason,
      cancelNotes: s.cancelNotes,
      previousStatus,
      refundStatus: s.refundStatus,

      activity: buildActivityTrail(s, { createdAt, bookedAt, inProgressAt, deliveredAt, cancelledAt }),

      createdAt,
      updatedAt,
    };
    return record;
  });
}

function buildActivityTrail(
  s: Spec,
  at: { createdAt: number; bookedAt?: number; inProgressAt?: number; deliveredAt?: number; cancelledAt?: number },
): ActivityEntry[] {
  const entries: { date: number; message: string }[] = [{ date: at.createdAt, message: 'Customer created' }];

  if (at.bookedAt !== undefined) {
    entries.push({ date: at.bookedAt, message: 'Status changed: Lead → Booked' });
  }
  if (at.inProgressAt !== undefined) {
    entries.push({ date: at.inProgressAt, message: 'Status changed: Booked → In Progress' });
    if (s.bankPanel) {
      entries.push({
        date: at.inProgressAt,
        message: `Financing confirmed: Loan · ${s.bankPanel} · ${s.loanTenureMonths ?? ''}mo · ${s.loanInterestRate ?? ''}%`,
      });
    } else if (s.financingType === 'Cash') {
      entries.push({ date: at.inProgressAt, message: 'Financing confirmed: Cash' });
    }
  }
  if (at.deliveredAt !== undefined) {
    if (at.inProgressAt === undefined && s.bankPanel) {
      // Delivered records don't carry an explicit inProgressDaysAgo — log financing at delivery time instead.
      entries.push({ date: at.deliveredAt, message: `Financing confirmed: Loan · ${s.bankPanel}` });
    }
    entries.push({ date: at.deliveredAt, message: 'Status changed: In Progress → Delivered' });
    entries.push({ date: at.deliveredAt, message: `Delivery completed · ${s.plateNo ?? ''}` });
  }
  if (at.cancelledAt !== undefined) {
    const from = at.bookedAt !== undefined ? 'Booked' : 'Lead';
    entries.push({ date: at.cancelledAt, message: `Status changed: ${from} → Cancelled (${s.cancelReason ?? ''})` });
  }

  return entries.sort((a, b) => a.date - b.date).map((e) => ({ id: crypto.randomUUID(), ...e }));
}
