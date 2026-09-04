import type { InsuranceQuotationDetails, RateType } from './calculator-data';

export type SalesDefaults = {
  interestRate: number;
  downpaymentPct: number;
  ncd: number;
  /** Default Basic Premium rate (% of RRP), editable from the Calculator or Account Settings. */
  basicPremiumRatePct: number;
  /** Which Rate Type the Calculator starts every new quote on. */
  defaultRateType: RateType;
  /** Which 3 tenure years (of 1-9) the Calculator's repayment table starts on for every new quote. */
  defaultTenureYears: number[];
};

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
  salesDefaults: { interestRate: 3.5, downpaymentPct: 10, ncd: 0, basicPremiumRatePct: 3.6, defaultRateType: 'flat', defaultTenureYears: [9, 7, 5] },
  notifications: { newLeadAlerts: true, bookingReminders: true, weeklySummary: false },
  dashboardTarget: { brand: 'Chery', target: 20 },
  vehicleInsurance: {},
};
