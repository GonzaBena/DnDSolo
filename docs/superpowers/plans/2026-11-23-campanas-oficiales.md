# Campañas oficiales con carga por trozos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir elegir entre jugar una "Aventura libre" o una de 3 campañas oficiales de DungeonSolo (100 % SRD 5.2.1), pre-cargando el estado inicial del módulo, integrando la selección con el generador de personajes y entregando la guía de campaña al DM **por trozos** (recorte doble por Acto activo y por Ubicación actual) para no quemar tokens.

**Architecture:**
- `src/campaigns/` define el tipo `OfficialCampaign`, el catálogo de 3 campañas escalonadas (Nivel 1, Nivel 2 y Nivel 3) y el selector de trozos `buildCampaignPromptBlock(state)` que en cada turno inyecta solo la brújula fija (~40 palabras), el Acto activo (1, 2 o 3 según `state.quests` / `state.threads`) y el detalle profundo únicamente de `state.location` más un índice de 1 línea de los lugares vecinos.
- `GameState` suma `campaignId: string | null` (`GAME_STATE_VERSION = 14`, migración `fromV13` en `src/persistence/migrations.ts` que asigna `campaignId: null` a partidas existentes).
- `createGame` acepta `campaignId?: string | null` en `CharacterInput`: si corresponde a una campaña oficial, fuerza su `startingLevel` y pre-puebla `location`, `npcs` de la escena inicial (`present: true`), `quests`, `threads` (públicos y `secret: true`) y `storyItems`.
- `/character` mantiene el formulario de personaje limpio en el primer paso; al pulsar "Empezar la aventura", cambia a una vista/sección individual "Elegí tu campaña" ("Aventura libre" + las 3 campañas oficiales) con botón "Volver al personaje" e "Iniciar partida".
- La portada (`/`) muestra el título de la campaña en `summarizeCampaign`, y el cajón `InfoDrawer` en `/play` muestra el título y la sinopsis pública de la campaña.

**Tech Stack:** Astro, React 19, TypeScript estricto, Zod, Vitest, tokens CSS existentes (`src/styles/tokens.css`).

---

### Task 1: Catálogo de campañas oficiales y motor de recorte por trozos (`src/campaigns/`)

**Files:**
- Create: `src/campaigns/types.ts`
- Create: `src/campaigns/data.ts`
- Create: `src/campaigns/index.ts`
- Test: `tests/campaigns.test.ts`

- [x] **Step 1: Crear `src/campaigns/types.ts` y `src/campaigns/data.ts`** con las 3 campañas oficiales SRD:
  1. `brasas-pico-quebrado` (*Las Brasas de Pico Quebrado*, niveles 1–3, arranque en nivel 1: frontera minera, goblins, kobolds y una sierpe roja joven en una forja enana sepultada).
  2. `campana-faro-hundido` (*La Campana del Faro Hundido*, niveles 2–4, arranque en nivel 2: misterio costero, niebla, ahogados y un culto en la cripta inundada bajo el faro).
  3. `mascaras-casa-ceniza` (*Máscaras de la Casa Ceniza*, niveles 3–4, arranque en nivel 3: intriga urbana, robo arcano, nobles, contrabandistas y un ritual en las cisternas).
  Todos los retratos de NPCs usan exclusivamente ids válidos de `PORTRAIT_IDS`.

- [x] **Step 2: Crear `src/campaigns/index.ts`** con:
  - `OFFICIAL_CAMPAIGNS`, `findCampaign(id: string | null | undefined): OfficialCampaign | undefined`
  - `activeAct(campaign: OfficialCampaign, state: GameState): CampaignAct | null`
  - `matchCampaignLocation(campaign: OfficialCampaign, locationName: string): CampaignLocation | null`
  - `buildCampaignPromptBlock(state: GameState): string | null` (recorte doble por Acto activo + Ubicación actual, y modo reducido de 2 líneas cuando los 3 actos ya se completaron).
  - `describeCampaignStart(state: GameState): string | null` (instrucción de turno 1 específica del módulo para `describeInput({ type: "start" }, state)`).

