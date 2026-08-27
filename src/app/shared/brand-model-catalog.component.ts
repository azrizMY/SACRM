import { Component, EventEmitter, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { SettingsService } from './settings.service';
import { VehicleCatalogService } from './vehicle-catalog.service';
import { deleteBrochure, loadAllBrochures, saveBrochure } from './brochure-store';
import { brandInitials, brandStyle } from '../data/dashboard-data';
import { modelVariantLabel, variantLabel, type Powertrain, type Vehicle } from '../data/calculator-data';

const POWERTRAINS: Powertrain[] = ['ICE', 'HEV', 'PHEV', 'BEV'];
const MAX_LOGO_BYTES = 400 * 1024;
const MAX_BROCHURE_BYTES = 10 * 1024 * 1024;

type ModelForm = {
  model: string;
  variant: string;
  engine: string;
  seater: number | null;
  transmission: string;
  powertrain: Powertrain;
  drivetrain: string;
};

function blankModelForm(): ModelForm {
  return { model: '', variant: '', engine: '', seater: 5, transmission: '', powertrain: 'ICE', drivetrain: '' };
}

/**
 * Owns brand identity: brand names, logos, and every model/variant/spec row — everything that
 * describes what a car IS, as opposed to what it costs (that's the Car Database). Opened from
 * Account Settings alongside the Car Database; both read/write the same VehicleCatalogService so
 * a brand or model created here shows up there immediately, ready to be priced.
 */
@Component({
  selector: 'app-brand-model-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></button>
      <div class="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <!-- Header -->
        <div class="flex flex-wrap items-start gap-3 border-b border-border p-4">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <app-icon name="sparkles" [size]="16" />
          </span>
          <div class="flex flex-col">
            <span class="text-sm font-semibold">Brand &amp; Model Catalog</span>
            <span class="text-xs text-muted-foreground">Brands, logos, models, variants and spec — pricing lives in the Car Database.</span>
          </div>
          <button type="button" (click)="close.emit()" aria-label="Close" class="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <app-icon name="x" [size]="16" />
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col sm:flex-row">
          <!-- Brands rail -->
          <div class="flex w-full shrink-0 flex-col gap-3 border-b border-border p-4 sm:max-h-none sm:w-64 sm:overflow-y-auto sm:border-b-0 sm:border-r">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Brands</span>
            <div class="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-x-visible sm:pb-0">
              @for (b of catalog.brands(); track b) {
                <button
                  type="button"
                  (click)="selectedBrand.set(b)"
                  class="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors sm:w-auto"
                  [ngClass]="selectedBrand() === b ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'"
                >
                  <div class="flex size-12 items-center justify-center overflow-hidden rounded-lg" [style.backgroundColor]="brandLogoFor(b) ? 'transparent' : styleFor(b).bg">
                    @if (brandLogoFor(b); as logo) {
                      <img [src]="logo" [alt]="b" class="size-full object-cover" />
                    } @else {
                      <span class="text-sm font-bold" [style.color]="styleFor(b).fg">{{ initialsFor(b) }}</span>
                    }
                  </div>
                  <span class="w-full truncate text-xs font-medium">{{ b }}</span>
                  <span class="text-[10px] text-muted-foreground">{{ countFor(b) }} car{{ countFor(b) === 1 ? '' : 's' }}</span>
                </button>
              }
              <button
                type="button"
                (click)="openAddBrand()"
                class="flex w-20 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-2.5 text-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto"
              >
                <span class="flex size-12 items-center justify-center rounded-lg border border-dashed border-border">
                  <app-icon name="plus" [size]="18" />
                </span>
                <span class="text-xs font-medium">Add Brand</span>
              </button>
            </div>
          </div>

          <!-- Selected brand: logo + models/variants -->
          <div class="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
            @if (!selectedBrand()) {
              <p class="text-sm text-muted-foreground">Select a brand on the left, or add a new one.</p>
            } @else {
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div
                    class="group relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border transition-colors hover:border-primary"
                    [ngClass]="dragActive() ? 'border-primary bg-primary/5' : ''"
                    (click)="logoFileInput.click()"
                    (dragover)="onLogoDragOver($event)"
                    (dragleave)="dragActive.set(false)"
                    (drop)="onLogoDrop($event)"
                  >
                    @if (brandLogoFor(selectedBrand()!); as logo) {
                      <img [src]="logo" [alt]="selectedBrand()!" class="size-full object-cover" />
                    } @else {
                      <span
                        class="flex size-full items-center justify-center text-lg font-bold"
                        [style.color]="styleFor(selectedBrand()!).fg"
                        [style.backgroundColor]="styleFor(selectedBrand()!).bg"
                      >
                        {{ initialsFor(selectedBrand()!) }}
                      </span>
                    }
                    <div class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <app-icon name="upload" [size]="16" class="text-white" />
                    </div>
                    <input #logoFileInput type="file" accept="image/*" class="hidden" (change)="onLogoFileChange($event)" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-base font-semibold">{{ selectedBrand() }}</span>
                    <span class="text-xs text-muted-foreground">Click or drop an image to {{ brandLogoFor(selectedBrand()!) ? 'replace' : 'add' }} its logo</span>
                    @if (brandLogoFor(selectedBrand()!)) {
                      <button type="button" (click)="removeLogo()" class="flex w-fit items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-[var(--destructive)]">
                        <app-icon name="trash" [size]="11" />
                        Remove logo
                      </button>
                    }
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  @if (countFor(selectedBrand()!) === 0) {
                    <button type="button" (click)="removeBrand()" class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                      <app-icon name="trash" [size]="13" />
                      Remove Brand
                    </button>
                  }
                  <button type="button" (click)="openAddModel()" class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                    <app-icon name="plus" [size]="14" />
                    Add Model
                  </button>
                </div>
              </div>

              @if (logoError()) {
                <p class="mt-2 text-xs text-[var(--destructive)]">{{ logoError() }}</p>
              }

              <div class="mt-5 flex flex-col gap-3">
                @for (m of modelsForSelectedBrand(); track m) {
                  <div class="overflow-hidden rounded-lg border border-border">
                    <div class="border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold">{{ m }}</div>
                    <div class="flex flex-col divide-y divide-border">
                      @for (v of variantRowsForModel(m); track v.id) {
                        <div class="flex flex-col gap-2 p-3">
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-sm font-medium">{{ variantLabel(v.variant) || '-' }}</span>
                            <div class="flex items-center gap-1">
                              <button
                                type="button"
                                (click)="toggleOffers(v.id)"
                                title="What's Included checklist"
                                aria-label="Edit What's Included checklist"
                                class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                [ngClass]="offersExpandedId() === v.id ? 'border-primary text-primary' : ''"
                              >
                                <app-icon name="gift" [size]="13" />
                              </button>
                              <button
                                type="button"
                                (click)="toggleBrochure(v.id)"
                                title="Brochure PDF"
                                aria-label="Manage brochure PDF"
                                class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                [ngClass]="brochureExpandedId() === v.id ? 'border-primary text-primary' : ''"
                              >
                                <app-icon name="file-text" [size]="13" />
                              </button>
                              <button
                                type="button"
                                (click)="requestRemoveVariant(v)"
                                title="Remove variant"
                                aria-label="Remove variant"
                                class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]"
                              >
                                <app-icon name="trash" [size]="13" />
                              </button>
                            </div>
                          </div>
                          <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                              Engine
                              <input type="text" [ngModel]="v.engine" (ngModelChange)="onSpecChange(v, 'engine', $event)" class="h-8 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-ring" />
                            </label>
                            <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                              Seater
                              <input type="number" min="1" step="1" [ngModel]="v.seater" (ngModelChange)="onSeaterChange(v, $event)" class="h-8 rounded border border-border bg-input px-2 text-xs tabular text-foreground outline-none focus:border-ring" />
                            </label>
                            <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                              Transmission
                              <input type="text" [ngModel]="v.transmission" (ngModelChange)="onSpecChange(v, 'transmission', $event)" class="h-8 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-ring" />
                            </label>
                            <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                              Powertrain
                              <select [ngModel]="v.powertrain" (ngModelChange)="onPowertrainChange(v, $event)" class="h-8 rounded border border-border bg-input px-1 text-xs text-foreground outline-none focus:border-ring">
                                @for (p of powertrains; track p) { <option [value]="p">{{ p }}</option> }
                              </select>
                            </label>
                            <label class="flex flex-col gap-1 text-[10px] font-medium text-muted-foreground">
                              Drivetrain
                              <input type="text" [ngModel]="v.drivetrain" placeholder="—" (ngModelChange)="onSpecChange(v, 'drivetrain', $event)" class="h-8 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-ring" />
                            </label>
                          </div>
                          @if (offersExpandedId() === v.id) {
                            <div class="mt-1 flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                              <div class="flex items-center justify-between">
                                <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What's Included</span>
                                <button type="button" (click)="addOfferItem(v)" class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                                  <app-icon name="plus" [size]="11" />
                                  Add item
                                </button>
                              </div>
                              <div class="flex flex-col gap-1.5">
                                @for (item of offersFor(v); track $index) {
                                  <div class="flex items-center gap-2">
                                    <input
                                      type="text"
                                      [ngModel]="item"
                                      (ngModelChange)="updateOfferItem(v, $index, $event)"
                                      placeholder="e.g. 7-yr / 150,000km warranty"
                                      class="h-8 flex-1 rounded border border-border bg-input px-2 text-xs text-foreground outline-none focus:border-ring"
                                    />
                                    <button type="button" (click)="removeOfferItem(v, $index)" title="Remove item" aria-label="Remove item" class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
                                      <app-icon name="trash" [size]="12" />
                                    </button>
                                  </div>
                                } @empty {
                                  <p class="text-xs text-muted-foreground">No items — this variant's Quote Preview checklist stays hidden until you add one.</p>
                                }
                              </div>
                            </div>
                          }
                          @if (brochureExpandedId() === v.id) {
                            <div class="mt-1 flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                              <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Brochure PDF</span>
                              @if (brochureNameFor(v); as name) {
                                <div class="flex items-center gap-2">
                                  <app-icon name="file-text" [size]="13" class="shrink-0 text-muted-foreground" />
                                  <span class="min-w-0 flex-1 truncate text-xs">{{ name }}</span>
                                  <button type="button" (click)="brochureFileInput.click()" class="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                                    Replace
                                  </button>
                                  <button
                                    type="button"
                                    (click)="removeBrochureFor(v)"
                                    title="Remove brochure"
                                    aria-label="Remove brochure"
                                    class="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]"
                                  >
                                    <app-icon name="trash" [size]="12" />
                                  </button>
                                </div>
                              } @else {
                                <div class="flex items-center gap-2">
                                  <span class="flex-1 text-xs text-muted-foreground">No brochure uploaded — My Cars will show this variant with no brochure.</span>
                                  <button type="button" (click)="brochureFileInput.click()" class="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                                    Upload
                                  </button>
                                </div>
                              }
                              @if (brochureError()) {
                                <p class="text-[11px] text-[var(--destructive)]">{{ brochureError() }}</p>
                              }
                              <input #brochureFileInput type="file" accept="application/pdf" class="hidden" (change)="onBrochureFileChange($event, v)" />
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @empty {
                  <p class="text-sm text-muted-foreground">No models yet — add one to get started.</p>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Add Brand -->
    @if (addingBrand()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="addingBrand.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Add Brand</span>
            <button type="button" (click)="addingBrand.set(false)" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 p-4">
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Brand Name
              <input type="text" [(ngModel)]="newBrandName" placeholder="e.g. Mazda" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <p class="text-[11px] text-muted-foreground">You can upload its logo and add models right after — no car is needed to create the brand.</p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="addingBrand.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitAddBrand()" [disabled]="!newBrandName.trim()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              Add Brand
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Add Model -->
    @if (addingModel()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="addingModel.set(false)"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Add Model — {{ selectedBrand() }}</span>
            <button type="button" (click)="addingModel.set(false)" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Model
                <input type="text" [(ngModel)]="modelForm.model" placeholder="e.g. Myvi" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Variant
                <input type="text" [(ngModel)]="modelForm.variant" placeholder="leave blank or use &quot;-&quot; if there's only one" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Price and every other financing figure are set afterward in the Car Database — this just creates the car's identity.
            </p>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Powertrain
                <select [(ngModel)]="modelForm.powertrain" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (p of powertrains; track p) { <option [value]="p">{{ p }}</option> }
                </select>
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Seater
                <input type="number" min="1" step="1" [(ngModel)]="modelForm.seater" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Engine
                <input type="text" [(ngModel)]="modelForm.engine" placeholder="e.g. 1.5L" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Transmission
                <input type="text" [(ngModel)]="modelForm.transmission" placeholder="e.g. CVT" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Drivetrain (optional)
              <input type="text" [(ngModel)]="modelForm.drivetrain" placeholder="e.g. FWD" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="addingModel.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitAddModel()" [disabled]="!canSubmitModel()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              Add Model
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Remove variant confirm -->
    @if (removeTarget(); as target) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="removeTarget.set(null)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              Remove variant?
            </span>
            <p class="text-sm text-muted-foreground">
              This permanently removes <strong class="text-foreground">{{ modelVariantLabel(target.model, target.variant) }}</strong> and every model year and pricing row that goes with it. This can't be undone.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="removeTarget.set(null)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="confirmRemoveVariant()" class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90">
              Remove
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BrandModelCatalogComponent {
  @Output() close = new EventEmitter<void>();

  powertrains = POWERTRAINS;
  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;

  selectedBrand = signal<string | null>(null);
  offersExpandedId = signal<string | null>(null);
  brochureExpandedId = signal<string | null>(null);
  /** Filenames keyed by brand::model::variant — the brochure is the same PDF across every model
   *  year of a variant, so it's keyed by identity, not by any one year-row's vehicle id. */
  brochureNames = signal<Record<string, string>>({});
  brochureError = signal<string | null>(null);

  addingBrand = signal(false);
  newBrandName = '';

  addingModel = signal(false);
  modelForm: ModelForm = blankModelForm();

  removeTarget = signal<Vehicle | null>(null);

  dragActive = signal(false);
  logoError = signal<string | null>(null);

  constructor(
    public catalog: VehicleCatalogService,
    private settingsService: SettingsService,
  ) {
    const brands = this.catalog.brands();
    if (brands.length > 0) this.selectedBrand.set(brands[0]);
    loadAllBrochures()
      .then((stored) => {
        const map: Record<string, string> = {};
        for (const [key, entry] of Object.entries(stored)) map[key] = entry.fileName;
        this.brochureNames.set(map);
      })
      .catch((err) => this.brochureError.set(`Couldn't load saved brochures: ${err?.message ?? err}`));
  }

  countFor(brand: string): number {
    return this.catalog.vehicles().filter((v) => v.brand === brand).length;
  }

  brandLogoFor(brand: string): string | null {
    return this.settingsService.getBrandLogo(brand);
  }

  styleFor(brand: string) {
    return brandStyle(brand);
  }

  initialsFor(brand: string): string {
    return brandInitials(brand);
  }

  modelsForSelectedBrand = computed(() => {
    this.catalog.vehicles();
    const brand = this.selectedBrand();
    if (!brand) return [];
    return Array.from(new Set(this.catalog.vehicles().filter((v) => v.brand === brand).map((v) => v.model)));
  });

  /** One row per variant (newest year stands in for the whole variant) — spec is edited once and
   *  applied to every year-row via updateVariantSpec(). */
  variantRowsForModel(model: string): Vehicle[] {
    const brand = this.selectedBrand();
    if (!brand) return [];
    const byVariant = new Map<string, Vehicle>();
    for (const v of this.catalog.vehicles()) {
      if (v.brand !== brand || v.model !== model) continue;
      const existing = byVariant.get(v.variant);
      if (!existing || v.year > existing.year) byVariant.set(v.variant, v);
    }
    return Array.from(byVariant.values());
  }

  // ---------- Brands ----------

  openAddBrand() {
    this.newBrandName = '';
    this.addingBrand.set(true);
  }

  submitAddBrand() {
    const name = this.newBrandName.trim();
    if (!name) return;
    this.catalog.addBrand(name);
    this.selectedBrand.set(name);
    this.addingBrand.set(false);
  }

  removeBrand() {
    const brand = this.selectedBrand();
    if (!brand) return;
    this.catalog.removeBrand(brand);
    const remaining = this.catalog.brands();
    this.selectedBrand.set(remaining.length > 0 ? remaining[0] : null);
  }

  // ---------- Logo ----------

  onLogoDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onLogoDrop(event: DragEvent) {
    event.preventDefault();
    this.dragActive.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.applyLogoFile(file);
  }

  onLogoFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.applyLogoFile(file);
  }

  private applyLogoFile(file: File) {
    const brand = this.selectedBrand();
    if (!brand) return;
    if (!file.type.startsWith('image/')) {
      this.logoError.set(`"${file.name}" isn't an image file.`);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.logoError.set(`"${file.name}" is too large — keep logos under 400KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.logoError.set(null);
      this.settingsService.updateBrandLogo(brand, reader.result as string);
    };
    reader.onerror = () => this.logoError.set(`Couldn't read "${file.name}".`);
    reader.readAsDataURL(file);
  }

  removeLogo() {
    const brand = this.selectedBrand();
    if (brand) this.settingsService.removeBrandLogo(brand);
  }

  // ---------- Models & variants ----------

  openAddModel() {
    this.modelForm = blankModelForm();
    this.addingModel.set(true);
  }

  canSubmitModel(): boolean {
    return !!this.modelForm.model.trim();
  }

  submitAddModel() {
    const brand = this.selectedBrand();
    if (!brand || !this.canSubmitModel()) return;
    this.catalog.addVehicle({
      brand,
      model: this.modelForm.model.trim(),
      variant: this.modelForm.variant.trim(),
      year: new Date().getFullYear(),
      price: 0,
      engine: this.modelForm.engine.trim(),
      seater: this.modelForm.seater ?? 5,
      transmission: this.modelForm.transmission.trim(),
      powertrain: this.modelForm.powertrain,
      drivetrain: this.modelForm.drivetrain.trim() || undefined,
    });
    this.addingModel.set(false);
  }

  onSpecChange(v: Vehicle, field: 'engine' | 'transmission' | 'drivetrain', value: string) {
    this.catalog.updateVariantSpec(v.brand, v.model, v.variant, { [field]: value.trim() });
  }

  onSeaterChange(v: Vehicle, value: string) {
    const n = Number(value);
    this.catalog.updateVariantSpec(v.brand, v.model, v.variant, { seater: Number.isFinite(n) && n > 0 ? n : v.seater });
  }

  onPowertrainChange(v: Vehicle, value: Powertrain) {
    this.catalog.updateVariantSpec(v.brand, v.model, v.variant, { powertrain: value });
  }

  requestRemoveVariant(v: Vehicle) {
    this.removeTarget.set(v);
  }

  confirmRemoveVariant() {
    const target = this.removeTarget();
    if (!target) return;
    if (this.offersExpandedId() === target.id) this.offersExpandedId.set(null);
    if (this.brochureExpandedId() === target.id) this.brochureExpandedId.set(null);
    this.catalog.removeVariant(target.brand, target.model, target.variant);
    deleteBrochure(this.brochureKey(target));
    this.brochureNames.update((map) => {
      const { [this.brochureKey(target)]: _removed, ...rest } = map;
      return rest;
    });
    this.removeTarget.set(null);
  }

  // ---------- Brochure ----------

  private brochureKey(v: Vehicle): string {
    return `${v.brand}::${v.model}::${v.variant}`;
  }

  brochureNameFor(v: Vehicle): string | null {
    return this.brochureNames()[this.brochureKey(v)] ?? null;
  }

  toggleBrochure(id: string) {
    this.brochureExpandedId.set(this.brochureExpandedId() === id ? null : id);
  }

  async onBrochureFileChange(event: Event, v: Vehicle) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.brochureError.set(`"${file.name}" isn't a PDF.`);
      return;
    }
    if (file.size > MAX_BROCHURE_BYTES) {
      this.brochureError.set(`"${file.name}" is too large — keep brochures under 10MB.`);
      return;
    }
    this.brochureError.set(null);
    const key = this.brochureKey(v);
    await saveBrochure(key, file);
    this.brochureNames.update((map) => ({ ...map, [key]: file.name }));
  }

  async removeBrochureFor(v: Vehicle) {
    const key = this.brochureKey(v);
    await deleteBrochure(key);
    this.brochureNames.update((map) => {
      const { [key]: _removed, ...rest } = map;
      return rest;
    });
  }

  // ---------- What's Included ----------

  toggleOffers(id: string) {
    this.offersExpandedId.set(this.offersExpandedId() === id ? null : id);
  }

  offersFor(v: Vehicle): string[] {
    return this.settingsService.getVehicleOffers(v.id);
  }

  updateOfferItem(v: Vehicle, index: number, value: string) {
    const items = [...this.offersFor(v)];
    items[index] = value;
    this.settingsService.updateVehicleOffers(v.id, items);
  }

  addOfferItem(v: Vehicle) {
    this.settingsService.updateVehicleOffers(v.id, [...this.offersFor(v), '']);
  }

  removeOfferItem(v: Vehicle, index: number) {
    this.settingsService.updateVehicleOffers(
      v.id,
      this.offersFor(v).filter((_, i) => i !== index),
    );
  }
}
