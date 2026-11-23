import type { OfficialCampaign } from "../campaigns";
import type { ChoiceError } from "./buildSheet";
import { isExpertise } from "./choices";
import { BACKGROUNDS, CLASSES_DATA, SPECIES, STANDARD_ARRAY, findBackground, findFeat, findItem, findSpell } from "./index";
import { alwaysPreparedSpells } from "./sheet";
import { ABILITY_NAMES, SKILLS, requirementsOf } from "./types";
import type { Ability, ChoiceSpec, ClassData, SkillId } from "./types";

// Prompts are in Spanish (content, not code), in the same voice as dmPrompt.ts.
// The model only chooses ids; the code validates and computes the sheet.

export const OUTSIDE_SRD_PHRASE = "Eso no lo tengo, revisalo en tu manual o podés disfrutar las alucinaciones.";

export const GENERATOR_SYSTEM_PROMPT = `Sos un asistente que arma personajes de D&D 2024 (SRD 5.2) a partir de la historia que cuenta un jugador. Hablás en español rioplatense.

CÓMO ELEGIR
- Solo elegís entre los ids que te damos; nunca inventes ids, reglas ni números. El sistema valida tus elecciones y calcula toda la hoja.
- Elegí lo que mejor encaje con la historia del jugador: su oficio, su pasado, su forma de pelear y su personalidad.
- Si la historia pide algo que no está en el catálogo (una especie, clase, subclase, trasfondo, conjuro u objeto que no figura), elegí lo más parecido que sí esté y completá "outsideSrdNote" con esta frase exacta: "${OUTSIDE_SRD_PHRASE}" seguida de qué pidió la historia y con qué lo reemplazaste. Si todo entra en el catálogo, "outsideSrdNote" es null.

ATRIBUTOS
- Las puntuaciones base usan la matriz estándar (${STANDARD_ARRAY.join(", ")}): cada valor una sola vez, uno por característica.
- Poné los valores más altos en el atributo principal de la clase y después en lo que la historia y la clase necesiten (Constitución suele convenir).

FORMATO
- Respondé únicamente con el JSON del esquema indicado, sin texto afuera. Los textos ("name", "story", "pitch", "outsideSrdNote") van en español.`;

const abilityNames = (abilities: Ability[]) => abilities.map((a) => ABILITY_NAMES[a]).join(", ");
const skillName = (id: SkillId) => SKILLS.find((s) => s.id === id)?.name ?? id;

function classLine(cls: ClassData): string {
  const caster = cls.spellcasting ? `; lanza conjuros con ${ABILITY_NAMES[cls.spellcasting.ability]}` : "";
  return `- ${cls.id} — ${cls.name} (subclase: ${cls.subclass.name}, desde nivel ${cls.subclass.level}; ` +
    `atributo principal: ${cls.primaryAbility.map((a) => ABILITY_NAMES[a]).join(" o ")}${caster})`;
}

/** Appended on a retry: why the previous answer was rejected. */
function retrySection(problems: string[]): string[] {
  if (problems.length === 0) return [];
  return [
    "",
    "ERRORES DEL INTENTO ANTERIOR",
    "Tu respuesta anterior no era válida. Corregí estos problemas y mandá la respuesta completa de nuevo:",
    ...problems.map((p) => `- ${p}`),
  ];
}

export function buildConceptPrompt(
  story: string,
  level: number,
  errors: string[] = [],
  campaign: OfficialCampaign | null = null,
): string {
  return [
    "HISTORIA DEL JUGADOR",
    story.trim(),
    "",
    `NIVEL: ${level}`,
    ...(campaign
      ? [
          "",
          `CAMPAÑA ELEGIDA: ${campaign.title}`,
          campaign.generatorPromptHook,
          'Conectá la historia ("story") y el concepto ("pitch") de cada personaje con este punto de partida.',
        ]
      : []),
    "",
    "TAREA",
    "Proponé exactamente 3 conceptos de personaje distintos que encajen con la historia (si podés, de clases distintas). Para cada uno:",
    '- "name": nombre del personaje.',
    '- "story": la historia del jugador contada para ese personaje, en 2 a 4 oraciones.',
    '- "pitch": una frase que venda el concepto.',
    '- "outsideSrdNote": null, o la frase fija más qué se reemplazó (ver instrucciones).',
    '- "speciesId", "classId", "backgroundId": ids de las listas de abajo.',
    "",
    "ESPECIES",
    ...SPECIES.map((s) => `- ${s.id} — ${s.name}`),
    "",
    "CLASES",
    ...CLASSES_DATA.map(classLine),
    "",
    "TRASFONDOS",
    ...BACKGROUNDS.map((b) =>
      `- ${b.id} — ${b.name} (atributos: ${abilityNames(b.abilities)}; dote: ${findFeat(b.featId)?.name ?? b.featId}; ` +
      `habilidades: ${b.skills.map(skillName).join(", ")})`),
    ...retrySection(errors),
  ].join("\n");
}

export interface ChoicesPromptInput {
  name: string; story: string;
  speciesId: string; classId: string; backgroundId: string; level: number;
}

/** "Jabalina ×7" instead of seven lines; "text:" items are already Spanish text. */
function itemList(items: string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.startsWith("text:") ? item.slice(5) : findItem(item)?.name ?? item;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(", ");
}

