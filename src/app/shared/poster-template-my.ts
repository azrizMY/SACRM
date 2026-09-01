/** Second poster template — a compact, monthly-payment-forward design: white top half (headline,
 *  car), black bottom half (big monthly figure, stats, tenure table, WhatsApp CTA). Rebuilt to
 *  match a detailed reference the user provided; per their instruction it follows that reference's
 *  LAYOUT closely but reuses this app's own established colour tokens (POSTER_COLORS) and fonts
 *  (Barlow Semi Condensed / Inter) rather than the reference's own palette/Poppins, so it reads as
 *  a sibling of the classic template.
 *
 *  Canvas width is 900 — exactly the classic template's own POSTER_WIDTH, not a separately-chosen
 *  size — specifically so the header (slash + eyebrow + headline) can reuse the classic template's
 *  literal numbers with zero scale-factor math. The two templates are shown at the same on-screen
 *  width, so any mismatch between their design-pixel widths would make identical raw values render
 *  at different visual sizes; matching the width outright is more robust than scaling every shared
 *  measurement by hand (which is what this file did before, and kept drifting out of sync). Every
 *  other measurement below — this template's own content, not shared with the classic one — is the
 *  original 1024-wide design scaled down by the same 900/1024 factor, so proportions stay intact. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { loadPosterImage } from './poster-images';
import { drawWhatsAppIcon } from './poster-whatsapp-icon';
import { fillPolygon, fillTrackedText } from './poster-draw-utils';
import type { PosterData } from './poster-data';
import type { PosterTemplate } from './poster-templates';

const WIDTH = 900;
const MARGIN = 56;
const WHITE_HEIGHT = 563;

function formatCurrencyCompact(value: number): string {
  return `RM${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawSwoosh(ctx: CanvasRenderingContext2D, y: number, amplitude: number, color: string, width: number): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-60, y);
  ctx.bezierCurveTo(WIDTH * 0.3, y - amplitude, WIDTH * 0.65, y + amplitude, WIDTH + 60, y - amplitude * 0.4);
  ctx.stroke();
  ctx.restore();
}

async function drawWhiteTop(ctx: CanvasRenderingContext2D, data: PosterData): Promise<void> {
  const M = MARGIN;
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, WIDTH, WHITE_HEIGHT);

  // Logo, right-aligned — drawn exactly as uploaded, no recolouring.
  const rightEdge = WIDTH - M;
  if (data.logoUrl) {
    try {
      const img = await loadPosterImage(data.logoUrl);
      const logoWidth = 132;
      const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
      ctx.drawImage(img, rightEdge - logoWidth, 46, logoWidth, logoHeight);
    } catch {
      ctx.font = labelFont(13, 700);
      ctx.fillStyle = POSTER_COLORS.ink;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.brand.toUpperCase(), rightEdge, 65);
    }
  } else {
    ctx.font = labelFont(13, 700);
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.brand.toUpperCase(), rightEdge, 65);
  }

  // Same slash + eyebrow + headline as the classic template's own header — same literal design-px
  // values, not scaled, since this canvas is now the same 900px width as the classic one.
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

  ctx.font = labelFont(9.5, 700);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'MONTHLY PAYMENT ESTIMATE', M + 16, 48, 2.8);

  // Model/variant headline sits below the eyebrow, mirroring the classic template's own vertical
  // order (eyebrow first, headline second) rather than the reverse.
  ctx.font = displayFont(46, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(data.modelTitle, M, 108);

  // Soft swoosh ribbons behind the car — a plain white bg has none of the classic template's dark
  // panels to give the hero visual weight, so these light neutral strokes stand in for that.
  drawSwoosh(ctx, 352, 23, '#ECECEC', 26);
  drawSwoosh(ctx, 387, 19, '#F4F4F4', 35);
}

async function drawCarHero(ctx: CanvasRenderingContext2D, data: PosterData): Promise<void> {
  if (!data.carImageUrl) return;
  const boxWidth = 668;
  const boxHeight = 316;
  const boxBottom = WHITE_HEIGHT - 9;
  try {
    const img = await loadPosterImage(data.carImageUrl);
    const scale = Math.min(boxWidth / img.naturalWidth, boxHeight / img.naturalHeight);
    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;
    const drawX = (WIDTH - drawWidth) / 2;
    const drawY = boxBottom - drawHeight;
    ctx.save();
    ctx.filter = 'drop-shadow(0px 14px 12px rgba(0,0,0,0.22))';
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  } catch {
    /* leave the hero band blank rather than show a broken-image icon */
  }
}

