import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { DateRangePickerComponent } from '../shared/date-range-picker.component';
import { CustomerAccordionDetailComponent } from '../shared/customer-accordion-detail.component';
import { CustomerEditModalComponent } from '../shared/customer-edit-modal.component';
import { CustomerNoteModalComponent } from '../shared/customer-note-modal.component';
import { CustomerService } from '../shared/customer.service';
import { AdvisorService } from '../shared/advisor.service';
import { SettingsService } from '../shared/settings.service';
import { buildQuotationPdfBytes, downloadBlob, openBlobInNewTab } from '../shared/pdf-writer';
import {
  DEFAULT_INSURANCE_RATE_PCT,
  DEFAULT_REBATE,
  MODEL_YEARS,
  NCD_OPTIONS,
  TENURE_OPTIONS,
  VEHICLES,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  modelVariantLabel,
  modelsForBrand,
  monthlyPayment,
  variantsForModel,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { todayStr } from '../shared/date-utils';
import {
  BANK_OPTIONS,
  CANCEL_REASON_OPTIONS,
  COLOUR_OPTIONS,
  CUSTOMER_STATUS_META,
  DOCUMENT_STATUS_META,
  DOCUMENT_STATUS_OPTIONS,
  FINANCING_TYPE_OPTIONS,
  INSURANCE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  SOURCE_TYPES,
  STAGE_DATE_HEADER,
  TO_BE_CONFIRMED_COLOUR,
  bookingFeeDisplay,
  canSubmitBooked,
  canSubmitCancel,
  canSubmitDelivered,
  canSubmitInProgress,
  currentStageEnteredAt,
  formatStageDate,
  freeGiftsComplete,
  freeGiftsSummary,
  isCashDeal,
  type BookedInput,
  type CancelledInput,
  type CustomerRecord,
  type CustomerStatus,
  type DeliveredInput,
  type DocumentStatus,
  type EditCustomerInput,
  type FinancingType,
  type InProgressInput,
  type NewLeadInput,
  type QuotationDetails,
  type TestDriveInput,
} from '../data/customer-data';

type Tab = 'All' | 'Lead' | 'Booked' | 'In Progress' | 'Delivered' | 'Cancelled';
type ModalKind = 'add' | 'booked' | 'inprogress' | 'delivered' | 'cancel' | 'edit' | 'note' | 'testdrive' | null;
/** 'stageDate' is a synthetic column — every tab's "date" column is the derived stage-entry
 *  date (see stageEnteredAt), never a raw stored field, so it isn't a real CustomerRecord key. */
type SortKey = keyof CustomerRecord | 'stageDate';
type SortDir = 'asc' | 'desc';
type Column = { key: SortKey; label: string; align?: 'right' };

const ALL_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'status', label: 'Status' },
  { key: 'sourceType', label: 'Source' },
  { key: 'stageDate', label: 'Last Updated', align: 'right' },
];
const LEAD_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'sourceType', label: 'Source' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['Lead'], align: 'right' },
];
const BOOKED_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'icNo', label: 'IC No' },
  { key: 'sourceType', label: 'Lead Source' },
  { key: 'documentStatus', label: 'Documents' },
  { key: 'bookingFee', label: 'Booking Fee', align: 'right' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['Booked'], align: 'right' },
];
const INPROGRESS_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'icNo', label: 'IC No' },
  { key: 'documentStatus', label: 'Documents' },
  { key: 'tradeInStatus', label: 'Trade-in' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['In Progress'], align: 'right' },
];
const DELIVERED_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'bankPanel', label: 'Bank' },
  { key: 'insuranceName', label: 'Insurance' },
  { key: 'plateNo', label: 'Registration No' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['Delivered'], align: 'right' },
];
const CANCELLED_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'sourceType', label: 'Source' },
  { key: 'cancelReason', label: 'Reason' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['Cancelled'], align: 'right' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 30];

function sortValueFor(r: CustomerRecord, key: SortKey): string | number {
  if (key === 'stageDate') return currentStageEnteredAt(r);
  const v = r[key as keyof CustomerRecord];
  return typeof v === 'number' ? v : String(v ?? '');
}

function compareRecords(a: CustomerRecord, b: CustomerRecord, key: SortKey, dir: SortDir): number {
  const av = sortValueFor(a, key);
  const bv = sortValueFor(b, key);
  const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
  return dir === 'asc' ? cmp : -cmp;
}

const TD = 'whitespace-nowrap p-4 align-middle';
const TD_R = 'whitespace-nowrap p-4 text-right align-middle';

const ALL_COLSPAN = ALL_COLUMNS.length + 1;
const LEAD_COLSPAN = LEAD_COLUMNS.length + 1;
const BOOKED_COLSPAN = BOOKED_COLUMNS.length + 1;
const INPROGRESS_COLSPAN = INPROGRESS_COLUMNS.length + 1;
const DELIVERED_COLSPAN = DELIVERED_COLUMNS.length + 1;
const CANCELLED_COLSPAN = CANCELLED_COLUMNS.length + 1;

