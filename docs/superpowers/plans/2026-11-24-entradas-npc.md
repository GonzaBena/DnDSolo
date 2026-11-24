# Entradas de personajes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic "Nuevo personaje" toast with arrival cards in the narration log (saved per turn) and a top "¡Emboscada!" banner when hostiles appear and combat starts in the same turn.

**Architecture:** A pure domain module (`src/domain/arrivals.ts`) diffs the state before and after a turn into `Arrival` snapshots, groups them for display and decides ambushes. `TurnEngine.commit` stores the snapshots on the `Turn`; `TurnLog` draws them; `useSendTurn` raises the banner; toasts and the screen-reader announcement adapt.

**Tech Stack:** Astro + React 19, TypeScript, zod 4, animejs 4 (via `src/animations/motion.ts`), vitest (tests in `tests/`, React markup via `react-dom/server` `renderToStaticMarkup`).

**Spec:** `docs/superpowers/specs/2026-11-24-entradas-npc-design.md`

## Global Constraints

- Identifiers and comments in English; all UI text in Spanish.
- No changes to the DM prompt or to `dmResponseSchema`.
- No numeric hit points shown anywhere; health only as `HealthLabel`, and only when it is not "Ileso".
- `Turn.arrivals` is optional: saves without it load unchanged, no migration, no version bump.
- Every animation goes through `src/animations/motion.ts`, which already honours `prefers-reduced-motion` via `motionAllowed()`.
- Work on branch `feat/entradas-npc`, not on `main`.

## Review Focus

- NPC renamed between turns (DM sends "Goblin" then "goblin"): names compare with the existing case/space-insensitive rule, so no duplicate arrival — test in Task 1.
- Location change: every NPC is set `present: false` and companions marked present again in the same turn must not count as arrivals (they were present before the turn) — test in Task 1.
- Ten identical hostiles plus several other kinds: log shows one card per group, banner never exceeds 4 slots — tests in Tasks 1 and 5.
- An "Ileso" arrival or one without tracked hp shows no health tag; a returning "Malherido" one shows it — test in Task 4.
- HP correction (`useHpAdjust`) calls `buildTurnToasts` with no new turn: it must produce no arrival-related toast changes — test in Task 3.

---

### Task 1: Arrivals domain module

**Files:**
- Create: `src/domain/arrivals.ts`
- Modify: `src/domain/types.ts` (add `Arrival` interface, near `Turn`)
- Test: `tests/arrivals.test.ts`

**Interfaces:**
- Produces (in `types.ts`):
  ```ts
  export interface Arrival {
    name: string;
    attitude: Attitude;
    portrait: string | null;   // same loose type as Npc.portrait
    blurb: string;             // first sentence of description, "" if none
    returning: boolean;
    health: HealthLabel | null; // null when untracked or "Ileso"
  }
  ```
- Produces (in `arrivals.ts`):
  - `arrivalsOf(prev: GameState, next: GameState): Arrival[]`
  - `firstSentence(text: string): string`
  - `interface ArrivalGroup { name: string; count: number; lead: Arrival }` — `name` is the base name when `count > 1`, the full name otherwise.
  - `groupArrivals(arrivals: readonly Arrival[]): ArrivalGroup[]`
  - `isAmbush(events: readonly string[], arrivals: readonly Arrival[]): boolean`
  - `arrivalsAnnouncement(arrivals: readonly Arrival[]): string`

- [ ] **Step 1: Create the branch and commit the docs**

```bash
git switch -c feat/entradas-npc
git add docs/roadmap.md docs/superpowers/specs/2026-11-24-entradas-npc-design.md docs/superpowers/plans/2026-11-24-entradas-npc.md
git commit -m "docs: roadmap de puesta en escena y diseño de entradas de NPC"
```

- [ ] **Step 2: Write the failing tests** in `tests/arrivals.test.ts` (use `newGame()` from `./helpers`, a local `npc(name, overrides)` factory returning a full `Npc`):

