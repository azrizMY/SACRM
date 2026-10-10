import type { Vehicle } from '../data/calculator-data';

/** One variant read from a price list. */
export type ParsedPriceRow = {
  /** The variant as the price list names it, e.g. "JAECOO J8 All-Wheel Drive (AWD)". */
  name: string;
  /** On-the-road price without insurance (Peninsular, private registration). */
  otr: number | null;
  sumInsured: number | null;
};

export type PriceListMatch = { row: ParsedPriceRow; vehicle: Vehicle };

export class ScannedPdfError extends Error {
  constructor() {
    super('This PDF is an image. Use the brand’s official digital price list.');
  }
}

/**
 * Reads a PDF's text layer in the browser (pdf.js, loaded only when an import starts) and returns
 * its lines, top to bottom, page by page. Throws ScannedPdfError when there's no text layer.
 */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    lines.push(...textItemsToLines(content.items as TextPiece[]));
  }
  if (!lines.some((l) => /\d{2,3},\d{3}/.test(l))) throw new ScannedPdfError();
  return lines;
}

type TextPiece = { str?: string; width: number; transform: number[] };

/** Groups a page's text pieces into lines by vertical position, read left to right. Some PDFs set
 *  text a letter at a time: pieces that touch are one word, a gap is a space. */
export function textItemsToLines(items: TextPiece[]): string[] {
  const rows = new Map<number, { x: number; w: number; text: string }[]>();
  for (const item of items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    const row = rows.get(y) ?? [];
    row.push({ x: item.transform[4], w: item.width, text: item.str });
    rows.set(y, row);
  }
  const lines: string[] = [];
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    let text = '';
    let end = -Infinity;
    let space = false;
    for (const r of rows.get(y)!.sort((a, b) => a.x - b.x)) {
      if (!r.text.trim()) {
        space = true;
        continue;
      }
      text += (text && (space || r.x - end > 1.5) ? ' ' : '') + r.text;
      end = r.x + r.w;
      space = false;
    }
    text = text.replace(/\s+/g, ' ').trim();
    if (text) lines.push(undouble(text));
  }
  return lines;
}

/** Bold text in some price lists comes out with every character twice ("SSuumm" → "Sum"). */
export function undouble(text: string): string {
  return text
    .split(' ')
    .map((word) => {
      if (word.length < 4 || word.length % 2) return word;
      for (let i = 0; i < word.length; i += 2) if (word[i] !== word[i + 1]) return word;
      let out = '';
      for (let i = 0; i < word.length; i += 2) out += word[i];
      return out;
    })
    .join(' ');
}

/** A label squeezed for matching: lower case, letters only, repeated letters collapsed — survives
 *  missing spaces and bold text drawn twice ("RReeccoommeennddeedd" → "recomended"). */
function squeeze(s: string): string {
  return s
    .replace(/[\d.,]+/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}

const MONEY = /\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{4,}(?:\.\d{2})?/g;

function amounts(line: string): number[] {
  return (line.match(MONEY) ?? []).map((m) => Number(m.replace(/,/g, '')));
}

/**
 * Chery, Omoda | Jaecoo (Chery Auto Malaysia): one variant per price list, with Private and Company
 * columns. The variant's name is the heading above "Private"; the figures are the first (Private)
 * column of "On The Road Price w/o Insurance" and "Proposed/Recommended Sum Insured".
 */
function parseCheryGroup(lines: string[]): ParsedPriceRow[] {
  const otrLine = lines.find((l) => /theroadprice/.test(squeeze(l)));
  const siLine = lines.find((l) => /sum.*insured/.test(squeeze(l)));
  if (!otrLine && !siLine) return [];
  const headerEnd = lines.findIndex((l) => /^(private|selingprice|peninsular)/.test(squeeze(l)));
  const header = lines
    .slice(0, headerEnd > 0 ? headerEnd : 3)
    .filter((l) => !/\b(hp|kw|nm)\b/i.test(l) || /\b(2wd|awd|4wd|phev|ev)\b/i.test(l))
    .join(' ');
  return [{ name: header || 'Unnamed variant', otr: otrLine ? (amounts(otrLine)[0] ?? null) : null, sumInsured: siLine ? (amounts(siLine)[0] ?? null) : null }];
}

/**
 * Proton (and other table layouts): one row per variant, with the variant name followed by its
 * figures. Takes the first figure as the OTR price and, when the table has a sum insured column,
 * the last figure as the sum insured.
 */
function parseTable(lines: string[]): ParsedPriceRow[] {
  const header = lines.find((l) => /sum insured/i.test(l)) ?? '';
  const hasSi = !!header;
  return lines
    .map((l) => ({ l, nums: amounts(l).filter((n) => n >= 10000) }))
    .filter((x) => x.nums.length >= 1 && /[a-z]/i.test(x.l.replace(MONEY, '')))
    .filter((x) => !/(selling price|registration|road tax|ownership|number plate|sum insured|on the road)/i.test(x.l))
    .map((x) => ({
      name: x.l.replace(MONEY, '').replace(/\bRM\b/gi, '').replace(/\s+/g, ' ').trim(),
      otr: x.nums[0] ?? null,
      sumInsured: hasSi && x.nums.length > 1 ? x.nums[x.nums.length - 1] : null,
    }));
}

/** Rows from one price list's lines, using the brand's layout. */
export function parsePriceList(brand: string, lines: string[], fileName = ''): ParsedPriceRow[] {
  const single = /chery|omoda|jaecoo/i.test(brand) ? parseCheryGroup(lines) : [];
  // A one-car price list's file name usually names the car too ("OMODA C9 Price List AWD") — a
  // fallback for headings drawn in a stylised font that doesn't come out as text
  if (single.length === 1 && fileName) {
    const hint = fileName.replace(/\.pdf$/i, '').replace(/price ?list|\(.*?\)|-\d+$/gi, ' ').replace(/\s+/g, ' ').trim();
    single[0].name = `${single[0].name} · ${hint}`;
  }
  return single.length ? single : parseTable(lines);
}

/** Lower case, letters and digits only — "J7 AWD" and "j7-awd" match. */
export function normaliseName(s: string): string {
  return s.toLowerCase().replace(/all[- ]wheel drive/g, 'awd').replace(/(two|2)[- ]wheel drive/g, '2wd').replace(/[^a-z0-9]/g, '');
}

/**
 * Matches each parsed row to one of the brand's variants: the variant whose model and variant names
 * both appear in the row's name, preferring the longest (most specific) match. Rows that match
 * nothing come back as unmatched ("New variant?").
 */
export function matchRows(rows: ParsedPriceRow[], vehicles: Vehicle[]): { matched: PriceListMatch[]; unmatched: ParsedPriceRow[] } {
  const matched: PriceListMatch[] = [];
  const unmatched: ParsedPriceRow[] = [];
  const used = new Set<string>();
  for (const row of rows) {
    const text = normaliseName(row.name);
    let best: { v: Vehicle; score: number } | null = null;
    for (const v of vehicles) {
      if (used.has(v.id)) continue;
      const model = normaliseName(v.model.replace(/^(chery|proton|omoda|jaecoo)\s+/i, ''));
      const variant = normaliseName(v.variant);
      if (!model || !text.includes(model)) continue;
      if (variant && !text.includes(variant)) continue;
      // A variant-less row only matches a variant-less car, unless it's the model's only car
      const score = model.length + variant.length * 2;
      if (!best || score > best.score) best = { v, score };
    }
    if (best) {
      matched.push({ row, vehicle: best.v });
      used.add(best.v.id);
    } else unmatched.push(row);
  }
  return { matched, unmatched };
}
