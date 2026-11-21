import { z } from "zod";
import { PORTRAIT_IDS } from "./portraits";
import { DICE, type DMResponse, type GameState } from "./types";

const attitude = z.enum(["friendly", "neutral", "hostile"]);
const questStatus = z.enum(["active", "completed", "failed"]);
const storyItemStatus = z.enum(["available", "taken", "gone"]);

const diceCount = z.number().int().min(1).max(20);

const playerRollRequest = z.object({
  die: z.enum(DICE),
  count: diceCount,
  reason: z.string().min(1),
  difficulty: z.number().int().nullable(),
});

const enemyRollRequest = z.object({
  die: z.enum(DICE),
  count: diceCount,
  modifier: z.number().int(),
  reason: z.string().min(1),
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
    portrait: z.enum(PORTRAIT_IDS).nullable(),
  }),
  z.object({
    type: z.literal("scene"),
    inCombat: z.boolean(),
    turnOf: z.string().nullable(),
  }),
  z.object({
    type: z.literal("quest"),
    title: z.string().min(1),
    description: z.string(),
    status: questStatus,
  }),
  z.object({
    type: z.literal("item"),
    name: z.string().min(1),
    description: z.string(),
    status: z.enum(["available", "gone"]),
  }),
]);

export const dmResponseSchema = z.object({
  // First on purpose: the UI streams this field while the rest is still
  // being generated, so it has to come before everything else.
  narration: z.string().min(1),
  playerRoll: playerRollRequest.nullable(),
  enemyRolls: z.array(enemyRollRequest),
  stateChanges: z.array(stateChange),
  events: z.array(z.string()),
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

export type ParseResult = { ok: true; response: DMResponse } | { ok: false; reason: string };

export function parseDMResponse(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "The response is not valid JSON." };
  }
  const parsed = dmResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: z.prettifyError(parsed.error) };
  return { ok: true, response: parsed.data };
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
      })
      .optional(),
  }),
  z.object({
    type: z.literal("enemy_rolls"),
    results: z.array(
      enemyRollRequest.extend({ values: z.array(z.number().int()), total: z.number().int() }),
    ),
  }),
]);

/** For game states that come from outside the engine (an imported file),
    where the TypeScript types guarantee nothing. */
export const gameStateSchema = z.object({
  id: z.string().min(1),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
    }),
  ),
  scene: z.object({ inCombat: z.boolean(), turnOf: z.string().nullable() }),
  quests: z.array(z.object({ title: z.string(), description: z.string(), status: questStatus })),
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
    }),
  ),
  pendingPlayerRoll: playerRollRequest.nullable(),
  pendingEnemyRolls: z.array(enemyRollRequest),
});

type InferredState = z.infer<typeof gameStateSchema>;
const _stateCheck: GameState = {} as InferredState;
const _stateReverseCheck: InferredState = {} as GameState;
void _stateCheck;
void _stateReverseCheck;
