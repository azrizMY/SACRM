import { AfterViewInit, Component, ElementRef, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NumberFieldComponent } from '../shared/number-field.component';
import { ChipListEditorComponent } from '../shared/chip-list-editor.component';
import { TranslatePipe, type Lang } from '../shared/i18n';
import { Router } from '@angular/router';
import { IconComponent, type IconName } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService, UNSPECIFIED_INSURER } from '../shared/settings.service';
import { BANK_OPTIONS, INSURANCE_OPTIONS } from '../data/customer-data';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { NCD_OPTIONS } from '../data/calculator-data';
import { DEFAULT_COST_PRESETS, DEFAULT_LEAD_SOURCE, DEFAULT_STALE_LEAD_DAYS, type CostPreset, type DashboardTarget, type SalesDefaults } from '../data/settings-data';

type NavItem = { id: string; label: string; icon: IconName };

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, NumberFieldComponent, ChipListEditorComponent, TranslatePipe],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-bold tracking-tight">{{ "Settings" | t }}</h2>
        <p class="text-pretty text-sm text-muted-foreground">{{ "Quote preferences, notifications, and account data." | t }}</p>
      </div>

      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <!-- Section nav -->
        <nav
          [attr.aria-label]="'Settings sections' | t"
          class="flex shrink-0 flex-row gap-1 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:w-52 lg:flex-col lg:overflow-visible lg:pb-0"
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

            <!-- New leads -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="users" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "New Leads" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Where your leads come from, and when a quiet lead gets flagged." | t }}</span>
                </div>
              </div>
              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex flex-col gap-3 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Lead Sources" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "The choices in every Lead Source dropdown. Tap one to make it the default for new leads. Removing a source never changes existing customers." | t }}</span>
                  </div>
                  <app-chip-list-editor
                    [(items)]="leadSourcesForm"
                    [selectable]="true"
                    [(defaultItem)]="salesForm.leadSource"
                    [placeholder]="'e.g. Roadshow – Mid Valley' | t"
                    addLabel="New lead source"
                  />
                  @if (listError === 'leads') { <p class="text-xs text-[var(--destructive)]">{{ "Keep at least one source." | t }}</p> }
                </div>
                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Follow-up Reminder" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Flag a lead in Customer Manager after this many days without an update." | t }}</span>
                  </div>
                  <app-number-field
                    class="w-28 shrink-0"
                    suffix="days"
                    ariaLabel="Days before a lead is flagged"
                    [decimals]="0"
                    [grouping]="false"
                    [value]="salesForm.staleLeadDays ?? defaultStaleDays"
                    (valueChange)="salesForm.staleLeadDays = Math.min(90, Math.max(1, Math.round($event ?? defaultStaleDays)))"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button type="button" (click)="saveLeadSettings()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{{ "Save Changes" | t }}</button>
                @if (savedFlashFor() === 'leads') {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]"><app-icon name="check" [size]="13" /> {{ "Saved" | t }}</span>
                }
              </div>
            </div>

            <!-- Banks & insurance -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="landmark" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Banks & Insurance" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Only the banks and insurers you actually work with — these are the choices in every dropdown." | t }}</span>
                </div>
              </div>
              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex flex-col gap-3 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Banks" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Used for a customer's Bank Panel and for your Bankers list. Removing a bank never changes existing customers or bankers." | t }}</span>
                  </div>
                  <app-chip-list-editor [(items)]="banksForm" [placeholder]="'e.g. Bank Muamalat' | t" addLabel="New bank" />
                  @if (listError === 'banks') { <p class="text-xs text-[var(--destructive)]">{{ "Keep at least one bank." | t }}</p> }
                </div>
                <div class="flex flex-col gap-3 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Insurance Companies" | t }}</span>
                    <span class="text-xs text-muted-foreground">Used when recording a delivery. "Unspecified" is always available.</span>
                  </div>
                  <app-chip-list-editor [(items)]="insurersForm" [placeholder]="'e.g. Takaful Ikhlas' | t" addLabel="New insurance company" />
                </div>
              </div>
              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button type="button" (click)="saveBankLists()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{{ "Save Changes" | t }}</button>
                <button type="button" (click)="resetBankLists()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">{{ "Restore defaults" | t }}</button>
                @if (savedFlashFor() === 'banks') {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]"><app-icon name="check" [size]="13" /> {{ "Saved" | t }}</span>
                }
              </div>
            </div>

            <!-- Cost quick-buttons -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="wallet" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Cost Quick-Buttons" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "The one-tap cost items on Cost Breakdown, with your own prices." | t }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-2 border-t border-border px-5 py-4 [&>*]:max-w-2xl">
                @for (preset of costPresetsForm; track $index; let i = $index) {
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      [(ngModel)]="preset.label"
                      [placeholder]="'Item, e.g. Tinted' | t"
                      [attr.aria-label]="'Cost item ' + (i + 1)"
                      class="h-9 min-w-0 flex-1 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none"
                    />
                    <app-number-field class="w-32 shrink-0" prefix="RM" [decimals]="0" ariaLabel="Price" [value]="preset.amount" (valueChange)="preset.amount = $event ?? 0" />
                    <button type="button" (click)="removeCostPreset(i)" [attr.aria-label]="'Remove item' | t" class="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  </div>
                } @empty {
                  <p class="text-xs text-muted-foreground">{{ "No quick-buttons — add one below." | t }}</p>
                }
                <div class="flex flex-wrap items-center gap-2 pt-1">
                  <button type="button" (click)="addCostPreset()" class="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">
                    <app-icon name="plus" [size]="12" />
                    {{ "Add item" | t }}
                  </button>
                  <button type="button" (click)="resetCostPresets()" class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                    <app-icon name="rotate-ccw" [size]="12" />
                    {{ "Restore defaults" | t }}
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-2 border-t border-border px-5 py-4">
                <button type="button" (click)="saveCostPresets()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{{ "Save Changes" | t }}</button>
                @if (savedFlashFor() === 'costs') {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]"><app-icon name="check" [size]="13" /> {{ "Saved" | t }}</span>
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
                  <span class="text-sm font-semibold leading-none">{{ "Primary Brand" | t }}</span>
                  <span class="text-xs text-muted-foreground">
                    {{ "Drives the Dashboard's Monthly Target, the Calculator's starting car, the new-lead starting car in Customer Manager, and the brand filter on Brochures." | t }}
                  </span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-4">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Brand" | t }}</span>
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
                    <span class="text-sm font-medium">{{ "Monthly Target" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Units target shown on the Dashboard." | t }}</span>
                  </div>
                  <app-number-field
                    class="w-24 shrink-0"
                    [suffix]="'units' | t"
                    ariaLabel="Monthly target"
                    [decimals]="0"
                    [grouping]="false"
                    [value]="dashboardForm.target"
                    (valueChange)="dashboardForm.target = Math.max(1, Math.round($event ?? 1))"
                  />
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

          <!-- Notifications -->
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
              </div>
              @if (uiLanguage() === 'ms') {
                <p class="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">{{ 'Some pages are still being translated and will show in English for now.' | t }}</p>
              }
            </div>
          </section>

          <section id="notifications" data-section class="flex scroll-mt-20 flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ "Notifications" | t }}</h3>
              <p class="text-xs text-muted-foreground">{{ "Choose what you want to be kept in the loop about." | t }}</p>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="bell" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">{{ "Notification Preferences" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "New leads, bookings, and weekly performance summaries." | t }}</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-3">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "New lead alerts" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "When a lead is added from the Calculator or Customer Manager." | t }}</span>
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
                    <span class="text-sm font-medium">{{ "Booking reminders" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Documents pending or a booking about to go stale." | t }}</span>
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
                    <span class="text-sm font-medium">{{ "Weekly performance summary" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Leads, bookings, deliveries, and commission for the week." | t }}</span>
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
                  <span class="text-xs text-muted-foreground">{{ "Back up, reset, or demo with sample data." | t }}</span>
                </div>
              </div>

              <div class="flex flex-col divide-y divide-border border-t border-border px-5">
                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Export all data" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Download your profile, settings, and customers as a JSON file." | t }}</span>
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
                    <span class="text-xs text-muted-foreground">{{ "Puts Quote Preferences and Notifications back to their factory settings." | t }}</span>
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

                <div class="flex items-center justify-between gap-4 py-3.5">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium">{{ "Load sample deals" | t }}</span>
                    <span class="text-xs text-muted-foreground">{{ "Adds 30 example leads, bookings, and deliveries — handy for a demo." | t }}</span>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    @if (seedFlash()) {
                      <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                        <app-icon name="check" [size]="13" />
                        {{ "Added" | t }}
                      </span>
                    }
                    <button
                      type="button"
                      (click)="loadSampleData()"
                      [disabled]="seeding()"
                      class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    >
                      <app-icon name="sparkles" [size]="13" />
                      {{ seeding() ? ('Loading…' | t) : ('Load' | t) }}
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
                  <span class="text-sm font-semibold leading-none text-[var(--destructive)]">{{ "Danger Zone" | t }}</span>
                  <span class="text-xs text-muted-foreground">{{ "Permanently deletes every lead, booking, and delivery record." | t }}</span>
                </div>
              </div>
              <div class="flex flex-col gap-3 border-t border-[var(--destructive)]/30 px-5 py-4">
                <p class="text-xs text-muted-foreground">{{ "Uploaded car brochures and your profile are not affected." | t }}</p>
                <button
                  type="button"
                  (click)="requestClearData()"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
                >
                  <app-icon name="trash" [size]="13" />
                  {{ "Clear all customer data" | t }}
                </button>
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

    <!-- Clear data confirmation -->
    @if (confirmingClear()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" [attr.aria-label]="'Close' | t" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingClear.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="trash" [size]="15" />
              {{ "Clear all customer data?" | t }}
            </span>
            <p class="text-sm text-muted-foreground">
              {{ 'This permanently removes all {n} customer records — leads, bookings, and deliveries. This can\'t be undone.' | t: { n: customers.records().length } }}
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingClear.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">{{ "Cancel" | t }}</button>
            <button
              type="button"
              (click)="confirmClearData()"
              class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90"
            >
              {{ "Clear data" | t }}
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
            <p class="text-sm text-muted-foreground">{{ "Your export includes your profile, settings, and every customer record, so we need your password first." | t }}</p>
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
  ncdOptions = NCD_OPTIONS;
  Math = Math;

  /** Keeps a typed percentage within 0–100. */
  clampPct(v: number | null): number {
    return Math.min(100, Math.max(0, Math.round(v ?? 0)));
  }

  uiLanguage = computed<Lang>(() => this.settingsService.settings().salesDefaults.uiLanguage ?? 'en');
  posterLanguage = computed<Lang>(() => this.settingsService.settings().salesDefaults.posterLanguage ?? 'en');

  /** Saves straight away — a language switch should take effect the moment it's tapped. */
  setLanguage(field: 'uiLanguage' | 'posterLanguage', lang: Lang) {
    this.settingsService.updateSalesDefaults({ [field]: lang });
    this.salesForm[field] = lang;
  }

  navItems: NavItem[] = [
    { id: 'defaults', label: 'Quote Preferences', icon: 'wallet' },
    { id: 'language', label: 'Language', icon: 'languages' },
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
    this.leadSourcesForm = [...this.settingsService.leadSources()];
    this.banksForm = [...this.settingsService.banks()];
    this.insurersForm = [...this.settingsService.insurers()];
    this.salesForm.leadSource ??= this.leadSourcesForm[0] ?? DEFAULT_LEAD_SOURCE;
    this.costPresetsForm = (this.settingsService.settings().salesDefaults.costPresets ?? DEFAULT_COST_PRESETS).map((c) => ({ ...c }));
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
  leadSourcesForm: string[] = [];
  banksForm: string[] = [];
  insurersForm: string[] = [];
  /** Which card's list was left empty on save. */
  listError: 'leads' | 'banks' | null = null;

  saveLeadSettings() {
    if (!this.leadSourcesForm.length) {
      this.listError = 'leads';
      return;
    }
    this.listError = null;
    this.salesForm.leadSources = [...this.leadSourcesForm];
    this.saveQuoteDefaults('leads');
  }

  saveBankLists() {
    if (!this.banksForm.length) {
      this.listError = 'banks';
      return;
    }
    this.listError = null;
    const banks = [...this.banksForm];
    const insurers = this.insurersForm.filter((i) => i !== UNSPECIFIED_INSURER);
    this.settingsService.updateSalesDefaults({ banks, insurers });
    this.salesForm.banks = banks;
    this.salesForm.insurers = insurers;
    this.flash('banks');
  }

  resetBankLists() {
    this.banksForm = [...BANK_OPTIONS];
    this.insurersForm = INSURANCE_OPTIONS.filter((i) => i !== UNSPECIFIED_INSURER);
    this.listError = null;
  }
  defaultStaleDays = DEFAULT_STALE_LEAD_DAYS;

  /** Working copy of Cost Breakdown's quick-buttons — saved only on Save Changes. */
  costPresetsForm: CostPreset[] = [];

  addCostPreset() {
    this.costPresetsForm = [...this.costPresetsForm, { label: '', amount: 0 }];
  }

  removeCostPreset(i: number) {
    this.costPresetsForm = this.costPresetsForm.filter((_, idx) => idx !== i);
  }

  resetCostPresets() {
    this.costPresetsForm = DEFAULT_COST_PRESETS.map((c) => ({ ...c }));
  }

  saveCostPresets() {
    // Blank rows are dropped rather than saved as nameless buttons.
    const presets = this.costPresetsForm.map((c) => ({ label: c.label.trim(), amount: c.amount })).filter((c) => c.label && c.amount !== 0);
    this.costPresetsForm = presets.map((c) => ({ ...c }));
    this.settingsService.updateSalesDefaults({ costPresets: presets });
    this.salesForm.costPresets = presets;
    this.flash('costs');
  }

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
