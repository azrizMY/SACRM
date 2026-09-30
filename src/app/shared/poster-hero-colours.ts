/** The Full Quotation poster's car hero, with the variant's factory colours as a row of chips under
 *  the car (see drawCarHeroWithColours) — so the colour list never covers the car. */
import { MARGIN, POSTER_WIDTH, type PosterLayout } from './poster-layout';
import { POSTER_COLORS, labelFont } from './poster-theme';
import { loadPosterImage } from './poster-images';
import { carImageWithShadow } from './car-shadow';
import { swatchHexFor } from './poster-colour-swatches';
import type { PosterData } from './poster-data';

/** The car, fitted (object-contain) and centred inside a box. */
async function drawCarInBox(ctx: CanvasRenderingContext2D, data: PosterData, x: number, y: number, w: number, h: number): Promise<void> {
  if (!data.carImageUrl) return;
  try {
    const img = await loadPosterImage(await carImageWithShadow(data.carImageUrl));
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } catch {
    /* leave the band blank rather than show a broken image */
  }
}

function surchargeNote(data: PosterData, colour: string): string {
  const s = data.colourSurcharges[colour];
  return s ? ` (+RM ${s.toLocaleString('en-MY')})` : '';
}

type Chip = { colour: string; width: number };

/** Rounded charcoal pills with white text, each with a ringed colour dot. */
const CHIP = { name: 11, note: 9, dot: 6, dotGap: 8, pad: 11, height: 28, gap: 8, lineGap: 8 };
const CHIP_FILL = POSTER_COLORS.block; // charcoal, same tone as the dark section below

/** Lays the chips out in centred lines that fit the poster's width. */
function layoutChips(ctx: CanvasRenderingContext2D, data: PosterData): { lines: Chip[][]; height: number } {
  const chips: Chip[] = data.colours.map((colour) => {
    ctx.font = labelFont(CHIP.name, 700);
    let text = ctx.measureText(colour).width;
    const note = surchargeNote(data, colour);
    if (note) {
      ctx.font = labelFont(CHIP.note, 400);
      text += ctx.measureText(note).width;
    }
    return { colour, width: CHIP.pad * 2 + CHIP.dot * 2 + CHIP.dotGap + text };
  });
  const maxW = POSTER_WIDTH - MARGIN * 2;
  const lines: Chip[][] = [[]];
  let used = 0;
  for (const chip of chips) {
    const line = lines[lines.length - 1];
    const add = (line.length ? CHIP.gap : 0) + chip.width;
    if (line.length && used + add > maxW) {
      lines.push([chip]);
      used = chip.width;
    } else {
      line.push(chip);
      used += add;
    }
  }
  return { lines, height: lines.length * CHIP.height + (lines.length - 1) * CHIP.lineGap };
}

function drawChips(ctx: CanvasRenderingContext2D, data: PosterData, top: number, lines: Chip[][]): void {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  lines.forEach((line, li) => {
    const lineW = line.reduce((s, c, i) => s + c.width + (i ? CHIP.gap : 0), 0);
    let x = (POSTER_WIDTH - lineW) / 2;
    const chipTop = top + li * (CHIP.height + CHIP.lineGap);
    const y = chipTop + CHIP.height / 2;
    line.forEach((chip, i) => {
      if (i) x += CHIP.gap;
      ctx.beginPath();
      ctx.roundRect(x, chipTop, chip.width, CHIP.height, CHIP.height / 2);
      ctx.fillStyle = CHIP_FILL;
      ctx.fill();
      // Dot with a light ring, so dark paints (Carbon Black) still show on the charcoal pill.
      const dx = x + CHIP.pad + CHIP.dot;
      ctx.beginPath();
      ctx.arc(dx, y, CHIP.dot, 0, Math.PI * 2);
      ctx.fillStyle = swatchHexFor(chip.colour);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const tx = dx + CHIP.dot + CHIP.dotGap;
      ctx.font = labelFont(CHIP.name, 700);
      ctx.fillStyle = POSTER_COLORS.paper;
      ctx.fillText(chip.colour, tx, y);
      const note = surchargeNote(data, chip.colour);
      if (note) {
        const nameW = ctx.measureText(chip.colour).width;
        ctx.font = labelFont(CHIP.note, 400);
        ctx.fillStyle = POSTER_COLORS.panelGray;
        ctx.fillText(note, tx + nameW, y);
      }
      x += chip.width;
    });
  });
}

/** The car in its 528px-wide box; when the variant has factory colours, a centred row of colour chips
 *  sits under it on the white band and the car's box ends just above them. */
export async function drawCarHeroWithColours(ctx: CanvasRenderingContext2D, layout: PosterLayout, data: PosterData): Promise<void> {
  const heroW = 528;
  const heroX = (POSTER_WIDTH - heroW) / 2;
  if (data.colours.length === 0) {
    await drawCarInBox(ctx, data, heroX, layout.carHeroTop, heroW, layout.carHeroHeight);
    return;
  }
  const { lines, height } = layoutChips(ctx, data);
  const chipsTop = layout.panelTop - 10 - height; // the white band runs down to the price panel's rule
  const carH = Math.min(layout.carHeroHeight, chipsTop - 8 - layout.carHeroTop);
  await drawCarInBox(ctx, data, heroX, layout.carHeroTop, heroW, carH);
  drawChips(ctx, data, chipsTop, lines);
}
