// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Canonical URLs, link previews and the sitemap need absolute addresses.
  site: 'https://dungeonsolo.com.ar',
  integrations: [react()],
  // No Markdown pages; Shiki's inline styles would also clash with the CSP.
  markdown: { syntaxHighlight: false },
  // Pages stay prerendered; only the /api/drive routes (prerender = false) run on the server.
  adapter: node({ mode: 'standalone' }),
  security: {
    // Content-Security-Policy as a <meta> with hashes of every script and style
    // Astro emits. The Gemini API key lives in localStorage, so this is the
    // main guard against an injected script reading it. Hostinger's CDN adds
    // its own CSP header (upgrade-insecure-requests); both policies apply.
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "manifest-src 'self'",
        // Gemini (BYOK), Drive and Google's OAuth endpoints.
        "connect-src 'self' https://generativelanguage.googleapis.com https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com",
        // Google Identity Services may render its consent flow in an iframe.
        "frame-src https://accounts.google.com",
      ],
      scriptDirective: {
        resources: ["'self'", "https://accounts.google.com/gsi/client"],
      },
      styleDirective: {
        resources: ["'self'", "https://accounts.google.com/gsi/style"],
        // The inline <style> Google Identity Services injects on load (for its
        // sign-in button, unused here). If Google changes it, the browser only
        // logs a violation: the OAuth popup keeps working.
        hashes: ["sha256-88QphsXJQwxKP9xXR175ZSMzpaq6Swzj9u3QQ+G2Wig="],
      },
    },
  },
});
