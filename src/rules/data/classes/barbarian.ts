import type { ClassData, LevelRow } from "../../types";
import {
  ASI_TRAIT, SOURCE, level4FeatChoice, masteryWeapons, skillOptions, subclassTrait, weaponMasteryChoice, weaponMasteryTrait,
} from "./common";

const SKILL_LIST = ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"] as const;

// Rages and rage damage by level (SRD table "Rasgos de bárbaro"); mastery grows from 2 to 3 at level 4.
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: { Furias: 2, "Daño por furia": 2 },
    features: [
      {
        name: "Defensa sin armadura",
        summary: "Sin armadura, tu CA base es 10 más tus modificadores de Destreza y Constitución. Podés llevar escudo.",
      },
      {
        name: "Furia",
        summary: "Como acción adicional (sin armadura pesada) te enfurecés: resistencia al daño contundente, cortante y perforante, daño extra con ataques de Fuerza y ventaja en pruebas y salvaciones de Fuerza. No podés lanzar conjuros ni concentrarte. Dura hasta el final de tu siguiente turno (máx. 10 minutos) si seguís atacando o forzando salvaciones. Recuperás un uso en descanso corto y todos en descanso largo.",
      },
      weaponMasteryTrait(2, "armas cuerpo a cuerpo sencillas o marciales"),
    ],
    choices: [weaponMasteryChoice("barbarian", 2, masteryWeapons.melee())],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { Furias: 2, "Daño por furia": 2 },
    features: [
      {
        name: "Ataque temerario",
        summary: "Al hacer tu primer ataque del turno, podés atacar temerariamente: ventaja en tus ataques de Fuerza hasta tu siguiente turno, pero los ataques contra vos también tienen ventaja.",
      },
      {
        name: "Sentir el peligro",
        summary: "Tenés ventaja en las tiradas de salvación de Destreza, salvo que estés incapacitado.",
      },
    ],
    choices: [],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { Furias: 3, "Daño por furia": 2 },
    features: [
      {
        name: "Conocimiento primigenio",
        summary: "Ganás competencia en otra habilidad de la lista de bárbaro. Además, enfurecido podés usar Fuerza en pruebas de Acrobacias, Intimidación, Percepción, Sigilo o Supervivencia.",
      },
      subclassTrait("bárbaro", "Senda del berserker"),
    ],
    choices: [
      {
        id: "class.barbarian.primal_knowledge", label: "Conocimiento primigenio", count: 1,
        options: skillOptions([...SKILL_LIST]),
      },
    ],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { Furias: 3, "Daño por furia": 2 },
    features: [ASI_TRAIT, { name: "Maestría con armas (3 tipos)", summary: "Ahora podés usar la maestría de 3 tipos de armas." }],
    choices: [
      level4FeatChoice("barbarian"),
      weaponMasteryChoice("barbarian", 1, masteryWeapons.melee(), "_level4"),
    ],
  },
];

export const BARBARIAN: ClassData = {
  id: "barbarian", name: "Bárbaro", source: SOURCE,
  hitDie: 12, primaryAbility: ["str"], saves: ["str", "con"],
  skillChoice: { count: 2, options: [...SKILL_LIST] },
  armor: ["Armaduras ligeras", "Armaduras medias", "Escudos"],
  weapons: ["Armas sencillas", "Armas marciales"],
  tools: [],
  weaponMasteryCount: 2,
  equipment: {
    A: { items: ["greataxe", "handaxe", "handaxe", "handaxe", "handaxe", "text:Paquete de explorador"], gold: 15 },
    B: { items: [], gold: 75 },
    C: undefined,
  },
  spellcasting: null,
  unarmoredDefense: "barbarian",
  levels,
  subclass: {
    id: "berserker", name: "Senda del berserker", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Frenesí",
          summary: "Si usás Ataque temerario enfurecido, el primer objetivo al que aciertes en tu turno con un ataque de Fuerza recibe daño extra: tirá tantos d6 como tu daño por furia.",
        },
      },
    ],
  },
};
