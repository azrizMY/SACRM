import { formatRM } from './dashboard-data';

export type LoanMode = 'ten-percent' | 'full-loan' | 'custom';

export type CarModel = {
  id: string;
  brand: string;
  model: string;
  price: number;
  /** Minimum net monthly salary a bank typically expects for this tier. */
  minSalary: number;
};

/** Multi-brand catalog spanning entry-level to premium, for a visible gradient. */
export const catalog: CarModel[] = [
  { id: 'axia', brand: 'Perodua', model: 'Axia 1.0', price: 40200, minSalary: 1500 },
  { id: 'saga', brand: 'Proton', model: 'Saga 1.3', price: 41500, minSalary: 1500 },
  { id: 'bezza', brand: 'Perodua', model: 'Bezza 1.3', price: 46800, minSalary: 1800 },
  { id: 'myvi', brand: 'Perodua', model: 'Myvi 1.5', price: 58600, minSalary: 2000 },
  { id: 'ativa', brand: 'Perodua', model: 'Ativa 1.0T', price: 65500, minSalary: 2200 },
  { id: 's70', brand: 'Proton', model: 'S70 Executive', price: 78900, minSalary: 2500 },
  { id: 'vios', brand: 'Toyota', model: 'Vios 1.5', price: 92500, minSalary: 2800 },
  { id: 'city', brand: 'Honda', model: 'City RS', price: 111500, minSalary: 3200 },
  { id: 'x70', brand: 'Proton', model: 'X70 Premium', price: 118000, minSalary: 3300 },
  { id: 'tiggo7phev', brand: 'Chery', model: 'Tiggo 7 PHEV CSH', price: 129800, minSalary: 3400 },
  { id: 'corolla', brand: 'Toyota', model: 'Corolla 1.8', price: 130500, minSalary: 3600 },
  { id: 'omodae5', brand: 'Chery', model: 'Omoda E5', price: 146978, minSalary: 2900 },
  { id: 'hrv', brand: 'Honda', model: 'HR-V e:HEV', price: 148900, minSalary: 4000 },
  { id: 'tiggo8phev', brand: 'Chery', model: 'Tiggo 8 PHEV CSH', price: 159800, minSalary: 4000 },
];

/** Fixed assumptions shown to the consultant. */
export const LOAN_YEARS = 9;
export const FLAT_RATE = 0.035; // 3.5% p.a. flat
export const DSR_LIMIT = 0.35; // max 35% of net salary

export type EligibilityStatus = 'qualified' | 'potential' | 'not-eligible';

export type EligibilityResult = {
  model: CarModel;
  downpayment: number;
  loanAmount: number;
  monthly: number;
  requiredSalary: number;
  status: EligibilityStatus;
};

export function downpaymentFor(price: number, mode: LoanMode, customDp: number): number {
  if (mode === 'ten-percent') return Math.round(price * 0.1);
  if (mode === 'full-loan') return 0;
  return Math.min(Math.max(customDp, 0), price);
}

export function monthlyPayment(loanAmount: number): number {
  const principal = Math.max(loanAmount, 0);
  const totalInterest = principal * FLAT_RATE * LOAN_YEARS;
  const months = LOAN_YEARS * 12;
  return (principal + totalInterest) / months;
}

export function evaluate(
  model: CarModel,
  salary: number,
  mode: LoanMode,
  customDp: number,
): EligibilityResult {
  const downpayment = downpaymentFor(model.price, mode, customDp);
  const loanAmount = model.price - downpayment;
  const monthly = monthlyPayment(loanAmount);
  const limit = salary * DSR_LIMIT;
  const requiredSalary = monthly / DSR_LIMIT;

  let status: EligibilityStatus;
  if (salary < model.minSalary) {
    status = 'not-eligible';
  } else if (monthly <= limit) {
    status = 'qualified';
  } else if (monthly <= limit * 1.2) {
    status = 'potential';
  } else {
    status = 'not-eligible';
  }

  return { model, downpayment, loanAmount, monthly, requiredSalary, status };
}

export function evaluateAll(salary: number, mode: LoanMode, customDp: number): EligibilityResult[] {
  return catalog
    .map((m) => evaluate(m, salary, mode, customDp))
    .sort((a, b) => a.monthly - b.monthly);
}

export const STATUS_META: Record<
  EligibilityStatus,
  { label: string; tone: string; dot: string; blurb: string }
> = {
  qualified: {
    label: 'Qualified',
    tone: 'bg-[var(--success)]/12 text-[var(--success)]',
    dot: 'bg-[var(--success)]',
    blurb: 'Monthly instalment sits within the 35% salary limit.',
  },
  potential: {
    label: 'Potential',
    tone: 'bg-[var(--warning)]/14 text-[var(--warning)]',
    dot: 'bg-[var(--warning)]',
    blurb: 'Salary clears the minimum — worth submitting an application.',
  },
  'not-eligible': {
    label: 'Not Yet',
    tone: 'bg-[var(--destructive)]/12 text-[var(--destructive)]',
    dot: 'bg-[var(--destructive)]',
    blurb: 'Salary is below the minimum requirement for this model.',
  },
};

export function formatMonthly(value: number): string {
  return `${formatRM(Math.round(value))}/mo`;
}

export { formatRM };
