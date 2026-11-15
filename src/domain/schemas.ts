import { z } from "zod";
import { DICE, type DMResponse } from "./types";

const attitude = z.enum(["friendly", "neutral", "hostile"]);
const questStatus = z.enum(["active", "completed", "failed"]);

const stateChange = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hp"), playerId: z.string(), delta: z.number().int() }),
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
  z.object({ type: z.literal("location"), name: z.string().min(1), description: z.string() }),
  z.object({
    type: z.literal("npc"),
    name: z.string().min(1),
    description: z.string(),
    attitude,
  }),
  z.object({
    type: z.literal("quest"),
    title: z.string().min(1),
    description: z.string(),
    status: questStatus,
  }),
]);

export const dmResponseSchema = z.object({
  // First on purpose: the UI streams this field while the rest is still
  // being generated, so it has to come before everything else.
  narration: z.string().min(1),
  rollRequest: z
    .object({
      die: z.enum(DICE),
      reason: z.string().min(1),
      difficulty: z.number().int().nullable(),
    })
    .nullable(),
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
    documents: no `$schema`, and `enum` instead of `const`. */
function toProviderSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toProviderSchema);
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") continue;
    if (key === "const") out.enum = [value];
    else out[key] = toProviderSchema(value);
  }
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
