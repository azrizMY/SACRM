import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

/** GET returns every saved override for this account, keyed by vehicle id — the client applies
 *  them onto its own hardcoded catalog. PUT replaces one vehicle's override wholesale (the client
 *  already merges the patch onto whatever it has in memory before sending, same as the old
 *  localStorage version did), so there's no partial-merge logic needed here. */
export async function handleVehicleOverridesRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);

  if (url.pathname === '/api/vehicle-overrides' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT vehicle_id, data FROM vehicle_overrides WHERE user_id = ?')
      .bind(user.id)
      .all<{ vehicle_id: string; data: string }>();
    const map: Record<string, unknown> = {};
    for (const row of results) map[row.vehicle_id] = JSON.parse(row.data);
    return json(map);
  }

  // Many cars at once (Price Settings' brand rebate editor and price list import): one request,
  // one batch — every override is the car's full merged override, same as the single-car PUT.
  if (url.pathname === '/api/vehicle-overrides' && request.method === 'PUT') {
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid override payload.' }, 400);
    const entries = Object.entries(body).filter(([id, data]) => typeof id === 'string' && id.length <= 120 && data && typeof data === 'object');
    if (entries.length === 0) return json({});
    if (entries.length > 500) return json({ error: 'Too many cars in one save.' }, 400);
    const stmt = env.DB.prepare(
      'INSERT INTO vehicle_overrides (user_id, vehicle_id, data) VALUES (?, ?, ?) ON CONFLICT(user_id, vehicle_id) DO UPDATE SET data = excluded.data',
    );
    await env.DB.batch(entries.map(([id, data]) => stmt.bind(user.id, id, JSON.stringify(data))));
    return json(Object.fromEntries(entries));
  }

  const match = url.pathname.match(/^\/api\/vehicle-overrides\/([^/]+)$/);
  if (match && request.method === 'PUT') {
    const vehicleId = decodeURIComponent(match[1]);
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid override payload.' }, 400);
    await env.DB.prepare(
      'INSERT INTO vehicle_overrides (user_id, vehicle_id, data) VALUES (?, ?, ?) ON CONFLICT(user_id, vehicle_id) DO UPDATE SET data = excluded.data',
    )
      .bind(user.id, vehicleId, JSON.stringify(body))
      .run();
    return json(body);
  }

  return json({ error: 'Not found' }, 404);
}
