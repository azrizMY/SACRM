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

  async signUp(name: string, email: string, password: string, phone: string, primaryBrand: string): Promise<AuthResult> {
    try {
      const user = await firstValueFrom(this.http.post<AuthUser>('/api/auth/signup', { name, email, password, phone, primaryBrand }));
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

  /** `idToken` is the signed JWT handed back by Google Identity Services — the Worker verifies it
   *  and creates/links the account server-side, then this behaves just like `login()`. */
  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    try {
      const user = await firstValueFrom(this.http.post<AuthUser>('/api/auth/google', { idToken }));
      this.currentUser.set(user);
      await this.loadUserData();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't sign in with Google. Please try again.") };
    }
  }

  /** Always resolves ok — the server intentionally responds the same way whether or not the email
   *  belongs to an account, so this can't be used to enumerate registered emails. */
  async forgotPassword(email: string): Promise<AuthResult> {
    try {
      await firstValueFrom(this.http.post('/api/auth/forgot-password', { email }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't send the reset email. Please try again.") };
    }
  }

  async resetPassword(token: string, password: string): Promise<AuthResult> {
    try {
      await firstValueFrom(this.http.post('/api/auth/reset-password', { token, password }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't reset your password. Please try again.") };
    }
  }

  /** Called by the setup page once brand and phone are saved, so authGuard lets the account through. */
  completeOnboarding(): void {
    const user = this.currentUser();
    if (user) this.currentUser.set({ ...user, needsOnboarding: false });
  }

  /** For a signed-in user changing their password from Settings — distinct from resetPassword(),
   *  which is the logged-out "forgot password" email-link flow. Succeeds silently on the session
   *  cookie the server's Set-Cookie header already replaced; nothing else needs updating here. */
  async changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    try {
      await firstValueFrom(this.http.post('/api/auth/change-password', { currentPassword, newPassword }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't change your password. Please try again.") };
    }
  }

  /** Re-confirms the signed-in user's password before a sensitive action such as exporting data. */
  async verifyPassword(password: string): Promise<AuthResult> {
    try {
      await firstValueFrom(this.http.post('/api/auth/verify-password', { password }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't verify your password. Please try again.") };
    }
  }

  /** Permanently deletes the signed-in account and every record it owns (server-side), then clears
   *  all local state the same way logging out does. `password` is only needed for an account
   *  without a Google login — the server rejects it otherwise. */
  async deleteAccount(password?: string): Promise<AuthResult> {
    try {
      await firstValueFrom(this.http.post('/api/auth/delete-account', { password }));
      this.logout();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractError(err, "Couldn't delete your account. Please try again.") };
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
