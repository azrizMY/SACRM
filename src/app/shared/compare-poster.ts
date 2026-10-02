import type { Lang, Params } from './i18n-core';
import { translate } from './i18n-core';
import { carImageWithShadow } from './car-shadow';
import { loadPosterImage } from './poster-images';
import { fillTrackedText, formatPosterCurrency, wrapPosterText } from './poster-draw-utils';
import { POSTER_COLORS, displayFont, labelFont, posterFontsReady } from './poster-theme';

/** One car's column on the comparison image. */
export type ComparePosterCar = {
  brand: string;
  title: string;
  year: number;
  photoUrl?: string;
  price: number;
  rebate: number;
  downpayment: number;
  loan: number;
  monthly: number | null;
};

export type ComparePosterData = {
  lang: Lang;
  cars: ComparePosterCar[];
  /** e.g. "10% downpayment · 9 years · Flat 2.5%" — already translated. */
  setupLine: string;
  tenureYears: number;
  advisor: { name: string; role: string; phone: string; photoUrl?: string };
};

export const COMPARE_POSTER_WIDTH = 1080;
export const COMPARE_POSTER_HEIGHT = 1350;

const W = COMPARE_POSTER_WIDTH;
const H = COMPARE_POSTER_HEIGHT;
const MARGIN = 56;
const GAP = 20;
const HERO_BOTTOM = 560;
const FOOTER_TOP = 1150;

/** "Which one suits you?" — 2–3 cars side by side as a 4:5 image for WhatsApp/Instagram, in the
 *  same visual language as the quote posters (white hero, dark data panel, accent-ruled footer). */
