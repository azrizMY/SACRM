import { ApplicationConfig, provideZoneChangeDetection, isDevMode, inject, provideAppInitializer } from '@angular/core';
import { NavigationEnd, Router, provideRouter, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { AuthService } from './shared/auth.service';
import { clearStaleChunkFlag, reloadOnceForStaleChunk } from './shared/stale-chunk-reload';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // A page whose code is gone after a deploy (an old open copy) reloads once into the new version.
    provideRouter(routes, withNavigationErrorHandler((e) => void reloadOnceForStaleChunk(e.error))),
    provideAppInitializer(() => {
      inject(Router).events.subscribe((e) => e instanceof NavigationEnd && clearStaleChunkFlag());
    }),
    provideHttpClient(withFetch()),
    // Resolves whether the browser's session cookie (if any) is still valid, and loads that
    // account's settings/advisor profile, before the router activates — so authGuard/guestGuard
    // see a correct isAuthenticated() on the very first paint, including a hard refresh.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // Disabled on localhost/127.0.0.1 as well as dev mode — otherwise every local rebuild during
    // `npm run preview` testing gets silently masked by a stale cached copy the browser already
    // installed, which looks exactly like the new code never shipped.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1',
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
