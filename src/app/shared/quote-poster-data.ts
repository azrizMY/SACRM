import type { AdvisorService } from './advisor.service';
import type { QuoteEngine } from './quote-engine';
import type { PosterData } from './poster-data';
import type { Lang } from './i18n-core';
import { translate } from './i18n-core';
import { modelVariantLabel } from '../data/calculator-data';
import { brandLogo } from '../data/dashboard-data';

/** Assembles the plain data object a poster template draws from — shared by the Calculator and
 *  Live Mode, so every figure on either poster traces back to the same QuoteEngine. */
export function quotePosterData(q: QuoteEngine, advisor: AdvisorService, lang: Lang, accent?: string, frame?: string): PosterData {
  const vehicle = q.selectedVehicle();
  const advisorProfile = advisor.profile();
  return {
    lang,
    accent,
    frame,
    brand: vehicle.brand,
    modelTitle: modelVariantLabel(vehicle.model, vehicle.variant),
    year: q.modelYear(),
    dateStr: new Date().toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: '2-digit', month: 'short', year: 'numeric' }),
    logoUrl: brandLogo(vehicle.brand),
    carImageUrl: vehicle.photoUrl ?? null,
    colours: vehicle.colours ?? [],
    colourSurcharges: vehicle.colourSurcharges ?? {},

    sellingPrice: q.allInPrice(),
    downpayment: q.downpaymentCash(),
    loanAmount: q.loanAmount(),
    isCashPurchase: q.isCashPurchase(),
    advisor: {
      name: advisorProfile.name,
      role: advisorProfile.role,
      initials: advisor.initials(),
      photoUrl: advisorProfile.photoUrl ?? null,
      phoneDisplay: advisorProfile.phoneDisplay,
      bio: advisorProfile.bio,
    },

    otrPrice: q.basePrice(),
    ncdPct: q.ncd(),
    insurance: q.insurance(),
    rebate: q.effectiveRebate(),
    cashback: q.totals().cashback,
    totalAmountDue: q.allInPrice(),

    rateLabel: `${q.interestRate()}% ${q.rateType() === 'flat' ? translate(lang, 'FLAT') : 'EIR'}`,
    interestRatePct: q.interestRate(),
    tenureRows: q.repaymentRows().map((row) => ({
      label: translate(lang, row.label),
      months: row.months,
      monthly: row.monthly,
      isLowest: row.months === Math.max(...q.repaymentRows().map((r) => r.months)),
    })),
  };
}
