import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { MODEL_YEARS, NCD_OPTIONS, TENURE_OPTIONS, VEHICLES, modelsForBrand, variantsForModel } from '../data/calculator-data';
import {
  BANK_OPTIONS,
  CANCEL_REASON_OPTIONS,
  COLOUR_OPTIONS,
  DOCUMENT_STATUS_META,
  DOCUMENT_STATUS_OPTIONS,
  FINANCING_TYPE_OPTIONS,
  INSURANCE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  REFUND_STATUS_OPTIONS,
  SOURCE_TYPES,
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
                  @for (s of sourceTypes; track s) { <option [value]="s">{{ s }}</option> }
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
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Brand
                <select [(ngModel)]="form.brand" (ngModelChange)="onBrandChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Model
                <select [(ngModel)]="form.model" (ngModelChange)="onModelChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (m of modelsForBrand(form.brand!); track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Variant
                <select [(ngModel)]="form.variant" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (v of variantsForModel(form.brand!, form.model!); track v) { <option [value]="v">{{ v }}</option> }
                </select>
              </label>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Year Made
              <select [(ngModel)]="form.yearMade" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (y of modelYears; track y) { <option [ngValue]="y">{{ y }}</option> }
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Colour @if (showColourRequired) { <span class="text-[var(--destructive)]">*</span> }
              <select [(ngModel)]="form.colour" class="h-10 w-full rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @if (showColourRequired && !form.colour) { <option value="">Select colour…</option> }
                @for (c of colourOptionsForForm; track c) { <option [value]="c">{{ c }}</option> }
              </select>
              @if (showColourRequired) {
                <span class="text-[10px] text-muted-foreground">Car's been delivered — pick the actual colour.</span>
              }
            </label>
          </fieldset>

          <!-- Payment -->
          @if (showBooking) {
            <fieldset class="flex flex-col gap-3">
              <legend class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment</legend>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Booking Fee (RM)
                <input type="number" min="0" step="100" [(ngModel)]="form.bookingFee" class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                @if (isCashInForm) {
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Payment Status
                    <select [(ngModel)]="form.paymentStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                      @for (p of paymentStatusOptions; track p) { <option [value]="p">{{ p }}</option> }
                    </select>
                  </label>
                } @else {
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
              @if (form.financingType === 'Loan') {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Down Payment Status
                  <select [(ngModel)]="form.downPaymentStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (p of paymentStatusOptions; track p) { <option [value]="p">{{ p }}</option> }
                  </select>
                </label>
              }
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
                      @for (b of bankOptions; track b) { <option [value]="b">{{ b }}</option> }
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
                  Insurance
                  <select [(ngModel)]="form.insuranceName" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (i of insuranceOptions; track i) { <option [value]="i">{{ i }}</option> }
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
              @if (record.refundStatus) {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Refund Status
                  <select [(ngModel)]="form.refundStatus" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (s of refundStatusOptions; track s) { <option [value]="s">{{ s }}</option> }
                  </select>
                </label>
              }
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
export class CustomerEditModalComponent implements OnInit {
  @Input({ required: true }) record!: CustomerRecord;
  @Output() save = new EventEmitter<EditCustomerInput>();
  @Output() close = new EventEmitter<void>();

  sourceTypes = SOURCE_TYPES;
  colourOptions = COLOUR_OPTIONS;
  tradeInOptions = TRADE_IN_OPTIONS;
  documentStatusOptions = DOCUMENT_STATUS_OPTIONS;
  bankOptions = BANK_OPTIONS;
  insuranceOptions = INSURANCE_OPTIONS;
  ncdOptions = NCD_OPTIONS;
  tenureOptions = TENURE_OPTIONS;
  modelYears = MODEL_YEARS;
  brands: string[] = Array.from(new Set(VEHICLES.map((v) => v.brand)));
  financingTypeOptions = FINANCING_TYPE_OPTIONS;
  paymentStatusOptions = PAYMENT_STATUS_OPTIONS;
  refundStatusOptions = REFUND_STATUS_OPTIONS;
  cancelReasons = CANCEL_REASON_OPTIONS;

  form: EditCustomerInput = {};

  modelsForBrand = modelsForBrand;
  variantsForModel = variantsForModel;

  private effectiveStage(): CustomerStatus {
    return this.record.status === 'Cancelled' ? (this.record.previousStatus ?? 'Lead') : this.record.status;
  }

  /** The physical car has a real colour by the time it's handed over — "To be Confirmed" is not
   *  a legal final answer once Delivered, even though nothing forces it to be resolved earlier. */
  get showColourRequired(): boolean {
    return this.record.status === 'Delivered';
  }

  get colourOptionsForForm(): string[] {
    return this.showColourRequired ? COLOUR_OPTIONS.filter((c) => c !== TO_BE_CONFIRMED_COLOUR) : COLOUR_OPTIONS;
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
      brand: r.brand,
      model: r.model,
      variant: r.variant,
      yearMade: r.yearMade,
      colour: this.showColourRequired && r.colour === TO_BE_CONFIRMED_COLOUR ? '' : r.colour,
      bookingFee: r.bookingFee,
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
      paymentStatus: r.paymentStatus,
      downPaymentStatus: r.downPaymentStatus,
      insuranceName: r.insuranceName,
      plateNo: r.plateNo,
      deliveryDate: r.deliveryDate,
      chassisNo: r.chassisNo,
      engineNo: r.engineNo,
      deliveryNotes: r.deliveryNotes,
      cancelReason: r.cancelReason,
      cancelNotes: r.cancelNotes,
      refundStatus: r.refundStatus,
    };
  }

  onBrandChange(brand: string) {
    this.form.brand = brand;
    const firstModel = this.modelsForBrand(brand)[0];
    this.onModelChange(firstModel);
  }

  onModelChange(model: string) {
    this.form.model = model;
    this.form.variant = this.variantsForModel(this.form.brand!, model)[0];
  }

  docLabel(d: DocumentStatus): string {
    return (DOCUMENT_STATUS_META[d] ?? DOCUMENT_STATUS_META.NO).label;
  }

  submit() {
    this.save.emit(this.form);
  }
}
