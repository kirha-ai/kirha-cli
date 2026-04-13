import type { Command } from "commander";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import { CliError } from "../lib/errors.ts";
import { emit, resolveQuery } from "../lib/output.ts";

interface TaskFlags {
  instruction?: string;
  timeout?: string;
  poll?: string;
}

function parsePositiveInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new CliError("USAGE", `--${name} must be a positive integer (ms)`);
  }
  return n;
}

export function registerTask(program: Command): void {
  const task = program.command("task").description("Manage Kirha async tasks");

  task
    .command("run [query]")
    .description("Create a task and wait until it finishes")
    .option("--instruction <text>", "Optional task instruction")
    .option("--timeout <ms>", "Max wait time in ms (default 600000)")
    .option("--poll <ms>", "Poll interval in ms (default 2000)")
    .action(async (query: string | undefined, flags: TaskFlags, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const text = await resolveQuery(query);
      const { client } = buildClient(globals);

      const created = await client.task(text, { instruction: flags.instruction });
      const result = await created.wait({
        timeout: parsePositiveInt(flags.timeout, "timeout"),
        pollInterval: parsePositiveInt(flags.poll, "poll"),
      });
      emit(result);
    });

  task
    .command("create [query]")
    .description("Create a task and return its id without waiting")
    .option("--instruction <text>", "Optional task instruction")
    .action(async (query: string | undefined, flags: TaskFlags, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const text = await resolveQuery(query);
      const { client } = buildClient(globals);
      const created = await client.task(text, { instruction: flags.instruction });
      emit({ id: created.id });
    });

  task
    .command("status <id>")
    .description("Fetch the status of an existing task")
    .action(async (id: string, _flags: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client } = buildClient(globals);
      emit(await client.getTask(id).status());
    });

  task
    .command("result <id>")
    .description("Fetch the result of an existing task")
    .action(async (id: string, _flags: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client } = buildClient(globals);
      emit(await client.getTask(id).result());
    });

  task
    .command("wait <id>")
    .description("Poll an existing task until it finishes")
    .option("--timeout <ms>", "Max wait time in ms (default 600000)")
    .option("--poll <ms>", "Poll interval in ms (default 2000)")
    .action(async (id: string, flags: TaskFlags, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client } = buildClient(globals);
      const result = await client.getTask(id).wait({
        timeout: parsePositiveInt(flags.timeout, "timeout"),
        pollInterval: parsePositiveInt(flags.poll, "poll"),
      });
      emit(result);
    });
}
