import { describe, expect, it } from 'vitest';
import { parseLine } from '../parser/parser-chain.js';

describe('parseLine — Combined Log Format', () => {
  const line =
    '192.0.2.10 - - [10/Oct/2023:13:55:36 +0000] "GET /search?q=polaris HTTP/1.1" 200 3312 "https://example.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"';

  it('extracts every field', () => {
    const result = parseLine(line);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') throw new Error('unreachable');
    expect(result.value).toEqual({
      timestamp: '2023-10-10T13:55:36.000Z',
      sourceIp: '192.0.2.10',
      method: 'GET',
      path: '/search',
      query: 'q=polaris',
      status: 200,
      responseBytes: 3312,
      referrer: 'https://example.com/',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
  });
});

describe('parseLine — Common Log Format', () => {
  it('parses without referrer / user-agent', () => {
    const line = '203.0.113.7 - - [10/Oct/2023:13:57:11 +0000] "GET /assets/main.css HTTP/1.1" 200 20481';
    const result = parseLine(line);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') throw new Error('unreachable');
    expect(result.value.path).toBe('/assets/main.css');
    expect(result.value.referrer).toBeUndefined();
    expect(result.value.userAgent).toBeUndefined();
  });
});

describe('parseLine — missing fields', () => {
  it('leaves referrer/UA undefined when marked with "-"', () => {
    const line =
      '192.0.2.55 - - [10/Oct/2023:13:59:01 +0000] "GET /favicon.ico HTTP/1.1" 404 209 "-" "-"';
    const result = parseLine(line);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') throw new Error('unreachable');
    expect(result.value.status).toBe(404);
    expect(result.value.referrer).toBeUndefined();
    expect(result.value.userAgent).toBeUndefined();
  });
});

describe('parseLine — partial parse', () => {
  it('flags a non-numeric status as a warning but keeps the rest of the entry', () => {
    const line =
      '192.0.2.60 - - [10/Oct/2023:14:01:20 +0000] "GET /report.pdf HTTP/1.1" ERR 5120 "-" "-"';
    const result = parseLine(line);
    expect(result.status).toBe('partial');
    if (result.status !== 'partial') throw new Error('unreachable');
    expect(result.value.status).toBeUndefined();
    expect(result.value.path).toBe('/report.pdf');
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'INVALID_STATUS', field: 'status' }),
    ]);
  });
});

describe('parseLine — unsupported format', () => {
  it('fails without matching any parser', () => {
    const result = parseLine('CRITICAL disk usage at 92% on host web-01');
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') throw new Error('unreachable');
    expect(result.warnings[0]?.code).toBe('PARSER_UNSUPPORTED_FORMAT');
  });
});
