import { AfterViewInit, Component, ElementRef, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent, type IconName } from '../shared/icon.component';
import { CarDatabaseComponent } from '../shared/car-database.component';
import { BrandModelCatalogComponent } from '../shared/brand-model-catalog.component';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { VehicleCatalogService } from '../shared/vehicle-catalog.service';
import { NCD_OPTIONS, VEHICLES } from '../data/calculator-data';
import type { DashboardTarget, SalesDefaults } from '../data/settings-data';

type NavItem = { id: string; label: string; icon: IconName };

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, CarDatabaseComponent, BrandModelCatalogComponent],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-semibold tracking-tight">Account Settings</h2>
        <p class="text-pretty text-sm text-muted-foreground">Defaults, notifications, and local data for your Redline account.</p>
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
          <!-- Defaults -->
          <section id="defaults" data-section class="flex scroll-mt-20 flex-col gap-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Defaults</h3>

            <!-- Quote defaults (Sales Preferences + Default Brand, merged — both are quote-starting values) -->
            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="wallet" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Quote Defaults</span>
                  <span class="text-xs text-muted-foreground">Starting values every time you open the Calculator or Dashboard.</span>
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-border px-5 py-5">
                <span class="text-xs font-semibold text-foreground">Sales Preferences</span>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Default Downpayment (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      [(ngModel)]="salesForm.downpaymentPct"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Default NCD
                    <select
                      [(ngModel)]="salesForm.ncd"
                      class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                    >
                      @for (opt of ncdOptions; track opt.value) { <option [ngValue]="opt.value">{{ opt.label }}</option> }
                    </select>
                  </label>
                </div>
                <p class="text-[11px] text-muted-foreground">Interest rate and basic premium are set per car in the Car Finance Database.</p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="saveSalesDefaults()"
                    class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Save Sales Preferences
                  </button>
                  @if (savedFlash()) {
                    <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                      <app-icon name="check" [size]="13" />
                      Saved
                    </span>
                  }
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-border px-5 py-5">
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-semibold text-foreground">Default Brand</span>
                  <p class="text-xs text-muted-foreground">
                    Dashboard's Monthly Target and Performance by Model, the Calculator's starting car, the new-lead starting car in
                    Customer Manager, and the brand filter on My Cars. Customer Manager's own brand filter always starts on "All" so
                    existing customers from other brands aren't hidden by default; Cost Breakdown keeps its own filter too.
                  </p>
                </div>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Brand
                    <select
                      [(ngModel)]="dashboardForm.brand"
                      class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring"
                    >
                      @for (b of brands; track b) { <option [value]="b">{{ b }}</option> }
                    </select>
                  </label>
                  <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Monthly Target (units)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      [(ngModel)]="dashboardForm.target"
                      class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </label>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    (click)="saveDashboardTarget()"
                    class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Save Default Brand
                  </button>
                  @if (dashboardSavedFlash()) {
                    <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                      <app-icon name="check" [size]="13" />
                      Saved
                    </span>
                  }
                </div>
              </div>
            </div>
          </section>

          <!-- Car catalog -->
          <section id="catalog" data-section class="flex scroll-mt-20 flex-col gap-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Car Catalog</h3>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="sparkles" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Brand &amp; Model Catalog</span>
                  <span class="text-xs text-muted-foreground">Brands, logos, models, variants, and spec — what a car IS.</span>
                </div>
              </div>

              <div class="flex items-center gap-3 border-t border-border px-5 py-4">
                <div class="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2">
                  <span class="text-lg font-semibold leading-none tabular">{{ catalog.brands().length }}</span>
                  <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Brand{{ catalog.brands().length === 1 ? '' : 's' }}
                  </span>
                </div>
                <div class="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2">
                  <span class="text-lg font-semibold leading-none tabular">{{ vehicleCount() }}</span>
                  <span class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Pricing Row{{ vehicleCount() === 1 ? '' : 's' }}
                  </span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-5 py-3">
                <button
                  type="button"
                  (click)="openBrandModelCatalog.set(true)"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <app-icon name="sparkles" [size]="13" />
                  Open Brand &amp; Model Catalog
                </button>
              </div>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="wallet" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Car Database</span>
                  <span class="text-xs text-muted-foreground">Price, interest rate, rebate, and insurance for cars already in the Catalog — what a car costs.</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-5 py-3">
                <button
                  type="button"
                  (click)="openCarDatabase.set(true)"
                  class="flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <app-icon name="table" [size]="13" />
                  Open Car Database
                </button>
              </div>
            </div>
          </section>

          <!-- Notifications -->
          <section id="notifications" data-section class="flex scroll-mt-20 flex-col gap-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</h3>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="bell" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Notification Preferences</span>
                  <span class="text-xs text-muted-foreground">Choose what you want to be kept in the loop about.</span>
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
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data &amp; Privacy</h3>

            <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
              <div class="flex items-center gap-3 px-5 py-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <app-icon name="file-text" [size]="18" />
                </span>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold leading-none">Data Management</span>
                  <span class="text-xs text-muted-foreground">Everything here lives only in this browser — no server involved.</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  (click)="exportData()"
                  class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="download" [size]="13" />
                  Export all data (JSON)
                </button>
                <button
                  type="button"
                  (click)="resetPreferences()"
                  class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <app-icon name="refresh-cw" [size]="13" />
                  Reset preferences to defaults
                </button>
                <button
                  type="button"
                  (click)="loadSampleData()"
                  [disabled]="seeding()"
                  class="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  <app-icon name="sparkles" [size]="13" />
                  {{ seeding() ? 'Loading…' : 'Load 30 sample deals' }}
                </button>
                @if (seedFlash()) {
                  <span class="flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                    <app-icon name="check" [size]="13" />
                    Added — check the Dashboard
                  </span>
                }
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
        </div>
      </div>
    </div>

    <!-- Brand & Model Catalog -->
    @if (openBrandModelCatalog()) {
      <app-brand-model-catalog (close)="openBrandModelCatalog.set(false)" />
    }

    <!-- Car Database -->
    @if (openCarDatabase()) {
      <app-car-database (close)="openCarDatabase.set(false)" />
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
  `,
})
export class AccountSettingsComponent implements AfterViewInit, OnDestroy {
  ncdOptions = NCD_OPTIONS;

  navItems: NavItem[] = [
    { id: 'defaults', label: 'Defaults', icon: 'wallet' },
    { id: 'catalog', label: 'Car Catalog', icon: 'car' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'data', label: 'Data & Privacy', icon: 'file-text' },
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

  /** Getter, not a field — re-reads the catalog on every check so it stays current while the
   *  Brand & Model Catalog (a child of this same component) adds/removes brands underneath it. */
  get brands(): string[] {
    return this.catalog.brands();
  }

  vehicleCount = () => VEHICLES.length;
  openCarDatabase = signal(false);
  openBrandModelCatalog = signal(false);

  salesForm: SalesDefaults;
  dashboardForm: DashboardTarget;
  savedFlash = signal(false);
  dashboardSavedFlash = signal(false);
  confirmingClear = signal(false);
  seeding = signal(false);
  seedFlash = signal(false);

  constructor(
    public settingsService: SettingsService,
    public customers: CustomerService,
    public catalog: VehicleCatalogService,
    private advisor: AdvisorService,
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

  saveSalesDefaults() {
    this.settingsService.updateSalesDefaults(this.salesForm);
    this.savedFlash.set(true);
    setTimeout(() => this.savedFlash.set(false), 2000);
  }

  saveDashboardTarget() {
    this.settingsService.updateDashboardTarget(this.dashboardForm);
    this.dashboardSavedFlash.set(true);
    setTimeout(() => this.dashboardSavedFlash.set(false), 2000);
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

  exportData() {
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
}