```ts
describe("arrivalsOf", () => {
  it("snapshots a new present NPC", () => {
    // prev: no npcs; next: Goblin 1, hostile, portrait "goblin", description "Pequeño y rápido. Huele mal.", maxHp 7, hp 7
    expect(arrivalsOf(prev, next)).toEqual([
      { name: "Goblin 1", attitude: "hostile", portrait: "goblin", blurb: "Pequeño y rápido.", returning: false, health: null },
    ]);
  });
  it("marks an NPC that was absent and is present again as returning, with its health", () => {
    // prev: Mateo present false hp 3 maxHp 10; next: same, present true
    expect(arrivalsOf(prev, next)).toMatchObject([{ name: "Mateo", returning: true, health: "Malherido" }]);
  });
  it("ignores NPCs that were already present", () => { /* present true → true */ expect(arrivalsOf(prev, next)).toEqual([]); });
  it("ignores a new NPC that is not present", () => { /* new, present false */ expect(arrivalsOf(prev, next)).toEqual([]); });
  it("matches names ignoring case and spaces", () => { /* prev "Goblin" present; next " goblin " present */ expect(arrivalsOf(prev, next)).toEqual([]); });
  it("keeps the order of the new state", () => { /* next: B then A, both new */ expect(arrivalsOf(prev, next).map((a) => a.name)).toEqual(["B", "A"]); });
});

describe("firstSentence", () => {
  it("cuts at the first . ! or ? followed by space or end", () => {
    expect(firstSentence("Herrero del pueblo. Tiene un perro.")).toBe("Herrero del pueblo.");
    expect(firstSentence("¡Cuidado! Muerde.")).toBe("¡Cuidado!");
    expect(firstSentence("Sin punto final")).toBe("Sin punto final");
    expect(firstSentence("  ")).toBe("");
  });
  it("does not cut inside an ellipsis or a number", () => {
    expect(firstSentence("Mide 1.80 de alto. Calvo.")).toBe("Mide 1.80 de alto.");
  });
});

describe("groupArrivals", () => {
  it("groups numbered names with the same attitude", () => {
    // Goblin 1, Goblin 2, Goblin 3 hostile
    expect(groupArrivals(a)).toEqual([{ name: "Goblin", count: 3, lead: a[0] }]);
  });
  it("keeps a different attitude apart", () => {
    // Goblin 1 hostile, Goblin 2 friendly
    expect(groupArrivals(a).map((g) => [g.name, g.count])).toEqual([["Goblin 1", 1], ["Goblin 2", 1]]);
  });
  it("never groups names without a trailing number", () => {
    // "Lobo" and "Lobo gris", both hostile
    expect(groupArrivals(a)).toHaveLength(2);
  });
  it("a single numbered arrival keeps its full name", () => {
    expect(groupArrivals([goblin1])).toEqual([{ name: "Goblin 1", count: 1, lead: goblin1 }]);
  });
  it("ten goblins and one wolf make two groups, in first-appearance order", () => {
    expect(groupArrivals(a).map((g) => [g.name, g.count])).toEqual([["Goblin", 10], ["Lobo", 1]]);
  });
});

describe("isAmbush", () => {
  it("needs combat_start and a hostile arrival", () => {
    expect(isAmbush(["combat_start"], [hostile])).toBe(true);
    expect(isAmbush(["combat_start"], [friendly])).toBe(false);
    expect(isAmbush([], [hostile])).toBe(false);
    expect(isAmbush(["combat_start"], [])).toBe(false);
  });
});

describe("arrivalsAnnouncement", () => {
  it("names each group with its count and attitude", () => {
    expect(arrivalsAnnouncement([g1, g2, g3, mateoReturning])).toBe(
      "Aparece: Goblin ×3, hostil. Vuelve: Mateo, aliado.",
    );
  });
  it("is empty without arrivals", () => { expect(arrivalsAnnouncement([])).toBe(""); });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/arrivals.test.ts`
Expected: FAIL, cannot resolve `../src/domain/arrivals`.

- [ ] **Step 4: Implement `src/domain/arrivals.ts` and the `Arrival` type**

