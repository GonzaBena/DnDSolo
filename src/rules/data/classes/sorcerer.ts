import type { ClassData, LevelRow, Option } from "../../types";
import { ASI_TRAIT, SOURCE, asiFeatChoice, level4FeatChoice, subclassTrait } from "./common";

// Metamagic options from the SRD "Opciones de metamagia" (cost in Sorcery Points).
const METAMAGIC: Option[] = [
  {
    id: "careful_spell", name: "Conjuro cuidadoso",
    summary: "Coste 1 punto. En un conjuro con salvación, hasta tu modificador de Carisma (mín. 1) criaturas elegidas la superan automáticamente y no sufren daño si normalmente recibirían la mitad.",
  },
  {
    id: "distant_spell", name: "Conjuro distante",
    summary: "Coste 1 punto. Duplicás el alcance de un conjuro con alcance de 1,5 m o más, o un conjuro de toque pasa a tener alcance de 9 m.",
  },
  {
    id: "empowered_spell", name: "Conjuro potenciado",
    summary: "Coste 1 punto. Repetís hasta tu modificador de Carisma (mín. 1) dados de daño del conjuro. Se puede usar junto con otra opción de metamagia.",
  },
  {
    id: "extended_spell", name: "Conjuro extendido",
    summary: "Coste 1 punto. Duplicás la duración de un conjuro de 1 minuto o más (máx. 24 horas); si requiere concentración, tenés ventaja en las salvaciones para mantenerla.",
  },
  {
    id: "heightened_spell", name: "Conjuro intensificado",
    summary: "Coste 2 puntos. En un conjuro con salvación, un objetivo tiene desventaja en la salvación contra él.",
  },
  {
    id: "quickened_spell", name: "Conjuro acelerado",
    summary: "Coste 2 puntos. Un conjuro con tiempo de lanzamiento de una acción pasa a ser una acción adicional (no si ya lanzaste un conjuro de nivel 1+ ese turno).",
  },
  {
    id: "seeking_spell", name: "Conjuro buscador",
    summary: "Coste 1 punto. Si fallás la tirada de ataque de un conjuro, volvés a tirar el d20 y usás el nuevo resultado. Se puede usar junto con otra opción de metamagia.",
  },
  {
    id: "subtle_spell", name: "Conjuro sutil",
    summary: "Coste 1 punto. Lanzás el conjuro sin componentes verbales, somáticos ni materiales (salvo los consumidos o con coste especificado).",
  },
  {
    id: "transmuted_spell", name: "Conjuro transmutado",
    summary: "Coste 1 punto. Cambiás el tipo de daño de un conjuro entre ácido, frío, fuego, relámpago, veneno y trueno.",
  },
  {
    id: "twinned_spell", name: "Conjuro gemelo",
    summary: "Coste 1 punto. Un conjuro que se puede potenciar con un espacio superior para afectar a una criatura adicional aumenta su nivel efectivo en 1 con ese fin.",
  },
];

// Cantrips, prepared spells, slots and Sorcery Points from the SRD table "Rasgos de hechicero".
const innate = { "Hechicería innata": 2 };
const levels: LevelRow[] = [
  {
    level: 1, proficiencyBonus: 2, resources: innate, cantrips: 4, preparedSpells: 2, slots: [2],
    features: [
      {
        name: "Lanzamiento de conjuros",
        summary: "Lanzás conjuros de hechicero con Carisma como aptitud mágica; un canalizador arcano sirve de canalizador. Conocés 4 trucos y preparás conjuros de nivel 1 y superiores; recuperás los espacios en descanso largo.",
      },
      {
        name: "Hechicería innata",
        summary: "Como acción adicional, durante 1 minuto la CD de salvación de tus conjuros de hechicero aumenta en 1 y tenés ventaja en sus tiradas de ataque. Dos usos, que recuperás en descanso largo.",
      },
    ],
    choices: [],
  },
  {
    level: 2, proficiencyBonus: 2, resources: { ...innate, "Puntos de hechicería": 2 }, cantrips: 4, preparedSpells: 4, slots: [3],
    features: [
      {
        name: "Fuente de magia",
        summary: "Tenés puntos de hechicería (2 en nivel 2) que recuperás en descanso largo. Podés convertir un espacio de conjuro en puntos igual a su nivel, o crear espacios de conjuro (hasta nivel 5) con una acción adicional pagando puntos.",
      },
      {
        name: "Metamagia",
        summary: "Elegís dos opciones de metamagia para modificar tus conjuros pagando puntos de hechicería. Solo una opción por conjuro, salvo que se indique otra cosa. Ganás más opciones en los niveles 10 y 17.",
      },
    ],
    choices: [
      { id: "class.sorcerer.metamagic", label: "Metamagia", count: 2, options: METAMAGIC },
    ],
  },
  {
    level: 3, proficiencyBonus: 2, resources: { ...innate, "Puntos de hechicería": 3 }, cantrips: 4, preparedSpells: 6, slots: [4, 2],
    features: [subclassTrait("hechicero", "Hechicería dracónica")],
    choices: [],
  },
  {
    level: 4, proficiencyBonus: 2, resources: { ...innate, "Puntos de hechicería": 4 }, cantrips: 5, preparedSpells: 7, slots: [4, 3],
    features: [ASI_TRAIT],
    choices: [level4FeatChoice("sorcerer")],
  },
  {
    level: 5, proficiencyBonus: 3, resources: { ...innate, "Puntos de hechicería": 5 }, cantrips: 5, preparedSpells: 9, slots: [4, 3, 2],
    features: [
      {
        name: "Recuperación mágica",
        summary: "Tras un descanso corto recuperás puntos de hechicería hasta la mitad de tu nivel de hechicero (redondeando hacia abajo). Una vez por descanso largo.",
      },
    ],
    choices: [],
  },
  { level: 6, proficiencyBonus: 3, resources: { ...innate, "Puntos de hechicería": 6 }, cantrips: 5, preparedSpells: 10, slots: [4, 3, 3], features: [], choices: [] },
  {
    level: 7, proficiencyBonus: 3, resources: { ...innate, "Puntos de hechicería": 7 }, cantrips: 5, preparedSpells: 11, slots: [4, 3, 3, 1],
    features: [
      {
        name: "Encarnación mágica",
        summary: "Sin usos de Hechicería innata, podés activarla gastando 2 puntos de hechicería. Mientras está activa, podés usar hasta dos opciones de metamagia en cada conjuro.",
      },
    ],
    choices: [],
  },
  {
    level: 8, proficiencyBonus: 3, resources: { ...innate, "Puntos de hechicería": 8 }, cantrips: 5, preparedSpells: 12, slots: [4, 3, 3, 2],
    features: [ASI_TRAIT],
    choices: [asiFeatChoice("sorcerer", 8)],
  },
  { level: 9, proficiencyBonus: 4, resources: { ...innate, "Puntos de hechicería": 9 }, cantrips: 5, preparedSpells: 14, slots: [4, 3, 3, 3, 1], features: [], choices: [] },
  {
    level: 10, proficiencyBonus: 4, resources: { ...innate, "Puntos de hechicería": 10 }, cantrips: 6, preparedSpells: 15, slots: [4, 3, 3, 3, 2],
    features: [{ name: "Metamagia (nivel 10)", summary: "Obtenés dos opciones de metamagia más." }],
    choices: [{ id: "class.sorcerer.metamagic_level10", label: "Metamagia (nivel 10)", count: 2, options: METAMAGIC }],
  },
];

