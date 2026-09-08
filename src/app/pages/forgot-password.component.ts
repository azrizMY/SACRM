import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="flex min-h-dvh items-center justify-center bg-black px-4 py-10 text-foreground">
      <div class="flex w-full max-w-sm flex-col gap-6">
        <a routerLink="/welcome" class="flex items-center justify-center gap-2.5">
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-semibold tracking-tight">Redline</span>
            <span class="text-[11px] text-muted-foreground">Dealership CRM</span>
          </div>
        </a>

        <div class="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div class="flex flex-col gap-1 text-center">
            <h1 class="text-lg font-semibold tracking-tight">Reset your password</h1>
            <p class="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="info" [size]="14" class="shrink-0" />
              {{ error() }}
            </div>
          }

          @if (sent()) {
            <div class="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              <app-icon name="info" [size]="14" class="shrink-0" />
              If an account exists for that email, a reset link is on its way.
            </div>
          } @else {
            <form class="flex flex-col gap-4" (ngSubmit)="submit()">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Email
                <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring">
                  <app-icon name="mail" [size]="15" class="shrink-0 text-muted-foreground" />
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

              <button
                type="submit"
                [disabled]="submitting()"
                class="mt-1 flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                Send Reset Link
              </button>
            </form>
          }
        </div>

        <p class="text-center text-sm text-muted-foreground">
          Remembered your password?
          <a routerLink="/login" class="font-medium text-primary hover:underline">Log in</a>
        </p>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  email = '';
  error = signal<string | null>(null);
  submitting = signal(false);
  sent = signal(false);

  constructor(private auth: AuthService) {}

  async submit() {
    this.error.set(null);
    if (!this.email.trim()) {
      this.error.set('Enter your email address.');
      return;
    }
    this.submitting.set(true);
    const result = await this.auth.forgotPassword(this.email.trim());
    this.submitting.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.sent.set(true);
  }
}
