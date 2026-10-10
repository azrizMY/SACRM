import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { NumberFieldComponent } from './number-field.component';
import { SettingsService } from './settings.service';
import { formatRM2 } from '../data/dashboard-data';
import {
  DEFAULT_EPR,
  computeInsuranceBreakdown,
  defaultInsuranceQuotation,
  type InsuranceQuotationDetails,
  type Vehicle,
} from '../data/calculator-data';

/**
 * Editable itemized insurance quotation for one car — Basic Premium, Premium All Rider,
 * a free-form list of Additional Coverages, Stamp Duty, Service Tax, and EPR — plus a live
 * preview of the official-style breakdown.
 *
 * Three modes:
 * - 'draft' (Price Settings' car editor): edits the object passed in as `draft` in place and has no
 *   buttons of its own — the editor panel's one Save, Reset and Discard cover it.
 * - 'database': Save writes the car's shared default via SettingsService.
 * - 'quote' (Calculator's Insurance Breakdown modal): Save never touches the shared database —
 *   it only emits the details for the parent to hold as a per-quotation override.
 *
 * Basic Premium can follow the motor tariff (`tariffPremium`, worked out from the car's sum insured
 * and engine band): it's labelled "From tariff" until the SA types the insurer's own figure over it.
 */
@Component({
  selector: 'app-insurance-quotation-editor',
  standalone: true,
  imports: [CommonModule, IconComponent, NumberFieldComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Insurance pricing mode" class="flex gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5">
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="form.mode === 'flat'"
          (click)="setMode('flat')"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          [ngClass]="form.mode === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
        >
          Flat
        </button>
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="form.mode !== 'flat'"
          (click)="setMode('itemized')"
          class="flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          [ngClass]="form.mode !== 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
        >
          Itemized
        </button>
      </div>

      @if (form.mode === 'flat') {
        <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Insurance Price
          <app-number-field prefix="RM" ariaLabel="Insurance price" [value]="form.flatPrice ?? null" (valueChange)="form.flatPrice = $event ?? 0" />
        </label>
        <p class="text-[11px] text-muted-foreground">The whole insurer-quoted price — NCD is deducted straight from it, nothing else added.</p>
      } @else {
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            <span class="flex items-center justify-between gap-2">
              Basic Premium
              @if (tariffPremium != null) {
                @if (followsTariff()) {
                  <span class="rounded-full bg-[var(--success)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--success)]">From tariff</span>
                } @else {
                  <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">Insurer quote</span>
                }
              }
            </span>
            <app-number-field prefix="RM" ariaLabel="Basic premium" [value]="form.basicPremium" (valueChange)="setBasicPremium($event)" />
            @if (tariffPremium != null && !followsTariff()) {
              <button type="button" (click)="useTariff()" class="w-fit text-[11px] font-medium text-primary hover:underline">
                Use tariff figure ({{ money(tariffPremium) }})
              </button>
            }
          </div>
          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Premium All Rider
            <app-number-field prefix="RM" ariaLabel="Premium all rider" [value]="form.premiumAllRider" (valueChange)="form.premiumAllRider = $event ?? 0" />
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
                [value]="item.label"
                (input)="item.label = $any($event.target).value"
                class="h-10 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-xs text-foreground outline-none focus:border-ring"
              />
              <app-number-field class="w-32 shrink-0" prefix="RM" ariaLabel="Coverage amount" [value]="item.amount" (valueChange)="item.amount = $event ?? 0" />
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
            Stamp Duty
            <app-number-field prefix="RM" ariaLabel="Stamp duty" [value]="form.stampDuty" (valueChange)="form.stampDuty = $event ?? 0" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Service Tax
            <app-number-field suffix="%" ariaLabel="Service tax" [value]="form.serviceTaxPct" (valueChange)="form.serviceTaxPct = $event ?? 0" />
          </label>
          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            EPR
            <app-number-field prefix="RM" ariaLabel="EPR" [value]="form.epr" (valueChange)="form.epr = $event ?? 0" />
          </label>
        </div>
      }

      <!-- Live preview, matching the official quotation layout -->
      <div class="overflow-hidden rounded-lg border border-border text-xs">
        <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
          <span>Premium Pricing</span>
          <span>RM</span>
        </div>
        @if (form.mode === 'flat') {
          <div class="flex flex-col divide-y divide-border/60">
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">Insurance Price</span>
              <span class="tabular">{{ plain(breakdown().flatPrice ?? 0) }}</span>
            </div>
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">&minus;NCD ({{ breakdown().ncdPct }}%)</span>
              <span class="tabular">{{ plain(breakdown().ncdAmount) }}</span>
            </div>
          </div>
        } @else {
          <div class="flex flex-col divide-y divide-border/60">
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">Basic Premium</span>
              <span class="tabular">{{ plain(breakdown().basicPremium) }}</span>
            </div>
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">Premium All Rider</span>
              <span class="tabular">{{ plain(breakdown().premiumAllRider) }}</span>
            </div>
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">&minus;NCD ({{ breakdown().ncdPct }}%)</span>
              <span class="tabular">{{ plain(breakdown().ncdAmount) }}</span>
            </div>
          </div>
          @if (form.additionalCoverages.length > 0) {
            <div class="bg-muted/40 px-3 py-1.5 font-semibold">+Additional Coverages</div>
            <div class="flex flex-col divide-y divide-border/60">
              @for (item of form.additionalCoverages; track $index) {
                <div class="flex items-center justify-between px-3 py-1.5">
                  <span class="text-muted-foreground">{{ item.label || 'Untitled coverage' }}</span>
                  <span class="tabular">{{ plain(item.amount) }}</span>
                </div>
              }
            </div>
          }
          <div class="flex items-center justify-between bg-muted/40 px-3 py-1.5 font-semibold">
            <span>Gross Premium</span>
            <span class="tabular">{{ plain(breakdown().grossPremium) }}</span>
          </div>
          <div class="flex flex-col divide-y divide-border/60">
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">+Stamp Duty</span>
              <span class="tabular">{{ plain(breakdown().stampDuty) }}</span>
            </div>
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">+Service Tax ({{ breakdown().serviceTaxPct }}%)</span>
              <span class="tabular">{{ plain(breakdown().serviceTaxAmount) }}</span>
            </div>
            <div class="flex items-center justify-between px-3 py-1.5">
              <span class="text-muted-foreground">+EPR</span>
              <span class="tabular">{{ plain(breakdown().epr) }}</span>
            </div>
          </div>
        }
        <div class="flex items-center justify-between bg-primary/10 px-3 py-2">
          <span class="font-semibold text-primary">Total Due</span>
          <span class="font-bold tabular text-primary">{{ plain(breakdown().totalDue) }}</span>
        </div>
      </div>

      @if (mode !== 'draft') {
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
      }
    </div>
  `,
})
export class InsuranceQuotationEditorComponent implements OnChanges {
  @Input({ required: true }) vehicle!: Vehicle;
  @Input() ncdPct = 0;
  @Input() fallbackBasicPremium = 0;
  /** See the class comment. */
  @Input() mode: 'database' | 'quote' | 'draft' = 'database';
  /** Quote mode only — the currently active details for this quote (an existing override, or the
   *  database default), so reopening the modal shows what's actually in effect, not a reset form. */
  @Input() initialDetails: InsuranceQuotationDetails | null = null;
  /** Draft mode only — the parent's working copy, edited in place. */
  @Input() draft: InsuranceQuotationDetails | null = null;
  /** Basic premium from the motor tariff for this car, or null when it can't be worked out. */
  @Input() tariffPremium: number | null = null;
  @Output() saved = new EventEmitter<InsuranceQuotationDetails>();

  money = formatRM2;
  plain = (v: number) => v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  savedFlash = signal(false);

  form: InsuranceQuotationDetails = { basicPremium: 0, premiumAllRider: 0, additionalCoverages: [], stampDuty: 0, serviceTaxPct: 0, epr: DEFAULT_EPR };

  constructor(private settingsService: SettingsService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['vehicle'] || changes['initialDetails'] || changes['draft']) this.loadForm();
    // A new sum insured or band moves the tariff figure; a premium that follows the tariff moves with it
    if (changes['tariffPremium'] && this.followsTariff() && this.tariffPremium != null) this.form.basicPremium = this.tariffPremium;
  }

  private loadForm() {
    if (this.mode === 'draft' && this.draft) {
      this.form = this.draft;
      return;
    }
    const details =
      this.mode === 'quote' && this.initialDetails
        ? this.initialDetails
        : this.settingsService.getVehicleInsurance(this.vehicle, this.fallbackBasicPremium);
    this.form = { ...details, additionalCoverages: details.additionalCoverages.map((c) => ({ ...c })) };
  }

  followsTariff(): boolean {
    return this.form.basicPremiumSource === 'tariff';
  }

  setMode(mode: 'flat' | 'itemized') {
    this.form.mode = mode;
    // Switching to itemized on a car the tariff covers starts from the tariff figure
    if (mode === 'itemized' && this.tariffPremium != null && this.form.basicPremiumSource === undefined) this.useTariff();
  }

  setBasicPremium(value: number | null) {
    const v = value ?? 0;
    if (v === this.form.basicPremium) return;
    this.form.basicPremium = v;
    this.form.basicPremiumSource = this.tariffPremium != null && Math.abs(v - this.tariffPremium) < 0.005 ? 'tariff' : 'quote';
  }

  useTariff() {
    if (this.tariffPremium == null) return;
    this.form.basicPremium = this.tariffPremium;
    this.form.basicPremiumSource = 'tariff';
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
