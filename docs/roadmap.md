# Roadmap: puesta en escena

El MVP está cumplido. Esta etapa no suma sistemas nuevos: hace que lo que el DM
ya manda (NPCs, escena, ubicación, nivel, objetos, misiones) se sienta en
pantalla. Todo es trabajo de presentación, sin tocar el prompt ni el schema
salvo que se indique.

## Orden de trabajo

### 1. Entradas de personajes ✓ (hecho 2026-11-24)
- Tarjeta de entrada en lugar del toast: retrato animado, nombre grande, una
  línea de `description` y borde según actitud (aliado / neutral / hostil).
- Enemigos agrupados: tres goblins → una tarjeta "×3".
- Emboscada: NPC hostil + inicio de combate en el mismo turno → pantalla breve
  de combate con los retratos alineados.
- Reencuentro: NPC conocido que vuelve (`present: false → true`) → "Vuelve a
  aparecer…".

### 2. Título de capítulo al cambiar de ubicación ✓ (hecho 2026-11-24)
- "— La Cripta de Vel —" con la descripción en cursiva, estilo película.

### 3. Subida de nivel y botín como momentos propios
- Subida de nivel a pantalla completa con lo que se ganó.
- Objeto obtenido como tarjeta de botín que vuela al inventario.
- Misión cumplida o fallida: pergamino que se sella o se quema.

## Pendiente de diseñar (darle una vuelta)

### Ambiente
- Tinte de fondo según la escena (combate, taberna, mazmorra), indicado por el
  DM o derivado de la ubicación.
- Sonido opcional, apagado por defecto: dados, espadas, acorde al subir de
  nivel.
- Diálogo con la voz del NPC: usar `voice` para la tipografía o el color.

### Continuidad
- "Anteriormente en…" al retomar una partida: resumen del LLM a partir de los
  hilos y misiones abiertas.
- Diario de la campaña legible: crónica automática de los momentos clave.
- Epílogo al morir o terminar, con estadísticas de la partida.

## En suspenso

### Combate: iniciativa y feedback de daño
Motivo: cargaría mucho el chat con animaciones y pantallas extra en cada
turno de pelea. Ya existe el orden de iniciativa en el panel de escena y la
sacudida de pantalla al recibir daño.
- Barra de iniciativa con retratos (`scene.order`, `turnOf`) y el activo
  resaltado.
- Daño: sacudida del retrato y número flotante; destello en crítico; retrato
  gris o tachado al llegar a 0 PV.
- Pantalla de victoria al terminar el combate (`inCombat → false`) con un
  resumen.

## Ideas sueltas (sin prioridad)
- Reglas: al subir de nivel no se recalculan los PG máximos (ni otras
  estadísticas de la ficha); quedan los del nivel 1.
- Reglas: los datos de clase llegan hasta nivel 4. Del 5 en adelante la
  pantalla de nivel no muestra rasgos ni el aumento de competencia (+3 en 5).
- Tiradas con suspenso: el dado gira un poco más; animación propia para 20 y 1
  naturales.
- Mostrar la CD después de tirar: "Necesitabas 15, sacaste 17 ✓".
- Tiradas de muerte con más dramatismo: latido, pantalla que se oscurece.
