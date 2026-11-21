# NPCs con voz propia y retratos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la partida se sienta como una mesa con varias personas: los NPCs hablan con su propia voz en burbujas propias y, en pantallas medianas/grandes, aparecen en un panel lateral con retrato que se agranda y oscila como un péndulo mientras hablan.

**Architecture:** Fase A (tareas 1–4): el DM sigue siendo una sola llamada, pero marca cada línea de diálogo de un NPC con `[[Nombre]]` al inicio del párrafo dentro de `narration`. Como el marcador viaja dentro del mismo string, el streaming y el typewriter actuales no cambian. Un parser puro (`splitDialogue`) separa la narración en segmentos por hablante al renderizar. Cada NPC suma un campo `voice` (cómo habla) y el prompt los empuja a intervenir por su cuenta. Fase B (tareas 5–8): retratos por arquetipo (lista cerrada de ids, el DM elige uno por NPC), avatar en las burbujas, panel lateral de escena y la animación del que habla.

**Tech Stack:** Astro 7, React 19, TypeScript estricto, Zod 4, Vitest 5, animejs 4, Gemini vía `LLMClient`.

**Spec:** no hay documento aparte. Las decisiones salen de la charla del 2026-11-20 y están en "Decisiones" abajo.

**Fuera de alcance (fase futura):** una llamada al LLM por NPC (agentes con conocimiento propio). El formato `[[Nombre]]` y `voice` de este plan sirven igual para esa fase.

## Decisiones

- El marcador de diálogo es `[[Nombre]]` al **inicio de un párrafo** de `narration`. Todo el párrafo es de ese NPC (habla + gestos breves). Si el marcador no está al inicio de un párrafo, es texto común.
- Los turnos viejos sin marcadores se ven exactamente igual que hoy. Los turnos no se migran.
- `voice`: string corto con tono, muletillas y forma de hablar. Si el DM manda `""` en un cambio `npc`, se conserva la voz anterior.
- Retratos: ids en inglés, en una lista cerrada que el esquema le pasa al modelo como `enum`. Las imágenes van en `public/portraits/<carpeta>/<n>.webp`; la variante sale de un hash del nombre del NPC. Si un NPC no tiene retrato (`portrait: null`), se muestran sus iniciales.
- Animación del que habla: el retrato escala a 1.1 y rota de ±3° con pivote arriba al centro (`transform-origin: top center`), en un ciclo de ~1.6 s con ease-in-out. Al terminar vuelve a 0° de forma suave. Con `prefers-reduced-motion` solo escala.
- El panel lateral solo se muestra desde `min-width: 64rem`. Por debajo de ese ancho no cambia nada.

## Global Constraints

- Identificadores y comentarios de código en inglés; el texto de la UI y los prompts, en español rioplatense.
- Solo React para componentes nuevos (nada de Svelte).
- Cada cambio de forma del guardado sube `GAME_STATE_VERSION` y suma un `fromVN` en `src/persistence/migrations.ts`, y `gameStateSchema` se mantiene en espejo de `GameState` (los chequeos de tipos de `schemas.ts` lo hacen cumplir).
- Verificación de cada tarea: `pnpm test` y `pnpm check` en verde.
- Los cambios de estado los propone el modelo y los decide `applyStateChanges`; nada de la UI modifica el estado.

## Review Focus

1. **Marcador a medio llegar durante el streaming** (`"[[Bre"`, `"[[Brena"` sin `]]`): no tiene que aparecer el texto crudo con corchetes. Se oculta hasta que cierre. → test en Tarea 1.
2. **El modelo marca al personaje del jugador** (`[[Lira]] ...`): no se le pone burbuja de NPC, se muestra como narración del DM. → test en Tarea 1.
3. **Nombre del marcador con otra capitalización o espacios** (`[[ brena ]]` cuando el NPC es "Brena"): se resuelve al NPC (para retrato y panel), con el nombre tal como figura en el estado. → tests en Tareas 1 y 8.
4. **Reintento del turno** (`onNarration("")`): el que habla vuelve a `null` y el péndulo se detiene. → test en Tarea 8 (`speakingNow("")`).
5. **Partidas guardadas viejas** (v5) y el mock en `docs/`: cargan con `voice: ""` y `portrait: null`. → tests en Tareas 2 y 5.

---

## Fase A — Diálogo estructurado y NPCs con voz

### Task 1: Parser de diálogo `splitDialogue`

