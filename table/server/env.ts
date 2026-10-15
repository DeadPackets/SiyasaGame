import type { GateDO } from "./gate";

export type Env = {
  DB: D1Database;
  PACKS: R2Bucket;
  RL: RateLimit;
  ASSETS: Fetcher;
  AI: Ai;
  VEC: VectorizeIndex;
  GATE: DurableObjectNamespace<GateDO>;
  BUILD: Workflow;
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  IDENTITY_SECRET: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  DAILY_BUILD_CAP: string;
  JEV_DAILY_CALLS?: string;
  FAKE_BUILD?: string;
};
