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

export function buildClient(opts: GlobalOptions): ResolvedContext {
  const apiKey = opts.apiKey ?? readAuth()?.apiKey ?? process.env.KIRHA_API_KEY;
  if (!apiKey) {
    throw new CliError(
      "AUTH_REQUIRED",
      "No API key found. Run `kirha auth login --api-key <key>` or set KIRHA_API_KEY.",
    );
  }

  const vertical = opts.vertical ?? readConfig().vertical ?? process.env.KIRHA_VERTICAL;

  return { vertical, client: new KirhaApi({ apiKey, vertical }) };
}
