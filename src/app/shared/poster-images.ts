/** Decodes an image URL (a data URL from an upload, or any http(s) URL) into an HTMLImageElement,
 *  cached by URL so redraws don't re-decode the same upload on every frame. */
const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadPosterImage(src: string): Promise<HTMLImageElement> {
  let cached = imageCache.get(src);
  if (!cached) {
    cached = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load image: ${src.slice(0, 40)}…`));
      img.src = src;
    });
    imageCache.set(src, cached);
  }
  return cached;
}

/** Recolours an image to one flat colour, alpha-masked — every non-transparent pixel becomes
 *  `color`, transparent stays transparent. Not used for the brand logo (that draws the dealer's
 *  upload as-is, unrecoloured) — kept for any element that does need a flat-tinted image. Only
 *  works cleanly when the source image actually has a transparent background; an opaque
 *  background tints solid instead of vanishing. */
export function tintImageToColor(img: HTMLImageElement, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
