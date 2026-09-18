export type AuthUser = {
  id: string;
  name: string;
  email: string;
  publicToken: string;
  /** Whether this account has a Google identity linked — shown as a read-only badge in Settings
   *  and used there to steer a password-less Google account at "Forgot password" instead of
   *  "Change password", which needs a current password nobody set. */
  hasGoogleLogin: boolean;
  /** Only ever present (and true) on the /api/auth/google response, for an account that route just
   *  created — signals the client to collect Primary Brand before the dashboard, since the Google
   *  flow skips the signup form that normally asks for it. Never persisted onto `currentUser`. */
  isNewUser?: boolean;
};
