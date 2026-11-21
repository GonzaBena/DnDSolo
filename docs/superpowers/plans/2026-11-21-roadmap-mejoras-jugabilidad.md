# Roadmap de mejoras y jugabilidad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los errores de arbitraje y UI detectados en el análisis del 2026-11-21 y subir la jugabilidad: ficha real en juego (PG, CA, equipo), progresión por hitos, muerte, descansos, combate legible, sugerencias de acción y tramas persistentes.

**Architecture:** Seis fases, cada una en su propia rama y mergeable sola, en orden (las versiones del guardado se encadenan). Se mantiene la regla central: el modelo propone y el código arbitra. Todo lo nuevo que cambia números (PG, salvaciones contra la muerte, niveles, descansos) lo aplica `applyStateChanges` o una función pura del dominio, nunca el modelo ni la UI directamente. La lógica nueva vive en funciones puras con tests; los componentes React solo la consumen.

**Tech Stack:** Astro 7, React 19, TypeScript estricto, Zod 4, Vitest 5 (entorno node, sin testing de DOM), animejs 4, `@google/genai`.

**Spec:** no hay documento aparte. Las decisiones salen del análisis del 2026-11-21 (chat) y están en "Decisiones" abajo.

## Mapa de fases

| Fase | Rama | Contenido | Versión del guardado |
| ---- | ---- | --------- | -------------------- |
| 1 | `fix/arbitraje-y-ui` | Ventaja/desventaja, avisos fieles, daño recibido/infligido, resumen en segundo plano, barra espaciadora, tope de tiradas encadenadas, reintento con corrección | 8 → 9 |
| 2 | `feat/prompt-y-control` | Prompt compacto, botón Detener, respuestas rápidas | sin cambio |
| 3 | `feat/ficha-en-juego` | Stats del personaje, equipo inicial, PG arbitrados por código, panel con PG | 9 → 10 |
| 4 | `feat/reglas-de-progreso` | Muerte y salvaciones, progresión por hitos, descansos | 10 → 11 |
| 5 | `feat/combate-legible` | PG de enemigos, orden de iniciativa, sugerencias de acción | 11 → 12 |
| 6 | `feat/tramas` | Hilos de campaña (objetivo, amenaza, misterio) | 12 → 13 |

Si se cambia el orden de las fases, se renumeran las versiones: cada fase que toca el guardado sube **una** versión en su primera tarea de datos.

## Decisiones

- **Ventaja/desventaja** es un campo `mode` (`"normal" | "advantage" | "disadvantage"`) en las tiradas pedidas al jugador y a los enemigos, con `count: 1`. El jugador carga los dos d20; el código elige el mayor o el menor. El crítico y la pifia se miran en el dado elegido.
- **Eventos**: `damage` se separa en `damage_taken` (lo recibe un jugador) y `damage_dealt` (lo recibe otro). Las etiquetas desconocidas se descartan antes de validar, no hacen fallar la respuesta.
- **Avisos (toasts)** salen de comparar el estado anterior con el nuevo, no de lo que el modelo propuso.
- **Resumen**: se genera después de cerrar y guardar el turno, sin bloquearlo. Si falla, no se reintenta hasta 3 turnos después.
- **PG**: los lleva el código. `Character.stats` (CA, PG máx., ataques, CD de conjuros…) viene de la ficha del generador o de dos campos opcionales del formulario manual. El modelo propone `{ type: "hp", target, delta }` y el código acota a `[0, maxHp]`. El jugador también puede corregirlos a mano desde el panel, a través de `TurnEngine.adjustHp`. Sin `stats` (partidas viejas o formulario sin datos) los PG no existen y el DM sigue preguntando, como hoy.
- **Muerte**: a 0 PG el personaje queda `dying`. Las salvaciones las carga el jugador con su d20 y el código las resuelve (`applyDeathSave`); el DM solo narra. Con 3 fallos, `dead` y pantalla de fin.
- **Niveles**: hacen falta `MILESTONES_PER_LEVEL = 2` hitos desde el último nivel. Completar una misión suma 1; el DM puede proponer un cambio `milestone` (máximo uno por respuesta) por un logro grande. Pedir subir de nivel no alcanza.
- **Descansos**: cambio `rest` (`short` | `long`). El largo restaura PG al máximo y limpia las salvaciones; se rechaza en combate. El corto no toca nada solo: los dados de golpe los tira el jugador y llegan como `hp`.
- **Enemigos con PG**: los NPC hostiles tienen `maxHp`, que el DM fija al aparecer según la tabla de REGLAS DE COMBATE. El daño se aplica con el mismo cambio `hp` (target = nombre del NPC). La UI muestra solo una etiqueta (Ileso / Herido / Malherido / Fuera de combate), nunca números.
- **Sugerencias**: hasta 3 acciones cortas por respuesta (≤ 60 caracteres). Tocar una la escribe en el cuadro de texto, no la envía. Se pueden apagar en Configuración.
- **Hilos de campaña**: objetivo, amenaza o misterio, con `secret` para lo que el jugador no debe ver todavía.

## Global Constraints

- Identificadores y comentarios en inglés; texto de UI y prompts en español rioplatense.
- Componentes nuevos solo en React.
- Cada cambio de forma del guardado: sube `GAME_STATE_VERSION`, suma `fromVN` en `src/persistence/migrations.ts`, actualiza `gameStateSchema` (los chequeos `_stateCheck` de `schemas.ts` obligan a que coincida con `GameState`) y regenera `docs/partida-mock.json` para que `tests/mockGame.test.ts` siga pasando.
- Todo cambio nuevo en `StateChange` va en el tipo (`types.ts`), en el esquema Zod (`schemas.ts`), en `applyStateChanges` y en el prompt (`DM_SYSTEM_PROMPT`) en la misma tarea.
- Los cambios de estado los decide `applyStateChanges` (o una función pura del dominio llamada desde `TurnEngine`); la UI nunca edita `GameState` directamente.
- Verificación de cada tarea: `pnpm test` y `pnpm check` en verde. Las tareas con UI suman una prueba manual con `pnpm dev`, descrita en la tarea.
- Commits en español con prefijo convencional (`feat:`, `fix:`), como el historial; al final, la línea `Co-Authored-By` que corresponda.
- Cada fase termina con merge `--no-ff` a `main`, como las ramas anteriores.

## Review Focus

1. **Partidas viejas (v8) cargando a través de todas las migraciones nuevas** sin perder turnos ni NPCs. → un test por migración (Tareas 1, 12, 16, 20, 23) más el mock en `docs/`.
2. **Cancelar mientras se envían tiradas de enemigos**: "Reintentar" tiene que reenviar los mismos dados, no tirar otros. → test en Tarea 9.
3. **Cambio `hp` sobre un personaje sin `stats`** (formulario manual vacío): se rechaza sin romper el turno y la UI no muestra PG. → tests en Tareas 12 y 15.
4. **El resumen termina después de que el jugador ya jugó otro turno**: el parche se aplica sobre el estado más nuevo, no lo pisa. → test en Tarea 5.
5. **Ventaja con 20 natural en el dado elegido** (y desventaja con un 20 en el dado descartado): crítico solo en el primero. → test en Tarea 1.

---

## Fase 1 — Arbitraje y UI (`fix/arbitraje-y-ui`)

```bash
git switch -c fix/arbitraje-y-ui
```

### Task 1: Ventaja y desventaja en las tiradas del jugador

