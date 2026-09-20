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
  sha256Hex,
  verifyPassword,
} from '../auth';
import { sendPasswordResetEmail } from '../email';
import { verifyGoogleIdToken } from '../google';
import { json, readJsonBody } from '../http';
import { clientIp, isRateLimited } from '../rate-limit';
import type { Env } from '../index';

type SignupBody = { name?: string; email?: string; password?: string; phone?: string; primaryBrand?: string };
type LoginBody = { email?: string; password?: string };
type GoogleBody = { idToken?: string };
type ForgotPasswordBody = { email?: string };
type ResetPasswordBody = { token?: string; password?: string };
type ChangePasswordBody = { currentPassword?: string; newPassword?: string };

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TOO_MANY = 'Too many attempts. Please try again later.';

/** Mirrors the client's toMalaysianWhatsAppNumber (dashboard-data.ts) so a freshly-seeded advisor
 *  profile's WhatsApp link is correct from the very first login, not just after the SA edits their
 *  profile once client-side. */
function toMalaysianWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('60')) return digits;
  if (digits.startsWith('0')) return `60${digits.slice(1)}`;
  return digits;
}

/** Google sign-in skips the signup form, so a Google account can exist without a Primary Brand or a
 *  phone number. Checked from real data (not a one-shot "new account" flag) so an account that
 *  bailed out of setup — or was created before this existed — is still sent back to finish it.
 *  Email signups always supply both, so they're never flagged. */
async function needsOnboarding(env: Env, userId: string, hasGoogleLogin: boolean): Promise<boolean> {
  if (!hasGoogleLogin) return false;
  const [settingsRow, advisorRow] = await Promise.all([
    env.DB.prepare('SELECT data FROM settings WHERE user_id = ?').bind(userId).first<{ data: string }>(),
    env.DB.prepare('SELECT data FROM advisor_profiles WHERE user_id = ?').bind(userId).first<{ data: string }>(),
  ]);
  const brand = settingsRow ? JSON.parse(settingsRow.data)?.dashboardTarget?.brand : undefined;
  const phone = advisorRow ? JSON.parse(advisorRow.data)?.phoneDisplay : undefined;
  return !brand || !phone;
}

/** Re-checks the signed-in user's password for a sensitive action (export, delete). Shares the
 *  login lockout counters, so this can't be used to brute-force a password from a stolen session.
 *  Returns an error Response to send back, or null when the password is correct. */
