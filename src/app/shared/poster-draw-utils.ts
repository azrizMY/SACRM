/** Small canvas-drawing helpers shared across every poster band — generic enough that the header,
 *  price panel, and data section all reuse the same polygon/tracked-text primitives instead of
 *  each re-deriving them. */

/** Fills an arbitrary closed polygon — used for the header's slash, the 2026 tag, and (in later
 *  stages) every notched-corner tile the spec calls for. */
export function fillPolygon(ctx: CanvasRenderingContext2D, points: [number, number][], fillStyle: string): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/** A rectangle with its top-right corner cut off at 45° — the "notch" the spec puts on stat
 *  boxes, the avatar tile, tenure cards, and chips. `notch` is the size of the cut, in px. */
export function notchedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, notch: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width - notch, y);
  ctx.lineTo(x + width, y + notch);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
}

export function fillNotchedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, notch: number, fillStyle: string): void {
  notchedRectPath(ctx, x, y, width, height, notch);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/** Draws text with explicit letter-spacing — canvas has no native tracking support, so this walks
 *  the string one character at a time, advancing by each glyph's measured width plus the gap.
 *  Only left-alignment is meaningful for tracked text (the poster never centres or right-aligns
 *  a spaced-out label), so this always draws left-to-right from `x` regardless of the context's
 *  current textAlign, restoring it afterwards. */
export function fillTrackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): void {
  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
  ctx.textAlign = previousAlign;
}

/** Total rendered width of tracked text — needed wherever tracked text must be right-aligned or
 *  centred (fillTrackedText itself only supports left alignment). */
export function measureTrackedText(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width + spacing;
  return width - spacing;
}

/** Every currency figure on the poster — always 2 decimal places plus thousands separators
 *  (matching the reference design, e.g. "RM 82,457.58"), never the rounded/compact forms used
 *  elsewhere in the app. */
export function formatPosterCurrency(value: number): string {
  return `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
