import { createGame } from "../src/domain/character";
import type { DMResponse, GameState } from "../src/domain/types";
import type { CharacterChoices } from "../src/rules/buildSheet";
import { activeChoices, isInvocationCantripChoice, requiredChoices } from "../src/rules/choices";
import { CLASSES_DATA, SPECIES, STANDARD_ARRAY, findBackground } from "../src/rules";
import { alwaysPreparedSpells } from "../src/rules/sheet";
import { ABILITIES } from "../src/rules/types";
import type { Ability } from "../src/rules/types";

export function newGame(): GameState {
  let counter = 0;
  return createGame(
    { name: "Lira", race: "Elfo", classId: "rogue", level: 3, background: "" },
    { newId: () => `id-${(counter += 1)}`, now: () => new Date("2026-01-01T00:00:00Z") },
  );
}

export const PLAYER_ID = "id-2"; // id-1 is the game itself

export function reply(overrides: Partial<DMResponse> = {}): DMResponse {
  return {
    narration: "Llegás a la posada del Ciervo Blanco.",
    playerRoll: null,
    enemyRolls: [],
    stateChanges: [],
    events: [],
    ...overrides,
  };
}

/** A valid level 1 human fighter with the soldier background. */
export function fighterChoices(overrides: Partial<CharacterChoices> = {}): CharacterChoices {
  return {
    speciesId: "human",
    classId: "fighter",
    backgroundId: "soldier",
    level: 1,
    baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
    backgroundBonus: { str: 2, con: 1 },
    classEquipment: "A",
    backgroundEquipment: "A",
    picks: {
      "origin.languages": ["elvish", "dwarvish"],
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "background.soldier.tool": ["dice"],
      "class.fighter.skills": ["acrobatics", "survival"],
      "class.fighter.fighting_style": ["defense"],
      "class.fighter.weapon_mastery": ["longsword", "greatsword", "longbow"],
    },
    ...overrides,
  };
}

/** Builds a legal character with a deterministic greedy picker: for each active choice, the first options
    that do not repeat anything already taken (skills, spells, feats, languages, weapons...). */
export function greedyChoices(speciesId: string, classId: string, backgroundId: string, level: number): CharacterChoices {
  const cls = CLASSES_DATA.find((c) => c.id === classId)!;
  const background = findBackground(backgroundId)!;
  const species = SPECIES.find((s) => s.id === speciesId)!;
  const order: Ability[] = [cls.primaryAbility[0]!, ...ABILITIES.filter((a) => a !== cls.primaryAbility[0])];
  const baseScores = Object.fromEntries(order.map((a, i) => [a, STANDARD_ARRAY[i]])) as Record<Ability, number>;
  const backgroundBonus = { [background.abilities[0]]: 2, [background.abilities[1]]: 1 };

  const picks: Record<string, string[]> = {};
  const speciesSpells = (species.spells ?? []).map((g) => g.spellId);
  const used = new Set<string>([
    background.featId, ...background.skills, ...species.fixedSkills, ...speciesSpells, ...alwaysPreparedSpells(cls, level),
  ]);
  const proficient = new Set<string>([...background.skills, ...species.fixedSkills]);
  for (let round = 0; round < 20; round++) {
    const todo = activeChoices(requiredChoices({ speciesId, classId, backgroundId, level }), picks).filter((s) => !picks[s.id]);
    if (todo.length === 0) break;
    for (const spec of todo) {
      let options = spec.options;
      if (spec.id.endsWith(".expertise") || spec.id === "class.wizard.scholar") {
        options = options.filter((o) => proficient.has(o.id));
      } else if (spec.id === "class.wizard.prepared") {
        options = options.filter((o) => picks["class.wizard.spellbook"]!.includes(o.id));
      } else if (isInvocationCantripChoice(spec.id)) {
        options = options.filter((o) => picks["class.warlock.cantrips"]!.includes(o.id));
      } else if (/\.abilit(y|ies)$/.test(spec.id)) {
        options = options.some((o) => o.id === "con") ? options.filter((o) => o.id === "con") : options;
      } else {
        options = options.filter((o) => !used.has(o.id) && !(o.skill && used.has(o.skill)));
      }
      const chosen = spec.allowRepeat
        ? Array.from({ length: spec.count }, () => options[0]!.id)
        : options.slice(0, spec.count).map((o) => o.id);
      picks[spec.id] = chosen;
      for (const id of chosen) {
        const option = spec.options.find((o) => o.id === id)!;
        if (spec.id !== "class.wizard.spellbook" && !/\.abilit(y|ies)$/.test(spec.id)) used.add(id);
        for (const g of option.spells ?? []) used.add(g.spellId);
        if (option.skill) {
          used.add(option.skill);
          proficient.add(option.skill);
        }
      }
    }
  }
  return {
    speciesId, classId, backgroundId, level, baseScores, backgroundBonus, classEquipment: "A", backgroundEquipment: "A", picks,
  };
}
