import type { ChoiceSpec, ClassData, LevelRow } from "../../types";
import { ARTISAN_TOOLS, ASI_TRAIT, INSTRUMENTS, SOURCE, asiFeatChoice, level4FeatChoice, subclassTrait } from "./common";


const toolChoice: ChoiceSpec = {
  id: "class.monk.tool", label: "Herramienta de artesano o instrumento musical", count: 1,
  options: [...ARTISAN_TOOLS, ...INSTRUMENTS],
};

// Martial Arts die, Focus Points and Unarmored Movement from the SRD table "Rasgos de monje".
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: { "Dado de artes marciales": 6 },
    features: [
      {
        name: "Artes marciales",
        summary: "Sin armadura ni escudo y con armas de monje (cuerpo a cuerpo sencillas o marciales ligeras) o desarmado: ataque sin armas adicional como acción adicional, daño con dado de artes marciales (d6) y podés usar Destreza en vez de Fuerza para atacar, dañar y agarrar o empujar.",
      },
      {
        name: "Defensa sin armadura",
        summary: "Sin armadura ni escudo, tu CA base es 10 más tus modificadores de Destreza y Sabiduría.",
      },
    ],
    choices: [toolChoice],
  },
  {
    level: 2, proficiencyBonus: 2,
    resources: { "Dado de artes marciales": 6, "Puntos de concentración": 2, "Movimiento sin armadura (m)": 3 },
    features: [
      {
        name: "Concentración de monje",
        summary: "Tenés puntos de concentración (igual a tu nivel de monje) que recuperás en descanso corto o largo. Los usás en Defensa paciente, Paso del viento y Ráfaga de golpes. CD de salvación: 8 + Sabiduría + competencia.",
      },
      {
        name: "Metabolismo asombroso",
        summary: "Al tirar iniciativa recuperás todos tus puntos de concentración gastados y, además, recuperás puntos de golpe igual a tu nivel de monje más una tirada de tu dado de artes marciales. Una vez por descanso largo.",
      },
      {
        name: "Movimiento sin armadura",
        summary: "Tu velocidad aumenta 3 m si no llevás armadura ni escudo.",
      },
    ],
    choices: [],
  },
  {
    level: 3, proficiencyBonus: 2,
    resources: { "Dado de artes marciales": 6, "Puntos de concentración": 3, "Movimiento sin armadura (m)": 3 },
    features: [
      {
        name: "Desviar ataques",
        summary: "Como reacción, reducís el daño de un ataque contundente, cortante o perforante que te acierte en 1d10 más tu Destreza y nivel de monje. Si lo reducís a 0, podés gastar 1 punto de concentración para redirigirlo a otra criatura.",
      },
      subclassTrait("monje", "Guerrero de la mano abierta"),
    ],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2,
    resources: { "Dado de artes marciales": 6, "Puntos de concentración": 4, "Movimiento sin armadura (m)": 3 },
    features: [
      {
        name: "Caída lenta",
        summary: "Como reacción al caer, reducís el daño de la caída en cinco veces tu nivel de monje.",
      },
      ASI_TRAIT,
    ],
    choices: [level4FeatChoice("monk")],
  },
  {
    level: 5, proficiencyBonus: 3,
    resources: { "Dado de artes marciales": 8, "Puntos de concentración": 5, "Movimiento sin armadura (m)": 3 },
    features: [
      { name: "Ataque adicional", summary: "Cuando realizás la acción de atacar en tu turno, hacés dos ataques en lugar de uno." },
      {
        name: "Golpe aturdidor",
        summary: "Una vez por turno, al acertar con un arma de monje o un ataque sin armas, podés gastar 1 punto de concentración: el objetivo hace una salvación de Constitución o queda aturdido hasta el inicio de tu siguiente turno; si la supera, su velocidad se reduce a la mitad y el siguiente ataque contra él tiene ventaja.",
      },
    ],
    choices: [],
  },
  {
    level: 6, proficiencyBonus: 3,
    resources: { "Dado de artes marciales": 8, "Puntos de concentración": 6, "Movimiento sin armadura (m)": 4.5 },
    features: [{ name: "Golpes potenciados", summary: "El daño de tus ataques sin armas puede ser de fuerza o de su tipo normal, a tu elección." }],
    choices: [],
  },
  {
    level: 7, proficiencyBonus: 3,
    resources: { "Dado de artes marciales": 8, "Puntos de concentración": 7, "Movimiento sin armadura (m)": 4.5 },
    features: [
      {
        name: "Evasión",
        summary: "Ante un efecto con salvación de Destreza para recibir la mitad del daño, no recibís daño si la superás y la mitad si la fallás (salvo que estés incapacitado).",
      },
    ],
    choices: [],
  },
  {
    level: 8, proficiencyBonus: 3,
    resources: { "Dado de artes marciales": 8, "Puntos de concentración": 8, "Movimiento sin armadura (m)": 4.5 },
    features: [ASI_TRAIT],
    choices: [asiFeatChoice("monk", 8)],
  },
  {
    level: 9, proficiencyBonus: 4,
    resources: { "Dado de artes marciales": 8, "Puntos de concentración": 9, "Movimiento sin armadura (m)": 4.5 },
    features: [
      {
        name: "Movimiento acrobático",
        summary: "Sin armadura ni escudo, podés moverte por superficies verticales y sobre líquidos sin caer durante tu movimiento.",
      },
    ],
    choices: [],
  },
  {
    level: 10, proficiencyBonus: 4,
    resources: { "Dado de artes marciales": 8, "Puntos de concentración": 10, "Movimiento sin armadura (m)": 6 },
    features: [
      {
        name: "Autorrestablecimiento",
        summary: "Al final de cada uno de tus turnos podés quitarte uno de estos estados: asustado, envenenado o hechizado. Pasar sin comida ni bebida no te causa cansancio.",
      },
      {
        name: "Concentración agudizada",
        summary: "Defensa paciente te da puntos de golpe temporales iguales a dos tiradas de tu dado de artes marciales; Paso del viento puede llevar consigo a una criatura voluntaria Grande o menor a 1,5 m; Ráfaga de golpes hace tres ataques sin armas en lugar de dos.",
      },
    ],
    choices: [],
  },
];

