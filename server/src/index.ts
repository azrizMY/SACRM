import { handleAuthRoute } from './routes/auth';
import { handleSettingsRoute } from './routes/settings';
import { handleAdvisorRoute } from './routes/advisor';
import { handleVehicleOverridesRoute } from './routes/vehicle-overrides';
import { handleBankersRoute } from './routes/bankers';
import { handleCustomersRoute } from './routes/customers';
import { handlePublicRoute } from './routes/public';
import { json } from './http';
import { handlePhotoRoute, withLinkPreview } from './link-preview';
import { withSecurityHeaders } from './security-headers';

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
    return withSecurityHeaders(await withLinkPreview(request, await env.ASSETS.fetch(request), env), false);
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname.startsWith('/api/public/photo/')) return (await handlePhotoRoute(request, env, url)) ?? json({ error: 'Not found' }, 404);
  if (url.pathname.startsWith('/api/public/')) return handlePublicRoute(request, env, url);
  if (url.pathname.startsWith('/api/auth/')) return handleAuthRoute(request, env, url);
  if (url.pathname === '/api/settings') return handleSettingsRoute(request, env);
  if (url.pathname === '/api/advisor') return handleAdvisorRoute(request, env);
  if (url.pathname.startsWith('/api/vehicle-overrides')) return handleVehicleOverridesRoute(request, env, url);
  if (url.pathname.startsWith('/api/bankers')) return handleBankersRoute(request, env, url);
  if (url.pathname.startsWith('/api/customers')) return handleCustomersRoute(request, env, url);
  return json({ error: 'Not found' }, 404);
}
