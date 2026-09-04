import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

type TradeInRow = {
  id: string;
  name: string;
  phone: string | null;
  username: string | null;
  company: string;
  state: string;
  branch: string | null;
  notes: string | null;
  favourite: number;
  created_at: number;
  updated_at: number;
};

type TradeInBody = {
  id?: string;
  name?: string;
  phone?: string;
  username?: string;
  company?: string;
  state?: string;
  branch?: string;
  notes?: string;
  favourite?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

function toClient(row: TradeInRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    username: row.username ?? undefined,
    company: row.company,
    state: row.state,
    branch: row.branch ?? undefined,
    notes: row.notes ?? undefined,
    favourite: !!row.favourite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleTradeInContactsRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);

  if (url.pathname === '/api/trade-in-contacts' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM trade_in_contacts WHERE user_id = ?').bind(user.id).all<TradeInRow>();
    return json(results.map(toClient));
  }

  const match = url.pathname.match(/^\/api\/trade-in-contacts\/([^/]+)$/);
  if (!match) return json({ error: 'Not found' }, 404);
  const id = decodeURIComponent(match[1]);

  if (request.method === 'PUT') {
    const body = await readJsonBody<TradeInBody>(request);
    if (!body?.name || !body.company || !body.state) return json({ error: 'Name, company, and state are required.' }, 400);
    const existing = await env.DB.prepare('SELECT user_id FROM trade_in_contacts WHERE id = ?').bind(id).first<{ user_id: string }>();
    if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404);

    const now = Date.now();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO trade_in_contacts (id, user_id, name, phone, username, company, state, branch, notes, favourite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.id,
        body.name,
        body.phone ?? null,
        body.username ?? null,
        body.company,
        body.state,
        body.branch ?? null,
        body.notes ?? null,
        body.favourite ? 1 : 0,
        body.createdAt ?? now,
        body.updatedAt ?? now,
      )
      .run();
    return json(body);
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM trade_in_contacts WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
