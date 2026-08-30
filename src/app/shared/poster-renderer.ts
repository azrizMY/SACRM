import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { MARGIN, POSTER_WIDTH, CHIP_HEIGHT, CHIP_GAP, CHIP_NOTCH, CHIP_PADDING_X, CHIP_ICON_AND_GAP, type PosterLayout } from './poster-layout';
import { fillPolygon, fillTrackedText, fillNotchedRect, notchedRectPath, formatPosterCurrency, measureTrackedText } from './poster-draw-utils';
import { loadPosterImage } from './poster-images';
import { drawWhatsAppIcon } from './poster-whatsapp-icon';
import type { PosterData } from './poster-data';

/** Paints every band's background exactly as the spec's vertical map describes, before any text
 *  or artwork goes on top — this is the skeleton every later drawing stage layers onto.
 *
 *  - Header + car hero: solid --paper (white) from y=0 straight through to the price panel's top
 *    rule — the spec never calls out a seam between them, so the white is one continuous fill,
 *    only conceptually split into "header content area" and "hero content area".
 *  - Price panel: horizontal gradient --panel-a → --panel-b, 3px --acc rule at its top.
 *  - Inclusions gap (when present): same --data-bg as the data section, since the chips visually
 *    belong to that continuation rather than to the panel above them.
 *  - Data section: solid --data-bg, 1px --hairline at its top.
 *  - Footer: horizontal gradient --footer-a → --footer-b, 3px --acc rule at its top.
 */
export function drawPosterSkeleton(ctx: CanvasRenderingContext2D, layout: PosterLayout): void {
  const width = POSTER_WIDTH;

  // Header + car hero: one continuous white field down to the panel's top rule.
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, width, layout.panelTop);

  // Price panel.
  const panelGradient = ctx.createLinearGradient(0, 0, width, 0);
  panelGradient.addColorStop(0, POSTER_COLORS.panelA);
  panelGradient.addColorStop(1, POSTER_COLORS.panelB);
  ctx.fillStyle = panelGradient;
  ctx.fillRect(0, layout.panelTop, width, layout.panelHeight);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(0, layout.panelTop, width, 3);

  // Inclusions gap + data section share one dark field down to the footer.
  ctx.fillStyle = POSTER_COLORS.dataBg;
  ctx.fillRect(0, layout.panelBottom, width, layout.footerTop - layout.panelBottom);
  ctx.fillStyle = POSTER_COLORS.hairline;
  ctx.fillRect(0, layout.dataSectionTop, width, 1);

  // Footer.
  const footerGradient = ctx.createLinearGradient(0, 0, width, 0);
  footerGradient.addColorStop(0, POSTER_COLORS.footerA);
  footerGradient.addColorStop(1, POSTER_COLORS.footerB);
  ctx.fillStyle = footerGradient;
  ctx.fillRect(0, layout.footerTop, width, layout.footerHeight);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(0, layout.footerTop, width, 3);
}

function drawBrandFallback(ctx: CanvasRenderingContext2D, brand: string, rightEdge: number): void {
  ctx.font = labelFont(13, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(brand.toUpperCase(), rightEdge, 56);
}

/** Section 1 — header (background --paper): red slash, eyebrow, brand logo (tinted --ink, or a
 *  plain text fallback when the vehicle has no uploaded logo), headline, year tag, date. */
export async function drawHeader(ctx: CanvasRenderingContext2D, data: PosterData): Promise<void> {
  const M = MARGIN;

  // Red slash: 4px-wide parallelogram, 16px tall, skewed 6px — left edge (M,56) to (M+6,40).
  fillPolygon(
    ctx,
    [
      [M + 6, 40],
      [M + 10, 40],
      [M + 4, 56],
      [M, 56],
    ],
    POSTER_COLORS.acc,
  );

  // Eyebrow.
  ctx.font = labelFont(9.5, 700);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'VEHICLE LOAN ESTIMATE', M + 16, 48, 2.8);

  // Brand logo, right-aligned to 900-M — drawn exactly as uploaded (no recolouring: the dealer's
  // own logo file is the source of truth for its colours) — or the text fallback if this vehicle
  // has none.
  const rightEdge = POSTER_WIDTH - M;
  if (data.logoUrl) {
    try {
      const img = await loadPosterImage(data.logoUrl);
      const logoWidth = 104;
      const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
      ctx.drawImage(img, rightEdge - logoWidth, 34, logoWidth, logoHeight);
    } catch {
      drawBrandFallback(ctx, data.brand, rightEdge);
    }
  } else {
    drawBrandFallback(ctx, data.brand, rightEdge);
  }

  // Date — its own line under the logo.
  ctx.font = labelFont(12.5, 400);
  ctx.fillStyle = POSTER_COLORS.grayD;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.dateStr, rightEdge, 134);

  // Headline.
  ctx.font = displayFont(46, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(data.modelTitle, M, 108);

  // 2026 tag: 76x24 parallelogram, top-left (M+8,122), bottom-left (M,146).
  fillPolygon(
    ctx,
    [
      [M + 8, 122],
      [M + 84, 122],
      [M + 76, 146],
      [M, 146],
    ],
    POSTER_COLORS.acc,
  );
  ctx.font = labelFont(12, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(data.year), M + 42, 134);
}

