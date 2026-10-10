import { json } from '../http';
import type { Env } from '../index';

type Showroom = { name?: string; address?: string; mapsUrl?: string };
type PublicAdvisor = {
  name: string;
  role: string;
  phoneDisplay: string;
  phoneWa: string;
  photoUrl?: string;
  bio?: string;
  showroom?: Showroom;
  socials?: Record<string, string>;
};

const SOCIAL_PLATFORMS = ['tiktok', 'threads', 'facebook', 'instagram', 'snapchat', 'x', 'telegram'];

function cleanString(value: unknown, max = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function publicShowroom(raw: unknown): Showroom | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const mapsUrl = cleanString(r['mapsUrl'], 1000);
  const showroom: Showroom = {
    name: cleanString(r['name'], 200),
    address: cleanString(r['address']),
    mapsUrl: mapsUrl && isHttpUrl(mapsUrl) ? mapsUrl : undefined,
  };
  return showroom.name || showroom.address || showroom.mapsUrl ? showroom : undefined;
}

function publicSocials(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const socials: Record<string, string> = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const value = cleanString(r[platform], 1000);
    if (value && isHttpUrl(value)) socials[platform] = value;
  }
  return Object.keys(socials).length ? socials : undefined;
}

/** No session check anywhere in this file — that's the point. The one route here resolves the
 *  account from the `public_token` in the URL instead of a cookie, and exposes only the minimal
 *  subset of that account's data a customer-facing quote page actually needs — including the
 *  bio, showroom and social links shown on the Profile tab (never email,
 *  never other customers, nothing write-capable — the page's "WhatsApp Advisor" button sends the
 *  quote as a plain wa.me message, so there's no lead-submission endpoint to guard here either). */
/** The account's motor tariff table, only if it's well-formed numbers (it's shown to customers). */
function validTariff(t: unknown): unknown {
  if (!t || typeof t !== 'object') return undefined;
  const tariff = t as { bands?: unknown; perThousand?: unknown };
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 100000;
  const region = (r: unknown) => !!r && typeof r === 'object' && num((r as Record<string, unknown>).peninsular) && num((r as Record<string, unknown>).east);
  if (!Array.isArray(tariff.bands) || tariff.bands.length === 0 || tariff.bands.length > 20 || !region(tariff.perThousand)) return undefined;
  const bands = tariff.bands.map((b: Record<string, unknown>) => {
    if (!b || typeof b !== 'object' || !region(b.first) || !(b.ccLimit === null || num(b.ccLimit))) return null;
    const first = b.first as Record<string, number>;
    const per = b.perThousand && typeof b.perThousand === 'object' ? (b.perThousand as Record<string, unknown>) : undefined;
    return {
      ccLimit: b.ccLimit,
      first: { peninsular: first.peninsular, east: first.east },
      ...(per ? { perThousand: { ...(num(per.peninsular) ? { peninsular: per.peninsular } : {}), ...(num(per.east) ? { east: per.east } : {}) } } : {}),
    };
  });
  if (bands.some((b) => b === null)) return undefined;
  const per = tariff.perThousand as Record<string, number>;
  return { bands, perThousand: { peninsular: per.peninsular, east: per.east } };
}

/** The poster colours the app offers (POSTER_ACCENTS in src/app/shared/poster-theme.ts). */
const POSTER_ACCENT_IDS = ['red', 'blue', 'navy', 'teal', 'orange', 'purple', 'magenta', 'gold'];
/** The festive frames the app offers (POSTER_FRAMES in src/app/shared/poster-frames.ts). */
const POSTER_FRAME_IDS = ['raya', 'ramadan', 'haji', 'cny', 'deepavali', 'christmas', 'merdeka', 'malaysiaday', 'newyear'];

export async function handlePublicRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const bundleMatch = url.pathname.match(/^\/api\/public\/quote\/([^/]+)$/);
  if (bundleMatch && request.method === 'GET') {
    return getPublicQuoteBundle(env, decodeURIComponent(bundleMatch[1]));
  }

  return json({ error: 'Not found' }, 404);
}

