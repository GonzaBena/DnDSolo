# Progresión de nivel (etapa 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game keeps each character's `CharacterChoices`; a level up asks for that level's picks and rebuilds the sheet with `buildSheet`; old saves can be upgraded from a notice.

**Architecture:** Pure functions in `src/domain/sheetProgress.ts` decide what is pending and produce the updated `Character`; `TurnEngine.updatePlayer` applies and saves like `adjustHp`; the UI (`ChoicePicker`, `LevelUpScreen`, `SheetUpgrade`) only calls them. Old-save upgrades reuse the generator's step 2 through a new `generateChoicesFor`.

**Tech Stack:** TypeScript, React 19, Astro, Zod 4, Vitest (`pnpm test`), `pnpm check`.

**Spec:** `docs/superpowers/specs/2026-11-25-progresion-nivel-design.md`

## Global Constraints

- Identifiers and comments in English; every UI string in Spanish (rioplatense "vos").
- Do not touch the DM prompt or the turn schema (`dmPrompt.ts`, `DMResponse`).
- Data stays levels 1–4 (`LOADED_MAX_LEVEL = 4`); level 5+ keeps today's behavior.
- `GAME_STATE_VERSION` goes 16 → 17.
- Notice copy, verbatim: "Esta partida usa una ficha antigua. Actualizala para que suba de nivel con sus PG y elecciones." Buttons: "Cancelar", "Actualizar". Upgrade screen buttons: "Usar esta", "Otra propuesta", "Cancelar".
- Only `players[0]` gets the notice, the upgrade and the level-up picker.
- Commit messages in Spanish, conventional prefix, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Ability Score Improvement (`feat.asi.abilities`, `allowRepeat`, count 2): the player must be able to put +2 in one ability (same option twice). Test in Task 4.
2. Growing specs with the same id (`class.<id>.cantrips`, `.prepared`, `class.wizard.spellbook`): earlier picks stay locked, only the missing ones are asked. Test in Task 2.
3. Reload in the middle of a level-up: `level > choices.level` must reopen the picker, not lose the level. Test in Task 2 (`pendingLevelUp`) and Task 5 wiring.
4. Leveling while dying (currentHp 0): HP must stay 0, the max still rises. Test in Task 2.
5. A generated character whose species was changed on the form after generation: `createCharacter` must not store choices that disagree with the character. Test in Task 1.

---

### Task 1: Store choices on the character (type, schema, migration)

**Files:**
- Modify: `src/domain/types.ts` (Character, `GAME_STATE_VERSION = 17`)
- Modify: `src/domain/schemas.ts` (export `characterChoicesSchema`; add `choices` to the player object in `gameStateSchema`)
- Modify: `src/character/handoff.ts` (import `characterChoicesSchema` instead of its local `choicesSchema`)
- Modify: `src/persistence/migrations.ts` (`fromV16`)
- Modify: `src/domain/character.ts` (`createCharacter`)
- Test: `tests/characterIds.test.ts` (already tests `migrateSave`)

**Interfaces:**
- Produces: `Character.choices: CharacterChoices | null`; `characterChoicesSchema` (Zod, shape of `CharacterChoices`).

- [ ] **Step 1: Failing tests**
  - `migrateSave` of a v16 save returns version 17 and every player has `choices: null`.
  - `createCharacter({...input, choices: fighterChoices()})` for a human fighter soldier level 1 → `choices` equals the input choices.
  - Same but input `speciesId: "elf"` while `choices.speciesId === "human"` → `choices === null`.
  - Same but `srdBackgroundId: null` or `choices.level !== level` → `choices === null`.
  - Without `input.choices` → `choices === null`.
- [ ] **Step 2: Run** `pnpm vitest run tests/characterIds.test.ts` → FAIL.
- [ ] **Step 3: Implement.** `createCharacter` keeps `input.choices` only when species, class, background (`srdBackgroundId`) and level all match and `buildSheet(choices).ok`; otherwise `null`. `fromV16` maps players adding `choices: null`. Move the Zod shape from `handoff.ts` to `schemas.ts` unchanged.
- [ ] **Step 4: Run** `pnpm test` and `pnpm check` → PASS (fix any helper/fixture that builds a `Character` literal by adding `choices: null`).
- [ ] **Step 5: Commit** `feat: la partida guarda las elecciones del personaje`

