import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Android'de sistem gezinme çubuğunun alanı kök düzende opak bir şeritle ayrılır (bkz. app/_layout),
 * bu yüzden ekran içeriği o alanı ikinci kez boşluk olarak eklememelidir. Ayrı pencerede açılan
 * Modal'lar (Sheet vb.) bu kuralın dışındadır; onlar gerçek insets.bottom kullanır.
 */
export const RESERVES_NAV_BAR = Platform.OS === 'android';

export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return RESERVES_NAV_BAR || Platform.OS === 'web' ? 0 : insets.bottom;
}
