import { Injectable, signal } from '@angular/core';
import type { IconName } from './icon.component';

/** Every page a signed-in user can open from the menu, in the default order. */
export type PageId = 'calculator' | 'compare' | 'budget' | 'live' | 'links' | 'cars' | 'price-settings' | 'profile' | 'settings';

export const PAGES: { id: PageId; label: string; short: string; icon: IconName; hint: string }[] = [
  { id: 'calculator', label: 'Calculator', short: 'Quote', icon: 'calculator', hint: 'Make a quote and its poster' },
  { id: 'budget', label: 'Budget', short: 'Budget', icon: 'wallet', hint: 'Find cars that fit a monthly payment' },
  { id: 'compare', label: 'Compare', short: 'Compare', icon: 'table', hint: 'Put up to 3 cars side by side' },
  { id: 'links', label: 'Quote Links', short: 'Links', icon: 'share', hint: 'A link or QR your customer can use' },
  { id: 'live', label: 'Live Mode', short: 'Live', icon: 'live', hint: 'A big quote screen for TikTok Live' },
  { id: 'cars', label: 'Catalog', short: 'Catalog', icon: 'car', hint: 'Brochures and offers to send' },
  { id: 'price-settings', label: 'Price Settings', short: 'Prices', icon: 'tag', hint: 'Your prices, rates and quote defaults' },
  { id: 'profile', label: 'My Profile', short: 'Profile', icon: 'user', hint: 'Your details and the brands you sell' },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: 'settings', hint: 'Look, language and account' },
];

/** The main menu (the rail on a computer, the "More" sheet on a phone). Profile and Settings sit
 *  below it, with the account. */
export const MENU_PAGES: PageId[] = ['calculator', 'budget', 'compare', 'links', 'live', 'cars', 'price-settings'];


export type Density = 'comfortable' | 'compact';

const START_PAGES: PageId[] = MENU_PAGES;

const KEYS = { density: 'redline-density', motion: 'redline-motion', start: 'redline-start' };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice still applies for this visit */
  }
}

/** The page that opens first, straight from storage — the router asks before any service exists. */
export function savedStartPage(): PageId {
  const saved = read(KEYS.start) as PageId | null;
  return saved && START_PAGES.includes(saved) ? saved : 'calculator';
}

/**
 * "Make it yours" (Settings): how roomy the layout is, motion, and which page opens first. (The
 * colour is the account's one Colour, applied by ThemeService.) All optional, all saved on this
 * device like the light/dark choice — public/theme-init.js applies the look before the app starts.
 */
@Injectable({ providedIn: 'root' })
export class UiPrefsService {
  density = signal<Density>(read(KEYS.density) === 'compact' ? 'compact' : 'comfortable');
  reduceMotion = signal<boolean>(read(KEYS.motion) === 'reduce');
  startPage = signal<PageId>(savedStartPage());

  constructor() {
    this.apply();
  }

  setDensity(density: Density) {
    this.density.set(density);
    write(KEYS.density, density === 'compact' ? 'compact' : null);
    this.apply();
  }

  setReduceMotion(on: boolean) {
    this.reduceMotion.set(on);
    write(KEYS.motion, on ? 'reduce' : null);
    this.apply();
  }

  setStartPage(id: PageId) {
    this.startPage.set(id);
    write(KEYS.start, id === 'calculator' ? null : id);
  }

  /** Back to how the app ships. */
  reset() {
    this.setDensity('comfortable');
    this.setReduceMotion(false);
    this.setStartPage('calculator');
  }

  private apply() {
    const root = document.documentElement;
    root.classList.toggle('density-compact', this.density() === 'compact');
    root.classList.toggle('reduce-motion', this.reduceMotion());
  }
}
