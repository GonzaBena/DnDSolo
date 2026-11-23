# Auditoría del sitio — 2026-11-23

Análisis de DungeonSolo en cinco ejes: seguridad, rendimiento, modularidad y mantenibilidad, SEO y accesibilidad. Basado en el código de `main` (`bca7df8`) y un build de producción.

## Prioridades

1. [x] CSP y cabeceras de seguridad, para proteger la API key.
   - Hecho: CSP con hashes vía `security.csp` (`astro.config.mjs`); Zod en modo `jitless` (`src/domain/zod.ts`) para no necesitar `eval`. Verificado en build de producción: todas las páginas, una partida cargada y Google Identity sin violaciones.
   - Pendiente: `frame-ancestors`, HSTS y `X-Content-Type-Options` solo funcionan como cabeceras HTTP, no en `<meta>`. Hay que ver si el CDN de Hostinger permite agregarlas.
2. [x] Metadatos SEO, `robots.txt`, sitemap y `noindex` en las páginas de la app.
   - Hecho: `site` en `astro.config.mjs`; en `Base.astro`, descripción, canonical sin barra final, Open Graph y Twitter Card; `noindex` en `/play`, `/character`, `/generator` y `/settings`; título de la home con palabras clave; JSON-LD `WebApplication`; `robots.txt` y `sitemap.xml` como endpoints prerenderizados (`/`, `/docs`, `/credits`).
   - Imagen de vista previa de 1200×630 en `public/og-image.png`, con tarjeta `summary_large_image`.
   - Pendiente: dar de alta el sitemap en Google Search Console (ver "Para después").
3. [ ] Arreglar el `aria-live` del log de narración.
4. [ ] Cargar el SDK de Gemini solo cuando se usa y pasar a `zod/mini`.
5. [ ] Sacar los scripts inline de `index.astro` y `settings.astro` a módulos con tests.

## Para después

- [ ] Push de `main` (CSP + SEO ya mergeados localmente; el push publica en Hostinger).
- [ ] Google Search Console, cuando propague el DNS:
  1. search.google.com/search-console → agregar propiedad **Prefijo de URL** `https://dungeonsolo.com.ar`.
  2. Verificar con **registro DNS TXT** (hPanel → Dominios → DNS).
  3. **Sitemaps** → enviar `sitemap.xml`.
  4. Opcional: **Inspección de URLs** en `/` → solicitar indexación. Bing Webmaster Tools importa todo desde Search Console.
- [ ] Revisar la vista previa al compartir con opengraph.xyz o developers.facebook.com/tools/debug.
- [ ] Cabeceras HTTP (`frame-ancestors`, HSTS, `X-Content-Type-Options`): ver si el CDN de Hostinger permite agregarlas.

## 1. Seguridad

**Lo que está bien**

- Refresh token de Drive en una cookie cifrada con AES-256-GCM, `httpOnly`, `secure`, `sameSite=strict`, limitada a `/api/drive` (`src/server/seal.ts`, `src/server/driveRoute.ts`).
- Las rutas de la API solo aceptan POST con JSON (`isJsonPost`), lo que frena CSRF simple sin tokens.
- Los errores nunca filtran tokens; las llamadas a Google tienen timeout de 10 s.
- No hay `innerHTML`, `set:html` ni `eval`. Las partidas importadas pasan por `migrateSave` y se validan con Zod.
- Fuentes propias, sin CDN de terceros.

**Riesgos**

- **No hay CSP ni cabeceras de seguridad** (`Content-Security-Policy`, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, HSTS). La API key de Gemini vive en `localStorage` (`src/persistence/settings.ts`): cualquier XSS o dependencia comprometida puede leerla. La CSP es la defensa principal.
- Sin límite de peticiones en `/api/drive/*` (riesgo bajo).
- Falta `pnpm audit` o Dependabot en el flujo.

## 2. Rendimiento

| Chunk | Tamaño | Gzip | Qué es / dónde carga |
|---|---|---|---|
| `settings.*.js` | 395 KB | 73 KB | SDK `@google/genai`, en `/settings`, `/play` y `/generator` |
| `client.*.js` | 209 KB | 65 KB | React |
| `schemas.*.js` | 196 KB | 54 KB | Zod v4 completo |
| `motion.*.js` | 36 KB | 14 KB | anime.js, en todas las páginas |

- `/settings` carga el SDK entero de Gemini solo para listar modelos: usar `import()` bajo demanda o `fetch` a la API REST.
- `zod/mini` reduciría bastante el bundle con los mismos esquemas.
- La clase `entering` oculta el contenido hasta que corre la animación (límite de 1,5 s): empeora el LCP.
- Retratos: 3,1 MB de webp 512×512 mostrados como avatares chicos. Variantes de 128/256 con `srcset`.
- Fuentes: falta `preload` del woff2 latino de Fraunces y Nunito.
- Confirmar que Hostinger sirve `/_astro/*` con `Cache-Control: immutable`.

## 3. Modularidad y mantenibilidad

**Lo que está bien:** capas separadas (`domain`, `rules`, `engine`, `llm`, `persistence`, `sync`, `server`), dependencias externas detrás de interfaces (`LLMClient`, `GameRepo`, `RemoteGameStore`, `DriveAuth`) con versiones falsas para tests, ~50 archivos de test, TypeScript estricto, Zod en los límites con el modelo.

**Para mejorar**

- `src/pages/index.astro` (677 líneas) y `settings.astro` (430): cientos de líneas de DOM manual en `<script>` sin tests. Moverlas a `src/home/` y `src/settings/`.
- `src/game/Game.tsx` (824 líneas): dividir en hooks (`useTurn`, `useDrawers`, `useSceneState`).
- `src/game/game.css` (1492 líneas): partir por componente.
- Dos estilos conviviendo (DOM manual en Astro, React en islas): definir un criterio y documentarlo.

## 4. SEO

- Sin `<meta name="description">`, Open Graph ni Twitter Card.
- Sin `robots.txt`, `sitemap.xml` ni `<link rel="canonical">` (`@astrojs/sitemap` + `site` en `astro.config.mjs`).
- Título de la home "Bienvenida · DnDSolo": sin palabras clave.
- `/play`, `/character`, `/generator` y `/settings` no tienen contenido indexable: `noindex`.
- JSON-LD `WebApplication` en la home.
- Bien: `lang="es-AR"`, HTML prerenderizado, guía con contenido real.

## 5. Accesibilidad

**Lo que está bien:** `<dialog>` nativo con `showModal`, botones de íconos con `aria-label`, `:focus-visible` global, respeta `prefers-reduced-motion`, el header del juego reaparece al recibir foco, contraste del texto secundario AA (5,7:1 claro, 6,7–7,8:1 oscuro).

**Problemas**

- El log de narración (`src/game/Game.tsx:580`) tiene `aria-live="polite"` sobre todo el log mientras el efecto de máquina de escribir agrega texto: el lector de pantalla anuncia fragmentos o repite. Usar `role="log"` + `aria-busy` durante el streaming y anunciar solo la narración final.
- El campo de acción tiene `outline: none` y solo cambia el color del borde (`src/game/game.css:931`): indicador de foco débil (WCAG 2.4.11).
- Falta un "saltar al contenido".
- El botón de tema podría usar `aria-pressed`.
- La animación de entrada oculta el contenido en el primer instante.
