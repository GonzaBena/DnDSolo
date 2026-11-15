import { describe, expect, it, vi } from "vitest";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import type { LLMClient, StructuredRequest, TextRequest } from "../src/llm/LLMClient";
import { SPECIES } from "../src/rules";
import type { CharacterChoices } from "../src/rules/buildSheet";
import { generateOptions } from "../src/rules/generateOptions";
import { ABILITIES } from "../src/rules/types";
import { fighterChoices, greedyChoices } from "./helpers";

const STORY = "Fui soldado en la guerra del norte y ahora busco a mi hermano desaparecido.";

interface ConceptReply {
  name: string; story: string; pitch: string; outsideSrdNote: string | null;
  speciesId: string; classId: string; backgroundId: string;
}

const CONCEPTS: ConceptReply[] = [
  { name: "Brann", story: "Veterano del norte.", pitch: "Un muro de acero.", outsideSrdNote: null, speciesId: "human", classId: "fighter", backgroundId: "soldier" },
  { name: "Ilsa", story: "Sanadora del frente.", pitch: "Fe en la trinchera.", outsideSrdNote: null, speciesId: "dwarf", classId: "cleric", backgroundId: "acolyte" },
  { name: "Vex", story: "Explorador perdido.", pitch: "Sombra entre los pinos.", outsideSrdNote: null, speciesId: "elf", classId: "rogue", backgroundId: "criminal" },
];

/** What the model sends in step 2: the choices with arrays instead of records. */
function choicesReply(c: CharacterChoices) {
  return {
    baseScores: c.baseScores,
    backgroundBonus: Object.entries(c.backgroundBonus).map(([ability, amount]) => ({ ability, amount })),
    classEquipment: c.classEquipment,
    backgroundEquipment: c.backgroundEquipment,
    picks: Object.entries(c.picks).map(([choiceId, optionIds]) => ({ choiceId, optionIds })),
  };
}

const replyFor = (concept: ConceptReply, level = 1) =>
  choicesReply(greedyChoices(concept.speciesId, concept.classId, concept.backgroundId, level));

/** The fighter repeats Athletics, which the soldier background already gives. */
const invalidFighter = () =>
  choicesReply(fighterChoices({ picks: { ...fighterChoices().picks, "class.fighter.skills": ["athletics", "survival"] } }));