**Files:**
- Create: `src/domain/dialogue.ts`
- Test: `tests/dialogue.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DialogueSegment {
    /** null = narración del DM; si no, el nombre del NPC (como figura en el estado si coincide). */
    speaker: string | null;
    paragraphs: string[];
  }
  export function splitDialogue(narration: string, cast: Cast): DialogueSegment[];
  /** Quién está hablando al final de un texto que todavía llega (el último segmento), o null si es el DM. */
  export function speakingNow(narration: string, cast: Cast): string | null;
  export interface Cast { npcs: Npc[]; playerNames: string[] }
  /** Sin distinguir mayúsculas ni espacios. */
  export function findNpc(npcs: Npc[], name: string): Npc | undefined;
  ```

- [ ] **Step 1: Write the failing tests** in `tests/dialogue.test.ts`, con `cast = { npcs: [npc("Brena"), npc("Goblin 1")], playerNames: ["Lira"] }` (`npc(name)` es un helper local que arma un `Npc` con valores por defecto):
  - `splitDialogue("La puerta cruje.\nHuele a humo.", cast)` → `[{ speaker: null, paragraphs: ["La puerta cruje.", "Huele a humo."] }]`
  - `splitDialogue("Entra alguien.\n[[Brena]] —¿Quién te manda?\nSilencio.", cast)` → tres segmentos: DM `["Entra alguien."]`, Brena `["—¿Quién te manda?"]`, DM `["Silencio."]`
  - Dos párrafos seguidos del mismo NPC se juntan en un segmento: `"[[Brena]] Uno.\n[[Brena]] Dos."` → `[{ speaker: "Brena", paragraphs: ["Uno.", "Dos."] }]`
  - Normalización: `"[[ brena ]] Hola."` → `speaker: "Brena"`. Si el nombre no está en el elenco (`"[[Tabernero]] Hola."`), `speaker: "Tabernero"` recortado.
  - Jugador: `"[[Lira]] Digo que sí."` → `{ speaker: null, paragraphs: ["Digo que sí."] }` (sin el marcador).
  - Marcador sin cerrar al final: `"Entra alguien.\n[[Bre"` → `[{ speaker: null, paragraphs: ["Entra alguien."] }]`. `"[[Brena"` solo → `[]`.
  - Marcador cerrado sin texto todavía: `"[[Brena]]"` → `[{ speaker: "Brena", paragraphs: [] }]`.
  - Marcador en el medio de un párrafo: `"Dice [[Brena]] algo."` → DM, texto literal.
  - `""` → `[]`.
  - `findNpc(cast.npcs, " brena ")` devuelve Brena; `findNpc([], "X")` → `undefined`.
  - `speakingNow("Entra.\n[[Brena]] —Ho", cast)` → `"Brena"`; `speakingNow("[[Brena]] Hola.\nElla se va.", cast)` → `null`; `speakingNow("", cast)` → `null`.

- [ ] **Step 2: Run** `pnpm vitest run tests/dialogue.test.ts` — Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implement** `splitDialogue`, `speakingNow` y `findNpc` en `src/domain/dialogue.ts`. Separar por `/\n+/`, descartar los párrafos vacíos, y reconocer el marcador con `/^\s*\[\[([^\]]+)\]\]\s*/`. Un párrafo que empieza con `[[` pero todavía no tiene `]]` se descarta (es un marcador incompleto). Para comparar nombres, usar el mismo criterio que `sameName` en `applyChanges.ts` (trim + lowercase).

- [ ] **Step 4: Run** `pnpm vitest run tests/dialogue.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: separar la narración en segmentos por hablante"`

### Task 2: Campo `voice` en los NPCs (estado v6)

**Files:**
- Modify: `src/domain/types.ts` (`Npc`, `StateChange` npc, `GAME_STATE_VERSION = 6`)
- Modify: `src/domain/schemas.ts` (cambio `npc` y `gameStateSchema.npcs`)
- Modify: `src/domain/applyChanges.ts` (caso `"npc"`)
- Modify: `src/persistence/migrations.ts` (`fromV5`)
- Test: `tests/applyChanges.test.ts`, `tests/characterIds.test.ts` (o el archivo que ya prueba `migrateSave`), `tests/mockGame.test.ts`

**Interfaces:**
- Produces: `Npc.voice: string`; `StateChange` `{ type: "npc"; name; description; attitude; present; voice: string }`.

- [ ] **Step 1: Write the failing tests**
  - applyChanges: un cambio `npc` nuevo con `voice: "Seca, habla en frases cortas"` → el NPC queda con esa voz.
  - applyChanges: si un NPC ya tiene voz y llega otro cambio `npc` con `voice: ""`, la voz anterior se conserva.
  - migrations: un guardado v5 con `npcs: [{ name, description, attitude, present }]` → `migrateSave` devuelve `version: 6` y `npcs[0].voice === ""`.
  - mockGame: el test existente sigue en verde (el mock es v3 y pasa por la cadena de migraciones).
