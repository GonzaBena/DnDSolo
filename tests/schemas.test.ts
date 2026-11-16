import { describe, expect, it } from "vitest";
import { dmResponseJsonSchema, parseDMResponse } from "../src/domain/schemas";
import { extractPartialNarration } from "../src/engine/narrationStream";
import { reply } from "./helpers";

describe("parseDMResponse", () => {
  it("accepts a valid response", () => {
    const parsed = parseDMResponse(
      JSON.stringify(
        reply({
          playerRoll: { die: "d20", count: 1, reason: "Sigilo", difficulty: 12 },
          enemyRolls: [{ die: "d6", count: 2, modifier: 1, reason: "Daño" }],
        }),
      ),
    );
    expect(parsed.ok).toBe(true);
  });

  it("rejects non-JSON, missing fields and unknown dice", () => {
    expect(parseDMResponse("not json").ok).toBe(false);
    expect(parseDMResponse(JSON.stringify({ narration: "Hola" })).ok).toBe(false);
    const badDie = {
      ...reply(),
      playerRoll: { die: "d7", count: 1, reason: "x", difficulty: null },
    };
    expect(parseDMResponse(JSON.stringify(badDie)).ok).toBe(false);
  });

  it("rejects state changes of an unknown type", () => {
    const bad = { ...reply(), stateChanges: [{ type: "teleport", to: "Luna" }] };
    expect(parseDMResponse(JSON.stringify(bad)).ok).toBe(false);
  });

  it("no longer lets the model change the player's HP", () => {
    const bad = { ...reply(), stateChanges: [{ type: "hp", playerId: "p", delta: -3 }] };
    expect(parseDMResponse(JSON.stringify(bad)).ok).toBe(false);
  });

  it("accepts level changes from 1 to 20 only", () => {
    const withLevel = (level: number) =>
      JSON.stringify({ ...reply(), stateChanges: [{ type: "level", playerId: "p", level }] });
    expect(parseDMResponse(withLevel(4)).ok).toBe(true);
    expect(parseDMResponse(withLevel(20)).ok).toBe(true);
    expect(parseDMResponse(withLevel(21)).ok).toBe(false);
    expect(parseDMResponse(withLevel(0)).ok).toBe(false);
  });

  it("rejects absurd dice counts", () => {
    const bad = { ...reply(), enemyRolls: [{ die: "d6", count: 500, modifier: 0, reason: "x" }] };
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
    const raw = '{"narration":"Dice: \\"alto\\".\\nSeguís \\u00e1gil.","playerRoll":null';
    expect(extractPartialNarration(raw)).toBe('Dice: "alto".\nSeguís ágil.');
  });

  it("waits when an escape sequence is cut in half", () => {
    expect(extractPartialNarration('{"narration":"Hola\\')).toBe("Hola");
    expect(extractPartialNarration('{"narration":"Hola\\u00')).toBe("Hola");
  });
});
