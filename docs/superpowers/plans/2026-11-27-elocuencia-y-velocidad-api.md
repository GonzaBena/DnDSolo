# Elocuencia del DM, velocidad y costo de API — Plan de implementación

> **Para agentes/implementación:** Trabajar tarea por tarea en orden. Cada tarea incluye archivos exactos, criterios verificables y comandos de test (`pnpm test`, `pnpm check`).

**Objetivo:** Mejorar notablemente la variedad narrativa del DM en modelos rápidos/accesibles (evitando escenas "copia-pega"), reducir latencia y consumo de tokens por turno (aprovechando *prefix caching* implícito, modelo auxiliar opcional y combate en 1 llamada por ataque) y reforzar la resiliencia ante cortes o saturación de la API de Gemini.

**Arquitectura:** Cambios acotados a las capas `engine`, `llm`, `domain`, `persistence/settings` y controles ligeros en `game`/`settings`, manteniendo intacta la separación (`LLMClient`, `TurnEngine`, `applyStateChanges`) y compatibilidad retroactiva con partidas guardadas.

**Stack:** TypeScript estricto, React 19, Astro, Zod 4, Vitest (`pnpm test`), `pnpm check`.

**Referencia:** [`docs/auditoria-2026-11-27.md`](../../auditoria-2026-11-27.md) (Prioridad 1).

---

## Restricciones globales

- Identificadores y comentarios de código en inglés; textos visibles al usuario y prompts del DM en español rioplatense.
- Compatibilidad retroactiva: no romper partidas guardadas ni ajustes existentes en `localStorage` (`dnsolo.settings` sin `auxiliaryModel` o `suggestionsMode` sigue funcionando con los valores por defecto).
- `DMResponse` y `dmResponseJsonSchema` mantienen `narration` como primera propiedad para no romper el streaming parcial (`extractPartialNarration`).
- Mantener la filosofía de mesa: los dados físicos siguen siendo el flujo principal.

---

### Task 1: Reordenar `buildTurnPrompt` para *prefix caching* y acotar `turnsForPrompt`

**Motivación:** Hoy `ESTADO` (cambia cada turno) va al inicio del prompt, invalidando el caché de prefijo implícito de Gemini antes de bloques estáticos como `REGLAS DE LOS PERSONAJES`, el módulo de campaña y `REGLAS DE COMBATE`. Además, si falla el resumen (`summarizeIfDue`), `turnsForPrompt` crece sin límite y dispara el gasto de tokens.

**Archivos:**
- Modificar: `src/engine/dmPrompt.ts` (`buildTurnPrompt`, `turnsForPrompt`)
- Modificar: `tests/dmPrompt.test.ts`

- [ ] **Step 1: Definir `MAX_UNSUMMARIZED_TURNS` (ej. `16`) y reordenar secciones en `buildTurnPrompt`**
  Orden nuevo en `buildTurnPrompt`:
  1. Bloques estáticos/semi-estáticos de sesión:
     - `REGLAS DE LOS PERSONAJES`
     - `campaignBlock` (si existe)
     - `REGLAS DE COMBATE` (si `state.scene.inCombat`)
  2. Bloques dinámicos:
     - `RESUMEN`
     - `ESTADO`
     - `TURNOS RECIENTES`
     - `FRASES GASTADAS` (si hay)
     - `TIRADA PEDIDA AL JUGADOR` (si aplica)
     - `LÍMITE DE TIRADAS` (si `!options.enemyRollsAllowed`)
     - `TURNO ACTUAL`
  En `turnsForPrompt(state, recentTurns)`: acotar el tope superior a `Math.min(MAX_UNSUMMARIZED_TURNS, Math.max(recentTurns, unsummarized))` para que un fallo prolongado en `summarizeIfDue` nunca mande 50+ turnos crudos.

- [ ] **Step 2: Agregar/actualizar tests en `tests/dmPrompt.test.ts`**
  - Verificar que las secciones estáticas (`REGLAS DE LOS PERSONAJES`, bloque de campaña y `REGLAS DE COMBATE`) aparecen antes que `ESTADO` y `TURNOS RECIENTES`.
  - Verificar que `turnsForPrompt` respeta `recentTurns` normalmente y no supera `MAX_UNSUMMARIZED_TURNS` cuando `summarizedThroughTurn` queda muy atrás.
  - Verificar que `LÍMITE DE TIRADAS` sigue justo antes de `TURNO ACTUAL`.

