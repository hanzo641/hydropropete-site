import { formatDuration } from '@conquete/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { rejectionText } from '@/features/run/rejection';
import { type LocalRun, pendingUploads } from '@/features/run/storage';
import { flushUploads } from '@/features/run/upload';
import { formatDate, formatNumber, t } from '@/i18n';
import { myRuns, type RunRow } from '@/lib/api';
import { Button, Card, Screen } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

/** Historique des courses et journal des courses rejetées (avec la raison). */
export default function Runs() {
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
        contentContainerStyle={{ gap: space.md, paddingVertical: space.lg }}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Text style={font.h1}>{t('history.title')}</Text>
            {pending.length > 0 && (
              <Card>
                <Text style={font.h3}>
                  {t('history.pending')} ({pending.length})
                </Text>
                {pending.map((p) => (
                  <Text key={p.id} style={font.small}>
                    {formatDate(new Date(p.started_at ?? p.created_at))} {p.last_error ? `— ${p.last_error}` : ''}
                  </Text>
                ))}
                <Button title={t('common.retry')} variant="secondary" onPress={() => void flushUploads().then(load)} />
              </Card>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={font.small}>{t('history.empty')}</Text>}
        renderItem={({ item }) => (
          <Card style={item.status === 'rejected' ? { borderWidth: 1, borderColor: colors.danger } : undefined}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={font.h3}>{item.started_at ? formatDate(item.started_at) : '—'}</Text>
              <Text style={{ color: item.status === 'validated' ? colors.success : colors.danger, fontWeight: '700' }}>
                {item.status === 'validated' ? t('history.validated') : t('history.rejected')}
              </Text>
            </View>
            {item.status === 'validated' ? (
              <Text style={font.body}>
                {formatNumber((item.distance_m ?? 0) / 1000, 2)} km · {formatDuration((item.duration_s ?? 0) * 1000)} · D+{' '}
                {item.dplus_m ?? 0} m · {t('common.troops', { n: item.troops_earned })}
              </Text>
            ) : (
              <Text style={font.body}>{rejectionText(item)}</Text>
            )}
            {item.troops_remaining > 0 && item.deploy_deadline && new Date(item.deploy_deadline) > new Date() && (
              <Button title={t('summary.deploy')} onPress={() => router.push(`/deploy/${item.id}`)} />
            )}
          </Card>
        )}
      />
    </Screen>
  );
}
