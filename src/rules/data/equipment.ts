const SOURCE = "SRD 5.2" as const;

export interface WeaponData {
  id: string;
  name: string;
  category: "simple" | "martial";
  ranged: boolean;
  damage: string;
  damageType: string;
  properties: string[];
  finesse: boolean;
  mastery: string;
  source: "SRD 5.2";
}

export interface ArmorData {
  id: string;
  name: string;
  type: "light" | "medium" | "heavy" | "shield";
  baseAc: number;
  source: "SRD 5.2";
}

type Row = [id: string, name: string, damage: string, damageType: string, properties: string[], mastery: string];

const weapons = (category: WeaponData["category"], ranged: boolean, rows: Row[]): WeaponData[] =>
  rows.map(([id, name, damage, damageType, properties, mastery]) => ({
    id, name, category, ranged, damage, damageType, properties,
    finesse: properties.includes("Sutil"), mastery, source: SOURCE,
  }));

// Transcribed from the official Spanish SRD 5.2.1 "Armas" table (ranges in meters).
export const WEAPONS: WeaponData[] = [
  ...weapons("simple", false, [
    ["quarterstaff", "Bastón", "1d6", "contundente", ["Versátil (1d8)"], "Derribar"],
    ["dagger", "Daga", "1d4", "perforante", ["Arrojadiza (alcance 6/18)", "Ligera", "Sutil"], "Mellar"],
    ["club", "Garrote", "1d4", "contundente", ["Ligero"], "Ralentizar"],
    ["greatclub", "Garrote grande", "1d8", "contundente", ["A dos manos"], "Empujar"],
    ["handaxe", "Hacha de mano", "1d6", "cortante", ["Arrojadiza (alcance 6/18)", "Ligera"], "Molestar"],
    ["sickle", "Hoz", "1d4", "cortante", ["Ligera"], "Mellar"],
    ["javelin", "Jabalina", "1d6", "perforante", ["Arrojadiza (alcance 9/36)"], "Ralentizar"],
    ["spear", "Lanza", "1d6", "perforante", ["Arrojadiza (alcance 6/18)", "Versátil (1d8)"], "Debilitar"],
    ["light_hammer", "Martillo ligero", "1d4", "contundente", ["Arrojadizo (alcance 6/18)", "Ligero"], "Mellar"],
    ["mace", "Maza", "1d6", "contundente", [], "Debilitar"],
  ]),
  ...weapons("simple", true, [
    ["shortbow", "Arco corto", "1d6", "perforante", ["A dos manos", "Munición (alcance 24/96; flecha)"], "Molestar"],
    ["light_crossbow", "Ballesta ligera", "1d8", "perforante", ["A dos manos", "Munición (alcance 24/96; virote)", "Recarga"], "Ralentizar"],
    ["dart", "Dardo", "1d4", "perforante", ["Arrojadizo (alcance 6/18)", "Sutil"], "Molestar"],
    ["sling", "Honda", "1d4", "contundente", ["Munición (alcance 9/36; proyectil)"], "Ralentizar"],
  ]),
  ...weapons("martial", false, [
    ["halberd", "Alabarda", "1d10", "cortante", ["A dos manos", "Gran alcance", "Pesada"], "Hender"],
    ["scimitar", "Cimitarra", "1d6", "cortante", ["Ligera", "Sutil"], "Mellar"],
    ["shortsword", "Espada corta", "1d6", "perforante", ["Ligera", "Sutil"], "Molestar"],
    ["longsword", "Espada larga", "1d8", "cortante", ["Versátil (1d10)"], "Debilitar"],
    ["greatsword", "Espadón", "2d6", "cortante", ["A dos manos", "Pesada"], "Rozar"],
    ["rapier", "Estoque", "1d8", "perforante", ["Sutil"], "Molestar"],
    ["glaive", "Guja", "1d10", "cortante", ["A dos manos", "Gran alcance", "Pesada"], "Rozar"],
    ["greataxe", "Hacha a dos manos", "1d12", "cortante", ["A dos manos", "Pesada"], "Hender"],
    ["battleaxe", "Hacha de guerra", "1d8", "cortante", ["Versátil (1d10)"], "Derribar"],
    ["lance", "Lanza de caballería", "1d10", "perforante", ["A dos manos (salvo montado)", "Gran alcance", "Pesada"], "Derribar"],
    ["whip", "Látigo", "1d4", "cortante", ["Gran alcance", "Sutil"], "Ralentizar"],
    ["morningstar", "Lucero del alba", "1d8", "perforante", [], "Debilitar"],
    ["flail", "Mangual", "1d8", "contundente", [], "Debilitar"],
    ["warhammer", "Martillo de guerra", "1d8", "contundente", ["Versátil (1d10)"], "Empujar"],
    ["maul", "Maza a dos manos", "2d6", "contundente", ["A dos manos", "Pesada"], "Derribar"],
    ["pike", "Pica", "1d10", "perforante", ["A dos manos", "Gran alcance", "Pesada"], "Empujar"],
    ["war_pick", "Pico de guerra", "1d8", "perforante", ["Versátil (1d10)"], "Debilitar"],
    ["trident", "Tridente", "1d8", "perforante", ["Arrojadizo (alcance 6/18)", "Versátil (1d10)"], "Derribar"],
  ]),
  ...weapons("martial", true, [
    ["longbow", "Arco largo", "1d8", "perforante", ["A dos manos", "Munición (alcance 45/180; flecha)", "Pesada"], "Ralentizar"],
    ["hand_crossbow", "Ballesta de mano", "1d6", "perforante", ["Ligera", "Munición (alcance 9/36; virote)", "Recarga"], "Molestar"],
    ["heavy_crossbow", "Ballesta pesada", "1d10", "perforante", ["A dos manos", "Munición (alcance 30/120; virote)", "Pesada", "Recarga"], "Empujar"],
    ["blowgun", "Cerbatana", "1", "perforante", ["Munición (alcance 7,5/30; dardo)", "Recarga"], "Molestar"],
    ["musket", "Mosquete", "1d12", "perforante", ["A dos manos", "Munición (alcance 12/36; bala)", "Recarga"], "Ralentizar"],
    ["pistol", "Pistola", "1d10", "perforante", ["Munición (alcance 9/27; bala)", "Recarga"], "Molestar"],
  ]),
];