**Files:**
- Modify: `src/domain/types.ts` (tipos de tirada, `GAME_STATE_VERSION` → 9)
- Modify: `src/domain/dice.ts`
- Modify: `src/domain/schemas.ts` (`playerRollRequest`, `turnInput.action.roll`)
- Modify: `src/persistence/migrations.ts` (`fromV8`)
- Modify: `src/game/RollDialog.tsx`, `src/game/Game.tsx` (`submitRoll`)
- Modify: `src/engine/dmPrompt.ts`, `src/engine/combatRules.ts` (texto de ventaja)
- No se toca: `docs/partida-mock.json` (queda en v3 a propósito para ejercitar toda la cadena de migración)
- Test: `tests/dice.test.ts`, `tests/schemas.test.ts`, `tests/memory.test.ts` o el test de migraciones que ya exista (`grep -l migrateSave tests`), `tests/dmPrompt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export const ROLL_MODES = ["normal", "advantage", "disadvantage"] as const;
  export type RollMode = (typeof ROLL_MODES)[number];
  interface PlayerRollRequest { die; count; reason; difficulty; mode: RollMode }
  interface PlayerRoll { die; count?; value; modifier; reason?; mode?: RollMode; rolls?: [number, number] }
  // dice.ts
  export function resolveRollMode(rolls: readonly [number, number], mode: Exclude<RollMode, "normal">): number;
  // naturalResult y describePlayerRoll aceptan además { mode?, rolls? }
  ```

- [ ] **Step 1: Write the failing tests** en `tests/dice.test.ts`:
  ```ts
  it("advantage keeps the higher die, disadvantage the lower", () => {
    expect(resolveRollMode([7, 15], "advantage")).toBe(15);
    expect(resolveRollMode([7, 15], "disadvantage")).toBe(7);
  });
  it("a natural 20 counts only on the die that was kept", () => {
    expect(naturalResult({ die: "d20", count: 1, value: 20, mode: "advantage", rolls: [20, 3] })).toBe("critical");
    expect(naturalResult({ die: "d20", count: 1, value: 3, mode: "disadvantage", rolls: [20, 3] })).toBeNull();
  });
  it("describes both dice of an advantage roll", () => {
    expect(describePlayerRoll({ die: "d20", count: 1, value: 17, modifier: 3, mode: "advantage", rolls: [12, 17] }))
      .toBe("1d20 con ventaja (12 y 17, queda 17): 17 + 3 = 20");
  });
  ```
  En `tests/schemas.test.ts`: una respuesta con `playerRoll` sin `mode` falla; con `mode: "advantage"` parsea.
  En el test de migraciones: un guardado v8 con `pendingPlayerRoll: { die: "d20", count: 1, reason: "x", difficulty: 12 }` migra a v9 con `mode: "normal"`; con `pendingPlayerRoll: null` sigue `null`.

- [ ] **Step 2: Run to verify they fail**
  Run: `pnpm test tests/dice.test.ts tests/schemas.test.ts`
  Expected: FAIL (`resolveRollMode` no existe, `mode` desconocido).

- [ ] **Step 3: Implement**
  - `types.ts`: `ROLL_MODES`, `RollMode`, los campos de arriba, `GAME_STATE_VERSION = 9`.
  - `dice.ts`: `resolveRollMode`; `naturalResult` mira `value` cuando `mode` no es `normal` (el `value` ya es el dado elegido; `count` sigue siendo 1). En `describePlayerRoll`, cuando hay `rolls`, el texto exacto es `1d20 con ventaja (A y B, queda X): …` / `1d20 con desventaja (…)`.
  - `schemas.ts`: `mode: z.enum(ROLL_MODES)` en `playerRollRequest`; `mode` y `rolls: z.tuple([z.number().int(), z.number().int()])` opcionales en `turnInput.action.roll`.
  - `migrations.ts`: `fromV8` agrega `mode: "normal"` a `pendingPlayerRoll` si es objeto; encadenarlo en `migrateSave`.
  - `RollDialog.tsx`: con `request.mode !== "normal"` muestra dos campos ("Dado 1", "Dado 2", cada uno de 1 a 20) en lugar de "Resultado", y muestra cuál queda. `onSubmit` recibe `value` = dado elegido, `mode` y `rolls`. Sin pedido, la tirada libre agrega un selector Normal / Ventaja / Desventaja solo para el d20.
  - `Game.tsx` `submitRoll`: pasa `mode` y `rolls` dentro de `roll`.
  - `dmPrompt.ts`: en TIRADAS DEL JUGADOR, `"mode"` es parte del pedido: `"advantage"` o `"disadvantage"` con `count: 1` cuando corresponda, si no `"normal"`. `combatRules.ts`: el bloque VENTAJA Y DESVENTAJA reemplaza "pedile count: 2…" por "pedile `mode: "advantage"` (o `"disadvantage"`) con `count: 1`; el sistema elige el dado".
  - `docs/partida-mock.json`: queda en `"version": 3` a propósito, para que ejercite toda la cadena de migración; no se sube a 9.

- [ ] **Step 4: Run all tests**
  Run: `pnpm test && pnpm check`
  Expected: PASS, 0 errores.

- [ ] **Step 5: Manual check**
  `pnpm dev` → en una partida, abrir el dado sin pedido, elegir d20 con ventaja, cargar 4 y 18: el total usa 18 y la tarjeta del log dice "con ventaja (4 y 18, queda 18)".

- [ ] **Step 6: Commit**
  ```bash
  git add -A && git commit -m "fix: ventaja y desventaja se cargan como dos d20 y el sistema elige"
  ```

### Task 2: Ventaja y desventaja en las tiradas de enemigos

**Files:**
- Modify: `src/domain/types.ts` (`EnemyRollRequest.mode`), `src/domain/schemas.ts` (`enemyRollRequest`), `src/domain/dice.ts` (`rollForEnemy`), `src/engine/dmPrompt.ts` (`describeInput` para `enemy_rolls`), `src/engine/TurnEngine.ts` (`checkInput` compara `mode`), `src/persistence/migrations.ts` (`fromV8` también agrega `mode: "normal"` a cada `pendingEnemyRolls[]` y a cada `turns[].input.results[]` de tipo `enemy_rolls`), `src/game/TurnLog.tsx` (tarjeta de tirada)
- Test: `tests/dice.test.ts`, `tests/TurnEngine.test.ts`, test de migraciones

**Interfaces:**
- Consumes: `RollMode`, `resolveRollMode` (Task 1).
- Produces: `EnemyRollRequest { die; count; modifier; reason; mode: RollMode }`; con `mode !== "normal"`, `EnemyRollResult.values` tiene 2 valores y `total = resolveRollMode(values) + modifier`.

- [ ] **Step 1: Write the failing tests**
  ```ts
  it("rolls two d20 for an enemy with advantage and keeps the higher", () => {
    const seq = [0.1, 0.9]; // -> 3 y 19
    const result = rollForEnemy({ die: "d20", count: 1, modifier: 4, reason: "Ataque del goblin", mode: "advantage" }, () => seq.shift()!);
    expect(result.values).toEqual([3, 19]);
    expect(result.total).toBe(23);
  });
  ```
  En `TurnEngine.test.ts`: el prompt de un turno `enemy_rolls` con ventaja contiene `"con ventaja"` y los dos dados.
  En migraciones: un turno v8 `enemy_rolls` sin `mode` sale con `mode: "normal"`.