### Task 2: Domain rules for level-up and upgrade

**Files:**
- Create: `src/domain/sheetProgress.ts`
- Test: `tests/sheetProgress.test.ts`

**Interfaces:**
- Consumes: `Character.choices` (Task 1); `requiredChoices`, `activeChoices` (`src/rules/choices.ts`); `buildSheet`, `validateChoices` (`src/rules/buildSheet.ts`); `statsFromSheet` (`src/domain/stats.ts`).
- Produces:
  - `pendingLevelUp(player: Character): boolean` — true when `choices !== null`, `player.level > choices.level` and `player.level <= LOADED_MAX_LEVEL`.
  - `pendingSpecs(player: Character, picks: Record<string, string[]>): ChoiceSpec[]` — active specs at `player.level` (given `picks`) whose picks are missing or fewer than `count` (use the effective count `activeChoices` returns).
  - `lockedPicks(player: Character): Record<string, string[]>` — `player.choices.picks` (what the picker shows fixed).
  - `previewLevelUp(player: Character, picks: Record<string, string[]>): BuildResult` — `buildSheet({...player.choices, level: player.level, picks})`.
  - `applyLevelUp(player: Character, picks: Record<string, string[]>): { ok: true; player: Character } | { ok: false; errors: ChoiceError[] }`.
  - `canUpgradeSheet(player: Character): boolean` — `choices === null`, `speciesId`, `classId`, `srdBackgroundId` not null, all known to the rules data, and `level <= LOADED_MAX_LEVEL`.
  - `upgradeSheet(player: Character, choices: CharacterChoices, sheet: CharacterSheet): Character`.

- [ ] **Step 1: Failing tests** (use `greedyChoices` from `tests/helpers.ts`):
  - Fighter with level-3 choices and `level: 4` → `pendingLevelUp` true; `pendingSpecs(player, choices.picks)` ids contain `class.fighter.level4_feat` and `class.fighter.weapon_mastery_level4`.
  - After picking `asi` in `level4_feat`, `pendingSpecs` also contains `feat.asi.abilities`.
  - Wizard level 1 choices, `level: 2` → pending contains `class.wizard.spellbook` (count 8, 6 already picked) and `class.wizard.prepared`.
  - `level === choices.level` → false; `level: 5` → false; `choices: null` → false.
  - `applyLevelUp` fighter 1→2 with no new picks: `ok`, `stats.maxHp` = old max + `max(1, 10/2 + 1 + conMod)`, `choices.level === 2`, `currentHp` rose by the same amount, inventory unchanged.
  - `applyLevelUp` with `currentHp: 0, condition: "dying"` → `currentHp` stays 0, max rises.
  - `applyLevelUp` with missing picks → `ok: false` with errors; player unchanged.
  - `canUpgradeSheet`: true for `newGame()` player with `srdBackgroundId: "criminal"`; false with `srdBackgroundId: null`, with `choices` set, or with `level: 5`.
  - `upgradeSheet`: player at 10/20 HP and new sheet max 30 → `currentHp` 15; at 0 → 0; at 1/40 with new max 10 → 1 (never 0 while > 0); `inventory`, `name`, `level` untouched; `stats` from the sheet; `choices` stored.
