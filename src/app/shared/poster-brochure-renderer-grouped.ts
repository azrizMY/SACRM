/** A5 "financing price list" brochure template, modelled on a dealer rebate-flyer reference: every
 *  variant of a model sits under one colour bar naming that model, with OTR price, insurance,
 *  downpayment, loan amount, and three tenure-year monthly figures as columns on that same bar —
 *  no photos, no rebate column. Unlike the other two templates, this one is a plain full-price
 *  list: rebate is zeroed out entirely (see my-cars.component.ts's groupedOfferRows), so downpayment
 *  lands on the flat default-% of OTR and loan/monthly follow from the un-rebated selling price —
 *  no promo pricing anywhere on this sheet. The three tenure columns always mirror whichever years
 *  are toggled on in Offer Sheet Settings (same setting the other two templates share), not a fixed
 *  set. Rows never split across a page break; whole model groups move to the next page together
 *  instead. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { fillTrackedText, measureTrackedText } from './poster-draw-utils';
import { drawHeader, drawAdvisorAvatar, drawQrCode } from './poster-brochure-renderer-simple';
import { drawDocumentsRequired } from './poster-brochure-documents-required';
import type { BrochureData, BrochureRow } from './poster-brochure-data';

export const PAGE_WIDTH = 1748;
export const PAGE_HEIGHT = 2480;
const MARGIN = 90;

const HEADER_HEIGHT = 190;
const TABLE_TOP_GAP = 20;
const GAP_BEFORE_FOOTER = 28;
/** Sized so the footer's text and QR print at an actually legible/scannable size at true A5
 *  (148x210mm) — this canvas is 1748x2480px, i.e. ~11.8px/mm, so a QR needs ~230px to reach the
 *  ~20mm industry-standard minimum for reliable scanning at arm's length, and body text needs to
 *  stay well above the ~12px that only prints at ~1mm (~3pt) tall. */
const FOOTER_HEIGHT = 371;

/** Packed (minimum) sizes pagination decisions are made against — renderGroupedPage scales these
 *  up to fill whatever space is actually left on a page with few groups, same "generous when
 *  there's few, packed when there's many" rule the other templates use. */
const GROUP_HEADER_HEIGHT = 50;
const ROW_HEIGHT = 68;
const GROUP_GAP = 14;
const TABLE_RADIUS = 20;

type Columns = {
  model: number;
  modelWidth: number;
  otr: number;
  insurance: number;
  downpayment: number;
  loan: number;
  tenure1: number;
  tenure2: number;
  tenure3: number;
  dataColWidth: number;
};

function computeColumns(): Columns {
  const left = MARGIN;
  const right = PAGE_WIDTH - MARGIN;
  const modelWidth = 560;
  const model = left;
  const dataColWidth = (right - (model + modelWidth)) / 7;
  const otr = model + modelWidth;
  const insurance = otr + dataColWidth;
  const downpayment = insurance + dataColWidth;
  const loan = downpayment + dataColWidth;
  const tenure1 = loan + dataColWidth;
  const tenure2 = tenure1 + dataColWidth;
  const tenure3 = tenure2 + dataColWidth;
  return { model, modelWidth, otr, insurance, downpayment, loan, tenure1, tenure2, tenure3, dataColWidth };
}

/** Plain thousands-separated figure with no currency prefix and no decimals — matching the dense,
 *  bare-number look of the reference this template is modelled on, since "OTR PRICE"/"INSURANCE"/
 *  etc. column headers already say what each figure is. */
function fmtWhole(v: number): string {
  return Math.round(v).toLocaleString('en-MY');
}

/** Whole ringgit + 2 decimals — used for the 4 money columns (not the 2 monthly-instalment ones,
 *  which stay whole ringgit like the reference). */
function fmtMoney(v: number): string {
  return v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Group = { model: string; year: number; rows: BrochureRow[] };

/** Consecutive rows sharing the same model+year become one group — relies on offerRows() already
 *  listing a brand's variants model-by-model (see VEHICLES in calculator-data.ts), same assumption
 *  the reference flyer's own row order makes. */
function groupRows(rows: BrochureRow[]): Group[] {
  const groups: Group[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.model === row.model && last.year === row.year) last.rows.push(row);
    else groups.push({ model: row.model, year: row.year, rows: [row] });
  }
  return groups;
}

