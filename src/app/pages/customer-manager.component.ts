import { I18nService, TranslatePipe } from '../shared/i18n';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { DateRangePickerComponent } from '../shared/date-range-picker.component';
import { CustomerDetailComponent, type QuoteSummary } from '../shared/customer-detail.component';
import { CustomerEditModalComponent } from '../shared/customer-edit-modal.component';
import { CustomerNoteModalComponent } from '../shared/customer-note-modal.component';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { DEFAULT_STALE_LEAD_DAYS } from '../data/settings-data';
import { downpaymentDisplay,
  DEFAULT_INSURANCE_RATE_PCT,
  MODEL_YEARS,
  NCD_OPTIONS,
  TENURE_OPTIONS,
  VEHICLES,
  basicPremiumDefault,
  computeInsuranceBreakdown,
  computeQuotationTotals,
  minDownpaymentCash,
  additionalRebateForYear,
  defaultRateFor,
  coloursForVehicle,
  modelVariantLabel,
  modelsForBrand,
  monthlyPayment,
  rebateForYear,
  variantsForModel,
  vehicleTitle,
  type RateType,
  type Vehicle,
} from '../data/calculator-data';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { celebrate } from '../shared/celebrate';
import { ToastService } from '../shared/toast.service';
import { toMalaysianWhatsAppNumber } from '../data/dashboard-data';
import {
  CANCEL_REASON_OPTIONS,
  COLOUR_OPTIONS,
  CUSTOMER_STATUS_META,
  FINANCING_TYPE_OPTIONS,
  STAGE_DATE_HEADER,
  TO_BE_CONFIRMED_COLOUR,
  NO_ID_NOTES_HINT,
  canSubmitWon,
  currentStageEnteredAt,
  dealProfit,
  formatStageDate,
  freeGiftsComplete,
  freeGiftsSummary,
  isCashDeal,
  type CarSpec,
  type CustomerRecord,
  type CustomerStatus,
  type EditCustomerInput,
  type FinancingType,
  type PendingRequote,
  type QuotationDetails,
} from '../data/customer-data';

type Tab = 'All' | 'Lead' | 'Won' | 'Lost';
type ModalKind = 'won' | 'lost' | 'edit' | 'note' | 'changecar' | null;
/** Synthetic columns: 'stageDate' is the derived stage-entry date (see stageEnteredAt) and
 *  'quote' is what the saved quotation works out to — neither is a stored CustomerRecord field. */
type SortKey = keyof CustomerRecord | 'stageDate' | 'quote';
type SortDir = 'asc' | 'desc';
type Column = { key: SortKey; label: string; align?: 'right'; sortable?: false };

// Each stage shows what matters at that stage: the quote for a Lead, the money for a Won deal,
// the reason for a Lost one.
const ALL_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Last activity', align: 'right' },
];
const LEAD_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'quote', label: 'Quote', sortable: false },
  { key: 'sourceType', label: 'Lead Source' },
  { key: 'updatedAt', label: 'Last activity', align: 'right' },
];
const WON_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'commission', label: 'Profit', align: 'right' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['Won'], align: 'right' },
];
const LOST_COLUMNS: Column[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'cancelReason', label: 'Reason' },
  { key: 'stageDate', label: STAGE_DATE_HEADER['Lost'], align: 'right' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 30];

function sortValueFor(r: CustomerRecord, key: SortKey): string | number {
  if (key === 'stageDate') return currentStageEnteredAt(r);
  if (key === 'commission') return r.commission == null ? Number.NEGATIVE_INFINITY : dealProfit(r);
  if (key === 'quote') return 0;
  const v = r[key as keyof CustomerRecord];
  return typeof v === 'number' ? v : String(v ?? '');
}

function compareRecords(a: CustomerRecord, b: CustomerRecord, key: SortKey, dir: SortDir): number {
  const av = sortValueFor(a, key);
  const bv = sortValueFor(b, key);
  const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
  return dir === 'asc' ? cmp : -cmp;
}

const COLUMNS_BY_TAB: Record<Tab, Column[]> = {
  All: ALL_COLUMNS,
  Lead: LEAD_COLUMNS,
  Won: WON_COLUMNS,
  Lost: LOST_COLUMNS,
};

const TD = 'whitespace-nowrap p-4 align-middle';
const TD_R = 'whitespace-nowrap p-4 text-right align-middle';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A lead with no activity for this many days is flagged as going stale. */
const WARN_TONE = 'bg-[var(--warning)]/14 text-[var(--warning)]';

/** Something about a record the SA should act on — `label` is the short row chip, `detail` the
 *  sentence shown in the customer panel. */
type Attention = { label: string; detail: string; tone: string };

type TodoId = 'followup' | 'requote' | 'booked' | 'gifts' | 'commission';

/** The to-do chips above the list — each one is a question the SA would otherwise have to hunt for. */
const TODOS: { id: TodoId; label: string; icon: IconName; tab: Tab; activeTone: string }[] = [
  { id: 'followup', label: 'Follow up', icon: 'bell', tab: 'Lead', activeTone: 'bg-[var(--warning)]/20 text-[var(--warning)]' },
  { id: 'requote', label: 'Re-quote', icon: 'refresh-cw', tab: 'Lead', activeTone: 'bg-[var(--warning)]/20 text-[var(--warning)]' },
  { id: 'booked', label: 'Booked, waiting for car', icon: 'calendar', tab: 'Lead', activeTone: 'bg-[oklch(0.7_0.17_300)]/20 text-[oklch(0.7_0.17_300)]' },
  { id: 'gifts', label: 'Gifts to sort out', icon: 'gift', tab: 'All', activeTone: 'bg-[var(--warning)]/20 text-[var(--warning)]' },
  { id: 'commission', label: 'Add commission', icon: 'wallet', tab: 'Won', activeTone: 'bg-[var(--success)]/20 text-[var(--success)]' },
];

const TODO_MATCH: Record<TodoId, (r: CustomerRecord, cm: { isStale(r: CustomerRecord): boolean }) => boolean> = {
  followup: (r, cm) => cm.isStale(r),
  requote: (r) => r.status === 'Lead' && !!r.pendingRequote,
  booked: (r) => r.status === 'Lead' && !!r.booked,
  // Promised gifts still to sort out on a deal that's going ahead (booked or won).
  gifts: (r) => (r.status === 'Won' || (r.status === 'Lead' && !!r.booked)) && !freeGiftsComplete(r),
  commission: (r) => r.status === 'Won' && r.commission == null,
};

