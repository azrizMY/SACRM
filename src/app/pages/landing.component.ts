import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';

const FEATURES: { icon: IconName; title: string; blurb: string }[] = [
  { icon: 'calculator', title: 'Quotation Calculator', blurb: 'Price out any brand, model and variant with live financing math.' },
  { icon: 'users', title: 'Customer Manager', blurb: 'Track every deal from lead to booking to delivery in one pipeline.' },
  { icon: 'wallet', title: 'Cost Breakdown', blurb: 'See commission, gift spend and real profit the moment docs are in.' },
  { icon: 'car', title: 'My Cars', blurb: 'Brochures for every model, filterable by brand, one tap to WhatsApp.' },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="flex min-h-dvh flex-col bg-background text-foreground">
      <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div class="flex items-center gap-2.5">
          <span class="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-semibold tracking-tight">Redline</span>
            <span class="text-[11px] text-muted-foreground">Dealership CRM</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a routerLink="/login" class="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Log In</a>
          <a routerLink="/signup" class="rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Create Account</a>
        </div>
      </header>

      <main class="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div
          class="w-full max-w-6xl overflow-hidden rounded-3xl border border-border"
          style="background: radial-gradient(circle at 20% 15%, color-mix(in oklch, var(--primary), transparent 78%), transparent 45%), radial-gradient(circle at 85% 85%, color-mix(in oklch, var(--primary), transparent 85%), transparent 50%), var(--card);"
        >
          <div class="flex flex-col items-center gap-5 px-6 py-16 text-center sm:px-12">
            <span class="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Built for sales consultants
            </span>
            <h1 class="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Close more deals, <span class="text-primary">faster.</span>
            </h1>
            <p class="max-w-xl text-pretty text-base text-muted-foreground">
              Quote a car, track the customer, cost the deal, and get paid — all from one dashboard built for how you actually sell.
            </p>
            <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a routerLink="/signup" class="flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                Create your account
                <app-icon name="arrow-up-right" [size]="15" />
              </a>
              <a routerLink="/login" class="flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
                Log In
              </a>
            </div>
          </div>
        </div>

        <div class="mt-8 grid w-full max-w-6xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (f of features; track f.title) {
            <div class="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <span class="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <app-icon [name]="f.icon" [size]="17" />
              </span>
              <span class="text-sm font-semibold">{{ f.title }}</span>
              <span class="text-pretty text-xs leading-relaxed text-muted-foreground">{{ f.blurb }}</span>
            </div>
          }
        </div>
      </main>

      <footer class="px-6 py-6 text-center text-xs text-muted-foreground">
        Redline Dealership CRM — a local demo. All data stays in this browser.
      </footer>
    </div>
  `,
})
export class LandingComponent {
  features = FEATURES;
}
