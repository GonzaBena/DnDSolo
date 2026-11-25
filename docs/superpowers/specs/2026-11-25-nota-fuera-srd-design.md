# Nota "Fuera del SRD"

## Por qué

El SRD 5.2 trae poco del Player's Handbook 2024: 4 trasfondos de 16, una
subclase por clase, pocas dotes. El jugador juega con su propia hoja (papel o
dnd.gonzabena.com.ar) y sus dados; DungeonSolo es el DM, no un creador de
personajes. Hace falta que el DM sepa lo que el personaje tiene fuera del
SRD sin que el jugador cargue el personaje entero.

## Objetivos

- Una nota libre por personaje, "Fuera del SRD", que el DM lee cada turno y
  aplica con lo que sabe del Player's Handbook 2024.
- La nota del generador ("pediste Ermitaño, te di Sabio") se guarda como valor
  inicial en lugar de perderse.
- Al llegar al nivel de subclase, el jugador elige la del SRD u "Otra de tu
  manual" con su nombre; con otra, la app deja de aplicar la del SRD (ficha,
  subida de nivel y bloque de reglas del DM).

## No objetivos / anti-objetivos

- Editores de trasfondos, subclases, dotes o especies propias.
- Ajustes numéricos de la ficha desde la nota (velocidad, PG, CA): se
  corrigen como hoy.
- Copiar texto del Player's Handbook en la app.
- Sumarle tareas al DM: la nota es solo información de entrada.

## Enfoques considerados

1. **Nota libre + casilla de subclase (elegido).** Mínimo trabajo para el
   jugador; el modelo ya conoce el PHB.
2. Contenido propio armado con piezas (trasfondo con características,
   habilidades y dote). Descartado: convierte la web en un creador de
   personajes.
3. Solo texto por rasgo al subir de nivel. Descartado: más carga y no cubre
   trasfondos ni linajes.

## Diseño

- `Character.outsideSrd: { note: string; subclass: string | null }`
  (por defecto `{ note: "", subclass: null }`), migración v17 → v18. Nota de
  hasta 1000 caracteres; `subclass` es el nombre de una subclase fuera del SRD.
- **Creación:** no se pide subclase. `CharacterInput` lleva la nota; el
  generador pasa su `outsideSrdNote` sin la frase fija ("Eso no lo tengo…"),
  solo lo que se pidió y con qué se reemplazó. El formulario manual suma un
  campo de texto opcional "Fuera del SRD".
- **Subida de nivel:**
  - Al llegar al nivel de subclase de la clase, si no hay subclase elegida
    (`subclassId === null` y `outsideSrd.subclass === null`), la pantalla de
    nivel pide "Subclase": "<la del SRD> (SRD)" u "Otra de tu manual" con un
    campo de nombre. "Seguir" espera esa elección. Con la del SRD se guarda
    `subclassId`; con otra, `outsideSrd.subclass`.
  - Con subclase fuera del SRD, la pantalla no muestra rasgos de la del SRD y
    dice "Tu subclase está fuera del SRD: revisá tu manual para este nivel".
  - La nota "Fuera del SRD" aparece editable (opcional) en la pantalla.
- **Edición en partida:** sección "Fuera del SRD" en Info con la nota y la
  subclase (SRD / otra con nombre), para corregir o para personajes que ya
  pasaron el nivel de subclase. Se guarda con `TurnEngine.updatePlayer`.
- **DM:** el bloque de reglas (`rulesBlock.ts`) agrega, si hay nota:
  "Fuera del SRD (lo anotó el jugador; aplicalo con lo que sepas del
  Player's Handbook 2024): …". Con subclase fuera del SRD dice
  "Subclase: <nombre> (fuera del SRD)" y no muestra ni ofrece la del SRD.
  El cambio de estado `subclass` del DM se acepta solo si el jugador no
  eligió ninguna subclase (partidas viejas); si no, se rechaza.
- **Ficha:** con subclase fuera del SRD, `buildSheet` no aplica rasgos, PG,
  elecciones ni defensa de la subclase del SRD (también al recalcular en la
  subida de nivel). El dato viaja con las elecciones guardadas para que el
  recálculo lo respete.

## Queda para quien construya

- Cómo llega `customSubclass` a `buildSheet` (campo opcional en
  `CharacterChoices` o parámetro).
- Personajes con elecciones guardadas que ya tienen la subclase del SRD
  aplicada por nivel sin `subclassId`: cómo se ofrece la elección (Info
  alcanza).
