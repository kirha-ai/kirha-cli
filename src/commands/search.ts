import type { Command } from "commander";
import type { SearchOptions, SummarizationConfig } from "kirha";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import { DEFAULT_PLANNING_RUNTIME, PLANNING_RUNTIMES, resolveRuntime } from "../lib/config.ts";
import { CliError } from "../lib/errors.ts";
import { emit, resolveQuery } from "../lib/output.ts";

interface SearchFlags {
  summarize?: string | true;
  instruction?: string;
  data: boolean;
  includePlanning?: boolean;
  runtime?: string;
}

function buildSummarization(flags: SearchFlags): SummarizationConfig | undefined {
  if (!flags.summarize) {
    if (flags.instruction) {
      throw new CliError("USAGE", "--instruction requires --summarize");
    }
    return undefined;
  }
  return flags.instruction ? { instruction: flags.instruction } : true;
}

export function registerSearch(program: Command): void {
  program
    .command("search [query]")
    .description("Run a search (query as arg or via stdin)")
    .option("--summarize [model]", "Add a summary of the results (model is ignored)")
    .option("--instruction <text>", "Summarization instruction")
    .option("--no-data", "Exclude raw data from response")
    .option("--include-planning", "Include planning info in response")
    .option(
      "--runtime <runtime>",
      `Planning runtime (${PLANNING_RUNTIMES.join(" | ")}, default: ${DEFAULT_PLANNING_RUNTIME})`,
    )
    .action(async (query: string | undefined, flags: SearchFlags, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const text = await resolveQuery(query);
      const { client } = buildClient(globals);

      const options: SearchOptions = {
        summarization: buildSummarization(flags),
        includeData: flags.data ? undefined : false,
        includePlanning: flags.includePlanning,
        planningRuntime: resolveRuntime(flags.runtime),
      };

      emit(await client.search(text, options));
    });
}
