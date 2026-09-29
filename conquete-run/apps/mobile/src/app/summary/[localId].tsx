import { formatDuration, TROPHIES } from '@conquete/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import * as session from '@/features/run/session';
import { getRun as getLocalRun } from '@/features/run/storage';
import { type SubmitRunResponse, uploadRun } from '@/features/run/upload';
import { rejectionText } from '@/features/run/rejection';
import { dict, formatNumber, getLocale, t } from '@/i18n';
import { getRun } from '@/lib/api';
import { Button, Card, Row, Screen, Stat } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

export default function Summary() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const [state, setState] = useState<'uploading' | 'queued' | 'done'>('uploading');
  const [res, setRes] = useState<SubmitRunResponse | null>(null);

  useEffect(() => {
    session.reset();
    void (async () => {
      const local = getLocalRun(localId);
      try {
        if (local?.upload_status === 'done' && local.server_run_id) {
          setRes({ run: await getRun(local.server_run_id), trophies: [], duplicate: true });
        } else {
          setRes(await uploadRun(localId));
        }
        setState('done');
      } catch {
        setState('queued');
      }
    })();
  }, [localId]);

  const run = res?.run;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.xl }}>
        <Text style={font.h1}>{t('summary.title')}</Text>
        {state === 'uploading' && (
          <Card style={{ alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={font.body}>{t('summary.uploading')}</Text>
          </Card>
        )}
        {state === 'queued' && (
          <Card>
            <Text style={font.body}>{t('summary.queued')}</Text>
            <Text style={font.small}>{t('common.offline')}</Text>
          </Card>
        )}
        {run && run.status === 'rejected' && (
          <Card style={{ borderWidth: 1, borderColor: colors.danger }}>
            <Text style={[font.h2, { color: colors.danger }]}>{t('summary.rejected')}</Text>
            <Text style={font.body}>{rejectionText(run)}</Text>
          </Card>
        )}
        {run && run.status === 'validated' && (
          <>
            <Card>
              <Text style={[font.h2, { color: colors.success }]}>{t('summary.validated')}</Text>
              <Row>
                <Stat big label={t('run.distance')} value={formatNumber((run.distance_m ?? 0) / 1000, 2)} unit="km" />
                <Stat big label={t('run.time')} value={formatDuration((run.duration_s ?? 0) * 1000)} />
              </Row>
              <Row>
                <Stat label={t('run.dplus')} value={formatNumber(run.dplus_m ?? 0)} unit="m" />
                <Stat label={t('run.cellsLit')} value={String(run.cells.length)} />
              </Row>
              <Text style={font.small}>
                D+ : {dict().summary.dplusSource[(run.dplus_source ?? 'gps') as keyof ReturnType<typeof dict>['summary']['dplusSource']] ?? run.dplus_source}
              </Text>
            </Card>
            <Card style={{ alignItems: 'center' }}>
              <Text style={[font.stat, { color: colors.accent }]}>{t('summary.troopsEarned', { n: run.troops_earned })}</Text>
              <Text style={font.h3}>{t('summary.xpEarned', { n: run.xp_earned })}</Text>
              {run.counted_km * 1000 < (run.distance_m ?? 0) - 1 && <Text style={font.small}>{t('summary.capped')}</Text>}
              {run.season_id == null && <Text style={font.small}>{t('summary.noSeason')}</Text>}
            </Card>
            {res!.trophies.length > 0 && (
              <Card>
                <Text style={font.h3}>{t('summary.trophies')}</Text>
                {res!.trophies.map((id) => {
                  const tr = TROPHIES.find((x) => x.id === id);
                  return tr ? (
                    <Text key={id} style={font.body}>
                      {tr.icon} {tr.name[getLocale()]} — {tr.description[getLocale()]}
                    </Text>
                  ) : null;
                })}
              </Card>
            )}
            <View style={{ gap: space.md }}>
              {run.troops_remaining > 0 && <Button title={t('summary.deploy')} icon="flag" onPress={() => router.replace(`/deploy/${run.id}`)} />}
              <Button title={run.troops_remaining > 0 ? t('summary.later') : t('common.close')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
            </View>
          </>
        )}
        {(state === 'queued' || run?.status === 'rejected') && (
          <Button title={t('common.close')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
        )}
      </ScrollView>
    </Screen>
  );
}
