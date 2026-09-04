import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Same reasoning as the root vitest.config.ts: `@polaris/db`'s Prisma
// client reads process.env.DATABASE_URL at module-init time, so it must be
// loaded before any test file imports it — this workspace has its own
// Vitest config (Vue plugin + happy-dom) and doesn't inherit the root
// config's dotenv loading.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
config({ path: path.join(repoRoot, '.env') });

/**
 * The API port is fixed (not ephemeral) so it can be baked into
 * VITE_API_BASE_URL at config time — the mounted apps/web pages read
 * import.meta.env.VITE_API_BASE_URL exactly as they would in a real
 * browser, so the port here must match what product-flow.test.ts passes to
 * `app.listen()`.
 */
const API_PORT = 34099;

export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(`http://127.0.0.1:${API_PORT}`),
  },
  test: {
    environment: 'happy-dom',
    // happy-dom enforces Same-Origin Policy on fetch() like a real browser
    // — the page's own origin must match the API's registered CORS origin
    // (real @fastify/cors, not a test bypass) or every fetch from the
    // mounted app is blocked client-side before it even reaches the server.
    environmentOptions: {
      happyDOM: {
        url: 'http://localhost:5173/',
      },
    },
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
