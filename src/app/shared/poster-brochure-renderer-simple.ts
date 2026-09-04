/** A5 "special rebates" flyer template: a light, marketing-style table (not the dark data-section
 *  look the other templates use) — car thumbnail + model, OTR price, insurance, a highlighted
 *  Rebate column, Selling Price, and an estimated "from" monthly figure, plus a promotion-notes/
 *  WhatsApp-QR footer.
 *  Modelled on a dealer rebate-flyer reference the user supplied, redrawn with this app's own
 *  color tokens (POSTER_COLORS) rather than copied wholesale. Sized to fit an entire brand's
 *  catalog (12 rows) on one A5 page whenever possible, only spilling to a second page if a brand
 *  ever exceeds that. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { loadPosterImage } from './poster-images';
import { fillPolygon, fillTrackedText, measureTrackedText, formatPosterCurrency } from './poster-draw-utils';
import { drawWhatsAppIcon } from './poster-whatsapp-icon';
import { buildQrMatrix } from './qr-code';
import type { BrochureData, BrochureRow } from './poster-brochure-data';

export const PAGE_WIDTH = 1748;
export const PAGE_HEIGHT = 2480;
const MARGIN = 90;

const HEADER_HEIGHT = 190;
const TABLE_TOP_GAP = 20;
const TABLE_HEADER_HEIGHT = 64;
/** Breathing room between the table's own rounded bottom border and the footer's hairline —
 *  without this, a page whose rows exactly fill the available height puts the footer's divider
 *  line right on top of the table's own border. */
const GAP_BEFORE_FOOTER = 28;
const FOOTER_HEIGHT = 380;
const ROW_HEIGHT = 134;
const TABLE_RADIUS = 20;

type Columns = {
  model: number;
  modelWidth: number;
  otr: number;
  otrWidth: number;
  insurance: number;
  insuranceWidth: number;
  rebate: number;
  rebateWidth: number;
  selling: number;
  sellingWidth: number;
  monthly: number;
  monthlyWidth: number;
};

function computeColumns(): Columns {
  const left = MARGIN;
  const modelWidth = 620;
  const otrWidth = 190;
  const insuranceWidth = 190;
  const rebateWidth = 190;
  const sellingWidth = 190;
  const monthlyWidth = PAGE_WIDTH - MARGIN - (left + modelWidth + otrWidth + insuranceWidth + rebateWidth + sellingWidth);
  const model = left;
  const otr = model + modelWidth;
  const insurance = otr + otrWidth;
  const rebate = insurance + insuranceWidth;
  const selling = rebate + rebateWidth;
  const monthly = selling + sellingWidth;
  return { model, modelWidth, otr, otrWidth, insurance, insuranceWidth, rebate, rebateWidth, selling, sellingWidth, monthly, monthlyWidth };
}

/** How many rows fit in the space left after the header/table-header/footer — the Calculator
 *  (deciding how many pages to render) and this renderer (drawing each one) must always agree.
 *  Sized so a brand's whole catalog (11 variants is the largest today) lands on a single page. */
export function rowsPerPage(): number {
  const contentHeight = PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - TABLE_TOP_GAP - TABLE_HEADER_HEIGHT - GAP_BEFORE_FOOTER - FOOTER_HEIGHT;
  return Math.max(1, Math.floor(contentHeight / ROW_HEIGHT));
}

