-- Existing accounts are grandfathered as verified; only new email/password signups start at 0
-- (see /api/auth/signup) — the flag decides whether a later Google sign-in may link to the account.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;

-- Fixed-window counters for per-IP / per-email rate limiting (see server/src/rate-limit.ts).
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
