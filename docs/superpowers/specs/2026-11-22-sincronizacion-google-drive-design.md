# Sincronización de partidas con Google Drive

Fecha: 2026-11-22 · Estado: borrador para aprobación

## Intención

Poder seguir la misma campaña en otro dispositivo: jugar en la PC, salir de
casa y continuar desde el celular donde se dejó. Hoy las partidas viven solo
en el IndexedDB de cada navegador y la única forma de moverlas es exportar e
importar el JSON a mano.

El modo es **opcional**: quien solo quiere abrir la web y jugar no ve ni
configura nada nuevo. El público general ya pasa por el trámite de la API key
de Gemini; la sincronización no debe sumar fricción para quien no la usa ni
pedir más que "tocar un botón y aceptar" para quien sí.

## Metas

- Con la sincronización activa, al abrir una campaña en otro dispositivo se ve
  el último turno jugado en cualquiera de ellos.
- La lista de campañas es la misma en todos los dispositivos conectados a la
  misma cuenta de Google (incluidos los borrados).
- Jugar sin conexión sigue funcionando; lo pendiente se sube al volver la red.
- Las partidas se guardan en el Drive del propio jugador, no en un servidor de
  DnSolo.

## No metas

- Jugar la misma partida en dos dispositivos a la vez ni fusionar turnos.
- Sincronizar la configuración: la API key, el modelo y las preferencias se
  cargan en cada dispositivo (decisión de diseño: la key no sale del navegador).
- Otros proveedores (Dropbox, iCloud, cuentas propias).
- Tiempo real: no se escuchan cambios remotos mientras se juega.

## Anti-metas (fracaso aunque "funcione")

- Que la sincronización haga más lento un turno o lo haga fallar. Un error de
  Drive nunca se muestra como error de turno ni impide guardar en local.
- Perder turnos en silencio: si hay dos versiones divergentes, el jugador elige.
- Que quien no activa el modo vea pantallas, permisos o avisos nuevos.

## Restricciones

- Sitio hoy 100 % estático, publicado en Hostinger como app de Node.js
  (preset Astro, rama `main`, salida `dist`). El spike de la rama
  `spike/servidor-node` confirmó que Hostinger corre el servidor de Astro con
  **archivo de entrada `server/entry.mjs`** (relativo a `dist`) y que todo lo
  demás sigue funcionando.
- La persistencia pasa solo por `GameRepo` (`save`, `load`, `loadLatest`,
  `list`, `delete`). Hoy se instancia `IndexedDBGameRepo` directamente en
  `src/pages/index.astro`, `src/game/Game.tsx` y
  `src/character/CharacterForm.tsx`; `TurnEngine` recibe el repo inyectado y
  guarda con una cadena serializada (`enqueueSave`).
- `GameState` tiene `id`, `version`, `createdAt`, `updatedAt` (ISO) y
  `turns`. Las partidas viejas se migran al leer (`migrateSave`).
- Google: OAuth solo acepta orígenes HTTPS o `http://localhost`; no se puede
  probar desde el celular contra `pnpm dev --host` en la red local.
- Código e identificadores en inglés, textos de la interfaz en español.

## Enfoques considerados

1. **Google Drive (carpeta oculta de la app), elegido.** Las partidas quedan
   en la cuenta del jugador, que ya tiene Google por Gemini. Sin base de datos
   propia.
2. **Backend propio con código de sincronización** (MySQL en Hostinger o
   Firebase). Lo más simple para el jugador (sin cuenta), pero DnSolo pasa a
   custodiar partidas ajenas, espacio y abuso. Descartado.
3. **Exportar/importar mejorado (QR, enlace).** No es sincronización real.
   Descartado.

Dentro de Drive, la renovación del permiso tiene dos variantes y **el jugador
elige** (decisión del usuario: hay quien no confía en un servidor):

- **Sin servidor (por defecto).** Permiso de Google de ~1 h desde el navegador.
  Al vencer se renueva aprovechando el toque de "Enviar"; se ve un popup (o un
  salto de pestaña en el celular) que se cierra solo, una vez por hora.
