import type { ClassData, LevelRow } from "../../types";
import { spellOptions } from "../spells";
import {
  ASI_TRAIT, SOURCE, asiFeatChoice, fightingStyleChoice, level4FeatChoice, masteryWeapons, subclassTrait, weaponMasteryChoice,
  weaponMasteryTrait,
} from "./common";

// Spell slots, prepared spells and Channel Divinity from the SRD table "Rasgos de paladín".
// The two cleric cantrips of Blessed Warrior are a conditional choice (SRD: "Guerrero bendito").
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: { "Imponer las manos": 5 }, preparedSpells: 2, slots: [2],
    features: [
      {
        name: "Imponer las manos",
        summary: "Reserva de curación de 5 puntos por nivel de paladín que se rellena en descanso largo. Como acción adicional tocás a una criatura para curarla con esa reserva, o gastás 5 puntos para eliminar el estado de envenenada.",
      },
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de paladín con Carisma como aptitud mágica; un símbolo sagrado sirve de canalizador. Preparás conjuros de nivel 1 y superiores y recuperás los espacios en descanso largo.",
      },
      weaponMasteryTrait(2, "armas con las que tengas competencia"),
    ],
    choices: [weaponMasteryChoice("paladin", 2, masteryWeapons.any())],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { "Imponer las manos": 10 }, preparedSpells: 3, slots: [2],
    features: [
      {
        name: "Castigo de paladín",
        summary: "Siempre tenés preparado el conjuro castigo divino y podés lanzarlo una vez sin gastar espacio de conjuro por descanso largo.",
        spells: ["divine_smite"],
      },
      {
        name: "Estilo de combate",
        summary: "Obtenés una dote de estilo de combate a elección, o la opción Guerrero bendito.",
      },
    ],
    choices: [
      fightingStyleChoice("paladin", [
        {
          id: "blessed_warrior", name: "Guerrero bendito",
          summary: "Aprendés dos trucos de clérigo de tu elección; cuentan como conjuros de paladín y el Carisma es tu aptitud mágica para ellos. Podés cambiar uno por otro truco de clérigo al subir de nivel.",
        },
      ]),
      {
        id: "class.paladin.blessed_warrior_cantrips", label: "Trucos de clérigo (Guerrero bendito)", count: 2,
        options: spellOptions("cleric", 0),
        requires: { choiceId: "class.paladin.fighting_style", optionId: "blessed_warrior" },
      },
    ],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { "Imponer las manos": 15, "Canalizar divinidad": 2 }, preparedSpells: 4, slots: [3],
    features: [
      {
        name: "Canalizar divinidad",
        summary: "Dos usos (recuperás uno en descanso corto y todos en largo). Empezás con Sentidos divinos: como acción adicional detectás celestiales, infernales y muertos vivientes a 18 m durante 10 minutos.",
      },
      subclassTrait("paladín", "Juramento de entrega"),
    ],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { "Imponer las manos": 20, "Canalizar divinidad": 2 }, preparedSpells: 5, slots: [3],
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("paladin", true)],
  },
  {
    level: 5, proficiencyBonus: 3, resources: { "Imponer las manos": 25, "Canalizar divinidad": 2 }, preparedSpells: 6, slots: [4, 2],
    features: [
      { name: "Ataque adicional", summary: "Cuando realizás la acción de atacar en tu turno, hacés dos ataques en lugar de uno." },
      {
        name: "Corcel fiel",
        summary: "Siempre tenés preparado hallar corcel y podés lanzarlo una vez sin gastar espacio de conjuro; recuperás ese uso en descanso largo.",
        spells: ["find_steed"],
      },
    ],
    choices: [],
  },
  {
    level: 6, proficiencyBonus: 3, resources: { "Imponer las manos": 30, "Canalizar divinidad": 2 }, preparedSpells: 6, slots: [4, 2],
    features: [
      {
        name: "Aura de protección",
        summary: "Emanás un aura de 3 m (inactiva si estás incapacitado): vos y tus aliados dentro suman tu modificador de Carisma (mín. +1) a las tiradas de salvación. Ya está sumado a tus salvaciones.",
      },
    ],
    choices: [],
  },
  { level: 7, proficiencyBonus: 3, resources: { "Imponer las manos": 35, "Canalizar divinidad": 2 }, preparedSpells: 7, slots: [4, 3], features: [], choices: [] },
  {
    level: 8, proficiencyBonus: 3, resources: { "Imponer las manos": 40, "Canalizar divinidad": 2 }, preparedSpells: 7, slots: [4, 3],
    features: [ASI_TRAIT],
    choices: [asiFeatChoice("paladin", 8, true)],
  },
  {
    level: 9, proficiencyBonus: 4, resources: { "Imponer las manos": 45, "Canalizar divinidad": 2 }, preparedSpells: 9, slots: [4, 3, 2],
    features: [
      {
        name: "Abjurar de los enemigos",
        summary: "Como acción de magia gastás un uso de Canalizar divinidad: tantas criaturas a 18 m como tu modificador de Carisma (mín. 1) hacen una salvación de Sabiduría o quedan asustadas 1 minuto o hasta recibir daño; mientras tanto solo pueden moverse, realizar una acción o una acción adicional en su turno.",
      },
    ],
    choices: [],
  },
  {
    level: 10, proficiencyBonus: 4, resources: { "Imponer las manos": 50, "Canalizar divinidad": 2 }, preparedSpells: 9, slots: [4, 3, 2],
    features: [
      {
        name: "Aura de coraje",
        summary: "Vos y tus aliados tienen inmunidad al estado asustado mientras estén dentro de tu Aura de protección.",
      },
    ],
    choices: [],
  },
];

