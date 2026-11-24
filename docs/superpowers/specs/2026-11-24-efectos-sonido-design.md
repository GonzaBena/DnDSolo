# Efectos de sonido: diseño

Primera parte de "Ambiente" en `docs/roadmap.md`. Tamaño: cambio chico.

## Por qué

Los momentos fuertes de la partida (emboscada, botín, subida de nivel) ya
tienen su animación, pero se viven en silencio. Un sonido corto en cada uno
les da peso. Esto no debe sumarle trabajo al LLM: cada vez que se le pide algo
más, gasta más tokens y es más fácil que alucine con el tiempo.

## Objetivos

- Un efecto corto para cada momento que la app ya detecta por su cuenta:

  | Momento | Sonido | De dónde sale |
  |---|---|---|
  | Tirada del jugador confirmada | dados, más suave | envío del `RollDialog` |
  | Tirada del enemigo | dados | `EnemyRollCard` cuando entra animada |
  | Capítulo nuevo (primera visita) | golpe grave o cuerno corto | banner `chapter` |
  | Emboscada | espadas desenvainando | banner `ambush` |
  | Daño recibido | golpe seco | la sacudida de pantalla que ya existe |
  | 0 PV / tiradas de muerte | latido | aviso de moribundo |
  | Botín | tintineo de monedas | tarjeta de botín |
  | Misión cumplida / fallida | sello de cera / llamarada | banner `quest` |
  | Subida de nivel | acorde o fanfarria corta | `LevelUpScreen` |
  | Fin de la partida | campana grave | `GameOver` |

- Apagado por defecto. Un botón de parlante en la barra del juego lo prende o
  lo apaga, y la elección se recuerda en cada dispositivo.
- Sección "Sonidos" en el lab, con un botón por momento, para escucharlos y
  elegirlos antes de conectarlos al juego.

## No objetivos

- Música de fondo y sonido de cada lugar (murmullo de taberna, etc.): quedan
  para después, igual que el tinte de fondo.
- Cambiar la tipografía según la voz del NPC: descartado, porque la burbuja
  ya alcanza.
- No se toca el prompt del DM ni el schema de respuesta.

## Anti-objetivos

- Que suene sin que el jugador lo haya pedido.
- Que el sonido llegue tarde respecto de la animación (sobre todo en iOS).
- Que los sonidos cansen: deben ser cortos, sin loops, y que los que se
  repiten seguido (dados) sean discretos.
- Usar sonidos con licencias dudosas.

## Enfoques

1. **Web Audio con un módulo propio (elegido).** Carga y decodifica cada
   sonido una vez. Reproduce sin retraso, permite superponer sonidos y tiene
   volumen general. Lo destraba el toque en el botón de parlante. No suma
   dependencias, y sirve de base para la música y el ambiente más adelante.
2. Elementos `<audio>`: es lo más simple de escribir, pero en iOS tienen
   retraso y hay que destrabar cada sonido. Descartado.
3. howler.js: resuelve lo mismo que el 1, pero sumando una dependencia.
   Descartado.

## Decisiones

- Archivos mp3 cortos en `public/sounds/`. La licencia tiene que ser CC0 o
  equivalente (Kenney, Freesound con filtro CC0, Pixabay). Los que pidan
  atribución se acreditan en `/credits`.
- El jugador escucha y aprueba cada sonido en el lab antes de que entre al
  juego.
- Los dados del jugador y los del enemigo pueden usar el mismo archivo, con
  el del jugador a menor volumen.
- Si el audio no se puede destrabar o un archivo falla, el juego sigue en
  silencio, sin errores visibles.

## Lo que queda al implementador

- Qué archivos concretos se proponen para cada momento (con su fuente y
  licencia anotadas).
- El nombre y la forma exacta del módulo de audio, y cómo se engancha cada
  momento (hook, llamada en el componente, etc.).
- El ícono y la posición exacta del botón de parlante dentro de la barra.
- Si varias tiradas de enemigo en el mismo turno suenan una vez o
  escalonadas.
