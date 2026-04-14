import type { Command } from "commander";
import { fetchOk, METADATA_TIMEOUT_MS } from "../lib/download.ts";

const DISCOVERY_BASE = "https://discovery.kirha.com";

async function fetchMdx(path: string): Promise<string> {
  const res = await fetchOk(`${DISCOVERY_BASE}${path}?cli=true`, METADATA_TIMEOUT_MS, {
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
    .description("Explore Kirha verticals, providers, and tools");

  discovery
    .command("home")
    .description("Show the discovery home page")
    .action(async () => {
      writeMarkdown(await fetchMdx("/home.mdx"));
    });

  const verticals = discovery.command("verticals").description("Browse Kirha verticals");

  verticals
    .command("list")
    .description("List available verticals")
    .action(async () => {
      writeMarkdown(await fetchMdx("/verticals/list.mdx"));
    });

  verticals
    .command("get <slug>")
    .description("Show details for a specific vertical")
    .action(async (slug: string) => {
      writeMarkdown(await fetchMdx(`/verticals/${encodeURIComponent(slug)}.mdx`));
    });

  const providers = discovery.command("providers").description("Browse Kirha providers");

  providers
    .command("list")
    .description("List available providers")
    .action(async () => {
      writeMarkdown(await fetchMdx("/providers/list.mdx"));
    });

  providers
    .command("get <slug>")
    .description("Show details for a specific provider")
    .action(async (slug: string) => {
      writeMarkdown(await fetchMdx(`/providers/${encodeURIComponent(slug)}.mdx`));
    });
}
