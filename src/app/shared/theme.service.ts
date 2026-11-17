import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { applyAppColour } from './app-colour';
import { SettingsService } from './settings.service';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'redline-theme';
/** The browser/status bar colour for each theme — matches the shell (--sidebar) in styles.css. */
const THEME_COLOR = { dark: '#0a0a0a', light: '#f6f6f8' };

/**
 * Dark / light / follow-the-device. Dark (Redline's own look) is the default. The choice lives on this device (it has to be read before the app even starts —
 * see public/theme-init.js, which applies it first so there's no flash). The Live Screen and
 * posters keep their own fixed colours whichever theme is on.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  private systemLight = signal(this.media?.matches ?? false);

  mode = signal<ThemeMode>(this.readMode());
  /** What's actually showing right now. */
  resolved = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    return mode === 'system' ? (this.systemLight() ? 'light' : 'dark') : mode;
  });

  private settings = inject(SettingsService);

  constructor() {
    // The account's one colour (Settings → Appearance → Colour) also colours the app.
    effect(() => applyAppColour(this.settings.settings().salesDefaults.posterAccent));
    this.media?.addEventListener('change', (e) => {
      this.systemLight.set(e.matches);
      this.apply();
    });
    this.apply();
  }

  setMode(mode: ThemeMode) {
    this.mode.set(mode);
    try {
      if (mode === 'dark') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* private mode etc. — the choice still applies for this visit */
    }
    this.apply();
  }

  private readMode(): ThemeMode {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'light' || saved === 'system' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  }

  private apply() {
    const theme = this.resolved();
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }
}
