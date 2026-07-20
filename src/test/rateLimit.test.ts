import { describe, it, expect, vi } from 'vitest';
import { rateLimit } from '../../server/lib/rateLimit';

function createMockReq(ip = '127.0.0.1') {
  return { ip } as any;
}

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('Rate Limiter', () => {
  it('allows requests within the limit', () => {
    const limiter = rateLimit(60000, 3);
    const req = createMockReq('test-allow-1');
    const res = createMockRes();
    const next = vi.fn();

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks requests over the limit', () => {
    const limiter = rateLimit(60000, 2);
    const req = createMockReq('test-block-1');
    const res = createMockRes();
    const next = vi.fn();

    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next); // 3rd request should be blocked

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests. Please try again later.' });
  });

  it('tracks different IPs separately', () => {
    const limiter = rateLimit(60000, 1);
    const res = createMockRes();
    const next = vi.fn();

    limiter(createMockReq('test-separate-1'), res, next);
    limiter(createMockReq('test-separate-2'), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).not.toHaveBeenCalled();
  });
});
