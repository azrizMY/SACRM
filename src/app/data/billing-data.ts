export type PlanId = 'starter' | 'pro' | 'team';

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  seatLimit: number;
  leadLimit: number;
  blurb: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    seatLimit: 1,
    leadLimit: 25,
    blurb: 'Get moving with the basics.',
    features: ['1 consultant seat', '25 leads / month', 'Quotation Calculator', 'My Cars brochures'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 89,
    seatLimit: 3,
    leadLimit: 200,
    blurb: 'For consultants running a full pipeline.',
    features: ['3 consultant seats', '200 leads / month', 'Customer Manager pipeline', 'Cost Breakdown & profit tracking', 'Priority support'],
  },
  {
    id: 'team',
    name: 'Team',
    price: 249,
    seatLimit: 10,
    leadLimit: Infinity,
    blurb: 'For dealership floors and sales teams.',
    features: ['10 consultant seats', 'Unlimited leads', 'Everything in Pro', 'Team performance rollups', 'Dedicated onboarding'],
  },
];

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export type InvoiceStatus = 'Paid' | 'Pending' | 'Failed';

export type Invoice = {
  id: string;
  date: string;
  planName: string;
  amount: number;
  status: InvoiceStatus;
};

export type PaymentMethod = {
  brand: string;
  last4: string;
  expiry: string;
};

export type SubscriptionState = {
  planId: PlanId;
  status: SubscriptionStatus;
  renewsOn: string;
  paymentMethod: PaymentMethod | null;
  invoices: Invoice[];
};

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function monthsAhead(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  planId: 'pro',
  status: 'active',
  renewsOn: monthsAhead(1),
  paymentMethod: { brand: 'Visa', last4: '4242', expiry: '09/28' },
  invoices: [
    { id: 'INV-1003', date: monthsAgo(0), planName: 'Pro', amount: 89, status: 'Paid' },
    { id: 'INV-1002', date: monthsAgo(1), planName: 'Pro', amount: 89, status: 'Paid' },
    { id: 'INV-1001', date: monthsAgo(2), planName: 'Starter', amount: 0, status: 'Paid' },
  ],
};

export const STATUS_META: Record<SubscriptionStatus, { label: string; tone: string; dot: string }> = {
  active: { label: 'Active', tone: 'bg-[var(--success)]/12 text-[var(--success)]', dot: 'bg-[var(--success)]' },
  trialing: { label: 'Trial', tone: 'bg-[var(--chart-4)]/15 text-[var(--chart-4)]', dot: 'bg-[var(--chart-4)]' },
  past_due: { label: 'Past Due', tone: 'bg-[var(--warning)]/14 text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
  canceled: { label: 'Canceled', tone: 'bg-[var(--destructive)]/12 text-[var(--destructive)]', dot: 'bg-[var(--destructive)]' },
};

export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; tone: string; dot: string }> = {
  Paid: { label: 'Paid', tone: 'bg-[var(--success)]/12 text-[var(--success)]', dot: 'bg-[var(--success)]' },
  Pending: { label: 'Pending', tone: 'bg-[var(--warning)]/14 text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
  Failed: { label: 'Failed', tone: 'bg-[var(--destructive)]/12 text-[var(--destructive)]', dot: 'bg-[var(--destructive)]' },
};
