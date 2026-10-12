import { PlanningRuntime } from "kirha";
import { CliError } from "./errors.ts";
import { configFile } from "./paths.ts";
import { readJson, writeJson } from "./store.ts";

export const PLANNING_RUNTIMES = Object.values(PlanningRuntime);
export const DEFAULT_PLANNING_RUNTIME: PlanningRuntime = PlanningRuntime.Fast;

export const CONFIG_KEYS = ["focus", "runtime"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

export interface ConfigRecord {
  focus?: string;
  vertical?: string;
  runtime?: PlanningRuntime;
}

const ALLOWED_VALUES: Record<ConfigKey, readonly string[] | null> = {
  focus: null,
  runtime: PLANNING_RUNTIMES,
};

export function isConfigKey(value: string): value is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(value);
}

export function isPlanningRuntime(value: string): value is PlanningRuntime {
  return (PLANNING_RUNTIMES as readonly string[]).includes(value);
}

export function readConfig(): ConfigRecord {
  return readJson<ConfigRecord>(configFile()) ?? {};
}

export function writeConfig(record: ConfigRecord): void {
  writeJson(configFile(), record, 0o644);
}

export function setConfigValue(key: ConfigKey, value: string): ConfigRecord {
  const allowed = ALLOWED_VALUES[key];
  if (allowed && !allowed.includes(value)) {
    throw new CliError(
      "USAGE",
      `Invalid value for ${key}: '${value}'. Allowed: ${allowed.join(", ")}`,
    );
  }
  const next: ConfigRecord = { ...readConfig(), [key]: value };
  writeConfig(next);
  return next;
}

export function unsetConfigValue(key: ConfigKey): ConfigRecord {
  const next: ConfigRecord = { ...readConfig() };
  delete next[key];
  writeConfig(next);
  return next;
}

export function resolveRuntime(flag: string | undefined): PlanningRuntime {
  if (flag !== undefined) {
    if (!isPlanningRuntime(flag)) {
      throw new CliError(
        "USAGE",
        `Invalid runtime '${flag}'. Allowed: ${PLANNING_RUNTIMES.join(", ")}`,
      );
    }
    return flag;
  }
  const saved = readConfig().runtime ?? process.env.KIRHA_RUNTIME;
  return saved && isPlanningRuntime(saved) ? saved : DEFAULT_PLANNING_RUNTIME;
}
