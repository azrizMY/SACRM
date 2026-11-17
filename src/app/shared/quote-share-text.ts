import type { PosterData } from './poster-data';
import { translate, type Lang } from './i18n-core';
import { downpaymentDisplay, vehicleTitle, type RateType } from '../data/calculator-data';
import { formatRM2 } from '../data/dashboard-data';

/**
 * The message that goes with a shared quote poster — the same figures as the poster, as text the
 * customer can read (and copy) in the chat. Built from the poster's own data so the two can't
 * disagree. Figures only: never the advisor's name or role (they're on the poster already, and the
 * owner asked for shares not to add them).
 *
 * WhatsApp formatting: *bold* for the car and the headline lines.
 */
export function quoteShareText(data: PosterData, rateType: RateType, lang: Lang): string {
  const T = (en: string, params?: Record<string, string | number>) => translate(lang, en, params);
  const rm = formatRM2;
  const cashback = data.cashback ?? 0;
  const priceRebate = data.rebate - cashback;

  const lines: string[] = [
    `*${vehicleTitle(data.brand, data.modelTitle)} (${data.year})*`,
    '',
    T('Car price (OTR): {amount}', { amount: rm(data.otrPrice) }),
    T('Insurance ({ncd}% NCD): {amount}', { ncd: data.ncdPct, amount: rm(data.insurance) }),
    T('Rebate: - {amount}', { amount: rm(priceRebate) }),
    ...(cashback > 0 ? [T('Cash back to you: {amount}', { amount: rm(cashback) })] : []),
    `*${T('Total price: {amount}', { amount: rm(data.sellingPrice) })}*`,
  ];

  if (data.isCashPurchase) {
    lines.push('', T('Cash purchase, no loan.'));
  } else {
    const dp = downpaymentDisplay(data.downpayment);
    const rate = `${data.interestRatePct}% ${rateType === 'flat' ? T('flat') : 'EIR'}`;
    lines.push(
      '',
      dp.isCashBack ? T('Cash back: {amount}', { amount: rm(dp.amount) }) : T('Downpayment: {amount}', { amount: rm(dp.amount) }),
      T('Loan amount: {amount}', { amount: rm(data.loanAmount) }),
      T('Interest rate: {rate}', { rate }),
      '',
      `*${T('Monthly instalment')}*`,
      ...data.tenureRows.map((r) => {
        const period = r.months % 12 === 0 ? T('{n} years', { n: r.months / 12 }) : T('{n} months', { n: r.months });
        return `${period}: ${rm(r.monthly)}`;
      }),
    );
  }

  lines.push('', T('Estimate only. Insurance, bank rate and final loan approval may vary.'));
  return lines.join('\n');
}
