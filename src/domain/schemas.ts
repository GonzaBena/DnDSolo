import { z } from "./zod";
import { DICE, ROLL_MODES, type DMResponse, type GameState } from "./types";

const attitude = z.enum(["friendly", "neutral", "hostile"]);
const questStatus = z.enum(["active", "completed", "failed"]);
const storyItemStatus = z.enum(["available", "taken", "gone"]);
const threadKind = z.enum(["goal", "threat", "mystery"]);
const threadStatus = z.enum(["open", "resolved"]);

const diceCount = z.number().int().min(1).max(20);

export const MAX_SUGGESTIONS = 3;
/** The prompt asks for 60 characters; this is only the cap past which a
    suggestion is junk and dropped. Anything shorter is kept whole, because
    picking it sends exactly this text: the chip trims it on screen (CSS). */
export const MAX_SUGGESTION_LENGTH = 160;

const damageRollRequest = z.object({
  die: z.enum(DICE),
  count: diceCount,
  reason: z.string().min(1),
});

const playerRollRequest = z.object({
  die: z.enum(DICE),
  count: diceCount,
  reason: z.string().min(1),
  difficulty: z.number().int().nullable(),
  mode: z.enum(ROLL_MODES),
  damage: damageRollRequest.nullable().optional(),
});

const enemyRollRequest = z.object({
  die: z.enum(DICE),
  count: diceCount,
  modifier: z.number().int(),
  reason: z.string().min(1),
  mode: z.enum(ROLL_MODES),
});

const stateChange = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inventory_add"),
    playerId: z.string(),
    item: z.string().min(1),
    quantity: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("inventory_remove"),
    playerId: z.string(),
    item: z.string().min(1),
    quantity: z.number().int().min(1),
  }),
  z.object({
    type: z.literal("level"),
    playerId: z.string(),
    level: z.number().int().min(1).max(20),
  }),
  z.object({
    type: z.literal("milestone"),
    playerId: z.string(),
    reason: z.string().min(1),
  }),
  z.object({ type: z.literal("rest"), kind: z.enum(["short", "long"]) }),
  z.object({
    type: z.literal("hp"),
    target: z.string().min(1),
    delta: z.number().int().refine((d) => d !== 0, "delta must not be 0"),
    critical: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("subclass"),
    playerId: z.string(),
    subclassId: z.string().min(1),
  }),
  z.object({ type: z.literal("location"), name: z.string().min(1), description: z.string() }),
  z.object({
    type: z.literal("npc"),
    name: z.string().min(1),
    description: z.string(),
    attitude,
    present: z.boolean(),
    voice: z.string(),
    maxHp: z.number().int().min(1).nullable(),
  }),
  z.object({
    type: z.literal("scene"),
    inCombat: z.boolean(),
    turnOf: z.string().nullable(),
    order: z.array(z.string()),
  }),
  z.object({
    type: z.literal("quest"),
    title: z.string().min(1),
    description: z.string(),
    status: questStatus,
  }),
  z.object({
    type: z.literal("thread"),
    title: z.string().trim().min(1),
    kind: threadKind,
    description: z.string(),
    status: threadStatus,
    secret: z.boolean(),
  }),
  z.object({
    type: z.literal("item"),
    name: z.string().min(1),
    description: z.string(),
    status: z.enum(["available", "gone"]),
  }),
  z.object({
    type: z.literal("resource"),
    playerId: z.string(),
    kind: z.enum(["slot", "feature"]),
    name: z.string().min(1),
    delta: z.number().int().refine((d) => d !== 0, "delta must not be 0"),
  }),
  z.object({
    type: z.literal("condition"),
    playerId: z.string(),
    condition: z.string().min(1),
    active: z.boolean(),
  }),
]);

export const dmResponseSchema = z.object({
  // First on purpose: the UI streams this field while the rest is still
  // being generated, so it has to come before everything else.
  narration: z.string().min(1),
  playerRoll: playerRollRequest.nullable(),
  enemyRolls: z.array(enemyRollRequest),
  stateChanges: z.array(stateChange),
  // The limits are hints for the model; parseDMResponse enforces them by cleaning.
  suggestions: z.array(z.string().min(1).max(MAX_SUGGESTION_LENGTH)).max(MAX_SUGGESTIONS),
});

// Compile-time guarantee that the schema and the hand-written type agree.
type Inferred = z.infer<typeof dmResponseSchema>;
const _typeCheck: DMResponse = {} as Inferred;
const _reverseCheck: Inferred = {} as DMResponse;
void _typeCheck;
void _reverseCheck;

