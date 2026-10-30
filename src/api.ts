import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import type { Gateway, User } from './types';
import { uid } from './types';

export const API_URL = 'https://zamzam-api.fly.dev';
const SESSION_SERVICE = 'org.zamzam.mobile.session.v1';
const DEVICE_SERVICE = 'org.zamzam.mobile.device.v1';
interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}
interface Credentials extends Tokens {
  endpoint: string;
  tenant: number | null;
  device: string;
  expiresAt: number;
  user?: User;
}
export class ApiError extends Error {
  constructor(message: string, public status: number, public detail?: unknown) {
    super(message);
  }
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'تعذر إتمام الطلب. حاول مرة أخرى.';
}
function detailMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map(d => d.msg || '')
      .filter(Boolean)
      .join('، ');
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, string>;
    return (
      d.message ||
      d.reason ||
      (d.code === 'session_version_conflict'
        ? 'تغيرت الحلقة على جهاز آخر. أعد تحميلها قبل متابعة التعديل.'
        : d.code)
    );
  }
  return 'تعذر إتمام الطلب. حاول مرة أخرى.';
}
export class ApiClient implements Gateway {
  static async checkServer(endpoint = API_URL) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${endpoint.replace(/\/+$/, '')}/health`, {
        signal: controller.signal,
      });
      const health = await response.json();
      if (!response.ok || health.status !== 'ok' || health.database !== 'ok')
        throw new Error('الخادم غير جاهز حالياً. حاول مرة أخرى.');
    } finally {
      clearTimeout(timer);
    }
  }
  readonly demo = false;
  private refreshFlight: Promise<void> | null = null;
  private writes: Promise<unknown> = Promise.resolve();
  onExpired?: () => void;
  private constructor(private credentials: Credentials) {}
  get deviceId() {
    return this.credentials.device;
  }
  get accountKey() {
    return `${this.credentials.endpoint}:${this.credentials.user?.id}`;
  }
  get cachedUser() {
    return this.credentials.user;
  }
  resolveMedia(path: string) {
    return /^https?:\/\//.test(path)
      ? path
      : `${this.credentials.endpoint}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  private async persist() {
    const snapshot = JSON.stringify(this.credentials);
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        const stored = await Keychain.setGenericPassword('zamzam', snapshot, {
          service: SESSION_SERVICE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        if (!stored) throw new Error('تعذر حفظ الجلسة بشكل آمن.');
      });
    await this.writes;
  }
  static async restore() {
    const stored = await Keychain.getGenericPassword({
      service: SESSION_SERVICE,
    });
    if (!stored) return null;
    try {
      const credentials: Credentials = JSON.parse(stored.password);
      if (
        !credentials.refresh_token ||
        !credentials.endpoint ||
        !credentials.device
      )
        throw new Error();
      return new ApiClient(credentials);
    } catch {
      await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
      return null;
    }
  }
  static async login(username: string, password: string, endpoint = API_URL) {
    const url = endpoint.trim().replace(/\/+$/, '');
    if (
      !/^https:\/\/[^/]+/.test(url) &&
      !(
        __DEV__ &&
        /^http:\/\/(10\.0\.2\.2|127\.0\.0\.1|localhost)(:\d+)?$/.test(url)
      )
    ) {
      throw new Error('يجب استخدام عنوان خادم HTTPS صالح.');
    }
    let deviceEntry = await Keychain.getGenericPassword({
      service: DEVICE_SERVICE,
    });
    if (!deviceEntry) {
      const id = uid();
      await Keychain.setGenericPassword('installation', id, {
        service: DEVICE_SERVICE,
      });
      deviceEntry = await Keychain.getGenericPassword({
        service: DEVICE_SERVICE,
      });
    }
    if (!deviceEntry) throw new Error('تعذر تهيئة التخزين الآمن.');
    const client = new ApiClient({
      endpoint: url,
      device: deviceEntry.password,
      tenant: null,
      access_token: '',
      refresh_token: '',
      expiresAt: 0,
    });
    const tokens = await client.raw<Tokens>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          device_id: deviceEntry.password,
          device_name: `Zamzam ${Platform.OS}`,
        }),
      },
      null,
      false,
    );
    client.credentials = {
      ...client.credentials,
      ...tokens,
      expiresAt: Date.now() + (tokens.expires_in || 28800) * 1000,
    };
    await client.persist();
    return client;
  }
  private async raw<T>(
    path: string,
    options: RequestInit = {},
    tenant = this.credentials.tenant,
    authenticated = true,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${this.credentials.endpoint}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated
            ? { Authorization: `Bearer ${this.credentials.access_token}` }
            : {}),
          ...(tenant !== null ? { 'X-Tahfiz-ID': String(tenant) } : {}),
          ...options.headers,
        },
      });
      if (response.status === 204) return undefined as T;
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new ApiError(
          detailMessage(data.detail),
          response.status,
          data.detail,
        );
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted)
        throw new Error('انتهت مهلة الاتصال. تحقق من الشبكة وحاول مرة أخرى.');
      throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.');
    } finally {
      clearTimeout(timer);
    }
  }
  private refresh() {
    if (!this.refreshFlight) {
      this.refreshFlight = (async () => {
        try {
          const tokens = await this.raw<Tokens>(
            '/auth/refresh',
            {
              method: 'POST',
              body: JSON.stringify({
                refresh_token: this.credentials.refresh_token,
                device_id: this.credentials.device,
              }),
            },
            null,
            false,
          );
          this.credentials = {
            ...this.credentials,
            ...tokens,
            expiresAt: Date.now() + (tokens.expires_in || 28800) * 1000,
          };
          await this.persist();
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
            this.onExpired?.();
          }
          throw error;
        }
      })().finally(() => {
        this.refreshFlight = null;
      });
    }
    return this.refreshFlight;
  }
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const tenant = this.credentials.tenant;
    if (this.credentials.expiresAt < Date.now() + 30000) await this.refresh();
    try {
      return await this.raw<T>(path, options, tenant);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await this.refresh();
      try {
        return await this.raw<T>(path, options, tenant);
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
          this.onExpired?.();
        }
        throw retryError;
      }
    }
  }
  async switchTenant(id: number) {
    await this.request('/auth/default-tahfiz', {
      method: 'POST',
      body: JSON.stringify({ tahfiz_id: id }),
    });
    const user = await this.raw<User>('/auth/me', {}, id);
    this.credentials = { ...this.credentials, tenant: id, user };
    await this.persist();
    return user;
  }
  async loadUser() {
    const user = await this.request<User>('/auth/me');
    this.credentials = { ...this.credentials, tenant: user.tahfiz_id, user };
    await this.persist();
    return user;
  }
  async selectCachedTenant(user: User) {
    this.credentials = { ...this.credentials, tenant: user.tahfiz_id, user };
    await this.persist();
  }
  async cacheUser(user: User) {
    if (this.credentials.tenant !== user.tahfiz_id) return;
    this.credentials = { ...this.credentials, user };
    await this.persist();
  }
  async logout() {
    try {
      await this.request('/auth/revoke-device', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: this.credentials.refresh_token }),
      });
    } finally {
      await this.writes.catch(() => {});
      await Keychain.resetGenericPassword({ service: SESSION_SERVICE });
    }
  }
}
