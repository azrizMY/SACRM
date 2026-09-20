export type AuthUser = {
  id: string;
  name: string;
  email: string;
  publicToken: string;
  /** Whether this account has a Google identity linked — shown as a read-only badge in Settings
   *  and used there to steer a password-less Google account at "Forgot password" instead of
   *  "Change password", which needs a current password nobody set. */
  hasGoogleLogin: boolean;
  /** True for a Google account still missing a Primary Brand or phone number (the Google flow skips
   *  the signup form that collects them) — authGuard keeps such an account on /choose-brand until
   *  it's done. Computed server-side from the account's real data on every login and session
   *  restore, so it can't be skipped by leaving mid-setup. */
  needsOnboarding: boolean;
};
