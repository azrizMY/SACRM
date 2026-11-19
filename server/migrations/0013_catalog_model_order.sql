-- The owner's order of each brand's models (Manage Cars → Reorder), shared by every account.
-- One row per brand that has been put in order: `models` is a JSON array of model names, first to
-- last. Models not in the list (added later) follow, cheapest first. Brands without a row keep the
-- catalogue's own order.
CREATE TABLE catalog_model_order (
  brand TEXT PRIMARY KEY,
  models TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
