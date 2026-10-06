import type { InsuranceQuotationDetails, LoanRounding, RateType } from './calculator-data';
import type { Lang } from '../shared/i18n-core';

export type SalesDefaults = {
  interestRate: number;
  /** Default effective rate (EIR) for cars without their own. Optional — when unset, quoting EIR
   *  on such a car asks for the bank's rate instead of guessing (a flat rate is never reused as an EIR). */
  effectiveRate?: number;
  downpaymentPct: number;
  ncd: number;
  /** Default Basic Premium rate (% of RRP), editable from the Calculator or Account Settings. */
  basicPremiumRatePct: number;
  /** Which Rate Type the Calculator starts every new quote on. */
  defaultRateType: RateType;
  /** Language of the app's own screens (Settings → Language). Absent = English. */
  uiLanguage?: Lang;
  /** Language of everything customers see — quote posters, offer sheets and the customer link —
   *  chosen separately from the UI language. Absent = English. */
  posterLanguage?: Lang;
  /** Colour of every poster, offer sheet and the Live Screen (an id from POSTER_ACCENTS). Absent = Redline red. */
  posterAccent?: string;
  /** Whether a new quote starts with Additional Rebate ticked (for cars that have one). Optional —
   *  absent means ticked, the original behaviour. */
  additionalRebateByDefault?: boolean;
  /** Which way every quote rounds the loan to RM100 — see LoanRounding. Optional; absent = down. */
  loanRounding?: LoanRounding;
  /** Show "Give rebate as cash back" in the Calculator. Optional; absent = off — only for dealers
   *  that pay rebates out as cash. */
  allowCashback?: boolean;
  /** Which 3 tenure years (of 1-9) the Calculator's repayment table starts on for every new quote. */
  defaultTenureYears: number[];
  /** The choices in every Lead Source dropdown (e.g. "Roadshow – Mid Valley"). Optional so settings
   *  saved before this existed still load; readers fall back to SOURCE_TYPES. */
  leadSources?: string[];
  /** The account's bank panel choices — only the ones this advisor actually works with.
   *  Optional; readers fall back to BANK_OPTIONS. */
  banks?: string[];
  /** Which of `leadSources` the Calculator's Add Lead form starts on. */
  leadSource?: string;
  /** A lead with no activity for this many days gets Customer Manager's "No update" flag. */
  staleLeadDays?: number;
  /** One-tap extra costs (e.g. Petrol RM 50). */
  costPresets?: CostPreset[];
  /** One-tap free gifts with their usual price (e.g. Tinted RM 350). */
  giftPresets?: CostPreset[];
};

export type CostPreset = { label: string; amount: number };

export const DEFAULT_LEAD_SOURCE = 'Walk-in';
export const DEFAULT_STALE_LEAD_DAYS = 7;
export const DEFAULT_GIFT_PRESETS: CostPreset[] = [
  { label: 'Tinted', amount: 350 },
  { label: 'Dashcam', amount: 250 },
  { label: 'Carpet', amount: 150 },
  { label: 'Coating', amount: 400 },
  { label: 'Perfume', amount: 30 },
  { label: 'Phone Holder', amount: 40 },
];
export const DEFAULT_COST_PRESETS: CostPreset[] = [
  { label: 'Petrol', amount: 50 },
  { label: 'Loader', amount: 100 },
  { label: 'Referral fee', amount: 200 },
];

/** Per-vehicle itemized insurance quotation overrides, keyed by Vehicle.id — edited from Account
 *  Settings ("Edit Car") or the Calculator's Insurance card. Absent entries fall back to
 *  defaultInsuranceQuotation() computed from the vehicle's own catalog figures. */
export type VehicleInsuranceOverrides = Record<string, InsuranceQuotationDetails>;

export type NotificationPrefs = {
  newLeadAlerts: boolean;
  weeklySummary: boolean;
};

/** Which single brand the Dashboard's Monthly Target and Performance by Model focus on. */
export type DashboardTarget = {
  brand: string;
  target: number;
};

/** The Dashboard's "Get set up" checklist. Most steps are read from real data (photo, price edits,
 *  customers); these are the ones with nothing else to check. */
export type Onboarding = {
  /** Copied a customer link, or copied/shared/downloaded a quote poster. */
  quoteShared?: boolean;
  /** Closed the checklist before finishing it. */
  hidden?: boolean;
};

// ---------- Live Mode (TikTok Live calculator) ----------

/** The Live Screen's fixed size — it shares the stream's tall 1080×1920 frame with the camera. */
export type LiveScreenSize = 'square' | 'bigNumbers' | 'bigCamera';

export const LIVE_SCREEN_SIZES: Record<LiveScreenSize, { width: number; height: number; label: string; hint: string }> = {
  square: { width: 1080, height: 1080, label: 'Square', hint: 'Balanced — about 45% left for your camera' },
  bigNumbers: { width: 1080, height: 1350, label: 'Big numbers', hint: 'The quote matters most — about 30% left for your camera' },
  bigCamera: { width: 1080, height: 810, label: 'Big camera', hint: 'You do most of the talking — about 60% left for your camera' },
};

/** The last quote on the Live page, so reopening it carries on where you stopped. */
export type LiveQuoteMemory = {
  vehicleId: string;
  year: number;
  downpaymentType: 'percent' | 'amount';
  downpaymentValue: number;
  tenureYears: number[];
  highlightedTenure: number;
};

/** Live Mode's own customisation — only how the Live Screen looks. Edited on the Live page only
 *  (never on the Settings page); the quote itself still follows Settings and Price Settings. */
export type LiveSettings = {
  size: LiveScreenSize;
  /** Language of the Live Screen itself; the controls follow the app language. */
  lang: 'ms' | 'en';
  /** Off by default: TikTok restricts sharing contact details and sending viewers off the platform. */
  showPhone: boolean;
  showWhatsApp: boolean;
  showShowroom: boolean;
  showAdvisor: boolean;
  showBrandLogo: boolean;
  showEstimateNote: boolean;
  /** Vehicle ids pinned for one-tap switching. */
  favourites: string[];
  lastQuote?: LiveQuoteMemory;
};

export const DEFAULT_LIVE_SETTINGS: LiveSettings = {
  size: 'square',
  lang: 'ms',
  showPhone: false,
  showWhatsApp: false,
  showShowroom: false,
  showAdvisor: true,
  showBrandLogo: true,
  showEstimateNote: true,
  favourites: [],
};

export type AppSettings = {
  salesDefaults: SalesDefaults;
  notifications: NotificationPrefs;
  dashboardTarget: DashboardTarget;
  vehicleInsurance: VehicleInsuranceOverrides;
  onboarding: Onboarding;
  live: LiveSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  salesDefaults: { interestRate: 2.3, effectiveRate: 4.3, downpaymentPct: 10, ncd: 0, basicPremiumRatePct: 3.27, defaultRateType: 'flat', defaultTenureYears: [9, 7, 5] },
  notifications: { newLeadAlerts: true, weeklySummary: false },
  dashboardTarget: { brand: 'Chery', target: 4 },
  vehicleInsurance: {},
  onboarding: {},
  live: DEFAULT_LIVE_SETTINGS,
};
