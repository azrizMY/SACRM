/** Design tokens for the Quote Poster canvas renderer — mirrors the design spec's colour table
 *  exactly. Canvas 2D needs literal colour strings (it can't resolve CSS custom properties like
 *  var(--acc)), so this object is the single source of truth; POSTER_CSS_VARS below is generated
 *  from it for any surrounding DOM chrome that wants to match without duplicating hex by hand. */
/** The advisor's poster colour (Settings → Poster colour). Each one is a tuned set, not just a
 *  hue: `acc` carries white text (bars, the LOWEST row, the year tag) and accents on white paper;
 *  `accDark` is its gradient partner; `accBright` is for text and thin lines drawn straight on the
 *  dark price panels, where a deep colour like navy would disappear. */
export const POSTER_ACCENTS = {
  red: { label: 'Redline red', acc: '#D61E2A', accDark: '#960E1A', accBright: '#E6303F' },
  blue: { label: 'Royal blue', acc: '#1D5FD6', accDark: '#123E91', accBright: '#5B95F7' },
  navy: { label: 'Navy', acc: '#1F3F7A', accDark: '#122650', accBright: '#7FA6E8' },
  teal: { label: 'Teal', acc: '#0E7C86', accDark: '#08545B', accBright: '#3FC6CF' },
  orange: { label: 'Orange', acc: '#E0550B', accDark: '#9E3A06', accBright: '#FF8A3D' },
  purple: { label: 'Purple', acc: '#6D3FD4', accDark: '#47278F', accBright: '#A98BF7' },
  magenta: { label: 'Magenta', acc: '#C2185B', accDark: '#880E4F', accBright: '#F06292' },
  gold: { label: 'Gold', acc: '#B37A12', accDark: '#7A520A', accBright: '#E8B54D' },
} as const;

export type PosterAccentId = keyof typeof POSTER_ACCENTS;
export const DEFAULT_POSTER_ACCENT: PosterAccentId = 'red';

export function posterAccent(id: string | null | undefined) {
  return POSTER_ACCENTS[(id ?? '') as PosterAccentId] ?? POSTER_ACCENTS[DEFAULT_POSTER_ACCENT];
}

/** Points the poster palette at the advisor's colour. Every poster renderer calls this first with
 *  the accent in its data, so whichever page draws it (Calculator, Offers, Compare, the customer
 *  link) the poster comes out in the same colour. */
export function usePosterAccent(id: string | null | undefined): void {
  const a = posterAccent(id);
  POSTER_COLORS.acc = a.acc;
  POSTER_COLORS.accDark = a.accDark;
  POSTER_COLORS.accBright = a.accBright;
}

export const POSTER_COLORS = {
  acc: '#D61E2A' as string,
  accDark: '#960E1A' as string,
  accBright: '#E6303F' as string,
  paper: '#FFFFFF',
  ink: '#121214',
  gray: '#707078',
  grayD: '#9898A0',
  panelA: '#151519',
  panelB: '#0C0C0F',
  panelCard: '#2C2C32',
  panelGray: '#9E9EA8',
  panelGrayD: '#767680',
  dataBg: '#101013',
  hairline: '#26262C',
  block: '#1E1E23',
  blockTotal: '#0D0D10',
  partition: '#36363D',
  green: '#34C77B',
  amber: '#F0B040',
  waGreen: '#25D366',
  footerA: '#0D0D10',
  footerB: '#08080A',
};

function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/** e.g. "--acc: #D61E2A; --acc-dark: #960E1A; ..." — drop into a :host style block. */
export const POSTER_CSS_VARS = Object.entries(POSTER_COLORS)
  .map(([key, value]) => `--${toKebab(key)}: ${value};`)
  .join(' ');

/** Two type families only, per spec: a condensed grotesque at weight 700 for every headline,
 *  currency figure, name, and CTA ("Display"), and a neutral sans for row labels and small-caps
 *  labels ("Label"). Both load from Google Fonts — see index.html. */
export const POSTER_FONTS = {
  display: `'Barlow Semi Condensed', 'Roboto Condensed', sans-serif`,
  label: `'Inter', Arial, Helvetica, sans-serif`,
} as const;

/** Canvas ctx.font strings — always specify weight explicitly since the spec calls out 700 vs 400
 *  per element, never relying on a family default. */
export function displayFont(px: number, weight: 400 | 700 = 700): string {
  return `${weight} ${px}px ${POSTER_FONTS.display}`;
}

export function labelFont(px: number, weight: 400 | 700 = 400): string {
  return `${weight} ${px}px ${POSTER_FONTS.label}`;
}

/** Resolves once fonts.google.com's Barlow Semi Condensed + Inter files are actually parsed and
 *  ready to paint — drawing to canvas before this resolves silently falls back to a system font
 *  for that first frame, with no error, so every draw must await this first. */
export function posterFontsReady(): Promise<void> {
  return loadPosterFontCss().then(() =>
    Promise.all([
      document.fonts.load(displayFont(16, 700)),
      document.fonts.load(labelFont(14, 400)),
      document.fonts.load(labelFont(14, 700)),
    ]).then(() => undefined),
  );
}

const POSTER_FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@700&family=Inter:wght@400;700&display=swap';
let posterFontCss: Promise<void> | null = null;

/** Only posters use these fonts, so their stylesheet is added on first use rather than in
 *  index.html, where it would hold up the first paint of every page. A failed load (offline)
 *  resolves anyway — the draw then falls back to the system font like before. */
function loadPosterFontCss(): Promise<void> {
  posterFontCss ??= new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = POSTER_FONT_CSS;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return posterFontCss;
}
