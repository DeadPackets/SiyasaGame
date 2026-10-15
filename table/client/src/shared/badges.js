// A fulfilled Vision earns a badge on its world, one per preset (platform spec). Kept in this browser: there are no accounts.
import { PRESETS } from "../../../engine/tune.ts";

const KEY = "siyasa-badges";
const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export const presetOf = (rules) => (typeof rules === "string" ? rules : Object.keys(PRESETS).find((k) => Object.entries(PRESETS[k]).every(([f, v]) => rules?.[f] === v)) ?? "custom");
export const badges = (world) => all()[world] ?? {};
export function earn(world, vision, rules) {
  const b = all(), w = (b[world] ??= {}), p = presetOf(rules);
  if ((w[vision] ??= []).includes(p)) return false;
  w[vision].push(p);
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {}
  return true;
}
