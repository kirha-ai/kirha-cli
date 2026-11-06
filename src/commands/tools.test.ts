import { describe, expect, test } from "bun:test";
import type { Tool, ToolDetails, ToolsPage } from "kirha";
import { renderDetails, renderFooter, renderMatch, renderTable, wrap } from "./tools.ts";

function tool(partial: Partial<Tool> & Pick<Tool, "name" | "provider">): Tool {
  return {
    id: partial.name,
    description: "A tool",
    creditsPerCall: 0,
    related: false,
    relatedTo: [],
    ...partial,
  };
}

function page(tools: Tool[], extra: Partial<ToolsPage> = {}): ToolsPage {
  return { tools, total: tools.length, limit: tools.length, skip: 0, ...extra };
}

describe("renderTable", () => {
  const tools = [
    tool({ name: "pubmed_searchPubmed", provider: "pubmed", creditsPerCall: 1 }),
    tool({ name: "xverse_getSparkTokenHolders", provider: "xverse", creditsPerCall: 12 }),
  ];

  test("aligns columns and right-aligns credits", () => {
    const [header, first, second] = renderTable(tools, true, 100).split("\n");
    expect(header).toStartWith("NAME");
    expect(header).toContain("PROVIDER");
    expect(header).toContain("CREDITS");
    expect(header?.indexOf("PROVIDER")).toBe(first?.indexOf("pubmed ") ?? -1);
    expect(header?.indexOf("DESCRIPTION")).toBe(first?.indexOf("A tool") ?? -1);
    expect(second).toContain("  12  ");
  });

  test("drops the provider column when filtering by provider", () => {
    const lines = renderTable(tools, false, 100).split("\n");
    expect(lines[0]).not.toContain("PROVIDER");
    expect(lines[1]).not.toContain("pubmed  ");
  });

  test("truncates descriptions to the terminal width", () => {
    const long = [tool({ name: "a_b", provider: "a", description: "x".repeat(400) })];
    for (const line of renderTable(long, true, 60).split("\n")) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  test("keeps descriptions whole at unbounded width", () => {
    const long = [tool({ name: "a_b", provider: "a", description: "x".repeat(400) })];
    expect(renderTable(long, true, Number.POSITIVE_INFINITY)).toContain("x".repeat(400));
  });
});

describe("renderFooter", () => {
  const next = (n: number) => `kirha tools list --page ${n}`;

  test("points at the next page when rows remain", () => {
    const tools = Array.from({ length: 20 }, (_, i) => tool({ name: `p_t${i}`, provider: "p" }));
    expect(renderFooter(page(tools, { total: 416 }), tools, next)).toBe(
      "Showing 1-20 of 416 · next: kirha tools list --page 2",
    );
  });

  test("numbers the next page from skip", () => {
    const tools = Array.from({ length: 20 }, (_, i) => tool({ name: `p_t${i}`, provider: "p" }));
    expect(renderFooter(page(tools, { total: 416, skip: 40 }), tools, next)).toBe(
      "Showing 41-60 of 416 · next: kirha tools list --page 4",
    );
  });

  test("counts tools when everything fits", () => {
    const tools = [tool({ name: "pubmed_searchPubmed", provider: "pubmed" })];
    expect(renderFooter(page(tools), tools, next)).toBe(
      "1 tool · details: kirha tools get pubmed_searchPubmed",
    );
  });

  test("is empty with no rows", () => {
    expect(renderFooter(page([]), [], next)).toBe("");
  });
});

describe("renderMatch", () => {
  const ranked = tool({
    name: "xverse_getSparkTokenHolders",
    provider: "xverse",
    creditsPerCall: 2,
    description: "Holders of a Spark token",
  });
  const tools = [
    ranked,
    tool({
      name: "xverse_getTokenMetadata",
      provider: "xverse",
      creditsPerCall: 0,
      related: true,
      relatedTo: ["xverse_getSparkTokenHolders"],
    }),
  ];

  test("splits ranked from related and names the source", () => {
    const out = renderMatch(tools, 100);
    expect(out).toContain("Ranked");
    expect(out).toContain("Related — surfaced by the picks above");
    expect(out).toContain("← xverse_getSparkTokenHolders");
    expect(out).toContain("2 cr");
    expect(out).toContain("free");
  });

  test("names a source from another provider in full", () => {
    const crossed = tool({
      name: "rxnorm_getConceptProperties",
      provider: "rxnorm",
      related: true,
      relatedTo: ["openfda_searchDrugRecalls", "rxnorm_findDrugByName"],
    });
    expect(renderMatch([ranked, crossed], 100)).toContain(
      "← openfda_searchDrugRecalls, rxnorm_findDrugByName",
    );
  });

  test("keeps descriptions whole at unbounded width", () => {
    const long = tool({ name: "a_b", provider: "a", description: "x".repeat(400) });
    expect(renderMatch([long], Number.POSITIVE_INFINITY)).toContain("x".repeat(400));
    expect(renderMatch([long], 60)).not.toContain("x".repeat(400));
  });

  test("omits the related heading when nothing was expanded", () => {
    const out = renderMatch([ranked], 100);
    expect(out).toContain("Ranked");
    expect(out).not.toContain("Related");
  });
});

describe("renderDetails", () => {
  const details: ToolDetails = {
    ...tool({
      name: "pubmed_searchPubmed",
      provider: "pubmed",
      creditsPerCall: 1,
      description: "Search PubMed for scientific articles",
      inputSchema: { type: "object" },
    }),
    relatedTools: ["pubmed_lookupMeshTerms", "pubmed_fetchPubmedArticles"],
  };

  test("prints schemas as JSON and sibling costs", () => {
    const out = renderDetails(
      details,
      new Map([
        ["pubmed_lookupMeshTerms", 0],
        ["pubmed_fetchPubmedArticles", 2],
      ]),
      100,
    );
    expect(out).toContain("Cost      1 credit per call");
    expect(out).toContain('"type": "object"');
    expect(out).not.toContain("output_schema");
    expect(out).toContain("pubmed_lookupMeshTerms      free");
    expect(out).toContain("pubmed_fetchPubmedArticles  2 credits");
    expect(out).toContain("Run it: kirha tools run pubmed_searchPubmed");
  });

  test("leaves sibling costs out when the listing is missing them", () => {
    const out = renderDetails(details, new Map(), 100);
    expect(out).toContain("pubmed_lookupMeshTerms");
    expect(out).not.toContain("credits");
  });
});

test("wrap breaks on words without exceeding the width", () => {
  const lines = wrap("one two three four five six seven", 12);
  expect(lines.every((line) => line.length <= 12)).toBe(true);
  expect(lines.join(" ")).toBe("one two three four five six seven");
});
