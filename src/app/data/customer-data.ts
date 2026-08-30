import type { DownpaymentType, InsuranceQuotationDetails, RateType } from './calculator-data';

export type CustomerStatus = 'Lead' | 'Booked' | 'In Progress' | 'Delivered' | 'Cancelled';
export type DocumentStatus = 'NO' | 'SUBMITTED' | 'APPROVE';

export const CUSTOMER_STATUSES: CustomerStatus[] = ['Lead', 'Booked', 'In Progress', 'Delivered', 'Cancelled'];

export const CUSTOMER_STATUS_META: Record<CustomerStatus, { label: string; tone: string; dot: string }> = {
  Lead: { label: 'Lead', tone: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]', dot: 'bg-[var(--chart-4)]' },
  Booked: { label: 'Booked', tone: 'bg-[var(--warning)]/14 text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
  'In Progress': { label: 'In Progress', tone: 'bg-[oklch(0.65_0.19_300)]/14 text-[oklch(0.65_0.19_300)]', dot: 'bg-[oklch(0.65_0.19_300)]' },
  Delivered: { label: 'Delivered', tone: 'bg-[var(--success)]/12 text-[var(--success)]', dot: 'bg-[var(--success)]' },
  Cancelled: { label: 'Cancelled', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

export const SOURCE_TYPES = [
  'Walk-in',
  'Phone Call',
  'Facebook Ads',
  'Instagram',
  'TikTok',
  'Referral',
  'Website Inquiry',
  'Other',
];

export const DOCUMENT_STATUS_OPTIONS: DocumentStatus[] = ['NO', 'SUBMITTED', 'APPROVE'];

export const DOCUMENT_STATUS_META: Record<DocumentStatus, { label: string; tone: string; dot: string }> = {
  NO: { label: 'Not Submitted', tone: 'bg-[var(--destructive)]/12 text-[var(--destructive)]', dot: 'bg-[var(--destructive)]' },
  SUBMITTED: { label: 'Submitted', tone: 'bg-[var(--warning)]/14 text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
  APPROVE: { label: 'Approved', tone: 'bg-[var(--success)]/12 text-[var(--success)]', dot: 'bg-[var(--success)]' },
};

export const TRADE_IN_OPTIONS = ['No Trade-in', 'Pending Evaluation', 'Confirmed'];

/** Replaces the old 6-item list — same const name/import sites, richer taxonomy. */
export const CANCEL_REASON_OPTIONS = [
  'Customer Changed Mind',
  'Bought Another Brand',
  'No Response',
  'Price Issue',
  'Monthly Payment Too High',
  'Loan Rejected',
  'Loan Amount Insufficient',
  'Financial Issue',
  'Family Decision',
  'Vehicle Unavailable',
  'Waiting Period Too Long',
  'Dealer Issue',
  'Other',
];

/** "To be Confirmed" is a real, storable value — selected by default at Lead creation, since the
 *  customer often hasn't picked a colour yet. It must be resolved to a real colour before Delivered. */
export const TO_BE_CONFIRMED_COLOUR = 'To be Confirmed';
export const COLOUR_OPTIONS = [TO_BE_CONFIRMED_COLOUR, 'White', 'Black', 'Silver', 'Grey', 'Red', 'Blue'];

export const BANK_OPTIONS = ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank', 'AmBank', 'Affin Bank', 'Bank Islam', 'Bank Rakyat', 'BSN'];
export const INSURANCE_OPTIONS = ['Etiqa', 'Allianz', 'Tokio Marine', 'Zurich Malaysia', 'Great Eastern General', 'MSIG', 'Berjaya Sompo'];

// ---------- Financing ----------

export type FinancingType = 'Cash' | 'Loan';
export const FINANCING_TYPE_OPTIONS: { value: FinancingType; label: string }[] = [
  { value: 'Loan', label: 'Hire Purchase' },
  { value: 'Cash', label: 'Cash' },
];

// ---------- Payment status (three-state label only — no amount tracking, by design) ----------

export type PaymentStatus = 'Not Paid' | 'Partially Paid' | 'Fully Paid';
export const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ['Not Paid', 'Partially Paid', 'Fully Paid'];

// ---------- Cancelled ----------

export type RefundStatus = 'Pending' | 'Refunded';
export const REFUND_STATUS_OPTIONS: RefundStatus[] = ['Pending', 'Refunded'];

// ---------- Free gifts (owned by Cost Breakdown; Customer Manager only reads a summary) ----------

export type FreeGiftItem = { id: string; name: string; done: boolean };

// ---------- Cost spent (owned by Cost Breakdown — itemised spend that offsets commission) ----------

export type CostItem = { id: string; label: string; amount: number };

export type CustomerRecord = {
  id: string;
  status: CustomerStatus;

  // Captured when the record is created (calculator hand-off or manual add)
  name: string;
  phone: string;
  brand: string;
  model: string;
  variant: string;
  yearMade: number;
  colour: string; // defaults to TO_BE_CONFIRMED_COLOUR — always populated, never blank
  sourceType: string;
  date: string;
  downpayment?: number;
  ncd?: number;

  // Captured at Lead creation, defaulting to Loan — the SA's best guess at how the customer will
  // pay. Stays editable at every stage; the In Progress gate collects the loan/cash specifics
  // that back it up but doesn't ask for this choice again.
  financingType?: FinancingType;

  // Test drive — an event on a Lead, not a stage. Also doubles as an early capture of the
  // fields the Booked gate will need, so a test-driven customer breezes through booking.
  icNo?: string;
  address?: string;
  email?: string;
  drivingLicenceNo?: string;
  testDriveDate?: string;

  // Captured when moved to Booked
  documentStatus?: DocumentStatus;
  remark?: string; // free-text customer notes — only ever set via Add Note, surfaced through Activity History
  bookingFee?: number;

  // Captured when moved to In Progress (financing confirmation)
  bankPanel?: string; // final agreed bank (post-LOU) — the customer's confirmed financing bank
  loanAmount?: number;
  loanTenureMonths?: number;
  loanInterestRate?: number;
  paymentStatus?: PaymentStatus; // cash buyers
  downPaymentStatus?: PaymentStatus; // loan buyers

  // Trade-in — agreed during In Progress onward. Recorded only; never affects any calculation.
  tradeInStatus?: string;
  tradeInVehicle?: string;
  tradeInValue?: number;

  // Arrive over days/weeks while In Progress; required only at the Delivered gate
  insuranceName?: string;
  plateNo?: string; // Registration Number
  deliveryDate?: string;
  chassisNo?: string; // Chassis / VIN
  engineNo?: string;
  deliveryNotes?: string;

  // Commission — set later via Cost Breakdown, never prompted at the Delivered transition.
  commission?: number;

  // Free gifts checklist — owned and edited on Cost Breakdown; Customer Manager only reads it.
  freeGifts?: FreeGiftItem[];

  // Itemised cost spent on this deal — owned and edited on Cost Breakdown; offsets commission in dealProfit().
  costItems?: CostItem[];

  // Captured when moved to Cancelled
  cancelReason?: string;
  cancelNotes?: string; // required only when cancelReason === 'Other'
  previousStatus?: CustomerStatus; // captured automatically — never user-input; also the Reopen target
  refundStatus?: RefundStatus; // only meaningful when a booking fee was taken; absent otherwise

  // Activity History — auto-recorded, newest-last (render reversed). The sole source of truth
  // for "when did this record enter stage X" — see stageEnteredAt().
  activity?: ActivityEntry[];

  // Quotation snapshot from the Calculator (or added/edited directly in Customer Manager).
  // Only the inputs are stored — derived figures (loan amount, monthly payment, etc.) are
  // recomputed on demand so they never drift from the shared calculator math.
  quotation?: QuotationDetails;

  createdAt: number;
  updatedAt: number;
};

export type ActivityEntry = { id: string; date: number; message: string };

export type QuotationDetails = {
  rebate: number;
  ncd: number;
  interestRate: number;
  /** Optional so quotations saved before Rate Type existed still load — they were always flat. */
  rateType?: RateType;
  downpaymentType: DownpaymentType;
  downpaymentValue: number;
  tenureMonths: number;
  // Optional so quotations saved before these existed still load with sensible defaults.
  additionalRebateEnabled?: boolean;
  additionalRebateValue?: number;
  basicPremium?: number;
  /** Full itemized insurance charge as actually quoted — a frozen snapshot, so later edits to the
   *  car's Finance Database default (or the customer declining/self-arranging cover) never change
   *  what this specific customer was already quoted. Falls back to the car database when absent
   *  (quotations saved before this existed). */
  insuranceDetails?: InsuranceQuotationDetails;
};

export type DealOutcome = 'Won' | 'Lost';

/** Sum of every cost item logged against a deal — spend the SA keyed in via "Add Cost Spent". */
export function totalCostSpent(r: CustomerRecord): number {
  return (r.costItems ?? []).reduce((sum, c) => sum + c.amount, 0);
}

/** Net profit for a deal is commission minus everything spent on it — positive is a Won deal, negative is Lost. */
export function dealProfit(r: CustomerRecord): number {
  return (r.commission ?? 0) - totalCostSpent(r);
}

export function dealOutcome(r: CustomerRecord): DealOutcome {
  return dealProfit(r) >= 0 ? 'Won' : 'Lost';
}

/** RM0 booking fee is a valid, deliberate "Not Applicable" — distinct from an unset field.
 *  Checks `== null` (not `=== undefined`) because a cleared number `<input>` bound via ngModel
 *  writes `null`, not `undefined` — a value this field's declared type doesn't rule out at runtime. */
export function bookingFeeDisplay(fee: number | undefined | null, fmt: (v: number) => string): string {
  if (fee == null) return '—';
  if (fee === 0) return 'Not Applicable';
  return fmt(fee);
}

// ---------- Free gifts ----------

export function freeGiftsSummary(r: CustomerRecord): { total: number; done: number } | null {
  const items = r.freeGifts;
  if (!items || items.length === 0) return null;
  return { total: items.length, done: items.filter((g) => g.done).length };
}

export function freeGiftsComplete(r: CustomerRecord): boolean {
  const s = freeGiftsSummary(r);
  return s === null || s.done === s.total;
}

export function freeGiftsLabel(r: CustomerRecord): string {
  const s = freeGiftsSummary(r);
  if (s === null) return '—';
  return s.done === s.total ? 'All completed' : `${s.done} / ${s.total} completed`;
}

// ---------- Cash-vs-loan display rule (drives the Documents panel/column) ----------

export function isCashDeal(r: CustomerRecord): boolean {
  return r.financingType === 'Cash';
}

// ---------- Stage-entry dates, derived from activity history (never separately stored) ----------

export const STAGE_DATE_HEADER: Record<CustomerStatus, string> = {
  Lead: 'Lead Since',
  Booked: 'Booked On',
  'In Progress': 'In Progress Since',
  Delivered: 'Delivered On',
  Cancelled: 'Cancelled On',
};

/** Timestamp the record most recently entered `stage`, read from the activity log (reopen included
 *  since its entry also ends in "→ <stage>"). Lead has no explicit transition entry — it's creation. */
export function stageEnteredAt(r: CustomerRecord, stage: CustomerStatus): number {
  if (stage === 'Lead') return r.createdAt;
  const marker = `→ ${stage}`; // matches "...changed: X → Booked" and "...(reason)" suffixes alike
  const matches = (r.activity ?? []).filter((e) => e.message.includes(marker));
  return matches.length ? matches[matches.length - 1].date : r.updatedAt;
}

/** The date/stage pair for whatever stage the record is in right now — used by the "All" tab. */
export function currentStageEnteredAt(r: CustomerRecord): number {
  return stageEnteredAt(r, r.status);
}

export function formatStageDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------- Gate validation ----------

export function canSubmitBooked(input: BookedInput): boolean {
  return !!input.icNo.trim() && !!input.address.trim() && !!input.email.trim();
}

export function canSubmitInProgress(input: InProgressInput): boolean {
  if (input.financingType === 'Cash') return !!input.paymentStatus;
  return (
    !!input.bankPanel &&
    !!input.downpayment &&
    !!input.downPaymentStatus &&
    !!input.loanAmount &&
    !!input.loanTenureMonths &&
    input.loanInterestRate != null
  );
}

export function canSubmitDelivered(input: DeliveredInput, giftsComplete: boolean, colourResolved: boolean): boolean {
  return (
    !!input.engineNo.trim() &&
    !!input.chassisNo.trim() &&
    !!input.insuranceName.trim() &&
    !!input.plateNo.trim() &&
    !!input.deliveryDate.trim() &&
    giftsComplete &&
    colourResolved
  );
}

export function canSubmitCancel(input: CancelledInput): boolean {
  return !!input.cancelReason && (input.cancelReason !== 'Other' || !!input.cancelNotes?.trim());
}

export type NewLeadInput = {
  name: string;
  phone: string;
  brand: string;
  model: string;
  variant: string;
  yearMade: number;
  colour: string;
  sourceType: string;
  date: string;
  quotation?: QuotationDetails;
  financingType: FinancingType;
};

export type TestDriveInput = {
  icNo: string;
  drivingLicenceNo: string;
  address: string;
  email: string;
  testDriveDate: string;
};

export type BookedInput = {
  icNo: string;
  address: string;
  email: string;
  bookingFee: number;
  downpayment?: number;
  ncd?: number;
};

export type InProgressInput = {
  financingType: FinancingType;
  paymentStatus?: PaymentStatus;
  bankPanel?: string;
  downpayment?: number;
  downPaymentStatus?: PaymentStatus;
  loanAmount?: number;
  loanTenureMonths?: number;
  loanInterestRate?: number;
};

export type DeliveredInput = {
  insuranceName: string;
  plateNo: string;
  deliveryDate: string;
  chassisNo: string;
  engineNo: string;
  deliveryNotes?: string;
};

export type CostingInput = {
  commission: number;
};

export type CancelledInput = {
  cancelReason: string;
  cancelNotes?: string;
  refundStatus?: RefundStatus;
};

/** Generic edit-any-field patch. Structurally excludes `status` so this path can never smuggle a status transition. */
export type EditCustomerInput = Partial<Omit<CustomerRecord, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'activity'>>;
