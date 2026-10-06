import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../shared/auth.service';
import { CountUpDirective } from '../shared/count-up.directive';
import { IconComponent, type IconName } from '../shared/icon.component';
import { LandingDemoComponent } from './landing-demo.component';

type Feature = { icon: IconName; title: string; blurb: string; points?: string[]; span: string };

const FEATURES: Feature[] = [
  {
    icon: 'calculator',
    title: 'Quotation Calculator',
    blurb: 'Price any brand, model and variant with live financing math. Work forwards from the downpayment, or backwards from the monthly installment the customer can afford.',
    points: ['Reverse-calc loan amount & installment', 'Cash or loan deals', 'Tenure & rate presets'],
    span: 'md:col-span-2 md:row-span-2',
  },
  {
    icon: 'sparkles',
    title: 'Ready-to-post Posters',
    blurb: 'Turn a quote into a Classic, Story, Square or Promo poster in one tap, sized for WhatsApp, Instagram and TikTok.',
    span: '',
  },
  {
    icon: 'share',
    title: 'Shareable Quote Links',
    blurb: 'Send customers a link to build their own quote, with no login needed. Your promo card rides along.',
    span: '',
  },
  {
    icon: 'live',
    title: 'Live Mode',
    blurb: 'A loan calculator built for TikTok Live: big, clear numbers on screen while you work the controls.',
    span: '',
  },
  {
    icon: 'table',
    title: 'Compare Cars',
    blurb: 'Up to three cars side by side, same loan setup, so the customer sees the difference at a glance.',
    span: '',
  },
  {
    icon: 'car',
    title: 'Catalog & Brochures',
    blurb: 'Brochures and offer sheets for every model, filterable by brand and ready to download or send.',
    span: '',
  },
  {
    icon: 'tag',
    title: 'Price Settings',
    blurb: 'Set your own OTR prices, rebates and packages once. Every quote picks them up.',
    span: '',
  },
  {
    icon: 'file-text',
    title: 'Your Colours',
    blurb: 'Pick a poster colour once and every poster, offer sheet and quote link matches.',
    span: '',
  },
];

const STEPS: { icon: IconName; title: string; blurb: string }[] = [
  { icon: 'tag', title: 'Set your prices', blurb: 'Load your catalog and price settings once. Your name, photo and socials go on your profile.' },
  { icon: 'calculator', title: 'Quote in seconds', blurb: 'Pick a variant, tune the loan, then send a poster or a live quote link straight to WhatsApp.' },
  { icon: 'live', title: 'Share or go live', blurb: 'Post it, send the quote link, or put Live Mode on your TikTok Live and answer every "berapa sebulan?" on the spot.' },
];

const FAQS: { q: string; a: string }[] = [
  { q: 'Who is Redline for?', a: 'Car sales consultants and advisors who quote their own customers. It works on your own, without a dealership-wide setup.' },
  { q: 'Does my customer need an account to see a quote?', a: 'No. A shareable quote link opens in any browser. Your customer can tweak the downpayment and tenure themselves and see the monthly installment update live.' },
  { q: 'Does it work on my phone?', a: 'Yes. Every screen is built for mobile first, including the calculator, posters and quote links, because that is where most selling happens.' },
  { q: 'Do I need to keep my customers\' details in Redline?', a: 'No. Redline only works out and shares quotes. It never asks for or stores your customers\' names, phone numbers or IC numbers.' },
  { q: 'Can I use my own prices?', a: 'Yes. Price Settings lets you set your own OTR prices, rebates and packages, and every quote and poster uses them.' },
];

