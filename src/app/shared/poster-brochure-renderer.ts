/** A5-per-page brand brochure — every model/variant/year of one brand, one row each, split across
 *  as many true A5 pages (1748x2480 @ 300dpi, matching this app's earlier-agreed print target) as
 *  the row count needs, rather than one ever-taller single image the way the on-screen posters do.
 *  Follows the same dark data-section / red-accent visual language as the quote posters
 *  (poster-renderer.ts) — white header band, dark table body, red accent rules and
 *  monthly-payment figures — rather than inventing a separate plain look for this one template. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { loadPosterImage } from './poster-images';
import { fillPolygon, fillTrackedText, fillTrackedTextRight, formatPosterCurrency } from './poster-draw-utils';
import { drawWhatsAppIcon } from './poster-whatsapp-icon';
import type { BrochureData, BrochureRow } from './poster-brochure-data';

export const PAGE_WIDTH = 1748;
export const PAGE_HEIGHT = 2480;
const MARGIN = 90;

const HEADER_HEIGHT = 360;
const TABLE_HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 260;
const ROW_HEIGHT = 250;

/** How many rows fit in the space left after the header and footer — computed once so the
 *  Calculator (deciding how many pages to render) and this renderer (drawing each one) always
 *  agree, instead of one of them guessing. */
export function rowsPerPage(): number {
  const contentHeight = PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - TABLE_HEADER_HEIGHT - FOOTER_HEIGHT;
  return Math.max(1, Math.floor(contentHeight / ROW_HEIGHT));
}

