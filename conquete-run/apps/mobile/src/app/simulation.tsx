import { parseGpx } from '@conquete/core';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import * as session from '@/features/run/session';
import { BUILTIN_TRACES, type BuiltinTrace, type CompactTrace, fromRawPoints } from '@/features/run/simulation';
import { dict, t } from '@/i18n';
import { Button, Card, ErrorText, Row, Screen } from '@/ui/components';
import { colors, font, radius, space } from '@/ui/theme';

const SPEEDS = [1, 5, 20];

/** Mode simulation : rejoue une trace GPX à la place du vrai GPS (tests sans courir). */
export default function Simulation() {
  const [selected, setSelected] = useState<{ name: string; trace: () => CompactTrace }>({
    name: 'ville-pau',
    trace: BUILTIN_TRACES['ville-pau'],
  });
  const [speed, setSpeed] = useState(20);
  const [error, setError] = useState<string | null>(null);
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
    await session.prepare('simulation', { name: selected.name, speed, trace: selected.trace() });
    router.replace('/run?sim=1');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}>
        <Text style={font.h1}>{t('simulation.title')}</Text>
        <Text style={font.small}>{t('simulation.help')}</Text>
        <Card>
          {(Object.keys(BUILTIN_TRACES) as BuiltinTrace[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setSelected({ name: k, trace: BUILTIN_TRACES[k] })}
              style={{ padding: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: selected.name === k ? colors.accent : colors.border }}>
              <Text style={font.body}>{names[k]}</Text>
            </Pressable>
          ))}
          <Button title={t('simulation.import')} variant="ghost" icon="document-outline" onPress={() => void importGpx()} />
          {!(selected.name in BUILTIN_TRACES) && <Text style={font.small}>✓ {selected.name}</Text>}
        </Card>
        <Row>
          {SPEEDS.map((s) => (
            <Button key={s} title={t('simulation.speed', { n: s })} variant={speed === s ? 'primary' : 'secondary'} style={{ flex: 1 }} onPress={() => setSpeed(s)} />
          ))}
        </Row>
        <ErrorText>{error}</ErrorText>
        <Button title={t('simulation.start')} icon="play" onPress={() => void start()} />
      </ScrollView>
    </Screen>
  );
}
