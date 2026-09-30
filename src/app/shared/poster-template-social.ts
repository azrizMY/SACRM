/** Social-media poster templates — Square (1:1) and Promo (4:5). Unlike the
 *  900px-wide printed-quote designs, these are built on a 540px canvas: at the Calculator's 4x
 *  export scale that's a 2160px-wide image, full resolution for Facebook / Instagram while
 *  staying well inside mobile browsers' maximum canvas area.
 *
 *  Both consume the same PosterData as the other templates and share one headline figure
 *  (see heroFigure): the lowest monthly instalment for a loan, the all-in price for a cash deal. */
import { POSTER_COLORS, displayFont, labelFont } from './poster-theme';
import { carImageWithShadow } from './car-shadow';
import { loadPosterImage } from './poster-images';
import { drawWhatsAppIcon } from './poster-whatsapp-icon';
import { fillPolygon, fillTrackedText, measureTrackedText } from './poster-draw-utils';
import { formatMalaysianPhone } from '../data/dashboard-data';
import type { PosterData } from './poster-data';
import { translate, type Lang, type Params } from './i18n-core';

/** Poster text in the advisor's chosen poster language (Settings → Language). */
const T = (data: { lang?: Lang }, en: string, params?: Params) => translate(data.lang ?? 'en', en, params);

import type { PosterTemplate } from './poster-templates';

const W = 540;

// ---------- Shared pieces ----------

type HeroFigure = { label: string; amount: string; perMonth: boolean; caption: string };

/** Loan: the lowest monthly (longest tenure). Cash: the total amount due, which already includes
 *  insurance and the rebate — a monthly figure means nothing without a loan. */
function heroFigure(data: PosterData): HeroFigure {
  const lowest = data.tenureRows.find((r) => r.isLowest) ?? data.tenureRows[0];
  if (data.isCashPurchase || !lowest) {
    return { label: T(data, 'CASH PRICE'), amount: Math.round(data.totalAmountDue).toLocaleString('en-MY'), perMonth: false, caption: T(data, 'INCL. INSURANCE') };
  }
  const years = Math.round(lowest.months / 12);
  return {
    label: T(data, 'MONTHLY FROM'),
    amount: Math.floor(lowest.monthly).toLocaleString('en-MY'),
    perMonth: true,
    caption: T(data, '{years} YEARS · {rate}', { years, rate: data.rateLabel }),
  };
}

function setupCanvas(canvas: HTMLCanvasElement, height: number, scale: number): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  canvas.width = W * scale;
  canvas.height = height * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

function centredTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  fillTrackedText(ctx, text, cx - measureTrackedText(ctx, text, spacing) / 2, y, spacing);
}

/** "RM" small + the figure big, as one group — left-, centre- or right-anchored at `x`. Returns
 *  the group's width. The figure shrinks to fit `maxWidth` rather than overflow the poster. */
function drawAmount(
  ctx: CanvasRenderingContext2D,
  amount: string,
  x: number,
  baseline: number,
  size: number,
  opts: { align: 'left' | 'center'; maxWidth: number; rmColor: string; color: string },
): number {
  let figureSize = size;
  let rmSize = Math.round(size * 0.33);
  const gap = size * 0.08;
  const measure = () => {
    ctx.font = displayFont(figureSize, 700);
    const a = ctx.measureText(amount).width;
    ctx.font = displayFont(rmSize, 700);
    return { a, r: ctx.measureText('RM').width };
  };
  let m = measure();
  while (m.r + gap + m.a > opts.maxWidth && figureSize > 20) {
    figureSize -= 2;
    rmSize = Math.round(figureSize * 0.33);
    m = measure();
  }
  const width = m.r + gap + m.a;
  const left = opts.align === 'center' ? x - width / 2 : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = displayFont(rmSize, 700);
  ctx.fillStyle = opts.rmColor;
  ctx.fillText('RM', left, baseline - figureSize * 0.06);
  ctx.font = displayFont(figureSize, 700);
  ctx.fillStyle = opts.color;
  ctx.fillText(amount, left + m.r + gap, baseline);
  return width;
}

/** The dealer's logo, as uploaded, on a white rounded chip so dark logos still read on the dark
 *  and red backgrounds these templates use. Falls back to the brand name. */
