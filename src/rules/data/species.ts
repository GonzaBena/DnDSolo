import { SKILLS } from "../types";
import type { ChoiceSpec, Option, SpeciesData } from "../types";

const SOURCE = "SRD 5.2" as const;

/** The 18 skills as options, for "choose a skill" traits. */
const skillOptions = (): Option[] =>
  SKILLS.map((s) => ({ id: s.id, name: s.name, summary: `Competencia en ${s.name}.`, skill: s.id }));

/** The elf, gnome and tiefling lineages all let the player pick the
    spellcasting ability; that pick belongs to the character sheet step, so it
    is described in the trait summary rather than modeled here. */
const SPELL_ABILITY_NOTE = "La aptitud mágica es Inteligencia, Sabiduría o Carisma (a elección).";

const dragonAncestry: ChoiceSpec = {
  id: "species.dragonborn.ancestry",
  label: "Linaje dracónico",
  count: 1,
  options: [
    ["black", "Negro", "ácido"], ["blue", "Azul", "relámpago"], ["brass", "Oropel", "fuego"],
    ["bronze", "Bronce", "relámpago"], ["copper", "Cobre", "ácido"], ["gold", "Oro", "fuego"],
    ["green", "Verde", "veneno"], ["red", "Rojo", "fuego"], ["silver", "Plata", "frío"],
    ["white", "Blanco", "frío"],
  ].map(([id, name, damage]) => ({
    id,
    name: `Dragón ${name.toLowerCase()}`,
    summary: `Tu ataque de aliento y tu resistencia son de daño de ${damage}.`,
  })),
};

const elfLineage: ChoiceSpec = {
  id: "species.elf.lineage",
  label: "Linaje élfico",
  count: 1,
  options: [
    {
      id: "drow", name: "Drow",
      summary: "Visión en la oscuridad de 36 m y truco luces danzantes; fuego feérico a nivel 3 y oscuridad a nivel 5.",
      spells: [
        { fromLevel: 1, spellId: "dancing_lights" },
        { fromLevel: 3, spellId: "faerie_fire" },
        { fromLevel: 5, spellId: "darkness" },
      ],
    },
    {
      id: "high_elf", name: "Alto elfo",
      summary: "Truco prestidigitación (lo podés cambiar por otro de mago tras un descanso largo); detectar magia a nivel 3 y paso brumoso a nivel 5.",
      spells: [
        { fromLevel: 1, spellId: "prestidigitation" },
        { fromLevel: 3, spellId: "detect_magic" },
        { fromLevel: 5, spellId: "misty_step" },
      ],
    },
    {
      id: "wood_elf", name: "Elfo de los bosques",
      summary: "Velocidad de 10,5 m y truco saber druídico; zancada prodigiosa a nivel 3 y pasar sin rastro a nivel 5.",
      spells: [
        { fromLevel: 1, spellId: "druidcraft" },
        { fromLevel: 3, spellId: "longstrider" },
        { fromLevel: 5, spellId: "pass_without_trace" },
      ],
    },
  ],
};

const elfKeenSenses: ChoiceSpec = {
  id: "species.elf.keen_senses",
  label: "Sentidos agudos",
  count: 1,
  options: SKILLS.filter((s) => ["insight", "perception", "survival"].includes(s.id)).map((s) => ({
    id: s.id, name: s.name, summary: `Competencia en ${s.name}.`, skill: s.id,
  })),
};

const gnomeLineage: ChoiceSpec = {
  id: "species.gnome.lineage",
  label: "Linaje gnomo",
  count: 1,
  options: [
    {
      id: "forest_gnome", name: "Gnomo de los bosques",
      summary: "Truco ilusión menor y siempre tenés preparado hablar con los animales (se lanza gratis tantas veces como tu bonificador por competencia por descanso largo).",
      spells: [
        { fromLevel: 1, spellId: "minor_illusion" },
        { fromLevel: 1, spellId: "speak_with_animals" },
      ],
    },
    {
      id: "rock_gnome", name: "Gnomo de las rocas",
      summary: "Trucos prestidigitación y reparar. Podés pasar 10 minutos para crear un dispositivo mecánico Diminuto (hasta tres a la vez) que produce un efecto de prestidigitación.",
      spells: [
        { fromLevel: 1, spellId: "mending" },
        { fromLevel: 1, spellId: "prestidigitation" },
      ],
    },
  ],
};

