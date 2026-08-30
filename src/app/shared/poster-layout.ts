/** Poster canvas geometry — the fixed 900-wide design grid from the spec, plus the one piece of
 *  layout that's actually dynamic: the optional "What's Included" chips, which push the data
 *  section (and therefore the footer, and therefore the whole poster) down by however much room
 *  they need. Every other band is a fixed height at a fixed offset — full-bleed bands (price
 *  panel, data section, footer) simply span x=0..POSTER_WIDTH; the header and car hero also span
 *  the full width but sit on --paper rather than a full-bleed colour change.
 *
 *  Nothing here draws anything — this only answers "where does each band start and end", so the
 *  drawing stages (header, hero, panel, data, footer, inclusions) and the canvas's own height can
 *  both read from one computation instead of duplicating the arithmetic. */

export const POSTER_WIDTH = 900;
export const MARGIN = 56;

const HEADER_HEIGHT = 168;
const CAR_HERO_HEIGHT = 298;
const PANEL_TOP = 492;
const PANEL_HEIGHT = 250;
const DATA_SECTION_HEIGHT = 306;
const FOOTER_HEIGHT = 120;

/** Data-section content (section labels, table, tenure cards) always sits this far below wherever
 *  the data section itself starts — fixed whether or not inclusions pushed that start down. */
const DATA_SECTION_LABEL_OFFSET = 46;

export const CHIP_HEIGHT = 40;
export const CHIP_GAP = 10;
export const CHIP_NOTCH = 14;
export const CHIP_PADDING_X = 18;
/** Check-mark glyph width + its gap to the label text, baked into each chip's measured width. */
export const CHIP_ICON_AND_GAP = 24;

export type PosterLayout = {
  headerTop: number;
  headerHeight: number;
  carHeroTop: number;
  carHeroHeight: number;
  panelTop: number;
  panelHeight: number;
  panelBottom: number;
  hasOffers: boolean;
  /** Offer labels already wrapped into rows that fit within POSTER_WIDTH - 2*MARGIN. */
  offerRows: string[][];
  inclusionsLabelY: number;
  inclusionsChipsTop: number;
  dataSectionTop: number;
  dataSectionHeight: number;
  dataLabelY: number;
  footerTop: number;
  footerHeight: number;
  /** Design-pixel height of the whole poster — derived, never fixed, per the spec's rule 5. */
  totalHeight: number;
};

/** Greedily packs offer labels into rows the same way inline-flex-wrap chips would: keep adding
 *  to the current row until the next chip would overflow maxWidth, then start a new row. Measures
 *  each label's actual rendered width via the canvas context (already set to the chip's label
 *  font by the caller) rather than guessing — a long item and a short item pack differently, and
 *  only real measurement gets that right. */
function wrapOfferChips(ctx: CanvasRenderingContext2D, items: string[], maxWidth: number): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentRowWidth = 0;
  for (const item of items) {
    const chipWidth = ctx.measureText(item).width + CHIP_PADDING_X * 2 + CHIP_ICON_AND_GAP;
    const widthIfAdded = currentRow.length === 0 ? chipWidth : currentRowWidth + CHIP_GAP + chipWidth;
    if (currentRow.length > 0 && widthIfAdded > maxWidth) {
      rows.push(currentRow);
      currentRow = [item];
      currentRowWidth = chipWidth;
    } else {
      currentRow.push(item);
      currentRowWidth = widthIfAdded;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

/** Computes every band's position for this specific poster — pass a context already sized to the
 *  poster canvas (for accurate text measurement) and the chip label font (Label 400 13px, per
 *  spec) that offer chips render in. */
export function computePosterLayout(ctx: CanvasRenderingContext2D, offers: string[], offerChipFont: string): PosterLayout {
  const headerTop = 0;
  const headerHeight = HEADER_HEIGHT;
  const carHeroTop = headerHeight;
  const carHeroHeight = CAR_HERO_HEIGHT;
  const panelTop = PANEL_TOP;
  const panelHeight = PANEL_HEIGHT;
  const panelBottom = panelTop + panelHeight;

  ctx.font = offerChipFont;
  const offerRows = offers.length > 0 ? wrapOfferChips(ctx, offers, POSTER_WIDTH - 2 * MARGIN) : [];
  const hasOffers = offerRows.length > 0;

  let dataSectionTop: number;
  let inclusionsLabelY = 0;
  let inclusionsChipsTop = 0;
  if (hasOffers) {
    inclusionsLabelY = panelBottom + 42;
    inclusionsChipsTop = inclusionsLabelY + 28;
    const chipsBlockHeight = offerRows.length * CHIP_HEIGHT + (offerRows.length - 1) * CHIP_GAP;
    dataSectionTop = inclusionsChipsTop + chipsBlockHeight + 32;
  } else {
    dataSectionTop = panelBottom;
  }

  const dataSectionHeight = DATA_SECTION_HEIGHT;
  const dataLabelY = dataSectionTop + DATA_SECTION_LABEL_OFFSET;
  const footerTop = dataSectionTop + dataSectionHeight;
  const footerHeight = FOOTER_HEIGHT;
  const totalHeight = footerTop + footerHeight;

  return {
    headerTop,
    headerHeight,
    carHeroTop,
    carHeroHeight,
    panelTop,
    panelHeight,
    panelBottom,
    hasOffers,
    offerRows,
    inclusionsLabelY,
    inclusionsChipsTop,
    dataSectionTop,
    dataSectionHeight,
    dataLabelY,
    footerTop,
    footerHeight,
    totalHeight,
  };
}
