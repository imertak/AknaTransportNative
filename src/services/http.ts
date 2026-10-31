import { APP_CONFIG } from '@/constants/config';
import { ServiceError } from './errors';

/**
 * .NET Web API entegrasyonu için hazırlanmış HTTP istemcisi.
 * Mock aşamasında kullanılmaz; API servisleri bu istemci üzerinden yazılacak.
 */
type TokenProvider = () => string | null;

let getToken: TokenProvider = () => null;

export function setTokenProvider(provider: TokenProvider) {
  getToken = provider;
}

export async function http<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (!APP_CONFIG.apiBaseUrl) {
    throw new ServiceError('not_implemented', 'API adresi henüz yapılandırılmadı.');
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.json !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    throw new ServiceError('network', 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }

  if (!res.ok) {
    const code = res.status === 401 ? 'invalid_credentials' : res.status === 403 ? 'forbidden' : res.status === 404 ? 'not_found' : res.status === 409 ? 'conflict' : res.status === 400 ? 'validation' : 'unknown';
    let message = 'İşlem gerçekleştirilemedi.';
    try {
      const body = (await res.json()) as { message?: string; title?: string };
      message = body.message ?? body.title ?? message;
    } catch {
      // gövde JSON değil
    }
    throw new ServiceError(code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