export const SORCERER: ClassData = {
  id: "sorcerer", name: "Hechicero", source: SOURCE,
  hitDie: 6, primaryAbility: ["cha"], saves: ["con", "cha"],
  skillChoice: { count: 2, options: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"] },
  armor: [],
  weapons: ["Armas sencillas"],
  tools: [],
  weaponMasteryCount: 0,
  equipment: {
    A: {
      items: ["spear", "dagger", "dagger", "text:Canalizador arcano (cristal)", "text:Paquete de explorador de mazmorras"],
      gold: 28,
    },
    B: { items: [], gold: 50 },
    C: undefined,
  },
  spellcasting: { ability: "cha", spellList: "sorcerer" },
  unarmoredDefense: null,
  levels,
  subclass: {
    id: "draconic", name: "Hechicería dracónica", level: 3, unarmoredDefense: "draconic", hpBonusPerLevel: 1,
    features: [
      {
        level: 3,
        feature: {
          name: "Resistencia dracónica",
          summary: "Tus puntos de golpe máximos aumentan en 3 y en 1 más por cada nivel de hechicero que subas. Sin armadura, tu CA base es 10 + modificadores de Destreza y Carisma.",
        },
      },
      {
        level: 3,
        feature: {
          name: "Conjuros dracónicos",
          summary: "Siempre tenés preparados aliento de dragón, alterar el propio aspecto, orbe cromático y orden imperiosa; más adelante se suman otros (niveles 5, 7 y 9).",
          spells: ["dragons_breath", "alter_self", "chromatic_orb", "command"],
        },
      },
      {
        level: 5,
        feature: { name: "Conjuros dracónicos (nivel 5)", summary: "Siempre tenés preparados terror y volar.", spells: ["fear", "fly"] },
      },
      {
        level: 6,
        feature: {
          name: "Afinidad elemental",
          summary: "Tenés resistencia al tipo de daño elegido y, al lanzar un conjuro que inflija ese daño, sumás tu modificador de Carisma a una de sus tiradas de daño.",
        },
        choices: [
          {
            id: "subclass.draconic.elemental_affinity", label: "Afinidad elemental", count: 1,
            options: [
              ["acid", "Ácido"], ["cold", "Frío"], ["fire", "Fuego"], ["lightning", "Relámpago"], ["poison", "Veneno"],
            ].map(([id, name]) => ({ id, name, summary: `Resistencia al daño de ${name.toLowerCase()} y +Carisma al daño de ${name.toLowerCase()} de tus conjuros.` })),
          },
        ],
      },
      {
        level: 7,
        feature: {
          name: "Conjuros dracónicos (nivel 7)",
          summary: "Siempre tenés preparados hechizar monstruo y ojo arcano.",
          spells: ["charm_monster", "arcane_eye"],
        },
      },
      {
        level: 9,
        feature: {
          name: "Conjuros dracónicos (nivel 9)",
          summary: "Siempre tenés preparados conocer las leyendas e invocar dragón.",
          spells: ["legend_lore", "summon_dragon"],
        },
      },
    ],
  },
};
