import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { InsuranceQuotationEditorComponent } from '../shared/insurance-quotation-editor.component';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { deleteBrochure, loadAllBrochures, saveBrochure } from '../shared/brochure-store';
import { compressImageFile } from '../shared/image-compress';
import { brandInitials, brandStyle } from '../data/dashboard-data';
import {
  basicPremiumDefault,
  formatRM,
  modelVariantLabel,
  modelsForBrand,
  variantLabel,
  variantsForModel,
  yearsForVariant,
  type Vehicle,
} from '../data/calculator-data';

const MAX_BROCHURE_BYTES = 10 * 1024 * 1024;

/** Everything the editor panel can change for one vehicle row — all specific to this one year's
 *  pricing row. Basic Premium and Add Benefits aren't here — they're set via the Itemized
 *  Insurance Quotation section instead, which already covers them. */
type PanelForm = {
  price: number;
  rebate: number | null;
  additionalRebate: number | null;
  interestRate: number | null;
  effectiveRate: number | null;
};

function pickForm(v: Vehicle): PanelForm {
  return {
    price: v.price,
    rebate: v.rebate ?? null,
    additionalRebate: v.additionalRebate ?? null,
    interestRate: v.interestRate ?? null,
    effectiveRate: v.effectiveRate ?? null,
  };
}

type ModelForm = {
  brand: string;
  model: string;
  variant: string;
  year: number;
};

function blankModelForm(brand: string, year: number): ModelForm {
  return { brand, model: '', variant: '', year };
}

type PricingForm = {
  brand: string;
  model: string;
  variant: string;
  year: number;
  price: number | null;
  interestRate: number | null;
  basicPremium: number | null;
  addBenefits: number | null;
  rebate: number | null;
  additionalRebate: number | null;
};

function blankPricingForm(brand: string): PricingForm {
  return {
    brand,
    model: '',
    variant: '',
    year: new Date().getFullYear(),
    price: null,
    interestRate: null,
    basicPremium: null,
    addBenefits: null,
    rebate: null,
    additionalRebate: null,
  };
}

type ModelGroup = { model: string; rows: Vehicle[] };
type BrandGroup = { brand: string; models: ModelGroup[] };

/**
 * One place for everything about a car: identity (brand, model, variant, brochure, "What's
 * Included") and every year's pricing (price, rebate, rates, itemized insurance) — the merged
 * replacement for the old Brand & Model Catalog + Car Database pair. Grouped by brand then model,
 * one row per model year; tap a row to edit it.
 *
 * The edit panel stages pricing edits locally and only writes them through VehicleCatalogService
 * on Save — closing with unsaved edits prompts save-or-discard. Logo, brochure, What's Included,
 * and the itemized insurance quotation stay instant, each already its own upload/checklist action
 * rather than a typed field.
 */