/** Rewrites what Zod emits into the JSON Schema subset the model API
    documents: no `$schema`, `enum` instead of `const`, and integer enums
    typed as "integer". */
export function toProviderSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toProviderSchema);
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") continue;
    if (key === "const") out.enum = [value];
    else out[key] = toProviderSchema(value);
  }
  // Zod types integer literals as "number"; tell the provider they are integers.
  if (out.type === "number" && Array.isArray(out.enum) && out.enum.every(Number.isInteger)) out.type = "integer";
  // Non-standard hint some providers use to fix the generation order.
  if (out.type === "object" && typeof out.properties === "object" && out.properties !== null) {
    out.propertyOrdering = Object.keys(out.properties);
  }
  return out;
}

export const dmResponseJsonSchema: unknown = toProviderSchema(z.toJSONSchema(dmResponseSchema));

/** The same reply without suggestions, for a player who hides them: the DM
    doesn't write what nobody reads (parseDMResponse fills in []). */
export const dmResponseJsonSchemaNoSuggestions: unknown = toProviderSchema(
  z.toJSONSchema(dmResponseSchema.omit({ suggestions: true })),
);

export type ParseResult = { ok: true; response: DMResponse } | { ok: false; reason: string };

export function parseDMResponse(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "The response is not valid JSON." };
  }
  // Suggestions are an extra: a long, empty or repeated one is fixed here
  // instead of failing (and retrying) a reply that is otherwise fine.
  if (typeof json === "object" && json !== null) {
    json = { ...json, suggestions: cleanSuggestions((json as { suggestions?: unknown }).suggestions) };
  }
  const parsed = dmResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: z.prettifyError(parsed.error) };
  return { ok: true, response: normalizeRollCounts(parsed.data) };
}

/** The reply of the suggestions-only call (TurnEngine.suggestFor). */
export const suggestionsJsonSchema: unknown = toProviderSchema(
  z.toJSONSchema(z.object({ suggestions: z.array(z.string()).max(MAX_SUGGESTIONS) })),
);

/** Cleaned suggestions from that reply; [] when it is not what was asked. */
export function parseSuggestions(text: string): string[] {
  try {
    return cleanSuggestions((JSON.parse(text) as { suggestions?: unknown }).suggestions);
  } catch {
    return [];
  }
}

function cleanSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const kept: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const text = item.trim().replace(/\s+/g, " ");
    if (text === "" || text.length > MAX_SUGGESTION_LENGTH) continue;
    if (kept.some((k) => k.toLowerCase() === text.toLowerCase())) continue;
    kept.push(text);
    if (kept.length === MAX_SUGGESTIONS) break;
  }
  return kept;
}

/** Advantage and disadvantage are always two d20 of a single roll: a model
    that also asks for "count": 2 must not leak "2d20 con ventaja" anywhere. */
function normalizeRollCounts(response: DMResponse): DMResponse {
  const single = <T extends { count: number; mode: string }>(roll: T): T =>
    roll.mode === "normal" ? roll : { ...roll, count: 1 };
  return {
    ...response,
    playerRoll: response.playerRoll && single(response.playerRoll),
    enemyRolls: response.enemyRolls.map(single),
  };
}

const turnInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }),
  z.object({
    type: z.literal("action"),
    text: z.string(),
    playerId: z.string().optional(),
    roll: z
      .object({
        die: z.enum(DICE),
        count: z.number().int().positive().optional(),
        value: z.number().int(),
        modifier: z.number().int(),
        reason: z.string().optional(),
        mode: z.enum(ROLL_MODES).optional(),
        rolls: z.tuple([z.number().int(), z.number().int()]).optional(),
        difficulty: z.number().int().optional(),
        damage: z
          .object({
            die: z.enum(DICE),
            count: z.number().int().positive().optional(),
            value: z.number().int(),
            modifier: z.number().int(),
            reason: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("enemy_rolls"),
    results: z.array(
      enemyRollRequest.extend({ values: z.array(z.number().int()), total: z.number().int() }),
    ),
  }),
  z.object({
    type: z.literal("death_save"),
    playerId: z.string(),
    natural: z.number().int().min(1).max(20),
  }),
]);

/** For game states that come from outside the engine (an imported file),
    where the TypeScript types guarantee nothing. */
const arrivalSchema = z.object({
  name: z.string(),
  attitude,
  portrait: z.string().nullable(),
  blurb: z.string(),
  returning: z.boolean(),
  health: z.enum(["Herido", "Malherido", "Fuera de combate"]).nullable(),
});

const abilityScores = z.object({
  str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number(),
});

/** The shape of `CharacterChoices` (rules are checked by `validateChoices`, not here). */
export const characterChoicesSchema = z.object({
  speciesId: z.string(),
  classId: z.string(),
  backgroundId: z.string(),
  level: z.number().int(),
  baseScores: abilityScores,
  backgroundBonus: abilityScores.partial(),
  classEquipment: z.enum(["A", "B", "C"]),
  backgroundEquipment: z.enum(["A", "B"]),
  picks: z.record(z.string(), z.array(z.string())),
  srdSubclass: z.literal(false).optional(),
});

export const gameStateSchema = z.object({
  id: z.string().min(1),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  campaignId: z.string().min(1).nullable(),
  players: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        race: z.string(),
        characterClass: z.string(),
        speciesId: z.string().nullable(),
        classId: z.string().nullable(),
        subclassId: z.string().nullable(),
        srdBackgroundId: z.string().nullable(),
        level: z.number().int(),
        background: z.string().nullable(),
        inventory: z.array(z.object({ name: z.string(), quantity: z.number().int() })),
        stats: z
          .object({
            maxHp: z.number().int(),
            armorClass: z.number().int(),
            initiative: z.number().int(),
            speed: z.number().int(),
            hitDice: z.string(),
            attacks: z.array(
              z.object({ name: z.string(), attackBonus: z.number().int(), damage: z.string() }),
            ),
            spellSaveDc: z.number().int().nullable(),
            spellAttackBonus: z.number().int().nullable(),
          })
          .nullable(),
        currentHp: z.number().int().nullable(),
        condition: z.enum(["ok", "dying", "stable", "dead"]),
        deathSaves: z.object({
          successes: z.number().int().min(0).max(3),
          failures: z.number().int().min(0).max(3),
        }),
        milestonesSinceLevel: z.number().int().min(0),
        choices: characterChoicesSchema.nullable(),
        outsideSrd: z.object({ note: z.string(), subclass: z.string().nullable() }),
        portrait: z.string().nullable(),
        activeConditions: z.array(z.string()).optional(),
        spentSlots: z.record(z.string(), z.number().int().min(0)).optional(),
        spentResources: z.record(z.string(), z.number().int().min(0)).optional(),
      }),
    )
    .min(1),
  location: z.object({ name: z.string(), description: z.string() }),
  npcs: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      attitude,
      present: z.boolean(),
      voice: z.string(),
      portrait: z.string().nullable(),
      hp: z.number().int().nullable(),
      maxHp: z.number().int().nullable(),
      seen: z.boolean().optional(),
      formerNames: z.array(z.string()).optional(),
      label: z.string().optional(),
    }),
  ),
  scene: z.object({ inCombat: z.boolean(), turnOf: z.string().nullable(), order: z.array(z.string()) }),
  quests: z.array(z.object({ title: z.string(), description: z.string(), status: questStatus })),
  threads: z.array(
    z.object({
      title: z.string(),
      kind: threadKind,
      description: z.string(),
      status: threadStatus,
      secret: z.boolean(),
    }),
  ),
  storyItems: z.array(
    z.object({ name: z.string(), description: z.string(), location: z.string(), status: storyItemStatus }),
  ),
  summary: z.string(),
  summarizedThroughTurn: z.number().int().min(0),
  turns: z.array(
    z.object({
      number: z.number().int(),
      input: turnInput,
      narration: z.string(),
      events: z.array(z.string()),
      arrivals: z.array(arrivalSchema).optional(),
      chapter: z.object({ name: z.string(), description: z.string(), firstVisit: z.boolean() }).optional(),
      moments: z
        .array(
          z.discriminatedUnion("kind", [
            z.object({ kind: z.literal("quest"), title: z.string(), status: questStatus }),
            z.object({ kind: z.literal("level"), level: z.number().int() }),
            z.object({ kind: z.literal("death") }),
          ]),
        )
        .optional(),
    }),
  ),
  pendingPlayerRoll: playerRollRequest.nullable(),
  pendingEnemyRolls: z.array(enemyRollRequest),
  suggestedActions: z.array(z.string()),
});

type InferredState = z.infer<typeof gameStateSchema>;
const _stateCheck: GameState = {} as InferredState;
const _stateReverseCheck: InferredState = {} as GameState;
void _stateCheck;
void _stateReverseCheck;