async function findUserIdByToken(env: Env, token: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT id FROM users WHERE public_token = ?').bind(token).first<{ id: string }>();
  return row?.id ?? null;
}

async function getPublicQuoteBundle(env: Env, token: string): Promise<Response> {
  const userId = await findUserIdByToken(env, token);
  if (!userId) return json({ error: 'This link is not valid.' }, 404);

  const [advisorRow, settingsRow, overridesResult] = await Promise.all([
    env.DB.prepare('SELECT data FROM advisor_profiles WHERE user_id = ?').bind(userId).first<{ data: string }>(),
    env.DB.prepare('SELECT data FROM settings WHERE user_id = ?').bind(userId).first<{ data: string }>(),
    env.DB.prepare('SELECT vehicle_id, data FROM vehicle_overrides WHERE user_id = ?').bind(userId).all<{ vehicle_id: string; data: string }>(),
  ]);

  const advisorData = advisorRow ? JSON.parse(advisorRow.data) : {};
  const advisor: PublicAdvisor = {
    name: advisorData.name ?? 'Your Sales Advisor',
    role: advisorData.role ?? '',
    phoneDisplay: advisorData.phoneDisplay ?? '',
    phoneWa: advisorData.phoneWa ?? '',
    photoUrl: advisorData.photoUrl,
    bio: cleanString(advisorData.bio, 1000),
    showroom: publicShowroom(advisorData.showroom),
    socials: publicSocials(advisorData.socials),
  };

  const settingsData = settingsRow ? JSON.parse(settingsRow.data) : {};
  const salesDefaults = {
    defaultRateType: settingsData.salesDefaults?.defaultRateType ?? 'flat',
    interestRate: settingsData.salesDefaults?.interestRate ?? 2.3,
    effectiveRate: typeof settingsData.salesDefaults?.effectiveRate === 'number' ? settingsData.salesDefaults.effectiveRate : 4.3,
    downpaymentPct: settingsData.salesDefaults?.downpaymentPct ?? 10,
    ncd: settingsData.salesDefaults?.ncd ?? 0,
    basicPremiumRatePct: settingsData.salesDefaults?.basicPremiumRatePct ?? 3.6,
    posterLanguage: settingsData.salesDefaults?.posterLanguage === 'ms' ? 'ms' : 'en',
    // What customers' WhatsApp messages to the advisor are written in; absent = the poster language.
    whatsappLanguage: ['ms', 'en'].includes(settingsData.salesDefaults?.whatsappLanguage) ? settingsData.salesDefaults.whatsappLanguage : undefined,
    loanRounding: settingsData.salesDefaults?.loanRounding === 'up' ? 'up' : 'down',
    // Only a known colour id is passed on (the app falls back to red for anything else).
    posterAccent: POSTER_ACCENT_IDS.includes(settingsData.salesDefaults?.posterAccent) ? settingsData.salesDefaults.posterAccent : undefined,
    posterFrame: POSTER_FRAME_IDS.includes(settingsData.salesDefaults?.posterFrame) ? settingsData.salesDefaults.posterFrame : undefined,
  };
  (salesDefaults as Record<string, unknown>).testDriveEnabled = settingsData.salesDefaults?.testDriveEnabled !== false;
  (salesDefaults as Record<string, unknown>).insuranceRegion = settingsData.salesDefaults?.insuranceRegion === 'east' ? 'east' : 'peninsular';
  const tariff = validTariff(settingsData.salesDefaults?.motorTariff);
  if (tariff) (salesDefaults as Record<string, unknown>).motorTariff = tariff;
  const vehicleInsurance = settingsData.vehicleInsurance ?? {};
  // Only the brand name, not the SA's sales target number — that figure is internal, the brand
  // is just what the page should default to showing this customer.
  const defaultBrand: string | undefined = settingsData.dashboardTarget?.brand;

  const vehicleOverrides: Record<string, unknown> = {};
  for (const row of overridesResult.results) vehicleOverrides[row.vehicle_id] = JSON.parse(row.data);

  return json({ advisor, salesDefaults, vehicleInsurance, vehicleOverrides, defaultBrand });
}
