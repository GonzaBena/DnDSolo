# Capítulos al cambiar de ubicación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each turn that changes location records a chapter; the log shows it as a separator and live first visits drop a banner from the top.

**Architecture:** Same shape as the arrivals feature: a pure `chapterOf` in `domain/` computes a snapshot at `TurnEngine.commit`, saved on the turn. `TurnLog` renders it; `Game.tsx` keeps a small queue of top banners so a chapter banner and an ambush banner play one after the other, reusing the ambush banner's shell.

**Tech Stack:** Astro 7 + React 19, TypeScript, zod 4, animejs 4 (`src/animations/motion.ts`), vitest + `renderToStaticMarkup`.

**Spec:** `docs/superpowers/specs/2026-11-24-capitulos-design.md`

## Global Constraints

- UI text in Spanish, identifiers in English.
- No change to the DM prompt or the response schema.
- Location names compare ignoring case and surrounding spaces (`a.trim().toLowerCase() === b.trim().toLowerCase()`).
- Banner: drops from the top like the ambush one, leaves after 3000 ms or on tap; live turns only.
- Separator: first visit "— Nombre —" large with italic description; revisit small line with the name only.
- `GAME_STATE_VERSION` goes from 15 to 16 with a no-op migration.
- Banner and separator are `aria-hidden`; the turn announcement starts with "Capítulo: Nombre.".
- Respect `prefers-reduced-motion` via `motionAllowed()`.

## Review Focus

1. Official campaign: location is set at creation, so turn 1 doesn't change it; it must still open chapter 1 (Task 1 test).
2. DM resends the same location with different case/spaces: no chapter (Task 1 test).
3. A location change to an empty name: no chapter, no banner (Task 1 test).
4. Chapter + ambush in the same turn: chapter banner first, then ambush, never both mounted (Task 3 test on `nextBanner` queue).
5. Reload: separators stay, no banner replays (Task 3: banners only enqueued from `useSendTurn`).

---

### Task 1: Chapter snapshot on the turn

**Files:**
- Create: `src/domain/chapters.ts`
- Modify: `src/domain/types.ts` (`Chapter`, `Turn.chapter?`, `GAME_STATE_VERSION = 16`), `src/domain/schemas.ts` (turn `chapter` optional), `src/persistence/migrations.ts` (`fromV15`), `src/engine/TurnEngine.ts` (`commit`)
- Test: `tests/chapters.test.ts`, `tests/TurnEngine.test.ts`, `tests/schemas.test.ts`, `tests/characterIds.test.ts` (version expectation 15→16, as last time)

**Interfaces:**
- Produces: `interface Chapter { name: string; description: string; firstVisit: boolean }`; `Turn.chapter?: Chapter`; `chapterOf(prev: GameState, next: GameState): Chapter | null` — `prev` has the turns before this one.

- [ ] **Step 1: Write the failing tests** in `tests/chapters.test.ts` (use `newGame()` from `./helpers`, setting `location` and `turns` directly):

```ts
it("opens a chapter when the location name changes", () =>
  expect(chapterOf(at("Camino", [turn()]), at("La Cripta de Vel", [turn()], "Piedra húmeda."))).toEqual({
    name: "La Cripta de Vel", description: "Piedra húmeda.", firstVisit: true }));
it("no chapter when the name is the same ignoring case and spaces", () =>
  expect(chapterOf(at("Taberna", [turn()]), at(" taberna ", [turn()]))).toBeNull());
it("no chapter for an empty name", () => expect(chapterOf(at("Camino", [turn()]), at("  ", [turn()]))).toBeNull());
it("the first turn opens chapter 1 even if the location was set at creation", () =>
  expect(chapterOf(at("Pico Quebrado", []), at("Pico Quebrado", []))).toMatchObject({ name: "Pico Quebrado", firstVisit: true }));
it("the first turn with no location yet opens no chapter", () => expect(chapterOf(at("", []), at("", []))).toBeNull());
it("a place with an earlier chapter is a revisit", () => {
  const before = at("Calle", [turn({ name: "Taberna", description: "", firstVisit: true }), turn({ name: "Calle", description: "", firstVisit: true })]);
  expect(chapterOf(before, at("TABERNA", before.turns))).toMatchObject({ name: "TABERNA", firstVisit: false });
});
```

Plus in `tests/TurnEngine.test.ts`: "records the chapter when the location changes" (a `location` state change → last turn has `chapter`) and "leaves chapter out when the place stays" (next to the existing arrivals tests). In `tests/schemas.test.ts`: a saved turn with `chapter` parses; one with `chapter.firstVisit: "yes"` fails.

- [ ] **Step 2: Run** `npx vitest run tests/chapters.test.ts tests/TurnEngine.test.ts tests/schemas.test.ts` — Expected: FAIL (module/field missing).

- [ ] **Step 3: Implement.** `chapterOf`: trimmed next name empty → null; if `prev.turns.length > 0` and names equal → null; `firstVisit` = no turn in `prev.turns` has `chapter` with the same name. Name and description taken from `next.location` as-is. In `commit`, `const chapter = chapterOf(base, applied.state)` and spread `...(chapter ? { chapter } : {})` into the turn. Schema: `chapter: z.object({ name: z.string(), description: z.string(), firstVisit: z.boolean() }).optional()`. `fromV15` returns `{ ...raw, version: 16 }`, chained after `fromV14`, with a comment like `fromV14`'s.

- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.

