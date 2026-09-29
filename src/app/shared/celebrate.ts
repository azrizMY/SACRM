/**
 * A short, dependency-free confetti burst drawn on a throwaway full-screen canvas.
 * Used to celebrate a closed deal. No-ops for reduced motion or outside the browser.
 */
const COLOURS = ['#e00012', '#ff6b2c', '#ffb547', '#ffffff', '#34d399', '#a78bfa'];

type Piece = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string };

export function celebrate(): void {
  if (typeof document === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '200' });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = [];
  // Two cannons firing up and inward from the bottom corners.
  for (const side of [0, 1]) {
    for (let i = 0; i < 70; i++) {
      const angle = (side === 0 ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
      const speed = 11 + Math.random() * 9;
      pieces.push({
        x: side === 0 ? 0 : width,
        y: height * 0.9,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        color: COLOURS[(Math.random() * COLOURS.length) | 0],
      });
    }
  }

  const start = performance.now();
  const duration = 2600;
  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.6) / (duration * 0.4));
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
