import { describe, expect, it } from "vitest";
import { normalizeInternalPageLinks } from "@/lib/page-discovery";

describe("internal page discovery normalization", () => {
  it("includes the start page and deduplicates same-origin links and fragments", () => {
    expect(normalizeInternalPageLinks("https://example.com/", [
      "https://example.com/about#team",
      "/about",
      "https://example.com/contact",
    ])).toEqual([
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/contact",
    ]);
  });

  it("drops external, unsafe, malformed and over-limit links", () => {
    expect(normalizeInternalPageLinks("https://example.com/", [
      "https://external.test/",
      "javascript:alert(1)",
      "http://127.0.0.1/admin",
      "not a url",
      "/one",
      "/two",
    ], 2)).toEqual(["https://example.com/", "https://example.com/one"]);
  });
});
