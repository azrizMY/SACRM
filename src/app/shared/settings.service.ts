import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type DashboardTarget,
  type NotificationPrefs,
  type SalesDefaults,
} from '../data/settings-data';
import { DEFAULT_EPR, defaultInsuranceQuotation, type InsuranceQuotationDetails, type Vehicle } from '../data/calculator-data';

const STORAGE_KEY = 'redline-app-settings';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        salesDefaults: { ...DEFAULT_SETTINGS.salesDefaults, ...parsed.salesDefaults },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
        dashboardTarget: { ...DEFAULT_SETTINGS.dashboardTarget, ...parsed.dashboardTarget },
        vehicleInsurance: { ...DEFAULT_SETTINGS.vehicleInsurance, ...parsed.vehicleInsurance },
        vehicleOffers: { ...DEFAULT_SETTINGS.vehicleOffers, ...parsed.vehicleOffers },
        brandLogos: { ...DEFAULT_SETTINGS.brandLogos, ...parsed.brandLogos },
      };
    }
  } catch {
    /* ignore corrupt/unavailable storage, fall back to default */
  }
  return DEFAULT_SETTINGS;
}

/** App-wide preferences: Calculator defaults, notification toggles, and dashboard focus brand — editable from Account Settings. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  settings = signal<AppSettings>(loadSettings());

  updateSalesDefaults(patch: Partial<SalesDefaults>) {
    this.persist({ ...this.settings(), salesDefaults: { ...this.settings().salesDefaults, ...patch } });
  }

  updateNotifications(patch: Partial<NotificationPrefs>) {
    this.persist({ ...this.settings(), notifications: { ...this.settings().notifications, ...patch } });
  }

  updateDashboardTarget(patch: Partial<DashboardTarget>) {
    this.persist({ ...this.settings(), dashboardTarget: { ...this.settings().dashboardTarget, ...patch } });
  }

  /** The saved itemized insurance quotation for this car, or a sensible starting point derived
   *  from its own catalog figures when the SA hasn't customized one yet. */
  getVehicleInsurance(vehicle: Vehicle, fallbackBasicPremium: number): InsuranceQuotationDetails {
    const saved = this.settings().vehicleInsurance[vehicle.id];
    if (!saved) return defaultInsuranceQuotation(vehicle, fallbackBasicPremium);
    // Backfills quotations saved before EPR replaced the old Discount (%) field.
    return { ...saved, epr: saved.epr ?? DEFAULT_EPR };
  }

  updateVehicleInsurance(vehicleId: string, details: InsuranceQuotationDetails) {
    this.persist({ ...this.settings(), vehicleInsurance: { ...this.settings().vehicleInsurance, [vehicleId]: details } });
  }

  /** Drops a car's saved insurance override — used when the car itself is removed from the database. */
  removeVehicleInsurance(vehicleId: string) {
    const { [vehicleId]: _removed, ...rest } = this.settings().vehicleInsurance;
    this.persist({ ...this.settings(), vehicleInsurance: rest });
  }

  /** The "What's Included" checklist for this exact car (brand/model/variant/year) — empty
   *  (checklist hidden) unless the SA has set one, since only a handful of variants carry a
   *  special offer. */
  getVehicleOffers(vehicleId: string): string[] {
    return this.settings().vehicleOffers[vehicleId] ?? [];
  }

  updateVehicleOffers(vehicleId: string, offers: string[]) {
    this.persist({ ...this.settings(), vehicleOffers: { ...this.settings().vehicleOffers, [vehicleId]: offers } });
  }

  /** Drops a car's saved offers checklist — used when the car itself is removed from the database. */
  removeVehicleOffers(vehicleId: string) {
    const { [vehicleId]: _removed, ...rest } = this.settings().vehicleOffers;
    this.persist({ ...this.settings(), vehicleOffers: rest });
  }

  /** The uploaded logo for this brand (a data URL), or null when the SA hasn't uploaded one yet. */
  getBrandLogo(brand: string): string | null {
    return this.settings().brandLogos[brand] ?? null;
  }

  updateBrandLogo(brand: string, dataUrl: string) {
    this.persist({ ...this.settings(), brandLogos: { ...this.settings().brandLogos, [brand]: dataUrl } });
  }

  removeBrandLogo(brand: string) {
    const { [brand]: _removed, ...rest } = this.settings().brandLogos;
    this.persist({ ...this.settings(), brandLogos: rest });
  }

  resetToDefaults() {
    this.persist(DEFAULT_SETTINGS);
  }

  private persist(value: AppSettings) {
    this.settings.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* localStorage unavailable — settings still hold for this session */
    }
  }
}
