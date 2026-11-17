import { DEFAULT_POSTER_ACCENT, posterAccent } from './poster-theme';

/** Where the last colour is kept, so public/theme-init.js can paint it before the app starts. */
const STORAGE_KEY = 'redline-colour';

/**
 * One colour for everything (Settings → Appearance → Colour): the poster colour also drives the
 * app's buttons, menu highlight and figures. Sets the --acc-* tokens styles.css builds on:
 * `acc` is the fill (white text sits on it), `accDark` the colour as text on light screens,
 * `accBright` the colour as text on dark screens.
 */
export function applyAppColour(id: string | null | undefined): void {
  if (typeof document === 'undefined') return;
  const a = posterAccent(id);
  const style = document.documentElement.style;
  style.setProperty('--acc-fill', a.acc);
  style.setProperty('--acc-on', '#ffffff');
  style.setProperty('--acc-ink-light', a.accDark);
  style.setProperty('--acc-ink-dark', a.accBright);
  try {
    if (!id || id === DEFAULT_POSTER_ACCENT) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ fill: a.acc, light: a.accDark, dark: a.accBright }));
  } catch {
    /* private mode: the colour still applies once the app has loaded */
  }
}
