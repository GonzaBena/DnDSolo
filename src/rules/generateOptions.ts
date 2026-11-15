import { z } from "zod";
import { toProviderSchema } from "../domain/schemas";
import type { LLMClient } from "../llm/LLMClient";
import { buildSheet } from "./buildSheet";
import type { CharacterChoices, ChoiceError } from "./buildSheet";
import { activeChoices, requiredChoices } from "./choices";
import { buildChoicesPrompt, buildConceptPrompt, GENERATOR_SYSTEM_PROMPT } from "./generatorPrompt";
import { BACKGROUNDS, CLASSES_DATA, LOADED_MAX_LEVEL, SPECIES, STANDARD_ARRAY, findBackground } from "./index";
import { ABILITIES } from "./types";
import type { Ability, CharacterSheet, ChoiceSpec } from "./types";

export interface GeneratedOption {
  name: string; story: string; pitch: string;
  outsideSrdNote: string | null; choices: CharacterChoices; sheet: CharacterSheet;
}
export interface GenerationResult { options: GeneratedOption[]; failures: string[] }

const ids = (items: { id: string }[]) => items.map((i) => i.id) as [string, ...string[]];

// Step 1: the model picks species, class and background for three concepts. Ids are enums of the catalog.
const conceptSchema = z.object({
  name: z.string().min(1),
  story: z.string().min(1),
  pitch: z.string().min(1),
  outsideSrdNote: z.string().nullable(),
  speciesId: z.enum(ids(SPECIES)),
  classId: z.enum(ids(CLASSES_DATA)),
  backgroundId: z.enum(ids(BACKGROUNDS)),
});
type ConceptReply = z.infer<typeof conceptSchema>;

const conceptsSchema = z.object({ concepts: z.array(conceptSchema).length(3) });
const conceptsJsonSchema: unknown = toProviderSchema(z.toJSONSchema(conceptsSchema));

const standardValue = z.literal([...STANDARD_ARRAY]);
type StandardValue = typeof standardValue;

/** Step 2 schema, built from the concept's specs: every id the model can send is an enum. */
function choicesSchema(concept: ConceptReply, specs: ChoiceSpec[]) {
  const cls = CLASSES_DATA.find((c) => c.id === concept.classId)!;
  const background = findBackground(concept.backgroundId)!;
  const equipmentKeys = (["A", "B", "C"] as const).filter((k) => cls.equipment[k]);
  return z.object({
    baseScores: z.object(Object.fromEntries(ABILITIES.map((a) => [a, standardValue])) as Record<Ability, StandardValue>),
    backgroundBonus: z.array(z.object({ ability: z.enum(background.abilities), amount: z.literal([1, 2]) })),
    classEquipment: z.enum(equipmentKeys as unknown as [string, ...string[]]),
    backgroundEquipment: z.enum(["A", "B"]),
    picks: z.array(z.object({ choiceId: z.enum(ids(specs)), optionIds: z.array(z.string()) })),
  });
}
type ChoicesReply = z.infer<ReturnType<typeof choicesSchema>>;

function parseJson<T>(raw: string, schema: z.ZodType<T>): { ok: true; value: T } | { ok: false; reason: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "La respuesta no es JSON válido." };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: z.prettifyError(parsed.error) };
}

/** Turns the model's arrays into CharacterChoices. Picks of specs that the other picks leave inactive are
    dropped: the model sometimes fills an optional branch it did not take, and that is harmless to ignore. */
function toChoices(concept: ConceptReply, level: number, specs: ChoiceSpec[], reply: ChoicesReply): CharacterChoices {
  const backgroundBonus: Partial<Record<Ability, number>> = {};
  for (const { ability, amount } of reply.backgroundBonus) {
    backgroundBonus[ability as Ability] = (backgroundBonus[ability as Ability] ?? 0) + amount;
  }
  const picks: Record<string, string[]> = {};
  for (const { choiceId, optionIds } of reply.picks) picks[choiceId] = [...(picks[choiceId] ?? []), ...optionIds];
  const active = new Set(activeChoices(specs, picks).map((s) => s.id));
  for (const key of Object.keys(picks)) if (!active.has(key)) delete picks[key];
  return {
    speciesId: concept.speciesId, classId: concept.classId, backgroundId: concept.backgroundId, level,
    baseScores: reply.baseScores,
    backgroundBonus,
    classEquipment: reply.classEquipment as CharacterChoices["classEquipment"],
    backgroundEquipment: reply.backgroundEquipment as CharacterChoices["backgroundEquipment"],
    picks,
  };
}

async function generateConcepts(llm: LLMClient, story: string, level: number, signal?: AbortSignal): Promise<ConceptReply[]> {
  const prompt = buildConceptPrompt(story, level);
  let reason = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await llm.generateStructured({ system: GENERATOR_SYSTEM_PROMPT, prompt, jsonSchema: conceptsJsonSchema, signal });
    const parsed = parseJson(raw, conceptsSchema);
    if (parsed.ok) return parsed.value.concepts;
    reason = parsed.reason;
  }
  throw new Error(`No se pudieron generar los conceptos de personaje: ${reason}`);
}

type ConceptOutcome = { ok: true; option: GeneratedOption } | { ok: false; failure: string };

async function generateChoices(
  llm: LLMClient, concept: ConceptReply, level: number, signal?: AbortSignal,
): Promise<ConceptOutcome> {
  const specs = requiredChoices({ ...concept, level });
  const schema = choicesSchema(concept, specs);
  const jsonSchema = toProviderSchema(z.toJSONSchema(schema));
  let errors: ChoiceError[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildChoicesPrompt({ ...concept, level }, specs, errors);
    const raw = await llm.generateStructured({ system: GENERATOR_SYSTEM_PROMPT, prompt, jsonSchema, signal });
    const parsed = parseJson(raw, schema);
    if (!parsed.ok) {
      errors = [{ field: "respuesta", message: parsed.reason }];
      continue;
    }
    const choices = toChoices(concept, level, specs, parsed.value);
    const built = buildSheet(choices);
    if (built.ok) {
      const { name, story, pitch, outsideSrdNote } = concept;
      return { ok: true, option: { name, story, pitch, outsideSrdNote, choices, sheet: built.sheet } };
    }
    errors = built.errors;
  }
  return {
    ok: false,
    failure: `No se pudo armar a ${concept.name} con reglas válidas: ${errors.map((e) => e.message).join(" ")}`,
  };
}

/** Two steps: one call proposes three concepts (species, class, background), then one call per concept, in
    parallel, chooses everything else. Code validates and computes; a concept that fails twice is reported in
    `failures` and the others go on. Model errors (network, key, abort) propagate. */
export async function generateOptions(
  llm: LLMClient, story: string, level: number, signal?: AbortSignal,
): Promise<GenerationResult> {
  if (!Number.isInteger(level) || level < 1 || level > LOADED_MAX_LEVEL) {
    throw new Error(`El nivel debe ser un entero entre 1 y ${LOADED_MAX_LEVEL}.`);
  }
  if (story.trim() === "") throw new Error("La historia está vacía.");

  const concepts = await generateConcepts(llm, story, level, signal);
  const outcomes = await Promise.all(concepts.map((concept) => generateChoices(llm, concept, level, signal)));
  return {
    options: outcomes.flatMap((o) => (o.ok ? [o.option] : [])),
    failures: outcomes.flatMap((o) => (o.ok ? [] : [o.failure])),
  };
}
