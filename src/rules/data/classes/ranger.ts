import type { ClassData, LevelRow } from "../../types";
import { spellOptions } from "../spells";
import {
  ASI_TRAIT, SOURCE, asiFeatChoice, expertiseChoice, fightingStyleChoice, languageChoice, level4FeatChoice, masteryWeapons,
  subclassTrait, weaponMasteryChoice, weaponMasteryTrait,
} from "./common";

// Spell slots, prepared spells and Favored Enemy uses from the SRD table "Rasgos de explorador".
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: { "Enemigo predilecto": 2 }, preparedSpells: 2, slots: [2],
    features: [
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de explorador con Sabiduría como aptitud mágica; un canalizador druídico sirve de canalizador. Preparás conjuros de nivel 1 y superiores y recuperás los espacios en descanso largo.",
      },
      {
        name: "Enemigo predilecto",
        summary: "Siempre tenés preparado el conjuro marca del cazador y podés lanzarlo dos veces sin gastar espacio de conjuro. Recuperás los usos en descanso largo.",
        spells: ["hunters_mark"],
      },
      weaponMasteryTrait(2, "armas con las que tengas competencia"),
    ],
    choices: [weaponMasteryChoice("ranger", 2, masteryWeapons.any())],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { "Enemigo predilecto": 2 }, preparedSpells: 3, slots: [2],
    features: [
      {
        name: "Estilo de combate",
        summary: "Obtenés una dote de estilo de combate a elección, o la opción Guerrero druídico.",
      },
      {
        name: "Explorador hábil",
        summary: "Conocés dos idiomas a elección y ganás pericia en una habilidad en la que ya seas competente.",
      },
    ],
    choices: [
      fightingStyleChoice("ranger", [
        {
          id: "druidic_warrior", name: "Guerrero druídico",
          summary: "Aprendés dos trucos de druida de tu elección; cuentan como conjuros de explorador y la Sabiduría es tu aptitud mágica para ellos. Podés cambiar uno por otro truco de druida al subir de nivel.",
        },
      ]),
      {
        id: "class.ranger.druidic_warrior_cantrips", label: "Trucos de druida (Guerrero druídico)", count: 2,
        options: spellOptions("druid", 0),
        requires: { choiceId: "class.ranger.fighting_style", optionId: "druidic_warrior" },
      },
      expertiseChoice("ranger", 1),
      languageChoice("class.ranger.languages", 2),
    ],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { "Enemigo predilecto": 2 }, preparedSpells: 4, slots: [3],
    features: [subclassTrait("explorador", "Cazador")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { "Enemigo predilecto": 2 }, preparedSpells: 5, slots: [3],
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("ranger", true)],
  },
  {
    level: 5, proficiencyBonus: 3, resources: { "Enemigo predilecto": 3 }, preparedSpells: 6, slots: [4, 2],
    features: [{ name: "Ataque adicional", summary: "Cuando realizás la acción de atacar en tu turno, hacés dos ataques en lugar de uno." }],
    choices: [],
  },
  {
    level: 6, proficiencyBonus: 3, resources: { "Enemigo predilecto": 3 }, preparedSpells: 6, slots: [4, 2],
    features: [
      {
        name: "Errante",
        summary: "Tu velocidad aumenta 3 m (10 pies) mientras no lleves armadura pesada, y tenés velocidad nadando y trepando iguales a tu velocidad.",
      },
    ],
    choices: [],
  },
  { level: 7, proficiencyBonus: 3, resources: { "Enemigo predilecto": 3 }, preparedSpells: 7, slots: [4, 3], features: [], choices: [] },
  {
    level: 8, proficiencyBonus: 3, resources: { "Enemigo predilecto": 3 }, preparedSpells: 7, slots: [4, 3],
    features: [ASI_TRAIT],
    choices: [asiFeatChoice("ranger", 8, true)],
  },
  {
    level: 9, proficiencyBonus: 4, resources: { "Enemigo predilecto": 4 }, preparedSpells: 9, slots: [4, 3, 2],
    features: [{ name: "Pericia", summary: "Ganás pericia en dos habilidades más en las que seas competente." }],
    choices: [expertiseChoice("ranger", 2, 9)],
  },
  {
    level: 10, proficiencyBonus: 4, resources: { "Enemigo predilecto": 4 }, preparedSpells: 9, slots: [4, 3, 2],
    features: [
      {
        name: "Infatigable",
        summary: "Como acción de magia te das 1d8 más tu modificador de Sabiduría (mín. 1) puntos de golpe temporales, tantas veces como tu modificador de Sabiduría (mín. 1) por descanso largo. Tras un descanso corto, tu cansancio baja 1 nivel.",
      },
    ],
    choices: [],
  },
];

