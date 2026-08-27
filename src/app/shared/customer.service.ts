import { Injectable, computed, signal } from '@angular/core';
import { formatRM } from '../data/calculator-data';
import type {
  BookedInput,
  CancelledInput,
  CostingInput,
  CostItem,
  CustomerRecord,
  CustomerStatus,
  DeliveredInput,
  EditCustomerInput,
  FreeGiftItem,
  InProgressInput,
  NewLeadInput,
  QuotationDetails,
  TestDriveInput,
} from '../data/customer-data';
import { buildSeedRecords } from '../data/seed-data';
import { clearAllCustomers, deleteCustomer, getAllCustomers, putCustomer } from './customer-store';

/** Field groupings for the generic Edit Customer path, used only to build a coarse "Details updated: X, Y" message. */
const EDIT_SECTIONS: Record<string, (keyof EditCustomerInput)[]> = {
  Customer: ['name', 'phone', 'icNo', 'address', 'email', 'drivingLicenceNo', 'sourceType'],
  Vehicle: ['brand', 'model', 'variant', 'yearMade', 'colour'],
  Payment: ['bookingFee', 'downpayment', 'ncd'],
  'Trade-in': ['tradeInStatus', 'tradeInVehicle', 'tradeInValue'],
  Documents: ['documentStatus'],
  Financing: ['financingType', 'bankPanel', 'loanAmount', 'loanTenureMonths', 'loanInterestRate', 'paymentStatus', 'downPaymentStatus'],
  Delivery: ['insuranceName', 'plateNo', 'deliveryDate', 'chassisNo', 'engineNo', 'deliveryNotes'],
  Cancellation: ['cancelReason', 'cancelNotes', 'refundStatus'],
};
const EDIT_SECTIONS_ORDER = Object.keys(EDIT_SECTIONS);

@Injectable({ providedIn: 'root' })
export class CustomerService {
  records = signal<CustomerRecord[]>([]);

  leads = computed(() => this.records().filter((r) => r.status === 'Lead'));
  booked = computed(() => this.records().filter((r) => r.status === 'Booked'));
  inProgress = computed(() => this.records().filter((r) => r.status === 'In Progress'));
  delivered = computed(() => this.records().filter((r) => r.status === 'Delivered'));
  cancelled = computed(() => this.records().filter((r) => r.status === 'Cancelled'));

  constructor() {
    getAllCustomers().then((all) => {
      this.records.set(all.sort((a, b) => b.createdAt - a.createdAt));
    });
  }

  async addLead(input: NewLeadInput): Promise<void> {
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
  }

  async recordTestDrive(id: string, input: TestDriveInput): Promise<void> {
    await this.mutate(id, () => ({
      changes: { icNo: input.icNo, drivingLicenceNo: input.drivingLicenceNo, address: input.address, email: input.email, testDriveDate: input.testDriveDate },
      messages: [`Test drive recorded · ${input.testDriveDate}`],
    }));
  }

  async markBooked(id: string, input: BookedInput): Promise<void> {
    await this.mutate(id, (existing) => {
      const messages: string[] = [`Status changed: ${existing.status} → Booked`];
      if (input.bookingFee) messages.push(`Booking fee set to ${formatRM(input.bookingFee)}`);
      return {
        // Documents defaults to "Not Submitted" on entering Booked rather than staying unset —
        // preserve it if already present (e.g. a reopened record already has a real status).
        changes: { ...input, status: 'Booked', documentStatus: existing.documentStatus ?? 'NO' },
        messages,
      };
    });
  }

  async markInProgress(id: string, input: InProgressInput): Promise<void> {
    await this.mutate(id, (existing) => {
      const messages = [`Status changed: ${existing.status} → In Progress`];
      if (input.financingType === 'Loan') {
        messages.push(
          `Financing confirmed: Loan · ${input.bankPanel} · ${formatRM(input.loanAmount ?? 0)} · ${input.loanTenureMonths}mo · ${input.loanInterestRate}% · Down payment ${input.downPaymentStatus}`,
        );
        messages.push('Documents: Approved (loan reaching In Progress means the bank has signed off)');
      } else {
        messages.push(`Financing confirmed: Cash · Payment ${input.paymentStatus}`);
      }
      // Reaching In Progress on a loan deal means the bank has approved — the documents that got it
      // there are done, so Document Status advances with it instead of sitting at its Booked-stage value.
      return { changes: { ...input, status: 'In Progress', documentStatus: input.financingType === 'Loan' ? 'APPROVE' : existing.documentStatus }, messages };
    });
  }

  async markDelivered(id: string, input: DeliveredInput): Promise<void> {
    await this.mutate(id, (existing) => {
      const messages = [`Status changed: ${existing.status} → Delivered`, `Delivery completed · ${input.plateNo}`];
      // The car doesn't go out the door on an unsettled balance — whichever payment status
      // applies (loan deposit or cash payment) advances to Fully Paid with it, rather than
      // staying stale just because the SA forgot to tick it before this transition.
      const downPaymentStatus = existing.financingType === 'Loan' ? 'Fully Paid' : existing.downPaymentStatus;
      const paymentStatus = existing.financingType === 'Cash' ? 'Fully Paid' : existing.paymentStatus;
      if (existing.financingType === 'Loan' && existing.downPaymentStatus !== 'Fully Paid') {
        messages.push('Down payment status: Fully Paid (car handed over)');
      }
      if (existing.financingType === 'Cash' && existing.paymentStatus !== 'Fully Paid') {
        messages.push('Payment status: Fully Paid (car handed over)');
      }
      return { changes: { ...input, status: 'Delivered', downPaymentStatus, paymentStatus }, messages };
    });
  }

  async markCancelled(id: string, input: CancelledInput): Promise<void> {
    await this.mutate(id, (existing) => ({
      changes: { ...input, status: 'Cancelled', previousStatus: existing.status },
      messages: [`Status changed: ${existing.status} → Cancelled (${input.cancelReason})`],
    }));
  }

  /** Restores a cancelled record to the stage it was cancelled from. Reason/notes are kept as
   *  history rather than cleared, so a record cancelled and reopened twice tells its own story. */
  async reopenCustomer(id: string): Promise<void> {
    await this.mutate(id, (existing) => {
      const target: CustomerStatus = existing.previousStatus ?? 'Lead';
      const messages = [`Reopened: Cancelled → ${target}`];
      if (existing.refundStatus === 'Refunded') {
        messages.push('Note: booking fee was already refunded and is not restored.');
      }
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

  async updateCosting(id: string, input: CostingInput): Promise<void> {
    await this.mutate(id, () => ({ changes: input }));
  }

  async updateCostItems(id: string, items: CostItem[]): Promise<void> {
    await this.mutate(id, () => ({ changes: { costItems: items } }));
  }

  async updateQuotation(id: string, quotation: QuotationDetails): Promise<void> {
    await this.mutate(id, () => ({ changes: { quotation } }));
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
   * messages to append (curated prose, not a generic field diff — see markInProgress for why).
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
