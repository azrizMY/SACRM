import { dealProfit, stageEnteredAt, totalCostSpent, type CustomerRecord, type CustomerStatus } from './customer-data';
import { toLocalDateStr } from '../shared/date-utils';

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toLocalDateStr(d);
}

/** Inclusive date window, expressed in "days ago" so it never has a calendar-boundary cliff. */
function inWindow(dateStr: string | undefined, startDaysAgo: number, endDaysAgo: number): boolean {
  if (!dateStr) return false;
  return dateStr >= daysAgoStr(startDaysAgo) && dateStr <= daysAgoStr(endDaysAgo);
}

const PERIOD_DAYS = 30;

/** Every Delivered deal on record as of `daysAgo` days ago — the running lifetime total at that point in time. */
function deliveredAsOf(records: CustomerRecord[], daysAgo: number): CustomerRecord[] {
  const cutoff = daysAgoStr(daysAgo);
  return records.filter((r) => r.status === 'Delivered' && (r.deliveryDate ?? r.date) <= cutoff);
}

export function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export type PeriodStat = { value: number; changePct: number; trend: 'up' | 'down' };

/**
 * These are lifetime totals (every Delivered deal ever, not just "this month") — the KPI
 * cards are literally labeled "Total ...", so the headline number has to match. The
 * changePct/trend badge still compares against the running total 30 days ago, which reads
 * as "how much has the total grown recently" rather than a this-month-only figure.
 */
export function unitsSoldTotal(records: CustomerRecord[]): PeriodStat {
  const curr = deliveredAsOf(records, 0).length;
  const prev = deliveredAsOf(records, PERIOD_DAYS).length;
  return { value: curr, changePct: Math.abs(pctChange(curr, prev)), trend: curr >= prev ? 'up' : 'down' };
}

/** Net profit — every delivered deal's commission summed together. */
export function profitTotal(records: CustomerRecord[]): PeriodStat {
  const sum = (daysAgo: number) => deliveredAsOf(records, daysAgo).reduce((s, r) => s + dealProfit(r), 0);
  const curr = sum(0);
  const prev = sum(PERIOD_DAYS);
  return { value: curr, changePct: Math.abs(pctChange(curr, prev)), trend: curr >= prev ? 'up' : 'down' };
}

/** Total spend on free gifts/extras across every delivered deal — a plain spend tracker, not a "loss" (a deal never sells at a loss). */
export function costSpentTotal(records: CustomerRecord[]): PeriodStat {
  const sum = (daysAgo: number) => deliveredAsOf(records, daysAgo).reduce((s, r) => s + totalCostSpent(r), 0);
  const curr = sum(0);
  const prev = sum(PERIOD_DAYS);
  // Less spend is the improvement, so trend flips (same convention as the KPI cards' other cost-style stats).
  return { value: curr, changePct: Math.abs(pctChange(curr, prev)), trend: curr <= prev ? 'down' : 'up' };
}

export function commissionEarnedTotal(records: CustomerRecord[]): number {
  return deliveredAsOf(records, 0).reduce((s, r) => s + (r.commission ?? 0), 0);
}

export type LeadsPipelineStat = PeriodStat & { hotThisWeek: number };

export function leadsPipelineStat(records: CustomerRecord[]): LeadsPipelineStat {
  const thisWeek = records.filter((r) => inWindow(r.date, 7, 0)).length;
  const lastWeek = records.filter((r) => inWindow(r.date, 14, 8)).length;
  const value = records.filter((r) => r.status === 'Lead').length;
  return {
    value,
    changePct: Math.abs(pctChange(thisWeek, lastWeek)),
    trend: thisWeek >= lastWeek ? 'up' : 'down',
    hotThisWeek: thisWeek,
  };
}

export type CommissionTrendPoint = { month: string; commission: number };

/** Calendar-month buckets — appropriate here since the chart shows discrete month labels. */
export function monthlyCommissionTrend(records: CustomerRecord[], months = 12): CommissionTrendPoint[] {
  const points: CommissionTrendPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toLocalDateStr(bucket).slice(0, 7);
    const commission = records
      .filter((r) => r.status === 'Delivered' && r.commission !== undefined && (r.deliveryDate ?? r.date).startsWith(key))
      .reduce((s, r) => s + dealProfit(r), 0);
    points.push({ month: bucket.toLocaleDateString('en-MY', { month: 'short' }), commission });
  }
  return points;
}

export type CostTrendPoint = { month: string; cost: number };

/** Same calendar-month buckets as monthlyCommissionTrend, so the KPI sparkline and Commission trend chart line up month-for-month. */
export function monthlyCostSpentTrend(records: CustomerRecord[], months = 12): CostTrendPoint[] {
  const points: CostTrendPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toLocalDateStr(bucket).slice(0, 7);
    const cost = records
      .filter((r) => r.status === 'Delivered' && (r.deliveryDate ?? r.date).startsWith(key))
      .reduce((s, r) => s + totalCostSpent(r), 0);
    points.push({ month: bucket.toLocaleDateString('en-MY', { month: 'short' }), cost });
  }
  return points;
}

