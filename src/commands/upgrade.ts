import { createHash } from "node:crypto";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import pkg from "../../package.json" with { type: "json" };
import { CliError } from "../lib/errors.ts";
import { emit } from "../lib/output.ts";

const REPO = "kirha-ai/kirha-cli";
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const METADATA_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const TAG_PATTERN = /^v?\d+\.\d+\.\d+/;

type InstallMethod = "binary" | "npm";

interface UpgradeFlags {
  check?: boolean;
}

interface ReleaseAsset {
  tag: string;
  assetName: string;
}

function detectInstallMethod(): InstallMethod {
  const basename = process.execPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  return /^(node|nodejs|bun|bunx|deno)(\.exe)?$/.test(basename) ? "npm" : "binary";
}

function detectAssetName(): string | null {
  const os = process.platform;
  const arch = process.arch;
  if (os === "darwin" && arch === "arm64") return "kirha-darwin-arm64";
  if (os === "darwin" && arch === "x64") return "kirha-darwin-x64";
  if (os === "linux" && arch === "x64") return "kirha-linux-x64";
  if (os === "linux" && arch === "arm64") return "kirha-linux-arm64";
  return null;
}

function normalizeVersion(v: string): string {
  return v.startsWith("v") ? v.slice(1) : v;
}

function compareVersions(a: string, b: string): number {
  const pa = normalizeVersion(a).split(".").map(Number);
  const pb = normalizeVersion(b).split(".").map(Number);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new CliError("INTERNAL", `Cannot compare non-numeric version parts: '${a}' vs '${b}'`);
    }
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

async function fetchOk(url: string, timeoutMs: number): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
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

async function fetchLatestTag(): Promise<string> {
  const response = await fetchOk(RELEASES_API, METADATA_TIMEOUT_MS);
  const data = (await response.json()) as { tag_name?: string };
  if (!data.tag_name || !TAG_PATTERN.test(data.tag_name)) {
    throw new CliError(
      "INTERNAL",
      `GitHub release returned an unexpected tag_name: ${JSON.stringify(data.tag_name)}`,
    );
  }
  return data.tag_name;
}

function findChecksum(checksumsText: string, asset: string): string | null {
  for (const line of checksumsText.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const file = parts[1]?.replace(/^\*/, "");
    if (file === asset) return parts[0] ?? null;
  }
  return null;
}

async function downloadAndVerify({ tag, assetName }: ReleaseAsset): Promise<Buffer> {
  const baseUrl = `https://github.com/${REPO}/releases/download/${tag}`;

  const [checksumsText, binaryBuffer] = await Promise.all([
    fetchOk(`${baseUrl}/checksums.txt`, METADATA_TIMEOUT_MS).then((r) => r.text()),
    fetchOk(`${baseUrl}/${assetName}`, DOWNLOAD_TIMEOUT_MS).then(async (r) =>
      Buffer.from(await r.arrayBuffer()),
    ),
  ]);

  const expected = findChecksum(checksumsText, assetName);
  if (!expected) {
    throw new CliError("INTERNAL", `No checksum entry for ${assetName} in checksums.txt`);
  }

  const actual = createHash("sha256").update(binaryBuffer).digest("hex");
  if (actual !== expected) {
    throw new CliError(
      "INTERNAL",
      `Checksum mismatch for ${assetName}: expected ${expected}, got ${actual}`,
    );
  }

  return binaryBuffer;
}

function replaceBinary(targetPath: string, content: Buffer): void {
  const targetDir = dirname(targetPath);
  let stagingDir: string;
  try {
    stagingDir = mkdtempSync(join(targetDir, ".kirha-upgrade-"));
  } catch {
    stagingDir = mkdtempSync(join(tmpdir(), "kirha-upgrade-"));
  }

  const stagedPath = join(stagingDir, "kirha");
  try {
    writeFileSync(stagedPath, content, { mode: 0o755 });
    renameSync(stagedPath, targetPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    const detail =
      code === "EACCES" || code === "EPERM"
        ? `Cannot write to ${targetPath} (permission denied). Try re-running with the right permissions or reinstall.`
        : `Failed to replace ${targetPath}: ${(err as Error).message}`;
    throw new CliError("INTERNAL", detail);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

export function registerUpgrade(program: Command): void {
  program
    .command("upgrade")
    .description("Upgrade kirha to the latest version")
    .option("--check", "Only check for a newer version, don't install it")
    .action(async (flags: UpgradeFlags) => {
      const method = detectInstallMethod();
      const current = pkg.version;
      const latestTag = await fetchLatestTag();
      const latest = normalizeVersion(latestTag);
      const updateAvailable = compareVersions(current, latest) < 0;

      if (flags.check) {
        emit({ current, latest, updateAvailable, method });
        return;
      }

      if (!updateAvailable) {
        emit({
          ok: true,
          method,
          current,
          latest,
          message: `Already on the latest version (${current})`,
        });
        return;
      }

      if (method === "npm") {
        emit({
          ok: true,
          method,
          action: "manual",
          current,
          latest,
          instruction: "npm install -g @kirha/cli@latest",
        });
        return;
      }

      const assetName = detectAssetName();
      if (!assetName) {
        throw new CliError(
          "INTERNAL",
          `Unsupported platform for binary upgrade: ${process.platform}/${process.arch}`,
        );
      }

      const content = await downloadAndVerify({ tag: latestTag, assetName });
      replaceBinary(process.execPath, content);

      emit({
        ok: true,
        method,
        from: current,
        to: latest,
        path: process.execPath,
      });
    });
}
