import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

/** CustomerRecord is ~30 mostly-optional fields — stored whole as JSON (see migrations/0001), with
 *  `status`/`created_at`/`updated_at` duplicated as real columns purely so DELETE-all and ownership
 *  checks don't need to parse JSON. The client already fetches-all-then-filters-in-memory, so a
 *  flat array of the full records is exactly what it expects back. */
export async function handleCustomersRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);

  if (url.pathname === '/api/customers' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT data FROM customers WHERE user_id = ?').bind(user.id).all<{ data: string }>();
    return json(results.map((row) => JSON.parse(row.data)));
  }

  if (url.pathname === '/api/customers' && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM customers WHERE user_id = ?').bind(user.id).run();
    return json({ ok: true });
  }

  const match = url.pathname.match(/^\/api\/customers\/([^/]+)$/);
  if (!match) return json({ error: 'Not found' }, 404);
  const id = decodeURIComponent(match[1]);

  if (request.method === 'PUT') {
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body || typeof body !== 'object' || typeof body.status !== 'string') {
      return json({ error: 'Invalid customer record.' }, 400);
    }
    const existing = await env.DB.prepare('SELECT user_id FROM customers WHERE id = ?').bind(id).first<{ user_id: string }>();
    if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404);

    const now = Date.now();
    const createdAt = typeof body.createdAt === 'number' ? body.createdAt : now;
    const updatedAt = typeof body.updatedAt === 'number' ? body.updatedAt : now;
    await env.DB.prepare('INSERT OR REPLACE INTO customers (id, user_id, status, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, body.status, createdAt, updatedAt, JSON.stringify(body))
      .run();
    return json(body);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM customers WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
