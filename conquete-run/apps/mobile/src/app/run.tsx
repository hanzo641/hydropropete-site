import { formatDuration, formatPace } from '@conquete/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { HexMap } from '@/features/map/HexMap';
import { requestPermissions } from '@/features/run/locationTask';
import * as session from '@/features/run/session';
import { formatNumber, t } from '@/i18n';
import { Button, Card, Row, Screen, Stat } from '@/ui/components';
import { colors, font, radius, space } from '@/ui/theme';

export default function RunScreen() {
  const params = useLocalSearchParams<{ sim?: string }>();
  const s = session.useRunSession();
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'foreground-only' | 'denied'>('unknown');
  const [, setNow] = useState(Date.now());

  // Préchauffage du GPS dès l'ouverture (sauf simulation déjà préparée, ou course restaurée).
  useEffect(() => {
    if (s.phase === 'running' || (params.sim && s.phase === 'warming')) {
      setPermission('granted');
      return;
    }
    void (async () => {
      const p = await requestPermissions();
      setPermission(p);
      if (p !== 'denied') await session.prepare('gps');
    })();
  }, []);

  // Chronomètre
  useEffect(() => {
    const id = setInterval(() => {
      session.tick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cancel = async () => {
    await session.discard();
    router.back();
  };

  const finish = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = await session.finish();
    if (id) router.replace(`/summary/${id}`);
  };

  const discard = () =>
    Alert.alert(t('run.discard'), t('run.discardConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('run.discard'), style: 'destructive', onPress: () => void cancel() },
    ]);

  if (permission === 'denied') {
    return (
      <Screen style={{ justifyContent: 'center', gap: space.lg }}>
        <Text style={font.h2}>{t('run.permissionTitle')}</Text>
        <Text style={font.body}>{t('run.permissionDenied')}</Text>
        <Button title={t('run.permissionOpenSettings')} onPress={() => void Linking.openSettings()} />
        <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const snap = s.snapshot;
  const elapsed = s.startedAt ? Date.now() - s.startedAt : 0;
  const center = snap?.last ?? null;

  return (
    <Screen padded={false}>
      {s.simulation && (
        <View style={{ backgroundColor: colors.info, padding: space.xs }}>
          <Text style={{ textAlign: 'center', color: '#111', fontWeight: '800' }}>
            {t('run.simulationBanner', { name: s.simulation.name, speed: s.simulation.speed })}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {s.phase === 'running' && center ? (
          <HexMap center={center} zoom={15} lit={s.litCells} track={s.track} followUser={s.source === 'gps'} />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg, padding: space.xl }}>
            <View
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                borderWidth: 6,
                borderColor: s.readiness.state === 'ready' ? colors.success : s.readiness.state === 'weak' ? colors.accent : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={font.stat}>{s.readiness.accuracyM != null ? `${Math.round(s.readiness.accuracyM)} m` : '…'}</Text>
            </View>
            <Text style={[font.h3, { textAlign: 'center' }]}>
              {s.readiness.state === 'ready'
                ? t('run.gpsReady', { acc: Math.round(s.readiness.accuracyM ?? 0) })
                : s.readiness.canStart
                  ? t('run.gpsWeakStart', { acc: Math.round(s.readiness.accuracyM ?? 0) })
                  : s.readiness.state === 'weak'
                    ? t('run.gpsWeak', { acc: Math.round(s.readiness.accuracyM ?? 0) })
                    : t('run.gpsSearching')}
            </Text>
            {permission === 'foreground-only' && <Text style={[font.small, { textAlign: 'center' }]}>{t('run.permissionBody')}</Text>}
          </View>
        )}
      </View>

      <Card style={{ borderRadius: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: space.xxl }}>
        {s.phase === 'running' || s.phase === 'finished' ? (
          <>
            <Row>
              <Stat big label={t('run.time')} value={formatDuration(elapsed)} />
              <Stat big label={t('run.distance')} value={formatNumber((snap?.distanceM ?? 0) / 1000, 2)} unit="km" />
            </Row>
            <Row>
              <Stat label={t('run.pace')} value={formatPace(snap?.paceSecPerKm ?? null)} unit="/km" />
              <Stat label={t('run.dplusLive')} value={formatNumber(snap?.dplusM ?? 0)} unit="m" />
              <Stat label={t('run.cellsLit')} value={String(s.litCells.length)} />
            </Row>
            <Row style={{ marginTop: space.md }}>
              <Button title={t('run.discard')} variant="ghost" onPress={discard} style={{ flex: 1 }} />
              <Button
                title={`${t('run.stop')} ⏻`}
                variant="danger"
                style={{ flex: 2 }}
                onPress={() => Alert.alert(t('run.stopConfirm'), t('run.stopConfirmBody'))}
                onLongPress={() => void finish()}
                delayLongPress={800}
              />
            </Row>
          </>
        ) : (
          <Row>
            <Button title={t('common.cancel')} variant="ghost" onPress={() => void cancel()} style={{ flex: 1 }} />
            <Button
              title={t('run.start')}
              icon="play"
              disabled={!s.readiness.canStart}
              style={{ flex: 2 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                session.start();
              }}
            />
          </Row>
        )}
      </Card>
    </Screen>
  );
}
