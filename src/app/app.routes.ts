import { Routes } from '@angular/router';
import { AccountSettingsComponent } from './pages/account-settings.component';
import { BankersComponent } from './pages/bankers.component';
import { BillingComponent } from './pages/billing.component';
import { CalculatorComponent } from './pages/calculator.component';
import { CostBreakdownComponent } from './pages/cost-breakdown.component';
import { CustomerManagerComponent } from './pages/customer-manager.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { LandingComponent } from './pages/landing.component';
import { LoginComponent } from './pages/login.component';
import { MyCarsComponent } from './pages/my-cars.component';
import { ProfileComponent } from './pages/profile.component';
import { SignupComponent } from './pages/signup.component';
import { TradeInsComponent } from './pages/trade-ins.component';
import { authGuard, guestGuard } from './shared/auth.guard';
import { AppShellComponent } from './shell/app-shell.component';

export const routes: Routes = [
  { path: 'welcome', component: LandingComponent, canActivate: [guestGuard] },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'signup', component: SignupComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent, data: { id: 'dashboard' } },
      { path: 'calculator', component: CalculatorComponent, data: { id: 'calculator' } },
      { path: 'cars', component: MyCarsComponent, data: { id: 'cars' } },
      { path: 'leads', component: CustomerManagerComponent, data: { id: 'leads' } },
      { path: 'bankers', component: BankersComponent, data: { id: 'bankers' } },
      { path: 'trade-ins', component: TradeInsComponent, data: { id: 'trade-ins' } },
      { path: 'notes', component: CostBreakdownComponent, data: { id: 'notes' } },
      { path: 'profile', component: ProfileComponent, data: { id: 'profile' } },
      { path: 'billing', component: BillingComponent, data: { id: 'billing' } },
      { path: 'settings', component: AccountSettingsComponent, data: { id: 'settings' } },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
