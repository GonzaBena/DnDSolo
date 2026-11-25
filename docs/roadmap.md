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

### 3. Subida de nivel y botín como momentos propios ✓ (hecho 2026-11-24)
- Subida de nivel a pantalla completa con lo que se ganó.
- Objeto obtenido como tarjeta de botín que vuela al inventario (botón Info).
- Misión cumplida o fallida: franja de pergamino que se sella o se quema.

## Pendiente de diseñar (darle una vuelta)

### Ambiente
- Efectos de sonido en los momentos clave ✓ (hecho 2026-11-24): activados
  por defecto, switch en el menú del engranaje.
- Después: música de fondo y sonido de cada lugar (murmullo de taberna,
  goteo de mazmorra). Debe salir de datos que la app ya tiene, sin sumarle
  trabajo al LLM.
- Tinte de fondo según la escena: postergado (mucho trabajo para lo que
  aporta).
- Descartado: tipografía según la voz del NPC (la burbuja ya alcanza).

### Continuidad ✓ (hecho 2026-11-24)
- "Anteriormente en…" al volver después de 12 horas: resumen, misiones en
  curso y dónde quedaste. Sin llamadas nuevas al LLM.
- Página "Tu campaña" (`/campaign`): números, crónica con línea de tiempo y
  bestiario de personajes y monstruos. Se llega desde Info, la portada y el
  epílogo al morir.
- Descartado: "terminar sin morir" (la historia puede seguir) y contar
  monedas o daño (se juega por la historia).

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
- El DM repite algunas frases a lo largo de la partida.
- Reglas: subida de nivel con elecciones y ficha recalculada ✓ (hecho
  2026-11-25, etapa 1): la partida guarda las elecciones, la pantalla de
  nivel pide las del nivel nuevo y las partidas viejas se actualizan desde
  un aviso.
- Nota "Fuera del SRD" ✓ (hecho 2026-11-25): texto libre que el DM lee
  cada turno (trasfondos, linajes, etc. del Player's Handbook) y subclase de
  tu manual elegida al subir de nivel o desde Info.
- Reglas, etapa 2 ✓ (hecho 2026-11-25): las 12 clases y sus subclases
  del SRD llegan al nivel 10, con los conjuros de nivel 3 a 5.
- Reglas, etapa 3: niveles 11 a 20 (conjuros de nivel 6 a 9, Arcanum
  místico del brujo, dones épicos).
- Tiradas con suspenso: el dado gira un poco más; animación propia para 20 y 1
  naturales.
- Mostrar la CD después de tirar: "Necesitabas 15, sacaste 17 ✓".
- Tiradas de muerte con más dramatismo: latido, pantalla que se oscurece.