- [ ] **Step 2: Run** `pnpm vitest run tests/sheetProgress.test.ts` → FAIL.
- [ ] **Step 3: Implement** in `src/domain/sheetProgress.ts`. HP on level-up: `currentHp > 0 ? min(newMax, currentHp + (newMax - oldMax)) : currentHp`. HP on upgrade: `currentHp === 0 ? 0 : max(1, round(currentHp / oldMax * newMax))`; when `stats` was null use the new max.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: reglas de subida de nivel con elecciones`

### Task 3: Engine method to replace a player and save

**Files:**
- Modify: `src/engine/TurnEngine.ts`
- Test: `tests/TurnEngine.test.ts`

**Interfaces:**
- Produces: `TurnEngine.updatePlayer(given: GameState, playerId: string, update: (p: Character) => Character): Promise<{ state: GameState; saveError: unknown | null }>` — same base selection, `latestByGame` update, `updatedAt` and `enqueueSave` as `adjustHp`.

- [ ] **Step 1: Failing test:** updating `level` of `PLAYER_ID` returns the new state, saves it (fake repo has it), and an unknown id returns the state unchanged without saving.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: el motor reemplaza la ficha de un jugador`

### Task 4: Choice picker component

**Files:**
- Create: `src/game/ChoicePicker.tsx`, `src/game/styles/choice-picker.css` (import from `game.css` like the others)
- Test: `tests/choicePicker.test.tsx` (static markup + pure helper)

**Interfaces:**
- Produces:
  - `togglePick(spec: ChoiceSpec, current: string[], locked: string[], optionId: string, delta: 1 | -1): string[]` — exported pure helper. Never removes a locked id; never exceeds `spec.count`; with `allowRepeat` an option may appear more than once (delta +1 adds another copy, -1 removes one); without it, +1 on a taken option is a no-op.
  - `<ChoicePicker specs={ChoiceSpec[]} picks={Record<string,string[]>} locked={Record<string,string[]>} errors={ChoiceError[]} onChange={(picks) => void} />` — one fieldset per spec: label, "Elegí N" (N = count − locked), each option with name and summary. `count - locked === 1` and no repeat → radio; otherwise checkboxes; `allowRepeat` → − / + buttons with the count. Locked options render checked and disabled. Errors whose `field === "picks." + spec.id` show under that fieldset.
- [ ] **Step 1: Failing tests:** `togglePick` for ASI (`allowRepeat`, count 2): `[]` +str → `["str"]`, +str → `["str","str"]`, +dex → unchanged; locked `["a","b"]` in a count-3 spec: −a unchanged, +c → `["a","b","c"]`, +d → unchanged. Static markup shows "Elegí 1", option summaries, and a locked option `disabled`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (mobile 320 px: single column, options as full-width rows). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: selector de elecciones`

### Task 5: Level-up screen asks for picks and rebuilds the sheet

**Files:**
- Modify: `src/game/LevelUpScreen.tsx`, `src/game/levelUp.ts`, `src/game/Game.tsx`, `src/game/styles/` (level-up stylesheet)
- Test: `tests/levelUpScreen.test.tsx`, `tests/levelUp.test.ts`

**Interfaces:**
- Consumes: Task 2 functions, Task 3 `updatePlayer`, Task 4 `ChoicePicker`.
- Produces:
  - `LevelUp` gains `playerId: string`.
  - `levelUpFromPlayer(player: Character): LevelUp` (exported from `levelUp.ts`; `levelUpOf` uses it).
  - `LevelUpScreen` props: `{ levelUp; player: Character; onConfirm: (picks) => Promise<void>; onClose }`.
  - `HpChange` line in `LevelUpContent`: optional prop `maxHp?: { before: number; after: number }` → "PG máx: 28 → 36".
- [ ] **Step 1: Failing tests:**
  - `LevelUpContent` with `maxHp {28, 36}` contains "PG máx: 28 → 36"; without it, no "PG máx".
  - `levelUpFromPlayer` for a level-4 fighter equals `levelUpOf(fighter(3), fighter(4))` plus `playerId`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - The screen keeps `picks` state starting at `lockedPicks(player)`; renders `ChoicePicker` with `pendingSpecs(player, picks)` when `pendingLevelUp(player)`; shows `maxHp` from `previewLevelUp` when it is ok; "Seguir" is disabled while `previewLevelUp` fails and pending specs exist; with no pending level-up it behaves as today.
  - On "Seguir" with a pending level-up: `onConfirm(picks)` → in `Game.tsx`, `engine.updatePlayer(state, playerId, p => applyLevelUp(p, picks).player)` and update the screen state the same way `useHpAdjust` does; close after it resolves; show `SAVE_WARNING` on `saveError`.
  - On game load (same effect that checks the recap): if `pendingLevelUp(state.players[0])`, queue `levelUpFromPlayer(player)` — once per game id.
  - Update the comment at the top of `levelUp.ts` (HP now recalculates).
- [ ] **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: la subida de nivel pide elecciones y recalcula la ficha`

