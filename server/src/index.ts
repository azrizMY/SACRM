import { handleAuthRoute } from './routes/auth';
import { handleSettingsRoute } from './routes/settings';
import { handleAdvisorRoute } from './routes/advisor';
import { handleVehicleOverridesRoute } from './routes/vehicle-overrides';
import { handleBankersRoute } from './routes/bankers';
import { handleCustomersRoute } from './routes/customers';
import { handlePublicRoute } from './routes/public';
import { handleLinkEventsRoute, handlePublicEvents } from './routes/link-events';
import { json } from './http';
import { handlePhotoRoute, withLinkPreview } from './link-preview';
import { withSecurityHeaders } from './security-headers';

const STATIC_FILE = /\.(?:m?js|css|map|json|webmanifest|png|jpe?g|webp|svg|ico|gif|woff2?|ttf|pdf)$/i;

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY: string;
  RESEND_FROM?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return withSecurityHeaders(await handleApi(request, env, url), true);
      } catch (err) {
        console.error(err);
        return withSecurityHeaders(json({ error: 'Internal server error' }, 500), true);
      }
    }
    const asset = await env.ASSETS.fetch(request);
    // A missing script/style/image file must be a real 404, never the app's index.html — an old open
    // copy of the app asking for last deploy's files would otherwise get HTML back as "JavaScript".
    if (STATIC_FILE.test(url.pathname) && (asset.headers.get('Content-Type') ?? '').includes('text/html')) {
      return withSecurityHeaders(new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } }), false);
    }
    return withSecurityHeaders(await withLinkPreview(request, asset, env), false);
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname.startsWith('/api/public/photo/')) return (await handlePhotoRoute(request, env, url)) ?? json({ error: 'Not found' }, 404);
  if (url.pathname.startsWith('/api/public/events/')) return handlePublicEvents(request, env, url);
  if (url.pathname.startsWith('/api/public/')) return handlePublicRoute(request, env, url);
  if (url.pathname.startsWith('/api/link-events')) return handleLinkEventsRoute(request, env, url);
  if (url.pathname.startsWith('/api/auth/')) return handleAuthRoute(request, env, url);
  if (url.pathname === '/api/settings') return handleSettingsRoute(request, env);
  if (url.pathname === '/api/advisor') return handleAdvisorRoute(request, env);
  if (url.pathname.startsWith('/api/vehicle-overrides')) return handleVehicleOverridesRoute(request, env, url);
  if (url.pathname.startsWith('/api/bankers')) return handleBankersRoute(request, env, url);
  if (url.pathname.startsWith('/api/customers')) return handleCustomersRoute(request, env, url);
  return json({ error: 'Not found' }, 404);
}
