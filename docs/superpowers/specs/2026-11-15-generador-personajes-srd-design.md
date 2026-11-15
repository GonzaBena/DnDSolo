# Generador de personajes con reglas SRD 5.2

Fecha: 2026-11-15 · Estado: borrador para aprobación

## Intención

Dos usos con una misma base de reglas:

1. **Generar personajes.** El jugador escribe un texto con la historia de su
   personaje y la app le propone **3 alternativas de personaje completo**
   (especie, clase, subclase si el nivel la habilita, trasfondo, atributos,
   HP, CA, competencias, rasgos, hechizos, equipo). El jugador elige una, la
   **copia a su propia ficha** y la usa para completar el formulario de
   creación de la partida.
2. **Subir de nivel.** Cuando el jugador le pregunta al DM en la partida qué
   gana al subir de nivel, el DM responde con las reglas reales, no de
   memoria.

El objetivo de fondo es que la IA no alucine reglas: se aplica el mismo
principio que ya rige el juego, **el modelo narra, el código arbitra**.

## Metas

- Las fichas generadas son correctas según las reglas de 2024 (SRD 5.2) en
  todo lo que el SRD cubre.
- Todos los números (modificadores, bonificador de competencia, HP, CA,
  espacios de conjuro, CD y ataque de conjuros) los calcula el código.
- El modelo solo elige entre opciones válidas y escribe el texto narrativo.
- El DM puede explicar qué se gana en cada nivel usando datos de la app.

## No-metas

- La app **no guarda ni gestiona** la ficha completa durante la partida. Se
  mantiene la decisión actual (`src/domain/types.ts`): la ficha vive con el
  jugador y la app guarda solo nombre, especie, clase, nivel, trasfondo e
  inventario.
