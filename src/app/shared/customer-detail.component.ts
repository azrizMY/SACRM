import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';
import { VEHICLES, modelVariantLabel, vehicleTitle } from '../data/calculator-data';
import {
  CUSTOMER_STATUS_META,
  DOCUMENT_STATUS_META,
  TO_BE_CONFIRMED_COLOUR,
  formatStageDate,
  freeGiftsLabel,
  isCashDeal,
  stageEnteredAt,
  type CustomerRecord,
} from '../data/customer-data';

type Field = { label: string; value: string; badge?: { tone: string; dot: string }; link?: boolean };
type Section = { title: string; fields: Field[] };

const EMPTY = '—';

function fmtMoney(v: number | undefined | null): string {
  return v == null ? EMPTY : `RM ${v.toLocaleString('en-MY')}`;
}
function fmtPct(v: number | undefined | null): string {
  return v == null ? EMPTY : `${v}%`;
}
function fmtOrDash(v: string | number | undefined | null): string {
  return v == null || v === '' ? EMPTY : String(v);
}

/**
 * Body of Customer Manager's side panel: the record's details grouped into sections, its activity
 * history, and every per-customer action. Same card set for every status — fields that aren't
 * populated yet just show "—"; only Cancellation (once cancelled) replaces Delivery.
 */
