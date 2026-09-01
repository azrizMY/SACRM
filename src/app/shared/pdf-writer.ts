/**
 * Zero-dependency PDF writer. Angular has no bundled PDF library and installing one requires
 * an npm/build step that keeps getting blocked in this environment, so quotation PDFs are
 * built by hand as raw PDF syntax (a handful of Type1 base-font text/line/rect operators).
 */
import { variantLabel, type InsuranceQuotationBreakdown, type RateType } from '../data/calculator-data';

export type PdfColor = [number, number, number];
export type PdfFontKey = 'H' | 'HB' | 'C';

export class PdfPage {
  private ops: string[] = [];

  private escape(text: string): string {
    const ascii = text
      .replace(/[–—]/g, '-')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/·/g, '-')
      .replace(/[^\x20-\x7e]/g, '');
    return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  text(x: number, y: number, str: string, opts: { font?: PdfFontKey; size?: number; color?: PdfColor } = {}) {
    const font = opts.font ?? 'H';
    const size = opts.size ?? 10;
    const [r, g, b] = opts.color ?? [0.1, 0.1, 0.1];
    this.ops.push(`${r} ${g} ${b} rg BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${this.escape(str)}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, opts: { color?: PdfColor; width?: number } = {}) {
    const [r, g, b] = opts.color ?? [0.85, 0.85, 0.85];
    this.ops.push(`${r} ${g} ${b} RG ${opts.width ?? 1} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  rectStroke(x: number, y: number, w: number, h: number, color: PdfColor = [0.85, 0.85, 0.85]) {
    const [r, g, b] = color;
    this.ops.push(`${r} ${g} ${b} RG ${x} ${y} ${w} ${h} re S`);
  }

  build(): string {
    return this.ops.join('\n');
  }
}

/** Minimal single-page PDF container: Catalog, Pages, Page, content stream, and 3 standard-14 fonts. */
export function assemblePdfBytes(contentStream: string): Uint8Array {
  return assembleMultiPagePdfBytes([contentStream]);
}

/** Same minimal container as assemblePdfBytes, but for N pages sharing one font resource set —
 *  used to attach a second "Insurance Breakdown" page onto the quotation PDF. */
export function assembleMultiPagePdfBytes(contentStreams: string[]): Uint8Array {
  const pageCount = contentStreams.length;
  const pageObjStart = 3;
  const streamObjStart = pageObjStart + pageCount;
  const fontObjStart = streamObjStart + pageCount;
  const [H, HB, C] = [fontObjStart, fontObjStart + 1, fontObjStart + 2];
  const totalObjects = fontObjStart + 3;

  const objects: string[] = new Array(totalObjects).fill('');
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObjStart + i} 0 R`).join(' ');
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  for (let i = 0; i < pageCount; i++) {
    objects[pageObjStart + i] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /H ${H} 0 R /HB ${HB} 0 R /C ${C} 0 R >> >> /Contents ${streamObjStart + i} 0 R >>`;
  }
  objects[H] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[HB] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[C] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';

  let out = '%PDF-1.4\n';
  const offsets: number[] = new Array(totalObjects).fill(0);

