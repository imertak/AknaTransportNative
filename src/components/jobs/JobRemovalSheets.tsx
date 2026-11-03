import { Ban, Trash2, TriangleAlert } from 'lucide-react-native';
import { memo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Input, Sheet, Text } from '@/components/ui';
import { JOB_STATUS_LABEL, isInProgress } from '@/constants/jobStatus';
import { colors, radius, spacing } from '@/theme';
import type { TransportJob } from '@/types';

const REASON_MAX = 500;

const CANCEL_REASONS = ['Müşteri vazgeçti', 'Araç arızası', 'Tarih değişti', 'Mükerrer kayıt'];

/** Silmede neden zorunlu mu? Sunucudaki kuralla aynıdır: sahada yürüyen veya tamamlanmış iş kritik sayılır. */
export const deletionReasonRequired = (job: Pick<TransportJob, 'status'>) => isInProgress(job.status) || job.status === 'completed';

interface SheetProps {
  job: TransportJob;
  visible: boolean;
  onClose: () => void;
  /** true dönerse sayfa kapanır ve alan temizlenir; hata durumunda açık kalır. */
  onConfirm: (reason: string) => Promise<boolean>;
  pending?: boolean;
}

/**
 * İş iptal onayı: sade uyarı ve zorunlu iptal nedeni. İptal edilen iş listede kalır, geçmişi korunur.
 */
export const CancelJobSheet = memo(function CancelJobSheet({ job, visible, onClose, onConfirm, pending }: SheetProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  const close = () => {
    setError(undefined);
    onClose();
  };

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('İptal nedenini yazın.');
      return;
    }
    if (await onConfirm(trimmed)) {
      setReason('');
      setError(undefined);
    }
  };

  const live = isInProgress(job.status);
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="İşi iptal et"
      subtitle={`${job.jobNo} · ${JOB_STATUS_LABEL[job.status]}`}
      footer={
        <View style={styles.actions}>
          <Button label="Vazgeç" variant="secondary" onPress={close} style={{ flex: 1 }} disabled={pending} />
          <Button label="İptal et" variant="danger" icon={Ban} onPress={submit} loading={pending} style={{ flex: 1 }} />
        </View>
      }>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text variant="bodySmall" tone="secondary">
          İş İptal durumuna geçer ve listede kalır. Durum geçmişi, duraklar ve konum kayıtları korunur; iptal tarihi ve iptal eden kişi kaydedilir.
          {job.driverId ? ' Şoföre bildirim gider.' : ''}
          {live ? ' Devam eden canlı konum takibi ve müşteri takip bağlantısı durur.' : ''}
        </Text>
        <View style={styles.chips}>
          {CANCEL_REASONS.map((r) => (
            <Chip
              key={r}
              label={r}
              active={reason.trim() === r}
              onPress={() => {
                setReason(r);
                setError(undefined);
              }}
            />
          ))}
        </View>
        <Input
          label="İptal nedeni"
          required
          value={reason}
          onChangeText={(t) => {
            setReason(t);
            if (error) setError(undefined);
          }}
          placeholder="Örn. Müşteri siparişi iptal etti"
          multiline
          maxLength={REASON_MAX}
          error={error}
          hint={`${reason.length}/${REASON_MAX}`}
        />
      </ScrollView>
    </Sheet>
  );
});

/**
 * İş silme onayı: belirgin uyarı, sonuçların listesi ve (kritik işlerde zorunlu) silme nedeni.
 * Silme mantıksaldır; iş "Silinen işler" ekranından geri alınabilir.
 */
export const DeleteJobSheet = memo(function DeleteJobSheet({ job, visible, onClose, onConfirm, pending }: SheetProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const required = deletionReasonRequired(job);

  const close = () => {
    setError(undefined);
    onClose();
  };

  const submit = async () => {
    const trimmed = reason.trim();
    if (required && !trimmed) {
      setError('Devam eden veya tamamlanmış işi silmek için neden yazın.');
      return;
    }
    if (await onConfirm(trimmed)) {
      setReason('');
      setError(undefined);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="İşi sil"
      subtitle={`${job.jobNo} · ${JOB_STATUS_LABEL[job.status]}`}
      footer={
        <>
          <Button label={`${job.jobNo} numaralı işi sil`} variant="destructive" icon={Trash2} onPress={submit} loading={pending} fullWidth />
          <Button label="Vazgeç" variant="ghost" onPress={close} disabled={pending} fullWidth />
        </>
      }>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.warning}>
          <TriangleAlert size={22} color={colors.danger} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="subheading" tone="danger">
              İş tüm listelerden kaldırılacak
            </Text>
            <Text variant="bodySmall" tone="secondary">
              Silinen iş iş listelerinde, haritada, raporlarda ve şoförün ekranında görünmez.
              {isInProgress(job.status) ? ' Devam eden canlı konum takibi durur.' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.facts}>
          <Fact text="Silme iptal değildir: işin durumu değişmez, iş yalnızca gizlenir." />
          <Fact text="Durum geçmişi, duraklar ve konum kayıtları saklanır; silme tarihi ve silen kişi kaydedilir." />
          <Fact text="Yönetici gerektiğinde Profil › Silinen işler ekranından görüntüleyip geri alabilir." />
        </View>
        <Input
          label="Silme nedeni"
          required={required}
          value={reason}
          onChangeText={(t) => {
            setReason(t);
            if (error) setError(undefined);
          }}
          placeholder={required ? 'Örn. Mükerrer kayıt, yanlış müşteri' : 'İsteğe bağlı'}
          multiline
          maxLength={REASON_MAX}
          error={error}
          hint={required ? 'Devam eden veya tamamlanmış işlerde zorunludur.' : undefined}
        />
      </ScrollView>
    </Sheet>
  );
});

function Fact({ text }: { text: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.dot} />
      <Text variant="bodySmall" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warning: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSoft,
  },
  facts: { gap: spacing.sm },
  fact: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textTertiary, marginTop: 7 },
});
