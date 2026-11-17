import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AuthLayoutComponent } from '../shared/auth-layout.component';
import { AuthService } from '../shared/auth.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <div class="flex w-full max-w-sm flex-col gap-6">
        <a routerLink="/welcome" class="flex items-center justify-center gap-2.5 lg:hidden">
          <span class="logo-chip flex size-10 items-center justify-center rounded-xl">
            <app-icon name="car" [size]="20" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-bold tracking-tight">Redline</span>
            <span class="text-xs text-muted-foreground">Car Quotation</span>
          </div>
        </a>

        <div class="flex flex-col gap-5 animate-rise rounded-2xl bg-card p-7 text-card-foreground shadow-xl">
          <div class="flex flex-col gap-1 text-center">
            <h1 class="text-2xl font-bold tracking-tight">Reset your password</h1>
            <p class="text-sm text-muted-foreground">Enter your email and the primary brand on your account, then choose a new password.</p>
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2.5 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="info" [size]="18" class="shrink-0" />
              {{ error() }}
            </div>
          }

          @if (done()) {
            <div class="flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand">
              <app-icon name="check" [size]="18" class="shrink-0" />
              Your password has been reset. You can log in with your new password now.
            </div>
            <a routerLink="/login" class="flex items-center justify-center btn-glow rounded-lg px-4 py-3 text-sm font-semibold">Go to Log In</a>
          } @else {
            <form class="flex flex-col gap-4" (ngSubmit)="submit()">
              <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
                Email
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3">
                  <app-icon name="mail" [size]="18" class="shrink-0 text-muted-foreground" />
                  <input
                    type="email"
                    name="email"
                    autocomplete="email"
                    [(ngModel)]="email"
                    placeholder="you@example.com"
                    class="h-10 w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </div>
              </label>

              <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
                Primary Brand
                <span class="text-sm font-normal text-muted-foreground">The brand you chose when you made your account.</span>
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3">
                  <app-icon name="star" [size]="18" class="shrink-0 text-muted-foreground" />
                  <select [(ngModel)]="primaryBrand" name="primaryBrand" class="h-10 w-full bg-transparent text-sm text-foreground outline-none">
                    <option value="" disabled selected>Choose a brand</option>
                    @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </div>
              </label>

              <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
                New Password
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3">
                  <app-icon name="lock" [size]="18" class="shrink-0 text-muted-foreground" />
                  <input
                    [type]="showPassword() ? 'text' : 'password'"
                    name="password"
                    autocomplete="new-password"
                    [(ngModel)]="password"
                    placeholder="At least 8 characters"
                    class="h-10 w-full bg-transparent text-sm text-foreground outline-none"
                  />
                  <button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" class="-mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
                    <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="18" />
                  </button>
                </div>
              </label>

              <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
                Confirm New Password
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3">
                  <app-icon name="lock" [size]="18" class="shrink-0 text-muted-foreground" />
                  <input
                    [type]="showPassword() ? 'text' : 'password'"
                    name="confirmPassword"
                    autocomplete="new-password"
                    [(ngModel)]="confirmPassword"
                    placeholder="Re-enter new password"
                    class="h-10 w-full bg-transparent text-sm text-foreground outline-none"
                  />
                </div>
              </label>

              <button
                type="submit"
                [disabled]="submitting()"
                class="mt-1 flex items-center justify-center btn-glow rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60"
              >
                Reset Password
              </button>
            </form>
          }
        </div>

        <p class="text-center text-sm text-muted-foreground">
          Remembered your password?
          <a routerLink="/login" class="font-medium text-brand hover:underline">Log in</a>
        </p>
      </div>
    </app-auth-layout>
  `,
})
export class ForgotPasswordComponent {
  email = '';
  primaryBrand = '';
  password = '';
  confirmPassword = '';
  showPassword = signal(false);
  error = signal<string | null>(null);
  submitting = signal(false);
  done = signal(false);
  brands: string[];

  constructor(
    private auth: AuthService,
    catalog: VehicleCatalogService,
  ) {
    this.brands = catalog.brands();
  }

  async submit() {
    this.error.set(null);
    if (!this.email.trim() || !this.primaryBrand || !this.password) {
      this.error.set('Fill in your email, primary brand, and a new password.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set("Passwords don't match.");
      return;
    }
    this.submitting.set(true);
    const result = await this.auth.forgotPassword(this.email.trim(), this.primaryBrand, this.password);
    this.submitting.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.done.set(true);
  }
}
