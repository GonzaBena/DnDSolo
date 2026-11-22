import { describe, expect, it } from "vitest";
import { TURN_EVENTS } from "../src/domain/types";
import { buildTurnPrompt, describeInput, DM_SYSTEM_PROMPT, stateForModel } from "../src/engine/dmPrompt";
import { COMBAT_RULES } from "../src/engine/combatRules";
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
      { name: "Berta", description: "Posadera", attitude: "neutral" as const, present: true, voice: "Seca, frases cortas", portrait: null, hp: null, maxHp: null },
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
    const fight = buildTurnPrompt({ ...game, scene: { inCombat: true, turnOf: null, order: [] } }, { type: "start" }, 6);
    expect(calm).not.toContain("REGLAS DE COMBATE\n");
    expect(fight).toContain("REGLAS DE COMBATE\n");
  });

  it("resolve an attack against the target's AC, then ask for damage", () => {
    const fight = buildTurnPrompt({ ...newGame(), scene: { inCombat: true, turnOf: null, order: [] } }, { type: "start" }, 6);
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
    const fight = buildTurnPrompt({ ...newGame(), scene: { inCombat: true, turnOf: null, order: [] } }, { type: "start" }, 6);
    expect(fight).toContain('"mode": "advantage"');
    expect(fight).not.toContain('"count": 2');
  });
});

describe("stateForModel", () => {
  const present = { name: "Berta", description: "Posadera", attitude: "friendly" as const, present: true, voice: "Seca", portrait: "innkeeper-female", hp: null, maxHp: null };
  const absent = { name: "Corvo", description: "Mercader", attitude: "neutral" as const, present: false, voice: "Suave", portrait: "merchant-male", hp: null, maxHp: null };

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
      name: `Aldeano ${i}`, description: long("Aldeano", i), attitude: "neutral" as const, present: false, voice: "Habla pausado, dice 'bueno' seguido", portrait: "guard-male", hp: null, maxHp: null,
    })),
    storyItems: Array.from({ length: 30 }, (_, i) => ({
      name: `Objeto ${i}`, description: long("Objeto", i), location: "Taberna", status: "gone" as const,
    })),
  };

  it("has no indentation in the state", () => {
    const prompt = buildTurnPrompt(big, { type: "start" }, 6);
    const section = prompt.slice("ESTADO\n".length, prompt.indexOf("\n\nREGLAS DE LOS PERSONAJES"));
    expect(prompt.startsWith("ESTADO\n")).toBe(true);
    expect(section.length).toBeGreaterThan(0);
    expect(section).not.toContain('\n  "');
    expect(section).not.toContain("\n");
  });

  it("does not claim the ESTADO lists gone items, but still asks for the gone change", () => {
    const line = DM_SYSTEM_PROMPT.split("\n").find((l) => l.includes('"storyItems" del ESTADO'))!;
    expect(line).not.toMatch(/"gone"/);
    expect(DM_SYSTEM_PROMPT).toContain('"item" con "status": "gone"');
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

  it("no longer says the DM lacks the character sheet or an hp change", () => {
    expect(DM_SYSTEM_PROMPT).not.toContain("No tenés su hoja de personaje");
    expect(DM_SYSTEM_PROMPT).not.toContain("No hay cambio de estado para eso");
  });

  it("asks for any stats field that is null or empty, and no longer claims the inventory is only story items", () => {
    expect(DM_SYSTEM_PROMPT).toContain('un dato de "stats" es null o está vacío (como "spellSaveDc" o "attacks")');
    expect(DM_SYSTEM_PROMPT).toContain("arranca con el equipo inicial del personaje");
    expect(DM_SYSTEM_PROMPT).not.toContain("son solo los objetos que entregaste vos");
  });

  it("says the stats speed is in feet while distances are narrated in metres", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"speed" está en pies (30 pies = 9 m)');
    expect(DM_SYSTEM_PROMPT).toContain("siempre narrás las distancias en metros");
  });

  it("documents the hp change and the null-stats fallback", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"hp"');
    expect(DM_SYSTEM_PROMPT).toContain('Si "stats" es null');
  });

  it("explains the hp change for players first", () => {
    expect(DM_SYSTEM_PROMPT).toContain("Cuando un jugador recibe daño o curación");
    expect(DM_SYSTEM_PROMPT).not.toContain("Cuando un personaje recibe daño");
  });

  it("combat rules tie enemy attacks to the AC and hp change, and spell saves to stats", () => {
    const fight = buildTurnPrompt({ ...newGame(), scene: { inCombat: true, turnOf: null, order: [] } }, { type: "start" }, 6);
    expect(fight).toContain('Compará el ataque con la CA de "stats" del jugador');
    expect(fight).toContain('con un cambio "hp"');
    expect(fight).toContain('"spellSaveDc" de "stats"');
    expect(fight).toContain('si es null, no la tenés: preguntásela');
    expect(fight).not.toContain('solo si "stats" es null');
    expect(fight).not.toContain("preguntásela si no la sabés");
  });

  it("shows the DM a player's stats and current hp", () => {
    const state = newGame();
    const stats = { maxHp: 12, armorClass: 16, initiative: 1, speed: 30, hitDice: "1d10", attacks: [], spellSaveDc: null, spellAttackBonus: null };
    state.players = [{ ...state.players[0]!, stats, currentHp: 9 }];
    const json = JSON.stringify(stateForModel(state));
    expect(json).toContain('"armorClass":16');
    expect(json).toContain('"currentHp":9');
  });
});

describe("death saves in the prompt", () => {
  it("describes a past death save from its natural alone", () => {
    expect(describeInput({ type: "death_save", playerId: "p", natural: 1 })).toBe(
      "SALVACIÓN CONTRA LA MUERTE (resuelta por el sistema): 1, dos fallos.",
    );
    expect(describeInput({ type: "death_save", playerId: "p", natural: 14 })).toBe(
      "SALVACIÓN CONTRA LA MUERTE (resuelta por el sistema): 14, éxito.",
    );
  });

  it("tells the DM not to ask for death saves itself", () => {
    expect(COMBAT_RULES).toContain('no la pidas vos en "playerRoll" ni cambies sus contadores');
    expect(DM_SYSTEM_PROMPT).toContain('"players[].condition"');
  });
});

describe("levels in the prompt", () => {
  it("asks for milestones instead of the player's wish", () => {
    expect(DM_SYSTEM_PROMPT).toContain("Que el jugador lo pida no alcanza");
    expect(DM_SYSTEM_PROMPT).not.toContain("o el jugador lo pida");
  });
});

describe("rests in the prompt", () => {
  it("explains short and long rests", () => {
    expect(DM_SYSTEM_PROMPT).toContain('mandá "rest" "long" (el sistema restaura los PG)');
    expect(DM_SYSTEM_PROMPT).toContain("No se descansa en combate.");
  });
});

describe("critical hits at 0 HP in the prompt", () => {
  it("asks for critical on hp changes and keeps the rule in combat", () => {
    expect(DM_SYSTEM_PROMPT).toContain('"critical": true');
    expect(COMBAT_RULES).toContain("un crítico, dos");
  });
});

describe("enemy hit points in the prompt", () => {
  it("has the DM set maxHp and send damage to enemies with hp", () => {
    expect(COMBAT_RULES).toContain('fijá su "maxHp" en el cambio "npc"');
    expect(DM_SYSTEM_PROMPT).not.toContain("los PG de enemigos y NPCs los llevás vos");
    expect(DM_SYSTEM_PROMPT).toContain('"maxHp"');
  });
});
