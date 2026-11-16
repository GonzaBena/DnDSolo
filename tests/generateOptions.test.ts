import { describe, expect, it, vi } from "vitest";
import { FakeLLMClient } from "../src/llm/FakeLLMClient";
import { LLMError } from "../src/llm/LLMClient";
import type { LLMClient, StructuredRequest } from "../src/llm/LLMClient";
import { SPECIES } from "../src/rules";
import type { CharacterChoices } from "../src/rules/buildSheet";
import { generateOptions, normalizeOutsideSrdNote } from "../src/rules/generateOptions";
import { OUTSIDE_SRD_PHRASE } from "../src/rules/generatorPrompt";
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

type Reply = object | string | Error;

/** Replies keyed by prompt content instead of call order: step 1 has its own queue, each step-2 call is routed
    by the character name in its prompt. Independent of how the parallel calls interleave. */
class ScriptedClient implements LLMClient {
  readonly requests: StructuredRequest[] = [];
  constructor(private readonly concepts: Reply[], private readonly byName: Record<string, Reply[]>) {}

  async generateStructured(request: StructuredRequest): Promise<string> {
    this.requests.push(request);
    const name = /^- Nombre: (.+)$/m.exec(request.prompt)?.[1];
    const reply = (name === undefined ? this.concepts : this.byName[name] ?? []).shift();
    if (reply === undefined) throw new Error(`ScriptedClient: no reply for ${name ?? "concepts"}.`);
    if (reply instanceof Error) throw reply;
    return typeof reply === "string" ? reply : JSON.stringify(reply);
  }

  async generateText(): Promise<string> {
    throw new Error("ScriptedClient: not used.");
  }

  promptsFor(name: string): string[] {
    return this.requests.map((r) => r.prompt).filter((p) => p.includes(`- Nombre: ${name}\n`));
  }
}

