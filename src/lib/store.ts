import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CliError } from "./errors.ts";

export function readJson<T>(path: string): T | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new CliError("CONFIG_INVALID", `Corrupted file at ${path}. Remove or fix it manually.`);
  }
}

export function writeJson(path: string, data: unknown, mode = 0o600): void {
  ensureDir(dirname(path), 0o700);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode });
  chmodSync(path, mode);
}

export function ensureDir(path: string, mode = 0o755): void {
  mkdirSync(path, { recursive: true, mode });
}

export function removeFile(path: string): void {
  rmSync(path, { force: true });
}
