import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="flex min-h-dvh items-center justify-center px-4 py-10 text-foreground">
      <div class="flex w-full max-w-sm flex-col gap-6">
        <a routerLink="/welcome" class="flex items-center justify-center gap-2.5">
          <span class="logo-chip flex size-10 items-center justify-center rounded-xl">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-bold tracking-tight">Redline</span>
            <span class="text-[11px] text-muted-foreground">Dealership CRM</span>
          </div>
        </a>

        <div class="flex flex-col gap-5 glass glow-border animate-rise rounded-2xl p-7 text-card-foreground shadow-[0_30px_80px_-30px_color-mix(in_oklch,var(--primary),transparent_60%)]">
          <div class="flex flex-col gap-1 text-center">
            <h1 class="text-2xl font-bold tracking-tight">Choose a new password</h1>
            <p class="text-sm text-muted-foreground">This link is valid for 30 minutes.</p>
          </div>

          @if (!token()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="info" [size]="14" class="shrink-0" />
              This reset link is missing its token. Request a new one below.
            </div>
          } @else if (error()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="info" [size]="14" class="shrink-0" />
              {{ error() }}
            </div>
          }

          @if (token()) {
            <form class="flex flex-col gap-4" (ngSubmit)="submit()">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                New Password
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
          <a routerLink="/forgot-password" class="font-medium text-primary hover:underline">Request a new link</a>
        </p>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent {
  token = signal<string | null>(null);
  password = '';
  confirmPassword = '';
  showPassword = signal(false);
  error = signal<string | null>(null);
  submitting = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  async submit() {
    this.error.set(null);
    const token = this.token();
    if (!token) return;

    if (this.password.length < 8) {
      this.error.set('Password must be at least 8 characters.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.resetPassword(token, this.password);
    this.submitting.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.router.navigateByUrl('/login');
  }
}
