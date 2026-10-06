import { CarShadowPipe } from './car-shadow';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

/** Shared frame for the signed-out pages (log in, sign up, forgot/reset password): the form on the
 *  right, and on wide screens a showcase panel on the left with a mock quote card — a preview of
 *  what the app actually makes. The panel is decoration only (aria-hidden); its figures are sample
 *  values, not anyone's data. */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink, IconComponent, CarShadowPipe],
  styles: `
    @keyframes auth-float {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-8px);
      }
    }
    .float-a {
      animation: auth-float 6s ease-in-out infinite;
    }
    .float-b {
      animation: auth-float 7s ease-in-out -2s infinite;
    }
    .float-c {
      animation: auth-float 8s ease-in-out -4s infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .float-a,
      .float-b,
      .float-c {
        animation: none;
      }
    }
  `,
  template: `
    <div class="flex min-h-dvh text-foreground">
      <!-- Showcase (desktop only) -->
      <aside class="relative hidden w-[52%] shrink-0 flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex xl:p-14" aria-hidden="true">
        <div class="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary),transparent_78%),transparent)]"></div>
        <div class="pointer-events-none absolute -bottom-48 right-[-120px] size-[480px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"></div>

        <a routerLink="/welcome" tabindex="-1" class="relative flex items-center gap-2.5">
          <span class="logo-chip flex size-10 items-center justify-center rounded-xl">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col leading-tight">
            <span class="text-sm font-bold tracking-tight">Redline</span>
            <span class="text-[11px] text-muted-foreground">Dealership CRM</span>
          </div>
        </a>

        <div class="relative flex flex-col gap-10">
          <div class="flex max-w-xl flex-col gap-3">
            <h2 class="text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
              Quote in seconds.<br />
              <span class="text-primary">Close</span> with confidence.
            </h2>
            <p class="text-sm text-muted-foreground">Prices, rebates, insurance and monthly instalments worked out for you — then shared as a poster or a live link.</p>
          </div>

          <!-- Mock quote card + floating status chips -->
          <div class="relative h-[330px] max-w-[520px]">
            <div class="float-a absolute left-10 top-2 w-[300px] -rotate-3 overflow-hidden rounded-2xl bg-white shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)]">
              <div class="flex items-center justify-between px-5 pt-4">
                <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Chery · 2026</span>
                <span class="rounded bg-[#D61E2A] px-1.5 py-0.5 text-[10px] font-bold text-white">QUOTE</span>
              </div>
              <div class="px-5 text-xl font-bold text-neutral-900">Chery O5</div>
              <img [src]="'/cars/chery-o5.png' | carShadow" alt="" class="mx-auto h-32 w-auto object-contain" />
              <div class="flex items-end justify-between bg-[#121214] px-5 py-4">
                <div class="flex flex-col">
                  <span class="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400">Monthly from</span>
                  <span class="text-2xl font-bold text-white"><span class="text-sm text-[#E6303F]">RM </span>1,202<span class="text-xs font-semibold text-neutral-400"> /mth</span></span>
                </div>
                <span class="text-[10px] font-semibold text-neutral-400">9 yrs · 2.3% flat</span>
              </div>
            </div>

            <div class="float-b absolute right-0 top-6 flex items-center gap-2.5 rounded-xl bg-card px-3.5 py-2.5 shadow-xl">
              <span class="flex size-8 items-center justify-center rounded-lg bg-[var(--success)]/15 text-[var(--success)]"><app-icon name="check" [size]="15" /></span>
              <div class="flex flex-col leading-tight">
                <span class="text-xs font-semibold">Deal booked</span>
                <span class="text-[11px] text-muted-foreground">Tiggo 8 Pro · just now</span>
              </div>
            </div>

            <div class="float-c absolute bottom-10 right-8 flex items-center gap-2.5 rounded-xl bg-card px-3.5 py-2.5 shadow-xl">
              <span class="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary"><app-icon name="gift" [size]="15" /></span>
              <div class="flex flex-col leading-tight">
                <span class="text-xs font-semibold">Rebate applied</span>
                <span class="text-[11px] text-[var(--success)]">−RM 13,000</span>
              </div>
            </div>

            <div class="float-b absolute bottom-0 left-0 flex items-center gap-2.5 rounded-xl bg-card px-3.5 py-2.5 shadow-xl">
              <span class="flex size-8 items-center justify-center rounded-lg bg-[#25D366]/15 text-[var(--whatsapp-text)]"><app-icon name="message-circle" [size]="15" /></span>
              <div class="flex flex-col leading-tight">
                <span class="text-xs font-semibold">Quote sent</span>
                <span class="text-[11px] text-muted-foreground">via WhatsApp</span>
              </div>
            </div>
          </div>
        </div>

        <div class="relative flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5"><app-icon name="calculator" [size]="13" class="text-primary" /> Instant quotes</span>
          <span class="flex items-center gap-1.5"><app-icon name="users" [size]="13" class="text-primary" /> Lead pipeline</span>
          <span class="flex items-center gap-1.5"><app-icon name="layout-dashboard" [size]="13" class="text-primary" /> Sales dashboard</span>
        </div>
      </aside>

      <!-- Form -->
      <div class="flex flex-1 flex-col">
        <main class="flex flex-1 items-center justify-center px-4 py-10">
          <ng-content />
        </main>
        <footer class="flex justify-center gap-4 pb-6 text-xs text-muted-foreground">
          <a routerLink="/privacy" class="transition-colors hover:text-foreground">Privacy Policy</a>
          <a routerLink="/terms" class="transition-colors hover:text-foreground">Terms of Use</a>
        </footer>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {}
