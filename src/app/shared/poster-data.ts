/** Everything the poster canvas needs to draw one quotation — assembled by the Calculator from its
 *  existing signals. Nothing in poster-renderer.ts reads app state directly; it only ever sees
 *  this plain data, so the renderer stays testable and the "no hardcoded figures" rule is
 *  structural rather than just a convention. */
export type PosterTenureRow = {
  label: string;
  /** Raw tenure length in months — kept alongside the already-formatted English `label` so a
   *  template in another language (e.g. "9 Tahun" instead of "9 Yrs") can format its own caption
   *  instead of parsing the English string. */
  months: number;
  monthly: number;
  isLowest: boolean;
};

export type PosterAdvisor = {
  name: string;
  role: string;
  initials: string;
  photoUrl: string | null;
  phoneDisplay: string;
};

export type PosterData = {
  brand: string;
  modelTitle: string;
  year: number;
  dateStr: string;
  logoUrl: string | null;
  carImageUrl: string | null;
  /** Factory colour options for this exact variant, in catalog order — empty when the Car Database
   *  has none hardcoded yet (see Vehicle.colours), in which case nothing is drawn for it. */
  colours: string[];
  /** Per-colour price surcharge (RM) for whichever of `colours` above has one — shown as a small
   *  note next to that colour's row so the printed list stays honest about which options cost
   *  more, independent of whichever colour is actually selected/quoted. */
  colourSurcharges: Record<string, number>;

  sellingPrice: number;
  downpayment: number;
  loanAmount: number;
  advisor: PosterAdvisor;

  otrPrice: number;
  ncdPct: number;
  insurance: number;
  rebate: number;
  totalAmountDue: number;

  rateLabel: string;
  /** Same rate as rateLabel, as a plain number — for a template that formats its own caption
   *  (e.g. just "2.3%") instead of using the English "2.3% FLAT" label. */
  interestRatePct: number;
  tenureRows: PosterTenureRow[];
};
