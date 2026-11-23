# Portada rediseñada y esqueleto de la guía — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home menu with two states — a first-visit landing and a "continue" screen for returning players — and add a `/docs` guide page skeleton linked from the home and the footer.

**Architecture:** `src/pages/index.astro` renders both states; a pre-paint inline script picks one from a localStorage hint, and the existing `refresh()` confirms it from `repo.list()` and fills the returning state. Campaign display data (name, subtitle, initials, detail, narration excerpt) comes from a new pure module `src/home/campaignSummary.ts`, unit-tested. `/docs` is a static Astro page with anchored sections and placeholder copy.

**Tech Stack:** Astro 7 (prerendered pages), TypeScript strict, Vitest, existing CSS tokens in `src/styles/tokens.css` / `global.css`.

**Spec:** Approved design canvas https://claude.ai/artifact/5L5aSAwjN76WnkwwwhEuHn (artboards "Primera visita" and "Jugador que vuelve", centered-avatar version) plus these decisions:
- First visit: hero SVG (unchanged), `h1` "Tu aventura, tu Dungeon Master", subtitle, one primary CTA "Empezar una campaña" → `/character`, secondary line "¿Ya tenés una partida? Importala" (+ " o traela de Drive" → `/settings#sync-section`, only in sync builds), card "Cómo funciona" with 3 steps, privacy line.
- Returning: `h1` "La aventura sigue", continue card (landscape banner, centered avatar overlapping banner half/half, name, subtitle, narration excerpt clamped to 2 lines, detail line, full-width "Seguir jugando"), two buttons "Nueva campaña" / "Importar", "Otras campañas" (up to 2) with "Ver todas (N)" opening the existing load panel.
- Removed from home: "Configuración" button (header gear stays), disabled "Continuar", "Generar personaje" button (header generator icon stays).
- Guide: route `/docs`, link label "Guía". Linked from step 2 ("Cómo conseguirla" → `/docs#api-key`), from the "Cómo funciona" card ("Leer la guía completa" → `/docs`), and from the site footer on every page.

## Global Constraints

- Identifiers and comments in English; every UI string in Spanish rioplatense with voseo; sentence case; no emojis; no decorative exclamation marks.
- Colors, spacing, radius, borders and shadows only through existing tokens (`--color-*`, `--space-1`…`--space-6`, `--radius`, `--border`, `--shadow-*`); no literal hex in CSS.
- Both themes (light/dark) must work: every fill used for text uses its `*-ink` pair.
- Names and narration come from the player and the model: insert as `textContent`, never `innerHTML`.
- Pages stay prerendered; no new dependencies.
- localStorage access always in try/catch. New key: `dnsolo.home` with values `"first"` | `"returning"`.
- Respect `prefers-reduced-motion` (existing `enterPage` already does; add no new animation).
- Tests in `tests/*.test.ts`; run `pnpm test`; typecheck `pnpm check`; build `pnpm build`.

## Review Focus

1. Returning player opens `/` → must not flash the first-visit landing before the continue card appears. Covered by the pre-paint hint in Task 4, Step 5 (manual check).
2. Very long character name (e.g. "Thalia Vientoescarcha de las Colinas Altas") → wraps to two centered lines, card does not overflow at 320px width. Manual check in Task 4, Step 7.
3. Latest turn with empty narration (a roll-only turn) or a game with zero turns → excerpt falls back to the previous non-empty narration, or the excerpt paragraph is hidden. Test in Task 1.
4. Game with no player (`players: []`) → card shows "Sin personaje", initials "?", no crash. Test in Task 1.
5. Deleting the last campaign from the load panel → page switches to the first-visit state and the hint becomes `"first"`. Manual check in Task 4, Step 7.

---

### Task 1: Campaign summary module

**Files:**
- Create: `src/home/campaignSummary.ts`
- Test: `tests/campaignSummary.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Turn` from `src/domain/types.ts`; `initials(name: string): string` from `src/game/NpcAvatar.tsx`.
- Produces:
  ```ts
  export interface CampaignSummary {
    id: string;
    name: string;      // player name, or "Sin personaje"
    subtitle: string;  // "Pícara · nivel 3", or "" without player
    initials: string;  // first letter of initials(name) uppercased, or "?"
    detail: string;    // "42 turnos · 21/11/2026" ("1 turno" singular), date es-AR from updatedAt
    excerpt: string;   // from narrationExcerpt(); "" when no narration
  }
  export function summarizeCampaign(game: GameState): CampaignSummary;
  export function narrationExcerpt(text: string, max?: number): string; // max defaults to 140
  ```

