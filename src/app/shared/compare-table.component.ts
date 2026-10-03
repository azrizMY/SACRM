import { Component, ElementRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';
import { CarShadowPipe } from './car-shadow';
import { MAX_COMPARE } from './compare.service';
import { downpaymentDisplay, modelVariantLabel, type Vehicle } from '../data/calculator-data';
import type { CompareQuote, CompareSetup } from '../data/compare-data';

export type CompareColumn = {
  index: number;
  vehicle: Vehicle;
  year: number;
  years: number[];
  fromQuote: boolean;
  quote: CompareQuote;
  /** This model year's additional rebate, and whether it's ticked — the SA's page only. */
  additionalRebate?: number;
  includeAdditionalRebate?: boolean;
};
export type CompareCarGroup = { brand: string; vehicles: Vehicle[] };

type FigureRow = { label: string; labelFor?: (q: CompareQuote) => string; caption?: (setup: CompareSetup, q: CompareQuote) => string; value: (q: CompareQuote) => string; strong?: boolean };

const rm = (v: number) => `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rmWhole = (v: number) => `RM ${Math.round(v).toLocaleString('en-MY')}`;

/**
 * The side-by-side car comparison, laid out like Apple's compare pages: a dropdown heading each of
 * the 3 columns (pinned while scrolling), a big photo and name, then headed sections where every
 * value sits in its car's column with a small caption under it. Shared by the SA's Compare page
 * and the customer link so both always look and behave the same — the page around it owns the
 * cars, the loan setup and any page-specific buttons.
 */
@Component({
  selector: 'app-compare-table',
  standalone: true,
  imports: [NgClass, FormsModule, IconComponent, TranslatePipe, CarShadowPipe],
  template: `
    <!-- Car dropdowns — pinned while scrolling -->
    <div class="sticky z-20 bg-background py-3" [ngClass]="stickyClass">
      <div class="grid grid-cols-3 gap-2 sm:gap-6">
        @for (i of slotIndexes; track i) {
          <div class="relative">
            <select
              [ngModel]="columnAt(i)?.vehicle?.id ?? null"
              (ngModelChange)="chooseCar.emit({ column: i, vehicleId: $event })"
              [attr.aria-label]="('Car' | t) + ' ' + (i + 1)"
              class="h-10 w-full appearance-none truncate rounded-xl border border-border bg-card pl-3 pr-7 text-xs font-semibold text-foreground outline-none transition-colors focus:border-ring sm:pl-4 sm:text-sm"
            >
              <option [ngValue]="null">{{ (columnAt(i) ? 'None' : 'Choose a car') | t }}</option>
              @for (g of carGroups; track g.brand) {
                <optgroup [label]="g.brand">
                  @for (v of g.vehicles; track v.id) {
                    <option [ngValue]="v.id" [disabled]="isPickedElsewhere(v.id, i)">{{ modelVariantLabel(v.model, v.variant) }}</option>
                  }
                </optgroup>
              }
            </select>
            <app-icon name="chevron-down" [size]="14" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        }
      </div>
    </div>

    <!-- Car heroes -->
    <div class="grid grid-cols-3 gap-2 pt-4 sm:gap-6">
      @for (i of slotIndexes; track i) {
        @if (columnAt(i); as c) {
          <div class="relative flex flex-col items-center gap-1 text-center">
            <div class="flex h-5 w-full items-center justify-between">
              @if (c.fromQuote) {
                <span class="whitespace-nowrap rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{{ quoteBadge | t }}</span>
              } @else {
                <span></span>
              }
              <button type="button" (click)="remove.emit(c.index)" [attr.aria-label]="'Remove' | t" class="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <app-icon name="x" [size]="13" />
              </button>
            </div>
            <div class="flex h-20 w-full items-end justify-center sm:h-36">
              @if (c.vehicle.photoUrl) {
                <img [src]="c.vehicle.photoUrl | carShadow" alt="" class="max-h-20 w-auto object-contain sm:max-h-36" />
              } @else {
                <app-icon name="car" [size]="40" class="text-muted-foreground" />
              }
            </div>
            <span class="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">{{ c.vehicle.brand }}</span>
            <span class="text-balance text-sm font-semibold leading-tight sm:text-2xl">{{ modelVariantLabel(c.vehicle.model, c.vehicle.variant) }}</span>
            @if (c.years.length > 1) {
              <div class="relative mt-1">
                <select
                  [ngModel]="c.year"
                  (ngModelChange)="setYear.emit({ index: c.index, year: +$event })"
                  [attr.aria-label]="'Model Year' | t"
                  class="h-7 appearance-none rounded-full bg-muted/50 pl-3 pr-7 text-xs text-foreground outline-none"
                >
                  @for (y of c.years; track y) {
                    <option [ngValue]="y">{{ y }}</option>
                  }
                </select>
                <app-icon name="chevron-down" [size]="12" class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            } @else {
              <span class="text-xs text-muted-foreground">{{ c.year }}</span>
            }
            <span class="mt-1 text-xs text-muted-foreground sm:text-sm">{{ 'From' | t }} {{ rmWhole(c.quote.price) }}</span>
            @if (showAdditionalRebate && (c.additionalRebate ?? 0) > 0) {
              <label class="mt-1.5 flex cursor-pointer items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[10px] font-medium sm:text-xs" [class.text-muted-foreground]="!c.includeAdditionalRebate">
                <input
                  type="checkbox"
                  [checked]="!!c.includeAdditionalRebate"
                  (change)="toggleAdditionalRebate.emit({ index: c.index, on: !c.includeAdditionalRebate })"
                  class="size-3.5 shrink-0 accent-[var(--primary)]"
                />
                {{ 'Additional rebate' | t }} {{ rmWhole(c.additionalRebate!) }}
              </label>
            }
          </div>
        } @else {
          <button
            type="button"
            (click)="openDropdown(i)"
            class="mt-5 flex h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary sm:h-52 sm:text-sm"
          >
            <app-icon name="plus" [size]="20" />
            {{ 'Choose a car' | t }}
          </button>
        }
      }
    </div>

    @if (columns.length > 0) {
      <!-- Figures, in headed sections -->
      @for (section of sections; track section.title) {
        <section class="mt-10 border-t border-border pt-6 sm:mt-14 sm:pt-8">
          <h2 class="mb-2 text-xl font-semibold tracking-tight sm:text-3xl">{{ section.title | t }}</h2>
          @for (row of section.rows; track row.label) {
            <div class="grid grid-cols-3 gap-2 py-3 sm:gap-6 sm:py-4">
              @for (i of slotIndexes; track i) {
                <div class="flex flex-col items-center gap-0.5 text-center">
                  @if (columnAt(i); as c) {
                    <span class="text-[13px] tabular sm:text-xl" [ngClass]="row.strong ? 'font-semibold' : 'font-medium'">{{ row.value(c.quote) | t }}</span>
                    <span class="text-[10px] leading-tight text-muted-foreground sm:text-xs">{{ (row.labelFor ? row.labelFor(c.quote) : row.label) | t }}{{ row.caption ? ' · ' + (row.caption(setup, c.quote) | t) : '' }}</span>
                  }
                </div>
              }
            </div>
          }
        </section>
      }

      <!-- Monthly -->
      <section class="mt-10 border-t border-border pt-6 sm:mt-14 sm:pt-8">
        <h2 class="text-xl font-semibold tracking-tight sm:text-3xl">{{ 'Monthly instalment' | t }}</h2>
        <p class="mt-1 text-xs text-muted-foreground sm:text-sm">{{ setup.tenureMonths / 12 }} {{ 'years' | t }} · {{ (setup.rateType === 'flat' ? 'Flat rate' : 'EIR') | t }}</p>
        <div class="mt-5 grid grid-cols-3 gap-2 sm:gap-6">
          @for (i of slotIndexes; track i) {
            <div class="flex flex-col items-center gap-1.5 text-center">
              @if (columnAt(i); as c) {
                <div class="flex w-full flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-4 sm:py-6" [ngClass]="isLowest(c) ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-card'">
                  <span class="text-[17px] font-semibold tabular sm:text-4xl" [ngClass]="isLowest(c) ? 'text-primary' : ''">{{ monthlyLabel(c.quote) | t }}</span>
                  @if (c.quote.monthly !== null && c.quote.monthly > 0) {
                    <span class="text-[10px] text-muted-foreground sm:text-xs">{{ 'per month' | t }}</span>
                  }
                  @if (isLowest(c)) {
                    <span class="mt-1 flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--success)] sm:text-xs">
                      <app-icon name="check" [size]="11" />{{ 'Lowest' | t }}
                    </span>
                  } @else if (diffFromLowest(c)) {
                    <span class="mt-1 text-[10px] text-muted-foreground sm:text-xs">+{{ diffFromLowest(c) }}/{{ 'mo' | t }}</span>
                  }
                </div>
                @if (actionLabel) {
                  <button type="button" (click)="action.emit(c)" class="mt-1 flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline sm:text-sm">
                    {{ actionLabel | t }}
                    <app-icon name="chevron-right" [size]="13" />
                  </button>
                }
              }
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class CompareTableComponent {
  private host = inject(ElementRef<HTMLElement>);

  private columnsSignal = signal<CompareColumn[]>([]);
  @Input({ required: true }) set columns(value: CompareColumn[]) {
    this.columnsSignal.set(value);
  }
  get columns(): CompareColumn[] {
    return this.columnsSignal();
  }
  @Input({ required: true }) carGroups: CompareCarGroup[] = [];
  @Input({ required: true }) setup!: CompareSetup;
  /** Under each monthly figure, e.g. "Open in Calculator"; omit for no button. */
  @Input() actionLabel = '';
  /** Label on the column that came from the quote being looked at. */
  @Input() quoteBadge = 'Your quote';
  /** Offer a per-car "Additional rebate" tick (the SA's page; the customer link never shows it). */
  @Input() showAdditionalRebate = false;
  /** Where the pinned dropdown row sticks and how far it bleeds — depends on the page's padding. */
  @Input() stickyClass = 'top-0';

  @Output() chooseCar = new EventEmitter<{ column: number; vehicleId: string | null }>();
  @Output() remove = new EventEmitter<number>();
  @Output() setYear = new EventEmitter<{ index: number; year: number }>();
  @Output() action = new EventEmitter<CompareColumn>();
  @Output() toggleAdditionalRebate = new EventEmitter<{ index: number; on: boolean }>();

  readonly slotIndexes = Array.from({ length: MAX_COMPARE }, (_, i) => i);
  readonly modelVariantLabel = modelVariantLabel;
  readonly rmWhole = rmWhole;

  readonly sections: { title: string; rows: FigureRow[] }[] = [
    {
      title: 'Price',
      rows: [
        { label: 'OTR Price', value: (q) => rm(q.price) },
        { label: 'Rebate', value: (q) => (q.rebate > 0 ? `− ${rm(q.rebate)}` : '—') },
        { label: 'Insurance', caption: (s) => `${s.ncd}% NCD`, value: (q) => rm(q.insurance) },
        { label: 'Total Amount Due', value: (q) => rm(q.totalDue), strong: true },
      ],
    },
    {
      title: 'Loan',
      rows: [
        // A negative downpayment (loan rounded up past the amount due) reads as Cash Back.
        { label: 'Downpayment', labelFor: (q) => downpaymentDisplay(q.downpayment).label, value: (q) => rm(downpaymentDisplay(q.downpayment).amount) },
        { label: 'Loan Amount', value: (q) => rm(q.loan), strong: true },
        {
          label: 'Interest Rate',
          caption: (_s, q) => (q.rateType === 'flat' ? 'Flat' : 'EIR'),
          value: (q) => (q.rate === null ? 'Rate needed' : `${q.rate}%`),
        },
      ],
    },
  ];

  columnAt(i: number): CompareColumn | undefined {
    return this.columns[i];
  }

  isPickedElsewhere(vehicleId: string, column: number): boolean {
    return this.columns.some((c, i) => c.vehicle.id === vehicleId && i !== column);
  }

  private lowestMonthly = computed(() => {
    const m = this.columnsSignal()
      .map((c) => c.quote.monthly)
      .filter((v): v is number => v !== null);
    return m.length > 1 ? Math.min(...m) : null;
  });

  isLowest(c: CompareColumn): boolean {
    return this.lowestMonthly() !== null && c.quote.monthly === this.lowestMonthly();
  }

  diffFromLowest(c: CompareColumn): string | null {
    const low = this.lowestMonthly();
    if (low === null || c.quote.monthly === null || c.quote.monthly <= low) return null;
    return rmWhole(c.quote.monthly - low);
  }

  monthlyLabel(q: CompareQuote): string {
    if (q.monthly === null) return 'Rate needed';
    if (q.monthly === 0) return 'Cash';
    return rm(q.monthly);
  }

  /** The dashed "Choose a car" placeholder opens that column's dropdown. */
  openDropdown(column: number) {
    const el = this.host.nativeElement.querySelectorAll('.sticky select')[column] as (HTMLSelectElement & { showPicker?: () => void }) | undefined;
    el?.focus();
    el?.showPicker?.();
  }
}
