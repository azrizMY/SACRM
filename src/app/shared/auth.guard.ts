import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Blocks the app shell (and everything under it) unless signed in — and, for a Google account that
 *  hasn't picked a Primary Brand and phone number yet, unless it has finished that setup. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  if (auth.currentUser()?.needsOnboarding) return router.createUrlTree(['/choose-brand']);
  return true;
};

/** The setup page itself: signed in, and only while setup is actually still pending. */
export const onboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (!auth.currentUser()?.needsOnboarding) return router.createUrlTree(['/dashboard']);
  return true;
};

/** Keeps a signed-in user off the landing/login/signup pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/dashboard']);
};
