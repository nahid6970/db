CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  bg_color TEXT,
  folder_id TEXT
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  bg_color TEXT,
  border_color TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
