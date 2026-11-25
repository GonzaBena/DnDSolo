# Progresión de nivel (etapa 1: mecánica)

## Por qué

Al subir de nivel la ficha no cambia: los PG máximos, los ataques y la CD
quedan como en el nivel en que se creó el personaje, y la mejora de
característica del nivel 4 es solo texto. Elegir qué gana el personaje es
lo mejor de subir de nivel, y hoy no existe.

La app la usa solo el autor; hay partidas en curso que quiere seguir.

## Objetivos

- La partida guarda las elecciones del personaje (`CharacterChoices`) y la
  ficha se recalcula entera con `buildSheet` al subir de nivel.
- Al subir de nivel, el jugador elige a mano lo que trae ese nivel.
- Las partidas viejas se pueden actualizar desde un aviso.

## No objetivos

- Datos de los niveles 5 a 20 y hechizos de nivel 3+: es la etapa 2 (otro
  diseño). Esta etapa funciona con los datos de 1 a 4.
- Un armador manual completo de personajes.
- Cambiar la CA por armaduras encontradas: hoy la CA tampoco cambia; al
  recalcular sale del equipo inicial elegido, como al crear.

## Anti-objetivos

- Sumarle trabajo al DM (prompt o schema del turno).
- Que subir de nivel pueda dejar la partida rota o trabada.

## Enfoques considerados

1. **Guardar elecciones y recalcular con `buildSheet` (elegido).** Una sola
   fuente de verdad para la ficha; reutiliza validación y cálculo.
2. Sumar incrementos sobre `stats` sin elecciones: no sirve para dotes ni
   hechizos y requiere deducir el modificador de Con. Descartado.
3. Para partidas viejas: armar todo a mano (demasiado trabajo para un uso
   raro) o que el LLM deduzca la ficha vieja (adivina). Se eligió que el
   paso 2 del generador **proponga** una ficha válida para el mismo
   concepto y el jugador la acepte o pida otra.

## Diseño

### Datos

- `Character.choices: CharacterChoices | null`. `createCharacter` lo copia
  de `CharacterInput.choices` (ya existe en la entrada); el formulario
  manual sin ficha generada deja `null`.
- `choices.level` es el nivel hasta el que el jugador ya eligió. Si
  `player.level > choices.level`, hay una subida de nivel con elecciones
  pendientes (estado derivado, sin bandera nueva).
- Migración v16 → v17: `choices: null` en cada jugador. Zod del estado
  guardado acepta el objeto (validación de forma, no de reglas).

### Subida de nivel

1. El DM manda el cambio `level` como hoy; `applyChanges` no cambia.
2. Si el jugador tiene `choices` y el nivel nuevo tiene datos
   (`<= LOADED_MAX_LEVEL`):
   - Elecciones pendientes = las de `activeChoices(requiredChoices(nivel
     nuevo), picks)` que faltan en `choices.picks` **o tienen menos picks
     que su `count`**. Lo segundo cubre trucos, conjuros preparados y libro
     de conjuros, que mantienen el id y suben la cantidad con el nivel (y
     suman opciones de nivel de conjuro nuevo). En esas, lo ya elegido
     aparece fijo y se pide solo lo que falta.
   - La pantalla de nivel muestra lo que hoy muestra y, debajo, un selector
     por cada elección nueva (opciones con su resumen; respeta `count`,
     `allowRepeat` y `requires`, incluidas las elecciones que abre una dote
     recién elegida, p. ej. Mejora de característica → 2 características).
   - "Seguir" se habilita cuando `validateChoices` no da errores; los
     errores se muestran junto a la elección.
   - Sin elecciones nuevas, la pantalla solo tiene "Seguir".
   - Al seguir: `buildSheet` con el nivel nuevo y los picks →
     `stats = statsFromSheet(sheet)`; `currentHp` sube lo mismo que subió
     el máximo; `choices` se guarda con el nivel nuevo. El inventario no se
     toca.
3. Si se cierra la app a mitad de elección, al abrir la partida se detecta
   `player.level > choices.level` y la pantalla vuelve a abrirse.
4. Subclase: hoy la elige el DM con el cambio `subclass`. Se mantiene;
   `buildSheet` la incluye por nivel (`hasSubclass`), como ya hace.
5. Sin `choices`, o nivel sin datos (5+): comportamiento de hoy.

### Ficha visible

La pantalla de nivel muestra los PG máximos nuevos ("PG máx: 28 → 36"),
ahora que se recalculan (hoy `levelUp.ts` aclara que no).

### Actualizar partidas viejas

- Se ofrece cuando el jugador tiene `choices === null` y tiene
  `speciesId`, `classId` y `srdBackgroundId` del SRD. Sin esos datos no se
  ofrece.
- Al abrir esa partida aparece un aviso: "Esta partida usa una ficha
  antigua. Actualizala para que suba de nivel con sus PG y elecciones."
  [Cancelar] [Actualizar]. Cancelar solo cierra el aviso; vuelve a salir la
  próxima vez que se abra la partida.
- Actualizar abre una pantalla que llama al paso 2 del generador
  (elecciones) con especie, clase, trasfondo y nivel fijos, y muestra la
  ficha con `SheetView`. Botones: "Usar esta", "Otra propuesta", "Cancelar".
  Necesita la clave del LLM configurada; si no, lo dice.
- "Usar esta": guarda `choices`, reemplaza `stats`, ajusta `currentHp` a
  la misma proporción del máximo (redondeando, mínimo 1 si estaba vivo, 0
  si estaba en 0). Inventario, historia y nombre no se tocan. Si el nivel
  de la partida es > 4, no se ofrece (sin datos).

## Queda para quien construya

- Diseño visual del selector dentro de la pantalla de nivel (scroll en
  teléfono de 320 px).
- Cómo exponer el paso 2 de `generateOptions` para un concepto fijo.
- Tests: migración, recálculo al subir de nivel, elecciones pendientes al
  recargar, PG en proporción al actualizar.

## Decisiones tomadas por Claude (revisables)

- `currentHp` sube lo mismo que el máximo al subir de nivel.
- En la actualización, la vida se conserva en proporción.
- El nombre "Seguir" se mantiene y queda deshabilitado hasta elegir.
- Los avisos y la actualización solo para el primer jugador (es solitario).
