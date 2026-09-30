import type { Env } from './index';

/**
 * Link previews (Open Graph / Twitter card tags) for WhatsApp, Facebook, Telegram etc. Their
 * crawlers don't run JavaScript, so the Angular app can't set these itself — instead the worker
 * rewrites index.html on the way out. Every page gets the site-wide card; a customer quote link
 * gets one naming the advisor, with their profile photo as the image.
 */

type Preview = { title: string; description: string; image: string; imageSize?: [number, number]; url: string };

const SITE_TITLE = 'Redline — Dealership CRM for car sales consultants';
const SITE_DESCRIPTION = 'Quote any car in seconds, send customers a poster or a live quote link, and track every deal from lead to delivery.';

const QUOTE_COPY = {
  en: {
    title: (name: string, brand?: string) => (brand ? `${brand} quote from ${name}` : `Car quote from ${name}`),
    description: 'Pick a model, set your downpayment and see your monthly instalment instantly.',
  },
  ms: {
    title: (name: string, brand?: string) => (brand ? `Sebut harga ${brand} daripada ${name}` : `Sebut harga kereta daripada ${name}`),
    description: 'Pilih model, tetapkan bayaran pendahuluan dan lihat ansuran bulanan anda serta-merta.',
  },
};

const QUOTE_PATH = /^\/quote\/([^/]+)(\/brand)?\/?$/;
const PHOTO_PATH = /^\/api\/public\/photo\/([^/]+)$/;

/** Adds preview tags to an HTML page response. Anything else passes through untouched. */
export async function withLinkPreview(request: Request, response: Response, env: Env): Promise<Response> {
  if (request.method !== 'GET' || !(response.headers.get('Content-Type') ?? '').includes('text/html')) return response;
  const url = new URL(request.url);
  const preview = (await quotePreview(env, url).catch(() => null)) ?? sitePreview(url);
  return new HTMLRewriter().on('head', { element: (head) => void head.append(metaTags(preview), { html: true }) }).transform(response);
}

function sitePreview(url: URL): Preview {
  return { title: SITE_TITLE, description: SITE_DESCRIPTION, image: `${url.origin}/og-image.png`, imageSize: [1200, 630], url: `${url.origin}${url.pathname}` };
}

async function quotePreview(env: Env, url: URL): Promise<Preview | null> {
  const match = url.pathname.match(QUOTE_PATH);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  const user = await env.DB.prepare('SELECT id FROM users WHERE public_token = ?').bind(token).first<{ id: string }>();
  if (!user) return null;

  const [advisorRow, settingsRow] = await Promise.all([
    env.DB.prepare('SELECT data FROM advisor_profiles WHERE user_id = ?').bind(user.id).first<{ data: string }>(),
    env.DB.prepare('SELECT data FROM settings WHERE user_id = ?').bind(user.id).first<{ data: string }>(),
  ]);
  const advisor = advisorRow ? JSON.parse(advisorRow.data) : {};
  const settings = settingsRow ? JSON.parse(settingsRow.data) : {};

  const copy = QUOTE_COPY[settings.salesDefaults?.posterLanguage === 'ms' ? 'ms' : 'en'];
  const name = typeof advisor.name === 'string' && advisor.name.trim() ? advisor.name.trim() : 'your Sales Advisor';
  const brand = match[2] && typeof settings.dashboardTarget?.brand === 'string' ? settings.dashboardTarget.brand : undefined;
  const byline = [advisor.role, advisor.showroom?.name].filter((s) => typeof s === 'string' && s.trim()).join(' · ');
  const hasPhoto = typeof advisor.photoUrl === 'string' && advisor.photoUrl.startsWith('data:image/');

  return {
    title: copy.title(name, brand),
    description: byline ? `${byline}. ${copy.description}` : copy.description,
    image: hasPhoto ? `${url.origin}/api/public/photo/${encodeURIComponent(token)}` : `${url.origin}/og-image.png`,
    imageSize: hasPhoto ? undefined : [1200, 630],
    url: `${url.origin}${url.pathname}`,
  };
}

/** GET /api/public/photo/:token — the advisor's profile photo as a real image file, since it's
 *  stored as a data: URL and preview crawlers need an http(s) link. Null when not a photo route. */
export async function handlePhotoRoute(request: Request, env: Env, url: URL): Promise<Response | null> {
  const match = url.pathname.match(PHOTO_PATH);
  if (!match || request.method !== 'GET') return null;
  const row = await env.DB.prepare(
    'SELECT a.data FROM advisor_profiles a JOIN users u ON u.id = a.user_id WHERE u.public_token = ?',
  )
    .bind(decodeURIComponent(match[1]))
    .first<{ data: string }>();
  const photo: unknown = row ? JSON.parse(row.data).photoUrl : undefined;
  const parsed = typeof photo === 'string' ? photo.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/) : null;
  if (!parsed) return new Response('Not found', { status: 404 });

  const bytes = Uint8Array.from(atob(parsed[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'Content-Type': parsed[1], 'Cache-Control': 'public, max-age=3600' } });
}

function metaTags(p: Preview): string {
  const e = escapeHtml;
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Redline">`,
    `<meta property="og:title" content="${e(p.title)}">`,
    `<meta property="og:description" content="${e(p.description)}">`,
    `<meta property="og:url" content="${e(p.url)}">`,
    `<meta property="og:image" content="${e(p.image)}">`,
    ...(p.imageSize ? [`<meta property="og:image:width" content="${p.imageSize[0]}">`, `<meta property="og:image:height" content="${p.imageSize[1]}">`] : []),
    `<meta name="twitter:card" content="${p.imageSize ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${e(p.title)}">`,
    `<meta name="twitter:description" content="${e(p.description)}">`,
    `<meta name="twitter:image" content="${e(p.image)}">`,
  ];
  return tags.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