export const MONK: ClassData = {
  id: "monk", name: "Monje", source: SOURCE,
  hitDie: 8, primaryAbility: ["dex", "wis"], saves: ["str", "dex"],
  skillChoice: { count: 2, options: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"] },
  armor: [],
  weapons: ["Armas sencillas", "Armas marciales con la propiedad ligera"],
  tools: ["Un tipo de herramientas de artesano o instrumento musical a elección"],
  weaponMasteryCount: 0,
  equipment: {
    A: {
      items: [
        "spear", "dagger", "dagger", "dagger", "dagger", "dagger",
        "text:Herramientas de artesano o instrumento musical elegido", "text:Paquete de explorador",
      ],
      gold: 11,
    },
    B: { items: [], gold: 50 },
    C: undefined,
  },
  spellcasting: null,
  unarmoredDefense: "monk",
  levels,
  subclass: {
    id: "open_hand", name: "Guerrero de la mano abierta", level: 3,
    features: [
      {
        level: 3,
        feature: {
          name: "Técnica de la mano abierta",
          summary: "Cuando aciertes a una criatura con un ataque de Ráfaga de golpes, podés imponerle un efecto: Derribar (salvación de Destreza o derribado), Desconcertar (sin ataques de oportunidad hasta su siguiente turno) o Empujar (salvación de Fuerza o empujado hasta 4,5 m).",
        },
      },
      {
        level: 6,
        feature: {
          name: "Plenitud de cuerpo",
          summary: "Como acción adicional tirás tu dado de artes marciales y recuperás ese resultado más tu modificador de Sabiduría en puntos de golpe (mín. 1). Tantos usos como tu modificador de Sabiduría (mín. 1) por descanso largo.",
        },
      },
    ],
  },
};
