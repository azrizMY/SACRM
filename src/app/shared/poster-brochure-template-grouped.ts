/** Wraps poster-brochure-renderer-grouped.ts's per-model financing table (OTR, insurance,
 *  downpayment, loan, two tenure-year instalments, grouped under a colour bar per model) as a
 *  `BrochureTemplate`. */
import { rowsPerPage, paginateGroupedRows, renderGroupedPage } from './poster-brochure-renderer-grouped';
import type { BrochureTemplate } from './poster-brochure-templates';

export const groupedBrochureTemplate: BrochureTemplate = {
  id: 'grouped',
  label: 'Financing Price List',
  rowsPerPage,
  paginateRows: paginateGroupedRows,
  renderPage: renderGroupedPage,
};