@Component({
  selector: 'app-customer-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    DateRangePickerComponent,
    CustomerAccordionDetailComponent,
    CustomerEditModalComponent,
    CustomerNoteModalComponent,
    BrandMarkComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-balance text-xl font-semibold tracking-tight">Customer Manager</h2>
          <p class="text-pretty text-sm text-muted-foreground">Track every customer from lead to booking to delivery.</p>
        </div>
        <button
          type="button"
          (click)="openAddLead()"
          class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <app-icon name="plus" [size]="14" />
          Add Lead
        </button>
      </div>

      <!-- Tabs + search -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Pipeline stage" class="flex flex-wrap items-center gap-1.5">
          @for (t of tabs; track t) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="t === activeTab()"
              (click)="selectTab(t)"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="
                t === activeTab()
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              "
            >
              {{ t }} ({{ countFor(t) }})
            </button>
          }
        </div>
        <div class="relative w-full sm:w-64">
          <app-icon name="search" [size]="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Name or car…"
            [ngModel]="nameFilter()"
            (ngModelChange)="nameFilter.set($event)"
            class="h-9 w-full rounded-md border border-input bg-input pl-8 pr-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Car Brand</span>
            <select
              [ngModel]="carFilter()"
              (ngModelChange)="carFilter.set($event)"
              class="h-9 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="All">All Cars</option>
              @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Test Drive</span>
            <select
              [ngModel]="testDriveFilter()"
              (ngModelChange)="testDriveFilter.set($event)"
              class="h-9 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="All">All</option>
              <option value="Yes">Test driven</option>
              <option value="No">Not test driven</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
            <select
              [ngModel]="sourceFilter()"
              (ngModelChange)="sourceFilter.set($event)"
              class="h-9 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="All">All Sources</option>
              @for (s of sourceTypes; track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date Range</span>
            <app-date-range-picker
              [from]="dateFromFilter()"
              (fromChange)="dateFromFilter.set($event)"
              [to]="dateToFilter()"
              (toChange)="dateToFilter.set($event)"
            />
          </div>
        </div>
        @if (hasActiveFilters()) {
          <div class="flex justify-end">
            <button
              type="button"
              (click)="clearFilters()"
              class="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="x" [size]="12" />
              Clear filters
            </button>
          </div>
        }
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="hidden overflow-x-auto sm:block">
          @if (activeTab() === 'All') {
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  @for (col of allColumns; track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button
                        type="button"
                        (click)="toggleSort(col.key)"
                        class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground"
                        [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']"
                      >
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [id]="'customer-row-' + r.id" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40" (click)="toggleExpand(r.id)">
                    <td [class]="TD">
                      <div class="flex flex-col">
                        <span class="font-medium">{{ r.name }}</span>
                        <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="text-xs text-primary hover:underline">{{ r.phone }}</a>
                      </div>
                    </td>
                    <td [class]="TD">
                      <div class="flex items-center gap-2">
                        <app-brand-mark [brand]="r.brand" />
                        <div class="flex flex-col">
                          <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                          <span class="text-xs text-muted-foreground">{{ r.yearMade }} &middot; {{ r.colour }}</span>
                        </div>
                      </div>
                    </td>
                    <td [class]="TD">
                      <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta(r.status).tone">
                        <span class="size-1.5 rounded-full" [ngClass]="statusMeta(r.status).dot"></span>
                        {{ statusMeta(r.status).label }}
                      </span>
                    </td>
                    <td [class]="TD + ' text-sm text-muted-foreground'">{{ r.sourceType }}</td>
                    <td [class]="TD_R + ' text-xs text-muted-foreground tabular'">{{ stageDateText(r) }} &middot; {{ r.status }}</td>
                    <td [class]="TD_R">
                      <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                        <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="file-text" [size]="13" />
                        </button>
                        <button type="button" (click)="requestDelete(r)" title="Delete" aria-label="Delete customer" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                          <app-icon name="trash" [size]="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (expandedId() === r.id) {
                    <tr class="border-b border-border bg-muted/20 last:border-0">
                      <td [attr.colspan]="allColspan" class="p-0">
                        <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="6" class="p-8 text-center text-sm text-muted-foreground">No customers match.</td></tr>
                }
              </tbody>
            </table>
          }

          @if (activeTab() === 'Lead') {
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  @for (col of leadColumns; track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button type="button" (click)="toggleSort(col.key)" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']">
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [id]="'customer-row-' + r.id" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40" (click)="toggleExpand(r.id)">
                    <td [class]="TD">
                      <div class="flex flex-col">
                        <span class="flex items-center gap-1.5 font-medium">
                          {{ r.name }}
                          @if (r.testDriveDate) { <app-icon name="car" [size]="12" class="text-muted-foreground" title="Test driven" /> }
                        </span>
                        <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="text-xs text-primary hover:underline">{{ r.phone }}</a>
                      </div>
                    </td>
                    <td [class]="TD">
                      <div class="flex items-center gap-2">
                        <app-brand-mark [brand]="r.brand" />
                        <div class="flex flex-col">
                          <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                          <span class="text-xs text-muted-foreground">{{ r.yearMade }}</span>
                        </div>
                      </div>
                    </td>
                    <td [class]="TD + ' text-sm text-muted-foreground'">{{ r.sourceType }}</td>
                    <td [class]="TD_R + ' text-xs text-muted-foreground tabular'">{{ stageDateText(r) }}</td>
                    <td [class]="TD_R">
                      <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                        <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="file-text" [size]="13" />
                        </button>
                        <button type="button" (click)="openBooked(r)" title="Mark as Booked" aria-label="Mark as Booked" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="clipboard-check" [size]="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (expandedId() === r.id) {
                    <tr class="border-b border-border bg-muted/20 last:border-0">
                      <td [attr.colspan]="leadColspan" class="p-0">
                        <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="5" class="p-8 text-center text-sm text-muted-foreground">No leads match.</td></tr>
                }
              </tbody>
            </table>
          }

          @if (activeTab() === 'Booked') {
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  @for (col of bookedColumns; track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button type="button" (click)="toggleSort(col.key)" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']">
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [id]="'customer-row-' + r.id" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40" (click)="toggleExpand(r.id)">
                    <td [class]="TD">
                      <div class="flex flex-col">
                        <span class="font-medium">{{ r.name }}</span>
                        <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="text-xs text-primary hover:underline">{{ r.phone }}</a>
                      </div>
                    </td>
                    <td [class]="TD">
                      <div class="flex items-center gap-2">
                        <app-brand-mark [brand]="r.brand" />
                        <div class="flex flex-col">
                          <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                          <span class="text-xs text-muted-foreground">{{ r.yearMade }} &middot; {{ r.colour }}</span>
                        </div>
                      </div>
                    </td>
                    <td [class]="TD + ' text-sm'">{{ r.icNo }}</td>
                    <td [class]="TD + ' text-sm text-muted-foreground'">{{ r.sourceType }}</td>
                    <td [class]="TD">
                      @if (isCash(r)) {
                        <span class="text-sm text-muted-foreground">Cash</span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="docMeta(r.documentStatus).tone">
                          <span class="size-1.5 rounded-full" [ngClass]="docMeta(r.documentStatus).dot"></span>
                          {{ docMeta(r.documentStatus).label }}
                        </span>
                      }
                    </td>
                    <td [class]="TD_R + ' tabular'">{{ bookingFeeText(r.bookingFee) }}</td>
                    <td [class]="TD_R + ' text-xs text-muted-foreground tabular'">{{ stageDateText(r) }}</td>
                    <td [class]="TD_R">
                      <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                        <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="file-text" [size]="13" />
                        </button>
                        <button type="button" (click)="openInProgress(r)" title="Start Progress" aria-label="Start Progress" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="refresh-cw" [size]="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (expandedId() === r.id) {
                    <tr class="border-b border-border bg-muted/20 last:border-0">
                      <td [attr.colspan]="bookedColspan" class="p-0">
                        <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="8" class="p-8 text-center text-sm text-muted-foreground">No bookings match.</td></tr>
                }
              </tbody>
            </table>
          }

          @if (activeTab() === 'In Progress') {
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  @for (col of inprogressColumns; track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button type="button" (click)="toggleSort(col.key)" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']">
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [id]="'customer-row-' + r.id" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40" (click)="toggleExpand(r.id)">
                    <td [class]="TD">
                      <div class="flex flex-col">
                        <span class="flex items-center gap-1.5 font-medium">
                          {{ r.name }}
                          @if (readyExceptGifts(r)) {
                            <app-icon name="alert-triangle" [size]="12" class="text-[var(--warning)]" title="Ready for delivery except free gifts — outstanding items on Cost Breakdown" />
                          }
                        </span>
                        <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="text-xs text-primary hover:underline">{{ r.phone }}</a>
                      </div>
                    </td>
                    <td [class]="TD">
                      <div class="flex items-center gap-2">
                        <app-brand-mark [brand]="r.brand" />
                        <div class="flex flex-col">
                          <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                          <span class="text-xs text-muted-foreground">{{ r.yearMade }} &middot; {{ r.colour }}</span>
                        </div>
                      </div>
                    </td>
                    <td [class]="TD + ' text-sm'">{{ r.icNo }}</td>
                    <td [class]="TD">
                      @if (isCash(r)) {
                        <span class="text-sm text-muted-foreground">Cash</span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="docMeta(r.documentStatus).tone">
                          <span class="size-1.5 rounded-full" [ngClass]="docMeta(r.documentStatus).dot"></span>
                          {{ docMeta(r.documentStatus).label }}
                        </span>
                      }
                    </td>
                    <td [class]="TD + ' text-sm text-muted-foreground'">{{ r.tradeInStatus || 'No Trade-in' }}</td>
                    <td [class]="TD_R + ' text-xs text-muted-foreground tabular'">{{ stageDateText(r) }}</td>
                    <td [class]="TD_R">
                      <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                        <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="file-text" [size]="13" />
                        </button>
                        <button type="button" (click)="openDelivered(r)" title="Deliver" aria-label="Deliver" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="truck" [size]="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (expandedId() === r.id) {
                    <tr class="border-b border-border bg-muted/20 last:border-0">
                      <td [attr.colspan]="inprogressColspan" class="p-0">
                        <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="7" class="p-8 text-center text-sm text-muted-foreground">Nothing in progress.</td></tr>
                }
              </tbody>
            </table>
          }

          @if (activeTab() === 'Delivered') {
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  @for (col of deliveredColumns; track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button type="button" (click)="toggleSort(col.key)" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']">
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [id]="'customer-row-' + r.id" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40" (click)="toggleExpand(r.id)">
                    <td [class]="TD">
                      <div class="flex flex-col">
                        <span class="font-medium">{{ r.name }}</span>
                        <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="text-xs text-primary hover:underline">{{ r.phone }}</a>
                      </div>
                    </td>
                    <td [class]="TD">
                      <div class="flex items-center gap-2">
                        <app-brand-mark [brand]="r.brand" />
                        <div class="flex flex-col">
                          <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                          <span class="text-xs text-muted-foreground">{{ r.yearMade }}</span>
                        </div>
                      </div>
                    </td>
                    <td [class]="TD + ' text-sm'">{{ r.bankPanel }}</td>
                    <td [class]="TD + ' text-sm'">{{ r.insuranceName }}</td>
                    <td [class]="TD + ' text-sm tabular'">{{ r.plateNo }}</td>
                    <td [class]="TD_R + ' text-xs text-muted-foreground tabular'">{{ stageDateText(r) }}</td>
                    <td [class]="TD_R">
                      <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                        <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="file-text" [size]="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (expandedId() === r.id) {
                    <tr class="border-b border-border bg-muted/20 last:border-0">
                      <td [attr.colspan]="deliveredColspan" class="p-0">
                        <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="7" class="p-8 text-center text-sm text-muted-foreground">No deliveries match.</td></tr>
                }
              </tbody>
            </table>
          }

          @if (activeTab() === 'Cancelled') {
            <table class="w-full caption-bottom text-sm">
              <thead>
                <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  @for (col of cancelledColumns; track col.key) {
                    <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                      <button type="button" (click)="toggleSort(col.key)" class="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground" [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground']">
                        {{ col.label }}
                        <app-icon [name]="sortIcon(col.key)" [size]="14" class="opacity-70" />
                      </button>
                    </th>
                  }
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (r of rows(); track r.id) {
                  <tr [id]="'customer-row-' + r.id" class="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40" (click)="toggleExpand(r.id)">
                    <td [class]="TD">
                      <div class="flex flex-col">
                        <span class="font-medium">{{ r.name }}</span>
                        <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="text-xs text-primary hover:underline">{{ r.phone }}</a>
                      </div>
                    </td>
                    <td [class]="TD">
                      <div class="flex items-center gap-2">
                        <app-brand-mark [brand]="r.brand" />
                        <div class="flex flex-col">
                          <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                          <span class="text-xs text-muted-foreground">{{ r.yearMade }} &middot; {{ r.colour }}</span>
                        </div>
                      </div>
                    </td>
                    <td [class]="TD + ' text-sm text-muted-foreground'">{{ r.sourceType }}</td>
                    <td [class]="TD + ' text-sm'">{{ r.cancelReason || '—' }}</td>
                    <td [class]="TD_R + ' text-xs text-muted-foreground tabular'">{{ stageDateText(r) }}</td>
                    <td [class]="TD_R">
                      <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                        <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          <app-icon name="file-text" [size]="13" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  @if (expandedId() === r.id) {
                    <tr class="border-b border-border bg-muted/20 last:border-0">
                      <td [attr.colspan]="cancelledColspan" class="p-0">
                        <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="6" class="p-8 text-center text-sm text-muted-foreground">No cancelled deals.</td></tr>
                }
              </tbody>
            </table>
          }
        </div>

        <!-- Mobile cards -->
        <div class="flex flex-col gap-3 p-3 sm:hidden">
          @for (r of rows(); track r.id) {
            <div [id]="'customer-row-' + r.id" class="overflow-hidden rounded-lg border border-border">
              <div class="flex cursor-pointer flex-col gap-2 p-3 transition-colors hover:bg-muted/40" (click)="toggleExpand(r.id)">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 flex-col">
                    <span class="flex items-center gap-1.5 font-medium">
                      <span class="truncate">{{ r.name }}</span>
                      @if (activeTab() === 'Lead' && r.testDriveDate) { <app-icon name="car" [size]="12" class="shrink-0 text-muted-foreground" title="Test driven" /> }
                      @if (activeTab() === 'In Progress' && readyExceptGifts(r)) {
                        <app-icon name="alert-triangle" [size]="12" class="shrink-0 text-[var(--warning)]" title="Ready for delivery except free gifts — outstanding items on Cost Breakdown" />
                      }
                    </span>
                    <a [href]="waLink(r.phone)" target="_blank" rel="noopener" (click)="$event.stopPropagation()" class="w-fit text-xs text-primary hover:underline">{{ r.phone }}</a>
                  </div>
                  <app-icon name="chevron-down" [size]="16" class="mt-0.5 shrink-0 text-muted-foreground transition-transform" [ngClass]="expandedId() === r.id ? 'rotate-180' : ''" />
                </div>
                <div class="flex items-center gap-2">
                  <app-brand-mark [brand]="r.brand" />
                  <div class="flex flex-col">
                    <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                    <span class="text-xs text-muted-foreground">{{ r.yearMade }} &middot; {{ r.colour }}</span>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 border-t border-border pt-2">
                  @for (col of cardMetaColumns(); track col.key) {
                    <div class="flex flex-col gap-0.5">
                      <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{{ col.label }}</span>
                      @if (col.key === 'status') {
                        <span class="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta(r.status).tone">
                          <span class="size-1.5 rounded-full" [ngClass]="statusMeta(r.status).dot"></span>
                          {{ statusMeta(r.status).label }}
                        </span>
                      } @else if (col.key === 'documentStatus') {
                        @if (isCash(r)) {
                          <span class="text-sm text-muted-foreground">Cash</span>
                        } @else {
                          <span class="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="docMeta(r.documentStatus).tone">
                            <span class="size-1.5 rounded-full" [ngClass]="docMeta(r.documentStatus).dot"></span>
                            {{ docMeta(r.documentStatus).label }}
                          </span>
                        }
                      } @else {
                        <span [ngClass]="col.key === 'stageDate' ? 'text-xs text-muted-foreground tabular' : 'text-sm'">{{ cardFieldValue(r, col.key) }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
              <div class="flex items-center gap-1.5 border-t border-border bg-muted/20 p-2" (click)="$event.stopPropagation()">
                <button type="button" (click)="openQuotation(r)" title="View Quotation" aria-label="View quotation" class="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                  <app-icon name="file-text" [size]="14" />
                </button>
                @switch (activeTab()) {
                  @case ('All') {
                    <button type="button" (click)="requestDelete(r)" title="Delete" aria-label="Delete customer" class="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  }
                  @case ('Lead') {
                    <button type="button" (click)="openBooked(r)" title="Mark as Booked" aria-label="Mark as Booked" class="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                      <app-icon name="clipboard-check" [size]="14" />
                    </button>
                  }
                  @case ('Booked') {
                    <button type="button" (click)="openInProgress(r)" title="Start Progress" aria-label="Start Progress" class="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                      <app-icon name="refresh-cw" [size]="14" />
                    </button>
                  }
                  @case ('In Progress') {
                    <button type="button" (click)="openDelivered(r)" title="Deliver" aria-label="Deliver" class="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                      <app-icon name="truck" [size]="14" />
                    </button>
                  }
                }
              </div>
              @if (expandedId() === r.id) {
                <div class="border-t border-border bg-muted/20">
                  <app-customer-accordion-detail [record]="r" (edit)="onAccordionEdit($event)" (addNote)="onAccordionAddNote($event)" (cancel)="openCancel($event)" (reopen)="requestReopen($event)" (recordTestDrive)="openTestDrive($event)" />
                </div>
              }
            </div>
          } @empty {
            <p class="p-8 text-center text-sm text-muted-foreground">{{ emptyMessageForActiveTab() }}</p>
          }
        </div>

        <!-- Pagination -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <select
              [ngModel]="pageSize()"
              (ngModelChange)="setPageSize($event)"
              class="h-8 rounded-md border border-input bg-input px-2 text-xs text-foreground outline-none focus:border-ring"
            >
              @for (n of pageSizeOptions; track n) { <option [ngValue]="n">{{ n }}</option> }
            </select>
            <span class="tabular">Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ filteredSorted().length }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              (click)="prevPage()"
              [disabled]="currentPage() === 0"
              class="inline-flex size-8 items-center justify-center rounded-md border border-input bg-transparent transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              aria-label="Previous page"
            >
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <span class="px-2 text-xs text-muted-foreground tabular">{{ currentPage() + 1 }} / {{ pageCount() }}</span>
            <button
              type="button"
              (click)="nextPage()"
              [disabled]="currentPage() >= pageCount() - 1"
              class="inline-flex size-8 items-center justify-center rounded-md border border-input bg-transparent transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              aria-label="Next page"
            >
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Lead modal -->
    @if (modal() === 'add') {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <!-- Preview sidebar — spans the full modal height -->
          <div class="hidden w-64 shrink-0 flex-col justify-center gap-5 overflow-y-auto border-r border-border bg-muted/30 p-5 sm:flex">
            <div class="flex flex-col items-center gap-1 text-center">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</span>
              <span class="text-sm font-semibold">{{ leadForm.brand }} {{ leadForm.model }}</span>
              <span class="text-xs text-muted-foreground">{{ leadForm.variant }} &middot; {{ leadForm.yearMade }}</span>
            </div>
            @if (leadQuotationPreview(); as lp) {
              <div class="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-4 py-4 text-center shadow-sm">
                <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Selling Price</span>
                <span class="text-2xl font-bold tabular tracking-tight">{{ fmt(lp.allInPrice) }}</span>
              </div>

              @if (leadForm.financingType !== 'Cash') {
                <div class="grid grid-cols-2 gap-2">
                  <div class="flex flex-col gap-0.5 rounded-lg bg-card px-2.5 py-2">
                    <span class="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Downpayment</span>
                    <span class="text-sm font-semibold tabular">{{ fmt(lp.downpaymentCash) }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 rounded-lg bg-card px-2.5 py-2">
                    <span class="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Loan Amount</span>
                    <span class="text-sm font-semibold tabular">{{ fmt(lp.loanAmount) }}</span>
                  </div>
                </div>
              }

              <div class="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">OTR Price</span>
                  <span class="font-medium tabular">{{ fmt(lp.basePrice) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Rebate</span>
                  <span class="font-medium tabular text-[var(--success)]">&minus; {{ fmt(lp.effectiveRebate) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Insurance ({{ leadQuotationForm.ncd }}% NCD)</span>
                  <span class="font-medium tabular">+ {{ fmt(lp.insuranceAmount) }}</span>
                </div>
              </div>

              @if (leadForm.financingType !== 'Cash') {
                <div class="flex flex-col gap-1 border-t border-border pt-3">
                  <span class="text-[10px] text-muted-foreground">
                    {{ leadQuotationForm.interestRate }}% <span class="text-muted-foreground/70">&middot; {{ leadQuotationForm.rateType === 'effective' ? 'EIR' : 'Flat' }}</span>
                  </span>
                  @for (row of lp.repaymentRows; track row.months) {
                    @if (row.months === leadQuotationForm.tenureMonths) {
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-medium">{{ row.label }}</span>
                        <span class="text-sm font-semibold tabular">{{ fmt(row.monthly) }}/mo</span>
                      </div>
                    }
                  }
                </div>
              }
            }
          </div>

          <!-- Header + form -->
          <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div class="flex items-center gap-3 border-b border-border p-4">
              <span class="text-sm font-semibold">Add Lead</span>
              <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                <app-icon name="x" [size]="16" />
              </button>
            </div>
            <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <fieldset class="flex flex-col gap-3">
                <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</legend>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Name
                    <input type="text" [(ngModel)]="leadForm.name" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Phone No
                    <input type="tel" [(ngModel)]="leadForm.phone" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Source Type
                    <select [(ngModel)]="leadForm.sourceType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (s of sourceTypes; track s) { <option [value]="s">{{ s }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Date
                    <input type="date" [(ngModel)]="leadForm.date" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
              </fieldset>

              <fieldset class="flex flex-col gap-3">
                <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vehicle</legend>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Brand
                    <select [(ngModel)]="leadForm.brand" (ngModelChange)="onLeadBrandChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Model
                    <select [(ngModel)]="leadForm.model" (ngModelChange)="onLeadModelChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (m of leadModelsForBrand(); track m) { <option [value]="m">{{ m }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Variant
                    <select [ngModel]="leadForm.variant" (ngModelChange)="onLeadVariantChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (v of leadVariantsForModel(); track v) { <option [value]="v">{{ v }}</option> }
                    </select>
                  </label>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Year Made
                    <select [(ngModel)]="leadForm.yearMade" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (y of modelYears; track y) { <option [ngValue]="y">{{ y }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Colour
                    <select [(ngModel)]="leadForm.colour" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (c of colourOptions; track c) { <option [value]="c">{{ c }}</option> }
                    </select>
                  </label>
                </div>
              </fieldset>

              <fieldset class="flex flex-col gap-3">
                <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Financing</legend>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Financing Type
                  <select [(ngModel)]="leadForm.financingType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
                  </select>
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Rebate (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="leadQuotationForm.rebate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    NCD
                    <select [(ngModel)]="leadQuotationForm.ncd" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (opt of ncdOptions; track opt.value) { <option [ngValue]="opt.value">{{ opt.label }}</option> }
                    </select>
                  </label>
                </div>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  <span class="flex items-center gap-2">
                    <input type="checkbox" [(ngModel)]="leadQuotationForm.additionalRebateEnabled" aria-label="Include additional rebate" class="size-4 shrink-0 rounded border-input accent-primary" />
                    Additional Rebate (RM)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    [disabled]="!leadQuotationForm.additionalRebateEnabled"
                    [(ngModel)]="leadQuotationForm.additionalRebateValue"
                    class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
                @if (leadForm.financingType !== 'Cash') {
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Rate Type
                    <select [(ngModel)]="leadQuotationForm.rateType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      <option value="flat">Flat</option>
                      <option value="effective">EIR</option>
                    </select>
                  </label>
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      {{ leadQuotationForm.rateType === 'effective' ? 'Effective Rate (%)' : 'Flat Rate (%)' }}
                      <input type="number" min="0" step="0.1" [(ngModel)]="leadQuotationForm.interestRate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                    </label>
                    <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                      Tenure
                      <select [(ngModel)]="leadQuotationForm.tenureMonths" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                        @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label }}</option> }
                      </select>
                    </label>
                  </div>
                  <div class="flex flex-col gap-2">
                    <span class="text-xs font-medium text-muted-foreground">Downpayment</span>
                    <div class="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        [attr.max]="leadQuotationForm.downpaymentType === 'percent' ? 100 : null"
                        [step]="leadQuotationForm.downpaymentType === 'percent' ? 1 : 500"
                        [(ngModel)]="leadQuotationForm.downpaymentValue"
                        class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm font-medium tabular outline-none focus:border-ring"
                      />
                      <div class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                        <button
                          type="button"
                          (click)="leadQuotationForm.downpaymentType = 'percent'"
                          class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                          [ngClass]="leadQuotationForm.downpaymentType === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                        >
                          %
                        </button>
                        <button
                          type="button"
                          (click)="leadQuotationForm.downpaymentType = 'amount'"
                          class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                          [ngClass]="leadQuotationForm.downpaymentType === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                        >
                          Amt
                        </button>
                      </div>
                    </div>
                  </div>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Loan Amount (RM)
                    <input
                      type="number"
                      min="0"
                      step="500"
                      [ngModel]="round(leadQuotationPreview().loanAmount)"
                      (ngModelChange)="onLeadLoanAmountChange($event)"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm font-medium tabular text-foreground outline-none focus:border-ring"
                    />
                  </label>
                }
              </fieldset>
            </div>
            <div class="flex items-center justify-end gap-2 border-t border-border p-4">
              <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
              <button type="button" (click)="submitLead()" [disabled]="!leadForm.name || !leadForm.phone" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Add Lead</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Record Test Drive modal -->
    @if (modal() === 'testdrive' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Record Test Drive &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <p class="text-[11px] text-muted-foreground">Needed for the test drive paperwork.</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                IC No
                <input type="text" [(ngModel)]="testDriveForm.icNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Driving Licence No
                <input type="text" [(ngModel)]="testDriveForm.drivingLicenceNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Address
              <input type="text" [(ngModel)]="testDriveForm.address" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Email
                <input type="email" [(ngModel)]="testDriveForm.email" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Test Drive Date
                <input type="date" [(ngModel)]="testDriveForm.testDriveDate" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitTestDrive(rec.id)" [disabled]="!canSubmitTestDrive()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Mark as Booked modal -->
    @if (modal() === 'booked' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Mark as Booked &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              IC No
              <input type="text" [(ngModel)]="bookedForm.icNo" class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Address
              <input type="text" [(ngModel)]="bookedForm.address" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Email
                <input type="email" [(ngModel)]="bookedForm.email" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Booking Fee (RM) <span class="text-muted-foreground/70">— 0 = N/A</span>
                <input type="number" min="0" step="100" [(ngModel)]="bookedForm.bookingFee" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>

            @if (rec.quotation && !isCash(rec)) {
              <p class="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">Down payment &amp; NCD below are prefilled from the quotation — adjust if needed.</p>
            }
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              @if (isCash(rec)) {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Selling Price
                  <span class="flex h-10 items-center rounded-lg border border-input bg-input px-3 text-sm text-muted-foreground">{{ fmt(vehiclePrice(rec)) }}</span>
                </label>
              } @else {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Down Payment (RM)
                  <input type="number" min="0" step="500" [(ngModel)]="bookedForm.downpayment" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
              }
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                NCD (%)
                <select [(ngModel)]="bookedForm.ncd" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (n of ncdOptions; track n.value) { <option [ngValue]="n.value">{{ n.label }}</option> }
                </select>
              </label>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitBooked(rec.id)" [disabled]="!canSubmitBooked(bookedForm)" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Start Progress modal -->
    @if (modal() === 'inprogress' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Start Progress &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <p class="text-[11px] text-muted-foreground">{{ rec.brand }} {{ rec.model }} &middot; {{ rec.variant }}</p>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Financing Type
              <select [(ngModel)]="inProgressForm.financingType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
              </select>
            </label>

            @if (inProgressForm.financingType === 'Cash') {
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Payment Status
                <select [(ngModel)]="inProgressForm.paymentStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (p of paymentStatusOptions; track p) { <option [value]="p">{{ p }}</option> }
                </select>
              </label>
            } @else {
              <p class="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                The bank panel below is the customer's <strong class="text-foreground">final confirmed</strong> financing bank. Down payment, amount and tenure are prefilled from the quotation — confirm or adjust them. Interest rate is manual — the bank sets it.
              </p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Bank Panel
                  <select [(ngModel)]="inProgressForm.bankPanel" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (b of bankOptions; track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Loan Amount (RM)
                  <input type="number" min="0" step="500" [(ngModel)]="inProgressForm.loanAmount" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Down Payment (RM)
                  <input type="number" min="0" step="500" [(ngModel)]="inProgressForm.downpayment" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Down Payment Status
                  <select [(ngModel)]="inProgressForm.downPaymentStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (p of paymentStatusOptions; track p) { <option [value]="p">{{ p }}</option> }
                  </select>
                </label>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Tenure
                  <select [(ngModel)]="inProgressForm.loanTenureMonths" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label }}</option> }
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Interest Rate (%)
                  <input type="number" min="0" step="0.1" placeholder="e.g. 3.5" [(ngModel)]="inProgressForm.loanInterestRate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
              </div>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitInProgress(rec.id)" [disabled]="!canSubmitInProgress(inProgressForm)" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Mark as Delivered modal -->
    @if (modal() === 'delivered' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Mark as Delivered &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            @if (!giftsCompleteFor(rec)) {
              <div class="flex items-start gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2.5 text-[11px] text-foreground">
                <app-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0 text-[var(--warning)]" />
                <span>{{ giftsBlockingText(rec) }} — <a routerLink="/notes" class="font-medium text-primary hover:underline">manage on Cost Breakdown</a>.</span>
              </div>
            }
            @if (rec.colour === TO_BE_CONFIRMED_COLOUR) {
              <div class="flex items-start gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2.5 text-[11px] text-foreground">
                <app-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0 text-[var(--warning)]" />
                <span>Colour is still "To be Confirmed" — update it to the actual colour via Edit before this car can be marked Delivered.</span>
              </div>
            }
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Registration Number
                <input type="text" [(ngModel)]="deliveredForm.plateNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Delivery Date
                <input type="date" [(ngModel)]="deliveredForm.deliveryDate" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Chassis / VIN
                <input type="text" [(ngModel)]="deliveredForm.chassisNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Engine No.
                <input type="text" [(ngModel)]="deliveredForm.engineNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Insurance Name
              <select [(ngModel)]="deliveredForm.insuranceName" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (i of insuranceOptions; track i) { <option [value]="i">{{ i }}</option> }
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Delivery Notes
              <textarea rows="2" [(ngModel)]="deliveredForm.deliveryNotes" class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"></textarea>
            </label>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitDelivered(rec.id)" [disabled]="!canSubmitDelivered(deliveredForm, giftsCompleteFor(rec), rec.colour !== TO_BE_CONFIRMED_COLOUR)" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    }

    <!-- Cancel modal -->
    @if (modal() === 'cancel' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Cancel Booking &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <p class="text-[11px] text-muted-foreground">This cancels <strong class="text-foreground">{{ rec.name }}</strong>'s {{ rec.brand }} {{ rec.model }} deal.</p>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Reason
              <select [(ngModel)]="cancelForm.cancelReason" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (r of cancelReasons; track r) { <option [value]="r">{{ r }}</option> }
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Cancellation Notes @if (cancelForm.cancelReason === 'Other') { <span class="text-[var(--destructive)]">*</span> }
              <textarea
                rows="2"
                [(ngModel)]="cancelForm.cancelNotes"
                placeholder="Details required when reason is 'Other'"
                class="rounded-lg border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                [ngClass]="canSubmitCancel(cancelForm) ? 'border-input' : 'border-[var(--destructive)]'"
              ></textarea>
            </label>
            @if ((rec.bookingFee ?? 0) > 0) {
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Refund Status
                <select [(ngModel)]="cancelForm.refundStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (s of refundStatusOptions; track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </label>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Back</button>
            <button
              type="button"
              (click)="submitCancel(rec.id)"
              [disabled]="!canSubmitCancel(cancelForm)"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Quotation modal -->
    @if (activeQuotationRecord(); as qrec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeQuotation()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Quotation &middot; {{ qrec.name }}</span>
            <button type="button" (click)="closeQuotation()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          @if (!quotationEditing() && qrec.quotation) {
            <!-- View mode -->
            <div class="flex flex-col gap-3 overflow-y-auto p-4">
              <p class="text-sm font-medium">{{ qrec.brand }} {{ qrec.model }} &middot; {{ qrec.variant }}</p>
              @if (quotationViewNumbers(qrec); as qv) {
                <div class="flex items-center gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <app-icon name="tag" [size]="16" />
                  </span>
                  <div class="flex flex-col">
                    <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Selling Price</span>
                    <span class="text-2xl font-bold tabular tracking-tight">{{ fmt(qv.allInPrice) }}</span>
                  </div>
                </div>
                @if (!isCash(qrec)) {
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                      <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Downpayment</span>
                      <span class="text-sm font-semibold tabular">{{ fmt(qv.downpaymentCash) }}</span>
                    </div>
                    <div class="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                      <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Loan Amount</span>
                      <span class="text-sm font-semibold tabular">{{ fmt(qv.loanAmount) }}</span>
                    </div>
                  </div>
                }
                <div class="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
                  <div class="flex items-center justify-between px-3 py-2">
                    <span class="text-muted-foreground">OTR Price</span>
                    <span class="font-medium tabular">{{ fmt(qv.basePrice) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-2">
                    <span class="text-muted-foreground">Rebate</span>
                    <span class="font-medium tabular text-[var(--success)]">&minus; {{ fmt(qv.effectiveRebate) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-2">
                    <span class="text-muted-foreground">Insurance ({{ qrec.quotation.ncd }}% NCD)</span>
                    <span class="font-medium tabular">+ {{ fmt(qv.insuranceAmount) }}</span>
                  </div>
                </div>
                @if (!isCash(qrec)) {
                  <div class="overflow-hidden rounded-lg border border-border">
                    <div class="border-b border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                      {{ qrec.quotation.interestRate }}% <span class="text-muted-foreground/70">&middot; {{ qv.rateType === 'effective' ? 'EIR' : 'Flat' }}</span>
                    </div>
                    @for (row of qv.repaymentRows; track row.months) {
                      @if (row.months === qrec.quotation.tenureMonths) {
                        <div class="flex items-center justify-between px-3 py-2 text-sm">
                          <span class="font-medium">{{ row.label }}</span>
                          <span class="font-semibold tabular">{{ fmt(row.monthly) }}/mo</span>
                        </div>
                      }
                    }
                  </div>
                }
              }
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
              @if (qrec.status !== 'Delivered') {
                <button type="button" (click)="startEditQuotation()" class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                  <app-icon name="pencil" [size]="13" />
                  Edit
                </button>
              }
              <button type="button" (click)="printQuotation(qrec)" class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                <app-icon name="file-text" [size]="13" />
                Print
              </button>
              <button type="button" (click)="downloadQuotation(qrec)" class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                <app-icon name="download" [size]="13" />
                Download PDF
              </button>
            </div>
          } @else {
            <!-- Edit / create mode -->
            <div class="flex flex-col gap-3 overflow-y-auto p-4">
              @if (!qrec.quotation) {
                <p class="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">No quotation yet for this customer — fill in the details below to create one.</p>
              }
              <p class="text-sm font-medium">{{ qrec.brand }} {{ qrec.model }} &middot; {{ qrec.variant }}</p>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Rebate (RM)
                  <input type="number" min="0" step="500" [(ngModel)]="quotationForm.rebate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  NCD
                  <select [(ngModel)]="quotationForm.ncd" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (opt of ncdOptions; track opt.value) { <option [ngValue]="opt.value">{{ opt.label }}</option> }
                  </select>
                </label>
              </div>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                <span class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="quotationForm.additionalRebateEnabled" aria-label="Include additional rebate" class="size-4 shrink-0 rounded border-input accent-primary" />
                  Additional Rebate (RM)
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  [disabled]="!quotationForm.additionalRebateEnabled"
                  [(ngModel)]="quotationForm.additionalRebateValue"
                  class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Rate Type
                <select [(ngModel)]="quotationForm.rateType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  <option value="flat">Flat</option>
                  <option value="effective">EIR</option>
                </select>
              </label>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {{ quotationForm.rateType === 'effective' ? 'Effective Rate (%)' : 'Flat Rate (%)' }}
                  <input type="number" min="0" step="0.1" [(ngModel)]="quotationForm.interestRate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Tenure
                  <select [(ngModel)]="quotationForm.tenureMonths" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label }}</option> }
                  </select>
                </label>
              </div>
              <div class="flex flex-col gap-2">
                <span class="text-xs font-medium text-muted-foreground">Downpayment</span>
                <div class="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    [attr.max]="quotationForm.downpaymentType === 'percent' ? 100 : null"
                    [step]="quotationForm.downpaymentType === 'percent' ? 1 : 500"
                    [(ngModel)]="quotationForm.downpaymentValue"
                    class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm font-medium tabular outline-none focus:border-ring"
                  />
                  <div class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      (click)="quotationForm.downpaymentType = 'percent'"
                      class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                      [ngClass]="quotationForm.downpaymentType === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                    >
                      %
                    </button>
                    <button
                      type="button"
                      (click)="quotationForm.downpaymentType = 'amount'"
                      class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                      [ngClass]="quotationForm.downpaymentType === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'"
                    >
                      Amt
                    </button>
                  </div>
                </div>
              </div>
              @if (quotationPreview(); as qp) {
                <div class="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                  <span class="flex flex-col">
                    Selling Price
                    <strong class="text-sm text-foreground tabular">{{ fmt(qp.allInPrice) }}</strong>
                  </span>
                  <span class="flex flex-col">
                    Downpayment
                    <strong class="text-sm text-foreground tabular">{{ fmt(qp.downpaymentCash) }}</strong>
                  </span>
                  <span class="flex flex-col">
                    Loan Amount
                    <strong class="text-sm text-foreground tabular">{{ fmt(qp.loanAmount) }}</strong>
                  </span>
                </div>
              }
            </div>
            <div class="flex items-center justify-end gap-2 border-t border-border p-4">
              <button type="button" (click)="cancelEditQuotation()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
              <button type="button" (click)="saveQuotation(qrec.id)" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Save</button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Delete confirmation -->
    @if (deleteTarget(); as target) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="cancelDelete()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              Delete customer?
            </span>
            <p class="text-sm text-muted-foreground">
              This permanently removes <strong class="text-foreground">{{ target.name }}</strong>
              ({{ target.brand }} {{ target.model }}) and everything recorded for them. This can't be undone.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="cancelDelete()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button
              type="button"
              (click)="confirmDelete()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Reopen confirmation -->
    @if (reopenTarget(); as target) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="cancelReopen()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold">
              <app-icon name="rotate-ccw" [size]="15" />
              Reopen customer?
            </span>
            <p class="text-sm text-muted-foreground">
              This restores <strong class="text-foreground">{{ target.name }}</strong> ({{ target.brand }} {{ target.model }}) to
              <strong class="text-foreground">{{ target.previousStatus }}</strong>. All data captured before cancellation is kept.
            </p>
            @if (target.refundStatus === 'Refunded') {
              <p class="rounded-lg bg-[var(--warning)]/10 px-3 py-2 text-xs text-foreground">Note: the booking fee was already refunded and won't be restored.</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="cancelReopen()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="confirmReopen()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Reopen</button>
          </div>
        </div>
      </div>
    }

    <!-- Edit Customer modal -->
    @if (modal() === 'edit' && activeRecord(); as rec) {
      <app-customer-edit-modal [record]="rec" (save)="submitEdit(rec.id, $event)" (close)="closeModal()" />
    }

    <!-- Add Note modal -->
    @if (modal() === 'note' && activeRecord(); as rec) {
      <app-customer-note-modal [record]="rec" (save)="submitNote(rec.id, $event)" (close)="closeModal()" />
    }
  `,
})
export class CustomerManagerComponent {
  tabs: Tab[] = ['All', 'Lead', 'Booked', 'In Progress', 'Delivered', 'Cancelled'];
  activeTab = signal<Tab>('All');

  TD = TD;
  TD_R = TD_R;

  allColumns = ALL_COLUMNS;
  leadColumns = LEAD_COLUMNS;
  bookedColumns = BOOKED_COLUMNS;
  inprogressColumns = INPROGRESS_COLUMNS;
  deliveredColumns = DELIVERED_COLUMNS;
  cancelledColumns = CANCELLED_COLUMNS;

  sourceTypes = SOURCE_TYPES;
  documentStatusOptions = DOCUMENT_STATUS_OPTIONS;
  colourOptions = COLOUR_OPTIONS;
  TO_BE_CONFIRMED_COLOUR = TO_BE_CONFIRMED_COLOUR;
  bankOptions = BANK_OPTIONS;
  insuranceOptions = INSURANCE_OPTIONS;
  cancelReasons = CANCEL_REASON_OPTIONS;
  ncdOptions = NCD_OPTIONS;
  tenureOptions = TENURE_OPTIONS;
  modelYears = MODEL_YEARS;
  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));
  pageSizeOptions = PAGE_SIZE_OPTIONS;
  financingTypeOptions = FINANCING_TYPE_OPTIONS;
  paymentStatusOptions = PAYMENT_STATUS_OPTIONS;
  refundStatusOptions: ('Pending' | 'Refunded')[] = ['Pending', 'Refunded'];

  allColspan = ALL_COLSPAN;
  leadColspan = LEAD_COLSPAN;
  bookedColspan = BOOKED_COLSPAN;
  inprogressColspan = INPROGRESS_COLSPAN;
  deliveredColspan = DELIVERED_COLSPAN;
  cancelledColspan = CANCELLED_COLSPAN;

  fmt = (v: number) => `RM ${v.toLocaleString('en-MY')}`;
  round = Math.round;
  docMeta = (s?: DocumentStatus) => DOCUMENT_STATUS_META[s ?? 'NO'] ?? DOCUMENT_STATUS_META.NO;
  statusMeta = (s: CustomerStatus) => CUSTOMER_STATUS_META[s];
  bookingFeeText = (fee?: number) => bookingFeeDisplay(fee, this.fmt);
  isCash = isCashDeal;
  canSubmitBooked = canSubmitBooked;
  canSubmitInProgress = canSubmitInProgress;
  canSubmitDelivered = canSubmitDelivered;
  canSubmitCancel = canSubmitCancel;
  stageDateText = (r: CustomerRecord) => formatStageDate(currentStageEnteredAt(r));

  waLink(phone: string): string {
    return `https://wa.me/${phone.replace(/[^0-9]/g, '')}`;
  }

  /** Mobile card fields: the active tab's columns minus name/brand, which the card already shows
   *  in its own header rows. */
  cardMetaColumns(): Column[] {
    const cols =
      this.activeTab() === 'Lead'
        ? this.leadColumns
        : this.activeTab() === 'Booked'
          ? this.bookedColumns
          : this.activeTab() === 'In Progress'
            ? this.inprogressColumns
            : this.activeTab() === 'Delivered'
              ? this.deliveredColumns
              : this.activeTab() === 'Cancelled'
                ? this.cancelledColumns
                : this.allColumns;
    return cols.filter((c) => c.key !== 'name' && c.key !== 'brand');
  }

  /** Plain-text value for a mobile card field; 'status'/'documentStatus' are rendered as badges
   *  in the template instead of through this. */
  cardFieldValue(r: CustomerRecord, key: SortKey): string {
    switch (key) {
      case 'stageDate':
        return this.stageDateText(r);
      case 'bookingFee':
        return this.bookingFeeText(r.bookingFee);
      case 'tradeInStatus':
        return r.tradeInStatus || 'No Trade-in';
      case 'cancelReason':
        return r.cancelReason || '—';
      default: {
        const v = r[key as keyof CustomerRecord];
        return v === undefined || v === null || v === '' ? '—' : String(v);
      }
    }
  }

  emptyMessageForActiveTab(): string {
    switch (this.activeTab()) {
      case 'Lead':
        return 'No leads match.';
      case 'Booked':
        return 'No bookings match.';
      case 'In Progress':
        return 'Nothing in progress.';
      case 'Delivered':
        return 'No deliveries match.';
      case 'Cancelled':
        return 'No cancelled deals.';
      default:
        return 'No customers match.';
    }
  }

  giftsCompleteFor(r: CustomerRecord): boolean {
    return freeGiftsComplete(r);
  }

  giftsBlockingText(r: CustomerRecord): string {
    const s = freeGiftsSummary(r);
    if (!s) return 'Free gifts outstanding';
    return `${s.total - s.done} of ${s.total} free gift item(s) still outstanding`;
  }

  /** In Progress row marker: every other Delivered-gate field is filled but gifts aren't — flags
   *  a deal that's otherwise ready so the SA knows exactly what's blocking it. */
  readyExceptGifts(r: CustomerRecord): boolean {
    return !!r.plateNo && !!r.chassisNo && !!r.engineNo && !!r.insuranceName && !!r.deliveryDate && !freeGiftsComplete(r);
  }

  // Accordion row expand/collapse — only one customer expanded at a time.
  expandedId = signal<string | null>(null);
  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  modal = signal<ModalKind>(null);
  activeRecordId = signal<string | null>(null);
  deleteTargetId = signal<string | null>(null);
  reopenTargetId = signal<string | null>(null);

  nameFilter = signal('');
  // Deliberately starts on "All", not the account's Default Brand — hiding other brands' existing
  // customers by default risks the SA forgetting about them.
  carFilter = signal('All');
  sourceFilter = signal('All');
  testDriveFilter = signal<'All' | 'Yes' | 'No'>('All');
  dateFromFilter = signal('');
  dateToFilter = signal('');
  sortKey = signal<SortKey>('stageDate');
  sortDir = signal<SortDir>('desc');

  pageSize = signal(10);
  page = signal(0);

  constructor(
    public customers: CustomerService,
    private advisor: AdvisorService,
    private route: ActivatedRoute,
  ) {
    // Deep link from elsewhere in the app (e.g. Recent Deals' phone number) — ?customer=<id>
    // switches to that record's tab and pops its accordion open.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('customer');
      // Deferred: queryParamMap emits synchronously on subscribe, which runs before this
      // component's other field initializers (declared below the constructor) have run.
      if (id) setTimeout(() => this.openCustomer(id));
    });
  }

  openCustomer(id: string) {
    const record = this.customers.records().find((r) => r.id === id);
    if (!record) return;
    this.nameFilter.set('');
    this.carFilter.set('All');
    this.sourceFilter.set('All');
    this.testDriveFilter.set('All');
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
    this.activeTab.set(record.status);
    const index = this.filteredSorted().findIndex((r) => r.id === id);
    this.page.set(index >= 0 ? Math.floor(index / this.pageSize()) : 0);
    this.expandedId.set(id);
    setTimeout(() => {
      document.getElementById(`customer-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  deleteTarget = computed(() => this.customers.records().find((r) => r.id === this.deleteTargetId()) ?? null);

  requestDelete(record: CustomerRecord) {
    this.deleteTargetId.set(record.id);
  }

  cancelDelete() {
    this.deleteTargetId.set(null);
  }

  async confirmDelete() {
    const id = this.deleteTargetId();
    if (!id) return;
    await this.customers.deleteCustomer(id);
    this.deleteTargetId.set(null);
  }

  reopenTarget = computed(() => this.customers.records().find((r) => r.id === this.reopenTargetId()) ?? null);

  requestReopen(record: CustomerRecord) {
    this.reopenTargetId.set(record.id);
  }

  cancelReopen() {
    this.reopenTargetId.set(null);
  }

  async confirmReopen() {
    const id = this.reopenTargetId();
    if (!id) return;
    await this.customers.reopenCustomer(id);
    this.reopenTargetId.set(null);
  }

  activeRecord = computed(() => this.customers.records().find((r) => r.id === this.activeRecordId()) ?? null);

  countFor(t: Tab): number {
    if (t === 'All') return this.customers.records().length;
    if (t === 'Lead') return this.customers.leads().length;
    if (t === 'Booked') return this.customers.booked().length;
    if (t === 'In Progress') return this.customers.inProgress().length;
    if (t === 'Delivered') return this.customers.delivered().length;
    return this.customers.cancelled().length;
  }

  selectTab(t: Tab) {
    this.activeTab.set(t);
    this.page.set(0);
  }

  filteredSorted = computed(() => {
    const tab = this.activeTab();
    let list = this.customers.records();
    if (tab !== 'All') {
      list = list.filter((r) => r.status === tab);
    }

    const search = this.nameFilter().trim().toLowerCase();
    if (search) {
      list = list.filter((r) => `${r.name} ${r.brand} ${r.model} ${r.variant}`.toLowerCase().includes(search));
    }
    if (this.carFilter() !== 'All') list = list.filter((r) => r.brand === this.carFilter());
    if (this.sourceFilter() !== 'All') list = list.filter((r) => r.sourceType === this.sourceFilter());
    if (this.testDriveFilter() !== 'All') {
      const wantsDriven = this.testDriveFilter() === 'Yes';
      list = list.filter((r) => !!r.testDriveDate === wantsDriven);
    }
    if (this.dateFromFilter()) list = list.filter((r) => r.date >= this.dateFromFilter());
    if (this.dateToFilter()) list = list.filter((r) => r.date <= this.dateToFilter());

    const key = this.sortKey();
    const dir = this.sortDir();
    return [...list].sort((a, b) => compareRecords(a, b, key, dir));
  });

  pageCount = computed(() => Math.max(1, Math.ceil(this.filteredSorted().length / this.pageSize())));
  currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));

  rows = computed(() => {
    const p = this.currentPage();
    const size = this.pageSize();
    return this.filteredSorted().slice(p * size, p * size + size);
  });

  rangeStart = computed(() => (this.filteredSorted().length === 0 ? 0 : this.currentPage() * this.pageSize() + 1));
  rangeEnd = computed(() => Math.min((this.currentPage() + 1) * this.pageSize(), this.filteredSorted().length));

  setPageSize(n: number) {
    this.pageSize.set(n);
    this.page.set(0);
  }

  prevPage() {
    this.page.set(Math.max(0, this.currentPage() - 1));
  }

  nextPage() {
    this.page.set(Math.min(this.pageCount() - 1, this.currentPage() + 1));
  }

  toggleSort(key: SortKey) {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.page.set(0);
  }

  sortIcon(key: SortKey): IconName {
    if (this.sortKey() !== key) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  hasActiveFilters(): boolean {
    return (
      !!this.nameFilter() ||
      this.carFilter() !== 'All' ||
      this.sourceFilter() !== 'All' ||
      this.testDriveFilter() !== 'All' ||
      !!this.dateFromFilter() ||
      !!this.dateToFilter()
    );
  }

  clearFilters() {
    this.nameFilter.set('');
    this.carFilter.set('All');
    this.sourceFilter.set('All');
    this.testDriveFilter.set('All');
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
    this.page.set(0);
  }

  private settings = inject(SettingsService);
  modelVariantLabel = modelVariantLabel;

  leadForm: NewLeadInput = this.blankLeadForm();

  private blankLeadForm(): NewLeadInput {
    const preferredBrand = this.settings.settings().dashboardTarget.brand;
    const first = VEHICLES.find((v) => v.brand === preferredBrand) ?? VEHICLES[0];
    return {
      name: '',
      phone: '',
      brand: first.brand,
      model: first.model,
      variant: first.variant,
      yearMade: MODEL_YEARS[0],
      colour: TO_BE_CONFIRMED_COLOUR,
      sourceType: SOURCE_TYPES[0],
      date: todayStr(),
      financingType: 'Loan',
    };
  }

  // Plain methods, not computed(): leadForm is a mutable object, not a signal, so
  // computed() would never see a dependency change and would freeze after first read.
  leadModelsForBrand(): string[] {
    return modelsForBrand(this.leadForm.brand);
  }
  leadVariantsForModel(): string[] {
    return variantsForModel(this.leadForm.brand, this.leadForm.model);
  }

  onLeadBrandChange(brand: string) {
    this.leadForm.brand = brand;
    const firstModel = VEHICLES.find((v) => v.brand === brand)!.model;
    this.onLeadModelChange(firstModel);
  }

  onLeadModelChange(model: string) {
    this.leadForm.model = model;
    const firstVariant = VEHICLES.find((v) => v.brand === this.leadForm.brand && v.model === model)!;
    this.leadForm.variant = firstVariant.variant;
    this.syncLeadRebateDefaults();
  }

  onLeadVariantChange(variant: string) {
    this.leadForm.variant = variant;
    this.syncLeadRebateDefaults();
  }

  /** Pre-fills Rebate and Additional Rebate from the newly selected car's Finance Database
   *  defaults, same as switching cars in the Calculator. */
  private syncLeadRebateDefaults() {
    const vehicle = VEHICLES.find((v) => v.brand === this.leadForm.brand && v.model === this.leadForm.model && v.variant === this.leadForm.variant);
    this.leadQuotationForm.rebate = vehicle?.rebate ?? DEFAULT_REBATE;
    this.leadQuotationForm.additionalRebateValue = vehicle?.additionalRebate ?? 0;
    this.leadQuotationForm.additionalRebateEnabled = (vehicle?.additionalRebate ?? 0) > 0;
  }

  testDriveForm: TestDriveInput = this.blankTestDriveForm();
  private blankTestDriveForm(): TestDriveInput {
    return { icNo: '', drivingLicenceNo: '', address: '', email: '', testDriveDate: todayStr() };
  }

  canSubmitTestDrive(): boolean {
    const f = this.testDriveForm;
    return !!f.icNo.trim() && !!f.drivingLicenceNo.trim() && !!f.address.trim() && !!f.email.trim() && !!f.testDriveDate;
  }

  openTestDrive(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.testDriveForm = {
      icNo: record.icNo ?? '',
      drivingLicenceNo: record.drivingLicenceNo ?? '',
      address: record.address ?? '',
      email: record.email ?? '',
      testDriveDate: record.testDriveDate ?? todayStr(),
    };
    this.modal.set('testdrive');
  }

  async submitTestDrive(id: string) {
    if (!this.canSubmitTestDrive()) return;
    await this.customers.recordTestDrive(id, this.testDriveForm);
    this.closeModal();
  }

  bookedForm: BookedInput = this.blankBookedForm();
  private blankBookedForm(): BookedInput {
    return { icNo: '', address: '', email: '', bookingFee: 0 };
  }

  inProgressForm: InProgressInput = this.blankInProgressForm();
  private blankInProgressForm(): InProgressInput {
    return { financingType: 'Loan', bankPanel: BANK_OPTIONS[0], downPaymentStatus: 'Not Paid', loanTenureMonths: TENURE_OPTIONS[0].months };
  }

  deliveredForm: DeliveredInput = this.blankDeliveredForm();

  private blankDeliveredForm(): DeliveredInput {
    return { insuranceName: INSURANCE_OPTIONS[0], plateNo: '', deliveryDate: todayStr(), chassisNo: '', engineNo: '', deliveryNotes: '' };
  }

  cancelForm: CancelledInput = this.blankCancelForm();
  private blankCancelForm(): CancelledInput {
    return { cancelReason: CANCEL_REASON_OPTIONS[0], cancelNotes: '', refundStatus: undefined };
  }

  leadQuotationForm: QuotationDetails = this.blankQuotationForm();

  openAddLead() {
    this.leadForm = this.blankLeadForm();
    this.leadQuotationForm = this.blankQuotationForm();
    this.syncLeadRebateDefaults();
    this.modal.set('add');
  }

  // Plain method, not computed(): leadForm/leadQuotationForm are mutable objects, not signals.
  leadQuotationPreview() {
    return this.computeQuotationNumbers(
      { brand: this.leadForm.brand, model: this.leadForm.model, variant: this.leadForm.variant, yearMade: this.leadForm.yearMade },
      this.leadQuotationForm,
    );
  }

  // Mirrors the Calculator's own Loan Amount field: editing it back-solves the downpayment
  // needed to reach that loan amount, same as editing downpayment back-solves the loan amount.
  onLeadLoanAmountChange(value: number) {
    const desiredLoan = Math.max(0, +value || 0);
    this.leadQuotationForm.downpaymentType = 'amount';
    this.leadQuotationForm.downpaymentValue = Math.round(Math.max(0, this.leadQuotationPreview().allInPrice - desiredLoan));
  }

  openBooked(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    const quoted = record.quotation ? this.computeQuotationNumbers(record, record.quotation) : null;
    this.bookedForm = {
      icNo: record.icNo ?? '',
      address: record.address ?? '',
      email: record.email ?? '',
      bookingFee: 0,
      downpayment: record.downpayment ?? (quoted ? quoted.downpaymentCash : undefined),
      ncd: record.ncd ?? record.quotation?.ncd,
    };
    this.modal.set('booked');
  }

  openInProgress(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    const quoted = record.quotation ? this.computeQuotationNumbers(record, record.quotation) : null;
    const financingType: FinancingType = record.financingType ?? 'Loan';
    this.inProgressForm = {
      financingType,
      paymentStatus: 'Not Paid',
      bankPanel: record.bankPanel ?? BANK_OPTIONS[0],
      downpayment: record.downpayment ?? (quoted ? quoted.downpaymentCash : undefined),
      downPaymentStatus: 'Not Paid',
      loanAmount: record.loanAmount ?? (quoted ? quoted.loanAmount : undefined),
      loanTenureMonths: record.quotation?.tenureMonths ?? TENURE_OPTIONS[0].months,
      loanInterestRate: undefined,
    };
    this.modal.set('inprogress');
  }

  openDelivered(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.deliveredForm = {
      insuranceName: record.insuranceName ?? INSURANCE_OPTIONS[0],
      plateNo: record.plateNo ?? '',
      deliveryDate: record.deliveryDate ?? todayStr(),
      chassisNo: record.chassisNo ?? '',
      engineNo: record.engineNo ?? '',
      deliveryNotes: record.deliveryNotes ?? '',
    };
    this.modal.set('delivered');
  }

  openCancel(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.cancelForm = { cancelReason: CANCEL_REASON_OPTIONS[0], cancelNotes: '', refundStatus: (record.bookingFee ?? 0) > 0 ? 'Pending' : undefined };
    this.modal.set('cancel');
  }

  // ---------- Accordion actions (Edit / Add Note / Change Status) ----------

  onAccordionEdit(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.modal.set('edit');
  }

  onAccordionAddNote(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.modal.set('note');
  }

  async submitEdit(id: string, input: EditCustomerInput) {
    await this.customers.editCustomer(id, input);
    this.closeModal();
  }

  async submitNote(id: string, note: string) {
    await this.customers.addNote(id, note);
    this.closeModal();
  }

  closeModal() {
    this.modal.set(null);
    this.activeRecordId.set(null);
  }

  async submitLead() {
    await this.customers.addLead({ ...this.leadForm, quotation: { ...this.leadQuotationForm } });
    this.closeModal();
    this.activeTab.set('Lead');
  }

  async submitBooked(id: string) {
    if (!canSubmitBooked(this.bookedForm)) return;
    await this.customers.markBooked(id, this.bookedForm);
    this.closeModal();
    this.activeTab.set('Booked');
  }

  async submitInProgress(id: string) {
    if (!canSubmitInProgress(this.inProgressForm)) return;
    await this.customers.markInProgress(id, this.inProgressForm);
    this.closeModal();
    this.activeTab.set('In Progress');
  }

  async submitDelivered(id: string) {
    const rec = this.activeRecord();
    if (!rec || !canSubmitDelivered(this.deliveredForm, this.giftsCompleteFor(rec), rec.colour !== TO_BE_CONFIRMED_COLOUR)) return;
    await this.customers.markDelivered(id, this.deliveredForm);
    this.closeModal();
    this.activeTab.set('Delivered');
  }

  async submitCancel(id: string) {
    if (!canSubmitCancel(this.cancelForm)) return;
    await this.customers.markCancelled(id, this.cancelForm);
    this.closeModal();
    this.activeTab.set('Cancelled');
  }

  // ---------- Quotation (view / edit / download / print) ----------

  quotationModalId = signal<string | null>(null);
  quotationEditing = signal(false);
  quotationForm: QuotationDetails = this.blankQuotationForm();

  activeQuotationRecord = computed(() => this.customers.records().find((r) => r.id === this.quotationModalId()) ?? null);

  /** Rebate and Additional Rebate seed from the car's Finance Database defaults when given its vehicle. */
  private blankQuotationForm(vehicle?: Vehicle): QuotationDetails {
    return {
      rebate: vehicle?.rebate ?? DEFAULT_REBATE,
      ncd: 0,
      interestRate: 3.5,
      rateType: 'flat',
      downpaymentType: 'percent',
      downpaymentValue: 10,
      tenureMonths: TENURE_OPTIONS[0].months,
      additionalRebateEnabled: (vehicle?.additionalRebate ?? 0) > 0,
      additionalRebateValue: vehicle?.additionalRebate ?? 0,
    };
  }

  private findRecordVehicle(record: CustomerRecord): Vehicle | undefined {
    return VEHICLES.find((v) => v.brand === record.brand && v.model === record.model && v.variant === record.variant);
  }

  openQuotation(record: CustomerRecord) {
    this.quotationModalId.set(record.id);
    this.quotationForm = record.quotation ? { ...record.quotation } : this.blankQuotationForm(this.findRecordVehicle(record));
    this.quotationEditing.set(!record.quotation);
  }

  closeQuotation() {
    this.quotationModalId.set(null);
    this.quotationEditing.set(false);
  }

  startEditQuotation() {
    const rec = this.activeQuotationRecord();
    if (rec?.quotation) this.quotationForm = { ...rec.quotation };
    this.quotationEditing.set(true);
  }

  cancelEditQuotation() {
    const rec = this.activeQuotationRecord();
    if (rec?.quotation) this.quotationEditing.set(false);
    else this.closeQuotation();
  }

  async saveQuotation(id: string) {
    await this.customers.updateQuotation(id, this.quotationForm);
    this.quotationEditing.set(false);
  }

  vehiclePrice(record: CustomerRecord): number {
    return VEHICLES.find((v) => v.brand === record.brand && v.model === record.model && v.variant === record.variant)?.price ?? 0;
  }

  private computeQuotationNumbers(spec: { brand: string; model: string; variant: string; yearMade: number }, q: QuotationDetails) {
    // Same brand/model/variant can have a separate database row per model year, each with its own
    // price and rebate — match the exact year first; only fall back to any row (e.g. a record whose
    // year was since removed from the catalog) if that exact year isn't there.
    const vehicleRows = VEHICLES.filter((v) => v.brand === spec.brand && v.model === spec.model && v.variant === spec.variant);
    const vehicle = vehicleRows.find((v) => v.year === spec.yearMade) ?? vehicleRows[0];
    const basePrice = vehicle?.price ?? 0;
    const additionalRebate = q.additionalRebateEnabled ? (q.additionalRebateValue ?? 0) : 0;
    const effectiveRebate = q.rebate + additionalRebate;

    // The quotation's own frozen insurance snapshot always wins — it's what this customer was
    // actually quoted, and must never drift just because the Car Finance Database default (or the
    // vehicle catalog) changed afterwards. Only quotations saved before this snapshot existed (or
    // created outside the Calculator) fall back to merging the live database default.
    const fallbackBasicPremium = basicPremiumDefault(basePrice, DEFAULT_INSURANCE_RATE_PCT);
    const insuranceDetails =
      q.insuranceDetails ??
      (vehicle
        ? { ...this.settings.getVehicleInsurance(vehicle, fallbackBasicPremium), basicPremium: q.basicPremium ?? vehicle.basicPremium ?? fallbackBasicPremium }
        : { basicPremium: q.basicPremium ?? fallbackBasicPremium, premiumAllRider: 0, additionalCoverages: [], stampDuty: 0, serviceTaxPct: 0, epr: 0 });
    const insuranceBreakdown = computeInsuranceBreakdown(insuranceDetails, q.ncd);

    const totals = computeQuotationTotals({
      basePrice,
      effectiveRebate,
      insuranceAmount: insuranceBreakdown.totalDue,
      downpaymentType: q.downpaymentType,
      downpaymentValue: q.downpaymentValue,
    });

    const rateType: RateType = q.rateType ?? 'flat';
    const repaymentRows = TENURE_OPTIONS.map((t) => ({ ...t, monthly: monthlyPayment(totals.loanAmount, q.interestRate, t.months, rateType) }));
    return {
      basePrice,
      effectiveRebate,
      insuranceAmount: totals.insuranceAmount,
      insuranceBreakdown,
      allInPrice: totals.totalAmountDue,
      downpaymentCash: totals.downpaymentCash,
      loanAmount: totals.loanAmount,
      rateType,
      repaymentRows,
    };
  }

  // Plain methods, not computed(): quotationForm is a mutable object (not a signal) for the
  // draft-preview case, so computed() would never see edits after the first read.
  quotationPreview() {
    const rec = this.activeQuotationRecord();
    if (!rec) return null;
    return this.computeQuotationNumbers(rec, this.quotationForm);
  }

  quotationViewNumbers(record: CustomerRecord) {
    if (!record.quotation) return null;
    return this.computeQuotationNumbers(record, record.quotation);
  }

  private quotationPdfData(record: CustomerRecord) {
    if (!record.quotation) return null;
    const quotation = record.quotation;
    const nums = this.computeQuotationNumbers(record, quotation);
    const advisor = this.advisor.profile();
    return {
      brand: record.brand,
      model: record.model,
      variant: record.variant,
      customerName: record.name,
      customerPhone: record.phone,
      advisorName: advisor.name,
      advisorRole: advisor.role,
      dateStr: record.date,
      basePrice: nums.basePrice,
      effectiveRebate: nums.effectiveRebate,
      ncd: record.quotation.ncd,
      insuranceAmount: nums.insuranceAmount,
      allInPrice: nums.allInPrice,
      isCash: isCashDeal(record),
      downpaymentCash: nums.downpaymentCash,
      loanAmount: nums.loanAmount,
      interestRate: quotation.interestRate,
      rateType: nums.rateType,
      repaymentRows: nums.repaymentRows.filter((r) => r.months === quotation.tenureMonths),
      insuranceBreakdown: nums.insuranceBreakdown,
    };
  }

  private quotationFileName(record: CustomerRecord): string {
    return `Quotation-${record.brand}-${record.model}-${record.name}.pdf`.replace(/\s+/g, '-');
  }

  downloadQuotation(record: CustomerRecord) {
    const data = this.quotationPdfData(record);
    if (!data) return;
    downloadBlob(buildQuotationPdfBytes(data), this.quotationFileName(record), 'application/pdf');
  }

  printQuotation(record: CustomerRecord) {
    const data = this.quotationPdfData(record);
    if (!data) return;
    openBlobInNewTab(buildQuotationPdfBytes(data), 'application/pdf');
  }
}
