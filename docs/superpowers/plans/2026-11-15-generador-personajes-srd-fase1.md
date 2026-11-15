# Generador de personajes SRD 5.2 — Fase 1 (niveles 1–4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A partir de la historia del jugador, generar 3 personajes completos y correctos según el SRD 5.2 (niveles 1–4). Los números los calcula el código. Además, el DM recibe las reglas reales del personaje para responder preguntas al subir de nivel.

**Architecture:** Un módulo nuevo, `src/rules/`, con datos tipados del SRD y funciones puras: qué elecciones pide un personaje (`requiredChoices`), cómo se validan y cómo se calcula la ficha (`buildSheet`). La generación con IA tiene dos pasos que pasan por `LLMClient`: 3 conceptos con ids en `enum`, y después, para cada concepto, las elecciones concretas. Todo se valida con `buildSheet` y se reintenta una vez. La página de personaje pasa a ser una isla React. El prompt del DM suma un bloque de reglas por personaje y un cambio de estado `level`.

**Tech Stack:** Astro 7, React 19, TypeScript estricto, Zod 4, Vitest 5, Gemini a través de `LLMClient`.

**Spec:** `docs/superpowers/specs/2026-11-15-generador-personajes-srd-design.md`

**Alcance de esta fase:** datos y cálculo hasta el nivel 4 (`LOADED_MAX_LEVEL = 4`). Los niveles 5–20 van en un plan aparte, que solo agrega datos y sube esa constante.

## Global Constraints

- Edición: reglas 2024, **SRD 5.2** (CC-BY-4.0). Solo contenido del SRD. Fuente de los datos: el PDF oficial del SRD 5.2. Cada entrada lleva `source: "SRD 5.2"`.
- Identificadores en inglés. Textos visibles y datos de reglas (nombres y resúmenes) en español rioplatense. Si existe traducción oficial del SRD al español, se usan sus nombres.
- Frase fija para lo que no está en los datos, sin cambiar una letra: `Eso no lo tengo, revisalo en tu manual o podés disfrutar las alucinaciones.`
- Matriz estándar: `[15, 14, 13, 12, 10, 8]`. Bonus de trasfondo: +2/+1 o +1/+1/+1, solo a los 3 atributos del trasfondo. Ningún atributo pasa de 20.
- HP: máximo del dado de golpe en nivel 1; después `dado/2 + 1` por nivel. Siempre se suma el modificador de Constitución, con un mínimo de 1 por nivel.
- El nivel lo elige el jugador. El generador acepta de 1 a `LOADED_MAX_LEVEL`.
- Todo acceso al modelo pasa por `LLMClient`. El JSON se valida con Zod del lado del llamador, con un reintento.
- El equipo generado no entra al `inventory`.
- La ficha completa no se guarda en `GameState`.
- Atribución CC-BY-4.0 en el pie del sitio: la declaración de atribución de la página legal del PDF del SRD 5.2, copiada textual.

## Review Focus

1. **Habilidad repetida entre trasfondo y clase** (ej.: Soldado da Atletismo y el Guerrero también la elige). `buildSheet` la rechaza con un error que nombra la habilidad, y el reintento del generador manda ese error. Test en Task 5.
2. **El modelo devuelve atributos que no son la matriz estándar** (dos 15, un 16, uno faltante). Se rechaza. Test en Task 5.
3. **Bonus de trasfondo inválido** (atributo fuera de los 3 del trasfondo, total distinto de 3, o resultado mayor a 20 tras la mejora de nivel 4). Se rechaza. Test en Task 5.
4. **Partida vieja con "Semielfo" o una clase escrita a mano.** Carga igual, y el bloque de reglas del DM nombra lo que falta en vez de inventarlo. Tests en Task 8 y Task 11.
5. **Portapapeles no disponible** (contexto no seguro o permiso denegado). "Copiar ficha" no falla en silencio: muestra el texto seleccionado en un `<textarea>` con un aviso. Lógica en `copyText` con un test en Task 10.

---

## File Structure

```
src/rules/
  types.ts            Tipos de datos de reglas y de ficha
  data/species.ts     9 especies + opciones (linajes, legados, ascendencias)
  data/backgrounds.ts 4 trasfondos
  data/feats.ts       Dotes de origen, generales (nivel 4), estilos de combate
  data/equipment.ts   Armas (con maestría), armaduras, escudo
  data/classes/*.ts   Un archivo por clase (12), niveles 1–4 + subclase
  data/spells.ts      Trucos y hechizos de nivel 1–2 con sus clases
  index.ts            Catálogo, búsquedas, LOADED_MAX_LEVEL
  choices.ts          requiredChoices / activeChoices
  buildSheet.ts       Validación + cálculo
  formatSheet.ts      Texto plano y Markdown para copiar
  generatorPrompt.ts  Prompts y esquemas de los dos pasos
  generateOptions.ts  Orquestación de la generación
src/engine/rulesBlock.ts      Bloque REGLAS DE LOS PERSONAJES
src/character/CharacterCreator.tsx, CharacterForm.tsx, CharacterGenerator.tsx,
  SheetView.tsx, formValues.ts, clipboard.ts
tests/rules-data.test.ts, choices.test.ts, buildSheet.test.ts,
  formatSheet.test.ts, generateOptions.test.ts, rulesBlock.test.ts,
  formValues.test.ts (+ cambios en schemas, applyChanges, mockGame/migrations)
```

