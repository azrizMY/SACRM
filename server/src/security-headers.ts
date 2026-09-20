/** Sent on every response (static assets and API alike). The CSP only allows what the app really
 *  loads: its own files, Google Identity Services (sign-in button), and Google Fonts. Inline styles
 *  stay allowed because Angular sets style attributes at runtime; inline *scripts* are not. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://accounts.google.com/gsi/ https://fonts.googleapis.com https://fonts.gstatic.com",
  'frame-src https://accounts.google.com/gsi/',
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function withSecurityHeaders(response: Response, isApi: boolean): Response {
  const res = new Response(response.body, response);
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('Strict-Transport-Security', 'max-age=31536000');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (isApi) res.headers.set('Cache-Control', 'no-store');
  return res;
}
