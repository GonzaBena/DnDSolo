import { findCampaign, type OfficialCampaign } from "../campaigns";
import { z } from "../domain/zod";
import { toProviderSchema } from "../domain/schemas";
import { LLMError } from "../llm/LLMClient";
import type { LLMClient } from "../llm/LLMClient";
import { buildSheet, replaceRepeatedSkills, replaceRepeatedSpells } from "./buildSheet";
import type { CharacterChoices, ChoiceError } from "./buildSheet";
import { activeChoices, requiredChoices } from "./choices";
import { buildChoicesPrompt, buildConceptPrompt, GENERATOR_SYSTEM_PROMPT, OUTSIDE_SRD_PHRASE } from "./generatorPrompt";
import { BACKGROUNDS, CLASSES_DATA, LOADED_MAX_LEVEL, SPECIES, STANDARD_ARRAY, findBackground } from "./index";
import { ABILITIES } from "./types";
import type { Ability, CharacterSheet, ChoiceSpec } from "./types";

export interface GeneratedOption {
  name: string; story: string; pitch: string;
  outsideSrdNote: string | null; choices: CharacterChoices; sheet: CharacterSheet;
}
export interface GenerationResult { options: GeneratedOption[]; failures: string[] }

/** What the player sees when the model ignored the schema; the Zod detail only goes back to the model. */
const FORMAT_FAILURE = "La respuesta no respetó el formato pedido.";

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

/** `reason` is for the model's retry prompt, not for the player. */
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

/** A model error worth one more attempt: not an abort (the caller gave up) and not a bad key (retrying won't help). */
function retriable(error: unknown, signal?: AbortSignal): error is LLMError {
  return error instanceof LLMError && error.kind !== "auth" && !signal?.aborted;
}

/** The note always starts with the fixed phrase; an empty note means nothing was replaced. */
export function normalizeOutsideSrdNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? "";
  if (trimmed === "") return null;
  return trimmed.startsWith(OUTSIDE_SRD_PHRASE) ? trimmed : `${OUTSIDE_SRD_PHRASE} ${trimmed}`;
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

async function generateConcepts(
  llm: LLMClient,
  story: string,
  level: number,
  signal?: AbortSignal,
  campaign: OfficialCampaign | null = null,
): Promise<ConceptReply[]> {
  let errors: string[] = [];
  let modelError: LLMError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildConceptPrompt(story, level, errors, campaign);
    let raw: string;
    try {
      raw = await llm.generateStructured({ system: GENERATOR_SYSTEM_PROMPT, prompt, jsonSchema: conceptsJsonSchema, signal });
    } catch (error) {
      if (!retriable(error, signal)) throw error;
      modelError = error;
      continue;
    }
    modelError = null;
    const parsed = parseJson(raw, conceptsSchema);
    if (parsed.ok) return parsed.value.concepts;
    errors = [parsed.reason];
  }
  if (modelError) throw modelError;
  throw new Error(`No se pudieron generar los conceptos de personaje. ${FORMAT_FAILURE}`);
}

type ConceptOutcome =
  | { ok: true; option: GeneratedOption }
  /** `modelError` is set when the last attempt failed because the model did not answer. */
  | { ok: false; failure: string; modelError: LLMError | null };

type Problem = { kind: "model"; error: LLMError } | { kind: "format" } | { kind: "rules"; errors: ChoiceError[] };

function failureFor(name: string, problem: Problem): ConceptOutcome {
  switch (problem.kind) {
    case "model":
      return { ok: false, failure: `No se pudo armar a ${name}: el modelo no respondió.`, modelError: problem.error };
    case "format":
      return { ok: false, failure: `No se pudo armar a ${name}. ${FORMAT_FAILURE}`, modelError: null };
    case "rules":
      return {
        ok: false,
        failure: `No se pudo armar a ${name} con reglas válidas: ${problem.errors.map((e) => e.message).join(" ")}`,
        modelError: null,
      };
  }
}

async function generateChoices(
  llm: LLMClient, concept: ConceptReply, level: number, signal?: AbortSignal,
): Promise<ConceptOutcome> {
  const specs = requiredChoices({ ...concept, level });
  const schema = choicesSchema(concept, specs);
  const jsonSchema = toProviderSchema(z.toJSONSchema(schema));
  let errors: ChoiceError[] = []; // sent back to the model on the retry
  let problem: Problem = { kind: "format" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildChoicesPrompt({ ...concept, level }, specs, errors);
    let raw: string;
    try {
      raw = await llm.generateStructured({ system: GENERATOR_SYSTEM_PROMPT, prompt, jsonSchema, signal });
    } catch (error) {
      if (!retriable(error, signal)) throw error;
      problem = { kind: "model", error };
      continue;
    }
    const parsed = parseJson(raw, schema);
    if (!parsed.ok) {
      errors = [{ field: "respuesta", message: parsed.reason }];
      problem = { kind: "format" };
      continue;
    }
    const choices = replaceRepeatedSpells(replaceRepeatedSkills(toChoices(concept, level, specs, parsed.value)));
    const built = buildSheet(choices);
    if (built.ok) {
      const { name, story, pitch } = concept;
      const outsideSrdNote = normalizeOutsideSrdNote(concept.outsideSrdNote);
      return { ok: true, option: { name, story, pitch, outsideSrdNote, choices, sheet: built.sheet } };
    }
    errors = built.errors;
    problem = { kind: "rules", errors };
  }
  return failureFor(concept.name, problem);
}

/** Two steps: one call proposes three concepts (species, class, background), then one call per concept, in
    parallel, chooses everything else. Code validates and computes; a concept that fails twice (invalid choices,
    malformed JSON or a transient model error) is reported in `failures` and the others go on. An abort or an
    auth error rejects the whole call, and so does the last model error when model errors left no option at
    all, so the UI can explain it with describeLLMError. */
export async function generateOptions(
  llm: LLMClient,
  story: string,
  level: number,
  signal?: AbortSignal,
  campaignId?: string | null,
): Promise<GenerationResult> {
  const campaign = findCampaign(campaignId) ?? null;
  const effectiveLevel = campaign ? campaign.startingLevel : level;
  if (!Number.isInteger(effectiveLevel) || effectiveLevel < 1 || effectiveLevel > LOADED_MAX_LEVEL) {
    throw new Error(`El nivel debe ser un entero entre 1 y ${LOADED_MAX_LEVEL}.`);
  }
  if (story.trim() === "") throw new Error("La historia está vacía.");

  const concepts = await generateConcepts(llm, story, effectiveLevel, signal, campaign);
  const outcomes = await Promise.all(concepts.map((concept) => generateChoices(llm, concept, effectiveLevel, signal)));
  const failed = outcomes.flatMap((o) => (o.ok ? [] : [o]));
  const modelErrors = failed.flatMap((o) => (o.modelError ? [o.modelError] : []));
  if (failed.length === outcomes.length && modelErrors.length === failed.length) throw modelErrors.at(-1)!;
  return {
    options: outcomes.flatMap((o) => (o.ok ? [o.option] : [])),
    failures: failed.map((o) => o.failure),
  };
}
