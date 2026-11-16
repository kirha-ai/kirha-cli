import { expect, test } from "bun:test";
import { catalogueUrl } from "./discovery.ts";

test("catalogueUrl targets kirha.com in CLI mode", () => {
  expect(catalogueUrl("/verticals.md")).toBe("https://kirha.com/verticals.md?cli=1");
  expect(catalogueUrl("/providers/apollo.md")).toBe("https://kirha.com/providers/apollo.md?cli=1");
});

test("catalogueUrl adds the page when one is asked for", () => {
  expect(catalogueUrl("/providers.md", 2)).toBe("https://kirha.com/providers.md?cli=1&page=2");
});