- [ ] **Step 2: Run to verify they fail** — `pnpm test tests/dice.test.ts tests/TurnEngine.test.ts` → FAIL.

- [ ] **Step 3: Implement** según las Interfaces. `describeInput` para un resultado con ventaja: `- Ataque del goblin: 1d20+4 con ventaja = 23 (dados: 3, 19; queda 19)`. En el prompt, la sección TIRADAS DE ENEMIGOS documenta `"mode"`. `TurnLog` muestra "con ventaja" o "con desventaja" en la meta de la tarjeta.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix: los enemigos también tiran con ventaja o desventaja"`

### Task 3: Eventos `damage_taken` / `damage_dealt` y etiquetas desconocidas

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts` (`events`, `parseDMResponse`), `src/engine/dmPrompt.ts` (sección EVENTOS)
- Test: `tests/schemas.test.ts`, `tests/dmPrompt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const TURN_EVENTS = ["damage_taken", "damage_dealt", "healing", "scene_change", "combat_start",
    "combat_end", "item_gained", "new_npc", "new_quest", "quest_completed", "level_up", "death"] as const;
  export type TurnEvent = (typeof TURN_EVENTS)[number];
  // DMResponse.events: TurnEvent[]   (Turn.events sigue siendo string[] para no migrar turnos viejos)
  ```

- [ ] **Step 1: Write the failing tests**
  ```ts
  it("drops unknown event tags instead of rejecting the reply", () => {
    const parsed = parseDMResponse(JSON.stringify({ ...reply(), events: ["damage_taken", "explosion", "damage"] }));
    expect(parsed.ok && parsed.response.events).toEqual(["damage_taken"]);
  });
  it("offers the model only the known tags", () => {
    expect(JSON.stringify(dmResponseJsonSchema)).toContain("damage_dealt");
  });
  ```
  En `dmPrompt.test.ts`: `DM_SYSTEM_PROMPT` contiene `damage_taken` y `damage_dealt` y no contiene `damage,`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**: `events: z.array(z.enum(TURN_EVENTS))` en `dmResponseSchema`. En `parseDMResponse`, después de `JSON.parse` y antes de `safeParse`, si `json.events` es un array, filtrarlo a los valores de `TURN_EVENTS`. Prompt: `damage_taken` (un jugador recibe daño), `damage_dealt` (un enemigo o NPC recibe daño).

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS. (Va a fallar la compilación de `Game.tsx` por `events.includes("damage")`; dejalo para la Task 4 o cambiá ahí mismo la comparación a `"damage_taken"`.)

- [ ] **Step 5: Commit** — `git commit -am "fix: el DM distingue el daño recibido del infligido"`

### Task 4: Avisos calculados a partir del estado aplicado

**Files:**
- Create: `src/game/turnToasts.ts`
- Modify: `src/game/Game.tsx` (borrar `handleTurnEvents`; usar `buildTurnToasts` y `shakeScreen` solo con `damage_taken`)
- Test: `tests/turnToasts.test.ts`

**Interfaces:**
- Consumes: `ToastItem` de `src/game/EventToasts.tsx`, `TurnEvent` (Task 3).
- Produces:
  ```ts
  export function buildTurnToasts(prev: GameState, next: GameState, events: readonly string[], stamp: number): ToastItem[];
  /** Whether the screen should shake: a player took damage. */
  export function tookDamage(events: readonly string[]): boolean;
  ```

- [ ] **Step 1: Write the failing tests** (estados de `newGame()` de `tests/helpers.ts`, modificados a mano):
  - objeto que aparece en el inventario de `next` y no en el de `prev` → aviso `{ kind: "item", title: "Objeto obtenido", detail: "Antorcha ×2" }`;
  - objeto que baja de cantidad o desaparece → `"Objeto usado o perdido"`;
  - `inventory_remove` rechazado (los inventarios de `prev` y `next` son iguales) → **ningún** aviso de objeto;
  - nivel 3 → 4 → `"¡Subiste de nivel!"`; evento `level_up` sin cambio de nivel → sin aviso;
  - misión que pasa a `completed` → `"¡Misión completada!"`; misión nueva `active` → `"Nueva misión"`;
  - NPC cuyo nombre no estaba en `prev.npcs` → `"Nuevo personaje"`;
  - `damage_taken` → aviso `kind: "damage"`; `damage_dealt` → ninguno de daño;
  - dos objetos con el mismo nombre en el mismo turno → ids distintos (`new Set(ids).size === ids.length`).

- [ ] **Step 2: Run to verify it fails** — `pnpm test tests/turnToasts.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implement** `buildTurnToasts`: diff de `players[0].inventory` por nombre normalizado (`trim().toLowerCase()`), de `level`, de `quests` por título y de `npcs` por nombre. Los ids son `` `${kind}-${stamp}-${index}` `` con el índice de la lista. Los textos son los mismos que hoy en `Game.tsx`. En `Game.tsx`, `send` guarda el `state` anterior y, con `outcome.ok`, llama a `setToasts(prev => [...prev, ...buildTurnToasts(state, outcome.state, outcome.response.events, Date.now())])`; el temblor y el destello quedan detrás de `tookDamage`.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check**: en `pnpm dev`, atacar a un enemigo y pegarle → la pantalla no tiembla.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "fix: los avisos muestran lo que pasó de verdad, no lo que propuso el DM"`

### Task 5: Resumen en segundo plano

**Files:**
- Modify: `src/engine/TurnEngine.ts`
- Modify: `src/game/Game.tsx`
- Test: `tests/TurnEngine.test.ts`, `tests/memory.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SummaryPatch { summary: string; summarizedThroughTurn: number }
  class TurnEngine {
    /** null when no summary is due, the call failed, or a failure happened less than 3 turns ago. */
    summarizeIfDue(state: GameState): Promise<SummaryPatch | null>;
    /** Applies the patch to the newest state (ignored if that state is already summarized further) and saves. */
    applySummary(latest: GameState, patch: SummaryPatch): Promise<{ state: GameState; saveError: unknown | null }>;
  }
  export const SUMMARY_RETRY_AFTER_TURNS = 3;
  ```
  `playTurn` deja de llamar al resumen: `commit` guarda sin `refreshSummary`.

- [ ] **Step 1: Write the failing tests**
  - `playTurn` en el turno 10 hace **cero** llamadas a `generateText` (`llm.textRequests.length === 0`).
  - `summarizeIfDue` con 10 turnos sin resumir devuelve `{ summary, summarizedThroughTurn: 10 }`.
  - `summarizeIfDue` falla (texto encolado como `new Error()`) → `null`; inmediatamente después, con 11 turnos → `null` sin llamar al modelo; con 13 turnos → vuelve a llamar.
  - `applySummary(latest, patch)` con `latest` de 11 turnos y un parche hasta el 10: conserva los 11 turnos y queda `summarizedThroughTurn: 10`.
  - `applySummary` con `latest.summarizedThroughTurn = 12` y un parche hasta el 10 → devuelve `latest` sin cambios.
  - Ajustar los tests existentes de `memory.test.ts` que esperaban el resumen dentro de `playTurn`.

- [ ] **Step 2: Run to verify they fail** — `pnpm test tests/TurnEngine.test.ts tests/memory.test.ts` → FAIL.

- [ ] **Step 3: Implement**: el intento fallido se recuerda en un campo privado `lastFailedSummaryAt: number | null` (el `turns.length` del fallo); `summarizeIfDue` no llama si `turns.length - lastFailedSummaryAt < SUMMARY_RETRY_AFTER_TURNS`. En `Game.tsx`, después de un turno ok, `void engine.summarizeIfDue(outcome.state).then(...)`; cuando hay parche, `applySummary` sobre el `state` más reciente (leelo desde un ref con la última pantalla, no desde el closure) y `setScreen` con el resultado.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix: el resumen se genera después del turno y no lo frena"`

