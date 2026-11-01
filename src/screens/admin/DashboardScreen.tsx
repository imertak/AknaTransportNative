import { router, type Href } from "expo-router";
import { ArrowLeftRight, Building2, ChevronLeft, ChevronRight, Truck, UserRound, UsersRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { JobRow } from "@/components/jobs/JobRow";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ListItem,
  PageHeader,
  Screen,
  Section,
  StatTile,
  Text,
} from "@/components/ui";
import { JOB_STATUS_LABEL, isInProgress } from "@/constants/jobStatus";
import { useAuth, useCurrentUser } from "@/contexts/AuthContext";
import {
  useDashboardStats,
  useJobs,
  useLocations,
  useMonthRevenue,
  useUsers,
  useVehicles,
} from "@/hooks/useData";
import { useRefresh } from "@/hooks/useRefresh";
import { routes } from "@/navigation/routes";
import { colors, hitSlop, spacing } from "@/theme";
import type { JobStatus, TransportJob } from "@/types";
import {
  MONTH_NAMES,
  formatCurrency,
  formatDateLong,
  formatRelative,
  todayISO,
} from "@/utils/format";

const openJob = (job: TransportJob) => router.push(routes.job(job.id));
const jobsWith = (status: string): Href =>
  ({ pathname: "/admin/jobs", params: { status } }) as Href;