async function drawLogoChip(ctx: CanvasRenderingContext2D, data: PosterData, x: number, y: number, height: number, align: 'left' | 'right'): Promise<void> {
  const padX = 12;
  const padY = 7;
  let img: HTMLImageElement | null = null;
  if (data.logoUrl) {
    try {
      img = await loadPosterImage(data.logoUrl);
    } catch {
      img = null;
    }
  }
  const innerH = height - padY * 2;
  let innerW: number;
  if (img) {
    innerW = Math.min(110, (img.naturalWidth / img.naturalHeight) * innerH);
  } else {
    ctx.font = labelFont(12, 700);
    innerW = ctx.measureText(data.brand.toUpperCase()).width;
  }
  const chipW = innerW + padX * 2;
  const left = align === 'left' ? x : x - chipW;
  ctx.beginPath();
  ctx.roundRect(left, y, chipW, height, 9);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fill();
  if (img) {
    const drawH = Math.min(innerH, (innerW / img.naturalWidth) * img.naturalHeight);
    ctx.drawImage(img, left + padX, y + (height - drawH) / 2, innerW, drawH);
  } else {
    ctx.font = labelFont(12, 700);
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.brand.toUpperCase(), left + padX, y + height / 2);
  }
}

/** The car photo, fitted inside a box and sat on its bottom edge. `onDark` adds a soft spotlight
 *  behind it so it doesn't sink into a dark background; its ground shadow comes with the image. */