export function paginateBrochureRows(rows: BrochureRow[]): BrochureRow[][] {
  const perPage = rowsPerPage();
  const pages: BrochureRow[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

type Columns = { model: number; divider: number; selling: number; rebate: number; downpayment: number; loan: number; tenure: number[] };

/** Seven right-aligned numeric columns share the remaining width evenly: Selling Price, Rebate,
 *  Downpayment, Loan, then one per chosen tenure year (always 3) — mirroring the price-breakdown
 *  vs. monthly-estimate split the single-vehicle poster uses, just with more rows and years. */
function computeColumns(): Columns {
  const contentLeft = MARGIN;
  const contentRight = PAGE_WIDTH - MARGIN;
  const dividerX = contentLeft + 340;
  const numericLeft = dividerX + 24;
  const numericCount = 7;
  const numericWidth = (contentRight - numericLeft) / numericCount;
  const at = (i: number) => numericLeft + numericWidth * i;
  return {
    model: contentLeft,
    divider: dividerX,
    selling: at(1),
    rebate: at(2),
    downpayment: at(3),
    loan: at(4),
    tenure: [at(5), at(6), at(7)],
  };
}

function drawSkeleton(ctx: CanvasRenderingContext2D): void {
  // Header + hero: solid white, matching the single-vehicle poster's own header band.
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, PAGE_WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(0, HEADER_HEIGHT, PAGE_WIDTH, 4);

  // Table body: solid --data-bg down to the footer, same as the poster's price-breakdown section.
  const footerTop = PAGE_HEIGHT - FOOTER_HEIGHT;
  ctx.fillStyle = POSTER_COLORS.dataBg;
  ctx.fillRect(0, HEADER_HEIGHT + 4, PAGE_WIDTH, footerTop - (HEADER_HEIGHT + 4));

  // Footer: horizontal gradient --footer-a → --footer-b, 3px --acc rule at its top — identical
  // treatment to the poster's own footer band.
  const footerGradient = ctx.createLinearGradient(0, 0, PAGE_WIDTH, 0);
  footerGradient.addColorStop(0, POSTER_COLORS.footerA);
  footerGradient.addColorStop(1, POSTER_COLORS.footerB);
  ctx.fillStyle = footerGradient;
  ctx.fillRect(0, footerTop, PAGE_WIDTH, FOOTER_HEIGHT);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(0, footerTop, PAGE_WIDTH, 3);
}

async function drawHeader(ctx: CanvasRenderingContext2D, data: BrochureData, pageIndex: number, pageCount: number): Promise<void> {
  const M = MARGIN;
  const rightEdge = PAGE_WIDTH - M;

  if (data.logoUrl) {
    try {
      const img = await loadPosterImage(data.logoUrl);
      const logoWidth = 200;
      const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
      ctx.drawImage(img, rightEdge - logoWidth, 66, logoWidth, logoHeight);
    } catch {
      /* no logo uploaded yet — the brand name in the subtitle below already identifies the brochure */
    }
  }

  // Red slash — same 4px-wide skewed parallelogram the single-vehicle poster opens its header
  // with, just scaled up slightly for this page's larger header.
  fillPolygon(
    ctx,
    [
      [M + 11, 74],
      [M + 18, 74],
      [M + 7, 104],
      [M, 104],
    ],
    POSTER_COLORS.acc,
  );
  ctx.font = labelFont(17, 700);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'CURRENT OFFERS', M + 28, 89, 5);

  ctx.font = displayFont(64, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(data.title, M, 186);

  ctx.font = labelFont(15, 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textBaseline = 'middle';
  ctx.fillText(`${data.brand} · Monthly instalments compared across ${data.tenureYears.length} tenures`, M, 224);

  if (pageCount > 1) {
    ctx.font = labelFont(14, 400);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textAlign = 'right';
    ctx.fillText(`Page ${pageIndex + 1} of ${pageCount}`, rightEdge, 224);
  }

  // Table column headers — tracked small-caps labels on --data-bg, matching the poster's own
  // "PRICE BREAKDOWN" / "MONTHLY ESTIMATE" section labels.
  const cols = computeColumns();
  const headerY = HEADER_HEIGHT + 4 + TABLE_HEADER_HEIGHT / 2;
  ctx.font = labelFont(11, 700);
  ctx.fillStyle = POSTER_COLORS.panelGrayD;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  fillTrackedText(ctx, 'MODEL', cols.model, headerY, 1.6);

  const headerCols: [string, number][] = [
    ['SELLING PRICE', cols.selling],
    ['REBATE', cols.rebate],
    ['DOWNPAYMENT', cols.downpayment],
    ['LOAN', cols.loan],
    ...data.tenureYears.map((y, i): [string, number] => [`${y}YR/MO`, cols.tenure[i]]),
  ];
  for (const [label, x] of headerCols) fillTrackedTextRight(ctx, label, x, headerY, 1.2);

  ctx.fillStyle = POSTER_COLORS.hairline;
  ctx.fillRect(MARGIN, HEADER_HEIGHT + 4 + TABLE_HEADER_HEIGHT, PAGE_WIDTH - 2 * MARGIN, 1);
}

async function drawRow(ctx: CanvasRenderingContext2D, row: BrochureRow, top: number, isLast: boolean): Promise<void> {
  const cols = computeColumns();
  const centerY = top + ROW_HEIGHT / 2;

  ctx.font = displayFont(34, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(row.modelTitle, cols.model, centerY - 6);

  ctx.font = labelFont(18, 400);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.fillText(String(row.year), cols.model, centerY + 26);

  const values: [string, number, string, number][] = [
    [formatPosterCurrency(row.sellingPrice), cols.selling, POSTER_COLORS.paper, 24],
    [`− ${formatPosterCurrency(row.rebate)}`, cols.rebate, POSTER_COLORS.green, 20],
    [formatPosterCurrency(row.downpayment), cols.downpayment, '#ECECF0', 20],
    [formatPosterCurrency(row.loanAmount), cols.loan, '#ECECF0', 20],
    ...row.monthlyByTenure.map((m, i): [string, number, string, number] => [formatPosterCurrency(m), cols.tenure[i], POSTER_COLORS.acc, 24]),
  ];
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const [text, x, color, size] of values) {
    ctx.font = displayFont(size, 700);
    ctx.fillStyle = color;
    ctx.fillText(text, x, centerY);
  }

  if (!isLast) {
    ctx.fillStyle = POSTER_COLORS.partition;
    ctx.fillRect(MARGIN, top + ROW_HEIGHT, PAGE_WIDTH - 2 * MARGIN, 1);
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, data: BrochureData): void {
  const M = MARGIN;
  const footerTop = PAGE_HEIGHT - FOOTER_HEIGHT;

  const barTop = footerTop + 46;
  const barHeight = 130;
  const barWidth = PAGE_WIDTH - 2 * M;
  const gradient = ctx.createLinearGradient(M, 0, M + barWidth, 0);
  gradient.addColorStop(0, '#1FB955');
  gradient.addColorStop(1, POSTER_COLORS.waGreen);
  ctx.beginPath();
  ctx.roundRect(M, barTop, barWidth, barHeight, 24);
  ctx.fillStyle = gradient;
  ctx.fill();

  const centerY = barTop + barHeight / 2;
  const iconSize = 56;
  drawWhatsAppIcon(ctx, M + 40, centerY - iconSize / 2, iconSize, POSTER_COLORS.waGreen);

  ctx.font = displayFont(36, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.name, M + 40 + iconSize + 30, centerY - 20);

  ctx.font = labelFont(24, 400);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${data.advisor.role} · ${data.advisor.phoneDisplay}`, M + 40 + iconSize + 30, centerY + 22);

  ctx.font = labelFont(19, 400);
  ctx.fillStyle = POSTER_COLORS.panelGrayD;
  ctx.textAlign = 'center';
  ctx.fillText('Estimate only — insurance, bank rate and final loan approval may vary from the figures shown here.', PAGE_WIDTH / 2, footerTop + 216);
}

export async function renderBrochurePage(canvas: HTMLCanvasElement, data: BrochureData, pageRows: BrochureRow[], pageIndex: number, pageCount: number): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawSkeleton(ctx);
  await drawHeader(ctx, data, pageIndex, pageCount);

  const tableTop = HEADER_HEIGHT + 4 + TABLE_HEADER_HEIGHT + 1;
  let rowTop = tableTop;
  for (let i = 0; i < pageRows.length; i++) {
    await drawRow(ctx, pageRows[i], rowTop, i === pageRows.length - 1);
    rowTop += ROW_HEIGHT;
  }

  // Vertical partition separating the model/photo column from the numeric columns — same
  // content-bound divider treatment the poster uses between its own price-breakdown and
  // monthly-estimate columns, drawn once across every row rather than repeated per row.
  if (pageRows.length > 0) {
    const cols = computeColumns();
    ctx.fillStyle = POSTER_COLORS.partition;
    ctx.fillRect(cols.divider, tableTop, 2, rowTop - tableTop);
  }

  drawFooter(ctx, data);
}
