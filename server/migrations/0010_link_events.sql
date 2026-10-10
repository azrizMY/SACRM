-- Quote link activity: what visitors did on an advisor's quote link (cars viewed, quotes built,
-- WhatsApp taps...). Anonymous — a random visit id from the visitor's browser, never a name, phone,
-- IC, IP address or location. Kept 90 days.
CREATE TABLE IF NOT EXISTS link_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  car_variant_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_events_user_time ON link_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_link_events_visit ON link_events (user_id, visit_id, created_at);
