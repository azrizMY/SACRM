import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../shared/auth.service';
import { IconComponent, type IconName } from '../shared/icon.component';
import { VEHICLES } from '../data/calculator-data';

/** One selling point: copy on one side, a real screenshot of the app on the other.
 *  The screenshots in public/landing/ are taken from the app with a made-up advisor profile. */
type Showcase = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: 'poster' | 'link' | 'budget' | 'live';
};

const SHOWCASES: Showcase[] = [
  {
    id: 'posters',
    eyebrow: 'Ready-to-post posters',
    title: 'A quote your customer can read at a glance',
    body: 'Every quote becomes a clean poster with the car, the monthly instalment and the full price breakdown, ready for WhatsApp, Instagram and TikTok.',
    points: ['Full Quotation, Monthly Estimate, Compact and Rebate Deal layouts', 'Your own poster colour, plus festive frames for Raya, CNY, Deepavali and more', 'Your name, photo and WhatsApp number on every poster'],
    visual: 'poster',
  },
  {
    id: 'link',
    eyebrow: 'Your own quote link',
    title: 'Let customers work out the numbers themselves',
    body: 'Send one link or show your QR code. Customers pick a car, change the deposit and loan period, compare cars and open brochures, with no app and no login.',
    points: ['One tap sends their exact quote to your WhatsApp', 'They can tell you up front if they have a car to trade in', 'Your profile and contact on every page they open'],
    visual: 'link',
  },
  {
    id: 'budget',
    eyebrow: 'Budget',
    title: 'Start from what the customer can pay each month',
    body: 'Most customers know their monthly, not their car. Enter it with the cash they have, and Redline lists every car that fits, with the deposit each one needs.',
    points: ['Full loan or a maximum deposit, using your own loan rounding', 'Cars just above the budget are shown too, so no option is missed', 'On your Budget page and on your customer\'s quote link'],
    visual: 'budget',
  },
  {
    id: 'live',
    eyebrow: 'Live Mode',
    title: 'Answer "berapa sebulan?" live, on screen',
    body: 'Live Mode puts a big, clear quote on your TikTok Live while you change the car and deposit off camera. Open it in its own window or run it full screen on a tablet.',
    points: ['Every loan period and the full price breakdown', 'Bahasa Melayu or English on screen', 'Your phone number stays hidden unless you switch it on'],
    visual: 'live',
  },
];

const VALUES: { icon: IconName; title: string; blurb: string }[] = [
  { icon: 'lock', title: 'No customer data', blurb: 'Redline never asks for or stores your customers\' names, phone numbers or IC numbers.' },
  { icon: 'tag', title: 'Your prices, your rules', blurb: 'Set your OTR prices, rebates, interest rate and loan rounding once. Every quote follows them.' },
  { icon: 'file-text', title: 'Brochures included', blurb: 'Official brochures for every model, ready to send on WhatsApp in one tap.' },
  { icon: 'message-circle', title: 'English and Bahasa Melayu', blurb: 'The app, posters, Live Mode and WhatsApp messages work in either language.' },
];

/** Brands in catalog order, as shown in the "loaded with" strip. */
const BRANDS = [...new Set(VEHICLES.map((v) => v.brand))];

