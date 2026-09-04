/** Multiple visual designs for the A5 brand brochure, the same way `poster-templates.ts` lets the
 *  single-vehicle quote poster have more than one look sharing one `PosterData` contract — here
 *  every template shares one `BrochureData`/`BrochureRow` contract but picks its own page density
 *  (rows/cards per page) and its own subset of fields to actually draw. */
import type { BrochureData, BrochureRow } from './poster-brochure-data';

export type BrochureTemplateId = 'detailed' | 'simple';

export interface BrochureTemplate {
  id: BrochureTemplateId;
  label: string;
  /** How many rows/cards this template's page layout fits — its own page (Calculator, deciding
   *  how many canvases to create) and this template's own renderPage must always agree. */
  rowsPerPage(): number;
  paginateRows(rows: BrochureRow[]): BrochureRow[][];
  renderPage(canvas: HTMLCanvasElement, data: BrochureData, pageRows: BrochureRow[], pageIndex: number, pageCount: number): Promise<void>;
}