- [ ] **Step 2: Run** `pnpm test` — Expected: FAIL en los tests nuevos.
- [ ] **Step 3: Implement**: `voice: z.string()` en el cambio `npc` (obligatorio, para que Gemini lo genere siempre) y en `gameStateSchema`. En `applyChanges`, `voice: change.voice.trim() || existing?.voice || ""`. `fromV5` agrega `voice: ""` a cada NPC.
- [ ] **Step 4: Run** `pnpm test && pnpm check` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: los NPCs guardan cómo hablan"`

### Task 3: Prompt del DM — formato de diálogo y NPCs que se meten en la charla

**Files:**
- Modify: `src/engine/dmPrompt.ts` (`DM_SYSTEM_PROMPT`)
- Test: `tests/dmPrompt.test.ts` (crear)

**Interfaces:**
- Consumes: el formato `[[Nombre]]` de la Task 1 y `voice` de la Task 2.

- [ ] **Step 1: Write the failing test**: `DM_SYSTEM_PROMPT` contiene `"[[Nombre]]"` y `"voice"`, y `buildTurnPrompt(newGame(), { type: "start" }, 6)` incluye `"voice"` dentro del bloque ESTADO cuando hay un NPC con voz.
- [ ] **Step 2: Run** `pnpm vitest run tests/dmPrompt.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**: agregar al prompt una sección `DIÁLOGO DE LOS NPCS` (texto fijo, en español) con estas reglas:
  - Cada vez que un NPC habla, su línea va en un párrafo propio que empieza con `[[Nombre]]`, usando el nombre exacto del ESTADO. Ese párrafo incluye lo que dice y, como mucho, un gesto breve. La narración del entorno va en párrafos sin marcador.
  - Nunca se marca al personaje del jugador ni se habla por él.
  - Los NPCs presentes intervienen por su cuenta: interrumpen, opinan, discuten entre ellos y le hablan directo al jugador. Como mucho 2 intervenciones espontáneas por turno.
  - Cada NPC habla según su `voice`. Al crear un NPC que habla, hay que completar `voice` con su tono, muletillas y registro. En cambios posteriores puede ir `""` si no cambia.
  - En "MUNDO VIVO", agregar que los NPCs persiguen sus propios objetivos en la conversación.
- [ ] **Step 4: Run** `pnpm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: el DM marca el diálogo de los NPCs y les da más voz"`

### Task 4: Burbujas de diálogo en el log

**Files:**
- Modify: `src/game/TurnLog.tsx` (`Narration`, `TurnLog`)
- Modify: `src/game/Game.tsx` (pasar el elenco a `Narration` en vuelo)
- Modify: `src/game/game.css` (`.message--npc`)
- Modify: `docs/partida-mock.json` (un turno con diálogo marcado, para probar a mano)

**Interfaces:**
- Consumes: `splitDialogue` (Task 1).
- Produces: `Narration({ text, cast, animated })` con `cast: Cast`; `castOf(state: GameState): Cast` en `src/domain/dialogue.ts`.

- [ ] **Step 1: Write the failing test**: en `tests/dialogue.test.ts`, `castOf(newGame())` → `{ npcs: [], playerNames: ["Lira"] }`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**:
  - `castOf` en `dialogue.ts`.
  - `Narration` recorre `splitDialogue(text, cast)`. Un segmento del DM se renderiza como ahora (`message message--dm`). Un segmento de NPC va como `message message--npc`: `<Speaker name={speaker}>` a la izquierda, el nombre visible arriba de la burbuja y los párrafos adentro. Las keys son `${segmentIndex}-${paragraphIndex}`, para que en el streaming solo anime el párrafo nuevo.
  - Los segmentos sin párrafos (marcador recién cerrado) muestran solo el nombre.
  - Burbuja `.message--npc` a la izquierda, con su color pastel según la actitud: rojo pastel para hostile, verde pastel para friendly y azul pastel para neutral. Tokens nuevos `--color-npc-hostile`, `--color-npc-friendly` y `--color-npc-neutral` en `tokens.css`, con una variante para modo oscuro. Si el NPC no está en el estado, usa neutral. `Narration` busca la actitud con `findNpc`.
  - En `docs/partida-mock.json`, reescribir la narración de un turno con un NPC para que tenga 1–2 párrafos `[[Nombre]]` con un nombre que exista en su `npcs`.