- [ ] **Step 1: Write the failing tests** in `tests/campaignSummary.test.ts`, building games from `loadMockGame()` (`src/persistence/mockGame`) and overriding fields:
  - `summarizeCampaign` with player `{ name: "Thalia", characterClass: "Pícara", level: 3 }`, 42 turns, `updatedAt: "2026-11-21T15:00:00Z"` → `name "Thalia"`, `subtitle "Pícara · nivel 3"`, `initials "T"`, `detail "42 turnos · 21/11/2026"`.
  - one turn → detail starts with `"1 turno ·"`.
  - `players: []` → `name "Sin personaje"`, `subtitle ""`, `initials "?"`.
  - last turn narration `""`, previous `"La puerta cede."` → `excerpt "La puerta cede."`; `turns: []` → `excerpt ""`.
  - `narrationExcerpt("Entrás a la cripta. La puerta cede con un crujido. Abajo, algo respira.", 60)` → `"La puerta cede con un crujido. Abajo, algo respira."` (whole trailing sentences that fit).
  - `narrationExcerpt` with one 200-char sentence, max 140 → length ≤ 141, ends with `"…"`, does not cut a word.
  - `narrationExcerpt("**Cuidado**:  el\n\nsuelo _cruje_.")` → `"Cuidado: el suelo cruje."` (strips `*`/`_`, collapses whitespace).

- [ ] **Step 2: Run** `pnpm test tests/campaignSummary.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/home/campaignSummary.ts`.**
  `narrationExcerpt`: strip `*` and `_`, collapse whitespace, trim; split into sentences on `/(?<=[.!?…])\s+/`; take sentences from the end while the joined length stays ≤ `max`; if not even the last sentence fits, take the first `max` chars of the last sentence, cut back to the last space, append `"…"`. `summarizeCampaign` picks the last turn whose `narration.trim()` is non-empty.

- [ ] **Step 4: Run** `pnpm test tests/campaignSummary.test.ts` — Expected: PASS. Then `pnpm check` — Expected: 0 errors.

- [ ] **Step 5: Commit**
  ```bash
  git add src/home/campaignSummary.ts tests/campaignSummary.test.ts
  git commit -m "feat(home): resumen de campaña para la portada"
  ```

---

### Task 2: `/docs` skeleton and footer link

**Files:**
- Create: `src/pages/docs.astro`
- Modify: `src/layouts/Base.astro` (footer, around the "Ver créditos" link)
- Modify: `src/styles/global.css` (append `.docs` rules)

**Interfaces:**
- Produces: route `/docs` with section anchors `#que-es`, `#api-key`, `#costo`, `#que-podes-hacer`, `#drive`, `#preguntas`. Task 3 links to `/docs` and `/docs#api-key`.

- [ ] **Step 1: Create `src/pages/docs.astro`** using `<Base title="Guía">`: `h1` "Guía", a `<nav class="docs-toc" aria-label="Contenido">` with an ordered list of links to each anchor, then one `<section id="…" aria-labelledby="…">` per anchor with these `h2`s: "Qué es DnDSolo", "Cómo conseguir tu API key", "Cuánto cuesta", "Qué podés hacer", "Tus partidas y Google Drive", "Preguntas frecuentes". Each section body is a single `<p class="docs-pending">Próximamente.</p>`, except `#api-key`, which also gets a link "Ir a Configuración" → `/settings`. End with `.actions` holding "Volver" → `/` (same as `credits.astro`).

- [ ] **Step 2: Add `.docs-toc` and `.docs-pending` styles** to `global.css`: toc as a `.save`-style card (`--border`, `--radius`, `--color-surface`, `--shadow-flat`, padding `--space-3`); sections separated by `--space-5`; `.docs-pending` in `--color-ink-soft`, italic; `section[id]` gets `scroll-margin-top: var(--space-6)` so anchors clear the header.

- [ ] **Step 3: Add the footer link.** In `Base.astro`, inside `.attribution`, put `<a href="/docs">Guía</a> · ` before `<a href="/credits">Ver créditos</a>`.

