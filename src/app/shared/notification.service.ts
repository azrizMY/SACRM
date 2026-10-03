import { Injectable, computed, inject } from '@angular/core';
import { CustomerService } from './customer.service';
import { SettingsService } from './settings.service';
import { formatRM, vehicleTitle } from '../data/calculator-data';
import { stageEnteredAt } from '../data/customer-data';

export type NotificationKind = 'lead' | 'summary';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  date: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A lead counts as "new" for this many days before it ages out of the panel. */
const NEW_LEAD_WINDOW_DAYS = 3;

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / DAY_MS);
  if (days <= 0) {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    return hours <= 0 ? 'just now' : `${hours}h ago`;
  }
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

/**
 * Real, derived notifications for the topbar bell — no separate read/unread inbox is stored;
 * each category is recomputed live from Customer Manager's records, gated by the same toggles in
 * Account Settings → Notification Preferences. "New lead" alerts count toward the
 * bell's badge; the weekly summary is informational only and never bumps the count.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private customers = inject(CustomerService);
  private settingsService = inject(SettingsService);

  private leadItems = computed<NotificationItem[]>(() => {
    if (!this.settingsService.settings().notifications.newLeadAlerts) return [];
    const cutoff = Date.now() - NEW_LEAD_WINDOW_DAYS * DAY_MS;
    return this.customers
      .leads()
      .filter((r) => r.createdAt >= cutoff)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        id: `lead-${r.id}`,
        kind: 'lead' as const,
        title: `New lead: ${r.name || 'Unnamed'}`,
        detail: `${vehicleTitle(r.brand, r.model)} · ${timeAgo(r.createdAt)}`,
        date: r.createdAt,
      }));
  });

  private summaryItem = computed<NotificationItem | null>(() => {
    if (!this.settingsService.settings().notifications.weeklySummary) return null;
    const cutoff = Date.now() - 7 * DAY_MS;
    const records = this.customers.records();

    const newLeads = records.filter((r) => r.createdAt >= cutoff).length;
    const wonRecords = records.filter((r) => r.status === 'Won' && stageEnteredAt(r, 'Won') >= cutoff);
    const lost = records.filter((r) => r.status === 'Lost' && stageEnteredAt(r, 'Lost') >= cutoff).length;
    const commission = wonRecords.reduce((sum, r) => sum + (r.commission ?? 0), 0);

    return {
      id: 'weekly-summary',
      kind: 'summary',
      title: 'Weekly performance summary',
      detail: `${newLeads} new lead${newLeads === 1 ? '' : 's'} · ${wonRecords.length} won · ${lost} lost · ${formatRM(commission)} commission`,
      date: Date.now(),
    };
  });

  /** Full panel contents, most time-sensitive first. */
  items = computed<NotificationItem[]>(() => {
    const list = [...this.leadItems()];
    const summary = this.summaryItem();
    if (summary) list.push(summary);
    return list;
  });

  /** Drives the bell's badge — only actionable items count, not the weekly digest. */
  urgentCount = computed(() => this.leadItems().length);
}
