import { formatDuration } from '@conquete/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { rejectionText } from '@/features/run/rejection';
import { type LocalRun, pendingUploads } from '@/features/run/storage';
import { flushUploads } from '@/features/run/upload';
import { formatDate, formatNumber, t } from '@/i18n';
import { myRuns, type RunRow } from '@/lib/api';
import { Button, Chip, Glass, Screen, usePalette } from '@/ui/components';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { colors, font, fonts, space } from '@/ui/theme';

/** Historique des courses (troupes en attente en tête) et journal des courses rejetées. */
export default function Runs() {
  const p = usePalette();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [pending, setPending] = useState<LocalRun[]>([]);
  const load = useCallback(() => {
    setPending(pendingUploads());
    void myRuns().then(setRuns).catch(() => undefined);
  }, []);
  useFocusEffect(load);

  return (
    <Screen>
      <FlatList
        data={runs}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: space.md, paddingTop: space.lg, paddingBottom: TAB_BAR_SPACE + space.xl }}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Text style={font.h1}>{t('history.title')}</Text>
            {pending.length > 0 && (
              <Glass glow={colors.gold} style={{ padding: space.lg, borderRadius: 20, gap: space.sm }}>
                <Text style={font.h3}>
                  {t('history.pending')} ({pending.length})
                </Text>
                {pending.map((q) => (
                  <Text key={q.id} style={font.small}>
                    {formatDate(new Date(q.started_at ?? q.created_at))} {q.last_error ? `— ${q.last_error}` : ''}
                  </Text>
                ))}
                <Button title={t('common.retry')} variant="secondary" icon="cloud-upload-outline" onPress={() => void flushUploads().then(load)} />
              </Glass>
            )}
          </View>
        }
        ListEmptyComponent={
          <Glass style={{ padding: space.xl, borderRadius: 22, alignItems: 'center', gap: space.md }}>
            <Text style={{ fontSize: 42 }}>🏃</Text>
            <Text style={[font.body, { textAlign: 'center', color: colors.textDim }]}>{t('history.empty')}</Text>
            <Button title={t('tabs.run')} icon="walk" onPress={() => router.push('/run')} />
          </Glass>
        }
        renderItem={({ item }) => {
          const ok = item.status === 'validated';
          const canDeploy = item.troops_remaining > 0 && item.deploy_deadline && new Date(item.deploy_deadline) > new Date();
          return (
            <Pressable disabled={!canDeploy} onPress={() => router.push(`/deploy/${item.id}`)}>
              <Glass glow={canDeploy ? p.main : !ok ? colors.danger : undefined} style={{ padding: space.lg, borderRadius: 20, gap: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={font.label}>{item.started_at ? formatDate(item.started_at) : '—'}</Text>
                  {ok ? (
                    <Chip text={t('common.troops', { n: item.troops_earned })} icon="flag" color={p.main} filled />
                  ) : (
                    <Chip text={t('history.rejected')} icon="close-circle" color={colors.danger} filled />
                  )}
                </View>
                {ok ? (
                  <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'baseline' }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 34, color: colors.text }}>
                      {formatNumber((item.distance_m ?? 0) / 1000, 2)}
                      <Text style={{ fontFamily: fonts.label, fontSize: 15, color: colors.textDim }}> km</Text>
                    </Text>
                    <Text style={font.small}>
                      {formatDuration((item.duration_s ?? 0) * 1000)} · D+ {item.dplus_m ?? 0} m · {item.cells.length} ⬡
                    </Text>
                  </View>
                ) : (
                  <Text style={font.body}>{rejectionText(item)}</Text>
                )}
                {canDeploy && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="flag" size={16} color={p.main} />
                    <Text style={[font.bodyBold, { color: p.main, flex: 1 }]}>{t('history.toDeploy', { n: item.troops_remaining })}</Text>
                    <Ionicons name="chevron-forward" size={18} color={p.main} />
                  </View>
                )}
              </Glass>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
