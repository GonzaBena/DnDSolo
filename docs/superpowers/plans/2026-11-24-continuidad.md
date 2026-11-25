# Continuidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla "Anteriormente en…" al retomar tras 12 h y página `/campaign?id=…` con números, crónica y bestiario, todo derivado del estado guardado.

**Architecture:** Funciones puras en `src/domain/` calculan momentos por turno (guardados en `Turn.moments` como `arrivals`/`chapter`), el recap, las estadísticas, la línea de tiempo y el bestiario. Dos vistas React las muestran: `RecapScreen` dentro de la isla del juego y `CampaignPage`, una isla nueva en `src/pages/campaign.astro`.

**Tech Stack:** Astro 7, React 19, zod 4, vitest (`pnpm test`), `pnpm check`.

**Spec:** `docs/superpowers/specs/2026-11-24-continuidad-design.md`

## Global Constraints

- Sin llamadas nuevas al LLM y sin cambios en `dmPrompt.ts` ni en el schema de `DMResponse`.
- Nada de monedas, daño hecho ni daño recibido.
- Los hilos `secret: true` nunca se muestran ni se cuentan.
- Identificadores en inglés; textos de UI en español rioplatense.
- Umbral del recap: 12 h, una sola constante `RECAP_AFTER_MS = 12 * 60 * 60 * 1000`.
- Ruta `/campaign?id=…`; título visible "Tu campaña".
- Retratos de monstruo: `goblin`, `kobold`, `wolf`, `skeleton`, `zombie`, `drowned`, `dragon`.
- En el bestiario, "Fuera de combate" se muestra como "Derrotado".
- `Turn.moments` es opcional: no hay migración ni cambio de `GAME_STATE_VERSION`.

## Review Focus

- Partida con turnos pero sin resumen (menos de 10 turnos) y sin misiones: el recap muestra solo "Donde quedaste", sin encabezados vacíos. Test en Task 2.
- Última narración que es solo diálogo de un NPC (`[[Orvin]] …`): el extracto muestra el nombre del que habla y no deja el marcador `[[…]]` en el texto. Test en Task 2.
- `/campaign` sin `id` o con un id inexistente: mensaje "No encontramos esa campaña" y enlace a la portada, sin pantalla en blanco. Test en Task 5 (estado `missing`).
- Partidas viejas: NPC sin `seen`, turnos sin `chapter` ni `moments` y `portrait: null`. Cuentan como vistos, hay 1 lugar y va a Personajes. Tests en Tasks 3 y 4.
- Un monstruo numerado ("Goblin 2") junto a uno con nombre propio de retrato goblin ("Grishnak"): son dos tarjetas distintas. Test en Task 4.

---

### Task 1: Momentos por turno

**Files:**
- Create: `src/domain/moments.ts`
- Modify: `src/domain/types.ts` (tipo `Moment`, `Turn.moments?`), `src/domain/schemas.ts:337-338` (zod opcional), `src/engine/TurnEngine.ts:240-249`
- Test: `tests/moments.test.ts`, `tests/TurnEngine.test.ts`, `tests/schemas.test.ts`

**Interfaces:**
- Produces: `type Moment = { kind: "quest"; title: string; status: QuestStatus } | { kind: "level"; level: number } | { kind: "death" }` en `types.ts`; `Turn.moments?: Moment[]`; `momentsOf(prev: GameState, next: GameState): Moment[]`.

- [ ] **Step 1: Write the failing tests** en `tests/moments.test.ts` (usar `newGame()` de `tests/helpers.ts` y armar `next` a mano):
  - `"a new quest is a moment with its status"` → `[{ kind: "quest", title: "Ruta", status: "active" }]`
  - `"a quest that changes status is a moment; one that only changes its description is not"`
  - `"quest titles match ignoring case and spaces"` (`"ruta "` vs `"Ruta"` → sin momento si el estado es igual)
  - `"a level up is a moment with the new level"` → `{ kind: "level", level: 4 }`
  - `"a player becoming dead is a death moment, once"` (`"dying"→"dead"` da uno; `"dead"→"dead"` ninguno)
  - `"order: quests, then level, then death"`
  En `TurnEngine.test.ts`: `"a turn records its moments, and none when nothing changed"`, esto último sin la clave `moments`. En `schemas.test.ts`: `"a saved turn with moments parses, and one without them too"`.