describe("generateOptions", () => {
  it("returns three options with computed sheets", async () => {
    const llm = new FakeLLMClient().queueStructured(
      { concepts: CONCEPTS },
      choicesReply(fighterChoices()),
      replyFor(CONCEPTS[1]!),
      replyFor(CONCEPTS[2]!),
    );
    const result = await generateOptions(llm, STORY, 1);
    expect(result.failures).toEqual([]);
    expect(result.options.map((o) => o.name)).toEqual(["Brann", "Ilsa", "Vex"]);
    expect(result.options[0]!.sheet.className).toBe("Guerrero");
    expect(result.options[0]!.choices.picks["class.fighter.skills"]).toEqual(["acrobatics", "survival"]);
    expect(result.options[1]!.sheet.species).toBe(SPECIES.find((s) => s.id === "dwarf")!.name);
    expect(llm.structuredRequests).toHaveLength(4);
    expect(llm.structuredRequests[0]!.prompt).toContain(STORY);
  });

  it("retries a step-2 call once with the previous errors", async () => {
    const llm = new FakeLLMClient().queueStructured(
      { concepts: CONCEPTS },
      invalidFighter(),
      replyFor(CONCEPTS[1]!),
      replyFor(CONCEPTS[2]!),
      choicesReply(fighterChoices()),
    );
    const result = await generateOptions(llm, STORY, 1);
    expect(result.failures).toEqual([]);
    expect(result.options).toHaveLength(3);
    const retry = llm.structuredRequests[4]!.prompt;
    expect(retry).toContain("ERRORES DEL INTENTO ANTERIOR");
    expect(retry).toContain("Atletismo");
    expect(llm.structuredRequests[1]!.prompt).not.toContain("ERRORES DEL INTENTO ANTERIOR");
  });

  it("drops a concept that fails twice and keeps the others", async () => {
    const llm = new FakeLLMClient().queueStructured(
      { concepts: CONCEPTS },
      invalidFighter(),
      replyFor(CONCEPTS[1]!),
      replyFor(CONCEPTS[2]!),
      invalidFighter(),
    );
    const result = await generateOptions(llm, STORY, 1);
    expect(result.options.map((o) => o.name)).toEqual(["Ilsa", "Vex"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("Brann");
    expect(result.failures[0]).toMatch(/no se pudo/i);
    expect(result.failures[0]).toContain("Atletismo");
  });

  it("retries step 1 once when it cannot be parsed", async () => {
    const llm = new FakeLLMClient().queueStructured(
      "no es json",
      { concepts: CONCEPTS },
      choicesReply(fighterChoices()),
      replyFor(CONCEPTS[1]!),
      replyFor(CONCEPTS[2]!),
    );
    const result = await generateOptions(llm, STORY, 1);
    expect(result.options).toHaveLength(3);
  });

  it("gives up when step 1 fails twice", async () => {
    const llm = new FakeLLMClient().queueStructured("no es json", { concepts: CONCEPTS.slice(0, 2) });
    await expect(generateOptions(llm, STORY, 1)).rejects.toThrow(/conceptos/);
    expect(llm.structuredRequests).toHaveLength(2);
  });

  it("restricts step-1 ids to the catalog", async () => {
    const llm = new FakeLLMClient().queueStructured("x", "x");
    await generateOptions(llm, STORY, 1).catch(() => undefined);
    const schema = llm.structuredRequests[0]!.jsonSchema as {
      properties: { concepts: { minItems: number; maxItems: number; items: { properties: Record<string, { enum?: string[] }> } } };
    };
    const concept = schema.properties.concepts;
    expect(concept.items.properties.speciesId!.enum).toHaveLength(9);
    expect(new Set(concept.items.properties.speciesId!.enum)).toEqual(new Set(SPECIES.map((s) => s.id)));
    expect(concept.items.properties.classId!.enum).toHaveLength(12);
    expect(concept.minItems).toBe(3);
    expect(concept.maxItems).toBe(3);
    expect(llm.structuredRequests[0]!.system).toContain(
      "Eso no lo tengo, revisalo en tu manual o podés disfrutar las alucinaciones.",
    );
  });

  it("builds the step-2 schema and prompt from the concept's specs", async () => {
    const llm = new FakeLLMClient().queueStructured(
      { concepts: CONCEPTS },
      choicesReply(fighterChoices()),
      replyFor(CONCEPTS[1]!),
      replyFor(CONCEPTS[2]!),
    );
    await generateOptions(llm, STORY, 1);
    const request = llm.structuredRequests[1]!;
    const schema = request.jsonSchema as {
      properties: {
        baseScores: { properties: Record<string, unknown> };
        backgroundBonus: { items: { properties: { ability: { enum: string[] } } } };
        classEquipment: { enum: string[] };
        backgroundEquipment: { enum: string[] };
        picks: { items: { properties: { choiceId: { enum: string[] } } } };
      };
    };
    expect(Object.keys(schema.properties.baseScores.properties).sort()).toEqual([...ABILITIES].sort());
    expect(schema.properties.backgroundBonus.items.properties.ability.enum.sort()).toEqual(["con", "str", "dex"].sort());
    expect(schema.properties.classEquipment.enum).toEqual(["A", "B", "C"]);
    expect(schema.properties.backgroundEquipment.enum).toEqual(["A", "B"]);
    const choiceIds = schema.properties.picks.items.properties.choiceId.enum;
    expect(choiceIds).toContain("class.fighter.skills");
    expect(choiceIds).toContain("feat.skilled.skills"); // conditional: Versatile -> Skilled
    // Prompt: id, label, count, options and the condition of conditional specs.
    expect(request.prompt).toContain("class.fighter.skills");
    expect(request.prompt).toContain("athletics — Atletismo");
    expect(request.prompt).toMatch(/feat\.skilled\.skills[\s\S]*solo si en species\.human\.versatile elegiste skilled/i);
    expect(request.prompt).toContain("Fuerza"); // primary ability
  });

  it("drops picks of choices that are not active instead of failing", async () => {
    const fighter = fighterChoices();
    const reply = choicesReply(fighter);
    reply.picks.push({ choiceId: "feat.skilled.skills", optionIds: ["history", "arcana", "religion"] });
    const llm = new FakeLLMClient().queueStructured({ concepts: CONCEPTS }, reply, replyFor(CONCEPTS[1]!), replyFor(CONCEPTS[2]!));
    const result = await generateOptions(llm, STORY, 1);
    expect(result.failures).toEqual([]);
    expect(result.options[0]!.choices.picks["feat.skilled.skills"]).toBeUndefined();
  });

  it("runs the three step-2 calls in parallel", async () => {
    const fake = new FakeLLMClient().queueStructured(
      { concepts: CONCEPTS },
      choicesReply(fighterChoices()),
      replyFor(CONCEPTS[1]!),
      replyFor(CONCEPTS[2]!),
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started = 0;
    const gated: LLMClient = {
      async generateStructured(request: StructuredRequest) {
        started += 1;
        if (started > 1) await gate; // hold every step-2 call until all of them started
        return fake.generateStructured(request);
      },
      generateText: (request: TextRequest) => fake.generateText(request),
    };
    const pending = generateOptions(gated, STORY, 1);
    await vi.waitFor(() => expect(started).toBe(4), { timeout: 500 });
    release();
    expect((await pending).options).toHaveLength(3);
  });

  it("works at level 4 for a wizard", async () => {
    const wizard: ConceptReply = { ...CONCEPTS[0]!, speciesId: "gnome", classId: "wizard", backgroundId: "sage" };
    const llm = new FakeLLMClient().queueStructured(
      { concepts: [wizard, CONCEPTS[1], CONCEPTS[2]] },
      replyFor(wizard, 4),
      replyFor(CONCEPTS[1]!, 4),
      replyFor(CONCEPTS[2]!, 4),
    );
    const result = await generateOptions(llm, STORY, 4);
    expect(result.failures).toEqual([]);
    expect(result.options[0]!.sheet.subclass).not.toBeNull();
  });

  it("rejects a level outside the loaded range or an empty story without calling the model", async () => {
    const llm = new FakeLLMClient();
    await expect(generateOptions(llm, STORY, 5)).rejects.toThrow(/nivel/i);
    await expect(generateOptions(llm, STORY, 0)).rejects.toThrow(/nivel/i);
    await expect(generateOptions(llm, "   ", 1)).rejects.toThrow(/historia/i);
    expect(llm.structuredRequests).toHaveLength(0);
  });
});