/** Decorative bar heights for the hero's mock preview (monthly instalment by tenure). */
const PREVIEW_BARS = [38, 52, 44, 66, 58, 74, 62, 88, 80, 96];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, CountUpDirective, LandingDemoComponent],
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
        <section class="relative flex w-full flex-col items-center px-4 pb-10 pt-10 sm:px-6 sm:pt-16">
          <div class="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>
          <div class="flex max-w-3xl flex-col items-center gap-6 text-center">
            <span class="animate-rise flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <span class="relative flex size-2">
                <span class="animate-rl-ping absolute inline-flex size-full rounded-full bg-primary opacity-75"></span>
                <span class="relative inline-flex size-2 rounded-full bg-primary"></span>
              </span>
              Built for car sales consultants
            </span>
            <h1 class="animate-rise text-balance text-[2.75rem] font-extrabold leading-[1.05] tracking-tight sm:text-7xl" style="--i: 1">
              Quote it. Post it.
              <span class="text-gradient">Close it.</span>
            </h1>
            <p class="animate-rise max-w-xl text-pretty text-base text-muted-foreground sm:text-lg" style="--i: 2">
              Price a car in seconds, then send your customer a poster or a live quote link, or show it on your TikTok Live. It all runs from your phone.
            </p>
            <div class="animate-rise flex w-full flex-col items-stretch justify-center gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center" style="--i: 3">
              <a [routerLink]="primaryCta().link" class="btn-glow group flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold">
                {{ primaryCta().label }}
                <app-icon name="arrow-up-right" [size]="16" class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <button type="button" (click)="scrollTo('features')" class="glass flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40">
                See what's inside
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

          <!-- Product preview -->
          <div class="animate-rise relative mt-14 w-full max-w-5xl" style="--i: 5" aria-hidden="true">
            <div class="absolute -inset-x-10 -inset-y-6 -z-10 rounded-[3rem] bg-primary/20 blur-3xl"></div>
            <div class="hero-float glass glow-border rounded-3xl p-3 sm:p-5">
              <div class="flex items-center gap-1.5 pb-3 sm:pb-4">
                <span class="size-2.5 rounded-full bg-[var(--destructive)]/80"></span>
                <span class="size-2.5 rounded-full bg-[var(--warning)]/80"></span>
                <span class="size-2.5 rounded-full bg-[var(--success)]/80"></span>
                <span class="ml-3 h-2 w-32 rounded-full bg-muted"></span>
              </div>
              <div class="grid gap-3 md:grid-cols-[1fr_17rem]">
                <div class="flex min-w-0 flex-col gap-3">
                  <div class="grid grid-cols-3 gap-3">
                    @for (s of stats; track s.label) {
                      <div class="rounded-xl border border-border bg-card p-3 text-left sm:p-4">
                        <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">{{ s.label }}</p>
                        <p class="mt-1 font-mono text-base font-bold tabular sm:text-2xl" [class]="s.tone" [appCountUp]="s.value" [countUpDuration]="1400"></p>
                      </div>
                    }
                  </div>
                  <div class="flex h-32 items-end gap-2 rounded-xl border border-border bg-card p-4 sm:h-44">
                    @for (h of bars; track $index) {
                      <div class="bar-rise flex-1 rounded-t-md bg-gradient-to-t from-primary/40 to-[var(--primary-glow)]" [style.height.%]="h" [style.--i]="$index"></div>
                    }
                  </div>
                </div>
                <!-- Mini quote card -->
                <div class="hidden flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left md:flex">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote</span>
                    <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Loan</span>
                  </div>
                  <div>
                    <p class="text-sm font-bold">Sedan 1.5 Premium</p>
                    <p class="text-xs text-muted-foreground">OTR RM 98,800</p>
                  </div>
                  <div class="flex flex-col gap-2 text-xs">
                    @for (r of quoteRows; track r.k) {
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">{{ r.k }}</span>
                        <span class="font-mono font-semibold tabular">{{ r.v }}</span>
                      </div>
                    }
                  </div>
                  <div class="mt-auto rounded-lg bg-primary/10 p-3">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-primary">Monthly</p>
                    <p class="font-mono text-2xl font-extrabold tabular text-gradient">RM 1,284</p>
                  </div>
                  <div class="flex gap-2">
                    <span class="btn-glow flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold"><app-icon name="share" [size]="12" /> Share</span>
                    <span class="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold"><app-icon name="download" [size]="12" /> Poster</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Live demo -->
        <section id="demo" class="w-full max-w-5xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-24">
          <div class="reveal mx-auto mb-12 flex max-w-2xl flex-col items-center gap-3 text-center">
            <span class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">See it in action</span>
            <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">A full quote in under a minute</h2>
            <p class="text-pretty text-muted-foreground">Pick the car, set the loan, and send it. The monthly instalment updates as you go.</p>
          </div>
          <app-landing-demo />
        </section>

        <!-- Features -->
        <section id="features" class="w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
          <div class="reveal mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <span class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Everything in one place</span>
            <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">Every quoting tool in your pocket</h2>
            <p class="text-pretty text-muted-foreground">No more spreadsheets and screenshots. Redline keeps every tool you need to quote in one app.</p>
          </div>
          <div class="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            @for (f of features; track f.title) {
              <div class="reveal lift group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-6 text-card-foreground" [class]="f.span">
                <span class="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-primary/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"></span>
                <span class="logo-chip flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <app-icon [name]="f.icon" [size]="20" />
                </span>
                <span class="text-base font-bold" [class]="f.points ? 'md:text-2xl' : ''">{{ f.title }}</span>
                <span class="text-pretty text-sm leading-relaxed text-muted-foreground">{{ f.blurb }}</span>
                @if (f.points) {
                  <ul class="mt-2 flex flex-col gap-2">
                    @for (p of f.points; track p) {
                      <li class="flex items-center gap-2 text-sm"><app-icon name="check" [size]="14" class="text-primary" /> {{ p }}</li>
                    }
                  </ul>
                  <div class="mt-auto hidden gap-2 pt-6 md:flex" aria-hidden="true">
                    @for (d of downpayments; track d) {
                      <span class="rounded-lg border border-border px-3 py-1.5 font-mono text-xs tabular text-muted-foreground" [class.active-chip]="d === '10%'">{{ d }}</span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </section>

        <!-- Share spotlight -->
        <section class="w-full border-y border-border bg-card/40">
          <div class="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2">
            <div class="reveal flex flex-col gap-5">
              <span class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Built for WhatsApp selling</span>
              <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Let customers build their own quote</h2>
              <p class="text-pretty text-muted-foreground">Send one link. Your customer picks the model, slides the downpayment and tenure, and sees the monthly installment live, with your name, photo and contact on every page.</p>
              <ul class="flex flex-col gap-3">
                @for (s of shareBullets; track s.title) {
                  <li class="flex gap-3">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><app-icon [name]="s.icon" [size]="16" /></span>
                    <span class="flex flex-col gap-0.5">
                      <span class="text-sm font-semibold">{{ s.title }}</span>
                      <span class="text-sm text-muted-foreground">{{ s.blurb }}</span>
                    </span>
                  </li>
                }
              </ul>
            </div>
            <!-- Phone mock -->
            <div class="reveal relative mx-auto w-full max-w-[18rem]" aria-hidden="true">
              <div class="absolute -inset-8 -z-10 rounded-full bg-primary/20 blur-3xl"></div>
              <div class="glass glow-border rounded-[2.25rem] p-3">
                <div class="flex flex-col gap-3 rounded-[1.75rem] bg-background p-4">
                  <div class="mx-auto h-1.5 w-16 rounded-full bg-muted"></div>
                  <div class="flex items-center gap-2.5">
                    <span class="logo-chip flex size-9 items-center justify-center rounded-full text-xs font-bold">AR</span>
                    <span class="flex flex-col leading-tight">
                      <span class="text-xs font-bold">Your name</span>
                      <span class="text-[10px] text-muted-foreground">Sales Advisor</span>
                    </span>
                  </div>
                  <div class="rounded-xl border border-border bg-card p-3">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Downpayment</p>
                    <div class="mt-2 h-1.5 rounded-full bg-muted"><div class="slider-fill h-full rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)]"></div></div>
                    <div class="mt-3 grid grid-cols-4 gap-1">
                      @for (t of tenures; track t) {
                        <span class="rounded-md border border-border py-1 text-center font-mono text-[10px] tabular" [class.active-chip]="t === 9">{{ t }}y</span>
                      }
                    </div>
                  </div>
                  <div class="rounded-xl bg-primary/10 p-3 text-center">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-primary">Your monthly</p>
                    <p class="font-mono text-3xl font-extrabold tabular text-gradient">RM 1,284</p>
                  </div>
                  <span class="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--success)] py-2.5 text-xs font-bold text-[var(--success-foreground)]">
                    <app-icon name="message-circle" [size]="14" /> Chat on WhatsApp
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Live Mode -->
        <section class="w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div class="grid items-center gap-12 md:grid-cols-2">
            <div class="reveal order-2 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 md:order-1" aria-hidden="true">
              <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kiraan pinjaman kereta</span>
              <span class="text-2xl font-extrabold">Sedan 1.5 Premium</span>
              <div class="rounded-xl bg-primary/10 p-4">
                <p class="text-xs font-semibold text-muted-foreground">Bulanan serendah</p>
                <p class="font-mono text-4xl font-extrabold tabular text-gradient">RM 1,284</p>
                <p class="text-xs text-muted-foreground">untuk 9 tahun · 2.3% flat</p>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm">
                @for (t of liveTenures; track t.y) {
                  <div class="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <span class="font-semibold">{{ t.y }} tahun</span>
                    <span class="font-mono font-bold tabular text-primary">{{ t.m }}</span>
                  </div>
                }
              </div>
            </div>
            <div class="reveal order-1 flex flex-col gap-5 md:order-2">
              <span class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Made for TikTok Live</span>
              <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Answer "berapa sebulan?" live, on screen</h2>
              <p class="text-pretty text-muted-foreground">Live Mode puts a clean, big-number quote on your stream while you change the car and down payment off camera. Your phone number stays hidden unless you switch it on.</p>
              <a [routerLink]="signedIn() ? '/live' : '/signup'" class="group flex w-fit items-center gap-1.5 text-sm font-semibold text-primary">
                {{ signedIn() ? 'Open Live Mode' : 'Try Live Mode' }}
                <app-icon name="arrow-up-right" [size]="14" class="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </section>

        <!-- How it works -->
        <section id="how" class="w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
          <div class="reveal mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <span class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">How it works</span>
            <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">Up and quoting in minutes</h2>
          </div>
          <ol class="mt-12 grid gap-4 md:grid-cols-3">
            @for (s of steps; track s.title; let i = $index) {
              <li class="reveal relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
                <span class="absolute right-5 top-4 font-mono text-5xl font-extrabold text-muted/80">0{{ i + 1 }}</span>
                <span class="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><app-icon [name]="s.icon" [size]="20" /></span>
                <span class="text-base font-bold">{{ s.title }}</span>
                <span class="text-pretty text-sm leading-relaxed text-muted-foreground">{{ s.blurb }}</span>
              </li>
            }
          </ol>
        </section>

        <!-- FAQ -->
        <section id="faq" class="w-full max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20">
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
          <div class="reveal glow-border relative mx-auto flex max-w-5xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:py-20">
            <div class="pointer-events-none absolute -bottom-24 left-1/2 -z-10 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" aria-hidden="true"></div>
            <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">Your next quote starts <span class="text-gradient">here.</span></h2>
            <p class="max-w-lg text-pretty text-muted-foreground">{{ signedIn() ? 'Pick up where you left off.' : 'Set up your account and send your first quote today.' }}</p>
            <div class="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
              <a [routerLink]="primaryCta().link" class="btn-glow flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold">
                {{ primaryCta().label }}
                <app-icon name="arrow-up-right" [size]="16" />
              </a>
              @if (signedIn()) {
                <a routerLink="/calculator" class="flex items-center justify-center rounded-xl border border-border px-6 py-3.5 text-sm font-semibold transition-colors hover:border-primary/40">Start a new quote</a>
              } @else {
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
    .hero-float {
      animation: landing-float 7s ease-in-out infinite;
    }
    @keyframes landing-float {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }
    .bar-rise {
      transform-origin: bottom;
      animation: landing-bar 1.1s var(--ease-out-expo) both;
      animation-delay: calc(var(--i) * 70ms + 500ms);
    }
    @keyframes landing-bar {
      from {
        transform: scaleY(0);
      }
    }
    .active-chip {
      border-color: color-mix(in oklch, var(--primary), transparent 50%);
      background-color: color-mix(in oklch, var(--primary), transparent 85%);
      color: var(--primary);
      font-weight: 700;
    }
    .slider-fill {
      width: 10%;
      animation: landing-slide 4s var(--ease-out-expo) infinite alternate;
    }
    @keyframes landing-slide {
      to {
        width: 35%;
      }
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
  features = FEATURES;
  liveTenures = [
    { y: 7, m: 'RM 1,566' },
    { y: 5, m: 'RM 2,101' },
  ];
  steps = STEPS;
  faqs = FAQS;
  bars = PREVIEW_BARS;
  year = new Date().getFullYear();
  scrolled = signal(false);
  /** The page is reachable signed in too (via the sidebar logo), so CTAs lead back into the app. */
  signedIn = inject(AuthService).isAuthenticated;
  primaryCta = computed(() => (this.signedIn() ? { link: '/calculator', label: 'Open the Calculator' } : { link: '/signup', label: 'Create your free account' }));

  navLinks = [
    { id: 'demo', label: 'Demo' },
    { id: 'features', label: 'Features' },
    { id: 'how', label: 'How it works' },
    { id: 'faq', label: 'FAQ' },
  ];
  trust = ['Free to start', 'Works on any phone', 'Share straight to WhatsApp'];
  stats = [
    { label: 'Models', value: '75', tone: 'text-foreground' },
    { label: 'From', value: 'RM 924', tone: 'text-[var(--success)]' },
    { label: 'Posters', value: '4', tone: 'text-primary' },
  ];
  quoteRows = [
    { k: 'Downpayment', v: 'RM 9,880' },
    { k: 'Loan amount', v: 'RM 88,920' },
    { k: 'Tenure', v: '9 years' },
    { k: 'Rate', v: '2.60%' },
  ];
  downpayments = ['0%', '10%', '20%', '30%'];
  tenures = [5, 7, 9, 10];
  shareBullets: { icon: IconName; title: string; blurb: string }[] = [
    { icon: 'user', title: 'Your brand on every quote', blurb: 'Your profile, promo card and socials show on the page your customer opens.' },
    { icon: 'sparkles', title: 'Posters for every channel', blurb: 'Story, Square and Promo layouts, ready for WhatsApp Status, Instagram and TikTok.' },
    { icon: 'lock', title: 'No login for customers', blurb: 'The link opens in any browser, so nothing gets in the way of a warm lead.' },
  ];

  onScroll() {
    this.scrolled.set(window.scrollY > 8);
  }

  scrollTo(id: string) {
    if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
