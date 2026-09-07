/** A5 "price list" brochure template: a single dense table of every model/variant of one brand —
 *  just the model, its year, and OTR price, no photos, insurance or instalment columns — so a
 *  brand's whole catalog reliably fits on one page as a plain reference sheet for viewers, with
 *  the advisor's name/role/phone and a WhatsApp QR still in the footer so it stays actionable.
 *  Shares its header and advisor/QR footer drawing with poster-brochure-renderer-simple.ts rather
 *  than redrawing them. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { fillTrackedText, fillTrackedTextRight, measureTrackedText, formatPosterCurrency } from './poster-draw-utils';
import { drawHeader, drawAdvisorAvatar, drawQrCode } from './poster-brochure-renderer-simple';
import type { BrochureData, BrochureRow } from './poster-brochure-data';

export const PAGE_WIDTH = 1748;
export const PAGE_HEIGHT = 2480;
const MARGIN = 90;

const HEADER_HEIGHT = 190;
const TABLE_TOP_GAP = 20;
const TABLE_HEADER_HEIGHT = 64;
const GAP_BEFORE_FOOTER = 28;
const FOOTER_HEIGHT = 300;
const TABLE_RADIUS = 20;
/** Minimum packed row height a page is laid out against — actual rows stretch to fill whatever
 *  space is left over (see renderPricelistPage), same "generous when there's few, packed when
 *  there's many" behaviour as the photo template. */
const ROW_HEIGHT = 80;

/** Sized so a brand's whole catalog (17 variants is the largest today) lands on a single page,
 *  same rule as rowsPerPage() in the photo template. */
export function rowsPerPage(): number {
  const contentHeight = PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - TABLE_TOP_GAP - TABLE_HEADER_HEIGHT - GAP_BEFORE_FOOTER - FOOTER_HEIGHT;
  return Math.max(1, Math.floor(contentHeight / ROW_HEIGHT));
}

