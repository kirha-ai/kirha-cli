import type { Command } from "commander";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import { emit, resolveQuery } from "../lib/output.ts";

export function registerPlan(program: Command): void {
  const plan = program.command("plan").description("Preview and execute Kirha plans");

  plan
    .command("create [query]")
    .description("Create and preview a plan (steps + estimated cost, no execution)")
    .action(async (query: string | undefined, _flags: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const text = await resolveQuery(query);
      const { client } = buildClient(globals);
      const result = await client.plan(text);
      emit({
        id: result.id,
        query: result.query,
        vertical: result.vertical,
        status: result.status,
        steps: result.steps,
        reason: result.reason,
        usage: result.usage,
        account: result.account,
      });
    });

  plan
    .command("exec <id>")
    .description("Execute a previously created plan by id")
    .action(async (id: string, _flags: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client } = buildClient(globals);
      emit(await client.getPlan(id).execute());
    });
}
