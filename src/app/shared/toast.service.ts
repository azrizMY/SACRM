import { Injectable, signal } from '@angular/core';

export type Toast = { id: number; message: string; actionLabel?: string; action?: () => void };

/**
 * Short confirmations at the bottom of the screen, with an optional action (usually Undo). Quick
 * actions like Mark as Won happen straight away and offer Undo here, instead of asking
 * "are you sure?" first — one tap for the common case, still safe for a mis-tap.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, opts: { actionLabel?: string; action?: () => void; durationMs?: number } = {}): void {
    const toast: Toast = { id: this.nextId++, message, actionLabel: opts.actionLabel, action: opts.action };
    // One at a time — a new action replaces the last one's Undo rather than stacking up.
    this.toasts.set([toast]);
    setTimeout(() => this.dismiss(toast.id), opts.durationMs ?? (opts.action ? 6000 : 3000));
  }

  /** Shorthand for an action that can be reversed. */
  undoable(message: string, undo: () => void): void {
    this.show(message, { actionLabel: 'Undo', action: undo });
  }

  run(toast: Toast): void {
    toast.action?.();
    this.dismiss(toast.id);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
