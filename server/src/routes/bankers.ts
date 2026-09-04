import { getUserFromSession } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

type BankerRow = {
  id: string;
  name: string;
  phone: string | null;
  username: string | null;
  bank: string;
  state: string;
  branch: string | null;
  notes: string | null;
  favourite: number;
  created_at: number;
  updated_at: number;
};

type BankerBody = {
  id?: string;
  name?: string;
  phone?: string;
  username?: string;
  bank?: string;
  state?: string;
  branch?: string;
  notes?: string;
  favourite?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

function toClient(row: BankerRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    username: row.username ?? undefined,
    bank: row.bank,
    state: row.state,
    branch: row.branch ?? undefined,
    notes: row.notes ?? undefined,
    favourite: !!row.favourite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function handleBankersRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await getUserFromSession(env.DB, request);
  if (!user) return json({ error: 'Not signed in.' }, 401);

  if (url.pathname === '/api/bankers' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM bankers WHERE user_id = ?').bind(user.id).all<BankerRow>();
    return json(results.map(toClient));
  }

  const match = url.pathname.match(/^\/api\/bankers\/([^/]+)$/);
  if (!match) return json({ error: 'Not found' }, 404);
  const id = decodeURIComponent(match[1]);

  if (request.method === 'PUT') {
    const body = await readJsonBody<BankerBody>(request);
    if (!body?.name || !body.bank || !body.state) return json({ error: 'Name, bank, and state are required.' }, 400);
    // Client-generated ids are random UUIDs, but guard against one account overwriting another's
    // row on an id collision anyway — cheap insurance for something that should never happen.
    const existing = await env.DB.prepare('SELECT user_id FROM bankers WHERE id = ?').bind(id).first<{ user_id: string }>();
    if (existing && existing.user_id !== user.id) return json({ error: 'Not found' }, 404);

    const now = Date.now();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO bankers (id, user_id, name, phone, username, bank, state, branch, notes, favourite, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.id,
        body.name,
        body.phone ?? null,
        body.username ?? null,
        body.bank,
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
    await env.DB.prepare('DELETE FROM bankers WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
