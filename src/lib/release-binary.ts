import { existsSync, lstatSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertChecksum, DOWNLOAD_TIMEOUT_MS, fetchOk, METADATA_TIMEOUT_MS } from "./download.ts";
import { CliError } from "./errors.ts";
import { cacheDir } from "./paths.ts";
import { ensureDir } from "./store.ts";

export interface ReleaseBinarySpec {
  toolName: string;
  repo: string;
  version: string;
  assetName: string;
}

export async function ensureReleaseBinary(spec: ReleaseBinarySpec): Promise<string> {
  const dir = join(cacheDir(), `${spec.toolName}-${spec.version}`);
  const binaryPath = join(dir, spec.assetName);

  if (existsSync(binaryPath)) {
    assertNotSymlink(binaryPath);
    return binaryPath;
  }

  ensureDir(dir);
  assertNotSymlink(dir);

  const baseUrl = `https://github.com/${spec.repo}/releases/download/${spec.version}`;
  const binaryUrl = `${baseUrl}/${spec.assetName}`;
  const checksumUrl = `${binaryUrl}.sha256`;

  const [checksumText, binaryBuffer] = await Promise.all([
    fetchOk(checksumUrl, METADATA_TIMEOUT_MS).then((r) => r.text()),
    fetchOk(binaryUrl, DOWNLOAD_TIMEOUT_MS).then(async (r) => Buffer.from(await r.arrayBuffer())),
  ]);

  const expected = parseSha256File(checksumText, spec.assetName);
  if (!expected) {
    throw new CliError(
      "INTERNAL",
      `Checksum file at ${checksumUrl} does not contain an entry for ${spec.assetName}`,
    );
  }
  assertChecksum(binaryBuffer, expected, spec.assetName);

  const stagingDir = mkdtempSync(join(dir, ".staging-"));
  try {
    const staged = join(stagingDir, spec.assetName);
    writeFileSync(staged, binaryBuffer, { mode: 0o755 });
    renameSync(staged, binaryPath);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  return binaryPath;
}

function assertNotSymlink(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    throw new CliError(
      "INTERNAL",
      `Refusing to use symlinked cache path ${path}. Remove it and retry.`,
    );
  }
}

function parseSha256File(text: string, expectedAssetName: string): string | null {
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const hex = parts[0];
    const file = parts[1]?.replace(/^\*/, "");
    if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) continue;
    if (file === undefined || file === expectedAssetName) return hex;
  }
  return null;
}