export async function renderComparePoster(canvas: HTMLCanvasElement, data: ComparePosterData): Promise<void> {
  await posterFontsReady();
  const T = (en: string, params?: Params) => translate(data.lang, en, params);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Backgrounds: white hero, dark data panel, footer.
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, W, HERO_BOTTOM);
  const panel = ctx.createLinearGradient(0, 0, W, 0);
  panel.addColorStop(0, POSTER_COLORS.panelA);
  panel.addColorStop(1, POSTER_COLORS.panelB);
  ctx.fillStyle = panel;
  ctx.fillRect(0, HERO_BOTTOM, W, FOOTER_TOP - HERO_BOTTOM);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(0, HERO_BOTTOM, W, 4);
  const footer = ctx.createLinearGradient(0, 0, W, 0);
  footer.addColorStop(0, POSTER_COLORS.footerA);
  footer.addColorStop(1, POSTER_COLORS.footerB);
  ctx.fillStyle = footer;
  ctx.fillRect(0, FOOTER_TOP, W, H - FOOTER_TOP);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.fillRect(0, FOOTER_TOP, W, 3);

  // Heading.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.font = labelFont(20, 700);
  fillTrackedText(ctx, T('COMPARE').toUpperCase(), MARGIN, 82, 4);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = displayFont(64);
  ctx.fillText(T('Which one suits you?'), MARGIN, 148);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.font = labelFont(24);
  ctx.fillText(data.setupLine, MARGIN, 190);

  const n = data.cars.length;
  const colW = (W - MARGIN * 2 - GAP * (n - 1)) / n;
  const colX = (i: number) => MARGIN + i * (colW + GAP);

  const monthlies = data.cars.map((c) => c.monthly).filter((m): m is number => m !== null);
  const lowest = monthlies.length > 1 ? Math.min(...monthlies) : null;

  for (const [i, car] of data.cars.entries()) {
    const x = colX(i);

    // Car photo, fitted into its slot and sat on a common baseline.
    if (car.photoUrl) {
      try {
        const img = await loadPosterImage(await carImageWithShadow(car.photoUrl));
        const boxW = colW;
        const boxH = 200;
        const scale = Math.min(boxW / img.width, boxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, x + (boxW - w) / 2, 230 + (boxH - h), w, h);
      } catch {
        /* no photo — the name below still identifies the car */
      }
    }

    ctx.textAlign = 'center';
    const cx = x + colW / 2;
    ctx.fillStyle = POSTER_COLORS.gray;
    ctx.font = labelFont(n === 3 ? 18 : 20, 700);
    ctx.fillText(car.brand.toUpperCase(), cx, 466);
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.font = displayFont(n === 3 ? 30 : 36);
    const lines = wrapPosterText(ctx, car.title, colW - 8, 2);
    lines.forEach((line, li) => ctx.fillText(line, cx, 502 + li * (n === 3 ? 30 : 34) - (lines.length - 1) * 14));
    ctx.fillStyle = POSTER_COLORS.gray;
    ctx.font = labelFont(16);
    ctx.fillText(String(car.year), cx, 546);

    // Figures.
    const rows: [string, string][] = [
      [T('OTR Price'), formatPosterCurrency(car.price)],
      [T('Rebate'), car.rebate > 0 ? `− ${formatPosterCurrency(car.rebate)}` : '—'],
      [T('Downpayment'), formatPosterCurrency(car.downpayment)],
      [T('Loan Amount'), formatPosterCurrency(car.loan)],
    ];
    let y = 620;
    for (const [label, value] of rows) {
      ctx.fillStyle = POSTER_COLORS.panelGray;
      ctx.font = labelFont(18);
      ctx.fillText(label, cx, y);
      ctx.fillStyle = POSTER_COLORS.paper;
      ctx.font = displayFont(n === 3 ? 30 : 34);
      ctx.fillText(value, cx, y + 38);
      y += 92;
    }

    // Monthly instalment block.
    const isLowest = lowest !== null && car.monthly === lowest;
    const boxTop = 980;
    ctx.fillStyle = isLowest ? POSTER_COLORS.acc : POSTER_COLORS.panelCard;
    roundRect(ctx, x, boxTop, colW, 140, 18);
    ctx.fill();
    ctx.fillStyle = isLowest ? POSTER_COLORS.paper : POSTER_COLORS.panelGray;
    ctx.font = labelFont(17, 700);
    ctx.fillText(T('MONTHLY · {n} YRS', { n: data.tenureYears }), cx, boxTop + 36);
    ctx.fillStyle = POSTER_COLORS.paper;
    ctx.font = displayFont(n === 3 ? 44 : 52);
    const monthlyText =
      car.monthly === null ? T('Ask me') : car.monthly === 0 ? T('Cash') : `RM ${Math.round(car.monthly).toLocaleString('en-MY')}`;
    ctx.fillText(monthlyText, cx, boxTop + 92);
    ctx.font = labelFont(16, 700);
    if (isLowest) ctx.fillText(T('LOWEST MONTHLY'), cx, boxTop + 124);
    else if (lowest !== null && car.monthly !== null && car.monthly > lowest) {
      ctx.fillStyle = POSTER_COLORS.panelGray;
      ctx.fillText(T('+RM {d} / month', { d: Math.round(car.monthly - lowest).toLocaleString('en-MY') }), cx, boxTop + 124);
    }
    ctx.textAlign = 'left';
  }

  // Footer: advisor.
  let textX = MARGIN;
  if (data.advisor.photoUrl) {
    try {
      const img = await loadPosterImage(data.advisor.photoUrl);
      const size = 104;
      const top = FOOTER_TOP + 34;
      ctx.save();
      ctx.beginPath();
      ctx.arc(MARGIN + size / 2, top + size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      const s = Math.max(size / img.width, size / img.height);
      ctx.drawImage(img, MARGIN + (size - img.width * s) / 2, top + (size - img.height * s) / 2, img.width * s, img.height * s);
      ctx.restore();
      textX = MARGIN + size + 24;
    } catch {
      /* photo failed to load — name and number still show */
    }
  }
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.font = displayFont(38);
  ctx.fillText(data.advisor.name, textX, FOOTER_TOP + 78);
  ctx.fillStyle = POSTER_COLORS.panelGray;
  ctx.font = labelFont(22);
  ctx.fillText([data.advisor.role, data.advisor.phone].filter(Boolean).join('  ·  '), textX, FOOTER_TOP + 116);
  ctx.fillStyle = POSTER_COLORS.panelGrayD;
  ctx.font = labelFont(15);
  ctx.fillText(T('Estimate only. Insurance, bank rate and final loan approval may vary from the figures shown here.'), MARGIN, H - 30);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
