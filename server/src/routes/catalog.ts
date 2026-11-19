import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

/**
 * The owner's car catalogue (see migrations/0012_catalog.sql). Reading it is public, because a
 * customer opening a quote link needs the same brands and cars as the signed-in app. Changing it
 * is for the owner account only (users.role = 'owner').
 *
 *   GET    /api/public/catalog              brands + variants, for everyone
 *   PUT    /api/catalog/brands              add a brand or change its logo        (owner)
 *   POST   /api/catalog/brands/rename       rename a brand the owner added        (owner)
 *   DELETE /api/catalog/brands/:name        remove a brand row                    (owner)
 *   PUT    /api/catalog/vehicles/:id        add or edit one variant               (owner)
 *   DELETE /api/catalog/vehicles/:id        delete an added variant, or undo
 *                                           every change to a built-in one        (owner)
 *   POST   /api/catalog/files?name=...      upload a logo, photo or brochure      (owner)
 *   GET    /api/files/:key                  serve an uploaded file, for everyone
 */

const MAX_FILE_BYTES = 25 * 1024 * 1024; // Workers KV's largest single value.
const FILE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};
/** Where a photo, logo or brochure may point: an uploaded file, or a file shipped with the app. */
const FILE_PATH = /^\/(?:api\/files\/f_[0-9a-f-]{36}|(?:cars|brochures|brands)\/[A-Za-z0-9._-]+)$/;

type CatalogVehicleData = Record<string, unknown>;

export async function handlePublicCatalog(env: Env): Promise<Response> {
  const [brands, vehicles, modelOrder] = await Promise.all([
    env.DB.prepare('SELECT name, logo_url AS logoUrl FROM catalog_brands ORDER BY name').all<{ name: string; logoUrl: string | null }>(),
    env.DB.prepare('SELECT id, data FROM catalog_vehicles ORDER BY updated_at').all<{ id: string; data: string }>(),
    loadModelOrder(env),
  ]);
  return json({
    brands: brands.results,
    vehicles: vehicles.results.map((r) => ({ id: r.id, data: JSON.parse(r.data) as CatalogVehicleData })),
    modelOrder,
  });
}

/** The owner's model order per brand. An empty answer (never an error) if the table is missing, so
 *  the catalogue still loads before its migration has run. */