- [ ] **Step 2: Run** `pnpm test moments TurnEngine schemas` → FAIL (`momentsOf` no existe).
- [ ] **Step 3: Implement** `momentsOf` comparando por `sameName` de `names.ts` (mismo criterio que `applyChanges.ts:282`). Agregar a `Turn` en `TurnEngine.commit` con `...(moments.length > 0 ? { moments } : {})`, junto a `arrivals`. En el schema: `moments: z.array(z.discriminatedUnion("kind", [...])).optional()`.
- [ ] **Step 4: Run** `pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat: cada turno registra misiones, niveles y muerte como momentos`

### Task 2: Recap y pantalla "Anteriormente en…"

**Files:**
- Create: `src/domain/recap.ts`, `src/game/RecapScreen.tsx`, `src/game/styles/recap.css` (importado desde `game.css`)
- Modify: `src/game/Game.tsx`, `src/game/InfoDrawer.tsx`
- Test: `tests/recap.test.ts`, `tests/recapScreen.test.tsx`

**Interfaces:**
- Produces:
  - `RECAP_AFTER_MS: number`
  - `shouldShowRecap(state: GameState, now: Date): boolean`
  - `interface Recap { summary: string[]; quests: { title: string; description: string }[]; place: string; inCombat: boolean; lastWords: { speaker: string | null; text: string } | null; pendingRoll: PlayerRollRequest | null; dying: boolean }`
  - `recapOf(state: GameState): Recap`
  - `RecapScreen({ recap, onClose }: { recap: Recap; onClose: () => void })`
  - `InfoDrawer` suma la prop `onOpenRecap: () => void`.

- [ ] **Step 1: Write the failing tests** en `tests/recap.test.ts`:
  - `shouldShowRecap`: `false` sin turnos; `false` a las 11 h 59 m desde `updatedAt`; `true` a las 12 h exactas; `false` si el jugador está `"dead"`.
  - `recapOf`:
    - `summary` es `state.summary` partido por `/\n+/` sin vacíos, y `[]` si está vacío.
    - `quests` son solo las `active`.
    - `place` es `state.location.name`.
    - `inCombat` sale de `scene.inCombat`.
    - `pendingRoll` sale de `pendingPlayerRoll`.
    - `dying` es `true` si algún jugador está `"dying"`.
  - `lastWords`:
    - Toma el último párrafo de la última narración (vía `splitDialogue` con `castOf(state)`).
    - Con `[[Orvin]] —Vení.` da `{ speaker: "Orvin", text: "—Vení." }`.
    - Un párrafo de más de 300 caracteres se recorta a las últimas oraciones completas que entran en 300, precedidas de `"…"`.
    - Una sola oración de más de 300 caracteres da `"…"` más sus últimos 300 caracteres.
    - Es `null` sin turnos.
  - En `tests/recapScreen.test.tsx` (con `renderToStaticMarkup`):
    - Tiene "Anteriormente en…" y el botón "Seguir".
    - Sin `summary` ni `quests` no aparecen los encabezados "Misiones en curso" ni el bloque de resumen.
    - Con `pendingRoll` muestra el `reason` y `CD 14`.
    - Con `dying` muestra "Tirada de muerte pendiente".
- [ ] **Step 2: Run** `pnpm test recap` → FAIL.
- [ ] **Step 3: Implement** `recap.ts` y `RecapScreen`. Es un `<dialog>` modal a pantalla completa con la estructura del boceto del spec: título "— Anteriormente en… —", resumen, "Misiones en curso" y "Donde quedaste" (lugar, " · en combate", la cita con el nombre del que habla y la tirada). El texto pasa por `parseInline` como el resto de la narración. El estilo es coherente con `level-up.css`.
- [ ] **Step 4: Wire in `Game.tsx`:**
  - Estado `recapOpen`. Al pasar a `screen.status === "playing"` con `state.turns.length === screen.loadedTurns` (solo al entrar), una vez por `state.id`, se abre si `shouldShowRecap(state, new Date())`.
  - Sumar `recapOpen` a las condiciones del efecto de turnos automáticos (línea 81, junto a `levelUpOpen`) y a `canAct`.
  - En `InfoDrawer`, un botón "Anteriormente en…" (cierra el cajón y abre el recap) y un enlace "Ver tu campaña" a `campaignHref(state.id)` (de Task 6), dentro de la sección "Crónica de la campaña".
- [ ] **Step 5: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 6: Commit** `feat: "Anteriormente en…" al volver a una partida después de 12 horas`

