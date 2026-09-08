import {
  clearSessionCookieHeader,
  createSession,
  deleteAllSessionsForUser,
  deleteSession,
  generatePublicToken,
  generateResetToken,
  getUserFromSession,
  hashPassword,
  sessionCookieHeader,
  verifyPassword,
} from '../auth';
import { sendPasswordResetEmail } from '../email';
import { verifyGoogleIdToken } from '../google';
import { json, readJsonBody } from '../http';
import type { Env } from '../index';

type SignupBody = { name?: string; email?: string; password?: string; phone?: string };
type LoginBody = { email?: string; password?: string };
type GoogleBody = { idToken?: string };
type ForgotPasswordBody = { email?: string };
type ResetPasswordBody = { token?: string; password?: string };

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export async function handleAuthRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const secure = url.protocol === 'https:';

  if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
    const body = await readJsonBody<SignupBody>(request);
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    const phone = body?.phone?.trim();
    if (!name || !email || !password || !phone) return json({ error: 'Name, email, phone number, and password are required.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
    if (phone.replace(/\D/g, '').length < 7) return json({ error: 'Enter a valid phone number.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'An account with this email already exists.' }, 409);

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const publicToken = generatePublicToken();
    // Seeds the new account's advisor profile with its own name/email/phone so the sidebar/quotes
    // show this SA from the very first login, not the client's hardcoded DEFAULT_ADVISOR placeholder
    // — the client already merges onto its own defaults for role/bio, so a partial profile is
    // exactly what's expected here, not the whole shape.
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, name, created_at, public_token, phone) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, email, passwordHash, name, Date.now(), publicToken, phone),
      env.DB.prepare('INSERT INTO advisor_profiles (user_id, data) VALUES (?, ?)').bind(id, JSON.stringify({ name, email, phoneDisplay: phone, phoneWa: phone.replace(/\D/g, '') })),
    ]);

    const { token, expiresAt } = await createSession(env.DB, id);
    return json({ id, email, name, publicToken }, 201, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJsonBody<LoginBody>(request);
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const user = await env.DB.prepare('SELECT id, email, name, password_hash, public_token, failed_attempts, locked_until FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string; public_token: string; failed_attempts: number; locked_until: number | null }>();

    if (user?.locked_until && user.locked_until > Date.now()) {
      const minutesLeft = Math.ceil((user.locked_until - Date.now()) / 60_000);
      return json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` }, 429);
    }

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      if (user) {
        const attempts = user.failed_attempts + 1;
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await env.DB.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').bind(Date.now() + LOCKOUT_MS, user.id).run();
        } else {
          await env.DB.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').bind(attempts, user.id).run();
        }
      }
      return json({ error: 'Incorrect email or password.' }, 401);
    }

    if (user.failed_attempts > 0 || user.locked_until) {
      await env.DB.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').bind(user.id).run();
    }

    const { token, expiresAt } = await createSession(env.DB, user.id);
    return json({ id: user.id, email: user.email, name: user.name, publicToken: user.public_token }, 200, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/google' && request.method === 'POST') {
    const body = await readJsonBody<GoogleBody>(request);
    if (!body?.idToken) return json({ error: 'Missing Google ID token.' }, 400);

    let identity;
    try {
      identity = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
    } catch (err) {
      console.error('Google token verification failed', err);
      return json({ error: 'Could not verify Google sign-in.' }, 401);
    }

    let user = await env.DB.prepare('SELECT id, email, name, public_token FROM users WHERE google_id = ?')
      .bind(identity.googleId)
      .first<{ id: string; email: string; name: string; public_token: string }>();

    if (!user) {
      const byEmail = await env.DB.prepare('SELECT id, email, name, public_token FROM users WHERE email = ?')
        .bind(identity.email)
        .first<{ id: string; email: string; name: string; public_token: string }>();

      if (byEmail) {
        await env.DB.prepare('UPDATE users SET google_id = ? WHERE id = ?').bind(identity.googleId, byEmail.id).run();
        user = byEmail;
      } else {
        const id = crypto.randomUUID();
        const publicToken = generatePublicToken();
        // No password on a Google-only account — password_hash still gets a value (rather than
        // loosening the NOT NULL constraint, which SQLite/D1 can't cheaply ALTER) but it's a
        // random value nobody knows, so it can never be used to log in via /api/auth/login.
        const passwordHash = await hashPassword(crypto.randomUUID());
        await env.DB.batch([
          env.DB.prepare('INSERT INTO users (id, email, password_hash, name, created_at, public_token, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
            id,
            identity.email,
            passwordHash,
            identity.name,
            Date.now(),
            publicToken,
            identity.googleId,
          ),
          env.DB.prepare('INSERT INTO advisor_profiles (user_id, data) VALUES (?, ?)').bind(id, JSON.stringify({ name: identity.name, email: identity.email })),
        ]);
        user = { id, email: identity.email, name: identity.name, public_token: publicToken };
      }
    }

    const { token, expiresAt } = await createSession(env.DB, user.id);
    return json({ id: user.id, email: user.email, name: user.name, publicToken: user.public_token }, 200, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
    const body = await readJsonBody<ForgotPasswordBody>(request);
    const email = body?.email?.trim().toLowerCase();
    if (!email) return json({ error: 'Email is required.' }, 400);

    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (user) {
      const resetToken = generateResetToken();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id),
        env.DB.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').bind(resetToken, user.id, Date.now() + RESET_TOKEN_TTL_MS),
      ]);
      const resetLink = `${url.origin}/reset-password?token=${resetToken}`;
      try {
        await sendPasswordResetEmail(env, email, resetLink);
      } catch (err) {
        console.error('Failed to send password reset email', err);
      }
    }
    // Same response whether or not the account exists, so this can't be used to enumerate emails.
    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/reset-password' && request.method === 'POST') {
    const body = await readJsonBody<ResetPasswordBody>(request);
    const token = body?.token;
    const password = body?.password;
    if (!token || !password) return json({ error: 'Reset token and new password are required.' }, 400);
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

    const reset = await env.DB.prepare('SELECT user_id, expires_at FROM password_resets WHERE token = ?')
      .bind(token)
      .first<{ user_id: string; expires_at: number }>();
    if (!reset || reset.expires_at < Date.now()) {
      return json({ error: 'This reset link is invalid or has expired.' }, 400);
    }

    const passwordHash = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').bind(passwordHash, reset.user_id),
      env.DB.prepare('DELETE FROM password_resets WHERE token = ?').bind(token),
    ]);
    await deleteAllSessionsForUser(env.DB, reset.user_id);

    return json({ ok: true });
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