- [ ] **Step 4: Verify.** `pnpm check && pnpm build` — Expected: success and `dist/client/docs/index.html` (or the build's equivalent prerendered path) exists. `grep -c 'id="api-key"' <that file>` → `1`.

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/docs.astro src/layouts/Base.astro src/styles/global.css
  git commit -m "feat(docs): esqueleto de la guía y enlace en el pie"
  ```

---

### Task 3: First-visit landing

**Files:**
- Modify: `src/pages/index.astro:8-65` (markup only in this task)
- Modify: `src/styles/global.css` (replace `.menu*` rules at lines ~190-196; append `.home-*` rules)

**Interfaces:**
- Consumes: `/docs`, `/docs#api-key` (Task 2).
- Produces for Task 4: wrapper `<div id="home-first" class="home">`, import trigger `<button id="import-save-first" type="button" class="link-button">Importala</button>`, and the existing `#menu-load` panel and `#import-file` input left intact.

- [ ] **Step 1: Replace `#menu-main`** with `#home-first` containing, in order: the existing hero SVG; `h1` "Tu aventura, tu Dungeon Master"; `<p class="home-lead">Jugá D&amp;D en solitario desde el navegador. Una IA narra la campaña; vos decidís qué hace tu personaje.</p>`; `<a class="button button--primary home-cta" href="/character">Empezar una campaña</a>`; `<p class="home-secondary">¿Ya tenés una partida? <button id="import-save-first" …>Importala</button>{syncBuild && <> o <a href="/settings#sync-section">traela de Drive</a></>}</p>`; `<section class="home-steps" aria-labelledby="how-title">` with `h2#how-title` "Cómo funciona", an `<ol>` of the 3 steps (copy below), and `<a href="/docs">Leer la guía completa</a>`; `<p class="home-privacy">` with a 24×24 lock icon (`stroke="currentColor"`, `stroke-width="2"`, round caps) and "Tus partidas se guardan en este navegador. Si querés, sincronizalas con tu Google Drive." (drop the second sentence when `!syncBuild`). Keep the existing `#sync-gesture` notice and the DEV-only "Cargar partida de ejemplo" button (move it to the end of `#home-first`).

  Steps copy (exact):
  1. **Creá tu personaje** — Elegí raza y clase, o dejá que la app lo genere por vos.
  2. **Pegá tu API key** — La narración usa tu propia clave de Gemini. `<a href="/docs#api-key">Cómo conseguirla</a>`
  3. **Jugá** — La IA narra; los dados y las reglas los resuelve la app.

- [ ] **Step 2: Styles.** Remove `.menu`, `.menu > …`, `.menu .button`, `.menu .button small` rules (keep `.button[aria-disabled]`). Add: `.home { display: grid; gap: var(--space-4); }`; `.home-cta` block, centered, `font-size: var(--text-lg)`, padding `--space-3 --space-4`; `.home-secondary` centered `--text-sm` `--color-ink-soft`; `.link-button` (reset button to look like an inline link: no border/background, `color: var(--color-accent)`, `font: inherit`, `font-weight: 700`, underline, `cursor: pointer`); `.home-steps` card (`--border`, `--radius`, `--color-surface`, `--shadow-flat`, padding `--space-3`); its `ol` list-style none with `counter-reset`, each `li::before` a 2.25rem circle (`--color-sun` fill, `--color-sun-ink` text, `--border`, `--font-display` 800) showing the counter; `.home-privacy` flex row, `--text-sm`, `--color-ink-soft`.

- [ ] **Step 3: Script.** `#import-save-first` click → `importFile.click()` (same as `#import-save`). Remove the `continueLink`, `continueInfo` and `openLoad` queries, their listeners and the continue-link block in `refresh()` (their elements are gone; a non-null `querySelector(...)!` would throw). The load panel is unreachable until Task 4 adds "Ver todas".

- [ ] **Step 4: Verify.** `pnpm check` → 0 errors. `pnpm dev`, open `/` with no saves (fresh profile or cleared IndexedDB) at 390px and 1280px wide, light and dark: landing matches the "Primera visita" artboard; "Importala" opens the file picker; links go to `/character`, `/docs`, `/docs#api-key`.

- [ ] **Step 5: Commit**
  ```bash
  git add src/pages/index.astro src/styles/global.css
  git commit -m "feat(home): portada para la primera visita"
  ```

---

### Task 4: Returning-player state

**Files:**
- Modify: `src/pages/index.astro` (markup + script)
- Modify: `src/styles/global.css` (append `.continue-card*`, `.campaign-row`, `[data-home]` rules)

**Interfaces:**
- Consumes: `summarizeCampaign(game): CampaignSummary` (Task 1); `#home-first`, `#import-save-first` (Task 3); existing `repo`, `renderSaves`, `#menu-load`, sync click interception for `a[href^='/play']`.
- Produces: `<div id="home-returning" class="home">`; `document.documentElement.dataset.home` = `"first"` | `"returning"`.

- [ ] **Step 1: Markup.** Add `#home-returning` after `#home-first`: `h1` "La aventura sigue"; `<article class="continue-card" aria-labelledby="continue-name">` with a decorative banner SVG (`aria-hidden="true"`, viewBox `0 0 320 90`, `preserveAspectRatio="xMidYMid slice"`, same sky/sun/far/near shapes as the hero scaled to 90 tall, reusing `.hero__sky/.hero__sun/.hero__far/.hero__near` classes), `<span class="continue-card__avatar" aria-hidden="true" id="continue-initials"></span>`, `h2#continue-name`, `<p id="continue-subtitle">`, `<p class="continue-card__excerpt" id="continue-excerpt">`, `<p class="continue-card__detail" id="continue-detail">`, `<a id="continue-play" class="button button--primary" href="/play">Seguir jugando</a>`; a `.home-pair` with `<a class="button" href="/character">Nueva campaña</a>` and `<button id="import-save-returning" type="button" class="button">Importar</button>`; `<section id="others" aria-labelledby="others-title">` with header row (`h2#others-title` "Otras campañas", `<button id="open-load" type="button" class="link-button">Ver todas (<span id="others-count"></span>)</button>`) and `<ul id="others-list" class="saves">`.

- [ ] **Step 2: Styles.** `.continue-card`: card tokens, `overflow: hidden`, `display: grid`, `text-align: center`; banner `display: block; width: 100%; height: 6rem; border-bottom: var(--border)`; `.continue-card__avatar` 4.5rem circle, `--color-accent` fill + `--color-accent-ink` text, `--border`, `--font-display` 800 `1.75rem`, `margin: -2.25rem auto 0` (half over the banner); name `--font-display` 800, `overflow-wrap: anywhere`; `.continue-card__excerpt` italic, dashed top border in `--color-ink-soft`, `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`; `.continue-card__detail` `--text-sm` `--color-ink-soft`; `.home-pair` 2-column grid `gap: var(--space-3)`. `.campaign-row`: `.save`-like row without shadow: avatar circle 2.5rem (`--color-dialog` / `--color-dialog-ink`), name + subtitle·turns, "Jugar" `.button--small`.
  Visibility rules:
  ```css
  #home-returning { display: none; }
  [data-home="returning"] #home-returning { display: grid; }
  [data-home="returning"] #home-first { display: none; }
  ```

- [ ] **Step 3: Script — fill and switch in `refresh()`.** Replace the continue-link block with: `const [latest, ...rest] = games;` if `latest`: fill the card fields from `summarizeCampaign(latest)` via `textContent` (hide `#continue-excerpt` when `excerpt === ""`), set `#continue-play` href `/play?id=<encoded id>`, render `rest.slice(0, 2)` into `#others-list` as `.campaign-row` items (built with `createElement`, "Jugar" link to `/play?id=…`), set `#others-count` to `games.length`, hide `#others` when `rest.length === 0`; then `setHome(latest ? "returning" : "first")`. Keep `renderSaves(games)` for the load panel. Remove the old `describe()` in favor of `summarizeCampaign` (the load panel uses `name`, `subtitle`, `detail`).
  `function setHome(state: "first" | "returning")`: sets `document.documentElement.dataset.home` and writes `localStorage["dnsolo.home"]` in try/catch.

- [ ] **Step 4: Script — panel and import.** `showMain()` hides `#menu-load` and shows the active home state (clear `hidden` on both wrappers; CSS decides which); `#open-load` click hides both wrappers and shows `#menu-load`. `#import-save-returning` click → `importFile.click()`. After a delete empties the list, `refresh()` already switches to `"first"`; then call `showMain()` (existing logic).

- [ ] **Step 5: Pre-paint hint.** At the top of `index.astro`'s Base slot, add `<script is:inline>` that reads `localStorage.getItem("dnsolo.home")` in try/catch and, if it is `"returning"`, sets `document.documentElement.dataset.home = "returning"`. No other value is applied (no-JS and unknown → first-visit).

- [ ] **Step 6: Verify automated.** `pnpm test && pnpm check && pnpm build` — Expected: all pass.

- [ ] **Step 7: Verify manually** with `pnpm dev` at 390px and 320px, light and dark:
  - With the DEV "Cargar partida de ejemplo" game saved, reload `/`: no first-visit flash; card matches the centered "Jugador que vuelve" artboard; "Seguir jugando" opens that game.
  - Rename the player to a 40-character name (edit in devtools IndexedDB or via import of an edited export): name wraps centered, nothing overflows at 320px.
  - With 3+ games: "Otras campañas" shows 2 rows; "Ver todas (N)" opens the panel; "Volver" returns to the continue screen.
  - Delete every game from the panel: page shows the first-visit landing; reload keeps it (hint `"first"`).
  - In a sync build (`PUBLIC_GOOGLE_CLIENT_ID` set), "Seguir jugando" and "Jugar" still go through the renewal interception (they match `a[href^='/play']`).

- [ ] **Step 8: Commit**
  ```bash
  git add src/pages/index.astro src/styles/global.css
  git commit -m "feat(home): pantalla para seguir jugando"
  ```
