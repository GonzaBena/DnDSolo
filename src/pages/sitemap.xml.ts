import type { APIRoute } from "astro";

/** Pages with content of their own. The app screens (play, character,
    generator, settings) render from the browser's storage and are noindex. */
export const INDEXED_PATHS = ["/", "/docs", "/credits", "/privacy", "/terms"] as const;

export const GET: APIRoute = ({ site }) => {
  const urls = INDEXED_PATHS.map((path) => `  <url><loc>${new URL(path, site)}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
