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
- Una casilla "Mi subclase no es la del SRD" que deja de aplicar la subclase
  del SRD (ficha, subida de nivel y bloque de reglas del DM).

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

- `Character.outsideSrd: { note: string; customSubclass: boolean }`
  (por defecto `{ note: "", customSubclass: false }`), migración v17 → v18.
  Nota de hasta 1000 caracteres.
- **Creación:** `CharacterInput` lleva la nota; el generador pasa su
  `outsideSrdNote` sin la frase fija ("Eso no lo tengo…"), solo lo que se
  pidió y con qué se reemplazó. El formulario manual suma un campo de texto
  opcional "Fuera del SRD".
- **Edición en partida:** sección "Fuera del SRD" en Info, con el texto y la
  casilla; se guarda con `TurnEngine.updatePlayer`.
- **DM:** el bloque de reglas (`rulesBlock.ts`) agrega, si hay nota:
  "Fuera del SRD (lo anotó el jugador; aplicalo con lo que sepas del
  Player's Handbook 2024): …". Con `customSubclass`, no muestra ni ofrece la
  subclase del SRD ni sus rasgos, y dice "subclase fuera del SRD (ver nota)".
- **Ficha:** con `customSubclass`, `buildSheet` no aplica rasgos, PG,
  elecciones ni defensa de la subclase del SRD (también al recalcular en la
  subida de nivel), y la pantalla de nivel no muestra sus rasgos. El dato
  tiene que viajar con las elecciones guardadas para que el recálculo lo
  respete.

## Queda para quien construya

- Cómo llega `customSubclass` a `buildSheet` (campo opcional en
  `CharacterChoices` o parámetro).
- Qué hace la app si el DM manda el cambio `subclass` del SRD con la casilla
  marcada (propuesta: rechazarlo).
