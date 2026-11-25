import type { ClassData, LevelRow } from "../../types";
import { spellOptions } from "../spells";
import { ASI_TRAIT, SOURCE, asiFeatChoice, level4FeatChoice, subclassTrait } from "./common";

/** Circle of the Land spells prepared from druid level 3, 5, 7 and 9 (SRD "Conjuros del círculo de la tierra"). */
const circle = (level3: string[], level5: string, level7: string, level9: string) => [
  ...level3.map((spellId) => ({ fromLevel: 3, spellId })),
  { fromLevel: 5, spellId: level5 }, { fromLevel: 7, spellId: level7 }, { fromLevel: 9, spellId: level9 },
];

// Cantrips, prepared spells, slots and Wild Shape uses from the SRD table "Rasgos de druida".
// The extra cantrip of the Magician order is a conditional choice.
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: {}, cantrips: 2, preparedSpells: 4, slots: [2],
    features: [
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de druida con Sabiduría como aptitud mágica; un canalizador druídico sirve de canalizador. Conocés 2 trucos y preparás conjuros de nivel 1 y superiores; recuperás los espacios en descanso largo.",
      },
      {
        name: "Druídico",
        summary: "Conocés el idioma druídico y siempre tenés preparado el conjuro hablar con los animales. Podés dejar mensajes ocultos que solo quienes conozcan el druídico detectan automáticamente.",
        spells: ["speak_with_animals"],
      },
      {
        name: "Orden primigenia",
        summary: "Elegís una función sacra: Naturalista (un truco de druida adicional y un bonificador igual a tu modificador de Sabiduría, mín. +1, a las pruebas de Conocimiento arcano y Naturaleza) o Guardián (competencia con armas marciales y entrenamiento con armaduras medias).",
      },
    ],
    choices: [
      {
        id: "class.druid.primal_order", label: "Orden primigenia", count: 1,
        options: [
          {
            id: "magician", name: "Naturalista",
            summary: "Un truco adicional de la lista de druida y un bonificador a Conocimiento arcano y Naturaleza igual a tu modificador de Sabiduría (mín. +1).",
          },
          { id: "warden", name: "Guardián", summary: "Competencia con armas marciales y entrenamiento con armaduras medias." },
        ],
      },
      {
        id: "class.druid.magician_cantrip", label: "Truco adicional (Naturalista)", count: 1,
        options: spellOptions("druid", 0),
        requires: { choiceId: "class.druid.primal_order", optionId: "magician" },
      },
    ],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { "Forma salvaje": 2, "Formas conocidas": 4 }, cantrips: 2, preparedSpells: 5, slots: [3],
    features: [
      {
        name: "Forma salvaje",
        summary: "Como acción adicional adoptás la forma de una bestia que conozcas durante horas iguales a la mitad de tu nivel de druida. Dos usos (recuperás uno en descanso corto y todos en largo). Conocés 4 formas (CR máx. 1/4, sin velocidad de vuelo) y ganás puntos de golpe temporales iguales a tu nivel de druida.",
      },
      {
        name: "Compañero salvaje",
        summary: "Como acción de magia, gastás un espacio de conjuro o un uso de Forma salvaje para lanzar encontrar familiar sin componentes materiales; el familiar es un feérico.",
      },
    ],
    choices: [],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { "Forma salvaje": 2, "Formas conocidas": 4 }, cantrips: 2, preparedSpells: 6, slots: [4, 2],
    features: [subclassTrait("druida", "Círculo de la tierra")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { "Forma salvaje": 2, "Formas conocidas": 6 }, cantrips: 3, preparedSpells: 7, slots: [4, 3],
    features: [
      {
        name: "Formas de bestia (nivel 4)",
        summary: "Tabla Formas de bestia: desde el nivel 4 conocés 6 formas y su valor de desafío máximo sube a 1/2 (sin velocidad de vuelo hasta el nivel 8).",
      },
      ASI_TRAIT,
    ],
    choices: [level4FeatChoice("druid")],
  },
  {
    level: 5, proficiencyBonus: 3, resources: { "Forma salvaje": 2, "Formas conocidas": 6 }, cantrips: 3, preparedSpells: 9, slots: [4, 3, 2],
    features: [
      {
        name: "Resurgimiento salvaje",
        summary: "Una vez por turno, si no te quedan usos de Forma salvaje, ganás uno gastando un espacio de conjuro. Además, una vez por descanso largo podés gastar un uso de Forma salvaje para obtener un espacio de nivel 1.",
      },
    ],
    choices: [],
  },
  { level: 6, proficiencyBonus: 3, resources: { "Forma salvaje": 3, "Formas conocidas": 6 }, cantrips: 3, preparedSpells: 10, slots: [4, 3, 3], features: [], choices: [] },
  {
    level: 7, proficiencyBonus: 3, resources: { "Forma salvaje": 3, "Formas conocidas": 6 }, cantrips: 3, preparedSpells: 11, slots: [4, 3, 3, 1],
    features: [{ name: "Furia elemental", summary: "Obtenés Golpe primordial o Lanzamiento potente, a tu elección." }],
    choices: [
      {
        id: "class.druid.elemental_fury", label: "Furia elemental", count: 1,
        options: [
          {
            id: "primal_strike", name: "Golpe primordial",
            summary: "Una vez por turno, al acertar con un arma o un ataque de bestia en Forma salvaje, el objetivo sufre 1d8 de daño adicional de frío, fuego, relámpago o trueno (a tu elección).",
          },
          { id: "potent_spellcasting", name: "Lanzamiento potente", summary: "Sumás tu modificador de Sabiduría al daño de tus trucos de druida." },
        ],
      },
    ],
  },
  {
    level: 8, proficiencyBonus: 3, resources: { "Forma salvaje": 3, "Formas conocidas": 8 }, cantrips: 3, preparedSpells: 12, slots: [4, 3, 3, 2],
    features: [
      ASI_TRAIT,
      { name: "Formas de bestia (nivel 8)", summary: "Conocés 8 formas, su valor de desafío máximo sube a 1 y ya podés elegir bestias con velocidad volando." },
    ],
    choices: [asiFeatChoice("druid", 8)],
  },
  { level: 9, proficiencyBonus: 4, resources: { "Forma salvaje": 3, "Formas conocidas": 8 }, cantrips: 3, preparedSpells: 14, slots: [4, 3, 3, 3, 1], features: [], choices: [] },
  { level: 10, proficiencyBonus: 4, resources: { "Forma salvaje": 3, "Formas conocidas": 8 }, cantrips: 4, preparedSpells: 15, slots: [4, 3, 3, 3, 2], features: [], choices: [] },
];