### Task 3: Estadísticas y línea de tiempo

**Files:**
- Create: `src/domain/campaignStats.ts`
- Test: `tests/campaignStats.test.ts`

**Interfaces:**
- Consumes: `Moment`, `Turn.moments` (Task 1); `isMonsterPortrait` (Task 4, que se hace antes).
- Produces:
  - `interface CampaignStats { turns: number; places: number; people: number; monsters: number; monstersDefeated: number; questsCompleted: number; questsFailed: number; questsActive: number; threadsResolved: number; rolls: number; natural20s: number; natural1s: number }`
  - `campaignStats(state: GameState): CampaignStats`
  - `type TimelineEntry = { turn: number } & ({ kind: "place"; name: string } | Moment)`
  - `timelineOf(state: GameState): TimelineEntry[]`

- [ ] **Step 1: Write the failing tests:**
  - `places`:
    - Cuenta los nombres distintos de los `turn.chapter`, comparados con `samePlace`.
    - Sin capítulos y con `location.name` no vacío, es 1.
    - Sin capítulos y con `location.name` vacío, es 0.
  - `people` y `monsters` cuentan NPCs vistos (`seen !== false`) y separan por `isMonsterPortrait`. Un NPC sin `seen` cuenta como visto.
  - `monstersDefeated`: monstruos con `hp === 0` y `maxHp !== null`.
  - `questsCompleted`, `questsFailed` y `questsActive` salen de `state.quests`. `threadsResolved` cuenta los `resolved` que no son `secret`.
  - `rolls` cuenta los turnos `action` con `roll` más los `death_save`.
  - `natural20s` y `natural1s`:
    - Cuentan un d20 único (`count` ausente o 1) con `value` 20 o 1, y los `death_save` con `natural` 20 o 1.
    - Un `2d6` que suma 1 no cuenta.
    - Con ventaja cuenta `value`, que es el dado que quedó.
  - `timelineOf`:
    - Ordena por turno.
    - En un mismo turno va primero el lugar y después los momentos.
    - Solo incluye capítulos con `firstVisit: true`.
    - Los turnos sin `moments` no aportan momentos.
- [ ] **Step 2: Run** `pnpm test campaignStats` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: estadísticas y línea de tiempo de la campaña`

### Task 4: Bestiario

**Files:**
- Modify: `src/domain/portraits.ts` (constante y función de monstruo)
- Create: `src/domain/bestiary.ts`
- Test: `tests/portraits.test.ts`, `tests/bestiary.test.ts`

**Interfaces:**
- Produces:
  - `isMonsterPortrait(portrait: string | null): boolean` en `portraits.ts`, con un `MONSTER_ARCHETYPES` cerrado (los 7 de Global Constraints).
  - `type BestiaryStatus = "Ileso" | "Herido" | "Malherido" | "Derrotado"`
  - `interface BestiaryEntry { name: string; npc: Npc; blurb: string; attitude: Attitude; status: BestiaryStatus | null }`, donde `npc` es el representante y sirve para `NpcAvatar`.
  - `bestiaryOf(state: GameState): { people: BestiaryEntry[]; monsters: BestiaryEntry[] }`

- [ ] **Step 1: Write the failing tests:**
  - `isMonsterPortrait`: `true` para `"goblin"`, `false` para `"orc-male"` y para `null`.
  - `bestiaryOf`:
    - Excluye a los NPCs con `seen: false` y respeta el orden de `npcs`.
    - `blurb` es `firstSentence(description)`.
    - `status` sale de `healthLabel`, con "Fuera de combate" convertido en "Derrotado", y es `null` sin PV.
    - Los monstruos sin nombre propio se agrupan en una sola entrada sin contador:
      - "Goblin", "Goblin 2" y "Goblin 3" quedan en una entrada `name: "Goblin"` (base del regex `NUMBERED` de `arrivals.ts`, a exportar).
      - El estado es "Derrotado" si todos tienen `hp === 0`. Si no, es el mejor de los demás (orden Ileso > Herido > Malherido).
      - Si ninguno tiene PV, el estado es `null`.
    - "Grishnak", con retrato goblin, es su propia entrada aunque exista "Goblin".
    - En Personajes no se agrupa nada: "Guardia 1" y "Guardia 2" son dos entradas.
- [ ] **Step 2: Run** `pnpm test bestiary portraits` → FAIL.
- [ ] **Step 3: Implement.** Agrupar por la base en minúsculas, o por el nombre si no tiene número. Sin número, solo se une a un grupo un nombre igual a una base ya vista ("Goblin" + "Goblin 2"). El representante es el primero.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: bestiario de personajes y monstruos conocidos`

