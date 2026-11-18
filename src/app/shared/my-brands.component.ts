import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from './icon.component';
import { TranslatePipe } from './i18n';
import { SettingsService } from './settings.service';
import { VehicleCatalogService } from './vehicle-catalog.service';

/**
 * My Profile → Your brands and Your quote link: the Primary Brand, the brands you sell, and the
 * Held until Save, as they were in Settings.
 */
@Component({
  selector: 'app-my-brands',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TranslatePipe],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Your brands -->
      <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <div class="flex flex-col gap-0.5">
          <h2 class="text-base font-semibold">{{ "Your brands" | t }}</h2>
          <p class="text-xs text-muted-foreground">{{ "Your Primary Brand comes first everywhere; only the brands you sell are shown." | t }}</p>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">{{ "Primary Brand" | t }}</span>
          <span class="text-xs text-muted-foreground">{{ "The Calculator's starting car." | t }}</span>
          <select [(ngModel)]="primary" (ngModelChange)="onPrimaryChange()" class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none sm:max-w-xs">
            @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
          </select>
        </label>

        <div class="flex flex-col gap-1.5">
          <span id="brandsSell" class="text-sm font-semibold">{{ "Brands I sell" | t }}</span>
          <span class="text-xs text-muted-foreground">{{ "Only these show in Price Settings, Compare, Budget and the Catalog." | t }}</span>
          <div role="group" aria-labelledby="brandsSell" class="flex flex-wrap gap-1.5">
            @for (b of brands; track b) {
              <button
                type="button"
                [attr.aria-pressed]="isSold(b)"
                [disabled]="b === primary"
                (click)="toggleSold(b)"
                class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-default"
                [ngClass]="isSold(b) ? 'border-brand bg-brand-soft text-foreground' : 'border-control text-muted-foreground hover:bg-accent hover:text-foreground'"
              >
                @if (isSold(b)) {
                  <app-icon name="check" [size]="15" />
                }
                {{ b }}
                @if (b === primary) {
                  <span class="font-normal opacity-70">· {{ "Primary" | t }}</span>
                }
              </button>
            }
          </div>
        </div>
      </div>

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
  `,
})
export class MyBrandsComponent {
  private settings = inject(SettingsService);
  private catalog = inject(VehicleCatalogService);

  primary = '';
  sold: string[] = [];
  savedFlash = signal(false);

  constructor() {
    this.discard();
  }

  /** Every brand in the catalog (re-read each check, so it follows Price Settings imports). */
  get brands(): string[] {
    return this.catalog.brands();
  }

  isSold(brand: string): boolean {
    return brand === this.primary || this.sold.includes(brand);
  }

  toggleSold(brand: string) {
    if (brand === this.primary) return;
    this.sold = this.sold.includes(brand) ? this.sold.filter((b) => b !== brand) : [...this.sold, brand];
  }

  /** The Primary Brand is always sold; it is never listed twice. */
  onPrimaryChange() {
    this.sold = this.sold.filter((b) => b !== this.primary);
  }

  unsavedCount(): number {
    const s = this.settings.settings();
    const savedSold = (s.salesDefaults.brandsISell ?? []).filter((b) => b !== s.dashboardTarget.brand);
    let n = 0;
    if (this.primary !== s.dashboardTarget.brand) n++;
    if (JSON.stringify([...this.sold].sort()) !== JSON.stringify([...savedSold].sort())) n++;
    return n;
  }

  save() {
    const s = this.settings.settings();
    const brandsISell = this.sold.filter((b) => b !== this.primary);
    // Leave "Brands I sell" unset until the advisor has actually chosen (it drives a one-time hint).
    const brandsChosen = s.salesDefaults.brandsISell !== undefined || brandsISell.length > 0;
    if (brandsChosen) this.settings.updateSalesDefaults({ brandsISell });
    if (this.primary !== s.dashboardTarget.brand) this.settings.updateDashboardTarget({ brand: this.primary });
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  discard() {
    const s = this.settings.settings();
    this.primary = s.dashboardTarget.brand;
    this.sold = (s.salesDefaults.brandsISell ?? []).filter((b) => b !== this.primary);
  }
}
