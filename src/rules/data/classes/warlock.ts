import type { ClassData, LevelRow, Option } from "../../types";
import { ASI_TRAIT, SOURCE, level4FeatChoice, subclassTrait } from "./common";

const free = (spellId: string): Pick<Option, "spells"> => ({ spells: [{ fromLevel: 1, spellId }] });

// Invocations without a level prerequisite (available at level 1).
const LEVEL_1_INVOCATIONS: Option[] = [
  { id: "armor_of_shadows", name: "Armadura de sombras", summary: "Podés lanzar armadura de mago sobre vos sin gastar espacio de conjuro.", ...free("mage_armor") },
  { id: "eldritch_mind", name: "Mente sobrenatural", summary: "Tenés ventaja en las salvaciones de Constitución para mantener la concentración." },
  {
    id: "pact_of_the_blade", name: "Pacto del filo",
    summary: "Como acción adicional conjurás un arma de pacto cuerpo a cuerpo (o te vinculás con un arma mágica): tenés competencia con ella, la usás como canalizador, atacás con Carisma y podés infligir daño necrótico, psíquico o radiante.",
  },
  {
    id: "pact_of_the_chain", name: "Pacto de la cadena",
    summary: "Aprendés encontrar familiar y lo lanzás como acción de magia sin gastar espacio, con formas especiales (diablillo, duende, esfinge de las maravillas, esqueleto, pseudodragón, quasit, serpiente venenosa). Tu familiar puede atacar usando uno de tus ataques.",
    ...free("find_familiar"),
  },
  {
    id: "pact_of_the_tome", name: "Pacto del grimorio",
    summary: "Al terminar un descanso conjurás un Libro de las sombras con tres trucos y dos conjuros rituales de nivel 1 de cualquier lista, que tenés preparados mientras lo llevés; sirve de canalizador.",
  },
];

// Invocations whose only prerequisite is a Warlock level of 2 or lower (plus cantrip prerequisites noted in the summary).
// Level 5+ options (e.g. Eldritch Smite, Thirsting Blade) are added when higher levels are loaded.
const LEVEL_2_INVOCATIONS: Option[] = [
  {
    id: "agonizing_blast", name: "Descarga agónica", repeatable: true,
    summary: "Requisito: brujo de nivel 2+ y un truco de brujo que cause daño. Sumás tu modificador de Carisma al daño de ese truco. Repetible con un truco distinto cada vez.",
  },
  { id: "devils_sight", name: "Vista del diablo", summary: "Requisito: brujo de nivel 2+. Ves con normalidad en luz tenue y oscuridad, mágica o no, a 36 m." },
  {
    id: "eldritch_spear", name: "Lanza sobrenatural", repeatable: true,
    summary: "Requisito: brujo de nivel 2+ y un truco de brujo que cause daño con alcance de 3 m o más. Su alcance aumenta 10 m por nivel de brujo. Repetible con un truco distinto cada vez.",
  },
  {
    id: "fiendish_vigor", name: "Vigor infernal",
    summary: "Requisito: brujo de nivel 2+. Lanzás falsa vida sobre vos sin gastar espacio y obtenés el máximo del dado de puntos de golpe temporales.",
    ...free("false_life"),
  },
  {
    id: "lessons_of_the_first_ones", name: "Lecciones de los primeros", repeatable: true,
    summary: "Requisito: brujo de nivel 2+. Obtenés una dote de origen a elección. Repetible con una dote de origen distinta cada vez.",
  },
  {
    id: "mask_of_many_faces", name: "Máscara de los mil rostros",
    summary: "Requisito: brujo de nivel 2+. Lanzás disfrazarse sin gastar espacio de conjuro.", ...free("disguise_self"),
  },
  {
    id: "misty_visions", name: "Visiones brumosas",
    summary: "Requisito: brujo de nivel 2+. Lanzás imagen silenciosa sin gastar espacio de conjuro.", ...free("silent_image"),
  },
  {
    id: "otherworldly_leap", name: "Salto sobrenatural",
    summary: "Requisito: brujo de nivel 2+. Lanzás salto sobre vos sin gastar espacio de conjuro.", ...free("jump"),
  },
  {
    id: "repelling_blast", name: "Descarga ahuyentadora", repeatable: true,
    summary: "Requisito: brujo de nivel 2+ y un truco de brujo que requiera tirada de ataque. Al acertar a una criatura Grande o menor, la empujás hasta 3 m. Repetible con un truco distinto cada vez.",
  },
];