export default function DashboardScreen() {
  const user = useCurrentUser();
  const { setViewMode } = useAuth();
  const stats = useDashboardStats();
  const jobs = useJobs();
  const users = useUsers();
  const vehicles = useVehicles();
  const locations = useLocations();
  const { refreshing, onRefresh } = useRefresh();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const revenue = useMonthRevenue(period.year, period.month);
  const isCurrentMonth = period.year === now.getFullYear() && period.month === now.getMonth() + 1;
  const shiftMonth = (delta: number) =>
    setPeriod((p) => {
      const d = new Date(p.year, p.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

  const recentCreated = useMemo(
    () =>
      [...jobs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4),
    [jobs],
  );
  const recentCompleted = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "completed")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 4),
    [jobs],
  );

  const activeDrivers = useMemo(() => {
    const out: {
      userId: string;
      name: string;
      plate?: string;
      job: TransportJob;
    }[] = [];
    for (const u of users) {
      const job = jobs.find(
        (j) => j.driverId === u.id && isInProgress(j.status),
      );
      if (job)
        out.push({
          userId: u.id,
          name: u.fullName,
          // İşe seçilen araç; yoksa şoföre atanmış ilk aktif araç.
          plate: job.vehiclePlate ?? vehicles.find((v) => v.isActive && v.driverId === u.id)?.plate,
          job,
        });
    }
    return out;
  }, [users, jobs, vehicles]);

  const firstName = user.fullName.split(" ")[0];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textInverseMuted}
          />
        }
      >
        <PageHeader
          overline={formatDateLong(todayISO())}
          title={`Merhaba, ${firstName}`}
          right={
            <IconButton
              icon={UserRound}
              label="Profilim"
              tone="dark"
              onPress={() => router.push(routes.profile("admin"))}
            />
          }
        >
          <View style={styles.revenue}>
            <View style={styles.periodRow}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={hitSlop} accessibilityRole="button" accessibilityLabel="Önceki ay">
                <ChevronLeft size={18} color={colors.textInverseMuted} />
              </Pressable>
              <Text variant="bodySmall" tone="inverseMuted">
                {MONTH_NAMES[period.month - 1]} {period.year} nakliye geliri
              </Text>
              <Pressable
                onPress={() => shiftMonth(1)}
                disabled={isCurrentMonth}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Sonraki ay"
                style={isCurrentMonth && { opacity: 0.3 }}>
                <ChevronRight size={18} color={colors.textInverseMuted} />
              </Pressable>
            </View>
            {revenue.data ? (
              <Text variant="display" tone="inverse" style={styles.tabular}>
                {formatCurrency(revenue.data.revenue)}
              </Text>
            ) : revenue.error ? (
              <Pressable onPress={revenue.reload} accessibilityRole="button">
                <Text variant="bodySmall" tone="inverse">Gelir alınamadı: {revenue.error} · Tekrar dene</Text>
              </Pressable>
            ) : (
              <ActivityIndicator color={colors.textInverse} style={styles.revenueLoading} />
            )}
            <Text variant="bodySmall" tone="inverseMuted">
              {revenue.data ? `${revenue.data.completedJobs} tamamlanan iş · İptaller hariç` : " "}
              {isCurrentMonth ? ` · Açık işler ${formatCurrency(stats.openValue)}` : ""}
            </Text>
          </View>
        </PageHeader>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScroll}
          style={{ marginTop: 20 }}
        >
          <StatTile
            label="Toplam iş"
            value={stats.total}
            emphasis
            onPress={() => router.navigate(routes.adminJobs)}
          />
          <StatTile
            label="Bekleyen"
            value={stats.pending}
            onPress={() => router.navigate(jobsWith("pending"))}
          />
          <StatTile
            label="Atanan"
            value={stats.assigned}
            onPress={() => router.navigate(jobsWith("assigned"))}
          />
          <StatTile
            label="Devam eden"
            value={stats.inProgress}
            onPress={() => router.navigate(jobsWith("active"))}
          />
          <StatTile
            label="Tamamlanan"
            value={stats.completed}
            onPress={() => router.navigate(jobsWith("completed"))}
          />
          <StatTile
            label="İptal edilen"
            value={stats.cancelled}
            onPress={() => router.navigate(jobsWith("cancelled"))}
          />
        </ScrollView>

        <View style={styles.body}>
          <Button
            label="Şoför görünümüne dön"
            icon={ArrowLeftRight}
            variant="secondary"
            onPress={() => setViewMode("driver")}
            accessibilityHint="Rolünüz değişmez; yalnızca şoför ekranlarına geçersiniz"
          />

          <Card padded={false}>
            <ListItem icon={Building2} title="Müşteriler" subtitle="Müşteri kayıtları ve geçmiş işler" onPress={() => router.push(routes.customers)} />
            <View style={styles.sep} />
            <ListItem icon={UsersRound} title="Şoförler" subtitle="Şoför ekleme, araç atama ve şifre sıfırlama" onPress={() => router.push(routes.drivers)} />
            <View style={styles.sep} />
            <ListItem icon={Truck} title="Araçlar" subtitle="Araç kaydı ve şoföre atama" onPress={() => router.push(routes.vehicles)} />
          </Card>

          <Section
            title={`Aktif şoförler · ${activeDrivers.length}`}
            action={
              activeDrivers.length ? (
                <Button
                  label="Haritada gör"
                  variant="ghost"
                  size="sm"
                  onPress={() => router.navigate(routes.adminMap)}
                />
              ) : undefined
            }
          >
            {activeDrivers.length === 0 ? (
              <EmptyState
                compact
                icon={Truck}
                title="Sahada aktif şoför yok"
                description="Devam eden işler burada görünür."
              />
            ) : (
              <Card padded={false}>
                {activeDrivers.map((d, i) => {
                  const loc = locations[d.job.id];
                  return (
                    <View
                      key={d.userId}
                      style={[
                        styles.driver,
                        i < activeDrivers.length - 1 && styles.driverBorder,
                      ]}
                    >
                      <Avatar name={d.name} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="subheading">{d.name}</Text>
                        <Text
                          variant="bodySmall"
                          tone="secondary"
                          numberOfLines={1}
                        >
                          {d.plate ? `${d.plate} · ` : ""}
                          {d.job.customerName}
                        </Text>
                        <Text variant="bodySmall" tone="tertiary">
                          {loc
                            ? `Konum ${formatRelative(loc.fix.timestamp)}`
                            : "Konum paylaşılmıyor"}
                        </Text>
                      </View>
                      <Badge
                        label={JOB_STATUS_LABEL[d.job.status as JobStatus]}
                        tone={d.job.status === "accepted" ? "strong" : "solid"}
                        dot={d.job.status !== "accepted"}
                      />
                    </View>
                  );
                })}
              </Card>
            )}
          </Section>

          <Section
            title="Son oluşturulan işler"
            action={
              <Button
                label="Tümü"
                variant="ghost"
                size="sm"
                onPress={() => router.navigate(routes.adminJobs)}
              />
            }
          >
            <Card style={styles.listCard}>
              {recentCreated.length ? (
                recentCreated.map((j, i) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    onPress={openJob}
                    last={i === recentCreated.length - 1}
                  />
                ))
              ) : (
                <Text tone="tertiary">Henüz iş yok.</Text>
              )}
            </Card>
          </Section>

          <Section title="Son tamamlanan işler">
            <Card style={styles.listCard}>
              {recentCompleted.length ? (
                recentCompleted.map((j, i) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    onPress={openJob}
                    last={i === recentCompleted.length - 1}
                  />
                ))
              ) : (
                <Text tone="tertiary">Tamamlanan iş yok.</Text>
              )}
            </Card>
          </Section>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge },
  revenue: { gap: spacing.xs, paddingTop: spacing.xs },
  periodRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  revenueLoading: { alignSelf: "flex-start", height: 38 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong, marginLeft: 64 },
  tabular: { fontVariant: ["tabular-nums"] },
  body: { padding: spacing.lg, gap: spacing.xxl },
  statsScroll: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  driver: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  driverBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  listCard: { paddingVertical: spacing.xs },
});