@Component({
  selector: 'app-price-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, InsuranceQuotationEditorComponent],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-semibold tracking-tight">Price Settings</h2>
        <p class="text-pretty text-sm text-muted-foreground">Brands, models, brochures, and every year's pricing — all in one place. Feeds the Calculator and every quote automatically.</p>
      </div>

      <!-- Brand filter -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          [attr.aria-selected]="brandFilter() === 'All'"
          (click)="brandFilter.set('All')"
          class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
          [ngClass]="brandFilter() === 'All' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
        >
          All ({{ catalog.vehicles().length }})
        </button>
        @for (b of catalog.brands(); track b) {
          <button
            type="button"
            [attr.aria-selected]="brandFilter() === b"
            (click)="brandFilter.set(b)"
            class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            [ngClass]="brandFilter() === b ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
          >
            <span class="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full" [style.backgroundColor]="brandLogoFor(b) ? 'transparent' : styleFor(b).bg">
              @if (brandLogoFor(b); as logo) {
                <img [src]="logo" [alt]="b" class="size-full object-cover" />
              } @else {
                <span class="text-[8px] font-bold" [style.color]="styleFor(b).fg">{{ initialsFor(b) }}</span>
              }
            </span>
            {{ b }} ({{ countForBrand(b) }})
          </button>
        }
        <button
          type="button"
          (click)="openAddBrand()"
          class="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <app-icon name="plus" [size]="12" />
          Add Brand
        </button>
      </div>

      <!-- Manage brand: logo + remove, only for a specific brand -->
      @if (brandFilter() !== 'All') {
        <div class="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div
            class="group relative flex size-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border transition-colors hover:border-primary"
            [ngClass]="dragActive() ? 'border-primary bg-primary/5' : ''"
            (click)="logoFileInput.click()"
            (dragover)="onLogoDragOver($event)"
            (dragleave)="dragActive.set(false)"
            (drop)="onLogoDrop($event)"
          >
            @if (brandLogoFor(brandFilter()); as logo) {
              <img [src]="logo" [alt]="brandFilter()" class="size-full object-cover" />
            } @else {
              <span class="flex size-full items-center justify-center text-sm font-bold" [style.color]="styleFor(brandFilter()).fg" [style.backgroundColor]="styleFor(brandFilter()).bg">
                {{ initialsFor(brandFilter()) }}
              </span>
            }
            <div class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <app-icon name="upload" [size]="14" class="text-white" />
            </div>
            <input #logoFileInput type="file" accept="image/*" class="hidden" (change)="onLogoFileChange($event)" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-sm font-semibold">{{ brandFilter() }}</span>
            <span class="text-xs text-muted-foreground">Click or drop an image to {{ brandLogoFor(brandFilter()) ? 'replace' : 'add' }} its logo</span>
            @if (brandLogoFor(brandFilter())) {
              <button type="button" (click)="removeLogo()" class="flex w-fit items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-[var(--destructive)]">
                <app-icon name="trash" [size]="11" />
                Remove logo
              </button>
            }
          </div>
          @if (countForBrand(brandFilter()) === 0) {
            <button type="button" (click)="removeBrand()" class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
              <app-icon name="trash" [size]="13" />
              Remove Brand
            </button>
          }
          <button type="button" (click)="openAddModel()" class="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            <app-icon name="plus" [size]="13" />
            Add Model
          </button>
        </div>
        @if (logoError()) {
          <p class="text-xs text-[var(--destructive)]">{{ logoError() }}</p>
        }
      }

      <!-- Search -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <app-icon name="search" [size]="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search car…"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            class="h-10 w-full rounded-lg border border-input bg-input pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>
        <button
          type="button"
          (click)="openAddPricing()"
          class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <app-icon name="plus" [size]="13" />
          Add Pricing
        </button>
      </div>

      <span class="text-xs font-semibold text-muted-foreground">{{ totalRows() }} car{{ totalRows() === 1 ? '' : 's' }}</span>

      <!-- List -->
      <div class="flex flex-col gap-5">
        @for (brandGroup of groups(); track brandGroup.brand) {
          <div class="flex flex-col gap-3">
            <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{ brandGroup.brand }}</span>
            @for (modelGroup of brandGroup.models; track modelGroup.model) {
              <div class="flex flex-col gap-2">
                <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{{ modelGroup.model }}</span>
                <div class="flex flex-col gap-2">
                  @for (v of modelGroup.rows; track v.id) {
                    <button
                      type="button"
                      (click)="openEditor(v)"
                      class="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-accent/60"
                    >
                      <div class="flex min-w-0 flex-col gap-1">
                        <span class="truncate text-sm font-semibold text-foreground">
                          {{ variantLabel(v.variant) || modelGroup.model }}
                          <span class="font-normal text-muted-foreground">— {{ v.year }}</span>
                        </span>
                        <span class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>Price <strong class="font-semibold text-foreground">{{ fmt(v.price) }}</strong></span>
                          <span>Insurance <strong class="font-semibold text-foreground">{{ v.basicPremium != null ? fmt(v.basicPremium) : 'Auto' }}</strong></span>
                          <span>Rate <strong class="font-semibold text-foreground">{{ v.interestRate != null ? v.interestRate + '%' : 'Default' }}</strong></span>
                        </span>
                      </div>
                      <app-icon name="chevron-right" [size]="16" class="shrink-0 text-muted-foreground" />
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        } @empty {
          <p class="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No cars match. Add a model above, then price it here.
          </p>
        }
      </div>
    </div>

    <!-- Editor panel -->
    @if (selected(); as v) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="requestClose()"></button>
        <div class="relative flex h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-start justify-between gap-3 border-b border-border p-4">
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-sm font-semibold">{{ modelVariantLabel(v.model, v.variant) }}</span>
              <span class="text-xs text-muted-foreground">{{ v.brand }} · {{ v.year }}</span>
            </div>
            <button type="button" (click)="requestClose()" aria-label="Close" class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>

          <!-- Unsaved changes bar -->
          @if (dirty()) {
            <div class="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-2">
              <span class="flex items-center gap-1.5 text-xs font-medium text-primary">
                <app-icon name="alert-triangle" [size]="13" />
                Unsaved changes
              </span>
            </div>
          } @else if (savedFlash()) {
            <div class="flex items-center gap-1.5 border-b border-border bg-[var(--success)]/5 px-4 py-2 text-xs font-medium text-[var(--success)]">
              <app-icon name="check" [size]="13" />
              Saved
            </div>
          }

          <div class="flex flex-col gap-5 overflow-y-auto p-4">
            <!-- Pricing (this year only) -->
            <div class="flex flex-col gap-3">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</span>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Price (RM)
                <input type="number" min="0" step="100" [ngModel]="form().price" (ngModelChange)="setPrice($event)" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Rebate (RM)
                  <input type="number" min="0" step="500" [ngModel]="form().rebate" (ngModelChange)="setOptionalField('rebate', $event)" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Additional Rebate (RM)
                  <input type="number" min="0" step="500" [ngModel]="form().additionalRebate" (ngModelChange)="setOptionalField('additionalRebate', $event)" placeholder="—" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Interest Rate — Flat (%)
                  <input type="number" min="0" step="0.1" [ngModel]="form().interestRate" (ngModelChange)="setOptionalField('interestRate', $event)" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Effective Rate — EIR (%)
                  <input type="number" min="0" step="0.1" [ngModel]="form().effectiveRate" (ngModelChange)="setOptionalField('effectiveRate', $event)" placeholder="Not set" class="h-10 rounded-lg border border-input bg-input px-3 text-sm tabular text-foreground outline-none focus:border-ring" />
                </label>
              </div>
              <p class="text-[11px] text-muted-foreground">
                Effective rate is a separate, independently-quoted figure — not calculated from the flat rate above. Basic Premium and Add Benefits are set
                in the Itemized Insurance Quotation below.
              </p>
            </div>

            <!-- Car Photo -->
            <div class="flex flex-col gap-2">
              <button
                type="button"
                (click)="togglePhoto()"
                class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <span class="flex items-center gap-2">
                  <app-icon name="car" [size]="14" />
                  Car Photo
                </span>
                <app-icon [name]="photoExpanded() ? 'chevron-down' : 'chevron-right'" [size]="14" />
              </button>
              @if (photoExpanded()) {
                <div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-card"
                      [ngClass]="v.imageUrl ? 'border-solid' : ''"
                    >
                      @if (v.imageUrl) {
                        <img [src]="v.imageUrl" [alt]="modelVariantLabel(v.model, v.variant)" class="size-full object-cover" />
                      } @else {
                        <app-icon name="car" [size]="20" class="text-muted-foreground" />
                      }
                    </div>
                    <div class="flex min-w-0 flex-1 flex-col gap-1">
                      <span class="text-xs text-muted-foreground">
                        {{ v.imageUrl ? "Shown as the hero image on this year's Quote Preview poster." : 'No photo — the poster falls back to a plain background for this year.' }}
                      </span>
                      <div class="flex items-center gap-2">
                        <button type="button" (click)="photoFileInput.click()" class="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                          {{ v.imageUrl ? 'Replace' : 'Upload' }}
                        </button>
                        @if (v.imageUrl) {
                          <button type="button" (click)="removePhotoFor(v)" class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-[var(--destructive)]">
                            <app-icon name="trash" [size]="11" />
                            Remove
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                  @if (photoError()) {
                    <p class="text-[11px] text-[var(--destructive)]">{{ photoError() }}</p>
                  }
                  <input #photoFileInput type="file" accept="image/*" class="hidden" (change)="onPhotoFileChange($event, v)" />
                </div>
              }
            </div>

            <!-- Itemized insurance quotation -->
            <div class="flex flex-col gap-2">
              <button
                type="button"
                (click)="toggleInsurance()"
                class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <span class="flex items-center gap-2">
                  <app-icon name="shield-check" [size]="14" />
                  Itemized Insurance Quotation
                </span>
                <app-icon [name]="insuranceExpanded() ? 'chevron-down' : 'chevron-right'" [size]="14" />
              </button>
              @if (insuranceExpanded()) {
                <div class="rounded-md border border-border bg-muted/20 p-3">
                  <app-insurance-quotation-editor [vehicle]="v" [ncdPct]="ncdPct()" [fallbackBasicPremium]="fallbackBasicPremiumFor(v)" />
                </div>
              }
            </div>

            <!-- What's Included -->
            <div class="flex flex-col gap-2">
              <button
                type="button"
                (click)="toggleOffers()"
                class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <span class="flex items-center gap-2">
                  <app-icon name="gift" [size]="14" />
                  What's Included
                </span>
                <app-icon [name]="offersExpanded() ? 'chevron-down' : 'chevron-right'" [size]="14" />
              </button>
              @if (offersExpanded()) {
                <div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Checklist items</span>
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
            </div>

            <!-- Brochure -->
            <div class="flex flex-col gap-2">
              <button
                type="button"
                (click)="toggleBrochure()"
                class="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <span class="flex items-center gap-2">
                  <app-icon name="file-text" [size]="14" />
                  Brochure PDF
                </span>
                <app-icon [name]="brochureExpanded() ? 'chevron-down' : 'chevron-right'" [size]="14" />
              </button>
              @if (brochureExpanded()) {
                <div class="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
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
                      <span class="flex-1 text-xs text-muted-foreground">No brochure uploaded — Brochures will show this variant with no brochure.</span>
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
          </div>

          <div class="flex flex-wrap items-center gap-2 border-t border-border p-4">
            <button type="button" (click)="requestRemove()" class="mr-auto flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-[var(--destructive)] hover:text-[var(--destructive)]">
              <app-icon name="trash" [size]="13" />
              {{ isOnlyYearFor(v) ? 'Remove Variant' : 'Remove This Year' }}
            </button>
            <button type="button" (click)="resetForm()" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              Reset
            </button>
            <button type="button" (click)="save()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Save
            </button>
          </div>
        </div>
      </div>
    }

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
            <span class="text-sm font-semibold">Add Model — {{ modelForm.brand }}</span>
            <button type="button" (click)="addingModel.set(false)" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            @if (catalog.brands().length === 0) {
              <p class="text-sm text-muted-foreground">No brands yet — add one first.</p>
            } @else {
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Brand
                <select [(ngModel)]="modelForm.brand" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                  @for (b of catalog.brands(); track b) { <option [value]="b">{{ b }}</option> }
                </select>
              </label>
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
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Model Year
                <input type="number" min="1900" step="1" [(ngModel)]="modelForm.year" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
              </label>
              <p class="text-[11px] text-muted-foreground">
                Price and every other financing figure are set afterward by opening this car's row — this just creates its identity. Adding another year
                for this same variant later? Use Add Pricing instead — it reuses this brochure automatically.
              </p>
            }
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

    <!-- Add Pricing -->
    @if (addingPricing()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeAddPricing()"></button>
        <div class="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex items-center gap-3 border-b border-border p-4">
            <span class="text-sm font-semibold">Add Pricing</span>
            <button type="button" (click)="closeAddPricing()" aria-label="Close" class="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="flex flex-col gap-3 overflow-y-auto p-4">
            @if (catalog.brands().length === 0) {
              <p class="text-sm text-muted-foreground">No brands yet — add one first.</p>
            } @else {
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Brand
                  <select [ngModel]="pricingForm.brand" (ngModelChange)="onPricingBrandChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (b of catalog.brands(); track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Model
                  <select [ngModel]="pricingForm.model" (ngModelChange)="onPricingModelChange($event)" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (m of modelsForPricingBrand(); track m) { <option [value]="m">{{ m }}</option> }
                  </select>
                </label>
              </div>
              @if (modelsForPricingBrand().length === 0) {
                <p class="text-xs text-muted-foreground">This brand has no models yet — add one first.</p>
              } @else {
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Variant
                  <select [(ngModel)]="pricingForm.variant" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                    @for (v of variantsForPricingModel(); track v) { <option [value]="v">{{ variantLabel(v) || '-' }}</option> }
                  </select>
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Model Year
                    <input type="number" min="1900" step="1" [(ngModel)]="pricingForm.year" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Price (RM)
                    <input type="number" min="0" step="100" [(ngModel)]="pricingForm.price" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Optional overrides</p>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Interest Rate (%)
                    <input type="number" min="0" step="0.1" [(ngModel)]="pricingForm.interestRate" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Basic Premium (RM)
                    <input type="number" min="0" step="1" [(ngModel)]="pricingForm.basicPremium" placeholder="Auto from price" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Add Benefits (RM)
                  <input type="number" min="0" step="1" [(ngModel)]="pricingForm.addBenefits" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Rebate (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="pricingForm.rebate" placeholder="Use account default" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Additional Rebate (RM)
                    <input type="number" min="0" step="500" [(ngModel)]="pricingForm.additionalRebate" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
                  </label>
                </div>
              }
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeAddPricing()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="submitAddPricing()" [disabled]="!canSubmitAddPricing()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              Add Pricing
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Remove confirm -->
    @if (removeTarget(); as target) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="removeTarget.set(null)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              {{ isOnlyYearFor(target) ? 'Remove variant?' : 'Remove this year?' }}
            </span>
            @if (isOnlyYearFor(target)) {
              <p class="text-sm text-muted-foreground">
                This permanently removes <strong class="text-foreground">{{ modelVariantLabel(target.model, target.variant) }}</strong>, its brochure, and every model year and pricing row that goes with it. This can't be undone.
              </p>
            } @else {
              <p class="text-sm text-muted-foreground">
                This permanently removes the <strong class="text-foreground">{{ target.year }}</strong> pricing row for
                <strong class="text-foreground">{{ modelVariantLabel(target.model, target.variant) }}</strong>. Other model years and its brochure stay untouched. This can't be undone.
              </p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="removeTarget.set(null)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="confirmRemove()" class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90">
              Remove
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Unsaved changes on close -->
    @if (closeConfirm()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closeConfirm.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="alert-triangle" [size]="15" />
              Save changes before closing?
            </span>
            <p class="text-sm text-muted-foreground">You've edited this car's pricing that hasn't been saved yet. Save it, or discard it and close.</p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="closeConfirm.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="discardAndClose()" class="rounded-md border border-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10">
              Discard &amp; Close
            </button>
            <button type="button" (click)="saveAndClose()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Save &amp; Close
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PriceSettingsComponent {
  modelVariantLabel = modelVariantLabel;
  variantLabel = variantLabel;
  fmt = (v: number) => formatRM(v);

  search = signal('');
  brandFilter = signal('All');

  ncdPct = computed(() => this.settingsService.settings().salesDefaults.ncd);

  // ---------- Editor panel ----------

  selectedId = signal<string | null>(null);
  selected = computed(() => this.catalog.vehicles().find((v) => v.id === this.selectedId()) ?? null);
  form = signal<PanelForm>(pickForm({} as Vehicle));
  dirty = signal(false);
  savedFlash = signal(false);
  closeConfirm = signal(false);

  insuranceExpanded = signal(false);
  offersExpanded = signal(false);
  brochureExpanded = signal(false);
  photoExpanded = signal(false);
  photoError = signal<string | null>(null);

  removeTarget = signal<Vehicle | null>(null);

  // ---------- Brand management ----------

  dragActive = signal(false);
  logoError = signal<string | null>(null);
  addingBrand = signal(false);
  newBrandName = '';

  // ---------- Add Model / Add Pricing ----------

  addingModel = signal(false);
  modelForm: ModelForm = blankModelForm('', new Date().getFullYear());

  addingPricing = signal(false);
  pricingForm: PricingForm = blankPricingForm('');

  // ---------- Brochure store ----------

  /** Filenames keyed by brand::model::variant — the brochure is the same PDF across every model
   *  year of a variant, so it's keyed by identity, not by any one year-row's vehicle id. */
  brochureNames = signal<Record<string, string>>({});
  brochureError = signal<string | null>(null);

  constructor(
    public catalog: VehicleCatalogService,
    private settingsService: SettingsService,
  ) {
    loadAllBrochures()
      .then((stored) => {
        const map: Record<string, string> = {};
        for (const [key, entry] of Object.entries(stored)) map[key] = entry.fileName;
        this.brochureNames.set(map);
      })
      .catch((err) => this.brochureError.set(`Couldn't load saved brochures: ${err?.message ?? err}`));
  }

  private filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const brand = this.brandFilter();
    return this.catalog
      .vehicles()
      .filter((v) => (brand === 'All' || v.brand === brand) && (!q || `${v.brand} ${v.model} ${v.variant}`.toLowerCase().includes(q)));
  });

  totalRows = computed(() => this.filteredRows().length);

  countForBrand(brand: string): number {
    return this.catalog.vehicles().filter((v) => v.brand === brand).length;
  }

  groups = computed((): BrandGroup[] => {
    const byBrand = new Map<string, Map<string, Vehicle[]>>();
    for (const v of this.filteredRows()) {
      if (!byBrand.has(v.brand)) byBrand.set(v.brand, new Map());
      const models = byBrand.get(v.brand)!;
      if (!models.has(v.model)) models.set(v.model, []);
      models.get(v.model)!.push(v);
    }
    return Array.from(byBrand.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([brand, models]) => ({
        brand,
        models: Array.from(models.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([model, rows]) => ({
            model,
            rows: rows.sort((a, b) => a.variant.localeCompare(b.variant) || b.year - a.year),
          })),
      }));
  });

  isOnlyYearFor(v: Vehicle): boolean {
    return yearsForVariant(v.brand, v.model, v.variant).length <= 1;
  }

  fallbackBasicPremiumFor(v: Vehicle): number {
    return basicPremiumDefault(v.price, this.settingsService.settings().salesDefaults.basicPremiumRatePct);
  }

  // ---------- Editor panel ----------

  openEditor(v: Vehicle) {
    this.selectedId.set(v.id);
    this.form.set(pickForm(v));
    this.dirty.set(false);
    this.insuranceExpanded.set(false);
    this.offersExpanded.set(false);
    this.brochureExpanded.set(false);
    this.photoExpanded.set(false);
    this.photoError.set(null);
  }

  setPrice(value: string) {
    const n = Number(value);
    this.form.update((f) => ({ ...f, price: Number.isFinite(n) ? n : 0 }));
    this.dirty.set(true);
  }

  setOptionalField(field: 'rebate' | 'additionalRebate' | 'interestRate' | 'effectiveRate', value: string) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      this.form.update((f) => ({ ...f, [field]: null }));
      this.dirty.set(true);
      return;
    }
    const n = Number(trimmed);
    this.form.update((f) => ({ ...f, [field]: Number.isFinite(n) ? n : null }));
    this.dirty.set(true);
  }

  resetForm() {
    const v = this.selected();
    if (!v) return;
    this.form.set(pickForm(v));
    this.dirty.set(false);
  }

  save() {
    const v = this.selected();
    if (!v) return;
    const f = this.form();
    this.catalog.updateVehicle(v.id, {
      price: f.price,
      rebate: f.rebate ?? undefined,
      additionalRebate: f.additionalRebate ?? undefined,
      interestRate: f.interestRate ?? undefined,
      effectiveRate: f.effectiveRate ?? undefined,
    });
    this.dirty.set(false);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  requestClose() {
    if (this.dirty()) {
      this.closeConfirm.set(true);
      return;
    }
    this.selectedId.set(null);
  }

  saveAndClose() {
    this.save();
    this.closeConfirm.set(false);
    this.selectedId.set(null);
  }

  discardAndClose() {
    this.closeConfirm.set(false);
    this.dirty.set(false);
    this.selectedId.set(null);
  }

  toggleInsurance() {
    this.insuranceExpanded.set(!this.insuranceExpanded());
  }

  toggleOffers() {
    this.offersExpanded.set(!this.offersExpanded());
  }

  toggleBrochure() {
    this.brochureExpanded.set(!this.brochureExpanded());
  }

  togglePhoto() {
    this.photoExpanded.set(!this.photoExpanded());
  }

  // ---------- Car Photo ----------

  async onPhotoFileChange(event: Event, v: Vehicle) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.photoError.set(`"${file.name}" isn't an image file.`);
      return;
    }
    try {
      // PNG, not JPEG — dealer car cutouts are usually shot/rendered on a transparent background,
      // and JPEG has no alpha channel: it would flatten that transparency to solid black.
      const compressed = await compressImageFile(file, { maxDimension: 1280, maxBytes: 300 * 1024, format: 'image/png', trimTransparent: true });
      this.photoError.set(null);
      this.catalog.updateVehicle(v.id, { imageUrl: compressed });
    } catch {
      this.photoError.set(`Couldn't process "${file.name}".`);
    }
  }

  removePhotoFor(v: Vehicle) {
    this.photoError.set(null);
    this.catalog.updateVehicle(v.id, { imageUrl: undefined });
  }

  requestRemove() {
    const v = this.selected();
    if (v) this.removeTarget.set(v);
  }

  confirmRemove() {
    const target = this.removeTarget();
    if (!target) return;
    if (this.isOnlyYearFor(target)) {
      this.catalog.removeVariant(target.brand, target.model, target.variant);
      deleteBrochure(this.brochureKey(target));
      this.brochureNames.update((map) => {
        const { [this.brochureKey(target)]: _removed, ...rest } = map;
        return rest;
      });
    } else {
      this.catalog.removeVehicle(target.id);
    }
    this.removeTarget.set(null);
    this.selectedId.set(null);
  }

  // ---------- What's Included ----------

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

  // ---------- Brochure ----------

  private brochureKey(v: Vehicle): string {
    return `${v.brand}::${v.model}::${v.variant}`;
  }

  brochureNameFor(v: Vehicle): string | null {
    return this.brochureNames()[this.brochureKey(v)] ?? null;
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

  // ---------- Brand management ----------

  brandLogoFor(brand: string): string | null {
    return this.settingsService.getBrandLogo(brand);
  }

  styleFor(brand: string) {
    return brandStyle(brand);
  }

  initialsFor(brand: string): string {
    return brandInitials(brand);
  }

  openAddBrand() {
    this.newBrandName = '';
    this.addingBrand.set(true);
  }

  submitAddBrand() {
    const name = this.newBrandName.trim();
    if (!name) return;
    this.catalog.addBrand(name);
    this.brandFilter.set(name);
    this.addingBrand.set(false);
  }

  removeBrand() {
    const brand = this.brandFilter();
    if (brand === 'All') return;
    this.catalog.removeBrand(brand);
    this.brandFilter.set('All');
  }

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

  private async applyLogoFile(file: File) {
    const brand = this.brandFilter();
    if (brand === 'All') return;
    if (!file.type.startsWith('image/')) {
      this.logoError.set(`"${file.name}" isn't an image file.`);
      return;
    }
    try {
      // PNG, not JPEG — a logo's transparency needs to survive; only its dimensions get shrunk.
      const compressed = await compressImageFile(file, { maxDimension: 400, maxBytes: 200 * 1024, format: 'image/png' });
      this.logoError.set(null);
      this.settingsService.updateBrandLogo(brand, compressed);
    } catch {
      this.logoError.set(`Couldn't process "${file.name}".`);
    }
  }

  removeLogo() {
    const brand = this.brandFilter();
    if (brand !== 'All') this.settingsService.removeBrandLogo(brand);
  }

  // ---------- Add Model ----------

  openAddModel() {
    const defaultBrand = this.brandFilter() !== 'All' ? this.brandFilter() : (this.catalog.brands()[0] ?? '');
    this.modelForm = blankModelForm(defaultBrand, new Date().getFullYear());
    this.addingModel.set(true);
  }

  canSubmitModel(): boolean {
    return !!this.modelForm.brand && !!this.modelForm.model.trim() && !!this.modelForm.year && this.modelForm.year > 1900;
  }

  submitAddModel() {
    if (!this.canSubmitModel()) return;
    this.catalog.addVehicle({
      brand: this.modelForm.brand,
      model: this.modelForm.model.trim(),
      variant: this.modelForm.variant.trim(),
      year: this.modelForm.year,
      price: 0,
    });
    this.brandFilter.set(this.modelForm.brand);
    this.addingModel.set(false);
  }

  // ---------- Add Pricing ----------

  openAddPricing() {
    const defaultBrand = this.brandFilter() !== 'All' ? this.brandFilter() : (this.catalog.brands()[0] ?? '');
    this.pricingForm = blankPricingForm(defaultBrand);
    this.pricingForm.model = modelsForBrand(defaultBrand)[0] ?? '';
    this.pricingForm.variant = variantsForModel(defaultBrand, this.pricingForm.model)[0] ?? '';
    this.addingPricing.set(true);
  }

  closeAddPricing() {
    this.addingPricing.set(false);
  }

  modelsForPricingBrand(): string[] {
    return modelsForBrand(this.pricingForm.brand);
  }

  variantsForPricingModel(): string[] {
    return variantsForModel(this.pricingForm.brand, this.pricingForm.model);
  }

  onPricingBrandChange(brand: string) {
    this.pricingForm.brand = brand;
    this.pricingForm.model = modelsForBrand(brand)[0] ?? '';
    this.pricingForm.variant = variantsForModel(brand, this.pricingForm.model)[0] ?? '';
  }

  onPricingModelChange(model: string) {
    this.pricingForm.model = model;
    this.pricingForm.variant = variantsForModel(this.pricingForm.brand, model)[0] ?? '';
  }

  canSubmitAddPricing(): boolean {
    return !!this.pricingForm.brand && !!this.pricingForm.model && !!this.pricingForm.year && this.pricingForm.year > 1900 && !!this.pricingForm.price && this.pricingForm.price > 0;
  }

  submitAddPricing() {
    if (!this.canSubmitAddPricing()) return;
    const template = this.catalog
      .vehicles()
      .find((v) => v.brand === this.pricingForm.brand && v.model === this.pricingForm.model && v.variant === this.pricingForm.variant);
    if (!template) return;
    this.catalog.addVehicle({
      brand: this.pricingForm.brand,
      model: this.pricingForm.model,
      variant: this.pricingForm.variant,
      year: this.pricingForm.year,
      price: this.pricingForm.price!,
      interestRate: this.pricingForm.interestRate ?? undefined,
      basicPremium: this.pricingForm.basicPremium ?? undefined,
      addBenefits: this.pricingForm.addBenefits ?? undefined,
      rebate: this.pricingForm.rebate ?? undefined,
      additionalRebate: this.pricingForm.additionalRebate ?? undefined,
    });
    this.brandFilter.set(this.pricingForm.brand);
    this.closeAddPricing();
  }
}
