import { describe, expect, it } from 'vitest';
import {
  buildMethodGroupId,
  buildPathGroupId,
  buildSourceIpGroupId,
  buildSourceIpPathGroupId,
  buildStatusGroupId,
  buildTimeBucketGroupId,
  buildUserAgentGroupId,
} from '../observation-set/group-id.js';

describe('Group ID scheme', () => {
  it('is deterministic — same input produces the same id every time', () => {
    expect(buildPathGroupId('/wp-login.php')).toBe(buildPathGroupId('/wp-login.php'));
    expect(buildUserAgentGroupId('Mozilla/5.0')).toBe(buildUserAgentGroupId('Mozilla/5.0'));
  });

  it('produces different ids for different inputs (no accidental collisions in these cases)', () => {
    expect(buildPathGroupId('/a')).not.toBe(buildPathGroupId('/b'));
    expect(buildSourceIpGroupId('192.0.2.1')).not.toBe(buildSourceIpGroupId('192.0.2.2'));
  });

  it('never embeds the raw path, source IP, or user agent as a readable substring', () => {
    expect(buildPathGroupId('/admin/super-secret-path')).not.toContain('super-secret-path');
    expect(buildSourceIpGroupId('203.0.113.55')).not.toContain('203.0.113.55');
    expect(buildUserAgentGroupId('Mozilla/5.0 (evil-bot)')).not.toContain('evil-bot');
  });

  it('leaves small fixed-vocabulary dimensions (status, method) and timestamps readable', () => {
    expect(buildStatusGroupId(404)).toBe('status:404');
    expect(buildMethodGroupId('POST')).toBe('method:POST');
    expect(buildTimeBucketGroupId('5m', '2023-10-10T17:00:00.000Z')).toBe('time:5m:2023-10-10T17:00:00.000Z');
  });

  it('source-ip-path id is a function of both dimensions, not just one', () => {
    const a = buildSourceIpPathGroupId('192.0.2.1', '/a');
    const b = buildSourceIpPathGroupId('192.0.2.1', '/b');
    const c = buildSourceIpPathGroupId('192.0.2.2', '/a');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
