/**
 * Zero-dependency PDF writer. Angular has no bundled PDF library and installing one requires
 * an npm/build step that keeps getting blocked in this environment, so the offer-sheet PDF is
 * built by hand as raw PDF syntax (each page is one full-bleed embedded JPEG).
 */

export type PdfImagePage = {
  /** Raw JPEG bytes (e.g. from canvas.toBlob('image/jpeg')) — embedded directly as a DCTDecode
   *  XObject stream, since a JPEG's own byte stream already is that filter's expected payload;
   *  no re-encoding needed. */
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  /** Page size in PDF points (1/72in) — this page's own MediaBox, since a brochure page (A5) can
   *  be a different physical size than another page in the same PDF. */
  widthPt: number;
  heightPt: number;
};

/** JPEG bytes -> a JS string with one character per byte (code points 0-255) — the standard
 *  "binary string" trick for building a PDF byte stream from a JS string. Chunked so a big JPEG
 *  doesn't blow the call stack via a single String.fromCharCode(...allBytes) spread. */
function bytesToBinaryString(bytes: Uint8Array): string {
  let str = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    str += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return str;
}

/** A multi-page PDF where every page is one full-bleed embedded JPEG — used for the brand
 *  brochure and the My Cars offer sheet, whose pages are rendered as canvas bitmaps (car photos,
 *  colour fills, print-DPI layout). Each page gets its own MediaBox, content stream, and image
 *  XObject as separate indirect objects. */
export function assembleImagePdfBytes(pages: PdfImagePage[]): Uint8Array {
  const n = pages.length;
  const pageObjStart = 3;
  const contentObjStart = pageObjStart + n;
  const imageObjStart = contentObjStart + n;
  const totalObjects = imageObjStart + n;

  const objects: string[] = new Array(totalObjects).fill('');
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = Array.from({ length: n }, (_, i) => `${pageObjStart + i} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;

  const contentStreams: string[] = [];
  for (let i = 0; i < n; i++) {
    const { widthPt, heightPt } = pages[i];
    const imageObj = imageObjStart + i;
    const contentObj = contentObjStart + i;
    objects[pageObjStart + i] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] ` +
      `/Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    contentStreams.push(`q ${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm /Im0 Do Q`);
  }

  let out = '%PDF-1.4\n';
  const offsets: number[] = new Array(totalObjects).fill(0);

  for (let i = 1; i < totalObjects; i++) {
    offsets[i] = out.length;
    if (i >= contentObjStart && i < contentObjStart + n) {
      const content = contentStreams[i - contentObjStart];
      out += `${i} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`;
    } else if (i >= imageObjStart && i < imageObjStart + n) {
      const { jpegBytes, widthPx, heightPx } = pages[i - imageObjStart];
      const jpegStr = bytesToBinaryString(jpegBytes);
      out +=
        `${i} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegStr.length} >>\nstream\n${jpegStr}\nendstream\nendobj\n`;
    } else {
      out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
  }

  const xrefStart = out.length;
  out += `xref\n0 ${totalObjects}\n0000000000 65535 f \r\n`;
  for (let i = 1; i < totalObjects; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \r\n`;
  }
  out += `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

export function downloadBlob(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
