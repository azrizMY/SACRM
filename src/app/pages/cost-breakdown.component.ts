import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CountUpDirective } from '../shared/count-up.directive';
import { IconComponent, type IconName } from '../shared/icon.component';
import { DateRangePickerComponent } from '../shared/date-range-picker.component';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { DealExtrasComponent } from '../shared/deal-extras.component';
import { I18nService, TranslatePipe } from '../shared/i18n';
import { ToastService } from '../shared/toast.service';
import { CustomerService } from '../shared/customer.service';
import { VEHICLES, formatRM, modelVariantLabel } from '../data/calculator-data';
import { CUSTOMER_STATUS_META, dealProfit, freeGiftsSummary, totalCostSpent, giftBudgetReport, giftsSpent, giftsStillToDo, hiddenCosts, wonDate, type CustomerRecord } from '../data/customer-data';

type SortKey = 'date' | 'name' | 'brand' | 'status' | 'commission' | 'totalCost' | 'netProfit';
type SortDir = 'asc' | 'desc';
type Period = 'thisMonth' | 'lastMonth' | 'all';

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'status', label: 'Status' },
  { key: 'commission', label: 'Commission', align: 'right' },
  { key: 'totalCost', label: 'Total Cost', align: 'right' },
  { key: 'netProfit', label: 'Net Profit', align: 'right' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 30];


/** The date a deal is filed under: the day it was won, or for an open Lead, when it came in. */
function dealDate(r: CustomerRecord): string {
  return r.status === 'Won' ? wonDate(r) : r.date;
}

function hasCommission(r: CustomerRecord): boolean {
  return r.commission != null;
}

function sortValue(r: CustomerRecord, key: SortKey): string | number {
  switch (key) {
    case 'date':
      return dealDate(r);
    case 'name':
      return r.name;
    case 'brand':
      return `${r.brand} ${r.model}`;
    case 'status':
      return r.status;
    case 'commission':
      return r.commission ?? 0;
    case 'totalCost':
      return totalCostSpent(r);
    case 'netProfit':
      return dealProfit(r);
  }
}

/** "YYYY-MM-DD" for the first and last day of the month `offset` months from today. */
function monthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
}

/**
 * Won deals (plus Leads with gifts or costs): commission, itemised cost spent, the resulting net
 * profit, and each deal's free-gift checklist (the source of truth Customer Manager's "gifts outstanding"
 * flag reads). Everything per deal lives in its expandable detail — costs and gifts are edited
 * inline there; only commission uses a small dialog (it's a single required figure with a preview).
 */
