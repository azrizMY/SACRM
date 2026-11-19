import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../shared/auth.service';
import { IconComponent, type IconName } from '../shared/icon.component';
import { VEHICLES, modelVariantLabel, type Vehicle } from '../data/calculator-data';
import { brandLogo, formatRM2 } from '../data/dashboard-data';
import { QuoteEngine } from '../shared/quote-engine';
import { quotePosterData } from '../shared/quote-poster-data';
import { classicTemplate } from '../shared/poster-template-classic';
import { posterFontsReady } from '../shared/poster-theme';
import type { AdvisorService } from '../shared/advisor.service';

/**
 * A money figure whose digits roll like a counter when the value changes (each digit is a
 * 0–9 strip moved into place). Screen readers get the plain value.
 */
@Component({
  selector: 'app-roll-figure',
  standalone: true,
  template: `<span class="roll" role="text" [attr.aria-label]="value()"
    >@for (ch of chars(); track $index) {
      @if (isDigit(ch)) {
        <span class="roll-d" aria-hidden="true"><span class="roll-s" [style.transform]="'translateY(-' + ch + 'em)'">
          @for (d of digits; track d) { <span>{{ d }}</span> }
        </span></span>
      } @else {
        <span aria-hidden="true">{{ ch }}</span>
      }
    }</span
  >`,
  styles: `
    .roll { display: inline-flex; align-items: baseline; font-variant-numeric: tabular-nums; white-space: pre; }
    .roll-d { display: inline-block; height: 1em; line-height: 1em; overflow: hidden; vertical-align: baseline; }
    .roll-s { display: flex; flex-direction: column; transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); }
    .roll-s > span { height: 1em; line-height: 1em; }
    @media (prefers-reduced-motion: reduce) { .roll-s { transition: none; } }
  `,
})
export class RollFigureComponent {
  value = input.required<string>();
  chars = computed(() => this.value().split(''));
  digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  isDigit(ch: string) {
    return ch >= '0' && ch <= '9';
  }
}

/** The made-up advisor on the demo poster (never a real person's details). */
const DEMO_ADVISOR = {
  profile: () => ({ name: 'Nur Aisyah', role: 'Sales Consultant', phoneDisplay: '012-345 6789', bio: 'Helping customers find the right car and the right deal.', photoUrl: undefined }),
  initials: () => 'NA',
} as unknown as AdvisorService;

/** The cars on the try-it calculator: one familiar model from each of the main brands. */
const DEMO_MODELS: [brand: string, model: string][] = [
  ['Proton', 'Saga'],
  ['Perodua', 'Myvi'],
  ['Proton', 'X50'],
  ['Honda', 'City'],
  ['Chery', 'Tiggo Cross'],
  ['Omoda | Jaecoo', 'J7'],
];

/** The handwriting on the "old way" side: only this page uses it, so it's added on first visit. */
let scrawlFontAdded = false;
function loadScrawlFont() {
  if (scrawlFontAdded || typeof document === 'undefined') return;
  scrawlFontAdded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap';
  document.head.appendChild(link);
}

/** Brands in catalog order, for the "loaded with" row. */
const BRANDS = [...new Set(VEHICLES.map((v) => v.brand))];

type Story = { id: string; title: string; body: string; points: string[]; visual: 'poster' | 'link' | 'budget' };
const STORIES: Story[] = [
  {
    id: 'posters',
    title: 'A poster your customer reads at a glance',
    body: 'Every quote becomes a clean poster with the car, the monthly instalment and the full price breakdown, ready for WhatsApp, Instagram and TikTok.',
    points: ['Full Quotation, Monthly Estimate, Compact and Rebate Deal layouts', 'Your own colour across the app, posters and quote link', 'Your name and WhatsApp number on every poster'],
    visual: 'poster',
  },
  {
    id: 'link',
    title: 'A quote link your customer can play with',
    body: 'Send one link or show your QR code. Customers see your profile, pick a car, change the deposit and loan period and open brochures, with no app and no login.',
    points: ['One tap sends their exact quote to your WhatsApp', 'Your cover photo, bio and socials on your profile page', 'They can tell you up front if they have a car to trade in'],
    visual: 'link',
  },
  {
    id: 'budget',
    title: 'Start from what they can pay each month',
    body: 'Most customers know their monthly, not their car. Enter it with the cash they have, and Redline lists every car that fits, with the deposit each one needs.',
    points: ['Full loan or a maximum deposit, using your own loan rounding', 'Cars just above the budget are shown too', 'On your Budget page and on your quote link'],
    visual: 'budget',
  },
];

