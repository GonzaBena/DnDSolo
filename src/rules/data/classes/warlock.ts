import type { ClassData, LevelRow, Option } from "../../types";
import { ASI_TRAIT, SOURCE, asiFeatChoice, level4FeatChoice, subclassTrait } from "./common";

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

// Invocations of warlock level 5, 7 and 9 from the SRD "Opciones de invocación sobrenatural". `prerequisite` is the
// invocation they need (Pact of the Blade, Chain or Tome), checked on validation.
const LEVEL_5_INVOCATIONS: Option[] = [
  {
    id: "ascendant_step", name: "Paso ascendente",
    summary: "Requisito: brujo de nivel 5+. Lanzás levitar sobre vos sin gastar espacio de conjuro.", ...free("levitate"),
  },
  {
    id: "eldritch_smite", name: "Castigo arcano", prerequisite: "pact_of_the_blade",
    summary: "Requisito: brujo de nivel 5+ y Pacto del filo. Una vez por turno, al acertar con tu arma de pacto, gastás un espacio de Magia del pacto: 1d8 de daño de fuerza más 1d8 por nivel del espacio, y podés derribar al objetivo si es Enorme o menor.",
  },
  {
    id: "gaze_of_two_minds", name: "Mirada de las dos mentes",
    summary: "Requisito: brujo de nivel 5+. Con una acción adicional tocás a una criatura voluntaria y percibís a través de sus sentidos hasta el final de tu siguiente turno (podés mantenerlo cada turno); podés lanzar conjuros como si estuvieras en su espacio si está a 18 m.",
  },
  {
    id: "gift_of_the_depths", name: "Don de las profundidades",
    summary: "Requisito: brujo de nivel 5+. Respirás bajo el agua, tenés velocidad nadando igual a tu velocidad y lanzás respirar bajo el agua una vez sin gastar espacio (se recupera en descanso largo).",
    ...free("water_breathing"),
  },
  {
    id: "investment_of_the_chain_master", name: "Inversión del amo de las cadenas", prerequisite: "pact_of_the_chain",
    summary: "Requisito: brujo de nivel 5+ y Pacto de la cadena. Tu familiar gana velocidad nadando o volando de 12 m, puede atacar como acción adicional tuya, su daño físico puede ser necrótico o radiante, usa tu CD de conjuros y con tu reacción le das resistencia a un daño.",
  },
  {
    id: "master_of_myriad_forms", name: "Maestro de las formas innumerables",
    summary: "Requisito: brujo de nivel 5+. Lanzás alterar el propio aspecto sin gastar espacio de conjuro.", ...free("alter_self"),
  },
  {
    id: "one_with_shadows", name: "Uno con las sombras",
    summary: "Requisito: brujo de nivel 5+. En luz tenue u oscuridad, lanzás invisibilidad sobre vos sin gastar espacio de conjuro.",
    ...free("invisibility"),
  },
  {
    id: "thirsting_blade", name: "Filo sediento", prerequisite: "pact_of_the_blade",
    summary: "Requisito: brujo de nivel 5+ y Pacto del filo. Con tu arma de pacto hacés dos ataques en lugar de uno al realizar la acción de atacar.",
  },
];

const LEVEL_7_INVOCATIONS: Option[] = [
  {
    id: "whispers_of_the_grave", name: "Susurros del sepulcro",
    summary: "Requisito: brujo de nivel 7+. Lanzás hablar con los muertos sin gastar espacio de conjuro.", ...free("speak_with_dead"),
  },
];

const LEVEL_9_INVOCATIONS: Option[] = [
  {
    id: "gift_of_the_protectors", name: "Don de los protectores", prerequisite: "pact_of_the_tome",
    summary: "Requisito: brujo de nivel 9+ y Pacto del grimorio. Tu Libro de las sombras tiene una página donde caben tantos nombres como tu modificador de Carisma (mín. 1): la primera de esas criaturas que caiga a 0 puntos de golpe sin morir queda en 1. Una vez por descanso largo.",
  },
  {
    id: "lifedrinker", name: "Devorador de vida", prerequisite: "pact_of_the_blade",
    summary: "Requisito: brujo de nivel 9+ y Pacto del filo. Una vez por turno, al acertar con tu arma de pacto, causás 1d6 de daño necrótico, psíquico o radiante adicional y podés gastar un dado de golpe para recuperar su resultado más tu Constitución.",
  },
  {
    id: "visions_of_distant_realms", name: "Visiones de reinos remotos",
    summary: "Requisito: brujo de nivel 9+. Lanzás ojo arcano sin gastar espacio de conjuro.", ...free("arcane_eye"),
  },
];

