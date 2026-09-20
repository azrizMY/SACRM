import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { toMalaysianWhatsAppNumber } from '../data/dashboard-data';

/**
 * Setup step for a Google account that skipped the signup form. Asks every question the signup form
 * does; what Google already gave us (name, email) is only offered as a tap-to-use suggestion, never
 * filled in automatically. authGuard keeps the account here until it's saved — see
 * AuthUser.needsOnboarding, which the server derives from the account's real data.
 */
@Component({
  selector: 'app-choose-brand',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
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
            <p class="text-sm text-muted-foreground">Set up your consultant profile. You can change these later.</p>
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="info" [size]="14" class="shrink-0" />
              {{ error() }}
            </div>
          }

          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Full Name
            <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring">
              <app-icon name="user" [size]="15" class="shrink-0 text-muted-foreground" />
              <input type="text" name="name" autocomplete="name" [(ngModel)]="name" placeholder="Your name" class="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
            </div>
            @if (suggestedName && name !== suggestedName) {
              <button type="button" (click)="name = suggestedName" class="w-fit text-left text-[11px] text-primary hover:underline">Use {{ suggestedName }} (from Google)</button>
            }
          </label>

          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Email
            <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring">
              <app-icon name="mail" [size]="15" class="shrink-0 text-muted-foreground" />
              <input type="email" name="email" autocomplete="email" [(ngModel)]="email" placeholder="you@example.com" class="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
            </div>
            @if (suggestedEmail && email !== suggestedEmail) {
              <button type="button" (click)="email = suggestedEmail" class="w-fit text-left text-[11px] text-primary hover:underline">Use {{ suggestedEmail }} (from Google)</button>
            }
          </label>

          <div class="flex flex-col gap-2">
            <span class="text-xs font-medium text-muted-foreground">Which brand do you primarily sell?</span>
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

          <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Phone Number
            <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring">
              <app-icon name="phone" [size]="15" class="shrink-0 text-muted-foreground" />
              <input type="tel" name="phone" autocomplete="tel" [(ngModel)]="phone" placeholder="011-53206966" class="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
            </div>
          </label>

          <button
            type="button"
            (click)="submit()"
            class="mt-1 flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
  name = '';
  email = '';
  phone = '';
  readonly suggestedName: string;
  readonly suggestedEmail: string;
  error = signal<string | null>(null);

  constructor(
    private settingsService: SettingsService,
    private advisor: AdvisorService,
    private auth: AuthService,
    private catalog: VehicleCatalogService,
    private router: Router,
  ) {
    this.brands = this.catalog.brands();
    const google = this.auth.currentUser();
    this.suggestedName = google?.name ?? '';
    this.suggestedEmail = google?.email ?? '';
  }

  submit() {
    this.error.set(null);
    const brand = this.selected();
    if (!this.name.trim()) {
      this.error.set('Enter your full name.');
      return;
    }
    if (!this.email.includes('@') || !this.email.includes('.')) {
      this.error.set('Enter a valid email address.');
      return;
    }
    if (!brand) {
      this.error.set('Choose the brand you primarily sell.');
      return;
    }
    if (this.phone.replace(/\D/g, '').length < 7) {
      this.error.set('Enter a valid phone number.');
      return;
    }
    const phone = this.phone.trim();
    this.settingsService.updateDashboardTarget({ brand });
    this.advisor.update({ name: this.name.trim(), email: this.email.trim(), phoneDisplay: phone, phoneWa: toMalaysianWhatsAppNumber(phone) });
    this.auth.completeOnboarding();
    this.router.navigateByUrl('/dashboard');
  }
}
