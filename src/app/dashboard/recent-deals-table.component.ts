import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerService } from '../shared/customer.service';
import { dealProfit, type CustomerRecord } from '../data/customer-data';
import { formatRM } from '../data/calculator-data';
import { BrandMarkComponent } from '../shared/brand-mark.component';
import { IconComponent, IconName } from '../shared/icon.component';

type Row = { id: string; customer: string; phone: string; model: string; brand: string; profit: number; date: string };

type SortKey = 'customer' | 'brand' | 'profit' | 'date';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 5;

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'customer', label: 'Customer' },
  { key: 'brand', label: 'Model / Brand' },
  { key: 'profit', label: 'Profit', align: 'right' },
  { key: 'date', label: 'Date', align: 'right' },
];

function toRow(r: CustomerRecord): Row {
  return {
    id: r.id,
    customer: r.name,
    phone: r.phone,
    model: r.model,
    brand: r.brand,
    profit: dealProfit(r),
    date: r.deliveryDate ?? r.date,
  };
}

@Component({
  selector: 'app-recent-deals-table',
  standalone: true,
  imports: [CommonModule, RouterLink, BrandMarkComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm">
      <div class="flex flex-col gap-1 px-6">
        <h3 class="font-semibold leading-none">Recent deals</h3>
        <p class="text-sm text-muted-foreground">Delivered deals and the profit each one earned</p>
      </div>

      <div>
        <div class="overflow-x-auto">
          <table class="w-full caption-bottom text-sm">
            <thead>
              <tr class="border-b border-border">
                @for (col of columns; track col.key) {
                  <th class="h-10 whitespace-nowrap px-4 align-middle" [ngClass]="col.align === 'right' ? 'text-right' : 'text-left'">
                    <button
                      type="button"
                      (click)="toggleSort(col.key)"
                      class="inline-flex items-center gap-1 py-2 text-xs font-medium transition-colors hover:text-foreground"
                      [ngClass]="[
                        col.align === 'right' ? 'flex-row-reverse' : '',
                        sortKey() === col.key ? 'text-foreground' : 'text-muted-foreground'
                      ]"
                    >
                      {{ col.label }}
                      <app-icon [name]="iconFor(col.key)" [size]="14" class="opacity-70" />
                    </button>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (deal of rows(); track deal.id) {
                <tr class="border-b border-border transition-colors hover:bg-muted/50">
                  <td class="p-4 align-middle">
                    <div class="flex flex-col">
                      <span class="font-medium">{{ deal.customer }}</span>
                      <a
                        [routerLink]="['/leads']"
                        [queryParams]="{ customer: deal.id }"
                        class="font-mono text-xs text-primary tabular hover:underline"
                      >{{ deal.phone }}</a>
                    </div>
                  </td>
                  <td class="p-4 align-middle">
                    <div class="flex items-center gap-2.5">
                      <app-brand-mark [brand]="deal.brand" />
                      <div class="flex flex-col">
                        <span class="text-sm">{{ deal.model }}</span>
                        <span class="text-xs text-muted-foreground">{{ deal.brand }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="p-4 text-right align-middle font-mono font-medium tabular text-[var(--success)]">
                    {{ deal.profit >= 0 ? '+' : '' }}{{ fmt(deal.profit) }}
                  </td>
                  <td class="p-4 text-right align-middle font-mono text-sm text-muted-foreground tabular">{{ fullDate(deal.date) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="p-8 text-center text-sm text-muted-foreground">
                    No delivered deals yet — they'll show up here once Customer Manager marks one as Delivered.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > 0) {
          <div class="flex items-center justify-between px-6 pt-4">
            <p class="text-xs text-muted-foreground tabular">
              Showing {{ page() * pageSize + 1 }}–{{ end() }} of {{ total() }}
            </p>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="inline-flex size-10 items-center justify-center rounded-md border border-input bg-transparent transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                (click)="prev()" [disabled]="page() === 0" aria-label="Previous page"
              >
                <app-icon name="chevron-left" [size]="16" />
              </button>
              <span class="px-2 text-xs text-muted-foreground tabular">{{ page() + 1 }} / {{ pageCount() }}</span>
              <button
                type="button"
                class="inline-flex size-10 items-center justify-center rounded-md border border-input bg-transparent transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                (click)="next()" [disabled]="page() >= pageCount() - 1" aria-label="Next page"
              >
                <app-icon name="chevron-right" [size]="16" />
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class RecentDealsTableComponent {
  columns = COLUMNS;
  pageSize = PAGE_SIZE;

  sortKey = signal<SortKey>('date');
  sortDir = signal<SortDir>('desc');
  page = signal(0);

  fmt = (v: number) => formatRM(v);

  constructor(private customers: CustomerService) {}

  allRows = computed(() => this.customers.delivered().map(toRow));
  total = computed(() => this.allRows().length);

  sorted = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    const copy = [...this.allRows()];
    copy.sort((a, b) => {
      let av: string | number = a[key];
      let bv: string | number = b[key];
      if (key === 'brand') {
        av = a.model;
        bv = b.model;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return dir === 'asc' ? av - bv : bv - av;
      }
      return dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  });

  pageCount = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize)));
  rows = computed(() =>
    this.sorted().slice(this.page() * this.pageSize, this.page() * this.pageSize + this.pageSize),
  );
  end = computed(() => Math.min((this.page() + 1) * this.pageSize, this.sorted().length));

  toggleSort(key: SortKey): void {
    if (key === this.sortKey()) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'customer' || key === 'brand' ? 'asc' : 'desc');
    }
    this.page.set(0);
  }

  iconFor(key: SortKey): IconName {
    if (this.sortKey() !== key) return 'chevrons-up-down';
    return this.sortDir() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  prev(): void {
    this.page.set(Math.max(0, this.page() - 1));
  }
  next(): void {
    this.page.set(Math.min(this.pageCount() - 1, this.page() + 1));
  }

  fullDate(date: string): string {
    return new Date(date).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
