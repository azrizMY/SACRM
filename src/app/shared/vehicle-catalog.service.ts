import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_VEHICLES, VEHICLE_CATALOG_STORAGE_KEY, VEHICLES, type Vehicle } from '../data/calculator-data';
import { SettingsService } from './settings.service';

export type NewVehicleInput = Omit<Vehicle, 'id'>;
export type EditVehicleInput = Partial<Omit<Vehicle, 'id'>>;

const DECLARED_BRANDS_STORAGE_KEY = 'redline-declared-brands';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function loadDeclaredBrands(): string[] {
  try {
    const raw = localStorage.getItem(DECLARED_BRANDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((b) => typeof b === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Owns the runtime-editable car database (Account Settings → Car Database): add/edit/remove a car
 * or brand, all backed by the same VEHICLES array every other page already reads. Mutates that
 * array in place and persists the whole catalog to localStorage, so edits survive reloads and are
 * visible everywhere (Calculator, Customer Manager, PDFs) without those pages knowing this service
 * exists.
 */
@Injectable({ providedIn: 'root' })
export class VehicleCatalogService {
  /** Bumped on every mutation so components depending on it re-derive brand/model lists reactively. */
  private version = signal(0);

  /** Brands declared (name + logo) before any car exists for them yet — lets a brand be set up in
   *  the Brand & Model Catalog ahead of the Car Database having any pricing for it. Once a brand has
   *  a car, it's already in `brands` via VEHICLES, so staying in this list too is harmless. */
  private declaredBrandsList = signal<string[]>(loadDeclaredBrands());

  /** A fresh array each time — VEHICLES is mutated in place, so returning the same reference would
   *  make Angular's equality check treat every add/remove as "unchanged" and silently skip
   *  notifying anything computed from this (brand/model lists, table rows, etc.). */
  vehicles = computed(() => {
    this.version();
    return [...VEHICLES];
  });

  brands = computed(() => {
    this.version();
    return Array.from(new Set([...VEHICLES.map((v) => v.brand), ...this.declaredBrandsList()]));
  });

  constructor(private settingsService: SettingsService) {}

  addVehicle(input: NewVehicleInput): Vehicle {
    const vehicle: Vehicle = { ...input, id: this.uniqueId(input.brand, input.model, input.variant, input.year) };
    VEHICLES.push(vehicle);
    this.persist();
    return vehicle;
  }

  updateVehicle(id: string, patch: EditVehicleInput) {
    const vehicle = VEHICLES.find((v) => v.id === id);
    if (!vehicle) return;
    Object.assign(vehicle, patch);
    this.persist();
  }

  removeVehicle(id: string) {
    const index = VEHICLES.findIndex((v) => v.id === id);
    if (index === -1) return;
    VEHICLES.splice(index, 1);
    this.settingsService.removeVehicleInsurance(id);
    this.settingsService.removeVehicleOffers(id);
    this.persist();
  }

  /** Removes every year-row for this exact brand/model/variant at once — used when a variant is
   *  deleted from the Brand & Model Catalog, where "the variant" and "its pricing rows" are the
   *  same thing under the hood. */
  removeVariant(brand: string, model: string, variant: string) {
    const ids = VEHICLES.filter((v) => v.brand === brand && v.model === model && v.variant === variant).map((v) => v.id);
    for (const id of ids) {
      const index = VEHICLES.findIndex((v) => v.id === id);
      if (index !== -1) VEHICLES.splice(index, 1);
      this.settingsService.removeVehicleInsurance(id);
      this.settingsService.removeVehicleOffers(id);
    }
    // The photo is shared across every model year of this variant (see variantKey) — safe to drop
    // only here, once every year-row is gone, not from a single-year removeVehicle().
    this.settingsService.removeVariantPhoto(brand, model, variant);
    this.persist();
  }

  /** Declares a brand with no cars yet, so it shows up for logo upload and model creation right
   *  away. No-op if the name is blank or the brand already exists (via a car or an earlier declare). */
  addBrand(name: string) {
    const trimmed = name.trim();
    if (!trimmed || this.brands().includes(trimmed)) return;
    this.declaredBrandsList.update((list) => [...list, trimmed]);
    this.persistDeclaredBrands();
  }

  /** Drops a brand that was declared but never got a car — refuses if it has any, since that brand
   *  identity is now owned by those rows, not this list. */
  removeBrand(name: string) {
    if (VEHICLES.some((v) => v.brand === name)) return;
    this.declaredBrandsList.update((list) => list.filter((b) => b !== name));
    this.persistDeclaredBrands();
  }

  /** Restores the factory catalog, discarding every custom car, brand, and edit. */
  resetToFactoryDefaults() {
    VEHICLES.length = 0;
    VEHICLES.push(...DEFAULT_VEHICLES.map((v) => ({ ...v })));
    try {
      localStorage.removeItem(VEHICLE_CATALOG_STORAGE_KEY);
      localStorage.removeItem(DECLARED_BRANDS_STORAGE_KEY);
    } catch {
      /* localStorage unavailable — in-memory catalog still resets for this session */
    }
    this.declaredBrandsList.set([]);
    this.version.update((v) => v + 1);
  }

  private persistDeclaredBrands() {
    this.version.update((v) => v + 1);
    try {
      localStorage.setItem(DECLARED_BRANDS_STORAGE_KEY, JSON.stringify(this.declaredBrandsList()));
    } catch {
      /* localStorage unavailable — declared brands still hold for this session */
    }
  }

  private uniqueId(brand: string, model: string, variant: string, year: number): string {
    const base = slugify(`${brand}-${model}-${variant}-${year}`) || `vehicle-${Date.now()}`;
    let id = base;
    let n = 2;
    while (VEHICLES.some((v) => v.id === id)) {
      id = `${base}-${n++}`;
    }
    return id;
  }

  private persist() {
    this.version.update((v) => v + 1);
    try {
      localStorage.setItem(VEHICLE_CATALOG_STORAGE_KEY, JSON.stringify(VEHICLES));
    } catch {
      /* localStorage unavailable — catalog still holds for this session */
    }
  }
}