function packedGroupHeight(group: Group): number {
  return GROUP_HEADER_HEIGHT + group.rows.length * ROW_HEIGHT;
}

function availableContentHeight(): number {
  return PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - TABLE_TOP_GAP - GAP_BEFORE_FOOTER - FOOTER_HEIGHT;
}

/** Not consulted by anything outside this file (paginateGroupedRows below does the real work) —
 *  kept only to satisfy the shared BrochureTemplate contract's rowsPerPage field. */
export function rowsPerPage(): number {
  return Math.max(1, Math.floor(availableContentHeight() / (GROUP_HEADER_HEIGHT + ROW_HEIGHT)));
}

/** Packs whole model groups onto each page — a group is never split across a page break, even if
 *  that means a page runs shorter than the packed-minimum space technically allows. */
export function paginateGroupedRows(rows: BrochureRow[]): BrochureRow[][] {
  const groups = groupRows(rows);
  const available = availableContentHeight();
  const pages: BrochureRow[][] = [];
  let current: BrochureRow[] = [];
  let currentHeight = 0;
  for (const group of groups) {
    const groupHeight = packedGroupHeight(group);
    const additional = current.length > 0 ? GROUP_GAP + groupHeight : groupHeight;
    if (current.length > 0 && currentHeight + additional > available) {
      pages.push(current);
      current = [];
      currentHeight = 0;
    }
    currentHeight += current.length > 0 ? GROUP_GAP + groupHeight : groupHeight;
    current.push(...group.rows);
  }
  if (current.length > 0 || pages.length === 0) pages.push(current);
  return pages;
}

function drawGroupHeader(ctx: CanvasRenderingContext2D, cols: Columns, group: Group, top: number, height: number, tenureYears: number[], scale: number): void {
  const f = (px: number) => Math.round(px * scale);
  const width = PAGE_WIDTH - 2 * MARGIN;
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(MARGIN, top, width, height);

  const centerY = top + height / 2;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = POSTER_COLORS.paper;

  ctx.font = displayFont(f(20), 700);
  ctx.textAlign = 'left';
  ctx.fillText(`${group.model.toUpperCase()} ${group.year}`, cols.model + 16, centerY);

  ctx.font = labelFont(f(10), 700);
  ctx.textAlign = 'center';
  const headerLabel = (text: string, x: number, colWidth: number) => fillTrackedText(ctx, text, x + colWidth / 2 - measureTrackedText(ctx, text, 1) / 2, centerY, 1);
  headerLabel('OTR PRICE', cols.otr, cols.dataColWidth);
  headerLabel('INSURANCE', cols.insurance, cols.dataColWidth);
  headerLabel('DOWNPAYMENT', cols.downpayment, cols.dataColWidth);
  headerLabel('LOAN', cols.loan, cols.dataColWidth);
  headerLabel(`${tenureYears[0]} YEARS`, cols.tenure1, cols.dataColWidth);
  headerLabel(`${tenureYears[1]} YEARS`, cols.tenure2, cols.dataColWidth);
  headerLabel(`${tenureYears[2]} YEARS`, cols.tenure3, cols.dataColWidth);
}