@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Vehicle -->
      <section class="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col">
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle</span>
            <span class="text-base font-bold text-foreground">{{ vehicleTitle(record.brand, modelVariantLabel(record.model, record.variant)) }}</span>
            <span class="text-xs" [ngClass]="colourUnconfirmed ? 'font-semibold text-[var(--warning)]' : 'text-muted-foreground'">
              {{ record.yearMade }} · {{ record.colour }}
            </span>
          </div>
          @if (record.status !== 'Cancelled') {
            <button
              type="button"
              (click)="changeCar.emit(record)"
              [disabled]="record.status === 'Delivered'"
              [title]="record.status === 'Delivered' ? 'This car has already been delivered, so it cannot be changed.' : 'Switch this customer to a different car'"
              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <app-icon name="refresh-cw" [size]="12" />
              Change car
            </button>
          }
        </div>
        <ng-container [ngTemplateOutlet]="fieldList" [ngTemplateOutletContext]="{ $implicit: vehicleFields }" />
      </section>

      @for (section of sections; track section.title) {
        <section class="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
          <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ section.title }}</span>
          <ng-container [ngTemplateOutlet]="fieldList" [ngTemplateOutletContext]="{ $implicit: section.fields }" />
        </section>
      }

      <!-- Activity History -->
      <section class="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
        <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Activity</span>
        @if (activity().length) {
          <ol class="flex flex-col">
            @for (entry of activity(); track entry.id; let last = $last) {
              <li class="relative flex gap-3 pb-3 last:pb-0">
                @if (!last) {
                  <span class="absolute left-[3px] top-3 h-full w-px bg-border"></span>
                }
                <span class="mt-1.5 size-[7px] shrink-0 rounded-full" [ngClass]="$first ? 'bg-primary' : 'bg-muted-foreground/50'"></span>
                <span class="flex min-w-0 flex-col gap-0.5 text-xs">
                  <span class="text-foreground">{{ entry.message }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ entryDate(entry.date) }}</span>
                </span>
              </li>
            }
          </ol>
        } @else {
          <p class="text-xs text-muted-foreground">No activity recorded yet.</p>
        }
      </section>

      <!-- Actions -->
      <div class="grid grid-cols-2 gap-2">
        <button type="button" (click)="addNote.emit(record)" class="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
          <app-icon name="sticky-note" [size]="13" />
          Add note
        </button>
        @if (record.status !== 'Cancelled') {
          <button type="button" (click)="edit.emit(record)" class="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
            <app-icon name="pencil" [size]="13" />
            Edit details
          </button>
        }
        @if (record.status === 'Cancelled') {
          <button type="button" (click)="reopen.emit(record)" class="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">
            <app-icon name="rotate-ccw" [size]="13" />
            Reopen
          </button>
        } @else if (record.status !== 'Delivered') {
          <button type="button" (click)="cancel.emit(record)" class="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--destructive)]/12 px-3 py-2.5 text-xs font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/20">
            <app-icon name="x-circle" [size]="13" />
            Cancel deal
          </button>
        }
        <button type="button" (click)="delete.emit(record)" class="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
          <app-icon name="trash" [size]="13" />
          Delete
        </button>
      </div>
    </div>

    <ng-template #fieldList let-fields>
      <dl class="flex flex-col gap-1.5">
        @for (f of fields; track f.label) {
          <div class="flex items-center justify-between gap-3 text-xs">
            <dt class="shrink-0 text-muted-foreground">{{ f.label }}</dt>
            @if (f.badge) {
              <dd class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium" [ngClass]="f.badge.tone">
                <span class="size-1.5 rounded-full" [ngClass]="f.badge.dot"></span>
                {{ f.value }}
              </dd>
            } @else if (f.link) {
              <dd><a routerLink="/notes" class="text-right font-medium text-primary hover:underline">{{ f.value }}</a></dd>
            } @else {
              <dd class="min-w-0 break-words text-right font-medium text-foreground">{{ f.value }}</dd>
            }
          </div>
        }
      </dl>
    </ng-template>
  `,
})
export class CustomerDetailComponent {
  @Input({ required: true }) record!: CustomerRecord;

  @Output() edit = new EventEmitter<CustomerRecord>();
  @Output() addNote = new EventEmitter<CustomerRecord>();
  @Output() changeCar = new EventEmitter<CustomerRecord>();
  @Output() cancel = new EventEmitter<CustomerRecord>();
  @Output() reopen = new EventEmitter<CustomerRecord>();
  @Output() delete = new EventEmitter<CustomerRecord>();

  vehicleTitle = vehicleTitle;
  modelVariantLabel = modelVariantLabel;

  get colourUnconfirmed(): boolean {
    return this.record.colour === TO_BE_CONFIRMED_COLOUR;
  }

  get vehicleFields(): Field[] {
    const r = this.record;
    const price = VEHICLES.find((v) => v.brand === r.brand && v.model === r.model && v.variant === r.variant)?.price;
    return [
      { label: 'Selling Price', value: fmtMoney(price) },
      { label: 'Rebate', value: fmtMoney(r.quotation?.rebate) },
      { label: 'NCD', value: r.ncd !== undefined ? fmtPct(r.ncd) : EMPTY },
      { label: 'Registration Number', value: fmtOrDash(r.plateNo) },
      { label: 'Chassis / VIN', value: fmtOrDash(r.chassisNo) },
      { label: 'Engine No.', value: fmtOrDash(r.engineNo) },
      { label: 'Insurance', value: fmtOrDash(r.insuranceName) },
    ];
  }

  get sections(): Section[] {
    const r = this.record;
    return [
      this.customerSection(r),
      this.financingSection(r),
      this.tradeInSection(r),
      // Cancelled deals never reach delivery — Cancellation takes that card's place instead.
      r.status === 'Cancelled' ? this.cancellationSection(r) : this.deliverySection(r),
    ];
  }

  activity() {
    return [...(this.record.activity ?? [])].sort((a, b) => b.date - a.date);
  }

  entryDate(ts: number): string {
    return new Date(ts).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  private customerSection(r: CustomerRecord): Section {
    return {
      title: 'Customer',
      fields: [
        { label: 'Phone', value: r.phone },
        { label: 'Lead Source', value: r.sourceType },
        { label: 'IC No', value: fmtOrDash(r.icNo) },
        { label: 'Driving Licence No', value: fmtOrDash(r.drivingLicenceNo) },
        { label: 'Address', value: fmtOrDash(r.address) },
        { label: 'Email', value: fmtOrDash(r.email) },
      ],
    };
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
      { label: 'Delivery Date', value: fmtOrDash(r.deliveryDate) },
      { label: 'Delivery Notes', value: fmtOrDash(r.deliveryNotes) },
    ];
    if (r.freeGifts?.length) {
      fields.push({ label: 'Free Gifts', value: freeGiftsLabel(r), link: true });
    }
    return { title: 'Delivery', fields };
  }

  private cancellationSection(r: CustomerRecord): Section {
    return {
      title: 'Cancellation',
      fields: [
        { label: 'Previous Status', value: r.previousStatus ? CUSTOMER_STATUS_META[r.previousStatus].label : EMPTY },
        { label: 'Cancellation Date', value: formatStageDate(stageEnteredAt(r, 'Cancelled')) },
        { label: 'Cancellation Reason', value: fmtOrDash(r.cancelReason) },
        { label: 'Cancellation Notes', value: fmtOrDash(r.cancelNotes) },
      ],
    };
  }
}
