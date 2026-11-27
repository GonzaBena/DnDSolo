# Auditoría integral de DungeonSolo — 2026-11-27

Revisión de la aplicación sobre `main` (`ed276c2`) en cuatro ejes: **optimización y rendimiento**, **UI/UX**, **jugabilidad y elocuencia del DM**, y **decisiones de diseño** para la siguiente etapa.

> Nota de verificación: `pnpm check` ejecutado el 2026-11-27 dio **0 errores**, **0 advertencias** y **4 hints** menores. Los tamaños de bundle citados corresponden a `dist/client/_astro/` en esa fecha.

---

## Estado actual: lo que está bien resuelto

- **Arquitectura desacoplada por interfaces:** `LLMClient`, `GameRepo`, `RemoteGameStore` y `DriveAuth` separan el motor de turnos (`src/engine/TurnEngine.ts`) de Gemini, IndexedDB y Google Drive.
- **El modelo narra, el código arbitra:** esquema estructurado en Zod (`src/domain/schemas.ts`) con `narration` primero + `propertyOrdering` para streaming en vivo (`src/engine/narrationStream.ts`), tiradas de enemigos y salvaciones de muerte resueltas en código (`src/domain/applyChanges.ts`), y validación de fichas SRD 5.2.1 (`src/rules/`).
- **Seguridad y privacidad:** BYOK en `localStorage`, CSP estricto en `astro.config.mjs`, sync opcional en `appDataFolder` con refresh token cifrado en cookie HttpOnly (`src/server/seal.ts`).
- **Accesibilidad y cuidado visual:** `<dialog>` nativos, región `aria-live` desacoplada del typewriter (`src/game/announcement.ts`), soporte de `prefers-reduced-motion`, tokens unificados claro/oscuro (`src/styles/tokens.css`).

---

## Prioridades acordadas

1. **Prioridad 1 — Prompt, Elocuencia y Velocidad/Costo de API** → Plan detallado en [`docs/superpowers/plans/2026-11-27-elocuencia-y-velocidad-api.md`](superpowers/plans/2026-11-27-elocuencia-y-velocidad-api.md).
2. **Prioridad 2 — Profundidad mecánica, carga rápida SRD y escudo anti-exploits en `Fuera del SRD`**.
3. **Prioridad 3 — Mejoras de UI/UX y optimización de persistencia/DOM en `/play`**.

---

## 1. Optimización y rendimiento

### IA, latencia y consumo de tokens
- **Orden de `buildTurnPrompt` rompe el *prefix caching* implícito (`src/engine/dmPrompt.ts`):** hoy `ESTADO` (cambia en casi todos los turnos) va antes de `REGLAS DE LOS PERSONAJES`, `campaignBlock` y `COMBAT_RULES`. Poner los bloques estáticos/semi-estáticos al principio y los dinámicos al final permite aprovechar el caché de prefijo de Gemini.
- **Sin timeout ni detección de streams colgados en `GeminiClient` (`src/llm/GeminiClient.ts`):** `fetch` y el bucle `sseEvents` no tienen límite de tiempo ni de inactividad entre chunks; si la conexión se queda colgada, el usuario queda bloqueado hasta abortar a mano.
- **Sin backoff ante errores transitorios (`src/engine/TurnEngine.ts`):** `playTurn` reintenta una vez si el JSON es inválido, pero no reintenta ante errores temporales (`429`, `503` o fallos de red).
- **Ventana sin techo en `turnsForPrompt` (`src/engine/dmPrompt.ts`):** `Math.max(recentTurns, unsummarized)` envía todos los turnos crudos acumulados si `summarizeIfDue` falla repetidamente, disparando el consumo de tokens en campañas largas.
- **Un único modelo para todo (`src/persistence/settings.ts`):** tanto la narración creativa como tareas mecánicas (`summarizeIfDue`, `suggestFor`, paso 2 de `generateOptions`) usan el mismo modelo. Separar un modelo auxiliar liviano abarata cuota y acelera tareas secundarias.
- **Sugerencias en cada turno (`src/domain/schemas.ts`, `src/engine/dmPrompt.ts`):** cuando están activas, generan tokens de salida extra en todos los turnos aunque el jugador ya sepa qué va a escribir.

