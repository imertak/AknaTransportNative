import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
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

/** Cihazdan seçilen dosya (elle fatura yükleme). Web'de `file` tarayıcının File nesnesidir. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  file?: Blob;
}

/** Cihazdan tek bir PDF seçtirir; vazgeçilirse null. */
export async function pickPdf(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.name || 'fatura.pdf', mimeType: asset.mimeType ?? 'application/pdf', size: asset.size, file: asset.file };
}

/** Hazırlanmış PDF: önizleme ve paylaşım aynı dosyayı kullanır. */
export interface PdfFile {
  uri: string;
  title: string;
}

/**
 * PDF'in kendisini sistemin önizleme ekranında açar (iOS/Android yazdırma önizlemesi; ek paket gerekmez).
 * Web'de yeni sekmede açılır.
 */
export async function previewPdf(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.open?.(uri, '_blank');
    return;
  }
  try {
    await Print.printAsync({ uri });
  } catch (e) {
    // Kullanıcı önizlemeyi kapattığında bazı sürümler iptal hatası verir; bu bir hata değildir.
    if (e instanceof Error && /cancel|iptal|did not complete/i.test(e.message)) return;
    throw e;
  }
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