export function paginateBrochureRows(rows: BrochureRow[]): BrochureRow[][] {
  const perPage = rowsPerPage();
  const pages: BrochureRow[][] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

async function drawHeader(ctx: CanvasRenderingContext2D, data: BrochureData, pageIndex: number, pageCount: number): Promise<void> {
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  const M = MARGIN;
  const rightEdge = PAGE_WIDTH - M;

  const titleText = data.title.toUpperCase();
  const titleBaseline = 150;
  const titleFontSize = 68;

  // Logo — a large, generous object-contain box (no brand name printed anywhere else on the page
  // now, so the logo alone has to carry that identity — it needs real presence, not a size tied
  // tightly to a single line of title text). Bottom is measured to land exactly on the bottom of
  // the title text so the two align, even though the box starts well above the title's own top.
  ctx.font = displayFont(titleFontSize, 700);
  const titleMetrics = ctx.measureText(titleText);
  const logoBoxTop = 18;
  const logoBoxBottom = titleBaseline + titleMetrics.actualBoundingBoxDescent;
  const logoBoxHeight = logoBoxBottom - logoBoxTop;
  const logoBoxWidth = 380;
  if (data.logoUrl) {
    try {
      const img = await loadPosterImage(data.logoUrl);
      const logoScale = Math.min(logoBoxWidth / img.naturalWidth, logoBoxHeight / img.naturalHeight);
      const logoWidth = img.naturalWidth * logoScale;
      const logoHeight = img.naturalHeight * logoScale;
      ctx.drawImage(img, rightEdge - logoWidth, logoBoxTop + (logoBoxHeight - logoHeight) / 2, logoWidth, logoHeight);
    } catch {
      /* no logo uploaded yet — the brand name in the headline already identifies the brochure */
    }
  }

  fillPolygon(
    ctx,
    [
      [M + 7, 44],
      [M + 12, 44],
      [M + 5, 62],
      [M, 62],
    ],
    POSTER_COLORS.acc,
  );
  ctx.font = labelFont(16, 700);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'CURRENT OFFERS', M + 20, 53, 4.5);

  ctx.font = displayFont(titleFontSize, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(titleText, M, titleBaseline);

  if (pageCount > 1) {
    ctx.font = labelFont(15, 400);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Page ${pageIndex + 1} of ${pageCount}`, rightEdge, titleBaseline);
  }
}

/** The table's own black header bar — solid ink/black, matching the reference's dark header row,
 *  except the Rebate column stays --acc red and continues down as a full-height band behind every
 *  row. Drawn inside renderBrochurePage's rounded clip region so its top corners come out rounded
 *  along with the rest of the table, rather than square corners poking out past a rounded border. */
function drawTableHeaderBar(ctx: CanvasRenderingContext2D, barTop: number): void {
  const cols = computeColumns();
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillRect(MARGIN, barTop, PAGE_WIDTH - 2 * MARGIN, TABLE_HEADER_HEIGHT);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(cols.rebate, barTop, cols.rebateWidth, TABLE_HEADER_HEIGHT);

  const headerY = barTop + TABLE_HEADER_HEIGHT / 2;
  ctx.font = labelFont(12, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  fillTrackedText(ctx, 'MODEL & VARIANT', cols.model + 12, headerY, 1.6);

  ctx.textAlign = 'center';
  ctx.font = labelFont(10.5, 700);
  ctx.fillText('OTR PRICE (RM)', cols.otr + cols.otrWidth / 2, headerY);
  ctx.fillText('INSURANCE (RM)', cols.insurance + cols.insuranceWidth / 2, headerY);
  ctx.fillText('REBATE (RM)', cols.rebate + cols.rebateWidth / 2, headerY);
  ctx.fillText('SELLING PRICE (RM)', cols.selling + cols.sellingWidth / 2, headerY);
  ctx.fillText('EST. MONTHLY FROM*', cols.monthly + cols.monthlyWidth / 2, headerY);
}

/** Rows stretch to fill whatever vertical space is actually available for this page's row count
 *  (see renderBrochurePage) rather than always drawing at the minimum packed height — a brand
 *  with far fewer than 12 models gets generously-sized rows instead of a cramped table sitting
 *  above a big blank gap. `scale` (relative to the minimum packed row height) grows the thumbnail
 *  and every font proportionally, capped so a page with only 1-2 rows doesn't get absurd giants. */
async function drawRow(ctx: CanvasRenderingContext2D, row: BrochureRow, top: number, rowHeight: number, scale: number, isLast: boolean): Promise<void> {
  const cols = computeColumns();
  const centerY = top + rowHeight / 2;
  const f = (px: number) => Math.round(px * scale);

  // Rebate column's red band continues behind this row.
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(cols.rebate, top, cols.rebateWidth, rowHeight);

  const thumbSize = { w: f(150), h: f(120) };
  const thumbX = cols.model + 10;
  const thumbY = top + (rowHeight - thumbSize.h) / 2;
  let imageDrawn = false;
  if (row.carImageUrl) {
    try {
      const img = await loadPosterImage(row.carImageUrl);
      const pad = f(6);
      const boxW = thumbSize.w - pad * 2;
      const boxH = thumbSize.h - pad * 2;
      const imgScale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const drawWidth = img.naturalWidth * imgScale;
      const drawHeight = img.naturalHeight * imgScale;
      ctx.drawImage(img, thumbX + (thumbSize.w - drawWidth) / 2, thumbY + (thumbSize.h - drawHeight) / 2, drawWidth, drawHeight);
      imageDrawn = true;
    } catch {
      /* no image drawn — text below starts at the column edge instead of leaving a gutter */
    }
  }

  // Without a photo, don't reserve blank space for one — start the text at the column edge.
  const textLeft = imageDrawn ? thumbX + thumbSize.w + f(18) : cols.model + 12;
  ctx.font = displayFont(f(21), 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(row.modelTitle, textLeft, centerY - f(4));

  ctx.font = labelFont(f(13), 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.fillText(String(row.year), textLeft, centerY + f(20));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = displayFont(f(20), 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(formatPosterCurrency(row.otrPrice), cols.otr + cols.otrWidth / 2, centerY);

  ctx.font = displayFont(f(19), 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(`+ ${formatPosterCurrency(row.insurance)}`, cols.insurance + cols.insuranceWidth / 2, centerY);

  ctx.font = displayFont(f(24), 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillText(`− ${formatPosterCurrency(row.rebate)}`, cols.rebate + cols.rebateWidth / 2, centerY);

  ctx.font = displayFont(f(20), 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(formatPosterCurrency(row.sellingPrice), cols.selling + cols.sellingWidth / 2, centerY);

  const monthlyFrom = row.monthlyByTenure.length > 0 ? Math.min(...row.monthlyByTenure) : 0;
  const monthlyX = cols.monthly + cols.monthlyWidth / 2;
  ctx.font = labelFont(f(11), 400);
  ctx.fillStyle = POSTER_COLORS.grayD;
  ctx.fillText('From', monthlyX, centerY - f(22));
  ctx.font = displayFont(f(22), 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillText(formatPosterCurrency(monthlyFrom), monthlyX, centerY + f(2));
  ctx.font = labelFont(f(11), 400);
  ctx.fillStyle = POSTER_COLORS.grayD;
  ctx.fillText('/ month', monthlyX, centerY + f(24));

  if (!isLast) {
    ctx.fillStyle = POSTER_COLORS.hairline;
    ctx.fillRect(MARGIN, top + rowHeight, PAGE_WIDTH - 2 * MARGIN, 1);
  }
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Circular advisor avatar — photo when uploaded (object-fit: cover, clipped to a circle, same
 *  treatment the quote poster's own consultant block uses), initials-on-a-tile otherwise. */
async function drawAdvisorAvatar(ctx: CanvasRenderingContext2D, data: BrochureData, x: number, y: number, size: number): Promise<void> {
  const cx = x + size / 2;
  const cy = y + size / 2;

  if (data.advisor.photoUrl) {
    try {
      const img = await loadPosterImage(data.advisor.photoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.clip();
      const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      ctx.drawImage(img, x + (size - drawWidth) / 2, y + (size - drawHeight) / 2, drawWidth, drawHeight);
      ctx.restore();
      return;
    } catch {
      /* fall through to the initials tile */
    }
  }

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = POSTER_COLORS.panelCard;
  ctx.fill();
  ctx.save();
  ctx.font = displayFont(size * 0.36, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initialsOf(data.advisor.name), cx, cy);
  ctx.restore();
}

/** Draws the QR at `size`x`size` starting at (x, y), with the WhatsApp mark sitting in a white
 *  roundrect cut into the middle of the code. Safe because buildQrMatrix always encodes at 'high'
 *  error correction (~30% of modules can be missing/obscured and still decode) — a centered logo
 *  covering roughly a fifth of the code is well inside that budget, and every WhatsApp QR reader
 *  is used to seeing a logo mark there anyway. */
function drawQrCode(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  const matrix = buildQrMatrix(text);
  const moduleSize = size / matrix.length;
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = POSTER_COLORS.ink;
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix.length; col++) {
      if (matrix[row][col]) ctx.fillRect(x + col * moduleSize, y + row * moduleSize, Math.ceil(moduleSize), Math.ceil(moduleSize));
    }
  }

  const badgeSize = size * 0.26;
  const badgeX = x + (size - badgeSize) / 2;
  const badgeY = y + (size - badgeSize) / 2;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, 8);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fill();

  const iconSize = badgeSize * 0.72;
  drawWhatsAppIcon(ctx, badgeX + (badgeSize - iconSize) / 2, badgeY + (badgeSize - iconSize) / 2, iconSize, POSTER_COLORS.waGreen);
}

async function drawFooter(ctx: CanvasRenderingContext2D, data: BrochureData): Promise<void> {
  const M = MARGIN;
  const footerTop = PAGE_HEIGHT - FOOTER_HEIGHT;

  ctx.fillStyle = POSTER_COLORS.hairline;
  ctx.fillRect(M, footerTop, PAGE_WIDTH - 2 * M, 1);

  // Left — promotion notes; Right — one bordered card holding the consultant's identity and the
  // WhatsApp QR side by side, since scanning that QR opens a chat with exactly this person.
  const cardWidth = 620;
  const gap = 50;
  const notesX = M;
  const notesWidth = PAGE_WIDTH - M - cardWidth - gap - notesX;
  const cardX = notesX + notesWidth + gap;

  const labelY = footerTop + 34;
  ctx.textBaseline = 'middle';

  // Left — promotion notes.
  ctx.font = labelFont(13, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'left';
  fillTrackedText(ctx, 'PROMOTION NOTES', notesX, labelY, 1.6);

  const now = new Date();
  const validUntil = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
  const maxTenure = data.tenureYears.length > 0 ? Math.max(...data.tenureYears) : 9;
  const notes = [
    'Insurance shown is the total due at 0% NCD; Selling Price is OTR plus insurance, less rebate.',
    'Rebate is subject to applicable terms & conditions.',
    `Monthly instalment is an estimate at up to ${maxTenure} years, and varies by bank, rate and downpayment.`,
    'Subject to bank approval.',
    `Promotion valid until ${validUntil}.`,
    'Terms & conditions apply.',
  ];
  ctx.font = labelFont(13, 400);
  ctx.fillStyle = POSTER_COLORS.ink;
  notes.forEach((note, i) => {
    const lineY = labelY + 34 + i * 29;
    ctx.fillText('•', notesX, lineY);
    ctx.fillText(note, notesX + 16, lineY);
  });

  // Right — the combined consultant + QR card.
  const cardTop = footerTop + 20;
  const cardHeight = 340;
  const padding = 24;

  ctx.beginPath();
  ctx.roundRect(cardX, cardTop, cardWidth, cardHeight, 14);
  ctx.fillStyle = 'rgba(18,18,20,0.035)';
  ctx.fill();
  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();

  const dividerX = cardX + 268;
  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.beginPath();
  ctx.moveTo(dividerX, cardTop + padding);
  ctx.lineTo(dividerX, cardTop + cardHeight - padding);
  ctx.stroke();

  // Left half of the card — straight into the consultant's own photo (no heading — the name right
  // below it already says who this is), sized up for legibility since removing the label freed up
  // the room for it.
  const leftHalfCenterX = cardX + (dividerX - cardX) / 2;
  const avatarSize = 130;
  const avatarX = leftHalfCenterX - avatarSize / 2;
  const avatarY = cardTop + 50;
  await drawAdvisorAvatar(ctx, data, avatarX, avatarY, avatarSize);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(24, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.fillText(data.advisor.name, leftHalfCenterX, avatarY + avatarSize + 32);

  ctx.font = labelFont(15, 400);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.fillText(data.advisor.role, leftHalfCenterX, avatarY + avatarSize + 55);

  ctx.font = displayFont(21, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillText(data.advisor.phoneDisplay, leftHalfCenterX, avatarY + avatarSize + 81);

  // Right half of the card — the WhatsApp QR, pre-filled to open a chat with this advisor. A
  // small red pill labels it (softer than a heavy stroked border), and the QR itself sits on a
  // plain white rounded card with a hairline edge and a faint drop shadow for a bit of lift.
  const qrHalfCenterX = dividerX + (cardX + cardWidth - dividerX) / 2;

  ctx.font = labelFont(12, 700);
  const pillLabel = 'SCAN TO WHATSAPP';
  const pillTextWidth = measureTrackedText(ctx, pillLabel, 1.2);
  const pillPaddingX = 16;
  const pillHeight = 27;
  const pillWidth = pillTextWidth + pillPaddingX * 2;
  const pillTop = cardTop + 24;
  ctx.beginPath();
  ctx.roundRect(qrHalfCenterX - pillWidth / 2, pillTop, pillWidth, pillHeight, pillHeight / 2);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fill();
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, pillLabel, qrHalfCenterX - pillTextWidth / 2, pillTop + pillHeight / 2, 1.2);

  const qrSize = 210;
  const qrCardPad = 14;
  const qrCardSize = qrSize + qrCardPad * 2;
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

export async function renderBrochurePage(canvas: HTMLCanvasElement, data: BrochureData, pageRows: BrochureRow[], pageIndex: number, pageCount: number): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  await drawHeader(ctx, data, pageIndex, pageCount);

  // The whole table — black header bar through the last row — sits inside one rounded-corner
  // border, like a card, instead of the header just having a plain accent rule along its bottom
  // edge. Everything inside is drawn through a matching rounded clip so square corners (the black
  // bar's top, a hairline divider near the bottom) never poke out past the curve.
  const barTop = HEADER_HEIGHT + TABLE_TOP_GAP;
  const rowsTop = barTop + TABLE_HEADER_HEIGHT;
  const availableHeight = PAGE_HEIGHT - FOOTER_HEIGHT - GAP_BEFORE_FOOTER - rowsTop;
  const maxRowHeight = 190;
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
    await drawRow(ctx, pageRows[i], rowTop, rowHeight, scale, i === pageRows.length - 1);
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
