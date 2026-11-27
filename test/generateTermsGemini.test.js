import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeTermHistory, parseAndFilterTerms, resolveTermCount } from "../src/generateTermsGemini.js";

await describe("resolveTermCount", async () => {
  await it("uses maxSearches when positive and falls back to defaultTermCount when unlimited (0)", () => {
    assert.equal(resolveTermCount(20, 30), 20);
    assert.equal(resolveTermCount(0, 30), 30);
  });
});

await describe("parseAndFilterTerms", async () => {
  await it("parses valid JSON, trims terms, and filters internal and historical duplicates", () => {
    const raw = JSON.stringify([
      "  como fazer pão de queijo  ",
      "Como Fazer Pão de Queijo",
      "receita de bolo de cenoura",
      "praias do nordeste",
    ]);

    const result = parseAndFilterTerms(raw, ["PRAIAS DO NORDESTE"]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.terms, ["como fazer pão de queijo", "receita de bolo de cenoura"]);
    }
  });

  await it("rejects malformed JSON", () => {
    const result = parseAndFilterTerms("{not valid json");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Invalid JSON response/);
    }
  });

  await it("rejects empty arrays and empty strings", () => {
    assert.equal(parseAndFilterTerms("[]").ok, false);
    assert.equal(parseAndFilterTerms(JSON.stringify(["", "   "])).ok, false);
  });

  await it("fails when every returned term duplicates previous terms", () => {
    const result = parseAndFilterTerms(JSON.stringify(["termo antigo"]), ["Termo Antigo"]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /duplicates/i);
    }
  });
});

await describe("mergeTermHistory", async () => {
  await it("deduplicates case-insensitively, keeps most recent order, and enforces the cap", () => {
    const merged = mergeTermHistory(["alpha", "beta", "gamma"], ["BETA", "delta", "epsilon"], 4);
    assert.deepEqual(merged, ["gamma", "BETA", "delta", "epsilon"]);
  });

  await it("returns an empty array when limit is 0", () => {
    assert.deepEqual(mergeTermHistory(["alpha"], ["beta"], 0), []);
  });
});
