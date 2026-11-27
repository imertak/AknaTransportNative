import { requireOptionalNativeModule, type EventSubscription } from 'expo';

export type SmsConsentError = { reason: 'denied' | 'timeout' | 'no_activity' | 'start_failed'; message?: string };

type SmsUserConsentNative = {
  startListening(): Promise<void>;
  stopListening(): void;
  addListener(event: 'onSms', listener: (e: { message: string }) => void): EventSubscription;
  addListener(event: 'onError', listener: (e: SmsConsentError) => void): EventSubscription;
};

/**
 * Yalnızca Android'de vardır. iOS'ta, web'de veya bu modül eklenmeden önce derlenmiş (OTA güncellemeyle
 * yeni JS almış) Android sürümlerinde null döner; çağıran taraf elle girişe düşer.
 */
export const SmsUserConsent = requireOptionalNativeModule<SmsUserConsentNative>('SmsUserConsent');
