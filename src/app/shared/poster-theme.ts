/** Design tokens for the Quote Poster canvas renderer — mirrors the design spec's colour table
 *  exactly. Canvas 2D needs literal colour strings (it can't resolve CSS custom properties like
 *  var(--acc)), so this object is the single source of truth; POSTER_CSS_VARS below is generated
 *  from it for any surrounding DOM chrome that wants to match without duplicating hex by hand. */
export const POSTER_COLORS = {
  acc: '#D61E2A',
  accDark: '#960E1A',
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
} as const;

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
  return Promise.all([
    document.fonts.load(displayFont(16, 700)),
    document.fonts.load(labelFont(14, 400)),
    document.fonts.load(labelFont(14, 700)),
  ]).then(() => undefined);
}
