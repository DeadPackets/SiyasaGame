import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

const day = () => new Date().toISOString().slice(0, 10);

// One instance serialises every claim, so a burst from one address cannot take two slots.
export class GateDO extends DurableObject<Env> {
  async claim(key: string): Promise<"ok" | "spaced" | "capped"> {
    const d = day();
    if (await this.ctx.storage.get(`ip:${d}:${key}`)) return "spaced";
    const cap = Number(this.env.DAILY_BUILD_CAP);
    if (!Number.isFinite(cap)) return "capped"; // a cap that is not a number closes the gate: it is a spending limit
    const n = ((await this.ctx.storage.get<number>(`n:${d}`)) ?? 0) + 1;
    if (n > cap) return "capped";
    await this.ctx.storage.put({ [`n:${d}`]: n, [`ip:${d}:${key}`]: 1 });
    return "ok";
  }
  // a failed build gives the slot back
  async release(key: string): Promise<void> {
    const d = day(), n = (await this.ctx.storage.get<number>(`n:${d}`)) ?? 0;
    await this.ctx.storage.delete(`ip:${d}:${key}`);
    if (n > 0) await this.ctx.storage.put(`n:${d}`, n - 1);
  }
}

// IPv6 is keyed by its /64, so one home network is one address
export const ipKey = (ip: string) => (ip.includes(":") ? ip.split(":").slice(0, 4).join(":") : ip);
