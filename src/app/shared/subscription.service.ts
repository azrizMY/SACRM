import { Injectable, computed, signal } from '@angular/core';
import {
  DEFAULT_SUBSCRIPTION,
  PLANS,
  type Invoice,
  type PaymentMethod,
  type PlanId,
  type SubscriptionState,
} from '../data/billing-data';

const STORAGE_KEY = 'redline-subscription';

function loadState(): SubscriptionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SUBSCRIPTION, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt/unavailable storage, fall back to default */
  }
  return DEFAULT_SUBSCRIPTION;
}

function invoiceId(existing: Invoice[]): string {
  const max = existing.reduce((m, inv) => Math.max(m, Number(inv.id.split('-')[1]) || 0), 1000);
  return `INV-${max + 1}`;
}

/** Local simulation of a SaaS subscription — plan, payment method and invoice history, persisted to this browser. */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  state = signal<SubscriptionState>(loadState());

  plan = computed(() => PLANS.find((p) => p.id === this.state().planId) ?? PLANS[1]);

  changePlan(planId: PlanId) {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || plan.id === this.state().planId) return;
    const invoice: Invoice = {
      id: invoiceId(this.state().invoices),
      date: new Date().toISOString().slice(0, 10),
      planName: plan.name,
      amount: plan.price,
      status: 'Paid',
    };
    this.persist({ ...this.state(), planId: plan.id, status: 'active', invoices: [invoice, ...this.state().invoices] });
  }

  updatePaymentMethod(method: PaymentMethod) {
    this.persist({ ...this.state(), paymentMethod: method });
  }

  cancelSubscription() {
    this.persist({ ...this.state(), status: 'canceled' });
  }

  resumeSubscription() {
    this.persist({ ...this.state(), status: 'active' });
  }

  private persist(next: SubscriptionState) {
    this.state.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage unavailable — state still holds for this session */
    }
  }
}
