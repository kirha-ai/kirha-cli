import { homedir } from "node:os";
import { join } from "node:path";

export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  return join(xdg && xdg.length > 0 ? xdg : join(homedir(), ".config"), "kirha");
}

export function authFile(): string {
  return join(configDir(), "auth.json");
}

export function configFile(): string {
  return join(configDir(), "config.json");
}
