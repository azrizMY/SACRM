import type { Showroom, SocialLinks } from './social-data';

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
  showroom?: Showroom;
  /** Canonical profile URLs, only for platforms the SA filled in. */
  socials?: SocialLinks;
};

/** Only what an account hasn't filled in yet falls back to these — so nothing here may ever be a real
 *  person's details (a blank phone shows no WhatsApp button; a real one would show someone else's). */
export const DEFAULT_ADVISOR: AdvisorProfile = {
  name: '',
  role: 'Sales Consultant',
  email: '',
  phoneDisplay: '',
  phoneWa: '',
  bio: 'Helping customers find the right car and the right deal, from first test drive to delivery day.',
};
