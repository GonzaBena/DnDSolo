# Capítulos al cambiar de ubicación: diseño

Ítem 2 de `docs/roadmap.md`. Tamaño: cambio chico.

## Por qué

Llegar a un lugar nuevo hoy no se nota: solo cambia el texto "Lugar" del
panel. Tiene que sentirse como empezar un capítulo, y al releer el registro
tiene que verse dónde empezó cada uno.

## Objetivos

- Cartel superpuesto breve, estilo película, la primera vez que se llega a un
  lugar.
- Separador de capítulo en el registro cada vez que cambia el lugar, grande en
  la primera visita y chico en las revisitas, que queda en el historial.
- El primer turno de la partida abre el capítulo 1 con su lugar inicial.

## No objetivos

- No se toca el prompt del DM ni el schema de respuesta.
- No se distinguen cambios "grandes" de "chicos": cuenta el nombre.
- Sin sonido ni tinte de fondo (queda en "Ambiente").

## Anti-objetivos

- Que el cartel corte la lectura a cada rato: solo en primeras visitas.
- Que el historial se reescriba: el separador muestra el lugar como era al
  llegar.

## Enfoques considerados

- A. Array `visitedLocations` en `GameState`: explícito, pero es un segundo
  registro que puede desfasarse del historial.
- **B. Foto del capítulo en el turno (elegido).** El turno donde cambia el
  lugar guarda `{ name, description, firstVisit }`; `firstVisit` se calcula al
  cerrar el turno mirando los capítulos de los turnos anteriores. El historial
  es la única fuente de verdad y la misma foto sirve al cartel y al
  separador.

## Diseño

### Datos

`Turn` gana `chapter?: Chapter`, con
`Chapter { name: string; description: string; firstVisit: boolean }`. Se
calcula en `TurnEngine.commit` con una función pura en `domain/`:

- Hay capítulo si el nombre del lugar después del turno difiere del de antes
  (misma comparación sin mayúsculas ni espacios que ya usa `applyChanges`),
  o si es el primer turno de la partida y el lugar tiene nombre.
- `firstVisit`: ningún turno anterior tiene un capítulo con ese nombre.
- Partidas viejas: sin capítulos previos, así que volver a un lugar de antes
  de esta versión cuenta como primera visita. Aceptado.

Sube `GAME_STATE_VERSION` (migración sin cambios), como con las entradas,
para que una versión vieja de la app no reescriba la partida perdiendo los
capítulos.

### Separador en el registro

- Va en `TurnLog` dentro del turno que trae capítulo, después del mensaje del
  jugador y antes de la narración del DM.
- Primera visita: "— Nombre —" grande con la descripción en cursiva debajo.
- Revisita: una línea chica con el nombre entre rayas, sin descripción.
- Animación de entrada solo en el turno en vivo (mismo criterio `animated`).

### Cartel

- Solo en vivo, solo si `firstVisit`. No al recargar.
- Franja que baja desde arriba, igual que la de emboscada (misma entrada,
  salida, ancho y corrimiento de los toasts), con estilo propio: nombre grande
  entre rayas y descripción en cursiva debajo. Se va sola a los 3 s o al
  tocarla.
- Si el mismo turno trae emboscada, primero la franja del capítulo y, cuando
  se va, la de emboscada (llegar y que te salten encima). Nunca dos a la vez.
- `prefers-reduced-motion`: aparece y se va sin desplazamiento.

### Accesibilidad

- El anuncio del turno suma "Capítulo: Nombre." al principio, antes de la
  narración. El cartel y el separador son `aria-hidden` para no repetirlo.

## Queda para quien construya

- Animaciones concretas en `animations/motion.ts`, en línea con
  `enterBanner`/`leaveBanner`.
- Tipografía y estilos exactos, con las fuentes de títulos que ya usa la app.
- Cómo encadenar cartel y emboscada en `Game.tsx` (una cola simple alcanza).
