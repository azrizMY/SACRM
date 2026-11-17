import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NCD_OPTIONS } from '../data/calculator-data';
import type { SalesDefaults } from '../data/settings-data';
import { IconComponent } from './icon.component';
import { NumberFieldComponent } from './number-field.component';
import { TranslatePipe } from './i18n';
import { SettingsService } from './settings.service';

/** The quote defaults this panel edits (all live in salesDefaults). */
const FIELDS = [
  'downpaymentPct',
  'ncd',
  'defaultRateType',
  'interestRate',
  'effectiveRate',
  'defaultTenureYears',
  'additionalRebateByDefault',
  'loanRounding',
  'allowCashback',
] as const satisfies readonly (keyof SalesDefaults)[];
type Form = Pick<SalesDefaults, (typeof FIELDS)[number]>;

/**
 * Price Settings → Quote defaults: what every new quote starts with (deposit, NCD, rate type,
 * default rates, repayment table years), plus the less common options under Advanced. Edits are
 * held here until Save, like the rest of the account's quote preferences always were.
 */
@Component({
  selector: 'app-quote-defaults',
  standalone: true,
  imports: [CommonModule, IconComponent, NumberFieldComponent, TranslatePipe],
  template: `
    <div class="flex flex-col gap-4">
      <p class="text-pretty text-sm text-muted-foreground">{{ "What every new quote starts with. A car's own price, rebate and rate (on the Cars tab) always win." | t }}</p>

      <!-- Every new quote -->
      <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <h2 class="text-base font-semibold">{{ "Every new quote" | t }}</h2>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <span id="qdDeposit" class="text-sm font-semibold">{{ "Downpayment" | t }}</span>
            <app-number-field
              suffix="%"
              ariaLabel="Default downpayment"
              [decimals]="0"
              [grouping]="false"
              [value]="form.downpaymentPct"
              (valueChange)="form.downpaymentPct = clampPct($event)"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <span id="qdRateType" class="text-sm font-semibold">{{ "Rate type" | t }}</span>
            <div role="radiogroup" aria-labelledby="qdRateType" class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              @for (o of rateTypes; track o.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="form.defaultRateType === o.id"
                  (click)="form.defaultRateType = o.id"
                  class="rounded-md px-2 py-1.5 text-sm font-semibold transition-colors"
                  [ngClass]="form.defaultRateType === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                >
                  {{ o.label | t }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span id="qdNcd" class="text-sm font-semibold">{{ "NCD" | t }}</span>
          <div role="radiogroup" aria-labelledby="qdNcd" class="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            @for (opt of ncdOptions; track opt.value) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="form.ncd === opt.value"
                (click)="form.ncd = opt.value"
                class="flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 leading-tight transition-colors"
                [ngClass]="form.ncd === opt.value ? 'border-brand bg-brand-soft' : 'border-control hover:bg-accent'"
              >
                <span class="text-sm font-bold tabular">{{ opt.value }}%</span>
                <span class="text-xs" [ngClass]="form.ncd === opt.value ? 'text-foreground' : 'text-muted-foreground'">{{ ncdYear(opt) | t }}</span>
              </button>
            }
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span id="qdYears" class="text-sm font-semibold">{{ "Repayment table years" | t }}</span>
          <div role="group" aria-labelledby="qdYears" class="grid grid-cols-9 gap-1">
            @for (y of yearOptions; track y) {
              <button
                type="button"
                [attr.aria-pressed]="form.defaultTenureYears.includes(y)"
                (click)="toggleYear(y)"
                class="flex h-9 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                [ngClass]="form.defaultTenureYears.includes(y) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              >
                {{ y }}
              </button>
            }
          </div>
          <span class="text-xs text-muted-foreground">{{ "Pick 3 tenures — which years the Calculator's repayment table opens on." | t }}</span>
        </div>
      </div>

      <!-- Default rates -->
      <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <div class="flex flex-col gap-0.5">
          <h2 class="text-base font-semibold">{{ "Default rates" | t }}</h2>
          <p class="text-xs text-muted-foreground">{{ "Used by every car without its own rate. Leave EIR empty to be asked for the bank's rate." | t }}</p>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:max-w-sm">
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            {{ "Flat" | t }}
            <app-number-field suffix="%" ariaLabel="Default flat rate" [decimals]="2" [value]="form.interestRate" (valueChange)="form.interestRate = clampRate($event) ?? form.interestRate" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            {{ "EIR" | t }}
            <app-number-field suffix="%" ariaLabel="Default EIR" [placeholder]="'Not set' | t" [decimals]="2" [value]="form.effectiveRate ?? null" (valueChange)="form.effectiveRate = clampRate($event) ?? undefined" />
          </label>
        </div>
      </div>

      <!-- Advanced: less common options -->
      <h2 class="px-1 pt-1 text-sm font-semibold text-muted-foreground">{{ "Advanced" | t }}</h2>
      <div class="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-4 text-card-foreground shadow-sm sm:px-5">
        <div class="flex items-center justify-between gap-4 py-4">
          <div class="flex flex-col">
            <span class="text-sm font-semibold">{{ "Tick Additional Rebate" | t }}</span>
            <span class="text-xs text-muted-foreground">{{ "Tick Additional Rebate by default on new quotes, for cars that have one. You can still untick it per quote." | t }}</span>
          </div>
          <ng-container *ngTemplateOutlet="toggle; context: { $implicit: form.additionalRebateByDefault ?? true, label: 'Tick Additional Rebate by default', flip: flipAdditionalRebate }" />
        </div>

        <div class="flex flex-col gap-2 py-4">
          <div class="flex flex-col">
            <span id="qdRounding" class="text-sm font-semibold">{{ "Loan Rounding" | t }}</span>
            <span class="text-xs text-muted-foreground">{{ "Loans are rounded to RM100. Round down adds the leftover to the downpayment; round up raises the loan and gives the excess back as cash back." | t }}</span>
          </div>
          <div role="radiogroup" aria-labelledby="qdRounding" class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:max-w-sm">
            @for (o of roundingOptions; track o.id) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="(form.loanRounding ?? 'down') === o.id"
                (click)="form.loanRounding = o.id"
                class="rounded-md px-2 py-1.5 text-sm font-semibold transition-colors"
                [ngClass]="(form.loanRounding ?? 'down') === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              >
                {{ o.label | t }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center justify-between gap-4 py-4">
          <div class="flex flex-col">
            <span class="text-sm font-semibold">{{ "Allow cash back" | t }}</span>
            <span class="text-xs text-muted-foreground">{{ "Show “Give rebate as cash back” in the Calculator. Turn on only if your dealer pays rebates out as cash." | t }}</span>
          </div>
          <ng-container *ngTemplateOutlet="toggle; context: { $implicit: form.allowCashback ?? false, label: 'Allow cash back', flip: flipCashback }" />
        </div>
      </div>

      <!-- One Save for this tab -->
      @if (unsavedCount() > 0 || savedFlash()) {
        <div class="pointer-events-none sticky bottom-4 z-30 flex justify-end">
          <div class="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-popover py-2 pl-4 pr-2 text-popover-foreground shadow-lg">
            @if (unsavedCount() > 0) {
              <span class="text-sm font-semibold">{{ (unsavedCount() === 1 ? '1 unsaved change' : '{n} unsaved changes') | t: { n: unsavedCount() } }}</span>
              <button type="button" (click)="discard()" class="btn">{{ "Discard" | t }}</button>
              <button type="button" (click)="save()" class="btn btn-primary">{{ "Save Changes" | t }}</button>
            } @else {
              <span class="flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-[var(--success)]">
                <app-icon name="check" [size]="18" />
                {{ "Saved" | t }}
              </span>
            }
          </div>
        </div>
      }
    </div>

    <ng-template #toggle let-on let-label="label" let-flip="flip">
      <button
        type="button"
        role="switch"
        [attr.aria-label]="label | t"
        [attr.aria-checked]="on"
        (click)="flip()"
        class="tap-auto relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
        [ngClass]="on ? 'bg-primary' : 'bg-muted'"
      >
        <span class="inline-block size-4 transform rounded-full bg-white shadow transition-transform" [ngClass]="on ? 'translate-x-6' : 'translate-x-1'"></span>
      </button>
    </ng-template>
  `,
})
export class QuoteDefaultsComponent {
  private settings = inject(SettingsService);

