/** QR matrix generation for the brochure's "scan to WhatsApp" code. Deep-imports the `qrcode`
 *  package's pure algorithmic core (lib/core/qrcode.js) instead of the package root — the root
 *  eagerly requires its Node-only PNG/file renderers (fs, pngjs), which don't exist in the
 *  browser and would break the bundle even though this app never calls them. The core module has
 *  no such dependency, so importing just that gets a plain module matrix this app can draw itself
 *  with fillRect, the same way every other poster primitive is drawn. */
import { create } from 'qrcode/lib/core/qrcode.js';

/** 'high' error correction (~30% of modules can be obscured and still decode) — this app always
 *  draws a logo mark over the center of its QR codes, so the extra redundancy isn't optional. */
export function buildQrMatrix(text: string): boolean[][] {
  const { modules } = create(text, { errorCorrectionLevel: 'high' });
  const matrix: boolean[][] = [];
  for (let row = 0; row < modules.size; row++) {
    const rowValues: boolean[] = [];
    for (let col = 0; col < modules.size; col++) rowValues.push(modules.get(row, col) === 1);
    matrix.push(rowValues);
  }
  return matrix;
}
