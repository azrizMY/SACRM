import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent, type IconName } from '../shared/icon.component';
import { DateRangePickerComponent } from '../shared/date-range-picker.component';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { CustomerService } from '../shared/customer.service';
import { VEHICLES, formatRM, modelVariantLabel } from '../data/calculator-data';
import { CUSTOMER_STATUS_META, dealProfit, freeGiftsLabel, totalCostSpent, type CostItem, type CustomerRecord, type FreeGiftItem } from '../data/customer-data';

type SortKey = 'name' | 'brand' | 'status' | 'commission' | 'totalCost' | 'netProfit';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Customer' },
  { key: 'brand', label: 'Car' },
  { key: 'status', label: 'Status' },
  { key: 'commission', label: 'Commission', align: 'right' },
  { key: 'totalCost', label: 'Total Cost', align: 'right' },
  { key: 'netProfit', label: 'Net Profit', align: 'right' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 30];

const COST_PRESETS: { label: string; amount: number }[] = [
  { label: 'Tinted', amount: 350 },
  { label: 'Dashcam', amount: 250 },
  { label: 'Carpet', amount: 150 },
  { label: 'Perfume', amount: 30 },
  { label: 'Phone Holder', amount: 40 },
  { label: 'Petrol', amount: 50 },
  { label: 'Coating', amount: 400 },
  { label: 'Loader', amount: 100 },
];

