-- every game, for later analysis (owner ruling O13); one row per term, updated each month
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  world TEXT NOT NULL,
  preset TEXT NOT NULL,
  owner TEXT,
  month INTEGER NOT NULL,
  outcome TEXT,
  state TEXT NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX games_world ON games (world, preset);
-- plays counted per preset (spec); worlds.plays stays the total
CREATE TABLE world_plays (
  world TEXT NOT NULL,
  preset TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (world, preset)
);
