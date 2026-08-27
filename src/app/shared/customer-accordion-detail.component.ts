import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';
import { VEHICLES } from '../data/calculator-data';
import {
  CUSTOMER_STATUS_META,
  DOCUMENT_STATUS_META,
  bookingFeeDisplay,
  formatStageDate,
  freeGiftsLabel,
  isCashDeal,
  stageEnteredAt,
  type CustomerRecord,
  type DocumentStatus,
} from '../data/customer-data';

type Field = { label: string; value: string; badge?: { tone: string; dot: string }; link?: boolean };
type Section = { title: string; fields: Field[] };

const EMPTY = '—';

function fmtMoney(v: number | undefined | null): string {
  return v == null ? EMPTY : `RM ${v.toLocaleString('en-MY')}`;
}
function fmtDate(v: string | undefined | null): string {
  return v || EMPTY;
}
function fmtPct(v: number | undefined | null): string {
  return v == null ? EMPTY : `${v}%`;
}
function fmtOrDash(v: string | number | undefined | null): string {
  return v == null || v === '' ? EMPTY : String(v);
}

@Component({
  selector: 'app-customer-accordion-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <ng-template #sectionCard let-section="section" let-grow="grow">
      <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3" [ngClass]="grow ? 'flex-1' : ''">
        <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ section.title }}</span>
        @if (section.title === 'Vehicle') {
          <div class="flex items-center justify-between gap-3">
            <span class="text-base font-semibold text-foreground">{{ record.brand }} {{ record.model }} {{ record.variant }}</span>
            <span class="shrink-0 text-sm font-medium text-muted-foreground">{{ record.colour }}</span>
          </div>
        }
        <div class="flex flex-col gap-1.5">
          @for (f of section.fields; track f.label) {
            <div class="flex items-center justify-between gap-3 text-xs">
              <span class="text-muted-foreground">{{ f.label }}</span>
              @if (f.badge) {
                <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium" [ngClass]="f.badge.tone">
                  <span class="size-1.5 rounded-full" [ngClass]="f.badge.dot"></span>
                  {{ f.value }}
                </span>
              } @else if (f.link) {
                <a routerLink="/notes" class="text-right font-medium text-primary hover:underline">{{ f.value }}</a>
              } @else {
                <span class="text-right font-medium text-foreground">{{ f.value }}</span>
              }
            </div>
          }
        </div>
      </div>
    </ng-template>

    <div class="flex flex-col gap-4 p-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          @for (section of sections; track section.title) {
            @if (section.title !== 'Vehicle' && section.title !== 'Payment') {
              <ng-container [ngTemplateOutlet]="sectionCard" [ngTemplateOutletContext]="{ section: section }" />
            }
          }
        </div>
        <div class="flex flex-col gap-3">
          @for (section of sections; track section.title) {
            @if (section.title === 'Vehicle') {
              <ng-container [ngTemplateOutlet]="sectionCard" [ngTemplateOutletContext]="{ section: section }" />
            }
          }
          @for (section of sections; track section.title) {
            @if (section.title === 'Payment') {
              <ng-container [ngTemplateOutlet]="sectionCard" [ngTemplateOutletContext]="{ section: section, grow: true }" />
            }
          }
        </div>
      </div>

      <!-- Activity History -->
      <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Activity History</span>
        @if (activity().length) {
          <ul class="flex flex-col gap-2">
            @for (entry of activity(); track entry.id) {
              <li class="flex flex-col gap-0.5 border-b border-border/60 pb-2 text-xs last:border-0 last:pb-0">
                <span class="text-[10px] text-muted-foreground">{{ entryDate(entry.date) }}</span>
                <span class="text-foreground">{{ entry.message }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="text-xs text-muted-foreground">No activity recorded yet.</p>
        }
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        @if (record.status === 'Lead' || record.status === 'Booked' || record.status === 'In Progress' || record.status === 'Cancelled') {
          <button
            type="button"
            (click)="recordTestDrive.emit(record)"
            class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <app-icon name="car" [size]="13" />
            Record Test Drive
          </button>
        }
        <button
          type="button"
          (click)="addNote.emit(record)"
          class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <app-icon name="sticky-note" [size]="13" />
          Add Note
        </button>
        @if (record.status !== 'Cancelled') {
          <button
            type="button"
            (click)="edit.emit(record)"
            class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <app-icon name="pencil" [size]="13" />
            Edit
          </button>
        }
        @if (record.status === 'Cancelled') {
          <button
            type="button"
            (click)="reopen.emit(record)"
            class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <app-icon name="rotate-ccw" [size]="13" />
            Reopen
          </button>
        } @else if (record.status !== 'Delivered') {
          <button
            type="button"
            (click)="cancel.emit(record)"
            class="flex items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
          >
            <app-icon name="x-circle" [size]="13" />
            Cancel
          </button>
        }
      </div>
    </div>
  `,
})
export class CustomerAccordionDetailComponent {
  @Input({ required: true }) record!: CustomerRecord;

  @Output() edit = new EventEmitter<CustomerRecord>();
  @Output() addNote = new EventEmitter<CustomerRecord>();
  @Output() cancel = new EventEmitter<CustomerRecord>();
  @Output() reopen = new EventEmitter<CustomerRecord>();
  @Output() recordTestDrive = new EventEmitter<CustomerRecord>();

  /** Same card set for every status — nothing is hidden pending a later stage, fields that
   *  aren't populated yet just render as "—" via the fmt* helpers below. Only Test Drive
   *  (an optional event, not a stage) and Cancellation (only meaningful once cancelled) vary. */
  get sections(): Section[] {
    const r = this.record;
    try {
      const sections = [
        this.customerSection(r),
        this.financingSection(r),
        this.tradeInSection(r),
        // Cancelled deals never reach delivery — Cancellation takes that card's place instead.
        r.status === 'Cancelled' ? this.cancellationSection(r) : this.deliverySection(r),
        this.vehicleSection(r),
        this.bookingSection(r),
      ];
      return sections;
    } catch {
      return [{ title: 'Customer', fields: [{ label: 'Name', value: r.name ?? '—' }, { label: 'Phone', value: r.phone ?? '—' }] }];
    }
  }

  activity() {
    return [...(this.record.activity ?? [])].sort((a, b) => b.date - a.date);
  }

  entryDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private customerSection(r: CustomerRecord): Section {
    return {
      title: 'Customer',
      fields: [
        { label: 'Name', value: r.name },
        { label: 'Phone', value: r.phone },
        { label: 'Lead Source', value: r.sourceType },
        { label: 'IC No', value: fmtOrDash(r.icNo) },
        { label: 'Driving Licence No', value: fmtOrDash(r.drivingLicenceNo) },
        { label: 'Address', value: fmtOrDash(r.address) },
        { label: 'Email', value: fmtOrDash(r.email) },
      ],
    };
  }

  private vehicleSection(r: CustomerRecord): Section {
    const price = VEHICLES.find((v) => v.brand === r.brand && v.model === r.model && v.variant === r.variant)?.price;
    return {
      title: 'Vehicle',
      fields: [
        { label: 'Year Make', value: String(r.yearMade) },
        { label: 'Selling Price', value: fmtMoney(price) },
        { label: 'Rebate', value: fmtMoney(r.quotation?.rebate) },
        { label: 'NCD', value: r.ncd !== undefined ? fmtPct(r.ncd) : EMPTY },
        { label: 'Registration Number', value: fmtOrDash(r.plateNo) },
        { label: 'Chassis / VIN', value: fmtOrDash(r.chassisNo) },
        { label: 'Engine No.', value: fmtOrDash(r.engineNo) },
        { label: 'Insurance', value: fmtOrDash(r.insuranceName) },
      ],
    };
  }

  private bookingSection(r: CustomerRecord): Section {
    const fields: Field[] = [{ label: 'Booking Fee', value: bookingFeeDisplay(r.bookingFee, fmtMoney as (v: number) => string) }];
    // Whichever payment-progress status applies — Payment Status (cash) or Down Payment Status
    // (loan) — lives here in Payment, not Financing; the deal terms live there, payment tracking here.
    if (isCashDeal(r)) {
      fields.push({ label: 'Payment Status', value: fmtOrDash(r.paymentStatus) });
    } else if (r.financingType === 'Loan') {
      fields.push({ label: 'Down Payment Status', value: fmtOrDash(r.downPaymentStatus) });
    }
    return { title: 'Payment', fields };
  }

  private tradeInSection(r: CustomerRecord): Section {
    return {
      title: 'Trade-in',
      fields: [
        { label: 'Trade-in Status', value: r.tradeInStatus ?? 'No Trade-in' },
        { label: 'Vehicle', value: fmtOrDash(r.tradeInVehicle) },
        { label: 'Agreed Value', value: fmtMoney(r.tradeInValue) },
      ],
    };
  }

  /** Falls back to the "Not Submitted" meta for any value outside the known enum — a stale
   *  record from before a schema change should degrade gracefully, never blank the row. */
  private documentStatusField(r: CustomerRecord): Field {
    if (isCashDeal(r)) return { label: 'Document Status', value: 'Cash' };
    const meta = DOCUMENT_STATUS_META[r.documentStatus ?? 'NO'] ?? DOCUMENT_STATUS_META.NO;
    return { label: 'Document Status', value: meta.label, badge: { tone: meta.tone, dot: meta.dot } };
  }

  private financingSection(r: CustomerRecord): Section {
    const fields: Field[] = [{ label: 'Financing Type', value: fmtOrDash(r.financingType) }];
    if (r.financingType === 'Loan') {
      fields.push(
        { label: 'Bank Panel', value: fmtOrDash(r.bankPanel) },
        { label: 'Loan Amount', value: fmtMoney(r.loanAmount) },
        { label: 'Tenure', value: r.loanTenureMonths !== undefined ? `${r.loanTenureMonths} months` : EMPTY },
        { label: 'Interest Rate', value: fmtPct(r.loanInterestRate) },
        { label: 'Down Payment', value: fmtMoney(r.downpayment) },
      );
    }
    fields.push(this.documentStatusField(r));
    return { title: 'Financing', fields };
  }

  private deliverySection(r: CustomerRecord): Section {
    const fields: Field[] = [
      { label: 'Delivery Date', value: fmtDate(r.deliveryDate) },
      { label: 'Delivery Notes', value: fmtOrDash(r.deliveryNotes) },
      { label: 'Test Drive Date', value: fmtDate(r.testDriveDate) },
    ];
    if (r.freeGifts?.length) {
      fields.push({ label: 'Free Gifts', value: freeGiftsLabel(r), link: true });
    }
    return { title: 'Delivery', fields };
  }

  private cancellationSection(r: CustomerRecord): Section {
    const fields: Field[] = [
      { label: 'Previous Status', value: r.previousStatus ? CUSTOMER_STATUS_META[r.previousStatus].label : EMPTY },
      { label: 'Cancellation Date', value: formatStageDate(stageEnteredAt(r, 'Cancelled')) },
      { label: 'Cancellation Reason', value: fmtOrDash(r.cancelReason) },
    ];
    if (r.refundStatus) {
      fields.push({ label: 'Refund Status', value: r.refundStatus });
    }
    fields.push({ label: 'Cancellation Notes', value: fmtOrDash(r.cancelNotes) });
    return { title: 'Cancellation', fields };
  }
}
