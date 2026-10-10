/**
 * Basic premium from the Schedule of Motor Tariff (private car, comprehensive): a fixed amount for
 * the first RM 1,000 of sum insured, by engine band, plus a rate for each further RM 1,000 or part
 * of it. Premiums have been detariffed since 2017, so this is a starting estimate — the SA can type
 * the insurer's real figure over it. The table is data, editable per account in Settings.
 */
export type TariffRegion = 'peninsular' | 'east';

export type MotorTariffBand = {
  /** Engine capacity this band goes up to; null = the top "over" band. */
  ccLimit: number | null;
  /** The first RM 1,000 of sum insured. */
  first: Record<TariffRegion, number>;
  /** Optional per-band rate for each further RM 1,000 (an insurer's own table); else the tariff's. */
  perThousand?: Partial<Record<TariffRegion, number>>;
};

export type MotorTariff = {
  bands: MotorTariffBand[];
  /** Each further RM 1,000 of sum insured. */
  perThousand: Record<TariffRegion, number>;
};

export const DEFAULT_MOTOR_TARIFF: MotorTariff = {
  bands: [
    { ccLimit: 1400, first: { peninsular: 273.8, east: 196.2 } },
    { ccLimit: 1650, first: { peninsular: 305.5, east: 220.0 } },
    { ccLimit: 2200, first: { peninsular: 339.1, east: 243.9 } },
    { ccLimit: 3050, first: { peninsular: 372.6, east: 266.5 } },
    { ccLimit: 4100, first: { peninsular: 404.3, east: 290.4 } },
    { ccLimit: 4250, first: { peninsular: 436.0, east: 313.0 } },
    { ccLimit: 4400, first: { peninsular: 469.6, east: 336.9 } },
    { ccLimit: null, first: { peninsular: 501.3, east: 359.5 } },
  ],
  perThousand: { peninsular: 26.0, east: 20.3 },
};

/** A band's stored key: its cc limit, or "over" for the top band. */
export function bandKey(band: MotorTariffBand): string {
  return band.ccLimit == null ? 'over' : String(band.ccLimit);
}

export function bandLabel(band: MotorTariffBand, tariff: MotorTariff = DEFAULT_MOTOR_TARIFF): string {
  if (band.ccLimit != null) return `Up to ${band.ccLimit.toLocaleString('en-MY')} cc`;
  const below = Math.max(...tariff.bands.map((b) => b.ccLimit ?? 0));
  return `Over ${below.toLocaleString('en-MY')} cc`;
}

/** The band a car's engine size falls in. */
export function bandForCc(cc: number, tariff: MotorTariff = DEFAULT_MOTOR_TARIFF): string {
  const band = [...tariff.bands].filter((b) => b.ccLimit != null).sort((a, b) => a.ccLimit! - b.ccLimit!).find((b) => cc <= b.ccLimit!);
  return band ? bandKey(band) : 'over';
}

/** A band guessed from a variant name like "1.5L" or "1.6T" (1.5 → about 1,500 cc). Null for EVs
 *  and names without an engine size — those need a band picked by hand. */
export function guessBand(name: string, tariff: MotorTariff = DEFAULT_MOTOR_TARIFF): string | null {
  const m = name.match(/\b(\d\.\d)\s*(?:L|T|TGDI|TD|TURBO)?\b/i);
  if (!m) return null;
  const litres = parseFloat(m[1]);
  if (!(litres >= 0.6 && litres <= 7)) return null;
  // 1.5 litre engines are 1,497–1,499 cc, so stay just under the round figure
  return bandForCc(Math.round(litres * 1000) - 2, tariff);
}

/** Basic premium for a sum insured, band and region, or null when there isn't enough to work it out. */
export function tariffBasicPremium(
  sumInsured: number | null | undefined,
  band: string | null | undefined,
  region: TariffRegion,
  tariff: MotorTariff = DEFAULT_MOTOR_TARIFF,
): number | null {
  if (!sumInsured || sumInsured <= 0 || !band) return null;
  const b = tariff.bands.find((x) => bandKey(x) === band);
  if (!b) return null;
  const further = Math.max(0, Math.ceil((sumInsured - 1000) / 1000));
  const rate = b.perThousand?.[region] ?? tariff.perThousand[region];
  return Math.round((b.first[region] + rate * further) * 100) / 100;
}
