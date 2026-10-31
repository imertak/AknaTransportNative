import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { ServiceError } from './errors';

export const fileSafe = (s: string) => s.replace(/[^\w.-]+/g, '_');

/**
 * İndirilen PDF'i cihazda geçici dosyaya yazar ve URI döndürür.
 * Web'de dosya sistemi olmadığından tarayıcı nesne URL'i döner.
 */
export async function savePdf(bytes: ArrayBuffer, fileName: string): Promise<string> {
  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  }
  const target = new File(Paths.cache, fileSafe(fileName));
  if (target.exists) target.delete();
  target.create();
  await target.write(new Uint8Array(bytes));
  return target.uri;
}

/** PDF'i paylaşım menüsüyle açar; web'de yeni sekmede gösterir. */
export async function sharePdf(uri: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.open?.(uri, '_blank');
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new ServiceError('not_implemented', 'Bu cihazda dosya paylaşımı desteklenmiyor.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}
