import { describe, it, expect } from 'vitest';
import { clampPagination } from '../../server/lib/pagination';

describe('clampPagination', () => {
  it('returns default values for empty strings', () => {
    const result = clampPagination('', '');
    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('returns default page=1 for non-numeric values', () => {
    const result = clampPagination('abc', 'xyz');
    expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('clamps minimum page to 1', () => {
    const result = clampPagination('0', '20');
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps negative page to 1', () => {
    const result = clampPagination('-5', '20');
    expect(result.page).toBe(1);
  });

  it('clamps maximum limit to 100', () => {
    const result = clampPagination('1', '200');
    expect(result.limit).toBe(100);
    expect(result.skip).toBe(0);
  });

  it('clamps minimum limit to 1 for negative zero edge case', () => {
    const result = clampPagination('1', '-1');
    expect(result.limit).toBe(1);
  });

  it('defaults limit to 20 when parseInt returns 0 (falsy)', () => {
    const result = clampPagination('1', '0');
    expect(result.limit).toBe(20);
  });

  it('clamps negative limit to 1', () => {
    const result = clampPagination('1', '-10');
    expect(result.limit).toBe(1);
  });

  it('calculates skip correctly', () => {
    const result = clampPagination('3', '25');
    expect(result.page).toBe(3);
    expect(result.limit).toBe(25);
    expect(result.skip).toBe(50);
  });

  it('handles valid numeric inputs', () => {
    const result = clampPagination('5', '50');
    expect(result).toEqual({ page: 5, limit: 50, skip: 200 });
  });
});
