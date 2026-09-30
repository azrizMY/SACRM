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
  {
    path: '',
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard-page.component').then((m) => m.DashboardPageComponent), data: { id: 'dashboard' } },
      { path: 'calculator', loadComponent: () => import('./pages/calculator.component').then((m) => m.CalculatorComponent), data: { id: 'calculator' } },
      { path: 'cars', loadComponent: () => import('./pages/my-cars.component').then((m) => m.MyCarsComponent), data: { id: 'cars' } },
      { path: 'price-settings', loadComponent: () => import('./pages/price-settings.component').then((m) => m.PriceSettingsComponent), data: { id: 'price-settings' } },
      { path: 'leads', loadComponent: () => import('./pages/customer-manager.component').then((m) => m.CustomerManagerComponent), data: { id: 'leads' } },
      { path: 'bankers', loadComponent: () => import('./pages/bankers.component').then((m) => m.BankersComponent), data: { id: 'bankers' } },
      { path: 'notes', loadComponent: () => import('./pages/cost-breakdown.component').then((m) => m.CostBreakdownComponent), data: { id: 'notes' } },
      { path: 'profile', loadComponent: () => import('./pages/profile.component').then((m) => m.ProfileComponent), data: { id: 'profile' } },
      { path: 'settings', loadComponent: () => import('./pages/account-settings.component').then((m) => m.AccountSettingsComponent), data: { id: 'settings' } },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
