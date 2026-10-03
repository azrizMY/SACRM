import { Injectable, computed, signal } from '@angular/core';
import { modelVariantLabel, vehicleTitle } from '../data/calculator-data';
import { TO_BE_CONFIRMED_COLOUR, withCurrentStages, withGiftCosts } from '../data/customer-data';
import type {
  LostInput,
  WonInput,
  CarSpec,
  CostItem,
  CustomerRecord,
  CustomerStatus,
  EditCustomerInput,
  FreeGiftItem,
  NewLeadInput,
  PendingRequote,
  QuotationDetails,
} from '../data/customer-data';
import { buildSeedRecords } from '../data/seed-data';
import { clearAllCustomers, deleteCustomer, getAllCustomers, putCustomer } from './customer-store';

/** Field groupings for the generic Edit Customer path, used only to build a coarse "Details updated: X, Y" message. */
const EDIT_SECTIONS: Record<string, (keyof EditCustomerInput)[]> = {
  Customer: ['name', 'phone', 'sourceType'],
  Vehicle: ['brand', 'model', 'variant', 'yearMade', 'colour'],
  Financing: ['financingType'],
  'Lost reason': ['cancelReason', 'cancelNotes'],
};
const EDIT_SECTIONS_ORDER = Object.keys(EDIT_SECTIONS);

