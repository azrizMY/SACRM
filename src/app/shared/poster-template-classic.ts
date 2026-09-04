import { computePosterLayout } from './poster-layout';
import { drawPosterSkeleton, drawHeader, drawCarHero, drawPricePanel, drawDataSection, drawFooter } from './poster-renderer';
import type { PosterTemplate } from './poster-templates';

/** The original full-quotation poster from quote-poster-spec.md — 900x1168 design px, header,
 *  car hero, price panel, itemized data section, footer. */
export const classicTemplate: PosterTemplate = {
  id: 'classic',
  label: 'Full Quotation',
  async render(canvas, data, scale, isStale) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layout = computePosterLayout();

    canvas.width = 900 * scale;
    canvas.height = layout.totalHeight * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    drawPosterSkeleton(ctx, layout);
    await drawHeader(ctx, data);
    if (isStale()) return;
    await drawCarHero(ctx, layout, data);
    if (isStale()) return;
    await drawPricePanel(ctx, data);
    if (isStale()) return;
    drawDataSection(ctx, layout, data);
    drawFooter(ctx, layout, data);
  },
};
