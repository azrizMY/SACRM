import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';

/**
 * One-time gate shown right after a Google sign-in creates a brand-new account — the normal
 * signup form collects Primary Brand up front, but the Google flow has no step of its own to ask,
 * so this fills that gap before the account can reach the dashboard. Reached only from
 * AuthService.loginWithGoogle()'s `isNewUser` flag; never linked to from anywhere in the app shell.
 */
@Component({
  selector: 'app-choose-brand',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="flex min-h-dvh items-center justify-center bg-black px-4 py-10 text-foreground">
      <div class="flex w-full max-w-sm flex-col gap-6">
        <div class="flex items-center justify-center gap-2.5">
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-semibold tracking-tight">Redline</span>
            <span class="text-[11px] text-muted-foreground">Dealership CRM</span>
          </div>
        </div>

        <div class="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div class="flex flex-col gap-1 text-center">
            <h1 class="text-lg font-semibold tracking-tight">One last thing</h1>
            <p class="text-sm text-muted-foreground">Which brand do you primarily sell? You can change this any time in Settings.</p>
          </div>

          <div class="grid grid-cols-1 gap-2">
            @for (b of brands; track b) {
              <button
                type="button"
                (click)="selected.set(b)"
                class="flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors"
                [ngClass]="selected() === b ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-accent'"
              >
                {{ b }}
                @if (selected() === b) {
                  <app-icon name="check" [size]="16" />
                }
              </button>
            }
          </div>

          <button
            type="button"
            [disabled]="!selected()"
            (click)="submit()"
            class="mt-1 flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ChooseBrandComponent {
  brands: string[];
  selected = signal<string | null>(null);

  constructor(
    private settingsService: SettingsService,
    private catalog: VehicleCatalogService,
    private router: Router,
  ) {
    this.brands = this.catalog.brands();
  }

  submit() {
    const brand = this.selected();
    if (!brand) return;
    this.settingsService.updateDashboardTarget({ brand });
    this.router.navigateByUrl('/dashboard');
  }
}
