import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Blocks the app shell (and everything under it) unless signed in. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    // A visitor hitting the bare site gets the landing page; deep links go to login and come back.
    if (state.url === '/' || state.url === '/calculator') return router.createUrlTree(['/welcome']);
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return true;
};

/** Keeps a signed-in user off the landing/login/signup pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/calculator']);
};

/** Manage Cars: the site owner only. Anyone else lands back on the Calculator. The server refuses
 *  catalogue changes from other accounts as well, so this only keeps the page out of their way. */
export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isOwner() ? true : inject(Router).createUrlTree(['/calculator']);
};
