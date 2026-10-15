import { mkdirSync, writeFileSync } from "node:fs";
import { ROLES, type Role } from "../engine";
import { adaptiveBot, greedyBot, randomBot } from "./bots";
import { loadPack } from "./load";
import { runTerm, type TermResult } from "./sim";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const N = Number(arg("terms", "1000")), which = arg("world", "all");
const worlds = (which === "all" ? ["egypt-2011", "mars-2091"] : [which]) as ("egypt-2011" | "mars-2091")[];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const runs = (f: (seed: number) => TermResult, n = N) => Array.from({ length: n }, (_, k) => f(k + 1));
const rate = (rs: TermResult[], kinds: string[]) => rs.filter((r) => kinds.includes(r.outcome.kind)).length / rs.length;
const fallers = (rs: TermResult[]) =>
  Object.entries(rs.reduce<Record<string, number>>((a, r) => (r.outcome.kind === "fallen" ? ((a[r.outcome.by] = (a[r.outcome.by] ?? 0) + 1), a) : a), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v / rs.length)}`)
    .join(", ");

const out: Record<string, unknown> = {};
const md: string[] = ["# Balance report", "", `${N} terms per bot (adaptive: ${Math.max(50, Math.round(N / 10))}), preset standard, Jev stand-in (nudge 0, Director = top, plausibility 0.7).`, ""];
for (const name of worlds) {
  const p = loadPack(name), t0 = performance.now();
  const random = runs((seed) => runTerm(p, randomBot(seed), seed));
  const greedy = Object.fromEntries(p.deck.visions.map((v) => [v.id, runs((seed) => runTerm(p, greedyBot(v.id), seed))]));
  const adaptive = runs((seed) => runTerm(p, adaptiveBot(), seed), Math.max(50, Math.round(N / 10)));
  const fulfil = Object.fromEntries(Object.entries(greedy).map(([id, rs]) => [id, rate(rs, ["fulfilled"])]));
  const fv = Object.values(fulfil), all = [...random, ...Object.values(greedy).flat(), ...adaptive];
  const plays = Object.values(greedy).flat().flatMap((r) => r.firstPlays);
  const top = Object.entries(plays.reduce<Record<string, number>>((a, id) => ((a[id] = (a[id] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1])[0];
  const acts = all.reduce((a, r) => a + r.actions, 0), months = all.reduce((a, r) => a + r.months, 0);
  const spent = Object.fromEntries(ROLES.map((k) => [k, all.reduce((a, r) => a + r.spentIn[k], 0) / acts]));
  const capped = Object.fromEntries((["force", "voice", "trust"] as Role[]).map((k) => [k, all.reduce((a, r) => a + r.capMonths[k], 0) / months]));
  const ch = all.reduce((a, r) => ({ answer: a.answer + r.change.answer, drift: a.drift + r.change.drift, other: a.other + r.change.other }), { answer: 0, drift: 0, other: 0 });
  const answerShare = ch.answer / (ch.answer + ch.drift + ch.other);
  const combos = p.deck.combos.map((c) => {
    const n = Math.max(50, Math.round(N / 4));
    const lift = Math.max(
      ...p.deck.visions.map(
        (v) => rate(runs((seed) => runTerm(p, greedyBot(v.id, c.parts), seed), n), ["fulfilled"]) - rate(runs((seed) => runTerm(p, greedyBot(v.id), seed, { banned: c.parts }), n), ["fulfilled"]),
      ),
    );
    return { name: c.name, lift };
  });
  const adaptiveRate = rate(adaptive, ["fulfilled"]);
  const targets: [string, boolean, string][] = [
    ["random falls in 60% or more of terms", rate(random, ["fallen"]) >= 0.6, `${pct(rate(random, ["fallen"]))} (by ${fallers(random)})`],
    ["no dominant ideology: Vision rates within 15 points", Math.max(...fv) - Math.min(...fv) <= 0.15, Object.entries(fulfil).map(([k, v]) => `${k} ${pct(v)}`).join(", ")],
    ["skill pays: adaptive beats every greedy bot by 15 points", fv.every((v) => adaptiveRate - v >= 0.15), `adaptive ${pct(adaptiveRate)}`],
    ["no card is the best play in more than 50% of months", (top?.[1] ?? 0) / Math.max(1, plays.length) <= 0.5, top ? `${top[0]} ${pct(top[1] / plays.length)}` : "no plays"],
    ["every kind is spent in 15% or more of actions", Object.values(spent).every((v) => v >= 0.15), Object.entries(spent).map(([k, v]) => `${k} ${pct(v)}`).join(", ")],
    ["no kind sits at its cap more than 30% of months", Object.values(capped).every((v) => v <= 0.3), Object.entries(capped).map(([k, v]) => `${k} ${pct(v)}`).join(", ")],
    ["answers cause 50% or more of support change", answerShare >= 0.5, pct(answerShare)],
    ...combos.map((c) => [`combo "${c.name}" lifts a Vision by 10 points (taken vs banned)`, c.lift >= 0.1, pct(c.lift)] as [string, boolean, string]),
  ];
  const greedyFalls = fallers(Object.values(greedy).flat());
  out[name] = { fulfil, adaptiveRate, random: rate(random, ["fallen"]), spent, capped, answerShare, combos, greedyFalls, seconds: (performance.now() - t0) / 1000 };
  md.push(
    `## ${p.world.title}`,
    "",
    "| Target | Pass | Measured |",
    "|---|---|---|",
    ...targets.map(([t, ok, m]) => `| ${t} | ${ok ? "yes" : "**no**"} | ${m} |`),
    "",
    `Greedy bots fall to: ${greedyFalls || "nobody"}. Run time ${Math.round((performance.now() - t0) / 1000)} s.`,
    "",
  );
}
mkdirSync(new URL("out/", import.meta.url), { recursive: true });
writeFileSync(new URL("out/report.json", import.meta.url), JSON.stringify(out, null, 1));
writeFileSync(new URL("out/report.md", import.meta.url), md.join("\n"));
console.log(md.join("\n"));
