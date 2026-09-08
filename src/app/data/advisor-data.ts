export type AdvisorProfile = {
  name: string;
  role: string;
  email: string;
  phoneDisplay: string;
  phoneWa: string;
  bio: string;
  /** Uploaded headshot (data URL) shown on the Profile page and the Calculator's Quote Preview —
   *  falls back to initials on a gradient tile everywhere it's absent. */
  photoUrl?: string;
};

/** Malaysian mobile display format ("011-53206966") derived from the WhatsApp digits
 *  ("601153206966") — WhatsApp number is the single source of truth for both fields. */
export function phoneDisplayFromWa(phoneWa: string): string {
  const digits = phoneWa.replace(/\D/g, '');
  const local = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
  return local.length > 3 ? `${local.slice(0, 3)}-${local.slice(3)}` : local;
}

export const DEFAULT_ADVISOR: AdvisorProfile = {
  name: 'Ahmad Azri',
  role: 'Sales Consultant',
  email: 'ahmdazri65@gmail.com',
  phoneDisplay: '011-53206966',
  phoneWa: '601153206966',
  bio: 'Helping customers find the right car and the right deal, from first test drive to delivery day.',
};
