import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import { isRateLimited } from '../rate-limit';
import type { Env } from '../index';

/**
 * Quote link activity. Visitors' browsers post what they did on an advisor's link (cars viewed,
 * quotes built, taps…) to POST /api/public/events/:token; the advisor reads it back from
 * GET /api/link-events. Only the event types below are accepted, each with its own short list of
 * fields — anything else is dropped, so a name, phone or free text can never be stored.
 */

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_EVENTS_PER_POST = 25;

type FieldKind = 'string' | 'number' | 'boolean' | 'ids';
/** Event type → the payload fields it may carry. */
const EVENT_FIELDS: Record<string, Record<string, FieldKind>> = {
  link_opened: {},
  car_viewed: { year: 'number' },
  quote_built: { year: 'number', deposit: 'number', tenure: 'number', monthly: 'number', cash: 'boolean' },
  poster_saved: { year: 'number', layout: 'string' },
  brochure_opened: {},
  compare_used: { cars: 'ids' },
  budget_used: { monthly: 'number', cash: 'number', fullLoan: 'boolean' },
  whatsapp_tapped: { year: 'number', deposit: 'number', tenure: 'number', monthly: 'number' },
  test_drive_tapped: {},
  trade_in: { tradeIn: 'boolean' },
};

const ID = /^[A-Za-z0-9._-]{1,80}$/;

function cleanPayload(type: string, raw: unknown): Record<string, unknown> {
  const fields = EVENT_FIELDS[type];
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const [key, kind] of Object.entries(fields)) {
    const v = r[key];
    if (kind === 'number' && typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 10_000_000) out[key] = Math.round(v * 100) / 100;
    else if (kind === 'boolean' && typeof v === 'boolean') out[key] = v;
    else if (kind === 'string' && typeof v === 'string' && ID.test(v)) out[key] = v;
    else if (kind === 'ids' && Array.isArray(v)) out[key] = v.filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 3);
  }
  return out;
}

/** POST /api/public/events/:token — a visitor's browser reporting what happened on the link. */
export async function handlePublicEvents(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = decodeURIComponent(url.pathname.slice('/api/public/events/'.length));
  if (!ID.test(token)) return json({ error: 'Not found' }, 404);
  const owner = await env.DB.prepare('SELECT id FROM users WHERE public_token = ?').bind(token).first<{ id: string }>();
  if (!owner) return json({ error: 'Not found' }, 404);

  // The advisor opening their own link isn't a visitor.
  const viewer = await getUserFromSession(env.DB, request).catch(() => null);
  if (viewer?.id === owner.id) return json({ ok: true, recorded: 0 });

  const body = await readJsonBody<{ visitId?: unknown; linkId?: unknown; events?: unknown }>(request);
  const visitId = typeof body?.visitId === 'string' && ID.test(body.visitId) ? body.visitId : null;
  const linkId = body?.linkId === 'brand' ? 'brand' : 'all';
  if (!visitId || !Array.isArray(body?.events)) return json({ error: 'Invalid events.' }, 400);

  // A visit can't flood an advisor's feed.
  if (await isRateLimited(env, `events:${owner.id}:${visitId}`, 300, 60 * 60 * 1000)) return json({ ok: true, recorded: 0 }, 429);

  const now = Date.now();
  const rows = (body!.events as unknown[])
    .slice(0, MAX_EVENTS_PER_POST)
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : null))
    .filter((e): e is Record<string, unknown> => !!e && typeof e['type'] === 'string' && e['type'] in EVENT_FIELDS)
    .map((e) => {
      const type = e['type'] as string;
      const car = typeof e['car'] === 'string' && ID.test(e['car']) ? e['car'] : null;
      // Event times from the browser are trusted only within the last 10 minutes
      const at = typeof e['at'] === 'number' && e['at'] <= now && e['at'] > now - 10 * 60 * 1000 ? Math.round(e['at']) : now;
      return { type, car, payload: JSON.stringify(cleanPayload(type, e['payload'])), at };
    });
  if (!rows.length) return json({ ok: true, recorded: 0 });

  const stmt = env.DB.prepare(
    'INSERT INTO link_events (id, user_id, link_id, visit_id, event_type, car_variant_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  await env.DB.batch(rows.map((r) => stmt.bind(crypto.randomUUID(), owner.id, linkId, visitId, r.type, r.car, r.payload, r.at)));
  // Housekeeping: drop events past 90 days now and then
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM link_events WHERE created_at < ?').bind(now - RETENTION_MS).run();
  return json({ ok: true, recorded: rows.length });
}

/** GET /api/link-events?since=<ms> — the signed-in advisor's own link activity, newest first. */
export async function handleLinkEventsRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const now = Date.now();
  const sinceParam = Number(url.searchParams.get('since'));
  const since = Number.isFinite(sinceParam) && sinceParam > 0 ? Math.max(sinceParam, now - RETENTION_MS) : now - 30 * 24 * 60 * 60 * 1000;

  if (url.pathname === '/api/link-events/count') {
    const row = await env.DB.prepare('SELECT COUNT(DISTINCT visit_id) AS visits FROM link_events WHERE user_id = ? AND created_at > ?')
      .bind(user.id, since)
      .first<{ visits: number }>();
    return json({ visits: row?.visits ?? 0 });
  }

  const { results } = await env.DB.prepare(
    'SELECT link_id, visit_id, event_type, car_variant_id, payload, created_at FROM link_events WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 3000',
  )
    .bind(user.id, since)
    .all<{ link_id: string; visit_id: string; event_type: string; car_variant_id: string | null; payload: string; created_at: number }>();
  // Each visitor's first-ever event, so a visit on a later day can be marked "Returning visitor"
  // (D1 allows 100 bound values per query, so look them up in chunks.)
  const visitIds = [...new Set(results.map((r) => r.visit_id))].slice(0, 450);
  const firstSeen: Record<string, number> = {};
  for (let i = 0; i < visitIds.length; i += 90) {
    const chunk = visitIds.slice(i, i + 90);
    const { results: first } = await env.DB.prepare(
      `SELECT visit_id, MIN(created_at) AS first FROM link_events WHERE user_id = ? AND visit_id IN (${chunk.map(() => '?').join(',')}) GROUP BY visit_id`,
    )
      .bind(user.id, ...chunk)
      .all<{ visit_id: string; first: number }>();
    for (const f of first) firstSeen[f.visit_id] = f.first;
  }
  return json({
    events: results.map((r) => ({
      link: r.link_id,
      visit: r.visit_id,
      type: r.event_type,
      car: r.car_variant_id,
      payload: JSON.parse(r.payload || '{}'),
      at: r.created_at,
    })),
    firstSeen,
  });
}
