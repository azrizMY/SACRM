import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { toLocalDateStr } from './date-utils';

type DayCell = { date: Date; iso: string; inMonth: boolean; isToday: boolean };

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Airbnb-style single calendar: click a start date, then an end date — the range in between highlights live as you hover. */
@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="toggle()"
        class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-input px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring"
      >
        <app-icon name="calendar" [size]="14" class="shrink-0 text-muted-foreground" />
        <span class="truncate" [ngClass]="!from && !to ? 'text-muted-foreground' : ''">{{ label() }}</span>
      </button>

      @if (open()) {
        <button type="button" aria-label="Close date picker" class="fixed inset-0 z-40 cursor-default" (click)="close()"></button>
        <div
          class="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[300px] sm:translate-y-0"
        >
          <div class="flex items-center justify-between pb-2">
            <button
              type="button"
              (click)="shiftMonth(-1)"
              aria-label="Previous month"
              class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="chevron-left" [size]="15" />
            </button>
            <span class="text-xs font-semibold">{{ monthLabel() }}</span>
            <button
              type="button"
              (click)="shiftMonth(1)"
              aria-label="Next month"
              class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <app-icon name="chevron-right" [size]="15" />
            </button>
          </div>

          <div class="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
            @for (d of weekdays; track d) { <span class="py-1">{{ d }}</span> }
          </div>

          <div class="grid grid-cols-7 gap-y-1 pt-1 text-center text-xs" (mouseleave)="hover.set(null)">
            @for (cell of days(); track cell.iso) {
              <button
                type="button"
                (click)="pick(cell.iso)"
                (mouseenter)="hover.set(cell.iso)"
                class="mx-auto flex size-8 items-center justify-center rounded-full transition-colors"
                [ngClass]="cellClass(cell)"
              >
                {{ cell.date.getDate() }}
              </button>
            }
          </div>

          <div class="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button type="button" (click)="clear()" class="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              Clear
            </button>
            <button type="button" (click)="close()" class="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Done
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class DateRangePickerComponent {
  @Input() from = '';
  @Input() to = '';
  @Output() fromChange = new EventEmitter<string>();
  @Output() toChange = new EventEmitter<string>();

  weekdays = WEEKDAYS;
  open = signal(false);
  viewMonth = signal(this.startOfMonth(new Date()));
  hover = signal<string | null>(null);

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  toggle() {
    if (!this.open()) {
      const base = this.from ? new Date(this.from) : new Date();
      this.viewMonth.set(this.startOfMonth(base));
    }
    this.open.set(!this.open());
  }

  close() {
    this.open.set(false);
  }

  shiftMonth(delta: number) {
    const m = this.viewMonth();
    this.viewMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  // Plain methods, not computed(): from/to arrive via @Input() as mutated plain fields
  // rather than signals, so computed() would never see them change after first read.
  monthLabel(): string {
    return this.viewMonth().toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
  }

  label(): string {
    if (this.from && this.to) return `${this.from} → ${this.to}`;
    if (this.from) return `${this.from} → …`;
    return 'Select dates';
  }

  days(): DayCell[] {
    const month = this.viewMonth();
    const year = month.getFullYear();
    const mi = month.getMonth();
    const firstWeekday = new Date(year, mi, 1).getDay();
    const start = new Date(year, mi, 1 - firstWeekday);
    const todayIso = toLocalDateStr(new Date());
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toLocalDateStr(d);
      cells.push({ date: d, iso, inMonth: d.getMonth() === mi, isToday: iso === todayIso });
    }
    return cells;
  }

  pick(iso: string) {
    if (!this.from || this.to) {
      // Starting a fresh selection (nothing picked yet, or a prior range was already complete).
      this.fromChange.emit(iso);
      this.toChange.emit('');
      return;
    }
    // from is set, to is not — this click is the end date.
    if (iso < this.from) {
      this.fromChange.emit(iso);
      this.toChange.emit('');
    } else {
      this.toChange.emit(iso);
      this.close();
    }
  }

  cellClass(cell: DayCell): string {
    const classes: string[] = [cell.inMonth ? 'text-foreground' : 'text-muted-foreground/40'];

    const rangeEnd = this.to || this.hover();
    const inRange = !!this.from && !!rangeEnd && cell.iso >= this.min(this.from, rangeEnd) && cell.iso <= this.max(this.from, rangeEnd);

    if (cell.iso === this.from || cell.iso === this.to) {
      classes.push('bg-primary text-primary-foreground font-semibold');
    } else if (inRange) {
      classes.push('bg-primary/15');
    } else {
      classes.push('hover:bg-accent');
    }

    if (cell.isToday && cell.iso !== this.from && cell.iso !== this.to) classes.push('ring-1 ring-inset ring-border');

    return classes.join(' ');
  }

  clear() {
    this.fromChange.emit('');
    this.toChange.emit('');
    this.hover.set(null);
  }

  private min(a: string, b: string): string {
    return a < b ? a : b;
  }
  private max(a: string, b: string): string {
    return a > b ? a : b;
  }
}
