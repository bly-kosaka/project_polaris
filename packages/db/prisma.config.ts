import 'dotenv/config';
import { defineConfig } from 'prisma/config';

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