/** Section 2 — car hero (background --paper): the uploaded cutout, object-contain within its
 *  528x298 box, plus a blurred contact-shadow ellipse. Draws nothing when the vehicle has no
 *  photo yet — the white band stays empty rather than showing a placeholder. */
export async function drawCarHero(ctx: CanvasRenderingContext2D, layout: PosterLayout, data: PosterData): Promise<void> {
  if (!data.carImageUrl) return;

  const heroWidth = 528;
  const heroHeight = 298;
  const heroX = (POSTER_WIDTH - heroWidth) / 2;
  const heroY = layout.carHeroTop;

  const shadowLeft = heroX + 74;
  const shadowTop = heroY + 278;
  const shadowRight = heroX + 454;
  const shadowBottom = heroY + 304;
  const cx = (shadowLeft + shadowRight) / 2;
  const cy = (shadowTop + shadowBottom) / 2;
  const rx = (shadowRight - shadowLeft) / 2;
  const ry = (shadowBottom - shadowTop) / 2;

  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = 'rgba(70, 70, 78, 0.43)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  try {
    const img = await loadPosterImage(data.carImageUrl);
    // object-contain within the 528x298 box — the upload never stretches.
    const scale = Math.min(heroWidth / img.naturalWidth, heroHeight / img.naturalHeight);
    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;
    const drawX = heroX + (heroWidth - drawWidth) / 2;
    const drawY = heroY + (heroHeight - drawHeight) / 2;
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  } catch {
    // Broken/unreadable upload — leave the hero band blank rather than show a broken-image icon.
  }
}

