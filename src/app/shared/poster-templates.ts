import type { PosterData } from './poster-data';

export type PosterTemplateId = 'classic' | 'compact-my';

/** One visual design for the Quote Preview poster — every template consumes the exact same
 *  PosterData contract, so adding one is purely a new layout/renderer pair, never a change to how
 *  the Calculator gathers data. */
export interface PosterTemplate {
  id: PosterTemplateId;
  label: string;
  /** Sizes `canvas` itself (design-pixel dimensions x `scale`) and draws the whole poster into it.
   *  `isStale`, checked between each async step (image loads), lets an in-flight render bail out
   *  early once a newer one has started — callers rendering into a shared, reused canvas (the live
   *  preview) must pass a real check; a one-shot render into a fresh offscreen canvas (export) can
   *  just pass `() => false`. */
  render(canvas: HTMLCanvasElement, data: PosterData, scale: number, isStale: () => boolean): Promise<void>;
}