---

### Task 1: Tipos de reglas, especies, trasfondos y dotes

**Files:**
- Create: `src/rules/types.ts`, `src/rules/data/species.ts`, `src/rules/data/backgrounds.ts`, `src/rules/data/feats.ts`, `src/rules/index.ts`
- Test: `tests/rules-data.test.ts`

**Interfaces:**
- Produces (`src/rules/types.ts`):

```ts
export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: Ability[];
export type SkillId = "acrobatics" | "animal_handling" | "arcana" | "athletics" | "deception"
  | "history" | "insight" | "intimidation" | "investigation" | "medicine" | "nature"
  | "perception" | "performance" | "persuasion" | "religion" | "sleight_of_hand"
  | "stealth" | "survival";
export const SKILLS: { id: SkillId; name: string; ability: Ability }[];
export interface Trait { name: string; summary: string }
export interface Option {
  id: string; name: string; summary: string;
  /** Spells this option grants, from the character level given. */
  spells?: { fromLevel: number; spellId: string }[];
  /** Skill proficiency it grants (e.g. Keen Senses). */
  skill?: SkillId;
}
export interface ChoiceSpec {
  /** Namespaced: "species.elf.lineage", "class.fighter.fighting_style", "feat.skilled.skills" */
  id: string; label: string; count: number; options: Option[];
  allowRepeat?: boolean;
  /** Only active when that pick was made. */
  requires?: { choiceId: string; optionId: string };
}
export interface SpeciesData {
  id: string; name: string; source: "SRD 5.2";
  speed: number; size: string; traits: Trait[];
  hpBonusPerLevel: number;          // 1 for dwarf, 0 otherwise
  fixedSkills: SkillId[];
  choices: ChoiceSpec[];            // lineage/legacy/ancestry, human skill & origin feat
}
export interface BackgroundData {
  id: string; name: string; source: "SRD 5.2";
  abilities: [Ability, Ability, Ability];
  featId: string; skills: [SkillId, SkillId]; tool: string;
  equipment: { A: string[]; B: string[] };  // B is the gold option
  gold: { A: number; B: number };
}
export interface FeatData {
  id: string; name: string; source: "SRD 5.2";
  category: "origin" | "general" | "fighting_style";
  summary: string;
  prerequisite?: { minLevel?: number; anyAbility?: { abilities: Ability[]; min: number } };
  choices: ChoiceSpec[];            // e.g. Skilled: 3 skills; Magic Initiate: cantrips + spell; ASI: 2 abilities allowRepeat
  initiativeAddsProficiency?: boolean; // Alert
}
```

- Produces (`src/rules/index.ts`): `SPECIES: SpeciesData[]`, `BACKGROUNDS: BackgroundData[]`, `FEATS: FeatData[]`, `findSpecies(idOrName: string): SpeciesData | undefined` (sin distinguir mayúsculas), `findBackground(id)`, `findFeat(id)`, `LOADED_MAX_LEVEL = 4`, `STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const`.

- [ ] **Step 1: Write the failing tests** in `tests/rules-data.test.ts`:
  - `SPECIES.map(s => s.id)` es exactamente `["dragonborn","dwarf","elf","gnome","goliath","halfling","human","orc","tiefling"]` (sin importar el orden).
  - `BACKGROUNDS` ids: `["acolyte","criminal","sage","soldier"]`. Soldado: `abilities` `["str","dex","con"]`, `featId` `"savage_attacker"`, `skills` `["athletics","intimidation"]`. Acólito: `featId` `"magic_initiate_cleric"`. Sabio: `"magic_initiate_wizard"`. Criminal: `"alert"`.
  - Velocidad: goliat 35, enano 30. Enano `hpBonusPerLevel` 1.
  - Elfo: la elección `species.elf.lineage` tiene 3 opciones, y `species.elf.keen_senses` ofrece insight, perception y survival. Humano: `species.human.skillful` (count 1, las 18 habilidades) y `species.human.versatile` (dotes de origen).
  - Integridad: ids únicos dentro de cada lista y entre todas las `ChoiceSpec`. Todo `featId` de un trasfondo existe en `FEATS`. Todo `requires.choiceId` apunta a una spec existente. Todo `source === "SRD 5.2"`.
  - `findSpecies("Elfo")` y `findSpecies("elf")` devuelven el mismo objeto.