function drawGroupRow(ctx: CanvasRenderingContext2D, cols: Columns, row: BrochureRow, top: number, rowHeight: number, scale: number, isLastInGroup: boolean): void {
  const f = (px: number) => Math.round(px * scale);
  const centerY = top + rowHeight / 2;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = displayFont(f(19), 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(row.variantText || row.modelTitle, cols.model + 16, centerY + f(6));

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = labelFont(f(16), 400);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(fmtMoney(row.otrPrice), cols.otr + cols.dataColWidth / 2, centerY);
  ctx.fillText(fmtMoney(row.insurance), cols.insurance + cols.dataColWidth / 2, centerY);
  ctx.fillText(fmtMoney(row.downpayment), cols.downpayment + cols.dataColWidth / 2, centerY);
  ctx.fillText(fmtMoney(row.loanAmount), cols.loan + cols.dataColWidth / 2, centerY);

  ctx.font = labelFont(f(17), 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillText(fmtWhole(row.monthlyByTenure[0] ?? 0), cols.tenure1 + cols.dataColWidth / 2, centerY);
  ctx.fillText(fmtWhole(row.monthlyByTenure[1] ?? 0), cols.tenure2 + cols.dataColWidth / 2, centerY);
  ctx.fillText(fmtWhole(row.monthlyByTenure[2] ?? 0), cols.tenure3 + cols.dataColWidth / 2, centerY);

  if (!isLastInGroup) {
    // 3px at this canvas's native 1748x2480 resolution — the on-screen preview shrinks that down
    // via CSS to fit the page card, and a 1px line falls below a full screen pixel at that scale,
    // so the browser's downscale smoothing renders it inconsistently (thin/uneven, sometimes
    // invisible) even though it's solid at full resolution (e.g. the downloaded PDF, which embeds
    // this canvas untouched). 3px survives that downscale as a consistently visible line.
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.fillRect(MARGIN, top + rowHeight - 1, PAGE_WIDTH - 2 * MARGIN, 3);
  }
}


/** Advisor identity + WhatsApp QR, confined to `width` starting at `x` — same card styling as the
 *  Current Offers template's own consultant card (subtle tinted background, hairline border and
 *  internal divider, red "SCAN TO WHATSAPP" pill above a shadowed white QR tile), just with the
 *  avatar to the left of the name/role/phone instead of stacked above it. QR is still sized to
 *  print at roughly 20mm square, the accepted minimum for a phone camera to scan it reliably at
 *  arm's length — the styling changed here, not that constraint. */
async function drawAdvisorBlock(ctx: CanvasRenderingContext2D, data: BrochureData, x: number, width: number, top: number): Promise<void> {
  const avatarSize = 130;
  const qrSize = 230;
  const qrCardPad = 14;
  const qrCardSize = qrSize + qrCardPad * 2;
  const pillHeight = 27;
  const pad = 18;
  // Anchored at `top` (same reference the documents checklist heading uses) minus a small pad —
  // NOT solved backward from "centre the avatar", which only works when the card is roughly
  // avatar-height; this card is much taller (driven by the pill+QR stack), so that approach was
  // pushing the whole card upward past the footer's own divider line.
  const cardTop = top - pad;
  const cardHeight = pad * 2 + pillHeight + 14 + qrCardSize;

  // Card shell — same subtle dark tint + hairline border as the Current Offers consultant card,
  // not the heavier black border the per-model tables use, so this reads as a softer identity
  // panel rather than another data table.
  ctx.beginPath();
  ctx.roundRect(x, cardTop, width, cardHeight, 14);
  ctx.fillStyle = 'rgba(18,18,20,0.035)';
  ctx.fill();
  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();

  const dividerX = x + avatarSize + pad * 2 + 190;
  ctx.beginPath();
  ctx.moveTo(dividerX, cardTop + pad);
  ctx.lineTo(dividerX, cardTop + cardHeight - pad);
  ctx.stroke();

  const avatarX = x + pad;
  const avatarY = cardTop + (cardHeight - avatarSize) / 2;
  await drawAdvisorAvatar(ctx, data, avatarX, avatarY, avatarSize);

  const textX = avatarX + avatarSize + 24;
  const textCenterY = avatarY + avatarSize / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(24, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(data.advisor.name, textX, textCenterY - 14);
  ctx.font = labelFont(14, 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.fillText(data.advisor.role, textX, textCenterY + 9);
  ctx.font = displayFont(19, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillText(data.advisor.phoneDisplay, textX, textCenterY + 35);

  // Right side — the WhatsApp QR, styled exactly like the Current Offers card: a red pill label
  // above it, and the QR itself on a plain white rounded tile with a hairline edge and a faint
  // drop shadow for a bit of lift, rather than the QR sitting flush on the page.
  const qrHalfCenterX = dividerX + (x + width - dividerX) / 2;

  ctx.font = labelFont(12, 700);
  const pillLabel = 'SCAN TO WHATSAPP';
  const pillTextWidth = measureTrackedText(ctx, pillLabel, 1.2);
  const pillPaddingX = 16;
  const pillWidth = pillTextWidth + pillPaddingX * 2;
  const pillTop = cardTop + pad;
  ctx.beginPath();
  ctx.roundRect(qrHalfCenterX - pillWidth / 2, pillTop, pillWidth, pillHeight, pillHeight / 2);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fill();
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, pillLabel, qrHalfCenterX - pillTextWidth / 2, pillTop + pillHeight / 2, 1.2);

  const qrCardTop = pillTop + pillHeight + 14;
  const qrCardX = qrHalfCenterX - qrCardSize / 2;

  ctx.beginPath();
  ctx.roundRect(qrCardX, qrCardTop + 3, qrCardSize, qrCardSize, 16);
  ctx.fillStyle = 'rgba(18,18,20,0.08)';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(qrCardX, qrCardTop, qrCardSize, qrCardSize, 16);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fill();
  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();

  const waText = `https://wa.me/${data.advisor.phoneWa}?text=${encodeURIComponent(`Hi, I would like to enquire about the ${data.brand} promotion.`)}`;
  drawQrCode(ctx, waText, qrCardX + qrCardPad, qrCardTop + qrCardPad, qrSize);
}

/** Documents checklist and advisor/QR side by side on one row — keeps the footer to a single
 *  compact band instead of two stacked rows eating far more page height than either needs alone. */
async function drawFooter(ctx: CanvasRenderingContext2D, data: BrochureData): Promise<void> {
  const footerTop = PAGE_HEIGHT - FOOTER_HEIGHT;
  ctx.fillStyle = POSTER_COLORS.hairline;
  ctx.fillRect(MARGIN, footerTop, PAGE_WIDTH - 2 * MARGIN, 1);

  const gap = 50;
  const advisorWidth = 690;
  const documentsX = MARGIN;
  const documentsWidth = PAGE_WIDTH - 2 * MARGIN - advisorWidth - gap;
  const advisorX = documentsX + documentsWidth + gap;

  const contentTop = footerTop + 34;
  drawDocumentsRequired(ctx, documentsX, documentsWidth, contentTop);
  await drawAdvisorBlock(ctx, data, advisorX, advisorWidth, contentTop);
}

export async function renderGroupedPage(canvas: HTMLCanvasElement, data: BrochureData, pageRows: BrochureRow[], pageIndex: number, pageCount: number): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  await drawHeader(ctx, data, pageIndex, pageCount, 'FINANCING PRICE LIST', HEADER_HEIGHT);

  const cols = computeColumns();
  // Always exactly 3 columns, mirroring whichever years are toggled on in Offer Sheet Settings —
  // repeats the last configured year into any slot beyond however many are actually toggled, so
  // fewer than 3 selected still renders sensibly instead of a blank/NaN column.
  const lastTenure = data.tenureYears[data.tenureYears.length - 1] ?? 0;
  const tenureYears = [0, 1, 2].map((i) => data.tenureYears[i] ?? lastTenure);

  const groups = groupRows(pageRows);
  const packedTotal =
    groups.reduce((sum, g) => sum + packedGroupHeight(g), 0) + Math.max(0, groups.length - 1) * GROUP_GAP;
  const available = availableContentHeight();
  const scale = packedTotal > 0 ? Math.min(1.3, available / packedTotal) : 1;
  const f = (px: number) => Math.round(px * scale);

  const tableTop = HEADER_HEIGHT + TABLE_TOP_GAP;
  const tableWidth = PAGE_WIDTH - 2 * MARGIN;

  let top = tableTop;
  for (const group of groups) {
    const groupHeaderHeight = f(GROUP_HEADER_HEIGHT);
    const rowHeight = f(ROW_HEIGHT);
    const groupHeight = groupHeaderHeight + group.rows.length * rowHeight;

    // Each model gets its own rounded clip region — same reason the other two templates clip
    // their table to a rounded rect: the header bar's square corners would otherwise poke out
    // past this group's own border at its top and bottom.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(MARGIN, top, tableWidth, groupHeight, TABLE_RADIUS);
    ctx.clip();
    drawGroupHeader(ctx, cols, group, top, groupHeaderHeight, tenureYears, scale);
    let rowTop = top + groupHeaderHeight;
    group.rows.forEach((row, i) => {
      drawGroupRow(ctx, cols, row, rowTop, rowHeight, scale, i === group.rows.length - 1);
      rowTop += rowHeight;
    });
    ctx.restore();

    // Outer border around this one model — black rather than the accent red, so it reads as a
    // frame rather than another coloured element competing with the header bar inside it.
    ctx.strokeStyle = POSTER_COLORS.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(MARGIN, top, tableWidth, groupHeight, TABLE_RADIUS);
    ctx.stroke();

    top += groupHeight + f(GROUP_GAP);
  }

  await drawFooter(ctx, data);
}
