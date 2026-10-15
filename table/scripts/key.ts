import { existsSync, readFileSync } from "node:fs";

// the key from the environment, or from the nearest .env up the tree; never printed
export function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (let d = new URL("..", import.meta.url); d.pathname !== "/"; d = new URL("..", d)) {
    const f = new URL(".env", d);
    const m = existsSync(f) && /^ANTHROPIC_API_KEY=(.+)$/m.exec(readFileSync(f, "utf8"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("no ANTHROPIC_API_KEY in the environment or a .env file");
}
