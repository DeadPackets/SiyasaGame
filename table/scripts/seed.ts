// Upload every pack under table/packs that has a skin to R2 and list it in D1.
//   bun scripts/seed.ts            -> the local dev bindings
//   bun scripts/seed.ts --remote   -> production
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname, remote = process.argv.includes("--remote") ? "--remote" : "--local";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;
mkdirSync(`${ROOT}dist/seed`, { recursive: true });

for (const dir of readdirSync(`${ROOT}packs`)) {
  const at = (f: string) => `${ROOT}packs/${dir}/${f}`;
  if (!existsSync(at("skin.json")) || !existsSync(at("music.brief.json"))) { console.log(`skip ${dir}: no skin or music`); continue; }
  const world = read(at("world.json")), skin = read(at("skin.json"));
  const pack = { world, deck: read(at("deck.json")), skin, music: read(at("music.brief.json")) };
  const file = `${ROOT}dist/seed/${world.id}.json`;
  writeFileSync(file, JSON.stringify(pack));
  execFileSync("npx", ["wrangler", "r2", "object", "put", `siyasa-packs/packs/${world.id}.json`, "--file", file, "--content-type", "application/json", remote], { cwd: ROOT, stdio: "inherit" });
  const card = { palette: skin.palette, fonts: skin.fonts, finish: skin.finish, ideologies: skin.ideologies.slice(0, 3) };
  const blurb = String(world.timeline?.[0]?.event ?? world.reckoning.meaning).split(/(?<=\.)\s/)[0];
  const row = `INSERT INTO worlds (id, title, polity, date, blurb, card, created) VALUES (${sql(world.id)}, ${sql(world.title)}, ${sql(world.polity)}, ${sql(world.date)}, ${sql(blurb)}, ${sql(JSON.stringify(card))}, ${Date.now()}) ON CONFLICT (id) DO UPDATE SET title = excluded.title, polity = excluded.polity, date = excluded.date, blurb = excluded.blurb, card = excluded.card`;
  execFileSync("npx", ["wrangler", "d1", "execute", "siyasa", remote, "--command", row], { cwd: ROOT, stdio: "inherit" });
  console.log(`seeded ${world.id}`);
}