### Task 6: Escribir en cualquier lado sin romper el teclado

**Files:**
- Create: `src/game/keyRedirect.ts`
- Modify: `src/game/Game.tsx` (listener de `keydown`)
- Test: `tests/keyRedirect.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface KeyLike { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; defaultPrevented: boolean }
  export interface TargetLike { tagName: string; isContentEditable?: boolean; getAttribute(name: string): string | null }
  /** Whether a keystroke on `target` should be sent to the composer. */
  export function shouldRedirectKey(event: KeyLike, target: TargetLike | null): boolean;
  ```

- [ ] **Step 1: Write the failing tests** con objetos planos:
  - `"a"` sobre `BODY` → `true`;
  - `" "` sobre `BUTTON` → `false`; `"Enter"` → `false` (tecla de más de un carácter);
  - `"a"` sobre `BUTTON` → `false` (un botón con foco no pierde el teclado);
  - `"a"` sobre `A`, `SUMMARY` o un elemento con `role="button"` → `false`;
  - `"a"` sobre `INPUT`, `TEXTAREA`, `SELECT` o `isContentEditable` → `false`;
  - `"a"` con `ctrlKey` → `false`; con `defaultPrevented` → `false`.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** y reemplazar en `Game.tsx` las condiciones del listener por `shouldRedirectKey(event, event.target as Element | null)` (más el chequeo de `dialog[open]`, que se queda). `isEditable` se mueve a `keyRedirect.ts`.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check**: Tab hasta "Escena" y Espacio → se abre el panel y no se escribe un espacio en el cuadro de texto.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "fix: la barra espaciadora vuelve a activar botones"`

### Task 7: Tope de tiradas de enemigos encadenadas, avisado al DM

**Files:**
- Modify: `src/engine/dmPrompt.ts` (`buildTurnPrompt` recibe opciones), `src/engine/TurnEngine.ts`
- Test: `tests/TurnEngine.test.ts`, `tests/dmPrompt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PromptOptions { enemyRollsAllowed: boolean }
  export function buildTurnPrompt(state: GameState, input: TurnInput, recentTurns: number, options?: PromptOptions): string;
  ```
  Con `enemyRollsAllowed: false` se agrega, justo antes de TURNO ACTUAL, el bloque exacto:
  `LÍMITE DE TIRADAS\nEn esta respuesta no pidas tiradas de enemigos: resolvé lo que quede con las tiradas que ya tenés y devolvele el turno al jugador.`

- [ ] **Step 1: Write the failing tests**
  - Con 2 turnos `enemy_rolls` seguidos y el input actual `enemy_rolls`, el prompt enviado (`llm.structuredRequests[0].prompt`) contiene `LÍMITE DE TIRADAS`.
  - Con 1 turno anterior, no lo contiene.
  - Si igual pide tiradas en el último permitido: `pendingEnemyRolls` queda `[]` **y** `scene.turnOf` queda `null`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**: `chainedEnemyRolls(state, input) >= MAX_CHAINED_ENEMY_ROLLS` decide `enemyRollsAllowed` antes de armar el prompt; en `commit`, cuando se descartan las tiradas, también `scene: { ...scene, turnOf: null }`.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix: el DM sabe cuándo no puede pedir más tiradas de enemigos"`

### Task 8: El reintento le dice al modelo qué falló

**Files:**
- Modify: `src/engine/dmPrompt.ts` (`buildCorrection`), `src/engine/TurnEngine.ts` (`playTurn`), `src/domain/applyChanges.ts:715` (quitar el `change.level > 20` redundante)
- Test: `tests/TurnEngine.test.ts`

**Interfaces:**
- Produces: `export function buildCorrection(reason: string): string` →
  `` `CORRECCIÓN\nTu respuesta anterior no respetó el esquema: ${reason}\nRespondé de nuevo, solo con el JSON válido.` ``

- [ ] **Step 1: Write the failing test**: encolar `"no es json"` y después una respuesta válida; `structuredRequests[1].prompt` termina con `buildCorrection("The response is not valid JSON.")` y `structuredRequests[0].prompt` no contiene `CORRECCIÓN`.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement**: en el segundo intento, `prompt + "\n\n" + buildCorrection(lastReason)`.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit, merge de la fase**
  ```bash
  git commit -am "fix: el reintento le explica al DM qué estuvo mal"
  git switch main && git merge --no-ff fix/arbitraje-y-ui
  ```

---

## Fase 2 — Prompt y control (`feat/prompt-y-control`)

### Task 9: Botón Detener

**Files:**
- Modify: `src/llm/LLMClient.ts` (`LLMErrorKind` + `"aborted"`), `src/llm/GeminiClient.ts` (`toLLMError`: `error.name === "AbortError"` → `aborted`), `src/llm/FakeLLMClient.ts` (respeta `signal.aborted` antes de devolver), `src/llm/errorMessages.ts`
- Modify: `src/engine/TurnEngine.ts` (`playTurn(state, input, onNarration?, signal?)`, nueva falla `{ kind: "aborted" }`)
- Modify: `src/game/Game.tsx` (AbortController, botón)
- Test: `tests/TurnEngine.test.ts`

**Interfaces:**
- Produces: `TurnFailure` suma `| { kind: "aborted" }`. `playTurn` pasa `signal` a `generateStructured` y no reintenta si la falla es `aborted`.

- [ ] **Step 1: Write the failing tests**
  - Con un `AbortController` ya abortado, `playTurn` devuelve `{ ok: false, failure: { kind: "aborted" } }`, el estado no cambia y `repo` no guardó nada.
  - Un turno `enemy_rolls` abortado conserva `input.results` intactos en el resultado: el test guarda los `values` que se mandaron y verifica que `engine.rollEnemyDice` no se volvió a llamar (la UI reenvía el mismo `inFlight.input`).

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement**. En `Game.tsx`: `abortRef = useRef<AbortController | null>(null)`; `send` crea uno por turno. Mientras `busy`, el botón de enviar se reemplaza por **"Detener"** (`aria-label="Detener respuesta"`). Al abortar:
  - input `action`: `setInFlight(null)` y el texto vuelve al cuadro (`setDraft(input.text)`), sin error;
  - input `start` o `enemy_rolls`: queda `inFlight` con el aviso `"Cortaste la respuesta del DM."` y el botón "Reintentar" (mismos dados).

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check**: mandar una acción, tocar Detener a mitad del texto → el texto vuelve al cuadro y el log no suma un turno.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: se puede detener la respuesta del DM"`

### Task 10: Prompt compacto

**Files:**
- Modify: `src/engine/dmPrompt.ts` (`stateForModel` exportada, `buildTurnPrompt`)
- Test: `tests/dmPrompt.test.ts`

**Interfaces:**
- Produces: `export function stateForModel(state: GameState): unknown` con estas reglas:
  - NPC presente: completo (`name, description, attitude, present, voice, portrait`);
  - NPC ausente: `{ name, attitude, present: false }`;
  - `storyItems`: solo `available` y `taken` (los `gone` quedan afuera);
  - misiones `completed` o `failed`: `{ title, status }`; las `active`, completas.
  `buildTurnPrompt` serializa con `JSON.stringify(stateForModel(state))`, sin sangría.