function drawPriceBlock(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const lowest = data.tenureRows.find((r) => r.isLowest) ?? data.tenureRows[0];
  const centerX = WIDTH / 2;

  // Subtle red glow behind the figure. Filled at the gradient's own full diameter (not a
  // narrower box) so it actually fades to transparent before its edge instead of getting hard-cut
  // by the fill rect — and clipped to the black section only, since the gradient's radius reaches
  // above the white/black boundary and would otherwise tint the white header pink.
  const glowCenterY = top + 79;
  const glowRadius = 229;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, WHITE_HEIGHT + 3, WIDTH, glowRadius * 2);
  ctx.clip();
  const glow = ctx.createRadialGradient(centerX, glowCenterY, 0, centerX, glowCenterY, glowRadius);
  glow.addColorStop(0, 'rgba(214, 30, 42, 0.18)');
  glow.addColorStop(1, 'rgba(214, 30, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(centerX - glowRadius, glowCenterY - glowRadius, glowRadius * 2, glowRadius * 2);
  ctx.restore();

  const amountBaseline = top + 88;
  const amountText = lowest ? Math.floor(lowest.monthly).toLocaleString('en-MY') : '0';
  ctx.font = displayFont(79, 700);
  const amountWidth = ctx.measureText(amountText).width;
  ctx.font = displayFont(26, 700);
  const rmWidth = ctx.measureText('RM').width;
  const gap = 8;
  const groupWidth = rmWidth + gap + amountWidth;
  const groupLeft = centerX - groupWidth / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(26, 700);
  ctx.fillStyle = '#E6303F';
  ctx.fillText('RM', groupLeft, amountBaseline - 5);

  ctx.font = displayFont(79, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillText(amountText, groupLeft + rmWidth + gap, amountBaseline);

  const perMonthBaseline = amountBaseline + 44;
  ctx.font = displayFont(26, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'center';
  ctx.fillText('per month', centerX, perMonthBaseline);

  const captionY = perMonthBaseline + 40;
  if (lowest) {
    const years = Math.round(lowest.months / 12);
    ctx.font = labelFont(12, 700);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textBaseline = 'middle';
    const caption = `ESTIMATE OVER ${years} YEARS`;
    const captionWidth = ctx.measureText(caption).width;
    const lineGap = 14;
    ctx.fillText(caption, centerX, captionY);
    ctx.strokeStyle = POSTER_COLORS.partition;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - captionWidth / 2 - lineGap - 53, captionY);
    ctx.lineTo(centerX - captionWidth / 2 - lineGap, captionY);
    ctx.moveTo(centerX + captionWidth / 2 + lineGap, captionY);
    ctx.lineTo(centerX + captionWidth / 2 + lineGap + 53, captionY);
    ctx.stroke();
  }

  return captionY + 35;
}

function drawStatsRow(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const M = MARGIN;
  ctx.fillStyle = POSTER_COLORS.partition;
  ctx.fillRect(M, top, WIDTH - 2 * M, 1);

  const columns = [
    { label: 'OTR PRICE', value: formatCurrencyCompact(data.otrPrice).replace('.00', '') },
    { label: 'DOWNPAYMENT', value: formatCurrencyCompact(data.downpayment) },
    { label: 'INTEREST RATE', value: `${data.interestRatePct}%` },
  ];
  const colWidth = (WIDTH - 2 * M) / 3;
  const labelY = top + 35;
  const valueY = top + 65;

  columns.forEach((col, i) => {
    const cx = M + colWidth * i + colWidth / 2;

    ctx.font = labelFont(11, 700);
    ctx.fillStyle = POSTER_COLORS.panelGray;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(col.label, cx, labelY);

    ctx.font = displayFont(21, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.fillText(col.value, cx, valueY);

    if (i > 0) {
      const dividerX = M + colWidth * i;
      ctx.fillStyle = POSTER_COLORS.partition;
      ctx.fillRect(dividerX, top + 14, 1, 70);
    }
  });

  return top + 98;
}

function drawTenureTable(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const M = MARGIN;
  const tableWidth = WIDTH - 2 * M;
  const headerHeight = 47;
  const rowHeight = 60;
  const radius = 14;
  const tableHeight = headerHeight + rowHeight * data.tenureRows.length;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(M, top, tableWidth, tableHeight, radius);
  ctx.clip();

  // panelCard, not ink — ink sits almost exactly on the page's own background gradient, so the
  // header row would have no visible edge against it; panelCard is the lighter tile tone already
  // used elsewhere for exactly this "distinct from the background" purpose.
  ctx.fillStyle = POSTER_COLORS.panelCard;
  ctx.fillRect(M, top, tableWidth, headerHeight);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(M, top + headerHeight - 2, tableWidth, 2);

  ctx.font = labelFont(11, 700);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('TENURE', M + 25, top + headerHeight / 2);
  ctx.textAlign = 'right';
  ctx.fillText('MONTHLY', WIDTH - M - 25, top + headerHeight / 2);

  data.tenureRows.forEach((row, i) => {
    const rowTop = top + headerHeight + i * rowHeight;
    const centerY = rowTop + rowHeight / 2;
    ctx.fillStyle = POSTER_COLORS.block;
    ctx.fillRect(M, rowTop, tableWidth, rowHeight);
    if (i > 0) {
      ctx.fillStyle = POSTER_COLORS.partition;
      ctx.fillRect(M, rowTop, tableWidth, 1);
    }

    const years = Math.round(row.months / 12);
    ctx.font = labelFont(15, 700);
    ctx.fillStyle = '#ECECF0';
    ctx.textAlign = 'left';
    ctx.fillText(`${years} Yrs`, M + 25, centerY);

    ctx.font = displayFont(21, 700);
    ctx.fillStyle = POSTER_COLORS.acc;
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrencyCompact(row.monthly), WIDTH - M - 25, centerY);
  });

  ctx.restore();
  return top + tableHeight;
}

async function drawAdvisorRow(ctx: CanvasRenderingContext2D, data: PosterData, top: number): Promise<number> {
  const M = MARGIN;
  const avatarSize = 81;
  const ringWidth = 2.6;
  const centerY = top + avatarSize / 2;
  const cx = M + avatarSize / 2;

  const drawRing = () => {
    ctx.beginPath();
    ctx.arc(cx, centerY, avatarSize / 2 + ringWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = POSTER_COLORS.acc;
    ctx.lineWidth = ringWidth;
    ctx.stroke();
  };

  if (data.advisor.photoUrl) {
    try {
      const img = await loadPosterImage(data.advisor.photoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, centerY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      const scale = Math.max(avatarSize / img.naturalWidth, avatarSize / img.naturalHeight);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      ctx.drawImage(img, M + (avatarSize - drawWidth) / 2, top + (avatarSize - drawHeight) / 2, drawWidth, drawHeight);
      ctx.restore();
      drawRing();
    } catch {
      drawAdvisorInitials(ctx, data, M, top, avatarSize, centerY);
      drawRing();
    }
  } else {
    drawAdvisorInitials(ctx, data, M, top, avatarSize, centerY);
    drawRing();
  }

  // Sized up alongside the bigger avatar — this is the sales advisor's own personal branding on
  // the poster, so name/role need to actually read at a glance, not just technically be present.
  const textX = M + avatarSize + 18;
  ctx.font = displayFont(26, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.name, textX, centerY - 13);

  ctx.font = labelFont(16, 400);
  ctx.fillStyle = POSTER_COLORS.grayD;
  ctx.fillText(data.advisor.role, textX, centerY + 15);

  return top + avatarSize;
}

function drawAdvisorInitials(ctx: CanvasRenderingContext2D, data: PosterData, x: number, y: number, size: number, centerY: number): void {
  ctx.beginPath();
  ctx.arc(x + size / 2, centerY, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = POSTER_COLORS.panelCard;
  ctx.fill();
  ctx.font = displayFont(19, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.initials, x + size / 2, centerY);
}

function drawCtaBar(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const M = MARGIN;
  const barWidth = WIDTH - 2 * M;
  const barHeight = 60;
  const radius = 12;

  const gradient = ctx.createLinearGradient(M, 0, M + barWidth, 0);
  gradient.addColorStop(0, '#1FB955');
  gradient.addColorStop(1, POSTER_COLORS.waGreen);
  ctx.beginPath();
  ctx.roundRect(M, top, barWidth, barHeight, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  const centerY = top + barHeight / 2;
  const iconX = M + 23;
  const iconSize = 26;

  // Green bubble on a translucent white circle would barely contrast against this already-green
  // bar — filling the bubble in the bar's own green instead makes it disappear into the
  // background, leaving just a clean white handset floating on green (the common real-world
  // WhatsApp-button look), rather than the near-invisible white-on-white result of a white bubble.
  drawWhatsAppIcon(ctx, iconX, centerY - iconSize / 2, iconSize, POSTER_COLORS.waGreen);

  ctx.font = displayFont(18, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('WhatsApp Me Now', iconX + iconSize + 16, centerY);

  ctx.font = displayFont(20, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'right';
  ctx.fillText(data.advisor.phoneDisplay, M + barWidth - 26, centerY);

  return top + barHeight;
}

/** Every block below the black top rule is a fixed height except the tenure table, which grows
 *  by one row (60px) per tenure — this closed-form total lets the canvas be sized correctly on
 *  the very first (and only) draw pass, rather than rendering once to measure and again for real. */
function computeTotalHeight(data: PosterData): number {
  const priceBlockHeight = 207;
  const statsRowHeight = 98 + 21;
  const tableHeight = 47 + 60 * data.tenureRows.length + 35;
  const advisorHeight = 81 + 35;
  const ctaHeight = 60 + 40;
  const contentTop = WHITE_HEIGHT + 3 + 48;
  return contentTop + priceBlockHeight + statsRowHeight + tableHeight + advisorHeight + ctaHeight;
}

export const compactMyTemplate: PosterTemplate = {
  id: 'compact-my',
  label: 'Monthly Estimate',
  async render(canvas, data, scale, isStale) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalHeight = computeTotalHeight(data);
    canvas.width = WIDTH * scale;
    canvas.height = totalHeight * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bg = ctx.createLinearGradient(0, WHITE_HEIGHT, 0, totalHeight);
    bg.addColorStop(0, POSTER_COLORS.panelA);
    bg.addColorStop(1, POSTER_COLORS.panelB);
    ctx.fillStyle = bg;
    ctx.fillRect(0, WHITE_HEIGHT, WIDTH, totalHeight - WHITE_HEIGHT);
    ctx.fillStyle = POSTER_COLORS.acc;
    ctx.fillRect(0, WHITE_HEIGHT, WIDTH, 3);

    await drawWhiteTop(ctx, data);
    if (isStale()) return;
    await drawCarHero(ctx, data);
    if (isStale()) return;

    let cursor = WHITE_HEIGHT + 3 + 48;
    cursor = drawPriceBlock(ctx, data, cursor);
    cursor = drawStatsRow(ctx, data, cursor) + 21;
    cursor = drawTenureTable(ctx, data, cursor) + 35;
    cursor = (await drawAdvisorRow(ctx, data, cursor)) + 35;
    if (isStale()) return;
    drawCtaBar(ctx, data, cursor);
  },
};
