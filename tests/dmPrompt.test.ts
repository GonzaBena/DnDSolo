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
});

describe("buildTurnPrompt", () => {
  it("shows the DM how each NPC talks", () => {
    const game = newGame();
    const npcs = [
      { name: "Berta", description: "Posadera", attitude: "neutral" as const, present: true, voice: "Seca, frases cortas" },
    ];
    expect(buildTurnPrompt({ ...game, npcs }, { type: "start" }, 6)).toContain("Seca, frases cortas");
  });
});