- No hay editor de fichas, ni tirada de atributos, ni multiclase.
- No se incluye contenido fuera del SRD 5.2 (subclases, trasfondos, especies
  o dotes del *Player's Handbook* que no estén en el SRD).

## Anti-metas (sería un fracaso aunque funcione)

- Que un número de la ficha lo haya inventado el modelo.
- Que el DM afirme una regla que no está en los datos sin advertirlo.
- Que el jugador tenga que pagar con su key un prompt enorme (no se manda el
  SRD entero).

## Restricciones

- Edición: **D&D 2024, SRD 5.2** (CC-BY-4.0). Requiere atribución visible
  (texto de licencia de Wizards of the Coast en el pie del sitio o en la
  página del generador).
- Contenido disponible en el SRD 5.2: 9 especies (Dracónido, Enano, Elfo,
  Gnomo, Goliat, Mediano, Humano, Orco, Tiefling), 4 trasfondos (Acólito,
  Criminal, Sabio, Soldado), 12 clases con una subclase cada una, dotes
  limitadas y la mayoría de los hechizos.
- Cuando algo no esté en los datos, el DM y el generador responden: **"Eso
  no lo tengo, revisalo en tu manual o podés disfrutar las alucinaciones."**
  Si el jugador elige la segunda opción, el DM puede improvisar, pero
  siempre aclarando que eso no viene de las reglas.
- Arquitectura existente: todo acceso al modelo pasa por `LLMClient`
  (`generateStructured` con JSON Schema y validación Zod del lado del
  llamador, con un reintento). Sitio estático, clave del usuario (BYOK).
- Identificadores en inglés; textos visibles y datos de reglas en español.
  UI interactiva en React.

## Enfoques considerados

- **A. Datos estructurados y cálculo en código (elegido).** Se codifica en
  el repo como datos tipados lo que el SRD define de forma cerrada. El
  modelo elige entre esas opciones y el código calcula los números. Es el
  más confiable y encaja con la arquitectura actual. Su costo es cargar los
  datos una sola vez.
- **B. Fragmentos de texto del SRD en el prompt.** Requiere menos trabajo,
  pero deja la aritmética en manos del modelo, que es justo donde más se
  equivoca (HP, bonos, espacios de conjuro). Descartado.
- **C. Mandar el SRD completo en cada pedido.** Son cientos de miles de
  tokens por pedido, que paga el usuario con su key, y es lento. Descartado.

Lo eligió el usuario: A.

## Diseño

### 1. Datos de reglas (`src/rules/`)

Módulo nuevo, solo datos y funciones puras, sin dependencias del modelo.

- `species`: id, nombre, tamaño, velocidad y rasgos (nombre y descripción
  breve en español).
- `backgrounds`: id, nombre, los 3 atributos que pueden subir (+2/+1 o
  +1/+1/+1, regla de 2024), dote de origen, 2 competencias de habilidad,
  herramienta y opciones de equipo.
- `classes`: id, nombre, dado de golpe, atributo principal, salvaciones,
  habilidades elegibles y cuántas, competencias de armas y armaduras,
  opciones de equipo inicial, tabla de progresión niveles 1–20 (rasgos por
  nivel, bonificador de competencia, recursos de clase, trucos conocidos,
  hechizos preparados y espacios), nivel de subclase y la subclase del SRD
  con sus rasgos por nivel.
- `feats`: dotes del SRD (origen, generales, estilos de combate y dones
  épicos) con requisitos y descripción breve.
- `spells`: nombre, nivel, escuela, clases que lo tienen y una línea de
  descripción. La descripción completa no hace falta para la ficha.

Cada entrada lleva `source: "SRD 5.2"`. Los tests verifican la integridad:
ids únicos, 20 niveles por clase y referencias cruzadas válidas.

### 2. Cálculo de la ficha (`src/rules/buildSheet.ts`)

Recibe las **elecciones** y devuelve la ficha completa calculada. Las
elecciones son: especie, clase, nivel, trasfondo, asignación de la matriz
estándar (15, 14, 13, 12, 10, 8), distribución del bonus de trasfondo,
habilidades, opción de equipo, hechizos y las elecciones de nivel (mejoras
de atributo o dotes en los niveles que corresponda).

- Valida cada elección contra los datos y devuelve errores con nombre de
  campo si algo no es válido.
- Calcula: modificadores, bonificador de competencia, HP (máximo en nivel 1
  y promedio fijo en los niveles siguientes), CA según la armadura del
  equipo elegido, salvaciones, habilidades, iniciativa, percepción pasiva,
  espacios de conjuro, CD y ataque de conjuros, y la lista de rasgos hasta
  el nivel.

Es una función pura y es la parte con más tests.

### 3. Generación con IA (`src/rules/generateOptions.ts`)

- Entrada: historia del jugador y nivel (lo elige el jugador; por defecto 1).
- El modelo devuelve **3 conjuntos de elecciones** (no fichas) más, para
  cada uno, nombre sugerido, trasfondo narrativo y una línea explicando por
  qué encaja con la historia.
- El JSON Schema usa `enum` con los ids de los datos. La respuesta se valida
  con Zod y después con `buildSheet`. Si alguna opción es inválida se
  reintenta una vez, igual que en `TurnEngine`; si vuelve a fallar se
  muestran las válidas y un error claro.
- El prompt incluye solo el catálogo compacto (ids y nombres; para el nivel
  pedido, las opciones de clase y subclase disponibles), no descripciones
  largas.
- Si la historia pide algo fuera del SRD (por ejemplo, "Embaucador
  Arcano"), el modelo elige lo más cercano y lo aclara con la frase
  acordada.

### 4. Interfaz (página de personaje)

Una isla React nueva en `character.astro`, encima del formulario actual:

```
┌ ¿Tenés una historia? ─────────────────────────┐
│ [ textarea con la historia                  ]  │
│ Nivel [ 1 ]              [ Generar opciones ]  │
└────────────────────────────────────────────────┘
┌ Opción 1 ─────┐ ┌ Opción 2 ─────┐ ┌ Opción 3 ─────┐
│ Nombre        │ │ ...           │ │ ...           │
│ Orco Bárbaro  │ │               │ │               │
│ por qué encaja│ │               │ │               │
│ [Ver ficha]   │ │               │ │               │
└───────────────┘ └───────────────┘ └───────────────┘
Ficha completa: atributos, HP, CA, habilidades, rasgos,
hechizos, equipo · [Copiar ficha] [Usar este personaje]
```

- **Copiar ficha:** copia texto plano legible (y Markdown) al portapapeles.
- **Usar este personaje:** completa el formulario existente (nombre,
  especie, clase, nivel, trasfondo); el jugador puede editarlo antes de
  crear la partida.
- El formulario actual sigue funcionando sin el generador.

### 5. Cambio de listas existentes

- `RACES` pasa a ser las 9 especies del SRD 5.2 y se obtiene de
  `src/rules/`. `CLASSES` también se obtiene de ahí.
- Las partidas guardadas con "Semielfo" o "Semiorco" siguen cargando: el
  campo es texto libre en el estado guardado, así que no hace falta
  migración.
- Se agrega `subclass: string | null` opcional a `Character` (con
  migración de `GAME_STATE_VERSION`) para que el DM sepa qué rasgos tiene
  el personaje.

### 6. El DM y la subida de nivel

- Al armar el prompt de cada turno, se agrega un bloque **REGLAS DEL
  PERSONAJE** compacto: los rasgos de clase y subclase del nivel actual y
  del siguiente (nombre y una línea cada uno), los espacios de conjuro y el
  bonificador de competencia. Pesa unos cientos de tokens.
- Nueva instrucción en `DM_SYSTEM_PROMPT`: para preguntas de reglas, usar
  ese bloque. Si lo que se pregunta no está ahí, responder con la frase
  acordada, y si el jugador elige las alucinaciones, aclarar que es
  improvisado.
- Nuevo tipo de cambio de estado `level` para que el DM pueda subir el
  nivel cuando la historia lo justifique o el jugador lo pida, validado
  entre 1 y 20 y solo de a uno.

## Decisiones del usuario

- Ficha completa, para copiar a la ficha propia; la app no la gestiona.
- Edición 2024 / SRD 5.2.
- Fuera del SRD: "Eso no lo tengo, revisalo en tu manual o podés disfrutar
  las alucinaciones."
- Enfoque A (datos estructurados y cálculo en código).

## Aclaraciones tras la revisión

- **Alcance de las elecciones.** "Ficha completa" incluye todas las
  elecciones que el SRD 5.2 pide:
  - De clase: estilo de combate, maestría con armas, pericia, invocaciones
    y don del pacto, metamagia, orden divina y orden primigenia.
  - De especie: linaje dracónido, linajes de elfo y gnomo, legado tiefling,
    ascendencia de goliat, y la habilidad y la dote extra del humano.
  - De dote o trasfondo: los hechizos de Iniciado en la Magia y la
    herramienta del trasfondo.

  Todas son parte del modelo de datos, del esquema y de `buildSheet`. Para
  que no sea un salto gigante se construye por fases: primero la ficha
  completa para los niveles 1–4, que cubre la creación en la mayoría de las
  partidas, y después hasta el 20. Mientras una fase no esté, el generador
  limita el nivel máximo a lo que ya cubre.
- **Formulario y personaje guardado.** El formulario agrega dos selects:
  "Trasfondo (reglas)", que es el trasfondo del SRD, y "Subclase", que se
  habilita al llegar al nivel que la da. El campo de texto "Trasfondo"
  actual queda para la historia, y el generador pone ahí el texto
  narrativo. `Character` suma `srdBackground` y `subclass`, los dos
  opcionales y guardados como id. Clase y especie también se guardan por
  id, además de la etiqueta. El equipo generado no entra al inventario: el
  inventario son solo los objetos que entrega el DM, y eso no cambia.
- **Bloque de reglas del DM cuando no hay coincidencia.** Se buscan clase y
  especie por id. Las partidas viejas se buscan por la etiqueta en
  español. Lo que no coincide (Semielfo, una subclase fuera del SRD, un
  personaje sin subclase elegida) no se manda: el bloque incluye solo lo
  que coincide y una línea que avisa qué falta. Así el DM usa la frase
  acordada en vez de suponer. No se asume la subclase del SRD.
- **"Disfrutar las alucinaciones" vale solo en la partida.** En el
  generador no hay un camino sin verificar: elige lo más parecido del SRD y
  avisa con la nota. Así se cumple la anti-meta de que ningún número lo
  invente el modelo.

## Decisiones mías (revisables)

- Atributos con la matriz estándar; sin tirada ni compra por puntos.
- HP con promedio fijo después del nivel 1.
- El nivel lo elige el jugador, no la IA.
- Descripciones de hechizos en una sola línea.
- Atribución CC-BY-4.0 en el pie del sitio.
- Subclase guardada en `Character` y tipo de cambio `level` para el DM.

## Lo que queda para quien lo construya

- De dónde transcribir los datos: el PDF oficial del SRD 5.2 o un dataset
  abierto ya estructurado, verificando contra el PDF. También cómo traducir
  los nombres al español: si existe traducción oficial, se usan sus nombres.
- Orden de carga sugerido: especies, trasfondos y dotes de origen; después
  las clases con su progresión; por último los hechizos.
- Formato exacto del texto copiado y estilos de las tarjetas, siguiendo los
  tokens de diseño actuales.
