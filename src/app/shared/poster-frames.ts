import type { Lang } from './i18n-core';
import { displayFont } from './poster-theme';

/**
 * Festive frames (Settings → Festive frame): a border and a greeting banner drawn *around* a
 * finished poster, never over it, so no price or name is ever covered whatever the design. Every
 * motif is drawn here in code — no image files — so frames stay sharp at any export size.
 */

type Palette = { bgA: string; bgB: string; accent: string; text: string; line: string };
type Motif = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: Palette) => void;
type Frame = {
  label: string;
  greeting: Record<Lang, string>;
  palette: Palette;
  /** Drawn at both ends of the banner (the right one mirrored). */
  motif: Motif;
  /** Repeated along the side and bottom bands. */
  pattern: Motif;
  /** The right-hand motif is normally a mirror image of the left; false draws it the same way round. */
  mirror?: boolean;
};

// ---------- Motifs ----------

/** A hanging string from the top edge down to (x, y). */
function hang(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, y);
  ctx.stroke();
}

const ketupat: Motif = (ctx, x, y, s, p) => {
  hang(ctx, x, y - s * 0.5, p.accent, s * 0.03);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  const h = s * 0.36;
  ctx.beginPath();
  ctx.rect(-h, -h, h * 2, h * 2);
  ctx.fillStyle = '#2e9e4f';
  ctx.fill();
  ctx.clip();
  // Woven palm strips
  ctx.lineWidth = h * 0.32;
  for (let i = -3; i <= 3; i++) {
    ctx.strokeStyle = i % 2 === 0 ? '#e9d36b' : '#1f7a3a';
    ctx.beginPath();
    ctx.moveTo(i * h * 0.45, -h * 1.2);
    ctx.lineTo(i * h * 0.45, h * 1.2);
    ctx.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    if (i % 2 === 0) continue;
    ctx.strokeStyle = 'rgba(233, 211, 107, 0.75)';
    ctx.beginPath();
    ctx.moveTo(-h * 1.2, i * h * 0.45);
    ctx.lineTo(h * 1.2, i * h * 0.45);
    ctx.stroke();
  }
  ctx.restore();
  // Two ribbon tails
  ctx.strokeStyle = '#2e9e4f';
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  for (const dx of [-0.08, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y + s * 0.5);
    ctx.quadraticCurveTo(x + dx * s * 3, y + s * 0.7, x + dx * s * 1.5, y + s * 0.85);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
};

/** A crescent, cut out on a scratch canvas so it sits cleanly on any background. */
function crescent(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const size = Math.ceil(r * 2.4);
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d');
  if (!g) return;
  g.scale(2, 2);
  g.fillStyle = color;
  g.beginPath();
  g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(size / 2 + r * 0.42, size / 2 - r * 0.18, r * 0.86, 0, Math.PI * 2);
  g.fill();
  ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, color: string, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, h: number) {
  const glow = ctx.createRadialGradient(x, y - h * 0.4, 0, x, y - h * 0.4, h * 1.4);
  glow.addColorStop(0, 'rgba(255, 210, 90, 0.55)');
  glow.addColorStop(1, 'rgba(255, 210, 90, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.4, h * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + h * 0.45, y - h * 0.45, x + h * 0.38, y, x, y);
  ctx.bezierCurveTo(x - h * 0.38, y, x - h * 0.45, y - h * 0.45, x, y - h);
  ctx.fillStyle = '#ffb703';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.55);
  ctx.bezierCurveTo(x + h * 0.2, y - h * 0.25, x + h * 0.16, y, x, y);
  ctx.bezierCurveTo(x - h * 0.16, y, x - h * 0.2, y - h * 0.25, x, y - h * 0.55);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
}

const crescentStar: Motif = (ctx, x, y, s, p) => {
  crescent(ctx, x, y, s * 0.34, p.accent);
  star(ctx, x + s * 0.26, y - s * 0.12, s * 0.1, 5, p.accent);
};

/** Ramadan fanous lantern, hanging, with a warm glow inside. */
const fanous: Motif = (ctx, x, y, s, p) => {
  hang(ctx, x, y - s * 0.5, p.accent, s * 0.03);
  const w = s * 0.42;
  ctx.fillStyle = p.accent;
  ctx.beginPath(); // dome
  ctx.moveTo(x, y - s * 0.55);
  ctx.lineTo(x + w * 0.5, y - s * 0.3);
  ctx.lineTo(x - w * 0.5, y - s * 0.3);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.25);
  glow.addColorStop(0, '#ffe08a');
  glow.addColorStop(1, '#f4a259');
  ctx.fillStyle = glow;
  ctx.beginPath(); // glass body
  ctx.moveTo(x - w * 0.5, y - s * 0.3);
  ctx.lineTo(x + w * 0.5, y - s * 0.3);
  ctx.lineTo(x + w * 0.38, y + s * 0.22);
  ctx.lineTo(x - w * 0.38, y + s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = s * 0.03;
  ctx.stroke();
  ctx.beginPath(); // frame bars
  ctx.moveTo(x, y - s * 0.3);
  ctx.lineTo(x, y + s * 0.22);
  ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.fillRect(x - w * 0.42, y + s * 0.22, w * 0.84, s * 0.06);
  ctx.beginPath(); // base point
  ctx.moveTo(x - w * 0.2, y + s * 0.28);
  ctx.lineTo(x + w * 0.2, y + s * 0.28);
  ctx.lineTo(x, y + s * 0.4);
  ctx.closePath();
  ctx.fill();
};

/** Mosque dome and minaret silhouette. */
const mosque: Motif = (ctx, x, y, s, p) => {
  ctx.fillStyle = p.accent;
  const base = y + s * 0.47;
  ctx.beginPath(); // onion dome
  ctx.moveTo(x - s * 0.3, base - s * 0.25);
  ctx.bezierCurveTo(x - s * 0.36, base - s * 0.6, x - s * 0.05, base - s * 0.6, x, base - s * 0.82);
  ctx.bezierCurveTo(x + s * 0.05, base - s * 0.6, x + s * 0.36, base - s * 0.6, x + s * 0.3, base - s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - s * 0.32, base - s * 0.27, s * 0.64, s * 0.27);
  ctx.fillRect(x + s * 0.4, base - s * 0.7, s * 0.09, s * 0.7); // minaret
  ctx.beginPath();
  ctx.moveTo(x + s * 0.38, base - s * 0.7);
  ctx.lineTo(x + s * 0.51, base - s * 0.7);
  ctx.lineTo(x + s * 0.445, base - s * 0.86);
  ctx.closePath();
  ctx.fill();
  crescent(ctx, x + s * 0.02, base - s * 0.92, s * 0.06, p.accent);
};

/** Chinese red lantern with gold ribs and tassel. */
const lantern: Motif = (ctx, x, y, s, p) => {
  hang(ctx, x, y - s * 0.42, p.accent, s * 0.03);
  const rx = s * 0.34;
  const ry = s * 0.27;
  ctx.fillStyle = p.accent;
  ctx.fillRect(x - rx * 0.45, y - ry - s * 0.07, rx * 0.9, s * 0.08);
  ctx.fillRect(x - rx * 0.45, y + ry - s * 0.01, rx * 0.9, s * 0.08);
  const body = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.3, rx * 0.1, x, y, rx);
  body.addColorStop(0, '#ff4d4d');
  body.addColorStop(1, '#c1121f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = s * 0.02;
  for (const k of [-0.6, -0.25, 0.25, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(k) * rx, ry, 0, k < 0 ? Math.PI / 2 : -Math.PI / 2, k < 0 ? (Math.PI * 3) / 2 : Math.PI / 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x, y - ry);
  ctx.lineTo(x, y + ry);
  ctx.stroke();
  ctx.strokeStyle = '#c1121f'; // tassel
  ctx.lineWidth = s * 0.025;
  for (const dx of [-0.04, 0, 0.04]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y + ry + s * 0.07);
    ctx.lineTo(x + dx * s * 1.4, y + ry + s * 0.3);
    ctx.stroke();
  }
};

/** Deepavali clay diya with its flame. */
const diya: Motif = (ctx, x, y, s, p) => {
  const w = s * 0.42;
  const top = y + s * 0.08;
  const bowl = ctx.createLinearGradient(0, top, 0, top + s * 0.24);
  bowl.addColorStop(0, '#e76f51');
  bowl.addColorStop(1, '#9c3d1f');
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.moveTo(x - w, top);
  ctx.quadraticCurveTo(x - w * 0.6, top + s * 0.3, x, top + s * 0.28);
  ctx.quadraticCurveTo(x + w * 0.6, top + s * 0.3, x + w * 1.25, top - s * 0.06); // spout
  ctx.lineTo(x + w * 0.9, top);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.8, top + s * 0.08);
  ctx.lineTo(x + w * 0.75, top + s * 0.08);
  ctx.stroke();
  flame(ctx, x + w * 1.05, top - s * 0.04, s * 0.32);
};

