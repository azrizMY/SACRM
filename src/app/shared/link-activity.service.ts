import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

export type LinkEvent = {
  link: 'all' | 'brand';
  visit: string;
  type: string;
  car: string | null;
  payload: Record<string, unknown>;
  at: number;
};

/** One visit: a visitor's events with no gap longer than 30 minutes. */
export type LinkVisit = {
  key: string;
  visitor: string;
  link: 'all' | 'brand';
  start: number;
  end: number;
  /** This browser first came on an earlier day — the strongest buying signal. */
  returning: boolean;
  events: LinkEvent[];
};

const VISIT_GAP_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The advisor's quote link activity (Quote Links → Activity), and the count of new visits since they
 * last looked, for the badge on the Quote Links menu item.
 */
@Injectable({ providedIn: 'root' })
export class LinkActivityService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private settings = inject(SettingsService);

  events = signal<LinkEvent[]>([]);
  private firstSeen = signal<Record<string, number>>({});
  loading = signal(false);
  error = signal(false);
  /** New visits since the advisor last opened Quote Links. */
  unseen = signal(0);

  constructor() {
    // Badge: check on sign-in and every few minutes while signed in
    let timer: ReturnType<typeof setInterval> | null = null;
    effect(() => {
      if (timer) clearInterval(timer);
      timer = null;
      if (!this.auth.isAuthenticated()) {
        this.unseen.set(0);
        return;
      }
      // untracked: reading the last-seen time mustn't re-run this when it changes
      untracked(() => void this.refreshUnseen());
      timer = setInterval(() => void this.refreshUnseen(), 5 * 60 * 1000);
    });
  }

  private seenAt(): number {
    return this.settings.settings().onboarding.activitySeenAt ?? 0;
  }

  async refreshUnseen() {
    try {
      const since = this.seenAt() || Date.now() - 7 * DAY_MS;
      const r = await firstValueFrom(this.http.get<{ visits: number }>(`/api/link-events/count?since=${since}`));
      this.unseen.set(r.visits);
    } catch {
      this.unseen.set(0);
    }
  }

  /** Opening Quote Links clears the badge. */
  markSeen() {
    this.unseen.set(0);
    this.settings.updateOnboarding({ activitySeenAt: Date.now() });
  }

  async load(days = 30) {
    this.loading.set(true);
    this.error.set(false);
    try {
      const r = await firstValueFrom(
        this.http.get<{ events: LinkEvent[]; firstSeen: Record<string, number> }>(`/api/link-events?since=${Date.now() - days * DAY_MS}`),
      );
      this.events.set(r.events);
      this.firstSeen.set(r.firstSeen);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  /** Every visit, newest first. */
  visits = computed((): LinkVisit[] => {
    const byVisitor = new Map<string, LinkEvent[]>();
    for (const e of this.events()) byVisitor.set(e.visit, [...(byVisitor.get(e.visit) ?? []), e]);
    const visits: LinkVisit[] = [];
    for (const [visitor, list] of byVisitor) {
      const sorted = [...list].sort((a, b) => a.at - b.at);
      let current: LinkEvent[] = [];
      const push = () => {
        if (!current.length) return;
        const start = current[0].at;
        const dayStart = new Date(start).setHours(0, 0, 0, 0);
        visits.push({
          key: `${visitor}|${start}`,
          visitor,
          link: current[0].link,
          start,
          end: current[current.length - 1].at,
          returning: (this.firstSeen()[visitor] ?? start) < dayStart,
          events: current,
        });
      };
      for (const e of sorted) {
        if (current.length && e.at - current[current.length - 1].at > VISIT_GAP_MS) {
          push();
          current = [];
        }
        current.push(e);
      }
      push();
    }
    return visits.sort((a, b) => b.start - a.start);
  });
}