- [ ] **Step 4: Verificar**: `pnpm test && pnpm check` en verde. Después `pnpm dev`, cargar la partida mock y comprobar que la burbuja del NPC se ve; jugar un turno real y confirmar que durante el streaming no aparece `[[` en pantalla.
- [ ] **Step 5: Commit** — `git commit -m "feat: el diálogo de los NPCs se ve en burbujas propias"`

---

## Fase B — Retratos, panel lateral y animación

### Task 5: Catálogo de retratos y campo `portrait` (estado v7)

> Revisada el 2026-11-21 con las imágenes reales: `public/portraits/<carpeta>/<n>.webp`, carpetas con género (`guard-female`) o sin él (`goblin`, `soldier`).

**Files:**
- Create: `src/domain/portraits.ts`, `tests/portraits.test.ts`
- Add: `public/portraits/**` (imágenes del usuario, ya optimizadas a 512px)
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/applyChanges.ts`, `src/persistence/migrations.ts` (`fromV6`, `GAME_STATE_VERSION = 7`), `src/engine/dmPrompt.ts`
- Test: `tests/portraits.test.ts`, `tests/applyChanges.test.ts`, `tests/characterIds.test.ts` (migración), `tests/dmPrompt.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const PORTRAIT_IDS: readonly [PortraitId, ...PortraitId[]]; // "<base>-male" | "<base>-female" para humanoides, "<base>" para el resto
  export type PortraitId = `${GenderedBase}-male` | `${GenderedBase}-female` | PlainBase;
  /** Carpetas en public/portraits y cuántas imágenes tiene cada una. */
  export const PORTRAIT_FOLDERS: Readonly<Record<string, number>>;
  /** Variante estable según el nombre del NPC. Prueba la carpeta del id y después la de su base sin género; null si no hay ninguna. */
  export function portraitUrl(id: string, npcName: string): string | null; // "/portraits/guard-female/3.webp"
  ```
  `Npc.portrait: string | null` (en el estado un string, para que un id que salga del catálogo no rompa guardados); el cambio `npc` suma `portrait: PortraitId | null` (`z.enum(PORTRAIT_IDS).nullable()`).

- [ ] **Step 1: Write the failing tests**
  - `PORTRAIT_FOLDERS` coincide con las carpetas y la cantidad de `.webp` de `public/portraits` (lee el disco).
  - Todo id de `PORTRAIT_IDS` resuelve a una carpeta existente, salvo los que no tienen ni carpeta propia ni de base (resuelven a null).
  - `portraitUrl` es estable para el mismo nombre (sin importar mayúsculas ni espacios), usa la carpeta sin género si falta la con género (`soldier-female` → `soldier/`), y da null sin carpeta (`cleric-male`).
  - Un cambio `npc` con `portrait: "guard-male"` lo guarda. Un cambio posterior con `portrait: null` lo conserva.
  - Un guardado v6 migra a v7 con `portrait: null` en cada NPC. El mock sigue cargando.
  - `DM_SYSTEM_PROMPT` menciona `"portrait"`.
- [ ] **Step 2: Run** `pnpm test` — Expected: FAIL.
- [ ] **Step 3: Implement** según las Interfaces. Hash del nombre normalizado (trim + minúsculas), FNV-1a, `% count + 1`. En applyChanges: `portrait: change.portrait ?? existing?.portrait ?? null`. En el prompt, una línea en ESCENA: al crear un NPC hay que elegir en `portrait` el arquetipo y género que mejor le queden, o `null` si ninguno encaja; después mandarlo null si no cambia.
- [ ] **Step 4: Run** `pnpm test && pnpm check` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: los NPCs tienen un retrato de arquetipo"`

### Task 6: Componente `NpcAvatar` y avatar en las burbujas

**Files:**
- Create: `src/game/NpcAvatar.tsx`
- Modify: `src/game/TurnLog.tsx`, `src/game/game.css`

**Interfaces:**
- Consumes: `portraitUrl` (Task 5), `initials` (`TurnLog.tsx`), `findNpc` (Task 1).
- Produces:
  - `NpcAvatar({ name, npc, size, speaking }: { name: string; npc: Npc | undefined; size: "sm" | "lg"; speaking?: boolean })`. Renderiza `<img alt="">` si `npc?.portrait` tiene valor; si no, un círculo con `initials(name)`. El borde usa el color de la actitud (`friendly`/`neutral`/`hostile`, con los mismos tokens que `SceneDrawer`).

- [ ] **Step 1: Implement** `NpcAvatar` y reemplazar `Speaker` por `<NpcAvatar size="sm">` en las burbujas de NPC. Si la imagen da error (`onError`), se muestran las iniciales.
- [ ] **Step 2: Verificar**: `pnpm check` en verde. Con `pnpm dev`, un NPC con retrato muestra la imagen y uno sin retrato muestra sus iniciales.
- [ ] **Step 3: Commit** — `git commit -m "feat: avatar de los NPCs en sus burbujas"`

