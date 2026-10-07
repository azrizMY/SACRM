import { AfterViewInit, Component, ElementRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NumberFieldComponent } from '../shared/number-field.component';
import { TranslatePipe, type Lang } from '../shared/i18n';
import { Router } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { SettingsService } from '../shared/settings.service';
import { ThemeService, type ThemeMode } from '../shared/theme.service';
import { DEFAULT_POSTER_ACCENT, POSTER_ACCENTS, type PosterAccentId } from '../shared/poster-theme';
import { POSTER_FRAMES, posterFrameThumbnail, type PosterFrameId } from '../shared/poster-frames';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { NCD_OPTIONS } from '../data/calculator-data';
import { type DashboardTarget, type SalesDefaults } from '../data/settings-data';

type NavItem = { id: string; label: string; icon: IconName };

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, NumberFieldComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-bold tracking-tight">{{ "Settings" | t }}</h2>
        <p class="text-pretty text-sm text-muted-foreground">{{ "Quote preferences, appearance, and account data." | t }}</p>
      </div>

      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <!-- Section nav -->
        <nav
          [attr.aria-label]="'Settings sections' | t"
          class="flex shrink-0 flex-row gap-1 overflow-x-auto pb-1 lg:sticky lg:top-0 lg:w-52 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          @for (item of navItems; track item.id) {
            <button
              type="button"
              (click)="scrollToSection(item.id)"
              class="relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              [ngClass]="activeSection() === item.id ? 'text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              <!-- Same straight red edge bar as the main sidebar -->
              @if (activeSection() === item.id) {
                <span class="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary"></span>
              }
              <app-icon [name]="item.icon" [size]="15" />
              {{ item.label | t }}
            </button>
          }
        </nav>

        <!-- Sections -->
        <div class="flex min-w-0 flex-1 flex-col gap-10">
          <!-- Quote Preferences -->
          <section id="defaults" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Quote Preferences" | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ "What every new quote starts with — change these any time." | t }}</p>
            </div>

            <!-- Starting values — one row per setting, matching the Notifications list below -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="wallet" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Starting Values" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Applied every time you open the Calculator for a new quote." | t }}</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Downpayment" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Starting percentage on a new quote." | t }}</span>
                  </div>
                  <app-number-field
                    class="w-24 shrink-0"
                    suffix="%"
                    ariaLabel="Default downpayment"
                    [decimals]="0"
                    [grouping]="false"
                    [value]="salesForm.downpaymentPct"
                    (valueChange)="salesForm.downpaymentPct = clampPct($event)"
                  />
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "NCD" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "No-claims discount applied by default. Rate and basic premium are set per car in Price Settings." | t }}</span>
                  </div>
                  <select
                    [(ngModel)]="salesForm.ncd"
                    class="h-9 shrink-0 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                  >
                    @for (opt of ncdOptions; track opt.value) { <option [ngValue]="opt.value">{{ opt.label | t }}</option> }
                  </select>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Additional Rebate" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Tick Additional Rebate by default on new quotes and offer sheets, for cars that have one. You can still untick it per quote." | t }}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    [attr.aria-label]="'Tick Additional Rebate by default' | t"
                    [attr.aria-checked]="salesForm.additionalRebateByDefault ?? true"
                    (click)="salesForm.additionalRebateByDefault = !(salesForm.additionalRebateByDefault ?? true)"
                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                    [ngClass]="(salesForm.additionalRebateByDefault ?? true) ? 'bg-primary' : 'bg-muted'"
                  >
                    <span
                      class="inline-block size-4 transform rounded-full bg-white shadow transition-transform"
                      [ngClass]="(salesForm.additionalRebateByDefault ?? true) ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Loan Rounding" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Loans are rounded to RM100. Round down adds the leftover to the downpayment; round up raises the loan and gives the excess back as cash back." | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'Loan Rounding' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    @for (opt of loanRoundingOptions; track opt.id) {
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="(salesForm.loanRounding ?? 'down') === opt.id"
                        (click)="salesForm.loanRounding = opt.id"
                        class="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        [ngClass]="(salesForm.loanRounding ?? 'down') === opt.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ opt.label | t }}
                      </button>
                    }
                  </div>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Allow cash back" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Show “Give rebate as cash back” in the Calculator. Turn on only if your dealer pays rebates out as cash." | t }}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    [attr.aria-label]="'Allow cash back' | t"
                    [attr.aria-checked]="salesForm.allowCashback ?? false"
                    (click)="salesForm.allowCashback = !(salesForm.allowCashback ?? false)"
                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                    [ngClass]="(salesForm.allowCashback ?? false) ? 'bg-primary' : 'bg-muted'"
                  >
                    <span
                      class="inline-block size-4 transform rounded-full bg-white shadow transition-transform"
                      [ngClass]="(salesForm.allowCashback ?? false) ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Rate Type" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Flat or EIR — which one a new quote opens on." | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'Rate Type' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="salesForm.defaultRateType === 'flat'"
                      (click)="salesForm.defaultRateType = 'flat'"
                      class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                      [ngClass]="salesForm.defaultRateType === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ "Flat" | t }}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="salesForm.defaultRateType === 'effective'"
                      (click)="salesForm.defaultRateType = 'effective'"
                      class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                      [ngClass]="salesForm.defaultRateType === 'effective' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      {{ "EIR" | t }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Default Rates" | t }}</span>
                    <span class="max-w-md text-xs text-muted-foreground">{{ "Used by every car without its own rate — a car's own rate is set in" | t }} <a routerLink="/price-settings" class="font-medium text-primary hover:underline">{{ "Price Settings" | t }}</a>{{ ". Leave EIR empty to be asked for the bank's rate." | t }}</span>
                  </div>
                  <div class="flex shrink-0 items-end gap-2">
                    <label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                      {{ "Flat" | t }}
                      <app-number-field class="w-24" suffix="%" ariaLabel="Default flat rate" [decimals]="2" [value]="salesForm.interestRate" (valueChange)="salesForm.interestRate = clampRate($event) ?? salesForm.interestRate" />
                    </label>
                    <label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                      {{ "EIR" | t }}
                      <app-number-field class="w-24" suffix="%" ariaLabel="Default EIR" [placeholder]="'Not set' | t" [decimals]="2" [value]="salesForm.effectiveRate ?? null" (valueChange)="salesForm.effectiveRate = clampRate($event) ?? undefined" />
                    </label>
                  </div>
                </div>

                <div class="flex flex-col gap-3 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Repayment Table Years" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Pick 3 tenures — which years the Calculator's repayment table opens on." | t }}</span>
                  </div>
                  <div role="group" [attr.aria-label]="'Repayment table tenures (years)' | t" class="flex flex-wrap gap-1.5">
                    @for (y of posterYearOptions; track y) {
                      <button
                        type="button"
                        [attr.aria-pressed]="salesForm.defaultTenureYears.includes(y)"
                        (click)="toggleDefaultTenureYear(y)"
                        class="flex size-10 items-center justify-center rounded-full text-xs font-semibold transition-colors"
                        [ngClass]="salesForm.defaultTenureYears.includes(y) ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ y }}
                      </button>
                    }
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  (click)="saveQuoteDefaults()"
                  class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {{ "Save Changes" | t }}
                </button>
                @if (savedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    {{ "Saved" | t }}
                  </span>
                }
              </div>
            </div>

            <!-- Primary Brand — the Calculator's starting car and the Catalog's brand filter -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="star" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Primary Brand" | t }}</span>
                  <span class="text-xs text-muted-foreground">
                    {{ "The Calculator's starting car and the brand filter on Brochures." | t }}
                  </span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Brand" | t }}</span>
                  </div>
                  <select
                    [(ngModel)]="dashboardForm.brand"
                    class="h-9 shrink-0 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                  >
                    @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </div>

              </div>

              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  (click)="saveDefaultBrand()"
                  class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {{ "Save Changes" | t }}
                </button>
                @if (brandSavedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    {{ "Saved" | t }}
                  </span>
                }
              </div>
            </div>
          </section>

          <!-- Appearance — saved on this device, applied before the app even loads -->
          <section id="appearance" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Appearance' | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ 'Light or dark screens. System follows your phone or computer. Posters and the Live Screen look the same either way.' | t }}</p>
            </div>
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div role="radiogroup" [attr.aria-label]="'Theme' | t" class="grid grid-cols-3 gap-2 p-4">
                @for (opt of themeOptions; track opt.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="theme.mode() === opt.id"
                    (click)="theme.setMode(opt.id)"
                    class="flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors"
                    [ngClass]="theme.mode() === opt.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    <app-icon [name]="opt.icon" [size]="18" />
                    {{ opt.label | t }}
                  </button>
                }
              </div>
            </div>
          </section>

          <!-- Language — the app's screens and what customers see are chosen separately -->
          <section id="language" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Language' | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ 'Choose the language for the app and, separately, for what your customers see.' | t }}</p>
            </div>
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex flex-col divide-y divide-border px-5">
                <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div class="flex min-w-0 flex-col">
                    <span class="text-sm font-medium">{{ 'App language' | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ 'Menus, buttons and screens you see in the app.' | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'App language' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="uiLanguage() === 'en'"
                        (click)="setLanguage('uiLanguage', 'en')"
                        class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        [ngClass]="uiLanguage() === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "English" | t }}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="uiLanguage() === 'ms'"
                        (click)="setLanguage('uiLanguage', 'ms')"
                        class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        [ngClass]="uiLanguage() === 'ms' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "Bahasa Melayu" | t }}
                      </button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div class="flex min-w-0 flex-col">
                    <span class="text-sm font-medium">{{ 'Poster language' | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ 'Quote posters, offer sheets and the customer link your customers see.' | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'Poster language' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="posterLanguage() === 'en'"
                        (click)="setLanguage('posterLanguage', 'en')"
                        class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        [ngClass]="posterLanguage() === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "English" | t }}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="posterLanguage() === 'ms'"
                        (click)="setLanguage('posterLanguage', 'ms')"
                        class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        [ngClass]="posterLanguage() === 'ms' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "Bahasa Melayu" | t }}
                      </button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div class="flex min-w-0 flex-col">
                    <span class="text-sm font-medium">{{ 'WhatsApp messages' | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ 'The ready-written messages you share with customers, and the ones customers send you from your quote link.' | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'WhatsApp messages' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    @for (l of languageOptions; track l.id) {
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="whatsappLanguage() === l.id"
                        (click)="setLanguage('whatsappLanguage', l.id)"
                        class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                        [ngClass]="whatsappLanguage() === l.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ l.label | t }}
                      </button>
                    }
                  </div>
                </div>
              </div>
              @if (uiLanguage() === 'ms') {
                <p class="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">{{ 'Some pages are still being translated and will show in English for now.' | t }}</p>
              }
            </div>
          </section>

          <!-- Poster colour — one choice for every poster, offer sheet, the customer link and Live Mode -->
          <section id="poster-colour" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Poster colour' | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ 'Used on every poster and offer sheet, your customer link and the Live Screen.' | t }}</p>
            </div>
            <div class="flex flex-col gap-5 overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm md:flex-row md:items-center">
              <div role="radiogroup" [attr.aria-label]="'Poster colour' | t" class="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                @for (opt of posterAccents; track opt.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="posterAccentId() === opt.id"
                    (click)="setPosterAccent(opt.id)"
                    class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors"
                    [ngClass]="posterAccentId() === opt.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    <span class="flex size-6 shrink-0 items-center justify-center rounded-full" [style.background-color]="opt.acc">
                      @if (posterAccentId() === opt.id) {
                        <app-icon name="check" [size]="13" class="text-white" />
                      }
                    </span>
                    {{ opt.label | t }}
                  </button>
                }
              </div>

              <!-- A slice of a poster in the chosen colour: the white header, the dark price panel, the lowest-tenure row -->
              <div class="w-full shrink-0 overflow-hidden rounded-lg border border-border md:w-60" aria-hidden="true">
                <div class="bg-white px-4 pb-3 pt-3.5">
                  <div class="flex items-center gap-1.5">
                    <span class="h-3 w-[3px] -skew-x-12" [style.background-color]="accentPreview().acc"></span>
                    <span class="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-500">{{ 'Vehicle loan estimate' | t }}</span>
                  </div>
                  <div class="mt-1 text-lg font-bold leading-tight text-neutral-900">Chery O5</div>
                  <span class="mt-1 inline-block -skew-x-12 px-2 text-[9px] font-bold text-white" [style.background-color]="accentPreview().acc">2026</span>
                </div>
                <div class="h-[3px]" [style.background-color]="accentPreview().acc"></div>
                <div class="flex flex-col gap-2 bg-[#121214] px-4 py-3">
                  <div class="flex items-baseline gap-1">
                    <span class="text-xs font-bold" [style.color]="accentPreview().accBright">RM</span>
                    <span class="text-2xl font-bold text-white">1,232</span>
                    <span class="text-[10px] text-white/60">/{{ 'month' | t }}</span>
                  </div>
                  <div class="flex items-center justify-between rounded px-2.5 py-1.5 text-[10px] font-bold text-white" [style.background-color]="accentPreview().acc">
                    <span>9 {{ 'Yrs' | t }}</span>
                    <span>RM 1,232</span>
                  </div>
                  <div class="flex items-center justify-between rounded bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold text-white/80">
                    <span>7 {{ 'Yrs' | t }}</span>
                    <span [style.color]="accentPreview().accBright">RM 1,519</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Festive frame — drawn around every poster, offer sheet and the customer link's poster -->
          <section id="festive-frame" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ 'Festive frame' | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ 'A border and greeting around your posters for the season. It never covers prices — remember to switch it off after the festival.' | t }}</p>
            </div>
            <div class="overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div role="radiogroup" [attr.aria-label]="'Festive frame' | t" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                @for (opt of frameOptions(); track opt.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="posterFrameId() === opt.id"
                    (click)="setPosterFrame(opt.id)"
                    class="flex flex-col items-center gap-2 rounded-lg border p-2 text-center text-xs font-medium transition-colors"
                    [ngClass]="posterFrameId() === opt.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    @if (opt.thumb) {
                      <img [src]="opt.thumb" alt="" class="aspect-[5/6] w-full rounded object-cover" />
                    } @else {
                      <span class="flex aspect-[5/6] w-full items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                        <app-icon name="x" [size]="18" />
                      </span>
                    }
                    {{ opt.label | t }}
                  </button>
                }
              </div>
            </div>
          </section>

          <!-- Data & privacy -->
          <section id="data" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Data & Privacy" | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ "Your data is saved to your account — export a copy any time." | t }}</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="file-text" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Data Management" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Back up or reset your settings." | t }}</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Export all data" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Download your profile and settings as a JSON file." | t }}</span>
                  </div>
                  <button
                    type="button"
                    (click)="requestExport()"
                    class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="download" [size]="13" />
                    {{ "Export" | t }}
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Reset preferences" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Puts Quote Preferences back to their factory settings." | t }}</span>
                  </div>
                  <button
                    type="button"
                    (click)="resetPreferences()"
                    class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="refresh-cw" [size]="13" />
                    {{ "Reset" | t }}
                  </button>
                </div>

              </div>
            </div>

          </section>

          <!-- Account & Security -->
          <section id="security" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Account & Security" | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ "Your password and account." | t }}</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="lock" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Change Password" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Needs your current password." | t }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-border px-5 py-5">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  {{ "Current Password" | t }}
                  <input
                    type="password"
                    autocomplete="current-password"
                    [(ngModel)]="passwordForm.current"
                    class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                  />
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {{ "New Password" | t }}
                    <input
                      type="password"
                      autocomplete="new-password"
                      [(ngModel)]="passwordForm.next"
                      [placeholder]="'At least 8 characters' | t"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    {{ "Confirm New Password" | t }}
                    <input
                      type="password"
                      autocomplete="new-password"
                      [(ngModel)]="passwordForm.confirm"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </label>
                </div>
                @if (passwordError()) {
                  <p class="text-[11px] font-medium text-destructive">{{ passwordError() }}</p>
                }
              </div>

              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  [disabled]="changingPassword()"
                  (click)="changePassword()"
                  class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {{ changingPassword() ? ('Saving…' | t) : ('Change Password' | t) }}
                </button>
                @if (passwordSavedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    {{ "Password changed" | t }}
                  </span>
                }
              </div>
            </div>

            <!-- Delete account -->
            <div class="overflow-hidden rounded-xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/5 text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
                  <app-icon name="alert-triangle" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none text-[var(--destructive)]">{{ "Delete Account" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Permanently removes your account and all of its data. This can't be undone." | t }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-3 border-t border-[var(--destructive)]/30 px-5 py-4">
                <p class="text-xs text-muted-foreground">
                  {{ "Deletes your profile, settings, customers, bankers, and pricing changes. You'll be signed out straight away. Export your data first (Data & Privacy above) if you want to keep a copy." | t }}
                </p>
                <button
                  type="button"
                  (click)="openDeleteAccount()"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
                >
                  <app-icon name="trash" [size]="13" />
                  {{ "Delete my account" | t }}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Delete account confirmation -->
    @if (confirmingDelete()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingDelete.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-3 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              {{ "Delete your account?" | t }}
            </span>
            <p class="text-sm text-muted-foreground">
              {{ 'Everything tied to {email} is erased permanently, including all {n} customer records. This can\'t be undone.' | t: { email: auth.currentUser()?.email ?? '', n: customers.records().length } }}
            </p>
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <span class="text-xs text-muted-foreground">
                <span class="font-medium text-foreground">{{ "Recommended:" | t }}</span> {{ "download a copy of your data first — it can't be recovered afterwards." | t }}
              </span>
              <button
                type="button"
                (click)="requestExport()"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <app-icon name="download" [size]="13" />
                {{ "Export" | t }}
              </button>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ "Your password" | t }}
              <input
                type="password"
                autocomplete="current-password"
                [(ngModel)]="deletePassword"
                class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {{ "Type DELETE to confirm" | t }}
              <input
                type="text"
                autocomplete="off"
                [(ngModel)]="deleteConfirmText"
                class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            @if (deleteError()) {
              <p class="text-[11px] font-medium text-destructive">{{ deleteError() }}</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingDelete.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              [disabled]="deleteConfirmText !== 'DELETE' || deletingAccount()"
              (click)="deleteAccount()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {{ deletingAccount() ? ('Deleting…' | t) : ('Delete account' | t) }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Export password confirmation -->
    @if (confirmingExport()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingExport.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-3 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold">
              <app-icon name="lock" [size]="15" />
              {{ "Confirm your password" | t }}
            </span>
            <p class="text-sm text-muted-foreground">{{ "Your export includes your profile and settings, so we need your password first." | t }}</p>
            <input
              type="password"
              autocomplete="current-password"
              [placeholder]="'Password' | t"
              [(ngModel)]="exportPassword"
              (keydown.enter)="confirmExport()"
              class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
            />
            @if (exportError()) {
              <p class="text-[11px] font-medium text-destructive">{{ exportError() }}</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingExport.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              [disabled]="verifyingExport()"
              (click)="confirmExport()"
              class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {{ verifyingExport() ? ('Checking…' | t) : ('Export data' | t) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AccountSettingsComponent implements AfterViewInit, OnDestroy {
  readonly loanRoundingOptions: { id: 'down' | 'up'; label: string }[] = [
    { id: 'down', label: 'Round down' },
    { id: 'up', label: 'Round up' },
  ];

  ncdOptions = NCD_OPTIONS;
  Math = Math;

  /** Keeps a typed percentage within 0–100. */
  clampPct(v: number | null): number {
    return Math.min(100, Math.max(0, Math.round(v ?? 0)));
  }

  uiLanguage = computed<Lang>(() => this.settingsService.settings().salesDefaults.uiLanguage ?? 'en');
  posterLanguage = computed<Lang>(() => this.settingsService.settings().salesDefaults.posterLanguage ?? 'en');
  whatsappLanguage = computed<Lang>(() => this.settingsService.whatsappLang());
  readonly languageOptions: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ms', label: 'Bahasa Melayu' },
  ];

  posterAccents = (Object.keys(POSTER_ACCENTS) as PosterAccentId[]).map((id) => ({ id, ...POSTER_ACCENTS[id] }));
  posterAccentId = computed<PosterAccentId>(() => {
    const id = this.settingsService.settings().salesDefaults.posterAccent;
    return id && id in POSTER_ACCENTS ? (id as PosterAccentId) : DEFAULT_POSTER_ACCENT;
  });
  accentPreview = computed(() => POSTER_ACCENTS[this.posterAccentId()]);

  /** Saves straight away, like the language switches. */
  setPosterAccent(id: PosterAccentId) {
    this.settingsService.updateSalesDefaults({ posterAccent: id });
    this.salesForm.posterAccent = id;
  }

  /** None plus every festive frame, each with a small preview drawn in the poster language. */
  frameOptions = computed(() => {
    const lang = this.settingsService.settings().salesDefaults.posterLanguage ?? 'en';
    return [
      { id: '', label: 'None', thumb: '' },
      ...(Object.keys(POSTER_FRAMES) as PosterFrameId[]).map((id) => ({ id, label: POSTER_FRAMES[id].label, thumb: posterFrameThumbnail(id, lang) })),
    ];
  });
  posterFrameId = computed(() => {
    const id = this.settingsService.settings().salesDefaults.posterFrame ?? '';
    return id in POSTER_FRAMES ? id : '';
  });

  /** Saves straight away, like Poster colour. '' = no frame. */
  setPosterFrame(id: string) {
    const posterFrame = id || undefined;
    this.settingsService.updateSalesDefaults({ posterFrame });
    this.salesForm.posterFrame = posterFrame;
  }

  /** Saves straight away — a language switch should take effect the moment it's tapped. */
  setLanguage(field: 'uiLanguage' | 'posterLanguage' | 'whatsappLanguage', lang: Lang) {
    this.settingsService.updateSalesDefaults({ [field]: lang });
    this.salesForm[field] = lang;
  }

  navItems: NavItem[] = [
    { id: 'defaults', label: 'Quote Preferences', icon: 'wallet' },
    { id: 'appearance', label: 'Appearance', icon: 'sun' },
    { id: 'language', label: 'Language', icon: 'languages' },
    { id: 'poster-colour', label: 'Poster colour', icon: 'file-text' },
    { id: 'festive-frame', label: 'Festive frame', icon: 'sparkles' },
    { id: 'data', label: 'Data & Privacy', icon: 'file-text' },
    { id: 'security', label: 'Account & Security', icon: 'lock' },
  ];
  activeSection = signal(this.navItems[0].id);
  private sectionObserver?: IntersectionObserver;
  private scrollContainer: HTMLElement | null = null;
  /** While a nav click's smooth-scroll animation is still running, auto-detection backs off so it
   *  can't fight the click — otherwise a short trailing section can never win on its own (see
   *  onScroll below), making the click briefly look like it did nothing or highlighted the wrong item. */
  private suppressAutoActiveUntil = 0;

  private onScroll = () => {
    if (Date.now() < this.suppressAutoActiveUntil) return;
    const el = this.scrollContainer;
    if (!el) return;
    // The last section(s) rarely have enough page height below them to scroll fully into the
    // IntersectionObserver's "active" band, so they can never win on intersection ratio alone —
    // once scrolled to the bottom, walk backwards to the last section that's actually been
    // scrolled past its own activation line and treat that as current.
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    if (!atBottom) return;
    const sections = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-section]');
    for (let i = sections.length - 1; i >= 0; i--) {
      if (sections[i].getBoundingClientRect().top <= 120) {
        this.activeSection.set(sections[i].id);
        return;
      }
    }
  };

  /** Getter, not a field — re-reads the catalog on every check so it stays current while Price
   *  Settings (a separate page reading the same VehicleCatalogService) adds/removes brands. */
  get brands(): string[] {
    return this.catalog.brands();
  }

  salesForm: SalesDefaults;
  dashboardForm: DashboardTarget;
  posterYearOptions = Array.from({ length: 9 }, (_, i) => i + 1);
  savedFlash = signal(false);
  brandSavedFlash = signal(false);

  passwordForm = { current: '', next: '', confirm: '' };
  passwordError = signal<string | null>(null);
  changingPassword = signal(false);
  passwordSavedFlash = signal(false);

  confirmingExport = signal(false);
  exportPassword = '';
  exportError = signal<string | null>(null);
  verifyingExport = signal(false);

  confirmingDelete = signal(false);
  deletePassword = '';
  deleteConfirmText = '';
  deleteError = signal<string | null>(null);
  deletingAccount = signal(false);

  themeOptions: { id: ThemeMode; label: string; icon: IconName }[] = [
    { id: 'system', label: 'System', icon: 'monitor' },
    { id: 'light', label: 'Light', icon: 'sun' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
  ];
  theme = inject(ThemeService);

  constructor(
    public settingsService: SettingsService,
    public catalog: VehicleCatalogService,
    public auth: AuthService,
    private advisor: AdvisorService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
  ) {
    this.salesForm = { ...this.settingsService.settings().salesDefaults };
    this.dashboardForm = { ...this.settingsService.settings().dashboardTarget };
  }

  ngAfterViewInit() {
    const sections = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-section]');
    // Treats a section as "active" once it's scrolled into the upper half of the viewport —
    // the standard scrollspy trick for highlighting the nav item that matches what's on screen.
    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        if (Date.now() < this.suppressAutoActiveUntil) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) this.activeSection.set(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((el) => this.sectionObserver!.observe(el));

    // The page's actual scroll container is the app shell's <main>, not window.
    this.scrollContainer = this.host.nativeElement.closest('main');
    this.scrollContainer?.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy() {
    this.sectionObserver?.disconnect();
    this.scrollContainer?.removeEventListener('scroll', this.onScroll);
  }

  scrollToSection(id: string) {
    this.activeSection.set(id);
    this.suppressAutoActiveUntil = Date.now() + 700;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  /** Every Quote Preferences card saves the same defaults object; `card` just picks which
   *  card shows the "Saved" tick. */
  saveQuoteDefaults(card: 'starting' | 'leads' = 'starting') {
    this.settingsService.updateSalesDefaults(this.salesForm);
    if (card === 'starting') {
      this.savedFlash.set(true);
      setTimeout(() => this.savedFlash.set(false), 2000);
    }
    this.flash(card);
  }

  savedFlashFor = signal<string | null>(null);
  private flash(card: string) {
    this.savedFlashFor.set(card);
    setTimeout(() => this.savedFlashFor() === card && this.savedFlashFor.set(null), 2000);
  }

  /** Working copies of the account's dropdown lists — saved only on each card's Save Changes. */
  /** A typed rate within 0–30%, or null when cleared. */
  clampRate(v: number | null): number | null {
    return v == null ? null : Math.min(30, Math.max(0, v));
  }

  saveDefaultBrand() {
    this.settingsService.updateDashboardTarget(this.dashboardForm);
    this.brandSavedFlash.set(true);
    setTimeout(() => this.brandSavedFlash.set(false), 2000);
  }

  /** Keeps the default tenure selection at exactly 3 years: toggles off if already picked (min 1
   *  stays selected), otherwise adds, replacing the oldest pick once 3 are already chosen —
   *  mirrors the Calculator's own poster-tenure picker. */
  toggleDefaultTenureYear(year: number) {
    const current = this.salesForm.defaultTenureYears;
    if (current.includes(year)) {
      if (current.length > 1) this.salesForm.defaultTenureYears = current.filter((y) => y !== year);
    } else if (current.length < 3) {
      this.salesForm.defaultTenureYears = [...current, year];
    } else {
      this.salesForm.defaultTenureYears = [...current.slice(1), year];
    }
  }

  resetPreferences() {
    this.settingsService.resetToDefaults();
    this.salesForm = { ...this.settingsService.settings().salesDefaults };
    this.dashboardForm = { ...this.settingsService.settings().dashboardTarget };
  }

  /** Export is gated behind the account password. */
  requestExport() {
    this.exportPassword = '';
    this.exportError.set(null);
    this.confirmingExport.set(true);
  }

  async confirmExport() {
    if (!this.exportPassword) {
      this.exportError.set('Enter your password.');
      return;
    }
    this.exportError.set(null);
    this.verifyingExport.set(true);
    const result = await this.auth.verifyPassword(this.exportPassword);
    this.verifyingExport.set(false);
    if (!result.ok) {
      this.exportError.set(result.error);
      return;
    }
    this.confirmingExport.set(false);
    this.exportPassword = '';
    this.exportData();
  }

  private exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: this.advisor.profile(),
      settings: this.settingsService.settings(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redline-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  openDeleteAccount() {
    this.deletePassword = '';
    this.deleteConfirmText = '';
    this.deleteError.set(null);
    this.confirmingDelete.set(true);
  }

  async deleteAccount() {
    this.deleteError.set(null);
    if (!this.deletePassword) {
      this.deleteError.set('Enter your password.');
      return;
    }
    this.deletingAccount.set(true);
    const result = await this.auth.deleteAccount(this.deletePassword);
    this.deletingAccount.set(false);
    if (!result.ok) {
      this.deleteError.set(result.error);
      return;
    }
    this.confirmingDelete.set(false);
    this.router.navigateByUrl('/welcome');
  }

  async changePassword() {
    this.passwordError.set(null);
    const { current, next, confirm } = this.passwordForm;
    if (!current || !next) {
      this.passwordError.set('Enter your current and new password.');
      return;
    }
    if (next.length < 8) {
      this.passwordError.set('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      this.passwordError.set('New passwords do not match.');
      return;
    }

    this.changingPassword.set(true);
    const result = await this.auth.changePassword(current, next);
    this.changingPassword.set(false);
    if (!result.ok) {
      this.passwordError.set(result.error);
      return;
    }
    this.passwordForm = { current: '', next: '', confirm: '' };
    this.passwordSavedFlash.set(true);
    setTimeout(() => this.passwordSavedFlash.set(false), 2500);
  }
}
