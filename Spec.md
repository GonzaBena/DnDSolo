# Proyecto: DM con IA para D&D (MVP)

## Qué es

Una web donde una IA hace de Dungeon Master. El jugador entra, carga datos
básicos de su personaje y empieza una campaña narrada por la IA. NO es un
gestor de hojas de personaje ni un chat entre jugadores.

## Stack

- Astro + TypeScript (modo estricto), salida 100% estática, sin servidor.
- La pantalla de juego es UNA isla de Svelte (`client:only`). El resto son
  páginas Astro comunes.
- anime.js para animaciones de UI.
- Gemini como LLM, llamado directo desde el navegador con la API key del
  usuario (BYOK). Usá el SDK oficial actual de Google para JS y consultá su
  documentación vigente antes de escribir la integración: no asumas nombres
  de modelos ni de métodos de memoria. El modelo tiene que ser configurable.
- Persistencia local en IndexedDB para el MVP.

## Alcance del MVP (solo esto)

1. **Bienvenida**: pantalla de entrada con "Nueva campaña" y "Continuar".
2. **Configuración**: campo para la API key de Gemini (guardada en
   localStorage, nunca en el código ni en el repo) y selector de modelo.
   Si no hay key, la app lo avisa y lleva a esta pantalla.
3. **Creación de personaje**: nombre, raza, clase, nivel y un trasfondo
   corto opcional.
4. **Juego en solitario**: la IA narra, el jugador responde con texto libre,
   la narración se muestra en streaming.
5. **Tiradas**: cuando el DM pide una tirada, la app muestra un botón, el
   CÓDIGO genera el número y lo muestra en pantalla como un número grande.
   Sin dados 3D ni animación por ahora.
6. **Guardado**: la partida se guarda sola después de cada turno y se puede
   retomar al recargar.

## Fuera de alcance (no lo construyas)

Multijugador, generación de imágenes, dados animados, login, backend,
mapas, combate táctico completo con todas las reglas de D&D.

## Reglas de arquitectura (importantes)

1. **El modelo narra, el código arbitra.** El modelo nunca inventa
   resultados de dados ni modifica el estado directamente. Solo propone.
2. **Respuesta estructurada.** Cada turno el modelo devuelve JSON validado
   contra un esquema, con esta forma como base:

   ```ts
   interface RespuestaDM {
     narracion: string; // texto que ve el jugador
     tiradaRequerida: null | {
       dado: "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";
       motivo: string; // ej: "Sigilo para pasar al guardia"
       dificultad: number | null; // CD si aplica
     };
     cambiosDeEstado: CambioDeEstado[]; // HP, inventario, ubicación, etc.
     eventos: string[]; // etiquetas tipo "dano", "cambio_escena"
   }
   ```

   `eventos` existe para enganchar animaciones más adelante.
   Si el JSON llega inválido, reintentá una vez y después mostrá un error
   claro sin romper la partida.

3. **Memoria en tres capas**, armadas en cada llamada:
   - Estado estructurado (personaje, HP, inventario, ubicación, NPCs,
     misiones) en JSON.
   - Resumen acumulado de la historia, regenerado cada N turnos
     (N configurable, arrancá con 10).
   - Los últimos turnos textuales (arrancá con 6).
     Nunca se manda el historial completo.
4. **Capas separadas e intercambiables**, cada una detrás de una interfaz:
   - `LLMClient`: única puerta al modelo. Mañana puede apuntar a un proxy.
   - `PartidaRepo`: única puerta a la persistencia. Mañana puede ser
     Firestore.
   - `Dados`: función pura que tira; la UI solo muestra el resultado.
   - `MotorDeTurno`: orquesta turno → llamada → validación → aplicar
     cambios → guardar. Sin dependencias de la UI, para poder testearlo.
5. Pensá el estado de partida con un array `jugadores` aunque hoy haya uno
   solo, para no rehacer el modelo cuando llegue el multijugador.

## Estilo

- Interfaz en español rioplatense.
- Estética de ilustración plana, tipo dibujo. Definí colores, tipografías y
  espaciados como variables CSS en un solo lugar.
- Animaciones con anime.js en transiciones de pantalla y aparición de la
  narración. Respetá `prefers-reduced-motion`.
- Código y nombres de dominio en español, comentarios explicando el porqué
  de las decisiones no obvias.

## Forma de trabajo

1. Antes de escribir código, proponé la estructura de carpetas, los tipos
   principales (`EstadoPartida`, `Personaje`, `RespuestaDM`,
   `CambioDeEstado`) y el system prompt del DM. Esperá mi OK.
2. Después avanzá en este orden, con un commit por paso:
   a. Scaffold Astro + react + TS y pantallas vacías navegables.
   b. Configuración y `LLMClient` con una llamada de prueba.
   c. Tipos, `MotorDeTurno` y `Dados` con tests unitarios (Vitest),
   usando un `LLMClient` falso.
   d. Pantalla de juego con streaming y tiradas.
   e. Memoria en tres capas y resumen automático.
   f. Guardado y "Continuar".
   g. Pasada de estilo y animaciones.
3. Al terminar cada paso decime cómo probarlo a mano.

## Criterio de terminado

Puedo cargar mi key, crear un personaje, jugar 30 turnos seguidos con
tiradas, recargar la página y seguir donde estaba, y el DM sigue
recordando nombres, objetos y lugares del principio.
