import { Injectable, computed, signal } from '@angular/core';

/** Chrome/Edge/Samsung Internet's deferred install prompt (not in lib.dom yet). */
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'redline.install-banner-dismissed';
/** How long "Not now" hides the banner before offering again. */
const DISMISS_DAYS = 14;

/**
 * "Install Redline" as a home-screen app (PWA). Android/desktop Chrome hand us a prompt we can
 * trigger from our own button; iOS Safari has no such API, so there we can only show the
 * Share → Add to Home Screen steps. Constructed at startup by AppComponent — the browser fires
 * beforeinstallprompt once, early, and a lazily created listener would miss it.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred = signal<BeforeInstallPromptEvent | null>(null);
  private dismissedAt = signal(readDismissedAt());

  readonly installed = signal(isStandalone());
  /** iPhone/iPad Safari, where install is manual. (Chrome on iOS can't install at all.) */
  readonly isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

  /** Something useful can be offered: a real prompt, or iOS steps. */
  readonly available = computed(() => !this.installed() && (this.deferred() !== null || this.isIos));
  readonly canPrompt = computed(() => this.deferred() !== null);
  readonly showBanner = computed(() => this.available() && Date.now() - this.dismissedAt() > DISMISS_DAYS * 86_400_000);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // we show our own banner instead of Chrome's mini-infobar
      this.deferred.set(e as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () => {
      this.installed.set(true);
      this.deferred.set(null);
    });
  }

  /** Opens the browser's install dialog. Resolves true if the user accepted. */
  async install(): Promise<boolean> {
    const e = this.deferred();
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.deferred.set(null); // a prompt event can only be used once
    return outcome === 'accepted';
  }

  /** Brings a dismissed banner back (the user menu's "Install app" on iOS, where it holds the steps). */
  reopenBanner() {
    this.dismissedAt.set(0);
    try {
      localStorage.removeItem(DISMISS_KEY);
    } catch {}
  }

  dismissBanner() {
    const now = Date.now();
    this.dismissedAt.set(now);
    try {
      localStorage.setItem(DISMISS_KEY, String(now));
    } catch {}
  }
}

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

function readDismissedAt(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY)) || 0;
  } catch {
    return 0;
  }
}