- Name matching: reuse the same normalisation the rest of the domain uses (`sameName` in `applyChanges.ts` / `findNpc` in `dialogue.ts`; export one if neither is exported, do not write a third).
- Health: `healthLabel(npc)` from `domain/health.ts`, mapped `"Ileso" → null`.
- Base name: `/^(.*\S)\s+\d+$/`; groups key on `base + attitude`, kept in first-appearance order.
- Attitude words for the announcement: friendly → "aliado", neutral → "neutral", hostile → "hostil". New arrivals go under "Aparece:", returning under "Vuelve:", each as `name[ ×N], actitud` joined by "; " within a section.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run tests/arrivals.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/arrivals.ts src/domain/types.ts tests/arrivals.test.ts
git commit -m "feat: detectar y agrupar las entradas de NPC de un turno"
```

---

### Task 2: Store arrivals on the turn

**Files:**
- Modify: `src/domain/types.ts` (`Turn`: add `arrivals?: Arrival[]`)
- Modify: `src/domain/schemas.ts:321-328` (saved turn schema)
- Modify: `src/engine/TurnEngine.ts:238-243` (`commit`)
- Test: `tests/TurnEngine.test.ts`, `tests/schemas.test.ts`

**Interfaces:**
- Consumes: `arrivalsOf(prev, next)` from Task 1.
- Produces: `Turn.arrivals?: Arrival[]`, present only when non-empty.

- [ ] **Step 1: Write the failing tests**

In `tests/TurnEngine.test.ts`:
```ts
it("records who arrived in the turn", async () => {
  // started game; reply with stateChanges [{ type: "npc", name: "Goblin 1", description: "Flaco.", attitude: "hostile",
  //   present: true, voice: "", portrait: null, maxHp: 7 }]
  expect(outcome.state.turns[1]!.arrivals).toEqual([
    { name: "Goblin 1", attitude: "hostile", portrait: null, blurb: "Flaco.", returning: false, health: null },
  ]);
});
it("leaves arrivals out when nobody arrived", async () => {
  expect("arrivals" in outcome.state.turns[1]!).toBe(false);
});
```
In `tests/schemas.test.ts`: a saved game whose turn has `arrivals` parses with them intact; one without the field parses with no `arrivals` key.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/TurnEngine.test.ts tests/schemas.test.ts`
Expected: FAIL on the two new TurnEngine tests and the arrivals schema test (field stripped).

- [ ] **Step 3: Implement**

- Schema: `arrivals: z.array(arrivalSchema).optional()`, `arrivalSchema` with `attitude` enum, `portrait: z.string().nullable()`, `health: z.enum(["Herido", "Malherido", "Fuera de combate"]).nullable()`. Keep the `_stateCheck` type assertion compiling.
- `commit`: `const arrivals = arrivalsOf(base, applied.state);` and spread `...(arrivals.length > 0 ? { arrivals } : {})` into `turn`.

- [ ] **Step 4: Run tests and type check**

