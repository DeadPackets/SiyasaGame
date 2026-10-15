CREATE TABLE builds (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  parts TEXT NOT NULL DEFAULT '{}',
  world TEXT,
  error TEXT,
  fake INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX builds_owner ON builds (owner, created);
ALTER TABLE worlds ADD COLUMN owner TEXT;
