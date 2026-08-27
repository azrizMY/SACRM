import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { SettingsService } from './settings.service';
import {
  DEFAULT_EPR,
  computeInsuranceBreakdown,
  defaultInsuranceQuotation,
  formatRM,
  type InsuranceQuotationDetails,
  type Vehicle,
} from '../data/calculator-data';

/**
 * Editable itemized insurance quotation for one car — Basic Premium, Premium All Rider,
 * a free-form list of Additional Coverages, Stamp Duty, Service Tax, and EPR — plus a live
 * preview of the official-style breakdown.
 *
 * Two modes, since the same form is used for two different things:
 * - 'database' (default, Account Settings → Car Database "Edit Car"): Save writes the car's
 *   shared default via SettingsService — every future quote for this car starts from it.
 * - 'quote' (Calculator's Insurance Breakdown modal): Save never touches the shared database —
 *   it only emits the details for the parent to hold as a per-quotation override, so one
 *   customer declining coverage (or arranging their own insurance) never changes what the next
 *   customer sees for the same car.
 */
@Component({
  selector: 'app-insurance-quotation-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Basic Premium (RM)
          <input type="number" min="0" step="1" [(ngModel)]="form.basicPremium" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Premium All Rider (RM)
          <input type="number" min="0" step="1" [(ngModel)]="form.premiumAllRider" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
        </label>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-muted-foreground">Additional Coverages</span>
          <button type="button" (click)="addCoverage()" class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-accent">
            <app-icon name="plus" [size]="12" />
            Add Coverage
          </button>
        </div>
        @for (item of form.additionalCoverages; track $index) {
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="Coverage name"
              [(ngModel)]="item.label"
              class="h-9 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-xs text-foreground outline-none focus:border-ring"
            />
            <input
              type="number"
              step="1"
              placeholder="RM"
              [(ngModel)]="item.amount"
              class="h-9 w-28 shrink-0 rounded-lg border border-input bg-input px-3 text-xs tabular text-foreground outline-none focus:border-ring"
            />
            <button type="button" (click)="removeCoverage($index)" aria-label="Remove coverage" class="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]">
              <app-icon name="trash" [size]="13" />
            </button>
          </div>
        } @empty {
          <p class="text-[11px] text-muted-foreground">No additional coverages yet.</p>
        }
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Stamp Duty (RM)
          <input type="number" min="0" step="1" [(ngModel)]="form.stampDuty" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Service Tax (%)
          <input type="number" min="0" step="0.01" [(ngModel)]="form.serviceTaxPct" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
        </label>
        <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          EPR (RM)
          <input type="number" min="0" step="0.01" [(ngModel)]="form.epr" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
        </label>
      </div>

      <!-- Live preview, matching the official quotation layout -->
      <div class="overflow-hidden rounded-lg border border-border text-xs">
        <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
          <span>Premium Pricing</span>
          <span>RM</span>
        </div>
        <div class="flex flex-col divide-y divide-border/60">
          <div class="flex items-center justify-between px-3 py-1.5">
            <span class="text-muted-foreground">Basic Premium</span>
            <span class="tabular">{{ fmtPlain(breakdown().basicPremium) }}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5">
            <span class="text-muted-foreground">Premium All Rider</span>
            <span class="tabular">{{ fmtPlain(breakdown().premiumAllRider) }}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5">
            <span class="text-muted-foreground">&minus;NCD ({{ breakdown().ncdPct }}%)</span>
            <span class="tabular">{{ fmtPlain(breakdown().ncdAmount) }}</span>
          </div>
        </div>
        @if (form.additionalCoverages.length > 0) {
          <div class="bg-muted/40 px-3 py-1.5 font-semibold">+Additional Coverages</div>
          <div class="flex flex-col divide-y divide-border/60">
            @for (item of form.additionalCoverages; track $index) {
              <div class="flex items-center justify-between px-3 py-1.5">
                <span class="text-muted-foreground">{{ item.label || 'Untitled coverage' }}</span>
                <span class="tabular">{{ fmtPlain(item.amount) }}</span>
              </div>
            }
          </div>
        }
        <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
          <span>Gross Premium</span>
          <span class="tabular">{{ fmtPlain(breakdown().grossPremium) }}</span>
        </div>
        <div class="flex flex-col divide-y divide-border/60">
          <div class="flex items-center justify-between px-3 py-1.5">
            <span class="text-muted-foreground">+Stamp Duty</span>
            <span class="tabular">{{ fmtPlain(breakdown().stampDuty) }}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5">
            <span class="text-muted-foreground">+Service Tax ({{ breakdown().serviceTaxPct }}%)</span>
            <span class="tabular">{{ fmtPlain(breakdown().serviceTaxAmount) }}</span>
          </div>
          <div class="flex items-center justify-between px-3 py-1.5">
            <span class="text-muted-foreground">+EPR</span>
            <span class="tabular">{{ fmtPlain(breakdown().epr) }}</span>
          </div>
        </div>
        <div class="flex items-center justify-between bg-primary/10 px-3 py-2">
          <span class="font-semibold text-primary">Total Due <span class="font-normal text-muted-foreground">(Rounded: {{ fmt(breakdown().totalRounded) }})</span></span>
          <span class="font-bold tabular text-primary">{{ fmtPlain(breakdown().totalDue) }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" (click)="save()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          {{ mode === 'quote' ? 'Use for This Quote' : 'Save Quotation' }}
        </button>
        @if (mode === 'quote') {
          <button type="button" (click)="reloadFromDatabase()" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            Reload Car Database Default
          </button>
        } @else {
          <button type="button" (click)="resetToDefault()" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            Reset to Default
          </button>
        }
        @if (savedFlash()) {
          <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
            <app-icon name="check" [size]="13" />
            {{ mode === 'quote' ? 'Applied to this quote' : 'Saved' }}
          </span>
        }
      </div>
      @if (mode === 'quote') {
        <p class="text-[11px] text-muted-foreground">This applies to this quotation only — the car's database default won't change.</p>
      }
    </div>
  `,
})
export class InsuranceQuotationEditorComponent implements OnChanges {
  @Input({ required: true }) vehicle!: Vehicle;
  @Input() ncdPct = 0;
  @Input() fallbackBasicPremium = 0;
  /** 'database' (default) saves to the shared per-car default; 'quote' never writes it, only emits. */
  @Input() mode: 'database' | 'quote' = 'database';
  /** Quote mode only — the currently active details for this quote (an existing override, or the
   *  database default), so reopening the modal shows what's actually in effect, not a reset form. */
  @Input() initialDetails: InsuranceQuotationDetails | null = null;
  @Output() saved = new EventEmitter<InsuranceQuotationDetails>();

  fmt = (v: number) => formatRM(v);
  fmtPlain = (v: number) => v.toFixed(2);
  savedFlash = signal(false);

  form: InsuranceQuotationDetails = { basicPremium: 0, premiumAllRider: 0, additionalCoverages: [], stampDuty: 0, serviceTaxPct: 0, epr: DEFAULT_EPR };

  constructor(private settingsService: SettingsService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['vehicle'] || changes['initialDetails']) this.loadForm();
  }

  private loadForm() {
    const details =
      this.mode === 'quote' && this.initialDetails
        ? this.initialDetails
        : this.settingsService.getVehicleInsurance(this.vehicle, this.fallbackBasicPremium);
    this.form = { ...details, additionalCoverages: details.additionalCoverages.map((c) => ({ ...c })) };
  }

  reloadFromDatabase() {
    this.form = this.settingsService.getVehicleInsurance(this.vehicle, this.fallbackBasicPremium);
  }

  breakdown() {
    return computeInsuranceBreakdown(this.form, this.ncdPct);
  }

  addCoverage() {
    this.form.additionalCoverages = [...this.form.additionalCoverages, { label: '', amount: 0 }];
  }

  removeCoverage(index: number) {
    this.form.additionalCoverages = this.form.additionalCoverages.filter((_, i) => i !== index);
  }

  save() {
    const details: InsuranceQuotationDetails = {
      ...this.form,
      additionalCoverages: this.form.additionalCoverages.map((c) => ({ ...c })),
    };
    if (this.mode === 'database') {
      this.settingsService.updateVehicleInsurance(this.vehicle.id, details);
    }
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
    this.saved.emit(details);
  }

  resetToDefault() {
    this.form = defaultInsuranceQuotation(this.vehicle, this.fallbackBasicPremium);
  }
}
