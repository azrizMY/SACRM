import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-login',
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
            <h1 class="text-lg font-semibold tracking-tight">Welcome back</h1>
            <p class="text-sm text-muted-foreground">Log in to pick up where you left off.</p>
          </div>

          @if (error()) {
            <div class="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs font-medium text-[var(--destructive)]">
              <app-icon name="info" [size]="14" class="shrink-0" />
              {{ error() }}
            </div>
          }

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

            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Password
              <div class="flex items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring">
                <app-icon name="lock" [size]="15" class="shrink-0 text-muted-foreground" />
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  [(ngModel)]="password"
                  placeholder="••••••••"
                  class="h-10 w-full bg-transparent text-sm text-foreground outline-none"
                />
                <button type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" class="-mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="15" />
                </button>
              </div>
            </label>

            <button
              type="submit"
              [disabled]="submitting()"
              class="mt-1 flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              Log In
            </button>
          </form>
        </div>

        <p class="text-center text-sm text-muted-foreground">
          Don't have an account?
          <a routerLink="/signup" class="font-medium text-primary hover:underline">Create one</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = signal(false);
  error = signal<string | null>(null);
  submitting = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  async submit() {
    this.error.set(null);
    if (!this.email || !this.password) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.submitting.set(true);
    const result = await this.auth.login(this.email, this.password);
    this.submitting.set(false);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }
}
