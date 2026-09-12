/** "Documents Required" checklist card, shared by every offer-sheet template that shows it
 *  (Financing Price List, Current Offers) — lives in its own module rather than either renderer so
 *  neither template has to import brochure-specific code from the other. */
import { POSTER_COLORS, labelFont } from './poster-theme';
import { fillTrackedText } from './poster-draw-utils';

/** Two side-by-side checklists (salaried vs self-employed) confined to `width` starting at `x` —
 *  the requirements every SA needs a customer to bring regardless of which car they're financing,
 *  so it lives once in the footer rather than repeated per model. Same card treatment as the
 *  advisor identity block beside it (subtle tint, hairline border, matched height) instead of bare
 *  text floating on white — a checklist reads as a checklist once each item gets its own checkbox
 *  glyph rather than a plain "1. 2. 3." numbering. */
export function drawDocumentsRequired(ctx: CanvasRenderingContext2D, x: number, width: number, top: number): void {
  const pad = 18;
  const cardTop = top - pad;
  const cardHeight = 335; // matches the advisor/QR card's own height so a side-by-side pair align

  ctx.beginPath();
  ctx.roundRect(x, cardTop, width, cardHeight, 14);
  ctx.fillStyle = 'rgba(18,18,20,0.035)';
  ctx.fill();
  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();

  const innerX = x + pad;
  const innerWidth = width - pad * 2;
  // Extra clearance below `top` before the heading's own baseline — `top` alone put the heading's
  // cap-height just 3-4px under the card's top border (alphabetic baseline text draws mostly
  // *above* its y-coordinate), which read as crammed against the edge.
  const contentTop = top + 10;

  ctx.font = labelFont(20, 700);
  ctx.fillStyle = POSTER_COLORS.acc;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  fillTrackedText(ctx, 'DOCUMENTS REQUIRED', innerX, contentTop, 1.6);

  const colGap = 44;
  const colWidth = (innerWidth - colGap) / 2;
  const col2X = innerX + colWidth + colGap;
  const dividerX = innerX + colWidth + colGap / 2;
  const listTop = contentTop + 42;
  const lineHeight = 40;

  ctx.strokeStyle = POSTER_COLORS.hairline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dividerX, listTop - 6);
  ctx.lineTo(dividerX, cardTop + cardHeight - pad);
  ctx.stroke();

  const salaried = ['Copy of IC', 'Driving Licence', 'Latest 3 months payslip', 'Latest 3 months bank statement', 'EPF (KWSP) statement'];
  const selfEmployed = ['Copy of IC', 'Driving Licence', 'Business Registration (SSM)', 'Latest 6 months bank statement'];

  ctx.font = labelFont(15, 700);
  ctx.fillStyle = POSTER_COLORS.gray;
  ctx.fillText('SALARIED', innerX, listTop);
  ctx.fillText('SELF-EMPLOYED', col2X, listTop);

  const checkSize = 17;
  const drawChecklistItem = (itemX: number, y: number, text: string) => {
    ctx.strokeStyle = POSTER_COLORS.grayD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(itemX, y - checkSize + 3, checkSize, checkSize, 4);
    ctx.stroke();

    ctx.font = labelFont(19, 400);
    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, itemX + checkSize + 13, y);
  };

  const itemsTop = listTop + 38;
  salaried.forEach((item, i) => drawChecklistItem(innerX, itemsTop + i * lineHeight, item));
  selfEmployed.forEach((item, i) => drawChecklistItem(col2X, itemsTop + i * lineHeight, item));
}
