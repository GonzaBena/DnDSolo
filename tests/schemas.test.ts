import { describe, expect, it } from "vitest";
import { dmResponseJsonSchema, parseDMResponse } from "../src/domain/schemas";
import { extractPartialNarration } from "../src/engine/narrationStream";
import { reply } from "./helpers";

describe("parseDMResponse", () => {
  it("accepts a valid response", () => {
    const parsed = parseDMResponse(
      JSON.stringify(reply({ rollRequest: { die: "d20", reason: "Sigilo", difficulty: 12 } })),
    );
    expect(parsed.ok).toBe(true);
  });

  it("rejects non-JSON, missing fields and unknown dice", () => {
    expect(parseDMResponse("not json").ok).toBe(false);
    expect(parseDMResponse(JSON.stringify({ narration: "Hola" })).ok).toBe(false);
    const badDie = { ...reply(), rollRequest: { die: "d7", reason: "x", difficulty: null } };
    expect(parseDMResponse(JSON.stringify(badDie)).ok).toBe(false);
  });

  it("rejects state changes of an unknown type", () => {
    const bad = { ...reply(), stateChanges: [{ type: "teleport", to: "Luna" }] };
    expect(parseDMResponse(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("dmResponseJsonSchema", () => {
  const text = JSON.stringify(dmResponseJsonSchema);

  it("only uses keywords the provider documents", () => {
    expect(text).not.toContain('"const"');
    expect(text).not.toContain("$schema");
  });

  it("asks for narration first so it can be streamed", () => {
    const schema = dmResponseJsonSchema as { propertyOrdering: string[] };
    expect(schema.propertyOrdering[0]).toBe("narration");
  });
});

describe("extractPartialNarration", () => {
  it("returns the text received so far", () => {
    expect(extractPartialNarration('{"narration": "Entrás a la cue')).toBe("Entrás a la cue");
  });

  it("returns nothing before the field starts", () => {
    expect(extractPartialNarration('{"narr')).toBe("");
  });

  it("stops at the closing quote and decodes escapes", () => {
    const raw = '{"narration":"Dice: \\"alto\\".\\nSeguís \\u00e1gil.","rollRequest":null';
    expect(extractPartialNarration(raw)).toBe('Dice: "alto".\nSeguís ágil.');
  });

  it("waits when an escape sequence is cut in half", () => {
    expect(extractPartialNarration('{"narration":"Hola\\')).toBe("Hola");
    expect(extractPartialNarration('{"narration":"Hola\\u00')).toBe("Hola");
  });
});
