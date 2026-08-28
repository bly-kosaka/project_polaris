import { describe, expect, it } from 'vitest';
import { loadEnv } from '../env.js';

const validEnv = {
  NODE_ENV: 'test',
  APP_BASE_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgres://polaris:polaris@localhost:5432/polaris',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'polaris-raw-logs',
  S3_ACCESS_KEY_ID: 'polaris',
  S3_SECRET_ACCESS_KEY: 'polaris123',
  S3_FORCE_PATH_STYLE: 'true',
};

describe('loadEnv', () => {
  it('parses a complete environment', () => {
    const env = loadEnv(validEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });

  it('fails fast when a required value is missing', () => {
    const { DATABASE_URL: _omit, ...incomplete } = validEnv;
    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('defaults NODE_ENV and S3_FORCE_PATH_STYLE when absent', () => {
    const { NODE_ENV: _n, S3_FORCE_PATH_STYLE: _s, ...rest } = validEnv;
    const env = loadEnv(rest);
    expect(env.NODE_ENV).toBe('development');
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });
});