- [ ] **Step 2:** `pnpm test tests/rules-data.test.ts` → FAIL (no existe el módulo).
- [ ] **Step 3:** Escribir los tipos y transcribir los datos del PDF del SRD 5.2. Las dotes de esta tarea son: `alert`, `magic_initiate_cleric`, `magic_initiate_druid`, `magic_initiate_wizard`, `savage_attacker`, `skilled` (solo habilidades, sin herramientas), `ability_score_improvement` (general, nivel 4, elección `feat.asi.abilities` con count 2 y `allowRepeat`), `grappler` (general, Fue o Des 13) y los estilos de combate del SRD. Las opciones de hechizo de Iniciado en la Magia quedan vacías hasta la Task 4: se llenan desde `spells.ts` con una función, no a mano.
- [ ] **Step 4:** `pnpm test tests/rules-data.test.ts` → PASS.
- [ ] **Step 5:** Commit `Add SRD 5.2 species, backgrounds and feats data`.

### Task 2: Equipo y cálculo de CA

**Files:**
- Create: `src/rules/data/equipment.ts`, `src/rules/armorClass.ts`
- Test: `tests/rules-data.test.ts` (agregar), `tests/armorClass.test.ts`

**Interfaces:**
- Produces:

```ts
export interface WeaponData { id: string; name: string; category: "simple" | "martial";
  ranged: boolean; damage: string; damageType: string; properties: string[]; finesse: boolean;
  mastery: string; source: "SRD 5.2" }
export interface ArmorData { id: string; name: string; type: "light" | "medium" | "heavy" | "shield";
  baseAc: number; source: "SRD 5.2" }
export const WEAPONS: WeaponData[]; export const ARMOR: ArmorData[];
export function findItem(id: string): WeaponData | ArmorData | undefined;

// src/rules/armorClass.ts
export interface AcInput { mods: Record<Ability, number>; armorId: string | null; shield: boolean;
  unarmoredDefense: "barbarian" | "monk" | "draconic" | null; defenseStyle: boolean }
export function armorClass(input: AcInput): number;
```

