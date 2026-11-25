# Nota "Fuera del SRD" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each character carries a free "Fuera del SRD" note and an optional non-SRD subclass name; the DM reads both every turn, and a non-SRD subclass stops the app from applying the SRD one.

**Architecture:** Plain data on `Character.outsideSrd`; a `srdSubclass?: false` flag on `Concept` (so stored `CharacterChoices` carry it) makes `requiredChoices`/`buildSheet` skip the SRD subclass. Pure functions in `src/domain/outsideSrd.ts` apply edits; UI in the level-up screen and Info saves through `TurnEngine.updatePlayer` (via `usePlayerUpdate`).

**Tech Stack:** TypeScript, React 19, Astro, Zod 4, Vitest (`pnpm test`), `pnpm check`.

**Spec:** `docs/superpowers/specs/2026-11-25-nota-fuera-srd-design.md`

## Global Constraints

- Identifiers in English; UI text in Spanish (rioplatense).
- Note limit: 1000 characters (trimmed and cut on save).
- `GAME_STATE_VERSION` 17 → 18.
- DM line, verbatim prefix: `Fuera del SRD (lo anotó el jugador; aplicalo con lo que sepas del Player's Handbook 2024): `
- Subclass line for the DM: `Subclase: <nombre> (fuera del SRD)`.
- Level-up copy: subclass question label "Subclase"; options "<SRD name> (SRD)" and "Otra de tu manual"; with a non-SRD subclass: "Tu subclase está fuera del SRD: revisá tu manual para este nivel."; note field label "Fuera del SRD (opcional)".
- No new duty in the DM prompt or turn schema; the DM's `subclass` change is accepted only when the player has no subclass of either kind.
- Commits in Spanish with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Switching in Info from the SRD subclass to a custom one (and back) on a character with stored choices: the sheet rebuilds without (with) the SRD subclass HP/features. Test in Task 3.
2. A custom subclass name that is only spaces: treated as no subclass. Test in Task 3.
3. A note over 1000 characters pasted in: cut, not rejected. Test in Task 3.
4. Old saves (v17) with `choices` and level ≥ 3: migration adds empty `outsideSrd` and nothing else changes. Test in Task 1.
5. The generator note without the fixed phrase prefix (model forgot it): kept as is. Test in Task 3.

---

### Task 1: Data — `outsideSrd`, migration, `srdSubclass` flag

**Files:** `src/domain/types.ts`, `src/domain/schemas.ts`, `src/persistence/migrations.ts`, `src/domain/character.ts`, `src/rules/choices.ts` (`Concept`), `src/lab/Lab.tsx`, fixtures in `tests/rulesBlock.test.ts`; Test: `tests/characterIds.test.ts`

**Interfaces — Produces:**
- `interface OutsideSrd { note: string; subclass: string | null }`; `Character.outsideSrd: OutsideSrd`.
- `Concept.srdSubclass?: false` (absent = the SRD subclass applies); `characterChoicesSchema` gains `srdSubclass: z.literal(false).optional()`.
- `CharacterInput.outsideSrdNote?: string`; `createCharacter` stores `{ note: (outsideSrdNote ?? "").trim().slice(0, 1000), subclass: null }`.

