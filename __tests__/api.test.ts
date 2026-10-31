jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' },
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));
import * as Keychain from 'react-native-keychain';
import { API_URL, ApiClient, ApiError } from '../src/api';

const response = (status: number, body: unknown) =>
  ({ status, ok: status < 400, json: async () => body } as Response);
const storage = new Map<string, string>();
test('checks the Fly server and rejects an unhealthy database', async () => {
  globalThis.fetch = jest.fn(async () =>
    response(200, { status: 'ok', database: 'ok' }),
  );
  await ApiClient.checkServer();
  expect(fetch).toHaveBeenCalledWith(
    `${API_URL}/health`,
    expect.objectContaining({ signal: expect.anything() }),
  );
  globalThis.fetch = jest.fn(async () =>
    response(200, { status: 'ok', database: 'error' }),
  );
  await expect(ApiClient.checkServer()).rejects.toThrow();
});
beforeEach(() => {
  storage.clear();
  jest.clearAllMocks();
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(
    async ({ service }) =>
      storage.has(service)
        ? { username: 'test', password: storage.get(service) }
        : false,
  );
  (Keychain.setGenericPassword as jest.Mock).mockImplementation(
    async (_u, p, { service }) => {
      storage.set(service, p);
      return { service };
    },
  );
  (Keychain.resetGenericPassword as jest.Mock).mockImplementation(
    async ({ service }) => storage.delete(service),
  );
});
test('saves tokens together in secure storage and keeps the same installation id after sign-out', async () => {
  globalThis.fetch = jest.fn(async url =>
    String(url).endsWith('/auth/login')
      ? response(200, {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        })
      : response(204, null),
  );
  const first = await ApiClient.login('admin', 'password');
  const device = first.deviceId;
  expect(storage.get('org.zamzam.mobile.session.v1')).toContain('refresh');
  await first.logout();
  expect(storage.has('org.zamzam.mobile.session.v1')).toBe(false);
  const next = await ApiClient.login('admin', 'password');
  expect(next.deviceId).toBe(device);
});
test('a single refresh services concurrent expired requests, then retries each request only once', async () => {
  let release!: (r: Response) => void;
  const delayed = new Promise<Response>(resolve => {
    release = resolve;
  });
  globalThis.fetch = jest.fn(async (url, options) => {
    if (String(url).endsWith('/auth/login'))
      return response(200, {
        access_token: 'old',
        refresh_token: 'rotate-me',
        expires_in: 3600,
      });
    if (String(url).endsWith('/auth/refresh')) return delayed;
    return (options?.headers as Record<string, string>).Authorization ===
      'Bearer new'
      ? response(200, { ok: true })
      : response(401, { detail: 'expired' });
  });
  const client = await ApiClient.login('admin', 'password');
  const requests = [client.request('/one'), client.request('/two')];
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(
    (fetch as jest.Mock).mock.calls.filter(([url]) =>
      url.endsWith('/auth/refresh'),
    ),
  ).toHaveLength(1);
  release(
    response(200, {
      access_token: 'new',
      refresh_token: 'rotated',
      expires_in: 3600,
    }),
  );
  await expect(Promise.all(requests)).resolves.toEqual([
    { ok: true },
    { ok: true },
  ]);
  expect(storage.get('org.zamzam.mobile.session.v1')).toContain('rotated');
});
test('an explicitly scoped request keeps its original tahfiz header', async () => {
  globalThis.fetch = jest.fn(async url =>
    String(url).endsWith('/auth/login')
      ? response(200, {
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 3600,
        })
      : response(200, {}),
  );
  const client = await ApiClient.login('admin', 'password');
  await client.request('/sessions/all', { headers: { 'X-Tahfiz-ID': '42' } });
  expect((fetch as jest.Mock).mock.calls.at(-1)[1].headers['X-Tahfiz-ID']).toBe(
    '42',
  );
});
test('normalizes validation arrays and denies non-HTTPS production endpoints', async () => {
  globalThis.fetch = jest.fn(async () =>
    response(422, { detail: [{ msg: 'invalid username' }] }),
  );
  await expect(ApiClient.login('admin', 'password')).rejects.toEqual(
    new ApiError('invalid username', 422, [{ msg: 'invalid username' }]),
  );
  await expect(
    ApiClient.login('admin', 'password', 'http://example.com'),
  ).rejects.toThrow('HTTPS');
});

test('public signup requests never attach credentials or persist an authentication session', async () => {
  globalThis.fetch = jest.fn(async () => response(200, { status: 'pending' }));
  await ApiClient.publicRequest('/auth/signup', {
    username: 'new-account',
    password: 'example-only',
  });
  const options = (fetch as jest.Mock).mock.calls[0][1];
  expect(options.credentials).toBe('omit');
  expect(options.headers.Authorization).toBeUndefined();
  expect(options.headers['X-Tahfiz-ID']).toBeUndefined();
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
});
test('photo multipart upload lets the native transport set its boundary', async () => {
  globalThis.fetch = jest.fn(async url =>
    String(url).endsWith('/auth/login')
      ? response(200, {
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        })
      : response(200, {}),
  );
  const client = await ApiClient.login('admin', 'password');
  const form = new FormData();
  form.append('file', {
    uri: 'file:///test.jpg',
    type: 'image/jpeg',
    name: 'test.jpg',
  } as unknown as Blob);
  await client.request('/students/1/upload-pic', {
    method: 'POST',
    body: form,
  });
  const options = (fetch as jest.Mock).mock.calls.at(-1)[1];
  expect(options.headers['Content-Type']).toBeUndefined();
  expect(options.headers.Authorization).toBe('Bearer access');
});