/** Valid replies for the three concepts, with per-name overrides. */
function scripted(byName: Record<string, Reply[]> = {}, concepts: Reply[] = [{ concepts: CONCEPTS }]) {
  return new ScriptedClient(concepts, {
    Brann: [choicesReply(fighterChoices())],
    Ilsa: [replyFor(CONCEPTS[1]!)],
    Vex: [replyFor(CONCEPTS[2]!)],
    ...byName,
  });
}

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
    const llm = scripted({ Brann: [invalidFighter(), choicesReply(fighterChoices())] });
    const result = await generateOptions(llm, STORY, 1);
    expect(result.failures).toEqual([]);
    expect(result.options).toHaveLength(3);
    const [first, retry] = llm.promptsFor("Brann");
    expect(first).not.toContain("ERRORES DEL INTENTO ANTERIOR");
    expect(retry).toContain("ERRORES DEL INTENTO ANTERIOR");
    expect(retry).toContain("Atletismo");
  });

  it("drops a concept that fails twice and keeps the others", async () => {
    const llm = scripted({ Brann: [invalidFighter(), invalidFighter()] });
    const result = await generateOptions(llm, STORY, 1);
    expect(result.options.map((o) => o.name)).toEqual(["Ilsa", "Vex"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("Brann");
    expect(result.failures[0]).toMatch(/no se pudo/i);
    expect(result.failures[0]).toContain("Atletismo");
  });

  it("keeps a concept whose class cantrip repeats one its background feat gives", async () => {
    const ilsa = greedyChoices("dwarf", "cleric", "acolyte", 1);
    const mi = ilsa.picks["feat.magic_initiate_cleric.cantrips"]!;
    const repeated = choicesReply({ ...ilsa, picks: { ...ilsa.picks, "class.cleric.cantrips": [mi[0]!, "light", "mending"] } });
    const llm = scripted({ Ilsa: [repeated] });
    const result = await generateOptions(llm, STORY, 1);
    expect(result.failures).toEqual([]);
    const option = result.options.find((o) => o.name === "Ilsa")!;
    expect(option.choices.picks["class.cleric.cantrips"]).not.toContain(mi[0]);
  });

  it("reports malformed step-2 JSON in plain Spanish and keeps the Zod detail for the retry prompt", async () => {
    const llm = scripted({ Brann: [{ baseScores: {} }, "no es json"] });
    const result = await generateOptions(llm, STORY, 1);
    expect(result.options).toHaveLength(2);
    expect(result.failures).toEqual(["No se pudo armar a Brann. La respuesta no respetó el formato pedido."]);
    expect(llm.promptsFor("Brann")[1]).toMatch(/ERRORES DEL INTENTO ANTERIOR[\s\S]*baseScores/);
  });

  describe("model errors in step 2", () => {
    it("retries once after a transient error", async () => {
      const llm = scripted({ Brann: [new LLMError("network", "offline"), choicesReply(fighterChoices())] });
      const result = await generateOptions(llm, STORY, 1);
      expect(result.failures).toEqual([]);
      expect(result.options).toHaveLength(3);
    });

    it("turns a second error into a failure and keeps the others", async () => {
      const llm = scripted({ Brann: [new LLMError("network", "offline"), new LLMError("empty", "nada")] });
      const result = await generateOptions(llm, STORY, 1);
      expect(result.options.map((o) => o.name)).toEqual(["Ilsa", "Vex"]);
      expect(result.failures).toEqual(["No se pudo armar a Brann: el modelo no respondió."]);
    });

    it("rejects the whole call on an auth error", async () => {
      const llm = scripted({ Brann: [new LLMError("auth", "bad key")] });
      await expect(generateOptions(llm, STORY, 1)).rejects.toMatchObject({ kind: "auth" });
    });

    it("rejects with the last model error when model errors left no option", async () => {
      const down = () => [new LLMError("rate_limit", "quota"), new LLMError("rate_limit", "quota")];
      const llm = scripted({ Brann: down(), Ilsa: down(), Vex: down() });
      await expect(generateOptions(llm, STORY, 1)).rejects.toMatchObject({ kind: "rate_limit" });
    });

    it("does not retry after an abort", async () => {
      const controller = new AbortController();
      const llm = scripted({ Brann: [new LLMError("network", "aborted")] });
      const original = llm.generateStructured.bind(llm);
      llm.generateStructured = async (request) => {
        if (request.prompt.includes("- Nombre: Brann")) controller.abort();
        return original(request);
      };
      await expect(generateOptions(llm, STORY, 1, controller.signal)).rejects.toMatchObject({ kind: "network" });
      expect(llm.promptsFor("Brann")).toHaveLength(1);
    });
  });

  describe("step 1", () => {
    it("retries once with the parse errors in the prompt", async () => {
      const llm = scripted({}, [{ concepts: CONCEPTS.slice(0, 2) }, { concepts: CONCEPTS }]);
      const result = await generateOptions(llm, STORY, 1);
      expect(result.options).toHaveLength(3);
      expect(llm.requests[0]!.prompt).not.toContain("ERRORES DEL INTENTO ANTERIOR");
      expect(llm.requests[1]!.prompt).toMatch(/ERRORES DEL INTENTO ANTERIOR[\s\S]*concepts/);
    });

    it("retries once after an empty answer", async () => {
      const llm = scripted({}, [new LLMError("empty", "nada"), { concepts: CONCEPTS }]);
      expect((await generateOptions(llm, STORY, 1)).options).toHaveLength(3);
    });

    it("gives up in Spanish when it cannot be parsed twice", async () => {
      const llm = scripted({}, ["no es json", { concepts: CONCEPTS.slice(0, 2) }]);
      await expect(generateOptions(llm, STORY, 1)).rejects.toThrow(
        "No se pudieron generar los conceptos de personaje. La respuesta no respetó el formato pedido.",
      );
      expect(llm.requests).toHaveLength(2);
    });

    it("rethrows a second model error and an auth error at once", async () => {
      const twice = scripted({}, [new LLMError("network", "x"), new LLMError("network", "y")]);
      await expect(generateOptions(twice, STORY, 1)).rejects.toMatchObject({ kind: "network", message: "y" });
      const auth = scripted({}, [new LLMError("auth", "bad key")]);
      await expect(generateOptions(auth, STORY, 1)).rejects.toMatchObject({ kind: "auth" });
      expect(auth.requests).toHaveLength(1);
    });
  });

  describe("outsideSrdNote", () => {
    it("is normalized: empty is null and the fixed phrase always comes first", async () => {
      const concepts = [
        { ...CONCEPTS[0]!, outsideSrdNote: "" },
        { ...CONCEPTS[1]!, outsideSrdNote: "Pediste un vampiro; usé un tiefling." },
        { ...CONCEPTS[2]!, outsideSrdNote: `${OUTSIDE_SRD_PHRASE} Pediste un ninja; usé un pícaro.` },
      ];
      const result = await generateOptions(scripted({}, [{ concepts }]), STORY, 1);
      expect(result.options.map((o) => o.outsideSrdNote)).toEqual([
        null,
        `${OUTSIDE_SRD_PHRASE} Pediste un vampiro; usé un tiefling.`,
        `${OUTSIDE_SRD_PHRASE} Pediste un ninja; usé un pícaro.`,
      ]);
      expect(normalizeOutsideSrdNote(null)).toBeNull();
      expect(normalizeOutsideSrdNote("   ")).toBeNull();
    });
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
    const llm = scripted();
    await generateOptions(llm, STORY, 1);
    const request = llm.requests.find((r) => r.prompt.includes("- Nombre: Brann\n"))!;
    type Enum = { type: string; enum: (string | number)[] };
    const schema = request.jsonSchema as {
      properties: {
        baseScores: { properties: Record<string, Enum> };
        backgroundBonus: { items: { properties: { ability: Enum; amount: Enum } } };
        classEquipment: Enum;
        backgroundEquipment: Enum;
        picks: { items: { properties: { choiceId: Enum } } };
      };
    };
    const { baseScores, backgroundBonus, classEquipment, backgroundEquipment, picks } = schema.properties;
    expect(Object.keys(baseScores.properties).sort()).toEqual([...ABILITIES].sort());
    expect(baseScores.properties.str).toEqual({ type: "integer", enum: [15, 14, 13, 12, 10, 8] });
    expect(backgroundBonus.items.properties.amount).toEqual({ type: "integer", enum: [1, 2] });
    expect(backgroundBonus.items.properties.ability.enum.sort()).toEqual(["con", "dex", "str"]);
    expect(classEquipment.enum).toEqual(["A", "B", "C"]);
    expect(backgroundEquipment.enum).toEqual(["A", "B"]);
    const choiceIds = picks.items.properties.choiceId.enum;
    expect(choiceIds).toContain("class.fighter.skills");
    expect(choiceIds).toContain("feat.skilled.skills"); // conditional: Versatile -> Skilled
    // Prompt: id, label, count, options and the condition of conditional specs.
    expect(request.prompt).toContain("class.fighter.skills");
    expect(request.prompt).toContain("athletics — Atletismo");
    expect(request.prompt).toMatch(/feat\.skilled\.skills[\s\S]*solo si en species\.human\.versatile elegiste skilled/i);
    expect(request.prompt).toContain("Fuerza"); // primary ability
  });

  it("drops picks of choices that are not active instead of failing", async () => {
    const reply = choicesReply(fighterChoices());
    reply.picks.push({ choiceId: "feat.skilled.skills", optionIds: ["history", "arcana", "religion"] });
    const result = await generateOptions(scripted({ Brann: [reply] }), STORY, 1);
    expect(result.failures).toEqual([]);
    expect(result.options[0]!.choices.picks["feat.skilled.skills"]).toBeUndefined();
  });

  it("runs the three step-2 calls in parallel", async () => {
    const inner = scripted();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started = 0;
    const gated: LLMClient = {
      async generateStructured(request: StructuredRequest) {
        started += 1;
        if (started > 1) await gate; // hold every step-2 call until all of them started
        return inner.generateStructured(request);
      },
      generateText: () => inner.generateText(),
    };
    const pending = generateOptions(gated, STORY, 1);
    await vi.waitFor(() => expect(started).toBe(4), { timeout: 500 });
    release();
    expect((await pending).options).toHaveLength(3);
  });

  it("works at level 4 for a wizard", async () => {
    const wizard: ConceptReply = { ...CONCEPTS[0]!, speciesId: "gnome", classId: "wizard", backgroundId: "sage" };
    const llm = scripted(
      { Brann: [replyFor(wizard, 4)], Ilsa: [replyFor(CONCEPTS[1]!, 4)], Vex: [replyFor(CONCEPTS[2]!, 4)] },
      [{ concepts: [wizard, CONCEPTS[1], CONCEPTS[2]] }],
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
