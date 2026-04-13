import { createHash } from "node:crypto";
import { CliError } from "./errors.ts";

export const METADATA_TIMEOUT_MS = 10_000;
export const DOWNLOAD_TIMEOUT_MS = 120_000;

export async function fetchOk(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const message = (err as Error).message || String(err);
    throw new CliError("NETWORK", `Failed to reach ${url}: ${message}`);
  }
  if (!response.ok) {
    throw new CliError("NETWORK", `HTTP ${response.status} from ${url}`);
  }
  return response;
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function assertChecksum(buf: Buffer, expected: string, label: string): void {
  const actual = sha256Hex(buf);
  if (actual !== expected) {
    throw new CliError(
      "INTERNAL",
      `Checksum mismatch for ${label}: expected ${expected}, got ${actual}`,
    );
  }
}
