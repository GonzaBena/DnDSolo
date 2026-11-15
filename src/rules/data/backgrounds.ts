import type { BackgroundData, ChoiceSpec } from "../types";

const SOURCE = "SRD 5.2" as const;

const soldierTool: ChoiceSpec = {
  id: "background.soldier.tool",
  label: "Juego a elección",
  count: 1,
  options: [
    ["dice", "Dados"], ["dragonchess", "Ajedrez dragón"],
    ["playing_cards", "Naipes"], ["three_dragon_ante", "Apuesta de los tres dragones"],
  ].map(([id, name]) => ({ id, name, summary: `Competencia con el juego de ${name.toLowerCase()}.` })),
};

// Option B of every background is simply 50 GP, so `equipment.B` is empty.
export const BACKGROUNDS_DATA: BackgroundData[] = [
  {
    id: "acolyte", name: "Acólito", source: SOURCE,
    abilities: ["int", "wis", "cha"],
    featId: "magic_initiate_cleric",
    skills: ["insight", "religion"],
    tool: "Suministros de calígrafo",
    equipment: {
      A: ["text:Suministros de calígrafo", "text:Libro (de oraciones)", "text:Símbolo sagrado", "text:Pergamino (10 hojas)", "text:Túnica"],
      B: [],
    },
    gold: { A: 8, B: 50 },
    choices: [],
  },
  {
    id: "criminal", name: "Criminal", source: SOURCE,
    abilities: ["dex", "con", "int"],
    featId: "alert",
    skills: ["sleight_of_hand", "stealth"],
    tool: "Herramientas de ladrón",
    equipment: {
      A: ["dagger", "dagger", "text:Herramientas de ladrón", "text:Palanqueta", "text:2 bolsas", "text:Ropas de viaje"],
      B: [],
    },
    gold: { A: 16, B: 50 },
    choices: [],
  },
  {
    id: "sage", name: "Erudito", source: SOURCE,
    abilities: ["con", "int", "wis"],
    featId: "magic_initiate_wizard",
    skills: ["arcana", "history"],
    tool: "Suministros de calígrafo",
    equipment: {
      A: ["quarterstaff", "text:Suministros de calígrafo", "text:Libro (de historia)", "text:Pergamino (8 hojas)", "text:Túnica"],
      B: [],
    },
    gold: { A: 8, B: 50 },
    choices: [],
  },
  {
    id: "soldier", name: "Soldado", source: SOURCE,
    abilities: ["str", "dex", "con"],
    featId: "savage_attacker",
    skills: ["athletics", "intimidation"],
    tool: "Un tipo de juego a elección",
    equipment: {
      A: [
        "spear", "shortbow", "text:20 flechas", "text:Juego (el mismo de la competencia)", "text:Útiles de sanador",
        "text:Aljaba", "text:Ropas de viaje",
      ],
      B: [],
    },
    gold: { A: 14, B: 50 },
    choices: [soldierTool],
  },
];