- [x] **Step 3: Escribir y correr `tests/campaigns.test.ts`** verificando:
  - Integridad de las 3 campañas (niveles, retratos válidos en `PORTRAIT_IDS`, `hp === maxHp` en NPCs iniciales, hilos secretos y públicos).
  - Transición automática entre Acto 1 → Acto 2 → Acto 3 → Campaña completada (mundo abierto) según `state.quests` y `state.threads`.
  - Recorte por ubicación: solo el lugar actual incluye `dmDetails`; los demás lugares aparecen únicamente como índice de 1 línea.

---

### Task 2: Dominio, esquema, migración `v13 -> v14` y `createGame` con semilla de campaña

**Files:**
- Modify: `src/domain/types.ts` (`GameState.campaignId: string | null`, `GAME_STATE_VERSION = 14`)
- Modify: `src/domain/schemas.ts` (`gameStateSchema.campaignId`)
- Modify: `src/persistence/migrations.ts` (`fromV13` asignando `campaignId: null`)
- Modify: `src/domain/character.ts` (`CharacterInput.campaignId?: string | null`, `createGame` pre-cargando el estado inicial de la campaña oficial y fijando su `startingLevel`)
- Modify: `docs/partida-mock.json` (`"version": 14`, `"campaignId": null`)
- Test: `tests/characterIds.test.ts`

- [x] **Step 1: Actualizar `types.ts`, `schemas.ts`, `migrations.ts`, `character.ts` y `docs/partida-mock.json`.**
- [x] **Step 2: Agregar tests de migración `v13 -> v14` y de `createGame` con `campaignId`** en `tests/characterIds.test.ts` y `tests/campaigns.test.ts`.

---

### Task 3: Integración en `dmPrompt.ts` y `generatorPrompt.ts`

**Files:**
- Modify: `src/engine/dmPrompt.ts` (`describeInput` con `describeCampaignStart(state)` y `buildTurnPrompt` con `buildCampaignPromptBlock(state)`)
- Modify: `src/rules/generatorPrompt.ts` (`buildConceptPrompt` aceptando `campaign?: OfficialCampaign | null`)
- Modify: `src/rules/generateOptions.ts` (`generateOptions` aceptando `campaignId?: string | null` opcional y forzando el nivel inicial si hay campaña)
- Test: `tests/dmPrompt.test.ts`, `tests/generateOptions.test.ts`

- [x] **Step 1: Inyectar el trozo de campaña en `buildTurnPrompt` y el gancho de inicio en `describeInput({ type: "start" }, state)`.**
- [x] **Step 2: Pasar el contexto público de la campaña a `buildConceptPrompt` en el generador de personajes.**
- [x] **Step 3: Agregar tests unitarios en `tests/dmPrompt.test.ts` y `tests/generateOptions.test.ts`.**

---

### Task 4: UI de selección en `/character`, handoff con `/generator`, portada (`/`) e `InfoDrawer` (`/play`)

**Files:**
- Modify: `src/character/handoff.ts` (persistir `campaignId` en `CharacterInput` y helper `stashCampaignId` / `readCampaignId` en `sessionStorage`)
- Modify: `src/character/CharacterCreator.tsx` (selector de tarjetas "Aventura libre" y las 3 campañas oficiales)
- Modify: `src/character/CharacterForm.tsx` (bloquear input de nivel cuando hay una campaña oficial seleccionada y pasar `campaignId` a `createGame`)
- Modify: `src/character/GeneratorPage.tsx` y `src/character/CharacterGenerator.tsx` (leer campaña activa, mostrar aviso de campaña, fijar su nivel inicial y pasar `campaignId` a `generateOptions` y al handoff de regreso)
- Modify: `src/character/character.css` (estilos con tokens para la grilla de tarjetas de campaña)
- Modify: `src/home/campaignSummary.ts` (incluir el título de la campaña oficial en `subtitle` cuando `game.campaignId` existe)
- Modify: `src/game/InfoDrawer.tsx` (mostrar título y sinopsis pública de la campaña oficial)
- Test: `tests/handoff.test.ts`, `tests/campaignSummary.test.ts`

- [x] **Step 1: Actualizar `handoff.ts`, `CharacterCreator.tsx`, `CharacterForm.tsx`, `GeneratorPage.tsx`, `CharacterGenerator.tsx` y `character.css`.**
- [x] **Step 2: Actualizar `campaignSummary.ts` e `InfoDrawer.tsx`.**
- [x] **Step 3: Correr `pnpm test && pnpm check && pnpm build`** para verificar que todos los tests, tipos y build pasen sin errores.
