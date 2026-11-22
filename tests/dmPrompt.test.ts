import { describe, expect, it } from "vitest";
import { TURN_EVENTS } from "../src/domain/types";
import { buildTurnPrompt, DM_SYSTEM_PROMPT, stateForModel } from "../src/engine/dmPrompt";
import type { GameState } from "../src/domain/types";
import { newGame } from "./helpers";

describe("DM_SYSTEM_PROMPT", () => {
  it("distinguishes damage taken from damage dealt", () => {
    const line = DM_SYSTEM_PROMPT.split("\n").find((l) => l.includes("solo de esta lista:"));
    const tags = (line ?? "")
      .split("solo de esta lista:")[1]!
      .replace(/\([^)]*\)/g, "")
      .replace(/\.$/, "")
      .split(",")
      .map((t) => t.trim());
    expect(tags).toEqual([...TURN_EVENTS]);
  });
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
  it("adds the roll limit block right before the current turn only when rolls are not allowed", () => {
    const game = newGame();
    const blocked = buildTurnPrompt(game, { type: "start" }, 6, { enemyRollsAllowed: false });
    expect(blocked).toContain(
      "LÍMITE DE TIRADAS\nEn esta respuesta no pidas tiradas de enemigos: resolvé lo que quede con las tiradas que ya tenés y devolvele el turno al jugador.\n\nTURNO ACTUAL",
    );
    expect(buildTurnPrompt(game, { type: "start" }, 6, { enemyRollsAllowed: true })).not.toContain("LÍMITE");
    expect(buildTurnPrompt(game, { type: "start" }, 6)).not.toContain("LÍMITE");
  });

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

describe("combat rules", () => {
  it("are sent only while in combat", () => {
    const game = newGame();
    const calm = buildTurnPrompt(game, { type: "start" }, 6);
    const fight = buildTurnPrompt({ ...game, scene: { inCombat: true, turnOf: null } }, { type: "start" }, 6);
    expect(calm).not.toContain("REGLAS DE COMBATE\n");
    expect(fight).toContain("REGLAS DE COMBATE\n");
  });

  it("resolve an attack against the target's AC, then ask for damage", () => {
    const fight = buildTurnPrompt({ ...newGame(), scene: { inCombat: true, turnOf: null } }, { type: "start" }, 6);
    expect(fight).toContain("Clase de Armadura (CA) del objetivo");
    expect(fight).toContain("pedile la tirada de daño");
  });

  it("tell the DM that attacks use AC even outside the combat block", () => {
    expect(DM_SYSTEM_PROMPT).toContain('Un ataque no usa esa escala');
  });
});

describe("advantage in the turn prompt", () => {
  it("spells out both d20 of the player's roll", () => {
    const prompt = buildTurnPrompt(
      newGame(),
      {
        type: "action",
        text: "Ataco",
        roll: { die: "d20", count: 1, value: 17, modifier: 3, mode: "advantage", rolls: [12, 17] },
      },
      6,
    );
    expect(prompt).toContain("1d20 con ventaja (12 y 17, queda 17): 17 + 3 = 20");
  });

  it("tells the DM the requested player roll has disadvantage", () => {
    const state = {
      ...newGame(),
      pendingPlayerRoll: { die: "d20" as const, count: 1, reason: "Sigilo", difficulty: 12, mode: "disadvantage" as const },
    };
    const prompt = buildTurnPrompt(state, { type: "action", text: "17" }, 6);
    expect(prompt).toMatch(/TIRADA PEDIDA AL JUGADOR\n.*con desventaja/);
  });
});

describe("advantage", () => {
  it("is asked for with a mode, never as two dice", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"mode"');
    const fight = buildTurnPrompt({ ...newGame(), scene: { inCombat: true, turnOf: null } }, { type: "start" }, 6);
    expect(fight).toContain('"mode": "advantage"');
    expect(fight).not.toContain('"count": 2');
  });
});

describe("stateForModel", () => {
  const present = { name: "Berta", description: "Posadera", attitude: "friendly" as const, present: true, voice: "Seca", portrait: "innkeeper-female" };
  const absent = { name: "Corvo", description: "Mercader", attitude: "neutral" as const, present: false, voice: "Suave", portrait: "merchant-male" };

  it("sends present NPCs in full and absent NPCs as name and attitude only", () => {
    const state = stateForModel({ ...newGame(), npcs: [present, absent] }) as { npcs: unknown[] };
    expect(state.npcs).toEqual([present, { name: "Corvo", attitude: "neutral", present: false }]);
  });

  it("leaves out story items that are gone", () => {
    const storyItems = [
      { name: "Llave", description: "Oxidada", location: "Sótano", status: "available" as const },
      { name: "Daga", description: "Corta", location: "", status: "taken" as const },
      { name: "Mapa", description: "Quemado", location: "", status: "gone" as const },
    ];
    const state = stateForModel({ ...newGame(), storyItems }) as { storyItems: unknown[] };
    expect(state.storyItems).toEqual(storyItems.slice(0, 2));
  });

  it("shrinks closed quests to title and status and keeps active ones whole", () => {
    const quests = [
      { title: "A", description: "Larga", status: "active" as const },
      { title: "B", description: "Larga", status: "completed" as const },
      { title: "C", description: "Larga", status: "failed" as const },
    ];
    const state = stateForModel({ ...newGame(), quests }) as { quests: unknown[] };
    expect(state.quests).toEqual([quests[0], { title: "B", status: "completed" }, { title: "C", status: "failed" }]);
  });

  it("keeps players, location and scene as they are", () => {
    const game = newGame();
    expect(stateForModel(game)).toMatchObject({ players: game.players, location: game.location, scene: game.scene });
  });
});

describe("compact prompt", () => {
  const long = (label: string, i: number) => `${label} ${i}: ` + "una descripción con bastante detalle sobre quién o qué es. ".repeat(3);
  const big: GameState = {
    ...newGame(),
    npcs: Array.from({ length: 30 }, (_, i) => ({
      name: `Aldeano ${i}`, description: long("Aldeano", i), attitude: "neutral" as const, present: false, voice: "Habla pausado, dice 'bueno' seguido", portrait: "guard-male",
    })),
    storyItems: Array.from({ length: 30 }, (_, i) => ({
      name: `Objeto ${i}`, description: long("Objeto", i), location: "Taberna", status: "gone" as const,
    })),
  };

  it("has no indentation in the state", () => {
    expect(buildTurnPrompt(big, { type: "start" }, 6)).not.toContain('\n  "');
  });

  it("makes the ESTADO section at least 40% shorter than the old indented serializer", () => {
    // Baseline: the old serializer, copied here, over the same full fields.
    const old = JSON.stringify(
      { players: big.players, location: big.location, npcs: big.npcs, scene: big.scene, quests: big.quests, storyItems: big.storyItems },
      null,
      2,
    );
    const section = buildTurnPrompt(big, { type: "start" }, 6).split("\n\nREGLAS DE LOS PERSONAJES")[0]!;
    expect(section.length).toBeLessThanOrEqual(old.length * 0.6);
  });

  it("tells the DM how absent NPCs come back", () => {
    expect(DM_SYSTEM_PROMPT).toContain("Los NPCs ausentes figuran solo con nombre y actitud");
    expect(DM_SYSTEM_PROMPT).toContain("mandala vacía");
  });
});
