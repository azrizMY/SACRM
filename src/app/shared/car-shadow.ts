import { Pipe, PipeTransform, signal } from '@angular/core';

/** Adds a ground shadow under a transparent car cut-out, so a PNG can be dropped into
 *  `public/cars/` as-is. It finds where each tyre touches the ground, builds the car's footprint
 *  from those points (so the shadow follows the car's angle), and lays one soft, even-toned shadow
 *  there. Photos that already have a floor shadow baked in are left untouched. Results are cached
 *  per URL; any failure falls back to the original image. Tuned in the shadow mockup. */

/** Settings chosen in the mockup: darkness 100, softness ~175, size ~130 (as fractions). */
const DARKNESS = 1;
const SOFTNESS = 1.75;
const SIZE = 1.3;

type Contact = { x: number; y: number; half: number };
type Analysis = { minX: number; maxX: number; maxY: number; carW: number; carH: number; contacts: Contact[]; hasShadow: boolean };

const cache = new Map<string, Promise<string>>();

/** The car image with its shadow, as an object URL (or the original URL if nothing was added). */
export function carImageWithShadow(src: string): Promise<string> {
  let hit = cache.get(src);
  if (!hit) {
    hit = build(src).catch(() => src);
    cache.set(src, hit);
  }
  return hit;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });
}

// ---------- Finding the car and its tyres ----------

function analyse(d: Uint8ClampedArray, w: number, h: number): Analysis | null {
  const a = (x: number, y: number) => d[(y * w + x) * 4 + 3];
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const carW = maxX - minX + 1;
  const carH = maxY - minY + 1;

  // Baked-in floor shadow: just above the lowest point it spans most of the width (tyres alone ~10%).
  let coverage = 0;
  for (const f of [0.02, 0.04, 0.06]) {
    const y = Math.round(maxY - carH * f);
    let n = 0;
    for (let x = minX; x <= maxX; x++) if (a(x, y) > 12) n++;
    coverage = Math.max(coverage, n / carW);
  }

  // Bottom profile: the lowest solid pixel in each column (within the lower 40% of the car).
  const floorLimit = Math.round(maxY - carH * 0.4);
  const bottom = new Float32Array(carW).fill(-1);
  for (let x = minX; x <= maxX; x++) {
    for (let y = maxY; y >= floorLimit; y--) {
      if (a(x, y) > 128) {
        bottom[x - minX] = y;
        break;
      }
    }
  }

  // Tyre candidates: dark rubber at a local low point of the profile, widened to the tyre's flat
  // bottom (only columns at about the same height, so a tyre beside dark trim stays separate).
  const lum = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  };
  const dark = new Uint8Array(carW);
  for (let i = 0; i < carW; i++) {
    const y = bottom[i];
    if (y < 0 || y < maxY - carH * 0.3) continue;
    let sum = 0, n = 0;
    for (let k = 0; k < 5 && y - k >= 0; k++) {
      sum += lum(minX + i, y - k);
      n++;
    }
    dark[i] = sum / n < 95 ? 1 : 0;
  }
  const win = Math.max(2, Math.round(carW * 0.025));
  const tol = carH * 0.01;
  const peaks: { l: number; r: number; y: number }[] = [];
  for (let i = 0; i < carW; i++) {
    if (!dark[i]) continue;
    const y = bottom[i];
    let isPeak = true;
    for (let j = Math.max(0, i - win); j <= Math.min(carW - 1, i + win); j++) {
      if (bottom[j] > y + 0.5) {
        isPeak = false;
        break;
      }
    }
    if (!isPeak) continue;
    let l = i, r = i;
    while (l > 0 && dark[l - 1] && Math.abs(bottom[l - 1] - y) <= tol) l--;
    while (r < carW - 1 && dark[r + 1] && Math.abs(bottom[r + 1] - y) <= tol) r++;
    const prev = peaks[peaks.length - 1];
    if (prev && l <= prev.r) continue;
    peaks.push({ l, r, y });
  }

  // A real tyre has a rounded bottom: nothing nearby reaches lower, and the outline rises on both
  // sides of it. Flat dark trim (a bumper chin, a sill strip) fails that.
  const reach = Math.max(3, Math.round(carW * 0.04));
  const riseMin = carH * 0.012;
  const sideRise = (from: number, to: number, y: number) => {
    if (to < 0 || from >= carW) return Infinity;
    let top = Infinity;
    for (let j = Math.max(0, from); j <= Math.min(carW - 1, to); j++) if (bottom[j] >= 0) top = Math.min(top, bottom[j]);
    return top === Infinity ? Infinity : y - top;
  };
  const real: typeof peaks = [];
  for (const t of peaks) {
    const width = t.r - t.l;
    if (width < carW * 0.006 || width > carW * 0.18) continue;
    let lowerNearby = false;
    for (let j = Math.max(0, t.l - reach); j <= Math.min(carW - 1, t.r + reach); j++) {
      if (bottom[j] > t.y + tol) {
        lowerNearby = true;
        break;
      }
    }
    if (lowerNearby) continue;
    if (sideRise(t.l - reach, t.l - 1, t.y) < riseMin || sideRise(t.r + 1, t.r + reach, t.y) < riseMin) continue;
    const prev = real[real.length - 1];
    if (prev && t.l - prev.r < carW * 0.04) {
      if (t.y > prev.y) real[real.length - 1] = t;
      continue;
    }
    real.push(t);
  }
  const kept = real.slice().sort((p, q) => q.y - p.y).slice(0, 4).sort((p, q) => p.l - q.l);
  const contacts = kept.map((t) => ({ x: minX + (t.l + t.r) / 2, y: t.y, half: Math.max((t.r - t.l) / 2, carW * 0.025) }));
  return { minX, maxX, maxY, carW, carH, contacts, hasShadow: coverage > 0.35 };
}