Run: `npx vitest run && npm run check`
Expected: all PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/schemas.ts src/engine/TurnEngine.ts tests/TurnEngine.test.ts tests/schemas.test.ts
git commit -m "feat: guardar en cada turno quién entró en escena"
```

---

### Task 3: Toasts and screen-reader announcement

**Files:**
- Modify: `src/game/turnToasts.ts` (remove the "Nuevo personaje" loop; skip "¡Iniciativa!" on ambush)
- Modify: `src/game/EventToasts.tsx` (drop `"npc"` from `ToastItem["kind"]` and `ICONS`)
- Modify: `src/game/useTurnAnnouncement.ts`
- Modify: `src/game/styles/toasts.css` (remove `[data-kind="npc"]` rules if any)
- Test: `tests/turnToasts.test.ts`, `tests/announcement.test.ts`

**Interfaces:**
- Consumes: `arrivalsOf`, `isAmbush`, `arrivalsAnnouncement` from Task 1.
- Produces: `turnAnnouncement(turn: Turn, cast: Cast): string` in `src/game/announcement.ts` — `announcementOf(turn.narration, cast)` followed by `arrivalsAnnouncement(turn.arrivals ?? [])`, joined by a space, trimmed.

- [ ] **Step 1: Write the failing tests**

In `tests/turnToasts.test.ts` (replace the existing "Nuevo personaje" test):
```ts
it("no longer announces new NPCs with a toast", () => {
  expect(buildTurnToasts(base, withNpcs(base, [npc("Lira")]), [], 1)).toEqual([]);
});
it("skips the initiative toast when hostiles arrive as combat starts", () => {
  const next = withNpcs(base, [{ ...npc("Goblin 1"), attitude: "hostile" }]);
  expect(buildTurnToasts(base, next, ["combat_start"], 1).map((t) => t.title)).not.toContain("¡Iniciativa!");
});
it("keeps the initiative toast when combat starts with no one new", () => {
  expect(buildTurnToasts(base, base, ["combat_start"], 1)).toMatchObject([{ title: "¡Iniciativa!" }]);
});
it("an hp correction with present NPCs adds nothing about them", () => {
  const withLira = withNpcs(base, [npc("Lira")]);
  expect(buildTurnToasts(withLira, withLira, [], 1)).toEqual([]);
});
```
In `tests/announcement.test.ts`:
```ts
it("adds who arrived after the narration", () => {
  expect(turnAnnouncement({ number: 2, input: { type: "start" }, narration: "Se abre la puerta.", events: [],
    arrivals: [goblin("Goblin 1"), goblin("Goblin 2")] }, cast)).toBe("Se abre la puerta. Aparece: Goblin ×2, hostil.");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/turnToasts.test.ts tests/announcement.test.ts`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement**

In `buildTurnToasts`, guard the combat_start branch with `!isAmbush(events, arrivalsOf(prev, next))`. In `useTurnAnnouncement`, call `turnAnnouncement(last, castOf(screen.state))`.

- [ ] **Step 4: Run tests and type check**

Run: `npx vitest run && npm run check`
Expected: all PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/turnToasts.ts src/game/EventToasts.tsx src/game/announcement.ts src/game/useTurnAnnouncement.ts src/game/styles/toasts.css tests/turnToasts.test.ts tests/announcement.test.ts
git commit -m "feat: las entradas reemplazan al toast de nuevo personaje y suman al anuncio"
```

---

### Task 4: Arrival cards in the log

**Files:**
- Create: `src/game/ArrivalCards.tsx`
- Create: `src/game/styles/arrivals.css` (import it where the other `game/styles/*.css` are imported)
- Modify: `src/game/TurnLog.tsx` (`TurnLog` renders `<ArrivalCards>` after `<Narration>`)
- Modify: `src/animations/motion.ts` (add `enterArrival(element: Element): void`)
- Test: `tests/arrivalCards.test.tsx`

**Interfaces:**
- Consumes: `groupArrivals`, `ArrivalGroup` (Task 1), `Turn.arrivals` (Task 2), `NpcAvatar` (`size="lg"`, `kind={attitude}`), `HealthTag` from `SceneDrawer.tsx`.
- Produces: `ArrivalCards({ arrivals, animated }: { arrivals: readonly Arrival[]; animated?: boolean })` — renders nothing for an empty list.

- [ ] **Step 1: Write the failing tests** (`renderToStaticMarkup` from `react-dom/server`):

```ts
it("draws one card per group with the count", () => {
  const html = renderToStaticMarkup(<ArrivalCards arrivals={[g1, g2, g3]} />);
  expect(html.match(/class="arrival-card/g)).toHaveLength(1);
  expect(html).toContain("Goblin");
  expect(html).toContain("×3");
  expect(html).toContain("hostil");
});
it("says when someone returns and shows a health tag other than Ileso", () => {
  const html = renderToStaticMarkup(<ArrivalCards arrivals={[{ ...mateo, returning: true, health: "Malherido" }]} />);
  expect(html).toContain("Vuelve a aparecer");
  expect(html).toContain("Malherido");
});
it("shows no health tag when health is null", () => {
  expect(renderToStaticMarkup(<ArrivalCards arrivals={[mateo]} />)).not.toContain("health-tag");
});
it("renders nothing without arrivals", () => {
  expect(renderToStaticMarkup(<ArrivalCards arrivals={[]} />)).toBe("");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/arrivalCards.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

- Card markup: `<div class="arrival-card" data-kind={attitude}>` with avatar, `<strong>` name plus ` ×N` when `count > 1`, attitude label (aliado / neutral / hostil), then a line: `"Vuelve a aparecer · "` prefix when `lead.returning`, then `lead.blurb`, and `HealthTag` when `lead.health`.
- `NpcAvatar` needs an `Npc`: build one from the lead (`description: blurb, present: true, voice: "", hp: null, maxHp: null`).
- `aria-hidden` on the cards container: the announcement from Task 3 already reads them.
- Animation: `useEnter(animated ? enterArrival : null)` on each card; `enterArrival` mirrors `enterNarration` with a slight scale-in of the avatar.
- `TurnLog`: `animated={index >= enterCount}`, so only turns played in this session animate once when they join the log; reopened saves render still.
- Colours: reuse the attitude colour variables already used by `.avatar[data-kind]` and `.message--hostile` etc.

- [ ] **Step 4: Run tests, type check, and look at it**

Run: `npx vitest run && npm run check`
Expected: PASS, 0 errors.
Then `npm run dev`, open a game, use the mock save (`docs/partida-mock.json`) or play a turn where an NPC appears; confirm the card at phone width (375px) and in dark mode.

- [ ] **Step 5: Commit**

```bash
git add src/game/ArrivalCards.tsx src/game/styles/arrivals.css src/game/TurnLog.tsx src/animations/motion.ts tests/arrivalCards.test.tsx
git commit -m "feat: tarjetas de entrada de NPC en el registro"
```

---

### Task 5: Ambush banner

**Files:**
- Create: `src/game/AmbushBanner.tsx`
- Modify: `src/game/styles/arrivals.css`
- Modify: `src/animations/motion.ts` (add `enterBanner(element: Element): void` and `leaveBanner(element: Element, onDone: () => void): () => void`, modelled on `enterToast`/`leaveToast`, sliding down from above)
- Modify: `src/game/useSendTurn.ts` (new `setAmbush` in `Ui`; after a successful turn, if `isAmbush(outcome.response.events, lastTurn.arrivals ?? [])`, call `setAmbush(hostileArrivals)`)
- Modify: `src/game/Game.tsx` (`const [ambush, setAmbush] = useState<Arrival[] | null>(null)`, pass to `useSendTurn`, render `<AmbushBanner>` next to `<EventToasts>`)
- Test: `tests/ambushBanner.test.tsx`

**Interfaces:**
- Consumes: `groupArrivals`, `ArrivalGroup`, `isAmbush` (Task 1), `NpcAvatar`.
- Produces:
  - `bannerSlots(groups: readonly ArrivalGroup[], max = 4): { shown: ArrivalGroup[]; hidden: number }` — when `groups.length > max`, `shown` is the first `max - 1` and `hidden` counts the rest.
  - `AmbushBanner({ arrivals, onDone }: { arrivals: readonly Arrival[]; onDone: () => void })`.

- [ ] **Step 1: Write the failing tests**

```ts
it("fits up to four groups", () => {
  expect(bannerSlots(groups(4))).toEqual({ shown: groups(4), hidden: 0 });
});
it("turns the fourth slot into +N past four", () => {
  expect(bannerSlots(groups(6))).toMatchObject({ shown: groups(6).slice(0, 3), hidden: 3 });
});
it("shows the title, grouped counts and the overflow chip", () => {
  const html = renderToStaticMarkup(<AmbushBanner arrivals={sixKindsWithThreeGoblins} onDone={() => {}} />);
  expect(html).toContain("¡Emboscada!");
  expect(html).toContain("×3");
  expect(html).toContain("+3");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/ambushBanner.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

- Portal to `document.body` like `EventToasts`; `role="status"`, fixed at the top, width of the log column, one row, no horizontal scroll; avatars shrink below 480px.
- Auto-dismiss after 2500 ms or on click/tap, via `leaveBanner` then `onDone` (which sets `ambush` to null).
- Only live turns trigger it (it is raised from `useSendTurn`, never from loading a save).

- [ ] **Step 4: Run tests, type check, and look at it**

Run: `npx vitest run && npm run check`
Expected: PASS, 0 errors.
In `npm run dev`, play or mock a turn with hostile arrivals + `combat_start`; confirm the banner slides in, leaves after 2.5 s, no "¡Iniciativa!" toast, and with reduced motion it appears without sliding.

- [ ] **Step 5: Commit**

```bash
git add src/game/AmbushBanner.tsx src/game/styles/arrivals.css src/animations/motion.ts src/game/useSendTurn.ts src/game/Game.tsx tests/ambushBanner.test.tsx
git commit -m "feat: franja de emboscada cuando aparecen hostiles y arranca el combate"
```