@Component({
  selector: 'app-cost-breakdown',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, DateRangePickerComponent, BrandMarkComponent, CountUpDirective, DealExtrasComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h2 class="text-balance text-xl font-bold tracking-tight">{{ "Earnings" | t }}</h2>
          <p class="text-pretty text-sm text-muted-foreground">{{ "Commission in, gifts and costs out — and what's left for you." | t }}</p>
        </div>
        <!-- Quick period — commission is tracked by month -->
        <div role="radiogroup" aria-label="Period" class="flex rounded-lg bg-card p-1">
          @for (p of periods; track p.id) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="period() === p.id"
              (click)="setPeriod(p.id)"
              class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
              [ngClass]="period() === p.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            >
              {{ p.label }}
            </button>
          }
        </div>
      </div>

      <!-- Summary tiles — follow every filter above the list -->
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <app-icon name="wallet" [size]="18" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Deals</span>
            <span class="font-mono text-xl font-bold tabular" [appCountUp]="'' + filteredSorted().length"></span>
            @if (pendingCount() > 0) {
              <span class="truncate text-[11px] font-medium text-[var(--warning)]">{{ pendingCount() }} pending</span>
            }
          </div>
        </div>
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <app-icon name="arrow-up-right" [size]="18" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Commission</span>
            <span class="truncate font-mono text-xl font-bold tabular text-[var(--success)]" [appCountUp]="fmt(totalCommission())"></span>
          </div>
        </div>
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--destructive)]/15 text-[var(--destructive)] ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <app-icon name="arrow-down-right" [size]="18" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{{ "Cost spent" | t }}</span>
            <span class="truncate font-mono text-xl font-bold tabular text-[var(--destructive)]" [appCountUp]="fmt(totalCosts())"></span>
          </div>
        </div>
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
            [ngClass]="totalNet() >= 0 ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--destructive)]/15 text-[var(--destructive)]'"
          >
            <app-icon name="credit-card" [size]="18" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Net profit</span>
            <span
              class="truncate font-mono text-xl font-bold tabular"
              [ngClass]="totalNet() >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'"
              [appCountUp]="signed(totalNet())"
            ></span>
            @if (pendingCount() > 0) {
              <span class="truncate text-[11px] text-muted-foreground">Excl. pending</span>
            }
          </div>
        </div>
      </div>

      <!-- Waiting for commission: type the amount, press Enter, next one -->
      @if (awaitingCommission().length) {
        <section class="flex flex-col gap-2 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/8 p-3">
          <div class="flex items-center gap-2">
            <app-icon name="wallet" [size]="15" class="text-[var(--warning)]" />
            <span class="text-sm font-semibold">{{ "Waiting for commission" | t }}</span>
            <span class="rounded-md bg-[var(--warning)]/20 px-1.5 text-[11px] font-bold text-[var(--warning)] tabular">{{ awaitingCommission().length }}</span>
            <span class="ml-auto hidden text-[11px] text-muted-foreground sm:block">{{ "Type the amount and press Enter" | t }}</span>
          </div>
          <ul class="flex flex-col divide-y divide-border/60">
            @for (r of awaitingCommission(); track r.id) {
              <li class="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                <div class="flex min-w-0 flex-1 basis-48 items-center gap-2">
                  <app-brand-mark [brand]="r.brand" />
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-sm font-semibold">{{ r.name }}</span>
                    <span class="truncate text-xs text-muted-foreground">
                      {{ modelVariantLabel(r.model, r.variant) }} · {{ "won" | t }} {{ shortDate(r) }}@if (costOf(r) !== 0) { · {{ fmt(costOf(r)) }} {{ "spent" | t }} }
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="relative w-36">
                    <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">RM</span>
                    <input
                      [id]="'commission-' + r.id"
                      type="number"
                      inputmode="decimal"
                      step="100"
                      [placeholder]="'e.g. 1500' | t"
                      [ngModel]="draftFor(r.id)"
                      (ngModelChange)="setDraft(r.id, $event)"
                      (keydown.enter)="saveInline(r)"
                      class="h-9 w-full rounded-lg border border-input bg-input pl-10 pr-2 text-sm tabular text-foreground outline-none focus:border-ring"
                    />
                  </div>
                  <button type="button" (click)="saveInline(r)" [disabled]="!draftValid(r.id)" class="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40">{{ "Save" | t }}</button>
                </div>
              </li>
            }
          </ul>
        </section>
      }

      <!-- Where the money goes: promised gifts (budget vs what they really cost) and extra costs -->
      @if (moneyTotals(); as m) {
        <section class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <div class="flex flex-wrap items-center gap-2">
            <app-icon name="gift" [size]="15" class="text-primary" />
            <span class="text-sm font-semibold">{{ "Where the money goes" | t }}</span>
            <span class="text-[11px] text-muted-foreground">{{ "Follows the period and filters above the list" | t }}</span>
          </div>

          <div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div class="flex flex-col rounded-lg bg-muted/50 px-3 py-2">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Gift budget" | t }}</span>
              <span class="font-mono text-base font-bold tabular">{{ fmt(m.budget) }}</span>
              <span class="text-[10px] text-muted-foreground">{{ "What you promised, at usual prices" | t }}</span>
            </div>
            <div class="flex flex-col rounded-lg bg-muted/50 px-3 py-2">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Gifts done" | t }}</span>
              <span class="font-mono text-base font-bold tabular">{{ fmt(m.actual) }}</span>
              @if (m.variance !== 0) {
                <span class="text-[10px] font-semibold" [ngClass]="m.variance > 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">{{ (m.variance > 0 ? '{amount} over' : '{amount} under') | t: { amount: fmt(abs(m.variance)) } }}</span>
              } @else {
                <span class="text-[10px] text-muted-foreground">{{ "What they really cost" | t }}</span>
              }
            </div>
            <div class="flex flex-col rounded-lg px-3 py-2" [ngClass]="m.remaining > 0 ? 'bg-[var(--warning)]/10' : 'bg-muted/50'">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Still to do" | t }}</span>
              <span class="font-mono text-base font-bold tabular" [ngClass]="m.remaining > 0 ? 'text-[var(--warning)]' : ''">~{{ fmt(m.remaining) }}</span>
              <span class="text-[10px] text-muted-foreground">{{ "Promised, not sorted yet" | t }}</span>
            </div>
            <div class="flex flex-col rounded-lg bg-muted/50 px-3 py-2">
              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Extra costs" | t }}</span>
              <span class="font-mono text-base font-bold tabular">{{ fmt(m.hidden) }}</span>
              <span class="text-[10px] text-muted-foreground">{{ "Petrol, loader, referral…" | t }}</span>
            </div>
          </div>

          <ul class="flex flex-col divide-y divide-border">
            <li class="hidden items-center gap-x-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
              <span class="flex-1">{{ "Deal" | t }}</span>
              <span class="w-32 text-right">{{ "Gifts done / budget" | t }}</span>
              <span class="w-28 text-right">{{ "Result" | t }}</span>
              <span class="w-24 text-right">{{ "Still to do" | t }}</span>
              <span class="w-24 text-right">{{ "Extra" | t }}</span>
            </li>
            @for (row of moneyRows(); track row.record.id) {
              <li>
                <button type="button" (click)="toggleExpand(row.record.id)" class="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-2 text-left text-sm">
                  <span class="min-w-0 flex-1 basis-40">
                    <span class="block truncate font-semibold">{{ row.record.name }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ modelVariantLabel(row.record.model, row.record.variant) }} · {{ statusMeta(row.record.status).label }}</span>
                  </span>
                  <span class="w-32 whitespace-nowrap text-right text-xs tabular text-muted-foreground">
                    {{ row.budget > 0 ? fmt(row.actual) + ' / ' + fmt(row.budget) : '—' }}
                  </span>
                  <span class="w-28 whitespace-nowrap text-right text-xs font-semibold tabular" [ngClass]="row.variance > 0 ? 'text-[var(--destructive)]' : row.variance < 0 ? 'text-[var(--success)]' : 'text-muted-foreground'">
                    @if (row.variance !== 0) {
                      {{ (row.variance > 0 ? '{amount} over' : '{amount} under') | t: { amount: fmt(abs(row.variance)) } }}
                    } @else if (row.budget > 0 && row.actual === 0) {
                      <span class="font-normal">{{ "Not done yet" | t }}</span>
                    } @else if (row.budget > 0) {
                      {{ "On budget" | t }}
                    } @else {
                      —
                    }
                  </span>
                  <span class="w-24 whitespace-nowrap text-right text-xs tabular" [ngClass]="row.remaining > 0 ? 'text-[var(--warning)]' : 'text-muted-foreground'">
                    {{ row.remaining > 0 ? '~' + fmt(row.remaining) : '—' }}
                  </span>
                  <span class="w-24 whitespace-nowrap text-right text-xs tabular" [ngClass]="row.hidden !== 0 ? 'text-foreground' : 'text-muted-foreground'">
                    {{ row.hidden !== 0 ? fmt(row.hidden) : '—' }}
                  </span>
                </button>
              </li>
            }
          </ul>
        </section>
      }

      <!-- Filters -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="relative min-w-0 flex-1">
          <app-icon name="search" [size]="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Name or car…"
            [ngModel]="nameFilter()"
            (ngModelChange)="nameFilter.set($event); page.set(0)"
            class="h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground outline-none"
          />
        </div>
        <select
          [ngModel]="carFilter()"
          (ngModelChange)="carFilter.set($event); page.set(0)"
          aria-label="Car brand"
          class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none sm:w-44"
        >
          <option value="All">All brands</option>
          @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
        </select>
        <div class="sm:w-60">
          <app-date-range-picker
            [from]="dateFromFilter()"
            (fromChange)="dateFromFilter.set($event); page.set(0)"
            [to]="dateToFilter()"
            (toChange)="dateToFilter.set($event); page.set(0)"
          />
        </div>
        @if (hasActiveFilters()) {
          <button type="button" (click)="clearFilters()" class="flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <app-icon name="x" [size]="12" />
            Clear
          </button>
        }
      </div>

      <!-- Deals -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
        <div class="hidden overflow-x-auto sm:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border">
                @for (col of columns; track col.key) {
                  <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                    <button
                      type="button"
                      (click)="toggleSort(col.key)"
                      class="inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground"
                      [ngClass]="[col.align === 'right' ? 'flex-row-reverse' : '', sortKey() === col.key ? 'text-foreground' : '']"
                    >
                      {{ col.label }}
                      <app-icon [name]="sortIcon(col.key)" [size]="13" class="opacity-70" />
                    </button>
                  </th>
                }
                <th class="h-10 whitespace-nowrap px-4 text-right align-middle">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr
                  class="cursor-pointer border-b border-border transition-colors last:border-0"
                  [ngClass]="expandedId() === r.id ? 'bg-primary/8' : 'hover:bg-muted/40'"
                  (click)="toggleExpand(r.id)"
                >
                  <td class="p-4 align-middle">
                    <div class="flex items-center gap-2">
                      <app-icon name="chevron-down" [size]="14" [class]="'shrink-0 text-muted-foreground transition-transform ' + (expandedId() === r.id ? 'rotate-180' : '')" />
                      <div class="flex min-w-0 flex-col gap-1">
                        <span class="font-semibold">{{ r.name }}</span>
                        <ng-container [ngTemplateOutlet]="giftChip" [ngTemplateOutletContext]="{ $implicit: r }" />
                      </div>
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <div class="flex items-center gap-2">
                      <app-brand-mark [brand]="r.brand" />
                      <div class="flex flex-col">
                        <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                        <span class="whitespace-nowrap text-xs text-muted-foreground tabular">{{ r.yearMade }} · {{ shortDate(r) }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta(r.status).tone">
                      <span class="size-1.5 rounded-full" [ngClass]="statusMeta(r.status).dot"></span>
                      {{ statusMeta(r.status).label }}
                    </span>
                  </td>
                  <td class="p-4 text-right align-middle tabular">
                    @if (hasCommission(r)) {
                      {{ fmt(r.commission!) }}
                    } @else if (r.status !== 'Won') {
                      <span class="text-muted-foreground">—</span>
                    } @else {
                      <span class="rounded-md bg-[var(--warning)]/14 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--warning)]">Pending</span>
                    }
                  </td>
                  <td class="p-4 text-right align-middle tabular" [ngClass]="costOf(r) > 0 ? 'text-[var(--destructive)]' : costOf(r) < 0 ? 'text-[var(--success)]' : 'text-muted-foreground'">
                    {{ costOf(r) !== 0 ? fmt(costOf(r)) : '—' }}
                  </td>
                  <td class="p-4 text-right align-middle font-semibold tabular">
                    <ng-container [ngTemplateOutlet]="netCell" [ngTemplateOutletContext]="{ $implicit: r }" />
                  </td>
                  <td class="p-4 text-right align-middle">
                    <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                      @if (r.status === 'Won') {
                        <button type="button" (click)="openCosting(r)" class="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-accent">
                          <app-icon name="pencil" [size]="12" />
                          Commission
                        </button>
                      }
                      <button type="button" (click)="expandForCost(r.id)" class="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-accent">
                        <app-icon name="plus" [size]="12" />
                        Cost
                      </button>
                    </div>
                  </td>
                </tr>
                @if (expandedId() === r.id) {
                  <tr class="border-b border-border bg-muted/20 last:border-0">
                    <td [attr.colspan]="columns.length + 1" class="p-4">
                      <ng-container [ngTemplateOutlet]="detail" [ngTemplateOutletContext]="{ $implicit: r }" />
                    </td>
                  </tr>
                }
              } @empty {
                <tr class="hover:bg-transparent">
                  <td [attr.colspan]="columns.length + 1" class="p-10 text-center text-sm text-muted-foreground">{{ emptyMessage() }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Phones -->
        <div class="flex flex-col divide-y divide-border sm:hidden">
          @for (r of rows(); track r.id) {
            <div [ngClass]="expandedId() === r.id ? 'bg-primary/8' : ''">
              <div role="button" tabindex="0" (click)="toggleExpand(r.id)" (keydown.enter)="toggleExpand(r.id)" class="flex cursor-pointer flex-col gap-2.5 p-4">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 flex-col gap-1">
                    <span class="truncate font-semibold">{{ r.name }}</span>
                    <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {{ modelVariantLabel(r.model, r.variant) }} · {{ shortDate(r) }}
                    </span>
                  </div>
                  <span class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium" [ngClass]="statusMeta(r.status).tone">
                    <span class="size-1.5 rounded-full" [ngClass]="statusMeta(r.status).dot"></span>
                    {{ statusMeta(r.status).label }}
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-2 text-xs">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Commission</span>
                    @if (hasCommission(r)) {
                      <span class="font-semibold tabular">{{ fmt(r.commission!) }}</span>
                    } @else if (r.status !== 'Won') {
                      <span class="font-semibold text-muted-foreground">—</span>
                    } @else {
                      <span class="w-fit rounded-md bg-[var(--warning)]/14 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">Pending</span>
                    }
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Cost</span>
                    <span class="font-semibold tabular" [ngClass]="costOf(r) > 0 ? 'text-[var(--destructive)]' : 'text-muted-foreground'">{{ costOf(r) !== 0 ? fmt(costOf(r)) : '—' }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 text-right">
                    <span class="text-[10px] uppercase tracking-wide text-muted-foreground">Net</span>
                    <span class="font-semibold tabular"><ng-container [ngTemplateOutlet]="netCell" [ngTemplateOutletContext]="{ $implicit: r }" /></span>
                  </div>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <ng-container [ngTemplateOutlet]="giftChip" [ngTemplateOutletContext]="{ $implicit: r }" />
                  <div class="ml-auto flex gap-1.5" (click)="$event.stopPropagation()">
                    @if (r.status === 'Won') {
                      <button type="button" (click)="openCosting(r)" class="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold">
                        <app-icon name="pencil" [size]="12" />
                        Commission
                      </button>
                    }
                    <button type="button" (click)="expandForCost(r.id)" class="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold">
                      <app-icon name="plus" [size]="12" />
                      Cost
                    </button>
                  </div>
                </div>
              </div>
              @if (expandedId() === r.id) {
                <div class="border-t border-border bg-muted/20 p-3">
                  <ng-container [ngTemplateOutlet]="detail" [ngTemplateOutletContext]="{ $implicit: r }" />
                </div>
              }
            </div>
          } @empty {
            <p class="p-10 text-center text-sm text-muted-foreground">{{ emptyMessage() }}</p>
          }
        </div>

        <!-- Pagination -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <select [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)" class="h-8 rounded-md border border-input bg-input px-2 text-xs text-foreground outline-none">
              @for (n of pageSizeOptions; track n) { <option [ngValue]="n">{{ n }}</option> }
            </select>
            <span class="tabular">Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ filteredSorted().length }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" (click)="prevPage()" [disabled]="currentPage() === 0" aria-label="Previous page" class="inline-flex size-8 items-center justify-center rounded-md bg-muted transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40">
              <app-icon name="chevron-left" [size]="16" />
            </button>
            <span class="px-2 text-xs text-muted-foreground tabular">{{ currentPage() + 1 }} / {{ pageCount() }}</span>
            <button type="button" (click)="nextPage()" [disabled]="currentPage() >= pageCount() - 1" aria-label="Next page" class="inline-flex size-8 items-center justify-center rounded-md bg-muted transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40">
              <app-icon name="chevron-right" [size]="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Net profit — "Pending" until a commission is keyed in, so a deal with costs but no
         commission yet doesn't read as a loss. -->
    <ng-template #netCell let-r>
      @if (hasCommission(r)) {
        <span [ngClass]="profitOf(r) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">{{ signed(profitOf(r)) }}</span>
      } @else {
        <span class="text-muted-foreground">—</span>
      }
    </ng-template>

    <!-- Free-gift progress on the row -->
    <ng-template #giftChip let-r>
      @if (giftSummary(r); as g) {
        <span
          class="inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          [ngClass]="g.done === g.total ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-[var(--warning)]/14 text-[var(--warning)]'"
        >
          <app-icon name="gift" [size]="10" />
          {{ g.done }}/{{ g.total }} gifts
        </span>
      }
    </ng-template>

    <!-- Expanded deal: free gifts and cost spent, the same editor as the customer panel -->
    <ng-template #detail let-r>
      <div class="flex flex-col gap-2">
        <app-deal-extras [record]="r" [columns]="true" [showBudget]="true" surface="bg-card" />
        <a routerLink="/leads" [queryParams]="{ customer: r.id }" class="flex w-fit items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {{ "Open customer" | t }}
          <app-icon name="arrow-up-right" [size]="12" />
        </a>
      </div>
    </ng-template>

    <!-- Edit Commission modal -->
    @if (activeRecord(); as rec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeCosting()"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Commission &middot; {{ rec.name }}</span>
            <button type="button" (click)="closeCosting()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <div class="flex flex-col gap-3 p-4">
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Commission (RM) <span class="text-[var(--destructive)]">*</span>
              <input
                type="number"
                step="50"
                required
                placeholder="Required"
                [ngModel]="commissionInput()"
                (ngModelChange)="commissionInput.set($event)"
                class="h-10 rounded-lg border bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                [ngClass]="commissionValid() ? 'border-input' : 'border-[var(--destructive)]'"
              />
            </label>
            @if (commissionInput() !== null) {
              <div class="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                <span>Net Profit (after {{ fmt(costOf(rec)) }} cost spent)</span>
                <strong class="text-sm tabular" [ngClass]="(commissionInput() ?? 0) - costOf(rec) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">
                  {{ signed((commissionInput() ?? 0) - costOf(rec)) }}
                </strong>
              </div>
            }
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeCosting()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="saveCosting(rec.id)" [disabled]="!commissionValid()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CostBreakdownComponent {
  modelVariantLabel = modelVariantLabel;
  columns = COLUMNS;
  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));
  pageSizeOptions = PAGE_SIZE_OPTIONS;
  /** Quick-add cost buttons — set in Settings → Quote Preferences. */
  periods: { id: Period; label: string }[] = [
    { id: 'thisMonth', label: 'This month' },
    { id: 'lastMonth', label: 'Last month' },
    { id: 'all', label: 'All time' },
  ];

  fmt = (v: number) => formatRM(v);
  profitOf = dealProfit;
  costOf = totalCostSpent;
  hasCommission = hasCommission;
  giftSummary = freeGiftsSummary;
  statusMeta = (s: CustomerRecord['status']) => CUSTOMER_STATUS_META[s] ?? CUSTOMER_STATUS_META.Lead;
  signed = (v: number) => `${v >= 0 ? '+' : '−'}${formatRM(Math.abs(v))}`;

  nameFilter = signal('');
  carFilter = signal('All');
  dateFromFilter = signal('');
  dateToFilter = signal('');
  /** Newest deals first by default. */
  sortKey = signal<SortKey>('date');
  sortDir = signal<SortDir>('desc');

  pageSize = signal(10);
  page = signal(0);

  activeRecordId = signal<string | null>(null);
  commissionInput = signal<number | null>(null);

  expandedId = signal<string | null>(null);
  private i18n = inject(I18nService);

  constructor(
    public customers: CustomerService,
    private toast: ToastService,
  ) {}

  // ---------- Waiting for commission (inline entry) ----------

  /** Every won deal still without a commission — regardless of the period picked, since these are
   *  jobs to finish, not figures to report. Oldest first: those are the ones most overdue. */
  awaitingCommission = computed(() =>
    this.customers
      .records()
      .filter((r) => r.status === 'Won' && r.commission == null)
      .sort((a, b) => wonDate(a).localeCompare(wonDate(b))),
  );

  private drafts = signal<Record<string, number | null>>({});

  draftFor(id: string): number | null {
    return this.drafts()[id] ?? null;
  }

  setDraft(id: string, value: number | null) {
    this.drafts.update((d) => ({ ...d, [id]: value }));
  }

  draftValid(id: string): boolean {
    const v = this.draftFor(id);
    return v !== null && (v as unknown) !== '' && Number.isFinite(Number(v)) && Number(v) !== 0;
  }

  /** Saves and jumps to the next deal's box, so a month's payouts go in with just typing and Enter. */
  async saveInline(record: CustomerRecord) {
    if (!this.draftValid(record.id)) return;
    const list = this.awaitingCommission();
    const next = list[list.findIndex((r) => r.id === record.id) + 1];
    await this.customers.setCommission(record.id, Number(this.draftFor(record.id)));
    this.setDraft(record.id, null);
    this.toast.show(this.i18n.t('Commission saved for {name}', { name: record.name }));
    if (next) setTimeout(() => document.getElementById('commission-' + next.id)?.focus());
  }

  activeRecord = computed(() => this.customers.records().find((r) => r.id === this.activeRecordId()) ?? null);

  /** Won deals, plus open Leads that already have gifts promised or money spent — so spending on
   *  deals that haven't closed yet is visible too. Lost deals never show up here. */
  eligibleRecords = computed(() =>
    this.customers.records().filter((r) => r.status === 'Won' || (r.status === 'Lead' && (!!r.freeGifts?.length || !!r.costItems?.length))),
  );

  filteredSorted = computed(() => {
    let list = this.eligibleRecords();
    const search = this.nameFilter().trim().toLowerCase();
    if (search) list = list.filter((r) => `${r.name} ${r.brand} ${r.model} ${r.variant}`.toLowerCase().includes(search));
    if (this.carFilter() !== 'All') list = list.filter((r) => r.brand === this.carFilter());
    if (this.dateFromFilter()) list = list.filter((r) => dealDate(r) >= this.dateFromFilter());
    if (this.dateToFilter()) list = list.filter((r) => dealDate(r) <= this.dateToFilter());

    const key = this.sortKey();
    const dir = this.sortDir();
    return [...list].sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  // Tiles follow the same filters as the list. Net profit only counts deals with a commission
  // keyed in — a deal still waiting on its commission would otherwise read as a loss.
  pendingCount = computed(() => this.filteredSorted().filter((r) => r.status === 'Won' && !hasCommission(r)).length);
  totalCommission = computed(() => this.filteredSorted().reduce((sum, r) => sum + (r.commission ?? 0), 0));
  totalCosts = computed(() => this.filteredSorted().reduce((sum, r) => sum + totalCostSpent(r), 0));
  /** Per deal: gift budget, what done gifts really cost, over/under, still to do, extra costs. */
  moneyRows = computed(() =>
    this.filteredSorted()
      .filter((r) => !!r.freeGifts?.length || !!r.costItems?.length)
      .map((record) => {
        const b = giftBudgetReport(record);
        return {
          record,
          budget: b?.budget ?? 0,
          actual: giftsSpent(record),
          variance: b?.variance ?? 0,
          remaining: giftsStillToDo(record),
          hidden: hiddenCosts(record),
        };
      })
      .sort((a, b) => b.variance - a.variance || b.remaining - a.remaining),
  );
  /** The same, summed over the listed deals — null when none has gifts or extra costs. */
  moneyTotals = computed(() => {
    const rows = this.moneyRows();
    if (!rows.length) return null;
    return rows.reduce(
      (t, r) => ({ budget: t.budget + r.budget, actual: t.actual + r.actual, variance: t.variance + r.variance, remaining: t.remaining + r.remaining, hidden: t.hidden + r.hidden }),
      { budget: 0, actual: 0, variance: 0, remaining: 0, hidden: 0 },
    );
  });
  abs = Math.abs;
  totalNet = computed(() => this.filteredSorted().filter(hasCommission).reduce((sum, r) => sum + dealProfit(r), 0));

  /** Which quick period the date range currently matches, if any. */
  period = computed<Period | null>(() => {
    const from = this.dateFromFilter();
    const to = this.dateToFilter();
    if (!from && !to) return 'all';
    const t = monthRange(0);
    if (from === t.from && to === t.to) return 'thisMonth';
    const l = monthRange(-1);
    if (from === l.from && to === l.to) return 'lastMonth';
    return null;
  });

  setPeriod(p: Period) {
    const range = p === 'all' ? { from: '', to: '' } : monthRange(p === 'thisMonth' ? 0 : -1);
    this.dateFromFilter.set(range.from);
    this.dateToFilter.set(range.to);
    this.page.set(0);
  }

  emptyMessage(): string {
    if (this.eligibleRecords().length === 0) return 'No deals yet — won deals, and leads with gifts or costs, appear here automatically.';
    return 'No deals match these filters.';
  }

  shortDate(r: CustomerRecord): string {
    const d = dealDate(r);
    return d ? new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }) : '';
  }

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
    return !!this.nameFilter() || this.carFilter() !== 'All' || !!this.dateFromFilter() || !!this.dateToFilter();
  }

  clearFilters() {
    this.nameFilter.set('');
    this.carFilter.set('All');
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
    this.page.set(0);
  }

  // ---------- Expanded detail ----------

  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  /** "+ Cost" on a row: open its detail and put the cursor in the cost field. */
  expandForCost(id: string) {
    this.expandedId.set(id);
    setTimeout(() => document.getElementById('cost-label-' + id)?.focus());
  }

  // ---------- Commission ----------

  commissionValid(): boolean {
    const v = this.commissionInput();
    return v !== null && v !== 0;
  }

  openCosting(record: CustomerRecord) {
    this.activeRecordId.set(record.id);
    this.commissionInput.set(record.commission ?? null);
  }

  closeCosting() {
    this.activeRecordId.set(null);
  }

  async saveCosting(id: string) {
    if (!this.commissionValid()) return;
    await this.customers.setCommission(id, this.commissionInput()!);
    this.closeCosting();
  }

}
