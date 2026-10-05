import { defineConfig } from 'astro/config';

// Public homepage + private /garage page. Talks to the FastAPI backend.
export default defineConfig({
  // public address: used for link previews (og:image needs a full URL) and the canonical link
  site: 'https://rusyaidi.is-a.dev',
  server: { port: 4321 },
});
