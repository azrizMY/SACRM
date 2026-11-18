import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { IconComponent } from '../shared/icon.component';
import { NumberFieldComponent } from '../shared/number-field.component';
import { ToastService } from '../shared/toast.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { knownSwatchHex } from '../shared/poster-colour-swatches';
import { shrinkImageForUpload } from '../shared/image-compress';
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
/** A new colour's dot before the owner picks one (a neutral grey). */
const DEFAULT_SWATCH = '#9ca3af';

/** What one row of the car list shows. `vehicle` is the owner's version (before any account's own
 *  price edits), so the owner always sees the shared catalogue, not their personal prices. */
type CarRow = {
  id: string;
  vehicle: Vehicle;
  builtIn: boolean;
  edited: boolean;
  hidden: boolean;
};

type ColourEntry = { name: string; hex: string };

type CarForm = {
  id: string | null;
  model: string;
  variant: string;
  price: number | null;
  colours: ColourEntry[];
  photoUrl: string | null;
  brochureUrl: string | null;
};

function emptyForm(model = ''): CarForm {
  return { id: null, model, variant: '', price: null, colours: [], photoUrl: null, brochureUrl: null };
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
 * price, colours, photo and brochure. Changes are shared by every account straight away, with no
 * code change or deploy. An account's own Price Settings edits still win over the owner's price.
 *
 * Model years aren't managed here: a new car starts on the current year, an edited car keeps the
 * years it has, and advisors can change a car's years themselves in Price Settings.
 */
@Component({
  selector: 'app-manage-cars',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, NumberFieldComponent],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-6" [ngClass]="carForm() ? 'xl:mr-[476px]' : ''">
      <!-- Brands -->
      <section class="flex flex-col gap-3">
        <h2 class="text-base font-semibold">Brands</h2>

        @if (brandForm(); as form) {
          <div class="rounded-xl border border-brand/40 bg-card p-4 text-card-foreground shadow-sm">
            <h3 class="text-sm font-semibold">{{ form.isNew ? 'Add a brand' : form.canRename ? 'Edit ' + form.original : 'Change the ' + form.original + ' logo' }}</h3>
            <div class="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
              <!-- The name can be set for a new brand or one you added; built-in brands keep their official name -->
              @if (form.isNew || form.canRename) {
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-semibold">Brand name</span>
                  <input class="h-10 rounded-lg border border-input bg-input px-3 text-sm" [(ngModel)]="form.name" placeholder="For example: Perodua" maxlength="60" />
                </label>
              }
              <div class="flex flex-col gap-1.5">
                <span class="text-sm font-semibold">Logo <span class="font-normal text-muted-foreground">(PNG, SVG, JPG or WebP)</span></span>
                <div class="flex items-center gap-3">
                  <span class="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1.5">
                    @if (form.logoUrl) {
                      <img [src]="form.logoUrl" alt="" class="max-h-full max-w-full object-contain" />
                    } @else {
                      <span class="text-xs text-neutral-500">No logo</span>
                    }
                  </span>
                  <label class="btn btn-outline cursor-pointer">
                    <app-icon name="upload" [size]="16" /> {{ uploading() === 'logo' ? 'Uploading…' : 'Choose logo' }}
                    <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml" (change)="uploadBrandLogo($event)" [disabled]="!!uploading()" />
                  </label>
                  @if (form.logoUrl) {
                    <button type="button" class="btn" (click)="form.logoUrl = null">Remove</button>
                  }
                </div>
              </div>
            </div>
            @if (brandError()) {
              <p class="mt-3 rounded-lg bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]" role="alert">{{ brandError() }}</p>
            }
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="btn" (click)="brandForm.set(null)">Cancel</button>
              <button type="button" class="btn btn-primary" (click)="saveBrand()" [disabled]="saving() || !!uploading()">
                {{ saving() ? 'Saving…' : 'Save brand' }}
              </button>
            </div>
          </div>
        }

        <!-- 3 across while the edit panel takes the right side, so brand names aren't cut off -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3" [ngClass]="carForm() ? 'lg:grid-cols-4 xl:grid-cols-3' : 'lg:grid-cols-4'">
          @for (brand of brands(); track brand) {
            <div class="relative">
              <button
                type="button"
                (click)="selectBrand(brand)"
                class="flex min-h-20 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors"
                [ngClass]="brand === selectedBrand() ? 'border-primary pr-10 ring-2 ring-primary/40' : 'border-border hover:border-primary/50'"
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
              <!-- The selected brand's own settings sit on its tile: change its logo, or delete a brand
                   you added once it has no cars. -->
              @if (brand === selectedBrand()) {
                <span class="absolute right-1.5 top-1.5 flex flex-col gap-1">
                  <button type="button" (click)="openBrandForm(brand)" [title]="canRenameBrand(brand) ? 'Edit ' + brand : 'Change the ' + brand + ' logo'" [attr.aria-label]="canRenameBrand(brand) ? 'Edit ' + brand : 'Change the ' + brand + ' logo'" class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <app-icon name="pencil" [size]="15" />
                  </button>
                  @if (canDeleteBrand(brand)) {
                    <button type="button" (click)="deleteBrand(brand)" [title]="'Delete ' + brand" [attr.aria-label]="'Delete ' + brand" class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[var(--destructive)]">
                      <app-icon name="trash" [size]="15" />
                    </button>
                  }
                </span>
              }
            </div>
          }
          <!-- Adding a brand is the last tile, so Add model stays the page's one main button -->
          <button
            type="button"
            (click)="openBrandForm()"
            class="flex min-h-20 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-control p-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground"
          >
            <app-icon name="plus" [size]="18" /> Add brand
          </button>
        </div>
      </section>

      <!-- Cars of the selected brand -->
      @if (selectedBrand(); as brand) {
        <section class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-base font-semibold">{{ brand }} cars</h2>
            <!-- A new model here; another variant of an existing model is "Add variant" on its group -->
            <button type="button" class="btn btn-primary" (click)="openCarForm()">
              <app-icon name="plus" [size]="16" /> Add model
            </button>
          </div>

          @for (g of modelGroups(); track g.model) {
            <div class="flex flex-col gap-1.5">
              <div class="flex items-baseline justify-between gap-3 px-0.5">
                <span class="text-sm font-semibold">{{ g.model }} <span class="font-normal text-muted-foreground">· {{ g.rows.length }} {{ g.rows.length === 1 ? 'variant' : 'variants' }}</span></span>
                <button type="button" (click)="openCarForm(undefined, g.model)" class="-my-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft">
                  <app-icon name="plus" [size]="14" /> Add variant
                </button>
              </div>
              <ul class="flex flex-col divide-y divide-border rounded-xl border border-border bg-card text-card-foreground">
                @for (row of g.rows; track row.id) {
                  <li class="flex items-center gap-3 px-3 py-2" [ngClass]="{ 'bg-brand-soft/40': carForm()?.id === row.id }">
                    <span class="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5" [class.opacity-50]="row.hidden">
                      @if (row.vehicle.photoUrl) {
                        <img [src]="row.vehicle.photoUrl" alt="" class="max-h-full max-w-full object-contain" loading="lazy" />
                      } @else {
                        <app-icon name="car" [size]="20" class="text-neutral-400" />
                      }
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3" [class.opacity-60]="row.hidden">
                      <span class="flex min-w-0 items-center gap-1.5 sm:flex-1">
                        <span class="truncate text-sm font-semibold">{{ row.vehicle.variant || row.vehicle.model }}</span>
                        @if (row.hidden) {
                          <span class="tag">Hidden</span>
                        } @else if (!row.builtIn) {
                          <span class="tag tag-brand">Added</span>
                        } @else if (row.edited) {
                          <span class="tag tag-brand">Changed</span>
                        }
                      </span>
                      <span class="flex items-center gap-3 text-xs text-muted-foreground sm:text-sm">
                        <span class="whitespace-nowrap tabular-nums text-foreground">{{ rm(row.vehicle.price) }}</span>
                        <span class="flex items-center gap-1" [title]="row.vehicle.brochureUrl ? 'Brochure added' : 'No brochure yet'">
                          <app-icon name="file-text" [size]="14" [class.opacity-30]="!row.vehicle.brochureUrl" />
                          <span class="sm:hidden">{{ row.vehicle.brochureUrl ? 'Brochure' : 'No brochure' }}</span>
                        </span>
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center gap-1.5">
                      @if (row.hidden) {
                        <button type="button" class="btn btn-outline btn-sm" (click)="undoCar(row)"><app-icon name="eye" [size]="14" /> Show again</button>
                      } @else {
                        <button type="button" class="btn btn-outline btn-sm" (click)="openCarForm(row)">Edit</button>
                        <span class="relative">
                          <button type="button" class="btn btn-sm px-2" (click)="toggleMenu($event, row.id)" [attr.aria-expanded]="menuFor() === row.id" aria-label="More actions">
                            <app-icon name="ellipsis" [size]="16" />
                          </button>
                          @if (menuFor() === row.id) {
                            <div class="absolute right-0 top-full z-30 mt-1 flex w-64 flex-col rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg" (click)="$event.stopPropagation()">
                              @if (row.builtIn) {
                                @if (row.edited) {
                                  <button type="button" class="menu-item" (click)="undoCar(row)">
                                    <app-icon name="rotate-ccw" [size]="16" />
                                    <span class="flex flex-col"><span class="font-semibold">Undo my changes</span><span class="text-xs text-muted-foreground">Back to the app's original details</span></span>
                                  </button>
                                }
                                <button type="button" class="menu-item" (click)="hideCar(row)">
                                  <app-icon name="eye-off" [size]="16" />
                                  <span class="flex flex-col"><span class="font-semibold">Hide from everyone</span><span class="text-xs text-muted-foreground">Off every list for now, kept here to show again</span></span>
                                </button>
                                <button type="button" class="menu-item text-[var(--destructive)]" (click)="deleteBuiltInCar(row)">
                                  <app-icon name="trash" [size]="16" />
                                  <span class="flex flex-col"><span class="font-semibold">Delete</span><span class="text-xs text-muted-foreground">Removes this car for everyone</span></span>
                                </button>
                              } @else {
                                <button type="button" class="menu-item text-[var(--destructive)]" (click)="deleteCar(row)">
                                  <app-icon name="trash" [size]="16" />
                                  <span class="flex flex-col"><span class="font-semibold">Delete</span><span class="text-xs text-muted-foreground">Removes this car for everyone</span></span>
                                </button>
                              }
                            </div>
                          }
                        </span>
                      }
                    </span>
                  </li>
                }
              </ul>
            </div>
          } @empty {
            <div class="empty-state">
              <span class="empty-icon"><app-icon name="car" [size]="28" /></span>
              <h3>No {{ brand }} cars yet</h3>
              <p>Press Add model to add the first one.</p>
            </div>
          }

          <!-- Built-in cars you deleted: out of the way, but a mistake can still be undone -->
          @if (deletedRows().length) {
            <div class="flex flex-col gap-1.5">
              <button type="button" (click)="showDeleted.set(!showDeleted())" [attr.aria-expanded]="showDeleted()" class="flex items-center gap-1.5 self-start rounded-md px-1 py-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
                <app-icon [name]="showDeleted() ? 'chevron-down' : 'chevron-right'" [size]="16" />
                Deleted cars · {{ deletedRows().length }}
              </button>
              @if (showDeleted()) {
                <ul class="flex flex-col divide-y divide-border rounded-xl border border-dashed border-border">
                  @for (row of deletedRows(); track row.id) {
                    <li class="flex items-center gap-3 px-3 py-2 text-sm">
                      <span class="min-w-0 flex-1 truncate text-muted-foreground line-through">{{ row.vehicle.model }} {{ row.vehicle.variant }}</span>
                      <button type="button" class="btn btn-outline btn-sm" (click)="restoreCar(row)">
                        <app-icon name="rotate-ccw" [size]="14" /> Restore
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }
        </section>
      }
    </div>

    <!-- Add / edit a car: a side panel on a computer, the whole screen on a phone -->
    @if (carForm(); as form) {
      <div class="fixed inset-0 z-40 bg-black/50 xl:hidden" (click)="closeCarForm()"></div>
      <aside class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background text-foreground shadow-xl sm:w-[460px]" role="dialog" [attr.aria-label]="panelTitle(form)">
        <div class="flex items-center gap-3 border-b border-border px-4 py-3">
          <span class="min-w-0 flex-1 truncate text-base font-semibold">{{ panelTitle(form) }}</span>
          <button type="button" (click)="closeCarForm()" aria-label="Close" class="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <app-icon name="x" [size]="20" />
          </button>
        </div>

        <div class="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <!-- Photo -->
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Photo <span class="font-normal text-muted-foreground">· PNG with a clear background works best</span></span>
            <label class="relative flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-white to-[#eceef1] transition-colors hover:border-brand/50">
              @if (form.photoUrl) {
                <img [src]="form.photoUrl" alt="" class="max-h-full max-w-full object-contain p-3" />
              } @else {
                <span class="flex flex-col items-center gap-1 text-sm text-neutral-500">
                  <app-icon name="image" [size]="24" />
                  {{ uploading() === 'photo' ? 'Uploading…' : 'Tap to add a photo' }}
                </span>
              }
              <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" (change)="uploadCarFile($event, 'photo')" [disabled]="!!uploading()" />
            </label>
            @if (form.photoUrl) {
              <div class="flex gap-2">
                <label class="btn btn-outline btn-sm cursor-pointer">
                  <app-icon name="upload" [size]="14" /> {{ uploading() === 'photo' ? 'Uploading…' : 'Replace' }}
                  <input type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" (change)="uploadCarFile($event, 'photo')" [disabled]="!!uploading()" />
                </label>
                <button type="button" class="btn btn-sm" (click)="form.photoUrl = null">Remove</button>
              </div>
            }
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-semibold">Model</span>
              <input class="h-10 rounded-lg border border-input bg-input px-3 text-sm" [(ngModel)]="form.model" list="model-names" placeholder="Myvi" maxlength="80" />
              <datalist id="model-names">
                @for (m of modelNames(); track m) {
                  <option [value]="m"></option>
                }
              </datalist>
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-semibold">Variant</span>
              <input class="h-10 rounded-lg border border-input bg-input px-3 text-sm" [(ngModel)]="form.variant" placeholder="1.5 AV" maxlength="80" />
            </label>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="carPrice" class="text-sm font-semibold">Price <span class="font-normal text-muted-foreground">· on-the-road (OTR)</span></label>
            <app-number-field inputId="carPrice" prefix="RM" placeholder="59,800" [value]="form.price" (valueChange)="form.price = $event" />
          </div>

          <!-- Colours: a name and its dot colour, in the order shown on posters -->
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Colours <span class="font-normal text-muted-foreground">· the dot is what posters show</span></span>
            @for (c of form.colours; track $index; let i = $index) {
              <div class="flex items-center gap-2">
                <label class="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-input bg-input" [title]="'Dot colour for ' + (c.name || 'this colour')">
                  <span class="size-6 rounded-full ring-2 ring-white/60" [style.background]="c.hex"></span>
                  <input type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" [(ngModel)]="c.hex" [attr.aria-label]="'Dot colour for ' + (c.name || 'this colour')" />
                </label>
                <input class="h-10 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-sm" [(ngModel)]="c.name" (blur)="suggestSwatch(c)" placeholder="Snow White" maxlength="40" />
                <button type="button" class="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" (click)="form.colours.splice(i, 1)" [attr.aria-label]="'Remove ' + (c.name || 'colour')">
                  <app-icon name="x" [size]="16" />
                </button>
              </div>
            }
            <button type="button" class="btn btn-outline btn-sm self-start" (click)="form.colours.push({ name: '', hex: defaultSwatch })">
              <app-icon name="plus" [size]="14" /> Add colour
            </button>
          </div>

          <!-- Brochure -->
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Brochure <span class="font-normal text-muted-foreground">· PDF, up to {{ maxMb }} MB</span></span>
            <div class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <app-icon name="file-text" [size]="18" class="text-muted-foreground" />
              @if (form.brochureUrl) {
                <a [href]="form.brochureUrl" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate text-sm font-semibold underline">Open brochure</a>
              } @else {
                <span class="flex-1 text-sm text-muted-foreground">No brochure yet</span>
              }
              <label class="btn btn-outline btn-sm cursor-pointer">
                {{ uploading() === 'brochure' ? 'Uploading…' : form.brochureUrl ? 'Replace' : 'Choose PDF' }}
                <input type="file" class="sr-only" accept="application/pdf" (change)="uploadCarFile($event, 'brochure')" [disabled]="!!uploading()" />
              </label>
              @if (form.brochureUrl) {
                <button type="button" class="btn btn-sm" (click)="form.brochureUrl = null">Remove</button>
              }
            </div>
          </div>

          @if (formError()) {
            <p class="rounded-lg bg-[var(--destructive)]/10 p-3 text-sm text-[var(--destructive)]" role="alert">{{ formError() }}</p>
          }
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" class="btn" (click)="closeCarForm()">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="saveCar()" [disabled]="saving() || !!uploading()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </aside>
    }

    <!-- "Are you sure?" for delete, hide and undo — the page's own box, not the browser's popup -->
    @if (confirming(); as q) {
      <div class="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="alertdialog" aria-modal="true" [attr.aria-label]="q.title">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/60" (click)="answerConfirm(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col gap-4 rounded-t-2xl border border-border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-xl sm:rounded-2xl">
          <div class="flex flex-col gap-1.5">
            <span class="text-base font-semibold">{{ q.title }}</span>
            <p class="text-sm text-muted-foreground">{{ q.body }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="answerConfirm(false)">Cancel</button>
            <button type="button" class="btn btn-primary" (click)="answerConfirm(true)">{{ q.action }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tag {
        border-radius: 999px;
        background: var(--muted);
        color: var(--muted-foreground);
        padding: 0.05rem 0.5rem;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .tag-brand {
        background: var(--brand-soft);
        color: var(--brand-ink);
      }
      .menu-item {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        border-radius: 0.5rem;
        padding: 0.55rem 0.6rem;
        text-align: left;
        font-size: 0.875rem;
      }
      .menu-item:hover {
        background: var(--accent);
      }
      .menu-item app-icon {
        margin-top: 0.15rem;
      }
    `,
  ],
})
export class ManageCarsComponent {
  private catalog = inject(VehicleCatalogService);
  private toast = inject(ToastService);

  readonly maxMb = MAX_UPLOAD_MB;
  readonly defaultSwatch = DEFAULT_SWATCH;

  selectedBrand = signal<string | null>(null);
  brandForm = signal<{ isNew: boolean; name: string; original: string; canRename: boolean; logoUrl: string | null } | null>(null);
  carForm = signal<CarForm | null>(null);
  /** The brand the open car form belongs to. */
  private carFormBrand = signal<string | null>(null);
  brandError = signal<string | null>(null);
  formError = signal<string | null>(null);
  saving = signal(false);
  uploading = signal<'logo' | 'photo' | 'brochure' | null>(null);
  /** The row whose ⋯ menu is open. */
  menuFor = signal<string | null>(null);

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
    const hidden: CarRow[] = BUILT_IN_VEHICLES.filter((v) => v.brand === brand && entries.get(v.id)?.hidden && !entries.get(v.id)?.deleted).map((v) => ({
      id: v.id,
      vehicle: v,
      builtIn: true,
      edited: false,
      hidden: true,
    }));
    return [...shown, ...hidden].sort((a, b) => a.vehicle.model.localeCompare(b.vehicle.model) || a.vehicle.price - b.vehicle.price);
  });

  /** Built-in cars of the selected brand the owner deleted — only listed so they can be restored. */
  deletedRows = computed<CarRow[]>(() => {
    const brand = this.selectedBrand();
    if (!brand) return [];
    const entries = new Map(this.catalog.catalogEntries().map((e) => [e.id, e.data]));
    return BUILT_IN_VEHICLES.filter((v) => v.brand === brand && entries.get(v.id)?.deleted).map((v) => ({ id: v.id, vehicle: v, builtIn: true, edited: false, hidden: true }));
  });
  showDeleted = signal(false);

  /** The rows grouped by model, models in name order, cheapest variant first. */
  modelGroups = computed(() => {
    const out: { model: string; rows: CarRow[] }[] = [];
    for (const r of this.rows()) {
      const g = out.find((x) => x.model === r.vehicle.model);
      if (g) g.rows.push(r);
      else out.push({ model: r.vehicle.model, rows: [r] });
    }
    return out;
  });

  modelNames = computed(() => Array.from(new Set(this.rows().map((r) => r.vehicle.model))));

  constructor() {
    const first = this.brands()[0];
    if (first) this.selectedBrand.set(first);
  }

  @HostListener('document:click')
  closeMenu() {
    this.menuFor.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.confirming()) this.answerConfirm(false);
    else if (this.menuFor()) this.menuFor.set(null);
    else if (this.carForm()) this.closeCarForm();
  }

  toggleMenu(event: Event, id: string) {
    event.stopPropagation();
    this.menuFor.set(this.menuFor() === id ? null : id);
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

  panelTitle(form: CarForm): string {
    if (form.id) return `Edit ${form.model} ${form.variant}`.trim();
    return form.model ? `Add a ${form.model} variant` : `Add a ${this.carFormBrand() ?? ''} model`.replace('  ', ' ');
  }

  /** A brand the owner added (not one built into the app) can be renamed. */
  canRenameBrand(brand: string): boolean {
    return this.catalog.catalogBrands().some((b) => b.name === brand) && !BUILT_IN_VEHICLES.some((v) => v.brand === brand);
  }

  /** A brand the owner added, with no cars left, can be deleted. Built-in brands can't be. */
  canDeleteBrand(brand: string): boolean {
    const added = this.catalog.catalogBrands().some((b) => b.name === brand);
    const builtIn = BUILT_IN_VEHICLES.some((v) => v.brand === brand);
    return added && !builtIn && this.carCount(brand) === 0;
  }

  selectBrand(brand: string): void {
    this.selectedBrand.set(brand);
    this.brandForm.set(null);
    this.closeCarForm();
  }

  openBrandForm(brand?: string): void {
    this.brandError.set(null);
    this.brandForm.set(
      brand
        ? { isNew: false, name: brand, original: brand, canRename: this.canRenameBrand(brand), logoUrl: brandLogo(brand) }
        : { isNew: true, name: '', original: '', canRename: false, logoUrl: null },
    );
  }

  async uploadBrandLogo(event: Event): Promise<void> {
    const url = await this.upload(event, 'logo', this.brandError);
    const form = this.brandForm();
    if (url && form) this.brandForm.set({ ...form, logoUrl: url });
  }

  async saveBrand(): Promise<void> {
    const form = this.brandForm();
    if (!form) return;
    const name = form.name.replace(/\s+/g, ' ').trim();
    if (!name) return this.brandError.set('Type the brand name first.');
    const renaming = !form.isNew && form.canRename && name !== form.original;
    const clash = this.brands().some((b) => b.toLowerCase() === name.toLowerCase() && b !== form.original);
    if ((form.isNew || renaming) && clash) {
      return this.brandError.set(`${name} is already on the list. Pick another name.`);
    }
    this.saving.set(true);
    this.brandError.set(null);
    try {
      // A rename moves the brand, its cars and every account's saved choices; then the logo saves
      // under the new name as usual.
      if (renaming) await this.catalog.renameBrand(form.original, name);
      // Only a built-in brand can go "back to the logo the app ships with". A brand you added keeps
      // its own row even with no logo — that row is what marks it as yours (rename, delete).
      const builtIn = builtInBrandLogo(name);
      const isBuiltInBrand = BUILT_IN_VEHICLES.some((v) => v.brand === name);
      if (!form.isNew && isBuiltInBrand && form.logoUrl === builtIn) {
        // Back to the logo the app ships with: no owner row needed.
        if (this.catalog.catalogBrands().some((b) => b.name === name)) await this.catalog.deleteBrand(name);
      } else {
        await this.catalog.saveBrand(name, form.logoUrl);
      }
      this.selectedBrand.set(name);
      this.brandForm.set(null);
      this.toast.show(form.isNew ? `${name} added. Now add its cars.` : renaming ? `${form.original} is now ${name}.` : `${name} saved.`);
    } catch (err) {
      this.brandError.set(errorText(err, "Couldn't save the brand. Please try again."));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteBrand(brand: string): Promise<void> {
    if (!(await this.ask({ title: `Delete ${brand}?`, body: 'It has no cars, so nothing else changes.', action: 'Delete brand', danger: true }))) return;
    try {
      await this.catalog.deleteBrand(brand);
      this.selectedBrand.set(this.brands()[0] ?? null);
      this.toast.show(`${brand} deleted.`);
    } catch (err) {
      this.toast.show(errorText(err, "Couldn't delete the brand."));
    }
  }

  /** Opens the side panel: a row to edit, or a new car (optionally under an existing model). */
  openCarForm(row?: CarRow, model?: string): void {
    this.menuFor.set(null);
    this.formError.set(null);
    this.carFormBrand.set(this.selectedBrand());
    if (!row) return this.carForm.set(emptyForm(model));
    const v = row.vehicle;
    this.carForm.set({
      id: row.id,
      model: v.model,
      variant: v.variant,
      price: v.price,
      colours: (v.colours ?? []).map((name) => ({ name, hex: v.colourHex?.[name] ?? knownSwatchHex(name) ?? DEFAULT_SWATCH })),
      photoUrl: v.photoUrl ?? null,
      brochureUrl: v.brochureUrl ?? null,
    });
  }

  closeCarForm(): void {
    this.carForm.set(null);
    this.formError.set(null);
  }

  /** After typing a colour's name, start its dot on the built-in colour for that name, if any. */
  suggestSwatch(c: ColourEntry): void {
    if (c.hex !== DEFAULT_SWATCH) return;
    const known = knownSwatchHex(c.name.trim());
    if (known) c.hex = known;
  }

  async uploadCarFile(event: Event, kind: 'photo' | 'brochure'): Promise<void> {
    const url = await this.upload(event, kind, this.formError);
    const form = this.carForm();
    if (url && form) this.carForm.set({ ...form, [kind === 'photo' ? 'photoUrl' : 'brochureUrl']: url });
  }

  async saveCar(): Promise<void> {
    const form = this.carForm();
    const brand = this.carFormBrand();
    if (!form || !brand) return;
    const model = form.model.replace(/\s+/g, ' ').trim();
    const variant = form.variant.replace(/\s+/g, ' ').trim();
    const price = Number(form.price);
    if (!model) return this.formError.set('Type the model name.');
    if (!variant) return this.formError.set('Type the variant name.');
    if (!(price > 0)) return this.formError.set('Type the price in RM, for example 59800.');
    const clash = DEFAULT_VEHICLES.find(
      (v) => v.id !== form.id && v.brand === brand && v.model.toLowerCase() === model.toLowerCase() && v.variant.toLowerCase() === variant.toLowerCase(),
    );
    if (clash) return this.formError.set(`${brand} ${model} ${variant} is already on the list. Edit that one instead.`);

    // Years aren't edited here: an existing car keeps its years (and their rebates); a new one
    // starts on the current year. Advisors can change years in Price Settings.
    const current = form.id ? DEFAULT_VEHICLES.find((v) => v.id === form.id) ?? BUILT_IN_VEHICLES.find((v) => v.id === form.id) : undefined;
    const years: VehicleYear[] = current?.years.length ? current.years.map((y) => ({ ...y })) : [{ year: new Date().getFullYear() }];

    const colours = form.colours.map((c) => ({ name: c.name.replace(/\s+/g, ' ').trim(), hex: c.hex })).filter((c) => c.name);
    const data: CatalogVehicleData = {
      brand,
      model,
      variant,
      price,
      years,
      colours: colours.map((c) => c.name),
      colourHex: Object.fromEntries(colours.map((c) => [c.name, c.hex])),
      photoUrl: form.photoUrl,
      brochureUrl: form.brochureUrl,
      // Sum insured isn't edited here; an existing car keeps whatever it has.
      ...(current?.sumInsured ? { sumInsured: current.sumInsured } : {}),
    };
    const id = form.id ?? `${slug(`${brand}-${model}-${variant}`).slice(0, 100) || 'car'}-${crypto.randomUUID().slice(0, 6)}`;

    this.saving.set(true);
    this.formError.set(null);
    try {
      await this.catalog.saveVehicle(id, data);
      this.closeCarForm();
      this.toast.show(`${model} ${variant} saved. Everyone can see it now.`);
    } catch (err) {
      this.formError.set(errorText(err, "Couldn't save the car. Please try again."));
    } finally {
      this.saving.set(false);
    }
  }

  async hideCar(row: CarRow): Promise<void> {
    this.menuFor.set(null);
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!(await this.ask({ title: `Hide ${name} from everyone?`, body: "It disappears from every account's lists and customer links. You can show it again any time.", action: 'Hide' }))) return;
    await this.run(() => this.catalog.saveVehicle(row.id, { hidden: true }), `${name} hidden.`);
  }

  async undoCar(row: CarRow): Promise<void> {
    this.menuFor.set(null);
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!row.hidden && !(await this.ask({ title: `Undo your changes to ${name}?`, body: "It goes back to the app's original details.", action: 'Undo changes' }))) return;
    await this.run(() => this.catalog.deleteVehicle(row.id), row.hidden ? `${name} is showing again.` : `${name} is back to the original.`);
  }

  /** A built-in car can't be removed from the app's code, so Delete takes it off every list for good
   *  and keeps it only under "Deleted cars", where it can be restored. */
  async deleteBuiltInCar(row: CarRow): Promise<void> {
    this.menuFor.set(null);
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!(await this.ask({ title: `Delete ${name} for everyone?`, body: "It's removed from every account and customer link. If it was a mistake, restore it from Deleted cars at the bottom of the list.", action: 'Delete', danger: true }))) return;
    await this.run(() => this.catalog.saveVehicle(row.id, { hidden: true, deleted: true }), `${name} deleted.`);
  }

  /** Brings a deleted built-in car back, with the app's original details. */
  async restoreCar(row: CarRow): Promise<void> {
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    await this.run(() => this.catalog.deleteVehicle(row.id), `${name} is back for everyone.`);
  }

  async deleteCar(row: CarRow): Promise<void> {
    this.menuFor.set(null);
    const name = `${row.vehicle.model} ${row.vehicle.variant}`;
    if (!(await this.ask({ title: `Delete ${name} for everyone?`, body: "This can't be undone.", action: 'Delete', danger: true }))) return;
    await this.run(() => this.catalog.deleteVehicle(row.id), `${name} deleted.`);
  }

  /** The page's own "are you sure?" box. The browser's built-in confirm() popup is blocked in some
   *  places (embedded browsers, some phones), where it silently answers Cancel, so a button seemed
   *  to do nothing. Resolves true for the action button, false for Cancel / Escape / outside. */
  confirming = signal<{ title: string; body: string; action: string; danger?: boolean } | null>(null);
  private answer: ((ok: boolean) => void) | null = null;

  ask(question: { title: string; body: string; action: string; danger?: boolean }): Promise<boolean> {
    this.answer?.(false);
    this.confirming.set(question);
    return new Promise((resolve) => (this.answer = resolve));
  }

  answerConfirm(ok: boolean) {
    this.confirming.set(null);
    const resolve = this.answer;
    this.answer = null;
    resolve?.(ok);
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
  private async upload(event: Event, kind: 'logo' | 'photo' | 'brochure', error: ReturnType<typeof signal<string | null>>): Promise<string | null> {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) return null;
    // Photos and logos are shrunk first (WebP keeps a clear background), so customers' quote
    // pages and posters don't download a full-size camera photo. Brochures go up as they are.
    const file = kind === 'brochure' ? picked : await shrinkImageForUpload(picked, kind === 'photo' ? 1600 : 512);
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      error.set(`That file is over ${MAX_UPLOAD_MB} MB. Use a smaller one.`);
      return null;
    }
    this.uploading.set(kind);
    error.set(null);
    try {
      return await this.catalog.uploadFile(file);
    } catch (err) {
      error.set(errorText(err, "Couldn't upload that file. Please try again."));
      return null;
    } finally {
      this.uploading.set(null);
    }
  }
}
