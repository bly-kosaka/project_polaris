import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Pinned so `include` resolves against the repo root regardless of the
// invoking CWD — otherwise `yarn workspace @polaris/analyzer test` (which
// runs with CWD=packages/analyzer) silently matches nothing, since Vitest's
// `root` defaults to CWD, not the config file's location.
const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: repoRoot,
  test: {
    include: ['{apps,packages}/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // packages/db's PostgreSQL integration tests share one beforeEach
    // resetDatabase() — safe only when test files never run concurrently
    // against the same database (32_Sprint_3_Plan_Review.md F-04).
    fileParallelism: false,
  },
});