async function drawCar(ctx: CanvasRenderingContext2D, data: PosterData, cx: number, bottom: number, boxW: number, boxH: number, onDark: boolean): Promise<void> {
  if (onDark) {
    // Filled over the whole canvas so the gradient fades out on its own, with no hard edges.
    const spot = ctx.createRadialGradient(cx, bottom - boxH * 0.45, 0, cx, bottom - boxH * 0.45, boxW * 0.62);
    spot.addColorStop(0, 'rgba(255,255,255,0.13)');
    spot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  if (!data.carImageUrl) return;
  try {
    const img = await loadPosterImage(await carImageWithShadow(data.carImageUrl));
    const s = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.save();
    // No drop-shadow: the car image already carries its own ground shadow (see car-shadow.ts).
    ctx.drawImage(img, cx - w / 2, bottom - h, w, h);
    ctx.restore();
  } catch {
    /* leave the space empty rather than show a broken image */
  }
}

async function drawAvatar(ctx: CanvasRenderingContext2D, data: PosterData, cx: number, cy: number, size: number, ring: string): Promise<void> {
  let drawn = false;
  if (data.advisor.photoUrl) {
    try {
      const img = await loadPosterImage(data.advisor.photoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max(size / img.naturalWidth, size / img.naturalHeight);
      ctx.drawImage(img, cx - (img.naturalWidth * s) / 2, cy - (img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      ctx.restore();
      drawn = true;
    } catch {
      drawn = false;
    }
  }
  if (!drawn) {
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = POSTER_COLORS.panelCard;
    ctx.fill();
    ctx.font = displayFont(size * 0.38, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.advisor.initials, cx, cy + 1);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 1, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Green WhatsApp bar: avatar + name + phone on the left, the WhatsApp mark on the right. */
async function drawWhatsAppBar(ctx: CanvasRenderingContext2D, data: PosterData, x: number, y: number, w: number, h: number): Promise<void> {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#1FB955');
  g.addColorStop(1, POSTER_COLORS.waGreen);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fillStyle = g;
  ctx.fill();

  const cy = y + h / 2;
  const avatar = h - 16;
  await drawAvatar(ctx, data, x + 8 + avatar / 2, cy, avatar, 'rgba(255,255,255,0.9)');

  const textX = x + 8 + avatar + 12;
  const iconSize = h * 0.46;
  const textMax = w - (textX - x) - iconSize - 28;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = displayFont(Math.round(h * 0.3), 700);
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillText(data.advisor.name, textX, cy - h * 0.16, textMax);
  ctx.font = labelFont(Math.round(h * 0.2), 700);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(T(data, 'WhatsApp {phone}', { phone: formatMalaysianPhone(data.advisor.phoneDisplay) }), textX, cy + h * 0.19, textMax);

  drawWhatsAppIcon(ctx, x + w - 16 - iconSize, cy - iconSize / 2, iconSize, POSTER_COLORS.waGreen);
}

function drawDisclaimer(ctx: CanvasRenderingContext2D, data: PosterData, cx: number, y: number, color: string): void {
  ctx.font = labelFont(10, 400);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(T(data, 'Estimate as of {date} · Terms & conditions apply', { date: data.dateStr }), cx, y);
}

function darkBackground(ctx: CanvasRenderingContext2D, height: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, POSTER_COLORS.panelA);
  bg.addColorStop(1, POSTER_COLORS.panelB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, height);
}

// ---------- Square (1:1) ----------

const SQUARE_H = 540;
const SQUARE_SPLIT = 352;

export const squareTemplate: PosterTemplate = {
  id: 'square',
  label: 'Compact',
  aspect: 'square',
  async render(canvas, data, scale, isStale) {
    const ctx = setupCanvas(canvas, SQUARE_H, scale);
    if (!ctx) return;
    const M = 32;

    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.fillRect(0, 0, W, SQUARE_SPLIT);
    const bg = ctx.createLinearGradient(0, SQUARE_SPLIT, 0, SQUARE_H);
    bg.addColorStop(0, POSTER_COLORS.panelA);
    bg.addColorStop(1, POSTER_COLORS.panelB);
    ctx.fillStyle = bg;
    ctx.fillRect(0, SQUARE_SPLIT, W, SQUARE_H - SQUARE_SPLIT);
    ctx.fillStyle = POSTER_COLORS.acc;
    ctx.fillRect(0, SQUARE_SPLIT, W, 3);

    // Header: logo right (drawn as uploaded — this band is white), eyebrow + title left.
    let logoW = 0;
    if (data.logoUrl) {
      try {
        const img = await loadPosterImage(data.logoUrl);
        logoW = 92;
        const logoH = Math.min(34, (img.naturalHeight / img.naturalWidth) * logoW);
        ctx.drawImage(img, W - M - logoW, 30, logoW, logoH);
      } catch {
        logoW = 0;
      }
    }
    if (isStale()) return;
    fillPolygon(ctx, [[M + 5, 30], [M + 9, 30], [M + 4, 43], [M, 43]], POSTER_COLORS.acc);
    ctx.font = labelFont(9.5, 700);
    ctx.fillStyle = POSTER_COLORS.gray;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fillTrackedText(ctx, `${data.brand.toUpperCase()} · ${data.year}`, M + 15, 37, 2.4);
    ctx.font = displayFont(34, 700);
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(data.modelTitle, M, 84, W - 2 * M - (logoW ? logoW + 16 : 0));

    // Light swooshes behind the car, as on the Monthly Estimate poster.
    for (const [y, amp, color, width] of [[282, 16, '#ECECEC', 18], [306, 13, '#F4F4F4', 24]] as const) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.bezierCurveTo(W * 0.3, y - amp, W * 0.65, y + amp, W + 40, y - amp * 0.4);
      ctx.stroke();
      ctx.restore();
    }
    await drawCar(ctx, data, W / 2, SQUARE_SPLIT - 8, 420, 236, false);
    if (isStale()) return;

    // Bottom band: figure on the left, advisor + WhatsApp on the right.
    const hero = heroFigure(data);
    ctx.font = labelFont(9.5, 700);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fillTrackedText(ctx, hero.label, M, 386, 2.2);
    const leftMax = 250;
    const amountW = drawAmount(ctx, hero.amount, M, 444, hero.perMonth ? 60 : 46, { align: 'left', maxWidth: leftMax, rmColor: '#E6303F', color: POSTER_COLORS.paper });
    if (hero.perMonth && amountW < leftMax - 30) {
      ctx.font = displayFont(18, 700);
      ctx.fillStyle = POSTER_COLORS.grayD;
      ctx.fillText(T(data, '/mth'), M + amountW + 6, 444);
    }
    ctx.font = labelFont(10, 700);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textBaseline = 'middle';
    fillTrackedText(ctx, hero.caption, M, 470, 1.2);

    const rightX = W - M;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = displayFont(19, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.fillText(data.advisor.name, rightX, 392, 200);
    ctx.font = labelFont(11, 400);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.fillText(data.advisor.role, rightX, 413, 200);

    const phone = formatMalaysianPhone(data.advisor.phoneDisplay);
    ctx.font = displayFont(17, 700);
    const pillW = ctx.measureText(phone).width + 58;
    const pillY = 432;
    const pillH = 40;
    ctx.beginPath();
    ctx.roundRect(rightX - pillW, pillY, pillW, pillH, 20);
    ctx.fillStyle = POSTER_COLORS.waGreen;
    ctx.fill();
    drawWhatsAppIcon(ctx, rightX - pillW + 12, pillY + 9, 22, POSTER_COLORS.waGreen);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.textAlign = 'right';
    ctx.fillText(phone, rightX - 16, pillY + pillH / 2 + 1);

    ctx.font = labelFont(9, 400);
    ctx.fillStyle = POSTER_COLORS.panelGrayD;
    ctx.textAlign = 'left';
    ctx.fillText(T(data, 'Estimate as of {date} · T&C apply', { date: data.dateStr }), M, 516);
  },
};

// ---------- Promo / Jimat (4:5) ----------

const PROMO_H = 675;

export const promoTemplate: PosterTemplate = {
  id: 'promo',
  label: 'Rebate Deal',
  aspect: 'promo',
  /** Its headline is the rebate — there's nothing to promote without one. */
  isAvailable: (data) => data.rebate > 0,
  async render(canvas, data, scale, isStale) {
    const ctx = setupCanvas(canvas, PROMO_H, scale);
    if (!ctx) return;
    const M = 34;
    darkBackground(ctx, PROMO_H);

    // Red banner with a slanted bottom edge; the car sits across the slant.
    const red = ctx.createLinearGradient(0, 0, W, 330);
    red.addColorStop(0, '#E8283A');
    red.addColorStop(1, POSTER_COLORS.accDark);
    fillPolygon(ctx, [[0, 0], [W, 0], [W, 300], [0, 372]], red);
    // Faint diagonal stripes for texture.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 300);
    ctx.lineTo(0, 372);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 14;
    for (let x = -400; x < W + 400; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 380, 380);
      ctx.stroke();
    }
    ctx.restore();

    await drawLogoChip(ctx, data, M, 28, 34, 'left');
    if (isStale()) return;
    ctx.font = labelFont(10.5, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'middle';
    const yearLabel = T(data, '{year} MODEL', { year: data.year });
    fillTrackedText(ctx, yearLabel, W - M - measureTrackedText(ctx, yearLabel, 2.4), 45, 2.4);

    ctx.font = displayFont(36, 700);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    fillTrackedText(ctx, 'JIMAT', M, 118, 7);
    drawAmount(ctx, Math.round(data.rebate).toLocaleString('en-MY'), M - 2, 212, 104, {
      align: 'left',
      maxWidth: W - 2 * M,
      rmColor: POSTER_COLORS.paper,
      color: POSTER_COLORS.paper,
    });
    ctx.font = labelFont(11, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'middle';
    fillTrackedText(ctx, T(data, 'REBATE · {model}', { model: data.modelTitle.toUpperCase() }), M, 244, 1.8);

    await drawCar(ctx, data, W / 2, 478, 470, 200, true);
    if (isStale()) return;

    const hero = heroFigure(data);
    ctx.font = labelFont(10.5, 700);
    ctx.fillStyle = POSTER_COLORS.grayD;
    ctx.textBaseline = 'middle';
    centredTracked(ctx, `${hero.label} · ${hero.caption}`, W / 2, 506, 1.8);
    const amountW = drawAmount(ctx, hero.amount, W / 2 - (hero.perMonth ? 26 : 0), 562, 52, {
      align: 'center',
      maxWidth: W - 2 * M - 60,
      rmColor: '#E6303F',
      color: POSTER_COLORS.paper,
    });
    if (hero.perMonth) {
      ctx.font = displayFont(20, 700);
      ctx.fillStyle = POSTER_COLORS.grayD;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(T(data, '/month'), W / 2 - 26 + amountW / 2 + 6, 562);
    }

    await drawWhatsAppBar(ctx, data, M, 586, W - 2 * M, 56);
    drawDisclaimer(ctx, data, W / 2, 658, POSTER_COLORS.panelGrayD);
  },
};
