import { AfterViewInit, Component, ElementRef, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, type Lang } from '../shared/i18n';
import { Router } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { SettingsService } from '../shared/settings.service';
import { ThemeService, type ThemeMode } from '../shared/theme.service';
import { MENU_PAGES, PAGES, UiPrefsService, type Density } from '../shared/ui-prefs.service';
import { DEFAULT_POSTER_ACCENT, POSTER_ACCENTS, type PosterAccentId } from '../shared/poster-theme';
import { type SalesDefaults } from '../data/settings-data';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { quoteForComparison } from '../data/compare-data';
import { basicPremiumDefault, modelVariantLabel, type Vehicle } from '../data/calculator-data';

type NavItem = { id: string; label: string; icon: IconName };

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <p class="text-pretty text-sm text-muted-foreground">{{ "How the app and your posters look, your languages, and your account. Quote defaults are in Price Settings; your brands are in My Profile." | t }}</p>
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
              class="relative flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-sm transition-colors"
              [ngClass]="activeSection() === item.id ? 'bg-accent font-semibold text-foreground' : 'font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              <!-- Same "you are here" mark as the main menu: a grey row with a red bar -->
              @if (activeSection() === item.id) {
                <span class="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary lg:inset-x-auto lg:inset-y-2 lg:left-0 lg:h-auto lg:w-[3px] lg:rounded-r-full lg:rounded-t-none" aria-hidden="true"></span>
              }
              <app-icon [name]="item.icon" [size]="18" [class]="activeSection() === item.id ? 'text-[var(--shell-accent)]' : ''" />
              {{ item.label | t }}
            </button>
          }
        </nav>

        <!-- Sections -->
        <div class="flex min-w-0 flex-1 flex-col gap-10">
          <!-- Appearance — saved on this device, applied before the app even loads -->
          <section id="appearance" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-base font-semibold text-foreground">{{ 'Appearance' | t }}</h3>
              <p class="hint">{{ 'Light or dark screens, and one colour for the app and your posters.' | t }}</p>
            </div>
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div role="radiogroup" [attr.aria-label]="'Theme' | t" class="grid grid-cols-3 gap-2 p-4">
                @for (opt of themeOptions; track opt.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="theme.mode() === opt.id"
                    (click)="theme.setMode(opt.id)"
                    class="flex min-h-12 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors"
                    [ngClass]="theme.mode() === opt.id ? 'border-brand bg-brand-soft text-foreground' : 'border-control text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                  >
                    <app-icon [name]="opt.icon" [size]="20" />
                    {{ opt.label | t }}
                  </button>
                }
              </div>
            </div>

            <!-- Colour — one choice for the app, every poster, the customer link and Live Mode -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <app-icon name="palette" [size]="20" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ 'Colour' | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ 'One colour for the app, every poster, your customer link and the Live Screen.' | t }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-5 border-t border-border p-5 md:flex-row md:items-center">
                <div role="radiogroup" [attr.aria-label]="'Colour' | t" class="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  @for (opt of posterAccents; track opt.id) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="posterAccentId() === opt.id"
                      (click)="setPosterAccent(opt.id)"
                      class="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors"
                      [ngClass]="posterAccentId() === opt.id ? 'border-brand bg-brand-soft text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      <span class="flex size-6 shrink-0 items-center justify-center rounded-full" [style.background-color]="opt.acc">
                        @if (posterAccentId() === opt.id) {
                          <app-icon name="check" [size]="16" class="text-white" />
                        }
                      </span>
                      {{ opt.label | t }}
                    </button>
                  }
                </div>

                <!-- A slice of a poster in the chosen colour: the white header, the dark price panel, the lowest-tenure row -->
                @if (posterPreview(); as pp) {
                <div class="w-full shrink-0 overflow-hidden rounded-lg border border-border md:w-60" aria-hidden="true">
                  <div class="bg-white px-4 pb-3 pt-3.5">
                    <div class="flex items-center gap-1.5">
                      <span class="h-3 w-[3px] -skew-x-12" [style.background-color]="accentPreview().acc"></span>
                      <span class="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-500">{{ 'Vehicle loan estimate' | t }}</span>
                    </div>
                    <div class="mt-1 truncate text-base font-semibold leading-tight text-neutral-900">{{ pp.title }}</div>
                    <span class="mt-1 inline-block -skew-x-12 px-2 text-xs font-bold text-white" [style.background-color]="accentPreview().acc">{{ pp.year }}</span>
                  </div>
                  <div class="h-[3px]" [style.background-color]="accentPreview().acc"></div>
                  <div class="flex flex-col gap-2 bg-[#121214] px-4 py-3">
                    <div class="flex items-baseline gap-1">
                      <span class="text-xs font-bold" [style.color]="accentPreview().accBright">RM</span>
                      <span class="text-2xl font-bold text-white">{{ pp.rows[0].amount }}</span>
                      <span class="text-xs text-white/60">/{{ 'month' | t }}</span>
                    </div>
                    @for (r of pp.rows; track r.years; let first = $first) {
                      <div class="flex items-center justify-between rounded px-2.5 py-1.5 text-xs font-bold" [ngClass]="first ? 'text-white' : 'bg-white/[0.06] text-white/80'" [style.background-color]="first ? accentPreview().acc : null">
                        <span>{{ r.years }} {{ 'Yrs' | t }}</span>
                        <span [style.color]="first ? null : accentPreview().accBright">RM {{ r.amount }}</span>
                      </div>
                    }
                  </div>
                </div>
                }
              </div>
            </div>

          </section>


          <!-- Make it yours — optional extras for people who like to set things up their way. All of
               it is saved on this device (like light/dark) and applies straight away. -->
          <section id="customise" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-1">
              <h3 class="text-base font-semibold text-foreground">{{ 'Make it yours' | t }}</h3>
              <p class="hint">{{ 'Optional. How roomy the app is, motion, and which page opens first. Saved on this phone or computer.' | t }}</p>
            </div>

            <!-- Layout and motion -->
            <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div class="flex flex-col gap-0.5">
                <h4 class="text-base font-semibold">{{ 'Layout' | t }}</h4>
                <p class="hint">{{ 'Comfortable has bigger text and buttons. Compact fits more on the screen.' | t }}</p>
              </div>
              <div role="radiogroup" [attr.aria-label]="'Layout' | t" class="grid grid-cols-2 gap-2">
                @for (d of densities; track d.id) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="prefs.density() === d.id"
                    (click)="prefs.setDensity(d.id)"
                    class="flex min-h-12 flex-col items-start justify-center gap-0.5 rounded-lg border-2 px-4 py-2 text-left transition-colors"
                    [ngClass]="prefs.density() === d.id ? 'border-foreground bg-brand-soft' : 'border-border hover:bg-accent'"
                  >
                    <span class="text-base font-bold">{{ d.label | t }}</span>
                    <span class="text-sm text-muted-foreground">{{ d.hint | t }}</span>
                  </button>
                }
              </div>
              <label class="flex min-h-12 cursor-pointer items-center justify-between gap-4 border-t border-border pt-4">
                <span class="flex flex-col gap-0.5">
                  <span class="text-base font-bold">{{ 'Reduce motion' | t }}</span>
                  <span class="hint">{{ 'Turn off sliding and fading on screen.' | t }}</span>
                </span>
                <input type="checkbox" class="size-6 shrink-0 accent-[var(--brand-ink)]" [checked]="prefs.reduceMotion()" (change)="prefs.setReduceMotion($any($event.target).checked)" />
              </label>
            </div>

            <!-- Start page -->
            <div class="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div class="flex flex-col gap-0.5">
                <label for="startPage" class="text-base font-semibold">{{ 'Open the app on' | t }}</label>
                <p class="hint">{{ 'The page you see first when you open Redline.' | t }}</p>
              </div>
              <select
                id="startPage"
                [value]="prefs.startPage()"
                (change)="prefs.setStartPage($any($event.target).value)"
                class="h-10 w-full rounded-lg border border-input bg-input px-3 text-sm text-foreground sm:max-w-sm"
              >
                @for (p of menuPages; track p.id) {
                  <option [value]="p.id" [selected]="prefs.startPage() === p.id">{{ p.label | t }}</option>
                }
              </select>
            </div>

            <button type="button" (click)="prefs.reset()" class="btn btn-outline self-start">
              <app-icon name="rotate-ccw" [size]="20" />
              {{ 'Put these back to how they started' | t }}
            </button>
          </section>

          <!-- Language — the app's screens and what customers see are chosen separately -->
          <section id="language" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-base font-semibold text-foreground">{{ 'Language' | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ 'Choose the language for the app and, separately, for what your customers see.' | t }}</p>
            </div>
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex flex-col divide-y divide-border px-5">
                <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div class="flex min-w-0 flex-1 basis-56 flex-col">
                    <span class="text-sm font-medium">{{ 'App language' | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ 'Menus, buttons and screens you see in the app.' | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'App language' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="uiLanguage() === 'en'"
                        (click)="setLanguage('uiLanguage', 'en')"
                        class="rounded-md px-3 py-2 text-sm font-semibold transition-colors"
                        [ngClass]="uiLanguage() === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "English" | t }}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="uiLanguage() === 'ms'"
                        (click)="setLanguage('uiLanguage', 'ms')"
                        class="rounded-md px-3 py-2 text-sm font-semibold transition-colors"
                        [ngClass]="uiLanguage() === 'ms' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "Bahasa Melayu" | t }}
                      </button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div class="flex min-w-0 flex-1 basis-56 flex-col">
                    <span class="text-sm font-medium">{{ 'Poster language' | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ 'Quote posters and the customer link your customers see.' | t }}</span>
                  </div>
                  <div role="radiogroup" [attr.aria-label]="'Poster language' | t" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="posterLanguage() === 'en'"
                        (click)="setLanguage('posterLanguage', 'en')"
                        class="rounded-md px-3 py-2 text-sm font-semibold transition-colors"
                        [ngClass]="posterLanguage() === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "English" | t }}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="posterLanguage() === 'ms'"
                        (click)="setLanguage('posterLanguage', 'ms')"
                        class="rounded-md px-3 py-2 text-sm font-semibold transition-colors"
                        [ngClass]="posterLanguage() === 'ms' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ "Bahasa Melayu" | t }}
                      </button>
                  </div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div class="flex min-w-0 flex-1 basis-56 flex-col">
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
                        class="rounded-md px-3 py-2 text-sm font-semibold transition-colors"
                        [ngClass]="whatsappLanguage() === l.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                      >
                        {{ l.label | t }}
                      </button>
                    }
                  </div>
                </div>
              </div>
              @if (uiLanguage() === 'ms') {
                <p class="border-t border-border px-5 py-3 text-xs text-muted-foreground">{{ 'Some pages are still being translated and will show in English for now.' | t }}</p>
              }
            </div>
          </section>

          <!-- Account: your data, your password, and deleting the account -->
          <section id="account" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-base font-semibold text-foreground">{{ "Account" | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ "Your data is saved to your account — export a copy any time." | t }}</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <app-icon name="file-text" [size]="20" />
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
                    class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="download" [size]="16" />
                    {{ "Export" | t }}
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Reset preferences" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Puts all your preferences back to how they started." | t }}</span>
                  </div>
                  <button
                    type="button"
                    (click)="resetPreferences()"
                    class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="refresh-cw" [size]="16" />
                    {{ "Reset" | t }}
                  </button>
                </div>

              </div>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <app-icon name="lock" [size]="20" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Change Password" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Needs your current password." | t }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-border px-5 py-5">
                <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
                  {{ "Current Password" | t }}
                  <input
                    type="password"
                    autocomplete="current-password"
                    [(ngModel)]="passwordForm.current"
                    class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                  />
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
                    {{ "New Password" | t }}
                    <input
                      type="password"
                      autocomplete="new-password"
                      [(ngModel)]="passwordForm.next"
                      [placeholder]="'At least 8 characters' | t"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
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
                  <p class="text-xs font-medium text-destructive">{{ passwordError() }}</p>
                }
              </div>

              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  [disabled]="changingPassword()"
                  (click)="changePassword()"
                  class="rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {{ changingPassword() ? ('Saving…' | t) : ('Change Password' | t) }}
                </button>
                @if (passwordSavedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="16" />
                    {{ "Password changed" | t }}
                  </span>
                }
              </div>
            </div>

            <!-- Delete account -->
            <div class="overflow-hidden rounded-xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/5 text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
                  <app-icon name="alert-triangle" [size]="20" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none text-[var(--destructive)]">{{ "Delete Account" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Permanently removes your account and all of its data. This can't be undone." | t }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-3 border-t border-[var(--destructive)]/30 px-5 py-4">
                <p class="text-xs text-muted-foreground">
                  {{ "Deletes your profile, settings and price changes. You'll be signed out straight away. Export your data first (above) if you want to keep a copy." | t }}
                </p>
                <button
                  type="button"
                  (click)="openDeleteAccount()"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-2.5 text-sm font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
                >
                  <app-icon name="trash" [size]="16" />
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
              <app-icon name="trash" [size]="18" />
              {{ "Delete your account?" | t }}
            </span>
            <p class="text-sm text-muted-foreground">
              {{ 'Everything tied to {email} is erased permanently. This can\'t be undone.' | t: { email: auth.currentUser()?.email ?? '' } }}
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
                <app-icon name="download" [size]="16" />
                {{ "Export" | t }}
              </button>
            </div>
            <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
              {{ "Your password" | t }}
              <input
                type="password"
                autocomplete="current-password"
                [(ngModel)]="deletePassword"
                class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm font-semibold text-foreground">
              {{ "Type DELETE to confirm" | t }}
              <input
                type="text"
                autocomplete="off"
                [(ngModel)]="deleteConfirmText"
                class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            @if (deleteError()) {
              <p class="text-xs font-medium text-destructive">{{ deleteError() }}</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingDelete.set(false)" class="rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              [disabled]="deleteConfirmText !== 'DELETE' || deletingAccount()"
              (click)="deleteAccount()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2.5 text-sm font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
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
              <app-icon name="lock" [size]="18" />
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
              <p class="text-xs font-medium text-destructive">{{ exportError() }}</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingExport.set(false)" class="rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              [disabled]="verifyingExport()"
              (click)="confirmExport()"
              class="rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
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

  private catalog = inject(VehicleCatalogService);
  /** The colour preview's car and figures: the first car of the advisor's Primary Brand, quoted on
   *  their own defaults — so it matches what the Calculator shows, not a made-up sample. */
  posterPreview = computed(() => {
    const d = this.settingsService.settings().salesDefaults;
    const primary = this.settingsService.settings().dashboardTarget.brand;
    const sold = this.catalog.soldVehicles();
    const vehicle = sold.find((v) => v.brand === primary) ?? sold[0];
    if (!vehicle) return null;
    const year = Math.max(...vehicle.years.map((y) => y.year));
    const tenures = [...d.defaultTenureYears].sort((a, b) => b - a).slice(0, 2);
    const pricing = {
      defaults: d,
      insuranceFor: (v: Vehicle) => this.settingsService.getVehicleInsurance(v, v.basicPremium ?? basicPremiumDefault(v.price, d.basicPremiumRatePct)),
    };
    const rows = tenures.map((years) => ({
      years,
      monthly: quoteForComparison(vehicle, year, { downpaymentType: 'percent', downpaymentValue: d.downpaymentPct, tenureMonths: years * 12, rateType: d.defaultRateType, ncd: d.ncd }, pricing).monthly ?? 0,
    }));
    const rm = (v: number) => Math.round(v).toLocaleString('en-MY');
    return { title: modelVariantLabel(vehicle.model, vehicle.variant), year, rows: rows.map((r) => ({ years: r.years, amount: rm(r.monthly) })) };
  });

  /** Saves straight away, like the language switches. */
  setPosterAccent(id: PosterAccentId) {
    this.settingsService.updateSalesDefaults({ posterAccent: id });
    this.salesForm.posterAccent = id;
  }

  /** Saves straight away — a language switch should take effect the moment it's tapped. */
  setLanguage(field: 'uiLanguage' | 'posterLanguage' | 'whatsappLanguage', lang: Lang) {
    this.settingsService.updateSalesDefaults({ [field]: lang });
    this.salesForm[field] = lang;
  }

  navItems: NavItem[] = [
    { id: 'appearance', label: 'Appearance', icon: 'sun' },
    { id: 'customise', label: 'Make it yours', icon: 'layout' },
    { id: 'language', label: 'Language', icon: 'languages' },
    { id: 'account', label: 'Account', icon: 'lock' },
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

  salesForm: SalesDefaults;

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
    { id: 'light', label: 'Light', icon: 'sun' },
    { id: 'dark', label: 'Dark', icon: 'moon' },
    { id: 'system', label: 'Same as device', icon: 'monitor' },
  ];
  theme = inject(ThemeService);

  // ---------- Make it yours (UiPrefsService) ----------
  prefs = inject(UiPrefsService);
  menuPages = MENU_PAGES.map((id) => PAGES.find((p) => p.id === id)!);
  densities: { id: Density; label: string; hint: string }[] = [
    { id: 'comfortable', label: 'Comfortable', hint: 'Bigger text and buttons' },
    { id: 'compact', label: 'Compact', hint: 'More on the screen' },
  ];

  constructor(
    public settingsService: SettingsService,
    public auth: AuthService,
    private advisor: AdvisorService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
  ) {
    this.salesForm = { ...this.settingsService.settings().salesDefaults };
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


  resetPreferences() {
    this.settingsService.resetToDefaults();
    this.salesForm = { ...this.settingsService.settings().salesDefaults };
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
