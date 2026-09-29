import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { SettingsService, withCurrent } from './settings.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { NCD_OPTIONS, TENURE_OPTIONS, coloursForVehicle, modelVariantLabel, vehicleTitle } from '../data/calculator-data';
import {
  CANCEL_REASON_OPTIONS,
  COLOUR_OPTIONS,
  DOCUMENT_STATUS_META,
  DOCUMENT_STATUS_OPTIONS,
  FINANCING_TYPE_OPTIONS,
  TO_BE_CONFIRMED_COLOUR,
  TRADE_IN_OPTIONS,
  type CustomerRecord,
  type CustomerStatus,
  type DocumentStatus,
  type EditCustomerInput,
} from '../data/customer-data';

@Component({
  selector: 'app-customer-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></button>
      <div class="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex items-center gap-3 border-b border-border p-4">
          <span class="text-sm font-semibold">Edit Customer &middot; {{ record.name }}</span>
          <button type="button" (click)="close.emit()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <div class="flex flex-col gap-5 overflow-y-auto p-4">
          <!-- Customer -->
          <fieldset class="flex flex-col gap-3">
            <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</legend>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Name
                <input type="text" [(ngModel)]="form.name" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Phone
                <input type="tel" [(ngModel)]="form.phone" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Lead Source
                <select [(ngModel)]="form.sourceType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (s of sourceOptions(); track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Financing Type
                <select [(ngModel)]="form.financingType" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (f of financingTypeOptions; track f.value) { <option [value]="f.value">{{ f.label }}</option> }
                </select>
              </label>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                IC No
                <input type="text" [(ngModel)]="form.icNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Driving Licence No
                <input type="text" [(ngModel)]="form.drivingLicenceNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Address
                <input type="text" [(ngModel)]="form.address" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Email
                <input type="email" [(ngModel)]="form.email" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
          </fieldset>

          <!-- Vehicle -->
          <fieldset class="flex flex-col gap-3">
            <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vehicle</legend>
            <!-- The car itself is changed only through "Change car" (customer panel), which flags the
                 quotation for re-quote and logs the swap — never silently from here. -->
            <div class="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2.5">
              <span class="text-sm font-semibold text-foreground">{{ vehicleTitle(record.brand, modelVariantLabel(record.model, record.variant)) }} · {{ record.yearMade }}</span>
              <span class="text-[11px] text-muted-foreground">To switch to a different car, use <strong class="text-foreground">Change car</strong> in the customer panel.</span>
            </div>
            <label
              #colourField
              [class]="'flex flex-col gap-1 text-xs font-medium text-muted-foreground rounded-lg transition-shadow duration-700 ' + (highlightColour ? 'ring-2 ring-[var(--warning)] ring-offset-2 ring-offset-card' : '')"
            >
              Colour @if (showColourRequired) { <span class="text-[var(--destructive)]">*</span> }
              <select [(ngModel)]="form.colour" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @if (showColourRequired && !form.colour) { <option value="">Select colour…</option> }
                @for (c of colourOptionsForForm; track c) { <option [value]="c">{{ c }}</option> }
              </select>
              @if (showColourRequired) {
                <span class="text-[10px] text-muted-foreground">Colour must be confirmed before this deal can continue.</span>
              }
            </label>
          </fieldset>

          <!-- Payment -->
          @if (showBooking) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                @if (!isCashInForm) {
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Down Payment (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="form.downpayment" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                }
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  NCD (%)
                  <select [(ngModel)]="form.ncd" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (n of ncdOptions; track n.value) { <option [ngValue]="n.value">{{ n.label }}</option> }
                  </select>
                </label>
              </div>
              @if (showDocumentsInBooking) {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Document Status
                  @if (isCashInForm) {
                    <span class="flex h-10 items-center rounded-lg border border-input bg-input px-3 text-sm text-muted-foreground">Cash</span>
                  } @else {
                    <select [(ngModel)]="form.documentStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (d of documentStatusOptions; track d) { <option [value]="d">{{ docLabel(d) }}</option> }
                    </select>
                  }
                </label>
              }
            </fieldset>
          }

          <!-- Trade-in -->
          @if (showTradeIn) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trade-in</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Trade-in Status
                  <select [(ngModel)]="form.tradeInStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (t of tradeInOptions; track t) { <option [value]="t">{{ t }}</option> }
                  </select>
                </label>
                @if (form.tradeInStatus === 'Confirmed') {
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Agreed Value (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="form.tradeInValue" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                }
              </div>
              @if (form.tradeInStatus === 'Confirmed') {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Trade-in Vehicle
                  <input type="text" placeholder="e.g. Toyota Vios 2018" [(ngModel)]="form.tradeInVehicle" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
              }
            </fieldset>
          }

          <!-- Financing -->
          @if (showFinancing) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Financing</legend>
              @if (form.financingType === 'Loan') {
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Bank Panel
                    <select [(ngModel)]="form.bankPanel" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @if (!form.bankPanel) { <option value="">Select bank…</option> }
                      @for (b of bankOptions(); track b) { <option [value]="b">{{ b }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Loan Amount (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="form.loanAmount" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Tenure
                    <select [(ngModel)]="form.loanTenureMonths" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (t of tenureOptions; track t.months) { <option [ngValue]="t.months">{{ t.label }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Interest Rate (%)
                    <input type="number" min="0" step="0.1" [(ngModel)]="form.loanInterestRate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
              }
              @if (showDocumentsInFinancing) {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Document Status
                  @if (isCashInForm) {
                    <span class="flex h-10 items-center rounded-lg border border-input bg-input px-3 text-sm text-muted-foreground">Cash</span>
                  } @else {
                    <select [(ngModel)]="form.documentStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (d of documentStatusOptions; track d) { <option [value]="d">{{ docLabel(d) }}</option> }
                    </select>
                  }
                </label>
              }
            </fieldset>
          }

          <!-- Delivery -->
          @if (showDelivery) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delivery</legend>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Insurance <span class="text-muted-foreground/70">(optional)</span>
                  <select [(ngModel)]="form.insuranceName" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (i of insuranceOptions(); track i) { <option [value]="i">{{ i }}</option> }
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Registration Number
                  <input type="text" [(ngModel)]="form.plateNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Chassis / VIN
                  <input type="text" [(ngModel)]="form.chassisNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Engine No.
                  <input type="text" [(ngModel)]="form.engineNo" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
              </div>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Delivery Date
                <input type="date" [(ngModel)]="form.deliveryDate" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Delivery Notes
                <textarea rows="2" [(ngModel)]="form.deliveryNotes" class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"></textarea>
              </label>
            </fieldset>
          }

          <!-- Cancellation -->
          @if (showCancellation) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cancellation</legend>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Reason
                <select [(ngModel)]="form.cancelReason" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (r of cancelReasons; track r) { <option [value]="r">{{ r }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Cancellation Notes
                <textarea rows="2" [(ngModel)]="form.cancelNotes" class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"></textarea>
              </label>
            </fieldset>
          }
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border p-4">
          <button type="button" (click)="close.emit()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
          <button type="button" (click)="submit()" [disabled]="!canSave" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save Changes</button>
        </div>
      </div>
    </div>
  `,
})
export class CustomerEditModalComponent implements OnInit, AfterViewInit {
  @Input({ required: true }) record!: CustomerRecord;
  @Output() save = new EventEmitter<EditCustomerInput>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('colourField') private colourFieldRef?: ElementRef<HTMLElement>;
  highlightColour = false;

  private settings = inject(SettingsService);

  /** This account's sources — plus the record's current one if it was removed from the list since,
   *  so opening an old lead never silently swaps its source. */
  sourceOptions(): string[] {
    return withCurrent(this.settings.leadSources(), this.form?.sourceType);
  }
  colourOptions = COLOUR_OPTIONS;
  tradeInOptions = TRADE_IN_OPTIONS;
  documentStatusOptions = DOCUMENT_STATUS_OPTIONS;
  bankOptions(): string[] {
    return withCurrent(this.settings.banks(), this.form?.bankPanel);
  }
  insuranceOptions(): string[] {
    return withCurrent(this.settings.insuranceOptions(), this.form?.insuranceName);
  }
  ncdOptions = NCD_OPTIONS;
  tenureOptions = TENURE_OPTIONS;
  financingTypeOptions = FINANCING_TYPE_OPTIONS;
  cancelReasons = CANCEL_REASON_OPTIONS;

  form: EditCustomerInput = {};

  vehicleTitle = vehicleTitle;
  modelVariantLabel = modelVariantLabel;

  private effectiveStage(): CustomerStatus {
    return this.record.status === 'Cancelled' ? (this.record.previousStatus ?? 'Lead') : this.record.status;
  }

  /** The colour must be resolved by the time financing is confirmed — "To be Confirmed" is not a
   *  legal answer once In Progress or later, even though nothing forces it to be resolved earlier.
   *  Uses effectiveStage() so a Cancelled record inherits whichever stage it was cancelled from. */
  get showColourRequired(): boolean {
    const s = this.effectiveStage();
    return s === 'In Progress' || s === 'Delivered';
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

  get showBooking(): boolean {
    return this.effectiveStage() !== 'Lead';
  }

  private get isInProgressOrLater(): boolean {
    const s = this.effectiveStage();
    return s === 'In Progress' || s === 'Delivered';
  }

  get showTradeIn(): boolean {
    const s = this.effectiveStage();
    return s === 'Booked' || s === 'In Progress' || s === 'Delivered';
  }

  get showFinancing(): boolean {
    return this.isInProgressOrLater;
  }

  get showDelivery(): boolean {
    return this.isInProgressOrLater;
  }

  private get showDocuments(): boolean {
    return this.showBooking;
  }

  /** Document Status has no dedicated fieldset — it lives inside whichever section already
   *  covers financing at the record's stage: Booking & Payment pre-approval, Financing once set. */
  get showDocumentsInBooking(): boolean {
    return this.showDocuments && this.effectiveStage() === 'Booked';
  }

  get showDocumentsInFinancing(): boolean {
    return this.showDocuments && this.isInProgressOrLater;
  }

  /** Reads the live form, not the record, so flipping the dropdown in this same modal updates
   *  dependent fields (Documents, Payment Status vs Down Payment) immediately. */
  get isCashInForm(): boolean {
    return this.form.financingType === 'Cash';
  }

  get showCancellation(): boolean {
    return this.record.status === 'Cancelled';
  }

  ngOnInit() {
    const r = this.record;
    this.form = {
      name: r.name,
      phone: r.phone,
      icNo: r.icNo,
      address: r.address,
      email: r.email,
      drivingLicenceNo: r.drivingLicenceNo,
      sourceType: r.sourceType,
      colour: this.showColourRequired && r.colour === TO_BE_CONFIRMED_COLOUR ? '' : r.colour,
      downpayment: r.downpayment,
      ncd: r.ncd,
      tradeInStatus: r.tradeInStatus ?? 'No Trade-in',
      tradeInVehicle: r.tradeInVehicle,
      tradeInValue: r.tradeInValue,
      documentStatus: r.documentStatus,
      financingType: r.financingType,
      bankPanel: r.bankPanel,
      loanAmount: r.loanAmount,
      loanTenureMonths: r.loanTenureMonths,
      loanInterestRate: r.loanInterestRate,
      insuranceName: r.insuranceName,
      plateNo: r.plateNo,
      deliveryDate: r.deliveryDate,
      chassisNo: r.chassisNo,
      engineNo: r.engineNo,
      deliveryNotes: r.deliveryNotes,
      cancelReason: r.cancelReason,
      cancelNotes: r.cancelNotes,
    };
  }

  /** Colour is the field most likely to be the reason this modal was opened (the In Progress /
   *  Delivered gates block on it) — if it's still unresolved, draw the advisor's eye straight to
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

  docLabel(d: DocumentStatus): string {
    return (DOCUMENT_STATUS_META[d] ?? DOCUMENT_STATUS_META.NO).label;
  }

  submit() {
    this.save.emit(this.form);
  }
}
