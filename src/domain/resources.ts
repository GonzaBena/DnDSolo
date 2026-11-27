import { findClass } from "../rules";
import { buildSheet } from "../rules/buildSheet";
import type { Character } from "./types";

interface FeatureRecovery {
  shortRest: "none" | "one" | "all";
  shortRestFromLevel?: number;
}

/** Exact SRD consumable resource keys mapped to their short-rest recovery rules.
    Passive scales in `LevelRow.resources` (e.g. Sneak Attack dice, Rage bonus) are excluded. */
const TRACKED_FEATURES: Record<string, FeatureRecovery> = {
  Furias: { shortRest: "one" },
  "Tomar aliento": { shortRest: "one" },
  "Acción súbita": { shortRest: "all" },
  Indómito: { shortRest: "none" },
  "Canalizar divinidad": { shortRest: "one" },
  "Imponer las manos": { shortRest: "none" },
  "Forma salvaje": { shortRest: "one" },
  "Puntos de concentración": { shortRest: "all" },
  "Puntos de hechicería": { shortRest: "none" },
  "Hechicería innata": { shortRest: "none" },
  "Enemigo predilecto": { shortRest: "none" },
  "Inspiración bárdica": { shortRest: "all", shortRestFromLevel: 5 },
};

/** Normalizes slot names from the LLM ("nivel 1", "Nivel 2", "pacto", "1") to canonical keys. */
export function normalizeSlotKey(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === "pact" || key === "pacto" || key.includes("pacto")) return "pact";
  const match = /(\d+)/.exec(key);
  return match ? match[1]! : key;
}

/** Maximum spell slots per canonical slot key ("1".."5", "pact") for a character's class and level. */
export function maxSlotsFor(player: Character): Record<string, number> {
  const cls = findClass(player.classId ?? player.characterClass);
  const row = cls?.levels.find((r) => r.level === player.level);
  if (!row) return {};
  const max: Record<string, number> = {};
  if (row.slots) {
    row.slots.forEach((count, index) => {
      if (count > 0) max[String(index + 1)] = count;
    });
  }
  if (row.pactSlots && row.pactSlots.count > 0) {
    max.pact = row.pactSlots.count;
  }
  return max;
}

/** Maximum consumable class feature uses for a character's class and level. */
export function maxFeaturesFor(player: Character): Record<string, number> {
  const cls = findClass(player.classId ?? player.characterClass);
  const row = cls?.levels.find((r) => r.level === player.level);
  if (!cls || !row) return {};
  const max: Record<string, number> = {};
  for (const [name, amount] of Object.entries(row.resources)) {
    if (name in TRACKED_FEATURES && amount > 0) max[name] = amount;
  }
  if (cls.id === "bard") {
    let uses = 1;
    if (player.choices) {
      const built = buildSheet(player.choices);
      if (built.ok) uses = Math.max(1, built.sheet.abilities.cha.modifier);
    }
    max["Inspiración bárdica"] = uses;
  }
  return max;
}

function compactRecord(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v > 0) out[k] = v;
  }
  return out;
}

export function applyResourceChange(
  player: Character,
  change: { kind: "slot" | "feature"; name: string; delta: number },
): { ok: true; player: Character } | { ok: false; reason: string } {
  if (change.kind === "slot") {
    const maxMap = maxSlotsFor(player);
    const key = normalizeSlotKey(change.name);
    const max = maxMap[key];
    if (max === undefined) return { ok: false, reason: `Unknown spell slot "${change.name}".` };
    const currentSpent = player.spentSlots?.[key] ?? 0;
    const nextSpent = Math.min(max, Math.max(0, currentSpent - change.delta));
    return {
      ok: true,
      player: { ...player, spentSlots: compactRecord({ ...player.spentSlots, [key]: nextSpent }) },
    };
  }

  const maxMap = maxFeaturesFor(player);
  const targetLower = change.name.trim().toLowerCase();
  const key = Object.keys(maxMap).find((k) => k.toLowerCase() === targetLower);
  if (!key) return { ok: false, reason: `Unknown class resource "${change.name}".` };
  const max = maxMap[key]!;
  const currentSpent = player.spentResources?.[key] ?? 0;
  const nextSpent = Math.min(max, Math.max(0, currentSpent - change.delta));
  return {
    ok: true,
    player: { ...player, spentResources: compactRecord({ ...player.spentResources, [key]: nextSpent }) },
  };
}

export function applyConditionChange(player: Character, condition: string, active: boolean): Character {
  const trimmed = condition.trim();
  if (!trimmed) return player;
  const current = player.activeConditions ?? [];
  const lower = trimmed.toLowerCase();
  if (active) {
    if (current.some((c) => c.toLowerCase() === lower)) return player;
    // Only one Concentration spell can be active at a time.
    const filtered = lower.startsWith("concentración")
      ? current.filter((c) => !c.toLowerCase().startsWith("concentración"))
      : current;
    return { ...player, activeConditions: [...filtered, trimmed] };
  }
  const next = current.filter((c) => {
    const cLower = c.toLowerCase();
    if (cLower === lower) return false;
    if (lower === "concentración" && cLower.startsWith("concentración")) return false;
    return true;
  });
  return { ...player, activeConditions: next };
}

export function applyShortRestResources(player: Character): Character {
  if (!player.spentSlots && !player.spentResources) return player;
  const nextSlots = { ...player.spentSlots };
  delete nextSlots.pact;
  const nextResources: Record<string, number> = {};
  for (const [name, spent] of Object.entries(player.spentResources ?? {})) {
    const rule = TRACKED_FEATURES[name];
    if (!rule) {
      if (spent > 0) nextResources[name] = spent;
      continue;
    }
    if (rule.shortRest === "all" && player.level >= (rule.shortRestFromLevel ?? 1)) continue;
    if (rule.shortRest === "one") {
      const reduced = Math.max(0, spent - 1);
      if (reduced > 0) nextResources[name] = reduced;
      continue;
    }
    if (spent > 0) nextResources[name] = spent;
  }
  return {
    ...player,
    spentSlots: compactRecord(nextSlots),
    spentResources: nextResources,
  };
}

export function applyLongRestResources(player: Character): Character {
  if (!player.spentSlots && !player.spentResources) return player;
  return {
    ...player,
    ...(player.spentSlots ? { spentSlots: {} } : {}),
    ...(player.spentResources ? { spentResources: {} } : {}),
  };
}

export interface ResourceStatus {
  slots: { key: string; label: string; available: number; max: number }[];
  features: { name: string; available: number; max: number }[];
}

export function resourceStatusFor(player: Character): ResourceStatus {
  const maxSlots = maxSlotsFor(player);
  const slots = Object.entries(maxSlots)
    .sort(([a], [b]) => (a === "pact" ? 1 : b === "pact" ? -1 : Number(a) - Number(b)))
    .map(([key, max]) => ({
      key,
      label: key === "pact" ? "Pacto" : `Nivel ${key}`,
      available: Math.max(0, max - (player.spentSlots?.[key] ?? 0)),
      max,
    }));
  const maxFeatures = maxFeaturesFor(player);
  const features = Object.entries(maxFeatures).map(([name, max]) => ({
    name,
    available: Math.max(0, max - (player.spentResources?.[name] ?? 0)),
    max,
  }));
  return { slots, features };
}
