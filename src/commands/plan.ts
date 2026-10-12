import type { Command } from "commander";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import { DEFAULT_PLANNING_RUNTIME, PLANNING_RUNTIMES, resolveRuntime } from "../lib/config.ts";
import { emit, resolveQuery } from "../lib/output.ts";

export function registerPlan(program: Command): void {
  const plan = program.command("plan").description("Preview and execute KIRHA plans");

  plan
    .command("create [query]")
    .description("Create and preview a plan (steps + estimated cost, no execution)")
    .option(
      "--runtime <runtime>",
      `Planning runtime (${PLANNING_RUNTIMES.join(" | ")}, default: ${DEFAULT_PLANNING_RUNTIME})`,
    )
    .action(async (query: string | undefined, flags: { runtime?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const text = await resolveQuery(query);
      const { client } = buildClient(globals);
      const result = await client.plan(text, { planningRuntime: resolveRuntime(flags.runtime) });
      emit({
        id: result.id,
        query: result.query,
        focus: result.focus,
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