const VALUES: { icon: IconName; title: string; blurb: string }[] = [
  { icon: 'lock', title: 'No customer data', blurb: "Redline never asks for or stores your customers' names, phone numbers or IC numbers." },
  { icon: 'tag', title: 'Your prices, your rules', blurb: 'Set your OTR prices, rebates, interest rate and loan rounding once. Every quote follows them.' },
  { icon: 'file-text', title: 'Brochures included', blurb: 'Official brochures for every model, ready to send on WhatsApp in one tap.' },
  { icon: 'languages', title: 'English and Bahasa Melayu', blurb: 'The app, posters, Live Mode and WhatsApp messages work in either language.' },
];

const FAQS: { q: string; a: string }[] = [
  { q: 'Who is Redline for?', a: 'Car sales advisors in Malaysia who quote their own customers. It works on your own, without a dealership-wide setup.' },
  { q: 'Which brands are included?', a: `${BRANDS.join(', ')}, with ${VEHICLES.length} variants and their brochures. You can change any price, rebate or package in Price Settings.` },
  { q: 'Does my customer need an account to see a quote?', a: 'No. Your quote link opens in any browser. Customers can change the car, deposit and loan period, find cars for their budget and compare them, then WhatsApp you in one tap.' },
  { q: "Do I need to keep my customers' details in Redline?", a: "No. Redline only works out and shares quotes. It never asks for or stores your customers' names, phone numbers or IC numbers." },
  { q: 'Can I use Bahasa Melayu?', a: 'Yes. The app, your posters, the Live Screen and the WhatsApp messages can each be set to Bahasa Melayu or English in Settings.' },
  { q: 'Does it work on my phone?', a: 'Yes. Redline works on phones, tablets and computers, and you can install it on your home screen like an app.' },
];

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [NgClass, RouterLink, IconComponent, RollFigureComponent],
  template: `
    <div class="flex min-h-dvh flex-col overflow-x-hidden text-foreground">
      <!-- Nav -->
      <header class="sticky top-0 z-40 border-b transition-colors duration-300" [class]="scrolled() ? 'border-border bg-background' : 'border-transparent bg-background'">
        <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <button type="button" (click)="scrollTo('top')" class="flex items-center gap-2.5 text-left">
            <span class="logo-chip flex size-9 items-center justify-center rounded-xl"><app-icon name="car" [size]="20" /></span>
            <span class="text-base font-bold tracking-tight">Redline</span>
          </button>
          <nav class="hidden items-center gap-1 md:flex" aria-label="Sections">
            @for (l of navLinks; track l.id) {
              <button type="button" (click)="scrollTo(l.id)" class="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{{ l.label }}</button>
            }
          </nav>
          <div class="flex items-center gap-1 sm:gap-2">
            @if (signedIn()) {
              <a routerLink="/calculator" class="btn btn-primary">Open Calculator</a>
            } @else {
              <a routerLink="/login" class="btn">Log in</a>
              <a routerLink="/signup" class="btn btn-primary">Get started</a>
            }
          </div>
        </div>
      </header>

      <main id="top" class="flex flex-1 flex-col items-center">
        <!-- Hero: the old way against Redline, live -->
        <section class="flex w-full flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
          <h1 class="enter text-balance text-center text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            “Berapa sebulan?”<br />
            <span class="text-brand">Answered in 3 seconds.</span>
          </h1>
          <p class="enter mt-5 max-w-2xl text-pretty text-center text-base text-muted-foreground sm:text-lg" style="--d: 80ms">
            For car sales advisors in Malaysia. Pick a car, a deposit and the years: Redline works out the monthly and the poster, ready to send. Try it right here.
          </p>

          <!-- Phones: one side at a time -->
          <div class="enter mt-7 flex w-full max-w-sm rounded-xl bg-muted p-1 md:hidden" role="tablist" aria-label="Compare" style="--d: 140ms">
            <button type="button" role="tab" [attr.aria-selected]="phoneSide() === 'old'" (click)="phoneSide.set('old')" class="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors" [ngClass]="phoneSide() === 'old' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'">The old way</button>
            <button type="button" role="tab" [attr.aria-selected]="phoneSide() === 'new'" (click)="phoneSide.set('new')" class="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors" [ngClass]="phoneSide() === 'new' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'">With Redline</button>
          </div>

          <div
            #stage
            class="enter stage relative mt-4 w-full max-w-[1240px] overflow-hidden rounded-[1.4rem] border border-border md:mt-10 md:grid md:min-h-[35rem] md:grid-cols-[minmax(0,var(--split))_minmax(0,1fr)]"
            [style.--split]="split() + '%'"
            style="--d: 160ms"
          >
            <!-- The old way: a hand calculation that never quite finishes -->
            <div class="old relative flex-col gap-5 overflow-hidden p-6 sm:p-8 md:flex" [ngClass]="phoneSide() === 'old' ? 'flex' : 'hidden'">
              <span class="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">The old way · about 4 minutes</span>
              <div class="scrawl text-muted-foreground" aria-label="A hand calculation of the same quote, still unfinished">
                <p style="--l: 0">{{ scrawl().car }} = {{ scrawl().price }}</p>
                <p style="--l: 1">dep 10% = <s>{{ scrawl().wrong }}</s> {{ scrawl().dep }}</p>
                <p style="--l: 2">loan {{ scrawl().loan }} × {{ scrawl().rate }}% × {{ scrawl().years }} = ?</p>
                <p style="--l: 3">+ insurance ... berapa ya?</p>
                <p style="--l: 4">÷ {{ scrawl().months }} = <span class="dots">...</span></p>
              </div>
              <div class="old-calc self-end lg:mt-auto" aria-hidden="true">
                <div class="old-calc-screen">{{ scrawl().typing }}<span class="caret"></span></div>
                <div class="old-calc-keys">
                  @for (k of calcKeys; track $index) { <span>{{ k }}</span> }
                </div>
              </div>
            </div>

            <!-- The seam between them (drag it, or use the arrow keys) -->
            <div
              class="seam absolute inset-y-0 z-10 hidden w-6 -translate-x-1/2 cursor-ew-resize touch-none md:block"
              [style.left]="split() + '%'"
              role="separator"
              aria-orientation="vertical"
              aria-label="Drag to compare the old way with Redline"
              [attr.aria-valuenow]="split()"
              aria-valuemin="30"
              aria-valuemax="50"
              tabindex="0"
              (pointerdown)="seamDown($event)"
              (pointermove)="seamMove($event)"
              (pointerup)="seamUp($event)"
              (pointercancel)="seamUp($event)"
              (keydown)="seamKey($event)"
            >
              <span class="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-primary"></span>
              <span class="seam-knob absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground" [class.nudge]="!seamTouched()">
                <app-icon name="chevrons-up-down" [size]="18" class="rotate-90" />
              </span>
            </div>

            <!-- With Redline: the real calculator and poster -->
            <div class="new flex-col gap-5 bg-card p-5 sm:p-7 md:flex md:pl-10" [ngClass]="phoneSide() === 'new' ? 'flex' : 'max-md:hidden'">
              <span class="w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">With Redline · 3 seconds</span>
              <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <div class="flex min-w-0 flex-col gap-4">
                  <div class="flex flex-col gap-2">
                    <span class="text-sm font-medium text-muted-foreground">Car</span>
                    <div class="flex flex-wrap gap-1.5" role="group" aria-label="Car">
                      @for (c of demoCars; track c.id) {
                        <button type="button" (click)="pickCar(c)" [attr.aria-pressed]="isCar(c)" class="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors" [ngClass]="isCar(c) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'">{{ c.model }}</button>
                      }
                    </div>
                    <span class="text-sm"><span class="font-semibold">{{ carTitle() }}</span><span class="text-muted-foreground">&nbsp;· OTR {{ price() }}</span></span>
                  </div>
                  <div class="flex flex-wrap gap-x-6 gap-y-4">
                    <div class="flex flex-col gap-2">
                      <span class="text-sm font-medium text-muted-foreground">Deposit</span>
                      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Deposit">
                        @for (p of q.downpaymentPresets; track $index) {
                          <button type="button" (click)="q.applyDownpaymentPreset(p)" [attr.aria-pressed]="q.isDownpaymentPreset(p)" class="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors" [ngClass]="q.isDownpaymentPreset(p) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'">{{ q.downpaymentPresetLabel(p) }}</button>
                        }
                      </div>
                    </div>
                    <div class="flex flex-col gap-2">
                      <span class="text-sm font-medium text-muted-foreground">Years</span>
                      <div class="flex gap-1.5" role="group" aria-label="Years">
                        @for (y of years; track y) {
                          <button type="button" (click)="q.selectRepaymentTenure(y * 12)" [attr.aria-pressed]="q.highlightedTenure() === y * 12" class="flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors" [ngClass]="q.highlightedTenure() === y * 12 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'">{{ y }}</button>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="answer order-first rounded-2xl px-5 py-4 md:order-none md:mt-1" aria-live="polite">
                    <span class="text-sm font-medium text-muted-foreground">Monthly · {{ q.highlightedTenure() / 12 }} years · {{ q.interestRate() }}% flat</span>
                    <div class="fig mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[2.6rem] leading-none text-brand sm:text-5xl">
                      <app-roll-figure [value]="monthly()" />
                      <span class="whitespace-nowrap text-base font-semibold text-muted-foreground">/ month</span>
                    </div>
                    <span class="mt-2 block text-sm text-muted-foreground">Price with insurance {{ allIn() }}<br />Deposit {{ deposit() }} · Loan {{ loan() }}</span>
                  </div>

                  <a [routerLink]="primaryCta().link" class="btn btn-primary btn-lg w-full">
                    {{ signedIn() ? 'Open the Calculator' : 'Create your account to send it' }}
                    <app-icon name="arrow-up-right" [size]="18" />
                  </a>
                  <span class="-mt-2 text-xs text-muted-foreground">Example figures at the app's default rate. Your own prices, rebates and rate apply once you sign up.</span>
                </div>

                <figure class="flex flex-col items-center gap-2 self-start">
                  <div class="poster-frame w-full max-w-[16rem] overflow-hidden rounded-xl bg-white">
                    <canvas #poster class="block h-auto w-full" aria-label="The quote poster for this car, updated live"></canvas>
                  </div>
                  <figcaption class="text-center text-xs text-muted-foreground">The real poster, redrawn as you change it</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        <!-- Brands -->
        <section class="w-full border-y border-border bg-card/50">
          <div class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
            <p class="text-center text-sm text-muted-foreground md:text-left">Loaded with <span class="font-semibold text-foreground">{{ variantCount }} variants</span>, current prices and official brochures</p>
            <ul class="flex flex-wrap items-center justify-center gap-2">
              @for (b of brands; track b) {
                <li class="flex h-11 w-[5.5rem] items-center justify-center rounded-lg bg-white px-2.5" [title]="b">
                  @if (logo(b); as src) { <img [src]="src" [alt]="b" class="max-h-7 max-w-full object-contain" loading="lazy" /> } @else { <span class="text-xs font-bold text-neutral-800">{{ b }}</span> }
                </li>
              }
            </ul>
          </div>
        </section>

        <!-- What happens after the answer -->
        <div id="features" class="flex w-full max-w-6xl scroll-mt-20 flex-col gap-24 px-4 py-20 sm:gap-32 sm:px-6 sm:py-28">
          <h2 class="max-w-3xl text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">Then send it the way your customer wants it.</h2>
          @for (s of stories; track s.id; let i = $index) {
            <section [id]="s.id" class="grid scroll-mt-24 items-center gap-10 md:grid-cols-2 md:gap-16">
              <div class="flex flex-col gap-5" [ngClass]="{ 'md:order-2': i % 2 === 1 }">
                <h3 class="text-balance text-2xl font-extrabold tracking-tight sm:text-4xl">{{ s.title }}</h3>
                <p class="max-w-xl text-pretty leading-relaxed text-muted-foreground">{{ s.body }}</p>
                <ul class="flex flex-col divide-y divide-border border-y border-border">
                  @for (p of s.points; track p) {
                    <li class="flex gap-3 py-3 text-sm"><app-icon name="check" [size]="18" class="mt-px shrink-0 text-brand" />{{ p }}</li>
                  }
                </ul>
              </div>
              <div class="relative flex justify-center" [ngClass]="{ 'md:order-1': i % 2 === 1 }">
                @switch (s.visual) {
                  @case ('poster') {
                    <img src="/landing/poster.webp" width="1800" height="2336" loading="lazy" alt="A Full Quotation poster for a Proton Saga" class="tilt block h-auto w-full max-w-md rounded-xl" />
                  }
                  @case ('link') {
                    <div class="relative flex w-full max-w-md justify-center">
                      <div class="phone w-[52%] -rotate-3"><img src="/landing/phone-profile.webp" width="780" height="1688" loading="lazy" alt="The advisor's profile page on the customer's quote link" class="block h-auto w-full rounded-[1.4rem]" /></div>
                      <div class="phone -ml-[10%] mt-14 w-[52%] rotate-3"><img src="/landing/phone-quote.webp" width="780" height="1688" loading="lazy" alt="The customer's own quote with a WhatsApp button" class="block h-auto w-full rounded-[1.4rem]" /></div>
                    </div>
                  }
                  @case ('budget') {
                    <div class="phone w-[62%] max-w-[17rem]"><img src="/landing/phone-budget.webp" width="780" height="1688" loading="lazy" alt="Cars that fit a RM 900 monthly on a full loan" class="block h-auto w-full rounded-[1.4rem]" /></div>
                  }
                }
              </div>
            </section>
          }
        </div>

        <!-- Live Mode: one vertical stage, like the Live itself -->
        <section id="live" class="flex min-h-[min(100svh,60rem)] w-full scroll-mt-16 items-center border-y border-border bg-card/50">
          <div class="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-20">
            <div class="flex flex-col gap-5">
              <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">Answer “berapa sebulan?” live, on screen.</h2>
              <p class="max-w-xl text-pretty leading-relaxed text-muted-foreground">Live Mode puts a big, clear quote on your TikTok Live while you change the car and deposit off camera. Open it in its own window, or run it full screen on a tablet.</p>
              <ul class="flex flex-col divide-y divide-border border-y border-border">
                @for (p of livePoints; track p) {
                  <li class="flex gap-3 py-3 text-sm"><app-icon name="check" [size]="18" class="mt-px shrink-0 text-brand" />{{ p }}</li>
                }
              </ul>
            </div>
            <div class="live-stage relative mx-auto flex aspect-[9/16] h-[min(80svh,44rem)] max-w-[88vw] flex-col overflow-hidden rounded-[2rem] border border-border bg-[#0b0b0d]">
              <div class="flex items-center gap-2.5 px-4 pb-3 pt-4">
                <span class="logo-chip flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">NA</span>
                <span class="flex min-w-0 flex-col leading-tight"><span class="truncate text-sm font-semibold text-white">Nur Aisyah</span><span class="text-xs text-white/60">Sales Consultant</span></span>
                <span class="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-xs font-bold tracking-wide text-primary-foreground"><span class="size-1.5 rounded-full bg-white"></span>LIVE</span>
              </div>
              <img src="/landing/live-screen.webp" width="936" height="936" loading="lazy" alt="The Live Screen in Bahasa Melayu showing the monthly for a Proton Saga" class="block w-full" />
              <ul class="comments mt-auto flex flex-col gap-1.5 px-3 pb-3 pt-4" aria-hidden="true">
                @for (c of liveComments; track c; let i = $index) {
                  <li class="comment w-fit max-w-full rounded-full bg-white/10 px-3 py-1.5 text-xs text-white" [style.--n]="i"><span class="font-semibold text-white/70">viewer · </span>{{ c }}</li>
                }
              </ul>
              <div class="mx-3 mb-4 rounded-full border border-white/15 px-4 py-2.5 text-xs text-white/45" aria-hidden="true">Add comment…</div>
            </div>
          </div>
        </section>

        <!-- Values -->
        <section class="w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 class="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Built the way you sell.</h2>
          <dl class="mt-10 grid gap-x-12 border-t border-border sm:grid-cols-2">
            @for (v of values; track v.title) {
              <div class="flex gap-4 border-b border-border py-6">
                <app-icon [name]="v.icon" [size]="22" class="mt-0.5 shrink-0 text-brand" />
                <div class="flex flex-col gap-1">
                  <dt class="text-base font-bold">{{ v.title }}</dt>
                  <dd class="text-pretty text-sm leading-relaxed text-muted-foreground">{{ v.blurb }}</dd>
                </div>
              </div>
            }
          </dl>
        </section>

        <!-- FAQ -->
        <section id="faq" class="w-full max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-24">
          <h2 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Questions, answered.</h2>
          <div class="mt-8 flex flex-col border-t border-border">
            @for (f of faqs; track f.q) {
              <details class="group border-b border-border">
                <summary class="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-semibold">
                  {{ f.q }}
                  <app-icon name="chevron-down" [size]="20" class="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p class="max-w-2xl pb-5 text-pretty text-sm leading-relaxed text-muted-foreground">{{ f.a }}</p>
              </details>
            }
          </div>
        </section>

        <!-- Close -->
        <section class="w-full border-t border-border bg-card/50">
          <div class="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:py-20 lg:flex-row lg:items-end lg:justify-between">
            <h2 class="max-w-2xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">The next “berapa sebulan?” takes <span class="text-brand">3 seconds.</span></h2>
            <div class="flex w-full shrink-0 flex-col gap-3 whitespace-nowrap sm:w-auto sm:flex-row">
              <a [routerLink]="primaryCta().link" class="btn btn-primary btn-lg">{{ primaryCta().label }}<app-icon name="arrow-up-right" [size]="18" /></a>
              @if (!signedIn()) {
                <a routerLink="/login" class="btn btn-outline btn-lg">I have an account</a>
              }
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t border-border">
        <div class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span class="flex items-center gap-2">
            <span class="logo-chip flex size-6 items-center justify-center rounded-md"><app-icon name="car" [size]="16" /></span>
            Redline Car Quotation © {{ year }}
          </span>
          <span class="flex gap-4">
            @if (signedIn()) {
              <a routerLink="/calculator" class="transition-colors hover:text-foreground">Calculator</a>
            } @else {
              <a routerLink="/login" class="transition-colors hover:text-foreground">Log in</a>
              <a routerLink="/signup" class="transition-colors hover:text-foreground">Create account</a>
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
    :host ::selection { background: color-mix(in oklch, var(--primary) 45%, transparent); color: inherit; }

    /* One entrance for the hero, in order; everything else is simply there. */
    .enter { animation: landing-enter 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--d, 0ms); }
    @keyframes landing-enter { from { opacity: 0; transform: translateY(14px); filter: blur(4px); } }

    .stage { box-shadow: 0 40px 80px -40px rgb(0 0 0 / 0.55); }
    .old { background: color-mix(in oklch, var(--background), var(--card) 35%); }
    .scrawl { font-family: 'Caveat', cursive; font-size: 1.75rem; line-height: 1.35; font-weight: 500; }
    .scrawl s { opacity: 0.55; }
    .scrawl p { animation: landing-write 0.55s cubic-bezier(0.65, 0, 0.35, 1) backwards; animation-delay: calc(0.9s + var(--l) * 0.45s); }
    @keyframes landing-write { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    .dots { display: inline-block; animation: landing-dots 1.4s steps(4, end) infinite; overflow: hidden; vertical-align: bottom; width: 1.4ch; }
    @keyframes landing-dots { from { width: 0; } }

    .old-calc { width: 10.5rem; border-radius: 1.4rem; padding: 0.75rem; background: #0b0b0d; border: 1px solid color-mix(in oklch, var(--border), white 6%); }
    .old-calc-screen { height: 3rem; border-radius: 0.6rem; background: #1d2a21; color: #9bd3a9; font: 600 1.25rem/3rem ui-monospace, monospace; text-align: right; padding: 0 0.6rem; overflow: hidden; white-space: nowrap; }
    .caret { display: inline-block; width: 2px; height: 1.1rem; margin-left: 2px; vertical-align: -2px; background: currentColor; animation: landing-caret 1s steps(2) infinite; }
    @keyframes landing-caret { 50% { opacity: 0; } }
    .old-calc-keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; margin-top: 0.6rem; }
    .old-calc-keys span { height: 1.75rem; border-radius: 0.45rem; background: #222228; color: #8a8a93; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; }

    .seam:focus-visible { outline: none; }
    .seam:focus-visible .seam-knob { box-shadow: 0 0 0 4px color-mix(in oklch, var(--primary) 35%, transparent); }
    .seam-knob { box-shadow: 0 8px 22px -6px color-mix(in oklch, var(--primary) 70%, black); }
    .seam-knob.nudge { animation: landing-nudge 2.6s cubic-bezier(0.45, 0, 0.55, 1) 1.1s 2; }
    @keyframes landing-nudge { 0%, 100% { translate: 0 0; } 25% { translate: -8px 0; } 75% { translate: 8px 0; } }

    .answer { background: color-mix(in oklch, var(--primary) 9%, var(--card)); border: 1px solid color-mix(in oklch, var(--primary) 28%, transparent); }
    .poster-frame { box-shadow: 0 24px 50px -24px rgb(0 0 0 / 0.6); }

    .tilt { transform: rotate(-2deg); box-shadow: 0 40px 70px -30px rgb(0 0 0 / 0.6); }
    .phone { padding: 6px; border-radius: 1.75rem; background: #0b0b0d; border: 1px solid color-mix(in oklch, var(--border), white 8%); box-shadow: 0 30px 60px -20px rgb(0 0 0 / 0.55); }

    .comment { animation: landing-comment 9s ease-in-out infinite; animation-delay: calc(var(--n) * -3s); }
    @keyframes landing-comment {
      0% { opacity: 0; transform: translateY(14px); }
      12%, 70% { opacity: 1; transform: translateY(0); }
      90%, 100% { opacity: 0; transform: translateY(-10px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .enter, .seam-knob.nudge, .dots, .caret, .comment, .scrawl p { animation: none; }
    }
  `,
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  /** The real quote engine (the Calculator's), on the app's default prices and rate. */
  readonly q = new QuoteEngine();
  readonly years = [5, 7, 9];
  demoCars: Vehicle[] = DEMO_MODELS.map(([brand, model]) => VEHICLES.find((v) => v.brand === brand && v.model === model)).filter((v): v is Vehicle => !!v);

  stories = STORIES;
  values = VALUES;
  faqs = FAQS;
  brands = BRANDS;
  variantCount = VEHICLES.length;
  year = new Date().getFullYear();
  scrolled = signal(false);
  signedIn = inject(AuthService).isAuthenticated;
  primaryCta = computed(() => (this.signedIn() ? { link: '/calculator', label: 'Open the Calculator' } : { link: '/signup', label: 'Create your account' }));

  navLinks = [
    { id: 'posters', label: 'Posters' },
    { id: 'link', label: 'Quote link' },
    { id: 'budget', label: 'Budget' },
    { id: 'live', label: 'Live Mode' },
    { id: 'faq', label: 'FAQ' },
  ];
  livePoints = ['Every loan period and the full price breakdown', 'Bahasa Melayu or English on screen', 'Your phone number stays hidden unless you switch it on'];
  liveComments = ['berapa sebulan saga ni?', 'deposit 10k boleh?', 'ada rebate tak bulan ni?', 'kalau 7 tahun berapa?'];
  calcKeys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];

  // ---- the try-it calculator ----
  phoneSide = signal<'old' | 'new'>('new');
  carTitle = computed(() => `${this.q.selectedBrand()} ${modelVariantLabel(this.q.selectedModelName(), this.q.selectedVariant())}`);
  price = computed(() => `RM ${this.q.basePrice().toLocaleString('en-MY')}`);
  monthly = computed(() => formatRM2(this.q.selectedTenureMonthly()));
  allIn = computed(() => formatRM2(this.q.allInPrice()));
  deposit = computed(() => formatRM2(this.q.downpaymentCash()));
  loan = computed(() => formatRM2(this.q.loanAmount()));

  /** The same quote worked out by hand: the car's price, a slip on the deposit, and no answer. */
  scrawl = computed(() => {
    const price = this.q.basePrice();
    const dep = Math.round(price * 0.1);
    const depText = dep.toLocaleString('en-MY');
    const digits = depText.replace(/,/g, '');
    const swapped = digits.length > 3 ? digits.slice(0, 1) + digits[2] + digits[1] + digits.slice(3) : digits;
    const years = this.q.highlightedTenure() / 12;
    return {
      car: this.q.selectedModelName(),
      price: price.toLocaleString('en-MY'),
      dep: depText,
      wrong: Number(swapped).toLocaleString('en-MY'),
      loan: (price - dep).toLocaleString('en-MY'),
      rate: this.q.interestRate(),
      years,
      months: years * 12,
      typing: `${(price - dep).toLocaleString('en-MY').replace(/,/g, '')}×0.023`,
    };
  });

  isCar(v: Vehicle) {
    return this.q.selectedBrand() === v.brand && this.q.selectedModelName() === v.model;
  }

  pickCar(v: Vehicle) {
    this.q.selectedBrand.set(v.brand);
    this.q.selectedModelName.set(v.model);
    this.q.onVariantChange(v.variant);
  }

  logo(brand: string) {
    return brandLogo(brand);
  }

  // ---- the live poster ----
  @ViewChild('poster') posterRef?: ElementRef<HTMLCanvasElement>;
  private posterData = computed(() => quotePosterData(this.q, DEMO_ADVISOR, 'en'));
  private fontsReady = signal(false);
  private drawGeneration = 0;
  private drawTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const start = this.demoCars.find((v) => v.model === 'X50') ?? this.demoCars[0];
    if (start) this.pickCar(start);
    this.q.posterTenureYears.set([...this.years]);
    this.q.applyDownpaymentPreset({ percent: 10 });
    this.q.selectRepaymentTenure(9 * 12);

    loadScrawlFont();
    posterFontsReady().then(() => this.fontsReady.set(true));
    effect(() => {
      const data = this.posterData();
      if (!this.fontsReady()) return;
      if (this.drawTimer) clearTimeout(this.drawTimer);
      this.drawTimer = setTimeout(() => this.drawPoster(data), 90);
    });
  }

  ngAfterViewInit() {
    if (this.fontsReady()) this.drawPoster(this.posterData());
  }

  private async drawPoster(data: ReturnType<typeof quotePosterData>) {
    const canvas = this.posterRef?.nativeElement;
    if (!canvas) return;
    const generation = ++this.drawGeneration;
    // Drawn off-screen, then copied in whole, so the visible poster never flashes half-drawn.
    const off = document.createElement('canvas');
    await classicTemplate.render(off, data, 1, () => generation !== this.drawGeneration);
    if (generation !== this.drawGeneration) return;
    canvas.width = off.width;
    canvas.height = off.height;
    canvas.getContext('2d')?.drawImage(off, 0, 0);
  }

  ngOnDestroy() {
    if (this.drawTimer) clearTimeout(this.drawTimer);
  }

  // ---- the seam ----
  @ViewChild('stage') stageRef?: ElementRef<HTMLElement>;
  /** Where the seam sits (% of the stage): a little narrower on tablets, so the calculator has room. */
  split = signal(typeof window !== 'undefined' && window.innerWidth < 1280 ? 36 : 42);
  seamTouched = signal(false);
  private dragging = false;

  seamDown(e: PointerEvent) {
    this.dragging = true;
    this.seamTouched.set(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  seamMove(e: PointerEvent) {
    if (!this.dragging) return;
    const rect = this.stageRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    this.setSplit(((e.clientX - rect.left) / rect.width) * 100);
  }

  seamUp(e: PointerEvent) {
    this.dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  seamKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    this.seamTouched.set(true);
    this.setSplit(this.split() + (e.key === 'ArrowLeft' ? -4 : 4));
  }

  private setSplit(pct: number) {
    this.split.set(Math.round(Math.min(50, Math.max(30, pct))));
  }

  // ---- page ----
  onScroll() {
    this.scrolled.set(window.scrollY > 8);
  }

  scrollTo(id: string) {
    if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
