import { describe, expect, it } from "vitest";
import { parseInline } from "../src/domain/inlineMarkdown";

describe("parseInline", () => {
  it("leaves plain text alone", () => {
    expect(parseInline("La puerta cruje.")).toEqual(["La puerta cruje."]);
  });

  it("parses bold, italic and both", () => {
    expect(parseInline("Ves a **Brena** que *susurra* algo ***terrible***.")).toEqual([
      "Ves a ",
      { kind: "strong", children: ["Brena"] },
      " que ",
      { kind: "em", children: ["susurra"] },
      " algo ",
      { kind: "strong", children: [{ kind: "em", children: ["terrible"] }] },
      ".",
    ]);
  });

  it("nests italic inside bold", () => {
    expect(parseInline("**un *gran* golpe**")).toEqual([
      { kind: "strong", children: ["un ", { kind: "em", children: ["gran"] }, " golpe"] },
    ]);
  });

  it("keeps asterisks that are not emphasis", () => {
    expect(parseInline("2 * 3 * 4")).toEqual(["2 * 3 * 4"]);
    expect(parseInline("**sin cerrar")).toEqual(["**sin cerrar"]);
  });

  it("shows an emphasis still arriving without its asterisks", () => {
    expect(parseInline("Ves a **Bre", true)).toEqual([
      "Ves a ",
      { kind: "strong", children: ["Bre"] },
    ]);
    expect(parseInline("Ves a *", true)).toEqual(["Ves a "]);
    expect(parseInline("Ves a **", true)).toEqual(["Ves a "]);
  });
});