  readonly ncdOptions = NCD_OPTIONS;
  readonly yearOptions = Array.from({ length: 9 }, (_, i) => i + 1);
  readonly rateTypes = [
    { id: 'flat' as const, label: 'Flat' },
    { id: 'effective' as const, label: 'EIR' },
  ];
  readonly roundingOptions = [
    { id: 'down' as const, label: 'Round down' },
    { id: 'up' as const, label: 'Round up' },
  ];

  form: Form = this.copySaved();
  savedFlash = signal(false);

  readonly flipAdditionalRebate = () => (this.form.additionalRebateByDefault = !(this.form.additionalRebateByDefault ?? true));
  readonly flipCashback = () => (this.form.allowCashback = !(this.form.allowCashback ?? false));

  /** "Year 2" under each NCD box (from the option's own label), "No NCD" for 0%. */
  ncdYear(opt: { value: number; label: string }): string {
    return opt.value === 0 ? 'No NCD' : (opt.label.split(' — ')[1] ?? '');
  }

  clampPct(v: number | null): number {
    return Math.min(100, Math.max(0, Math.round(v ?? 0)));
  }

  /** A typed rate within 0–30%, or null when cleared. */
  clampRate(v: number | null): number | null {
    return v == null ? null : Math.min(30, Math.max(0, v));
  }

  /** Keeps exactly up to 3 years picked, replacing the oldest once 3 are chosen (as in the Calculator). */
  toggleYear(year: number) {
    const current = this.form.defaultTenureYears;
    if (current.includes(year)) {
      if (current.length > 1) this.form.defaultTenureYears = current.filter((y) => y !== year);
    } else if (current.length < 3) {
      this.form.defaultTenureYears = [...current, year];
    } else {
      this.form.defaultTenureYears = [...current.slice(1), year];
    }
  }

  unsavedCount(): number {
    const saved = this.settings.settings().salesDefaults;
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    return FIELDS.filter((k) => !same(this.form[k], saved[k])).length;
  }

  save() {
    this.settings.updateSalesDefaults({ ...this.form });
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  discard() {
    this.form = this.copySaved();
  }

  private copySaved(): Form {
    const d = this.settings.settings().salesDefaults;
    const out = {} as Record<string, unknown>;
    for (const k of FIELDS) out[k] = Array.isArray(d[k]) ? [...(d[k] as number[])] : d[k];
    return out as Form;
  }
}