- [ ] **Step 1: Write the failing tests** para cada regla, más: el prompt no contiene `"\n  \""` (sin sangría) y un estado con 30 NPCs ausentes y 30 objetos `gone` produce un prompt al menos 40 % más corto que hoy (medir el largo de `buildTurnPrompt` antes del cambio en el mismo test con una copia del serializador viejo, o fijar el número esperado).

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** El prompt del sistema ya explica `present`; agregar: "Los NPCs ausentes figuran solo con nombre y actitud; si vuelven, mandá su cambio `npc` completo."

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: el estado viaja compacto y sin lo que ya no está en escena"`

### Task 11: Respuestas rápidas (menos razonamiento)

**Files:**
- Create: `src/llm/thinking.ts`
- Modify: `src/persistence/settings.ts` (`fastNarration`), `src/pages/settings.astro` (checkbox), `src/llm/GeminiClient.ts` (constructor con opciones), `src/game/Game.tsx` (pasa la opción)
- Test: `tests/thinking.test.ts`, test de settings si existe

**Interfaces:**
- Produces:
  ```ts
  export type ThinkingConfig = { thinkingBudget: number } | { thinkingLevel: "low" };
  export function thinkingConfigFor(model: string, fast: boolean): ThinkingConfig | undefined;
  interface Settings { apiKey: string; model: string; fastNarration: boolean } // false si falta en lo guardado
  new GeminiClient(apiKey, model, { fastNarration })
  ```

- [ ] **Step 1: Verify the API** con Context7 (`@google/genai`, `thinkingConfig`): confirmar los nombres `thinkingBudget` y `thinkingLevel` y qué familias aceptan cada uno. Si difieren de la tabla de abajo, ajustar la tabla antes de escribir los tests.

- [ ] **Step 2: Write the failing tests** con la tabla decidida:
  | `model` contiene | `fast: true` | `fast: false` |
  | --- | --- | --- |
  | `gemini-2.5-flash` | `{ thinkingBudget: 0 }` | `undefined` |
  | `gemini-2.5-pro` | `{ thinkingBudget: 128 }` | `undefined` |
  | `gemini-3` | `{ thinkingLevel: "low" }` | `undefined` |
  | otro | `undefined` | `undefined` |
  Más: `loadSettings` con `{ apiKey, model }` guardado sin `fastNarration` devuelve `fastNarration: false`.

- [ ] **Step 3: Run to verify they fail.**

- [ ] **Step 4: Implement.** Solo `generateStructured` usa el `thinkingConfig`; el resumen no. En Configuración, checkbox "Respuestas rápidas (el DM piensa menos y contesta antes)".

- [ ] **Step 5: Run** — `pnpm test && pnpm check` → PASS. Manual: con la opción prendida, en la pestaña Network el pedido lleva `thinkingConfig`.

- [ ] **Step 6: Commit + merge**
  ```bash
  git add -A && git commit -m "feat: opción de respuestas rápidas"
  git switch main && git merge --no-ff feat/prompt-y-control
  ```

---

## Fase 3 — Ficha en juego (`feat/ficha-en-juego`)

### Task 12: Stats del personaje y PG en el estado

**Files:**
- Modify: `src/domain/types.ts` (`CharacterStats`, `Character.stats`, `Character.currentHp`, cambio `hp`, `GAME_STATE_VERSION` → 10)
- Modify: `src/domain/schemas.ts` (`stateChange` `hp`, `gameStateSchema.players`)
- Modify: `src/domain/applyChanges.ts` (`case "hp"`)
- Modify: `src/persistence/migrations.ts` (`fromV9`: `stats: null, currentHp: null`), `src/domain/character.ts` (`createCharacter` pone `stats: null, currentHp: null` por ahora), `docs/partida-mock.json`
- Test: `tests/applyChanges.test.ts`, test de migraciones, `tests/schemas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CharacterStats {
    maxHp: number; armorClass: number; initiative: number; speed: number; hitDice: string;
    attacks: { name: string; attackBonus: number; damage: string }[];
    spellSaveDc: number | null; spellAttackBonus: number | null;
  }
  // Character: stats: CharacterStats | null; currentHp: number | null
  // StateChange: | { type: "hp"; target: string; delta: number }   // target = id o nombre del jugador (Fase 5: también NPC)
  ```

- [ ] **Step 1: Write the failing tests** (`newGame()` con `stats` puestos a mano, `maxHp: 20, currentHp: 20`):
  - `{ type: "hp", target: PLAYER_ID, delta: -7 }` → `currentHp: 13`;
  - `delta: -50` → `0`; `delta: +50` desde 13 → `20`;
  - `target: "Lira"` (por nombre, sin importar mayúsculas) también aplica;
  - personaje con `stats: null` → rechazado con motivo `"That character has no hit points tracked."`, el estado no cambia;
  - `target` desconocido con un solo jugador → aplica al único jugador (como `findPlayerIndex`);
  - migración v9 → v10 agrega `stats: null, currentHp: null` a cada jugador.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** El esquema de `hp`: `delta: z.number().int()` y distinto de 0 (`.refine(d => d !== 0)`). Todavía no se toca el prompt (Task 14).

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: el estado lleva CA y PG del personaje"`

### Task 13: La ficha del generador y el formulario llegan a la partida

**Files:**
- Create: `src/domain/stats.ts`
- Modify: `src/domain/character.ts` (`CharacterInput.stats?`, `CharacterInput.startingInventory?`, `createCharacter`)
- Modify: `src/character/formValues.ts` (`formValuesFromOption` usa `option.sheet`), `src/character/handoff.ts` (esquema extendido), `src/character/CharacterForm.tsx` (campos opcionales "PG máximos" y "Clase de armadura")
- Test: `tests/stats.test.ts`, `tests/formValues.test.ts`, `tests/handoff.test.ts`, `tests/characterIds.test.ts` o donde se testee `createGame`

**Interfaces:**
- Consumes: `CharacterSheet` (`src/rules/types.ts`), `buildSheet`, `fighterChoices()` (`tests/helpers.ts`).
- Produces:
  ```ts
  export function statsFromSheet(sheet: CharacterSheet): CharacterStats;
  /** "Jabalina (8)" -> { name: "Jabalina", quantity: 8 }; gold > 0 adds "Monedas de oro". */
  export function inventoryFromSheet(sheet: CharacterSheet): InventoryItem[];
  /** Manual form: both numbers or nothing. */
  export function statsFromForm(maxHp: number | null, armorClass: number | null): CharacterStats | null;
  ```

