# DnSolo

Un Dungeon Master con IA para jugar D&D en solitario desde el navegador. Creás tu personaje, la IA narra la campaña y vos decidís qué hace tu personaje con texto libre.

## Características

- **Narración en streaming** con Gemini, usando tu propia API key (BYOK).
- **Tiradas arbitradas por código**: el DM pide la tirada, la app genera el número. El modelo nunca inventa resultados.
- **Memoria en tres capas**: estado estructurado (personaje y nivel, inventario, ubicación, NPCs, misiones; la ficha completa con PG y estadísticas la llevás vos), un resumen acumulado de la historia y los últimos turnos. Nunca se manda el historial completo.
- **Guardado automático** en IndexedDB después de cada turno, con lista de campañas, importación y exportación.
- **Generador de personajes SRD**: describís una idea y la IA propone personajes con ficha completa según las reglas del SRD 5.2.1.
- **Sincronización con Google Drive (opcional)**: tus campañas viajan entre dispositivos usando tu propio Drive. Ver [Sincronización](#sincronización-con-google-drive).
- **Casi sin servidor**: las páginas son estáticas; tu key y tus partidas quedan en tu navegador. La única parte que corre en un servidor son tres rutas opcionales para renovar la conexión con Drive automáticamente.

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
| `pnpm build`   | Genera `dist/client/` (sitio) y `dist/server/entry.mjs` (rutas de Drive) |
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
├── sync/         # Sincronización: motor, almacén en Drive, autenticación con Google y piezas de UI
├── server/       # Solo servidor: cookie sellada, intercambio de tokens con Google y helpers de rutas
├── pages/        # Bienvenida, personaje, juego y configuración (y api/drive/ con las tres rutas del servidor)
└── styles/       # Tokens de diseño y estilos globales
```

Cada capa vive detrás de una interfaz (`LLMClient`, `GameRepo`, `RemoteGameStore`, `DriveAuth`) para poder reemplazarla sin tocar el motor de turnos; así Drive se suma como una capa sobre `GameRepo` sin que el motor lo sepa.

## Sincronización con Google Drive

Es opcional. Con `PUBLIC_GOOGLE_CLIENT_ID` vacío la función queda oculta y la app no contacta a Google.

- **Dónde viven los datos**: en la carpeta oculta de la app (`appDataFolder`) del Drive de cada jugador, con el alcance `drive.appdata`. Un archivo por campaña. Los borrados se sincronizan como lápidas y los conflictos los resuelve el jugador. La API key de Gemini y los ajustes no se sincronizan.
- **Modo por defecto, sin servidor**: el permiso dura cerca de 1 hora y se guarda en `sessionStorage`, así que sobrevive a la navegación dentro de la misma pestaña (se pierde al cerrarla). Al vencer se renueva con el próximo toque del jugador (Enviar, Jugar/Continuar, Reconectar); puede parpadear una ventana de Google.
- **Modo opcional "Renovar la conexión automáticamente"**: usa tres rutas del servidor, `/api/drive/connect`, `/api/drive/token` y `/api/drive/disconnect`. El refresh token queda sellado (AES-256-GCM) en una cookie HttpOnly del jugador; el servidor no guarda nada. Si el servidor ya no puede renovar (cookie borrada, permiso revocado, o los 7 días que dura el refresh token mientras la pantalla de consentimiento está en Testing), "Reconectar" o "Sincronizar ahora" vuelven a abrir la ventana de Google.

Las páginas se prerenderizan y solo esas tres rutas corren en el servidor (`@astrojs/node`, modo standalone).

### Puesta en marcha (una vez, el dueño del sitio, gratis)

1. En [Google Cloud Console](https://console.cloud.google.com) creá o elegí un proyecto y habilitá **Google Drive API**.
2. **Pantalla de consentimiento de OAuth**: tipo External, con el alcance `drive.appdata` (no sensible). Mientras esté en modo Testing solo pueden conectarse los usuarios de prueba que cargues (máximo 100). Al publicar a Production puede pedirte un enlace a una política de privacidad.
3. **Credenciales**: cliente OAuth de tipo "Aplicación web" con Orígenes de JavaScript autorizados `https://<tu-dominio>` y `http://localhost:4321`. No hacen falta URIs de redireccionamiento (el flujo del servidor usa `postmessage`).

### Variables de entorno

| Variable                 | Dónde se usa                                              |
| ------------------------ | --------------------------------------------------------- |
| `PUBLIC_GOOGLE_CLIENT_ID` | Pública; se usa en el build y también la lee el servidor en runtime |
| `GOOGLE_CLIENT_SECRET`   | Solo servidor, leída en runtime                           |
| `SESSION_SECRET`         | Solo servidor, leída en runtime: una cadena larga y aleatoria (`openssl rand -base64 32`) |

`GOOGLE_CLIENT_SECRET` y `SESSION_SECRET` se leen en runtime, así que tienen que estar definidas como variables de entorno del hosting y no solo en el build. En local van en `.env` (ignorado por git); hay un modelo en `.env.example`.

### Probarlo en local

Abrí la app como `http://localhost:4321` (no `127.0.0.1` ni la IP de la red local), que es el origen autorizado.

- Modo por defecto: `pnpm dev`.
- Renovación automática: `pnpm build && node dist/server/entry.mjs` (puerto 4321).

### Despliegue en Hostinger (Node.js app)

- Preset: **Astro**.
- Comando de build: `pnpm run build`.
- Directorio de salida: `dist`.
- Archivo de entrada: `server/entry.mjs`, relativo al directorio de salida (con `dist/server/entry.mjs` falla con "Entry file not found").
- En "Variables de entorno": las tres de arriba.

## Generador de personajes

En `/generator` podés describir una idea ("una elfa que dejó el templo para cazar no muertos") y pedir opciones. **El modelo elige, el código calcula**: la IA solo elige especie, clase, trasfondo y cada elección de reglas (habilidades, idiomas, conjuros, dotes, maestrías…); `src/rules/` valida esas elecciones y calcula todos los números de la ficha (PG, CA, salvaciones, bonificadores, CD de conjuros). Si una elección no es legal, se le devuelve el error al modelo para que la corrija.

- `src/rules/data/` tiene las especies, clases, trasfondos, dotes, equipo y conjuros del SRD en español.
- La fase 1 cubre los **niveles 1 a 4**, con la única subclase de cada clase que trae el SRD.
- La ficha se puede copiar como texto o Markdown, o pasar al formulario de `/character` con "Usar este personaje" para empezar la partida; el DM recibe los rasgos reales del nivel actual y del siguiente.

Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.

Los créditos están en `/credits`.

La especificación completa del MVP está en [`Spec.md`](Spec.md).
