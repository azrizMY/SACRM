import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import {
  BUILT_IN_VEHICLES,
  DEFAULT_VEHICLES,
  formatRM,
  isBuiltInVehicle,
  type CatalogVehicleData,
  type Vehicle,
  type VehicleYear,
} from '../data/calculator-data';
import { brandInitials, brandLogo, brandStyle, builtInBrandLogo } from '../data/dashboard-data';

const MAX_UPLOAD_MB = 25;

/** What one row of the car list shows. `vehicle` is the owner's version (before any account's own
 *  price edits), so the owner always sees the shared catalogue, not their personal prices. */
type CarRow = {
  id: string;
  vehicle: Vehicle;
  builtIn: boolean;
  edited: boolean;
  hidden: boolean;
};

type CarForm = {
  id: string | null;
  model: string;
  variant: string;
  price: number | null;
  years: string;
  colours: string;
  sumInsured: number | null;
  photoUrl: string | null;
  brochureUrl: string | null;
};

function emptyForm(): CarForm {
  return { id: null, model: '', variant: '', price: null, years: String(new Date().getFullYear()), colours: '', sumInsured: null, photoUrl: null, brochureUrl: null };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const message = (err.error as { error?: string } | null)?.error;
    if (message) return message;
    if (err.status === 0) return "Couldn't reach the server. Check your connection and try again.";
  }
  return fallback;
}

/**
 * Manage Cars (site owner only): add brands and their logos, add and edit model variants with their
 * price, photo and brochure. Changes are shared by every account straight away, with no code
 * change or deploy. An account's own Price Settings edits still win over the owner's price.
 */
