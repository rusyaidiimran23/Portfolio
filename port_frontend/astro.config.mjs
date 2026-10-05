import { defineConfig } from 'astro/config';

// Public homepage + private /garage page. Talks to the FastAPI backend.
export default defineConfig({
  server: { port: 4321 },
});
