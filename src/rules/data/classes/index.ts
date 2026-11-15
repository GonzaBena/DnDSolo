import type { ClassData } from "../../types";
import { BARBARIAN } from "./barbarian";
import { FIGHTER } from "./fighter";
import { MONK } from "./monk";
import { PALADIN } from "./paladin";
import { RANGER } from "./ranger";
import { ROGUE } from "./rogue";

// The remaining casters (bard, cleric, druid, sorcerer, warlock, wizard) are added in the next commit.
export const CLASSES_DATA: ClassData[] = [BARBARIAN, FIGHTER, MONK, PALADIN, RANGER, ROGUE];