- [ ] **Step 1: Failing tests:** v17 save → version 18, every player `outsideSrd` equals `{ note: "", subclass: null }`, `choices` untouched; `createCharacter({...base, outsideSrdNote: "  Trasfondo Ermitaño  "})` → note `"Trasfondo Ermitaño"`; 1200-char note → length 1000.
- [ ] **Step 2: Run** `pnpm vitest run tests/characterIds.test.ts` → FAIL.
- [ ] **Step 3: Implement** (`fromV17` like `fromV16`; old-version test literals use `GAME_STATE_VERSION`).
- [ ] **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: nota Fuera del SRD en el personaje`

### Task 2: Rules — `srdSubclass: false` skips the SRD subclass

**Files:** `src/rules/choices.ts` (`requiredChoices`), `src/rules/sheet.ts` (`hasSubclass`); Test: `tests/buildSheet.test.ts`

- [ ] **Step 1: Failing tests:** `greedyChoices("human","fighter","soldier",3)` built with `srdSubclass: false` → `sheet.subclass === null`, no feature named "Crítico mejorado"; draconic sorcerer level 3 (`greedyChoices("human","sorcerer","sage",3)`) with `srdSubclass: false` → `hitPoints` 3 lower than without the flag (Draconic Resilience); a class whose subclass adds choices (find one with `cls.subclass.features.some(f => f.choices)`) → those spec ids absent from `requiredChoices({...concept, srdSubclass: false})`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `hasSubclass: c.srdSubclass !== false && c.level >= cls.subclass.level` and the same guard on the subclass-features line of `requiredChoices`. **Step 4: Run** `pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat: la ficha puede no aplicar la subclase del SRD`

### Task 3: Domain — subclass choice, Info edit, generator note, DM change

**Files:** Create `src/domain/outsideSrd.ts`; modify `src/domain/sheetProgress.ts` (export `rebuildSheet`), `src/domain/applyChanges.ts`, `src/game/levelUp.ts`; Test: `tests/outsideSrd.test.ts`, `tests/applyChanges.test.ts`, `tests/levelUp.test.ts`

**Interfaces — Produces:**
- `type SubclassPick = { kind: "srd" } | { kind: "custom"; name: string }`.
- `needsSubclassChoice(player: Character): boolean` — class known, `level >= cls.subclass.level`, `subclassId === null`, `outsideSrd.subclass === null`.
- `applySubclassPick(player: Character, pick: SubclassPick): Character` — srd: `subclassId = cls.subclass.id`, choices without `srdSubclass`; custom (name trimmed, empty → same as clearing): `subclassId = null`, `outsideSrd.subclass = name`, choices `srdSubclass: false`. Rebuilds stats with `rebuildSheet` when `choices` exist and `level <= choices.level` (a pending level up rebuilds later in `applyLevelUp`).
- `setOutsideSrd(player: Character, edit: { note: string; subclass: SubclassPick | null }): Character` — note trimmed/cut to 1000; `subclass` null leaves the subclass as it is.
- `stripOutsideSrdPhrase(note: string | null): string` — removes the leading `OUTSIDE_SRD_PHRASE` and following spaces; null → "".
- `rebuildSheet(player: Character, choices: CharacterChoices): Character` in `sheetProgress.ts` — `buildSheet`; on failure returns `player` unchanged; HP moves by the change of the maximum (0 stays 0), as `applyLevelUp` does (refactor `applyLevelUp` to use it).
- `LevelUp` gains `customSubclass: string | null`; `levelUpFromPlayer` omits SRD subclass features and name when `outsideSrd.subclass !== null`.
- `applyChanges` `subclass` case: reject with reason `"The player chose a subclass outside the SRD."` when `outsideSrd.subclass !== null`.

- [ ] **Step 1: Failing tests** (Review Focus 1–3, 5 live here): `needsSubclassChoice` for fighter level 3 without subclass (true), with `subclassId` (false), with custom (false), level 2 (false); `applySubclassPick` custom on a fighter with level-3 choices drops "Crítico mejorado"-derived nothing visible but sets `choices.srdSubclass === false` and keeps HP equal for fighter (no subclass HP) / lowers max by 3 for a draconic sorcerer; srd pick back restores it; custom `"   "` → `outsideSrd.subclass === null`; `setOutsideSrd` cuts 1200 chars to 1000; `stripOutsideSrdPhrase(OUTSIDE_SRD_PHRASE + " Pediste Ermitaño; te di Sabio.")` → `"Pediste Ermitaño; te di Sabio."`, without the phrase → unchanged, null → `""`; DM `subclass` change rejected with custom subclass; `levelUpFromPlayer` for fighter level 3 with custom "Maestro de armas" → `subclass: null`, `customSubclass: "Maestro de armas"`, no subclass features.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: subclase fuera del SRD y edición de la nota`

### Task 4: DM rules block

**Files:** `src/engine/rulesBlock.ts`; Test: `tests/rulesBlock.test.ts`

