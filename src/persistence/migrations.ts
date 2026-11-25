import { gameStateSchema } from "../domain/schemas";
import { npcNameFromArchetype } from "../domain/portraits";
import { findClass, findSpecies } from "../rules";
import { GAME_STATE_VERSION, type Condition, type GameState } from "../domain/types";

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null;

/** v1 -> v2. In v1 the app rolled the player's dice and tracked HP. In v2
    the player rolls and keeps their own sheet, so: HP is dropped, a pending
    roll becomes a request the player answers in the chat, and past roll
    turns are rewritten as the chat message the player would have sent. */
function fromV1(raw: Raw): Raw {
  const players = (Array.isArray(raw.players) ? raw.players : []).map((player) => {
    if (!isObject(player)) return player;
    const { hp: _hp, maxHp: _maxHp, ...rest } = player;
    return rest;
  });
  const turns = (Array.isArray(raw.turns) ? raw.turns : []).map((turn) => {
    if (!isObject(turn) || !isObject(turn.input) || turn.input.type !== "roll") return turn;
    const result = isObject(turn.input.result) ? turn.input.result : {};
    const text = `Tiré ${String(result.die)} por "${String(result.reason)}": me dio ${String(result.value)} en total.`;
    return { ...turn, input: { type: "action", text } };
  });
  const { pendingRoll, ...rest } = raw;
  return {
    ...rest,
    version: 2,
    players,
    turns,
    pendingPlayerRoll: isObject(pendingRoll) ? { ...pendingRoll, count: 1 } : null,
    pendingEnemyRolls: [],
  };
}

/** v2 -> v3. v3 knows who is in the current scene and whose turn it is.
    Old saves never recorded presence, so the scene starts empty and calm. */
function fromV2(raw: Raw): Raw {
  const npcs = (Array.isArray(raw.npcs) ? raw.npcs : []).map((npc) =>
    isObject(npc) ? { ...npc, present: false } : npc,
  );
  return { ...raw, version: 3, npcs, scene: { inCombat: false, turnOf: null } };
}

/** v3 -> v4. Characters carry the ids of the SRD rules data, recovered from
    the old Spanish labels. What SRD 5.2 lacks (Semielfo, Semiorco) stays
    null and the save still loads. */
function fromV3(raw: Raw): Raw {
  const players = (Array.isArray(raw.players) ? raw.players : []).map((player) => {
    if (!isObject(player)) return player;
    const race = typeof player.race === "string" ? player.race : "";
    const characterClass = typeof player.characterClass === "string" ? player.characterClass : "";
    return {
      ...player,
      speciesId: findSpecies(race)?.id ?? null,
      classId: findClass(characterClass)?.id ?? null,
      subclassId: null,
      srdBackgroundId: null,
    };
  });
  return { ...raw, version: 4, players };
}

/** v4 -> v5. v5 records the objects that appeared in the story. Old saves
    only know what the players carry, so that is the starting record, with
    the place it came from unknown. */
function fromV4(raw: Raw): Raw {
  const names = new Map<string, string>();
  for (const player of Array.isArray(raw.players) ? raw.players : []) {
    if (!isObject(player) || !Array.isArray(player.inventory)) continue;
    for (const item of player.inventory) {
      if (!isObject(item) || typeof item.name !== "string") continue;
      const key = item.name.trim().toLowerCase();
      if (!names.has(key)) names.set(key, item.name.trim());
    }
  }
  const storyItems = [...names.values()].map((name) => ({
    name,
    description: "",
    location: "",
    status: "taken",
  }));
  return { ...raw, version: 5, storyItems };
}

/** v5 -> v6. NPCs record how they talk; nobody had a voice before. */
function fromV5(raw: Raw): Raw {
  const npcs = (Array.isArray(raw.npcs) ? raw.npcs : []).map((npc) =>
    isObject(npc) ? { ...npc, voice: "" } : npc,
  );
  return { ...raw, version: 6, npcs };
}

/** v6 -> v7. NPCs get a portrait archetype; nobody had one before. */
function fromV6(raw: Raw): Raw {
  const npcs = (Array.isArray(raw.npcs) ? raw.npcs : []).map((npc) =>
    isObject(npc) ? { ...npc, portrait: null } : npc,
  );
  return { ...raw, version: 7, npcs };
}

/** v7 -> v8. NPCs the model named after their portrait archetype
    ("innkeeper-male") get the Spanish name ("Tabernero"). Past narrations
    keep the old markers; dialogue.ts resolves them to the new name. */
function fromV7(raw: Raw): Raw {
  const rename = (name: unknown) => (typeof name === "string" ? npcNameFromArchetype(name) : name);
  const npcs = (Array.isArray(raw.npcs) ? raw.npcs : []).map((npc) =>
    isObject(npc) ? { ...npc, name: rename(npc.name) } : npc,
  );
  const scene = isObject(raw.scene) ? { ...raw.scene, turnOf: rename(raw.scene.turnOf) } : raw.scene;
  return { ...raw, version: 8, npcs, scene };
}

/** v8 -> v9. A requested roll (the player's or an enemy's) says whether it
    is made with advantage; every old one was a plain roll. */
function fromV8(raw: Raw): Raw {
  const pending = isObject(raw.pendingPlayerRoll)
    ? { ...raw.pendingPlayerRoll, mode: "normal" }
    : raw.pendingPlayerRoll;
  const plain = (roll: unknown) => (isObject(roll) ? { ...roll, mode: "normal" } : roll);
  const pendingEnemyRolls = Array.isArray(raw.pendingEnemyRolls)
    ? raw.pendingEnemyRolls.map(plain)
    : raw.pendingEnemyRolls;
  const turns = Array.isArray(raw.turns)
    ? raw.turns.map((turn: unknown) => {
        if (!isObject(turn) || !isObject(turn.input) || turn.input.type !== "enemy_rolls") return turn;
        const results = Array.isArray(turn.input.results)
          ? turn.input.results.map(plain)
          : turn.input.results;
        return { ...turn, input: { ...turn.input, results } };
      })
    : raw.turns;
  return { ...raw, version: 9, pendingPlayerRoll: pending, pendingEnemyRolls, turns };
}

