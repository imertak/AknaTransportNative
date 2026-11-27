import { useEffect, useEffectEvent } from 'react';
import { Platform } from 'react-native';

import { SmsUserConsent } from '../../modules/sms-user-consent';
import { extractSmsCode } from '@/utils/smsCode';

/**
 * Android: SMS gelince sistem "Mesajı AKNA'ya ver?" penceresini açar; onaylanırsa kod `onCode` ile gelir.
 * READ_SMS izni istenmez. `key` değişince (ör. "Yeni kod") dinleme yeniden başlar.
 *
 * iOS'ta uygulamaların SMS okumasına izin verilmez: orada kod, `textContentType="oneTimeCode"` sayesinde
 * klavyenin üstünde öneri olarak çıkar ve tek dokunuşla girilir.
 */
export function useSmsCodeAutofill(key: string | null, onCode: (code: string) => void) {
  const deliver = useEffectEvent((code: string) => onCode(code));

  useEffect(() => {
    if (!key || Platform.OS !== 'android' || !SmsUserConsent) return;
    const native = SmsUserConsent;
    const sub = native.addListener('onSms', ({ message }) => {
      const code = extractSmsCode(message);
      if (code) deliver(code);
    });
    native.startListening().catch(() => {});
    return () => {
      sub.remove();
      native.stopListening();
    };
  }, [key]);
}