### Task 7: Panel lateral de escena (escritorio y pantallas medianas)

**Files:**
- Create: `src/game/ScenePanel.tsx`
- Modify: `src/game/Game.tsx`, `src/game/game.css`

**Interfaces:**
- Consumes: `sceneMembers(state, dmActing)` de `SceneDrawer.tsx` (ya existe: DM, jugadores y NPCs presentes, con `hasTurn`), `NpcAvatar`, `findNpc`.
- Produces: `ScenePanel({ state, dmActing, speaking }: { state: GameState; dmActing: boolean; speaking: string | null })`. En la Task 7 `speaking` siempre es `null`; la Task 8 lo conecta.

- [ ] **Step 1: Implement**: `ScenePanel` lista a los `sceneMembers` con `NpcAvatar size="lg"` (para el DM y los jugadores, iniciales). Marca a quien tiene `hasTurn` y al que coincide con `speaking`. Es un `<aside aria-label="Personajes en escena">`.
- [ ] **Step 2: Layout**: en `game.css`, `@media (min-width: 64rem)`: `.game` pasa a dos columnas (`minmax(0, 1fr) 14rem`) y el panel queda en la columna derecha, `position: sticky` debajo del header (usando `--header-offset` como `.sheet`). Por debajo de 64rem lleva `display: none`. El botón que abre el `SceneDrawer` se oculta en ≥64rem para no duplicar.
- [ ] **Step 3: Verificar**: `pnpm check` en verde. Con `pnpm dev` a 1280px se ve el panel con los NPCs presentes; a 800px y a 390px el panel no está y el drawer sigue funcionando. En modo zen (`game--zen`) el panel también se oculta.
- [ ] **Step 4: Commit** — `git commit -m "feat: panel lateral con los personajes en escena"`

### Task 8: Quién habla y animación de péndulo

**Files:**
- Modify: `src/animations/motion.ts`, `src/game/Game.tsx`, `src/game/ScenePanel.tsx`, `src/game/NpcAvatar.tsx`, `src/game/game.css`
- Test: `tests/dialogue.test.ts`

**Interfaces:**
- Consumes: `speakingNow` y `castOf` (Tasks 1 y 4).
- Produces: `startSwing(element: HTMLElement): () => void` en `motion.ts`. Arranca la oscilación y devuelve `stop`, que lleva la rotación a 0 en ~300 ms. Si `motionAllowed()` es false, no hace nada y devuelve un no-op.

- [ ] **Step 1: Write the test**: `speakingNow("[[Lira]] Sí", cast)` → `null` y `speakingNow("[[ brena ]] Ho", cast)` → `"Brena"`. Complementan los de la Task 1.
- [ ] **Step 2: Run** `pnpm vitest run tests/dialogue.test.ts` — Expected: PASS, porque ya lo cubre la Task 1. Si falla, corregir `speakingNow` antes de seguir.
- [ ] **Step 3: Implement**:
  - En `Game.tsx`: `const speaking = inFlight ? speakingNow(inFlight.narration, castOf(state)) : null`. Como sale del texto que el typewriter ya mostró, el péndulo se mueve al ritmo de lo que se lee y pasa a `null` cuando un reintento reinicia la narración.
  - `startSwing` con animejs 4: `animate(element, { rotate: [-3, 3], duration: 800, ease: "inOutSine", loop: true, alternate: true })`. Mirar en `motion.ts` cómo se importa. `stop` pausa la animación y hace un tween de `rotate` a 0.
  - En `NpcAvatar`, cuando `speaking` es true: la clase `avatar--speaking` (`transform: scale(1.1)` con `transition: transform 200ms`) en el contenedor, y `startSwing` sobre un elemento interno con `transform-origin: top center`, en un `useEffect` que llama a `stop` al apagarse. La escala va en el contenedor y la rotación en el elemento interno para que los dos transforms no se pisen.
  - `ScenePanel` le pasa `speaking={member.name === speaking}` a cada avatar.
- [ ] **Step 4: Verificar**: `pnpm test && pnpm check`. Con `pnpm dev` a 1280px, jugar un turno donde hable un NPC: su retrato crece y oscila solo mientras se escribe su línea, y vuelve suave a 0° cuando sigue el DM o cuando termina. Con reduced motion activado en el sistema, solo escala.
- [ ] **Step 5: Commit** — `git commit -m "feat: el retrato del NPC que habla se agranda y oscila"`
