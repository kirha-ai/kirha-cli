import { KirhaApi } from "kirha";
import { readAuth } from "./auth.ts";
import { readConfig } from "./config.ts";
import { CliError } from "./errors.ts";

export interface GlobalOptions {
  apiKey?: string;
  vertical?: string;
}

export interface ResolvedContext {
  vertical?: string;
  client: KirhaApi;
}

export function resolveApiKey(opts: GlobalOptions, override?: string): string | null {
  return override ?? opts.apiKey ?? readAuth()?.apiKey ?? process.env.KIRHA_API_KEY ?? null;
}

export function resolveVertical(opts: GlobalOptions): string | undefined {
  return opts.vertical ?? readConfig().vertical ?? process.env.KIRHA_VERTICAL;
}

export function buildClient(opts: GlobalOptions): ResolvedContext {
  const apiKey = resolveApiKey(opts);
  if (!apiKey) {
    throw new CliError(
      "AUTH_REQUIRED",
      "No API key found. Run `kirha auth login --api-key <key>` or set KIRHA_API_KEY.",
    );
  }

  const vertical = resolveVertical(opts);
  return { vertical, client: new KirhaApi({ apiKey, vertical }) };
}
