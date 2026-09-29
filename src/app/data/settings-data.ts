import type { InsuranceQuotationDetails, RateType } from './calculator-data';

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
  /** Whether a new quote starts with Additional Rebate ticked (for cars that have one). Optional —
   *  absent means ticked, the original behaviour. */
  additionalRebateByDefault?: boolean;
  /** Which 3 tenure years (of 1-9) the Calculator's repayment table starts on for every new quote. */
  defaultTenureYears: number[];
  /** The choices in every Lead Source dropdown (e.g. "Roadshow – Mid Valley"). Optional so settings
   *  saved before this existed still load; readers fall back to SOURCE_TYPES. */
  leadSources?: string[];
  /** The account's bank panel and insurer choices — only the ones this advisor actually works
   *  with. Optional; readers fall back to BANK_OPTIONS / INSURANCE_OPTIONS. */
  banks?: string[];
  insurers?: string[];
  /** Which of `leadSources` the Calculator's Add Lead form starts on. */
  leadSource?: string;
  /** A lead with no activity for this many days gets Customer Manager's "No update" flag. */
  staleLeadDays?: number;
  /** Cost Breakdown's quick-add buttons (e.g. Tinted RM 350). */
  costPresets?: CostPreset[];
};

export type CostPreset = { label: string; amount: number };

export const DEFAULT_LEAD_SOURCE = 'Walk-in';
export const DEFAULT_STALE_LEAD_DAYS = 7;
export const DEFAULT_COST_PRESETS: CostPreset[] = [
  { label: 'Tinted', amount: 350 },
  { label: 'Dashcam', amount: 250 },
  { label: 'Carpet', amount: 150 },
  { label: 'Perfume', amount: 30 },
  { label: 'Phone Holder', amount: 40 },
  { label: 'Petrol', amount: 50 },
  { label: 'Coating', amount: 400 },
  { label: 'Loader', amount: 100 },
];

/** Per-vehicle itemized insurance quotation overrides, keyed by Vehicle.id — edited from Account
 *  Settings ("Edit Car") or the Calculator's Insurance card. Absent entries fall back to
 *  defaultInsuranceQuotation() computed from the vehicle's own catalog figures. */
export type VehicleInsuranceOverrides = Record<string, InsuranceQuotationDetails>;

export type NotificationPrefs = {
  newLeadAlerts: boolean;
  bookingReminders: boolean;
  weeklySummary: boolean;
};

/** Which single brand the Dashboard's Monthly Target and Performance by Model focus on. */
export type DashboardTarget = {
  brand: string;
  target: number;
};

export type AppSettings = {
  salesDefaults: SalesDefaults;
  notifications: NotificationPrefs;
  dashboardTarget: DashboardTarget;
  vehicleInsurance: VehicleInsuranceOverrides;
};

export const DEFAULT_SETTINGS: AppSettings = {
  salesDefaults: { interestRate: 2.5, downpaymentPct: 10, ncd: 0, basicPremiumRatePct: 3.27, defaultRateType: 'flat', defaultTenureYears: [9, 7, 5] },
  notifications: { newLeadAlerts: true, bookingReminders: true, weeklySummary: false },
  dashboardTarget: { brand: 'Chery', target: 4 },
  vehicleInsurance: {},
};