// Transcribed from the official Spanish SRD 5.2.1 "Armaduras" table.
export const ARMOR: ArmorData[] = [
  { id: "padded_armor", name: "Armadura acolchada", type: "light", baseAc: 11, source: SOURCE },
  { id: "leather_armor", name: "Armadura de cuero", type: "light", baseAc: 11, source: SOURCE },
  { id: "studded_leather_armor", name: "Armadura de cuero tachonado", type: "light", baseAc: 12, source: SOURCE },
  { id: "hide_armor", name: "Armadura de pieles", type: "medium", baseAc: 12, source: SOURCE },
  { id: "chain_shirt", name: "Camisa de malla", type: "medium", baseAc: 13, source: SOURCE },
  { id: "scale_mail", name: "Cota de escamas", type: "medium", baseAc: 14, source: SOURCE },
  { id: "breastplate", name: "Coraza", type: "medium", baseAc: 14, source: SOURCE },
  { id: "half_plate_armor", name: "Media armadura", type: "medium", baseAc: 15, source: SOURCE },
  { id: "ring_mail", name: "Cota guarnecida", type: "heavy", baseAc: 14, source: SOURCE },
  { id: "chain_mail", name: "Cota de malla", type: "heavy", baseAc: 16, source: SOURCE },
  { id: "splint_armor", name: "Armadura de bandas", type: "heavy", baseAc: 17, source: SOURCE },
  { id: "plate_armor", name: "Armadura de placas", type: "heavy", baseAc: 18, source: SOURCE },
  { id: "shield", name: "Escudo", type: "shield", baseAc: 2, source: SOURCE },
];

export function findItem(id: string): WeaponData | ArmorData | undefined {
  return WEAPONS.find((w) => w.id === id) ?? ARMOR.find((a) => a.id === id);
}