/** "Chery Tiggo 8 PHEV 2026" — how a car reads in the activity log. */
function carLabel(c: CarSpec): string {
  return `${vehicleTitle(c.brand, modelVariantLabel(c.model, c.variant))} ${c.yearMade}`;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  records = signal<CustomerRecord[]>([]);

  leads = computed(() => this.records().filter((r) => r.status === 'Lead'));
  won = computed(() => this.records().filter((r) => r.status === 'Won'));
  lost = computed(() => this.records().filter((r) => r.status === 'Lost'));

  constructor() {
    this.load();
  }

  /** Refetches this account's customers — called again by AuthService after a fresh login/signup,
   *  since this service is a singleton that otherwise only fetches once for the app's lifetime,
   *  which would leak the previous account's records into a same-tab account switch. */
  async load(): Promise<void> {
    try {
      const all = await getAllCustomers();
      this.records.set(all.map((r) => withGiftCosts(withCurrentStages(r))).sort((a, b) => b.createdAt - a.createdAt));
    } catch {
      this.records.set([]);
    }
  }

  /** Clears to empty on logout so the next login on this tab never flashes the previous account's records. */
  reset(): void {
    this.records.set([]);
  }

  async addLead(input: NewLeadInput): Promise<CustomerRecord> {
    const now = Date.now();
    const record: CustomerRecord = {
      id: crypto.randomUUID(),
      status: 'Lead',
      createdAt: now,
      updatedAt: now,
      ...input,
      activity: [{ id: crypto.randomUUID(), date: now, message: 'Customer created' }],
    };
    await putCustomer(record);
    this.records.update((list) => [record, ...list]);
    return record;
  }

  /** Colour is the one thing Won requires — it's saved here with the status change. */
  async markWon(id: string, input: WonInput): Promise<void> {
    await this.mutate(id, (existing) => {
      const messages = [`Status changed: ${existing.status} → Won`];
      if (input.colour !== existing.colour) messages.push(`Colour confirmed: ${input.colour}`);
      return { changes: { ...input, status: 'Won' }, messages };
    });
  }

  async setBooked(id: string, booked: boolean): Promise<void> {
    await this.mutate(id, () => ({ changes: { booked }, messages: [booked ? 'Marked as booked' : 'Booking removed'] }));
  }

  /** Commission arrives after delivery — saved on its own, straight from the panel or Earnings. */
  async setCommission(id: string, commission: number | undefined): Promise<void> {
    await this.mutate(id, () => ({ changes: { commission } }));
  }

  async markLost(id: string, input: LostInput): Promise<void> {
    await this.mutate(id, (existing) => ({
      changes: { ...input, status: 'Lost', previousStatus: existing.status },
      messages: [`Status changed: ${existing.status} → Lost (${input.cancelReason})`],
    }));
  }

  /** Restores a lost record to the stage it was lost from. Reason/notes are kept as history
   *  rather than cleared, so a record lost and reopened twice tells its own story. */
  async reopenCustomer(id: string): Promise<void> {
    await this.mutate(id, (existing) => {
      const target: CustomerStatus = existing.previousStatus ?? 'Lead';
      const messages = [`Reopened: Lost → ${target}`];
      return { changes: { status: target, previousStatus: undefined }, messages };
    });
  }

  async editCustomer(id: string, input: EditCustomerInput): Promise<void> {
    await this.mutate(id, (existing) => {
      const changedSections = EDIT_SECTIONS_ORDER.filter((section) =>
        EDIT_SECTIONS[section].some((k) => input[k] !== undefined && input[k] !== existing[k]),
      );
      return { changes: input, messages: changedSections.length ? [`Details updated: ${changedSections.join(', ')}`] : [] };
    });
  }

  async updateFreeGifts(id: string, items: FreeGiftItem[]): Promise<void> {
    await this.mutate(id, () => ({ changes: { freeGifts: items } }));
  }

  async addNote(id: string, note: string): Promise<void> {
    await this.mutate(id, (existing) => ({
      changes: { remark: existing.remark ? `${existing.remark}\n${note}` : note },
      messages: [`Note added: ${note}`],
    }));
  }

  async updateCostItems(id: string, items: CostItem[]): Promise<void> {
    await this.mutate(id, () => ({ changes: { costItems: items } }));
  }

  async updateGiftsAndCosts(id: string, freeGifts: FreeGiftItem[], costItems: CostItem[]): Promise<void> {
    await this.mutate(id, () => ({ changes: { freeGifts, costItems } }));
  }

  /** Saving a quotation is also what resolves a pending re-quote after a car change. */
  async updateQuotation(id: string, quotation: QuotationDetails): Promise<void> {
    await this.mutate(id, (existing) => ({
      changes: { quotation, pendingRequote: undefined },
      messages: existing.pendingRequote ? [`Re-quoted for ${carLabel(existing)}`] : [],
    }));
  }

  /**
   * Swaps the customer's car. Colour always resets to "To be Confirmed" (even if the new car
   * offers the same colour name) since it has to be re-confirmed for a different car. If the record
   * has a quotation, it's flagged for re-quote — nothing is recalculated here; the SA re-quotes
   * explicitly. Changing twice before re-quoting keeps the *first* snapshot, since that's what the
   * customer was actually quoted. Won records are refused (the deal is closed, colour confirmed).
   */
  async changeCar(id: string, car: CarSpec, opts: { pendingRequote?: PendingRequote; note?: string } = {}): Promise<void> {
    await this.mutate(id, (existing) => {
      if (existing.status === 'Won') return { changes: {} };
      return {
        changes: {
          ...car,
          colour: TO_BE_CONFIRMED_COLOUR,
          pendingRequote: existing.quotation ? (existing.pendingRequote ?? opts.pendingRequote) : undefined,
        },
        messages: [`Car changed: ${carLabel(existing)} → ${carLabel(car)}${opts.note ? ` (${opts.note})` : ''}`, 'Colour reset to To be Confirmed'],
      };
    });
  }

  /** Puts a record back exactly as it was — what Undo uses after a quick action. */
  async restore(record: CustomerRecord): Promise<void> {
    await putCustomer(record);
    this.records.update((list) => list.map((r) => (r.id === record.id ? record : r)));
  }

  async deleteCustomer(id: string): Promise<void> {
    await deleteCustomer(id);
    this.records.update((list) => list.filter((r) => r.id !== id));
  }

  async clearAll(): Promise<void> {
    await clearAllCustomers();
    this.records.set([]);
  }

  async seedDummyData(): Promise<void> {
    const seeded = buildSeedRecords();
    for (const record of seeded) {
      await putCustomer(record);
    }
    this.records.update((list) => [...seeded, ...list].sort((a, b) => b.createdAt - a.createdAt));
  }

  /**
   * Single seam every mutation goes through, so activity logging can't be silently skipped by a
   * future method. `build` sees the pre-mutation record and returns the patch plus any activity
   * messages to append (curated prose, not a generic field diff).
   */
  private async mutate(
    id: string,
    build: (existing: CustomerRecord) => { changes: Partial<CustomerRecord>; messages?: string[] },
  ): Promise<void> {
    const existing = this.records().find((r) => r.id === id);
    if (!existing) return;
    const { changes, messages = [] } = build(existing);
    const activity = messages.length
      ? [...(existing.activity ?? []), ...messages.map((message) => ({ id: crypto.randomUUID(), date: Date.now(), message }))]
      : existing.activity;
    const updated: CustomerRecord = { ...existing, ...changes, activity, updatedAt: Date.now() };
    await putCustomer(updated);
    this.records.update((list) => list.map((r) => (r.id === id ? updated : r)));
  }
}
