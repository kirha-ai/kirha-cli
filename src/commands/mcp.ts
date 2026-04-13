import { spawn } from "node:child_process";
import type { Command } from "commander";
import { ANSI } from "../lib/ansi.ts";
import { type GlobalOptions, resolveApiKey } from "../lib/client.ts";
import { CliError } from "../lib/errors.ts";
import { promptMultiSelect } from "../lib/prompt.ts";
import { ensureReleaseBinary } from "../lib/release-binary.ts";

const MCP_INSTALLER_REPO = "kirha-ai/mcp-installer";
const MCP_INSTALLER_VERSION = process.env.KIRHA_MCP_INSTALLER_VERSION ?? "v0.1.0";
const MCP_INSTALLER_TOOL = "mcp-installer";

const SUPPORTED_CLIENTS = [
  { id: "claudecode", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "opencode", label: "OpenCode" },
  { id: "gemini", label: "Gemini CLI (experimental)" },
  { id: "droid", label: "Droid (Factory AI)" },
] as const;

type ClientId = (typeof SUPPORTED_CLIENTS)[number]["id"];
type McpSubcommand = "install" | "update" | "remove" | "show";

interface SubcommandDefinition {
  needsKey: boolean;
  multi: boolean;
  participle: string;
}

const SUBCOMMAND_CONFIG: Record<McpSubcommand, SubcommandDefinition> = {
  install: { needsKey: true, multi: true, participle: "installed" },
  update: { needsKey: true, multi: true, participle: "updated" },
  remove: { needsKey: false, multi: true, participle: "removed" },
  show: { needsKey: false, multi: false, participle: "shown" },
};

const CLIENT_IDS = new Set<string>(SUPPORTED_CLIENTS.map((c) => c.id));

function isClientId(value: string): value is ClientId {
  return CLIENT_IDS.has(value);
}

const PLATFORM_MAP: Record<string, { osName: string; suffix: string }> = {
  darwin: { osName: "darwin", suffix: "" },
  linux: { osName: "linux", suffix: "" },
  win32: { osName: "windows", suffix: ".exe" },
};

const ARCH_MAP: Record<string, string> = {
  x64: "amd64",
  arm64: "arm64",
};

interface McpFlags {
  client?: string;
  key?: string;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  configPath?: string;
}

function mcpAssetName(): string {
  const platform = PLATFORM_MAP[process.platform];
  const arch = ARCH_MAP[process.arch];
  if (!platform || !arch) {
    throw new CliError(
      "INTERNAL",
      `Unsupported platform for mcp-installer: ${process.platform}/${process.arch}`,
    );
  }
  return `kirha-mcp-installer-${platform.osName}-${arch}${platform.suffix}`;
}

function parseClients(raw: string | undefined): ClientId[] | null {
  if (!raw) return null;
  if (raw === "all") return SUPPORTED_CLIENTS.map((c) => c.id);

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((c) => {
      if (!isClientId(c)) {
        throw new CliError(
          "USAGE",
          `Unknown client '${c}'. Allowed: ${SUPPORTED_CLIENTS.map((x) => x.id).join(", ")}, all`,
        );
      }
      return c;
    });
}

async function promptForClients(subcommand: McpSubcommand): Promise<ClientId[]> {
  const participle = SUBCOMMAND_CONFIG[subcommand].participle;
  const selected = await promptMultiSelect<ClientId>({
    message: `Which clients should Kirha be ${participle} for?`,
    items: SUPPORTED_CLIENTS.map((c) => ({ label: c.label, value: c.id })),
    minSelected: 1,
  });

  if (selected === null) {
    throw new CliError(
      "USAGE",
      "--client is required (comma-separated, 'all', or run in an interactive terminal)",
    );
  }
  if (selected.length === 0) {
    throw new CliError("USAGE", "No clients selected");
  }
  return selected;
}

