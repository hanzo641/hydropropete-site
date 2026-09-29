import { coarsen, toGpx } from '@conquete/core';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { wipeLocalData } from '@/features/run/storage';
import { t } from '@/i18n';
import { getGpsConsent, getPrivacySettings, invokeFunction, setGpsConsent, setPrivacyZone } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, ErrorText, Row, Screen } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

interface ExportPayload {
  exported_at: string;
  profile: unknown;
  runs: { id: string; started_at: string | null }[];
  traces: { run_id: string; points: [number, number, number, number | null, number | null][] }[];
  [k: string]: unknown;
}

export default function Privacy() {
  const { signOut } = useAuth();
  const [radius, setRadius] = useState(300);
  const [hasZone, setHasZone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);

  useEffect(() => {
    void getGpsConsent().then(setConsent).catch(() => undefined);
    void getPrivacySettings()
      .then((s) => {
        if (!s) return;
        setRadius(s.privacy_radius_m);
        setHasZone(s.has_zone);
      })
      .catch(() => undefined);
  }, []);

  const wrap = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setError(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const setHere = () =>
    wrap('zone', async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error(t('run.permissionDenied'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = coarsen({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      await setPrivacyZone(p.lat, p.lng, radius);
      setHasZone(true);
      setMsg(t('privacy.zoneSet'));
    });

  const exportData = () =>
    wrap('export', async () => {
      const data = await invokeFunction<ExportPayload>('export-data', {});
      const gpx = Object.fromEntries(
        data.traces.map((tr) => [
          tr.run_id,
          toGpx(
            tr.run_id,
            tr.points.map(([t0, lat, lng, , alt]) => ({ t: t0, lat, lng, alt })),
          ),
        ]),
      );
      const file = new File(Paths.cache, `conquete-run-export-${new Date().toISOString().slice(0, 10)}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify({ ...data, gpx }, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    });

  const deleteAccount = () =>
    Alert.alert(t('privacy.delete'), t('privacy.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('privacy.delete'),
        style: 'destructive',
        onPress: () =>
          void wrap('delete', async () => {
            await invokeFunction('delete-account', { confirm: true });
            wipeLocalData();
            await signOut();
            Alert.alert(t('privacy.deleted'));
            router.replace('/sign-in');
          }),
      },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}>
        <Text style={font.h1}>{t('privacy.title')}</Text>
        <Card>
          <Text style={font.h3}>{t('privacy.zoneTitle')}</Text>
          <Text style={font.small}>{t('privacy.zoneHelp')}</Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <Button title="−" variant="secondary" onPress={() => setRadius((r) => Math.max(200, r - 100))} />
            <Text style={font.h3}>{t('privacy.radius', { n: radius })}</Text>
            <Button title="+" variant="secondary" onPress={() => setRadius((r) => Math.min(1000, r + 100))} />
          </Row>
          <Button title={t('privacy.setHere')} icon="home-outline" loading={busy === 'zone'} onPress={() => void setHere()} />
          {hasZone && (
            <Button
              title={t('privacy.remove')}
              variant="ghost"
              onPress={() => void wrap('zone', async () => {
                await setPrivacyZone(null, null, radius);
                setHasZone(false);
              })}
            />
          )}
          {msg && <Text style={{ color: colors.success }}>{msg}</Text>}
        </Card>
        <Card>
          <Text style={font.h3}>{t('privacy.consentTitle')}</Text>
          <Text style={font.small}>{t('privacy.consentHelp')}</Text>
          {consent != null && (
            <Button
              title={consent ? t('privacy.revokeConsent') : t('privacy.grantConsent')}
              variant={consent ? 'ghost' : 'primary'}
              loading={busy === 'consent'}
              onPress={() =>
                void wrap('consent', async () => {
                  await setGpsConsent(!consent);
                  setConsent(!consent);
                })
              }
            />
          )}
        </Card>
        <Card>
          <Text style={font.h3}>{t('privacy.export')}</Text>
          <Text style={font.small}>{t('privacy.exportHelp')}</Text>
          <Button title={t('privacy.export')} variant="secondary" icon="download-outline" loading={busy === 'export'} onPress={() => void exportData()} />
        </Card>
        <Card>
          <Button title={t('privacy.delete')} variant="danger" icon="trash-outline" loading={busy === 'delete'} onPress={deleteAccount} />
        </Card>
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </Screen>
  );
}