export type UnitsTrendPoint = { month: string; units: number };

/** Same calendar-month buckets as monthlyCommissionTrend, so the two trend charts line up month-for-month. */
export function monthlyUnitsSoldTrend(records: CustomerRecord[], months = 12): UnitsTrendPoint[] {
  const points: UnitsTrendPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toLocalDateStr(bucket).slice(0, 7);
    const units = records.filter((r) => r.status === 'Delivered' && (r.deliveryDate ?? r.date).startsWith(key)).length;
    points.push({ month: bucket.toLocaleDateString('en-MY', { month: 'short' }), units });
  }
  return points;
}

/** New leads captured per month, regardless of their current pipeline status — a volume/momentum trend, not a snapshot. */
export function monthlyLeadsCreatedTrend(records: CustomerRecord[], months = 12): UnitsTrendPoint[] {
  const points: UnitsTrendPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toLocalDateStr(bucket).slice(0, 7);
    const units = records.filter((r) => r.date.startsWith(key)).length;
    points.push({ month: bucket.toLocaleDateString('en-MY', { month: 'short' }), units });
  }
  return points;
}

export type PipelineTrendPoint = { month: string; lead: number; booked: number; inProgress: number; delivered: number };

/** A record counts toward a stage the month it most recently entered that stage (per stageEnteredAt),
 *  regardless of where it sits now — so a since-Cancelled deal still shows up in the months it was a
 *  Lead/Booked/In Progress. Lead always counts (creation = entering the pipeline); the later stages
 *  only count once the activity log shows the record actually reached them. */
export function monthlyPipelineTrend(records: CustomerRecord[], months = 12): PipelineTrendPoint[] {
  const points: PipelineTrendPoint[] = [];
  const now = new Date();
  const stages: CustomerStatus[] = ['Lead', 'Booked', 'In Progress', 'Delivered'];
  const entered = records.map((r) =>
    Object.fromEntries(
      stages.map((stage) => [stage, hasEnteredStage(r, stage) ? toLocalDateStr(new Date(stageEnteredAt(r, stage))).slice(0, 7) : null]),
    ) as Record<CustomerStatus, string | null>,
  );
  for (let i = months - 1; i >= 0; i--) {
    const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toLocalDateStr(bucket).slice(0, 7);
    const countFor = (stage: CustomerStatus) => entered.filter((e) => e[stage] === key).length;
    points.push({
      month: bucket.toLocaleDateString('en-MY', { month: 'short' }),
      lead: countFor('Lead'),
      booked: countFor('Booked'),
      inProgress: countFor('In Progress'),
      delivered: countFor('Delivered'),
    });
  }
  return points;
}

function hasEnteredStage(r: CustomerRecord, stage: CustomerStatus): boolean {
  if (stage === 'Lead') return true;
  return (r.activity ?? []).some((e) => e.message.includes(`→ ${stage}`));
}

export type ModelPerf = { model: string; brand: string; unitsMonth: number; unitsYear: number };

export function modelPerfForBrand(records: CustomerRecord[], brand: string): ModelPerf[] {
  const map = new Map<string, ModelPerf>();
  for (const r of records) {
    if (r.status !== 'Delivered' || r.brand !== brand) continue;
    const dateStr = r.deliveryDate ?? r.date;
    if (!map.has(r.model)) map.set(r.model, { model: r.model, brand, unitsMonth: 0, unitsYear: 0 });
    const entry = map.get(r.model)!;
    if (inWindow(dateStr, PERIOD_DAYS, 0)) entry.unitsMonth += 1;
    if (inWindow(dateStr, 365, 0)) entry.unitsYear += 1;
  }
  return Array.from(map.values());
}

export type ModelRank = { model: string; brand: string; units: number };

export function topModelsByUnits(records: CustomerRecord[], limit = 5): ModelRank[] {
  const map = new Map<string, ModelRank>();
  for (const r of records) {
    if (r.status !== 'Delivered' || !inWindow(r.deliveryDate ?? r.date, PERIOD_DAYS, 0)) continue;
    const key = `${r.brand}::${r.model}`;
    if (!map.has(key)) map.set(key, { model: r.model, brand: r.brand, units: 0 });
    map.get(key)!.units += 1;
  }
  return Array.from(map.values())
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}

export function statusBreakdown(records: CustomerRecord[]): { status: CustomerStatus; count: number }[] {
  const statuses: CustomerStatus[] = ['Lead', 'Booked', 'In Progress', 'Delivered', 'Cancelled'];
  return statuses.map((status) => ({ status, count: records.filter((r) => r.status === status).length }));
}
