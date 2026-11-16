# DnSolo

Un Dungeon Master con IA para jugar D&D en solitario desde el navegador. Creás tu personaje, la IA narra la campaña y vos decidís qué hace tu personaje con texto libre.

## Características

- **Narración en streaming** con Gemini, usando tu propia API key (BYOK).
- **Tiradas arbitradas por código**: el DM pide la tirada, la app genera el número. El modelo nunca inventa resultados.
- **Memoria en tres capas**: estado estructurado (personaje y nivel, inventario, ubicación, NPCs, misiones; la ficha completa con PG y estadísticas la llevás vos), un resumen acumulado de la historia y los últimos turnos. Nunca se manda el historial completo.
- **Guardado automático** en IndexedDB después de cada turno, con lista de campañas, importación y exportación.
- **Generador de personajes SRD**: describís una idea y la IA propone personajes con ficha completa según las reglas del SRD 5.2.1.
- **Sin servidor**: sitio 100 % estático; tu key y tus partidas quedan en tu navegador.

## Stack

- [Astro](https://astro.build) + TypeScript (estricto), con la pantalla de juego como isla de React
- [@google/genai](https://www.npmjs.com/package/@google/genai) para Gemini
- [Zod](https://zod.dev) para validar las respuestas estructuradas del DM
- [anime.js](https://animejs.com) para animaciones (respeta `prefers-reduced-motion`)
- [Vitest](https://vitest.dev) + `fake-indexeddb` para tests

## Cómo correrlo

Requiere Node 22+ y pnpm.

```sh
pnpm install
pnpm dev        # http://localhost:4321
```

Después entrá a **Configuración**, pegá tu API key de Gemini (la podés crear en [Google AI Studio](https://aistudio.google.com/apikey)) y elegí un modelo. La key se guarda solo en `localStorage`.

### Otros comandos

| Comando        | Qué hace                         |
| -------------- | -------------------------------- |
| `pnpm build`   | Genera el sitio estático en `dist/` |
| `pnpm preview` | Sirve el build localmente        |
| `pnpm check`   | Chequeo de tipos de Astro        |
| `pnpm test`    | Corre los tests con Vitest       |

## Arquitectura

**El modelo narra, el código arbitra.** Cada turno el modelo devuelve un JSON validado contra un esquema (narración, tirada requerida, cambios de estado y eventos). Si llega inválido se reintenta una vez y, si vuelve a fallar, se muestra un error claro sin romper la partida.

```
src/
├── domain/       # Tipos, esquemas Zod, dados y aplicación de cambios de estado
├── rules/        # Datos y cálculo de reglas del SRD 5.2.1: generador de personajes y fichas
├── character/    # Isla de React del generador y el formulario de personaje
├── engine/       # TurnEngine: turno → llamada → validación → cambios → guardado
├── llm/          # LLMClient (interfaz), GeminiClient y FakeLLMClient para tests
├── persistence/  # GameRepo (interfaz), IndexedDB, en memoria y migraciones
├── game/         # Isla de React con la pantalla de juego
├── pages/        # Bienvenida, personaje, juego y configuración
└── styles/       # Tokens de diseño y estilos globales
```

Cada capa vive detrás de una interfaz (`LLMClient`, `GameRepo`) para poder reemplazarla después, por ejemplo por un proxy o Firestore, sin tocar el motor de turnos.

## Generador de personajes

En `/generator` podés describir una idea ("una elfa que dejó el templo para cazar no muertos") y pedir opciones. **El modelo elige, el código calcula**: la IA solo elige especie, clase, trasfondo y cada elección de reglas (habilidades, idiomas, conjuros, dotes, maestrías…); `src/rules/` valida esas elecciones y calcula todos los números de la ficha (PG, CA, salvaciones, bonificadores, CD de conjuros). Si una elección no es legal, se le devuelve el error al modelo para que la corrija.

- `src/rules/data/` tiene las especies, clases, trasfondos, dotes, equipo y conjuros del SRD en español.
- La fase 1 cubre los **niveles 1 a 4**, con la única subclase de cada clase que trae el SRD.
- La ficha se puede copiar como texto o Markdown, o pasar al formulario de `/character` con "Usar este personaje" para empezar la partida; el DM recibe los rasgos reales del nivel actual y del siguiente.

Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.

Los créditos están en `/credits`.

La especificación completa del MVP está en [`Spec.md`](Spec.md).