const goliathAncestry: ChoiceSpec = {
  id: "species.goliath.giant_ancestry",
  label: "Linaje gigante",
  count: 1,
  options: [
    { id: "cloud", name: "Excursión de las nubes (gigante de las nubes)", summary: "Acción adicional: te teletransportás hasta 9 m a un espacio sin ocupar que veas." },
    { id: "fire", name: "Abrasión del fuego (gigante de fuego)", summary: "Al acertar un ataque y causar daño, sumás 1d10 de daño de fuego." },
    { id: "frost", name: "Frío de la escarcha (gigante de escarcha)", summary: "Al acertar un ataque y causar daño, sumás 1d6 de daño de frío y reducís 3 m su velocidad hasta tu próximo turno." },
    { id: "hill", name: "Caída de las colinas (gigante de las colinas)", summary: "Al acertar y dañar a una criatura Grande o menor, podés derribarla." },
    { id: "stone", name: "Resistencia de la piedra (gigante de piedra)", summary: "Reacción al recibir daño: tirás 1d12, sumás tu mod. de Constitución y reducís el daño en ese total." },
    { id: "storm", name: "Trueno de la tormenta (gigante de las tormentas)", summary: "Reacción cuando una criatura a 18 m o menos te daña: le causás 1d8 de daño de trueno." },
  ],
};

const humanSkillful: ChoiceSpec = {
  id: "species.human.skillful",
  label: "Diestro",
  count: 1,
  options: skillOptions(),
};

/** Origin feats a human can take. Option ids are feat ids so the generator can
    resolve them with findFeat; the list is kept in sync by a test. */
const humanVersatile: ChoiceSpec = {
  id: "species.human.versatile",
  label: "Versátil",
  count: 1,
  options: [
    { id: "alert", name: "Alerta", summary: "Sumás tu bonificador por competencia a la iniciativa." },
    { id: "magic_initiate_cleric", name: "Iniciado en la magia (clérigo)", summary: "Dos trucos y un conjuro de nivel 1 de la lista de clérigo." },
    { id: "magic_initiate_druid", name: "Iniciado en la magia (druida)", summary: "Dos trucos y un conjuro de nivel 1 de la lista de druida." },
    { id: "magic_initiate_wizard", name: "Iniciado en la magia (mago)", summary: "Dos trucos y un conjuro de nivel 1 de la lista de mago." },
    { id: "savage_attacker", name: "Atacante salvaje", summary: "Una vez por turno, tirás dos veces el daño del arma y usás el que prefieras." },
    { id: "skilled", name: "Habilidoso", summary: "Competencia en tres habilidades a elección. Recomendada." },
  ],
};

const tieflingLegacy: ChoiceSpec = {
  id: "species.tiefling.legacy",
  label: "Legado infernal",
  count: 1,
  options: [
    {
      id: "abyssal", name: "Abisal",
      summary: "Resistencia al daño de veneno y truco rociada venenosa; rayo nauseabundo a nivel 3 e inmovilizar persona a nivel 5.",
      spells: [
        { fromLevel: 1, spellId: "poison_spray" },
        { fromLevel: 3, spellId: "ray_of_sickness" },
        { fromLevel: 5, spellId: "hold_person" },
      ],
    },
    {
      id: "chthonic", name: "Ctónico",
      summary: "Resistencia al daño necrótico y truco toque helado; falsa vida a nivel 3 y rayo debilitador a nivel 5.",
      spells: [
        { fromLevel: 1, spellId: "chill_touch" },
        { fromLevel: 3, spellId: "false_life" },
        { fromLevel: 5, spellId: "ray_of_enfeeblement" },
      ],
    },
    {
      id: "infernal", name: "Infernal",
      summary: "Resistencia al daño de fuego y truco descarga de fuego; reprensión infernal a nivel 3 y oscuridad a nivel 5.",
      spells: [
        { fromLevel: 1, spellId: "fire_bolt" },
        { fromLevel: 3, spellId: "hellish_rebuke" },
        { fromLevel: 5, spellId: "darkness" },
      ],
    },
  ],
};

