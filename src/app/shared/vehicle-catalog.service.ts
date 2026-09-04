import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_VEHICLES, VEHICLES, type VehicleOverride } from '../data/calculator-data';

/**
 * Owns the runtime-editable pricing catalog (Price Settings): edit a variant's price, rates, and
 * model years, backed by the same VEHICLES array every other page already reads. Brands, models,
 * and variants themselves are hardcoded in calculator-data.ts by the developer — not editable here,
 * and there's always exactly one row per variant (see Vehicle.years for its model years) so nothing
 * here ever adds or removes a row, only patches one in place. Every edit is saved per-account via
 * the Worker API (`/api/vehicle-overrides`), keyed by vehicle id, rather than persisting the whole
 * catalog — so a developer's own catalog changes (a renamed trim, a new variant) always take effect
 * immediately, even for an account with saved pricing edits.
 */
@Injectable({ providedIn: 'root' })
export class VehicleCatalogService {
  /** Bumped on every mutation so components depending on it re-derive brand/model lists reactively. */
  private version = signal(0);
  private overridesById = new Map<string, VehicleOverride>();

  constructor(private http: HttpClient) {}

  /** A fresh array each time — VEHICLES is mutated in place, so returning the same reference would
   *  make Angular's equality check treat every edit as "unchanged" and silently skip notifying
   *  anything computed from this (brand/model lists, table rows, etc.). */
  vehicles = computed(() => {
    this.version();
    return [...VEHICLES];
  });

  brands = computed(() => {
    this.version();
    return Array.from(new Set(VEHICLES.map((v) => v.brand)));
  });

  /** Fetches the signed-in account's saved price/rate/year overrides and applies them onto the
   *  hardcoded catalog — called once per login/session-restore by AuthService, never directly by
   *  components. */
  async loadOverrides(): Promise<void> {
    try {
      const overrides = await firstValueFrom(this.http.get<Record<string, VehicleOverride>>('/api/vehicle-overrides'));
      this.overridesById = new Map(Object.entries(overrides));
      for (const v of VEHICLES) {
        const override = this.overridesById.get(v.id);
        if (override) Object.assign(v, override);
      }
    } catch {
      this.overridesById = new Map();
    }
    this.version.update((v) => v + 1);
  }

  /** Reverts every vehicle to its hardcoded default and drops the cached overrides — called on
   *  logout so the next login on this tab doesn't start from the previous account's pricing. Never
   *  touches what's actually saved on the server; a later login just re-fetches it. */
  resetOverrides(): void {
    const defaultsById = new Map(DEFAULT_VEHICLES.map((v) => [v.id, v]));
    for (const vehicle of VEHICLES) {
      const original = defaultsById.get(vehicle.id);
      if (original) Object.assign(vehicle, original, { years: original.years.map((y) => ({ ...y })) });
    }
    this.overridesById = new Map();
    this.version.update((v) => v + 1);
  }

  updateVehicle(id: string, patch: VehicleOverride) {
    const vehicle = VEHICLES.find((v) => v.id === id);
    if (!vehicle) return;
    Object.assign(vehicle, patch);
    const merged = { ...this.overridesById.get(id), ...patch };
    this.overridesById.set(id, merged);
    this.version.update((v) => v + 1);
    firstValueFrom(this.http.put(`/api/vehicle-overrides/${encodeURIComponent(id)}`, merged)).catch((err) => {
      console.error('Failed to save vehicle override.', err);
    });
  }
}
