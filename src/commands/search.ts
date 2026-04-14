import type { Command } from "commander";
import type { PlanningRuntime } from "kirha";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import {
  DEFAULT_PLANNING_RUNTIME,
  DEFAULT_SUMMARIZATION_MODEL,
  isPlanningRuntime,
  isSummarizationModel,
  PLANNING_RUNTIMES,
  readConfig,
  SUMMARIZATION_MODELS,
  type SummarizationModel,
} from "../lib/config.ts";
import { CliError } from "../lib/errors.ts";
import { emit, resolveQuery } from "../lib/output.ts";

type SummarizationConfig = SummarizationModel | { model: SummarizationModel; instruction?: string };

interface SearchOptions {
  summarization?: SummarizationConfig;
  includeData?: boolean;
  includePlanning?: boolean;
  planningRuntime?: PlanningRuntime;
}

interface SearchFlags {
  summarize?: string | true;
  instruction?: string;
  noData?: boolean;
  includePlanning?: boolean;
  runtime?: string;
}

function resolveRuntime(flag: string | undefined): PlanningRuntime {
  const value =
    flag ?? readConfig().runtime ?? process.env.KIRHA_RUNTIME ?? DEFAULT_PLANNING_RUNTIME;
  if (!isPlanningRuntime(value)) {
    throw new CliError(
      "USAGE",
      `Invalid runtime '${value}'. Allowed: ${PLANNING_RUNTIMES.join(", ")}`,
    );
  }
  return value;
}

function resolveModel(value: string | true): SummarizationModel {
  if (value === true) return DEFAULT_SUMMARIZATION_MODEL;
  if (!isSummarizationModel(value)) {
    throw new CliError(
      "USAGE",
      `Invalid summarization model '${value}'. Allowed: ${SUMMARIZATION_MODELS.join(", ")}`,
    );
  }
  return value;
}

function buildSummarization(flags: SearchFlags): SummarizationConfig | undefined {
  if (flags.summarize === undefined) {
    if (flags.instruction) {
      throw new CliError("USAGE", "--instruction requires --summarize");
    }
    return undefined;
  }
  const model = resolveModel(flags.summarize);
  return flags.instruction ? { model, instruction: flags.instruction } : model;
}

export function registerSearch(program: Command): void {
  program
    .command("search [query]")
    .description("Run a search (query as arg or via stdin)")
    .option(
      "--summarize [model]",
      `Enable summarization (${SUMMARIZATION_MODELS.join(" | ")}, default: ${DEFAULT_SUMMARIZATION_MODEL})`,
    )
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
        includeData: flags.noData ? false : undefined,
        includePlanning: flags.includePlanning,
        planningRuntime: resolveRuntime(flags.runtime),
      };

      const result = await client.search(text, options);
      emit(result);
    });
}
