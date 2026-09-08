import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Module-level so the JWKS response is cached (and re-fetched only on a `kid` miss) across
// requests within the same Worker isolate, instead of hitting Google on every sign-in.
const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export type GoogleIdentity = { googleId: string; email: string; name: string };

/** Verifies a Google Identity Services ID token (signature, issuer, audience, expiry) and returns
 *  the identity it carries. Throws if the token is invalid, expired, or wasn't issued for this
 *  app's Client ID — callers should treat any throw as "reject the sign-in attempt". */
export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, { issuer: GOOGLE_ISSUERS, audience: clientId });
  const googleId = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload['email'] === 'string' ? (payload['email'] as string) : '';
  const name = typeof payload['name'] === 'string' ? (payload['name'] as string) : email;
  if (!googleId || !email) throw new Error('Google token missing sub/email');
  return { googleId, email: email.toLowerCase(), name };
}
