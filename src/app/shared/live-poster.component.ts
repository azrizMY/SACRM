import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, inject } from '@angular/core';
import type { PosterData } from './poster-data';
import type { PosterTemplate, PosterTemplateId } from './poster-templates';
import { posterFontsReady } from './poster-theme';
import { classicTemplate } from './poster-template-classic';
import { compactMyTemplate } from './poster-template-my';
import { promoTemplate, squareTemplate } from './poster-template-social';

/** The Calculator's poster designs, in the order Live Mode offers them. */
export const LIVE_POSTER_TEMPLATES: PosterTemplate[] = [classicTemplate, compactMyTemplate, squareTemplate, promoTemplate];

/** Whether a poster design works for this quote (Monthly Estimate needs a loan, Rebate Deal a rebate). */
export function posterAvailable(t: PosterTemplate, data: PosterData): boolean {
  return !(data.isCashPurchase && t.id === 'compact-my') && (t.isAvailable?.(data) ?? true);
}

/**
 * One of the Calculator's posters on the Live Screen. Redrawn at the resolution it's actually
 * shown at (window size × screen density), so text stays sharp however big the capture window is.
 */
@Component({
  selector: 'app-live-poster',
  standalone: true,
  host: { class: 'flex h-full w-full items-center justify-center' },
  template: `<canvas #canvas class="block h-auto max-h-full w-auto max-w-full"></canvas>`,
})
export class LivePosterComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) data!: PosterData;
  @Input({ required: true }) templateId!: PosterTemplateId;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: ResizeObserver;
  private fontsReady = false;
  private generation = 0;
  /** Design width of the last poster drawn, so the next draw can pick its scale straight away. */
  private designWidth = 0;
  private designHeight = 0;
  private drawnScale = 0;

  ngOnInit() {
    posterFontsReady().then(() => {
      this.fontsReady = true;
      this.draw();
    });
    // Resizing only needs a redraw when it changes how many pixels the poster needs.
    this.observer = new ResizeObserver(() => {
      if (this.scaleFor() !== this.drawnScale) this.draw();
    });
    this.observer.observe(this.host.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['templateId']) this.designWidth = 0;
    this.draw();
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.generation++;
  }

  /** Pixels per design pixel needed to fill the host sharply — at least 2, at most 4. */
  private scaleFor(): number {
    if (!this.designWidth) return 2;
    const box = this.host.nativeElement.getBoundingClientRect();
    const shown = Math.min(box.width / this.designWidth, box.height / this.designHeight) || 1;
    return Math.min(4, Math.max(2, Math.ceil(shown * (window.devicePixelRatio || 1) * 4) / 4));
  }

  private async draw() {
    if (!this.fontsReady || !this.data) return;
    const template = LIVE_POSTER_TEMPLATES.find((t) => t.id === this.templateId) ?? LIVE_POSTER_TEMPLATES[0];
    const canvas = this.canvasRef.nativeElement;
    const generation = ++this.generation;
    const scale = this.scaleFor();
    await template.render(canvas, this.data, scale, () => generation !== this.generation);
    if (generation !== this.generation) return;
    const firstSize = !this.designWidth;
    this.drawnScale = scale;
    this.designWidth = canvas.width / scale;
    this.designHeight = canvas.height / scale;
    // The first draw had to guess its scale; redraw once now the poster's real size is known.
    if (firstSize && this.scaleFor() !== scale) this.draw();
  }
}
