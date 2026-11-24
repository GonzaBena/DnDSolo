# Subida de nivel, botín y misiones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Level up gets a full-screen moment with what was gained, completed/failed quests get a parchment banner in the top-banner queue, and gained items fly as a small card to the "Info" button.

**Architecture:** Everything is derived in the client from `prev` vs `next` state after a live turn, like `buildTurnToasts`. Quests become two new `Banner` kinds in `bannerQueue.ts` (rendered with `TopBanner`). Level up is a pure `levelUpOf(prev, next)` plus a `<dialog>` screen that `Game.tsx` shows once the banner queue is empty. Loot stays a toast with a new kind whose exit animation flies to the Info button.

**Tech Stack:** Astro 7 + React 19, TypeScript, animejs 4 (`src/animations/motion.ts`), vitest + `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-11-24-nivel-botin-misiones-design.md`

## Global Constraints

- UI text in Spanish, identifiers in English.
- No change to the DM prompt, the response schema or `GAME_STATE_VERSION`.
- Only live turns raise these moments (from `useSendTurn`); reloading a game replays nothing.
- "Nueva misión" and "Objeto usado o perdido" stay as toasts, unchanged.
- Level screen never shows hit points (they are not recalculated on level up).
- Respect reduced motion: CSS under `@media (prefers-reduced-motion: reduce)`, JS via `motionAllowed()`.
- Quest banner look (chosen on mockups, option A in `.superpowers/brainstorm/*/content/pergamino.html`): same top strip as chapter/ambush, parchment background (`#f3dfb4` → `#e2c48a` vertical gradient; pick dark-mode equivalents), bottom edge `--color-accent` (completed) or `--color-hostile` (failed). Completed: red wax seal with ✓ stamps in on the right with a bounce. Failed: a 🔥 appears on the right, a burn sweeps right to left, the strip darkens; then it leaves as usual.

## Review Focus

1. A turn that both completes a quest and levels up (the usual case: the quest gives the milestone): quest banner first, level screen only after the queue empties (Task 3 test on `Game` gating helper).
2. Class with no data for the new level (levels above `LOADED_MAX_LEVEL` = 4, or an old save with no `classId` and an unknown class name): screen shows only "¡Nivel N!" and the name, no crash (Task 1 tests).
3. Quest title that differs only in case/spaces between turns is the same quest (Task 2 test).
4. Several items gained in one turn: each card leaves staggered, none lost (Task 4 test on `holdMs`).
5. Info button not on screen when a loot card leaves: the card fades out like a normal toast (Task 4: `flyToTarget` falls back to `leaveToast`).

---

### Task 1: What a level up gives

**Files:**
- Create: `src/game/levelUp.ts`
- Test: `tests/levelUp.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface LevelUp {
    name: string;                 // the player's name
    level: number;                // the new level
    features: { name: string; summary: string }[]; // class row features, then subclass features of that level
    proficiencyBonus: number | null; // the new bonus, only when it went up
    subclass: string | null;      // subclass name, only on the level that grants it
  }
  function levelUpOf(prev: GameState, next: GameState): LevelUp | null
  ```
  First player only; null unless `next` level > `prev` level. Class via `findClass(player.classId ?? player.characterClass)` from `src/rules`. Subclass features: `subclass.features` with `level === newLevel`, only when `newLevel >= subclass.level`.

- [ ] **Step 1: Write the failing tests** (use `newGame()` from `./helpers`; set `classId: "fighter"` and `level` on `players[0]`):

```ts
it("no level change, no level up", () => expect(levelUpOf(fighter(1), fighter(1))).toBeNull());
it("level 2 fighter: the row's features, no bonus change, no subclass", () =>
  expect(levelUpOf(fighter(1), fighter(2))).toMatchObject({
    level: 2, proficiencyBonus: null, subclass: null,
    features: [{ name: "Acción súbita" }, { name: "Mente táctica" }] }));
it("level 3 names the subclass and adds its level-3 features", () => {
  const up = levelUpOf(fighter(2), fighter(3))!;
  expect(up.subclass).toBe("Campeón");
  expect(up.features.length).toBeGreaterThan(1);
});
it("a level with no data: just the level and the name", () =>
  expect(levelUpOf(fighter(4), fighter(5))).toEqual({ name: expect.any(String), level: 5, features: [], proficiencyBonus: null, subclass: null }));
it("an unknown class still levels up", () =>
  expect(levelUpOf(withClass(null, "Inventor", 1), withClass(null, "Inventor", 2))).toMatchObject({ level: 2, features: [] }));
```