- [ ] **Step 1: Failing tests:** a hero with note "Trasfondo Ermitaño." → block contains the Global Constraints prefix + "Trasfondo Ermitaño."; empty note → no "Fuera del SRD"; level 3 fighter with custom "Maestro de armas" → contains "Subclase: Maestro de armas (fuera del SRD)", not "Campeón", not "subclase no elegida", no `Si elige la subclase SRD`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (custom subclass counts as chosen-not-SRD: skip SRD preview and subclass features). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: el DM lee la nota Fuera del SRD`

### Task 5: Creation — generator note and form field

**Files:** `src/character/formValues.ts`, `src/character/handoff.ts`, `src/character/CharacterForm.tsx`; Test: `tests/formValues.test.ts`, `tests/handoff.test.ts`

- [ ] **Step 1: Failing tests:** `formValuesFromOption` with `outsideSrdNote: OUTSIDE_SRD_PHRASE + " Pediste Ermitaño; te di Sabio."` → `outsideSrdNote: "Pediste Ermitaño; te di Sabio."`; null → `""`; handoff round-trips `outsideSrdNote`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; the form adds a textarea "Fuera del SRD (opcional)" after the background field, `maxLength={1000}`, bound to `values.outsideSrdNote`, hint "Lo que tu personaje tiene y no está en el SRD: trasfondo, linaje… El DM lo tiene en cuenta." **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: la nota del generador llega al personaje`

### Task 6: Level-up screen — subclass question and note

**Files:** `src/game/LevelUpScreen.tsx`, `src/game/Game.tsx`, `src/domain/sheetProgress.ts`, styles in `src/game/styles/level-up.css`; Test: `tests/levelUpScreen.test.tsx`, `tests/sheetProgress.test.ts`

**Interfaces:**
- `confirmLevelUp(player: Character, picks: Picks, subclass: SubclassPick | null, note: string): Character` in `sheetProgress.ts` — `applySubclassPick` (if given), then `applyLevelUp` (if `pendingLevelUp`; on failure keep the player), then note via `setOutsideSrd`.
- `LevelUpScreen.onConfirm(picks, subclass, note)`.
- `LevelUpContent` shows "Tu subclase está fuera del SRD: revisá tu manual para este nivel." when `customSubclass` is set.
- [ ] **Step 1: Failing tests:** `confirmLevelUp` fighter 2→3 with choices and `{ kind: "custom", name: "Maestro de armas" }` → level 3 sheet without Champion, `choices.level === 3`, note saved; with `{ kind: "srd" }` → `subclassId: "champion"`; `LevelUpContent` with `customSubclass` contains the copy.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** When `needsSubclassChoice(player)`: a fieldset "Subclase" with radios "<SRD name> (SRD)" (its level features listed under it) and "Otra de tu manual" + text input; hide SRD subclass features from the content while asking; "Seguir" also waits for a pick (custom needs a non-empty name). Below everything, textarea "Fuera del SRD (opcional)" prefilled with the note. The screen asks (and blocks Esc) when `pendingLevelUp || needsSubclassChoice`. `Game.tsx` calls `updatePlayer(..., p => confirmLevelUp(p, picks, subclass, note))`.
- [ ] **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: la subida de nivel pregunta la subclase y deja editar la nota`

### Task 7: Info — "Fuera del SRD" section

**Files:** Create `src/game/OutsideSrdSection.tsx`; modify `src/game/InfoDrawer.tsx` (new prop `onSaveOutsideSrd?: (edit) => Promise<void>`), `src/game/Game.tsx`; Test: `tests/infoDrawer.test.tsx`

- [ ] **Step 1: Failing tests (static markup):** the drawer shows "Fuera del SRD", the player's note, and — for a level 3 fighter — the subclass radios with "Campeón (SRD)" and "Otra de tu manual"; for a level 1 character no subclass radios.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: local draft state, "Guardar" disabled while unchanged or saving, calls `setOutsideSrd` through `updatePlayer`; status "Guardado." after. **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: editar Fuera del SRD desde Info`

### Task 8: Browser check and roadmap

- [ ] **Step 1:** In the user's Chrome, Atlas (ranger level 2 with choices): Info → write a note, save, reload → kept. Set level 3 in IndexedDB, reload → level-up asks "Subclase"; pick "Otra de tu manual: Maestro de las bestias" → no Hunter features, sheet rebuilt; Info shows the custom subclass.
- [ ] **Step 2:** Roadmap: add "Nota Fuera del SRD ✓ (2026-11-25)" under Ideas sueltas.
- [ ] **Step 3: Commit** `docs: roadmap con la nota Fuera del SRD`
