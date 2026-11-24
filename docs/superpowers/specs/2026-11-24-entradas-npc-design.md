# Entradas de personajes: diseño

Ítem 1 de `docs/roadmap.md`. Tamaño: cambio chico.

## Por qué

Hoy la aparición de un NPC es un toast genérico ("👤 Nuevo personaje — Goblin 1
está presente en la historia") que no se distingue de "Objeto obtenido". No se
siente que apareció alguien. La entrada tiene que ser un momento: ver la cara,
saber quién es y si viene en paz o a pelear.

## Objetivos

- Tarjeta de entrada dentro del registro de narración, al final del turno en
  que el personaje entra, que queda en el historial.
- Reencuentros: un NPC conocido que vuelve a estar presente también tiene
  tarjeta.
- Enemigos del mismo tipo agrupados en una tarjeta.
- Franja de "¡Emboscada!" solo cuando aparecen hostiles de golpe y arranca el
  combate en el mismo turno.

## No objetivos

- No se toca el prompt del DM ni el schema de respuesta.
- No se muestran PV numéricos de nadie.
- Sin sonido (queda en "Ambiente" del roadmap).

## Anti-objetivos

- Que la entrada interrumpa la lectura cada vez que aparece alguien: el
  overlay se reserva para la emboscada.
- Que el historial se reescriba: una tarjeta vieja muestra al personaje como
  era al entrar.

## Enfoques considerados

- **A. Foto de la entrada guardada en el turno (elegido).** El historial es
  fiel y cuesta ~200 bytes por entrada.
- B. Guardar solo nombres y leer el estado actual: el historial cambia solo
  (aliado que se vuelve hostil, goblin muerto entrando "Fuera de combate").
- C. No persistir: se pierde al recargar, contradice que quede en el registro.

## Diseño

### Datos

`Turn` gana un campo opcional `arrivals?: Arrival[]` (también en el schema
zod de partidas guardadas). Partidas viejas: sin campo, sin tarjetas, sin
migración.

```ts
interface Arrival {
  name: string;
  attitude: Attitude;
  portrait: PortraitId | null;
  /** Primera oración de `description`; vacío si no hay. */
  blurb: string;
  returning: boolean;
  /** Solo si no es "Ileso" (ver domain/health). */
  health: HealthLabel | null;
}
```

Se calcula en `TurnEngine.commit` comparando el estado base con el aplicado
(función pura en `domain/`, testeable):

- Nuevo: NPC presente cuyo nombre no existía antes.
- Reencuentro: NPC que existía con `present: false` y ahora `present: true`.
- Orden: el del estado nuevo.

### Tarjeta en el registro

- Se dibuja en `TurnLog` después de la narración del turno, y en el turno en
  vuelo cuando llegan los cambios.
- Retrato `NpcAvatar` grande, nombre, etiqueta de actitud (aliado / neutral /
  hostil) y borde del color de la actitud, `blurb` debajo.
- Reencuentro: "Vuelve a aparecer · " delante del texto, más `HealthTag` si
  `health` no es null.
- Animación de entrada corta solo en el turno en vivo (mismo criterio
  `animated` que el resto del registro).

### Agrupación

Al dibujar, las llegadas del mismo turno con igual nombre base (nombre sin
número final: "Goblin 2" → "Goblin") y la misma actitud se unen en una
tarjeta "Goblin ×N" con el retrato del primero. Un nombre sin número final no
se agrupa. Se guardan sin agrupar; agrupar es solo presentación.

### Emboscada

- Condición: el turno trae `combat_start` y al menos una llegada hostil.
- Franja que baja desde arriba, ancho de la columna, "⚔ ¡Emboscada! ⚔" y la
  fila de retratos con nombre de las llegadas hostiles (agrupadas igual: un
  retrato por grupo con un globito "×N").
- Como máximo 4 lugares en la fila: si hay más grupos, el cuarto es una ficha
  "+N" con los restantes. Una sola línea, sin scroll horizontal; los retratos
  se achican en pantallas angostas.
- Se va sola a los 2,5 s o al tocarla. Solo en vivo, no al reabrir.
- Reemplaza al toast "¡Iniciativa!" en ese turno. Si el combate arranca sin
  llegadas hostiles, queda el toast "¡Iniciativa!" de hoy.

### Toasts

Se elimina el toast "Nuevo personaje" de `buildTurnToasts`.

### Accesibilidad

- La tarjeta se suma al anuncio del turno ("Aparece: Goblin ×3, hostil").
- La franja respeta `prefers-reduced-motion` (aparece sin desplazarse).

## Queda para quien construya

- Animaciones concretas (en `animations/motion.ts`, en línea con las
  existentes).
- Estilos exactos de la tarjeta y la franja, siguiendo los colores de actitud
  que ya usan `.avatar` y `.message--*`.
- Cómo cortar la primera oración de forma robusta.
