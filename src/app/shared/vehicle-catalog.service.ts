import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { SettingsService } from './settings.service';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  DEFAULT_VEHICLES,
  VEHICLES,
  applyCatalog,
  type CatalogVehicleData,
  type CatalogVehicleEntry,
  type ModelOrder,
  type VehicleOverride,
} from '../data/calculator-data';
import { setCatalogBrandLogos } from '../data/dashboard-data';

/** A brand row of the owner's shared catalogue: one they added, or a built-in one with a new logo. */
export type CatalogBrand = { name: string; logoUrl: string | null };
type CatalogResponse = { brands: CatalogBrand[]; vehicles: CatalogVehicleEntry[]; modelOrder?: ModelOrder };

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

  private settings = inject(SettingsService);

  /** Settings → Brands I sell, in catalog order with the Primary Brand first. Price Settings,
   *  Compare, Budget and the Catalog show only these. */
  soldBrands = computed(() => {
    const sold = this.settings.brandsISell();
    const all = this.brands().filter((b) => sold.includes(b));
    const primary = sold[0];
    return all.length ? [...all.filter((b) => b === primary), ...all.filter((b) => b !== primary)] : this.brands();
  });
  /** Every variant of the brands this account sells. */
  soldVehicles = computed(() => {
    const brands = this.soldBrands();
    return this.vehicles().filter((v) => brands.includes(v.brand));
  });

  /** Whether this account has edited any variant's pricing (the Dashboard's setup checklist). */
  hasPriceEdits = computed(() => {
    this.version();
    return this.overridesById.size > 0;
  });

  /** The owner's shared catalogue as last loaded (Manage Cars reads these to show what changed). */
  catalogBrands = signal<CatalogBrand[]>([]);
  catalogEntries = signal<CatalogVehicleEntry[]>([]);
  /** The owner's model order per brand (Manage Cars → Reorder). */
  modelOrder = signal<ModelOrder>({});

  /** Every brand: the ones with cars, plus any the owner added that have no cars yet. */
  allBrands = computed(() => {
    const withCars = this.brands();
    const extra = this.catalogBrands()
      .map((b) => b.name)
      .filter((n) => !withCars.includes(n));
    return [...withCars, ...extra];
  });

  /** Loads the owner's shared catalogue (brands, cars, logos, photos, brochures) for everyone,
   *  signed in or not. Runs once at app start, before any account's own price edits are applied.
   *  A slow or failed load leaves the built-in catalogue in place rather than blocking the app. */
  async loadCatalog(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<CatalogResponse>('/api/public/catalog').pipe(timeout(6000)));
      this.catalogBrands.set(res.brands ?? []);
      this.catalogEntries.set(res.vehicles ?? []);
      this.modelOrder.set(res.modelOrder ?? {});
      this.applyAll();
    } catch {
      // Keep the built-in catalogue.
    }
  }

  /** Rebuilds the live catalogue: built-in cars, then the owner's shared changes, then this
   *  account's own Price Settings edits on top, so a user's own price always wins. */
  private applyAll(): void {
    applyCatalog(this.catalogEntries(), this.modelOrder());
    setCatalogBrandLogos(Object.fromEntries(this.catalogBrands().filter((b) => b.logoUrl).map((b) => [b.name, b.logoUrl as string])));
    for (const v of VEHICLES) {
      const override = this.overridesById.get(v.id);
      if (override) Object.assign(v, override);
    }
    this.version.update((n) => n + 1);
  }

  // ---- Owner-only changes (Manage Cars). The server refuses these for any other account. ----

  /** Uploads a logo, car photo or brochure and returns the path to store on the brand or car. */
  async uploadFile(file: File): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`/api/catalog/files?name=${encodeURIComponent(file.name)}`, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      }),
    );
    return res.url;
  }

  /** Saves the order of one brand's models for everyone; every list in the app follows it. */
  async saveModelOrder(brand: string, models: string[]): Promise<void> {
    await firstValueFrom(this.http.put('/api/catalog/model-order', { brand, models }));
    this.modelOrder.update((o) => ({ ...o, [brand]: models }));
    this.applyAll();
  }

  async saveBrand(name: string, logoUrl: string | null): Promise<void> {
    const saved = await firstValueFrom(this.http.put<CatalogBrand>('/api/catalog/brands', { name, logoUrl }));
    this.catalogBrands.update((list) => [...list.filter((b) => b.name !== saved.name), saved]);
    this.applyAll();
  }

  /** Renames a brand the owner added. The server moves its cars and every account's saved brand
   *  choices with it; here the catalogue is reloaded, and this account's own choices are moved too
   *  so they aren't saved back under the old name. */
  async renameBrand(from: string, to: string): Promise<void> {
    await firstValueFrom(this.http.post('/api/catalog/brands/rename', { from, to }));
    const s = this.settings.settings();
    if (s.dashboardTarget.brand === from) this.settings.updateDashboardTarget({ brand: to });
    const sold = s.salesDefaults.brandsISell;
    if (sold?.includes(from)) this.settings.updateSalesDefaults({ brandsISell: sold.map((b) => (b === from ? to : b)) });
    await this.loadCatalog();
  }

  async deleteBrand(name: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/catalog/brands/${encodeURIComponent(name)}`));
    this.catalogBrands.update((list) => list.filter((b) => b.name !== name));
    this.applyAll();
  }

  /** Adds a new car, or saves the owner's changes to an existing one (built-in or added). */
  async saveVehicle(id: string, data: CatalogVehicleData): Promise<void> {
    await firstValueFrom(this.http.put(`/api/catalog/vehicles/${encodeURIComponent(id)}`, data));
    this.catalogEntries.update((list) => [...list.filter((e) => e.id !== id), { id, data }]);
    this.applyAll();
  }

  /** Deletes a car the owner added, or undoes every owner change to a built-in car. */
  async deleteVehicle(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/api/catalog/vehicles/${encodeURIComponent(id)}`));
    this.catalogEntries.update((list) => list.filter((e) => e.id !== id));
    this.applyAll();
  }

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

  /** Saves several cars in one request (brand rebate editor, price list import). Resolves once the
   *  server has them, so the caller can say "Saved"; rejects if it couldn't. */
  async updateVehicles(patches: Record<string, VehicleOverride>): Promise<void> {
    const merged: Record<string, VehicleOverride> = {};
    for (const [id, patch] of Object.entries(patches)) {
      const vehicle = VEHICLES.find((v) => v.id === id);
      if (!vehicle) continue;
      Object.assign(vehicle, patch);
      merged[id] = { ...this.overridesById.get(id), ...patch };
      this.overridesById.set(id, merged[id]);
    }
    this.version.update((v) => v + 1);
    if (Object.keys(merged).length) await firstValueFrom(this.http.put('/api/vehicle-overrides', merged));
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
