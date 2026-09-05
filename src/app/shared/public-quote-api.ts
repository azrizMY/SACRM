import { apiRequest } from './api-client';
import type { VehicleOverride } from '../data/calculator-data';
import type { VehicleInsuranceOverrides } from '../data/settings-data';

export type PublicAdvisor = { name: string; role: string; phoneDisplay: string; phoneWa: string; photoUrl?: string };

export type PublicQuoteBundle = {
  advisor: PublicAdvisor;
  salesDefaults: { defaultRateType: 'flat' | 'effective'; interestRate: number; downpaymentPct: number; ncd: number; basicPremiumRatePct: number };
  vehicleInsurance: VehicleInsuranceOverrides;
  vehicleOverrides: Record<string, VehicleOverride>;
  /** The SA's own Default Brand (Account Settings → Dashboard) — the page opens on this brand's
   *  first car, same as the Calculator does for the signed-in SA. */
  defaultBrand?: string;
};

/** No session/cookie needed — the token in the URL is the whole identity. Used only by
 *  PublicQuoteComponent, the one page in the app reachable without logging in. */
export function fetchPublicQuote(token: string): Promise<PublicQuoteBundle> {
  return apiRequest<PublicQuoteBundle>(`/api/public/quote/${encodeURIComponent(token)}`);
}
