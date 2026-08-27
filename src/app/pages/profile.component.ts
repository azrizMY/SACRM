import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { AdvisorService } from '../shared/advisor.service';
import { CustomerService } from '../shared/customer.service';
import { CUSTOMER_STATUS_META } from '../data/customer-data';
import type { AdvisorProfile } from '../data/advisor-data';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-5">
      <!-- Profile card -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col gap-5 bg-gradient-to-br from-primary/12 via-card to-card p-6 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              class="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-border text-2xl font-bold text-white/90"
              [style.background]="avatarGradient"
            >
              {{ advisor.initials() }}
            </div>
            <div class="flex flex-col gap-1.5">
              @if (!editing()) {
                <h2 class="text-xl font-semibold tracking-tight">{{ advisor.profile().name }}</h2>
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

        <div class="flex flex-col gap-4 p-6">
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
                <span class="truncate text-sm">{{ advisor.profile().phoneDisplay }}</span>
                <a
                  [href]="'https://wa.me/' + advisor.profile().phoneWa"
                  target="_blank"
                  rel="noopener"
                  aria-label="Chat on WhatsApp"
                  class="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                >
                  <app-icon name="message-circle" [size]="13" />
                </a>
              } @else {
                <input type="text" [(ngModel)]="form.phoneDisplay" placeholder="Display phone" class="h-8 w-full bg-transparent text-sm text-foreground outline-none" />
              }
            </div>
          </div>

          @if (editing()) {
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              WhatsApp Number (digits only, country code first)
              <input
                type="text"
                [(ngModel)]="form.phoneWa"
                placeholder="60123456789"
                class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>
          }
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full" [ngClass]="statusMeta.Lead.tone">
            <app-icon name="users" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Leads</span>
            <span class="text-lg font-semibold tabular">{{ customers.leads().length }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full" [ngClass]="statusMeta.Booked.tone">
            <app-icon name="clipboard-check" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Booked</span>
            <span class="text-lg font-semibold tabular">{{ customers.booked().length }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full" [ngClass]="statusMeta.Delivered.tone">
            <app-icon name="car" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Delivered</span>
            <span class="text-lg font-semibold tabular">{{ customers.delivered().length }}</span>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <app-icon name="wallet" [size]="18" />
          </span>
          <div class="flex flex-col">
            <span class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Commission Earned</span>
            <span class="text-lg font-semibold tabular">{{ fmt(totalCommission()) }}</span>
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
              <span class="min-w-0 flex-1 truncate">{{ r.name }} &middot; {{ r.brand }} {{ r.model }}</span>
              <span class="text-xs text-muted-foreground tabular">{{ r.date }}</span>
            </li>
          } @empty {
            <li class="p-6 text-center text-sm text-muted-foreground">No activity yet.</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class ProfileComponent {
  statusMeta = CUSTOMER_STATUS_META;
  fmt = (v: number) => `RM ${v.toLocaleString('en-MY')}`;
  avatarGradient =
    'radial-gradient(circle at 30% 20%, var(--primary), transparent 70%), linear-gradient(145deg, var(--primary), color-mix(in oklch, var(--primary), black 55%))';

  editing = signal(false);
  form: AdvisorProfile;

  constructor(
    public advisor: AdvisorService,
    public customers: CustomerService,
  ) {
    this.form = { ...this.advisor.profile() };
  }

  totalCommission = computed(() => this.customers.records().reduce((sum, r) => sum + (r.commission ?? 0), 0));

  recentActivity = computed(() => [...this.customers.records()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5));

  startEdit() {
    this.form = { ...this.advisor.profile() };
    this.editing.set(true);
  }

  cancelEdit() {
    this.editing.set(false);
  }

  saveEdit() {
    this.advisor.update(this.form);
    this.editing.set(false);
  }
}