@Component({
  selector: 'app-customer-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IconComponent,
    DateRangePickerComponent,
    CustomerDetailComponent,
    CustomerEditModalComponent,
    CustomerNoteModalComponent,
    BrandMarkComponent,
    TranslatePipe,
  ],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-4 transition-[margin] duration-300" [ngClass]="panelRecord() ? '2xl:mr-[476px]' : ''">
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="text-balance text-xl font-bold tracking-tight">{{ "Customer Manager" | t }}</h2>
          <p class="text-pretty text-sm text-muted-foreground">{{ "Your leads, won and lost deals — tap a customer to do everything in one place." | t }}</p>
        </div>
        <a
          routerLink="/calculator"
          [title]="'Leads are created by saving a quote in the Calculator' | t"
          class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
        >
          <app-icon name="plus" [size]="14" />
          {{ "New lead" | t }}
        </a>
      </div>

      <!-- Stages -->
      <div role="tablist" [attr.aria-label]="'Pipeline stage' | t" class="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-card p-1">
        @for (t of tabs; track t) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="t === activeTab()"
            (click)="selectTab(t)"
            class="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            [ngClass]="t === activeTab() ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
          >
            @if (t !== 'All') {
              <span class="size-2 shrink-0 rounded-full" [ngClass]="t === activeTab() ? 'bg-white/80' : statusMeta(t).dot"></span>
            }
            {{ tabLabel(t) | t }}
            <span class="rounded-md px-1.5 text-[11px] font-bold tabular" [ngClass]="t === activeTab() ? 'bg-white/20' : 'bg-muted text-foreground'">{{ countFor(t) }}</span>
          </button>
        }
      </div>

      <!-- To do: what needs a tap right now — one tap shows just those customers -->
      @if (todos().length) {
        <div class="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          <span class="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "To do" | t }}</span>
          @for (td of todos(); track td.id) {
            <button
              type="button"
              (click)="toggleFocus(td.id)"
              [attr.aria-pressed]="focus() === td.id"
              class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="focus() === td.id ? td.activeTone : 'bg-card text-foreground hover:bg-accent'"
            >
              <app-icon [name]="td.icon" [size]="13" />
              {{ td.label | t }}
              <span class="rounded-md bg-black/15 px-1.5 text-[11px] font-bold tabular">{{ td.count }}</span>
            </button>
          }
          @if (focus()) {
            <button type="button" (click)="focus.set(null)" class="shrink-0 whitespace-nowrap px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">{{ "Show all" | t }}</button>
          }
        </div>
      }

      <!-- Search + filters -->
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
            <app-icon name="search" [size]="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              [placeholder]="'Name, car or phone…' | t"
              [ngModel]="nameFilter()"
              (ngModelChange)="nameFilter.set($event); page.set(0)"
              class="h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground outline-none"
            />
          </div>
          <button
            type="button"
            (click)="filtersOpen.set(!filtersOpen())"
            [attr.aria-expanded]="filtersOpen()"
            class="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors"
            [ngClass]="filtersOpen() || filterChips().length ? 'bg-accent text-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'"
          >
            <app-icon name="filter" [size]="13" />
            {{ 'Filters' | t }}
            @if (filterChips().length) {
              <span class="rounded-md bg-primary/20 px-1.5 text-[11px] font-bold text-primary tabular">{{ filterChips().length }}</span>
            }
          </button>
        </div>

        @if (filtersOpen()) {
          <div class="grid grid-cols-2 gap-3 rounded-xl bg-card p-3 lg:grid-cols-4">
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Car Brand" | t }}</span>
              <select
                [ngModel]="carFilter()"
                (ngModelChange)="carFilter.set($event); page.set(0)"
                class="h-9 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none"
              >
                <option value="All">{{ "All Cars" | t }}</option>
                @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Lead Source" | t }}</span>
              <select
                [ngModel]="sourceFilter()"
                (ngModelChange)="sourceFilter.set($event); page.set(0)"
                class="h-9 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none"
              >
                <option value="All">{{ "All Sources" | t }}</option>
                @for (s of sourceTypes(); track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </div>
            <div class="col-span-2 flex flex-col gap-1">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Date Range" | t }}</span>
              <app-date-range-picker
                [from]="dateFromFilter()"
                (fromChange)="dateFromFilter.set($event); page.set(0)"
                [to]="dateToFilter()"
                (toChange)="dateToFilter.set($event); page.set(0)"
              />
            </div>
          </div>
        }

        @if (filterChips().length) {
          <div class="flex flex-wrap items-center gap-1.5">
            @for (chip of filterChips(); track chip.label) {
              <button
                type="button"
                (click)="chip.clear(); page.set(0)"
                [attr.aria-label]="'Remove filter ' + chip.label"
                class="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-[var(--destructive)]/15"
              >
                {{ chip.label | t }}
                <app-icon name="x" [size]="11" class="text-muted-foreground" />
              </button>
            }
            <button type="button" (click)="clearFilters()" class="px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">{{ "Clear all" | t }}</button>
          </div>
        }
      </div>

      <!-- List -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
        <!-- Table (sm and up) -->
        <div class="hidden overflow-x-auto sm:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border">
                @for (col of columns(); track col.key) {
                  <th class="h-10 whitespace-nowrap px-4 align-middle text-[11px] font-semibold text-muted-foreground" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                    @if (col.sortable === false) {
                      <span class="uppercase">{{ col.label | t }}</span>
                    } @else {
                      <button
                        type="button"
                        (click)="toggleSort(col.key)"
                        class="inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground"
                        [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : '']"
                      >
                        {{ col.label | t }}
                        <app-icon [name]="sortIcon(col.key)" [size]="13" class="opacity-70" />
                      </button>
                    }
                  </th>
                }
                <th class="h-10 px-4"></th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr
                  [id]="'customer-row-' + r.id"
                  (click)="openPanel(r.id)"
                  class="cursor-pointer border-b border-border transition-colors last:border-0"
                  [ngClass]="r.id === panelId() ? 'bg-primary/10 shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-muted/40'"
                >
                  @for (col of columns(); track col.key) {
                    <td [class]="col.align === 'right' ? TD_R : TD">
                      <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: r, key: col.key }" />
                    </td>
                  }
                  <td [class]="TD_R">
                    <ng-container [ngTemplateOutlet]="rowActions" [ngTemplateOutletContext]="{ $implicit: r, mobile: false }" />
                  </td>
                </tr>
              } @empty {
                <tr class="hover:bg-transparent">
                  <td [attr.colspan]="columns().length + 1" class="p-10 text-center text-sm text-muted-foreground">{{ emptyMessageForActiveTab() | t }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Cards (phones) -->
        <div class="flex flex-col divide-y divide-border sm:hidden">
          @for (r of rows(); track r.id) {
            <div [id]="'customer-card-' + r.id" [ngClass]="r.id === panelId() ? 'bg-primary/10' : ''">
              <div role="button" tabindex="0" (click)="openPanel(r.id)" (keydown.enter)="openPanel(r.id)" class="flex cursor-pointer flex-col gap-2 px-4 pb-2 pt-3.5">
                <div class="flex items-start justify-between gap-2">
                  <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: r, key: 'name' }" />
                  <span class="shrink-0 text-right">
                    <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: r, key: headlineKey() }" />
                  </span>
                </div>
                <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: r, key: 'brand' }" />
              </div>
              <div class="px-4 pb-3">
                <ng-container [ngTemplateOutlet]="rowActions" [ngTemplateOutletContext]="{ $implicit: r, mobile: true }" />
              </div>
            </div>
          } @empty {
            <p class="p-10 text-center text-sm text-muted-foreground">{{ emptyMessageForActiveTab() | t }}</p>
          }
        </div>

        <!-- Pagination -->
        @if (pageCount() > 1 || filteredSorted().length > pageSizeOptions[0]) {
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{{ "Rows per page" | t }}</span>
              <select
                [ngModel]="pageSize()"
                (ngModelChange)="setPageSize($event)"
                class="h-8 rounded-md border border-input bg-input px-2 text-xs text-foreground outline-none"
              >
                @for (n of pageSizeOptions; track n) { <option [ngValue]="n">{{ n }}</option> }
              </select>
              <span class="tabular">{{ 'Showing {from}–{to} of {total}' | t: { from: rangeStart(), to: rangeEnd(), total: filteredSorted().length } }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="prevPage()"
                [disabled]="currentPage() === 0"
                class="inline-flex size-8 items-center justify-center rounded-md bg-muted transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                [attr.aria-label]="'Previous page' | t"
              >
                <app-icon name="chevron-left" [size]="16" />
              </button>
              <span class="px-2 text-xs text-muted-foreground tabular">{{ currentPage() + 1 }} / {{ pageCount() }}</span>
              <button
                type="button"
                (click)="nextPage()"
                [disabled]="currentPage() >= pageCount() - 1"
                class="inline-flex size-8 items-center justify-center rounded-md bg-muted transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                [attr.aria-label]="'Next page' | t"
              >
                <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- One cell of a customer row (shared by the table and the phone cards) -->
    <ng-template #cell let-r let-key="key">
      @switch (key) {
        @case ('name') {
          <div class="flex min-w-0 flex-col gap-1">
            <span class="truncate font-semibold">{{ r.name }}</span>
            <span class="text-xs text-muted-foreground tabular">{{ r.phone }}</span>
            @if (r.booked && r.status === 'Lead') {
              <span class="flex flex-wrap gap-1">
                <span class="inline-flex items-center gap-1 rounded-md bg-[oklch(0.7_0.17_300)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[oklch(0.7_0.17_300)]">
                  <app-icon name="calendar" [size]="10" />
                  {{ "Booked" | t }}
                </span>
              </span>
            }
            @if (attention(r); as flags) {
              @if (flags.length) {
                <span class="flex flex-wrap gap-1">
                  @for (a of flags; track a.label) {
                    <span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" [ngClass]="a.tone">
                      <app-icon name="alert-triangle" [size]="10" />
                      {{ a.label | t }}
                    </span>
                  }
                </span>
              }
            }
          </div>
        }
        @case ('brand') {
          <div class="flex items-center gap-2">
            <app-brand-mark [brand]="r.brand" />
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
              <span class="text-xs" [ngClass]="r.colour === TO_BE_CONFIRMED_COLOUR ? 'text-muted-foreground/70' : 'text-muted-foreground'">
                {{ r.yearMade }} · {{ r.colour === TO_BE_CONFIRMED_COLOUR ? ('Colour TBC' | t) : r.colour }}
              </span>
            </div>
          </div>
        }
        @case ('status') {
          <span class="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta(r.status).tone">
            <span class="size-1.5 rounded-full" [ngClass]="statusMeta(r.status).dot"></span>
            {{ statusMeta(r.status).label | t }}
          </span>
        }
        @case ('quote') {
          @if (quoteLine(r); as q) {
            <span class="flex flex-col">
              <span class="text-sm font-semibold tabular">{{ q.main }}</span>
              <span class="text-[11px] text-muted-foreground">{{ q.sub | t }}</span>
            </span>
          } @else {
            <span class="text-xs text-muted-foreground">{{ "Not quoted" | t }}</span>
          }
        }
        @case ('commission') {
          @if (r.commission != null) {
            <span class="flex flex-col items-end">
              <span class="text-sm font-semibold tabular" [ngClass]="profitOf(r) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">{{ signed(profitOf(r)) }}</span>
              <span class="text-[11px] text-muted-foreground tabular">{{ fmt(r.commission) }} {{ "commission" | t }}</span>
            </span>
          } @else {
            <span class="rounded-md bg-[var(--warning)]/14 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warning)]">{{ "Commission pending" | t }}</span>
          }
        }
        @case ('updatedAt') {
          <span class="text-xs tabular" [ngClass]="isStale(r) ? 'font-semibold text-[var(--warning)]' : 'text-muted-foreground'" [title]="formatDate(r.updatedAt)">
            {{ relativeDate(r.updatedAt) }}
          </span>
        }
        @case ('stageDate') {
          <span class="text-xs tabular text-muted-foreground" [title]="stageDateText(r)">
            {{ relativeDate(currentStageTs(r)) }}
          </span>
        }
        @default {
          <span class="text-sm" [ngClass]="key === 'sourceType' ? 'text-muted-foreground' : ''">{{ cardFieldValue(r, key) }}</span>
        }
      }
    </ng-template>

    <!-- Row actions: contact, then the one thing to do next -->
    <ng-template #rowActions let-r let-mobile="mobile">
      <div class="flex items-center gap-1" [ngClass]="mobile ? '' : 'justify-end'" (click)="$event.stopPropagation()">
        <a
          [href]="waLink(r.phone)"
          target="_blank"
          rel="noopener"
          [title]="'WhatsApp ' + r.phone"
          [attr.aria-label]="'WhatsApp' | t"
          class="inline-flex size-8 items-center justify-center rounded-lg text-[#25D366] transition-colors hover:bg-[#25D366]/15"
        >
          <app-icon name="message-circle" [size]="15" />
        </a>
        <a [href]="'tel:' + r.phone" [title]="'Call ' + r.phone" [attr.aria-label]="'Call' | t" class="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <app-icon name="phone" [size]="14" />
        </a>
        <button
          type="button"
          (click)="openQuotation(r)"
          [title]="r.pendingRequote ? 'Quotation — re-quote needed' : 'View quotation'"
          [attr.aria-label]="'View quotation' | t"
          class="relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <app-icon name="file-text" [size]="14" />
          @if (r.pendingRequote) {
            <span class="absolute right-1 top-1 size-2 rounded-full bg-[var(--warning)]"></span>
          }
        </button>
        @if (r.status === 'Lead') {
          <button
            type="button"
            (click)="quickWon(r)"
            class="flex items-center gap-1 whitespace-nowrap rounded-lg bg-[var(--success)]/12 px-2.5 py-1.5 text-xs font-semibold text-[var(--success)] transition-colors hover:bg-[var(--success)]/20"
            [ngClass]="mobile ? 'ml-auto' : 'ml-1'"
          >
            <app-icon name="check" [size]="13" />
            {{ "Won" | t }}
          </button>
        } @else if (r.status === 'Won' && r.commission == null) {
          <button
            type="button"
            (click)="openPanel(r.id, true)"
            class="flex items-center gap-1 whitespace-nowrap rounded-lg bg-[var(--warning)]/14 px-2.5 py-1.5 text-xs font-semibold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/20"
            [ngClass]="mobile ? 'ml-auto' : 'ml-1'"
          >
            <app-icon name="wallet" [size]="13" />
            {{ "Add commission" | t }}
          </button>
        }
      </div>
    </ng-template>

    <!-- Customer panel: full-screen sheet on phones, side panel from md up. Below 2xl a backdrop
         dims the list; from 2xl the list shifts left and stays usable. Stage/quotation modals
         (z-50) open above it. -->
    @if (panelRecord(); as p) {
      <button type="button" [attr.aria-label]="'Close customer' | t" class="cm-backdrop fixed inset-0 z-30 hidden bg-black/60 md:block 2xl:hidden" (click)="closePanel()"></button>
      <aside
        role="dialog"
        [attr.aria-label]="p.name"
        class="cm-drawer fixed inset-0 z-40 flex flex-col bg-card text-card-foreground md:left-auto md:w-[460px] md:border-l md:border-border md:shadow-[0_0_60px_-10px_oklch(0_0_0/80%)]"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 border-b border-border px-4 py-3">
          <span class="logo-chip flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">{{ initials(p.name) }}</span>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="truncate text-sm font-bold">{{ p.name }}</span>
            <span class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium" [ngClass]="statusMeta(p.status).tone">
                <span class="size-1.5 rounded-full" [ngClass]="statusMeta(p.status).dot"></span>
                {{ statusMeta(p.status).label | t }}
              </span>
              @if (p.booked && p.status === 'Lead') {
                <span class="rounded-md bg-[oklch(0.7_0.17_300)]/15 px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.7_0.17_300)]">{{ "Booked" | t }}</span>
              }
              @if (panelIndex() >= 0) {
                <span class="tabular">{{ '{n} of {total}' | t: { n: panelIndex() + 1, total: filteredSorted().length } }}</span>
              }
            </span>
          </div>
          <div class="flex shrink-0 items-center">
            <button type="button" (click)="stepPanel(-1)" [disabled]="panelIndex() <= 0" [attr.aria-label]="'Previous customer' | t" [title]="'Previous (Alt+↑)' | t" class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30">
              <app-icon name="arrow-up" [size]="15" />
            </button>
            <button type="button" (click)="stepPanel(1)" [disabled]="panelIndex() < 0 || panelIndex() >= filteredSorted().length - 1" [attr.aria-label]="'Next customer' | t" [title]="'Next (Alt+↓)' | t" class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30">
              <app-icon name="arrow-down" [size]="15" />
            </button>
            <button type="button" (click)="closePanel()" [attr.aria-label]="'Close' | t" [title]="'Close (Esc)' | t" class="ml-1 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
        </div>

        <!-- Contact + the stage action, always in reach at the top -->
        <div class="flex flex-col gap-2 border-b border-border p-3">
          <div class="grid grid-cols-3 gap-2">
            <a [href]="waLink(p.phone)" target="_blank" rel="noopener" class="flex flex-col items-center gap-1 rounded-lg bg-[#25D366]/12 py-2 text-[11px] font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20">
              <app-icon name="message-circle" [size]="16" />
              {{ "WhatsApp" | t }}
            </a>
            <a [href]="'tel:' + p.phone" class="flex flex-col items-center gap-1 rounded-lg bg-muted py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent">
              <app-icon name="phone" [size]="16" />
              {{ "Call" | t }}
            </a>
            <button type="button" (click)="openQuotation(p)" class="relative flex flex-col items-center gap-1 rounded-lg bg-muted py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent">
              <app-icon name="file-text" [size]="16" />
              {{ "Quotation" | t }}
              @if (p.pendingRequote) {
                <span class="absolute right-2 top-2 size-2 rounded-full bg-[var(--warning)]"></span>
              }
            </button>
          </div>

          @switch (p.status) {
            @case ('Lead') {
              <button type="button" (click)="quickWon(p)" class="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                <app-icon name="check" [size]="15" />
                {{ "Mark as Won" | t }}
              </button>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  (click)="toggleBooked(p)"
                  [attr.aria-pressed]="!!p.booked"
                  class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors"
                  [ngClass]="p.booked ? 'bg-[oklch(0.7_0.17_300)]/15 text-[oklch(0.7_0.17_300)]' : 'bg-muted text-foreground hover:bg-accent'"
                >
                  <app-icon [name]="p.booked ? 'check' : 'calendar'" [size]="13" />
                  {{ (p.booked ? 'Booked' : 'Mark booked') | t }}
                </button>
                <button type="button" (click)="openLost(p)" class="flex items-center justify-center gap-1.5 rounded-lg bg-muted py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[var(--destructive)]/12 hover:text-[var(--destructive)]">
                  <app-icon name="x-circle" [size]="13" />
                  {{ "Lost" | t }}
                </button>
              </div>
            }
            @case ('Won') {
              <!-- Commission: the one thing left to enter once a deal is won -->
              <div class="flex flex-col gap-2 rounded-lg p-3" [ngClass]="p.commission == null ? 'bg-[var(--warning)]/10' : 'bg-muted/60'">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold">{{ "Commission" | t }}</span>
                  @if (p.commission != null) {
                    <span class="text-xs text-muted-foreground">
                      {{ "Net profit" | t }}
                      <strong class="tabular" [ngClass]="profitOf(p) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">{{ signed(profitOf(p)) }}</strong>
                    </span>
                  } @else {
                    <span class="text-[11px] font-medium text-[var(--warning)]">{{ "Add it when the dealer pays" | t }}</span>
                  }
                </div>
                <div class="flex gap-2">
                  <div class="relative min-w-0 flex-1">
                    <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">RM</span>
                    <input
                      id="panel-commission"
                      type="number"
                      inputmode="decimal"
                      step="100"
                      [placeholder]="'e.g. 1500' | t"
                      [ngModel]="commissionDraft()"
                      (ngModelChange)="commissionDraft.set($event)"
                      (keydown.enter)="saveCommission(p)"
                      class="h-10 w-full rounded-lg border border-input bg-input pl-10 pr-3 text-sm tabular text-foreground outline-none focus:border-ring"
                    />
                  </div>
                  <button
                    type="button"
                    (click)="saveCommission(p)"
                    [disabled]="!commissionChanged(p)"
                    class="rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                  >
                    {{ "Save" | t }}
                  </button>
                </div>
              </div>
            }
            @case ('Lost') {
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ "Lost" | t }} · {{ p.cancelReason || '—' }}</span>
                <button type="button" (click)="reopen(p)" class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                  <app-icon name="rotate-ccw" [size]="13" />
                  {{ "Reopen" | t }}
                </button>
              </div>
            }
          }
        </div>

        <!-- Body -->
        <div class="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          @if (p.pendingRequote; as pr) {
            <div class="flex items-start gap-2.5 rounded-xl bg-[var(--warning)]/12 p-3">
              <app-icon name="alert-triangle" [size]="15" class="mt-0.5 shrink-0 text-[var(--warning)]" />
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <span class="text-xs text-foreground">
                  {{ "Car changed from" | t }} <strong>{{ carTitle(pr.from) }}</strong>{{ ". The quotation still uses the old car's rebate, rate and insurance." | t }}
                </span>
                <button type="button" (click)="openQuotation(p)" class="w-fit rounded-lg bg-[var(--warning)] px-3 py-1.5 text-xs font-semibold text-[var(--warning-foreground)]">{{ "Re-quote now" | t }}</button>
              </div>
            </div>
          }
          @for (a of attention(p); track a.label) {
            @if (a.label !== 'Re-quote needed') {
              <div class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium" [ngClass]="a.tone">
                <app-icon name="alert-triangle" [size]="13" class="shrink-0" />
                {{ a.detail | t }}
              </div>
            }
          }
          <app-customer-detail
            [record]="p"
            [quote]="panelQuote(p)"
            (edit)="onEdit($event)"
            (addNote)="onAddNote($event)"
            (changeCar)="openChangeCar($event)"
            (delete)="requestDelete($event)"
          />
        </div>
      </aside>
    }

    <!-- Mark as Won — only shown when the colour still needs confirming -->
    @if (modal() === 'won' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">{{ "Which colour did they take?" | t }}</span>
            <button type="button" (click)="closeModal()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <p class="text-xs text-muted-foreground">{{ rec.name }} · {{ vehicleTitle(rec.brand, rec.model) }} {{ rec.variant }}</p>
            <!-- One tap picks the colour and marks the deal Won -->
            <div class="grid grid-cols-2 gap-2">
              @for (c of wonColourOptions(rec); track c) {
                <button type="button" (click)="submitWon(rec, c)" class="rounded-lg bg-muted px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-[var(--success)]/15 hover:text-[var(--success)]">
                  {{ c }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Mark as Lost — one tap on a reason; the note is optional -->
    @if (modal() === 'lost' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">{{ "Why was it lost?" | t }}</span>
            <button type="button" (click)="closeModal()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <p class="text-xs text-muted-foreground">{{ rec.name }} · {{ vehicleTitle(rec.brand, rec.model) }} {{ rec.variant }}</p>
            <input
              type="text"
              [placeholder]="'Note (optional) — type it before picking a reason' | t"
              [ngModel]="lostNote()"
              (ngModelChange)="lostNote.set($event)"
              class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
            />
            <div class="flex flex-wrap gap-2">
              @for (reason of cancelReasons; track reason) {
                <button type="button" (click)="submitLost(rec, reason)" class="rounded-full bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]">
                  {{ reason }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Change car modal -->
    @if (modal() === 'changecar' && activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeModal()"></button>
        <div class="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Change car &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeModal()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-4 overflow-y-auto p-4">
            <p class="text-xs text-muted-foreground">{{ "Currently" | t }} <strong class="text-foreground">{{ carTitle(rec) }}</strong></p>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Brand" | t }}
                <select [ngModel]="changeCarForm.brand" (ngModelChange)="onChangeCarBrand($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none">
                  @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Model" | t }}
                <select [ngModel]="changeCarForm.model" (ngModelChange)="onChangeCarModel($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none">
                  @for (m of modelsForBrand(changeCarForm.brand); track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Variant" | t }}
                <select [ngModel]="changeCarForm.variant" (ngModelChange)="onChangeCarVariant($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none">
                  @for (v of variantsForModel(changeCarForm.brand, changeCarForm.model); track v) { <option [value]="v">{{ v || changeCarForm.model }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Model year" | t }}
                <select [(ngModel)]="changeCarForm.yearMade" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none">
                  @for (y of changeCarYears(); track y) { <option [ngValue]="y">{{ y }}</option> }
                </select>
              </label>
            </div>

            @if (changeCarIsDifferent(rec)) {
              @let cp = changeCarPreview(rec);
              <div class="flex flex-col divide-y divide-border rounded-lg bg-muted/50 text-xs">
                <div class="flex items-center justify-between gap-3 px-3 py-2">
                  <span class="text-muted-foreground">{{ "Price" | t }}</span>
                  <span class="flex items-center gap-2 tabular">
                    <span class="text-muted-foreground">{{ fmt(cp.oldPrice) }}</span>
                    <app-icon name="chevron-right" [size]="12" class="text-muted-foreground" />
                    <strong class="text-foreground">{{ fmt(cp.newPrice) }}</strong>
                    @if (cp.delta !== 0) {
                      <span class="rounded-md px-1.5 py-0.5 text-[10px] font-bold" [ngClass]="cp.delta > 0 ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-[var(--success)]/15 text-[var(--success)]'">
                        {{ cp.delta > 0 ? '+' : '−' }}{{ fmt(abs(cp.delta)) }}
                      </span>
                    }
                  </span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3 py-2">
                  <span class="text-muted-foreground">{{ "Rebate (this year)" | t }}</span>
                  <span class="flex items-center gap-2 tabular">
                    <span class="text-muted-foreground">{{ fmt(cp.oldRebate) }}</span>
                    <app-icon name="chevron-right" [size]="12" class="text-muted-foreground" />
                    <strong class="text-foreground">{{ fmt(cp.newRebate) }}</strong>
                  </span>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{{ "What happens" | t }}</span>
                <ul class="flex flex-col gap-1.5 text-xs text-foreground">
                  <li class="flex items-start gap-2"><app-icon name="info" [size]="13" class="mt-0.5 shrink-0 text-muted-foreground" /> Colour resets to "To be Confirmed" — confirm it again for the new car.</li>
                  @if (rec.quotation) {
                    <li class="flex items-start gap-2">
                      <app-icon name="info" [size]="13" class="mt-0.5 shrink-0 text-muted-foreground" />
                      @if (isCash(rec)) {
                        The quotation is flagged and you'll re-quote next — it stays a cash deal at the new car's price.
                      } @else {
                        The quotation is flagged and you'll re-quote next — the customer's agreed down payment ({{ fmt(cp.oldDownpayment) }}) is kept as the starting point.
                      }
                    </li>
                  }
                  <li class="flex items-start gap-2"><app-icon name="info" [size]="13" class="mt-0.5 shrink-0 text-muted-foreground" /> {{ "The change is recorded in the activity history." | t }}</li>
                </ul>
              </div>
            } @else {
              <p class="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">{{ "Pick a different brand, model, variant or year." | t }}</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeModal()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              (click)="submitChangeCar(rec)"
              [disabled]="!changeCarIsDifferent(rec)"
              class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {{ "Change car" | t }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Quotation modal -->
    @if (activeQuotationRecord(); as qrec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeQuotation()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Quotation &middot; {{ qrec.name }}</span>
            <button type="button" (click)="closeQuotation()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          @if (!quotationEditing() && qrec.quotation) {
            <!-- View mode -->
            <div class="flex flex-col gap-3 overflow-y-auto p-4">
              <p class="text-sm font-medium">{{ vehicleTitle(qrec.brand, qrec.model) }} &middot; {{ qrec.variant }}</p>
              @if (qrec.pendingRequote; as pr) {
                <div class="flex items-start gap-2 rounded-lg bg-[var(--warning)]/12 px-3 py-2.5 text-[11px] text-foreground">
                  <app-icon name="alert-triangle" [size]="14" class="mt-0.5 shrink-0 text-[var(--warning)]" />
                  <span>
                    {{ 'Car changed from {car} on {date}.' | t: { car: carTitle(pr.from), date: formatStageDate(pr.changedAt) } }}
                    {{ "These figures still use the old car's rebate, rate and insurance — re-quote before sending it to the customer." | t }}
                  </span>
                </div>
              }
              @if (quotationViewNumbers(qrec); as qv) {
                <div class="flex items-center gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <app-icon name="tag" [size]="16" />
                  </span>
                  <div class="flex flex-col">
                    <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Selling Price" | t }}</span>
                    <span class="text-2xl font-bold tabular tracking-tight">{{ fmt(qv.allInPrice) }}</span>
                  </div>
                </div>
                @if (qv.loanAmount > 0) {
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                      <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{{ dpDisplay(qv.downpaymentCash).label | t }}</span>
                      <span class="text-sm font-semibold tabular">{{ fmt(dpDisplay(qv.downpaymentCash).amount) }}</span>
                    </div>
                    <div class="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                      <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{{ "Loan Amount" | t }}</span>
                      <span class="text-sm font-semibold tabular">{{ fmt(qv.loanAmount) }}</span>
                    </div>
                  </div>
                }
                <div class="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
                  <div class="flex items-center justify-between px-3 py-2">
                    <span class="text-muted-foreground">{{ "OTR Price" | t }}</span>
                    <span class="font-medium tabular">{{ fmt(qv.basePrice) }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3 py-2">
                    <span class="text-muted-foreground">{{ "Rebate" | t }}</span>
                    <span class="font-medium tabular text-[var(--success)]">&minus; {{ fmt(qv.effectiveRebate - qv.cashback) }}</span>
                  </div>
                  @if (qv.cashback > 0) {
                    <div class="flex items-center justify-between px-3 py-2">
                      <span class="text-muted-foreground">{{ "Cash back to customer" | t }}</span>
                      <span class="font-medium tabular text-[var(--success)]">{{ fmt(qv.cashback) }}</span>
                    </div>
                  }
                  <div class="flex items-center justify-between px-3 py-2">
                    <span class="text-muted-foreground">Insurance ({{ qrec.quotation.ncd }}% NCD)</span>
                    <span class="font-medium tabular">+ {{ fmt(qv.insuranceAmount) }}</span>
                  </div>
                </div>
                @if (qv.loanAmount > 0) {
                  <div class="overflow-hidden rounded-lg border border-border">
                    <div class="border-b border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                      {{ qrec.quotation.interestRate }}% <span class="text-muted-foreground/70">&middot; {{ qv.rateType === 'effective' ? 'EIR' : ('Flat' | t) }}</span>
                    </div>
                    @for (row of qv.repaymentRows; track row.months) {
                      @if (row.months === qrec.quotation.tenureMonths) {
                        <div class="flex items-center justify-between px-3 py-2 text-sm">
                          <span class="font-medium">{{ row.label | t }}</span>
                          <span class="font-semibold tabular">{{ fmt(row.monthly) }}/mo</span>
                        </div>
                      }
                    }
                  </div>
                }
              }
            </div>
            <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
              @if (qrec.status !== 'Won') {
                @if (qrec.pendingRequote) {
                  <button type="button" (click)="startEditQuotation()" class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                    <app-icon name="refresh-cw" [size]="13" />
                    {{ "Re-quote now" | t }}
                  </button>
                } @else {
                  <button type="button" (click)="startEditQuotation()" class="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                    <app-icon name="pencil" [size]="13" />
                    {{ "Edit" | t }}
                  </button>
                }
              }
            </div>
          } @else {
            <!-- Edit / create mode -->
            <div class="flex flex-col gap-3 overflow-y-auto p-4">
              @if (!qrec.quotation) {
                <p class="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">{{ "No quotation yet for this customer — fill in the details below to create one." | t }}</p>
              }
              <p class="text-sm font-medium">{{ vehicleTitle(qrec.brand, qrec.model) }} &middot; {{ qrec.variant }}</p>
              @if (qrec.pendingRequote; as pr) {
                @if (quotationPreview(); as qp) {
                  <div class="flex flex-col gap-2 rounded-lg bg-[var(--warning)]/10 p-3">
                    <span class="flex items-center gap-1.5 text-xs font-semibold text-[var(--warning)]">
                      <app-icon name="refresh-cw" [size]="13" />
                      {{ "Re-quoting for the new car" | t }}
                    </span>
                    <p class="text-[11px] text-muted-foreground">
                      {{ "Rebate, rate and insurance now come from the new car. The down payment starts at the customer's agreed amount — change it if you've agreed something else." | t }}
                    </p>
                    <div class="grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-3 gap-y-1.5 text-[11px]">
                      <span></span>
                      <span class="truncate font-semibold text-muted-foreground">Before · {{ carTitle(pr.from) }}</span>
                      <span class="truncate font-semibold text-foreground">Now · {{ carTitle(qrec) }}</span>

                      <span class="text-muted-foreground">{{ "Selling price" | t }}</span>
                      <span class="tabular text-muted-foreground">{{ fmt(pr.allInPrice) }}</span>
                      <span class="font-semibold tabular text-foreground">{{ fmt(qp.allInPrice) }}</span>

                      @if (quotationFinancingType !== 'Cash') {
                        <span class="text-muted-foreground">{{ "Down payment" | t }}</span>
                        <span class="tabular text-muted-foreground">{{ fmt(pr.downpaymentCash) }}</span>
                        <span class="font-semibold tabular text-foreground">
                          {{ fmt(qp.downpaymentCash) }}
                          <span class="font-normal text-muted-foreground">· {{ pctOf(qp.downpaymentCash, qp.allInPrice) }}</span>
                        </span>

                        <span class="text-muted-foreground">{{ "Loan amount" | t }}</span>
                        <span class="tabular text-muted-foreground">{{ fmt(pr.loanAmount) }}</span>
                        <span class="font-semibold tabular text-foreground">{{ fmt(qp.loanAmount) }}</span>

                        <span class="text-muted-foreground">{{ "Monthly" | t }}</span>
                        <span class="tabular text-muted-foreground">{{ fmt(pr.monthly) }} · {{ pr.tenureMonths / 12 }}y</span>
                        <span class="font-semibold tabular text-foreground">{{ fmt(monthlyFor(qp, quotationForm.tenureMonths)) }} · {{ quotationForm.tenureMonths / 12 }}y</span>
                      }
                    </div>
                  </div>
                }
              }
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Financing Type" | t }}
                <select [ngModel]="quotationFinancingType" (ngModelChange)="onQuotationFinancingTypeChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label | t }}</option> }
                </select>
              </label>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {{ "Rebate (RM)" | t }}
                  <input type="number" min="0" step="500" [(ngModel)]="quotationForm.rebate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {{ "NCD" | t }}
                  <select [(ngModel)]="quotationForm.ncd" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (opt of ncdOptions; track opt.value) { <option [ngValue]="opt.value">{{ opt.label | t }}</option> }
                  </select>
                </label>
              </div>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                <span class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="quotationForm.additionalRebateEnabled" [attr.aria-label]="'Include additional rebate' | t" class="size-4 shrink-0 rounded border-input accent-primary" />
                  {{ "Additional Rebate (RM)" | t }}
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
              @if (quotationFinancingType !== 'Cash' && (cashbackAllowed() || (quotationForm.cashbackAmount ?? 0) > 0)) {
                <!-- Part of the rebate paid to the customer in cash instead of off the price -->
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {{ "Cash back from rebate (RM)" | t }}
                  <input
                    type="number"
                    min="0"
                    step="500"
                    [(ngModel)]="quotationForm.cashbackAmount"
                    class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                  />
                  <span class="text-[10px] font-normal text-muted-foreground">{{ "0 = the whole rebate comes off the price" | t }}</span>
                </label>
              }
              @if (quotationFinancingType !== 'Cash') {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {{ "Rate Type" | t }}
                  <select [(ngModel)]="quotationForm.rateType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    <option value="flat">{{ "Flat" | t }}</option>
                    <option value="effective">{{ "EIR" | t }}</option>
                  </select>
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {{ quotationForm.rateType === 'effective' ? ('Effective Rate (%)' | t) : ('Flat Rate (%)' | t) }}
                    <input type="number" min="0" step="0.1" [(ngModel)]="quotationForm.interestRate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {{ "Tenure" | t }}
                    <select [(ngModel)]="quotationForm.tenureMonths" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label | t }}</option> }
                    </select>
                  </label>
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-xs font-medium text-muted-foreground">{{ "Downpayment" | t }}</span>
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
                        {{ "Amt" | t }}
                      </button>
                    </div>
                  </div>
                </div>
              }
              @if (quotationPreview(); as qp) {
                @if (quotationFinancingType === 'Cash') {
                  <div class="rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                    <span class="flex flex-col">
                      {{ "Selling Price" | t }}
                      <strong class="text-sm text-foreground tabular">{{ fmt(qp.allInPrice) }}</strong>
                    </span>
                  </div>
                } @else {
                  <div class="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                    <span class="flex flex-col">
                      {{ "Selling Price" | t }}
                      <strong class="text-sm text-foreground tabular">{{ fmt(qp.allInPrice) }}</strong>
                    </span>
                    <span class="flex flex-col">
                      {{ dpDisplay(qp.downpaymentCash).label | t }}
                      <strong class="text-sm text-foreground tabular">{{ fmt(dpDisplay(qp.downpaymentCash).amount) }}</strong>
                    </span>
                    <span class="flex flex-col">
                      {{ "Loan Amount" | t }}
                      <strong class="text-sm text-foreground tabular">{{ fmt(qp.loanAmount) }}</strong>
                    </span>
                  </div>
                }
              }
            </div>
            <div class="flex items-center justify-end gap-2 border-t border-border p-4">
              <button type="button" (click)="cancelEditQuotation()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
              <button type="button" (click)="saveQuotation(qrec.id)" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">{{ "Save" | t }}</button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Delete confirmation -->
    @if (deleteTarget(); as target) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="cancelDelete()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              {{ "Delete customer?" | t }}
            </span>
            <p class="text-sm text-muted-foreground">
              {{ "This permanently removes" | t }} <strong class="text-foreground">{{ target.name }}</strong>
              ({{ vehicleTitle(target.brand, target.model) }}) and everything recorded for them. This can't be undone.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="cancelDelete()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              (click)="confirmDelete()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
            >
              {{ "Delete" | t }}
            </button>
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
  /** A negative downpayment (loan rounded up) is shown as Cash Back. */
  dpDisplay = downpaymentDisplay;

  /** Leads first — that's where the work is. All sits last for the odd look across everything. */
  tabs: Tab[] = ['Lead', 'Won', 'Lost', 'All'];
  activeTab = signal<Tab>('Lead');
  tabLabel = (t: Tab) => (t === 'Lead' ? 'Leads' : t);

  TD = TD;
  TD_R = TD_R;

  /** The active tab's columns — one table renders every tab from this. */
  columns = computed(() => COLUMNS_BY_TAB[this.activeTab()]);

  /** Filter choices: this account's sources, plus any still on a customer after being removed. */
  sourceTypes = computed(() => {
    const used = this.customers.records().map((r) => r.sourceType).filter((s): s is string => !!s);
    return [...new Set([...this.settings.leadSources(), ...used])];
  });
  TO_BE_CONFIRMED_COLOUR = TO_BE_CONFIRMED_COLOUR;
  noIdNotesHint = NO_ID_NOTES_HINT;
  cancelReasons = CANCEL_REASON_OPTIONS;
  ncdOptions = NCD_OPTIONS;
  tenureOptions = TENURE_OPTIONS;
  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));
  pageSizeOptions = PAGE_SIZE_OPTIONS;
  financingTypeOptions = FINANCING_TYPE_OPTIONS;

  // `toLocaleString` with no options defaults to *up to 3* fraction digits, not 2 — invisible for
  // whole numbers but shows a stray 3rd decimal (e.g. "3,889.176") on anything that doesn't divide
  // evenly, like insurance or a monthly instalment. maximumFractionDigits caps it at 2 like every
  // other money figure in the app, while minimumFractionDigits stays default (0) so whole amounts
  // still show without a trailing ".00".
  fmt = (v: number) => `RM ${v.toLocaleString('en-MY', { maximumFractionDigits: 2 })}`;
  round = Math.round;
  statusMeta = (s: CustomerStatus) => CUSTOMER_STATUS_META[s] ?? CUSTOMER_STATUS_META.Lead;
  isCash = isCashDeal;
  canSubmitWon = canSubmitWon;
  stageDateText = (r: CustomerRecord) => formatStageDate(currentStageEnteredAt(r));

  waLink(phone: string): string {
    return `https://wa.me/${toMalaysianWhatsAppNumber(phone)}`;
  }

  /** Mobile card fields: the active tab's columns minus name/brand, which the card already shows
   *  in its own header rows. */
  cardMetaColumns(): Column[] {
    return this.columns().filter((c) => c.key !== 'name' && c.key !== 'brand');
  }

  /** Plain-text value for a mobile card field; 'status' is rendered as a badge
   *  in the template instead of through this. */
  cardFieldValue(r: CustomerRecord, key: SortKey): string {
    switch (key) {
      case 'stageDate':
        return this.stageDateText(r);
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
      case 'Won':
        return 'No won deals yet.';
      case 'Lost':
        return 'No lost deals.';
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

  // ---------- Customer panel ----------

  panelId = signal<string | null>(null);
  panelRecord = computed(() => this.customers.records().find((r) => r.id === this.panelId()) ?? null);
  /** Position within the current (filtered, sorted) list — drives Prev/Next; -1 once the open
   *  record no longer matches the list (e.g. a filter hides it), which disables stepping. */
  panelIndex = computed(() => this.filteredSorted().findIndex((r) => r.id === this.panelId()));

  /** `focusCommission` — from a Won row's "Add commission": open straight onto the commission field. */
  openPanel(id: string, focusCommission = false) {
    this.panelId.set(id);
    this.commissionDraft.set(this.customers.records().find((r) => r.id === id)?.commission ?? null);
    if (focusCommission) setTimeout(() => document.getElementById('panel-commission')?.focus(), 50);
  }

  closePanel() {
    this.panelId.set(null);
  }

  stepPanel(delta: number) {
    const target = this.filteredSorted()[this.panelIndex() + delta];
    if (!target) return;
    this.openPanel(target.id);
    // Keep the list's page in step so the highlighted row stays visible behind the panel.
    const index = this.panelIndex();
    if (index >= 0) this.page.set(Math.floor(index / this.pageSize()));
  }

  /** Esc closes the panel and Alt+↑/↓ steps through customers — only when no dialog is open on
   *  top of it, so Esc never closes the panel from underneath a form. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (!this.panelId() || this.modal() || this.quotationModalId() || this.deleteTargetId()) return;
    if (e.key === 'Escape') {
      this.closePanel();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      this.stepPanel(e.key === 'ArrowUp' ? -1 : 1);
    }
  }

  initials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join('') || '?'
    );
  }

  carTitle(c: CarSpec): string {
    return `${vehicleTitle(c.brand, modelVariantLabel(c.model, c.variant))} ${c.yearMade}`;
  }

  // ---------- Row status: next step, staleness, needs-attention ----------

  private daysSince(ts: number): number {
    return Math.floor((Date.now() - ts) / DAY_MS);
  }

  currentStageTs(r: CustomerRecord): number {
    return currentStageEnteredAt(r);
  }

  /** "Today", "3d ago", "2w ago", then the plain date past a month — the exact date is in the tooltip. */
  relativeDate(ts: number): string {
    const d = this.daysSince(ts);
    if (d <= 0) return this.i18n.t('Today');
    if (d === 1) return this.i18n.t('Yesterday');
    if (d < 7) return this.i18n.t('{n}d ago', { n: d });
    if (d < 30) return this.i18n.t('{n}w ago', { n: Math.floor(d / 7) });
    return formatStageDate(ts);
  }

  isStale(r: CustomerRecord): boolean {
    const days = this.settings.settings().salesDefaults.staleLeadDays ?? DEFAULT_STALE_LEAD_DAYS;
    // A booked customer waiting for stock isn't going cold — no follow-up nag for them.
    return r.status === 'Lead' && !r.booked && this.daysSince(r.updatedAt) >= days;
  }

  /** Everything worth flagging on a record, built only from data it already has. */
  attention(r: CustomerRecord): Attention[] {
    const out: Attention[] = [];
    if (r.pendingRequote) {
      out.push({ label: 'Re-quote needed', detail: 'The car was changed — re-quote before sending the quotation.', tone: WARN_TONE });
    }
    if (this.isStale(r)) {
      const d = this.daysSince(r.updatedAt);
      out.push({ label: `No update in ${d}d`, detail: `No activity for ${d} days — time to follow up.`, tone: WARN_TONE });
    }
    return out;
  }

  modal = signal<ModalKind>(null);
  activeRecordId = signal<string | null>(null);
  deleteTargetId = signal<string | null>(null);

  nameFilter = signal('');
  filtersOpen = signal(false);
  // Deliberately starts on "All", not the account's Primary Brand — hiding other brands' existing
  // customers by default risks the SA forgetting about them.
  carFilter = signal('All');
  sourceFilter = signal('All');
  dateFromFilter = signal('');
  dateToFilter = signal('');
  sortKey = signal<SortKey>('stageDate');
  sortDir = signal<SortDir>('desc');

  pageSize = signal(10);
  page = signal(0);

  constructor(
    public customers: CustomerService,
    private route: ActivatedRoute,
    private toast: ToastService,
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
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
    this.focus.set(null);
    this.activeTab.set(record.status);
    const index = this.filteredSorted().findIndex((r) => r.id === id);
    this.page.set(index >= 0 ? Math.floor(index / this.pageSize()) : 0);
    this.openPanel(id);
    setTimeout(() => {
      // Table row on tablet/desktop, card on phones — only one of the two is visible.
      for (const el of [document.getElementById(`customer-row-${id}`), document.getElementById(`customer-card-${id}`)]) {
        if (el?.offsetParent) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
    if (this.panelId() === id) this.closePanel();
  }

  activeRecord = computed(() => this.customers.records().find((r) => r.id === this.activeRecordId()) ?? null);

  countFor(t: Tab): number {
    if (t === 'All') return this.customers.records().length;
    if (t === 'Lead') return this.customers.leads().length;
    if (t === 'Won') return this.customers.won().length;
    return this.customers.lost().length;
  }

  selectTab(t: Tab) {
    this.activeTab.set(t);
    const focus = this.focus();
    if (focus && TODOS.find((x) => x.id === focus)!.tab !== t) this.focus.set(null);
    this.page.set(0);
  }

  /** Tab + search + filters, before the Needs-attention toggle — so its count shows how many of
   *  *these* need attention. */
  private matching = computed(() => {
    const tab = this.activeTab();
    let list = this.customers.records();
    if (tab !== 'All') {
      list = list.filter((r) => r.status === tab);
    }

    const search = this.nameFilter().trim().toLowerCase();
    if (search) {
      // Digits-only comparison too, so "0123456789" finds "012-345 6789".
      const digits = search.replace(/\D/g, '');
      const digitsMatch = (v?: string) => digits.length >= 3 && !!v && v.replace(/\D/g, '').includes(digits);
      list = list.filter((r) => `${r.name} ${r.brand} ${r.model} ${r.variant} ${r.phone}`.toLowerCase().includes(search) || digitsMatch(r.phone));
    }
    if (this.carFilter() !== 'All') list = list.filter((r) => r.brand === this.carFilter());
    if (this.sourceFilter() !== 'All') list = list.filter((r) => r.sourceType === this.sourceFilter());
    if (this.dateFromFilter()) list = list.filter((r) => r.date >= this.dateFromFilter());
    if (this.dateToFilter()) list = list.filter((r) => r.date <= this.dateToFilter());
    return list;
  });


  filteredSorted = computed(() => {
    let list = this.matching();
    const focus = this.focus();
    if (focus) list = list.filter((r) => TODO_MATCH[focus](r, this));
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

  /** Active Brand / Source / Date filters as removable chips (search lives in its own box). */
  filterChips = computed(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (this.carFilter() !== 'All') chips.push({ label: this.carFilter(), clear: () => this.carFilter.set('All') });
    if (this.sourceFilter() !== 'All') chips.push({ label: this.sourceFilter(), clear: () => this.sourceFilter.set('All') });
    const from = this.dateFromFilter();
    const to = this.dateToFilter();
    if (from || to) {
      chips.push({
        label: from && to ? `${from} → ${to}` : from ? `From ${from}` : `Until ${to}`,
        clear: () => {
          this.dateFromFilter.set('');
          this.dateToFilter.set('');
        },
      });
    }
    return chips;
  });

  clearFilters() {
    this.nameFilter.set('');
    this.carFilter.set('All');
    this.sourceFilter.set('All');
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
    this.page.set(0);
  }

  private settings = inject(SettingsService);
  private i18n = inject(I18nService);
  modelVariantLabel = modelVariantLabel;
  vehicleTitle = vehicleTitle;

  /** This exact variant's factory colours when the catalog has them (colour is required here,
   *  so the placeholder "To be Confirmed" option never belongs in this list); not every model has
   *  one hardcoded yet, so those fall back to the generic list. */
  wonColourOptions(rec: CustomerRecord): string[] {
    return coloursForVehicle(rec.brand, rec.model, rec.variant) ?? COLOUR_OPTIONS.filter((c) => c !== TO_BE_CONFIRMED_COLOUR);
  }

  openLost(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.lostNote.set('');
    this.modal.set('lost');
  }

  // ---------- Panel actions (Edit / Add Note / Change car) ----------

  onEdit(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.modal.set('edit');
  }

  onAddNote(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.modal.set('note');
  }

  // ---------- Change car ----------

  modelsForBrand = modelsForBrand;
  variantsForModel = variantsForModel;
  abs = Math.abs;
  changeCarForm: CarSpec = { brand: '', model: '', variant: '', yearMade: 0 };

  openChangeCar(record: CustomerRecord) {
    if (record.status === 'Won' || record.status === 'Lost') return;
    this.activeRecordId.set(record.id);
    this.changeCarForm = { brand: record.brand, model: record.model, variant: record.variant, yearMade: record.yearMade };
    this.modal.set('changecar');
  }

  onChangeCarBrand(brand: string) {
    this.changeCarForm.brand = brand;
    this.onChangeCarModel(modelsForBrand(brand)[0] ?? '');
  }

  onChangeCarModel(model: string) {
    this.changeCarForm.model = model;
    this.onChangeCarVariant(variantsForModel(this.changeCarForm.brand, model)[0] ?? '');
  }

  onChangeCarVariant(variant: string) {
    this.changeCarForm.variant = variant;
    const years = this.changeCarYears();
    if (!years.includes(this.changeCarForm.yearMade)) this.changeCarForm.yearMade = years[0];
  }

  /** The chosen variant's model years from the catalog (newest first), else the generic list. */
  changeCarYears(): number[] {
    const v = this.findVehicle(this.changeCarForm);
    const years = v ? v.years.map((y) => y.year).sort((a, b) => b - a) : [];
    return years.length ? years : MODEL_YEARS;
  }

  changeCarIsDifferent(rec: CustomerRecord): boolean {
    const f = this.changeCarForm;
    return f.brand !== rec.brand || f.model !== rec.model || f.variant !== rec.variant || f.yearMade !== rec.yearMade;
  }

  // Plain method, not computed(): changeCarForm is a mutable object bound with ngModel.
  changeCarPreview(rec: CustomerRecord) {
    const oldVehicle = this.findRecordVehicle(rec);
    const newVehicle = this.findVehicle(this.changeCarForm);
    const oldPrice = oldVehicle?.price ?? 0;
    const newPrice = newVehicle?.price ?? 0;
    const q = rec.quotation;
    const oldRebate = q ? q.rebate + (q.additionalRebateEnabled ? (q.additionalRebateValue ?? 0) : 0) : oldVehicle ? this.yearRebate(oldVehicle, rec.yearMade) : 0;
    const newRebate = newVehicle ? this.yearRebate(newVehicle, this.changeCarForm.yearMade) : 0;
    const oldDownpayment = q ? this.computeQuotationNumbers(rec, q).downpaymentCash : 0;
    return { oldPrice, newPrice, delta: newPrice - oldPrice, oldRebate, newRebate, oldDownpayment };
  }

  async submitChangeCar(rec: CustomerRecord) {
    if (!this.changeCarIsDifferent(rec)) return;
    const delta = this.changeCarPreview(rec).delta;
    const note = delta === 0 ? undefined : `price ${delta > 0 ? '+' : '−'}${this.fmt(this.abs(delta))}`;
    const pendingRequote = rec.quotation ? this.snapshotForRequote(rec) : undefined;
    await this.customers.changeCar(rec.id, { ...this.changeCarForm }, { pendingRequote, note });
    this.closeModal();
    // Straight into the re-quote so the stale quotation is dealt with while the SA is here; if
    // they close it, the record stays flagged until they come back to it.
    const updated = this.customers.records().find((r) => r.id === rec.id);
    if (updated?.pendingRequote) this.openQuotation(updated);
  }

  /** What the existing quotation works out to, captured before the car changes underneath it. */
  private snapshotForRequote(rec: CustomerRecord): PendingRequote {
    const q = rec.quotation!;
    const n = this.computeQuotationNumbers(rec, q);
    return {
      from: { brand: rec.brand, model: rec.model, variant: rec.variant, yearMade: rec.yearMade },
      changedAt: Date.now(),
      allInPrice: n.allInPrice,
      downpaymentCash: n.downpaymentCash,
      loanAmount: n.loanAmount,
      tenureMonths: q.tenureMonths,
      monthly: this.monthlyFor(n, q.tenureMonths),
    };
  }

  private yearRebate(v: Vehicle, year: number): number {
    return rebateForYear(v, year) + additionalRebateForYear(v, year);
  }

  private findVehicle(c: CarSpec): Vehicle | undefined {
    return VEHICLES.find((v) => v.brand === c.brand && v.model === c.model && v.variant === c.variant);
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

  // ---------- One-tap stage actions (each offers Undo instead of asking first) ----------

  /** Won straight away when the colour is already known; otherwise one tap on a colour does it. */
  quickWon(record: CustomerRecord) {
    if (record.colour === TO_BE_CONFIRMED_COLOUR) {
      this.activeRecordId.set(record.id);
      this.modal.set('won');
      return;
    }
    void this.submitWon(record, record.colour);
  }

  async submitWon(record: CustomerRecord, colour: string) {
    if (!canSubmitWon(colour !== TO_BE_CONFIRMED_COLOUR)) return;
    const before = record;
    this.closeModal();
    await this.customers.markWon(record.id, { colour });
    celebrate();
    // Straight to the Won tab with this customer still open — next up is commission and gifts.
    this.openCustomer(record.id);
    const gifts = freeGiftsSummary(record);
    const left = gifts ? gifts.total - gifts.done : 0;
    const message =
      left > 0 ? this.i18n.t('Marked Won — {n} gift(s) still to do', { n: left }) : this.i18n.t('{name} marked Won', { name: record.name });
    this.toast.undoable(message, () => void this.customers.restore(before));
  }

  lostNote = signal('');

  async submitLost(record: CustomerRecord, reason: string) {
    const before = record;
    this.closeModal();
    await this.customers.markLost(record.id, { cancelReason: reason, cancelNotes: this.lostNote().trim() || undefined });
    this.toast.undoable(this.i18n.t('{name} marked Lost', { name: record.name }), () => void this.customers.restore(before));
  }

  async reopen(record: CustomerRecord) {
    const before = record;
    await this.customers.reopenCustomer(record.id);
    this.toast.undoable(this.i18n.t('{name} reopened', { name: record.name }), () => void this.customers.restore(before));
  }

  async toggleBooked(record: CustomerRecord) {
    await this.customers.setBooked(record.id, !record.booked);
    this.toast.show(record.booked ? 'Booking removed' : 'Marked as booked — no follow-up reminders while they wait');
  }

  // ---------- Commission (Won deals) ----------

  commissionDraft = signal<number | null>(null);

  commissionChanged(record: CustomerRecord): boolean {
    const v = this.commissionDraft();
    const next = v === null || (v as unknown) === '' ? null : Number(v);
    return next !== (record.commission ?? null) && (next === null || Number.isFinite(next));
  }

  async saveCommission(record: CustomerRecord) {
    if (!this.commissionChanged(record)) return;
    const v = this.commissionDraft();
    await this.customers.setCommission(record.id, v === null || (v as unknown) === '' ? undefined : Number(v));
    this.toast.show('Commission saved');
  }

  /** "Give rebate as cash back" is switched on in Settings. */
  cashbackAllowed = computed(() => this.settings.settings().salesDefaults.allowCashback ?? false);

  profitOf = dealProfit;
  signed = (v: number) => `${v >= 0 ? '+' : '−'}${this.fmt(Math.abs(v))}`;
  formatDate = formatStageDate;

  // ---------- To do ----------

  /** Which to-do the list is narrowed to, if any. */
  focus = signal<TodoId | null>(null);

  /** Counted across every customer, not just the open tab — each chip also jumps to its tab. */
  todos = computed(() => {
    const all = this.customers.records();
    return TODOS.map((t) => ({ ...t, count: all.filter((r) => TODO_MATCH[t.id](r, this)).length })).filter((t) => t.count > 0);
  });

  toggleFocus(id: TodoId) {
    if (this.focus() === id) {
      this.focus.set(null);
    } else {
      this.focus.set(id);
      this.activeTab.set(TODOS.find((t) => t.id === id)!.tab);
    }
    this.page.set(0);
  }

  /** What a phone card shows top-right — the one figure that matters at this stage. */
  headlineKey(): SortKey {
    const tab = this.activeTab();
    return tab === 'Lead' ? 'quote' : tab === 'Won' ? 'commission' : tab === 'Lost' ? 'cancelReason' : 'status';
  }

  /** "RM 1,214/mo" for a hire-purchase quote, the total for a cash one. */
  quoteLine(record: CustomerRecord): { main: string; sub: string } | null {
    const q = this.panelQuote(record);
    // No price means the car isn't in the catalog — nothing meaningful to show.
    if (!q || q.allInPrice <= 0) return null;
    if (q.cash) return { main: this.fmt(q.allInPrice), sub: 'Cash' };
    return { main: `${this.fmt(Math.round(q.monthly))}/mo`, sub: `${q.tenureMonths / 12} yrs · ${this.fmt(Math.round(q.downpayment))} down` };
  }

  // ---------- Quotation (view / edit / download / print) ----------

  quotationModalId = signal<string | null>(null);
  quotationEditing = signal(false);
  quotationForm: QuotationDetails = this.blankQuotationForm();
  /** Lives on the record itself (CustomerRecord.financingType), not inside QuotationDetails — kept
   *  as its own form field here rather than folded into quotationForm so there's still one single
   *  source of truth for it, saved back via editCustomer alongside the quotation (see
   *  saveQuotation), instead of a second copy that could drift from the record's own value. */
  quotationFinancingType: FinancingType = 'Loan';

  activeQuotationRecord = computed(() => this.customers.records().find((r) => r.id === this.quotationModalId()) ?? null);

  /** Rebate and Additional Rebate seed from the car's Finance Database defaults when given its
   *  vehicle, from whichever model year the record is for — both can vary year to year, each
   *  independently of the other. */
  private blankQuotationForm(vehicle?: Vehicle, yearMade?: number): QuotationDetails {
    const hasYear = vehicle && yearMade != null;
    const additionalRebate = hasYear ? additionalRebateForYear(vehicle, yearMade) : 0;
    return {
      rebate: hasYear ? rebateForYear(vehicle, yearMade) : 0,
      ncd: 0,
      interestRate: vehicle?.interestRate ?? this.settings.settings().salesDefaults.interestRate,
      rateType: 'flat',
      downpaymentType: 'percent',
      downpaymentValue: 10,
      tenureMonths: TENURE_OPTIONS[0].months,
      additionalRebateEnabled: additionalRebate > 0,
      additionalRebateValue: additionalRebate,
    };
  }

  private findRecordVehicle(record: CustomerRecord): Vehicle | undefined {
    return VEHICLES.find((v) => v.brand === record.brand && v.model === record.model && v.variant === record.variant);
  }

  /** A pending re-quote opens straight into the editor, pre-filled for the new car. */
  openQuotation(record: CustomerRecord) {
    this.quotationModalId.set(record.id);
    this.quotationFinancingType = record.financingType ?? 'Loan';
    if (record.quotation && record.pendingRequote) {
      this.quotationForm = this.requoteForm(record);
      this.quotationEditing.set(true);
      return;
    }
    this.quotationForm = record.quotation ? { ...record.quotation } : this.blankQuotationForm(this.findRecordVehicle(record), record.yearMade);
    this.quotationEditing.set(!record.quotation);
  }

  /**
   * Starting point for re-quoting after a car change. What belongs to the *car* comes from the new
   * car — rebate and additional rebate for its model year, its rate (or the account default), and
   * its insurance quotation, frozen as a snapshot like the Calculator does. What belongs to the
   * *customer* carries over — NCD, tenure, rate type, and the down payment as the same RM amount
   * they agreed (not the same %, which would silently change the cash they need on a pricier car).
   */
  private requoteForm(rec: CustomerRecord): QuotationDetails {
    const q = rec.quotation!;
    const pr = rec.pendingRequote!;
    const v = this.findRecordVehicle(rec);
    const defaults = this.settings.settings().salesDefaults;
    const rateType = q.rateType ?? 'flat';
    const additional = v ? additionalRebateForYear(v, rec.yearMade) : 0;
    const insurance = v ? this.settings.getVehicleInsurance(v, basicPremiumDefault(v.price, defaults.basicPremiumRatePct)) : undefined;
    const cash = (rec.financingType ?? 'Loan') === 'Cash';
    return {
      ...q,
      rebate: v ? rebateForYear(v, rec.yearMade) : 0,
      additionalRebateEnabled: additional > 0,
      additionalRebateValue: additional,
      // No EIR for the new car anywhere → keep the rate already quoted rather than reuse a flat one.
      interestRate: (v ? defaultRateFor(v, rateType, defaults) : null) ?? q.interestRate,
      insuranceDetails: insurance,
      basicPremium: insurance?.basicPremium,
      downpaymentType: cash ? 'percent' : 'amount',
      downpaymentValue: cash ? 100 : pr.downpaymentCash,
    };
  }

  formatStageDate = formatStageDate;

  monthlyFor(numbers: { repaymentRows: { months: number; monthly: number }[] }, months: number): number {
    return numbers.repaymentRows.find((r) => r.months === months)?.monthly ?? 0;
  }

  pctOf(part: number, whole: number): string {
    return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';
  }

  closeQuotation() {
    this.quotationModalId.set(null);
    this.quotationEditing.set(false);
  }

  startEditQuotation() {
    const rec = this.activeQuotationRecord();
    if (rec?.quotation) this.quotationForm = rec.pendingRequote ? this.requoteForm(rec) : { ...rec.quotation };
    this.quotationFinancingType = rec?.financingType ?? 'Loan';
    this.quotationEditing.set(true);
  }

  cancelEditQuotation() {
    const rec = this.activeQuotationRecord();
    if (rec?.quotation) this.quotationEditing.set(false);
    else this.closeQuotation();
  }

  /** Cash means the full selling price is due with no financing at all — switching to it pins
   *  the downpayment to 100% (so the loan amount always computes to 0, same signal the rest of
   *  the app uses to recognise a cash deal) and hides the now-meaningless rate/tenure fields.
   *  Switching back to Loan restores the SA's default downpayment % instead of leaving it at 100,
   *  which would otherwise still compute as a cash deal despite Loan being selected. */
  onQuotationFinancingTypeChange(type: FinancingType) {
    this.quotationFinancingType = type;
    if (type === 'Cash') {
      this.quotationForm.downpaymentType = 'percent';
      this.quotationForm.downpaymentValue = 100;
    } else if (this.quotationForm.downpaymentType === 'percent' && this.quotationForm.downpaymentValue === 100) {
      this.quotationForm.downpaymentValue = this.settings.settings().salesDefaults.downpaymentPct;
    }
  }

  async saveQuotation(id: string) {
    await this.customers.updateQuotation(id, this.quotationForm);
    await this.customers.editCustomer(id, { financingType: this.quotationFinancingType });
    this.quotationEditing.set(false);
  }


  private computeQuotationNumbers(spec: { brand: string; model: string; variant: string; yearMade: number }, q: QuotationDetails) {
    const vehicle = VEHICLES.find((v) => v.brand === spec.brand && v.model === spec.model && v.variant === spec.variant);
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
    // What the loan is sized against — the same quotation at 0% NCD, so a better NCD only
    // shrinks the downpayment (see computeQuotationTotals's loanBasisInsuranceAmount).
    const loanBasisInsurance = computeInsuranceBreakdown(insuranceDetails, 0).totalDue;

    const totals = computeQuotationTotals({
      basePrice,
      effectiveRebate,
      insuranceAmount: insuranceBreakdown.totalDue,
      loanBasisInsuranceAmount: loanBasisInsurance,
      downpaymentType: q.downpaymentType,
      downpaymentValue: q.downpaymentValue,
      minDownpaymentCash: minDownpaymentCash(vehicle?.minDownpayment, basePrice),
      loanRounding: q.loanRounding,
      cashbackAmount: q.cashbackAmount,
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
      cashback: totals.cashback,
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

  /** The figures the customer panel shows — straight from the saved quotation, the only
   *  financial record a customer has. */
  panelQuote(record: CustomerRecord): QuoteSummary | null {
    const q = record.quotation;
    if (!q) return null;
    const n = this.computeQuotationNumbers(record, q);
    return {
      cash: isCashDeal(record),
      allInPrice: n.allInPrice,
      rebate: n.effectiveRebate - n.cashback,
      cashback: n.cashback,
      ncd: q.ncd,
      insurance: n.insuranceAmount,
      downpayment: n.downpaymentCash,
      loanAmount: n.loanAmount,
      tenureMonths: q.tenureMonths,
      interestRate: q.interestRate,
      rateType: n.rateType,
      monthly: monthlyPayment(n.loanAmount, q.interestRate, q.tenureMonths, n.rateType),
    };
  }

}