Check the fighter data in `src/rules/data/classes/fighter.ts` for the exact level-2 feature names and the subclass features before fixing the assertions.

- [ ] **Step 2: Run `npx vitest run tests/levelUp.test.ts`** — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `levelUpOf`** in `src/game/levelUp.ts`. `proficiencyBonus` = the new row's bonus when both rows exist and it is greater than the previous row's.
- [ ] **Step 4: Run the test** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: qué gana el personaje al subir de nivel`

---

### Task 2: Quest banners (sealed / burned)

**Files:**
- Modify: `src/game/bannerQueue.ts`, `src/game/turnToasts.ts`, `src/game/useSendTurn.ts`, `src/game/Game.tsx`, `src/game/game.css` (import)
- Create: `src/game/QuestBanner.tsx`, `src/game/styles/quests.css`
- Test: `tests/bannerQueue.test.ts`, `tests/turnToasts.test.ts`, `tests/questBanner.test.tsx`

**Interfaces:**
- Produces: `Banner` gains `{ kind: "quest"; outcome: "completed" | "failed"; title: string }`; `questBanners(prev: GameState, next: GameState): Banner[]` in `bannerQueue.ts` — one per quest whose status became `completed` or `failed` this turn (title matched with `trim().toLowerCase()`, like `turnToasts.ts`), in `next.quests` order. `QuestStrip({ outcome, title })` and `QuestBanner({ outcome, title, onDone })` in `QuestBanner.tsx`.

- [ ] **Step 1: Write the failing tests:**

```ts
// bannerQueue.test.ts
it("a quest completed or failed this turn raises its banner", () => {
  const prev = withQuests([quest("Ruta", "active"), quest("Faro", "active")]);
  const next = withQuests([quest(" ruta ", "completed"), quest("Faro", "failed")]);
  expect(questBanners(prev, next)).toEqual([
    { kind: "quest", outcome: "completed", title: " ruta " },
    { kind: "quest", outcome: "failed", title: "Faro" }]);
});
it("an already closed quest raises nothing again", () => {
  const s = withQuests([quest("Ruta", "completed")]);
  expect(questBanners(s, s)).toEqual([]);
});
it("a new active quest raises no banner", () =>
  expect(questBanners(withQuests([]), withQuests([quest("Nueva", "active")]))).toEqual([]));

// turnToasts.test.ts: replace the "announces completed and new quests" expectation
expect(buildTurnToasts(prev, next, [], 1)).toMatchObject([{ kind: "quest", title: "Nueva misión", detail: "Nueva" }]);