### Task 6: Generator step 2 for a fixed character

**Files:**
- Modify: `src/rules/generateOptions.ts`
- Test: `tests/generateOptions.test.ts`

**Interfaces:**
- Produces: `generateChoicesFor(llm: LLMClient, character: { name: string; story: string; speciesId: string; classId: string; backgroundId: string; level: number }, signal?: AbortSignal): Promise<{ ok: true; choices: CharacterChoices; sheet: CharacterSheet } | { ok: false; failure: string }>` — wraps the private `generateChoices` with `pitch: ""`, `outsideSrdNote: null`; throws on abort/auth like `generateOptions`; throws if level is outside 1..`LOADED_MAX_LEVEL`.
- [ ] **Step 1: Failing tests** with `FakeLLMClient`: a greedy reply for elf rogue criminal level 3 → `ok` with `choices.level === 3` and a sheet; an invalid reply twice → `ok: false` with a Spanish failure; level 5 → throws.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (story = `character.background ?? ""`, the caller passes it). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: el generador propone elecciones para un personaje dado`

### Task 7: Old-save notice and upgrade screen

**Files:**
- Create: `src/game/SheetUpgrade.tsx` (notice + upgrade dialog), styles next to the other game styles
- Modify: `src/game/Game.tsx`
- Test: `tests/sheetUpgrade.test.tsx`

**Interfaces:**
- Consumes: `canUpgradeSheet`, `upgradeSheet` (Task 2), `updatePlayer` (Task 3), `generateChoicesFor` (Task 6), `SheetView` (`src/character/SheetView.tsx`), `loadSettings`/`GeminiClient` as `useGameSession` builds it.
- Produces: `<UpgradeNotice onUpgrade onCancel />`, `<SheetUpgradeDialog player llm onUse={(choices, sheet) => void} onCancel />`.
- [ ] **Step 1: Failing tests (static markup):** the notice contains the exact copy and both buttons; the dialog in its "proposal" state renders `SheetView` content plus "Usar esta", "Otra propuesta", "Cancelar"; its failure state shows the failure text and "Otra propuesta".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - `Game.tsx`: after load, when `canUpgradeSheet(players[0])` and the notice was not dismissed in this mount, show `UpgradeNotice` (not over the recap or level-up screens; turns may continue behind it). "Cancelar" hides it until the game is opened again (component state only).
  - "Actualizar" opens the dialog, which calls `generateChoicesFor` on mount and on "Otra propuesta" (abortable; loading state "Armando la ficha…"; LLM errors via `describeLLMError`).
  - "Usar esta" → `engine.updatePlayer(state, id, p => upgradeSheet(p, choices, sheet))`, close the dialog and the notice.
- [ ] **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Commit** `feat: aviso para actualizar fichas de partidas viejas`

### Task 8: Verify in the user's browser and update the roadmap

- [ ] **Step 1:** `pnpm dev`; in the user's Chrome open an existing old game: the notice shows; "Cancelar" hides it; reopening shows it again; "Actualizar" → proposal → "Usar esta" → sheet panel shows the new numbers and the notice is gone.
- [ ] **Step 2:** In a game with choices (new character or upgraded), trigger a level up (Lab page or a DM level change): picker shows, ASI +2 works, "PG máx" line shows, "Seguir" saves; reload mid-pick reopens the screen. Check at 320 px width.
- [ ] **Step 3:** In `docs/roadmap.md`, mark the HP idea done (etapa 1, 2026-11-25) and leave the level 5+ idea as "etapa 2".
- [ ] **Step 4: Commit** `docs: roadmap con la progresión de nivel`