function sortValue(r: CustomerRecord, key: SortKey): string | number {
  switch (key) {
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

@Component({
  selector: 'app-cost-breakdown',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, DateRangePickerComponent, BrandMarkComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-semibold tracking-tight">Cost Breakdown</h2>
        <p class="text-pretty text-sm text-muted-foreground">
          In Progress and Delivered deals land here — key in commission, log every cost spent per customer, and see net profit update automatically.
        </p>
      </div>

      <!-- Summary tiles -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <app-icon name="wallet" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Deals</span>
            <span class="text-lg font-semibold tabular">{{ filteredSorted().length }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full"
            [ngClass]="totalGrossProfit() >= 0 ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--destructive)]/15 text-[var(--destructive)]'"
          >
            <app-icon name="arrow-up-right" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Gross Profit</span>
            <span class="text-lg font-semibold tabular" [ngClass]="totalGrossProfit() >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">
              {{ signed(totalGrossProfit()) }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full"
            [ngClass]="totalCostsSpent() >= 0 ? 'bg-[var(--destructive)]/15 text-[var(--destructive)]' : 'bg-[var(--success)]/15 text-[var(--success)]'"
          >
            <app-icon name="arrow-down-right" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Costs</span>
            <span class="text-lg font-semibold tabular" [ngClass]="totalCostsSpent() >= 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">
              {{ fmt(totalCostsSpent()) }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full"
            [ngClass]="totalProfit() >= 0 ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--destructive)]/15 text-[var(--destructive)]'"
          >
            <app-icon name="credit-card" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Net Profit</span>
            <span class="text-lg font-semibold tabular" [ngClass]="totalProfit() >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">
              {{ signed(totalProfit()) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Search</span>
            <div class="relative">
              <app-icon name="search" [size]="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Name or car…"
                [ngModel]="nameFilter()"
                (ngModelChange)="nameFilter.set($event)"
                class="h-9 w-full rounded-md border border-input bg-input pl-8 pr-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
              />
            </div>
          </div>
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
        <div class="overflow-x-auto">
          <table class="w-full caption-bottom text-sm">
            <thead>
              <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                @for (col of columns; track col.key) {
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
                <tr class="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40" (click)="toggleExpand(r.id)">
                  <td class="p-4 align-middle">
                    <div class="flex items-center gap-2">
                      <app-icon name="chevron-down" [size]="14" class="shrink-0 text-muted-foreground transition-transform" [ngClass]="expandedId() === r.id ? 'rotate-180' : ''" />
                      <div class="flex flex-col">
                        <span class="font-medium">{{ r.name }}</span>
                        <span class="text-xs text-muted-foreground">{{ r.phone }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <div class="flex items-center gap-2">
                      <app-brand-mark [brand]="r.brand" />
                      <div class="flex flex-col">
                        <span class="text-sm">{{ modelVariantLabel(r.model, r.variant) }}</span>
                        <span class="text-xs text-muted-foreground">{{ r.yearMade }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta(r.status).tone">
                      <span class="size-1.5 rounded-full" [ngClass]="statusMeta(r.status).dot"></span>
                      {{ statusMeta(r.status).label }}
                    </span>
                  </td>
                  <td class="p-4 text-right align-middle tabular">{{ r.commission != null ? fmt(r.commission) : '—' }}</td>
                  <td
                    class="p-4 text-right align-middle tabular"
                    [ngClass]="costOf(r) > 0 ? 'text-[var(--destructive)]' : costOf(r) < 0 ? 'text-[var(--success)]' : ''"
                  >
                    {{ costOf(r) !== 0 ? fmt(costOf(r)) : '—' }}
                  </td>
                  <td
                    class="p-4 text-right align-middle font-semibold tabular"
                    [ngClass]="profitOf(r) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'"
                  >
                    {{ signed(profitOf(r)) }}
                  </td>
                  <td class="p-4 text-right align-middle">
                    <div class="flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                      <button
                        type="button"
                        (click)="openCosting(r)"
                        class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <app-icon name="pencil" [size]="13" />
                        Commission
                      </button>
                      <button
                        type="button"
                        (click)="openCostModal(r)"
                        class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <app-icon name="plus" [size]="13" />
                        Add Cost
                      </button>
                    </div>
                  </td>
                </tr>
                @if (expandedId() === r.id) {
                  <tr class="border-b border-border bg-muted/20 last:border-0">
                    <td [attr.colspan]="columns.length + 1" class="p-4">
                      <div class="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cost Spent Breakdown</span>
                          <span class="text-xs font-semibold tabular" [ngClass]="costOf(r) >= 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">{{ fmtAbs(costOf(r)) }} total</span>
                        </div>
                        @if (r.costItems?.length) {
                          <ul class="flex flex-col gap-1.5">
                            @for (item of r.costItems; track item.id) {
                              <li class="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs">
                                <span class="flex-1 text-foreground">{{ item.label }}</span>
                                <span class="tabular font-medium" [ngClass]="item.amount >= 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">{{ fmtAbs(item.amount) }}</span>
                                <button
                                  type="button"
                                  (click)="removeCostItem(r, item.id)"
                                  aria-label="Remove cost item"
                                  class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]"
                                >
                                  <app-icon name="x" [size]="12" />
                                </button>
                              </li>
                            }
                          </ul>
                        } @else {
                          <p class="text-xs text-muted-foreground">No cost logged yet — use "Add Cost" to record spend for this customer.</p>
                        }
                        <div class="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
                          <span class="text-muted-foreground">Commission <strong class="tabular text-foreground">{{ r.commission != null ? fmt(r.commission) : '—' }}</strong></span>
                          <span class="text-muted-foreground">Total Cost <strong class="tabular text-foreground">{{ fmt(costOf(r)) }}</strong></span>
                          <span class="text-muted-foreground">
                            Net Profit
                            <strong class="tabular" [ngClass]="profitOf(r) >= 0 ? 'text-[var(--success)]' : 'text-[var(--destructive)]'">{{ signed(profitOf(r)) }}</strong>
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td [attr.colspan]="columns.length + 1" class="p-8 text-center text-sm text-muted-foreground">
                    No deals match. In Progress and Delivered customers from Customer Manager will appear here automatically.
                  </td>
                </tr>
              }
            </tbody>
          </table>
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
      <!-- Free Gifts Checklist — the single source of truth Customer Manager links back to -->
      <div class="flex flex-col gap-1 border-t border-border p-4">
        <span class="text-sm font-semibold">Free Gifts Checklist</span>
        <p class="text-xs text-muted-foreground">Deals from In Progress onward. Customer Manager shows a read-only count and links here.</p>
      </div>
      <div class="overflow-x-auto border-t border-border">
        <table class="w-full caption-bottom text-sm">
          <thead>
            <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th class="h-10 whitespace-nowrap px-4 align-middle">Customer</th>
              <th class="h-10 whitespace-nowrap px-4 align-middle">Car</th>
              <th class="h-10 whitespace-nowrap px-4 align-middle">Status</th>
              <th class="h-10 whitespace-nowrap px-4 align-middle">Gifts</th>
              <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            @for (r of giftEligible(); track r.id) {
              <tr class="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40">
                <td class="p-4 align-middle">{{ r.name }}</td>
                <td class="p-4 align-middle text-sm text-muted-foreground">
                  <div class="flex items-center gap-2">
                    <app-brand-mark [brand]="r.brand" class="size-6" />
                    {{ modelVariantLabel(r.model, r.variant) }}
                  </div>
                </td>
                <td class="p-4 align-middle text-sm text-muted-foreground">{{ r.status }}</td>
                <td class="p-4 align-middle text-sm">{{ giftsLabel(r) }}</td>
                <td class="p-4 text-right align-middle">
                  <button
                    type="button"
                    (click)="openGifts(r)"
                    class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="gift" [size]="13" />
                    Manage
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="p-8 text-center text-sm text-muted-foreground">No deals in progress or delivered yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Manage Free Gifts modal -->
    @if (giftsTarget(); as grec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeGifts()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Free Gifts &middot; {{ grec.name }}</span>
            <button type="button" (click)="closeGifts()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            @if (giftsDraft().length) {
              <ul class="flex flex-col gap-1.5">
                @for (item of giftsDraft(); track item.id) {
                  <li class="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <input type="checkbox" [checked]="item.done" (change)="toggleGift(item.id)" class="size-4 accent-primary" />
                    <span class="flex-1 text-sm" [ngClass]="item.done ? 'text-muted-foreground line-through' : 'text-foreground'">{{ item.name }}</span>
                    <button type="button" (click)="removeGift(item.id)" aria-label="Remove item" class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]">
                      <app-icon name="x" [size]="13" />
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-xs text-muted-foreground">No gift items yet — add one below.</p>
            }
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Floor mats"
                [ngModel]="newGiftName()"
                (ngModelChange)="newGiftName.set($event)"
                (keydown.enter)="addGift()"
                class="h-9 flex-1 rounded-md border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
              <button type="button" (click)="addGift()" [disabled]="!newGiftName().trim()" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50">Add</button>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeGifts()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="saveGifts(grec.id)" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Save</button>
          </div>
        </div>
      </div>
    }

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
            <button
              type="button"
              (click)="saveCosting(rec.id)"
              [disabled]="!commissionValid()"
              class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Add Cost Spent modal -->
    @if (costTarget(); as crec) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeCostModal()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Cost Spent &middot; {{ crec.name }}</span>
            <button type="button" (click)="closeCostModal()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            @if (crec.costItems?.length) {
              <ul class="flex flex-col gap-1.5">
                @for (item of crec.costItems; track item.id) {
                  <li class="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <span class="flex-1 text-sm text-foreground">{{ item.label }}</span>
                    <span class="text-sm font-medium tabular" [ngClass]="item.amount >= 0 ? 'text-[var(--destructive)]' : 'text-[var(--success)]'">{{ fmt(item.amount) }}</span>
                    <button type="button" (click)="removeCostItem(crec, item.id)" aria-label="Remove item" class="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]">
                      <app-icon name="x" [size]="13" />
                    </button>
                  </li>
                }
              </ul>
              <div class="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>Total Cost</span>
                <strong class="tabular text-foreground">{{ fmt(costOf(crec)) }}</strong>
              </div>
            } @else {
              <p class="text-xs text-muted-foreground">No cost logged yet — add what was spent below.</p>
            }
            <div class="flex flex-col gap-2 border-t border-border pt-3">
              <div class="flex flex-wrap gap-1.5">
                @for (p of costPresets; track p.label) {
                  <button
                    type="button"
                    (click)="applyCostPreset(p)"
                    class="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {{ p.label }} &middot; {{ fmt(p.amount) }}
                  </button>
                }
              </div>
              <input
                type="text"
                placeholder="What was it spent on? e.g. Detailing"
                [ngModel]="newCostLabel()"
                (ngModelChange)="newCostLabel.set($event)"
                class="h-9 w-full rounded-md border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
              <div class="flex gap-2">
                <input
                  type="number"
                  step="10"
                  placeholder="Amount (RM) — use - for a credit"
                  [ngModel]="newCostAmount()"
                  (ngModelChange)="newCostAmount.set($event)"
                  (focus)="onAmountFocus()"
                  (blur)="onAmountBlur()"
                  (keydown.enter)="addCostItem(crec)"
                  class="h-9 flex-1 rounded-md border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                />
                <button type="button" (click)="addCostItem(crec)" [disabled]="!costEntryValid()" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50">Add</button>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeCostModal()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Done</button>
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

  fmt = (v: number) => formatRM(v);
  fmtAbs = (v: number) => formatRM(Math.abs(v));
  profitOf = dealProfit;
  costOf = totalCostSpent;
  statusMeta = (s: CustomerRecord['status']) => CUSTOMER_STATUS_META[s];
  signed = (v: number) => `${v >= 0 ? '+' : '−'}${formatRM(Math.abs(v))}`;

  nameFilter = signal('');
  carFilter = signal('All');
  dateFromFilter = signal('');
  dateToFilter = signal('');
  sortKey = signal<SortKey>('name');
  sortDir = signal<SortDir>('asc');

  pageSize = signal(10);
  page = signal(0);

  activeRecordId = signal<string | null>(null);
  commissionInput = signal<number | null>(null);

  giftsTargetId = signal<string | null>(null);
  giftsDraft = signal<FreeGiftItem[]>([]);
  newGiftName = signal('');

  expandedId = signal<string | null>(null);

  costPresets = COST_PRESETS;
  costTargetId = signal<string | null>(null);
  newCostLabel = signal('');
  newCostAmount = signal<number | null>(null);
  presetDefaultAmount = signal<number | null>(null);

  constructor(public customers: CustomerService) {}

  activeRecord = computed(() => this.customers.records().find((r) => r.id === this.activeRecordId()) ?? null);

  /** Cost Breakdown covers deals from In Progress onward — Lead/Booked/Cancelled never show up here. */
  eligibleRecords = computed(() => this.customers.records().filter((r) => r.status === 'In Progress' || r.status === 'Delivered'));
  giftEligible = this.eligibleRecords;
  giftsLabel = freeGiftsLabel;
  giftsTarget = computed(() => this.customers.records().find((r) => r.id === this.giftsTargetId()) ?? null);
  costTarget = computed(() => this.customers.records().find((r) => r.id === this.costTargetId()) ?? null);

  toggleExpand(id: string) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  openGifts(record: CustomerRecord) {
    this.giftsTargetId.set(record.id);
    this.giftsDraft.set([...(record.freeGifts ?? [])]);
    this.newGiftName.set('');
  }

  closeGifts() {
    this.giftsTargetId.set(null);
  }

  addGift() {
    const name = this.newGiftName().trim();
    if (!name) return;
    this.giftsDraft.update((items) => [...items, { id: crypto.randomUUID(), name, done: false }]);
    this.newGiftName.set('');
  }

  toggleGift(id: string) {
    this.giftsDraft.update((items) => items.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  }

  removeGift(id: string) {
    this.giftsDraft.update((items) => items.filter((g) => g.id !== id));
  }

  async saveGifts(id: string) {
    await this.customers.updateFreeGifts(id, this.giftsDraft());
    this.closeGifts();
  }

  totalGrossProfit = computed(() => this.eligibleRecords().reduce((sum, r) => sum + (r.commission ?? 0), 0));
  totalCostsSpent = computed(() => this.eligibleRecords().reduce((sum, r) => sum + totalCostSpent(r), 0));
  totalProfit = computed(() => this.eligibleRecords().reduce((sum, r) => sum + dealProfit(r), 0));

  filteredSorted = computed(() => {
    let list = this.eligibleRecords();
    const search = this.nameFilter().trim().toLowerCase();
    if (search) {
      list = list.filter((r) => `${r.name} ${r.brand} ${r.model} ${r.variant}`.toLowerCase().includes(search));
    }
    if (this.carFilter() !== 'All') list = list.filter((r) => r.brand === this.carFilter());
    if (this.dateFromFilter()) list = list.filter((r) => (r.deliveryDate ?? r.date) >= this.dateFromFilter());
    if (this.dateToFilter()) list = list.filter((r) => (r.deliveryDate ?? r.date) <= this.dateToFilter());

    const key = this.sortKey();
    const dir = this.sortDir();
    return [...list].sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
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
      !!this.dateFromFilter() ||
      !!this.dateToFilter()
    );
  }

  clearFilters() {
    this.nameFilter.set('');
    this.carFilter.set('All');
    this.dateFromFilter.set('');
    this.dateToFilter.set('');
    this.page.set(0);
  }

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
    await this.customers.updateCosting(id, { commission: this.commissionInput()! });
    this.closeCosting();
  }

  openCostModal(record: CustomerRecord) {
    this.costTargetId.set(record.id);
    this.newCostLabel.set('');
    this.newCostAmount.set(null);
    this.presetDefaultAmount.set(null);
  }

  closeCostModal() {
    this.costTargetId.set(null);
  }

  applyCostPreset(preset: { label: string; amount: number }) {
    this.newCostLabel.set(preset.label);
    this.newCostAmount.set(preset.amount);
    this.presetDefaultAmount.set(preset.amount);
  }

  /** Clicking into a still-untouched preset amount clears it so typing replaces it outright. */
  onAmountFocus() {
    if (this.presetDefaultAmount() !== null && this.newCostAmount() === this.presetDefaultAmount()) {
      this.newCostAmount.set(null);
    }
  }

  /** Leaving the amount empty after a preset was picked falls back to that preset's default. */
  onAmountBlur() {
    if (this.newCostAmount() === null && this.presetDefaultAmount() !== null) {
      this.newCostAmount.set(this.presetDefaultAmount());
    }
  }

  costEntryValid(): boolean {
    const amount = this.newCostAmount();
    return !!this.newCostLabel().trim() && amount !== null && amount !== 0;
  }

  async addCostItem(record: CustomerRecord) {
    if (!this.costEntryValid()) return;
    const item: CostItem = { id: crypto.randomUUID(), label: this.newCostLabel().trim(), amount: this.newCostAmount()! };
    await this.customers.updateCostItems(record.id, [...(record.costItems ?? []), item]);
    this.newCostLabel.set('');
    this.newCostAmount.set(null);
    this.presetDefaultAmount.set(null);
  }

  async removeCostItem(record: CustomerRecord, itemId: string) {
    await this.customers.updateCostItems(record.id, (record.costItems ?? []).filter((c) => c.id !== itemId));
  }
}
