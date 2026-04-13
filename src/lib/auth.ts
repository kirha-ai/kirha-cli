import { authFile } from "./paths.ts";
import { readJson, removeFile, writeJson } from "./store.ts";

export interface AuthRecord {
  apiKey: string;
}

export function readAuth(): AuthRecord | null {
  return readJson<AuthRecord>(authFile());
}

export function writeAuth(record: AuthRecord): void {
  writeJson(authFile(), record, 0o600);
}

export function clearAuth(): void {
  removeFile(authFile());
}
