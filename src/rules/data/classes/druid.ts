import type { ClassData, LevelRow } from "../../types";
import { ASI_TRAIT, SOURCE, level4FeatChoice, subclassTrait } from "./common";

// Cantrips, prepared spells, slots and Wild Shape uses from the SRD table "Rasgos de druida".
// The extra cantrip of the Magician order is picked in the spell task.
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
              { id: "arid", name: "Árido", summary: "Nivel 3: contorno borroso, descarga de fuego, manos ardientes." },
              { id: "polar", name: "Polar", summary: "Nivel 3: inmovilizar persona, nube de oscurecimiento, rayo de escarcha." },
              { id: "temperate", name: "Templado", summary: "Nivel 3: agarre electrizante, dormir, paso brumoso." },
              { id: "tropical", name: "Tropical", summary: "Nivel 3: rayo nauseabundo, salpicadura ácida, telaraña." },
            ],
          },
        ],
      },
    ],
  },
};