const FAQS: { q: string; a: string }[] = [
  { q: 'Who is Redline for?', a: 'Car sales advisors in Malaysia who quote their own customers. It works on your own, without a dealership-wide setup.' },
  { q: 'Which brands are included?', a: `${BRANDS.join(', ')}, with ${VEHICLES.length} variants and their brochures. You can change any price, rebate or package in Price Settings.` },
  { q: 'Does my customer need an account to see a quote?', a: 'No. Your quote link opens in any browser. Customers can change the car, deposit and loan period, find cars for their budget and compare them, then WhatsApp you in one tap.' },
  { q: 'Do I need to keep my customers\' details in Redline?', a: 'No. Redline only works out and shares quotes. It never asks for or stores your customers\' names, phone numbers or IC numbers.' },
  { q: 'Can I use Bahasa Melayu?', a: 'Yes. The app, your posters, the Live Screen and the WhatsApp messages can each be set to Bahasa Melayu or English in Settings.' },
  { q: 'Does it work on my phone?', a: 'Yes. Redline works on phones, tablets and computers, and you can install it on your home screen like an app.' },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NgClass, RouterLink, IconComponent],
  template: `
    <div class="flex min-h-dvh flex-col overflow-x-hidden text-foreground">
      <!-- Nav -->
      <header class="sticky top-0 z-40 border-b transition-colors duration-300" [class]="scrolled() ? 'border-border bg-background/85 backdrop-blur-md' : 'border-transparent'">
        <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button type="button" (click)="scrollTo('top')" class="flex items-center gap-2.5 text-left">
            <span class="logo-chip flex size-9 items-center justify-center rounded-xl">
              <app-icon name="car" [size]="18" />
            </span>
            <span class="flex flex-col leading-tight">
              <span class="text-sm font-bold tracking-tight">Redline</span>
              <span class="text-[11px] text-muted-foreground">Car Quotation</span>
            </span>
          </button>
          <nav class="hidden items-center gap-1 md:flex" aria-label="Sections">
            @for (l of navLinks; track l.id) {
              <button type="button" (click)="scrollTo(l.id)" class="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{{ l.label }}</button>
            }
          </nav>
          <div class="flex items-center gap-1 sm:gap-2">
            @if (signedIn()) {
              <a routerLink="/calculator" class="btn-glow whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold">Open Calculator</a>
            } @else {
              <a routerLink="/login" class="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Log In</a>
              <a routerLink="/signup" class="btn-glow whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold">Get Started</a>
            }
          </div>
        </div>
      </header>

      <main id="top" class="flex flex-1 flex-col items-center">
        <!-- Hero -->
        <section class="relative flex w-full flex-col items-center px-4 pt-10 sm:px-6 sm:pt-16">
          <div class="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
          <div class="flex max-w-4xl flex-col items-center gap-6 text-center">
            <span class="animate-rise rounded-full border border-border bg-card px-3.5 py-1 text-xs font-semibold text-muted-foreground">
              For car sales advisors in Malaysia
            </span>
            <h1 class="animate-rise text-balance text-[2.75rem] font-extrabold leading-[1.05] tracking-tight sm:text-7xl" style="--i: 1">
              Quote it. Post it.
              <span class="text-gradient">Close it.</span>
            </h1>
            <p class="animate-rise max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg" style="--i: 2">
              Turn a car price into a full loan quotation in seconds. Share it as a poster, send a link your customer can play with, or show it on TikTok Live.
            </p>
            <div class="animate-rise flex w-full flex-col items-stretch justify-center gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center" style="--i: 3">
              <a [routerLink]="primaryCta().link" class="btn-glow group flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold">
                {{ primaryCta().label }}
                <app-icon name="arrow-up-right" [size]="16" class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <button type="button" (click)="scrollTo('posters')" class="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40">
                See how it works
                <app-icon name="chevron-down" [size]="16" />
              </button>
            </div>
            <ul class="animate-rise flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground" style="--i: 4">
              @for (t of trust; track t) {
                <li class="flex items-center gap-1.5">
                  <app-icon name="check" [size]="14" class="text-[var(--success)]" />
                  {{ t }}
                </li>
              }
            </ul>
          </div>

          <!-- Product shot: the advisor's Calculator, with the customer's quote link on a phone -->
          <div class="animate-rise relative mt-14 w-full max-w-5xl pb-8 sm:pb-16" style="--i: 5">
            <div class="absolute inset-x-16 top-16 -z-10 h-2/3 rounded-full bg-primary/15 blur-3xl" aria-hidden="true"></div>
            <figure class="overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:rounded-2xl">
              <div class="flex items-center gap-1.5 border-b border-border px-4 py-2.5" aria-hidden="true">
                <span class="size-2.5 rounded-full bg-muted-foreground/30"></span>
                <span class="size-2.5 rounded-full bg-muted-foreground/30"></span>
                <span class="size-2.5 rounded-full bg-muted-foreground/30"></span>
              </div>
              <img src="/landing/calculator.webp" width="2160" height="1350" alt="The Redline Calculator with a Chery O5 quote and its poster" class="block h-auto w-full" fetchpriority="high" />
            </figure>
            <div class="phone absolute -bottom-2 right-2 w-[28%] max-w-[15rem] sm:-right-6 sm:bottom-0 md:-right-10">
              <img src="/landing/phone-quote.webp" width="780" height="1688" alt="The same quote on the customer's phone" class="block h-auto w-full rounded-[1.4rem]" />
            </div>
          </div>
        </section>

        <!-- Brands strip -->
        <section class="w-full border-y border-border bg-card/40">
          <div class="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-7 text-center sm:px-6 md:flex-row md:justify-between md:text-left">
            <p class="text-sm text-muted-foreground">
              Loaded with <span class="font-semibold text-foreground">{{ variantCount }} variants</span> and their brochures
            </p>
            <ul class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              @for (b of brands; track b) {
                <li class="text-sm font-bold tracking-tight text-foreground/80">{{ b }}</li>
              }
            </ul>
          </div>
        </section>

        <!-- Selling points -->
        <div id="features" class="flex w-full max-w-6xl scroll-mt-20 flex-col gap-20 px-4 py-20 sm:gap-28 sm:px-6 sm:py-28">
          @for (s of showcases; track s.id; let i = $index) {
            <section [id]="s.id" class="grid scroll-mt-24 items-center gap-10 md:grid-cols-2 md:gap-16">
              <div class="reveal flex flex-col gap-5" [ngClass]="{ 'md:order-2': i % 2 === 1 }">
                <span class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{{ s.eyebrow }}</span>
                <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">{{ s.title }}</h2>
                <p class="text-pretty leading-relaxed text-muted-foreground">{{ s.body }}</p>
                <ul class="flex flex-col gap-3 pt-1">
                  @for (p of s.points; track p) {
                    <li class="flex gap-3 text-sm">
                      <span class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><app-icon name="check" [size]="12" /></span>
                      <span>{{ p }}</span>
                    </li>
                  }
                </ul>
              </div>

              <div class="reveal relative flex justify-center" [ngClass]="{ 'md:order-1': i % 2 === 1 }">
                <div class="absolute inset-10 -z-10 rounded-full bg-primary/12 blur-3xl" aria-hidden="true"></div>
                @switch (s.visual) {
                  @case ('poster') {
                    <img src="/landing/poster.webp" width="1800" height="2336" loading="lazy" alt="A Full Quotation poster for a Chery O5" class="block h-auto w-full max-w-md rounded-xl shadow-2xl" />
                  }
                  @case ('link') {
                    <div class="relative flex w-full max-w-md justify-center">
                      <div class="phone w-[52%] -rotate-3">
                        <img src="/landing/phone-profile.webp" width="780" height="1688" loading="lazy" alt="The advisor's profile on the customer's quote link" class="block h-auto w-full rounded-[1.4rem]" />
                      </div>
                      <div class="phone -ml-[10%] mt-12 w-[52%] rotate-3">
                        <img src="/landing/phone-quote.webp" width="780" height="1688" loading="lazy" alt="The customer's own quote with a WhatsApp button" class="block h-auto w-full rounded-[1.4rem]" />
                      </div>
                    </div>
                  }
                  @case ('budget') {
                    <div class="phone w-[62%] max-w-[17rem]">
                      <img src="/landing/phone-budget-cars.webp" width="780" height="1688" loading="lazy" alt="Cars that fit a RM 900 monthly budget, with the deposit for each" class="block h-auto w-full rounded-[1.4rem]" />
                    </div>
                  }
                  @case ('live') {
                    <figure class="relative w-full max-w-md">
                      <span class="absolute -top-3 right-4 z-10 flex items-center gap-1.5 rounded-md bg-[#fe2c55] px-2 py-1 text-[11px] font-bold tracking-wide text-white shadow">
                        <span class="size-1.5 rounded-full bg-white"></span>LIVE
                      </span>
                      <img src="/landing/live-screen.webp" width="1053" height="1053" loading="lazy" alt="The Live Screen in Bahasa Melayu showing a monthly of RM 1,214" class="block h-auto w-full rounded-xl shadow-2xl" />
                    </figure>
                  }
                }
              </div>
            </section>
          }
        </div>

        <!-- Values -->
        <section class="w-full border-y border-border bg-card/40">
          <div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 class="reveal mx-auto max-w-2xl text-balance text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Built the way you sell</h2>
            <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (v of values; track v.title) {
                <div class="reveal flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                  <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><app-icon [name]="v.icon" [size]="18" /></span>
                  <span class="text-base font-bold">{{ v.title }}</span>
                  <span class="text-pretty text-sm leading-relaxed text-muted-foreground">{{ v.blurb }}</span>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- FAQ -->
        <section id="faq" class="w-full max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <h2 class="reveal text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Questions, answered</h2>
          <div class="mt-10 flex flex-col gap-3">
            @for (f of faqs; track f.q) {
              <details class="reveal group rounded-2xl border border-border bg-card px-5 open:border-primary/30">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-sm font-semibold sm:text-base">
                  {{ f.q }}
                  <app-icon name="chevron-down" [size]="18" class="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p class="pb-5 text-pretty text-sm leading-relaxed text-muted-foreground">{{ f.a }}</p>
              </details>
            }
          </div>
        </section>

        <!-- Final CTA -->
        <section class="w-full px-4 pb-20 sm:px-6">
          <div class="reveal relative mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:py-20">
            <div class="pointer-events-none absolute -bottom-24 left-1/2 -z-10 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" aria-hidden="true"></div>
            <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">Your next quote starts <span class="text-gradient">here.</span></h2>
            <p class="max-w-lg text-pretty text-muted-foreground">{{ signedIn() ? 'Pick up where you left off.' : 'Set up your account and send your first quote today.' }}</p>
            <div class="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
              <a [routerLink]="primaryCta().link" class="btn-glow flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold">
                {{ primaryCta().label }}
                <app-icon name="arrow-up-right" [size]="16" />
              </a>
              @if (!signedIn()) {
                <a routerLink="/login" class="flex items-center justify-center rounded-xl border border-border px-6 py-3.5 text-sm font-semibold transition-colors hover:border-primary/40">I already have an account</a>
              }
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t border-border">
        <div class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span class="flex items-center gap-2">
            <span class="logo-chip flex size-6 items-center justify-center rounded-md"><app-icon name="car" [size]="12" /></span>
            Redline Car Quotation © {{ year }}
          </span>
          <span class="flex gap-4">
            @if (signedIn()) {
              <a routerLink="/calculator" class="transition-colors hover:text-foreground">Calculator</a>
            } @else {
              <a routerLink="/login" class="transition-colors hover:text-foreground">Log In</a>
              <a routerLink="/signup" class="transition-colors hover:text-foreground">Create Account</a>
            }
            <a routerLink="/privacy" class="transition-colors hover:text-foreground">Privacy</a>
            <a routerLink="/terms" class="transition-colors hover:text-foreground">Terms</a>
          </span>
        </div>
      </footer>
    </div>
  `,
  host: { '(window:scroll)': 'onScroll()' },
  styles: `
    .hero-grid {
      background-image:
        linear-gradient(to right, color-mix(in oklch, var(--border), transparent 40%) 1px, transparent 1px),
        linear-gradient(to bottom, color-mix(in oklch, var(--border), transparent 40%) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 70% 55% at 50% 20%, #000 30%, transparent 75%);
    }
    /* A plain phone body around a phone-sized screenshot */
    .phone {
      padding: 6px;
      border-radius: 1.75rem;
      background: #0b0b0d;
      border: 1px solid color-mix(in oklch, var(--border), white 8%);
      box-shadow: 0 30px 60px -20px rgb(0 0 0 / 0.55);
    }
    /* Scroll-driven reveal where supported; elsewhere content simply shows. */
    @supports (animation-timeline: view()) {
      .reveal {
        animation: landing-reveal linear both;
        animation-timeline: view();
        animation-range: entry 0% entry 40%;
      }
      @keyframes landing-reveal {
        from {
          opacity: 0;
          transform: translateY(24px);
        }
      }
    }
  `,
})
export class LandingComponent {
  showcases = SHOWCASES;
  values = VALUES;
  faqs = FAQS;
  brands = BRANDS;
  variantCount = VEHICLES.length;
  year = new Date().getFullYear();
  scrolled = signal(false);
  /** The page is reachable signed in too (via the sidebar logo), so CTAs lead back into the app. */
  signedIn = inject(AuthService).isAuthenticated;
  primaryCta = computed(() => (this.signedIn() ? { link: '/calculator', label: 'Open the Calculator' } : { link: '/signup', label: 'Create your free account' }));

  navLinks = [
    { id: 'posters', label: 'Posters' },
    { id: 'link', label: 'Quote link' },
    { id: 'budget', label: 'Budget' },
    { id: 'live', label: 'Live Mode' },
    { id: 'faq', label: 'FAQ' },
  ];
  trust = ['Current Malaysian prices loaded', 'Works on phone, tablet and PC', 'No customer data stored'];

  onScroll() {
    this.scrolled.set(window.scrollY > 8);
  }

  scrollTo(id: string) {
    if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