- [ ] **Step 3: Ejecutar tests**
  `pnpm vitest run tests/dmPrompt.test.ts` → PASS.

---

### Task 2: Elocuencia adaptativa en `DM_SYSTEM_PROMPT` y calibración en `thinking.ts`

**Motivación:** Exigir 90–190 palabras con detalles sensoriales, manías de NPCs y comentario atmosférico en *cada* turno convierte a los modelos rápidos en una plantilla repetitiva, reforzada por el reenvío constante de `location.description` en `ESTADO`.

**Archivos:**
- Modificar: `src/engine/dmPrompt.ts` (`DM_SYSTEM_PROMPT`, `stateForModel`)
- Modificar: `src/llm/thinking.ts` (`CREATIVE_TEMPERATURE`)
- Modificar: `tests/dmPrompt.test.ts`, `tests/thinking.test.ts`

- [ ] **Step 1: Actualizar `CÓMO NARRAR` en `DM_SYSTEM_PROMPT`**
  - Reemplazar la regla fija de longitud y checklist sensorial único por **ritmo según el momento**:
    - **Escena nueva o cambio de lugar:** 100–170 palabras con anclaje sensorial concreto (luz, clima, olor, sonido).
    - **Continuación en el mismo lugar / diálogo ágil / combate:** 45–110 palabras enfocadas en la acción, la reacción del entorno y lo que cambia ahora.
  - Agregar regla explícita **NO REPITAS EL DECORADO**: la `description` de `location` y de los NPCs presentes en `ESTADO` es memoria de referencia; si el personaje sigue en el mismo lugar, no vuelvas a describir lo que ya se vio salvo que algo cambie.
  - Agregar regla de **variación de arranque**: alternar entre empezar por impacto físico, línea directa de un NPC (`[[Nombre]]`), detalle puntual del entorno o consecuencia táctica; nunca encadenar dos turnos con la misma apertura ni cerrar siempre con la misma muletilla de pregunta.

- [ ] **Step 2: Evitar saturación por `temperature` en `src/llm/thinking.ts`**
  - Ajustar `CREATIVE_TEMPERATURE` de `1.2` a `1.05` (mantiene variedad léxica sin volver errática o artificial la prosa en Gemini 2.5 Flash con `thinkingBudget: 0`).

- [ ] **Step 3: Actualizar y correr tests**
  - Ajustar expectativa de `temperature` en `tests/thinking.test.ts` (`1.05`) y agregar aserciones clave del nuevo bloque de ritmo en `tests/dmPrompt.test.ts`.
  - Ejecutar `pnpm vitest run tests/dmPrompt.test.ts tests/thinking.test.ts` → PASS.

---

### Task 3: Timeout de red/stream y reintento ante errores transitorios

**Motivación:** Hoy un stream que deja de emitir datos o un error transitorio (`429` / `503` / red) falla de golpe o deja esperando indefinidamente al jugador.

**Archivos:**
- Modificar: `src/llm/LLMClient.ts` (agregar `kind: "timeout"` o mapear en `"network"` — evaluar si conviene distinguir mensaje al usuario en `errorMessages.ts`)
- Modificar: `src/llm/GeminiClient.ts`
- Modificar: `src/llm/errorMessages.ts`
- Modificar: `src/engine/TurnEngine.ts`
- Modificar: `tests/GeminiClient.test.ts`, `tests/TurnEngine.test.ts`

- [ ] **Step 1: Timeout inicial e inactividad de stream en `GeminiClient`**
  - En `generateStructured`: aplicar timeout de respuesta inicial (ej. 25 s) y timeout entre chunks SSE (ej. 15 s) usando un `AbortController` interno enlazado al `request.signal` del usuario. Si vence el timer interno (sin aborto del jugador), lanzar `LLMError("network", ...)` (o `"timeout"` con mensaje claro en `errorMessages.ts`).
  - En `generateText`: timeout de 20 s enlazado a `request.signal`.
  - Limpiar siempre los timers en `finally`.