- [ ] **Step 5: Commit** `feat: los turnos guardan el capítulo cuando cambia el lugar`

### Task 2: Separator in the log and the announcement

**Files:**
- Create: `src/game/ChapterSeparator.tsx`, `src/game/styles/chapters.css` (imported last in `game.css`)
- Modify: `src/game/TurnLog.tsx` (inside the turn, between `InputEntry` and `Narration`), `src/game/announcement.ts`, `src/animations/motion.ts` (`enterChapter`)
- Test: `tests/chapterSeparator.test.tsx`, `tests/announcement.test.ts`

**Interfaces:**
- Consumes: `Chapter`, `Turn.chapter`.
- Produces: `ChapterSeparator({ chapter, animated }: { chapter: Chapter; animated?: boolean })`; `chapterAnnouncement(chapter: Chapter): string` → `"Capítulo: <name>."`; `enterChapter(element: Element): void`.

- [ ] **Step 1: Write the failing tests:**
  - first visit renders `.chapter[data-visit="first"][aria-hidden="true"]` containing `— La Cripta de Vel —` and the description inside an element with class `chapter__description`;
  - revisit renders `data-visit="again"` with the name and no `chapter__description`;
  - first visit with empty description renders no `chapter__description`;
  - `turnAnnouncement` of a turn with chapter and arrivals: `"Capítulo: La Cripta de Vel. <narration> Aparece: …"`.
- [ ] **Step 2: Run** `npx vitest run tests/chapterSeparator.test.tsx tests/announcement.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Separator uses `useEnter(animated ? enterChapter : null)`; `enterChapter` is a short fade + slight scale, no-op without `motionAllowed()`. In `TurnLog`, `{turn.chapter && <ChapterSeparator chapter={turn.chapter} animated={index >= enterCount} />}`. Styles: `--font-display`, centered; first visit `--text-xl` with the description italic `--text-sm` muted; revisit `--text-sm`, flanked by rules.
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: separador de capítulo en el registro`

### Task 3: Chapter banner and banner queue

**Files:**
- Create: `src/game/TopBanner.tsx` (shell extracted from `AmbushBanner`: portal, enter/leave, timer, `--ambush-height`), `src/game/ChapterBanner.tsx`
- Modify: `src/game/AmbushBanner.tsx` (use `TopBanner`, keep `bannerSlots`, `AmbushStrip`), `src/game/Game.tsx`, `src/game/useSendTurn.ts`, `src/game/styles/chapters.css`, `src/lab/Lab.tsx` (git-excluded: add a "Capítulo" and "Capítulo + emboscada" button)
- Test: `tests/bannerQueue.test.ts`, `tests/chapterBanner.test.tsx`, `tests/ambushBanner.test.tsx` (keeps passing)

**Interfaces:**
- Consumes: `Chapter`, `isAmbush`, `dismissAmbush` pattern.
- Produces:
  - `type Banner = { kind: "chapter"; chapter: Chapter } | { kind: "ambush"; hostiles: Arrival[] }`
  - `turnBanners(turn: Turn, events: readonly string[]): Banner[]` in `src/game/bannerQueue.ts` — chapter first (only if `firstVisit`), then ambush if `isAmbush(events, turn.arrivals ?? [])`.
  - `TopBanner({ className, shownMs, onDone, children })`; `ChapterStrip({ chapter })` (`aria-hidden`, `— Nombre —` + italic description); `ChapterBanner({ chapter, onDone })` with `shownMs` 3000; `AmbushBanner` keeps its props and 2500 ms.
  - `Ui.setAmbush` is replaced by `Ui.showBanners(banners: Banner[])`.

- [ ] **Step 1: Write the failing tests** in `tests/bannerQueue.test.ts`:
  - turn with a first-visit chapter and hostile arrivals + `combat_start` → `[{kind:"chapter"}, {kind:"ambush"}]` in that order;
  - revisit chapter → no chapter banner;
  - no chapter, no ambush → `[]`.
  And in `tests/chapterBanner.test.tsx`: `ChapterStrip` renders `aria-hidden="true"`, `— La Cripta de Vel —`, and the description.
- [ ] **Step 2: Run** `npx vitest run tests/bannerQueue.test.ts tests/chapterBanner.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** `Game.tsx` holds `{ key: number; queue: Banner[] } | null`; renders only `queue[0]`, keyed by `key`; `onDone` drops the head and bumps `key` if the queue still has items, else clears it (guarded by key like `dismissAmbush`). `showBanners` appends to the queue. `useSendTurn` calls `showBanners(turnBanners(lastTurn, events))` when non-empty. Chapter banner style: same `.ambush` box but `border-bottom` color `--color-accent` (class `top-banner--chapter`); generalize the toast-offset selector to the shared class `top-banner`.
- [ ] **Step 4: Run** `npx vitest run` and `npx astro check` — Expected: all pass, 0 errors.
- [ ] **Step 5: Commit** `feat: franja de capítulo en la primera visita, antes de la emboscada`

### Task 4: Real game check

- [ ] Start a free adventure in the user's Chrome at `http://localhost:4321` (the user's dev server). Verify: turn 1 shows the chapter banner and the large separator; moving to a new place repeats it; going back shows only the small separator; reload keeps separators with no banner; phone width (375 px iframe) keeps the banner title on one line. No console errors.
- [ ] Mark item 2 as done in `docs/roadmap.md`; commit `docs: capítulos hechos en el roadmap`.
