import { describe, expect, it } from "vitest";
import { dmResponseJsonSchema, parseDMResponse } from "../src/domain/schemas";
import { TURN_EVENTS } from "../src/domain/types";
import { extractPartialNarration } from "../src/engine/narrationStream";
import { reply } from "./helpers";

describe("parseDMResponse", () => {
  it("accepts a valid response", () => {
    const parsed = parseDMResponse(
      JSON.stringify(
        reply({
          playerRoll: { die: "d20", count: 1, reason: "Sigilo", difficulty: 12, mode: "normal" },
          enemyRolls: [{ die: "d6", count: 2, modifier: 1, reason: "Daño", mode: "normal" }],
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
      playerRoll: { die: "d7", count: 1, reason: "x", difficulty: null, mode: "normal" },
    };
    expect(parseDMResponse(JSON.stringify(badDie)).ok).toBe(false);
  });

  it("requires a roll mode on the player's roll request", () => {
    const request = { die: "d20", count: 1, reason: "Sigilo", difficulty: 12 } as const;
    expect(parseDMResponse(JSON.stringify(reply({ playerRoll: request as never }))).ok).toBe(false);
    const withMode = reply({ playerRoll: { ...request, mode: "advantage" } });
    expect(parseDMResponse(JSON.stringify(withMode)).ok).toBe(true);
  });

  it("rejects state changes of an unknown type", () => {
    const bad = { ...reply(), stateChanges: [{ type: "teleport", to: "Luna" }] };
    expect(parseDMResponse(JSON.stringify(bad)).ok).toBe(false);
  });

  it("no longer lets the model change the player's HP", () => {
    const bad = { ...reply(), stateChanges: [{ type: "hp", playerId: "p", delta: -3 }] };
    expect(parseDMResponse(JSON.stringify(bad)).ok).toBe(false);
  });

  it("accepts subclass changes with a subclass id", () => {
    const withSubclass = (change: object) => JSON.stringify({ ...reply(), stateChanges: [{ type: "subclass", playerId: "p", ...change }] });
    const ok = parseDMResponse(withSubclass({ subclassId: "thief" }));
    expect(ok.ok && ok.response.stateChanges[0]).toEqual({ type: "subclass", playerId: "p", subclassId: "thief" });
    expect(parseDMResponse(withSubclass({ subclassId: "" })).ok).toBe(false);
    expect(parseDMResponse(withSubclass({})).ok).toBe(false);
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
    const bad = { ...reply(), enemyRolls: [{ die: "d6", count: 500, modifier: 0, reason: "x", mode: "normal" }] };
    expect(parseDMResponse(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("event tags", () => {
  it("drops unknown event tags instead of rejecting the reply", () => {
    const parsed = parseDMResponse(JSON.stringify({ ...reply(), events: ["damage_taken", "explosion", "damage"] }));
    expect(parsed.ok && parsed.response.events).toEqual(["damage_taken"]);
  });
  it("yields an empty list when every tag is unknown", () => {
    const parsed = parseDMResponse(JSON.stringify({ ...reply(), events: ["foo"] }));
    expect(parsed.ok && parsed.response.events).toEqual([]);
  });
  it("still rejects events that are not an array", () => {
    expect(parseDMResponse(JSON.stringify({ ...reply(), events: "damage_taken" })).ok).toBe(false);
  });
});

describe("dmResponseJsonSchema", () => {
  const text = JSON.stringify(dmResponseJsonSchema);
  it("offers the model only the known tags", () => {
    const schema = dmResponseJsonSchema as { properties: { events: { items: { enum: string[] } } } };
    const tags = schema.properties.events.items.enum;
    expect(tags).toEqual([...TURN_EVENTS]);
    expect(tags).not.toContain("damage");
  });

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

describe("parseDMResponse count with advantage", () => {
  function parse(body: object) {
    const parsed = parseDMResponse(JSON.stringify({ ...reply(), ...body }));
    if (!parsed.ok) throw new Error(parsed.reason);
    return parsed.response;
  }

  it("forces count 1 on a player roll with advantage", () => {
    const response = parse({
      playerRoll: { die: "d20", count: 2, reason: "x", difficulty: 12, mode: "advantage" },
    });
    expect(response.playerRoll?.count).toBe(1);
  });

  it("forces count 1 on an enemy roll with disadvantage", () => {
    const response = parse({
      enemyRolls: [{ die: "d20", count: 2, modifier: 1, reason: "x", mode: "disadvantage" }],
    });
    expect(response.enemyRolls[0]?.count).toBe(1);
  });

  it("leaves a normal multi-dice roll alone", () => {
    const response = parse({
      playerRoll: { die: "d6", count: 3, reason: "x", difficulty: null, mode: "normal" },
      enemyRolls: [{ die: "d6", count: 3, modifier: 0, reason: "x", mode: "normal" }],
    });
    expect(response.playerRoll?.count).toBe(3);
    expect(response.enemyRolls[0]?.count).toBe(3);
  });
});

describe("hp state change", () => {
  const parse = (change: unknown) =>
    parseDMResponse(JSON.stringify(reply({ stateChanges: [change as never] })));
  it("accepts a non-zero integer delta", () => {
    expect(parse({ type: "hp", target: "Lira", delta: -4 }).ok).toBe(true);
  });
  it("rejects a zero or fractional delta", () => {
    expect(parse({ type: "hp", target: "Lira", delta: 0 }).ok).toBe(false);
    expect(parse({ type: "hp", target: "Lira", delta: 1.5 }).ok).toBe(false);
  });
  it("rejects a missing or empty target", () => {
    expect(parse({ type: "hp", delta: -4 }).ok).toBe(false);
    expect(parse({ type: "hp", target: "", delta: -4 }).ok).toBe(false);
  });
});

describe("suggestions", () => {
  it("allows up to three short ones", () => {
    const four = JSON.stringify({ ...reply(), suggestions: ["Corro", "Me escondo", "Grito", "Ataco"] });
    expect(parseDMResponse(four).ok).toBe(false);
    const long = JSON.stringify({ ...reply(), suggestions: ["x".repeat(61)] });
    expect(parseDMResponse(long).ok).toBe(false);
    const three = JSON.stringify({ ...reply(), suggestions: ["Corro", "Me escondo", "Grito"] });
    expect(parseDMResponse(three).ok).toBe(true);
  });

  it("keeps narration first in the provider schema", () => {
    const ordering = (dmResponseJsonSchema as { propertyOrdering: string[] }).propertyOrdering;
    expect(ordering[0]).toBe("narration");
    expect(ordering).toContain("suggestions");
  });
});
