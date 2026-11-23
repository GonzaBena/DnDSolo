// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  // Pages stay prerendered; only the /api/drive routes (prerender = false) run on the server.
  adapter: node({ mode: 'standalone' }),
});
