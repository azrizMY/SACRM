import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { AuthUser } from '../data/auth-data';
import { AdvisorService } from './advisor.service';
import { SettingsService } from './settings.service';
import { VehicleCatalogService } from './vehicle-catalog.service';
import { BankerService } from './banker.service';
import { TradeInService } from './trade-in.service';
import { CustomerService } from './customer.service';

export type AuthResult = { ok: true } | { ok: false; error: string };

function extractError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const message = (err.error as { error?: string } | null)?.error;
    if (message) return message;
  }
  return fallback;
}

/**
 * Real accounts backed by the Worker API (`/api/auth/*`) — the session lives in an HttpOnly cookie
 * the browser sends automatically, so nothing sensitive is kept client-side. `currentUser` is only
 * known for certain after `restoreSession()` resolves (see the app initializer in app.config.ts),
 * which is why every route sits behind `authGuard`/`guestGuard` rather than reading this signal
 * before that first check completes.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<AuthUser | null>(null);
  isAuthenticated = computed(() => this.currentUser() !== null);

  constructor(
    private http: HttpClient,
    private settingsService: SettingsService,
    private advisorService: AdvisorService,
    private vehicleCatalogService: VehicleCatalogService,
    private bankerService: BankerService,
    private tradeInService: TradeInService,
    private customerService: CustomerService,
  ) {}

  /** Checks whether the browser's session cookie (if any) still points at a valid session —
   *  called once at app bootstrap, before routing/guards evaluate, and never again. */
  async restoreSession(): Promise<void> {
    try {
      const user = await firstValueFrom(this.http.get<AuthUser>('/api/auth/me'));
      this.currentUser.set(user);
      await this.loadUserData();
    } catch {
      this.currentUser.set(null);
    }
  }

  async signUp(name: string, email: string, password: string): Promise<AuthResult> {
    try {
      const user = await firstValueFrom(this.http.post<AuthUser>('/api/auth/signup', { name, email, password }));
      this.currentUser.set(user);
      await this.loadUserData();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't create your account. Please try again.") };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const user = await firstValueFrom(this.http.post<AuthUser>('/api/auth/login', { email, password }));
      this.currentUser.set(user);
      await this.loadUserData();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't log in. Please try again.") };
    }
  }

  /** Signs out immediately client-side (so guards redirect right away) and clears the server
   *  session in the background — nothing meaningful for the caller to wait on. */
  logout(): void {
    this.currentUser.set(null);
    this.settingsService.reset();
    this.advisorService.reset();
    this.vehicleCatalogService.resetOverrides();
    this.bankerService.reset();
    this.tradeInService.reset();
    this.customerService.reset();
    firstValueFrom(this.http.post('/api/auth/logout', {})).catch(() => {
      /* session cookie is cleared client-side regardless; a failed server call just leaves an
       * orphaned row that expires on its own */
    });
  }

  /** Every other per-account slice of data is only knowable once we know who's signed in — loaded
   *  together right after that, on every path that establishes a session (restore, login, signup).
   *  Bankers/trade-ins/customers already self-load once on construction, but since each is a
   *  singleton that otherwise only fetches once for the app's lifetime, they need an explicit
   *  reload here too, or a same-tab account switch would keep showing the previous account's data. */
  private async loadUserData(): Promise<void> {
    await Promise.all([
      this.settingsService.load(),
      this.advisorService.load(),
      this.vehicleCatalogService.loadOverrides(),
      this.bankerService.load(),
      this.tradeInService.load(),
      this.customerService.load(),
    ]);
  }
}