async function loadModelOrder(env: Env): Promise<Record<string, string[]>> {
  try {
    const rows = await env.DB.prepare('SELECT brand, models FROM catalog_model_order').all<{ brand: string; models: string }>();
    const out: Record<string, string[]> = {};
    for (const r of rows.results) {
      const models = JSON.parse(r.models);
      if (Array.isArray(models)) out[r.brand] = models.filter((m): m is string => typeof m === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

export async function handleFileRoute(env: Env, key: string): Promise<Response> {
  if (!env.FILES || !/^f_[0-9a-f-]{36}$/.test(key)) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.FILES.getWithMetadata<{ type: string; name: string }>(key, 'stream');
  if (!value || !metadata) return new Response('Not found', { status: 404 });
  const headers: Record<string, string> = {
    'Content-Type': metadata.type,
    // Uploads never change in place (a replacement gets a new key), so browsers may keep them.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': `inline; filename="${metadata.name.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
  };
  // An SVG is a document that can carry script: lock it down so it can only ever draw.
  if (metadata.type === 'image/svg+xml') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  return new Response(value, { headers });
}

export async function handleCatalogRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);
  if (user.role !== 'owner') return json({ error: 'Only the site owner can change the car catalogue.' }, 403);

  if (url.pathname === '/api/catalog/files' && request.method === 'POST') return uploadFile(request, env, url);

  if (url.pathname === '/api/catalog/brands' && request.method === 'PUT') {
    const body = await readJsonBody<{ name?: unknown; logoUrl?: unknown }>(request);
    const name = cleanText(body?.name, 60);
    if (!name) return json({ error: 'Give the brand a name.' }, 400);
    const logoUrl = body?.logoUrl == null || body.logoUrl === '' ? null : cleanFilePath(body.logoUrl);
    if (logoUrl === undefined) return json({ error: 'That logo file is not valid.' }, 400);
    await env.DB.prepare(
      'INSERT INTO catalog_brands (name, logo_url, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET logo_url = excluded.logo_url, updated_at = excluded.updated_at',
    )
      .bind(name, logoUrl, Date.now())
      .run();
    return json({ name, logoUrl });
  }

  // Rename a brand the owner added. A brand's name is what ties things to it, so everything that
  // holds the old name moves in one batch: its brand row, its cars, and every account's Primary
  // Brand and "Brands I sell". (Built-in brands live in the app's code and aren't renamed; the
  // Manage Cars page only offers this for brands the owner added.)
  if (url.pathname === '/api/catalog/model-order' && request.method === 'PUT') {
    const body = await readJsonBody<{ brand?: unknown; models?: unknown }>(request);
    const brand = cleanText(body?.brand, 60);
    if (!brand) return json({ error: 'Which brand is this order for?' }, 400);
    if (!Array.isArray(body?.models) || body.models.length > 300) return json({ error: 'That model order is not valid.' }, 400);
    const models: string[] = [];
    for (const raw of body.models) {
      const name = cleanText(raw, 120);
      if (name && !models.includes(name)) models.push(name);
    }
    if (models.length) {
      await env.DB.prepare('INSERT INTO catalog_model_order (brand, models, updated_at) VALUES (?, ?, ?) ON CONFLICT(brand) DO UPDATE SET models = excluded.models, updated_at = excluded.updated_at')
        .bind(brand, JSON.stringify(models), Date.now())
        .run();
    } else {
      await env.DB.prepare('DELETE FROM catalog_model_order WHERE brand = ?').bind(brand).run();
    }
    return json({ brand, models });
  }

  if (url.pathname === '/api/catalog/brands/rename' && request.method === 'POST') {
    const body = await readJsonBody<{ from?: unknown; to?: unknown }>(request);
    const from = cleanText(body?.from, 60);
    const to = cleanText(body?.to, 60);
    if (!from || !to) return json({ error: 'Give the brand its new name.' }, 400);
    if (from === to) return json({ name: to });
    const own = await env.DB.prepare('SELECT 1 FROM catalog_brands WHERE name = ?').bind(from).first();
    if (!own) return json({ error: `${from} isn't a brand you added, so it can't be renamed.` }, 400);
    const taken = await env.DB.prepare(
      "SELECT 1 FROM catalog_brands WHERE lower(name) = lower(?) UNION ALL SELECT 1 FROM catalog_vehicles WHERE lower(json_extract(data, '$.brand')) = lower(?) LIMIT 1",
    )
      .bind(to, to)
      .first();
    if (taken && from.toLowerCase() !== to.toLowerCase()) return json({ error: `${to} is already a brand. Pick another name.` }, 409);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO catalog_brands (name, logo_url, updated_at) SELECT ?, logo_url, ? FROM catalog_brands WHERE name = ?').bind(to, now, from),
      env.DB.prepare('DELETE FROM catalog_brands WHERE name = ?').bind(from),
      env.DB.prepare('UPDATE catalog_model_order SET brand = ? WHERE brand = ?').bind(to, from),
      env.DB.prepare("UPDATE catalog_vehicles SET data = json_set(data, '$.brand', ?), updated_at = ? WHERE json_extract(data, '$.brand') = ?").bind(to, now, from),
      env.DB.prepare("UPDATE settings SET data = json_set(data, '$.dashboardTarget.brand', ?) WHERE json_extract(data, '$.dashboardTarget.brand') = ?").bind(to, from),
      env.DB.prepare(
        `UPDATE settings SET data = json_set(data, '$.salesDefaults.brandsISell', (
           SELECT json_group_array(b) FROM (
             SELECT CASE WHEN value = ? THEN ? ELSE value END AS b FROM json_each(settings.data, '$.salesDefaults.brandsISell') ORDER BY key
           )
         ))
         WHERE EXISTS (SELECT 1 FROM json_each(settings.data, '$.salesDefaults.brandsISell') WHERE value = ?)`,
      ).bind(from, to, from),
    ]);
    return json({ name: to });
  }

  const brandMatch = url.pathname.match(/^\/api\/catalog\/brands\/([^/]+)$/);
  if (brandMatch && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM catalog_brands WHERE name = ?').bind(decodeURIComponent(brandMatch[1])).run();
    return json({ ok: true });
  }

  const vehicleMatch = url.pathname.match(/^\/api\/catalog\/vehicles\/([^/]+)$/);
  if (vehicleMatch) {
    const id = decodeURIComponent(vehicleMatch[1]);
    if (!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(id)) return json({ error: 'Invalid car id.' }, 400);
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM catalog_vehicles WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
    if (request.method === 'PUT') {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const data = body && typeof body === 'object' && !Array.isArray(body) ? cleanVehicle(body) : null;
      if (typeof data === 'string') return json({ error: data }, 400);
      if (!data) return json({ error: 'Invalid car details.' }, 400);
      await env.DB.prepare(
        'INSERT INTO catalog_vehicles (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
      )
        .bind(id, JSON.stringify(data), Date.now())
        .run();
      return json({ id, data });
    }
  }

  return json({ error: 'Not found' }, 404);
}