- [ ] **Step 1: Tests** (`tests/armorClass.test.ts`, con Des +2, Con +3, Sab +1, Car +2):
  - sin armadura → 12; armadura de cuero (11, ligera) → 13; cota de escamas (14, media) con Des +3 → 16 (tope +2); cota de mallas (16, pesada) → 16; con escudo → +2.
  - bárbaro sin armadura → 10+2+3 = 15, con escudo → 17.
  - monje sin armadura → 13, y con escudo pierde el bonus (→ 12+2 = 14, se usa la fórmula base más el escudo).
  - `defenseStyle` suma +1 solo si hay armadura.
  - draconic sin armadura → 10+2+2 = 14.
  - Se usa el máximo entre las fórmulas aplicables.
  - En `rules-data.test.ts`: espada larga `damage` `"1d8"` con `mastery` de nombre no vacío, y todas las armas y armaduras con ids únicos.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Transcribir armas y armaduras del SRD 5.2 e implementar `armorClass`.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Add SRD 5.2 equipment data and armor class calculation`.

### Task 3: Clases niveles 1–4 con subclase

**Files:**
- Create: `src/rules/data/classes/{barbarian,bard,cleric,druid,fighter,monk,paladin,ranger,rogue,sorcerer,warlock,wizard}.ts`, `src/rules/data/classes/index.ts`
- Modify: `src/rules/types.ts`, `src/rules/index.ts`
- Test: `tests/rules-data.test.ts` (agregar)

**Interfaces:**
- Produces (`types.ts`):

```ts
export interface LevelRow {
  level: number; proficiencyBonus: number; features: Trait[];
  /** Class resources by name, e.g. { "Furias": 2 } */
  resources: Record<string, number>;
  cantrips?: number; preparedSpells?: number; slots?: number[];   // slots[0] = 1st level
  pactSlots?: { count: number; slotLevel: number };
  /** Choices gained at this level, e.g. fighting style at 1, ASI feat at 4. */
  choices: ChoiceSpec[];
}
export interface ClassData {
  id: string; name: string; source: "SRD 5.2";
  hitDie: 6 | 8 | 10 | 12; primaryAbility: Ability[]; saves: [Ability, Ability];
  skillChoice: { count: number; options: SkillId[] };
  armor: string[]; weapons: string[]; tools: string[];
  weaponMasteryCount: number;              // 0 if none
  equipment: Record<"A" | "B" | "C", { items: string[]; gold: number } | undefined>;
  spellcasting: { ability: Ability; spellList: string } | null;
  unarmoredDefense: "barbarian" | "monk" | null;
  levels: LevelRow[];                      // rows 1..LOADED_MAX_LEVEL
  subclass: { id: string; name: string; level: number; features: { level: number; feature: Trait; choices?: ChoiceSpec[] }[]; unarmoredDefense?: "draconic" };
}
```

- Produces (`index.ts`): `CLASSES_DATA: ClassData[]`, `findClass(idOrName: string): ClassData | undefined`. Busca por id o por nombre en español sin distinguir mayúsculas. Los nombres son exactamente los de la lista `CLASSES` actual: "Bárbaro", "Bardo", "Clérigo", "Druida", "Guerrero", "Monje", "Paladín", "Explorador", "Pícaro", "Hechicero", "Brujo", "Mago".

- [ ] **Step 1: Tests** (en `rules-data.test.ts`):
  - 12 clases, cada una con `levels.length === LOADED_MAX_LEVEL`, filas 1..4 en orden, `proficiencyBonus` 2 en todas.
  - Todas con `subclass.level === 3`.
  - Bárbaro: d12, salvaciones str/con, 2 habilidades entre animal_handling, athletics, intimidation, nature, perception, survival, `weaponMasteryCount` 2, `resources.Furias` 2 en nivel 1 y 3 en nivel 3.
  - Guerrero: d10, str/con, `weaponMasteryCount` 3, la fila 1 tiene una elección de estilo de combate cuyas opciones son las dotes `fighting_style` de `FEATS`, subclase `champion`.
  - Pícaro: d8, dex/int, 4 habilidades, la fila 1 tiene `class.rogue.expertise` con count 2.
  - Mago: d6, int/wis, `cantrips` 3 y `preparedSpells` 4 en nivel 1, `slots` `[2]`, `[3]`, `[4,2]`, `[4,3]` en los niveles 1 a 4.
  - Brujo: `pactSlots` `{count:1, slotLevel:1}` en nivel 1 y `{count:2, slotLevel:1}` en nivel 2; invocaciones en las filas 1 y 2 según el SRD.
  - Paladín: lanza conjuros desde el nivel 1 (`slots` `[2]`).
  - Cada fila 4 tiene la elección `class.<id>.level4_feat`, con opciones que son las dotes `general`.
  - Integridad: los ids de `ChoiceSpec` son únicos en todo el catálogo y los ids de equipo existen en `findItem` (o son ítems de texto con el prefijo `text:`).
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Transcribir del SRD 5.2 las 12 clases con sus elecciones de niveles 1–4: estilo de combate, maestría con armas (`class.<id>.weapon_mastery`, con opciones de `WEAPONS`), pericia, invocaciones, metamagia, orden divina, orden primigenia e instrumentos y herramientas a elegir. Las elecciones de hechizos se agregan en la Task 4.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Add SRD 5.2 class data for levels 1-4`.

### Task 4: Hechizos (trucos, nivel 1 y 2) y elecciones de conjuros

**Files:**
- Create: `src/rules/data/spells.ts`
- Modify: `src/rules/data/feats.ts` (opciones de Iniciado en la Magia), `src/rules/data/species.ts` (los hechizos de linajes y legados apuntan a ids reales)
- Test: `tests/rules-data.test.ts` (agregar)

**Interfaces:**
- Produces: `interface SpellData { id: string; name: string; level: 0 | 1 | 2; school: string; lists: string[]; summary: string; source: "SRD 5.2" }`, `SPELLS: SpellData[]`, `spellsFor(list: string, level: number): SpellData[]`, `findSpell(id)`.

- [ ] **Step 1: Tests:**
  - Todo `spellId` mencionado en especies o dotes existe.
  - `spellsFor("wizard", 0)` incluye el id de *Rayo de escarcha* y `spellsFor("cleric", 1)` incluye *Curar heridas*.
  - Las elecciones `feat.magic_initiate_<lista>.cantrips` (count 2) y `.spell` (count 1) tienen como opciones exactamente `spellsFor(lista, 0)` y `spellsFor(lista, 1)`.
  - `summary` no está vacío en ningún hechizo.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Transcribir los hechizos de nivel 0–2 del SRD 5.2 (nombre, nivel, escuela, listas y un resumen de una línea). Generar las opciones de Iniciado en la Magia con `spellsFor`.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Add SRD 5.2 spells up to 2nd level`.

### Task 5: Elecciones requeridas y validación

**Files:**
- Create: `src/rules/choices.ts`, `src/rules/buildSheet.ts` (solo la validación en esta tarea)
- Test: `tests/choices.test.ts`, `tests/buildSheet.test.ts`

**Interfaces:**
- Produces:

```ts
// choices.ts
export interface Concept { speciesId: string; classId: string; backgroundId: string; level: number }
/** All specs this concept can need, conditional ones included (with `requires`). Spell
    choices are derived here from the class row: "class.<id>.cantrips" and
    "class.<id>.prepared" (options from spellsFor(class list, ≤ highest slot level)),
    plus "class.wizard.spellbook" (6 + 2 per level after 1). Skills: "class.<id>.skills". */
