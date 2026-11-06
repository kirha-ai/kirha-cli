import type { Command } from "commander";
import type { Tool, ToolDetails, ToolsPage } from "kirha";
import { buildClient, type GlobalOptions } from "../lib/client.ts";
import { CliError } from "../lib/errors.ts";
import { emit, parseJsonArg, readStdin } from "../lib/output.ts";

const PAGE_SIZE = 20;
const MIN_DESCRIPTION_WIDTH = 24;
const MAX_PROSE_WIDTH = 80;
const FULL_DESCRIPTION_HELP =
  "Print descriptions in full instead of truncating them to the terminal width (always on when the output is not a terminal)";

interface ListFlags {
  provider?: string;
  page?: number;
  limit?: number;
  expand?: boolean;
  fullDescription?: boolean;
  json?: boolean;
}

interface MatchFlags {
  limit?: number;
  expand?: boolean;
  fullDescription?: boolean;
  json?: boolean;
}

interface RunFlags {
  input?: string;
  json?: boolean;
}

function terminalWidth(full = false): number {
  if (full || !process.stdout.isTTY) return Number.POSITIVE_INFINITY;
  return process.stdout.columns ?? 100;
}

function positiveInt(flag: string) {
  return (value: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new CliError("USAGE", `--${flag} must be a positive integer`);
    }
    return parsed;
  };
}

function shortCredits(credits: number): string {
  return credits === 0 ? "free" : `${credits} cr`;
}

function longCredits(credits: number): string {
  if (credits === 0) return "free";
  return `${credits} credit${credits === 1 ? "" : "s"} per call`;
}

