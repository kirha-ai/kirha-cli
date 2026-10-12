import { KirhaApi } from "kirha";
import { readAuth } from "./auth.ts";
import { readConfig } from "./config.ts";
import { CliError } from "./errors.ts";

export interface GlobalOptions {
  apiKey?: string;
  focus?: string;
  vertical?: string;
}

export interface ResolvedContext {
  focus?: string;
  client: KirhaApi;
}

export function resolveApiKey(opts: GlobalOptions, override?: string): string | null {
  return override ?? opts.apiKey ?? readAuth()?.apiKey ?? process.env.KIRHA_API_KEY ?? null;
}

export function resolveFocus(opts: GlobalOptions): string | undefined {
  const config = readConfig();
  return (
    opts.focus ??
    opts.vertical ??
    config.focus ??
    config.vertical ??
    process.env.KIRHA_FOCUS ??
    process.env.KIRHA_VERTICAL
  );
}

export function buildClient(opts: GlobalOptions): ResolvedContext {
  const apiKey = resolveApiKey(opts);
  if (!apiKey) {
    throw new CliError(
      "AUTH_REQUIRED",
      "No API key found. Run `kirha auth login --api-key <key>` or set KIRHA_API_KEY.",
    );
  }

  const focus = resolveFocus(opts);
  return { focus, client: new KirhaApi({ apiKey, focus }) };
}
