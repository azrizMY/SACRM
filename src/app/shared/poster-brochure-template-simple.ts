/** Wraps poster-brochure-renderer-simple.ts's image-forward card grid (model, car photo, OTR
 *  price only) as a `BrochureTemplate`. */
import { rowsPerPage, paginateBrochureRows, renderBrochurePage } from './poster-brochure-renderer-simple';
import type { BrochureTemplate } from './poster-brochure-templates';

export const simpleBrochureTemplate: BrochureTemplate = {
  id: 'simple',
  label: 'Photo & OTR Price',
  rowsPerPage,
  paginateRows: paginateBrochureRows,
  renderPage: renderBrochurePage,
};
