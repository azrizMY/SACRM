/** Best-effort colour-name → hex lookup for the poster's "Available in:" swatch dots — the Car
 *  Database only stores the manufacturer's own colour names (Vehicle.colours in calculator-data
 *  .ts), not hex codes, so this fills that gap with a reasonable approximation per name. Not
 *  brand-exact; good enough for a small identifying dot next to the printed name. */
const COLOUR_SWATCH_HEX: Record<string, string> = {
  'Carbon Black': '#1A1A1D',
  'Carbon Crystal Black': '#17171A',
  'Dark Black': '#101012',
  'Canyon Black': '#1C1B19',
  'Quartz Black': '#15161A',
  'Phantom Grey': '#5B5D63',
  'Matte Grey': '#6B6C6E',
  'Space Grey': '#54565B',
  'Jet Grey': '#4A4B4F',
  'Zircon Gray': '#7A7C80',
  'Olive Grey': '#6E6A57',
  'Nasdaq Silver': '#C7C9CC',
  'Moonlight Silver': '#CBCDD1',
  'Armour Silver': '#C3C5C9',
  'Khaki White': '#E7E2D6',
  'Snow White': '#F5F5F3',
  'Snowy White': '#F5F5F3',
  'Blood Stone Red': '#8B1E23',
  'Ruby Red': '#9B1B2A',
  'Marine Blue': '#1F3A5F',
  'Glacier Blue': '#7FA8C9',
  'Fjord Grey': '#6E7780',
  'Aurora Green': '#2F5E4E',
  'Alpine Green': '#3C6B4B',
  'Model Green': '#33553F',
  'Blazing Red Pearl': '#A3121E',
  'Ignite Red Metallic': '#B3161F',
  'Platinum White Pearl': '#F1F0EB',
  'Stellar Diamond Pearl': '#D8DBDE',
  'Meteoroid Gray Metallic': '#5C5F64',
  'Crystal Black Pearl': '#111114',
  'Phoenix Orange Pearl': '#E0651E',
  'Lunar Silver Metallic': '#C4C7CB',
  'Aqua Green': '#BEE2D8',
  'Canyon River Blue Metallic': '#24334F',
  'Energy Green': '#8DB2AC',
  'Ayers Silver': '#B8BBBF',
  'Crayon Grey': '#5D6873',
  'Sun Black': '#141416',
  'Hamilton White': '#F0F0ED',
  'Hazel Wood Beige': '#D8C4B0',
  'So Blue': '#22B2CE',
  'Pistachio Green': '#BFD8C2',
  'Aqua Grey': '#5E7286',
  'Wisdom Grey': '#5A626A',
  'Aurora White': '#F2F2F0',
  'Nebula Black': '#141417',
  'Crystal Grey': '#899094',
};

/** Neutral fallback dot for any colour name not in the table above — still shows *a* dot rather
 *  than nothing, since the printed name is always correct regardless of the swatch's accuracy. */
const FALLBACK_HEX = '#9E9EA8';

/** Strips a trailing " + Black Roof" (or similar) qualifier before lookup — that stays in the
 *  displayed label, but a two-tone dot for it isn't worth the complexity. */
export function swatchHexFor(colourName: string): string {
  const base = colourName.split('+')[0].trim();
  return COLOUR_SWATCH_HEX[base] ?? FALLBACK_HEX;
}
