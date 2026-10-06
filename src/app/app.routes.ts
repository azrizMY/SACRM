import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './shared/auth.guard';

// Every page is lazy-loaded so a visitor only downloads the screen they open — the landing page,
// login and the customer quote link stay light instead of shipping the calculator, poster
// renderers and charts up front. The service worker still prefetches every chunk once installed.
export const routes: Routes = [
  { path: 'welcome', loadComponent: () => import('./pages/landing.component').then((m) => m.LandingComponent) },
  { path: 'login', loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent), canActivate: [guestGuard] },
  { path: 'signup', loadComponent: () => import('./pages/signup.component').then((m) => m.SignupComponent), canActivate: [guestGuard] },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password.component').then((m) => m.ForgotPasswordComponent), canActivate: [guestGuard] },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password.component').then((m) => m.ResetPasswordComponent), canActivate: [guestGuard] },
  { path: 'privacy', loadComponent: () => import('./pages/legal-page.component').then((m) => m.LegalPageComponent), data: { doc: 'privacy' } },
  { path: 'terms', loadComponent: () => import('./pages/legal-page.component').then((m) => m.LegalPageComponent), data: { doc: 'terms' } },
  { path: 'quote/:token',loadComponent: () => import('./pages/public-quote.component').then((m) => m.PublicQuoteComponent) },
  { path: 'quote/:token/brand', loadComponent: () => import('./pages/public-quote.component').then((m) => m.PublicQuoteComponent), data: { singleBrand: true } },
  // Live Mode's pop-out window — no app shell, just the Live Screen to capture on stream.
  { path: 'live-screen', loadComponent: () => import('./pages/live-screen-window.component').then((m) => m.LiveScreenWindowComponent), canActivate: [authGuard] },
  {
    path: '',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      // A quoting tool first: the Calculator is home.
      { path: '', pathMatch: 'full', redirectTo: 'calculator' },
      { path: 'calculator', loadComponent: () => import('./pages/calculator.component').then((m) => m.CalculatorComponent), data: { id: 'calculator' } },
      { path: 'compare', loadComponent: () => import('./pages/compare.component').then((m) => m.CompareComponent), data: { id: 'compare' } },
      { path: 'live', loadComponent: () => import('./pages/live.component').then((m) => m.LiveComponent), data: { id: 'live' } },
      { path: 'cars', loadComponent: () => import('./pages/my-cars.component').then((m) => m.MyCarsComponent), data: { id: 'cars' } },
      { path: 'price-settings', loadComponent: () => import('./pages/price-settings.component').then((m) => m.PriceSettingsComponent), data: { id: 'price-settings' } },
      { path: 'profile', loadComponent: () => import('./pages/profile.component').then((m) => m.ProfileComponent), data: { id: 'profile' } },
      { path: 'settings', loadComponent: () => import('./pages/account-settings.component').then((m) => m.AccountSettingsComponent), data: { id: 'settings' } },
      { path: '**', redirectTo: 'calculator' },
    ],
  },
];
