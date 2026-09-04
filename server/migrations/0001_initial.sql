CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- One row per user, whole blob — mirrors the client's AppSettings shape exactly.
CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);

-- One row per user — genuinely personal, unlike the old single global profile.
CREATE TABLE advisor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);

-- Price Settings overrides (price/rates/model years), one row per variant per user.
CREATE TABLE vehicle_overrides (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (user_id, vehicle_id)
);

CREATE TABLE bankers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  username TEXT,
  bank TEXT NOT NULL,
  state TEXT NOT NULL,
  branch TEXT,
  notes TEXT,
  favourite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_bankers_user ON bankers(user_id);

CREATE TABLE trade_in_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  username TEXT,
  company TEXT NOT NULL,
  state TEXT NOT NULL,
  branch TEXT,
  notes TEXT,
  favourite INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_trade_in_user ON trade_in_contacts(user_id);

-- CustomerRecord is ~30 mostly-optional fields; stored as JSON with just the columns needed for
-- filtering/sorting indexed alongside it (the client already fetches-all-then-filters-in-memory).
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX idx_customers_user ON customers(user_id);
