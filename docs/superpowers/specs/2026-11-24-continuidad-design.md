# Continuidad: "Anteriormente en…" y página de la campaña

## Intención
Sección "Continuidad" del roadmap. Al volver a una partida después de días,
sobre todo si quedó a mitad de algo (una tirada pendiente, un combate), el
jugador no se acuerda de por qué está ahí: a quién conoció, qué le dijeron,
qué misión tomó. Además falta un lugar donde mirar la campaña entera
(números, personajes conocidos, monstruos) y hoy morir cierra la historia
sin ningún epílogo.

Se juega por la historia: todo lo que se muestra sirve para recordarla, no
para contar recursos.

## Objetivos
- Al retomar tras 12 horas o más, una pantalla "Anteriormente en…" cuenta
  el panorama general y dónde quedó el jugador exactamente.
- Una página propia, "Tu campaña", junta números generales, la crónica y
  un bestiario de personajes y monstruos conocidos.
- Al morir, el epílogo lleva a esa página.

## No objetivos
- No hay estado "campaña terminada" sin morir: cumplir la misión principal
  puede abrir otra. Se puede sumar un "Cerrar campaña" manual más adelante.
- No se registran monedas gastadas, daño hecho ni daño recibido (el usuario
  lo descartó: no hace a la historia).
- No se toca el prompt del DM ni el schema de su respuesta.

## Anti-objetivos
- Que "Anteriormente en…" salte en cada recarga de página.
- Nuevas llamadas al LLM o nuevos deberes para el DM (ver memoria
  "reducir responsabilidad del LLM").
- Mostrar secretos: hilos `secret` no revelados nunca aparecen.

## Enfoques considerados (dónde vive la página)
1. **Página nueva `/campaign?id=…`** (elegido): isla React propia que lee la
   partida guardada. Dirección propia, carga liviana, no agranda `Game.tsx`;
   se llega desde la portada sin abrir la partida. Contra: volver a jugar
   recarga la partida.
2. **Vista a pantalla completa dentro del juego.** Abre sin recargar, pero
   suma otra capa a `Game.tsx` y no se llega desde la portada.

## Diseño

### 1. "Anteriormente en…" (dentro del juego)
**Cuándo:** al abrir una partida con al menos un turno, si
`now - updatedAt >= 12 h` y el personaje no está muerto (ahí se ve el
epílogo). Una vez por apertura. También se abre a mano con un botón en el
cajón Info.

**Contenido**, todo con datos existentes y sin llamar al LLM:
- **Resumen:** `state.summary` en párrafos. Si está vacío (menos de 10
  turnos), se omite la parte.
- **Misiones en curso:** `quests` con `status: "active"`, con título y
  descripción. Si no hay, se omite.
- **Donde quedaste:** el nombre del lugar, "en combate" si
  `scene.inCombat`, el final de la narración del último turno (el último
  párrafo o los últimos ~300 caracteres, cortado en límite de oración) y la
  tirada pendiente (`pendingPlayerRoll`: motivo, dado, CD) o la tirada de
  muerte si el personaje está agonizando.
- Botón **"Seguir"** que cierra la pantalla.

```
   — Anteriormente en… —
   [resumen, 2-3 párrafos]

   Misiones en curso
   · Recuperar el sello del gremio: el maestre Orvin…

   Donde quedaste
   Cripta de Vel · en combate
   «…el esqueleto levanta la espada oxidada…»
   🎲 Te pidieron: Destreza (Sigilo) CD 14

          [ Seguir ]
```

**Convivencia:** mientras está abierta no corre nada que juegue un turno
solo (las tiradas enemigas pendientes esperan, igual que con la pantalla de
nivel). Las sugerencias de partidas viejas (`useOldSaveSuggestions`) pueden
pedirse por detrás.

### 2. Página "Tu campaña" (`/campaign?id=…`)
Página Astro con una isla React (`client:only`) que carga la partida con
`repo.load(id)`. Si no existe, muestra un mensaje con un enlace a la
portada. Se accede desde:
- el cajón Info ("Ver tu campaña"),
- el epílogo de `GameOver` ("Ver tu campaña"),
- cada partida de "Cargar campaña" en la portada.

Hay un enlace "Volver a jugar" a `/play?id=…`, salvo si el personaje murió.

**Secciones:**

**General:** campaña (título oficial o "Aventura libre"), personaje (nombre,
especie, clase, nivel), fecha de inicio y de la última partida y, en
números:
- turnos jugados,
- lugares visitados: nombres distintos de los capítulos (con `samePlace`),
  o 1 si no hay capítulos,
- personajes y monstruos conocidos, y monstruos derrotados,
- misiones cumplidas, fallidas y en curso, e hilos resueltos (solo los no
  secretos),
- tiradas del jugador y sus 20 y 1 naturales: un d20 único (`count` 1 o
  ausente) en `input.roll` y las tiradas de muerte (`death_save.natural`).

