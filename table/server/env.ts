export type Env = {
  DB: D1Database;
  PACKS: R2Bucket;
  RL: RateLimit;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  JEV_DAILY_CALLS?: string;
};