- [ ] **Step 1: Write the failing tests**
  - Con `buildSheet(fighterChoices())`: `statsFromSheet` copia `hitPoints → maxHp`, `armorClass`, `initiative`, `speed`, `hitDice`, `attacks` (sin `mastery`), y `spellSaveDc`/`spellAttackBonus` son `null` porque el guerrero no lanza conjuros.
  - Con un mago de `greedyChoices("human", "wizard", "sage", 1)`: `spellSaveDc === sheet.spellcasting.saveDc`.
  - `inventoryFromSheet({ ...sheet, equipment: ["Espada larga", "Jabalina (8)"], gold: 4 })` → `[{ name: "Espada larga", quantity: 1 }, { name: "Jabalina", quantity: 8 }, { name: "Monedas de oro", quantity: 4 }]`.
  - `statsFromForm(18, 16)` → `{ maxHp: 18, armorClass: 16, initiative: 0, speed: 9, hitDice: "", attacks: [], spellSaveDc: null, spellAttackBonus: null }`; `statsFromForm(18, null)` → `null`.
  - `createGame` con `stats` y `startingInventory` → el jugador tiene `stats`, `currentHp === stats.maxHp` y ese inventario; sin ellos → `stats: null, currentHp: null, inventory: []`.
  - `handoff`: `takeCharacter` acepta y devuelve `stats` y `startingInventory`; uno con `stats` mal formado devuelve `null`.
  - `formValuesFromOption(option)` incluye `stats` e inventario de `option.sheet`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** El inventario inicial también entra a `storyItems` como `taken` al crear la partida (para que `syncStoryItems` no lo marque como recién aparecido); alcanza con llamar a la misma lógica o crear los items con `location: ""`. En el formulario: dos `<input type="number">` opcionales con la ayuda "Si los completás, la app lleva tus PG". Si el formulario viene del generador, se muestran ya llenos y en solo lectura, con la leyenda "De la ficha generada".

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check**: generar un personaje → "Usar este personaje" → crear la partida → en Info aparece el equipo del trasfondo y la clase.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: la partida arranca con la ficha y el equipo del personaje"`

### Task 14: El DM ve la ficha y propone los cambios de PG

**Files:**
- Modify: `src/engine/dmPrompt.ts` (`stateForModel` incluye `stats` y `currentHp`; textos de TIRADAS DEL JUGADOR y ESTADO), `src/engine/combatRules.ts`
- Test: `tests/dmPrompt.test.ts`

**Interfaces:**
- Consumes: cambio `hp` (Task 12).

- [ ] **Step 1: Write the failing tests**
  - `DM_SYSTEM_PROMPT` ya no contiene `No tenés su hoja de personaje` ni `No hay cambio de estado para eso`.
  - Contiene `"hp"` y la frase `Si "stats" es null`.
  - `stateForModel` de un jugador con stats incluye `armorClass` y `currentHp`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement** los textos (reemplazos exactos):
  - TIRADAS DEL JUGADOR: "En ESTADO, `players[].stats` tiene su CA, PG máximos, ataques y CD de conjuros, y `currentHp` sus PG actuales. Usalos en vez de preguntar. Si `"stats"` es null, no los tenés: preguntáselos en la narración."
  - ESTADO: "Cuando un personaje recibe daño o curación, mandá un cambio `"hp"` con `"target"` (su id) y `"delta"` (negativo para daño), y decí la cantidad en la narración. Si `"stats"` es null, no mandes `"hp"`: decile la cantidad para que la anote."
  - `combatRules.ts` ATAQUES DE ENEMIGOS: "Compará el ataque con la CA de `stats`; si impacta, aplicá el daño con un cambio `"hp"`."

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: el DM conoce la CA y los PG y los descuenta con un cambio de estado"`

### Task 15: PG en el panel y corrección manual

**Files:**
- Create: `src/game/HpDialog.tsx`
- Modify: `src/engine/TurnEngine.ts` (`adjustHp`), `src/game/CharacterPanel.tsx`, `src/game/Game.tsx`, `src/game/game.css`, `src/game/turnToasts.ts` (aviso con el número exacto)
- Test: `tests/TurnEngine.test.ts`, `tests/turnToasts.test.ts`

**Interfaces:**
- Consumes: `applyStateChanges` con `hp` (Task 12), `buildTurnToasts` (Task 4).
- Produces:
  ```ts
  class TurnEngine {
    /** Manual fix from the sheet panel; not a turn, so nothing goes to the model. */
    adjustHp(state: GameState, playerId: string, delta: number): Promise<{ state: GameState; saveError: unknown | null }>;
  }
  ```

- [ ] **Step 1: Write the failing tests**
  - `adjustHp(state, PLAYER_ID, -3)` devuelve `currentHp` bajado, `turns.length` sin cambio y el repo guardó.
  - `buildTurnToasts` con `currentHp` 20 → 13 da `{ kind: "damage", title: "¡Daño recibido!", detail: "Perdiste 7 PG (13/20)." }`; 13 → 18 da `{ kind: "healing", title: "Recuperación", detail: "Recuperaste 5 PG (18/20)." }`. Con PG, el aviso de daño sale de la diferencia, no del evento; sin `stats`, sigue saliendo del evento `damage_taken`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.**
  - `CharacterPanel`: si hay `stats`, muestra una barra `PG 13/20` (verde > 50 %, ámbar > 25 %, rojo el resto, con colores de `tokens.css`) y `CA 16`. Botones `−` y `+` de 1 PG; tocar el número abre `HpDialog` (cantidad + "Daño" / "Curación").
  - `Game.tsx`: el panel llama a `engine.adjustHp` y actualiza la pantalla. Deshabilitado mientras `busy`.
  - Sin `stats`, el panel no cambia respecto de hoy.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check**: en un combate, el goblin pega → la barra baja y el aviso dice cuántos PG; tocar `+` sube 1 y sobrevive a recargar la página.

- [ ] **Step 6: Commit + merge**
  ```bash
  git add -A && git commit -m "feat: los PG se ven en el panel y se pueden corregir a mano"
  git switch main && git merge --no-ff feat/ficha-en-juego
  ```

---

## Fase 4 — Reglas de progreso (`feat/reglas-de-progreso`)

### Task 16: Estado de salud del personaje y salvaciones contra la muerte

**Files:**
- Create: `src/domain/deathSaves.ts`
- Modify: `src/domain/types.ts` (`Character.condition`, `Character.deathSaves`, `Character.milestonesSinceLevel`, `TurnInput` `death_save`, `GAME_STATE_VERSION` → 11), `src/domain/schemas.ts`, `src/persistence/migrations.ts` (`fromV10`), `src/domain/applyChanges.ts` (`hp` a 0 → `dying`; daño estando a 0 → +1 fallo; curación desde 0 → `ok` y salvaciones a 0), `docs/partida-mock.json`
- Test: `tests/deathSaves.test.ts`, `tests/applyChanges.test.ts`, test de migraciones

**Interfaces:**
- Produces:
  ```ts
  export type Condition = "ok" | "dying" | "stable" | "dead";
  // Character: condition: Condition; deathSaves: { successes: number; failures: number }; milestonesSinceLevel: number
  // TurnInput: | { type: "death_save"; playerId: string; natural: number }
  export function applyDeathSave(player: Character, natural: number): Character;
  ```
  Reglas de `applyDeathSave` (solo con `condition === "dying"`; si no, devuelve el mismo personaje): 20 → `currentHp: 1, condition: "ok"`, salvaciones a 0; 1 → +2 fallos; 10–19 → +1 éxito; 2–9 → +1 fallo; 3 éxitos → `stable` (salvaciones a 0); 3 fallos → `dead`.

- [ ] **Step 1: Write the failing tests**: un caso por regla, más `hp` −20 desde 5 → `currentHp: 0, condition: "dying"`; `hp` −3 estando `dying` → `failures: 1`; `hp` −3 con 2 fallos → `dead`; `hp` +4 estando `dying` o `stable` → `ok`, `currentHp: 4`. La migración v10 → v11 agrega `condition: "ok", deathSaves: { successes: 0, failures: 0 }, milestonesSinceLevel: 0`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: a 0 PG el personaje queda moribundo y las salvaciones las resuelve el código"`