const upTo5 = () => [...LEVEL_1_INVOCATIONS, ...LEVEL_2_INVOCATIONS, ...LEVEL_5_INVOCATIONS];

// Cantrips, prepared spells, Pact Magic slots and invocation count from the SRD table "Rasgos de brujo":
// 1 invocation at level 1, 3 from level 2, 5 from level 5, 6 from level 7 and 7 from level 9.
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
  {
    level: 5, proficiencyBonus: 3, resources: {}, cantrips: 3, preparedSpells: 6, pactSlots: { count: 2, slotLevel: 3 },
    features: [{ name: "Invocaciones sobrenaturales (5)", summary: "Obtenés dos invocaciones más (5 en total)." }],
    choices: [{ id: "class.warlock.invocation_5", label: "Invocaciones sobrenaturales (nivel 5)", count: 2, options: upTo5() }],
  },
  { level: 6, proficiencyBonus: 3, resources: {}, cantrips: 3, preparedSpells: 7, pactSlots: { count: 2, slotLevel: 3 }, features: [], choices: [] },
  {
    level: 7, proficiencyBonus: 3, resources: {}, cantrips: 3, preparedSpells: 8, pactSlots: { count: 2, slotLevel: 4 },
    features: [{ name: "Invocaciones sobrenaturales (6)", summary: "Obtenés una invocación más (6 en total)." }],
    choices: [
      { id: "class.warlock.invocation_7", label: "Invocación sobrenatural (nivel 7)", count: 1, options: [...upTo5(), ...LEVEL_7_INVOCATIONS] },
    ],
  },
  {
    level: 8, proficiencyBonus: 3, resources: {}, cantrips: 3, preparedSpells: 9, pactSlots: { count: 2, slotLevel: 4 },
    features: [ASI_TRAIT],
    choices: [asiFeatChoice("warlock", 8)],
  },
  {
    level: 9, proficiencyBonus: 4, resources: {}, cantrips: 3, preparedSpells: 10, pactSlots: { count: 2, slotLevel: 5 },
    features: [
      {
        name: "Contactar patrón",
        summary: "Siempre tenés preparado contactar con otro plano; una vez por descanso largo lo lanzás sin gastar espacio para hablar con tu patrón y superás automáticamente su salvación.",
        spells: ["contact_other_plane"],
      },
      { name: "Invocaciones sobrenaturales (7)", summary: "Obtenés una invocación más (7 en total)." },
    ],
    choices: [
      {
        id: "class.warlock.invocation_9", label: "Invocación sobrenatural (nivel 9)", count: 1,
        options: [...upTo5(), ...LEVEL_7_INVOCATIONS, ...LEVEL_9_INVOCATIONS],
      },
    ],
  },
  { level: 10, proficiencyBonus: 4, resources: {}, cantrips: 4, preparedSpells: 10, pactSlots: { count: 2, slotLevel: 5 }, features: [], choices: [] },
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
          summary: "Siempre tenés preparados manos ardientes, orden imperiosa, rayo abrasador y sugestión; más adelante se suman otros (niveles 5, 7 y 9).",
          spells: ["burning_hands", "command", "scorching_ray", "suggestion"],
        },
      },
      {
        level: 5,
        feature: { name: "Conjuros del infernal (nivel 5)", summary: "Siempre tenés preparados bola de fuego y nube apestosa.", spells: ["fireball", "stinking_cloud"] },
      },
      {
        level: 6,
        feature: {
          name: "La suerte del oscuro",
          summary: "Al hacer una prueba de característica o una salvación podés sumar 1d10, incluso después de ver el resultado. Tantas veces como tu modificador de Carisma (mín. 1) por descanso largo, una vez por tirada.",
        },
      },
      {
        level: 7,
        feature: { name: "Conjuros del infernal (nivel 7)", summary: "Siempre tenés preparados escudo de fuego y muro de fuego.", spells: ["fire_shield", "wall_of_fire"] },
      },
      {
        level: 9,
        feature: { name: "Conjuros del infernal (nivel 9)", summary: "Siempre tenés preparados geas y plaga de insectos.", spells: ["geas", "insect_plague"] },
      },
      {
        level: 10,
        feature: {
          name: "Resistencia infernal",
          summary: "Tras un descanso corto o largo elegís un tipo de daño (salvo fuerza) y tenés resistencia a él hasta que elijas otro.",
        },
      },
    ],
  },
};
