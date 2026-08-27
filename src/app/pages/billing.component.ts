import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { SubscriptionService } from '../shared/subscription.service';
import { CustomerService } from '../shared/customer.service';
import { formatRM } from '../data/calculator-data';
import { INVOICE_STATUS_META, PLANS, STATUS_META, type Invoice, type PaymentMethod } from '../data/billing-data';

const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express'];

function thisMonthPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-5">
      <div class="flex flex-col gap-1">
        <h2 class="text-balance text-xl font-semibold tracking-tight">Billing</h2>
        <p class="text-pretty text-sm text-muted-foreground">Your Redline subscription — plan, usage, payment method and invoices.</p>
      </div>

      <!-- Current plan -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col gap-4 bg-gradient-to-br from-primary/12 via-card to-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <app-icon name="credit-card" [size]="22" />
            </span>
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="text-lg font-semibold tracking-tight">{{ plan().name }} Plan</span>
                <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="statusMeta().tone">
                  <span class="size-1.5 rounded-full" [ngClass]="statusMeta().dot"></span>
                  {{ statusMeta().label }}
                </span>
              </div>
              <span class="text-sm text-muted-foreground">
                {{ plan().price === 0 ? 'Free' : fmt(plan().price) + ' / month' }}
                @if (subscription.state().status !== 'canceled') {
                  <span class="inline-flex items-center gap-1">
                    &middot; <app-icon name="calendar" [size]="12" class="inline" /> renews {{ subscription.state().renewsOn }}
                  </span>
                }
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            @if (subscription.state().status === 'canceled') {
              <button type="button" (click)="subscription.resumeSubscription()" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                Resume Subscription
              </button>
            } @else {
              <button type="button" (click)="confirmingCancel.set(true)" class="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                Cancel Subscription
              </button>
            }
          </div>
        </div>

        <!-- Usage -->
        <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-muted-foreground">Leads this month</span>
              <span class="tabular text-muted-foreground">{{ leadsThisMonth() }} / {{ isFinite(plan().leadLimit) ? plan().leadLimit : '∞' }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" [style.width.%]="leadUsagePct()"></div>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-muted-foreground">Consultant seats</span>
              <span class="tabular text-muted-foreground">1 / {{ plan().seatLimit }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary transition-all" [style.width.%]="(1 / plan().seatLimit) * 100"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Plans -->
      <div class="flex flex-col gap-3">
        <span class="text-sm font-semibold">Change Plan</span>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          @for (p of plans; track p.id) {
            <div
              class="flex flex-col gap-3 rounded-xl border p-4 text-card-foreground shadow-sm"
              [ngClass]="p.id === plan().id ? 'border-primary bg-primary/5' : 'border-border bg-card'"
            >
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-sm font-semibold">
                  @if (p.id === 'team') { <app-icon name="sparkles" [size]="13" class="text-primary" /> }
                  {{ p.name }}
                </span>
                @if (p.id === plan().id) {
                  <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Current</span>
                }
              </div>
              <span class="text-2xl font-bold tabular">
                {{ p.price === 0 ? 'Free' : fmt(p.price) }}
                @if (p.price > 0) { <span class="text-xs font-normal text-muted-foreground">/mo</span> }
              </span>
              <span class="text-xs text-muted-foreground">{{ p.blurb }}</span>
              <ul class="flex flex-col gap-1.5">
                @for (f of p.features; track f) {
                  <li class="flex items-start gap-1.5 text-xs">
                    <app-icon name="check" [size]="13" class="mt-0.5 shrink-0 text-[var(--success)]" />
                    <span>{{ f }}</span>
                  </li>
                }
              </ul>
              <button
                type="button"
                [disabled]="p.id === plan().id"
                (click)="subscription.changePlan(p.id)"
                class="mt-auto rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                [ngClass]="p.id === plan().id ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'"
              >
                {{ p.id === plan().id ? 'Current Plan' : p.price > plan().price ? 'Upgrade' : 'Downgrade' }}
              </button>
            </div>
          }
        </div>
      </div>

      <!-- Payment method -->
      <div class="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold">Payment Method</span>
          @if (!editingPayment()) {
            <button type="button" (click)="startEditPayment()" class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
              <app-icon name="pencil" [size]="12" />
              Update
            </button>
          }
        </div>

        @if (!editingPayment()) {
          @if (subscription.state().paymentMethod; as pm) {
            <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <app-icon name="credit-card" [size]="18" class="shrink-0 text-primary" />
              <span class="text-sm">{{ pm.brand }} &middot;&middot;&middot;&middot; {{ pm.last4 }}</span>
              <span class="ml-auto text-xs text-muted-foreground">Expires {{ pm.expiry }}</span>
            </div>
          } @else {
            <span class="text-sm text-muted-foreground">No payment method on file.</span>
          }
        } @else {
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Card Brand
              <select [(ngModel)]="paymentForm.brand" class="h-10 rounded-lg border border-input bg-input px-2 text-sm text-foreground outline-none focus:border-ring">
                @for (b of cardBrands; track b) { <option [value]="b">{{ b }}</option> }
              </select>
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Last 4 Digits
              <input type="text" maxlength="4" inputmode="numeric" [(ngModel)]="paymentForm.last4" placeholder="4242" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
            <label class="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Expiry (MM/YY)
              <input type="text" maxlength="5" [(ngModel)]="paymentForm.expiry" placeholder="09/28" class="h-10 rounded-lg border border-input bg-input px-3 text-sm text-foreground outline-none focus:border-ring" />
            </label>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" (click)="editingPayment.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Cancel</button>
            <button type="button" (click)="savePayment()" [disabled]="paymentForm.last4.length !== 4" class="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">Save Card</button>
          </div>
        }
      </div>

      <!-- Invoices -->
      <div class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="border-b border-border p-5">
          <span class="text-sm font-semibold">Billing History</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full caption-bottom text-sm">
            <thead>
              <tr class="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th class="h-10 whitespace-nowrap px-4 align-middle">Invoice</th>
                <th class="h-10 whitespace-nowrap px-4 align-middle">Plan</th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Amount</th>
                <th class="h-10 whitespace-nowrap px-4 align-middle">Status</th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Date</th>
                <th class="h-10 whitespace-nowrap px-4 align-middle text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (inv of subscription.state().invoices; track inv.id) {
                <tr class="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                  <td class="p-4 align-middle font-mono text-xs tabular">{{ inv.id }}</td>
                  <td class="p-4 align-middle">{{ inv.planName }}</td>
                  <td class="p-4 text-right align-middle tabular">{{ fmt(inv.amount) }}</td>
                  <td class="p-4 align-middle">
                    <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium" [ngClass]="invoiceStatusMeta[inv.status].tone">
                      <span class="size-1.5 rounded-full" [ngClass]="invoiceStatusMeta[inv.status].dot"></span>
                      {{ inv.status }}
                    </span>
                  </td>
                  <td class="p-4 text-right align-middle text-xs text-muted-foreground tabular">{{ inv.date }}</td>
                  <td class="p-4 text-right align-middle">
                    <button type="button" (click)="downloadInvoice(inv)" class="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" aria-label="Download invoice">
                      <app-icon name="download" [size]="13" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Cancel confirmation -->
    @if (confirmingCancel()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" aria-label="Close" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="confirmingCancel.set(false)"></button>
        <div class="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
          <div class="flex flex-col gap-2 p-5">
            <span class="flex items-center gap-2 text-sm font-semibold text-[var(--destructive)]">
              <app-icon name="info" [size]="15" />
              Cancel your subscription?
            </span>
            <p class="text-sm text-muted-foreground">
              You'll keep {{ plan().name }} access until {{ subscription.state().renewsOn }}, then the account drops to read-only. You can resume anytime before that.
            </p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-border p-4">
            <button type="button" (click)="confirmingCancel.set(false)" class="rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">Keep Subscription</button>
            <button type="button" (click)="doCancel()" class="rounded-md bg-[var(--destructive)] px-3 py-2 text-xs font-semibold text-[var(--destructive-foreground)] transition-colors hover:opacity-90">Cancel Subscription</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BillingComponent {
  plans = PLANS;
  cardBrands = CARD_BRANDS;
  invoiceStatusMeta = INVOICE_STATUS_META;
  fmt = (v: number) => formatRM(v);
  isFinite = (v: number) => Number.isFinite(v);

  confirmingCancel = signal(false);
  editingPayment = signal(false);
  paymentForm: PaymentMethod = { brand: 'Visa', last4: '', expiry: '' };

  constructor(
    public subscription: SubscriptionService,
    private customers: CustomerService,
  ) {}

  plan = computed(() => this.subscription.plan());
  statusMeta = computed(() => STATUS_META[this.subscription.state().status]);

  leadsThisMonth = computed(() => {
    const prefix = thisMonthPrefix();
    return this.customers.records().filter((r) => r.date.startsWith(prefix)).length;
  });

  leadUsagePct = computed(() => {
    const limit = this.plan().leadLimit;
    if (!Number.isFinite(limit)) return Math.min(100, this.leadsThisMonth() > 0 ? 8 : 0);
    return Math.min(100, (this.leadsThisMonth() / limit) * 100);
  });

  startEditPayment() {
    const pm = this.subscription.state().paymentMethod;
    this.paymentForm = pm ? { ...pm } : { brand: 'Visa', last4: '', expiry: '' };
    this.editingPayment.set(true);
  }

  savePayment() {
    this.subscription.updatePaymentMethod(this.paymentForm);
    this.editingPayment.set(false);
  }

  doCancel() {
    this.subscription.cancelSubscription();
    this.confirmingCancel.set(false);
  }

  downloadInvoice(inv: Invoice) {
    const lines = [
      'REDLINE DEALERSHIP CRM',
      '-----------------------------',
      `Invoice: ${inv.id}`,
      `Date: ${inv.date}`,
      `Plan: ${inv.planName}`,
      `Amount: ${this.fmt(inv.amount)}`,
      `Status: ${inv.status}`,
      '-----------------------------',
      'Thank you for your business.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