function equipmentLines(cls: ClassData, backgroundId: string): string[] {
  const background = findBackground(backgroundId)!;
  const classOptions = (["A", "B", "C"] as const).flatMap((key) => {
    const option = cls.equipment[key];
    if (!option) return [];
    const items = option.items.length > 0 ? `${itemList(option.items)} y ` : "";
    return [`  ${key}: ${items}${option.gold} po`];
  });
  return [
    `- "classEquipment" (${cls.name}):`,
    ...classOptions,
    `- "backgroundEquipment" (${background.name}):`,
    `  A: ${itemList(background.equipment.A)} y ${background.gold.A} po`,
    `  B: ${background.equipment.B.length > 0 ? `${itemList(background.equipment.B)} y ` : ""}${background.gold.B} po`,
  ];
}

function conditionText(spec: ChoiceSpec): string | null {
  const requirements = requirementsOf(spec);
  if (requirements.length === 0) return null;
  const [first, ...rest] = requirements.map((r) => `en ${r.choiceId} elegiste ${r.optionId}`);
  return `solo si ${first}${rest.map((r) => ` (o ${r})`).join("")}`;
}

/** Each spec with id, label, count, condition and options. Identical option lists are printed once. */
export function describeSpecs(specs: ChoiceSpec[]): string[] {
  const printed = new Map<string, string>(); // option-id signature -> spec id that printed them
  return specs.map((spec) => {
    const extras = [
      `elegí ${spec.count}`,
      spec.allowRepeat ? "se puede repetir una opción" : null,
      conditionText(spec),
    ].filter((x) => x !== null);
    const signature = spec.options.map((o) => o.id).join("|");
    const seen = printed.get(signature);
    let options: string;
    if (seen) {
      options = `las mismas que ${seen}`;
    } else {
      printed.set(signature, spec.id);
      options = spec.options.map((o) => `${o.id} — ${o.name}${o.repeatable ? " (repetible)" : ""}`).join("; ");
    }
    return `- ${spec.id} — ${spec.label} — ${extras.join("; ")}\n  Opciones: ${options}`;
  });
}

export function buildChoicesPrompt(concept: ChoicesPromptInput, specs: ChoiceSpec[], errors: ChoiceError[] = []): string {
  const species = SPECIES.find((s) => s.id === concept.speciesId)!;
  const cls = CLASSES_DATA.find((c) => c.id === concept.classId)!;
  const background = findBackground(concept.backgroundId)!;
  const known = [
    ...background.skills.map((s) => `${skillName(s)} (trasfondo)`),
    ...species.fixedSkills.map((s) => `${skillName(s)} (especie)`),
  ];
  const fixedSpells = [
    ...(species.spells ?? []).filter((g) => g.fromLevel <= concept.level).map((g) => g.spellId),
    ...alwaysPreparedSpells(cls, concept.level),
  ].map((id) => findSpell(id)?.name ?? id);

  const lines = [
    "PERSONAJE",
    `- Nombre: ${concept.name}`,
    `- Historia: ${concept.story}`,
    `- Especie: ${species.name}. Clase: ${cls.name}, nivel ${concept.level}` +
      `${concept.level >= cls.subclass.level ? ` (subclase ${cls.subclass.name}, la asigna el sistema)` : ""}. ` +
      `Trasfondo: ${background.name}.`,
    "",
    "ATRIBUTOS",
    `- "baseScores": la matriz estándar (${STANDARD_ARRAY.join(", ")}), cada valor una vez, uno por característica (str, dex, con, int, wis, cha).`,
    `- Atributo principal de ${cls.name}: ${cls.primaryAbility.map((a) => ABILITY_NAMES[a]).join(" o ")}. Poné ahí el valor más alto.`,
    `- "backgroundBonus": +2 a una y +1 a otra, o +1 a las tres, solo entre las de ${background.name}: ${abilityNames(background.abilities)}. ` +
      "Ninguna puntuación puede pasar de 20.",
    "",
    "EQUIPO",
    ...equipmentLines(cls, concept.backgroundId),
    "",
    "REGLAS DE LAS ELECCIONES",
    '- En "picks" va una entrada por cada elección de la lista que corresponda: "choiceId" es el id de la elección y "optionIds" los ids de las opciones, exactamente la cantidad pedida.',
    '- Las elecciones marcadas "solo si" van únicamente si hiciste esa elección; si no, no las incluyas. Si una opción repetible desbloquea una elección y la elegiste varias veces, esa elección pide la cantidad multiplicada.',
    "- No repitas opciones dentro de una elección ni entre elecciones (habilidades, idiomas, conjuros, dotes, maestrías, invocaciones), salvo las marcadas como repetibles.",
    `- Ya tenés estas habilidades, no las elijas de nuevo: ${known.join(", ")}.`,
    ...(fixedSpells.length > 0 ? [`- Ya conocés o tenés siempre preparados estos conjuros, no los elijas: ${fixedSpells.join(", ")}.`] : []),
    "- Un conjuro se aprende de una sola fuente: si tu linaje, legado o una dote (como Iniciado en la magia) ya te da un conjuro, no lo elijas de nuevo en los trucos o conjuros de clase.",
    ...(specs.some((s) => isExpertise(s.id)) ? ["- La pericia solo puede ir en habilidades en las que ya tengas competencia."] : []),
    ...(cls.id === "wizard" ? ["- Los conjuros preparados del mago tienen que estar en su libro de conjuros."] : []),
    ...(cls.id === "warlock" ? ["- Los trucos que mejora una invocación tienen que ser trucos de brujo que ya conozcas."] : []),
    "",
    "ELECCIONES",
    ...describeSpecs(specs),
  ];
  return [...lines, ...retrySection(errors.map((e) => `${e.field}: ${e.message}`))].join("\n");
}
