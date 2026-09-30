import { MS } from './i18n-ms';

/** The two languages the app speaks. English strings are the keys; anything without a Malay entry
 *  just stays English, so pages can be translated one at a time. */
export type Lang = 'en' | 'ms';

export type Params = Record<string, string | number>;

/** Patterns the dictionary can't list one by one (e.g. "7 Yrs"). */
const MS_PATTERNS: [RegExp, string][] = [
  [/^(\d+) Yrs?$/, '$1 Tahun'],
  [/^(\d+) yrs?$/, '$1 thn'],
  [/^(\d+) Years?$/, '$1 Tahun'],
  [/^(\d+) YEARS?$/, '$1 TAHUN'],
  [/^(\d+) Months?$/, '$1 Bulan'],
  [/^(\d+)% — No NCD$/, '$1% — Tiada NCD'],
  [/^([\d.]+)% — Year (\d+\+?)$/, '$1% — Tahun $2'],
];

/** Translates one English string. Also used outside Angular (the canvas posters). */
export function translate(lang: Lang, en: string, params?: Params): string {
  let out = en;
  if (lang === 'ms') {
    const hit = MS[en];
    if (hit !== undefined) out = hit;
    else {
      for (const [re, rep] of MS_PATTERNS) {
        if (re.test(en)) {
          out = en.replace(re, rep);
          break;
        }
      }
    }
  }
  if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