/** v9 -> v10. Characters carry optional combat stats and current hit points;
    old saves have neither tracked. */
function fromV9(raw: Raw): Raw {
  const players = Array.isArray(raw.players)
    ? raw.players.map((p: unknown) => (isObject(p) ? { ...p, stats: null, currentHp: null } : p))
    : raw.players;
  return { ...raw, version: 10, players };
}

/** v10 -> v11. Characters know whether they are up, dying, stable or dead,
    and count milestones toward their next level. Nobody has saves or
    milestones yet; normalizeHp turns a player left at 0 HP into dying. */
function fromV10(raw: Raw): Raw {
  const players = Array.isArray(raw.players)
    ? raw.players.map((p: unknown) =>
        isObject(p)
          ? {
              ...p,
              condition: "ok",
              deathSaves: { successes: 0, failures: 0 },
              milestonesSinceLevel: 0,
            }
          : p,
      )
    : raw.players;
  return { ...raw, version: 11, players };
}

/** v11 -> v12. NPCs can carry hit points, the scene keeps the initiative
    order and the DM's suggested actions are stored; old saves have none. */
function fromV11(raw: Raw): Raw {
  const npcs = Array.isArray(raw.npcs)
    ? raw.npcs.map((n: unknown) => (isObject(n) ? { ...n, hp: null, maxHp: null } : n))
    : raw.npcs;
  const scene = isObject(raw.scene) ? { ...raw.scene, order: [] } : raw.scene;
  return { ...raw, version: 12, npcs, scene, suggestedActions: [] };
}

/** v12 -> v13. Campaign threads; old games have none yet. */
function fromV12(raw: Raw): Raw {
  return { ...raw, version: 13, threads: [] };
}

/** v13 -> v14. Official campaign id; old games are free adventures. */
function fromV13(raw: Raw): Raw {
  return { ...raw, version: 14, campaignId: null };
}

/** v14 -> v15. Turns may carry who arrived, and NPCs whether they have been
    seen; both are optional, so old saves carry over as they are. The bump
    keeps older app versions from rewriting a save and dropping them. */
function fromV14(raw: Raw): Raw {
  return { ...raw, version: 15 };
}

/** v15 -> v16: turns gained an optional `chapter`; old saves carry over as
    they are. The bump keeps older app versions from rewriting a save and
    dropping the chapters. */
function fromV15(raw: Raw): Raw {
  return { ...raw, version: 16 };
}

/** v16 -> v17: players keep the rules choices their sheet is built from.
    Older saves don't have them. */
function fromV16(raw: Raw): Raw {
  const players = Array.isArray(raw.players)
    ? raw.players.map((p: unknown) => (isObject(p) ? { ...p, choices: null } : p))
    : raw.players;
  return { ...raw, version: 17, players };
}

/** Turns whatever was stored into a GameState of the current version, or
    null if it can't be trusted (unknown version or wrong shape). Loading
    code must go through here so the screens never see a malformed save. */
export function migrateSave(raw: unknown): GameState | null {
  if (!isObject(raw)) return null;
  let current = raw;
  if (current.version === 1) current = fromV1(current);
  if (current.version === 2) current = fromV2(current);
  if (current.version === 3) current = fromV3(current);
  if (current.version === 4) current = fromV4(current);
  if (current.version === 5) current = fromV5(current);
  if (current.version === 6) current = fromV6(current);
  if (current.version === 7) current = fromV7(current);
  if (current.version === 8) current = fromV8(current);
  if (current.version === 9) current = fromV9(current);
  if (current.version === 10) current = fromV10(current);
  if (current.version === 11) current = fromV11(current);
  if (current.version === 12) current = fromV12(current);
  if (current.version === 13) current = fromV13(current);
  if (current.version === 14) current = fromV14(current);
  if (current.version === 15) current = fromV15(current);
  if (current.version === 16) current = fromV16(current);
  if (current.version !== GAME_STATE_VERSION) return null;
  const parsed = gameStateSchema.safeParse(current);
  return parsed.success ? normalizeHp(parsed.data) : null;
}

/** A stored game can disagree with itself about hit points (stats without
    current HP, HP above the maximum, HP with no stats, a condition that
    doesn't match the HP). Repair it on load instead of rejecting the save. */
function normalizeHp(state: GameState): GameState {
  const players = state.players.map((p) => {
    // A non-positive maximum is not a real sheet: treat the player as untracked.
    if (p.stats === null || p.stats.maxHp < 1) {
      // Without HP nobody is at 0, so nobody is dying or stable (the dead stay dead).
      const condition: Condition = p.condition === "dead" ? "dead" : "ok";
      if (p.stats === null && p.currentHp === null && condition === p.condition) return p;
      return { ...p, stats: null, currentHp: null, condition, ...(condition === "ok" ? { deathSaves: UP } : {}) };
    }
    const currentHp = Math.min(p.stats.maxHp, Math.max(0, p.currentHp ?? p.stats.maxHp));
    const condition: Condition =
      p.condition === "dead" ? "dead" : currentHp > 0 ? "ok" : p.condition === "ok" ? "dying" : p.condition;
    if (currentHp === p.currentHp && condition === p.condition) return p;
    return { ...p, currentHp, condition, ...(condition === "ok" ? { deathSaves: UP } : {}) };
  });
  return { ...state, players };
}

const UP = { successes: 0, failures: 0 };