export function requiredChoices(concept: Concept): ChoiceSpec[];
/** Drops specs whose `requires` pick was not made. */
export function activeChoices(specs: ChoiceSpec[], picks: Record<string, string[]>): ChoiceSpec[];

// buildSheet.ts
export interface CharacterChoices extends Concept {
  baseScores: Record<Ability, number>;
  backgroundBonus: Partial<Record<Ability, number>>;
  classEquipment: "A" | "B" | "C";
  backgroundEquipment: "A" | "B";
  picks: Record<string, string[]>;
}
export interface ChoiceError { field: string; message: string }   // message in Spanish
export function validateChoices(choices: CharacterChoices): ChoiceError[];
```

- [ ] **Step 1: Tests.** Usar un fixture válido `fighterChoices()` (Humano Guerrero nivel 1, Soldado) en `tests/helpers.ts`.
  - `requiredChoices` de Humano Guerrero nivel 1 incluye `species.human.skillful`, `species.human.versatile`, `class.fighter.skills`, `class.fighter.fighting_style` y `class.fighter.weapon_mastery` (count 3). No incluye `class.fighter.level4_feat`.
  - Con nivel 4 sí la incluye. `activeChoices` agrega `feat.asi.abilities` solo si se eligió `ability_score_improvement`. Si en `species.human.versatile` se elige `skilled`, aparece `feat.skilled.skills`.
  - Clérigo nivel 1: `class.cleric.cantrips` count 3 y `class.cleric.prepared` count 4, con opciones de nivel 1 o menor.
  - `validateChoices(fighterChoices())` → `[]`.
  - Errores, cada uno con su `field`:
    - Atributos que no son la matriz estándar (`{str:15,dex:15,...}`) → field `baseScores`.
    - Bonus de trasfondo en `int` para Soldado, o que suma 4, o `{str:3}` → field `backgroundBonus`.
    - Atletismo elegido en `class.fighter.skills` siendo Soldado → field `picks.class.fighter.skills`, con el mensaje que nombra "Atletismo".
    - Cantidad de picks distinta de `count`, opción inexistente, repetida sin `allowRepeat`, o una spec activa sin elegir.
    - Nivel 0, nivel 5 (`> LOADED_MAX_LEVEL`) o ids de especie, clase o trasfondo inexistentes.
    - `grappler` con Fue 12 y Des 12 → falla el prerrequisito.
    - Una mejora de atributo que deja un atributo en 21 → field `picks.feat.asi.abilities`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar `requiredChoices`, `activeChoices` y `validateChoices`. Los mensajes van en español porque se le reenvían al modelo en el reintento.
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Add required choices and validation for SRD characters`.

### Task 6: Cálculo de la ficha

**Files:**
- Modify: `src/rules/buildSheet.ts`, `src/rules/types.ts`
- Test: `tests/buildSheet.test.ts` (agregar)

**Interfaces:**
- Produces:

```ts
export interface CharacterSheet {
  species: string; className: string; subclass: string | null; level: number; background: string;
  abilities: Record<Ability, { score: number; modifier: number; save: number; proficientSave: boolean }>;
  proficiencyBonus: number; hitPoints: number; hitDice: string; armorClass: number;
  initiative: number; speed: number; passivePerception: number;
  skills: { id: SkillId; name: string; bonus: number; proficient: boolean; expertise: boolean }[];
  proficiencies: { armor: string[]; weapons: string[]; tools: string[] };
  attacks: { name: string; attackBonus: number; damage: string; mastery: string | null }[];
  features: { source: string; name: string; summary: string }[];
  spellcasting: null | { ability: Ability; saveDc: number; attackBonus: number; slots: number[];
    pactSlots: { count: number; slotLevel: number } | null;
    cantrips: string[]; prepared: string[]; spellbook: string[] | null; other: string[] };
  equipment: string[]; gold: number;
}
export type BuildResult = { ok: true; sheet: CharacterSheet } | { ok: false; errors: ChoiceError[] };
export function buildSheet(choices: CharacterChoices): BuildResult;  // validateChoices first
```

La subclase se asigna sola cuando `level >= subclass.level`, porque el SRD trae una sola por clase. `spellcasting.other` lista los hechizos de especie y de Iniciado en la Magia. La armadura y el escudo se detectan en el equipo elegido. La primera armadura que aparece es la que se lleva puesta.

