import type { Command } from "commander";
import { fetchOk, METADATA_TIMEOUT_MS } from "../lib/download.ts";
import { positiveInt } from "./tools.ts";

const CATALOGUE_BASE = "https://kirha.com";

export function catalogueUrl(path: string, page?: number): string {
  const url = new URL(path, CATALOGUE_BASE);
  url.searchParams.set("cli", "1");
  if (page !== undefined) url.searchParams.set("page", String(page));
  return url.toString();
}

async function fetchMarkdown(path: string, page?: number): Promise<string> {
  const res = await fetchOk(catalogueUrl(path, page), METADATA_TIMEOUT_MS, {
    headers: { Accept: "text/markdown, text/plain, */*" },
  });
  return await res.text();
}

function writeMarkdown(body: string): void {
  process.stdout.write(body.endsWith("\n") ? body : `${body}\n`);
}

export function registerDiscovery(program: Command): void {
  const discovery = program
    .command("discovery")
    .description("Explore KIRHA verticals, providers, and tools");

  discovery
    .command("home")
    .description("Show the catalogue overview")
    .action(async () => {
      writeMarkdown(await fetchMarkdown("/providers.md"));
    });

  const verticals = discovery.command("verticals").description("Browse KIRHA verticals");

  verticals
    .command("list")
    .description("List available verticals")
    .action(async () => {
      writeMarkdown(await fetchMarkdown("/verticals.md"));
    });

  verticals
    .command("get <slug>")
    .description("Show details for a specific vertical")
    .action(async (slug: string) => {
      writeMarkdown(await fetchMarkdown(`/verticals/${encodeURIComponent(slug)}.md`));
    });

  const providers = discovery.command("providers").description("Browse KIRHA providers");

  providers
    .command("list")
    .description("List available providers, 50 per page")
    .option("--page <n>", "Page to fetch", positiveInt("page"))
    .action(async (flags: { page?: number }) => {
      writeMarkdown(await fetchMarkdown("/providers.md", flags.page));
    });

  providers
    .command("get <slug>")
    .description("Show details for a specific provider")
    .action(async (slug: string) => {
      writeMarkdown(await fetchMarkdown(`/providers/${encodeURIComponent(slug)}.md`));
    });
}
