import { parseGpx } from '@conquete/core';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { GAME_MODE } from '@/backend';
import * as session from '@/features/run/session';
import { BUILTIN_TRACES, type BuiltinTrace, type CompactTrace, fromRawPoints, relocate } from '@/features/run/simulation';
import { dict, t } from '@/i18n';
import { Button, ErrorText, Glass, Screen, usePalette } from '@/ui/components';
import { colors, font, fonts, space } from '@/ui/theme';

const SPEEDS = [1, 5, 20];

/** Mode simulation : rejoue une trace GPX à la place du vrai GPS (tests sans courir). */
export default function Simulation() {
  const p = usePalette();
  const [selected, setSelected] = useState<{ name: string; trace: () => CompactTrace }>({
    name: 'ville-pau',
    trace: BUILTIN_TRACES['ville-pau'],
  });
  const [speed, setSpeed] = useState(20);
  const [nearMe, setNearMe] = useState(GAME_MODE === 'local');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names = dict().simulation.traces;

  const importGpx = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const text = await new File(res.assets[0].uri).text();
    const pts = parseGpx(text);
    if (pts.length < 30) {
      setError('GPX : trop peu de points.');
      return;
    }
    const trace = fromRawPoints(pts);
    setSelected({ name: res.assets[0].name, trace: () => trace });
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      let trace = selected.trace();
      if (nearMe) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') throw new Error(t('run.permissionDenied'));
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        trace = relocate(trace, { lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
      await session.prepare('simulation', { name: selected.name, speed, trace });
      router.replace('/run?sim=1');
    } catch (e) {
      setError((e as Error).message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}>
        <Text style={font.h1}>{t('simulation.title')}</Text>
        <Text style={font.small}>{t('simulation.help')}</Text>
        <View style={{ gap: space.sm }}>
          {(Object.keys(BUILTIN_TRACES) as BuiltinTrace[]).map((k) => (
            <Pressable key={k} onPress={() => setSelected({ name: k, trace: BUILTIN_TRACES[k] })}>
              <Glass glow={selected.name === k ? p.main : undefined} style={{ padding: space.lg, borderRadius: 18 }}>
                <Text style={[font.bodyBold, selected.name === k && { color: p.main }]}>{names[k]}</Text>
              </Glass>
            </Pressable>
          ))}
          <Button title={t('simulation.import')} variant="ghost" icon="document-outline" onPress={() => void importGpx()} />
          {!(selected.name in BUILTIN_TRACES) && <Text style={font.small}>✓ {selected.name}</Text>}
        </View>
        <Glass style={{ padding: space.lg, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={font.bodyBold}>{t('simulation.nearMe')}</Text>
            <Text style={font.small}>{t('simulation.nearMeHelp')}</Text>
          </View>
          <Switch value={nearMe} onValueChange={setNearMe} trackColor={{ true: p.main, false: colors.surfaceHigh }} thumbColor="#FFFFFF" />
        </Glass>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {SPEEDS.map((s) => (
            <Pressable key={s} onPress={() => setSpeed(s)} style={{ flex: 1 }}>
              <Glass glow={speed === s ? p.main : undefined} style={{ paddingVertical: space.md, borderRadius: 14, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: speed === s ? p.main : colors.text }}>×{s}</Text>
              </Glass>
            </Pressable>
          ))}
        </View>
        <ErrorText>{error}</ErrorText>
        <Button title={t('simulation.start')} size="lg" icon="play" loading={busy} onPress={() => void start()} />
      </ScrollView>
    </Screen>
  );
}
