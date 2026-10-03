import { TranslatePipe } from './i18n';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';
import { DealExtrasComponent } from './deal-extras.component';
import { VEHICLES, modelVariantLabel, vehicleTitle, type RateType } from '../data/calculator-data';
import {
  CUSTOMER_STATUS_META,
  TO_BE_CONFIRMED_COLOUR,
  formatStageDate,
  stageEnteredAt,
  type CustomerRecord,
} from '../data/customer-data';

/** What the customer's saved quotation works out to — computed by Customer Manager with the same
 *  maths as the Calculator, so the panel never keeps a second copy of any financial figure. */
export type QuoteSummary = {
  cash: boolean;
  allInPrice: number;
  rebate: number;
  /** Part of the rebate paid to the customer in cash, not taken off the price. */
  cashback: number;
  ncd: number;
  insurance: number;
  downpayment: number;
  loanAmount: number;
  tenureMonths: number;
  interestRate: number;
  rateType: RateType;
  monthly: number;
};

type Field = { label: string; value: string; badge?: { tone: string; dot: string }; link?: boolean };
type Section = { title: string; fields: Field[] };

const EMPTY = '—';

function fmtMoney(v: number | undefined | null): string {
  return v == null ? EMPTY : `RM ${v.toLocaleString('en-MY')}`;
}
/** Same as Customer Manager's fmt — caps at 2 decimals so instalments and insurance never show a stray 3rd. */
function fmtRM(v: number): string {
  return `RM ${v.toLocaleString('en-MY', { maximumFractionDigits: 2 })}`;
}
/** "RM 11,000", or how it splits when some of it went to the customer as cash back. */
function rebateText(q: QuoteSummary): string {
  if (q.cashback <= 0) return fmtRM(q.rebate);
  return q.rebate > 0 ? `${fmtRM(q.rebate)} off + ${fmtRM(q.cashback)} cash back` : `${fmtRM(q.cashback)} as cash back`;
}
function fmtOrDash(v: string | number | undefined | null): string {
  return v == null || v === '' ? EMPTY : String(v);
}

/**
 * Body of Customer Manager's side panel: the record's details grouped into sections, its activity
 * history, and every per-customer action. Same card set for every status — fields that aren't
 * populated yet just show "—"; a lost deal also gets a Lost card.
 */
