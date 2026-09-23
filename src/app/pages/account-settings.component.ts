import { AfterViewInit, Component, ElementRef, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { NCD_OPTIONS } from '../data/calculator-data';
import type { DashboardTarget, SalesDefaults } from '../data/settings-data';

type NavItem = { id: string; label: string; icon: IconName };

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-semibold tracking-tight">Settings</h2>
        <p class="text-pretty text-sm text-muted-foreground">Quote preferences, notifications, and account data.</p>
      </div>

      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <!-- Section nav -->
        <nav
          aria-label="Settings sections"
          class="flex shrink-0 flex-row gap-1 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:w-52 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          @for (item of navItems; track item.id) {
            <button
              type="button"
              (click)="scrollToSection(item.id)"
              class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors"
              [ngClass]="activeSection() === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
            >
              <app-icon [name]="item.icon" [size]="15" />
              {{ item.label }}
            </button>
          }
        </nav>

        <!-- Sections -->
        <div class="flex min-w-0 flex-1 flex-col gap-10">
          <!-- Quote Preferences -->
          <section id="defaults" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quote Preferences</h3>
              <p class="text-xs text-muted-foreground">What every new quote starts with — change these any time.</p>
            </div>

            <!-- Starting values — one row per setting, matching the Notifications list below -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="wallet" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Starting Values</span>
                  <span class="text-xs text-muted-foreground">Applied every time you open the Calculator for a new quote.</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Downpayment</span>
                    <span class="text-xs text-muted-foreground">Starting percentage on a new quote.</span>
                  </div>
                  <div class="relative flex shrink-0 items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      [(ngModel)]="salesForm.downpaymentPct"
                      class="h-9 w-24 rounded-lg border border-input bg-input px-3 text-right text-sm text-foreground outline-none focus:border-ring"
                    />
                    <span class="pointer-events-none absolute right-3 text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">NCD</span>
                    <span class="text-xs text-muted-foreground">No-claims discount applied by default. Rate and basic premium are set per car in Price Settings.</span>
                  </div>
                  <select
                    [(ngModel)]="salesForm.ncd"
                    class="h-9 shrink-0 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                  >
                    @for (opt of ncdOptions; track opt.value) { <option [ngValue]="opt.value">{{ opt.label }}</option> }
                  </select>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Rate Type</span>
                    <span class="text-xs text-muted-foreground">Flat or EIR — which one a new quote opens on.</span>
                  </div>
                  <div role="radiogroup" aria-label="Rate Type" class="flex shrink-0 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="salesForm.defaultRateType === 'flat'"
                      (click)="salesForm.defaultRateType = 'flat'"
                      class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                      [ngClass]="salesForm.defaultRateType === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      Flat
                    </button>
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="salesForm.defaultRateType === 'effective'"
                      (click)="salesForm.defaultRateType = 'effective'"
                      class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                      [ngClass]="salesForm.defaultRateType === 'effective' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                    >
                      EIR
                    </button>
                  </div>
                </div>

                <div class="flex flex-col gap-3 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Repayment Table Years</span>
                    <span class="text-xs text-muted-foreground">Pick 3 tenures — which years the Calculator's repayment table opens on.</span>
                  </div>
                  <div role="group" aria-label="Repayment table tenures (years)" class="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
                    @for (y of posterYearOptions; track y) {
                      <button
                        type="button"
                        [attr.aria-pressed]="salesForm.defaultTenureYears.includes(y)"
                        (click)="toggleDefaultTenureYear(y)"
                        class="flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition-colors"
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
                  Save Changes
                </button>
                @if (savedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    Saved
                  </span>
                }
              </div>
            </div>

            <!-- Primary Brand — not Calculator-specific: also drives Dashboard and Customer Manager -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="star" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Primary Brand</span>
                  <span class="text-xs text-muted-foreground">
                    Drives the Dashboard's Monthly Target, the Calculator's starting car, the new-lead starting car in Customer
                    Manager, and the brand filter on Brochures.
                  </span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Brand</span>
                    <span class="text-xs text-muted-foreground">Customer Manager and Cost Breakdown keep their own "All" filter, so existing customers stay visible.</span>
                  </div>
                  <select
                    [(ngModel)]="dashboardForm.brand"
                    class="h-9 shrink-0 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                  >
                    @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                  </select>
                </div>

                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Monthly Target</span>
                    <span class="text-xs text-muted-foreground">Units target shown on the Dashboard.</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    [(ngModel)]="dashboardForm.target"
                    class="h-9 w-24 shrink-0 rounded-lg border border-input bg-input px-3 text-right text-sm text-foreground outline-none focus:border-ring"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  (click)="saveDefaultBrand()"
                  class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Save Changes
                </button>
                @if (brandSavedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    Saved
                  </span>
                }
              </div>
            </div>
          </section>

          <!-- Notifications -->
          <section id="notifications" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</h3>
              <p class="text-xs text-muted-foreground">Choose what you want to be kept in the loop about.</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="bell" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Notification Preferences</span>
                  <span class="text-xs text-muted-foreground">New leads, bookings, and weekly performance summaries.</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-3">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">New lead alerts</span>
                    <span class="text-xs text-muted-foreground">When a lead is added from the Calculator or Customer Manager.</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    [attr.aria-checked]="notifications().newLeadAlerts"
                    (click)="toggleNotification('newLeadAlerts')"
                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                    [ngClass]="notifications().newLeadAlerts ? 'bg-primary' : 'bg-muted'"
                  >
                    <span
                      class="inline-block size-4 transform rounded-full bg-white shadow transition-transform"
                      [ngClass]="notifications().newLeadAlerts ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-3">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Booking reminders</span>
                    <span class="text-xs text-muted-foreground">Documents pending or a booking about to go stale.</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    [attr.aria-checked]="notifications().bookingReminders"
                    (click)="toggleNotification('bookingReminders')"
                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                    [ngClass]="notifications().bookingReminders ? 'bg-primary' : 'bg-muted'"
                  >
                    <span
                      class="inline-block size-4 transform rounded-full bg-white shadow transition-transform"
                      [ngClass]="notifications().bookingReminders ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-3">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Weekly performance summary</span>
                    <span class="text-xs text-muted-foreground">Leads, bookings, deliveries, and commission for the week.</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    [attr.aria-checked]="notifications().weeklySummary"
                    (click)="toggleNotification('weeklySummary')"
                    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                    [ngClass]="notifications().weeklySummary ? 'bg-primary' : 'bg-muted'"
                  >
                    <span
                      class="inline-block size-4 transform rounded-full bg-white shadow transition-transform"
                      [ngClass]="notifications().weeklySummary ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Data & privacy -->
          <section id="data" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data &amp; Privacy</h3>
              <p class="text-xs text-muted-foreground">Everything here lives only in this browser — no server involved.</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="file-text" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Data Management</span>
                  <span class="text-xs text-muted-foreground">Back up, reset, or demo with sample data.</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Export all data</span>
                    <span class="text-xs text-muted-foreground">Download your profile, settings, and customers as a JSON file.</span>
                  </div>
                  <button
                    type="button"
                    (click)="requestExport()"
                    class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="download" [size]="13" />
                    Export
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Reset preferences</span>
                    <span class="text-xs text-muted-foreground">Puts Quote Preferences and Notifications back to their factory settings.</span>
                  </div>
                  <button
                    type="button"
                    (click)="resetPreferences()"
                    class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <app-icon name="refresh-cw" [size]="13" />
                    Reset
                  </button>
                </div>

                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">Load sample deals</span>
                    <span class="text-xs text-muted-foreground">Adds 30 example leads, bookings, and deliveries — handy for a demo.</span>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    @if (seedFlash()) {
                      <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                        <app-icon name="check" [size]="13" />
                        Added
                      </span>
                    }
                    <button
                      type="button"
                      (click)="loadSampleData()"
                      [disabled]="seeding()"
                      class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    >
                      <app-icon name="sparkles" [size]="13" />
                      {{ seeding() ? 'Loading…' : 'Load' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Danger zone -->
            <div class="overflow-hidden rounded-xl border border-[var(--destructive)]/40 bg-[var(--destructive)]/5 text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--destructive)]/15 text-[var(--destructive)]">
                  <app-icon name="alert-triangle" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none text-[var(--destructive)]">Danger Zone</span>
                  <span class="text-xs text-muted-foreground">Permanently deletes every lead, booking, and delivery record.</span>
                </div>
              </div>
              <div class="flex flex-col gap-3 border-t border-[var(--destructive)]/30 px-5 py-4">
                <p class="text-xs text-muted-foreground">Uploaded car brochures and your profile are not affected.</p>
                <button
                  type="button"
                  (click)="requestClearData()"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
                >
                  <app-icon name="trash" [size]="13" />
                  Clear all customer data
                </button>
              </div>
            </div>
          </section>

          <!-- Account & Security -->
          <section id="security" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account &amp; Security</h3>
              <p class="text-xs text-muted-foreground">Your password and account.</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="lock" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Change Password</span>
                  <span class="text-xs text-muted-foreground">Needs your current password.</span>
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-border px-5 py-5">
                <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Current Password
                  <input
                    type="password"
                    autocomplete="current-password"
                    [(ngModel)]="passwordForm.current"
                    class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                  />
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    New Password
                    <input
                      type="password"
                      autocomplete="new-password"
                      [(ngModel)]="passwordForm.next"
                      placeholder="At least 8 characters"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Confirm New Password
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
                  {{ changingPassword() ? 'Saving…' : 'Change Password' }}
                </button>
                @if (passwordSavedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    Password changed
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
                  <span class="text-sm font-semibold leading-none text-[var(--destructive)]">Delete Account</span>
                  <span class="text-xs text-muted-foreground">Permanently removes your account and all of its data. This can't be undone.</span>
                </div>
              </div>
              <div class="flex flex-col gap-3 border-t border-[var(--destructive)]/30 px-5 py-4">
                <p class="text-xs text-muted-foreground">
                  Deletes your profile, settings, customers, bankers, and pricing changes. You'll be signed out straight away.
                  Export your data first (Data &amp; Privacy above) if you want to keep a copy.
                </p>
                <button
                  type="button"
                  (click)="openDeleteAccount()"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
                >
                  <app-icon name="trash" [size]="13" />
                  Delete my account
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
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingDelete.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-3 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              Delete your account?
            </span>
            <p class="text-sm text-muted-foreground">
              Everything tied to <span class="font-medium text-foreground">{{ auth.currentUser()?.email }}</span> is erased permanently, including
              all {{ customers.records().length }} customer record{{ customers.records().length === 1 ? '' : 's' }}. This can't be undone.
            </p>
            <div class="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <span class="text-xs text-muted-foreground">
                <span class="font-medium text-foreground">Recommended:</span> download a copy of your data first — it can't be recovered afterwards.
              </span>
              <button
                type="button"
                (click)="requestExport()"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <app-icon name="download" [size]="13" />
                Export
              </button>
            </div>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Your password
              <input
                type="password"
                autocomplete="current-password"
                [(ngModel)]="deletePassword"
                class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Type DELETE to confirm
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
            <button type="button" (click)="confirmingDelete.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button
              type="button"
              [disabled]="deleteConfirmText !== 'DELETE' || deletingAccount()"
              (click)="deleteAccount()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {{ deletingAccount() ? 'Deleting…' : 'Delete account' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Clear data confirmation -->
    @if (confirmingClear()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingClear.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              Clear all customer data?
            </span>
            <p class="text-sm text-muted-foreground">
              This permanently removes all {{ customers.records().length }} customer record{{ customers.records().length === 1 ? '' : 's' }} —
              leads, bookings, and deliveries. This can't be undone.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingClear.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button
              type="button"
              (click)="confirmClearData()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
            >
              Clear data
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Export password confirmation -->
    @if (confirmingExport()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingExport.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-3 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold">
              <app-icon name="lock" [size]="15" />
              Confirm your password
            </span>
            <p class="text-sm text-muted-foreground">Your export includes your profile, settings, and every customer record, so we need your password first.</p>
            <input
              type="password"
              autocomplete="current-password"
              placeholder="Password"
              [(ngModel)]="exportPassword"
              (keydown.enter)="confirmExport()"
              class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
            />
            @if (exportError()) {
              <p class="text-[11px] font-medium text-destructive">{{ exportError() }}</p>
            }
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingExport.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button
              type="button"
              [disabled]="verifyingExport()"
              (click)="confirmExport()"
              class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {{ verifyingExport() ? 'Checking…' : 'Export data' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AccountSettingsComponent implements AfterViewInit, OnDestroy {
  ncdOptions = NCD_OPTIONS;

  navItems: NavItem[] = [
    { id: 'defaults', label: 'Quote Preferences', icon: 'wallet' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
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
  confirmingClear = signal(false);
  seeding = signal(false);
  seedFlash = signal(false);

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

  constructor(
    public settingsService: SettingsService,
    public customers: CustomerService,
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

  notifications = () => this.settingsService.settings().notifications;

  saveQuoteDefaults() {
    this.settingsService.updateSalesDefaults(this.salesForm);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
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

  toggleNotification(key: 'newLeadAlerts' | 'bookingReminders' | 'weeklySummary') {
    this.settingsService.updateNotifications({ [key]: !this.notifications()[key] });
  }

  resetPreferences() {
    this.settingsService.resetToDefaults();
    this.salesForm = { ...this.settingsService.settings().salesDefaults };
    this.dashboardForm = { ...this.settingsService.settings().dashboardTarget };
  }

  async loadSampleData() {
    this.seeding.set(true);
    await this.customers.seedDummyData();
    this.seeding.set(false);
    this.seedFlash.set(true);
    setTimeout(() => this.seedFlash.set(false), 3000);
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
      customers: this.customers.records(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redline-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  requestClearData() {
    this.confirmingClear.set(true);
  }

  async confirmClearData() {
    await this.customers.clearAll();
    this.confirmingClear.set(false);
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
