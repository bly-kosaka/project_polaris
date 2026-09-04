import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Pinned so `include` resolves against the repo root regardless of the
// invoking CWD — otherwise `yarn workspace @polaris/analyzer test` (which
// runs with CWD=packages/analyzer) silently matches nothing, since Vitest's
// `root` defaults to CWD, not the config file's location.
const repoRoot = path.dirname(fileURLToPath(import.meta.url));

// `yarn workspace @polaris/db run test` runs with that package's directory
// as CWD, not the repo root — dotenv's default `.env` lookup would miss the
// root-level .env entirely, so the path is resolved explicitly instead
// (same reasoning as packages/db/prisma.config.ts).
config({ path: path.join(repoRoot, '.env') });

export default defineConfig({
  root: repoRoot,
  test: {
    // Backend-only (F-06, 41_Sprint_5_Plan_Final_Review.md) — apps/web and
    // apps/product-e2e each have their own Vitest config with the Vue
    // plugin + happy-dom, run via their own `yarn workspace ... run test`.
    // A bare `{apps,packages}/*` glob here would double-run their tests
    // through `yarn test:backend` (re-introducing the double-execution
    // F-03 was meant to fix) and could fail to transform .vue files anyway
    // since this config has no Vue plugin registered.
    include: ['packages/*/src/**/*.test.ts', 'apps/{api,worker}/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // packages/db's PostgreSQL integration tests share one beforeEach
    // resetDatabase() — safe only when test files never run concurrently
    // against the same database (32_Sprint_3_Plan_Review.md F-04).
    fileParallelism: false,
  },
});