### Task 17: Turno de salvación contra la muerte y pantalla de fin

**Files:**
- Create: `src/game/GameOver.tsx`
- Modify: `src/engine/TurnEngine.ts` (`checkInput` y `playTurn` para `death_save`), `src/engine/dmPrompt.ts` (`describeInput`, reglas), `src/game/Game.tsx`, `src/game/RollDialog.tsx` (modo salvación), `src/game/TurnLog.tsx` (`InputEntry` de `death_save`)
- Test: `tests/TurnEngine.test.ts`, `tests/dmPrompt.test.ts`

**Interfaces:**
- Consumes: `applyDeathSave`, `Condition` (Task 16).

- [ ] **Step 1: Write the failing tests**
  - `death_save` con el jugador `ok` → `invalid_input`; con `natural` fuera de 1–20 → `invalid_input`; cualquier `action` con el jugador `dead` → `invalid_input`.
  - `death_save` natural 8 estando `dying` con 0 fallos: el prompt contiene `SALVACIÓN CONTRA LA MUERTE (resuelta por el sistema): 8, fallo. Van 0 éxitos y 1 fallo.` y el estado guardado tiene `failures: 1` aunque la respuesta del DM no proponga nada.
  - Natural 20: el prompt dice `20 natural: recupera 1 PG y se levanta.`; tercer fallo: `Tercer fallo: el personaje muere.`

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** El engine aplica `applyDeathSave` **antes** de armar el prompt y manda al modelo el estado ya actualizado. En `combatRules.ts`, PUNTOS DE GOLPE A 0 pasa a: "Cuando el jugador está `dying`, el sistema le pide la salvación en su turno y te manda el resultado; no la pidas vos en `playerRoll` ni cambies sus contadores." En la UI:
  - `condition === "dying"` y es el turno del jugador: el cuadro de texto se reemplaza por un aviso "Estás inconsciente" con el botón "Tirar salvación contra la muerte", que abre `RollDialog` en modo d20 sin modificador y envía `{ type: "death_save", … }`. Se muestran los contadores como 3 círculos de éxito y 3 de fallo.
  - `condition === "dead"`: `GameOver` con el título "Tu historia terminó acá", el log en solo lectura y los botones "Exportar partida" (la misma acción que en la lista de campañas) y "Nueva campaña" (`/character`).

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check**: bajar los PG a 0 con `−` → aparece el botón de salvación; cargar 1, 1 → pantalla de fin; recargar → sigue la pantalla de fin.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: salvaciones contra la muerte y pantalla de fin"`

### Task 18: Progresión por hitos

**Files:**
- Modify: `src/domain/types.ts` (cambio `milestone`, `MILESTONES_PER_LEVEL`), `src/domain/schemas.ts`, `src/domain/applyChanges.ts` (`quest` → `completed` suma 1 a cada jugador; `milestone`; `level` exige hitos y los resetea), `src/engine/dmPrompt.ts`, `src/game/CharacterPanel.tsx` (progreso)
- Test: `tests/applyChanges.test.ts`, `tests/dmPrompt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MILESTONES_PER_LEVEL = 2;
  // StateChange: | { type: "milestone"; playerId: string; reason: string }
  ```

- [ ] **Step 1: Write the failing tests**
  - Misión `active` → `completed` suma 1 a `milestonesSinceLevel`; volver a mandar la misma misión `completed` no suma otra vez.
  - Dos `milestone` en la misma respuesta: se aplica uno y el otro se rechaza (`"One milestone per reply."`).
  - `level` con 1 hito → rechazado (`"Not enough milestones for a new level."`); con 2 → aplica y deja `milestonesSinceLevel: 0`.
  - Orden dentro de una respuesta: `quest completed` + `level` → aplica (el hito cuenta antes del nivel). Para eso, `level` se evalúa contra `next`, no contra `state`.
  - El prompt contiene `Que el jugador lo pida no alcanza` y ya no contiene `o el jugador lo pida`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Texto de REGLAS: "Para subir de nivel hacen falta 2 hitos desde el último nivel; los hitos se ven en `milestonesSinceLevel`. Completar una misión suma uno solo. Por un logro grande (vencer a un jefe, resolver un misterio central) mandá un cambio `milestone` con el motivo, como mucho uno por respuesta. Que el jugador lo pida no alcanza: si pregunta, decile cuánto le falta." En el panel: "Progreso ●○" junto al nivel.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: subir de nivel requiere hitos"`

### Task 19: Descansos corto y largo

**Files:**
- Modify: `src/domain/types.ts` (cambio `rest`), `src/domain/schemas.ts`, `src/domain/applyChanges.ts`, `src/game/slashCommands.ts`, `src/engine/dmPrompt.ts`
- Test: `tests/applyChanges.test.ts`, `tests/slashCommands.test.ts`

**Interfaces:**
- Produces: `StateChange` suma `| { type: "rest"; kind: "short" | "long" }`.

- [ ] **Step 1: Write the failing tests**
  - `rest long` fuera de combate → `currentHp = maxHp`, `deathSaves` a 0, `condition: "ok"` si estaba `stable`.
  - `rest long` con `scene.inCombat` → rechazado (`"Can't rest during combat."`).
  - `rest short` → el estado no cambia y no se rechaza.
  - `rest long` con el personaje `dead` → rechazado.
  - `expandSlashCommands("/descanso")` y `"/descanso corto"` → `"Me tomo un descanso corto (una hora) para recuperar el aliento y vendar heridas."`; `"/descanso largo"` → `"Armo campamento para un descanso largo de ocho horas."`.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Prompt (sección ESTADO): "Descanso corto: si el jugador gasta dados de golpe, pedile la tirada (`playerRoll` con su dado de golpe) y aplicá la curación con `hp`; después mandá `rest` `short`. Descanso largo: si nada lo interrumpe, mandá `rest` `long` (el sistema restaura los PG) y recordale que recupera los espacios de conjuro y la mitad de sus dados de golpe. No se descansa en combate."

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit + merge**
  ```bash
  git add -A && git commit -m "feat: descansos corto y largo arbitrados por el código"
  git switch main && git merge --no-ff feat/reglas-de-progreso
  ```

---

## Fase 5 — Combate legible (`feat/combate-legible`)

### Task 20: PG de enemigos y etiqueta de salud

**Files:**
- Create: `src/domain/health.ts`
- Modify: `src/domain/types.ts` (`Npc.hp`, `Npc.maxHp`, cambio `npc` con `maxHp`, `GAME_STATE_VERSION` → 12), `src/domain/schemas.ts`, `src/domain/applyChanges.ts` (`hp` con target NPC; `npc` fija `maxHp` la primera vez), `src/persistence/migrations.ts` (`fromV11`: `hp: null, maxHp: null`; `scene.order: []`; `suggestedActions: []`, todo lo de la fase), `src/engine/dmPrompt.ts`, `src/engine/combatRules.ts`, `src/game/SceneDrawer.tsx`, `src/game/ScenePanel.tsx`, `docs/partida-mock.json`
- Test: `tests/health.test.ts`, `tests/applyChanges.test.ts`, test de migraciones

**Interfaces:**
- Produces:
  ```ts
  // Npc: hp: number | null; maxHp: number | null
  // npc change: + maxHp: number | null   (solo cuenta la primera vez; null = no lleva PG)
  export type HealthLabel = "Ileso" | "Herido" | "Malherido" | "Fuera de combate";
  export function healthLabel(npc: Pick<Npc, "hp" | "maxHp">): HealthLabel | null;
  ```
  Cortes: `hp === maxHp` → Ileso; `hp / maxHp > 0.5` → Herido; `> 0` → Malherido; `0` → Fuera de combate; sin `maxHp` → `null`.