export const DRUID: ClassData = {
  id: "druid", name: "Druida", source: SOURCE,
  hitDie: 8, primaryAbility: ["wis"], saves: ["int", "wis"],
  skillChoice: {
    count: 2,
    options: ["arcana", "animal_handling", "insight", "medicine", "nature", "perception", "religion", "survival"],
  },
  armor: ["Armaduras ligeras", "Escudos"],
  weapons: ["Armas sencillas"],
  tools: ["Útiles de herborista"],
  weaponMasteryCount: 0,
  equipment: {
    A: {
      items: [
        "leather_armor", "shield", "sickle", "quarterstaff", "text:Canalizador druídico (bastón)",
        "text:Paquete de explorador", "text:Útiles de herborista",
      ],
      gold: 9,
    },
    B: { items: [], gold: 50 },
    C: undefined,
  },
  spellcasting: { ability: "wis", spellList: "druid" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "land", name: "Círculo de la tierra", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Ayuda de la tierra",
          summary: "Como acción de magia, gastás un uso de Forma salvaje y elegís un punto a 18 m: en una esfera de 3 m las criaturas que elijas hacen una salvación de Constitución o sufren 2d6 de daño necrótico (la mitad si la superan) y una criatura de tu elección recupera 2d6 puntos de golpe.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Conjuros del círculo de la tierra",
          summary: "Tras cada descanso largo elegís un tipo de terreno (árido, polar, templado o tropical) y tenés preparados los conjuros de círculo de ese terreno para tu nivel de druida.",
        },
        choices: [
          {
            id: "subclass.land.land_type", label: "Tipo de terreno", count: 1,
            options: [
              {
                id: "arid", name: "Árido",
                summary: "Nivel 3: contorno borroso, descarga de fuego, manos ardientes. Nivel 5: bola de fuego. Nivel 7: marchitar. Nivel 9: muro de piedra. Resistencia (nivel 10): fuego.",
                spells: circle(["blur", "burning_hands", "fire_bolt"], "fireball", "blight", "wall_of_stone"),
              },
              {
                id: "polar", name: "Polar",
                summary: "Nivel 3: inmovilizar persona, nube de oscurecimiento, rayo de escarcha. Nivel 5: tormenta de aguanieve. Nivel 7: tormenta de hielo. Nivel 9: cono de frío. Resistencia (nivel 10): frío.",
                spells: circle(["fog_cloud", "hold_person", "ray_of_frost"], "sleet_storm", "ice_storm", "cone_of_cold"),
              },
              {
                id: "temperate", name: "Templado",
                summary: "Nivel 3: agarre electrizante, dormir, paso brumoso. Nivel 5: relámpago. Nivel 7: libertad de movimiento. Nivel 9: paso arbóreo. Resistencia (nivel 10): relámpago.",
                spells: circle(["misty_step", "shocking_grasp", "sleep"], "lightning_bolt", "freedom_of_movement", "tree_stride"),
              },
              {
                id: "tropical", name: "Tropical",
                summary: "Nivel 3: rayo nauseabundo, salpicadura ácida, telaraña. Nivel 5: nube apestosa. Nivel 7: polimorfar. Nivel 9: plaga de insectos. Resistencia (nivel 10): veneno.",
                spells: circle(["acid_splash", "ray_of_sickness", "web"], "stinking_cloud", "polymorph", "insect_plague"),
              },
            ],
          },
        ],
      },
      {
        level: 6,
        feature: {
          name: "Recuperación natural",
          summary: "Una vez por descanso largo lanzás sin gastar espacio un conjuro de nivel 1+ preparado por Conjuros de círculo. Además, tras un descanso corto recuperás espacios gastados cuya suma de niveles sea como máximo la mitad de tu nivel de druida (redondeando hacia arriba), ninguno de nivel 6 o más; una vez por descanso largo.",
        },
      },
      {
        level: 10,
        feature: {
          name: "Protección de la naturaleza",
          summary: "Sos inmune al estado envenenado y tenés resistencia al daño de tu terreno actual: fuego (árido), frío (polar), relámpago (templado) o veneno (tropical).",
        },
      },
    ],
  },
};
