import { describe, expect, it } from "vitest";
import { buildTurnPrompt, DM_SYSTEM_PROMPT } from "../src/engine/dmPrompt";
import { newGame } from "./helpers";

describe("DM_SYSTEM_PROMPT", () => {
  it("tells the DM how to mark what each NPC says", () => {
    expect(DM_SYSTEM_PROMPT).toContain("[[Nombre]]");
  });

  it("asks for each NPC's voice", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"voice"');
  });

  it("asks for each NPC's portrait", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"portrait"');
  });

  it("asks for a portrait for NPCs that still have none", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"portrait": null y le queda');
  });
});

describe("buildTurnPrompt", () => {
  it("shows the DM how each NPC talks", () => {
    const game = newGame();
    const npcs = [
      { name: "Berta", description: "Posadera", attitude: "neutral" as const, present: true, voice: "Seca, frases cortas", portrait: null },
    ];
    expect(buildTurnPrompt({ ...game, npcs }, { type: "start" }, 6)).toContain("Seca, frases cortas");
  });
});

describe("NPC names", () => {
  it("asks for Spanish names, never the portrait archetype", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"Tabernero"');
    expect(DM_SYSTEM_PROMPT).toContain('"innkeeper-male"');
  });
});

describe("portraits", () => {
  it("tells the DM what each archetype shows", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"guard-male" / "guard-female": con armadura');
    expect(DM_SYSTEM_PROMPT).toContain("una vendedora no es una guardia");
  });
});

describe("difficulty", () => {
  it("gives the DM the DC scale instead of leaving it to guess", () => {
    expect(DM_SYSTEM_PROMPT).toContain("muy fácil 5, fácil 10, media 15, difícil 20, muy difícil 25, casi imposible 30");
  });
});
