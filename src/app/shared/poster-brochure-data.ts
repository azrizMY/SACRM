/** One catalog row on the brand brochure — every model/variant/year of the chosen brand gets its
 *  own row, independent of whatever car is selected in the single-quote Calculator above it. */
export type BrochureRow = {
  modelTitle: string;
  year: number;
  carImageUrl: string | null;
  otrPrice: number;
  /** Total insurance due at 0% NCD (basic premium + additional coverages) — never just the basic
   *  premium alone. */
  insurance: number;
  sellingPrice: number;
  /** Base rebate, plus the additional rebate when the "Include Additional Rebate" toggle is on. */
  rebate: number;
  downpayment: number;
  loanAmount: number;
  /** Monthly instalment for each of `BrochureData.tenureYears`, same order/length (3). */
  monthlyByTenure: number[];
};

export type BrochureData = {
  brand: string;
  logoUrl: string | null;
  /** e.g. "September 2026 Offers" — user-editable, defaults from today's date. */
  title: string;
  /** The 3 tenure years every row's monthly columns are quoted at, e.g. [3, 5, 7]. */
  tenureYears: number[];
  rows: BrochureRow[];
  advisor: {
    name: string;
    role: string;
    phoneDisplay: string;
    /** Digits-only, country-code-prefixed (e.g. "601153206966") — what a wa.me link needs. */
    phoneWa: string;
    photoUrl: string | null;
  };
};
