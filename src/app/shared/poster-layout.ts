/** Poster canvas geometry — the fixed 900-wide design grid from the spec. Every band is a fixed
 *  height at a fixed offset — full-bleed bands (price panel, data section, footer) simply span
 *  x=0..POSTER_WIDTH; the header and car hero also span the full width but sit on --paper rather
 *  than a full-bleed colour change.
 *
 *  Nothing here draws anything — this only answers "where does each band start and end", so the
 *  drawing stages (header, hero, panel, data, footer) and the canvas's own height can both read
 *  from one computation instead of duplicating the arithmetic. */

export const POSTER_WIDTH = 900;
export const MARGIN = 56;

const HEADER_HEIGHT = 168;
const CAR_HERO_HEIGHT = 298;
const PANEL_TOP = 492;
const PANEL_HEIGHT = 250;
const DATA_SECTION_HEIGHT = 306;
const FOOTER_HEIGHT = 120;

/** Data-section content (section labels, table, tenure cards) always sits this far below wherever
 *  the data section itself starts. */
const DATA_SECTION_LABEL_OFFSET = 46;

export type PosterLayout = {
  headerTop: number;
  headerHeight: number;
  carHeroTop: number;
  carHeroHeight: number;
  panelTop: number;
  panelHeight: number;
  panelBottom: number;
  dataSectionTop: number;
  dataSectionHeight: number;
  dataLabelY: number;
  footerTop: number;
  footerHeight: number;
  /** Design-pixel height of the whole poster — derived, never fixed, per the spec's rule 5. */
  totalHeight: number;
};

/** Computes every band's position for this specific poster. */
export function computePosterLayout(): PosterLayout {
  const headerTop = 0;
  const headerHeight = HEADER_HEIGHT;
  const carHeroTop = headerHeight;
  const carHeroHeight = CAR_HERO_HEIGHT;
  const panelTop = PANEL_TOP;
  const panelHeight = PANEL_HEIGHT;
  const panelBottom = panelTop + panelHeight;

  const dataSectionTop = panelBottom;
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
    dataSectionTop,
    dataSectionHeight,
    dataLabelY,
    footerTop,
    footerHeight,
    totalHeight,
  };
}
