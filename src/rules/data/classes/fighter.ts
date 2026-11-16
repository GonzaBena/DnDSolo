import type { ClassData, LevelRow } from "../../types";
import {
  ASI_TRAIT, SOURCE, fightingStyleChoice, level4FeatChoice, masteryWeapons, subclassTrait, weaponMasteryChoice,
  weaponMasteryTrait,
} from "./common";

const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: { "Tomar aliento": 2 },
    features: [
      {
        name: "Estilo de combate",
        summary: "Obtenés una dote de estilo de combate a elección (se recomienda Defensa). Al subir de nivel podés cambiarla por otra.",
      },
      weaponMasteryTrait(3, "armas sencillas o marciales"),
      {
        name: "Tomar aliento",
        summary: "Como acción adicional recuperás 1d10 más tu nivel de guerrero en puntos de golpe. Recuperás un uso en descanso corto y todos en descanso largo.",
      },
    ],
    choices: [
      fightingStyleChoice("fighter"),
      weaponMasteryChoice("fighter", 3, masteryWeapons.any()),
    ],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { "Tomar aliento": 2, "Acción súbita": 1 },
    features: [
      {
        name: "Acción súbita",
        summary: "En tu turno podés realizar una acción adicional, salvo la acción de magia. Se recupera tras un descanso corto o largo.",
      },
      {
        name: "Mente táctica",
        summary: "Al fallar una prueba de característica, podés gastar un uso de Tomar aliento para sumar 1d10 al resultado. Si aun así fallás, no se gasta el uso.",
      },
    ],
    choices: [],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { "Tomar aliento": 2, "Acción súbita": 1 },
    features: [subclassTrait("guerrero", "Campeón")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { "Tomar aliento": 3, "Acción súbita": 1 },
    features: [ASI_TRAIT, { name: "Maestría con armas (4 tipos)", summary: "Ahora podés usar la maestría de 4 tipos de armas." }],
    choices: [
      level4FeatChoice("fighter", true),
      weaponMasteryChoice("fighter", 1, masteryWeapons.any(), "_level4"),
    ],
  },
];

export const FIGHTER: ClassData = {
  id: "fighter", name: "Guerrero", source: SOURCE,
  hitDie: 10, primaryAbility: ["str", "dex"], saves: ["str", "con"],
  skillChoice: {
    count: 2,
    options: ["acrobatics", "athletics", "history", "intimidation", "perception", "insight", "persuasion", "survival", "animal_handling"],
  },
  armor: ["Armaduras ligeras", "Armaduras medias", "Armaduras pesadas", "Escudos"],
  weapons: ["Armas sencillas", "Armas marciales"],
  tools: [],
  weaponMasteryCount: 3,
  equipment: {
    A: {
      items: [
        "chain_mail", "greatsword", "flail", "javelin", "javelin", "javelin", "javelin", "javelin", "javelin", "javelin",
        "javelin", "text:Paquete de explorador de mazmorras",
      ],
      gold: 4,
    },
    B: {
      items: [
        "studded_leather_armor", "scimitar", "shortsword", "longbow", "text:20 flechas", "text:Aljaba",
        "text:Paquete de explorador de mazmorras",
      ],
      gold: 11,
    },
    C: { items: [], gold: 155 },
  },
  spellcasting: null,
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "champion", name: "Campeón", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Atleta sobresaliente",
          summary: "Tenés ventaja en las tiradas de iniciativa y en las pruebas de Fuerza (Atletismo). Tras causar un crítico podés moverte hasta la mitad de tu velocidad sin provocar ataques de oportunidad.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Crítico mejorado",
          summary: "Tus ataques con armas y sin armas causan crítico con un 19 o 20 en el d20.",
        },
      },
    ],
  },
};
