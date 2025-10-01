-- Create links table
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  target TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 302,
  expires_at INTEGER,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for expiration cleanup queries
CREATE INDEX IF NOT EXISTS idx_links_expires
  ON links(expires_at)
  WHERE expires_at IS NOT NULL;

-- Index for chronological listing
CREATE INDEX IF NOT EXISTS idx_links_created
  ON links(created_at DESC);
