import { clearSessionCookieHeader, createSession, deleteSession, getUserFromSession, hashPassword, sessionCookieHeader, verifyPassword } from '../auth';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

type SignupBody = { name?: string; email?: string; password?: string };
type LoginBody = { email?: string; password?: string };

export async function handleAuthRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const secure = url.protocol === 'https:';

  if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
    const body = await readJsonBody<SignupBody>(request);
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    if (!name || !email || !password) return json({ error: 'Name, email, and password are required.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'An account with this email already exists.' }, 409);

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    // Seeds the new account's advisor profile with its own name/email so the sidebar/quotes show
    // this SA from the very first login, not the client's hardcoded DEFAULT_ADVISOR placeholder —
    // the client already merges onto its own defaults for role/phone/bio, so a partial profile is
    // exactly what's expected here, not the whole shape.
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, email, passwordHash, name, Date.now()),
      env.DB.prepare('INSERT INTO advisor_profiles (user_id, data) VALUES (?, ?)').bind(id, JSON.stringify({ name, email })),
    ]);

    const { token, expiresAt } = await createSession(env.DB, id);
    return json({ id, email, name }, 201, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJsonBody<LoginBody>(request);
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const user = await env.DB.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string }>();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return json({ error: 'Incorrect email or password.' }, 401);
    }

    const { token, expiresAt } = await createSession(env.DB, user.id);
    return json({ id: user.id, email: user.email, name: user.name }, 200, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    await deleteSession(env.DB, request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookieHeader(secure) });
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await getUserFromSession(env.DB, request);
    if (!user) return json({ error: 'Not signed in.' }, 401);
    return json(user);
  }

  return json({ error: 'Not found' }, 404);
}
