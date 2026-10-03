import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountUpDirective } from '../shared/count-up.directive';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { AuthService } from '../shared/auth.service';
import { CustomerService } from '../shared/customer.service';
import { SettingsService } from '../shared/settings.service';
import { ImageCropModalComponent } from '../shared/image-crop-modal.component';
import { CUSTOMER_STATUS_META } from '../data/customer-data';
import { vehicleTitle } from '../data/calculator-data';
import type { AdvisorProfile } from '../data/advisor-data';
import { formatMalaysianPhone, toMalaysianWhatsAppNumber } from '../data/dashboard-data';
import { BrandIconComponent } from '../shared/brand-icon.component';
import {
  SOCIAL_PLATFORMS,
  displayLink,
  hasShowroom,
  normalizeMapsUrl,
  normalizeSocialLink,
  showroomMapsHref,
  socialEntries,
  type Showroom,
  type SocialLinks,
  type SocialPlatform,
} from '../data/social-data';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ImageCropModalComponent, BrandIconComponent, CountUpDirective],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-5">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-bold tracking-tight">My Profile</h2>
        <p class="text-pretty text-sm text-muted-foreground">What customers see on your quotes and shared links.</p>
      </div>

      <!-- Identity card -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div class="relative flex size-20 shrink-0">
              @if ((editing() ? form.photoUrl : advisor.profile().photoUrl); as photo) {
                <img [src]="photo" alt="" class="size-20 shrink-0 rounded-full border border-border object-cover" />
              } @else {
                <div
                  class="flex size-20 shrink-0 items-center justify-center rounded-full border border-border text-2xl font-bold text-white/90"
                  [style.background]="avatarGradient"
                >
                  {{ advisor.initials() }}
                </div>
              }
              @if (editing()) {
                <button
                  type="button"
                  (click)="photoInput.click()"
                  aria-label="Change photo"
                  class="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
                >
                  <app-icon name="upload" [size]="13" />
                </button>
                <input #photoInput type="file" accept="image/*" class="hidden" (change)="onPhotoFileChange($event)" />
              }
            </div>
            <div class="flex flex-col gap-1.5">
              @if (editing() && form.photoUrl) {
                <button
                  type="button"
                  (click)="removePhoto()"
                  class="w-fit text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                >
                  Remove photo
                </button>
              }
              @if (photoError(); as err) {
                <span class="text-[11px] font-medium text-destructive">{{ err }}</span>
              }
              @if (!editing()) {
                <h3 class="text-xl font-semibold tracking-tight">{{ advisor.profile().name }}</h3>
                <span class="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{{ advisor.profile().role }}</span>
              } @else {
                <input
                  type="text"
                  [(ngModel)]="form.name"
                  placeholder="Name"
                  class="h-9 w-full rounded-lg border border-input bg-input px-3 text-base font-semibold text-foreground outline-none focus:border-ring sm:w-56"
                />
                <input
                  type="text"
                  [(ngModel)]="form.role"
                  placeholder="Role"
                  class="h-8 w-full rounded-lg border border-input bg-input px-3 text-xs text-foreground outline-none focus:border-ring sm:w-44"
                />
              }
            </div>
          </div>

          @if (!editing()) {
            <button
              type="button"
              (click)="startEdit()"
              class="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <app-icon name="pencil" [size]="13" />
              Edit Profile
            </button>
          } @else {
            <div class="flex shrink-0 items-center gap-2">
              <button type="button" (click)="cancelEdit()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
              <button type="button" (click)="saveEdit()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Save</button>
            </div>
          }
        </div>

        <div class="flex flex-col gap-4 border-t border-border p-6">
          @if (!editing()) {
            <p class="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">{{ advisor.profile().bio }}</p>
          } @else {
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Bio
              <textarea
                rows="2"
                [(ngModel)]="form.bio"
                class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              ></textarea>
            </label>
          }

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <app-icon name="mail" [size]="16" class="shrink-0 text-primary" />
              @if (!editing()) {
                <span class="truncate text-sm">{{ advisor.profile().email }}</span>
              } @else {
                <input type="email" [(ngModel)]="form.email" placeholder="Email" class="h-8 w-full bg-transparent text-sm text-foreground outline-none" />
              }
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <app-icon name="phone" [size]="16" class="shrink-0 text-primary" />
              @if (!editing()) {
                <span class="truncate text-sm">{{ formatPhone(advisor.profile().phoneDisplay) }}</span>
              } @else {
                <input type="text" [(ngModel)]="form.phoneDisplay" placeholder="e.g. 012-345 6789" class="h-8 w-full bg-transparent text-sm text-foreground outline-none" />
              }
            </div>
          </div>
        </div>

        <!-- Showroom -->
        <div class="flex flex-col gap-3 border-t border-border p-6">
          <div class="flex flex-col gap-0.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Showroom</span>
            <span class="text-xs text-muted-foreground">Shown on the Profile tab of your customer link, with directions.</span>
          </div>
          @if (!editing()) {
            @if (hasShowroom(advisor.profile().showroom)) {
              <div class="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <app-icon name="map-pin" [size]="16" class="mt-0.5 shrink-0 text-primary" />
                <div class="flex min-w-0 flex-col gap-0.5">
                  @if (advisor.profile().showroom?.name; as name) {
                    <span class="text-sm font-medium">{{ name }}</span>
                  }
                  @if (advisor.profile().showroom?.address; as address) {
                    <span class="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{{ address }}</span>
                  }
                  @if (showroomMapsHref(advisor.profile().showroom); as href) {
                    <a [href]="href" target="_blank" rel="noopener noreferrer" class="mt-1 w-fit text-xs font-medium text-primary underline-offset-2 hover:underline">Open in Google Maps</a>
                  }
                </div>
              </div>
            } @else {
              <p class="text-xs text-muted-foreground">No showroom added yet — tap Edit Profile to add one.</p>
            }
          } @else {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Showroom Name
                <input
                  type="text"
                  [(ngModel)]="showroomForm.name"
                  placeholder="e.g. Proton 3S Glenmarie"
                  maxlength="200"
                  class="h-9 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                />
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Google Maps Link <span class="font-normal">(optional)</span>
                <input
                  type="url"
                  [(ngModel)]="showroomForm.mapsUrl"
                  (ngModelChange)="mapsError.set(null)"
                  placeholder="https://maps.app.goo.gl/…"
                  class="h-9 rounded-lg border bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
                  [ngClass]="mapsError() ? 'border-destructive' : 'border-input'"
                />
                @if (mapsError(); as err) {
                  <span class="text-[11px] font-medium text-destructive">{{ err }}</span>
                }
              </label>
              <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                Address
                <textarea
                  rows="2"
                  [(ngModel)]="showroomForm.address"
                  placeholder="Street, postcode, city, state"
                  maxlength="500"
                  class="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                ></textarea>
              </label>
            </div>
            <p class="text-[11px] text-muted-foreground">Without a Maps link, directions search for the showroom name and address.</p>
          }
        </div>

        <!-- Social media -->
        <div class="flex flex-col gap-3 border-t border-border p-6">
          <div class="flex flex-col gap-0.5">
            <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social Media</span>
            <span class="text-xs text-muted-foreground">Only the ones you fill in are shown to customers.</span>
          </div>
          @if (!editing()) {
            @if (socialEntries(advisor.profile().socials); as entries) {
              @if (entries.length) {
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  @for (s of entries; track s.id) {
                    <a
                      [href]="s.href"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent"
                    >
                      <app-brand-icon [name]="s.id" [size]="28" [tile]="true" />
                      <div class="flex min-w-0 flex-col">
                        <span class="text-sm font-medium leading-tight">{{ s.label }}</span>
                        <span class="truncate text-[11px] text-muted-foreground">{{ displayLink(s.href) }}</span>
                      </div>
                    </a>
                  }
                </div>
              } @else {
                <p class="text-xs text-muted-foreground">No social media added yet — tap Edit Profile to add your pages.</p>
              }
            }
          } @else {
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              @for (p of socialPlatforms; track p.id) {
                <div class="flex flex-col gap-1">
                  <label class="flex items-center gap-2.5 rounded-lg border bg-input px-2 focus-within:border-ring" [ngClass]="socialErrors()[p.id] ? 'border-destructive' : 'border-input'">
                    <app-brand-icon [name]="p.id" [size]="24" [tile]="true" />
                    <span class="sr-only">{{ p.label }}</span>
                    <input
                      type="text"
                      autocapitalize="off"
                      autocomplete="off"
                      spellcheck="false"
                      [(ngModel)]="socialForm[p.id]"
                      (ngModelChange)="clearSocialError(p.id)"
                      [placeholder]="p.label + ' — @username or link'"
                      class="h-9 w-full min-w-0 bg-transparent text-sm text-foreground outline-none"
                    />
                  </label>
                  @if (socialErrors()[p.id]; as err) {
                    <span class="text-[11px] font-medium text-destructive">{{ err }}</span>
                  }
                </div>
              }
            </div>
          }
        </div>

        @if (editing()) {
          <div class="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            @if (hasFormErrors()) {
              <span class="mr-auto text-[11px] font-medium text-destructive">Fix the highlighted fields to save.</span>
            }
            <button type="button" (click)="cancelEdit()" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="saveEdit()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">Save</button>
          </div>
        }
      </div>

      <!-- Shareable links -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex items-center gap-3 px-5 py-4">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <app-icon name="share" [size]="18" />
          </span>
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-semibold leading-none">Shareable Quote Links</span>
            <span class="text-xs text-muted-foreground">Send these to a customer to build their own quote — no login needed.</span>
          </div>
        </div>

        <div class="flex flex-col divide-y divide-border border-t border-border px-5">
          <div class="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">Your Customer Link</span>
              <span class="text-xs text-muted-foreground">Your promo card is shown on the quote they build.</span>
            </div>
            <div class="flex items-center gap-2">
              <code class="max-w-[220px] truncate rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-foreground sm:max-w-xs">{{ customerLinkUrl() }}</code>
              <button
                type="button"
                (click)="copyCustomerLink()"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <app-icon [name]="linkCopied() ? 'check' : 'clipboard-check'" [size]="13" />
                {{ linkCopied() ? 'Copied!' : 'Copy' }}
              </button>
              <a
                [href]="customerLinkUrl()"
                target="_blank"
                rel="noopener"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <app-icon name="arrow-up-right" [size]="13" />
                Open
              </a>
            </div>
          </div>

          <div class="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">{{ defaultBrand() }}-Only Link</span>
              <span class="text-xs text-muted-foreground">Same quote page, locked to {{ defaultBrand() }} — no brand switcher for the customer.</span>
            </div>
            <div class="flex items-center gap-2">
              <code class="max-w-[220px] truncate rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-foreground sm:max-w-xs">{{ brandOnlyLinkUrl() }}</code>
              <button
                type="button"
                (click)="copyBrandOnlyLink()"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <app-icon [name]="brandLinkCopied() ? 'check' : 'clipboard-check'" [size]="13" />
                {{ brandLinkCopied() ? 'Copied!' : 'Copy' }}
              </button>
              <a
                [href]="brandOnlyLinkUrl()"
                target="_blank"
                rel="noopener"
                class="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <app-icon name="arrow-up-right" [size]="13" />
                Open
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" [ngClass]="statusMeta.Lead.tone">
            <app-icon name="users" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Leads</span>
            <span class="font-mono text-xl font-bold tabular" [appCountUp]="'' + (customers.leads().length)"></span>
          </div>
        </div>
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" [ngClass]="statusMeta.Won.tone">
            <app-icon name="trophy" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Won</span>
            <span class="font-mono text-xl font-bold tabular" [appCountUp]="'' + (customers.won().length)"></span>
          </div>
        </div>
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" [ngClass]="statusMeta.Lost.tone">
            <app-icon name="x-circle" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lost</span>
            <span class="font-mono text-xl font-bold tabular" [appCountUp]="'' + (customers.lost().length)"></span>
          </div>
        </div>
        <div class="lift group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 bg-primary/15 text-primary">
            <app-icon name="wallet" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Commission Earned</span>
            <span class="font-mono text-xl font-bold tabular" [appCountUp]="'' + (fmt(totalCommission()))"></span>
            @if (pendingCommission() > 0) {
              <span class="text-[11px] font-medium text-[var(--warning)]">{{ pendingCommission() }} awaiting commission</span>
            }
          </div>
        </div>
      </div>

      <!-- Recent activity -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="border-b border-border p-4">
          <h3 class="text-sm font-semibold">Recent Activity</h3>
        </div>
        <ul>
          @for (r of recentActivity(); track r.id) {
            <li class="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-0">
              <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta[r.status].tone">
                <span class="size-1.5 rounded-full" [ngClass]="statusMeta[r.status].dot"></span>
                {{ statusMeta[r.status].label }}
              </span>
              <span class="min-w-0 flex-1 truncate">{{ r.name }} &middot; {{ vehicleTitle(r.brand, r.model) }}</span>
              <span class="whitespace-nowrap text-xs text-muted-foreground tabular">{{ shortDate(r.date) }}</span>
            </li>
          } @empty {
            <li class="p-6 text-center text-sm text-muted-foreground">No activity yet.</li>
          }
        </ul>
      </div>
    </div>

    @if (cropFile(); as file) {
      <app-image-crop-modal [file]="file" (crop)="onCropped($event)" (cancel)="cropFile.set(null)" />
    }
  `,
})
export class ProfileComponent {
  statusMeta = CUSTOMER_STATUS_META;
  vehicleTitle = vehicleTitle;
  fmt = (v: number) => `RM ${v.toLocaleString('en-MY')}`;
  avatarGradient =
    'radial-gradient(circle at 30% 20%, var(--primary), transparent 70%), linear-gradient(145deg, var(--primary), color-mix(in oklch, var(--primary), black 55%))';

  editing = signal(false);
  photoError = signal<string | null>(null);
  cropFile = signal<File | null>(null);
  form: AdvisorProfile;
  linkCopied = signal(false);
  brandLinkCopied = signal(false);

  formatPhone = formatMalaysianPhone;
  socialPlatforms = SOCIAL_PLATFORMS;
  socialEntries = socialEntries;
  displayLink = displayLink;
  hasShowroom = hasShowroom;
  showroomMapsHref = showroomMapsHref;
  showroomForm: Showroom = {};
  socialForm: Partial<Record<SocialPlatform, string>> = {};
  mapsError = signal<string | null>(null);
  socialErrors = signal<Partial<Record<SocialPlatform, string>>>({});
  hasFormErrors = computed(() => !!this.mapsError() || Object.keys(this.socialErrors()).length > 0);

  clearSocialError(platform: SocialPlatform) {
    if (!this.socialErrors()[platform]) return;
    const { [platform]: _, ...rest } = this.socialErrors();
    this.socialErrors.set(rest);
  }

  constructor(
    public advisor: AdvisorService,
    public customers: CustomerService,
    private auth: AuthService,
    private settingsService: SettingsService,
  ) {
    this.form = { ...this.advisor.profile() };
  }

  defaultBrand = computed(() => this.settingsService.settings().dashboardTarget.brand);
  customerLinkUrl = computed(() => `${location.origin}/quote/${this.auth.currentUser()?.publicToken ?? ''}`);
  brandOnlyLinkUrl = computed(() => `${location.origin}/quote/${this.auth.currentUser()?.publicToken ?? ''}/brand`);

  async copyCustomerLink() {
    try {
      await navigator.clipboard.writeText(this.customerLinkUrl());
      this.settingsService.markQuoteShared();
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch {
      /* clipboard permission denied — the link is still visible to copy manually */
    }
  }

  async copyBrandOnlyLink() {
    try {
      await navigator.clipboard.writeText(this.brandOnlyLinkUrl());
      this.settingsService.markQuoteShared();
      this.brandLinkCopied.set(true);
      setTimeout(() => this.brandLinkCopied.set(false), 2000);
    } catch {
      /* clipboard permission denied — the link is still visible to copy manually */
    }
  }

  shortDate(d: string): string {
    return d ? new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  totalCommission = computed(() => this.customers.records().reduce((sum, r) => sum + (r.commission ?? 0), 0));
  /** Won deals with no commission keyed in yet (same rule as Earnings). */
  pendingCommission = computed(
    () => this.customers.records().filter((r) => r.status === 'Won' && r.commission == null).length,
  );

  recentActivity = computed(() => [...this.customers.records()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5));

  startEdit() {
    const profile = this.advisor.profile();
    this.form = { ...profile };
    // Separate copies so typing into nested fields never mutates the live profile before Save.
    this.showroomForm = { ...profile.showroom };
    this.socialForm = { ...profile.socials };
    this.mapsError.set(null);
    this.socialErrors.set({});
    this.photoError.set(null);
    this.editing.set(true);
  }

  cancelEdit() {
    this.photoError.set(null);
    this.mapsError.set(null);
    this.socialErrors.set({});
    this.editing.set(false);
  }

  saveEdit() {
    const mapsUrl = normalizeMapsUrl(this.showroomForm.mapsUrl);
    this.mapsError.set(mapsUrl === null ? 'Enter a full link, e.g. https://maps.app.goo.gl/…' : null);

    const socials: SocialLinks = {};
    const errors: Partial<Record<SocialPlatform, string>> = {};
    for (const p of SOCIAL_PLATFORMS) {
      const href = normalizeSocialLink(p.id, this.socialForm[p.id]);
      if (href === null) errors[p.id] = `Enter a ${p.label} username or a ${p.hosts[0]} link.`;
      else if (href) socials[p.id] = href;
    }
    this.socialErrors.set(errors);
    if (this.hasFormErrors()) return;

    const showroom: Showroom = {
      name: this.showroomForm.name?.trim() || undefined,
      address: this.showroomForm.address?.trim() || undefined,
      mapsUrl: mapsUrl || undefined,
    };
    this.form.showroom = hasShowroom(showroom) ? showroom : undefined;
    this.form.socials = Object.keys(socials).length ? socials : undefined;
    // No separate WhatsApp-number field — derived from the display phone itself, in Malaysian
    // local format ("012-345 6789") or already with the country code either way.
    this.form.phoneDisplay = formatMalaysianPhone(this.form.phoneDisplay.trim());
    this.form.phoneWa = toMalaysianWhatsAppNumber(this.form.phoneDisplay);
    this.advisor.update(this.form);
    this.photoError.set(null);
    this.editing.set(false);
  }

  onPhotoFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.photoError.set(`"${file.name}" isn't an image file.`);
      return;
    }
    this.photoError.set(null);
    this.cropFile.set(file);
  }

  onCropped(dataUrl: string) {
    this.form.photoUrl = dataUrl;
    this.cropFile.set(null);
  }

  removePhoto() {
    this.photoError.set(null);
    this.form.photoUrl = undefined;
  }
}
