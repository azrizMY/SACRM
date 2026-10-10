import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { BulkEditSheetComponent, type BulkColumn, type BulkRow, type BulkSave } from './bulk-edit-sheet.component';
import { VehicleCatalogService } from './vehicle-catalog.service';
import { ScannedPdfError, extractPdfLines, matchRows, parsePriceList, type ParsedPriceRow, type PriceListMatch } from './price-list-parser';
import type { VehicleOverride } from '../data/calculator-data';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Price Settings → a brand's "Import price list": pick the brand's official price list PDF(s), the
 * app reads the prices and sums insured, then shows them in the same review screen as Edit rebates —
 * current vs proposed, a tick per row. Nothing changes until Save. Rebates are never touched (price
 * lists don't carry dealer rebates); premiums following the tariff recalculate from the new sums insured.
 */
@Component({
  selector: 'app-price-list-import',
  standalone: true,
  imports: [CommonModule, IconComponent, BulkEditSheetComponent],
  template: `
    @if (step() === 'review') {
      <app-bulk-edit-sheet
        [title]="'Import price list — ' + brand"
        subtitle="Untick anything you don't want to change. Rebates aren't touched."
        [note]="reviewNote()"
        [columns]="columns"
        [rows]="reviewRows()"
        [selectable]="true"
        [busy]="saving()"
        [error]="saveError()"
        (saved)="apply($event)"
        (closed)="closed.emit()"
      />
    } @else {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" [attr.aria-label]="'Import price list — ' + brand">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closed.emit()"></button>
        <div class="relative flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-base font-bold">Import {{ brand }} price list</span>
              <span class="text-xs text-muted-foreground">Pick the brand's official digital price list (PDF, up to 10 MB). You can pick several — one per model is fine.</span>
            </div>
            <button type="button" (click)="closed.emit()" aria-label="Close" class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <label
            class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors hover:border-primary/50"
            [class.pointer-events-none]="step() === 'reading'"
          >
            <app-icon [name]="step() === 'reading' ? 'refresh-cw' : 'upload'" [size]="22" class="text-muted-foreground" [class.animate-spin]="step() === 'reading'" />
            <span class="text-sm font-semibold">{{ step() === 'reading' ? 'Reading…' : 'Choose PDF' }}</span>
            <input type="file" accept="application/pdf,.pdf" multiple class="sr-only" (change)="read($any($event.target).files); $any($event.target).value = ''" />
          </label>

          @if (error()) {
            <p class="flex items-start gap-1.5 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="alert-triangle" [size]="13" class="mt-px shrink-0" />
              {{ error() }}
            </p>
          }
          <p class="text-[11px] text-muted-foreground">The file is read on this device — it isn't uploaded anywhere.</p>
        </div>
      </div>
    }
  `,
})
export class PriceListImportComponent {
  private catalog = inject(VehicleCatalogService);

  @Input({ required: true }) brand = '';
  @Output() closed = new EventEmitter<void>();

  step = signal<'pick' | 'reading' | 'review'>('pick');
  error = signal('');
  saving = signal(false);
  saveError = signal('');
  private matches = signal<PriceListMatch[]>([]);
  private unmatched = signal<ParsedPriceRow[]>([]);

  readonly columns: BulkColumn[] = [
    { key: 'price', label: 'Price (RM)', kind: 'edit' },
    { key: 'sumInsured', label: 'Sum insured (RM)', kind: 'edit' },
  ];

  async read(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    this.error.set('');
    const tooBig = list.find((f) => f.size > MAX_BYTES);
    if (tooBig) return this.error.set(`${tooBig.name} is over 10 MB.`);
    const notPdf = list.find((f) => !/\.pdf$/i.test(f.name) && f.type !== 'application/pdf');
    if (notPdf) return this.error.set(`${notPdf.name} isn't a PDF.`);

    this.step.set('reading');
    const rows: ParsedPriceRow[] = [];
    const scanned: string[] = [];
    try {
      for (const f of list) {
        try {
          rows.push(...parsePriceList(this.brand, await extractPdfLines(f), f.name));
        } catch (e) {
          if (e instanceof ScannedPdfError) scanned.push(f.name);
          else throw e;
        }
      }
    } catch {
      this.step.set('pick');
      return this.error.set("Couldn't read that PDF. Try the brand's official digital price list.");
    }
    if (!rows.length) {
      this.step.set('pick');
      return this.error.set(
        scanned.length ? 'This PDF is an image. Use the brand’s official digital price list.' : 'No prices found in this PDF — is it the right brand’s price list?',
      );
    }
    const vehicles = this.catalog.vehicles().filter((v) => v.brand === this.brand);
    const { matched, unmatched } = matchRows(rows, vehicles);
    this.matches.set(matched);
    this.unmatched.set([...unmatched, ...scanned.map((name) => ({ name: `${name} (image only — not read)`, otr: null, sumInsured: null }))]);
    if (!matched.length) {
      this.step.set('pick');
      return this.error.set(`Found ${rows.length} price${rows.length === 1 ? '' : 's'}, but none matched a ${this.brand} car: ${unmatched.map((r) => r.name).join(', ')}.`);
    }
    this.step.set('review');
  }

  reviewRows = computed((): BulkRow[] =>
    this.matches().map(({ row, vehicle }) => ({
      id: vehicle.id,
      group: vehicle.model,
      label: vehicle.variant || vehicle.model,
      values: { price: vehicle.price, sumInsured: vehicle.sumInsured ?? null },
      proposed: { price: row.otr ?? vehicle.price, sumInsured: row.sumInsured ?? vehicle.sumInsured ?? null },
    })),
  );

  reviewNote = computed(() => {
    const u = this.unmatched();
    return u.length ? `New variant? Not matched to a car, so skipped: ${u.map((r) => r.name).join(' · ')}` : '';
  });

  async apply(changes: BulkSave) {
    const patches: Record<string, VehicleOverride> = {};
    for (const { id, values } of changes) {
      patches[id] = {
        ...(values['price'] != null ? { price: values['price'] } : {}),
        ...(values['sumInsured'] != null ? { sumInsured: values['sumInsured'] } : {}),
      };
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.catalog.updateVehicles(patches);
      this.closed.emit();
    } catch {
      this.saveError.set("Couldn't save — check your connection and try again.");
    } finally {
      this.saving.set(false);
    }
  }
}
