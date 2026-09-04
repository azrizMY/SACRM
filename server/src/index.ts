import { handleAuthRoute } from './routes/auth';
import { handleSettingsRoute } from './routes/settings';
import { handleAdvisorRoute } from './routes/advisor';
import { handleVehicleOverridesRoute } from './routes/vehicle-overrides';
import { handleBankersRoute } from './routes/bankers';
import { handleTradeInContactsRoute } from './routes/trade-in-contacts';
import { handleCustomersRoute } from './routes/customers';
import { json } from './http';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error(err);
        return json({ error: 'Internal server error' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname.startsWith('/api/auth/')) return handleAuthRoute(request, env, url);
  if (url.pathname === '/api/settings') return handleSettingsRoute(request, env);
  if (url.pathname === '/api/advisor') return handleAdvisorRoute(request, env);
  if (url.pathname.startsWith('/api/vehicle-overrides')) return handleVehicleOverridesRoute(request, env, url);
  if (url.pathname.startsWith('/api/bankers')) return handleBankersRoute(request, env, url);
  if (url.pathname.startsWith('/api/trade-in-contacts')) return handleTradeInContactsRoute(request, env, url);
  if (url.pathname.startsWith('/api/customers')) return handleCustomersRoute(request, env, url);
  return json({ error: 'Not found' }, 404);
}
