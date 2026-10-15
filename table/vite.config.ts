import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const here = (...p: string[]) => resolve(import.meta.dirname, ...p);
const pages = ["index", "play"];

export default defineConfig({
  root: "client",
  plugins: [cloudflare({ configPath: here("wrangler.jsonc"), persistState: { path: here(".wrangler/state") } })],
  environments: {
    siyasa: { build: { outDir: here("dist/siyasa") } },
    client: { build: { outDir: here("dist/client"), emptyOutDir: true, rollupOptions: { input: Object.fromEntries(pages.map((p) => [p, here("client", `${p}.html`)])) } } },
  },
});
