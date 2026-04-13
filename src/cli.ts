import { Command, CommanderError } from "commander";
import pkg from "../package.json" with { type: "json" };
import { registerAuth } from "./commands/auth.ts";
import { registerConfig } from "./commands/config.ts";
import { registerMcp } from "./commands/mcp.ts";
import { registerPlan } from "./commands/plan.ts";
import { registerSearch } from "./commands/search.ts";
import { registerTask } from "./commands/task.ts";
import { registerTools } from "./commands/tools.ts";
import { registerUpgrade } from "./commands/upgrade.ts";
import { fail } from "./lib/output.ts";

const HELP_CODES = new Set(["commander.help", "commander.helpDisplayed", "commander.version"]);

export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("kirha")
    .description("Run Kirha from your terminal.")
    .version(pkg.version)
    .option("--api-key <key>", "Override the API key for this invocation")
    .option("--vertical <id>", "Override the vertical for this invocation")
    .showHelpAfterError()
    .configureOutput({
      writeOut: (str) => process.stdout.write(str),
      writeErr: (str) => process.stderr.write(str),
    })
    .exitOverride();

  registerAuth(program);
  registerConfig(program);
  registerSearch(program);
  registerPlan(program);
  registerTask(program);
  registerTools(program);
  registerMcp(program);
  registerUpgrade(program);

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.exitCode === 0 || HELP_CODES.has(err.code)) process.exit(0);
      process.stderr.write(
        `${JSON.stringify({ error: { code: "USAGE", message: err.message } })}\n`,
      );
      process.exit(2);
    }
    fail(err);
  }
}