### Persistencia, renderizado y assets
- **Validación completa de Zod al listar partidas (`src/persistence/IndexedDBGameRepo.ts`, `src/persistence/migrations.ts`):** `repo.list()` recorre todas las partidas en IndexedDB y ejecuta `migrateSave` (`gameStateSchema.safeParse`, incluyendo todo el array `turns`) solo para mostrar los resúmenes de portada en `/`. Separar un índice ligero de metadatos (o validar `turns` recién al abrir `/play`) acelera la portada a medida que crecen las campañas.
- **Historial sin ventana en el DOM (`src/game/TurnLog.tsx`):** renderiza todos los turnos desde el turno 1. En partidas largas conviene mostrar los últimos ~25 turnos con un botón *"Ver turnos anteriores"*.
- **Re-parseo durante el typewriter (`src/game/Game.tsx`, `src/game/typewriter.ts`):** cada tick vuelve a correr `splitDialogue` + `parseInline` sobre toda la narración en vuelo, y `finish()` retiene `beforeCommit` hasta `MAX_LAG_SECONDS = 8` s sin opción de revelar el texto al instante con un clic/tap.
- **Carga ansiosa de audio (`src/audio/sound.ts`):** al primer toque en `/play` descarga y decodifica en paralelo los 10 MP3 (`240 KB` en `public/sounds/`). Conviene priorizar los frecuentes (`dice`, `hit`, `chapter`) y cargar bajo demanda los poco frecuentes (`gameOver`, `levelUp`, `questDone`, `ambush`).
- **Bundles de producción (`dist/client/_astro/`):** `client` (~205 KB), `rules` (~144 KB), `Game` (~103 KB), `schemas` (~101 KB), `motion` (~42 KB). Además quedaron archivos residuales de compilaciones viejas en `dist/client/` (como `companion/` y `CompanionApp.*.js`, inexistentes en `src/pages/`) — conviene limpiar `dist/` en el script de build.
- **Higiene menor:**
  - `pnpm check` reporta 4 hints: `PortraitId` sin usar en `src/domain/types.ts:5`, `useEffect` sin usar en `src/game/TurnLog.tsx:1`, y dos funciones convertibles a `async` (`src/sync/SyncEngine.ts:118`, `src/sync/openGame.ts:36`).
  - `README.md` todavía menciona que la fase 1 cubre niveles 1 a 4, cuando `LOADED_MAX_LEVEL` en `src/rules/index.ts:24` ya es `10`.

---

## 2. UI / UX

- **Ficha completa oculta durante la partida (`src/game/CharacterPanel.tsx`, `src/game/InfoDrawer.tsx`):** `buildSheet` y `formatSheetText` calculan la ficha completa en `/generator` y `SheetUpgrade`, pero en `/play` solo se muestran nombre, raza, clase, nivel, PG, CA y trasfondo. Aunque la filosofía principal es tener la hoja física al lado, contar con una vista de consulta rápida read-only en `InfoDrawer` evita quedar ciego si se juega fuera de casa.
- **Brecha entre formulario manual y generador (`src/character/CharacterForm.tsx`):** el flujo manual rápido deja `inventory: []`, `choices: null`, `attacks: []` y `spellSaveDc: null`, y el selector *"Trasfondo (reglas)"* no impacta mecánicamente si no se pasó por `/generator`. Un aviso temprano si falta la API key (sin esperar a redirigir en `/play`) también reduce fricción.
- **Selector de modelos en `/settings` (`src/settings/apiSection.ts`):** lista todos los modelos `generateContent` alfabéticamente sin orientar sobre velocidad/cuota (Flash vs Pro) ni diferenciar modelo narrador de auxiliar.
- **Recuperación de errores del DM (`src/game/Game.tsx`):** hoy solo se pueden ajustar PG o renombrar NPCs; no existe acción para **deshacer o regenerar el último turno** ni edición manual simple de inventario/ubicación/combate si el DM se desincroniza.
- **Avatares en móvil (`src/game/styles/log.css`):** por debajo de `34rem` se oculta `.message--npc .avatar`, perdiendo la identificación visual rápida en escenas con varios NPCs. Un mini avatar inline junto al nombre mantendría la claridad sin quitar ancho al texto.

