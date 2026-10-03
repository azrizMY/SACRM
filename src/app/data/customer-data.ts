import type { DownpaymentType, InsuranceQuotationDetails, LoanRounding, RateType } from './calculator-data';
import { toLocalDateStr } from '../shared/date-utils';

export type CustomerStatus = 'Lead' | 'Won' | 'Lost';

export const CUSTOMER_STATUSES: CustomerStatus[] = ['Lead', 'Won', 'Lost'];

export const CUSTOMER_STATUS_META: Record<CustomerStatus, { label: string; tone: string; dot: string }> = {
  Lead: { label: 'Lead', tone: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]', dot: 'bg-[var(--chart-4)]' },
  Won: { label: 'Won', tone: 'bg-[var(--success)]/12 text-[var(--success)]', dot: 'bg-[var(--success)]' },
  Lost: { label: 'Lost', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
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

/** Placeholder on every free-text note box — the record no longer stores ID numbers, so notes
 *  mustn't become a back door for them. */
export const NO_ID_NOTES_HINT = "Don't enter IC, plate or chassis numbers here.";

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
 *  customer often hasn't picked a colour yet. It must be resolved to a real colour before Won. */
export const TO_BE_CONFIRMED_COLOUR = 'To be Confirmed';
export const COLOUR_OPTIONS = [TO_BE_CONFIRMED_COLOUR, 'White', 'Black', 'Silver', 'Grey', 'Red', 'Blue'];

export const BANK_OPTIONS = ['Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank', 'AmBank', 'Affin Bank', 'Bank Islam', 'Bank Rakyat', 'BSN'];

// ---------- Financing ----------

export type FinancingType = 'Cash' | 'Loan';
export const FINANCING_TYPE_OPTIONS: { value: FinancingType; label: string }[] = [
  { value: 'Loan', label: 'Hire Purchase' },
  { value: 'Cash', label: 'Cash' },
];

// ---------- Gifts & costs ----------
//
// Two different things, kept apart:
//  • Free gifts — what the SA promised the customer. A promise costs nothing yet; `estimate` is its
//    usual price (the deal's gift budget). Once sorted out it's `done`, and `cost` is what it
//    really cost (defaults to the estimate; 0 when the dealer supplied it).
//  • Extra costs (costItems) — money out that the customer never hears about: petrol, a loader,
//    a referral fee, an extra discount from the SA's own pocket.

export type FreeGiftItem = { id: string; name: string; done: boolean; estimate?: number; cost?: number };

/** What the promised gifts should roughly cost, from their estimates; null when none are priced. */
export function giftBudget(r: CustomerRecord): number | null {
  const priced = (r.freeGifts ?? []).filter((g) => g.estimate != null);
  return priced.length ? priced.reduce((sum, g) => sum + (g.estimate ?? 0), 0) : null;
}

/** Money already out on gifts that are done. */
export function giftsSpent(r: CustomerRecord): number {
  return (r.freeGifts ?? []).filter((g) => g.done).reduce((sum, g) => sum + (g.cost ?? 0), 0);
}

/** Estimated cost of gifts promised but not done yet — money still to go out. */
export function giftsStillToDo(r: CustomerRecord): number {
  return (r.freeGifts ?? []).filter((g) => !g.done).reduce((sum, g) => sum + (g.estimate ?? 0), 0);
}

/** Extra costs only — what's in costItems. */
export function hiddenCosts(r: CustomerRecord): number {
  return (r.costItems ?? []).reduce((sum, c) => sum + c.amount, 0);
}

export type GiftBudgetReport = {
  /** Sum of every gift's estimate. */
  budget: number;
  /** What the done gifts really cost. */
  actual: number;
  /** Actual minus estimate over the done gifts that have both — positive is over budget. Gifts
   *  not done yet don't count, so a half-done deal isn't "under" just because it's unpaid. */
  variance: number;
  /** Estimates of gifts not done yet. */
  remaining: number;
  /** Extra costs — outside the gift budget. */
  hidden: number;
};

/** Budget vs actual for a deal's gifts — null when no gift has an estimate. */
export function giftBudgetReport(r: CustomerRecord): GiftBudgetReport | null {
  const budget = giftBudget(r);
  if (budget == null) return null;
  let variance = 0;
  for (const g of r.freeGifts ?? []) {
    if (g.done && g.estimate != null && g.cost != null) variance += g.cost - g.estimate;
  }
  return { budget, actual: giftsSpent(r), variance, remaining: giftsStillToDo(r), hidden: hiddenCosts(r) };
}

const sameName = (x: string, y: string) => x.trim().toLowerCase() === y.trim().toLowerCase();

/** Records from before gifts held their own cost logged it as an extra cost under the gift's name.
 *  Move it onto the gift (marking it done) so nothing is counted twice; applied on load. */
export function withGiftCosts(r: CustomerRecord): CustomerRecord {
  const gifts = r.freeGifts ?? [];
  const costs = r.costItems ?? [];
  if (!gifts.length || !costs.length || gifts.every((g) => g.cost != null)) return r;
  let moved = false;
  const remaining = [...costs];
  const freeGifts = gifts.map((g) => {
    if (g.cost != null) return g;
    const matches = remaining.filter((c) => sameName(c.label, g.name));
    if (!matches.length) return g;
    moved = true;
    for (const m of matches) remaining.splice(remaining.indexOf(m), 1);
    return { ...g, done: true, cost: matches.reduce((sum, c) => sum + c.amount, 0) };
  });
  return moved ? { ...r, freeGifts, costItems: remaining } : r;
}

// ---------- Extra costs — itemised money out that offsets commission ----------

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

  // Cash or hire purchase — part of the quote, set at Lead creation and in the quotation editor.
  financingType?: FinancingType;

  // A Lead that has booked and is waiting for the car — an optional one-tap marker, not a stage.
  // It quiets the "no update" reminder, since waiting for stock isn't the SA going quiet.
  booked?: boolean;

  // Deliberately no identity fields (IC, address, email, licence, plate, chassis, engine) and no
  // separate post-approval loan or trade-in details — the quotation is the only financial record.
  // Keeping customer data to contact details plus the quote limits what a leak could expose under
  // the PDPA. The server strips the old fields on save (server/src/routes/customers.ts);
  // migration 0009 removed them from existing rows.

  // Free-text notes
  remark?: string; // free-text customer notes — only ever set via Add Note, surfaced through Activity History

  // Commission — entered once the dealer pays (customer panel or Earnings), never prompted when marked Won.
  commission?: number;

  // Free gifts promised to the customer — see FreeGiftItem.
  freeGifts?: FreeGiftItem[];

  // Extra costs — money out the customer never hears about; offsets commission in dealProfit().
  costItems?: CostItem[];

  // Captured when marked Lost (field names predate the Cancelled → Lost rename)
  cancelReason?: string;
  cancelNotes?: string;
  previousStatus?: CustomerStatus; // captured automatically — never user-input; also the Reopen target

  // Activity History — auto-recorded, newest-last (render reversed). The sole source of truth
  // for "when did this record enter stage X" — see stageEnteredAt().
  activity?: ActivityEntry[];

  // Quotation snapshot from the Calculator (or added/edited directly in Customer Manager).
  // Only the inputs are stored — derived figures (loan amount, monthly payment, etc.) are
  // recomputed on demand so they never drift from the shared calculator math.
  quotation?: QuotationDetails;

  /** Set when the car is changed on a record that already had a quotation — that quotation still
   *  holds the previous car's rebate, rate and insurance until the SA re-quotes (which clears
   *  this). Holds what the old quotation worked out to, so the re-quote can keep the customer's
   *  agreed RM down payment and show old vs new. */
  pendingRequote?: PendingRequote;

  createdAt: number;
  updatedAt: number;
};

export type CarSpec = { brand: string; model: string; variant: string; yearMade: number };

export type PendingRequote = {
  /** The car the existing quotation was made for. */
  from: CarSpec;
  changedAt: number;
  allInPrice: number;
  downpaymentCash: number;
  loanAmount: number;
  tenureMonths: number;
  monthly: number;
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
  /** The loan rounding this quote was made with — frozen like the insurance above, so changing the
   *  setting later never moves a customer's already-quoted loan. Absent = down (older quotes). */
  loanRounding?: LoanRounding;
  /** Part of the rebate paid back to the customer in cash instead of off the price ("Give rebate
   *  as cash back" in the Calculator). Absent/0 = the whole rebate is a discount. */
  cashbackAmount?: number;
};

export type DealOutcome = 'Won' | 'Lost';

/** Everything already spent on a deal: gifts that are done plus extra costs. */
export function totalCostSpent(r: CustomerRecord): number {
  return giftsSpent(r) + hiddenCosts(r);
}

/** Net profit for a deal is commission minus everything spent on it — positive is a Won deal, negative is Lost. */
export function dealProfit(r: CustomerRecord): number {
  return (r.commission ?? 0) - totalCostSpent(r);
}

export function dealOutcome(r: CustomerRecord): DealOutcome {
  return dealProfit(r) >= 0 ? 'Won' : 'Lost';
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

// ---------- Retired stages ----------

/** The pipeline used to be Lead → Booked → In Progress → Delivered (or Cancelled); it's now just
 *  Lead → Won (or Lost) — a booked car still counts as a Lead until it's delivered, which is when
 *  it's Won. Migration 0009 converts stored records, but anything still carrying an
 *  old stage (e.g. a database the migration hasn't reached yet) is converted on load, so nothing
 *  ever looks up a stage that no longer exists. */
const RETIRED_STAGES: Record<string, CustomerStatus> = { Booked: 'Lead', 'In Progress': 'Lead', Delivered: 'Won', Cancelled: 'Lost' };

export function withCurrentStages(r: CustomerRecord): CustomerRecord {
  const status = RETIRED_STAGES[r.status] ?? r.status;
  const previousStatus = r.previousStatus && (RETIRED_STAGES[r.previousStatus] ?? r.previousStatus);
  return status === r.status && previousStatus === r.previousStatus ? r : { ...r, status, previousStatus };
}

// ---------- Cash vs loan ----------

export function isCashDeal(r: CustomerRecord): boolean {
  return r.financingType === 'Cash';
}

// ---------- Stage-entry dates, derived from activity history (never separately stored) ----------

export const STAGE_DATE_HEADER: Record<CustomerStatus, string> = {
  Lead: 'Lead Since',
  Won: 'Won On',
  Lost: 'Lost On',
};

/** Activity-log markers for when a record entered each stage, newest wording first. Records from
 *  before the stage rename only have the old wording, where a deal was won on delivery. */
const STAGE_MARKERS: Record<Exclude<CustomerStatus, 'Lead'>, string[]> = {
  Won: ['→ Won', '→ Delivered'],
  Lost: ['→ Lost', '→ Cancelled'],
};

/** Timestamp the record most recently entered `stage`, read from the activity log (reopen included
 *  since its entry also ends in "→ <stage>"). Lead has no explicit transition entry — it's creation. */
export function stageEnteredAt(r: CustomerRecord, stage: CustomerStatus): number {
  if (stage === 'Lead') return r.createdAt;
  for (const marker of STAGE_MARKERS[stage]) {
    // matches "...changed: X → Won" and "...(reason)" suffixes alike
    const matches = (r.activity ?? []).filter((e) => e.message.includes(marker));
    if (matches.length) return matches[matches.length - 1].date;
  }
  return r.updatedAt;
}

/** Whether the activity log shows the record ever reached `stage` (Lead always counts — it's creation). */
export function hasEnteredStage(r: CustomerRecord, stage: CustomerStatus): boolean {
  if (stage === 'Lead') return true;
  return STAGE_MARKERS[stage].some((marker) => (r.activity ?? []).some((e) => e.message.includes(marker)));
}

/** The date/stage pair for whatever stage the record is in right now — used by the "All" tab. */
export function currentStageEnteredAt(r: CustomerRecord): number {
  return stageEnteredAt(r, r.status);
}

/** The day a won deal counts as a sale (YYYY-MM-DD) — what the dashboard and Cost Breakdown file it under. */
export function wonDate(r: CustomerRecord): string {
  return toLocalDateStr(new Date(stageEnteredAt(r, 'Won')));
}

export function formatStageDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------- Gate validation ----------

/** This isn't an official CRM — nothing is required to move a record along except a confirmed
 *  colour when it's marked Won. */
export function canSubmitWon(colourResolved: boolean): boolean {
  return colourResolved;
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

export type WonInput = {
  colour: string;
};

export type LostInput = {
  cancelReason: string;
  cancelNotes?: string;
};

/** Generic edit-any-field patch. Structurally excludes `status` so this path can never smuggle a status transition. */
export type EditCustomerInput = Partial<Omit<CustomerRecord, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'activity'>>;
