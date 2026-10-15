import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

export const today = () => new Date().toISOString().slice(0, 10);

// One instance serialises every claim, so a burst from one address cannot take two slots.
export class GateDO extends DurableObject<Env> {
  async peek(key: string): Promise<"ok" | "spaced" | "capped"> {
    const d = today(), cap = Number(this.env.DAILY_BUILD_CAP);
    if (await this.ctx.storage.get(`ip:${d}:${key}`)) return "spaced";
    return Number.isFinite(cap) && ((await this.ctx.storage.get<number>(`n:${d}`)) ?? 0) < cap ? "ok" : "capped";
  }
  async claim(key: string): Promise<"ok" | "spaced" | "capped"> {
    const d = today();
    if (await this.ctx.storage.get(`ip:${d}:${key}`)) return "spaced";
    const cap = Number(this.env.DAILY_BUILD_CAP);
    if (!Number.isFinite(cap)) return "capped"; // a cap that is not a number closes the gate: it is a spending limit
    const n = ((await this.ctx.storage.get<number>(`n:${d}`)) ?? 0) + 1;
    if (n > cap) return "capped";
    await this.ctx.storage.put({ [`n:${d}`]: n, [`ip:${d}:${key}`]: 1 });
    return "ok";
  }
  // A failed build gives the address one more try that day. The global count is spent money and never goes back.
  async release(key: string, day: string): Promise<void> {
    if (await this.ctx.storage.get(`refund:${day}:${key}`)) return;
    await this.ctx.storage.put(`refund:${day}:${key}`, 1);
    await this.ctx.storage.delete(`ip:${day}:${key}`);
  }
}

// IPv6 is keyed by its /64, so one home network is one address
export const ipKey = (ip: string) => (ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip);