async function rejectUnlessPasswordValid(env: Env, userId: string, password: string | undefined): Promise<Response | null> {
  const row = await env.DB.prepare('SELECT password_hash, failed_attempts, locked_until FROM users WHERE id = ?')
    .bind(userId)
    .first<{ password_hash: string; failed_attempts: number; locked_until: number | null }>();
  if (!row) return json({ error: 'Account not found.' }, 404);
  if (row.locked_until && row.locked_until > Date.now()) {
    const minutesLeft = Math.ceil((row.locked_until - Date.now()) / 60_000);
    return json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` }, 429);
  }
  if (!password || !(await verifyPassword(password, row.password_hash))) {
    const attempts = row.failed_attempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await env.DB.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').bind(Date.now() + LOCKOUT_MS, userId).run();
    } else {
      await env.DB.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').bind(attempts, userId).run();
    }
    return json({ error: 'Password is incorrect.' }, 401);
  }
  if (row.failed_attempts > 0) await env.DB.prepare('UPDATE users SET failed_attempts = 0 WHERE id = ?').bind(userId).run();
  return null;
}

export async function handleAuthRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const secure = url.protocol === 'https:';

  if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
    if (await isRateLimited(env, `signup:${clientIp(request)}`, 10, HOUR_MS)) return json({ error: TOO_MANY }, 429);
    const body = await readJsonBody<SignupBody>(request);
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    const phone = body?.phone?.trim();
    const primaryBrand = body?.primaryBrand?.trim();
    if (!name || !email || !password || !phone || !primaryBrand) return json({ error: 'Name, email, phone number, primary brand, and password are required.' }, 400);
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
    // exactly what's expected here, not the whole shape. The settings row seeds Primary Brand the
    // same way — chosen at signup, not left on the client's shipped default.
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, name, created_at, public_token, phone, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 0)').bind(id, email, passwordHash, name, Date.now(), publicToken, phone),
      env.DB.prepare('INSERT INTO advisor_profiles (user_id, data) VALUES (?, ?)').bind(id, JSON.stringify({ name, email, phoneDisplay: phone, phoneWa: toMalaysianWhatsAppNumber(phone) })),
      env.DB.prepare('INSERT INTO settings (user_id, data) VALUES (?, ?)').bind(id, JSON.stringify({ dashboardTarget: { brand: primaryBrand } })),
    ]);

    const { token, expiresAt } = await createSession(env.DB, id);
    return json({ id, email, name, publicToken, hasGoogleLogin: false, needsOnboarding: false }, 201, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    if (await isRateLimited(env, `login:${clientIp(request)}`, 40, 15 * 60 * 1000)) return json({ error: TOO_MANY }, 429);
    const body = await readJsonBody<LoginBody>(request);
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const user = await env.DB.prepare('SELECT id, email, name, password_hash, public_token, google_id, failed_attempts, locked_until FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string; email: string; name: string; password_hash: string; public_token: string; google_id: string | null; failed_attempts: number; locked_until: number | null }>();

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
    return json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        publicToken: user.public_token,
        hasGoogleLogin: user.google_id != null,
        needsOnboarding: await needsOnboarding(env, user.id, user.google_id != null),
      },
      200,
      { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) },
    );
  }

  if (url.pathname === '/api/auth/google' && request.method === 'POST') {
    if (await isRateLimited(env, `google:${clientIp(request)}`, 40, 15 * 60 * 1000)) return json({ error: TOO_MANY }, 429);
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
      const byEmail = await env.DB.prepare('SELECT id, email, name, public_token, email_verified FROM users WHERE email = ?')
        .bind(identity.email)
        .first<{ id: string; email: string; name: string; public_token: string; email_verified: number }>();

      if (byEmail) {
        if (byEmail.email_verified) {
          await env.DB.prepare('UPDATE users SET google_id = ? WHERE id = ?').bind(identity.googleId, byEmail.id).run();
          user = byEmail;
        } else {
          // Email/password signup never proves ownership of the address, so this account may have
          // been registered by someone other than the real owner. Google just verified the owner,
          // so cut off whatever password, session and public link the registrant holds before
          // handing the account over.
          const freshPublicToken = generatePublicToken();
          await env.DB.prepare('UPDATE users SET google_id = ?, email_verified = 1, password_hash = ?, public_token = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?')
            .bind(identity.googleId, await hashPassword(crypto.randomUUID()), freshPublicToken, byEmail.id)
            .run();
          await deleteAllSessionsForUser(env.DB, byEmail.id);
          user = { ...byEmail, public_token: freshPublicToken };
        }
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
    // Every path through this branch (found by google_id, linked by email, or freshly created)
    // ends with google_id set on the row, so this is always true here.
    return json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        publicToken: user.public_token,
        hasGoogleLogin: true,
        needsOnboarding: await needsOnboarding(env, user.id, true),
      },
      200,
      { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) },
    );
  }

  if (url.pathname === '/api/auth/forgot-password' && request.method === 'POST') {
    const body = await readJsonBody<ForgotPasswordBody>(request);
    const email = body?.email?.trim().toLowerCase();
    if (!email) return json({ error: 'Email is required.' }, 400);
    if (await isRateLimited(env, `forgot-ip:${clientIp(request)}`, 10, HOUR_MS)) return json({ error: TOO_MANY }, 429);
    // Per-address cap stops someone flooding one inbox; answered like a normal success so it
    // can't be used to probe which emails are registered.
    if (await isRateLimited(env, `forgot-email:${email}`, 3, HOUR_MS)) return json({ ok: true });

    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (user) {
      const resetToken = generateResetToken();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id),
        env.DB.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(resetToken), user.id, Date.now() + RESET_TOKEN_TTL_MS),
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

    const tokenHash = await sha256Hex(token);
    const reset = await env.DB.prepare('SELECT user_id, expires_at FROM password_resets WHERE token = ?')
      .bind(tokenHash)
      .first<{ user_id: string; expires_at: number }>();
    if (!reset || reset.expires_at < Date.now()) {
      return json({ error: 'This reset link is invalid or has expired.' }, 400);
    }

    const passwordHash = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ?, email_verified = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?').bind(passwordHash, reset.user_id),
      env.DB.prepare('DELETE FROM password_resets WHERE token = ?').bind(tokenHash),
    ]);
    await deleteAllSessionsForUser(env.DB, reset.user_id);

    return json({ ok: true });
  }

  if (url.pathname === '/api/auth/change-password' && request.method === 'POST') {
    const user = await getUserFromSession(env.DB, request);
    if (!user) return json({ error: 'Not signed in.' }, 401);

    const body = await readJsonBody<ChangePasswordBody>(request);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;
    if (!currentPassword || !newPassword) return json({ error: 'Current and new password are required.' }, 400);
    if (newPassword.length < 8) return json({ error: 'New password must be at least 8 characters.' }, 400);

    const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>();
    // A Google-only account's password_hash is a random value nobody knows (see /api/auth/google
    // above) — this correctly rejects any "current password" attempt for one, same as if it were
    // simply wrong; the client points those users at Forgot Password instead.
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      return json({ error: 'Current password is incorrect.' }, 401);
    }

    const passwordHash = await hashPassword(newPassword);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run();
    // Every other signed-in device gets logged out, same as a reset-password completion — this
    // request's own session is replaced right after so the current tab keeps working.
    await deleteAllSessionsForUser(env.DB, user.id);
    const { token, expiresAt } = await createSession(env.DB, user.id);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieHeader(token, expiresAt, secure) });
  }

  if (url.pathname === '/api/auth/verify-password' && request.method === 'POST') {
    const user = await getUserFromSession(env.DB, request);
    if (!user) return json({ error: 'Not signed in.' }, 401);
    const body = await readJsonBody<{ password?: string }>(request);
    const rejection = await rejectUnlessPasswordValid(env, user.id, body?.password);
    return rejection ?? json({ ok: true });
  }

  if (url.pathname === '/api/auth/delete-account' && request.method === 'POST') {
    const user = await getUserFromSession(env.DB, request);
    if (!user) return json({ error: 'Not signed in.' }, 401);

    // An account that can sign in with a password must prove it. A Google-linked account can't be
    // held to that (its password may be a random value nobody knows — see /api/auth/google), so for
    // those the live session plus the client's typed confirmation is the whole check.
    if (!user.hasGoogleLogin) {
      const body = await readJsonBody<{ password?: string }>(request);
      const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>();
      if (!body?.password || !row || !(await verifyPassword(body.password, row.password_hash))) {
        return json({ error: 'Password is incorrect.' }, 401);
      }
    }

    // Child rows are deleted explicitly rather than relying on ON DELETE CASCADE being enforced.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM customers WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM bankers WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM trade_in_contacts WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM vehicle_overrides WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM settings WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM advisor_profiles WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ]);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookieHeader(secure) });
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    await deleteSession(env.DB, request);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookieHeader(secure) });
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await getUserFromSession(env.DB, request);
    if (!user) return json({ error: 'Not signed in.' }, 401);
    return json({ ...user, needsOnboarding: await needsOnboarding(env, user.id, user.hasGoogleLogin) });
  }

  return json({ error: 'Not found' }, 404);
}
