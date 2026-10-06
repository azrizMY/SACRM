import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AuthLayoutComponent } from '../shared/auth-layout.component';
import { AuthService } from '../shared/auth.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <div class="flex w-full max-w-sm flex-col gap-6">
        <a routerLink="/welcome" class="flex items-center justify-center gap-2.5 lg:hidden">
          <span class="logo-chip flex size-10 items-center justify-center rounded-xl">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-bold tracking-tight">Redline</span>
            <span class="text-[11px] text-muted-foreground">Car Quotation</span>
          </div>
        </a>

        <div class="flex flex-col gap-5 animate-rise rounded-2xl bg-card p-7 text-card-foreground shadow-xl">
          <div class="flex flex-col gap-1 text-center">
            <h1 class="text-2xl font-bold tracking-tight">Create your account</h1>
            <p class="text-sm text-muted-foreground">Set up your consultant profile in a few seconds.</p>
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="info" [size]="14" class="shrink-0" />
              {{ error() }}
            </div>
          }

          <form class="flex flex-col gap-4" (ngSubmit)="submit()">
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Full Name
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_80%)]">
                <app-icon name="user" [size]="15" class="shrink-0 text-muted-foreground" />
                <input type="text" name="name" autocomplete="name" [(ngModel)]="name" placeholder="Your name" class="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
              </div>
            </label>

            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Email
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_80%)]">
                <app-icon name="mail" [size]="15" class="shrink-0 text-muted-foreground" />
                <input type="email" name="email" autocomplete="email" [(ngModel)]="email" placeholder="you@example.com" class="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
              </div>
            </label>

            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Phone Number
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_80%)]">
                <app-icon name="phone" [size]="15" class="shrink-0 text-muted-foreground" />
                <input type="tel" name="phone" autocomplete="tel" [(ngModel)]="phone" placeholder="011-53206966" class="h-10 w-full bg-transparent text-sm text-foreground outline-none" />
              </div>
            </label>

            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Primary Brand
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_80%)]">
                <app-icon name="star" [size]="15" class="shrink-0 text-muted-foreground" />
                <select [(ngModel)]="primaryBrand" name="primaryBrand" class="h-10 w-full bg-transparent text-sm text-foreground outline-none">
                  <option value="" disabled selected>Which brand do you primarily sell?</option>
                  @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                </select>
              </div>
            </label>

            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Password
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_80%)]">
                <app-icon name="lock" [size]="15" class="shrink-0 text-muted-foreground" />
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  name="password"
                  autocomplete="new-password"
                  [(ngModel)]="password"
                  placeholder="At least 8 characters"
                  class="h-10 w-full bg-transparent text-sm text-foreground outline-none"
                />
                <button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" class="-mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="15" />
                </button>
              </div>
            </label>

            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Confirm Password
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_80%)]">
                <app-icon name="lock" [size]="15" class="shrink-0 text-muted-foreground" />
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  name="confirmPassword"
                  autocomplete="new-password"
                  [(ngModel)]="confirmPassword"
                  placeholder="Re-enter password"
                  class="h-10 w-full bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </label>

            <label class="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" name="acceptTerms" [(ngModel)]="acceptTerms" class="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
              <span>
                I agree to the
                <a routerLink="/terms" target="_blank" class="font-medium text-primary hover:underline">Terms of Use</a>
                and
                <a routerLink="/privacy" target="_blank" class="font-medium text-primary hover:underline">Privacy Policy</a>,
                and I have my customers' consent for any of their details I record.
              </span>
            </label>

            <button
              type="submit"
              [disabled]="submitting()"
              class="mt-1 flex items-center justify-center btn-glow rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60"
            >
              Create Account
            </button>
          </form>
        </div>

        <p class="text-center text-sm text-muted-foreground">
          Already have an account?
          <a routerLink="/login" class="font-medium text-primary hover:underline">Log in</a>
        </p>
      </div>
    </app-auth-layout>
  `,
})
export class SignupComponent {
  name = '';
  email = '';
  phone = '';
  primaryBrand = '';
  password = '';
  confirmPassword = '';
  acceptTerms = false;
  showPassword = signal(false);
  error = signal<string | null>(null);
  submitting = signal(false);
  brands: string[];

  constructor(
    private auth: AuthService,
    private router: Router,
    private catalog: VehicleCatalogService,
  ) {
    this.brands = this.catalog.brands();
  }

  async submit() {
    this.error.set(null);

    if (!this.name.trim() || !this.email.trim() || !this.phone.trim() || !this.primaryBrand || !this.password) {
      this.error.set('Fill in your name, email, phone number, primary brand, and password.');
      return;
    }
    if (!this.email.includes('@') || !this.email.includes('.')) {
      this.error.set('Enter a valid email address.');
      return;
    }
    if (this.phone.replace(/\D/g, '').length < 7) {
      this.error.set('Enter a valid phone number.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    if (!this.acceptTerms) {
      this.error.set('Please agree to the Terms of Use and Privacy Policy to continue.');
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.signUp(this.name, this.email, this.password, this.phone, this.primaryBrand);
    this.submitting.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.router.navigateByUrl('/calculator');
  }
}
