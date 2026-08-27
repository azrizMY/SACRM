export const MALAYSIAN_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
];

export type BankerRecord = {
  id: string;
  name: string;
  // Two distinct, independently optional ways a banker gave contact — a real phone number, or a
  // WhatsApp username/handle with no number attached. At least one of the two must be present
  // (enforced by canSubmitBanker), but neither is required on its own.
  phone?: string;
  username?: string;
  bank: string;
  state: string;
  branch?: string;
  notes?: string;
  favourite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type NewBankerInput = {
  name: string;
  phone?: string;
  username?: string;
  bank: string;
  state: string;
  branch?: string;
  notes?: string;
};

export type EditBankerInput = Partial<Omit<BankerRecord, 'id' | 'favourite' | 'createdAt' | 'updatedAt'>>;

/** The Username field is pre-filled with a bare "@" so the handle always reads correctly as typed
 *  — that alone isn't a real handle, so it counts as empty everywhere below. */
function hasUsername(value?: string): boolean {
  const trimmed = value?.trim();
  return !!trimmed && trimmed !== '@';
}

export function canSubmitBanker(input: { name: string; phone?: string; username?: string; bank: string; state: string }): boolean {
  return !!input.name.trim() && !!input.bank && !!input.state && (!!input.phone?.trim() || hasUsername(input.username));
}

function phoneChatHref(phone?: string): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function usernameChatHref(username?: string): string | null {
  const trimmed = username?.trim();
  if (!hasUsername(trimmed)) return null;
  const handle = trimmed!.replace(/^@/, '');
  return handle ? `https://wa.me/${handle}` : null;
}

/** Prefers the phone number when both are present — it's the more reliable deep link. The
 *  username fallback relies on WhatsApp's newer @username chat links (wa.me/<username>), which is
 *  the only way to reach a banker who only ever shared a handle and no number. */
export function whatsAppHref(b: { phone?: string; username?: string }): string | null {
  return phoneChatHref(b.phone) ?? usernameChatHref(b.username);
}

export function usernameDisplay(username?: string): string | null {
  const trimmed = username?.trim();
  return hasUsername(trimmed) ? trimmed! : null;
}

/** Normalizes a saved username to always carry its "@" prefix, and collapses the empty "@"
 *  placeholder down to undefined so it isn't stored as a fake value. */
export function normalizeUsername(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!hasUsername(trimmed)) return undefined;
  return trimmed!.startsWith('@') ? trimmed! : `@${trimmed}`;
}
