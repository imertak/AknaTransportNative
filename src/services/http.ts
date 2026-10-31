import { APP_CONFIG } from '@/constants/config';
import { ServiceError, type ServiceErrorCode } from './errors';

/**
 * .NET Web API istemcisi. API tüm yanıtları `{ isSuccess, message, data, errors }`
 * zarfıyla döndürür; bu istemci `data` alanını açar, hataları `ServiceError`'a çevirir
 * ve süresi dolan erişim token'ını bir kez yenileyip isteği tekrarlar.
 */
type TokenProvider = () => string | null;
/** Yeni erişim token'ını döndürür; yenilenemiyorsa null. */
type TokenRefresher = () => Promise<string | null>;

let getToken: TokenProvider = () => null;
let refresher: TokenRefresher | null = null;
let refreshing: Promise<string | null> | null = null;

export function setTokenProvider(provider: TokenProvider) {
  getToken = provider;
}

export function setTokenRefresher(fn: TokenRefresher | null) {
  refresher = fn;
}

interface ApiEnvelope<T> {
  isSuccess: boolean;
  message?: string | null;
  data?: T;
  errors?: { field?: string | null; message: string }[] | null;
}

export interface HttpOptions extends RequestInit {
  json?: unknown;
  /** Token eklenmez ve 401'de yenileme denenmez (giriş, token yenileme). */
  anonymous?: boolean;
  /** Sorgu parametreleri; undefined/null/boş değerler atlanır, diziler tekrarlanır. */
  query?: Record<string, string | number | boolean | null | undefined | (string | number)[]>;
}

function buildUrl(path: string, query?: HttpOptions['query']): string {
  const params: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return `${APP_CONFIG.apiBaseUrl}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

function codeFor(status: number, anonymous: boolean): ServiceErrorCode {
  switch (status) {
    case 400:
      return 'validation';
    case 401:
      return anonymous ? 'invalid_credentials' : 'session_expired';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 503:
      return 'unavailable';
    default:
      return 'unknown';
  }
}

const FALLBACK_MESSAGE: Partial<Record<number, string>> = {
  401: 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.',
  403: 'Bu işlem için yetkiniz yok.',
  404: 'Kayıt bulunamadı.',
  429: 'Çok fazla istek gönderildi. Lütfen biraz bekleyip tekrar deneyin.',
};

async function toError(res: Response, anonymous: boolean): Promise<ServiceError> {
  let message = FALLBACK_MESSAGE[res.status] ?? 'İşlem gerçekleştirilemedi.';
  try {
    const body = (await res.json()) as Partial<ApiEnvelope<unknown>> & { title?: string };
    const details = body.errors?.map((e) => e.message).filter(Boolean) ?? [];
    message = details.length ? details.join('\n') : (body.message ?? body.title ?? message);
  } catch {
    // gövde JSON değil
  }
  return new ServiceError(codeFor(res.status, anonymous), message);
}

/** Eşzamanlı 401'lerde tek bir yenileme isteği yapılır. */
function refreshOnce(): Promise<string | null> {
  if (!refresher) return Promise.resolve(null);
  if (!refreshing) {
    refreshing = refresher()
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function send(path: string, init: HttpOptions, token: string | null): Promise<Response> {
  const { json, anonymous: _anonymous, query, headers: extra, ...rest } = init;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(buildUrl(path, query), {
      ...rest,
      headers: { ...headers, ...(extra as Record<string, string> | undefined) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ServiceError('network', 'Sunucuya ulaşılamadı. İnternet bağlantınızı ve API adresini kontrol edin.');
  }
}

export async function http<T>(path: string, init: HttpOptions = {}): Promise<T> {
  if (!APP_CONFIG.apiBaseUrl) {
    throw new ServiceError('not_implemented', 'API adresi henüz yapılandırılmadı.');
  }
  const anonymous = init.anonymous === true;
  const token = anonymous ? null : getToken();
  let res = await send(path, init, token);

  if (res.status === 401 && !anonymous && token) {
    const fresh = await refreshOnce();
    if (fresh) res = await send(path, init, fresh);
  }

  if (!res.ok) throw await toError(res, anonymous);
  if (res.status === 204) return undefined as T;

  const body = (await res.json()) as ApiEnvelope<T> | T;
  if (body && typeof body === 'object' && 'isSuccess' in body) {
    if (!body.isSuccess) throw new ServiceError('unknown', body.message ?? 'İşlem gerçekleştirilemedi.');
    return body.data as T;
  }
  return body as T;
}

interface Paged<T> {
  items: T[];
  pageNumber: number;
  totalPages: number;
}

/** Sayfalı listeleri sonuna kadar okur (API sayfa boyutu üst sınırı 200). */
export async function httpAll<T>(path: string, query: HttpOptions['query'] = {}): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 100; page++) {
    const res = await http<Paged<T>>(path, { query: { ...query, pageNumber: page, pageSize: 200 } });
    out.push(...res.items);
    if (page >= res.totalPages || res.items.length === 0) break;
  }
  return out;
}

/** Kimlik doğrulamalı ikili indirme (PDF). 401'de token bir kez yenilenir. */
export async function httpBinary(path: string, init: HttpOptions = {}): Promise<ArrayBuffer> {
  if (!APP_CONFIG.apiBaseUrl) {
    throw new ServiceError('not_implemented', 'API adresi henüz yapılandırılmadı.');
  }
  const token = getToken();
  const withAccept = { ...init, headers: { Accept: 'application/pdf, application/octet-stream', ...(init.headers as Record<string, string> | undefined) } };
  let res = await send(path, withAccept, token);
  if (res.status === 401 && token) {
    const fresh = await refreshOnce();
    if (fresh) res = await send(path, withAccept, fresh);
  }
  if (!res.ok) throw await toError(res, false);
  return res.arrayBuffer();
}

/** Arka plan görevleri gibi oturum bağlamı olmayan yerlerde token sağlayıcının kurulu olup olmadığı. */
export const hasToken = () => !!getToken();
