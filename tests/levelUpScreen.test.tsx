import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LevelUpContent, levelUpChanges, shouldOpenLevelUp } from "../src/game/LevelUpScreen";
import type { LevelUp } from "../src/game/levelUp";

const up: LevelUp = {
  playerId: "p1",
  customSubclass: null,
  name: "Brenna",
  level: 3,
  subclass: "Campeón",
  proficiencyBonus: null,
  features: [{ name: "Crítico mejorado", summary: "Crítico con 19 o 20." }],
};

describe("LevelUpContent", () => {
  it("points to the manual for a subclass outside the SRD", () =>
    expect(renderToStaticMarkup(<LevelUpContent levelUp={{ ...up, subclass: null, customSubclass: "Maestro de las bestias" }} />)).toContain(
      "Tu subclase está fuera del SRD: revisá tu manual para este nivel.",
    ));

  it("shows the new maximum HP when it is known", () => {
    expect(renderToStaticMarkup(<LevelUpContent levelUp={up} maxHp={{ before: 28, after: 36 }} />)).toContain(
      "PG máx: 28 → 36",
    );
    expect(renderToStaticMarkup(<LevelUpContent levelUp={up} />)).not.toContain("PG máx");
  });

  it("shows the level, the name, the subclass and each feature", () => {
    const html = renderToStaticMarkup(<LevelUpContent levelUp={up} />);
    for (const text of ["¡Nivel 3!", "Brenna", "Campeón", "Crítico mejorado", "Crítico con 19 o 20."]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("competencia");
  });

  it("shows the proficiency bonus only when it went up", () => {
    expect(renderToStaticMarkup(<LevelUpContent levelUp={{ ...up, proficiencyBonus: 3 }} />)).toContain("+3");
  });

  it("with nothing known, only the level and the name", () => {
    const html = renderToStaticMarkup(<LevelUpContent levelUp={{ ...up, subclass: null, features: [] }} />);
    expect(html).toContain("¡Nivel 3!");
    expect(html).toContain("Brenna");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Subclase");
  });
});

describe("shouldOpenLevelUp", () => {
  const banner = [{ id: 1, kind: "quest" as const, outcome: "completed" as const, title: "Ruta" }];
  it("waits for the banners and the toasts of the turn to leave", () => {
    expect(shouldOpenLevelUp(1, banner, 0, false)).toBe(false);
    expect(shouldOpenLevelUp(1, null, 2, false)).toBe(false);
    expect(shouldOpenLevelUp(1, null, 0, false)).toBe(true);
  });
  it("nothing pending, nothing to open", () => {
    expect(shouldOpenLevelUp(0, null, 0, false)).toBe(false);
  });
  it("an open screen is not opened again", () => {
    expect(shouldOpenLevelUp(1, null, 0, true)).toBe(false);
  });
});

describe("levelUpChanges", () => {
  it("nothing to save without picks, subclass or a new note", () =>
    expect(levelUpChanges({ asks: false, asksSubclass: false, note: " Ermitaño ", savedNote: "Ermitaño" })).toBe(false));
  it("a new note is saved", () =>
    expect(levelUpChanges({ asks: false, asksSubclass: false, note: "Ermitaño, lobo", savedNote: "Ermitaño" })).toBe(true));
  it("picks or a subclass are saved", () => {
    expect(levelUpChanges({ asks: true, asksSubclass: false, note: "", savedNote: "" })).toBe(true);
    expect(levelUpChanges({ asks: false, asksSubclass: true, note: "", savedNote: "" })).toBe(true);
  });
});