- [ ] **Step 1: Tests** sobre el fixture del Guerrero, con base `{str:15,dex:14,con:13,int:8,wis:12,cha:10}`, bonus Soldado `{str:2,con:1}` y estilo Defensa:
  - str 17 (+3), con 14 (+2); HP nivel 1 = 10+2 = 12; nivel 3 = 12 + 2×(6+2) = 28.
  - `proficiencyBonus` 2; salvación de Fue = 3+2 = 5, competente. Atletismo = 5 (del trasfondo).
  - `initiative` = mod de Des.
  - CA según el equipo de la opción A del SRD, más 1 por Defensa (el valor exacto se calcula con la Task 2).
  - Enano nivel 2: HP con +2 extra en total.
  - Pícaro con pericia en Sigilo: `bonus` = Des + 4.
  - Mago nivel 1 con Int 16 (+3): `saveDc` 13, `attackBonus` 5, `slots` `[2]`, 3 trucos, 4 preparados, `spellbook` de 6.
  - Alerta suma el bonificador de competencia a la iniciativa.
  - Monje nivel 2: velocidad 40.
  - `passivePerception` = 10 + Percepción.
  - Un ataque con espada larga: bonus = Fue + 2, daño `"1d8+3"`, maestría solo si se eligió en `weapon_mastery`.
  - Elecciones inválidas → `{ ok: false }` con los mismos errores que `validateChoices`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar `buildSheet` con `armorClass` (Task 2).
- [ ] **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Compute full SRD character sheets in code`.

### Task 7: Formato para copiar

**Files:**
- Create: `src/rules/formatSheet.ts`
- Test: `tests/formatSheet.test.ts`

**Interfaces:**
- Produces: `formatSheetText(sheet: CharacterSheet, name: string, story: string): string` y `formatSheetMarkdown(...)` con la misma firma.

- [ ] **Step 1: Tests:** con la ficha del Guerrero, el texto contiene `"CA "`, `"PG 12"`, `"Fuerza 17 (+3)"`, `"Atletismo +5"` y el nombre. Al final lleva la línea `Reglas: SRD 5.2 (CC-BY-4.0)`. El Markdown arranca con `# <nombre>` y tiene una sección `## Atributos`. Los modificadores negativos salen con signo menos (`-1`), nunca como `+-1`.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Format generated sheets as text and Markdown`.

### Task 8: Personaje con ids, migración v4 y listas desde las reglas

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/character.ts`, `src/persistence/migrations.ts`, `tests/helpers.ts`
- Test: `tests/mockGame.test.ts` (o un `tests/migrations.test.ts` nuevo), `tests/schemas.test.ts`

**Interfaces:**
- Produces:
  - `Character` suma `speciesId: string | null; classId: string | null; subclassId: string | null; srdBackgroundId: string | null`. `race` y `characterClass` siguen siendo las etiquetas. `GAME_STATE_VERSION = 4`.
  - `CharacterInput` = `{ name; speciesId; classId; subclassId: string | null; srdBackgroundId: string | null; level; background }`.
  - En `character.ts`, `RACES` se reemplaza por `SPECIES_OPTIONS` (`{ id, label }[]` derivado de `SPECIES`). `CLASSES` pasa a derivarse de `CLASSES_DATA` con la misma forma `{ id, label }`. Se suma `BACKGROUND_OPTIONS`.
  - `createCharacter` valida que los ids existan. Rechaza `subclassId` si `level < subclass.level` o si no es la subclase de esa clase.
  - En `migrations.ts`, `fromV3` resuelve `speciesId` con `findSpecies(race)?.id ?? null` y `classId` con `findClass(characterClass)?.id ?? null`. Deja `subclassId` y `srdBackgroundId` en `null`.
- [ ] **Step 1: Tests:**
  - Una partida v3 con `race: "Semielfo"` y `characterClass: "Pícaro"` migra a v4 con `speciesId: null` y `classId: "rogue"`, y carga.
  - Una v3 con `"Elfo"` queda con `speciesId: "elf"`.
  - `createGame` con `speciesId: "elf"` guarda `race: "Elfo"`.
  - `createCharacter` con `subclassId: "thief"` en nivel 2 tira error.
  - `gameStateSchema` acepta los campos nuevos.
  - Actualizar `newGame()` en helpers a la forma nueva.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar y actualizar los usos de `RACES`. **Step 4:** `pnpm test` completo → PASS.
- [ ] **Step 5:** Commit `Store rules ids on characters and migrate saves to v4`.

### Task 9: Generación con IA en dos pasos

**Files:**
- Create: `src/rules/generatorPrompt.ts`, `src/rules/generateOptions.ts`
- Modify: `src/domain/schemas.ts` (exportar `toProviderSchema`)
- Test: `tests/generateOptions.test.ts` (usa `FakeLLMClient`)

**Interfaces:**
- Consumes: `LLMClient.generateStructured`, `requiredChoices`, `activeChoices`, `buildSheet`.
- Produces:

```ts
export interface GeneratedOption { name: string; story: string; pitch: string;
  outsideSrdNote: string | null; choices: CharacterChoices; sheet: CharacterSheet }
