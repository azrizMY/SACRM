/** Second poster template — a compact, Malay-language, monthly-payment-forward design: white top
 *  half (headline, car), black bottom half (big monthly figure, stats, tenure table, WhatsApp
 *  CTA). Rebuilt to match a detailed reference the user provided; per their instruction it follows
 *  that reference's LAYOUT closely but reuses this app's own established colour tokens
 *  (POSTER_COLORS) and fonts (Barlow Semi Condensed / Inter) rather than the reference's own
 *  palette/Poppins, so it reads as a sibling of the classic template. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { loadPosterImage } from './poster-images';
import { drawWhatsAppIcon } from './poster-whatsapp-icon';
import { fillPolygon, fillTrackedText } from './poster-draw-utils';
import type { PosterData } from './poster-data';
import type { PosterTemplate } from './poster-templates';

const WIDTH = 1024;
const MARGIN = 60;
const WHITE_HEIGHT = 640;

function formatCurrencyMy(value: number): string {
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
      const logoWidth = 150;
      const logoHeight = (img.naturalHeight / img.naturalWidth) * logoWidth;
      ctx.drawImage(img, rightEdge - logoWidth, 52, logoWidth, logoHeight);
    } catch {
      ctx.font = labelFont(15, 700);
      ctx.fillStyle = POSTER_COLORS.ink;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(data.brand.toUpperCase(), rightEdge, 74);
    }
  } else {
    ctx.font = labelFont(15, 700);
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.brand.toUpperCase(), rightEdge, 74);
  }

  ctx.font = displayFont(60, 700);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(data.modelTitle, M, 110);

  // Same slash + eyebrow treatment as the classic template's "VEHICLE LOAN ESTIMATE" line, scaled
  // up by 1024/900 (this canvas's own design width over the classic template's) — both posters
  // are displayed at the same on-screen width, so matching only the raw design-px values would
  // actually render smaller here; this keeps the two visually identical size on screen.
  const eyebrowScale = WIDTH / 900;
  fillPolygon(
    ctx,
    [
      [M + 7, 142],
      [M + 11, 142],
      [M + 5, 160],
      [M, 160],
    ],
    POSTER_COLORS.acc,
  );

  ctx.font = labelFont(9.5 * eyebrowScale, 700);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.textBaseline = 'middle';
  fillTrackedText(ctx, 'ANGGARAN BAYARAN BULANAN', M + 18, 152, 2.8 * eyebrowScale);

  // Soft swoosh ribbons behind the car — a plain white bg has none of the classic template's dark
  // panels to give the hero visual weight, so these light neutral strokes stand in for that.
  drawSwoosh(ctx, 400, 26, '#ECECEC', 30);
  drawSwoosh(ctx, 440, 22, '#F4F4F4', 40);
}

async function drawCarHero(ctx: CanvasRenderingContext2D, data: PosterData): Promise<void> {
  if (!data.carImageUrl) return;
  const boxWidth = 760;
  const boxHeight = 360;
  const boxBottom = WHITE_HEIGHT - 10;
  try {
    const img = await loadPosterImage(data.carImageUrl);
    const scale = Math.min(boxWidth / img.naturalWidth, boxHeight / img.naturalHeight);
    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;
    const drawX = (WIDTH - drawWidth) / 2;
    const drawY = boxBottom - drawHeight;
    ctx.save();
    ctx.filter = 'drop-shadow(0px 16px 14px rgba(0,0,0,0.22))';
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
  const glowCenterY = top + 90;
  const glowRadius = 260;
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

  const amountBaseline = top + 100;
  const amountText = lowest ? Math.floor(lowest.monthly).toLocaleString('en-MY') : '0';
  ctx.font = displayFont(90, 700);
  const amountWidth = ctx.measureText(amountText).width;
  ctx.font = displayFont(30, 700);
  const rmWidth = ctx.measureText('RM').width;
  const gap = 9;
  const groupWidth = rmWidth + gap + amountWidth;
  const groupLeft = centerX - groupWidth / 2;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(30, 700);
  ctx.fillStyle = '#E6303F';
  ctx.fillText('RM', groupLeft, amountBaseline - 6);

  ctx.font = displayFont(90, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillText(amountText, groupLeft + rmWidth + gap, amountBaseline);

  const sebulanBaseline = amountBaseline + 50;
  ctx.font = displayFont(30, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'center';
  ctx.fillText('sebulan', centerX, sebulanBaseline);

  const captionY = sebulanBaseline + 46;
  if (lowest) {
    const years = Math.round(lowest.months / 12);
    ctx.font = labelFont(14, 700);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textBaseline = 'middle';
    const caption = `ANGGARAN ${years} TAHUN`;
    const captionWidth = ctx.measureText(caption).width;
    const lineGap = 16;
    ctx.fillText(caption, centerX, captionY);
    ctx.strokeStyle = POSTER_COLORS.partition;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - captionWidth / 2 - lineGap - 60, captionY);
    ctx.lineTo(centerX - captionWidth / 2 - lineGap, captionY);
    ctx.moveTo(centerX + captionWidth / 2 + lineGap, captionY);
    ctx.lineTo(centerX + captionWidth / 2 + lineGap + 60, captionY);
    ctx.stroke();
  }

  return captionY + 40;
}

function drawStatsRow(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const M = MARGIN;
  ctx.fillStyle = POSTER_COLORS.partition;
  ctx.fillRect(M, top, WIDTH - 2 * M, 1);

  const columns = [
    { label: 'HARGA KERETA', value: formatCurrencyMy(data.otrPrice).replace('.00', '') },
    { label: 'DP SELEPAS REBATE', value: formatCurrencyMy(data.downpayment) },
    { label: 'KADAR FAEDAH', value: `${data.interestRatePct}%` },
  ];
  const colWidth = (WIDTH - 2 * M) / 3;
  const labelY = top + 40;
  const valueY = top + 74;

  columns.forEach((col, i) => {
    const cx = M + colWidth * i + colWidth / 2;

    ctx.font = labelFont(12.5, 700);
    ctx.fillStyle = POSTER_COLORS.panelGray;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(col.label, cx, labelY);

    ctx.font = displayFont(24, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.fillText(col.value, cx, valueY);

    if (i > 0) {
      const dividerX = M + colWidth * i;
      ctx.fillStyle = POSTER_COLORS.partition;
      ctx.fillRect(dividerX, top + 16, 1, 80);
    }
  });

  return top + 112;
}

function drawTenureTable(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const M = MARGIN;
  const tableWidth = WIDTH - 2 * M;
  const headerHeight = 54;
  const rowHeight = 68;
  const radius = 16;
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

  ctx.font = labelFont(13, 700);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('TEMPOH', M + 28, top + headerHeight / 2);
  ctx.textAlign = 'right';
  ctx.fillText('BULANAN', WIDTH - M - 28, top + headerHeight / 2);

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
    ctx.font = labelFont(17, 700);
    ctx.fillStyle = '#ECECF0';
    ctx.textAlign = 'left';
    ctx.fillText(`${years} Tahun`, M + 28, centerY);

    ctx.font = displayFont(24, 700);
    ctx.fillStyle = POSTER_COLORS.acc;
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrencyMy(row.monthly), WIDTH - M - 28, centerY);
  });

  ctx.restore();
  return top + tableHeight;
}

async function drawAdvisorRow(ctx: CanvasRenderingContext2D, data: PosterData, top: number): Promise<number> {
  const M = MARGIN;
  const avatarSize = 70;
  const ringWidth = 2.5;
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

  const textX = M + avatarSize + 18;
  ctx.font = displayFont(23, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.name, textX, centerY - 12);

  ctx.font = labelFont(14, 400);
  ctx.fillStyle = POSTER_COLORS.grayD;
  ctx.fillText(data.advisor.role, textX, centerY + 14);

  return top + avatarSize;
}

function drawAdvisorInitials(ctx: CanvasRenderingContext2D, data: PosterData, x: number, y: number, size: number, centerY: number): void {
  ctx.beginPath();
  ctx.arc(x + size / 2, centerY, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = POSTER_COLORS.panelCard;
  ctx.fill();
  ctx.font = displayFont(22, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.advisor.initials, x + size / 2, centerY);
}

function drawCtaBar(ctx: CanvasRenderingContext2D, data: PosterData, top: number): number {
  const M = MARGIN;
  const barWidth = WIDTH - 2 * M;
  const barHeight = 90;
  const radius = 18;

  const gradient = ctx.createLinearGradient(M, 0, M + barWidth, 0);
  gradient.addColorStop(0, '#1FB955');
  gradient.addColorStop(1, POSTER_COLORS.waGreen);
  ctx.beginPath();
  ctx.roundRect(M, top, barWidth, barHeight, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  const centerY = top + barHeight / 2;
  const iconX = M + 30;
  const iconSize = 36;

  // Green bubble on a translucent white circle would barely contrast against this already-green
  // bar — filling the bubble in the bar's own green instead makes it disappear into the
  // background, leaving just a clean white handset floating on green (the common real-world
  // WhatsApp-button look), rather than the near-invisible white-on-white result of a white bubble.
  drawWhatsAppIcon(ctx, iconX, centerY - iconSize / 2, iconSize, POSTER_COLORS.waGreen);

  ctx.font = displayFont(21, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Semak Kelayakan Sekarang', iconX + iconSize + 18, centerY);

  ctx.font = displayFont(23, 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.textAlign = 'right';
  ctx.fillText(data.advisor.phoneDisplay, M + barWidth - 30, centerY);

  return top + barHeight;
}

/** Every block below the black top rule is a fixed height except the tenure table, which grows
 *  by one row (68px) per tenure — this closed-form total lets the canvas be sized correctly on
 *  the very first (and only) draw pass, rather than rendering once to measure and again for real. */
function computeTotalHeight(data: PosterData): number {
  const priceBlockHeight = 236;
  const statsRowHeight = 112 + 24;
  const tableHeight = 54 + 68 * data.tenureRows.length + 40;
  const advisorHeight = 70 + 40;
  const ctaHeight = 90 + 46;
  const contentTop = WHITE_HEIGHT + 3 + 55;
  return contentTop + priceBlockHeight + statsRowHeight + tableHeight + advisorHeight + ctaHeight;
}

export const compactMyTemplate: PosterTemplate = {
  id: 'compact-my',
  label: 'Bulanan (Malay)',
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

    let cursor = WHITE_HEIGHT + 3 + 55;
    cursor = drawPriceBlock(ctx, data, cursor);
    cursor = drawStatsRow(ctx, data, cursor) + 24;
    cursor = drawTenureTable(ctx, data, cursor) + 40;
    cursor = (await drawAdvisorRow(ctx, data, cursor)) + 40;
    if (isStale()) return;
    drawCtaBar(ctx, data, cursor);
  },
};