/** Kolam / rangoli rosette. */
const rangoli: Motif = (ctx, x, y, s, p) => {
  const colors = [p.accent, '#ff006e', '#3a86ff', '#ffbe0b'];
  for (let ring = 3; ring >= 1; ring--) {
    ctx.fillStyle = colors[ring % colors.length];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + (ring % 2) * (Math.PI / 8);
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * s * 0.11 * ring, y + Math.sin(a) * s * 0.11 * ring, s * 0.07, s * 0.035 * ring, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
};

const snowflake: Motif = (ctx, x, y, s, p) => {
  ctx.strokeStyle = p.text;
  ctx.lineWidth = s * 0.035;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * i) / 3;
    const ex = x + Math.cos(a) * s * 0.4;
    const ey = y + Math.sin(a) * s * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    for (const t of [0.5, 0.75]) {
      const bx = x + Math.cos(a) * s * 0.4 * t;
      const by = y + Math.sin(a) * s * 0.4 * t;
      for (const d of [-0.6, 0.6]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + d) * s * 0.12, by + Math.sin(a + d) * s * 0.12);
      }
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
};

/** A small decorated Christmas tree. */
const tree: Motif = (ctx, x, y, s, p) => {
  const tiers: [number, number, number][] = [
    [-0.42, 0.18, 0.18],
    [-0.22, 0.26, 0.38],
    [-0.02, 0.34, 0.58],
  ];
  ctx.fillStyle = '#2d6a4f';
  for (const [top, half, bottom] of tiers) {
    ctx.beginPath();
    ctx.moveTo(x, y + top * s);
    ctx.lineTo(x + half * s, y + (bottom - 0.32) * s + 0.32 * s);
    ctx.lineTo(x - half * s, y + (bottom - 0.32) * s + 0.32 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#7f5539';
  ctx.fillRect(x - s * 0.05, y + s * 0.58, s * 0.1, s * 0.1);
  const balls: [number, number, string][] = [
    [-0.08, 0.08, '#d00000'],
    [0.1, 0.2, p.accent],
    [-0.14, 0.4, '#4cc9f0'],
    [0.16, 0.48, '#d00000'],
    [0, 0.32, '#ffffff'],
  ];
  for (const [dx, dy, color] of balls) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  star(ctx, x, y - s * 0.44, s * 0.09, 5, p.accent);
};

const christmas: Motif = (ctx, x, y, s, p) => {
  snowflake(ctx, x - s * 0.3, y - s * 0.12, s * 0.6, p);
  tree(ctx, x + s * 0.15, y - s * 0.06, s * 0.85, p);
};

/** The Jalur Gemilang on a short pole. */
const jalurGemilang: Motif = (ctx, x, y, s) => {
  const w = s * 0.9;
  const h = w / 2;
  const left = x - w / 2;
  const top = y - h / 2;
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(left - s * 0.04, top - s * 0.05, s * 0.03, h + s * 0.45);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#cc0001' : '#ffffff';
    ctx.fillRect(left, top + (h / 14) * i, w, h / 14 + 0.5);
  }
  const cw = w / 2;
  const ch = (h / 14) * 8;
  ctx.fillStyle = '#010066';
  ctx.fillRect(left, top, cw, ch);
  crescent(ctx, left + cw * 0.36, top + ch / 2, ch * 0.36, '#ffcc00');
  star(ctx, left + cw * 0.7, top + ch / 2, ch * 0.3, 14, '#ffcc00', 0.42);
};

const firework: Motif = (ctx, x, y, s, p) => {
  const bursts: [number, number, number, string][] = [
    [0, 0, 0.42, p.accent],
    [0.32, -0.25, 0.22, '#ff4d6d'],
    [-0.3, 0.22, 0.2, '#4cc9f0'],
  ];
  for (const [dx, dy, r, color] of bursts) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s * 0.02;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * r * 0.35, cy + Math.sin(a) * s * r * 0.35);
      ctx.lineTo(cx + Math.cos(a) * s * r, cy + Math.sin(a) * s * r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * r * 1.12, cy + Math.sin(a) * s * r * 1.12, s * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

// ---------- Border patterns ----------

const dots =
  (colors: string[]): Motif =>
  (ctx, x, y, s, p) => {
    ctx.fillStyle = colors[Math.round(x + y) % colors.length] ?? p.accent;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  };
const diamond: Motif = (ctx, x, y, s, p) => {
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.28);
  ctx.lineTo(x + s * 0.2, y);
  ctx.lineTo(x, y + s * 0.28);
  ctx.lineTo(x - s * 0.2, y);
  ctx.closePath();
  ctx.fill();
};
const coin: Motif = (ctx, x, y, s, p) => {
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7d0a10';
  ctx.fillRect(x - s * 0.07, y - s * 0.07, s * 0.14, s * 0.14);
};
const smallStar: Motif = (ctx, x, y, s, p) => star(ctx, x, y, s * 0.24, 5, p.accent);
const snowDot: Motif = (ctx, x, y, s) => {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
};
const stripe: Motif = (ctx, x, y, s) => {
  ctx.fillStyle = '#ffcc00';
  star(ctx, x, y, s * 0.22, 14, '#ffcc00', 0.45);
};

// ---------- The frames ----------

export const POSTER_FRAMES = {
  raya: {
    label: 'Hari Raya Aidilfitri',
    greeting: { en: 'Selamat Hari Raya Aidilfitri', ms: 'Selamat Hari Raya Aidilfitri' },
    palette: { bgA: '#11643a', bgB: '#073d22', accent: '#f2c14e', text: '#fff8e1', line: '#f2c14e' },
    motif: ketupat,
    pattern: diamond,
  },
  ramadan: {
    label: 'Ramadan',
    greeting: { en: 'Ramadan Kareem', ms: 'Salam Ramadan' },
    palette: { bgA: '#1b2a52', bgB: '#0b132b', accent: '#e9c46a', text: '#fff8e1', line: '#e9c46a' },
    motif: fanous,
    pattern: smallStar,
  },
  haji: {
    label: 'Hari Raya Haji',
    greeting: { en: 'Selamat Hari Raya Aidiladha', ms: 'Selamat Hari Raya Aidiladha' },
    palette: { bgA: '#0f4c5c', bgB: '#082f38', accent: '#e9c46a', text: '#fff8e1', line: '#e9c46a' },
    motif: mosque,
    pattern: smallStar,
  },
  cny: {
    label: 'Chinese New Year',
    greeting: { en: 'Happy Chinese New Year', ms: 'Gong Xi Fa Cai' },
    palette: { bgA: '#b3121b', bgB: '#6e0a10', accent: '#f6c453', text: '#fff3c4', line: '#f6c453' },
    motif: lantern,
    pattern: coin,
  },
  deepavali: {
    label: 'Deepavali',
    greeting: { en: 'Happy Deepavali', ms: 'Selamat Hari Deepavali' },
    palette: { bgA: '#5a189a', bgB: '#2d0a4e', accent: '#ff9f1c', text: '#fff3c4', line: '#ff9f1c' },
    motif: (ctx, x, y, s, p) => {
      rangoli(ctx, x - s * 0.18, y - s * 0.08, s * 0.85, p);
      diya(ctx, x + s * 0.12, y + s * 0.12, s * 0.75, p);
    },
    pattern: dots(['#ff9f1c', '#ff006e', '#ffbe0b']),
  },
  christmas: {
    label: 'Christmas',
    greeting: { en: 'Merry Christmas', ms: 'Selamat Hari Krismas' },
    palette: { bgA: '#1b5e35', bgB: '#0b3a20', accent: '#ffd166', text: '#ffffff', line: '#d00000' },
    motif: christmas,
    pattern: snowDot,
  },
  merdeka: {
    label: 'Merdeka',
    greeting: { en: 'Selamat Hari Merdeka', ms: 'Selamat Hari Merdeka' },
    palette: { bgA: '#0a1a7a', bgB: '#010046', accent: '#ffcc00', text: '#ffffff', line: '#cc0001' },
    motif: jalurGemilang,
    pattern: stripe,
    mirror: false,
  },
  malaysiaday: {
    label: 'Malaysia Day',
    greeting: { en: 'Happy Malaysia Day', ms: 'Selamat Hari Malaysia' },
    palette: { bgA: '#0a1a7a', bgB: '#010046', accent: '#ffcc00', text: '#ffffff', line: '#cc0001' },
    motif: jalurGemilang,
    pattern: stripe,
    mirror: false,
  },
  newyear: {
    label: 'New Year',
    greeting: { en: 'Happy New Year', ms: 'Selamat Tahun Baharu' },
    palette: { bgA: '#1b1b3a', bgB: '#07071a', accent: '#ffd166', text: '#ffffff', line: '#ffd166' },
    motif: firework,
    pattern: dots(['#ffd166', '#ff4d6d', '#4cc9f0', '#80ed99']),
  },
} satisfies Record<string, Frame>;

export type PosterFrameId = keyof typeof POSTER_FRAMES;

export function posterFrame(id: string | null | undefined): Frame | null {
  return (POSTER_FRAMES as Record<string, Frame>)[id ?? ''] ?? null;
}

/** Border and banner sizes for a poster `width` design px wide. */
function frameMetrics(width: number) {
  const band = Math.round(width * 0.035);
  const banner = Math.round(width * 0.13);
  return { band, banner };
}

/** Draws the frame (background, banner, border pattern) for a framed area w × h. */
function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, lang: Lang, w: number, h: number, band: number, banner: number) {
  const p = frame.palette;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, p.bgA);
  bg.addColorStop(1, p.bgB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Border pattern down both sides and along the bottom
  const step = band * 1.6;
  for (let y = banner + step / 2; y < h - band; y += step) {
    frame.pattern(ctx, band / 2, y, band, p);
    frame.pattern(ctx, w - band / 2, y, band, p);
  }
  for (let x = band + step / 2; x < w - band; x += step) frame.pattern(ctx, x, h - band / 2, band, p);

  // Banner: motif at each end, greeting between
  const s = banner * 0.95;
  frame.motif(ctx, band + s * 0.6, banner * 0.55, s, p);
  if (frame.mirror === false) {
    frame.motif(ctx, w - band - s * 0.6, banner * 0.55, s, p);
  } else {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    frame.motif(ctx, band + s * 0.6, banner * 0.55, s, p);
    ctx.restore();
  }

  const text = frame.greeting[lang];
  const maxText = w - (band + s * 1.25) * 2;
  let size = Math.round(banner * 0.36);
  ctx.font = displayFont(size, 700);
  while (ctx.measureText(text).width > maxText && size > 12) {
    size -= 1;
    ctx.font = displayFont(size, 700);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillText(text, w / 2 + size * 0.04, banner * 0.56 + size * 0.06);
  ctx.fillStyle = p.text;
  ctx.fillText(text, w / 2, banner * 0.56);
  ctx.fillStyle = p.accent;
  const lineW = Math.min(ctx.measureText(text).width * 0.4, w * 0.2);
  ctx.fillRect(w / 2 - lineW / 2, banner * 0.56 + size * 0.62, lineW, Math.max(2, size * 0.06));
}

/**
 * Wraps a finished poster in a festive frame: the canvas grows by a border on three sides and a
 * greeting banner on top, and the poster is put back inside untouched. `scale` is the poster's own
 * pixels-per-design-pixel. No frame chosen → the canvas is left exactly as it was.
 */
export function applyPosterFrame(canvas: HTMLCanvasElement, frameId: string | null | undefined, lang: Lang, scale = 1): void {
  const frame = posterFrame(frameId);
  if (!frame || !canvas.width || !canvas.height) return;
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);

  const w = canvas.width / scale;
  const h = canvas.height / scale;
  const { band, banner } = frameMetrics(w);
  const fw = w + band * 2;
  const fh = h + banner + band;
  canvas.width = Math.round(fw * scale);
  canvas.height = Math.round(fh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawFrame(ctx, frame, lang, fw, fh, band, banner);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(copy, Math.round(band * scale), Math.round(banner * scale));
  // A thin line where the poster meets the frame
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.strokeStyle = frame.palette.line;
  ctx.lineWidth = Math.max(1.5, w * 0.003);
  ctx.strokeRect(band - ctx.lineWidth / 2, banner - ctx.lineWidth / 2, w + ctx.lineWidth, h + ctx.lineWidth);
}

/** A small preview for the Settings picker: the frame around a plain stand-in poster. */
export function posterFrameThumbnail(frameId: string, lang: Lang): string {
  const canvas = document.createElement('canvas');
  const w = 300;
  const h = 360;
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8e8ec';
  ctx.fillRect(20, 24, 140, 16);
  ctx.fillRect(20, 50, 90, 10);
  ctx.fillStyle = '#121214';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.fillStyle = '#d61e2a';
  ctx.fillRect(0, h * 0.55, w, 4);
  ctx.fillRect(20, h * 0.68, 120, 22);
  applyPosterFrame(canvas, frameId, lang, 2);
  return canvas.toDataURL('image/png');
}