// Cantrips, prepared spells, Pact Magic slots and invocation count from the SRD table "Rasgos de brujo":
// 1 invocation at level 1 and 3 from level 2 (so 2 more at level 2).
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: {}, cantrips: 2, preparedSpells: 2, pactSlots: { count: 1, slotLevel: 1 },
    features: [
      {
        name: "Invocaciones sobrenaturales",
        summary: "Obtenés una invocación sobrenatural (como Pacto del grimorio); ganás más al subir de nivel (3 en total desde el nivel 2). Algunas tienen requisitos de nivel de brujo o de otra invocación, y podés cambiar una cada vez que subís de nivel.",
      },
      {
        name: "Magia del pacto",
        summary: "Lanzás conjuros de brujo con Carisma como aptitud mágica; un canalizador arcano sirve de canalizador. Conocés 2 trucos y preparás conjuros de nivel 1 y superiores. Tus espacios, todos del mismo nivel, se recuperan en descanso corto o largo.",
      },
    ],
    choices: [
      { id: "class.warlock.invocation", label: "Invocación sobrenatural", count: 1, options: LEVEL_1_INVOCATIONS },
    ],
  },
  {
    level: 2, proficiencyBonus: 2, resources: {}, cantrips: 2, preparedSpells: 3, pactSlots: { count: 2, slotLevel: 1 },
    features: [
      {
        name: "Astucia mágica",
        summary: "Con un rito de 1 minuto recuperás espacios de Magia del pacto gastados, hasta la mitad de tu máximo (redondeando hacia arriba). Una vez por descanso largo.",
      },
    ],
    choices: [
      { id: "class.warlock.invocation_2", label: "Invocaciones sobrenaturales (nivel 2)", count: 2, options: [...LEVEL_1_INVOCATIONS, ...LEVEL_2_INVOCATIONS] },
    ],
  },
  {
    level: 3, proficiencyBonus: 2, resources: {}, cantrips: 2, preparedSpells: 4, pactSlots: { count: 2, slotLevel: 2 },
    features: [subclassTrait("brujo", "Patrón infernal")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: {}, cantrips: 3, preparedSpells: 5, pactSlots: { count: 2, slotLevel: 2 },
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("warlock")],
  },
];

export const WARLOCK: ClassData = {
  id: "warlock", name: "Brujo", source: SOURCE,
  hitDie: 8, primaryAbility: ["cha"], saves: ["wis", "cha"],
  skillChoice: {
    count: 2,
    options: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
  },
  armor: ["Armaduras ligeras"],
  weapons: ["Armas sencillas"],
  tools: [],
  weaponMasteryCount: 0,
  equipment: {
    A: {
      items: [
        "leather_armor", "sickle", "dagger", "dagger", "text:Canalizador arcano (orbe)", "text:Libro (conocimientos ocultistas)",
        "text:Paquete de erudito",
      ],
      gold: 15,
    },
    B: { items: [], gold: 100 },
    C: undefined,
  },
  spellcasting: { ability: "cha", spellList: "warlock" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "fiend", name: "Patrón infernal", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Bendición del oscuro",
          summary: "Al reducir a 0 puntos de golpe a un enemigo (o si otra criatura lo hace a 3 m de vos) obtenés puntos de golpe temporales iguales a tu modificador de Carisma más tu nivel de brujo (mín. 1).",
        },
      },
      {
        level: 3,
        feature: {
          name: "Conjuros del infernal",
          summary: "Siempre tenés preparados manos ardientes, orden imperiosa, rayo abrasador y sugestión (nivel 3); bola de fuego y nube apestosa (nivel 5).",
          spells: ["burning_hands", "command", "scorching_ray", "suggestion"],
        },
      },
    ],
  },
};
