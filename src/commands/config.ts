import type { Command } from "commander";
import {
  CONFIG_KEYS,
  type ConfigKey,
  isConfigKey,
  readConfig,
  setConfigValue,
  unsetConfigValue,
} from "../lib/config.ts";
import { CliError } from "../lib/errors.ts";
import { emit } from "../lib/output.ts";

function assertKey(key: string): asserts key is ConfigKey {
  if (!isConfigKey(key)) {
    throw new CliError("USAGE", `Unknown config key '${key}'. Allowed: ${CONFIG_KEYS.join(", ")}`);
  }
}

export function registerConfig(program: Command): void {
  const config = program.command("config").description("Manage non-secret CLI defaults");

  config
    .command("get <key>")
    .description("Read a config value")
    .action((key: string) => {
      assertKey(key);
      emit({ key, value: readConfig()[key] ?? null });
    });

  config
    .command("set <key> <value>")
    .description("Set a config value")
    .action((key: string, value: string) => {
      assertKey(key);
      emit({ ok: true, config: setConfigValue(key, value) });
    });

  config
    .command("unset <key>")
    .description("Remove a config value")
    .action((key: string) => {
      assertKey(key);
      emit({ ok: true, config: unsetConfigValue(key) });
    });

  config
    .command("list")
    .description("Show all config values")
    .action(() => {
      emit(readConfig());
    });
}