// questBanner.test.tsx
it("completed: announced, with the seal", () => {
  const html = renderToStaticMarkup(<QuestStrip outcome="completed" title="Ruta" />);
  expect(html).toContain('role="status"');
  expect(html).toContain("Misión cumplida");
  expect(html).toContain("Ruta");
  expect(html).toContain("quest-banner__seal");
});
it("failed: announced, with the flame", () => {
  const html = renderToStaticMarkup(<QuestStrip outcome="failed" title="Ruta" />);
  expect(html).toContain("Misión fallida");
  expect(html).toContain("quest-banner__flame");
});
```

- [ ] **Step 2: Run `npx vitest run tests/bannerQueue.test.ts tests/turnToasts.test.ts tests/questBanner.test.tsx`** — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `questBanners` in `bannerQueue.ts`.
  - Remove the "¡Misión completada!" toast from `buildTurnToasts` (keep "Nueva misión").
  - `QuestStrip`: kicker "Misión cumplida" / "Misión fallida" plus the title; `role="status"` on the strip (the banners are the only place this is said now; seal and flame are `aria-hidden`). `QuestBanner` wraps it in `TopBanner` with `className={\`quest-banner quest-banner--${outcome}\`}` and `shownMs` 3000 (completed) / 3200 (failed, so the burn finishes before leaving).
  - `quests.css`: the look from Global Constraints; seal stamp at ~550 ms, burn from ~700 ms over ~1.4 s; under reduced motion show the final state with no animation. Import it in `game.css` after `chapters.css`.
  - `useSendTurn.ts`: `showBanners([...turnBanners(lastTurn, events), ...questBanners(state, outcome.state)])`, so chapter and ambush come first.
  - `Game.tsx`: render `QuestBanner` for `head.kind === "quest"` (switch over the three kinds instead of the ternary).
- [ ] **Step 4: Run the tests and `npm run check`** — Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat: franja de misión cumplida (sello) o fallida (quemada)`

---

### Task 3: Level-up screen

**Files:**
- Create: `src/game/LevelUpScreen.tsx`, `src/game/styles/level-up.css`
- Modify: `src/game/turnToasts.ts`, `src/game/useSendTurn.ts`, `src/game/Game.tsx`, `src/game/game.css` (import)
- Test: `tests/levelUpScreen.test.tsx`, `tests/turnToasts.test.ts`

**Interfaces:**
- Consumes: `LevelUp`, `levelUpOf` (Task 1); `BannerQueue` (Task 2).
- Produces: `LevelUpContent({ levelUp }: { levelUp: LevelUp })` (testable markup), `LevelUpScreen({ levelUp, onClose })`; `useSendTurn` option `showLevelUp: (levelUp: LevelUp) => void`; `levelUpVisible(levelUp: LevelUp | null, banners: BannerQueue | null): boolean` exported from `LevelUpScreen.tsx`.

- [ ] **Step 1: Write the failing tests:**

```ts
// levelUpScreen.test.tsx
const up: LevelUp = { name: "Brenna", level: 3, subclass: "Campeón", proficiencyBonus: null,
  features: [{ name: "Crítico mejorado", summary: "Crítico con 19 o 20." }] };
it("shows the level, the name, the subclass and each feature", () => {
  const html = renderToStaticMarkup(<LevelUpContent levelUp={up} />);
  for (const text of ["¡Nivel 3!", "Brenna", "Campeón", "Crítico mejorado", "Crítico con 19 o 20."]) expect(html).toContain(text);
  expect(html).not.toContain("Competencia");
});
it("shows the proficiency bonus only when it went up", () =>
  expect(renderToStaticMarkup(<LevelUpContent levelUp={{ ...up, proficiencyBonus: 3 }} />)).toContain("+3"));
it("with nothing known, only the level and the name", () => {
  const html = renderToStaticMarkup(<LevelUpContent levelUp={{ ...up, subclass: null, features: [] }} />);
  expect(html).toContain("¡Nivel 3!");
  expect(html).not.toContain("<ul");
});
it("waits for the banners to finish", () => {
  expect(levelUpVisible(up, [{ id: 1, kind: "quest", outcome: "completed", title: "Ruta" }])).toBe(false);
  expect(levelUpVisible(up, null)).toBe(true);
  expect(levelUpVisible(null, null)).toBe(false);
});

// turnToasts.test.ts: the level test now expects no toast
expect(buildTurnToasts(base, withLevel(base, 2), [], 1)).toEqual([]);
```

- [ ] **Step 2: Run `npx vitest run tests/levelUpScreen.test.tsx tests/turnToasts.test.ts`** — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Remove the level toast from `buildTurnToasts`.
  - `LevelUpContent`: heading "¡Nivel N!", the name below, "Subclase: X" when set, "Bonificador de competencia: +N" when set, then a `<ul>` of features (name in bold, summary) only if there are any.
  - `LevelUpScreen`: a modal `<dialog>` opened with `showModal()` on mount, following `HpDialog.tsx`; one button "Seguir" (autofocus) closes it; Escape (`cancel`/`close` event) also calls `onClose`. Full-viewport in `level-up.css`, app tokens, a short entrance via a new `enterLevelUp(element)` in `motion.ts` guarded by `motionAllowed()`.
  - `useSendTurn.ts`: after the banners, `const up = levelUpOf(state, outcome.state); if (up) showLevelUp(up);`.
  - `Game.tsx`: `const [levelUp, setLevelUp] = useState<LevelUp | null>(null)`, pass `showLevelUp: setLevelUp`, render `<LevelUpScreen levelUp={levelUp!} onClose={() => setLevelUp(null)} />` when `levelUpVisible(levelUp, banners)`.
- [ ] **Step 4: Run the tests and `npm run check`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: pantalla de subida de nivel con lo que se ganó`

---

### Task 4: Loot card that flies to the inventory

**Files:**
- Modify: `src/game/EventToasts.tsx`, `src/game/turnToasts.ts`, `src/animations/motion.ts`, `src/game/CharacterPanel.tsx`, `src/game/styles/toasts.css`
- Test: `tests/turnToasts.test.ts`

**Interfaces:**
- Produces: `ToastItem.kind` gains `"loot"`; `ToastItem.holdMs?: number` (default stays 4800); `flyToTarget(element: Element, target: Element | null, onDone: () => void): () => void` in `motion.ts`; the Info button carries `data-inventory-target`.

- [ ] **Step 1: Write the failing tests** (update the existing item tests):

```ts
it("a gained item is a loot card; several leave one after another", () => {
  const next = withInventory(base, [{ name: "Antorcha", quantity: 2 }, { name: "Soga", quantity: 1 }]);
  expect(buildTurnToasts(base, next, [], 1)).toMatchObject([
    { kind: "loot", title: "Objeto obtenido", detail: "Antorcha ×2", holdMs: 1800 },
    { kind: "loot", title: "Objeto obtenido", detail: "Soga", holdMs: 2100 }]);
});
it("a lost item stays a plain toast with no hold time", () => {
  // existing "Objeto usado o perdido" expectations, kind "item", no holdMs
});
```

Also fix the kind/id expectations at `tests/turnToasts.test.ts:144-145` to the new kinds.

- [ ] **Step 2: Run `npx vitest run tests/turnToasts.test.ts`** — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `buildTurnToasts`: gained items get `kind: "loot"`, `holdMs: 1800 + 300 * i` (i = index among this turn's gained items).
  - `ToastCard`: timer uses `toast.holdMs ?? 4800`; for `"loot"` the timed exit calls `flyToTarget(el, document.querySelector("[data-inventory-target]"), done)`; the × still uses `leaveToast`. Icon 🎒; `data-kind="loot"` styled smaller in `toasts.css`.
  - `flyToTarget`: without `motionAllowed()` or without a target (or a target with an empty bounding box), delegate to `leaveToast`. Otherwise translate the card's center to the target's center while scaling to ~0.2 and fading, ~550 ms, then give the target a short pulse.
  - `CharacterPanel.tsx`: add `data-inventory-target` to the Info button (line ~149).
- [ ] **Step 4: Run `npm test` and `npm run check`** — Expected: all PASS.
- [ ] **Step 5: Commit** `feat: el botín vuela al inventario`

---

### Task 5: Lab stage, check in the browser and close the roadmap item

- [ ] **Step 0:** Add a "Nivel, botín y misiones" stage to `src/lab/Lab.tsx` (local only, excluded from git via `.git/info/exclude`; never commit it), next to `ChaptersLab`: buttons "Misión cumplida", "Misión fallida", "Capítulo + misión + nivel" (enqueues chapter + quest banners and a `LevelUp`, showing the screen only via `levelUpVisible`), "Nivel 2", "Nivel 5 (sin datos)", "Botín ×1", "Botín ×3". The stage renders its own button with `data-inventory-target` so the loot cards have somewhere to fly, and its own `EventToasts`.
- [ ] **Step 1 (cont.):** Run `npm run dev`; try every button on `/lab`, then, in the user's Chrome with a real campaign, play until an item is gained, a quest closes and a level is reached (or use the mock game if `tests/mockGame.test.ts` shows how to force those changes). Check: loot flies to Info; quest banner seals / burns after any chapter or ambush banner; level screen comes after the banners and closes with "Seguir"; with reduced motion on, nothing animates and everything still shows.
- [ ] **Step 2:** In `docs/roadmap.md`, mark "3. Subida de nivel y botín como momentos propios ✓ (hecho YYYY-MM-DD)" and change "pergamino que se sella o se quema" to match what shipped.
- [ ] **Step 3: Commit** `docs: nivel, botín y misiones hechos en el roadmap`