@Component({
  selector: 'app-manage-cars',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6 text-base">
      <section class="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div class="flex items-start gap-3">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <app-icon name="shield-check" [size]="20" />
          </span>
          <div class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">Brands and cars for everyone</h2>
            <p class="text-pretty text-sm text-muted-foreground">
              Only you can see this page. What you change here — brands, logos, cars, prices, photos and brochures — shows for
              every account straight away. If someone has set their own price for a car in Price Settings, theirs stays.
            </p>
          </div>
        </div>
        <ol class="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <li class="flex gap-2 rounded-lg bg-muted/50 p-3"><span class="font-semibold text-primary">1</span> Pick a brand below, or add a new one.</li>
          <li class="flex gap-2 rounded-lg bg-muted/50 p-3"><span class="font-semibold text-primary">2</span> Add a car, or press Edit on one to change it.</li>
          <li class="flex gap-2 rounded-lg bg-muted/50 p-3"><span class="font-semibold text-primary">3</span> Press Save. Everyone sees it right away.</li>
        </ol>
      </section>

      <!-- Brands -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Brands</h2>
          <button type="button" class="btn-primary" (click)="openBrandForm()">
            <app-icon name="plus" [size]="18" /> Add brand
          </button>
        </div>

        @if (brandForm(); as form) {
          <div class="rounded-xl border-2 border-primary/40 bg-card p-5 shadow-sm">
            <h3 class="text-base font-semibold">{{ form.isNew ? 'Add a brand' : 'Change ' + form.name + ' logo' }}</h3>
            <div class="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
              @if (form.isNew) {
                <label class="field">
                  <span class="field-label">Brand name</span>
                  <input class="input" [(ngModel)]="form.name" placeholder="For example: Perodua" maxlength="60" />
                </label>
              }
              <div class="field">
                <span class="field-label">Logo <span class="font-normal text-muted-foreground">(PNG, SVG, JPG or WebP)</span></span>
                <div class="flex items-center gap-3">
                  <span class="logo-box">
                    @if (form.logoUrl) {
                      <img [src]="form.logoUrl" alt="" class="max-h-full max-w-full object-contain" />
                    } @else {
                      <span class="text-xs text-muted-foreground">No logo</span>
                    }
                  </span>
                  <label class="btn-secondary cursor-pointer">
                    <app-icon name="upload" [size]="18" /> {{ uploading() === 'logo' ? 'Uploading…' : 'Choose logo' }}
                    <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="uploadBrandLogo($event)" [disabled]="!!uploading()" />
                  </label>
                  @if (form.logoUrl) {
                    <button type="button" class="btn-ghost" (click)="form.logoUrl = null">Remove</button>
                  }
                </div>
              </div>
            </div>
            @if (formError()) {
              <p class="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{{ formError() }}</p>
            }
            <div class="mt-5 flex flex-wrap gap-3">
              <button type="button" class="btn-primary" (click)="saveBrand()" [disabled]="saving() || !!uploading()">
                <app-icon name="check" [size]="18" /> {{ saving() ? 'Saving…' : 'Save brand' }}
              </button>
              <button type="button" class="btn-secondary" (click)="closeForms()">Cancel</button>
            </div>
          </div>
        }

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          @for (brand of brands(); track brand) {
            <button
              type="button"
              (click)="selectBrand(brand)"
              class="flex min-h-20 items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors"
              [ngClass]="brand === selectedBrand() ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'"
              [attr.aria-pressed]="brand === selectedBrand()"
            >
              <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg" [style.background]="logoFor(brand) ? 'white' : styleFor(brand).bg" [style.color]="styleFor(brand).fg">
                @if (logoFor(brand); as logo) {
                  <img [src]="logo" alt="" class="max-h-10 max-w-10 object-contain" />
                } @else {
                  <span class="text-sm font-bold">{{ initials(brand) }}</span>
                }
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-semibold">{{ brand }}</span>
                <span class="text-sm text-muted-foreground">{{ carCount(brand) }} {{ carCount(brand) === 1 ? 'car' : 'cars' }}</span>
              </span>
            </button>
          }
        </div>
      </section>

      <!-- Cars of the selected brand -->
      @if (selectedBrand(); as brand) {
        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ brand }} cars</h2>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-secondary" (click)="openBrandForm(brand)">
                <app-icon name="pencil" [size]="18" /> Change logo
              </button>
              @if (canDeleteBrand(brand)) {
                <button type="button" class="btn-secondary text-destructive" (click)="deleteBrand(brand)">
                  <app-icon name="trash" [size]="18" /> Delete brand
                </button>
              }
              <button type="button" class="btn-primary" (click)="openCarForm()">
                <app-icon name="plus" [size]="18" /> Add car
              </button>
            </div>
          </div>

          @if (carForm(); as form) {
            <div class="rounded-xl border-2 border-primary/40 bg-card p-5 shadow-sm">
              <h3 class="text-base font-semibold">{{ form.id ? 'Edit ' + (form.model || 'car') + ' ' + form.variant : 'Add a ' + brand + ' car' }}</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <label class="field">
                  <span class="field-label">Model</span>
                  <input class="input" [(ngModel)]="form.model" list="model-names" placeholder="For example: Myvi" maxlength="80" />
                  <datalist id="model-names">
                    @for (m of modelNames(); track m) {
                      <option [value]="m"></option>
                    }
                  </datalist>
                  <span class="field-hint">Pick an existing model to add a variant to it, or type a new one.</span>
                </label>
                <label class="field">
                  <span class="field-label">Variant</span>
                  <input class="input" [(ngModel)]="form.variant" placeholder="For example: 1.5 AV" maxlength="80" />
                </label>
                <label class="field">
                  <span class="field-label">Price (RM, on-the-road)</span>
                  <input class="input" type="number" inputmode="decimal" min="0" step="0.01" [(ngModel)]="form.price" placeholder="For example: 59800" />
                </label>
                <label class="field">
                  <span class="field-label">Model years</span>
                  <input class="input" [(ngModel)]="form.years" placeholder="For example: 2026, 2025" />
                  <span class="field-hint">Separate years with a comma. Rebates per year are set in Price Settings.</span>
                </label>
                <label class="field md:col-span-2">
                  <span class="field-label">Colours <span class="font-normal text-muted-foreground">(optional)</span></span>
                  <input class="input" [(ngModel)]="form.colours" placeholder="For example: Snow White, Jet Grey, Ruby Red" />
                  <span class="field-hint">Separate colours with a comma, in the order you want them shown.</span>
                </label>
                <label class="field">
                  <span class="field-label">Sum insured (RM) <span class="font-normal text-muted-foreground">(optional)</span></span>
                  <input class="input" type="number" inputmode="decimal" min="0" step="0.01" [(ngModel)]="form.sumInsured" placeholder="From the brand's price list" />
                </label>
              </div>

              <div class="mt-5 grid gap-4 md:grid-cols-2">
                <div class="field">
                  <span class="field-label">Car photo <span class="font-normal text-muted-foreground">(PNG with a clear background works best)</span></span>
                  <div class="flex flex-wrap items-center gap-3">
                    <span class="photo-box">
                      @if (form.photoUrl) {
                        <img [src]="form.photoUrl" alt="" class="max-h-full max-w-full object-contain" />
                      } @else {
                        <span class="text-xs text-muted-foreground">No photo</span>
                      }
                    </span>
                    <label class="btn-secondary cursor-pointer">
                      <app-icon name="upload" [size]="18" /> {{ uploading() === 'photo' ? 'Uploading…' : 'Choose photo' }}
                      <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" (change)="uploadCarFile($event, 'photo')" [disabled]="!!uploading()" />
                    </label>
                    @if (form.photoUrl) {
                      <button type="button" class="btn-ghost" (click)="form.photoUrl = null">Remove</button>
                    }
                  </div>
                </div>
                <div class="field">
                  <span class="field-label">Brochure <span class="font-normal text-muted-foreground">(PDF, up to {{ maxMb }} MB)</span></span>
                  <div class="flex flex-wrap items-center gap-3">
                    @if (form.brochureUrl) {
                      <a [href]="form.brochureUrl" target="_blank" rel="noopener" class="btn-ghost underline">
                        <app-icon name="file-text" [size]="18" /> Open brochure
                      </a>
                    } @else {
                      <span class="text-sm text-muted-foreground">No brochure</span>
                    }
                    <label class="btn-secondary cursor-pointer">
                      <app-icon name="upload" [size]="18" /> {{ uploading() === 'brochure' ? 'Uploading…' : 'Choose PDF' }}
                      <input type="file" class="sr-only" accept="application/pdf" (change)="uploadCarFile($event, 'brochure')" [disabled]="!!uploading()" />
                    </label>
                    @if (form.brochureUrl) {
                      <button type="button" class="btn-ghost" (click)="form.brochureUrl = null">Remove</button>
                    }
                  </div>
                </div>
              </div>

              @if (formError()) {
                <p class="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{{ formError() }}</p>
              }
              <div class="mt-5 flex flex-wrap gap-3">
                <button type="button" class="btn-primary" (click)="saveCar(brand)" [disabled]="saving() || !!uploading()">
                  <app-icon name="check" [size]="18" /> {{ saving() ? 'Saving…' : 'Save car' }}
                </button>
                <button type="button" class="btn-secondary" (click)="closeForms()">Cancel</button>
              </div>
            </div>
          }

          @if (rows().length === 0) {
            <div class="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No cars for {{ brand }} yet. Press <strong>Add car</strong> to add the first one.
            </div>
          } @else {
            <ul class="flex flex-col gap-2">
              @for (row of rows(); track row.id) {
                <li class="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm" [class.opacity-60]="row.hidden">
                  <span class="photo-thumb">
                    @if (row.vehicle.photoUrl) {
                      <img [src]="row.vehicle.photoUrl" alt="" class="max-h-full max-w-full object-contain" loading="lazy" />
                    } @else {
                      <app-icon name="car" [size]="22" class="text-muted-foreground" />
                    }
                  </span>
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class="font-semibold">{{ row.vehicle.model }} {{ row.vehicle.variant }}</span>
                    <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span class="font-medium text-foreground">{{ rm(row.vehicle.price) }}</span>
                      <span>{{ yearsText(row.vehicle) }}</span>
                      <span>{{ row.vehicle.brochureUrl ? 'Brochure added' : 'No brochure' }}</span>
                      @if (!row.builtIn) { <span class="badge">Added by you</span> }
                      @if (row.edited) { <span class="badge">Changed by you</span> }
                      @if (row.hidden) { <span class="badge">Hidden from everyone</span> }
                    </span>
                  </span>
                  <span class="flex flex-wrap gap-2">
                    @if (row.hidden) {
                      <button type="button" class="btn-secondary" (click)="undoCar(row)"><app-icon name="eye" [size]="18" /> Show again</button>
                    } @else {
                      <button type="button" class="btn-secondary" (click)="openCarForm(row)"><app-icon name="pencil" [size]="18" /> Edit</button>
                      @if (row.builtIn) {
                        @if (row.edited) {
                          <button type="button" class="btn-ghost" (click)="undoCar(row)"><app-icon name="rotate-ccw" [size]="18" /> Undo my changes</button>
                        }
                        <button type="button" class="btn-ghost" (click)="hideCar(row)"><app-icon name="eye-off" [size]="18" /> Hide</button>
                      } @else {
                        <button type="button" class="btn-ghost text-destructive" (click)="deleteCar(row)"><app-icon name="trash" [size]="18" /> Delete</button>
                      }
                    }
                  </span>
                </li>
              }
            </ul>
          }
        </section>
      } @else {
        <div class="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">Pick a brand above to see and edit its cars.</div>
      }
    </div>
  `,
  styles: [
    `
      .btn-primary,
      .btn-secondary,
      .btn-ghost {
        display: inline-flex;
        min-height: 2.75rem;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.6rem;
        padding: 0 1rem;
        font-size: 0.95rem;
        font-weight: 600;
        transition: background-color 150ms, border-color 150ms, opacity 150ms;
      }
      .btn-primary { background: var(--primary); color: var(--primary-foreground); }
      .btn-primary:hover { opacity: 0.9; }
      .btn-secondary { border: 1px solid var(--border); background: var(--card); }
      .btn-secondary:hover, .btn-ghost:hover { background: var(--muted); }
      .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }
      .btn-primary:focus-visible, .btn-secondary:focus-visible, .btn-ghost:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
      .field { display: flex; flex-direction: column; gap: 0.4rem; }
      .field-label { font-size: 0.95rem; font-weight: 600; }
      .field-hint { font-size: 0.85rem; color: var(--muted-foreground); }
      .input {
        min-height: 2.75rem;
        border-radius: 0.6rem;
        border: 1px solid var(--input);
        background: var(--input);
        padding: 0 0.75rem;
        font-size: 1rem;
        color: var(--foreground);
        outline: none;
      }
      .input:focus { border-color: var(--ring); }
      .logo-box, .photo-box, .photo-thumb {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 0.6rem;
        border: 1px solid var(--border);
        background: white;
      }
      .logo-box { width: 4rem; height: 4rem; padding: 0.4rem; }
      .photo-box { width: 9rem; height: 5.5rem; padding: 0.25rem; }
      .photo-thumb { width: 6rem; height: 3.75rem; flex-shrink: 0; padding: 0.2rem; }
      .badge { border-radius: 999px; background: color-mix(in oklch, var(--primary) 14%, transparent); color: var(--primary); padding: 0.05rem 0.55rem; font-size: 0.8rem; font-weight: 600; }
    `,
  ],
})
export class ManageCarsComponent {
  private catalog = inject(VehicleCatalogService);
  private toast = inject(ToastService);

  readonly maxMb = MAX_UPLOAD_MB;

  selectedBrand = signal<string | null>(null);
  brandForm = signal<{ isNew: boolean; name: string; logoUrl: string | null } | null>(null);
  carForm = signal<CarForm | null>(null);
  formError = signal<string | null>(null);
  saving = signal(false);
  uploading = signal<'logo' | 'photo' | 'brochure' | null>(null);

  brands = computed(() => this.catalog.allBrands());

  /** The owner's version of every car of the selected brand, including built-in cars they hid. */
  rows = computed<CarRow[]>(() => {
    this.catalog.vehicles();
    const brand = this.selectedBrand();
    if (!brand) return [];
    const entries = new Map(this.catalog.catalogEntries().map((e) => [e.id, e.data]));
    const shown: CarRow[] = DEFAULT_VEHICLES.filter((v) => v.brand === brand).map((v) => ({
      id: v.id,
      vehicle: v,
      builtIn: isBuiltInVehicle(v.id),
      edited: isBuiltInVehicle(v.id) && entries.has(v.id),
      hidden: false,
    }));
    const hidden: CarRow[] = BUILT_IN_VEHICLES.filter((v) => v.brand === brand && entries.get(v.id)?.hidden).map((v) => ({
      id: v.id,
      vehicle: v,
      builtIn: true,
      edited: false,
      hidden: true,
    }));
    return [...shown, ...hidden].sort((a, b) => a.vehicle.model.localeCompare(b.vehicle.model) || a.vehicle.price - b.vehicle.price);
  });

  modelNames = computed(() => Array.from(new Set(this.rows().map((r) => r.vehicle.model))));

  constructor() {
    const first = this.brands()[0];
    if (first) this.selectedBrand.set(first);
  }

  rm(value: number): string {
    return formatRM(value);
  }

  logoFor(brand: string): string | null {
    return brandLogo(brand);
  }

  styleFor(brand: string) {
    return brandStyle(brand);
  }

  initials(brand: string): string {
    return brandInitials(brand);
  }

  carCount(brand: string): number {
    this.catalog.vehicles();
    return DEFAULT_VEHICLES.filter((v) => v.brand === brand).length;
  }

  yearsText(v: Vehicle): string {
    const years = v.years.map((y) => y.year).sort((a, b) => b - a);
    return years.length ? `Model year ${years.join(', ')}` : '';
  }

  /** A brand the owner added, with no cars left, can be deleted. Built-in brands can't be. */
  canDeleteBrand(brand: string): boolean {
    const added = this.catalog.catalogBrands().some((b) => b.name === brand);
    const builtIn = BUILT_IN_VEHICLES.some((v) => v.brand === brand);
    return added && !builtIn && this.carCount(brand) === 0;
  }

  selectBrand(brand: string): void {
    this.selectedBrand.set(brand);
    this.closeForms();
  }

  closeForms(): void {
    this.brandForm.set(null);
    this.carForm.set(null);
    this.formError.set(null);
  }

  openBrandForm(brand?: string): void {
    this.closeForms();
    this.brandForm.set(brand ? { isNew: false, name: brand, logoUrl: brandLogo(brand) } : { isNew: true, name: '', logoUrl: null });
  }

  async uploadBrandLogo(event: Event): Promise<void> {
    const url = await this.upload(event, 'logo');
    const form = this.brandForm();
    if (url && form) this.brandForm.set({ ...form, logoUrl: url });
  }

  async saveBrand(): Promise<void> {
    const form = this.brandForm();
    if (!form) return;
    const name = form.name.replace(/\s+/g, ' ').trim();
    if (!name) return this.formError.set('Type the brand name first.');
    if (form.isNew && this.brands().some((b) => b.toLowerCase() === name.toLowerCase())) {
      return this.formError.set(`${name} is already on the list. Pick it below instead.`);
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const builtIn = builtInBrandLogo(name);
      if (!form.isNew && form.logoUrl === builtIn) {
        // Back to the logo the app ships with: no owner row needed.
        if (this.catalog.catalogBrands().some((b) => b.name === name)) await this.catalog.deleteBrand(name);
      } else {
        await this.catalog.saveBrand(name, form.logoUrl);
      }
      this.selectedBrand.set(name);
      this.closeForms();
      this.toast.show(form.isNew ? `${name} added. Now add its cars.` : `${name} logo saved.`);
    } catch (err) {
      this.formError.set(errorText(err, "Couldn't save the brand. Please try again."));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteBrand(brand: string): Promise<void> {
    if (!confirm(`Delete the brand ${brand}? It has no cars, so nothing else changes.`)) return;
    try {
      await this.catalog.deleteBrand(brand);
      this.selectedBrand.set(this.brands()[0] ?? null);
      this.toast.show(`${brand} deleted.`);
    } catch (err) {
      this.toast.show(errorText(err, "Couldn't delete the brand."));
    }
  }

  openCarForm(row?: CarRow): void {
    this.closeForms();
    if (!row) return this.carForm.set(emptyForm());
    const v = row.vehicle;
    this.carForm.set({
      id: row.id,
      model: v.model,
      variant: v.variant,
      price: v.price,
      years: v.years.map((y) => y.year).join(', '),
      colours: (v.colours ?? []).join(', '),
      sumInsured: v.sumInsured ?? null,
      photoUrl: v.photoUrl ?? null,
      brochureUrl: v.brochureUrl ?? null,
    });
  }

  async uploadCarFile(event: Event, kind: 'photo' | 'brochure'): Promise<void> {
    const url = await this.upload(event, kind);
    const form = this.carForm();
    if (url && form) this.carForm.set({ ...form, [kind === 'photo' ? 'photoUrl' : 'brochureUrl']: url });
  }

  async saveCar(brand: string): Promise<void> {
    const form = this.carForm();
    if (!form) return;
    const model = form.model.replace(/\s+/g, ' ').trim();
    const variant = form.variant.replace(/\s+/g, ' ').trim();
    const price = Number(form.price);
    if (!model) return this.formError.set('Type the model name.');
    if (!variant) return this.formError.set('Type the variant name.');
    if (!(price > 0)) return this.formError.set('Type the price in RM, for example 59800.');
    const yearNumbers = Array.from(new Set(form.years.split(/[,\s]+/).filter(Boolean).map(Number)));
    if (!yearNumbers.length || yearNumbers.some((y) => !Number.isInteger(y) || y < 2000 || y > 2100)) {
      return this.formError.set('Type the model years as numbers, for example 2026, 2025.');
    }
    const clash = DEFAULT_VEHICLES.find(
      (v) => v.id !== form.id && v.brand === brand && v.model.toLowerCase() === model.toLowerCase() && v.variant.toLowerCase() === variant.toLowerCase(),
    );
    if (clash) return this.formError.set(`${brand} ${model} ${variant} is already on the list. Edit that one instead.`);

    // Keep each year's rebates when the year stays.
    const current = form.id ? DEFAULT_VEHICLES.find((v) => v.id === form.id) : undefined;
    const years: VehicleYear[] = yearNumbers.sort((a, b) => b - a).map((year) => current?.years.find((y) => y.year === year) ?? { year });
    const data: CatalogVehicleData = {
      brand,
      model,
      variant,
      price,
      years,
      colours: form.colours.split(',').map((c) => c.trim()).filter(Boolean),
      photoUrl: form.photoUrl,
      brochureUrl: form.brochureUrl,
      ...(form.sumInsured != null && Number(form.sumInsured) > 0 ? { sumInsured: Number(form.sumInsured) } : {}),
    };
    const id = form.id ?? `${slug(`${brand}-${model}-${variant}`).slice(0, 100) || 'car'}-${crypto.randomUUID().slice(0, 6)}`;

    this.saving.set(true);
    this.formError.set(null);
    try {
      await this.catalog.saveVehicle(id, data);
      this.closeForms();
      this.toast.show(`${model} ${variant} saved. Everyone can see it now.`);
    } catch (err) {
      this.formError.set(errorText(err, "Couldn't save the car. Please try again."));
    } finally {
      this.saving.set(false);
    }
  }

  async hideCar(row: CarRow): Promise<void> {
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!confirm(`Hide ${name} from everyone? You can show it again any time.`)) return;
    await this.run(() => this.catalog.saveVehicle(row.id, { hidden: true }), `${name} hidden.`);
  }

  async undoCar(row: CarRow): Promise<void> {
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!row.hidden && !confirm(`Undo your changes to ${name}? It goes back to the app's original details.`)) return;
    await this.run(() => this.catalog.deleteVehicle(row.id), row.hidden ? `${name} is showing again.` : `${name} is back to the original.`);
  }

  async deleteCar(row: CarRow): Promise<void> {
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!confirm(`Delete ${name} for everyone? This can't be undone.`)) return;
    await this.run(() => this.catalog.deleteVehicle(row.id), `${name} deleted.`);
  }

  private async run(action: () => Promise<void>, done: string): Promise<void> {
    try {
      await action();
      this.toast.show(done);
    } catch (err) {
      this.toast.show(errorText(err, "Couldn't save that. Please try again."));
    }
  }

  /** Uploads the picked file and returns its path, or null (with the reason shown) on failure. */
  private async upload(event: Event, kind: 'logo' | 'photo' | 'brochure'): Promise<string | null> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return null;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      this.formError.set(`That file is over ${MAX_UPLOAD_MB} MB. Use a smaller one.`);
      return null;
    }
    this.uploading.set(kind);
    this.formError.set(null);
    try {
      return await this.catalog.uploadFile(file);
    } catch (err) {
      this.formError.set(errorText(err, "Couldn't upload that file. Please try again."));
      return null;
    } finally {
      this.uploading.set(null);
    }
  }
}
