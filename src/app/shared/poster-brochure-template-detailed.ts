/** Wraps poster-brochure-renderer.ts's dense pricing table (Selling Price, Rebate, Downpayment,
 *  Loan, 3 tenure years) as a `BrochureTemplate`. */
import { rowsPerPage, paginateBrochureRows, renderBrochurePage } from './poster-brochure-renderer';
import type { BrochureTemplate } from './poster-brochure-templates';

export const detailedBrochureTemplate: BrochureTemplate = {
  id: 'detailed',
  label: 'Full Pricing Table',
  rowsPerPage,
  paginateRows: paginateBrochureRows,
  renderPage: renderBrochurePage,
};
