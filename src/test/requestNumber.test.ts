import { describe, it, expect } from 'vitest';
import { generateRequestNumber, lookupByIdOrNumber } from '../../server/lib/requestUtils';

describe('Request number generation', () => {
  it('generates a request number with correct format', () => {
    const num = generateRequestNumber();
    expect(num).toMatch(/^REQ-\d{4}-\d{4}$/);
  });

  it('uses the current year', () => {
    const num = generateRequestNumber();
    const year = new Date().getFullYear();
    expect(num).toMatch(new RegExp(`^REQ-${year}-`));
  });

  it('generates a 4-digit sequence number', () => {
    const num = generateRequestNumber();
    const seq = parseInt(num.split('-')[2]);
    expect(seq).toBeGreaterThanOrEqual(1000);
    expect(seq).toBeLessThanOrEqual(9999);
  });

  it('generates unique numbers over multiple calls', () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      numbers.add(generateRequestNumber());
    }
    // With 9000 possible sequences, 100 calls should produce mostly unique
    expect(numbers.size).toBeGreaterThan(90);
  });
});

describe('lookupByIdOrNumber', () => {
  it('returns requestNumber for REQ- prefixed strings', () => {
    expect(lookupByIdOrNumber('REQ-2026-1234')).toEqual({ requestNumber: 'REQ-2026-1234' });
  });

  it('returns id for UUID strings', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(lookupByIdOrNumber(uuid)).toEqual({ id: uuid });
  });

  it('returns requestNumber for any REQ- prefixed string', () => {
    expect(lookupByIdOrNumber('REQ-abc')).toEqual({ requestNumber: 'REQ-abc' });
  });

  it('returns id for numeric strings', () => {
    expect(lookupByIdOrNumber('12345')).toEqual({ id: '12345' });
  });
});
