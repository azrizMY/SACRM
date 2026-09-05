export const SESSION_COOKIE = 'redline_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PBKDF2_ITERATIONS = 100_000;

export type SessionUser = { id: string; email: string; name: string; publicToken: string };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Same-length string comparison that doesn't short-circuit on the first mismatched byte — a
 *  plain `===` on a secret hash leaks timing information an attacker can use to guess it byte by
 *  byte. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return new Uint8Array(bits);
}

/** Stored as `pbkdf2:<iterations>:<salt_hex>:<hash_hex>` — the iteration count travels with the
 *  hash so it can be bumped later without invalidating existing passwords. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const hash = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(toHex(hash), parts[3]);
}

function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Shorter than a session token (16 bytes vs 32) since this one goes in a URL a customer might
 *  have to retype — still random and unguessable, just friendlier to share. */
export function generatePublicToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function createSession(db: D1Database, userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expiresAt).run();
  return { token, expiresAt };
}

/** `Secure` is only safe to set when the request itself came in over HTTPS — `wrangler dev` serves
 *  plain HTTP locally, and a browser silently drops `Secure` cookies set over HTTP, which would
 *  make login look broken in local dev even though it works fine once deployed. */
export function sessionCookieHeader(token: string, expiresAt: number, secure: boolean): string {
  const expires = new Date(expiresAt).toUTCString();
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookieHeader(secure: boolean): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawVal] = part.trim().split('=');
    if (rawKey === SESSION_COOKIE) return rawVal.join('=');
  }
  return null;
}

/** Null when there's no session cookie, the session doesn't exist, or it's expired — callers
 *  should treat all three the same way (401), so this collapses them into one signal. Expired
 *  sessions are deleted on the way out instead of lingering in the table forever. */
export async function getUserFromSession(db: D1Database, request: Request): Promise<SessionUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT users.id as id, users.email as email, users.name as name, users.public_token as publicToken, sessions.expires_at as expiresAt
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`,
    )
    .bind(token)
    .first<{ id: string; email: string; name: string; publicToken: string; expiresAt: number }>();
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, publicToken: row.publicToken };
}

export async function deleteSession(db: D1Database, request: Request): Promise<void> {
  const token = getSessionToken(request);
  if (token) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run();
}
