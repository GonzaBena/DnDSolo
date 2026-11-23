import type { APIRoute } from "astro";

/** App screens carry their own noindex; robots.txt only points to the sitemap. */
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${new URL("/sitemap.xml", site)}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
