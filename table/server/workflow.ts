import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "./env";

export type BuildParams = { build: string; prompt: string; owner: string; key: string };

// The steps arrive with the portable pipeline (table/build); until then a build fails cleanly and gives its slot back.
export class WorldBuild extends WorkflowEntrypoint<Env, BuildParams> {
  async run(event: WorkflowEvent<BuildParams>, step: WorkflowStep) {
    const { build, key } = event.payload;
    await step.do("fail", async () => {
      await this.env.DB.prepare("UPDATE builds SET status = 'failed', error = ? WHERE id = ?").bind("The build pipeline is not wired yet.", build).run();
      await this.env.GATE.get(this.env.GATE.idFromName("global")).release(key);
    });
  }
}
