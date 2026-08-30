/** Decodes an image file into an HTMLImageElement via a blob URL, revoking it once decoded. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode "${file.name}" as an image.`));
    };
    img.src = url;
  });
}

/** Byte size of a data URL's payload, without actually allocating the decoded bytes. */
function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.ceil((base64.length * 3) / 4);
}

/** Crops a canvas down to the bounding box of its non-transparent pixels — a low alpha threshold
 *  (not zero) so a soft, fading drop-shadow stays intact instead of getting clipped at the point
 *  it becomes near-invisible, plus a small breathing margin so the crop doesn't shave right up
 *  against the shadow's faint edge. Returns the original canvas untouched if there's nothing to trim
 *  (fully transparent image, or already tight to its edges). */
function trimTransparentMargins(source: HTMLCanvasElement): HTMLCanvasElement {
  const { width, height } = source;
  const ctx = source.getContext('2d');
  if (!ctx) return source;
  const { data } = ctx.getImageData(0, 0, width, height);

  const ALPHA_THRESHOLD = 4;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return source; // fully transparent — nothing to crop to

  const pad = Math.round(Math.max(width, height) * 0.02);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  if (trimmedWidth === width && trimmedHeight === height) return source; // already tight

  const trimmed = document.createElement('canvas');
  trimmed.width = trimmedWidth;
  trimmed.height = trimmedHeight;
  const trimmedCtx = trimmed.getContext('2d');
  if (!trimmedCtx) return source;
  trimmedCtx.drawImage(source, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
  return trimmed;
}

export type CompressOptions = {
  /** Longest side, in pixels, the image is scaled down to fit within — never scaled up. */
  maxDimension: number;
  /** Target ceiling in bytes. Only enforceable for JPEG, by stepping quality down; PNG has no
   *  quality knob in canvas, so PNG output is only ever shrunk by maxDimension. */
  maxBytes: number;
  /** 'image/jpeg' compresses real photos well but flattens transparency to white — use it for
   *  photos (cars, headshots). 'image/png' keeps transparency (logos) but can only be dimension-shrunk. */
  format: 'image/jpeg' | 'image/png';
  /** Crops away blank transparent margin around the subject first, before the maxDimension resize
   *  — so the resolution budget goes to the car (and its shadow), not empty canvas around it. Only
   *  meaningful for images with real transparency (car cutouts); a no-op otherwise. */
  trimTransparent?: boolean;
};

/** Resizes and re-encodes any image file to fit within maxDimension/maxBytes, always returning a
 *  usable data URL — an upload is never rejected for being too big, it's shrunk to fit instead. */
export async function compressImageFile(file: File, options: CompressOptions): Promise<string> {
  const img = await loadImage(file);

  let source: HTMLCanvasElement = document.createElement('canvas');
  source.width = img.naturalWidth;
  source.height = img.naturalHeight;
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) throw new Error('Canvas rendering is not supported in this browser.');
  sourceCtx.drawImage(img, 0, 0);

  if (options.trimTransparent) {
    source = trimTransparentMargins(source);
  }

  const scale = Math.min(1, options.maxDimension / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is not supported in this browser.');
  ctx.drawImage(source, 0, 0, width, height);

  if (options.format === 'image/png') {
    return canvas.toDataURL('image/png');
  }

  let quality = 0.9;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(dataUrl) > options.maxBytes && quality > 0.3) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}