- [ ] **Step 2: Backoff breve ante fallos transitorios en `TurnEngine.playTurn`**
  - Si `generateStructured` falla con `rate_limit` (`429`) o `network` *antes* de haber emitido narración útil (o en el primer intento) y `!signal?.aborted`, esperar un backoff corto (ej. 1200 ms cancelable por `signal`) y reintentar una vez antes de devolver `failure`.
  - No reintentar jamás `auth` ni `aborted`.

- [ ] **Step 3: Tests con timers falsos / fetch simulado**
  - `tests/GeminiClient.test.ts`: stream que nunca emite chunks dispara error de timeout y limpia el timer; aborto del usuario sigue devolviendo `"aborted"`.
  - `tests/TurnEngine.test.ts`: `FakeLLMClient` lanza `rate_limit` una vez y luego responde válido → `playTurn` resuelve `ok: true`; si `signal` aborta durante el backoff → devuelve `aborted`.
  - Ejecutar `pnpm vitest run tests/GeminiClient.test.ts tests/TurnEngine.test.ts` → PASS.

---

### Task 4: Modelo auxiliar opcional y sugerencias bajo demanda

**Motivación:** El jugador puede querer mejor elocuencia para narrar (sin apagar thinking o usando un modelo mejor) sin gastar esa cuota en resúmenes automáticos (`summarizeIfDue`) ni sugerencias (`suggestFor`). Además, generar sugerencias en cada turno gasta tokens de salida incluso cuando no se usan.

**Archivos:**
- Modificar: `src/persistence/settings.ts` (`Settings` + `loadSettings` retrocompatible)
- Modificar: `src/pages/settings.astro` y `src/settings/apiSection.ts`
- Modificar: `src/engine/TurnEngine.ts` (aceptar `auxiliaryLlm?: LLMClient` opcional en `EngineDeps` para `summarizeIfDue` y `suggestFor`)
- Modificar: `src/game/useGameSession.ts`
- Modificar: `src/game/Composer.tsx`, `src/game/Suggestions.tsx` y `src/game/Game.tsx`
- Tests: `tests/settings.test.ts`, `tests/TurnEngine.test.ts`, `tests/suggestions.test.ts`

- [ ] **Step 1: Extender `Settings` de forma retrocompatible**
  - Agregar campos opcionales con fallback seguro en `loadSettings`:
    - `auxiliaryModel: string` (`""` = usar el mismo modelo principal).
    - `suggestionsMode: "auto" | "on_demand" | "off"` (migrar en lectura desde `showSuggestions: boolean` → `"auto"` / `"off"` para no romper settings guardados).

- [ ] **Step 2: UI en `/settings`**
  - Agregar selector opcional *"Modelo para resúmenes y tareas rápidas"* (opción por defecto: *"El mismo que el principal"*).
  - Cambiar el switch *"Sugerencias de acción"* a un selector compacto de 3 modos (`Siempre`, `Solo al pedirlas`, `Desactivadas`), o mantener switch + opción secundaria clara.

- [ ] **Step 3: Cablear `auxiliaryLlm` en `TurnEngine` y `useGameSession`**
  - `EngineDeps.auxiliaryLlm?: LLMClient` (por defecto `deps.llm`).
  - `summarizeIfDue` y `suggestFor` usan `this.auxiliaryLlm`.
  - En `suggestionsMode === "on_demand"`: `config.suggestions = false` durante turnos normales (usa `dmResponseJsonSchemaNoSuggestions`) y en el `Composer` aparece un botón discreto *"¿Ideas?"* que llama a `engine.suggestFor(state)` y muestra los chips cuando el jugador los pide.

- [ ] **Step 4: Tests**
  - `tests/settings.test.ts`: settings viejos con `showSuggestions: false` o sin `auxiliaryModel` cargan correctamente.
  - `tests/TurnEngine.test.ts`: cuando se pasa `auxiliaryLlm`, `summarizeIfDue` y `suggestFor` llaman a `auxiliaryLlm` y `playTurn` llama a `llm`.
  - Ejecutar `pnpm vitest run tests/settings.test.ts tests/TurnEngine.test.ts` → PASS.

---

### Task 5: Combate ágil en 1 llamada por ataque (Ataque + Daño juntos)

**Motivación:** Según `src/engine/combatRules.ts`, cada ataque del jugador requiere 2 turnos completos de LLM (tirada de ataque → respuesta → tirada de daño → respuesta). Combinar ataque y daño en un mismo envío reduce a la mitad las llamadas de API y la espera en combate.

