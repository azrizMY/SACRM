import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Treat a new version found this soon after launch/resume as "you just opened the app": switch
 *  straight away, before the user has had time to start anything. */
const FRESH_WINDOW_MS = 8_000;
/** Don't re-check on every quick app switch. */
const MIN_CHECK_GAP_MS = 60_000;

/**
 * Gets the installed app (PWA) onto a new deploy quickly. Left alone, the service worker downloads
 * a new version in the background but keeps serving the old one until the next full restart — and
 * iOS rarely truly restarts a home-screen app (swiping away mostly just suspends it), so updates
 * could take several closes and reopens to appear.
 *
 * Instead: check on launch and every time the app returns to the foreground, and once a new version
 * is downloaded, reload into it at a safe moment — right after launch/resume, or the next time the
 * app is brought back — never while someone is typing.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private sw = inject(SwUpdate);
  private ready = false;
  private activeSince = Date.now();
  private lastCheck = 0;

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.subscribe((e) => {
      if (e.type !== 'VERSION_READY') return;
      this.ready = true;
      if (Date.now() - this.activeSince < FRESH_WINDOW_MS) this.applyIfIdle();
    });
    // The cached app is broken beyond repair (e.g. files from an old version were evicted) —
    // a reload fetches everything fresh from the network.
    this.sw.unrecoverable.subscribe(() => location.reload());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.activeSince = Date.now();
      if (this.ready) this.applyIfIdle();
      else this.check();
    });

    this.check();
  }

  private check() {
    const now = Date.now();
    if (now - this.lastCheck < MIN_CHECK_GAP_MS) return;
    this.lastCheck = now;
    this.sw.checkForUpdate().catch(() => {
      /* offline or the server is unreachable — try again on the next resume */
    });
  }

  /** Reloads into the new version unless the user is mid-entry, in which case it waits for the
   *  next time the app comes back to the foreground. */
  private applyIfIdle() {
    const el = document.activeElement;
    const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    // Any open modal/drawer (the app's overlays are all full-screen `fixed inset-0` layers) may hold
    // unsaved input, so wait for a calmer moment.
    if (typing || document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0')) return;
    this.sw
      .activateUpdate()
      .then(() => location.reload())
      .catch(() => location.reload());
  }
}
