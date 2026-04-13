import { CliError, EXIT_CODES, formatError } from "./errors.ts";

const SECRET_FIELDS = new Set(["apiService"]);

function secretReplacer(key: string, value: unknown): unknown {
  return SECRET_FIELDS.has(key) ? undefined : value;
}

export function emit(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, secretReplacer)}\n`);
}

export function fail(err: unknown): never {
  const formatted = formatError(err);
  process.stderr.write(`${JSON.stringify({ error: formatted })}\n`);
  process.exit(EXIT_CODES[formatted.code]);
}

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

export async function resolveQuery(arg: string | undefined): Promise<string> {
  if (arg && arg !== "-") return arg;
  const stdin = await readStdin();
  if (!stdin) {
    throw new CliError("USAGE", "Query is required (pass as argument or pipe via stdin)");
  }
  return stdin;
}

export function parseJsonArg(input: string, field: string): unknown {
  try {
    return JSON.parse(input);
  } catch (err) {
    throw new CliError("USAGE", `Invalid JSON for --${field}: ${(err as Error).message}`);
  }
}