**Archivos:**
- Modificar: `src/domain/types.ts` (`PlayerRollRequest`, `PlayerRoll`)
- Modificar: `src/domain/schemas.ts`
- Modificar: `src/engine/combatRules.ts`, `src/engine/dmPrompt.ts`
- Modificar: `src/game/RollDialog.tsx`, `src/game/TurnLog.tsx`, `src/game/Game.tsx`
- Tests: `tests/schemas.test.ts`, `tests/dmPrompt.test.ts`, `tests/TurnEngine.test.ts`

- [ ] **Step 1: Extender `PlayerRoll` y `PlayerRollRequest` (opcional)**
  - En `PlayerRollRequest`: campo opcional `damage?: { die: Die; count: number; reason: string } | null` (cuando el DM pide una tirada de ataque con arma o conjuro).
  - En `PlayerRoll`: campo opcional `damage?: { die: Die; count: number; value: number; modifier: number } | undefined`.
  - Actualizar `gameStateSchema` y `dmResponseSchema` manteniendo compatibilidad total con turnos/saves previos (todos los campos nuevos son opcionales / nullable).

- [ ] **Step 2: Actualizar `COMBAT_RULES` y `describeInput`**
  - En `src/engine/combatRules.ts`: indicar que cuando el jugador ataca, el DM puede pedir el ataque en `playerRoll` incluyendo `damage` (dado y cantidad base del arma/conjuro) para resolver impacto y daño en un solo turno. Si el ataque falla la CA, el daño enviado se ignora y se narra el fallo; si es 20 natural, en la narración/cálculo se aplica el crítico (o se pide el daño extra).
  - En `describeInput`: formatear ambos valores cuando `input.roll.damage` viene presente (ej. `Ataque: 1d20 + 5 = 18 | Daño si impacta: 1d8 + 3 = 9`).

- [ ] **Step 3: Soportar sección opcional de daño en `RollDialog.tsx` y `TurnLog.tsx`**
  - Si `request?.damage` viene presente (o si el jugador activa un check *"Incluir daño"* al hacer una tirada manual de ataque), `RollDialog` muestra debajo una fila compacta para el dado de daño + modificador de daño.
  - En `PlayerRollCard` (`src/game/TurnLog.tsx`), mostrar también el subtotal de daño debajo cuando exista.

- [ ] **Step 4: Tests**
  - Validar `parseDMResponse` y `gameStateSchema` con y sin `damage`.
  - Verificar `describeInput` con `roll.damage`.
  - Ejecutar `pnpm vitest run tests/schemas.test.ts tests/dmPrompt.test.ts tests/TurnEngine.test.ts` → PASS.

---

### Task 6: Saltar animación de Typewriter con clic/tap

**Motivación:** `createTypewriter` en `src/game/typewriter.ts` retiene `beforeCommit` hasta 8 segundos tras recibir la respuesta completa. Permitir revelar todo al instante al tocar/clicar la narración en vuelo mejora mucho la sensación de velocidad para lectores rápidos.

**Archivos:**
- Modificar: `src/game/typewriter.ts` (agregar `flush(): void`)
- Modificar: `src/game/useSendTurn.ts` (exponer `flushNarration` o callback de tap en el bloque `inFlight`)
- Modificar: `src/game/Game.tsx`
- Tests: `tests/typewriter.test.ts`

- [ ] **Step 1: Agregar `flush()` en `createTypewriter`**
  - Llama al mismo `revealAll()` interno que ya usa `visibilitychange`, cancelando el `requestAnimationFrame` pendiente, emitiendo `onReveal(target)` y resolviendo los `waiters` de `finish()`.

- [ ] **Step 2: Permitir clic/tap en el turno `inFlight` en `Game.tsx`**
  - Si `busy` y `inFlight.narration !== ""`, un clic/tap sobre el contenedor de la narración en vuelo invoca `flush()` (sin interferir con selección de texto si el usuario está seleccionando).

- [ ] **Step 3: Test y verificación global**
  - Test en `tests/typewriter.test.ts`: `setTarget("hola mundo")` + `flush()` revela todo inmediatamente y resuelve `finish()`.
  - Ejecutar verificación completa del proyecto: `pnpm test && pnpm check && pnpm build`.
