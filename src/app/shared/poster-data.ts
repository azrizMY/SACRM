/** Everything the poster canvas needs to draw one quotation — assembled by the Calculator from its
 *  existing signals. Nothing in poster-renderer.ts reads app state directly; it only ever sees
 *  this plain data, so the renderer stays testable and the "no hardcoded figures" rule is
 *  structural rather than just a convention. */
export type PosterTenureRow = {
  label: string;
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
  tenureRows: PosterTenureRow[];

  offers: string[];
};