function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  const flat = flatten(text);
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 1))}…`;
}

export function wrap(text: string, max: number): string[] {
  const words = flatten(text).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  lines.push(line);
  return lines;
}

function columns(values: string[], min: number): number {
  return values.reduce((widest, value) => Math.max(widest, value.length), min);
}

export function renderTable(tools: Tool[], showProvider: boolean, width: number): string {
  const nameWidth = columns(
    tools.map((tool) => tool.name),
    "NAME".length,
  );
  const providerWidth = showProvider
    ? columns(
        tools.map((tool) => tool.provider),
        "PROVIDER".length,
      )
    : 0;
  const creditWidth = columns(
    tools.map((tool) => String(tool.creditsPerCall)),
    "CREDITS".length,
  );
  const used = nameWidth + 2 + (showProvider ? providerWidth + 2 : 0) + creditWidth + 2;
  const descriptionWidth = Math.max(MIN_DESCRIPTION_WIDTH, width - used);

  const row = (name: string, provider: string, credits: string, description: string): string => {
    const head = showProvider
      ? `${name.padEnd(nameWidth)}  ${provider.padEnd(providerWidth)}`
      : name.padEnd(nameWidth);
    return `${head}  ${credits.padStart(creditWidth)}  ${description}`.trimEnd();
  };

  return [
    row("NAME", "PROVIDER", "CREDITS", "DESCRIPTION"),
    ...tools.map((tool) =>
      row(
        tool.name,
        tool.provider,
        String(tool.creditsPerCall),
        truncate(tool.description, descriptionWidth),
      ),
    ),
  ].join("\n");
}

export function renderExpanded(tools: Tool[], width: number): string {
  const prose = Math.min(width, MAX_PROSE_WIDTH);
  return tools
    .map((tool) => {
      const block = [
        `${tool.name} · ${tool.provider} · ${shortCredits(tool.creditsPerCall)}`,
        ...wrap(tool.description, prose),
      ];
      if (tool.inputSchema) {
        block.push("", "input_schema", JSON.stringify(tool.inputSchema, null, 2));
      }
      if (tool.outputSchema) {
        block.push("", "output_schema", JSON.stringify(tool.outputSchema, null, 2));
      }
      return block.join("\n");
    })
    .join("\n\n");
}

export function renderFooter(
  page: ToolsPage,
  shown: Tool[],
  nextCommand: (nextPage: number) => string,
): string {
  const head = shown[0];
  if (!head) return "";
  const first = page.skip + 1;
  const last = page.skip + shown.length;
  if (last < page.total) {
    const nextPage = Math.floor(page.skip / shown.length) + 2;
    return `Showing ${first}-${last} of ${page.total} · next: ${nextCommand(nextPage)}`;
  }
  const details = `details: kirha tools get ${head.name}`;
  if (first === 1) {
    return `${page.total} tool${page.total === 1 ? "" : "s"} · ${details}`;
  }
  return `Showing ${first}-${last} of ${page.total} · ${details}`;
}

export function renderMatch(tools: Tool[], width: number): string {
  const ranked = tools.filter((tool) => !tool.related);
  const related = tools.filter((tool) => tool.related);
  const nameWidth = columns(
    tools.map((tool) => tool.name),
    0,
  );
  const providerWidth = columns(
    tools.map((tool) => tool.provider),
    0,
  );
  const creditWidth = columns(
    tools.map((tool) => shortCredits(tool.creditsPerCall)),
    0,
  );
  const used = 2 + nameWidth + 2 + providerWidth + 2 + creditWidth + 2;
  const tailWidth = Math.max(MIN_DESCRIPTION_WIDTH, width - used);

  const row = (tool: Tool, tail: string): string =>
    `  ${tool.name.padEnd(nameWidth)}  ${tool.provider.padEnd(providerWidth)}  ${shortCredits(
      tool.creditsPerCall,
    ).padStart(creditWidth)}  ${tail}`.trimEnd();

  const sections: string[] = [];
  if (ranked.length > 0) {
    sections.push(
      ["Ranked", ...ranked.map((tool) => row(tool, truncate(tool.description, tailWidth)))].join(
        "\n",
      ),
    );
  }
  if (related.length > 0) {
    sections.push(
      [
        "Related — surfaced by the picks above",
        ...related.map((tool) => row(tool, `← ${tool.relatedTo.join(", ")}`)),
      ].join("\n"),
    );
  }
  return sections.join("\n\n");
}

export function renderDetails(
  tool: ToolDetails,
  siblingCredits: Map<string, number>,
  width: number,
): string {
  const prose = Math.min(width, MAX_PROSE_WIDTH);
  const lines = [tool.name, ...wrap(tool.description, prose), ""];
  lines.push(`Provider  ${tool.provider}`, `Cost      ${longCredits(tool.creditsPerCall)}`);
  if (tool.inputSchema) {
    lines.push("", "input_schema", JSON.stringify(tool.inputSchema, null, 2));
  }
  if (tool.outputSchema) {
    lines.push("", "output_schema", JSON.stringify(tool.outputSchema, null, 2));
  }
  if (tool.relatedTools.length > 0) {
    const nameWidth = columns(tool.relatedTools, 0);
    lines.push("", "Related tools");
    for (const name of tool.relatedTools) {
      const credits = siblingCredits.get(name);
      const cost =
        credits === undefined ? "" : `  ${longCredits(credits).replace(" per call", "")}`;
      lines.push(`  ${name.padEnd(nameWidth)}${cost}`.trimEnd());
    }
  }
  lines.push("", `Run it: kirha tools run ${tool.name} --input '{}'`);
  return lines.join("\n");
}

function print(body: string): void {
  if (!body) return;
  process.stdout.write(`\n${body}\n`);
}

export function registerTools(program: Command): void {
  const tools = program.command("tools").description("Inspect and run KIRHA tools");

  tools
    .command("list")
    .description("List the tool catalogue")
    .option("--provider <slug>", "Only tools served by this provider")
    .option("--page <n>", "Page to fetch (1-1000)", positiveInt("page"))
    .option("--limit <n>", "Tools per page (1-100)", positiveInt("limit"))
    .option("--expand", "Print each tool with its input and output schema")
    .option("--full-description", FULL_DESCRIPTION_HELP)
    .option("--json", "Print the raw API response")
    .action(async (flags: ListFlags, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client, focus } = buildClient(globals);
      const page = await client.listTools({
        focus,
        provider: flags.provider,
        page: flags.page,
        limit: flags.limit,
      });

      if (flags.json) {
        emit(page);
        return;
      }

      const paged = flags.page !== undefined || flags.limit !== undefined;
      const shown = paged ? page.tools : page.tools.slice(0, PAGE_SIZE);
      const width = terminalWidth(flags.fullDescription);
      const body = flags.expand
        ? renderExpanded(shown, width)
        : renderTable(shown, flags.provider === undefined, width);
      const footer = renderFooter(page, shown, (next) =>
        [
          "kirha",
          focus ? `--focus ${focus}` : "",
          "tools list",
          flags.provider ? `--provider ${flags.provider}` : "",
          flags.limit ? `--limit ${flags.limit}` : "",
          `--page ${next}`,
        ]
          .filter(Boolean)
          .join(" "),
      );
      print(footer ? `${body}\n\n${footer}` : body);
    });

  tools
    .command("get <name>")
    .description("Show one tool, its schemas and its provider's other tools")
    .option("--json", "Print the raw API response")
    .action(async (name: string, flags: { json?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client } = buildClient(globals);
      const tool = await client.getTool(name);

      if (flags.json) {
        emit(tool);
        return;
      }

      const siblings =
        tool.relatedTools.length > 0
          ? await client.listTools({ provider: tool.provider })
          : { tools: [] as Tool[] };
      const credits = new Map(siblings.tools.map((t) => [t.name, t.creditsPerCall] as const));
      print(renderDetails(tool, credits, terminalWidth()));
    });

  tools
    .command("match <intent>")
    .description("Rank the catalogue against an intent in plain language")
    .option("--limit <n>", "Ranked tools to return (1-50, default 10)", positiveInt("limit"))
    .option("--expand", "Print each tool with its input and output schema")
    .option("--full-description", FULL_DESCRIPTION_HELP)
    .option("--json", "Print the raw API response")
    .action(async (intent: string, flags: MatchFlags, cmd: Command) => {
      if (!intent.trim()) {
        throw new CliError("USAGE", "intent is required");
      }
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const { client, focus } = buildClient(globals);
      const page = await client.matchTools(intent, { focus, limit: flags.limit });

      if (flags.json) {
        emit(page);
        return;
      }

      const width = terminalWidth(flags.fullDescription);
      print(flags.expand ? renderExpanded(page.tools, width) : renderMatch(page.tools, width));
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
