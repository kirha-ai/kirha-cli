import type { Command } from "commander";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import { CliError } from "../lib/errors.ts";
import { emit, parseJsonArg, readStdin } from "../lib/output.ts";

interface RunFlags {
  input?: string;
}

export function registerTools(program: Command): void {
  const tools = program.command("tools").description("Inspect and run Kirha tools");

  tools
    .command("list")
    .description("List available tools for a vertical")
    .action(async (_flags: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client, vertical } = buildClient(globals);
      if (!vertical) {
        throw new CliError(
          "USAGE",
          "vertical required (use --vertical, KIRHA_VERTICAL, or `kirha config set vertical <id>`)",
        );
      }
      const list = await client.tools({ vertical });
      emit(list);
    });

  tools
    .command("run <name>")
    .description("Execute a tool by name with JSON input")
    .option("--input <json>", "Tool input as JSON string (use '-' to read from stdin)")
    .action(async (name: string, flags: RunFlags, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client } = buildClient(globals);

      if (!flags.input) {
        throw new CliError("USAGE", "--input is required (JSON string or '-' for stdin)");
      }
      const raw = flags.input === "-" ? await readStdin() : flags.input;
      if (!raw) {
        throw new CliError("USAGE", "--input '-' was given but stdin was empty");
      }
      const input = parseJsonArg(raw, "input");

      const result = await client.executeTool(name, input);
      emit(result);
    });
}
