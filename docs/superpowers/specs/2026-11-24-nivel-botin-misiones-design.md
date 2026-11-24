# Subida de nivel, botín y misiones como momentos propios

## Intención
Punto 3 del roadmap de puesta en escena. Hoy subir de nivel, conseguir un
objeto y cerrar una misión salen como toasts casi iguales, y el de nivel no
dice nada concreto. La idea es que cada uno tenga su momento en pantalla
sin cargar el chat: el usuario dejó el combate en suspenso justamente por
eso.

## Objetivos
- Subir de nivel se siente como un hito: pantalla completa con lo que se ganó.
- Cumplir o fallar una misión tiene su propia franja.
- Conseguir un objeto se ve, pero no frena la lectura.

## No objetivos
- No tocar el prompt ni el schema.
- No arreglar los PG máximos al subir de nivel (anotado aparte en el roadmap).
- "Nueva misión" y "Objeto usado o perdido" siguen como toasts.

## Anti-objetivos
- Que el botín interrumpa: pasa casi en cada turno y cansaría como el combate.
- Mostrar en la pantalla de nivel algo que la app no calcula (ej. "+X PG").

## Enfoques considerados
1. **Sumar cada momento a lo existente** (elegido): pantalla de nivel como
   componente propio, misiones como tipos nuevos de la cola de franjas
   (`bannerQueue.ts`), botín como una variante animada del toast. Poco código
   y no toca el capítulo ni la emboscada.
2. **Una sola cola de "momentos"** para franjas, nivel y botín. Más prolijo a
   futuro, pero rehace la cola que recién quedó estable; hoy no hace falta.

Peso de cada momento (opción A, elegida por el usuario): grande solo lo raro.

## Diseño

### Subida de nivel
- Pantalla completa que tapa el juego y se cierra solo con un botón "Seguir".
- Muestra: "¡Nivel N!", el nombre del personaje, los rasgos del nivel nuevo
  (nombre y resumen, de los datos de la clase), el bonificador de competencia
  si sube, y la subclase si este nivel la trae (y sus rasgos de ese nivel).
- Sin rasgos conocidos (clase sin datos, partidas viejas) muestra solo el
  nivel y el nombre.
- Sale después de las franjas del turno, para no taparlas.
- Reemplaza el toast "¡Subiste de nivel!".
- Detectado del cambio de nivel entre el estado previo y el aplicado, como hoy.

### Misión cumplida o fallida
- Dos tipos nuevos en la cola de franjas: `quest-completed` (pergamino que se
  sella) y `quest-failed` (pergamino que se quema), con el título de la misión.
- Van detrás del capítulo y la emboscada del mismo turno.
- Reemplaza el toast "¡Misión completada!"; la fallida hoy no muestra nada.

### Botín
- El toast "Objeto obtenido" pasa a ser una tarjeta chica con el nombre (y
  ×N) que aparece un momento y vuela hasta el botón "Info" del panel del
  personaje, donde está el inventario.
- No bloquea nada; varios objetos del mismo turno salen escalonados.
- Con `prefers-reduced-motion` no vuela: aparece y se desvanece.

## Queda a criterio de quien lo construya
- La estética exacta del pergamino, el sello y la quema, dentro del estilo de
  las franjas existentes.
- Duraciones y curvas de las animaciones.
- Si la pantalla de nivel se encola o se muestra al vaciarse la cola de
  franjas, siempre que salga después de ellas.
