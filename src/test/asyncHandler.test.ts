import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../../server/lib/asyncHandler';

function createMockReq() {
  return { method: 'GET', path: '/' } as any;
}

function createMockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
}

function createMockNext() {
  return vi.fn();
}

describe('asyncHandler', () => {
  it('calls the handler function', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await wrapped(req, res, next);
    expect(handler).toHaveBeenCalledWith(req, res, next);
  });

  it('passes errors to next()', async () => {
    const error = new Error('test error');
    const handler = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await wrapped(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('propagates synchronous throw (not caught by Promise.resolve)', async () => {
    const error = new Error('sync error');
    const handler = vi.fn().mockImplementation(() => { throw error; });
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    expect(() => wrapped(req, res, next)).toThrow('sync error');
  });

  it('handles async rejections', async () => {
    const error = new Error('async rejection');
    const handler = vi.fn().mockImplementation(async () => { throw error; });
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await wrapped(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next on success', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = asyncHandler(handler);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await wrapped(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