export function paginatePricelistRows(rows: BrochureRow[]): BrochureRow[][] {
  const perPage = rowsPerPage();
  const pages: BrochureRow[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

function drawTableHeaderBar(ctx: CanvasRenderingContext2D, barTop: number): void {
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillRect(MARGIN, barTop, PAGE_WIDTH - 2 * MARGIN, TABLE_HEADER_HEIGHT);

  const headerY = barTop + TABLE_HEADER_HEIGHT / 2;
  ctx.font = labelFont(12, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  fillTrackedText(ctx, 'MODEL & VARIANT', MARGIN + 12, headerY, 1.6);

  fillTrackedTextRight(ctx, 'OTR PRICE (RM)', PAGE_WIDTH - MARGIN - 12, headerY, 1.6);
}

function drawRow(ctx: CanvasRenderingContext2D, row: BrochureRow, top: number, rowHeight: number, scale: number, isLast: boolean): void {
  const centerY = top + rowHeight / 2;
  const f = (px: number) => Math.round(px * scale);

  ctx.font = displayFont(f(26), 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(row.modelTitle, MARGIN + 12, centerY - f(2));

  ctx.font = labelFont(f(14), 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.fillText(String(row.year), MARGIN + 12, centerY + f(22));

  ctx.font = displayFont(f(28), 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatPosterCurrency(row.otrPrice), PAGE_WIDTH - MARGIN - 12, centerY);

  if (!isLast) {
    ctx.fillStyle = POSTER_COLORS.hairline;
    ctx.fillRect(MARGIN, top + rowHeight, PAGE_WIDTH - 2 * MARGIN, 1);
  }
}

/** Compact single-row footer — advisor identity on the left, WhatsApp QR on the right, no
 *  promotion-notes column (a price list only needs the one disclaimer line above it). */
async function drawFooter(ctx: CanvasRenderingContext2D, data: BrochureData): Promise<void> {
  const M = MARGIN;
  const footerTop = PAGE_HEIGHT - FOOTER_HEIGHT;

  ctx.fillStyle = POSTER_COLORS.hairline;
  ctx.fillRect(M, footerTop, PAGE_WIDTH - 2 * M, 1);

  ctx.font = labelFont(14, 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Prices shown are OTR and subject to change without notice.', M, footerTop + 40);

  const rowTop = footerTop + 70;
  const rowHeight = FOOTER_HEIGHT - 70 - 20;
  const avatarSize = 120;
  const identityX = M;
  await drawAdvisorAvatar(ctx, data, identityX, rowTop + (rowHeight - avatarSize) / 2, avatarSize);

  const textX = identityX + avatarSize + 26;
  const textCenterY = rowTop + rowHeight / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(26, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(data.advisor.name, textX, textCenterY - 16);
  ctx.font = labelFont(16, 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.fillText(data.advisor.role, textX, textCenterY + 10);
  ctx.font = displayFont(22, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillText(data.advisor.phoneDisplay, textX, textCenterY + 38);

  // Shrunk below the row's full height to leave room for the "SCAN TO WHATSAPP" label underneath
  // it, both still landing inside the rowTop..rowTop+rowHeight band the footer budgeted for them.
  const qrLabelSpace = 34;
  const qrSize = rowHeight - qrLabelSpace;
  const qrCardX = PAGE_WIDTH - M - qrSize;
  ctx.beginPath();
  ctx.roundRect(qrCardX - 6, rowTop - 6, qrSize + 12, qrSize + 12, 14);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fill();
  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();
  const waText = `https://wa.me/${data.advisor.phoneWa}?text=${encodeURIComponent(`Hi, I would like to enquire about the ${data.brand} price list.`)}`;
  drawQrCode(ctx, waText, qrCardX, rowTop, qrSize);

  ctx.font = labelFont(11, 700);
  ctx.fillStyle = POSTER_COLORS.grayD;
  ctx.textBaseline = 'alphabetic';
  const scanLabel = 'SCAN TO WHATSAPP';
  const scanLabelWidth = measureTrackedText(ctx, scanLabel, 1.2);
  fillTrackedText(ctx, scanLabel, qrCardX + qrSize / 2 - scanLabelWidth / 2, rowTop + qrSize + 24, 1.2);
}

export async function renderPricelistPage(canvas: HTMLCanvasElement, data: BrochureData, pageRows: BrochureRow[], pageIndex: number, pageCount: number): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  await drawHeader(ctx, data, pageIndex, pageCount, 'PRICE LIST');

  const barTop = HEADER_HEIGHT + TABLE_TOP_GAP;
  const rowsTop = barTop + TABLE_HEADER_HEIGHT;
  const availableHeight = PAGE_HEIGHT - FOOTER_HEIGHT - GAP_BEFORE_FOOTER - rowsTop;
  const maxRowHeight = 150;
  const rowHeight = pageRows.length > 0 ? Math.min(maxRowHeight, availableHeight / pageRows.length) : ROW_HEIGHT;
  const scale = Math.min(1.3, rowHeight / ROW_HEIGHT);
  const tableHeight = TABLE_HEADER_HEIGHT + Math.max(1, pageRows.length) * rowHeight;
  const tableWidth = PAGE_WIDTH - 2 * MARGIN;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(MARGIN, barTop, tableWidth, tableHeight, TABLE_RADIUS);
  ctx.clip();
  drawTableHeaderBar(ctx, barTop);
  let rowTop = rowsTop;
  for (let i = 0; i < pageRows.length; i++) {
    drawRow(ctx, pageRows[i], rowTop, rowHeight, scale, i === pageRows.length - 1);
    rowTop += rowHeight;
  }
  ctx.restore();

  ctx.strokeStyle = POSTER_COLORS.acc;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(MARGIN, barTop, tableWidth, tableHeight, TABLE_RADIUS);
  ctx.stroke();

  await drawFooter(ctx, data);
}