/** Draws an image cropped/scaled to cover an arbitrary box (like CSS object-fit: cover), clipped
 *  to whatever path is already current on the context — used for the consultant avatar tile. */
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number): void {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

/** Section 3 — price panel (background already painted by drawPosterSkeleton): accent bar,
 *  selling price, downpayment/loan-amount stat tiles, and the consultant block. The consultant
 *  block must stay inside this band per the spec's rule 2 — it never migrates to the footer. */
export async function drawPricePanel(ctx: CanvasRenderingContext2D, data: PosterData): Promise<void> {
  const M = MARGIN;

  // Accent bar.
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(M, 522, 38, 3);

  // "SELLING PRICE" label.
  ctx.font = labelFont(9.5, 700);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'SELLING PRICE', M, 550, 2.8);

  // Selling price figure.
  ctx.font = displayFont(50, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(formatPosterCurrency(data.sellingPrice), M, 610);

  // Downpayment / Loan Amount stat tiles.
  const boxY = 634;
  const boxHeight = 74;
  const boxWidth = 196;
  const boxes: { x: number; label: string; value: number }[] = [
    { x: M, label: 'DOWNPAYMENT', value: data.downpayment },
    { x: M + 210, label: 'LOAN AMOUNT', value: data.loanAmount },
  ];
  for (const box of boxes) {
    fillNotchedRect(ctx, box.x, boxY, boxWidth, boxHeight, 14, POSTER_COLORS.panelCard);
    ctx.fillStyle = POSTER_COLORS.acc;
    ctx.fillRect(box.x, boxY, 3, boxHeight);

    ctx.font = labelFont(9, 700);
    ctx.fillStyle = POSTER_COLORS.panelGray;
    ctx.textBaseline = 'middle';
    fillTrackedText(ctx, box.label, box.x + 18, boxY + 24, 2.2);

    ctx.font = displayFont(22, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.textAlign = 'left';
    ctx.fillText(formatPosterCurrency(box.value), box.x + 18, boxY + 54);
  }

  // Consultant block — avatar tile, name, role, WhatsApp label, phone.
  const avatarX = 528;
  const avatarY = 550;
  const avatarSize = 64;
  if (data.advisor.photoUrl) {
    try {
      const img = await loadPosterImage(data.advisor.photoUrl);
      ctx.save();
      notchedRectPath(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
      ctx.clip();
      drawImageCover(ctx, img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } catch {
      drawAdvisorInitialsTile(ctx, data, avatarX, avatarY, avatarSize);
    }
  } else {
    drawAdvisorInitialsTile(ctx, data, avatarX, avatarY, avatarSize);
  }

  ctx.font = displayFont(23, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.name, 610, 576);

  ctx.font = labelFont(12, 400);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.fillText(data.advisor.role, 610, 599);

  ctx.font = labelFont(9, 700);
  ctx.fillStyle = POSTER_COLORS.panelGrayD;
  fillTrackedText(ctx, 'WHATSAPP', avatarX, 660, 2.2);

  ctx.font = displayFont(26, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillText(data.advisor.phoneDisplay, avatarX, 692);
}

function drawAdvisorInitialsTile(ctx: CanvasRenderingContext2D, data: PosterData, x: number, y: number, size: number): void {
  fillNotchedRect(ctx, x, y, size, size, 14, POSTER_COLORS.panelCard);
  ctx.font = displayFont(22, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.initials, x + size / 2, y + size / 2);
}

/** Section 4 — data section (background --data-bg, hairline already painted by
 *  drawPosterSkeleton): the price-breakdown table on the left and the monthly-estimate cards on
 *  the right. Every y-coordinate here is derived from `layout.dataLabelY`, never a literal from
 *  the spec's base-case numbers, so this reflows correctly whether or not the optional "what's
 *  included" chips pushed the whole section down. */
export function drawDataSection(ctx: CanvasRenderingContext2D, layout: PosterLayout, data: PosterData): void {
  const leftX = 56;
  const leftWidth = 372;
  const rightX = 488;
  const rightWidth = 356;
  const labelY = layout.dataLabelY;
  // The spec's base case has content start 28px below the section labels (816 - 788 = 28) —
  // the same offset it uses for the inclusions chips below their own label.
  const contentTop = labelY + 28;

  // Section labels + rate.
  ctx.font = labelFont(9.5, 700);
  ctx.fillStyle = POSTER_COLORS.panelGrayD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'PRICE BREAKDOWN', leftX, labelY, 2.8);
  fillTrackedText(ctx, 'MONTHLY ESTIMATE', rightX, labelY, 2.8);

  ctx.fillStyle = POSTER_COLORS.acc;
  const rateText = data.rateLabel.toUpperCase();
  const rateWidth = measureTrackedText(ctx, rateText, 2.8);
  fillTrackedText(ctx, rateText, 844 - rateWidth, labelY, 2.8);

  // ---- Left: price breakdown ----
  const rows: { label: string; sub: string; subColor: string; value: string; valueColor: string }[] = [
    {
      label: 'OTR price',
      sub: '(without insurance)',
      subColor: POSTER_COLORS.panelGray,
      value: formatPosterCurrency(data.otrPrice),
      valueColor: POSTER_COLORS.paper,
    },
    {
      label: 'Insurance',
      sub: `(${data.ncdPct}% NCD)`,
      subColor: POSTER_COLORS.panelGray,
      value: `+ ${formatPosterCurrency(data.insurance)}`,
      valueColor: POSTER_COLORS.amber,
    },
    {
      label: 'Rebate',
      sub: 'you save',
      subColor: POSTER_COLORS.green,
      value: `− ${formatPosterCurrency(data.rebate)}`,
      valueColor: POSTER_COLORS.green,
    },
  ];
  const rowHeight = 46;
  const tableTop = contentTop;
  ctx.fillStyle = POSTER_COLORS.block;
  ctx.fillRect(leftX, tableTop, leftWidth, rowHeight * rows.length);

  rows.forEach((row, i) => {
    const rowTop = tableTop + i * rowHeight;
    const centerY = rowTop + rowHeight / 2;
    if (i > 0) {
      ctx.fillStyle = POSTER_COLORS.partition;
      ctx.fillRect(leftX, rowTop, leftWidth, 1);
    }

    ctx.font = labelFont(14, 400);
    ctx.fillStyle = '#ECECF0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, 74, centerY);
    const labelWidth = ctx.measureText(row.label).width;

    ctx.font = labelFont(11, 400);
    ctx.fillStyle = row.subColor;
    ctx.fillText(row.sub, 74 + labelWidth + 6, centerY);

    ctx.font = labelFont(14.5, 700);
    ctx.fillStyle = row.valueColor;
    ctx.textAlign = 'right';
    ctx.fillText(row.value, 410, centerY);
  });

  // Total strip.
  const totalStripTop = tableTop + rowHeight * rows.length;
  const totalStripHeight = 68;
  ctx.fillStyle = POSTER_COLORS.blockTotal;
  ctx.fillRect(leftX, totalStripTop, leftWidth, totalStripHeight);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(leftX, totalStripTop, 4, totalStripHeight);

  ctx.font = labelFont(9, 700);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'TOTAL AMOUNT DUE', 76, totalStripTop + 23, 2.2);

  ctx.font = displayFont(27, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillText(formatPosterCurrency(data.totalAmountDue), 76, totalStripTop + 48);

  // ---- Right: monthly estimate cards ----
  const cardHeight = 56;
  const cardGap = 10;
  data.tenureRows.forEach((row, i) => {
    const cardTop = contentTop + i * (cardHeight + cardGap);
    const centerY = cardTop + cardHeight / 2;
    fillNotchedRect(ctx, rightX, cardTop, rightWidth, cardHeight, 14, row.isLowest ? POSTER_COLORS.acc : POSTER_COLORS.block);

    ctx.font = labelFont(13, 700);
    ctx.fillStyle = row.isLowest ? POSTER_COLORS.paper : POSTER_COLORS.panelGray;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.label, rightX + 18, centerY);

    if (row.isLowest) {
      const pillX = rightX + 74;
      const pillWidth = 54;
      const pillHeight = 18;
      const pillY = cardTop + (cardHeight - pillHeight) / 2;
      ctx.fillStyle = POSTER_COLORS.paper;
      ctx.fillRect(pillX, pillY, pillWidth, pillHeight);

      ctx.font = labelFont(7.5, 700);
      ctx.fillStyle = POSTER_COLORS.acc;
      const lowestWidth = measureTrackedText(ctx, 'LOWEST', 1.3);
      fillTrackedText(ctx, 'LOWEST', pillX + (pillWidth - lowestWidth) / 2, pillY + pillHeight / 2, 1.3);
    }

    ctx.font = displayFont(23, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.textAlign = 'right';
    ctx.fillText(formatPosterCurrency(row.monthly), 826, centerY);
  });
}

/** Section 5 — footer (background/top rule already painted by drawPosterSkeleton): the WhatsApp
 *  CTA. Every y-coordinate is an offset from `layout.footerTop`, matching the spec's own base-case
 *  numbers (1088/1100/1126/1112 against a 1048 footer top) so this stays correct regardless of
 *  how much the optional inclusions section pushed the footer down. */
export function drawFooter(ctx: CanvasRenderingContext2D, layout: PosterLayout, data: PosterData): void {
  const top = layout.footerTop;

  drawWhatsAppIcon(ctx, 56, top + 40, 44, POSTER_COLORS.waGreen);

  ctx.font = displayFont(25, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('WhatsApp me now', 116, top + 52);

  ctx.font = labelFont(12, 400);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.fillText('Check your eligibility before the current promotion ends', 116, top + 78);

  ctx.font = displayFont(30, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'right';
  ctx.fillText(data.advisor.phoneDisplay, 844, top + 64);
}

/** Optional "What's Included" chips, sitting in the gap between the price panel and the data
 *  section — no-ops entirely when the vehicle has no offers, so 0-item posters render exactly as
 *  if this stage didn't exist. `layout.offerRows` is already wrapped by computePosterLayout; this
 *  only has to re-measure each label to find its chip's x position within its row, using the same
 *  width formula the wrapping pass used so the two never disagree. */
export function drawInclusions(ctx: CanvasRenderingContext2D, layout: PosterLayout): void {
  if (!layout.hasOffers) return;
  const M = MARGIN;

  ctx.font = labelFont(9.5, 700);
  ctx.fillStyle = POSTER_COLORS.panelGrayD;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, "WHAT'S INCLUDED", M, layout.inclusionsLabelY, 2.8);

  const chipFont = labelFont(13, 400);
  layout.offerRows.forEach((row, rowIndex) => {
    const rowTop = layout.inclusionsChipsTop + rowIndex * (CHIP_HEIGHT + CHIP_GAP);
    const centerY = rowTop + CHIP_HEIGHT / 2;
    let x = M;
    for (const item of row) {
      ctx.font = chipFont;
      const textWidth = ctx.measureText(item).width;
      const chipWidth = textWidth + CHIP_PADDING_X * 2 + CHIP_ICON_AND_GAP;
      fillNotchedRect(ctx, x, rowTop, chipWidth, CHIP_HEIGHT, CHIP_NOTCH, POSTER_COLORS.block);

      ctx.font = labelFont(13, 700);
      ctx.fillStyle = POSTER_COLORS.green;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x + CHIP_PADDING_X, centerY);

      ctx.font = chipFont;
      ctx.fillStyle = POSTER_COLORS.paper;
      ctx.fillText(item, x + CHIP_PADDING_X + CHIP_ICON_AND_GAP, centerY);

      x += chipWidth + CHIP_GAP;
    }
  });
}
