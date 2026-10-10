/**
 * Sends what a visitor does on a quote link to the advisor's Activity feed, in small batches.
 * Anonymous: a random visitor id kept in this browser (so a return visit on another day shows as
 * "Returning visitor"), plus which cars and quotes were looked at — never a name, number or IC.
 * The server ignores the advisor's own visits. Failures are silent; this must never get in the
 * customer's way.
 */
export type LinkEventType =
  | 'link_opened'
  | 'car_viewed'
  | 'quote_built'
  | 'poster_saved'
  | 'brochure_opened'
  | 'compare_used'
  | 'budget_used'
  | 'whatsapp_tapped'
  | 'test_drive_tapped'
  | 'trade_in';

type QueuedEvent = { type: LinkEventType; car?: string; payload?: Record<string, unknown>; at: number };

const VISITOR_KEY = 'redline-visitor';

function visitorId(): string {
  const fresh = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved && /^[A-Za-z0-9._-]{1,80}$/.test(saved)) return saved;
    const id = fresh();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}

export class LinkActivityRecorder {
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly visitId = visitorId();
  private readonly url: string;

  constructor(
    token: string,
    private readonly linkId: 'all' | 'brand',
  ) {
    this.url = `/api/public/events/${encodeURIComponent(token)}`;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true);
    });
  }

  record(type: LinkEventType, car?: string | null, payload?: Record<string, unknown>) {
    this.queue.push({ type, car: car ?? undefined, payload, at: Date.now() });
    if (this.queue.length >= 20) this.flush();
    else if (!this.timer) this.timer = setTimeout(() => this.flush(), 3000);
  }

  /** Sends what's queued; on the way out of the page, as a beacon so it isn't cut off. */
  flush(leaving = false) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.queue.length) return;
    const body = JSON.stringify({ visitId: this.visitId, linkId: this.linkId, events: this.queue.splice(0, 25) });
    try {
      if (leaving && navigator.sendBeacon?.(this.url, new Blob([body], { type: 'application/json' }))) return;
      fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' }).catch(() => undefined);
    } catch {
      // never let activity tracking break the page
    }
    if (this.queue.length) this.timer = setTimeout(() => this.flush(), 1000);
  }
}