function runMcpInstaller(
  binaryPath: string,
  subcommand: McpSubcommand,
  client: ClientId,
  flags: McpFlags,
  apiKey: string | null,
): Promise<number> {
  const args: string[] = [subcommand, "--client", client];

  if (SUBCOMMAND_CONFIG[subcommand].needsKey) {
    if (!apiKey) {
      throw new CliError(
        "AUTH_REQUIRED",
        "No API key found. Run `kirha auth login` or pass --api-key.",
      );
    }
    args.push("--key", apiKey);
  }
  if (flags.configPath) args.push("--config-path", flags.configPath);
  if (flags.dryRun) args.push("--dry-run");
  if (flags.force) args.push("--force");
  if (flags.verbose) args.push("--verbose");

  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, { stdio: "inherit" });
    child.on("error", (err) =>
      reject(new CliError("INTERNAL", `Failed to spawn mcp-installer: ${err.message}`)),
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function runForClients(
  subcommand: McpSubcommand,
  clients: ClientId[],
  flags: McpFlags,
  apiKey: string | null,
): Promise<void> {
  const binaryPath = await ensureReleaseBinary({
    toolName: MCP_INSTALLER_TOOL,
    repo: MCP_INSTALLER_REPO,
    version: MCP_INSTALLER_VERSION,
    assetName: mcpAssetName(),
  });

  const showBanner = clients.length > 1;
  const results: Array<{ client: ClientId; code: number }> = [];
  const stderr = process.stderr;

  for (const client of clients) {
    if (showBanner) stderr.write(`\n→ ${subcommand} for ${client}\n`);
    const code = await runMcpInstaller(binaryPath, subcommand, client, flags, apiKey);
    results.push({ client, code });
  }

  if (showBanner) {
    stderr.write("\n");
    for (const { client, code } of results) {
      const symbol = code === 0 ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
      stderr.write(`  ${symbol} ${client}\n`);
    }
    const succeeded = results.filter((r) => r.code === 0).length;
    stderr.write(`\n${succeeded}/${results.length} succeeded\n`);
  }

  const failed = results.filter((r) => r.code !== 0);
  if (failed.length > 0) {
    throw new CliError(
      "API_ERROR",
      `mcp-installer ${subcommand} failed for: ${failed.map((r) => r.client).join(", ")}`,
    );
  }
}

async function runSubcommand(
  subcommand: McpSubcommand,
  flags: McpFlags,
  cmd: Command,
): Promise<void> {
  const globals = cmd.optsWithGlobals() as GlobalOptions;
  const definition = SUBCOMMAND_CONFIG[subcommand];
  const parsedFromFlag = parseClients(flags.client);

  let clients: ClientId[];
  if (parsedFromFlag) {
    if (!definition.multi && parsedFromFlag.length > 1) {
      throw new CliError(
        "USAGE",
        `${subcommand} takes a single --client, got ${parsedFromFlag.length}`,
      );
    }
    clients = parsedFromFlag;
  } else if (definition.multi) {
    clients = await promptForClients(subcommand);
  } else {
    throw new CliError("USAGE", "--client is required for this command");
  }

  const apiKey = resolveApiKey(globals, flags.key);
  await runForClients(subcommand, clients, flags, apiKey);
}

export function registerMcp(program: Command): void {
  const mcp = program
    .command("mcp")
    .description("Install the Kirha MCP server into AI coding clients");

  const allowedClients = `${SUPPORTED_CLIENTS.map((c) => c.id).join(" | ")} | all`;

  mcp
    .command("install")
    .description("Install Kirha MCP into one or more clients")
    .option("-c, --client <names>", `Client(s) to install for (${allowedClients})`)
    .option("-k, --key <apiKey>", "API key to store in the client config (defaults to your auth)")
    .option("--config-path <path>", "Custom configuration file path")
    .option("--dry-run", "Show what would change without applying it")
    .option("-f, --force", "Force install even if the client is running")
    .option("--verbose", "Verbose output from mcp-installer")
    .action((flags: McpFlags, cmd: Command) => runSubcommand("install", flags, cmd));

  mcp
    .command("update")
    .description("Update the API key for one or more clients")
    .option("-c, --client <names>", `Client(s) to update (${allowedClients})`)
    .option("-k, --key <apiKey>", "New API key (defaults to your stored auth)")
    .option("--config-path <path>", "Custom configuration file path")
    .option("--dry-run", "Show what would change without applying it")
    .option("-f, --force", "Force update even if the client is running")
    .option("--verbose", "Verbose output from mcp-installer")
    .action((flags: McpFlags, cmd: Command) => runSubcommand("update", flags, cmd));

  mcp
    .command("remove")
    .description("Remove Kirha MCP from one or more clients")
    .option("-c, --client <names>", `Client(s) to remove from (${allowedClients})`)
    .option("--config-path <path>", "Custom configuration file path")
    .option("--dry-run", "Show what would change without applying it")
    .option("-f, --force", "Force remove even if the client is running")
    .option("--verbose", "Verbose output from mcp-installer")
    .action((flags: McpFlags, cmd: Command) => runSubcommand("remove", flags, cmd));

  mcp
    .command("show")
    .description("Show the current MCP configuration for a client")
    .option(
      "-c, --client <name>",
      `Client to inspect (${SUPPORTED_CLIENTS.map((c) => c.id).join(" | ")})`,
    )
    .option("--config-path <path>", "Custom configuration file path")
    .option("--verbose", "Verbose output from mcp-installer")
    .action((flags: McpFlags, cmd: Command) => runSubcommand("show", flags, cmd));
}
