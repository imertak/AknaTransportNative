import { Eye, FileText, Share2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { previewPdf, sharePdf, type PdfFile } from '@/services/files';
import { colors, radius, spacing } from '@/theme';

/**
 * PDF hazırlandıktan sonra açılır: önce önizlenir, sonra paylaşılır. Önizleme ve paylaşım
 * aynı dosyayı kullanır; önizlemeden dönünce pencere açık kalır.
 */
export function PdfReadySheet({ pdf, onClose }: { pdf: PdfFile | null; onClose: () => void }) {
  const preview = useAsyncAction();
  const share = useAsyncAction();
  return (
    <Sheet
      visible={!!pdf}
      onClose={onClose}
      title="PDF hazır"
      subtitle="Önizleyip kontrol ettikten sonra paylaşabilirsiniz."
      footer={
        <View style={styles.row}>
          <Button
            label="Önizle"
            icon={Eye}
            variant="secondary"
            style={{ flex: 1 }}
            loading={preview.pending}
            onPress={() => pdf && preview.run(() => previewPdf(pdf.uri), { error: 'Önizleme açılamadı.' })}
          />
          <Button
            label="Paylaş"
            icon={Share2}
            style={{ flex: 1 }}
            loading={share.pending}
            onPress={() => pdf && share.run(() => sharePdf(pdf.uri, pdf.title), { error: 'PDF paylaşılamadı.' })}
          />
        </View>
      }>
      <View style={styles.file}>
        <View style={styles.icon}>
          <FileText size={22} color={colors.text} />
        </View>
        <Text variant="subheading" style={{ flex: 1 }} numberOfLines={2}>
          {pdf?.title}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  file: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  icon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