- **Renovación automática (opcional, interruptor en Configuración).** Un
  servidor de DnSolo guarda un permiso de larga duración cifrado en una cookie
  del propio jugador y renueva sin que se note. Conectás una vez y listo.

## Diseño

### Lo que ve el jugador

**Configuración → sección "Sincronización"**

```
Sincronización entre dispositivos
Guardá tus campañas en tu Google Drive para seguirlas en otro dispositivo.
[ Conectar Google Drive ]

(conectado)
● Conectado a Google Drive · última sincronización hace 2 min
[ ] Renovar la conexión automáticamente
    Usa el servidor de DnSolo para no pedirte que vuelvas a entrar.
    Tus partidas siguen solo en tu Drive.
[ Sincronizar ahora ]  [ Desconectar ]
```

- Desconectar no borra nada: quedan las copias locales y las de Drive.
- Activar o desactivar el interruptor pide volver a conectar con Google
  (cambia el tipo de permiso).

**Indicador** en la pantalla de juego y en la lista de campañas, solo con el
modo activo: *Sincronizado*, *Sincronizando…*, *Sin conexión, se sube después*,
*Reconectar* (botón). Discreto; la ubicación exacta queda al implementador
siguiendo el estilo actual.

**Borrar una campaña** con el modo activo la borra en todos los dispositivos.
El texto de confirmación (el botón de dos toques actual) lo aclara: "Se borra
en todos tus dispositivos".

**Choque de versiones** (diálogo, solo si las dos copias cambiaron desde la
última sincronización):

```
Esta campaña cambió en dos lugares
  Este dispositivo · turno 40 · hace 10 min      [ Quedarme con esta ]
  Google Drive     · turno 42 · hace 2 h          [ Usar la de Drive ]
La otra versión se descarta.
```

El diálogo incluye un enlace "Exportar la otra versión" (reusa
`downloadGame`) para quien quiera guardarla antes de descartarla.

### Almacenamiento en Drive

- Alcance OAuth: `https://www.googleapis.com/auth/drive.appdata` (carpeta
  oculta `appDataFolder`; la app no ve el resto del Drive). No sensible.
- Un archivo por partida: `game-<id>.json` con el `GameState` completo.
  `appProperties`: `gameId`, `updatedAt`, `turnCount`, `deleted` ("true" o
  ausente). Así se lista sin descargar contenidos.
- **Borrado = lápida**: el archivo se reemplaza por `{ "deleted": true,
  "deletedAt": ... }` con `appProperties.deleted = "true"`, para que el otro
  dispositivo borre su copia en lugar de volver a subirla. Las lápidas no se
  limpian (pesan bytes).

### Reconciliación

Por dispositivo se guarda, por cada partida, la **base**: el `updatedAt` de la
última versión que coincidió en local y en Drive (en `localStorage`,
`dnsolo.sync.bases`, junto con el estado de conexión; no toca el esquema de
`GameState` ni la versión de IndexedDB).

Para cada partida, comparando local (L), Drive (R) y base (B):

| Situación | Acción |
|---|---|
| Solo existe en L | subir |
| Solo existe en R (no lápida) | bajar |
| L cambió, R = B | subir |
| R cambió, L = B | bajar |
| Los dos cambiaron | diálogo de choque |
| R es lápida, L = B | borrar local |
| R es lápida, L cambió desde B | diálogo: "se borró en otro dispositivo, ¿restaurar?" |
| L no existe, hay B, R = B (borrada acá sin conexión) | poner lápida en R |
| L no existe, hay B, R cambió desde B | bajar (se jugó en otro lado después; no se pierde) |
| L = B, R no existe ni como lápida | volver a subir |
| L = R | nada (actualizar B) |

