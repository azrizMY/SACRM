import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

/** Whole-blob storage, same shape as the client's AppSettings — the server has no opinion on
 *  defaults or partial shapes; the client already merges onto its own DEFAULT_SETTINGS the same
 *  way it did when this lived in localStorage, so a brand-new user just gets `{}` back. */
export async function handleSettingsRoute(request: Request, env: Env): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);

  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data FROM settings WHERE user_id = ?').bind(user.id).first<{ data: string }>();
    return json(row ? JSON.parse(row.data) : {});
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid settings payload.' }, 400);
    await env.DB.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data')
      .bind(user.id, JSON.stringify(body))
      .run();
    return json(body);
  }

  return json({ error: 'Method not allowed' }, 405);
}