**Crónica:** el resumen (lo que hoy muestra el cajón Info bajo "Crónica de
la campaña") y una línea de tiempo con los momentos clave, en orden:
- capítulos: primera visita a cada lugar, con número de turno;
- momentos nuevos que se registran desde ahora (ver "Registro de
  momentos"): misión nueva, cumplida o fallida, subida de nivel y muerte.

**Personajes y Monstruos (bestiario):** solo los NPCs vistos
(`seen !== false`).
- **Monstruo** si su retrato es de criatura: `goblin`, `kobold`, `wolf`,
  `skeleton`, `zombie`, `drowned`, `dragon`. El resto, incluidos los que no
  tienen retrato, va a **Personajes**. El conjunto vive junto a los
  arquetipos en `domain/portraits.ts`.
- Cada tarjeta: retrato (o iniciales, como `NpcAvatar`), nombre, la línea de
  la tarjeta de llegada (primera oración de `description`), actitud
  (Aliado / Neutral / Hostil) y último estado: el `HealthLabel` actual, con
  "Derrotado" en lugar de "Fuera de combate" cuando sus PV llegaron a 0.
  Sin PV seguidos, no se muestra estado.
- Orden: por aparición en la partida (orden de `npcs`).

### 3. Registro de momentos (código, sin LLM)
Igual que `arrivals` y `chapter`, cada turno guarda en `Turn.moments`
(opcional, ausente en turnos viejos) lo que cambió entre el estado anterior
y el nuevo:
- `{ kind: "quest", title, status }` para misiones nuevas o que cambiaron de
  estado,
- `{ kind: "level", level }`,
- `{ kind: "death" }`.

Se calcula en `TurnEngine` con una función pura `momentsOf(prev, next)` en
`domain/`. Las partidas anteriores muestran en la línea de tiempo solo los
capítulos, más lo que se juegue desde la actualización. Como el campo es
opcional, no necesita migración.

### 4. Epílogo al morir
`GameOver` suma el botón "Ver tu campaña" junto a "Exportar partida" y
"Nueva campaña".

## Decisiones del implementador (marcadas como propias)
- Ruta en inglés (`/campaign`), como las demás. Título visible "Tu
  campaña".
- La página lee solo la copia local (`repo.load`), sin sincronizar con
  Drive antes: es de lectura.
- Monstruos sin nombre propio (por ejemplo "Goblin", "Goblin 2", "Goblin 3")
  van en una sola tarjeta "Goblin", sin contador: son todos iguales. Su
  estado es "Derrotado" si cayeron todos y, si no, el del que está mejor.
  Los que tienen nombre propio van en su propia tarjeta. (Pedido del usuario;
  la regla del estado es del implementador.)
- El umbral de 12 h es una constante única.

## Queda para el implementador
- Estilos y animación de la pantalla y de la página, coherentes con
  `chapters.css` y `level-up.css`.
- Textos exactos de los estados vacíos.
- Pruebas: `momentsOf`, la clasificación de monstruos, las estadísticas y la
  regla de las 12 h, como funciones puras.

## Rediseño de "Tu campaña" (aprobado sobre maqueta, 2026-11-24)
El usuario quiso la página "como un libro", con galerías y tarjetas verticales,
y aprobó la maqueta.
- Arriba, siempre visibles: el encabezado (campaña, personaje, fechas,
  botones) y las estadísticas.
- Debajo, tres pestañas tipo señalador: **Crónica**, **Personajes** y
  **Monstruos**, de a una por vez. Arranca en Crónica. La elegida queda en el
  hash (`#cronica`, `#personajes`, `#monstruos`).
- La página es de papel, con doble filete y sombra, título en cursiva y el
  ornamento ❦. La crónica va con letra de libro y capital en rojo, y debajo
  la línea de tiempo.
- Galerías: 2 columnas en el celular y 3 desde 46rem. La tarjeta es vertical:
  retrato cuadrado grande con borde del color de la actitud, nombre,
  descripción y etiquetas. Un hostil derrotado se ve en gris.
- **Álbum de monstruos:** siempre se ven todas las especies de criatura que
  tienen retrato, en orden fijo (goblin, kobold, lobo, esqueleto, zombi,
  ahogado, dragón). Las que no se vieron muestran la silueta en negro con un
  "?", el nombre "???" y "Todavía no te cruzaste con esta criatura". Arriba
  dice "Descubriste N de M" y la pestaña dice "N/M".
- Un monstruo con nombre propio (un goblin "Grishnak") va en su propia
  tarjeta, después de la de su especie, y no suma al contador. Si de esa
  especie solo se vieron monstruos con nombre, el primero ocupa el lugar de
  la especie. (Decisión del implementador, presentada al usuario.)
- Los personajes no tienen huecos "?" porque no hay una lista cerrada.