Para que un borrado sin conexión no se pierda, `delete` en modo
sincronizado deja la base intacta (es la señal de la fila "L no existe, hay
B"); la base se elimina recién cuando la lápida está en Drive.

Las bases se guardan **por cuenta de Drive** (clave: `permissionId` de
`about.get`, sin pedir el alcance de email). **Desconectar borra las bases**
de esa cuenta: al reconectar se comporta como primera conexión, así un
borrado hecho mientras estaba desconectado no se propaga y la campaña vuelve
desde Drive. Conectar otra cuenta usa sus propias bases.

"Cambió" = `updatedAt` distinto de B. La primera conexión de un dispositivo
(sin bases) sube lo que no está en Drive y baja lo que no está en local; si la
misma partida existe en los dos con distinto `updatedAt`, gana la más nueva
sin preguntar (en la primera conexión no hay base contra la cual detectar
choque; caso raro, solo ocurre con partidas importadas a mano en ambos).

Antes de subir se lee la metadata de R y se compara con B (leer y luego
escribir). Con un dispositivo por vez la carrera es despreciable.

La reconciliación es una función pura (L, R, B → acciones), testeada sin red.

### Cuándo se sincroniza

- **Lista de campañas (`/`)**: reconciliación completa al cargar; la lista se
  pinta primero con lo local y se refresca al terminar.
- **Permiso vencido al entrar (modo sin servidor; decisión del usuario).** Es
  el caso normal al pasar de un dispositivo a otro. La lista muestra un aviso
  "Tocá para traer tus partidas de Drive" (botón que renueva y reconcilia), y
  además **"Continuar" y "Jugar" renuevan el permiso con ese toque**: se abre
  y cierra la ventana de Google, se reconcilia esa partida y recién después
  se navega a `/play`. Si el jugador cierra la ventana o falla, se abre la
  copia local igual y el indicador queda en "Reconectar".
- **Abrir una partida (`/play`)**: reconcilia esa partida antes de mostrarla,
  con un límite de ~3 s; si no hay red o tarda, abre la local y sigue en
  segundo plano. `/play` sin id ("Continuar") usa la más nueva entre local y
  Drive. Si esa reconciliación tardía encuentra una versión más nueva en
  Drive y el jugador **todavía no mandó ningún turno**, se reemplaza la
  partida en pantalla (recreando el `TurnEngine`, que cachea el estado) con
  un aviso "Se cargó la versión más reciente de Drive". Si ya mandó un turno,
  es un choque y va al diálogo.
- **Después de cada guardado**: subida en segundo plano, una por vez por
  partida, colapsando las pendientes (solo importa el último estado).
- **Al volver la red** (`online`) y **al ocultar la página**
  (`visibilitychange` → hidden): intentar subir lo pendiente, para el caso
  "cierro la PC y salgo".
- Crear (formulario de personaje) e importar campañas cuentan como guardado.

### Arquitectura

- `SyncedGameRepo implements GameRepo`: envuelve a `IndexedDBGameRepo`. Toda
  lectura y escritura va primero a local y resuelve con el resultado local;
  la sincronización corre aparte y **nunca rechaza** las promesas de
  `GameRepo` por culpa de Drive. `TurnEngine` no cambia.
- Una fábrica (`createGameRepo()`) reemplaza los tres `new
  IndexedDBGameRepo()`: devuelve el repo sincronizado si el modo está activo.
- `RemoteGameStore` (interfaz): `list()`, `get(id)`, `put(state)`,
  `tombstone(id)`. Implementación `DriveGameStore` sobre la API REST de Drive
  v3 con `fetch` (sin `gapi`); implementación en memoria para tests.
- `DriveAuth` (interfaz): `getAccessToken()`, `connect()`, `disconnect()`,
  estado observable. Dos implementaciones:
  - `BrowserDriveAuth`: Google Identity Services (`accounts.google.com/gsi/client`,
    cliente de token). La renovación con el toque: cuando faltan <10 min para
    vencer, el manejador de "Enviar" llama a `requestAccessToken({ prompt: '' })`
    **de forma sincrónica, antes de cualquier `await`** (si no, el navegador
    bloquea el popup). **El turno espera a que la ventana de Google vuelva**
    (o falle, o pasen ~20 s) antes de llamar a Gemini: en el celular la
    ventana es un salto de pestaña que suspende la página, y un stream
    iniciado antes se cortaría. Si la renovación falla, el turno sigue igual
    y solo la subida queda pendiente. Lo mismo vale para "Continuar"/"Jugar"
    y el botón "Reconectar".
  - `ServerDriveAuth`: cliente de código de GIS (`ux_mode: 'popup'`,
    `access_type` offline) → el código va al servidor; después pide tokens
    nuevos a `/api/drive/token` cuando hace falta, sin interacción.
- Un único estado de sincronización (conectado/sincronizando/sin conexión/
  reconectar/choque) que leen el indicador y la sección de Configuración.

### Servidor (solo para la renovación automática)

- Adaptador `@astrojs/node` en modo `standalone`. Las páginas siguen
  prerenderizadas; solo las rutas `src/pages/api/drive/*` tienen
  `prerender = false`.
- `POST /api/drive/connect` `{ code }`: canjea el código con Google
  (`redirect_uri: 'postmessage'`), guarda el refresh token cifrado
  (AES-256-GCM con `SESSION_SECRET`) en una cookie `HttpOnly; Secure;
  SameSite=Strict; Path=/api/drive`, devuelve `{ accessToken, expiresAt }`.
- `POST /api/drive/token`: descifra la cookie, renueva, devuelve el token.
  401 si no hay cookie o Google la rechazó (la app pasa a "Reconectar").
- `POST /api/drive/disconnect`: revoca el refresh token en Google y borra la
  cookie.
- El servidor no guarda nada: sin base de datos, sin logs de tokens.
- Variables de entorno en Hostinger: `GOOGLE_CLIENT_SECRET`,
  `SESSION_SECRET`. Pública en el build: `PUBLIC_GOOGLE_CLIENT_ID`.
- Hostinger: agregar **archivo de entrada `server/entry.mjs`** y las variables.

### Puesta en marcha (una vez, el dueño de la app)

1. Google Cloud: proyecto (puede ser el de la key de Gemini), habilitar Drive
   API, pantalla de consentimiento en producción con el alcance
   `drive.appdata`.
2. Credencial "Aplicación web": orígenes autorizados `https://<subdominio>` y
   `http://localhost:4321`.
3. Copiar client ID y secreto a las variables de Hostinger y a `.env` local
   (no commiteado).

Quedan documentados en el README; también se actualiza "Sin servidor" para
explicar que el servidor existe solo para la renovación opcional.

### Pruebas

- Unitarias: la reconciliación (cada fila de la tabla), `SyncedGameRepo` con
  `fake-indexeddb` + `RemoteGameStore` en memoria (local nunca falla por
  Drive, colapso de subidas, lápidas), cifrado/descifrado de la cookie.
- Manual en el sitio publicado: PC → celular → PC, modo sin conexión en el
  celular, borrar en uno y ver que desaparece en el otro, forzar un choque.

## Decisiones tomadas en la conversación

- Drive en la cuenta del jugador; modo opcional.
- Un dispositivo por vez; los choques se resuelven eligiendo, sin fusionar.
- Borrar una campaña la borra en todos lados.
- Por defecto sin servidor; la renovación automática es un interruptor.
- La API key y la configuración no se sincronizan (propuesta mía, aceptada).
- Con el permiso vencido al entrar, "Continuar"/"Jugar" renuevan con ese
  toque y la lista muestra un aviso para traer las partidas.

## Decisiones del diseñador (revisables)

- Las filas de reconciliación para borrados sin conexión y archivos que
  faltan en Drive; bases por cuenta de Drive; desconectar borra las bases.
- El turno espera a que vuelva la ventana de Google antes de llamar a Gemini.
- Reemplazo silencioso (con aviso) si Drive trae algo más nuevo antes del
  primer turno de la sesión.

## Queda para el implementador

- Ubicación y estilo exactos del indicador de sincronización.
- Reintentos y backoff ante errores de red o límites de la API de Drive.
- Si mostrar el email de la cuenta conectada (requiere sumar el alcance
  `openid email`; por defecto no).
