import { gameStateSchema } from "../domain/schemas";
import { npcNameFromArchetype } from "../domain/portraits";
import { findClass, findSpecies } from "../rules";
import { GAME_STATE_VERSION, type GameState } from "../domain/types";

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
  if (current.version !== GAME_STATE_VERSION) return null;
  const parsed = gameStateSchema.safeParse(current);
  return parsed.success ? parsed.data : null;
}
