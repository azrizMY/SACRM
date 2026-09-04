import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type DashboardTarget,
  type NotificationPrefs,
  type SalesDefaults,
} from '../data/settings-data';
import { DEFAULT_EPR, defaultInsuranceQuotation, type InsuranceQuotationDetails, type Vehicle } from '../data/calculator-data';

/** Merges whatever the server actually has on file onto the shipped defaults — an account with no
 *  saved settings yet just gets `{}` back, and a partially-saved blob from before a field existed
 *  still works, same defensive merge this did when it read straight from localStorage. */
function mergeSettings(saved: Partial<AppSettings> | null): AppSettings {
  return {
    salesDefaults: { ...DEFAULT_SETTINGS.salesDefaults, ...saved?.salesDefaults },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...saved?.notifications },
    dashboardTarget: { ...DEFAULT_SETTINGS.dashboardTarget, ...saved?.dashboardTarget },
    vehicleInsurance: { ...DEFAULT_SETTINGS.vehicleInsurance, ...saved?.vehicleInsurance },
  };
}

/** App-wide preferences: Calculator defaults, notification toggles, and dashboard focus brand —
 *  editable from Account Settings, persisted per-account via the Worker API (`/api/settings`) so
 *  they follow the signed-in user across devices instead of living in this browser's storage. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  settings = signal<AppSettings>(DEFAULT_SETTINGS);

  constructor(private http: HttpClient) {}

  /** Populates `settings` from the signed-in account — called once per login/session-restore by
   *  AuthService, never directly by components. */
  async load(): Promise<void> {
    try {
      const saved = await firstValueFrom(this.http.get<Partial<AppSettings>>('/api/settings'));
      this.settings.set(mergeSettings(saved));
    } catch {
      this.settings.set(DEFAULT_SETTINGS);
    }
  }

  /** Drops back to shipped defaults — called on logout so the next login on this tab never shows
   *  a flash of the previous account's settings. */
  reset() {
    this.settings.set(DEFAULT_SETTINGS);
  }

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

  resetToDefaults() {
    this.persist(DEFAULT_SETTINGS);
  }

  /** Updates the signal immediately (so the UI never waits on the network) and saves in the
   *  background — a failed save just means the edit won't survive a reload, same risk profile as
   *  the old localStorage version silently failing on a full quota. */
  private persist(value: AppSettings) {
    this.settings.set(value);
    firstValueFrom(this.http.put('/api/settings', value)).catch((err) => {
      console.error('Failed to save settings.', err);
    });
  }
}