@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TranslatePipe, DealExtrasComponent],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Vehicle -->
      <section class="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col">
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ "Vehicle" | t }}</span>
            <span class="text-base font-bold text-foreground">{{ vehicleTitle(record.brand, modelVariantLabel(record.model, record.variant)) }}</span>
            <span class="text-xs" [ngClass]="colourUnconfirmed ? 'font-semibold text-[var(--warning)]' : 'text-muted-foreground'">
              {{ record.yearMade }} · {{ record.colour }}
            </span>
          </div>
          @if (record.status !== 'Lost') {
            <button
              type="button"
              (click)="changeCar.emit(record)"
              [disabled]="record.status === 'Won'"
              [title]="record.status === 'Won' ? 'This deal is already won, so the car cannot be changed.' : 'Switch this customer to a different car'"
              class="flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <app-icon name="refresh-cw" [size]="12" />
              {{ "Change car" | t }}
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

      <!-- Free gifts + cost spent — recorded at any stage, since both happen before a deal is won -->
      <app-deal-extras [record]="record" [collapsible]="true" />

      <!-- History — tucked away; the latest entry is enough at a glance -->
      <section class="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
        <button type="button" (click)="historyOpen = !historyOpen" [attr.aria-expanded]="historyOpen" class="flex items-center gap-2 text-left">
          <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ "History" | t }}</span>
          @if (activity()[0]; as latest) {
            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ latest.message }} · {{ entryDate(latest.date) }}</span>
          } @else {
            <span class="flex-1 text-xs text-muted-foreground">{{ "No activity recorded yet." | t }}</span>
          }
          <app-icon name="chevron-down" [size]="14" class="shrink-0 text-muted-foreground transition-transform" [ngClass]="historyOpen ? 'rotate-180' : ''" />
        </button>
        @if (historyOpen && activity().length) {
          <ol class="flex flex-col pt-1">
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
        }
      </section>

      <!-- Less frequent actions -->
      <div class="flex items-center gap-1">
        <button type="button" (click)="addNote.emit(record)" class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
          <app-icon name="sticky-note" [size]="13" />
          {{ "Add note" | t }}
        </button>
        @if (record.status !== 'Lost') {
          <button type="button" (click)="edit.emit(record)" class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent">
            <app-icon name="pencil" [size]="13" />
            {{ "Edit details" | t }}
          </button>
        }
        <button type="button" (click)="delete.emit(record)" class="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
          <app-icon name="trash" [size]="13" />
          {{ "Delete" | t }}
        </button>
      </div>
    </div>

    <ng-template #fieldList let-fields>
      <dl class="flex flex-col gap-1.5">
        @for (f of fields; track f.label) {
          <div class="flex items-center justify-between gap-3 text-xs">
            <dt class="shrink-0 text-muted-foreground">{{ f.label | t }}</dt>
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
  @Input() quote: QuoteSummary | null = null;

  @Output() edit = new EventEmitter<CustomerRecord>();
  @Output() addNote = new EventEmitter<CustomerRecord>();
  @Output() changeCar = new EventEmitter<CustomerRecord>();
  @Output() delete = new EventEmitter<CustomerRecord>();

  historyOpen = false;

  vehicleTitle = vehicleTitle;
  modelVariantLabel = modelVariantLabel;

  get colourUnconfirmed(): boolean {
    return this.record.colour === TO_BE_CONFIRMED_COLOUR;
  }

  get sections(): Section[] {
    const r = this.record;
    return [
      this.quotationSection(),
      this.customerSection(r),
      ...(r.status === 'Lost' ? [this.lostSection(r)] : []),
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
      ],
    };
  }

  private get catalogPrice(): number | undefined {
    const r = this.record;
    return VEHICLES.find((v) => v.brand === r.brand && v.model === r.model && v.variant === r.variant)?.price;
  }

  /** What the car itself costs this customer — price, plus the insurance and rebate from their quote. */
  get vehicleFields(): Field[] {
    const q = this.quote;
    const fields: Field[] = [{ label: 'Price', value: fmtMoney(this.catalogPrice) }];
    if (q && this.catalogPrice != null) {
      fields.push(
        { label: 'Insurance', value: `${fmtRM(q.insurance)} (${q.ncd}% NCD)` },
        { label: 'Rebate', value: rebateText(q) },
      );
    }
    return fields;
  }

  private quotationSection(): Section {
    const q = this.quote;
    if (!q) return { title: 'Quotation', fields: [{ label: 'Quotation', value: 'Not quoted yet' }] };
    if (this.catalogPrice == null) return { title: 'Quotation', fields: [{ label: 'Quotation', value: 'Car not in your catalog' }] };
    const fields: Field[] = [{ label: 'Payment', value: q.cash ? 'Cash' : 'Hire Purchase' }];
    if (q.cashback > 0) fields.push({ label: 'Cash back to customer', value: fmtRM(q.cashback) });
    if (q.cash) {
      fields.push({ label: 'Total Price', value: fmtRM(q.allInPrice) });
    } else {
      fields.push(
        { label: q.downpayment < 0 ? 'Cash Back' : 'Down Payment', value: fmtRM(Math.abs(q.downpayment)) },
        { label: 'Loan Amount', value: fmtRM(q.loanAmount) },
        { label: 'Tenure', value: `${q.tenureMonths / 12} ${q.tenureMonths === 12 ? 'year' : 'years'}` },
        { label: 'Interest Rate', value: `${q.interestRate}% ${q.rateType === 'effective' ? 'EIR' : 'flat'}` },
        { label: 'Monthly', value: fmtRM(q.monthly) },
      );
    }
    return { title: 'Quotation', fields };
  }

  private lostSection(r: CustomerRecord): Section {
    return {
      title: 'Lost',
      fields: [
        { label: 'Previous Status', value: r.previousStatus ? (CUSTOMER_STATUS_META[r.previousStatus]?.label ?? r.previousStatus) : EMPTY },
        { label: 'Lost On', value: formatStageDate(stageEnteredAt(r, 'Lost')) },
        { label: 'Reason', value: fmtOrDash(r.cancelReason) },
        { label: 'Notes', value: fmtOrDash(r.cancelNotes) },
      ],
    };
  }
}