/** The car's footprint on the ground from its tyres. In a ¾ view the lowest tyre is the near
 *  front; the rear and far-front wheels sit one each side of it (the rear higher in the photo); the
 *  hidden far-rear corner follows from the other three. Stretched a little past the tyres to cover
 *  the bumpers' overhang. */
function footprint(info: Analysis): { x: number; y: number }[] {
  const { minX, maxY, carW, carH } = info;
  let contacts = info.contacts;
  if (contacts.length < 2) {
    contacts = [
      { x: minX + carW * 0.2, y: maxY, half: carW * 0.05 },
      { x: minX + carW * 0.75, y: maxY, half: carW * 0.05 },
    ];
  }
  const nf = contacts.reduce((p, q) => (q.y > p.y ? q : p));
  const pick = (dir: number) => contacts.filter((p) => p !== nf && Math.sign(p.x - nf.x) === dir).sort((p, q) => q.y - p.y)[0];
  const left = pick(-1);
  const right = pick(1);
  let nr: Contact;
  let ff: { x: number; y: number };
  if (left && right) [nr, ff] = left.y < right.y ? [left, right] : [right, left];
  else {
    nr = (left ?? right)!;
    const side = Math.sign(nf.x - nr.x) || 1;
    ff = { x: nf.x + side * carW * 0.1, y: nf.y - carH * 0.045 };
  }
  const fr = { x: nr.x + (ff.x - nf.x), y: nr.y + (ff.y - nf.y) };
  const len = Math.hypot(nf.x - nr.x, nf.y - nr.y) || 1;
  const ux = (nf.x - nr.x) / len;
  const uy = (nf.y - nr.y) / len;
  const grow = len * 0.14 * SIZE;
  return [
    { x: nr.x - ux * grow, y: nr.y - uy * grow },
    { x: nf.x + ux * grow, y: nf.y + uy * grow },
    { x: ff.x + ux * grow, y: ff.y + uy * grow },
    { x: fr.x - ux * grow, y: fr.y - uy * grow },
  ];
}

// ---------- Drawing ----------

async function build(src: string): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  if (!pctx) return src;
  pctx.drawImage(img, 0, 0);
  const pixels = pctx.getImageData(0, 0, w, h).data;
  // Opaque background (not a cut-out): nothing to put a shadow behind.
  if (pixels[3] > 200 && pixels[pixels.length - 1] > 200) return src;
  const info = analyse(pixels, w, h);
  if (!info || info.hasShadow) return src;
  const { carW, carH, maxY } = info;

  // Draw on a padded canvas so a car filling its photo edge to edge doesn't get its shadow clipped…
  const padX = Math.round(carW * 0.14);
  const padB = Math.round(carH * 0.2);
  const out = document.createElement('canvas');
  out.width = w + padX * 2;
  out.height = Math.max(h, maxY + padB);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;

  // One even-toned shadow: the footprint drawn solid, then laid down once at a single opacity.
  const mask = document.createElement('canvas');
  mask.width = out.width;
  mask.height = out.height;
  const m = mask.getContext('2d');
  if (!m) return src;
  m.translate(padX, 0);
  m.fillStyle = m.strokeStyle = '#000';
  m.lineJoin = 'round';
  m.lineWidth = carH * 0.02 * SIZE;
  m.beginPath();
  footprint(info).forEach((p, i) => (i ? m.lineTo(p.x, p.y) : m.moveTo(p.x, p.y)));
  m.closePath();
  m.fill();
  m.stroke();
  ctx.save();
  ctx.globalAlpha = Math.min(1, 0.55 * DARKNESS);
  ctx.filter = `blur(${carH * 0.012 * SOFTNESS}px)`;
  ctx.drawImage(mask, 0, 0);
  ctx.restore();
  ctx.drawImage(img, padX, 0);

  // …then crop back to just the car and its shadow, so the car isn't shrunk by empty padding
  // wherever the image is fitted into a box.
  const all = ctx.getImageData(0, 0, out.width, out.height).data;
  let x0 = out.width, x1 = -1, y0 = out.height, y1 = -1;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (all[(y * out.width + x) * 4 + 3] > 3) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return src;
  const crop = document.createElement('canvas');
  crop.width = x1 - x0 + 1;
  crop.height = y1 - y0 + 1;
  crop.getContext('2d')?.drawImage(out, -x0, -y0);
  const blob = await new Promise<Blob | null>((resolve) => crop.toBlob(resolve, 'image/png'));
  return blob ? URL.createObjectURL(blob) : src;
}

/** `<img [src]="car.photoUrl | carShadow">` — shows the original straight away, then swaps to the
 *  shadowed version once it's ready (cached after the first time). */
@Pipe({ name: 'carShadow', standalone: true, pure: false })
export class CarShadowPipe implements PipeTransform {
  private static ready = signal<Record<string, string>>({});
  private static pending = new Set<string>();

  transform(src: string | null | undefined): string {
    if (!src) return '';
    const done = CarShadowPipe.ready()[src];
    if (done) return done;
    if (!CarShadowPipe.pending.has(src)) {
      CarShadowPipe.pending.add(src);
      carImageWithShadow(src).then((url) => {
        if (url !== src) CarShadowPipe.ready.update((map) => ({ ...map, [src]: url }));
      });
    }
    return src;
  }
}
