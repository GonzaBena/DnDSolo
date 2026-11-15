# DnSolo

Un Dungeon Master con IA para jugar D&D en solitario desde el navegador. Creás tu personaje, la IA narra la campaña y vos decidís qué hace tu personaje con texto libre.

## Características

- **Narración en streaming** con Gemini, usando tu propia API key (BYOK).
- **Tiradas arbitradas por código**: el DM pide la tirada, la app genera el número. El modelo nunca inventa resultados.
- **Memoria en tres capas**: estado estructurado (personaje, HP, inventario, ubicación, NPCs, misiones), un resumen acumulado de la historia y los últimos turnos. Nunca se manda el historial completo.
- **Guardado automático** en IndexedDB después de cada turno, con lista de campañas, importación y exportación.
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
├── engine/       # TurnEngine: turno → llamada → validación → cambios → guardado
├── llm/          # LLMClient (interfaz), GeminiClient y FakeLLMClient para tests
├── persistence/  # GameRepo (interfaz), IndexedDB, en memoria y migraciones
├── game/         # Isla de React con la pantalla de juego
├── pages/        # Bienvenida, personaje, juego y configuración
└── styles/       # Tokens de diseño y estilos globales
```

Cada capa vive detrás de una interfaz (`LLMClient`, `GameRepo`) para poder reemplazarla después, por ejemplo por un proxy o Firestore, sin tocar el motor de turnos.

La especificación completa del MVP está en [`Spec.md`](Spec.md).