export interface GenerationResult { options: GeneratedOption[]; failures: string[] }
export async function generateOptions(llm: LLMClient, story: string, level: number,
  signal?: AbortSignal): Promise<GenerationResult>;
```

- **Paso 1 (conceptos):** una llamada que devuelve `{ concepts: [...] }` con exactamente 3 elementos `{ name, story, pitch, outsideSrdNote: string | null, speciesId, classId, backgroundId }`. Los ids van como `enum` con los ids del catálogo, y el prompt lista id y nombre en español de especies, clases (con el nombre de su subclase) y trasfondos.
- **Paso 2 (elecciones):** una llamada por concepto, las 3 en paralelo. El esquema se arma con los specs de `requiredChoices(concepto)`:
  - `baseScores`: un entero por atributo.
  - `backgroundBonus`: array de `{ability: enum de los 3 del trasfondo, amount: 1|2}`.
  - `classEquipment` y `backgroundEquipment`: `enum`.
  - `picks`: array de `{ choiceId: enum, optionIds: string[] }`.

  El prompt lista cada spec con id, etiqueta, count, la condición `requires` en texto ("solo si en X elegiste Y") y sus opciones (`id — nombre`).
- Reintento: si el paso 1 no se puede parsear, o el paso 2 no pasa `buildSheet`, se reintenta una vez esa llamada. En el paso 2 se agrega al prompt `ERRORES DEL INTENTO ANTERIOR` con los `ChoiceError`. Si vuelve a fallar, ese concepto va a `failures` con un mensaje en español y los demás siguen.
- Prompt de sistema (español rioplatense): elegir lo que mejor encaje con la historia. Si la historia pide algo fuera del catálogo, elegir lo más parecido y completar `outsideSrdNote` con la frase fija de Global Constraints más qué se reemplazó. Los atributos usan la matriz estándar, priorizando el atributo principal de la clase.
- `level` fuera de `1..LOADED_MAX_LEVEL` o `story` vacía (después de `trim`) → tira `Error` antes de llamar al modelo.

- [ ] **Step 1: Tests** con `FakeLLMClient` y respuestas guionadas:
  - Camino feliz → 3 opciones con `sheet`.
  - Paso 2 inválido una vez (Atletismo repetido) y válido después → 3 opciones, y el segundo prompt contiene `ERRORES DEL INTENTO ANTERIOR` y "Atletismo".
  - Inválido dos veces → 2 opciones y 1 `failure`.
  - El esquema del paso 1 tiene `enum` con los 9 ids de especie.
  - Nivel 5 → error sin llamadas al modelo.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Generate three SRD character options from a story`.

### Task 10: Página de personaje en React, generador y atribución

**Files:**
- Create: `src/character/CharacterCreator.tsx`, `src/character/CharacterForm.tsx`, `src/character/CharacterGenerator.tsx`, `src/character/SheetView.tsx`, `src/character/formValues.ts`, `src/character/clipboard.ts`, `src/character/character.css`
- Modify: `src/pages/character.astro` (queda solo `<CharacterCreator client:only="react" />`), `src/layouts/Base.astro` (atribución en el pie)
- Test: `tests/formValues.test.ts`

**Interfaces:**
- Produces:
  - `formValuesFromOption(option: GeneratedOption): CharacterInput`, que copia nombre, especie, clase, la subclase si corresponde, el trasfondo SRD, el nivel y `background = story`.
  - `copyText(text: string, clipboard: Pick<Clipboard, "writeText"> | undefined): Promise<"copied" | "fallback">`.
- UI según el boceto del spec (sección 4):
  - **Arriba, el generador:** textarea "Tu historia", nivel (1–4), botón "Generar opciones".
  - **Tres tarjetas:** nombre, especie, clase, `pitch` y `outsideSrdNote` si hay, con el botón "Ver ficha".
  - **La ficha** en `SheetView`, con los botones "Copiar ficha", "Copiar en Markdown" y "Usar este personaje".
  - **Abajo, el formulario:** Nombre, Especie, Clase, Subclase (deshabilitada si el nivel es menor que el de la subclase), Nivel (1–20), Trasfondo (reglas) con la opción "Ninguno" y Trasfondo (historia). El submit sigue creando la partida y yendo a `/play`.
  - **Sin API key configurada:** el generador muestra un enlace a `/settings` y el formulario funciona igual.
  - **Mientras genera:** botón deshabilitado y estado "Generando…" con `aria-live`. Las `failures` se muestran como aviso.
  - **Si `copyText` devuelve `"fallback"`:** se muestra un `<textarea readonly>` con el texto seleccionado y el aviso "No pude copiar; seleccioná y copiá a mano."
  - **Pie:** la declaración de atribución del SRD 5.2, textual.
