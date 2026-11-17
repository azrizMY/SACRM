-- The owner's car catalogue, edited from the owner-only "Manage Cars" page and shared by every
-- account. It sits on top of the catalogue built into the app's code:
--   catalog_brands   one row per brand the owner added, or a built-in brand whose logo they changed.
--   catalog_vehicles one row per variant the owner added, or a built-in variant they edited or hid.
--                    `data` is JSON: a full variant for a new one, the changed fields for a built-in
--                    one, and {"hidden": true} to take a built-in variant off the list.
-- Uploaded logos, photos and brochures live in the FILES key-value store, not in this database;
-- these rows only hold their /api/files/... paths.
CREATE TABLE catalog_brands (
  name TEXT PRIMARY KEY,
  logo_url TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE catalog_vehicles (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