export const SPECIES_DATA: SpeciesData[] = [
  {
    id: "dragonborn", name: "Dracónido", source: SOURCE,
    speed: 30, size: "Mediano", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Linaje dracónico", summary: "Elegís un tipo de dragón que define el tipo de daño de tu aliento y tu resistencia." },
      { name: "Ataque de aliento", summary: "En vez de un ataque, exhalás en un cono de 4,5 m o una línea de 9 m (salvación de Destreza, CD 8 + Con + competencia): 1d10 de daño, sube a 2d10 en nivel 5, 3d10 en 11 y 4d10 en 17. Usos: tu bonificador por competencia por descanso largo." },
      { name: "Resistencia al daño", summary: "Resistencia al tipo de daño de tu linaje." },
      { name: "Visión en la oscuridad", summary: "Visión en la oscuridad hasta 18 m." },
      { name: "Vuelo dracónico", summary: "Desde el nivel 5, como acción adicional te salen alas espectrales 10 minutos con velocidad de vuelo igual a tu velocidad. Una vez por descanso largo." },
    ],
    choices: [dragonAncestry],
  },
  {
    id: "dwarf", name: "Enano", source: SOURCE,
    speed: 30, size: "Mediano", hpBonusPerLevel: 1, fixedSkills: [],
    traits: [
      { name: "Visión en la oscuridad", summary: "Visión en la oscuridad hasta 36 m." },
      { name: "Resistencia enana", summary: "Resistencia al daño de veneno y ventaja en salvaciones para evitar o terminar el estado de envenenado." },
      { name: "Aguante enano", summary: "Tus puntos de golpe máximos aumentan en 1 y en 1 más con cada nivel que subas." },
      { name: "Afinidad con la piedra", summary: "Acción adicional: sentís vibraciones a 18 m durante 10 minutos, estando sobre o tocando piedra. Usos: tu bonificador por competencia por descanso largo." },
    ],
    choices: [],
  },
  {
    id: "elf", name: "Elfo", source: SOURCE,
    speed: 30, size: "Mediano", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Visión en la oscuridad", summary: "Visión en la oscuridad hasta 18 m." },
      { name: "Linaje élfico", summary: `Elegís un linaje (drow, alto elfo o elfo de los bosques) con un beneficio de nivel 1 y conjuros a nivel 3 y 5, que podés lanzar una vez gratis por descanso largo. ${SPELL_ABILITY_NOTE}` },
      { name: "Linaje feérico", summary: "Ventaja en salvaciones para evitar o terminar el estado de hechizado." },
      { name: "Sentidos agudos", summary: "Competencia en Perspicacia, Percepción o Supervivencia (a elección)." },
      { name: "Trance", summary: "No necesitás dormir ni la magia puede dormirte. Un descanso largo te lleva 4 horas de meditación consciente." },
    ],
    choices: [elfLineage, elfKeenSenses],
  },
  {
    id: "gnome", name: "Gnomo", source: SOURCE,
    speed: 30, size: "Pequeño", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Visión en la oscuridad", summary: "Visión en la oscuridad hasta 18 m." },
      { name: "Astucia gnoma", summary: "Ventaja en salvaciones de Inteligencia, Sabiduría y Carisma." },
      { name: "Linaje gnomo", summary: `Elegís gnomo de los bosques o de las rocas. ${SPELL_ABILITY_NOTE}` },
    ],
    choices: [gnomeLineage],
  },
  {
    id: "goliath", name: "Goliat", source: SOURCE,
    speed: 35, size: "Mediano", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Linaje gigante", summary: "Elegís un beneficio sobrenatural de tu ascendencia gigante, usable tantas veces como tu bonificador por competencia por descanso largo." },
      { name: "Forma grande", summary: "Desde el nivel 5, como acción adicional pasás a tamaño Grande 10 minutos: ventaja en pruebas de Fuerza y +3 m de velocidad. Una vez por descanso largo." },
      { name: "Constitución poderosa", summary: "Ventaja en pruebas para terminar el estado de agarrado y contás como un tamaño más para la capacidad de carga." },
    ],
    choices: [goliathAncestry],
  },
  {
    id: "halfling", name: "Mediano", source: SOURCE,
    speed: 30, size: "Pequeño", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Valiente", summary: "Ventaja en salvaciones para evitar o terminar el estado de asustado." },
      { name: "Agilidad de mediano", summary: "Podés pasar por el espacio de una criatura de tamaño mayor, pero no detenerte en él." },
      { name: "Fortuna", summary: "Cuando sacás un 1 en un d20 de una prueba, repetís la tirada y usás el nuevo resultado." },
      { name: "Sigiloso por naturaleza", summary: "Podés esconderte tras una criatura de al menos un tamaño mayor al tuyo." },
    ],
    choices: [],
  },
  {
    id: "human", name: "Humano", source: SOURCE,
    speed: 30, size: "Mediano o Pequeño (a elección)", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Ingenioso", summary: "Ganás inspiración heroica cada vez que terminás un descanso largo." },
      { name: "Diestro", summary: "Competencia en una habilidad a elección." },
      { name: "Versátil", summary: "Obtenés una dote de origen a elección. Se recomienda Habilidoso." },
    ],
    choices: [humanSkillful, humanVersatile],
  },
  {
    id: "orc", name: "Orco", source: SOURCE,
    speed: 30, size: "Mediano", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Descarga de adrenalina", summary: "Correr como acción adicional, y ganás puntos de golpe temporales iguales a tu bonificador por competencia. Usos: ese bonificador por descanso corto o largo." },
      { name: "Visión en la oscuridad", summary: "Visión en la oscuridad hasta 36 m." },
      { name: "Aguante incansable", summary: "Al caer a 0 puntos de golpe sin morir, quedás en 1. Una vez por descanso largo." },
    ],
    choices: [],
  },
  {
    id: "tiefling", name: "Tiefling", source: SOURCE,
    speed: 30, size: "Mediano o Pequeño (a elección)", hpBonusPerLevel: 0, fixedSkills: [],
    traits: [
      { name: "Visión en la oscuridad", summary: "Visión en la oscuridad hasta 18 m." },
      { name: "Legado infernal", summary: `Elegís un legado (abisal, ctónico o infernal) con un beneficio de nivel 1 y conjuros a nivel 3 y 5, que podés lanzar una vez gratis por descanso largo. ${SPELL_ABILITY_NOTE}` },
      { name: "Presencia sobrenatural", summary: "Conocés el truco taumaturgia, con la misma aptitud mágica que tu legado." },
    ],
    choices: [tieflingLegacy],
  },
];
