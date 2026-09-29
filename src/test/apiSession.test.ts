import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Test',
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

async function loadApi() {
  vi.resetModules();
  return import('../lib/api');
}

describe('api session handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the bearer token from localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('prrms_token', 'jwt-123');

    const api = await loadApi();
    await api.getUsers();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('clears the token and notifies the app on a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'Token expired' }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('prrms_token', 'stale-jwt');

    const onUnauthorized = vi.fn();
    const api = await loadApi();
    api.setUnauthorizedHandler(onUnauthorized);

    await expect(api.getUsers()).rejects.toThrow('Token expired');

    expect(localStorage.getItem('prrms_token')).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    api.setUnauthorizedHandler(null);
  });

  it('does not clear the token on a 403 — that is an authorization problem, not an expiry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { error: 'Access denied' }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('prrms_token', 'good-jwt');

    const onUnauthorized = vi.fn();
    const api = await loadApi();
    api.setUnauthorizedHandler(onUnauthorized);

    await expect(api.updateRequest('req-1', { title: 'x' })).rejects.toThrow('Access denied');

    expect(localStorage.getItem('prrms_token')).toBe('good-jwt');
    expect(onUnauthorized).not.toHaveBeenCalled();

    api.setUnauthorizedHandler(null);
  });

  it('does not clear the token on a 500', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { message: 'Internal server error' }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('prrms_token', 'good-jwt');

    const onUnauthorized = vi.fn();
    const api = await loadApi();
    api.setUnauthorizedHandler(onUnauthorized);

    await expect(api.getUsers()).rejects.toThrow('Internal server error');

    expect(localStorage.getItem('prrms_token')).toBe('good-jwt');
    expect(onUnauthorized).not.toHaveBeenCalled();

    api.setUnauthorizedHandler(null);
  });

  it('reports a network failure as a network error and keeps the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    localStorage.setItem('prrms_token', 'good-jwt');

    const onUnauthorized = vi.fn();
    const api = await loadApi();
    api.setUnauthorizedHandler(onUnauthorized);

    await expect(api.getUsers()).rejects.toThrow(/Network error/);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(localStorage.getItem('prrms_token')).toBe('good-jwt');

    api.setUnauthorizedHandler(null);
  });

  it('surfaces a plain-text error body instead of a JSON parse failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Title, description, and deadline are required',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const api = await loadApi();
    await expect(api.createRequest({ title: '', description: '', deadline: '2030-01-01' })).rejects.toThrow(
      'Title, description, and deadline are required',
    );
  });

  it('handles an empty 204 response without throwing a SyntaxError', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      text: async () => '',
      json: async () => {
        throw new Error('Unexpected end of JSON input');
      },
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const api = await loadApi();
    await expect(api.createRequest({ title: 'x', description: 'd', deadline: '2030-01-01' })).resolves.toBeNull();
  });
});
