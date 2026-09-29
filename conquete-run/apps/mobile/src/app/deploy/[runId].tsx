import {
  type Allocation,
  autoDistribute,
  cellCenter,
  type DeployTarget,
  factionById,
  previewDeployment,
  troopsToCapture,
  validateAllocations,
  WILD_COLOR,
} from '@conquete/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { DragGauge } from '@/features/deploy/DragGauge';
import { ResultsList } from '@/features/deploy/ResultsList';
import { HexMap } from '@/features/map/HexMap';
import { formatDate, formatNumber, t, type TKey } from '@/i18n';
import { type DeployResultRow, deployTargets, deployTroops, getRun, type RunRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentConfig, loadGameConfig } from '@/lib/gameConfig';
import { Button, Card, ErrorText, Row, Screen } from '@/ui/components';
import { colors, font, radius, space } from '@/ui/theme';

export default function Deploy() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const { profile, refreshProfile } = useAuth();
  const faction = profile?.faction_id ?? 0;
  const [run, setRun] = useState<RunRow | null>(null);
  const [targets, setTargets] = useState<DeployTarget[]>([]);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [results, setResults] = useState<DeployResultRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await loadGameConfig();
        const [r, rows] = await Promise.all([getRun(runId), deployTargets(runId)]);
        setRun(r);
        setTargets(
          rows.map((x) => ({
            cell: x.h3,
            region: x.region,
            state: { owner: x.owner_faction, garrison: Number(x.garrison) },
            regionController: x.region_controller,
          })),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [runId]);

  const cfg = currentConfig();
  const available = run?.troops_remaining ?? 0;
  const used = Object.values(alloc).reduce((s, n) => s + n, 0);
  const remaining = available - used;
  const allocations: Allocation[] = Object.entries(alloc)
    .filter(([, n]) => n > 0)
    .map(([cell, troops]) => ({ cell, troops }));
  const preview = useMemo(
    () => previewDeployment(new Map(targets.map((x) => [x.cell, x])), allocations, faction, cfg),
    [targets, alloc, faction, cfg],
  );
  const bbox = useMemo(() => {
    if (targets.length === 0) return null;
    const pts = targets.map((x) => cellCenter(x.cell));
    const pad = 0.004;
    return {
      south: Math.min(...pts.map((p) => p.lat)) - pad,
      north: Math.max(...pts.map((p) => p.lat)) + pad,
      west: Math.min(...pts.map((p) => p.lng)) - pad,
      east: Math.max(...pts.map((p) => p.lng)) + pad,
    };
  }, [targets]);

  const submit = async () => {
    const err = validateAllocations(allocations, new Set(targets.map((x) => x.cell)), available);
    if (err) {
      setError(t(`deploy.errors.${err}` as TKey));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await deployTroops(runId, allocations);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResults(res);
      void refreshProfile();
    } catch (e) {
      const key = `deploy.errors.${(e as Error).message}` as TKey;
      setError(t(key) === key ? t('common.error') : t(key));
    } finally {
      setBusy(false);
    }
  };

  if (!run && !error) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (results) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.xl }}>
          <Text style={font.h1}>{t('deploy.results')}</Text>
          <ResultsList results={results} />
          <Button title={t('deploy.done')} onPress={() => router.replace('/(tabs)')} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ height: 220 }}>
        {bbox && <HexMap center={cellCenter(targets[0]!.cell)} lit={targets.map((x) => x.cell)} fitTo={bbox} />}
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={font.h2}>{t('deploy.title')}</Text>
          <Text style={[font.h3, { color: remaining > 0 ? colors.accent : colors.textDim }]}>{t('deploy.remaining', { n: remaining })}</Text>
        </Row>
        {run?.deploy_deadline && <Text style={font.small}>{t('deploy.deadline', { date: formatDate(run.deploy_deadline) })}</Text>}
        <Text style={font.small}>{t('deploy.dragHint')}</Text>
        {targets.map((x) => {
          const mine = x.state.owner === faction;
          const color = factionById(x.state.owner)?.color ?? WILD_COLOR;
          const here = alloc[x.cell] ?? 0;
          const bonus = x.regionController === faction;
          const p = preview.get(x.cell);
          const kind = mine ? t('deploy.yours') : x.state.owner == null ? t('deploy.wild') : t('deploy.enemy');
          let outcome = '';
          if (p && here > 0) {
            outcome =
              p.outcome === 'captured'
                ? t('deploy.willCapture')
                : p.outcome === 'reinforced'
                  ? t('deploy.willReinforce', { n: formatNumber(p.after.garrison, 1) })
                  : t('deploy.willDamage', { n: formatNumber(p.after.garrison, 1) });
          }
          return (
            <Card key={x.cell} style={{ gap: space.sm, borderLeftWidth: 6, borderLeftColor: color, borderRadius: radius.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={font.h3}>
                  {kind} · {formatNumber(x.state.garrison, 1)}
                </Text>
                <Text style={font.small}>
                  {!mine ? t('deploy.need', { n: troopsToCapture(x, faction, cfg) }) : ''}
                  {bonus ? `  ${t('deploy.bonus')}` : ''}
                </Text>
              </Row>
              <DragGauge
                value={here}
                max={here + remaining}
                color={mine ? color : (factionById(faction)?.color ?? colors.accent)}
                onChange={(v) => setAlloc((a) => ({ ...a, [x.cell]: v }))}
                accessibilityLabel={`${kind} ${formatNumber(x.state.garrison, 1)}`}
              />
              {outcome ? (
                <Text style={[font.small, p?.outcome === 'captured' && { color: colors.accent, fontWeight: '800' }]}>{outcome}</Text>
              ) : null}
            </Card>
          );
        })}
        <ErrorText>{error}</ErrorText>
        <Row>
          <Button
            title={t('deploy.auto')}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => setAlloc(Object.fromEntries(autoDistribute(targets, available, faction, cfg).map((a) => [a.cell, a.troops])))}
          />
          <Button title={t('deploy.reset')} variant="ghost" style={{ flex: 1 }} onPress={() => setAlloc({})} />
        </Row>
        <Button title={t('deploy.confirm', { n: used })} loading={busy} disabled={used === 0} onPress={() => void submit()} />
      </ScrollView>
    </Screen>
  );
}
