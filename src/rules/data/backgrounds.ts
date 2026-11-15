import type { BackgroundData } from "../types";

const SOURCE = "SRD 5.2" as const;

// Option B of every background is simply 50 GP, so `equipment.B` is empty.
export const BACKGROUNDS_DATA: BackgroundData[] = [
  {
    id: "acolyte", name: "Acólito", source: SOURCE,
    abilities: ["int", "wis", "cha"],
    featId: "magic_initiate_cleric",
    skills: ["insight", "religion"],
    tool: "Suministros de calígrafo",
    equipment: {
      A: ["Suministros de calígrafo", "Libro (de oraciones)", "Símbolo sagrado", "Pergamino (10 hojas)", "Túnica"],
      B: [],
    },
    gold: { A: 8, B: 50 },
  },
  {
    id: "criminal", name: "Criminal", source: SOURCE,
    abilities: ["dex", "con", "int"],
    featId: "alert",
    skills: ["sleight_of_hand", "stealth"],
    tool: "Herramientas de ladrón",
    equipment: {
      A: ["2 dagas", "Herramientas de ladrón", "Palanqueta", "2 bolsas", "Ropas de viaje"],
      B: [],
    },
    gold: { A: 16, B: 50 },
  },
  {
    id: "sage", name: "Erudito", source: SOURCE,
    abilities: ["con", "int", "wis"],
    featId: "magic_initiate_wizard",
    skills: ["arcana", "history"],
    tool: "Suministros de calígrafo",
    equipment: {
      A: ["Bastón", "Suministros de calígrafo", "Libro (de historia)", "Pergamino (8 hojas)", "Túnica"],
      B: [],
    },
    gold: { A: 8, B: 50 },
  },
  {
    id: "soldier", name: "Soldado", source: SOURCE,
    abilities: ["str", "dex", "con"],
    featId: "savage_attacker",
    skills: ["athletics", "intimidation"],
    tool: "Un tipo de juego a elección",
    equipment: {
      A: ["Lanza", "Arco corto", "20 flechas", "Juego (el mismo de la competencia)", "Útiles de sanador", "Aljaba", "Ropas de viaje"],
      B: [],
    },
    gold: { A: 14, B: 50 },
  },
];
