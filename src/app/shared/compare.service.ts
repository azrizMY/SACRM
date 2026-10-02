import { Injectable, signal } from '@angular/core';
import type { CompareOverrides, CompareSetup } from '../data/compare-data';

export const MAX_COMPARE = 3;

export type CompareSlot = {
  vehicleId: string;
  year: number;
  /** Set only for the car handed over from the Calculator (see CompareOverrides). */
  overrides?: CompareOverrides;
};

/**
 * The cars on the Compare page and the loan setup they share. Lives at the root so the selection
 * survives leaving the page, and so the Calculator can hand a quote over ("Compare with…") and
 * the Compare page can hand a car back ("Open in Calculator").
 */
@Injectable({ providedIn: 'root' })
export class CompareService {
  readonly slots = signal<CompareSlot[]>([]);
  /** Null until set from the Calculator or the account's defaults on first visit. */
  readonly setup = signal<CompareSetup | null>(null);

  /** A car the Calculator should open on next time it loads, then forget. */
  private calculatorCar: { vehicleId: string; year: number } | null = null;

  /** From the Calculator: the quoted car (with its own figures) becomes the first column and its
   *  loan setup becomes the comparison's. Other cars already picked stay. */
  startFromQuote(slot: CompareSlot, setup: CompareSetup) {
    const others = this.slots().filter((s) => s.vehicleId !== slot.vehicleId);
    this.slots.set([slot, ...others].slice(0, MAX_COMPARE));
    this.setup.set(setup);
  }

  add(slot: CompareSlot) {
    if (this.slots().length >= MAX_COMPARE) return;
    this.slots.update((list) => [...list.filter((s) => s.vehicleId !== slot.vehicleId), slot]);
  }

  /** A column's dropdown: put this car in column `index` (an empty column appends), or clear it with null. */
  setCar(index: number, vehicleId: string | null, year = 0) {
    const list = this.slots();
    if (vehicleId === null) return this.remove(index);
    if (list.some((s, i) => s.vehicleId === vehicleId && i !== index)) return; // already in another column
    const slot: CompareSlot = { vehicleId, year };
    if (index < list.length) this.slots.set(list.map((s, i) => (i === index ? slot : s)));
    else if (list.length < MAX_COMPARE) this.slots.set([...list, slot]);
  }

  remove(index: number) {
    this.slots.update((list) => list.filter((_, i) => i !== index));
  }

  setYear(index: number, year: number) {
    // Rebate and insurance overrides belong to the year they were quoted for.
    this.slots.update((list) => list.map((s, i) => (i === index ? { vehicleId: s.vehicleId, year } : s)));
  }

  openInCalculator(vehicleId: string, year: number) {
    this.calculatorCar = { vehicleId, year };
  }

  takeCalculatorCar(): { vehicleId: string; year: number } | null {
    const car = this.calculatorCar;
    this.calculatorCar = null;
    return car;
  }
}
