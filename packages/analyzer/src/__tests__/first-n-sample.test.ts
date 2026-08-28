import { describe, expect, it } from 'vitest';
import { FirstNSample } from '../aggregation/first-n-sample.js';

describe('FirstNSample', () => {
  it('keeps up to N distinct values in arrival order', () => {
    const sample = new FirstNSample<string>(3);
    sample.add('a');
    sample.add('b');
    sample.add('c');
    expect(sample.values()).toEqual(['a', 'b', 'c']);
  });

  it('ignores duplicates of an already-captured value', () => {
    const sample = new FirstNSample<string>(3);
    sample.add('a');
    sample.add('a');
    sample.add('a');
    expect(sample.values()).toEqual(['a']);
  });

  it('is NOT a frequency ranking: a value arriving after capacity fills never appears, no matter how often it recurs', () => {
    const sample = new FirstNSample<string>(2);
    sample.add('early-1');
    sample.add('early-2');
    // 'late' would dominate any true frequency ranking if it kept recurring —
    // but the cap is already full, so it's simply absent, not misrepresented.
    for (let i = 0; i < 100_000; i += 1) sample.add('late');

    const values = sample.values();
    expect(values).toEqual(['early-1', 'early-2']);
    expect(values).not.toContain('late');
  });

  it('carries no count field to misrepresent as a frequency', () => {
    const sample = new FirstNSample<string>(5);
    sample.add('x');
    const [first] = sample.values();
    expect(first).toBe('x');
    expect(sample.values()).not.toHaveProperty('0.count');
  });
});
