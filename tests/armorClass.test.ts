import { describe, expect, it } from "vitest";
import { armorClass } from "../src/rules/armorClass";
import type { AcInput } from "../src/rules/armorClass";

const mods = { str: 0, dex: 2, con: 3, int: 0, wis: 1, cha: 2 };
const base: AcInput = { mods, armorId: null, shield: false, unarmoredDefense: null, defenseStyle: false };
const ac = (o: Partial<AcInput>) => armorClass({ ...base, ...o });

describe("armorClass", () => {
  it("unarmored is 10 + Dex", () => expect(ac({})).toBe(12));
  it("light armor adds full Dex", () => expect(ac({ armorId: "leather_armor" })).toBe(13));
  it("medium armor caps Dex at +2", () => {
    expect(ac({ armorId: "scale_mail", mods: { ...mods, dex: 3 } })).toBe(16);
  });
  it("heavy armor ignores Dex", () => expect(ac({ armorId: "chain_mail" })).toBe(16));
  it("shield adds 2", () => {
    expect(ac({ shield: true })).toBe(14);
    expect(ac({ armorId: "chain_mail", shield: true })).toBe(18);
  });
  it("barbarian unarmored defense uses Con", () => {
    expect(ac({ unarmoredDefense: "barbarian" })).toBe(15);
    expect(ac({ unarmoredDefense: "barbarian", shield: true })).toBe(17);
  });
  it("monk unarmored defense uses Wis but not with a shield", () => {
    expect(ac({ unarmoredDefense: "monk" })).toBe(13);
    expect(ac({ unarmoredDefense: "monk", shield: true })).toBe(14);
  });
  it("draconic unarmored defense uses Cha", () => {
    expect(ac({ unarmoredDefense: "draconic" })).toBe(14);
  });
  it("unarmored defense is ignored when wearing armor", () => {
    expect(ac({ unarmoredDefense: "barbarian", armorId: "leather_armor" })).toBe(13);
  });
  it("defense style adds 1 only with armor", () => {
    expect(ac({ defenseStyle: true })).toBe(12);
    expect(ac({ defenseStyle: true, armorId: "chain_mail" })).toBe(17);
  });
  it("ignores unknown or non-armor ids", () => {
    expect(ac({ armorId: "longsword" })).toBe(12);
  });
  it("barbarian with negative Con falls back to the base formula", () => {
    expect(ac({ unarmoredDefense: "barbarian", mods: { ...mods, con: -1 } })).toBe(12);
  });
  it("ignores shield as armorId", () => {
    expect(ac({ armorId: "shield" })).toBe(12);
  });
  it("defense style stacks with a shield", () => {
    expect(ac({ armorId: "chain_mail", shield: true, defenseStyle: true })).toBe(19);
  });
});