export const RANGER: ClassData = {
  id: "ranger", name: "Explorador", source: SOURCE,
  hitDie: 10, primaryAbility: ["dex", "wis"], saves: ["str", "dex"],
  skillChoice: {
    count: 3,
    options: ["athletics", "investigation", "nature", "perception", "insight", "stealth", "survival", "animal_handling"],
  },
  armor: ["Armaduras ligeras", "Armaduras medias", "Escudos"],
  weapons: ["Armas sencillas", "Armas marciales"],
  tools: [],
  weaponMasteryCount: 2,
  equipment: {
    A: {
      items: [
        "studded_leather_armor", "scimitar", "shortsword", "longbow", "text:20 flechas", "text:Aljaba",
        "text:Canalizador druídico (rama de muérdago)", "text:Paquete de explorador",
      ],
      gold: 7,
    },
    B: { items: [], gold: 150 },
    C: undefined,
  },
  spellcasting: { ability: "wis", spellList: "ranger" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "hunter", name: "Cazador", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "El cazador y la presa",
          summary: "Elegís una opción (podés cambiarla tras un descanso corto o largo): Azote de colosos (1d8 de daño extra una vez por turno a un objetivo herido) o Destructor de hordas (un ataque extra con la misma arma contra otra criatura a 1,5 m del objetivo, una vez por turno).",
        },
        choices: [
          {
            id: "subclass.hunter.hunters_prey", label: "El cazador y la presa", count: 1,
            options: [
              {
                id: "colossus_slayer", name: "Azote de colosos",
                summary: "Una vez por turno, el arma inflige 1d8 de daño adicional si el objetivo no tiene todos sus puntos de golpe.",
              },
              {
                id: "horde_breaker", name: "Destructor de hordas",
                summary: "Una vez por turno, al atacar con un arma podés hacer otro ataque con la misma arma contra una criatura distinta a 1,5 m del objetivo original.",
              },
            ],
          },
        ],
      },
      {
        level: 3,
        feature: {
          name: "Sabiduría del cazador",
          summary: "Mientras una criatura tenga tu marca del cazador, sabés si tiene inmunidades, resistencias o vulnerabilidades y cuáles son.",
        },
      },
      {
        level: 7,
        feature: {
          name: "Tácticas defensivas",
          summary: "Elegís una opción (podés cambiarla tras un descanso corto o largo): Defensa contra ataques múltiples (quien te acierte tiene desventaja en sus demás ataques contra vos ese turno) o Escapar de la horda (los ataques de oportunidad contra vos tienen desventaja).",
        },
        choices: [
          {
            id: "subclass.hunter.defensive_tactics", label: "Tácticas defensivas", count: 1,
            options: [
              {
                id: "multiattack_defense", name: "Defensa contra ataques múltiples",
                summary: "Cuando una criatura te acierta, tiene desventaja en sus demás tiradas de ataque contra vos ese turno.",
              },
              { id: "escape_the_horde", name: "Escapar de la horda", summary: "Los ataques de oportunidad contra vos tienen desventaja." },
            ],
          },
        ],
      },
    ],
  },
};
