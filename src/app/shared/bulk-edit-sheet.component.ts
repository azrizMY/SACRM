import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

export type BulkValues = Record<string, number | null>;

export type BulkColumn = {
  key: string;
  label: string;
  /** 'edit' = a number input; 'readonly' = shown for reference; 'derived' = worked out live from the row. */
  kind: 'edit' | 'readonly' | 'derived';
  /** Shown as RM with thousands separators (no decimals). */
  money?: boolean;
  derive?: (values: BulkValues) => number | null;
};

export type BulkRow = {
  id: string;
  /** Rows are grouped under this heading (e.g. the model). */
  group: string;
  label: string;
  /** Small text after the label (e.g. the model year). */
  sub?: string;
  /** Saved values. */
  values: BulkValues;
  /** Proposed values to start from (price list import); absent = the saved values. */
  proposed?: BulkValues;
};

export type BulkSave = { id: string; values: BulkValues }[];

/**
 * A full-screen sheet for editing one number column or two across many rows — Price Settings'
 * "Edit rebates" for a brand, and the price list import's review step. Changed cells are
 * highlighted with the old value underneath; Tab/Enter move down a column so a month's update can be
 * typed top to bottom; one Save sends every changed row. On a phone each row becomes a small card.
 */
@Component({
  selector: 'app-bulk-edit-sheet',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="fixed inset-0 z-[60] flex flex-col bg-background text-foreground" role="dialog" [attr.aria-label]="title">
      <!-- Header -->
      <div class="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-base font-bold">{{ title }}</span>
          @if (subtitle) {
            <span class="truncate text-xs text-muted-foreground">{{ subtitle }}</span>
          }
        </div>
        <button type="button" (click)="requestClose()" aria-label="Close" class="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <app-icon name="x" [size]="18" />
        </button>
      </div>

      <!-- Rows -->
      <div class="flex-1 overflow-y-auto">
        <div class="mx-auto flex max-w-5xl flex-col gap-5 p-4 md:p-6">
          @if (note) {
            <p class="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{{ note }}</p>
          }
          <!-- Column headings (table layout) -->
          <div class="sticky -top-4 z-10 hidden gap-3 bg-background py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:-top-6 md:grid" [style.grid-template-columns]="gridColumns()">
            @if (selectable) {
              <span></span>
            }
            <span>Model · Variant</span>
            @for (c of columns; track c.key) {
              <span class="text-right">{{ c.label }}</span>
            }
          </div>

          @for (g of groups(); track g.group) {
            <section class="flex flex-col">
              <span class="pb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ g.group }}</span>
              <div class="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
                @for (r of g.rows; track r.id) {
                  <div
                    class="flex flex-col gap-2 px-3 py-3 md:grid md:items-center md:gap-3 md:py-2"
                    [style.grid-template-columns]="gridColumns()"
                    [ngClass]="{ 'opacity-50': selectable && !isSelected(r.id) }"
                  >
                    @if (selectable) {
                      <input type="checkbox" class="hidden size-4 accent-[var(--primary)] md:block" [checked]="isSelected(r.id)" (change)="toggleSelected(r.id)" [attr.aria-label]="'Apply ' + r.label" />
                    }
                    <span class="flex min-w-0 items-center gap-2">
                      @if (selectable) {
                        <input type="checkbox" class="size-4 shrink-0 accent-[var(--primary)] md:hidden" [checked]="isSelected(r.id)" (change)="toggleSelected(r.id)" [attr.aria-label]="'Apply ' + r.label" />
                      }
                      <span class="truncate text-sm font-semibold">{{ r.label }}</span>
                      @if (r.sub) {
                        <span class="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">{{ r.sub }}</span>
                      }
                    </span>

                    <!-- Phone: the read-only figures on one line, then the inputs side by side. From md
                         up both wrappers dissolve into the row's grid, and each cell's order puts it
                         back in its column. -->
                    <span class="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground md:contents">
                      @for (c of columns; track c.key; let ci = $index) {
                        @if (c.kind !== 'edit') {
                          <span class="md:text-right" [style.order]="ci + 2">
                            <span class="md:hidden">{{ c.label }} </span>
                            <span class="font-semibold tabular-nums" [ngClass]="c.kind === 'derived' ? 'text-[var(--success)]' : 'text-foreground'">{{ show(cellValue(r, c), c) }}</span>
                          </span>
                        }
                      }
                    </span>
                    <span class="grid grid-cols-2 gap-2 md:contents">
                      @for (c of columns; track c.key; let ci = $index) {
                        @if (c.kind === 'edit') {
                          <label class="flex min-w-0 flex-col gap-1 md:items-end" [style.order]="ci + 2">
                            <span class="text-[11px] font-medium text-muted-foreground md:hidden">{{ c.label }}</span>
                            <input
                              type="text"
                              inputmode="decimal"
                              [attr.data-col]="c.key"
                              [attr.data-row]="rowIndex(r.id)"
                              [attr.aria-label]="c.label + ' — ' + r.label + (r.sub ? ' ' + r.sub : '')"
                              [value]="inputText(r.id, c.key)"
                              (focus)="typed = null; focusing.set(r.id + '|' + c.key)"
                              (input)="commit(r.id, c.key, $any($event.target).value, true)"
                              (blur)="commit(r.id, c.key, $any($event.target).value)"
                              (keydown)="onKey($event, c.key, rowIndex(r.id))"
                              class="h-10 w-full rounded-lg border bg-input px-3 text-right text-sm tabular-nums text-foreground outline-none transition-colors focus:border-ring md:h-9"
                              [ngClass]="changed(r, c.key) ? 'border-[var(--warning)] bg-[var(--warning)]/10' : 'border-input'"
                            />
                            @if (changed(r, c.key)) {
                              <span class="text-[10px] text-muted-foreground">was <span class="tabular-nums line-through">{{ show(r.values[c.key] ?? null, c) }}</span></span>
                            }
                          </label>
                        }
                      }
                    </span>
                  </div>
                }
              </div>
            </section>
          } @empty {
            <p class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing to edit.</p>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
        <span class="min-w-0 flex-1 text-xs text-muted-foreground">
          @if (error) {
            <span class="font-semibold text-[var(--destructive)]">{{ error }}</span>
          } @else {
            <span class="hidden md:inline">Tab or Enter moves down the column · Shift goes back up</span>
          }
        </span>
        <button type="button" (click)="requestClose()" class="rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
        <button type="button" (click)="save()" [disabled]="changedRows().length === 0 || busy" class="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {{ busy ? 'Saving…' : changedRows().length === 0 ? 'No changes' : changedRows().length === 1 ? 'Save 1 change' : 'Save ' + changedRows().length + ' changes' }}
        </button>
      </div>

      <!-- Leaving with unsaved changes -->
      @if (confirmingClose()) {
        <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button type="button" aria-label="Keep editing" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingClose.set(false)"></button>
          <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <div class="flex flex-col gap-2 p-5">
              <span class="flex items-center gap-2 text-sm font-semibold"><app-icon name="alert-triangle" [size]="15" /> Save changes first?</span>
              <p class="text-sm text-muted-foreground">{{ changedRows().length === 1 ? '1 row has' : changedRows().length + ' rows have' }} unsaved changes.</p>
            </div>
            <div class="flex items-center justify-end gap-2 border-t border-border p-4">
              <button type="button" (click)="confirmingClose.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Keep editing</button>
              <button type="button" (click)="discard()" class="rounded-md border border-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">Discard</button>
              <button type="button" (click)="confirmingClose.set(false); save()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Save</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class BulkEditSheetComponent implements OnChanges {
  private host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() note = '';
  @Input({ required: true }) columns: BulkColumn[] = [];
  @Input({ required: true }) rows: BulkRow[] = [];
  /** Price list import: a tick box per row (all ticked to start); only ticked rows are saved. */
  @Input() selectable = false;
  @Input() busy = false;
  @Input() error = '';
  @Output() saved = new EventEmitter<BulkSave>();
  @Output() closed = new EventEmitter<void>();

  /** Working values per row id. */
  private working = signal<Record<string, BulkValues>>({});
  private selected = signal<Set<string>>(new Set());
  private rowList = signal<BulkRow[]>([]);
  focusing = signal<string | null>(null);
  confirmingClose = signal(false);

  ngOnChanges() {
    this.rowList.set(this.rows);
    this.working.set(Object.fromEntries(this.rows.map((r) => [r.id, { ...r.values, ...(r.proposed ?? {}) }])));
    this.selected.set(new Set(this.rows.map((r) => r.id)));
  }

  groups = computed(() => {
    const out: { group: string; rows: BulkRow[] }[] = [];
    for (const r of this.rowList()) {
      const g = out.find((x) => x.group === r.group);
      if (g) g.rows.push(r);
      else out.push({ group: r.group, rows: [r] });
    }
    return out;
  });

  gridColumns(): string {
    return [this.selectable ? '1.25rem' : '', 'minmax(0,1.6fr)', ...this.columns.map((c) => (c.kind === 'edit' ? 'minmax(0,9rem)' : 'minmax(0,7rem)'))]
      .filter(Boolean)
      .join(' ');
  }

  rowIndex(id: string): number {
    return this.rowList().findIndex((r) => r.id === id);
  }

  value(id: string, key: string): number | null {
    return this.working()[id]?.[key] ?? null;
  }

  cellValue(r: BulkRow, c: BulkColumn): number | null {
    if (c.kind === 'derived') return c.derive ? c.derive(this.working()[r.id] ?? {}) : null;
    return this.value(r.id, c.key);
  }

  changed(r: BulkRow, key: string): boolean {
    return (this.value(r.id, key) ?? 0) !== (r.values[key] ?? 0);
  }

  isSelected(id: string): boolean {
    return !this.selectable || this.selected().has(id);
  }

  toggleSelected(id: string) {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  changedRows = computed(() =>
    this.rowList().filter((r) => this.isSelected(r.id) && this.columns.some((c) => c.kind === 'edit' && (this.working()[r.id]?.[c.key] ?? 0) !== (r.values[c.key] ?? 0))),
  );

  /** Raw number while the field has focus, grouped figure otherwise. */
  inputText(id: string, key: string): string {
    if (this.focusing() === `${id}|${key}` && this.typed !== null) return this.typed;
    const v = this.value(id, key);
    if (v == null) return '';
    return this.focusing() === `${id}|${key}` ? String(v) : v.toLocaleString('en-MY', { maximumFractionDigits: 2 });
  }

  /** Exactly what's typed in the focused field, so "40." isn't tidied to "40" mid-number. */
  typed: string | null = null;

  /** While typing (`typing`), keeps the field as typed; on leaving it, shows the grouped figure. */
  commit(id: string, key: string, text: string, typing = false) {
    this.typed = typing ? text : null;
    if (!typing) this.focusing.set(null);
    const cleaned = text.replace(/[^0-9.]/g, '');
    const v = cleaned === '' ? null : Math.max(0, Number(cleaned));
    this.working.update((w) => ({ ...w, [id]: { ...w[id], [key]: v == null || isNaN(v) ? null : Math.round(v * 100) / 100 } }));
  }

  show(v: number | null, c: BulkColumn): string {
    if (v == null) return '—';
    return c.money ? `RM ${Math.round(v).toLocaleString('en-MY')}` : v.toLocaleString('en-MY', { maximumFractionDigits: 2 });
  }

  /** Tab / Enter move down the column; with Shift, up. */
  onKey(e: KeyboardEvent, col: string, row: number) {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    const next = row + (e.shiftKey ? -1 : 1);
    const target = (this.host.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`input[data-col="${col}"][data-row="${next}"]`);
    if (!target) return;
    e.preventDefault();
    (e.target as HTMLInputElement).blur();
    target.focus();
    target.select();
  }

  save() {
    const rows = this.changedRows();
    if (!rows.length) return;
    this.saved.emit(rows.map((r) => ({ id: r.id, values: { ...this.working()[r.id] } })));
  }

  requestClose() {
    if (this.changedRows().length && !this.busy) this.confirmingClose.set(true);
    else this.closed.emit();
  }

  discard() {
    this.confirmingClose.set(false);
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirmingClose()) this.confirmingClose.set(false);
    else this.requestClose();
  }
}