async function uploadFile(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.FILES) return json({ error: 'File storage is not set up on this server yet.' }, 503);
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (!FILE_TYPES[type]) return json({ error: 'Upload a PNG, JPG, WebP or SVG image, or a PDF brochure.' }, 415);
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_FILE_BYTES) return json({ error: 'That file is over 25 MB. Use a smaller one.' }, 413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return json({ error: 'That file is empty.' }, 400);
  if (bytes.byteLength > MAX_FILE_BYTES) return json({ error: 'That file is over 25 MB. Use a smaller one.' }, 413);
  const name = cleanText(url.searchParams.get('name'), 120) || `upload.${FILE_TYPES[type]}`;
  const key = `f_${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { metadata: { type, name, size: bytes.byteLength } });
  return json({ url: `/api/files/${key}`, name, size: bytes.byteLength }, 201);
}

/** Checks and trims a car before it is saved. Returns the clean data, or an error message. Every
 *  field is optional, because a built-in car's row holds only what the owner changed; the page
 *  makes sure a brand-new car has its brand, model, variant and price. */
function cleanVehicle(body: Record<string, unknown>): CatalogVehicleData | string {
  const out: CatalogVehicleData = {};
  // A built-in variant the owner deleted: off every list, kept only so it can be restored.
  if (body['hidden'] === true && body['deleted'] === true) return { hidden: true, deleted: true };
  if (body['hidden'] === true) return { hidden: true };
  for (const key of ['brand', 'model', 'variant'] as const) {
    if (body[key] === undefined) continue;
    const text = cleanText(body[key], 80);
    if (!text) return `The ${key} name can't be empty.`;
    out[key] = text;
  }
  for (const key of ['price', 'sumInsured', 'basicPremium', 'addBenefits'] as const) {
    if (body[key] === undefined || body[key] === null) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return `The ${key === 'price' ? 'price' : key} must be a number.`;
    out[key] = Math.round(n * 100) / 100;
  }
  for (const key of ['photoUrl', 'brochureUrl'] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') {
      out[key] = null;
      continue;
    }
    const path = cleanFilePath(body[key]);
    if (path === undefined) return 'That file is not valid.';
    out[key] = path;
  }
  if (body['ratingBand'] !== undefined) {
    const band = cleanText(body['ratingBand'], 10);
    if (band) out['ratingBand'] = band;
  }
  if (body['colours'] !== undefined) {
    if (!Array.isArray(body['colours'])) return 'Colours must be a list.';
    out['colours'] = body['colours'].map((c) => cleanText(c, 40)).filter(Boolean).slice(0, 30);
  }
  // Each colour's poster dot, as #rrggbb, keyed by the colour name.
  if (body['colourHex'] !== undefined) {
    const raw = body['colourHex'];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return 'Colour swatches must be a list of names and colours.';
    const hex: Record<string, string> = {};
    for (const [name, value] of Object.entries(raw as Record<string, unknown>).slice(0, 30)) {
      const key = cleanText(name, 40);
      if (!key) continue;
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) return `The colour for ${key} is not valid.`;
      hex[key] = value.toLowerCase();
    }
    out['colourHex'] = hex;
  }
  if (body['years'] !== undefined) {
    if (!Array.isArray(body['years']) || body['years'].length === 0) return 'Give the car at least one model year.';
    const years = [];
    for (const raw of body['years'].slice(0, 6)) {
      const y = raw as Record<string, unknown>;
      const year = Number(y?.['year']);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) return 'A model year is not valid.';
      const entry: Record<string, number> = { year };
      for (const k of ['rebate', 'additionalRebate']) {
        if (y[k] === undefined || y[k] === null || y[k] === '') continue;
        const n = Number(y[k]);
        if (!Number.isFinite(n) || n < 0) return 'A rebate must be a number.';
        entry[k] = n;
      }
      years.push(entry);
    }
    out['years'] = years;
  }
  return out;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** A valid file path, or undefined when the value isn't one. */
function cleanFilePath(value: unknown): string | undefined {
  return typeof value === 'string' && FILE_PATH.test(value) ? value : undefined;
}
