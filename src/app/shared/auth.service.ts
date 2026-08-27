import { Injectable, computed, signal } from '@angular/core';
import { DEMO_ACCOUNT, type AuthAccount, type AuthUser } from '../data/auth-data';
import { AdvisorService } from './advisor.service';

const ACCOUNTS_KEY = 'redline-auth-accounts';
const SESSION_KEY = 'redline-auth-session';

export type AuthResult = { ok: true } | { ok: false; error: string };

function loadAccounts(): AuthAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore corrupt/unavailable storage */
  }
  // First run: seed a demo account so the login page is never a dead end.
  const seeded = [DEMO_ACCOUNT];
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
  } catch {
    /* ignore */
  }
  return seeded;
}

function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Local, backend-free "auth" for this prototype: accounts and the active
 * session both live in the browser's localStorage. Good enough to gate the
 * app and demo a real login/sign-up flow — not a substitute for real auth.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<AuthUser | null>(loadSession());
  isAuthenticated = computed(() => this.currentUser() !== null);

  constructor(private advisor: AdvisorService) {}

  signUp(name: string, email: string, password: string): AuthResult {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = loadAccounts();
    if (accounts.some((a) => a.email === normalizedEmail)) {
      return { ok: false, error: 'An account with this email already exists.' };
    }
    const account: AuthAccount = { name: name.trim(), email: normalizedEmail, password };
    this.saveAccounts([...accounts, account]);
    this.startSession({ name: account.name, email: account.email });
    return { ok: true };
  }

  login(email: string, password: string): AuthResult {
    const normalizedEmail = email.trim().toLowerCase();
    const account = loadAccounts().find((a) => a.email === normalizedEmail);
    if (!account || account.password !== password) {
      return { ok: false, error: 'Incorrect email or password.' };
    }
    this.startSession({ name: account.name, email: account.email });
    return { ok: true };
  }

  logout() {
    this.currentUser.set(null);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  private startSession(user: AuthUser) {
    this.currentUser.set(user);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      /* session still holds for this tab even if storage fails */
    }
    // Keep the rest of the app (sidebar, topbar, profile) in sync with whoever is signed in.
    this.advisor.update({ name: user.name, email: user.email });
  }

  private saveAccounts(accounts: AuthAccount[]) {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch {
      /* ignore */
    }
  }
}