### Task 5: Página "Tu campaña"

**Files:**
- Create: `src/pages/campaign.astro`, `src/campaign/CampaignPage.tsx`, `src/campaign/CampaignView.tsx`, `src/campaign/campaign.css`
- Test: `tests/campaignView.test.tsx`

**Interfaces:**
- Consumes: `campaignStats`, `timelineOf` (Task 3), `bestiaryOf` (Task 4), `findCampaign`, `NpcAvatar`, `createGameRepo()`.
- Produces:
  - `CampaignView({ state }: { state: GameState })`, que es presentación pura.
  - `CampaignPage()`, que lee `?id=`, hace `createGameRepo().load(id)` y maneja los estados `loading | missing | ready`.

- [ ] **Step 1: Write the failing tests** (`renderToStaticMarkup` de `CampaignView`, y de `CampaignPage`'s missing state exportado como `CampaignMissing`):
  - Encabezado: título de la campaña oficial o "Aventura libre", más nombre, especie, clase y nivel.
  - Muestra los números de `campaignStats`, con etiquetas como "turnos" y "lugares visitados".
  - Sección "Crónica": muestra el resumen y cada entrada de la línea de tiempo.
    - "Turno 3 · Llegaste a La Cripta de Vel".
    - "Misión cumplida: Ruta", "Nueva misión: …" y "Misión fallida: …".
    - "Subiste a nivel 4".
    - "Caíste en combate".
  - Secciones "Personajes" y "Monstruos" con nombre, blurb, actitud y estado.
    - La actitud se muestra como "Aliado", "Neutral" u "Hostil".
    - Una sección vacía muestra "Todavía no conociste a nadie" o "Todavía no te cruzaste con monstruos".
  - Enlaces:
    - "Volver a jugar" a `/play?id=…`. No aparece si el jugador está `"dead"`.
    - Siempre hay un enlace a la portada.
  - `CampaignMissing`: "No encontramos esa campaña" y enlace a `/`.
- [ ] **Step 2: Run** `pnpm test campaignView` → FAIL.
- [ ] **Step 3: Implement.**
  - `campaign.astro` sigue el modelo de `play.astro`: `Base title="Tu campaña" noindex`, `client:only="react"` y `DiceLoader` como fallback.
  - El layout sale del boceto del spec: General, Crónica, Personajes y Monstruos, en grilla de tarjetas a ancho de celular.
  - Los estilos usan los tokens de `tokens.css`.
- [ ] **Step 4: Run** `pnpm test && pnpm check && pnpm build` → PASS.
- [ ] **Step 5: Commit** `feat: página Tu campaña con números, crónica y bestiario`

### Task 6: Accesos y roadmap

**Files:**
- Modify: `src/home/campaignRows.ts` (`campaignHref`, enlace en `saveRow`), `src/game/GameOver.tsx`, `docs/roadmap.md`, `src/pages/sitemap.xml.ts` (solo si lista páginas a mano: `/campaign` no va, es `noindex`)
- Test: `tests/homeDom.test.ts`, test nuevo en `tests/gameOver.test.tsx`

**Interfaces:**
- Produces: `campaignHref(id: string): string` → `` `/campaign?id=${encodeURIComponent(id)}` ``, exportado junto a `playHref`. Task 2 lo usa en `InfoDrawer`.

- [ ] **Step 1: Write the failing tests:**
  - `saveRow` tiene un enlace "Ver campaña" con `href` a `/campaign?id=…`.
  - `GameOver` tiene "Ver tu campaña" con ese `href`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** En `docs/roadmap.md`, marcar la sección "Continuidad" como hecha el 2026-11-24 y anotar que "terminar sin morir" quedó fuera.
- [ ] **Step 4: Run** `pnpm test && pnpm check` → PASS.
- [ ] **Step 5: Verify in the user's Chrome** con una campaña real: abrir el recap a mano desde Info, la página desde Info y desde la portada, y comprobar en ancho de celular que no haya scroll horizontal.
- [ ] **Step 6: Commit** `feat: accesos a Tu campaña desde la portada y el epílogo`

**Orden de ejecución:** 1 → 4 → 3 → 6 → 2 → 5. La Task 6 va antes que la 2 porque define `campaignHref`, que la 2 usa.