export const PALADIN: ClassData = {
  id: "paladin", name: "Paladín", source: SOURCE,
  hitDie: 10, primaryAbility: ["str", "cha"], saves: ["wis", "cha"],
  skillChoice: { count: 2, options: ["athletics", "intimidation", "medicine", "insight", "persuasion", "religion"] },
  armor: ["Armaduras ligeras", "Armaduras medias", "Armaduras pesadas", "Escudos"],
  weapons: ["Armas sencillas", "Armas marciales"],
  tools: [],
  weaponMasteryCount: 2,
  equipment: {
    A: {
      items: [
        "chain_mail", "shield", "longsword", "javelin", "javelin", "javelin", "javelin", "javelin", "javelin",
        "text:Símbolo sagrado", "text:Paquete de sacerdote",
      ],
      gold: 9,
    },
    B: { items: [], gold: 150 },
    C: undefined,
  },
  spellcasting: { ability: "cha", spellList: "paladin" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "oath_of_devotion", name: "Juramento de entrega", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Arma sagrada",
          summary: "Al atacar, gastás un uso de Canalizar divinidad para imbuir un arma cuerpo a cuerpo durante 10 minutos: sumás tu modificador de Carisma (mín. +1) a las tiradas de ataque, podés infligir daño radiante y el arma emite luz.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Conjuros del juramento de entrega",
          summary: "Siempre tenés preparados escudo de fe y protección contra el bien y el mal; más adelante se suman otros (niveles 5 y 9).",
          spells: ["shield_of_faith", "protection_from_evil_and_good"],
        },
      },
      {
        level: 5,
        feature: {
          name: "Conjuros del juramento de entrega (nivel 5)",
          summary: "Siempre tenés preparados auxilio y zona de la verdad.",
          spells: ["aid", "zone_of_truth"],
        },
      },
      {
        level: 7,
        feature: {
          name: "Aura de entrega",
          summary: "Vos y tus aliados tienen inmunidad al estado hechizado mientras estén dentro de tu Aura de protección.",
        },
      },
      {
        level: 9,
        feature: {
          name: "Conjuros del juramento de entrega (nivel 9)",
          summary: "Siempre tenés preparados disipar magia y señal de esperanza.",
          spells: ["dispel_magic", "beacon_of_hope"],
        },
      },
    ],
  },
};
