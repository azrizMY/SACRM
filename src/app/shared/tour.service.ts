import { Injectable, computed, signal } from '@angular/core';

export type TourStep = {
  /** Value of the element's `data-tour` attribute to point at; omit for a centred message. */
  target?: string;
  title: string;
  body: string;
  /** Runs before the step is shown, e.g. switch a mobile tab or open the drawer so the target exists. */
  before?: () => void | Promise<void>;
  /** Skip the step entirely when the target isn't on screen (e.g. an optional button). */
  skipIfMissing?: boolean;
  /** Overrides "Got it" on the last step. */
  doneLabel?: string;
};

type ActiveTour = { id: string; scope: string; steps: TourStep[] };

/** The first visible element carrying this `data-tour` name. A name can exist twice at once (the
 *  desktop sidebar and the mobile drawer both render the nav), and only one of them has a size. */
export function findTourTarget(name: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Guided walkthroughs. A tour is shown once per device (and per account, for signed-in tours):
 * "seen" lives in localStorage. It can be replayed on demand. Rendering is TourOverlayComponent.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private active = signal<ActiveTour | null>(null);
  private indexSignal = signal(0);
  /** A page asks for a replay by name; whichever component owns that tour picks it up. */
  replayRequest = signal<string | null>(null);

  isActive = computed(() => this.active() !== null);
  step = computed(() => this.active()?.steps[this.indexSignal()] ?? null);
  index = this.indexSignal.asReadonly();
  total = computed(() => this.active()?.steps.length ?? 0);
  isLast = computed(() => this.indexSignal() >= this.total() - 1);

  private key(id: string, scope: string): string {
    return `redline:tour:${id}:${scope}`;
  }

  hasSeen(id: string, scope = 'device'): boolean {
    try {
      return localStorage.getItem(this.key(id, scope)) === '1';
    } catch {
      return true; // storage blocked: never nag on every visit
    }
  }

  private markSeen(id: string, scope: string) {
    try {
      localStorage.setItem(this.key(id, scope), '1');
    } catch {
      /* private mode: the tour may show again next visit, which is harmless */
    }
  }

  async start(id: string, steps: TourStep[], scope = 'device'): Promise<void> {
    if (this.active() || steps.length === 0) return;
    this.active.set({ id, scope, steps });
    await this.goTo(0, 1);
  }

  next() {
    if (this.isLast()) this.finish();
    else void this.goTo(this.indexSignal() + 1, 1);
  }

  back() {
    if (this.indexSignal() > 0) void this.goTo(this.indexSignal() - 1, -1);
  }

  finish() {
    const tour = this.active();
    if (!tour) return;
    this.markSeen(tour.id, tour.scope);
    this.active.set(null);
    this.indexSignal.set(0);
  }

  private async goTo(index: number, direction: 1 | -1): Promise<void> {
    const tour = this.active();
    if (!tour) return;
    if (index < 0 || index >= tour.steps.length) {
      if (direction === 1) this.finish();
      return;
    }
    const step = tour.steps[index];
    try {
      await step.before?.();
    } catch {
      /* a failed prep step just means the target may be missing, handled below */
    }
    // Give the page a moment to render whatever `before` changed.
    await new Promise((resolve) => setTimeout(resolve, 260));
    if (this.active() !== tour) return;
    if (step.target && step.skipIfMissing && !findTourTarget(step.target)) {
      await this.goTo(index + direction, direction);
      return;
    }
    this.indexSignal.set(index);
  }
}
