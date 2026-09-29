import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('../../server/lib/prisma.js', () => ({
  default: { researchRequest: { findUnique } },
}));

import {
  createWithUniqueRequestNumber,
  generateRequestNumber,
  generateUniqueRequestNumber,
  lookupByIdOrNumber,
  retryOnUniqueViolation,
} from '../../server/lib/requestUtils';

function uniqueViolation() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

describe('generateRequestNumber', () => {
  it('uses the REQ-<year>-<4 digits> format', () => {
    expect(generateRequestNumber()).toMatch(/^REQ-\d{4}-\d{4}$/);
  });
});

describe('generateUniqueRequestNumber', () => {
  beforeEach(() => findUnique.mockReset());

  it('returns a number that is not already taken', async () => {
    findUnique.mockResolvedValue(null);
    const number = await generateUniqueRequestNumber();
    expect(findUnique).toHaveBeenCalledWith({ where: { requestNumber: number } });
  });

  it('keeps drawing when the candidate is already in use', async () => {
    findUnique.mockResolvedValueOnce({ id: 'taken' }).mockResolvedValueOnce(null);
    const number = await generateUniqueRequestNumber();
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(number).toMatch(/^REQ-\d{4}-\d{4}$/);
  });
});

describe('createWithUniqueRequestNumber', () => {
  beforeEach(() => findUnique.mockReset());

  it('passes an allocated number into the create callback', async () => {
    findUnique.mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({ id: 'req-1' });
    await expect(createWithUniqueRequestNumber(create)).resolves.toEqual({ id: 'req-1' });
    expect(create).toHaveBeenCalledWith(expect.stringMatching(/^REQ-\d{4}-\d{4}$/));
  });

  it('retries when the insert loses the race to a concurrent submission', async () => {
    findUnique.mockResolvedValue(null);
    const create = vi
      .fn()
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({ id: 'req-2' });

    await expect(createWithUniqueRequestNumber(create)).resolves.toEqual({ id: 'req-2' });
    expect(create).toHaveBeenCalledTimes(2);
    // Each attempt must draw a *fresh* number, otherwise the retry collides again.
    expect(create.mock.calls[0][0]).not.toBe(create.mock.calls[1][0]);
  });

  it('does not swallow non-uniqueness errors', async () => {
    findUnique.mockResolvedValue(null);
    const boom = new Error('Foreign key constraint failed');
    const create = vi.fn().mockRejectedValue(boom);

    await expect(createWithUniqueRequestNumber(create)).rejects.toBe(boom);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting the attempts instead of looping forever', async () => {
    findUnique.mockResolvedValue(null);
    const create = vi.fn().mockRejectedValue(uniqueViolation());

    await expect(createWithUniqueRequestNumber(create)).rejects.toMatchObject({ code: 'P2002' });
    expect(create).toHaveBeenCalledTimes(8);
  });
});

describe('retryOnUniqueViolation', () => {
  it('recomputes and retries after a unique violation', async () => {
    let counter = 0;
    const attempt = vi.fn().mockImplementation(async () => {
      counter += 1;
      if (counter < 3) throw uniqueViolation();
      return { version: counter };
    });

    await expect(retryOnUniqueViolation(attempt)).resolves.toEqual({ version: 3 });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('returns the first attempt result when nothing collides', async () => {
    const attempt = vi.fn().mockResolvedValue('ok');
    await expect(retryOnUniqueViolation(attempt)).resolves.toBe('ok');
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('propagates a non-uniqueness error without retrying', async () => {
    const boom = new Error('Foreign key constraint failed');
    const attempt = vi.fn().mockRejectedValue(boom);
    await expect(retryOnUniqueViolation(attempt)).rejects.toBe(boom);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than looping forever', async () => {
    const attempt = vi.fn().mockRejectedValue(uniqueViolation());
    await expect(retryOnUniqueViolation(attempt)).rejects.toMatchObject({ code: 'P2002' });
    expect(attempt).toHaveBeenCalledTimes(8);
  });
});

describe('lookupByIdOrNumber', () => {
  it('treats a REQ- prefixed value as a request number', () => {
    expect(lookupByIdOrNumber('REQ-2026-1234')).toEqual({ requestNumber: 'REQ-2026-1234' });
  });

  it('treats anything else as an id', () => {
    expect(lookupByIdOrNumber('6f1c0f6e-1b2a-4c3d-9e8f-0a1b2c3d4e5f')).toEqual({
      id: '6f1c0f6e-1b2a-4c3d-9e8f-0a1b2c3d4e5f',
    });
  });
});
