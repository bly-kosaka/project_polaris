import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// `yarn workspace @polaris/db run ...` runs with this package's directory as
// cwd, not the repo root — dotenv's default `.env` lookup would miss the
// root-level .env entirely, so the path is resolved explicitly instead.
config({ path: path.resolve(import.meta.dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // process.env directly, not the strict env() helper — `prisma generate`
    // (run via postinstall, with no live DB available) must not fail just
    // because DATABASE_URL isn't set yet; `migrate` still fails clearly on
    // its own when a real connection is actually needed and missing.
    url: process.env.DATABASE_URL ?? '',
  },
});
