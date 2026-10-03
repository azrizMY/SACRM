import { TranslatePipe } from './i18n';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { SettingsService, withCurrent } from './settings.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { coloursForVehicle, modelVariantLabel, vehicleTitle } from '../data/calculator-data';
import {
  CANCEL_REASON_OPTIONS,
  COLOUR_OPTIONS,
  FINANCING_TYPE_OPTIONS,
  NO_ID_NOTES_HINT,
  TO_BE_CONFIRMED_COLOUR,
  type CustomerRecord,
  type CustomerStatus,
  type EditCustomerInput,
} from '../data/customer-data';

@Component({
  selector: 'app-customer-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></button>
      <div class="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex items-center gap-3 border-b border-border p-4">
          <span class="text-sm font-semibold">Edit Customer &middot; {{ record.name }}</span>
          <button type="button" (click)="close.emit()" [attr.aria-label]="'Close' | t" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <div class="flex flex-col gap-5 overflow-y-auto p-4">
          <!-- Customer -->
          <fieldset class="flex flex-col gap-3">
            <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Customer" | t }}</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Name" | t }}
                <input type="text" [(ngModel)]="form.name" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Phone" | t }}
                <input type="tel" [(ngModel)]="form.phone" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Lead Source" | t }}
                <select [(ngModel)]="form.sourceType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (s of sourceOptions(); track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Financing Type" | t }}
                <select [(ngModel)]="form.financingType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label | t }}</option> }
                </select>
              </label>
            </div>
          </fieldset>

          <!-- Vehicle -->
          <fieldset class="flex flex-col gap-3">
            <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Vehicle" | t }}</legend>
            <!-- The car itself is changed only through "Change car" (customer panel), which flags the
                 quotation for re-quote and logs the swap — never silently from here. -->
            <div class="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2.5">
              <span class="text-sm font-semibold text-foreground">{{ vehicleTitle(record.brand, modelVariantLabel(record.model, record.variant)) }} · {{ record.yearMade }}</span>
              <span class="text-[11px] text-muted-foreground">{{ "To switch to a different car, use" | t }} <strong class="text-foreground">{{ "Change car" | t }}</strong> {{ "in the customer panel." | t }}</span>
            </div>
            <label
              #colourField
              [class]="'flex flex-col gap-1 text-xs font-medium text-muted-foreground rounded-lg transition-shadow duration-700 ' + (highlightColour ? 'ring-2 ring-[var(--warning)] ring-offset-2 ring-offset-card' : '')"
            >
              Colour @if (showColourRequired) { <span class="text-[var(--destructive)]">*</span> }
              <select [(ngModel)]="form.colour" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @if (showColourRequired && !form.colour) { <option value="">{{ "Select colour…" | t }}</option> }
                @for (c of colourOptionsForForm; track c) { <option [value]="c">{{ c }}</option> }
              </select>
              @if (showColourRequired) {
                <span class="text-[10px] text-muted-foreground">{{ "Colour must be confirmed before this deal can continue." | t }}</span>
              }
            </label>
          </fieldset>

          <!-- Lost -->
          @if (showCancellation) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ "Lost" | t }}</legend>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Reason" | t }}
                <select [(ngModel)]="form.cancelReason" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (r of cancelReasons; track r) { <option [value]="r">{{ r }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {{ "Notes" | t }}
                <textarea rows="2" [(ngModel)]="form.cancelNotes" [placeholder]="noIdNotesHint | t" class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"></textarea>
              </label>
            </fieldset>
          }
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border p-4">
          <button type="button" (click)="close.emit()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
          <button type="button" (click)="submit()" [disabled]="!canSave" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">{{ "Save Changes" | t }}</button>
        </div>
      </div>
    </div>
  `,
})
export class CustomerEditModalComponent implements OnInit, AfterViewInit {
  @Input({ required: true }) record!: CustomerRecord;
  @Output() save = new EventEmitter<EditCustomerInput>();
  @Output() close = new EventEmitter<void>();
  noIdNotesHint = NO_ID_NOTES_HINT;

  @ViewChild('colourField') private colourFieldRef?: ElementRef<HTMLElement>;
  highlightColour = false;

  private settings = inject(SettingsService);

  /** This account's sources — plus the record's current one if it was removed from the list since,
   *  so opening an old lead never silently swaps its source. */
  sourceOptions(): string[] {
    return withCurrent(this.settings.leadSources(), this.form?.sourceType);
  }
  colourOptions = COLOUR_OPTIONS;
  financingTypeOptions = FINANCING_TYPE_OPTIONS;
  cancelReasons = CANCEL_REASON_OPTIONS;

  form: EditCustomerInput = {};

  vehicleTitle = vehicleTitle;
  modelVariantLabel = modelVariantLabel;

  private effectiveStage(): CustomerStatus {
    return this.record.status === 'Lost' ? (this.record.previousStatus ?? 'Lead') : this.record.status;
  }

  /** A won deal has a real colour — "To be Confirmed" is not a legal answer once Won,
   *  even though nothing forces it to be resolved earlier.
   *  Uses effectiveStage() so a Lost record inherits whichever stage it was lost from. */
  get showColourRequired(): boolean {
    const s = this.effectiveStage();
    return s === 'Won';
  }

  get colourOptionsForForm(): string[] {
    // Prefer this exact car's own factory colours when the catalog has them; not every model has
    // one hardcoded yet, so those fall back to the generic list.
    const vehicleColours = coloursForVehicle(this.record.brand, this.record.model, this.record.variant);
    if (this.showColourRequired) return vehicleColours ?? COLOUR_OPTIONS.filter((c) => c !== TO_BE_CONFIRMED_COLOUR);
    return vehicleColours ? [TO_BE_CONFIRMED_COLOUR, ...vehicleColours] : COLOUR_OPTIONS;
  }

  get canSave(): boolean {
    return !this.showColourRequired || !!this.form.colour;
  }

  get showCancellation(): boolean {
    return this.record.status === 'Lost';
  }

  ngOnInit() {
    const r = this.record;
    this.form = {
      name: r.name,
      phone: r.phone,
      sourceType: r.sourceType,
      colour: this.showColourRequired && r.colour === TO_BE_CONFIRMED_COLOUR ? '' : r.colour,
      financingType: r.financingType,
      cancelReason: r.cancelReason,
      cancelNotes: r.cancelNotes,
    };
  }

  /** Colour is the field most likely to be the reason this modal was opened (the Won
   *  gate blocks on it) — if it's still unresolved, draw the advisor's eye straight to
   *  it instead of leaving them to hunt through the form. */
  ngAfterViewInit() {
    if (this.showColourRequired && !this.form.colour) {
      setTimeout(() => {
        this.colourFieldRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.highlightColour = true;
        setTimeout(() => (this.highlightColour = false), 1800);
      }, 100);
    }
  }

  submit() {
    this.save.emit(this.form);
  }
}
