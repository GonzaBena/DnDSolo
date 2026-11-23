import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INDEXED_PATHS } from "../src/pages/sitemap.xml";

const pageFile = (path: string) => `src/pages/${path === "/" ? "index" : path.slice(1)}.astro`;

describe("sitemap", () => {
  it("lists only pages that exist and are not marked noindex", () => {
    for (const path of INDEXED_PATHS) {
      const file = pageFile(path);
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\bnoindex\b/);
    }
  });
});