---

## 3. Jugabilidad y Elocuencia del DM

### Por qué las escenas se sienten repetitivas ("copia-pega")
- **Plantilla rígida en `DM_SYSTEM_PROMPT` (`src/engine/dmPrompt.ts`):** exigir en *todos* los turnos 90–190 palabras con detalles sensoriales (luz, olor, temperatura, ruidos), lenguaje corporal de NPCs, comentario de tensión y cierre abierto hace que los modelos chicos/rápidos (en especial Flash con `thinkingBudget: 0`) sigan exactamente el mismo molde turno tras turno.
- **Re-descripción de lo estático:** `stateForModel` reenvía en cada turno `location.description` y las descripciones de los NPCs presentes. Sin una regla explícita de *no repetir la ambientación ya establecida mientras no cambie de lugar*, el modelo recicla esas mismas imágenes.
- **Temperatura en modelos rápidos (`src/llm/thinking.ts`):** `CREATIVE_TEMPERATURE = 1.2` en 2.5 con pensamiento desactivado puede producir prosa reiterativa o fórmulas artificiales; conviene calibrar temperatura y reforzar variación de apertura y longitud según tipo de escena.

### Profundidad mecánica y abuso de `Fuera del SRD`
- **Falta de contexto mecánico en personajes manuales:** cuando el jugador entra rápido por `/character` sin pasar por `/generator`, el DM no tiene ataques, CD de conjuros ni equipo inicial, y tiene que preguntarlos en texto. Una **plantilla rápida SRD por defecto (1 clic)** al elegir Especie + Clase + Trasfondo + Nivel resolvería el arranque en < 30 segundos con ficha legal completa.
- **Superficie de exploits en `outsideSrd.note` (`src/engine/rulesBlock.ts`, `src/domain/outsideSrd.ts`):** el texto libre del usuario llega al DM con la instrucción *"aplicalo con lo que sepas del Player's Handbook 2024"*, sin restricción explícita contra objetos mágicos inventados, bonificadores arbitrarios o equipo fuera de tier de nivel (ej. armadura de mithril regenerativa a nivel 1).
- **Subclases y opciones populares fuera del SRD:** ofrecer un catálogo de *nombres* oficiales conocidos (PHB/manuales) como referencia rápida evita que el usuario tenga que tipear descripciones largas y reduce alucinaciones de reglas.
- **Tracking de recursos, conjuros y condiciones:** `src/rules/data/classes/` ya define `resources` y espacios de conjuro, pero `Character` (`src/domain/types.ts`) no guarda slots gastados, usos de rasgos, dados de golpe ni condiciones de combate (Concentración, Derribado, Envenenado, etc.), y `rest: "short"` en `applyChanges.ts` es un no-op.
- **Combate lento y costoso en llamadas (`src/engine/combatRules.ts`):** cada ataque del jugador consume 2 turnos de LLM (ataque → respuesta → daño → respuesta) más los turnos de `enemyRolls`. Permitir **Ataque + Daño en una sola tirada** reduce a la mitad las llamadas de API y agiliza las peleas.
- **Dado virtual opcional (`src/game/RollDialog.tsx`):** mantener la carga manual de dados físicos como flujo principal (fiel al espíritu de mesa), agregando un botón discreto opcional *"Tirar acá"* para cuando el jugador no tiene dados encima.