  for (let i = 1; i < totalObjects; i++) {
    offsets[i] = out.length;
    if (i >= streamObjStart && i < streamObjStart + pageCount) {
      const content = contentStreams[i - streamObjStart];
      out += `${i} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`;
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

export type PdfImagePage = {
  /** Raw JPEG bytes (e.g. from canvas.toBlob('image/jpeg')) — embedded directly as a DCTDecode
   *  XObject stream, since a JPEG's own byte stream already is that filter's expected payload;
   *  no re-encoding needed. */
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  /** Page size in PDF points (1/72in) — this page's own MediaBox, since a brochure page (A5) is
   *  a different physical size than the quotation PDF's fixed A4. */
  widthPt: number;
  heightPt: number;
};

/** JPEG bytes -> a JS string with one character per byte (code points 0-255) — the same "binary
 *  string" trick assembleMultiPagePdfBytes already relies on for the whole PDF, extended to a
 *  large binary payload. Chunked so a big JPEG doesn't blow the call stack via a single
 *  String.fromCharCode(...allBytes) spread. */
function bytesToBinaryString(bytes: Uint8Array): string {
  let str = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    str += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return str;
}

/** A multi-page PDF where every page is one full-bleed embedded JPEG — used for the brand
 *  brochure, whose pages are rendered as canvas bitmaps (car photos, colour fills, print-DPI
 *  layout) rather than built from PDF text/line operators the way the quotation PDF is. Each page
 *  gets its own MediaBox, content stream, and image XObject as separate indirect objects. */
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

/** Opens the PDF in a new tab via the browser's native PDF viewer, ready to print from there — no download prompt. */
export function openBlobInNewTab(bytes: Uint8Array, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type QuotationPdfData = {
  brand: string;
  model: string;
  variant: string;
  customerName: string;
  customerPhone: string;
  advisorName: string;
  advisorRole: string;
  dateStr: string;
  basePrice: number;
  effectiveRebate: number;
  ncd: number;
  insuranceAmount: number;
  allInPrice: number;
  isCash: boolean;
  downpaymentCash: number;
  loanAmount: number;
  interestRate: number;
  rateType: RateType;
  repaymentRows: { label: string; monthly: number }[];
  /** Itemized insurance breakdown — expands the Insurance line into its own rows when provided. */
  insuranceBreakdown?: InsuranceQuotationBreakdown;
  /** Only meaningful once a deal is Booked — 0 at quotation stage. */
  bookingFee?: number;
};

/** Every amount in the quotation renders through this — 2 decimals plus thousands separators,
 *  always, so the table reads consistently whether a figure happens to land on a whole ringgit. */
function fmt2(v: number): string {
  return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type TableCell = { text: string; font?: PdfFontKey; color?: PdfColor; align?: 'left' | 'right' };
type TableRow = { cells: TableCell[]; rowHeight?: number };

/** Draws a bordered table (outer rule, row rules, column rules) starting at the given top-left,
 *  and returns the y coordinate immediately below it. Right-aligned cells are rendered in Courier
 *  ('C') so each glyph is a known 0.6em wide — the only way to compute text width without a real
 *  font-metrics table, which this hand-rolled PDF writer has no room for. */
function drawTable(page: PdfPage, x: number, yTop: number, colWidths: number[], rows: TableRow[]): number {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const totalHeight = rows.reduce((sum, r) => sum + (r.rowHeight ?? 18), 0);
  const border: PdfColor = [0.82, 0.82, 0.82];

  page.rectStroke(x, yTop - totalHeight, totalWidth, totalHeight, border);
  let ruleY = yTop;
  for (let i = 0; i < rows.length - 1; i++) {
    ruleY -= rows[i].rowHeight ?? 18;
    page.line(x, ruleY, x + totalWidth, ruleY, { color: border });
  }
  let colX = x;
  for (let c = 0; c < colWidths.length - 1; c++) {
    colX += colWidths[c];
    page.line(colX, yTop, colX, yTop - totalHeight, { color: border });
  }

  let rowY = yTop;
  for (const row of rows) {
    const rowHeight = row.rowHeight ?? 18;
    const textY = rowY - rowHeight + 6;
    let cx = x;
    row.cells.forEach((cell, ci) => {
      const width = colWidths[ci];
      const size = 9.5;
      const font = cell.font ?? 'H';
      let textX = cx + 8;
      if (cell.align === 'right') {
        const charWidth = size * 0.6;
        textX = cx + width - 8 - cell.text.length * charWidth;
      }
      page.text(textX, textY, cell.text, { font, size, color: cell.color });
      cx += width;
    });
    rowY -= rowHeight;
  }
  return rowY;
}

/** Shared quotation layout — used by both the Calculator (live state) and Customer Manager (stored
 *  snapshot). Every cost line — OTR price, rebate, and the full itemized insurance premium when
 *  known — is laid out as one bordered table so the customer can see exactly what they're paying for. */
export function buildQuotationPdfBytes(d: QuotationPdfData): Uint8Array {
  const page = new PdfPage();
  const left = 50;
  const right = 545;
  const rightCol = 340;
  const red: PdfColor = [0.78, 0.12, 0.15];
  const gray: PdfColor = [0.45, 0.45, 0.45];
  const dark: PdfColor = [0.1, 0.1, 0.1];
  let y = 792;

  page.text(left, y, 'REDLINE MOTORS', { font: 'HB', size: 20, color: red });
  page.text(rightCol, y, `Date: ${d.dateStr}`, { font: 'H', size: 9, color: gray });
  y -= 14;
  page.text(left, y, 'Official Quotation', { font: 'H', size: 10, color: gray });
  page.text(rightCol, y, `Advisor: ${d.advisorName}`, { font: 'H', size: 9, color: gray });
  y -= 12;
  page.text(rightCol, y, d.advisorRole, { font: 'H', size: 9, color: gray });
  y -= 14;
  page.line(left, y, right, y, { color: red, width: 2 });
  y -= 26;

  const variant = variantLabel(d.variant);
  page.text(left, y, `${d.brand} ${d.model}${variant ? ' - ' + variant : ''}`, { font: 'HB', size: 16, color: dark });
  y -= 16;
  page.text(left, y, `Prepared for: ${d.customerName || 'Valued Customer'}${d.customerPhone ? ' - ' + d.customerPhone : ''}`, {
    font: 'H',
    size: 10,
    color: gray,
  });
  y -= 30;

  page.text(left, y, fmt2(d.allInPrice), { font: 'HB', size: 26, color: dark });
  y -= 30;

  if (!d.isCash) {
    page.rectStroke(left, y - 40, 235, 40);
    page.text(left + 10, y - 14, 'DOWNPAYMENT', { font: 'H', size: 8, color: gray });
    page.text(left + 10, y - 30, fmt2(d.downpaymentCash), { font: 'HB', size: 13, color: dark });
    page.rectStroke(left + 255, y - 40, 235, 40);
    page.text(left + 265, y - 14, 'LOAN AMOUNT', { font: 'H', size: 8, color: gray });
    page.text(left + 265, y - 30, fmt2(d.loanAmount), { font: 'HB', size: 13, color: dark });
    y -= 62;
  } else {
    y -= 16;
  }

  // ---------- Itemized quotation table: OTR price, the full insurance premium breakdown (when
  // known) grouped under its own section, then rebate/booking fee down to the total amount due —
  // mirrors the insurer's own official-quotation layout line for line. ----------
  const labelWidth = 340;
  const amountWidth = right - left - labelWidth;
  const money = (text: string, opts: { bold?: boolean; color?: PdfColor } = {}): TableCell => ({
    text,
    font: opts.bold ? 'HB' : 'C',
    color: opts.color ?? dark,
    align: 'right',
  });
  const label = (text: string, opts: { bold?: boolean; color?: PdfColor; indent?: boolean } = {}): TableCell => ({
    text: opts.indent ? `    ${text}` : text,
    font: opts.bold ? 'HB' : 'H',
    color: opts.color ?? dark,
  });
  /** A section divider row — bold label, blank amount column. */
  const section = (text: string): TableRow => ({ cells: [label(text, { bold: true, color: gray }), label('')] });

  const rows: TableRow[] = [{ cells: [label('OTR Price (without insurance)'), money(fmt2(d.basePrice))] }];

  const b = d.insuranceBreakdown;
  let totalSalesPrice = d.basePrice + d.insuranceAmount;
  if (b) {
    totalSalesPrice = d.basePrice + b.totalDue;
    rows.push(section('Insurance'));
    rows.push({ cells: [label('Basic Premium'), money(fmt2(b.basicPremium))] });
    rows.push({ cells: [label(`NCD (${b.ncdPct}%)`), money(`- ${fmt2(b.ncdAmount)}`)] });
    if (b.premiumAllRider > 0) {
      rows.push({ cells: [label('Premium All Rider'), money(fmt2(b.premiumAllRider))] });
    }
    if (b.additionalCoverages.length > 0) {
      rows.push(section('Additional Coverage'));
      for (const item of b.additionalCoverages) {
        rows.push({ cells: [label(item.label || 'Additional Coverage', { indent: true }), money(fmt2(item.amount))] });
      }
    }
    rows.push({ cells: [label('Gross Premium', { bold: true }), money(fmt2(b.grossPremium), { bold: true })] });
    rows.push({ cells: [label('Service Tax'), money(fmt2(b.serviceTaxAmount))] });
    rows.push({ cells: [label('Stamp Duty'), money(fmt2(b.stampDuty))] });
    rows.push({ cells: [label('EPR'), money(fmt2(b.epr))] });
    rows.push({ cells: [label('Insurance Amount Due', { bold: true }), money(fmt2(b.totalDue), { bold: true })] });
  } else {
    rows.push({ cells: [label(`Insurance (${d.ncd}% NCD)`), money(fmt2(d.insuranceAmount))] });
  }

  rows.push({ cells: [label('Total Sales Price', { bold: true }), money(fmt2(totalSalesPrice), { bold: true })] });
  rows.push({ cells: [label('Rebate'), money(`- ${fmt2(d.effectiveRebate)}`)] });
  rows.push({ cells: [label('Booking Fee'), money(`- ${fmt2(d.bookingFee ?? 0)}`)] });
  rows.push({ cells: [label('Total Amount Due', { bold: true, color: red }), money(fmt2(d.allInPrice), { bold: true, color: red })] });
  if (!d.isCash) {
    rows.push(
      { cells: [label('Downpayment'), money(fmt2(d.downpaymentCash))] },
      { cells: [label('Loan Amount'), money(fmt2(d.loanAmount))] },
    );
  }

  page.text(left, y, 'QUOTATION BREAKDOWN', { font: 'HB', size: 9, color: gray });
  y -= 12;
  y = drawTable(page, left, y, [labelWidth, amountWidth], rows);
  y -= 20;

  // ---------- Repayment table ----------
  if (!d.isCash) {
    const rateTypeLabel = d.rateType === 'effective' ? 'Effective (declining balance)' : 'Flat';
    page.text(left, y, `MONTHLY REPAYMENT — ${rateTypeLabel} ${d.interestRate}%`, { font: 'HB', size: 9, color: gray });
    y -= 12;
    const repaymentRows: TableRow[] = [
      { cells: [label('Tenure', { bold: true }), label('Monthly Payment', { bold: true })] },
      ...d.repaymentRows.map((r) => ({ cells: [label(r.label), money(`${fmt2(r.monthly)}/mo`)] })),
    ];
    y = drawTable(page, left, y, [labelWidth, amountWidth], repaymentRows);
    y -= 20;
  }

  if (d.isCash) {
    page.text(left, y, 'Estimate only. Insurance may vary from the figures shown here.', { font: 'H', size: 8, color: gray });
  } else {
    page.text(left, y, 'Estimate only. Insurance, bank rate and final loan approval', { font: 'H', size: 8, color: gray });
    y -= 11;
    page.text(left, y, 'may vary from the figures shown here.', { font: 'H', size: 8, color: gray });
  }

  return assemblePdfBytes(page.build());
}
