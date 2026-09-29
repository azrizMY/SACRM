export type SocialPlatform = 'tiktok' | 'threads' | 'facebook' | 'instagram' | 'snapchat' | 'x' | 'telegram';

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export type Showroom = {
  name?: string;
  address?: string;
  /** Optional exact pin (e.g. a Google Maps share link) — otherwise maps links search the name/address. */
  mapsUrl?: string;
};

type PlatformMeta = {
  id: SocialPlatform;
  label: string;
  /** Hosts a pasted link must belong to (subdomains included). */
  hosts: string[];
  profileUrl: (handle: string) => string;
};

export const SOCIAL_PLATFORMS: PlatformMeta[] = [
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], profileUrl: (h) => `https://www.tiktok.com/@${h}` },
  { id: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'], profileUrl: (h) => `https://www.threads.com/@${h}` },
  { id: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], profileUrl: (h) => `https://www.facebook.com/${h}` },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com', 'instagr.am'], profileUrl: (h) => `https://www.instagram.com/${h}` },
  { id: 'snapchat', label: 'Snapchat', hosts: ['snapchat.com'], profileUrl: (h) => `https://www.snapchat.com/add/${h}` },
  { id: 'x', label: 'X (Twitter)', hosts: ['x.com', 'twitter.com'], profileUrl: (h) => `https://x.com/${h}` },
  { id: 'telegram', label: 'Telegram', hosts: ['t.me', 'telegram.me', 'telegram.dog'], profileUrl: (h) => `https://t.me/${h}` },
];

const HANDLE_RE = /^[A-Za-z0-9._-]{1,64}$/;
const BARE_DOMAIN_RE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|\?|$)/i;

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function hostMatches(host: string, domains: string[]): boolean {
  const h = host.toLowerCase();
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

/**
 * Turns whatever the SA typed — a full link, a scheme-less link ("tiktok.com/@ali") or just a
 * handle ("@ali") — into a canonical profile URL. `undefined` means blank (not set); `null` means
 * it can't be turned into a link for this platform.
 */
export function normalizeSocialLink(platform: SocialPlatform, raw?: string | null): string | null | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  const meta = SOCIAL_PLATFORMS.find((p) => p.id === platform)!;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  // Dotted handles ("ali.cars") are common, so a scheme-less value only counts as a link when it
  // has a path or is the platform's own domain.
  const bareDomain = BARE_DOMAIN_RE.test(value) && (value.includes('/') || hostMatches(value.split(/[/?]/)[0], meta.hosts));
  if (hasScheme || bareDomain) {
    const url = parseHttpUrl(hasScheme ? value : `https://${value}`);
    return url && hostMatches(url.hostname, meta.hosts) ? url.href : null;
  }
  const handle = value.replace(/^@/, '');
  return HANDLE_RE.test(handle) ? meta.profileUrl(handle) : null;
}

/** Only the platforms with a usable link, in display order — for rendering. */
export function socialEntries(links?: SocialLinks | null): { id: SocialPlatform; label: string; href: string }[] {
  if (!links) return [];
  return SOCIAL_PLATFORMS.flatMap((p) => {
    const href = normalizeSocialLink(p.id, links[p.id]);
    return href ? [{ id: p.id, label: p.label, href }] : [];
  });
}

/** "https://www.tiktok.com/@ali" → "tiktok.com/@ali" */
export function displayLink(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

export function normalizeMapsUrl(raw?: string | null): string | null | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  const url = parseHttpUrl(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  return url && url.hostname.includes('.') ? url.href : null;
}

function showroomQuery(s?: Showroom | null): string {
  return [s?.name, s?.address].map((v) => (v ?? '').trim()).filter(Boolean).join(', ');
}

export function hasShowroom(s?: Showroom | null): boolean {
  return !!showroomQuery(s) || !!normalizeMapsUrl(s?.mapsUrl);
}

export function showroomMapsHref(s?: Showroom | null): string | null {
  const pinned = normalizeMapsUrl(s?.mapsUrl);
  if (pinned) return pinned;
  const q = showroomQuery(s);
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function showroomWazeHref(s?: Showroom | null): string | null {
  const q = showroomQuery(s);
  return q ? `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes` : null;
}