- [ ] **Step 1: Tests:** `formValuesFromOption` en nivel 1 deja `subclassId: null` y en nivel 3 deja la subclase. `copyText` con `undefined` devuelve `"fallback"`, con un `writeText` que rechaza devuelve `"fallback"`, y con uno que resuelve devuelve `"copied"`.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** `pnpm test` y `pnpm check` → sin errores.
- [ ] **Step 5:** Verificación manual con `pnpm dev`:
  - Crear un personaje sin generador.
  - Generar con una historia real, ver la ficha, copiar y "Usar este personaje".
  - Crear la partida y comprobar que la partida empieza.
  - Repetir en modo oscuro y a 375 px de ancho.
- [ ] **Step 6:** Commit `Add the character generator to the character page`.

### Task 11: Bloque de reglas para el DM

**Files:**
- Create: `src/engine/rulesBlock.ts`
- Modify: `src/engine/dmPrompt.ts`
- Test: `tests/rulesBlock.test.ts`, `tests/memory.test.ts` (prompt)

**Interfaces:**
- Produces: `describeCharacterRules(players: Character[]): string`. Por cada personaje usa `classId` y `speciesId`; si son `null`, busca por etiqueta con `findClass` y `findSpecies`. El bloque incluye:
  - El encabezado `Nombre — Especie Clase (Subclase) nivel N`.
  - El bonificador de competencia.
  - Los rasgos de clase y subclase del nivel actual y del siguiente (nombre: resumen).
  - Los espacios de conjuro de ambos niveles, si tiene.
  - Los nombres de los rasgos de especie.
  - Una línea `Sin datos de reglas: …` que nombra lo que no coincide: especie, clase, subclase no elegida aunque el nivel ya la habilita, o un nivel mayor a `LOADED_MAX_LEVEL`.
- `buildTurnPrompt` agrega `REGLAS DE LOS PERSONAJES\n<bloque>` después de `ESTADO`.
- Se agrega a `DM_SYSTEM_PROMPT`, antes de `EVENTOS`, este texto exacto:

```
REGLAS
- En REGLAS DE LOS PERSONAJES tenés los rasgos reales (SRD 5.2, reglas 2024) del nivel actual y del siguiente de cada personaje. Para preguntas de reglas o de subida de nivel, usá solo eso.
- Si te preguntan algo que no figura ahí, respondé: "Eso no lo tengo, revisalo en tu manual o podés disfrutar las alucinaciones." Si el jugador elige las alucinaciones, podés improvisar, pero aclarale que no sale de las reglas.
- Cuando la historia lo justifique o el jugador lo pida, subí al personaje un nivel con un cambio "level" (de a uno).
```

- [ ] **Step 1: Tests:**
  - Guerrero nivel 2 → contiene "Oleada de acción" (o el nombre SRD en español elegido en la Task 3) y los rasgos del nivel 3 del Campeón.
  - Pícaro nivel 3 sin `subclassId` → contiene `Sin datos de reglas` y "subclase".
  - `race: "Semielfo"` → `Sin datos de reglas` y "Semielfo".
  - Nivel 4 → nombra el nivel 5 como no cargado.
  - `buildTurnPrompt` contiene `REGLAS DE LOS PERSONAJES`.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** Correr → PASS.
- [ ] **Step 5:** Commit `Give the DM the character's real rules`.

### Task 12: Cambio de estado `level`

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/applyChanges.ts`, `src/engine/dmPrompt.ts` (agregar `level_up` a la lista de EVENTOS)
- Test: `tests/applyChanges.test.ts`, `tests/schemas.test.ts`

**Interfaces:**
- Produces: `StateChange` suma `{ type: "level"; playerId: string; level: number }`. Zod: `level` entero 1–20.
- `applyStateChanges` lo aplica solo si `level === player.level + 1` (y como máximo 20). Si no, va a `rejected` con el motivo `"Level changes go one at a time."`. La búsqueda del jugador es la misma que en el inventario.

- [ ] **Step 1: Tests:**
  - Nivel 3 → `level: 4` se aplica.
  - `level: 5` desde 3 se rechaza.
  - En 20, `level: 21` falla en el parseo.
  - `parseDMResponse` acepta el tipo nuevo.
- [ ] **Step 2:** Correr → FAIL. **Step 3:** Implementar. **Step 4:** `pnpm test` y `pnpm check` → PASS.
- [ ] **Step 5:** Commit `Let the DM level up characters one level at a time`.