- [ ] **Step 1: Write the failing tests**: los cortes de `healthLabel` (incluido 11/11, 6/11, 5/11, 1/11 y 0/11); `npc` con `maxHp: 7` → `hp: 7, maxHp: 7`; un segundo cambio con `maxHp: 20` no lo cambia; `hp` con `target: "Goblin 1"` −4 → `hp: 3`; a 0 el NPC sigue en la lista (el DM decide si muere o huye); `hp` a un NPC sin `maxHp` → rechazado; la migración v11 → v12.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** `combatRules.ts`, CA DE LOS ENEMIGOS: "Al aparecer un enemigo, fijá su `maxHp` en el cambio `npc` (tabla de abajo). El daño que recibe va con `hp` y su nombre en `target`; ya no hace falta que lleves la cuenta. A 0 cae." En la escena, cada NPC hostil muestra su etiqueta (`healthLabel`) debajo del nombre, sin números.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: los enemigos tienen PG y la escena muestra cómo están"`

### Task 21: Orden de iniciativa en la escena

**Files:**
- Modify: `src/domain/types.ts` (`Scene.order`, cambio `scene` con `order`), `src/domain/schemas.ts`, `src/domain/applyChanges.ts` (`case "scene"` y `settleTurn`), `src/engine/dmPrompt.ts`, `src/game/SceneDrawer.tsx` (`sceneMembers` ordena por `order` en combate), `src/game/ScenePanel.tsx`
- Test: `tests/applyChanges.test.ts`, test de `sceneMembers` (crear `tests/sceneMembers.test.ts` si no existe)

**Interfaces:**
- Produces: `Scene { inCombat; turnOf; order: string[] }`; cambio `scene` con `order: string[]`, donde `[]` mantiene el orden actual y `inCombat: false` lo vacía.

- [ ] **Step 1: Write the failing tests**: `order: ["Goblin 1", "Lira", "Goblin 2"]` se guarda normalizado a los nombres del estado; nombres que no están en escena se descartan; un cambio con `order: []` no lo pisa; `inCombat: false` lo deja `[]`; `sceneMembers` en combate devuelve los miembros en ese orden (DM primero, los que no figuran al final).

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Prompt: "Cuando tengas todas las iniciativas, mandá `scene` con `order`: los nombres de mayor a menor. Después mandá `order: []` salvo que cambie." En la escena, durante un combate, el título dice "Orden de iniciativa" y cada miembro lleva su número.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: la escena muestra el orden de iniciativa"`

### Task 22: Sugerencias de acción

**Files:**
- Create: `src/game/Suggestions.tsx`
- Modify: `src/domain/types.ts` (`DMResponse.suggestions`, `GameState.suggestedActions`), `src/domain/schemas.ts` (después de `narration`), `src/engine/TurnEngine.ts` (`commit` guarda las sugerencias), `src/engine/dmPrompt.ts`, `src/persistence/settings.ts` (`showSuggestions`, default `true`), `src/pages/settings.astro`, `src/game/Game.tsx`, `src/game/game.css`
- Test: `tests/schemas.test.ts`, `tests/TurnEngine.test.ts`

**Interfaces:**
- Produces: `suggestions: z.array(z.string().min(1).max(60)).max(3)`; `GameState.suggestedActions: string[]` (la migración de esta fase ya lo agregó en `fromV11`).

- [ ] **Step 1: Write the failing tests**: una respuesta con 4 sugerencias es inválida; `narration` sigue siendo la primera clave de `dmResponseJsonSchema.propertyOrdering`; `commit` guarda `suggestedActions` y una respuesta con `playerRoll` las guarda vacías (cuando hay tirada pedida, no se sugieren acciones).

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Prompt: "En `suggestions`, hasta tres acciones cortas y distintas que el personaje podría hacer ahora (en primera persona, ≤ 60 caracteres: 'Interrogo al guardia'). Ninguna obvia ni que decida por él. Si pedís una tirada, mandá []." En la UI, debajo del log y arriba del cuadro de texto, chips con las sugerencias cuando `canAct`; tocar una pone el texto en el cuadro y le da foco. Se ocultan con `showSuggestions: false`.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Manual check** en un viewport de 375 px: los chips entran en el ancho sin scroll horizontal.

- [ ] **Step 6: Commit + merge**
  ```bash
  git add -A && git commit -m "feat: el DM sugiere acciones"
  git switch main && git merge --no-ff feat/combate-legible
  ```

---

## Fase 6 — Tramas (`feat/tramas`)

### Task 23: Hilos de campaña

**Files:**
- Modify: `src/domain/types.ts` (`Thread`, `GameState.threads`, cambio `thread`, `GAME_STATE_VERSION` → 13), `src/domain/schemas.ts`, `src/domain/applyChanges.ts`, `src/persistence/migrations.ts` (`fromV12`: `threads: []`), `src/engine/dmPrompt.ts`, `src/game/InfoDrawer.tsx`, `docs/partida-mock.json`
- Test: `tests/applyChanges.test.ts`, `tests/dmPrompt.test.ts`, test de migraciones

**Interfaces:**
- Produces:
  ```ts
  export interface Thread {
    title: string; kind: "goal" | "threat" | "mystery"; description: string;
    status: "open" | "resolved"; secret: boolean;
  }
  // StateChange: | { type: "thread"; title; kind; description; status; secret }
  ```

- [ ] **Step 1: Write the failing tests**: upsert por título, sin importar mayúsculas; un hilo `secret` pasa a `secret: false` cuando el DM lo revela, pero un cambio posterior con `secret: true` no lo vuelve a ocultar; la migración; el prompt contiene `HILOS` y la regla del primer turno.

- [ ] **Step 2: Run to verify they fail.**

- [ ] **Step 3: Implement.** Sección HILOS del prompt:
  - "En el primer turno creá un hilo `goal` (lo que mueve al personaje) y uno `threat` (alguien o algo que avanza en contra), este último con `secret: true`."
  - "Cada tanto, sin que el jugador lo vea, la amenaza avanza: mostrá sus consecuencias en el mundo (rumores, rastros, víctimas). Revelala (`secret: false`) cuando el jugador la descubra."
  - "Al resolver un hilo, `status: "resolved"`; resolver un `threat` o un `mystery` central justifica un `milestone`."
  En Info: sección "Hilos", solo con los `secret: false`; los resueltos, tachados.

- [ ] **Step 4: Run** — `pnpm test && pnpm check` → PASS.

- [ ] **Step 5: Commit + merge**
  ```bash
  git add -A && git commit -m "feat: hilos de campaña con amenazas que avanzan"
  git switch main && git merge --no-ff feat/tramas
  ```

---

## Backlog (fuera de este plan)

- Corregir el retrato de un NPC desde la escena (hoy el primero queda fijo).
- "Volver al último descanso": guardar una copia del estado en cada `rest long` y ofrecerla en la pantalla de fin.
- Datos de reglas para niveles 5+ (`LOADED_MAX_LEVEL = 4`); mientras tanto, avisar en el panel cuando el personaje pasa del nivel 4.
- Llevar los espacios de conjuro y los dados de golpe en el estado, con la misma lógica que los PG.
