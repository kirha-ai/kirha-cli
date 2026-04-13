import type { Command } from "commander";
import { clearAuth, readAuth, writeAuth } from "../lib/auth.ts";
import type { GlobalOptions } from "../lib/client.ts";
import { CliError } from "../lib/errors.ts";
import { emit, readStdin } from "../lib/output.ts";
import { promptApiKey } from "../lib/prompt.ts";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Manage Kirha credentials");

  auth
    .command("login")
    .description("Store an API key (--api-key flag, piped stdin, or interactive prompt)")
    .action(async (_flags: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals() as GlobalOptions;
      const apiKey = globals.apiKey || (await readStdin()) || (await promptApiKey());
      if (!apiKey) {
        throw new CliError(
          "USAGE",
          "API key required (use --api-key, pipe via stdin, or run interactively)",
        );
      }
      writeAuth({ apiKey });
      emit({ ok: true, source: "file" });
    });

  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(() => {
      clearAuth();
      emit({ ok: true });
    });

  auth
    .command("status")
    .description("Show authentication status")
    .action(() => {
      const fileKey = readAuth()?.apiKey;
      const envKey = process.env.KIRHA_API_KEY;
      const source = fileKey ? "file" : envKey ? "env" : null;
      emit({ authenticated: source !== null, source });
    });
}
