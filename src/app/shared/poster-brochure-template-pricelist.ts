/** Wraps poster-brochure-renderer-pricelist.ts's dense model+price table (no photos, no
 *  insurance/instalment columns) as a `BrochureTemplate`. */
import { rowsPerPage, paginatePricelistRows, renderPricelistPage } from './poster-brochure-renderer-pricelist';
import type { BrochureTemplate } from './poster-brochure-templates';

export const pricelistBrochureTemplate: BrochureTemplate = {
  id: 'pricelist',
  label: 'Price List',
  rowsPerPage,
  paginateRows: paginatePricelistRows,
  renderPage: renderPricelistPage,
};
