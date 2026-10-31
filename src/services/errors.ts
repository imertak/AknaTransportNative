export type ServiceErrorCode =
  | 'invalid_credentials'
  | 'not_found'
  | 'validation'
  | 'forbidden'
  | 'conflict'
  | 'not_implemented'
  | 'network'
  | 'unavailable'
  | 'session_expired'
  | 'unknown';

/** Servis katmanından ekranlara taşınan, kullanıcıya gösterilebilir hata. */
export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function errorMessage(err: unknown, fallback = 'Beklenmeyen bir hata oluştu.'): string {
  if (err instanceof ServiceError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
