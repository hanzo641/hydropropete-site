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
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BattleSequence } from '@/features/deploy/BattleSequence';
import { DragGauge } from '@/features/deploy/DragGauge';
import { ResultsList } from '@/features/deploy/ResultsList';
import { HexMap } from '@/features/map/HexMap';
import { formatDate, formatNumber, t, type TKey } from '@/i18n';
import { type DeployResultRow, deployTargets, deployTroops, getRun, type RunRow, warOverview } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentConfig, loadGameConfig } from '@/lib/gameConfig';
import { Button, Chip, ErrorText, Glass, Screen, usePalette } from '@/ui/components';
import { Emblem, FadeIn } from '@/ui/game';
import { colors, font, fonts, paletteOf, space } from '@/ui/theme';

export default function Deploy() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const p = usePalette();
  const faction = profile?.faction_id ?? 0;
  const [run, setRun] = useState<RunRow | null>(null);
  const [targets, setTargets] = useState<DeployTarget[]>([]);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [front, setFront] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [results, setResults] = useState<DeployResultRow[] | null>(null);
  const [battle, setBattle] = useState<DeployResultRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void (async () => {
      try {
        const { cfg } = await loadGameConfig();
        const [r, rows, war] = await Promise.all([getRun(runId), deployTargets(runId), warOverview(profile?.home_zone ?? '').catch(() => null)]);
        const ts: DeployTarget[] = rows.map((x) => ({
          cell: x.h3,
          region: x.region,
          state: { owner: x.owner_faction, garrison: Number(x.garrison) },
          regionController: x.region_controller,
        }));
        setRun(r);
        setTargets(ts);
        setFront(war?.front ?? null);
        // répartition optimale proposée d'emblée : un tap suffit pour lancer l'assaut
        const auto = Object.fromEntries(autoDistribute(ts, r.troops_remaining, faction, cfg).map((a) => [a.cell, a.troops]));
        setAlloc(auto);
        // les cases où partent les troupes en premier (ordre figé : pas de saut pendant le glisser)
        setOrder([...ts].sort((a, b) => (auto[b.cell] ?? 0) - (auto[a.cell] ?? 0)).map((x) => x.cell));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // chargement unique par course
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
    // allocations dérive de alloc
    [targets, alloc, faction, cfg],
  );
  const willCapture = [...preview.values()].filter((x) => x.outcome === 'captured').length;
  const bbox = useMemo(() => {
    if (targets.length === 0) return null;
    const pts = targets.map((x) => cellCenter(x.cell));
    const pad = 0.004;
    return {
      south: Math.min(...pts.map((q) => q.lat)) - pad,
      north: Math.max(...pts.map((q) => q.lat)) + pad,
      west: Math.min(...pts.map((q) => q.lng)) - pad,
      east: Math.max(...pts.map((q) => q.lng)) + pad,
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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await deployTroops(runId, allocations);
      void refreshProfile();
      // la bataille se joue sur la carte, puis le rapport
      if (res.length > 0) setBattle(res);
      else setResults(res);
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
        <ActivityIndicator color={p.main} />
      </Screen>
    );
  }

  if (battle) {
    return (
      <BattleSequence
        results={battle}
        faction={faction}
        bbox={bbox}
        onDone={() => {
          setResults(battle);
          setBattle(null);
          flash.setValue(0.35);
          Animated.timing(flash, { toValue: 0, duration: 500, useNativeDriver: true }).start();
        }}
      />
    );
  }

  if (results) {
    const captured = results.filter((r) => r.outcome === 'captured').length;
    const reinforced = results.filter((r) => r.outcome === 'reinforced').length;
    const damaged = results.filter((r) => r.outcome === 'damaged').length;
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.xl }}>
          <FadeIn>
            <Text style={[font.label, { color: p.main }]}>⚔️ {t('deploy.title')}</Text>
            <Text style={font.hero}>{t('deploy.results')}</Text>
          </FadeIn>
          <FadeIn delay={100}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {captured > 0 && <Chip text={t('deploy.summaryCaptured', { n: captured })} icon="flag" color={p.main} filled />}
              {reinforced > 0 && <Chip text={t('deploy.summaryReinforced', { n: reinforced })} icon="shield-checkmark" color={colors.success} filled />}
              {damaged > 0 && <Chip text={t('deploy.summaryDamaged', { n: damaged })} icon="flash" color={colors.gold} filled />}
            </View>
          </FadeIn>
          <ResultsList results={results} />
          <Button title={t('deploy.done')} size="lg" icon="map" onPress={() => router.replace('/(tabs)')} />
        </ScrollView>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: p.main, opacity: flash }]} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: 290 }}>
        {bbox && <HexMap center={{ lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 }} pitch={40} lit={targets.map((x) => x.cell)} fitTo={bbox} front={front} />}
        <LinearGradient pointerEvents="none" colors={['transparent', colors.bg]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={{ position: 'absolute', top: insets.top + 8, left: space.md }}>
          <Glass style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Glass>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 140 + insets.bottom, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={font.h1}>{t('deploy.title')}</Text>
            {run?.deploy_deadline && <Text style={font.small}>{t('deploy.deadline', { date: formatDate(run.deploy_deadline) })}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 52, color: remaining > 0 ? p.main : colors.textDim }}>{remaining}</Text>
            <Text style={[font.label, { fontSize: 11 }]}>{t('deploy.left')}</Text>
          </View>
        </View>
        <Text style={font.small}>{t('deploy.dragHint')}</Text>
        {[...targets].sort((a, b) => order.indexOf(a.cell) - order.indexOf(b.cell)).map((x) => {
          const mine = x.state.owner === faction;
          const color = factionById(x.state.owner)?.color ?? WILD_COLOR;
          const here = alloc[x.cell] ?? 0;
          const bonus = x.regionController === faction;
          const pv = preview.get(x.cell);
          const kind = mine ? t('deploy.yours') : x.state.owner == null ? t('deploy.wild') : t('deploy.enemy');
          const onFront = x.region === front;
          let outcome = '';
          if (pv && here > 0) {
            outcome =
              pv.outcome === 'captured'
                ? t('deploy.willCapture')
                : pv.outcome === 'reinforced'
                  ? t('deploy.willReinforce', { n: formatNumber(pv.after.garrison, 1) })
                  : t('deploy.willDamage', { n: formatNumber(pv.after.garrison, 1) });
          }
          const capture = pv?.outcome === 'captured' && here > 0;
          return (
            <Glass key={x.cell} glow={capture ? p.main : undefined} style={{ padding: space.md, gap: space.sm, borderRadius: 20 }}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Emblem factionId={x.state.owner} size={24} />
                <Text style={[font.h3, { flex: 1 }]}>
                  {kind} · <Text style={{ fontFamily: fonts.display, fontSize: 20 }}>{formatNumber(x.state.garrison, 1)}</Text>
                </Text>
                {capture ? (
                  <Text style={{ fontFamily: fonts.display, fontSize: 20, color: p.main }}>{outcome}</Text>
                ) : outcome ? (
                  <Text style={font.small}>{outcome}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {!mine && <Chip text={t('deploy.need', { n: troopsToCapture(x, faction, cfg) })} color={colors.textDim} />}
                {bonus && <Chip text={t('deploy.bonus')} color={p.main} filled />}
                {onFront && <Chip text={t('deploy.front')} emoji="⚔️" color={colors.gold} filled />}
              </View>
              <DragGauge
                value={here}
                max={here + remaining}
                gradient={mine ? paletteOf(faction).gradient : p.gradient}
                onChange={(v) => setAlloc((a) => ({ ...a, [x.cell]: v }))}
                accessibilityLabel={`${kind} ${formatNumber(x.state.garrison, 1)}`}
              />
            </Glass>
          );
        })}
        <ErrorText>{error}</ErrorText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            title={t('deploy.auto')}
            variant="secondary"
            icon="sparkles"
            style={{ flex: 1 }}
            onPress={() => setAlloc(Object.fromEntries(autoDistribute(targets, available, faction, cfg).map((a) => [a.cell, a.troops])))}
          />
          <Button title={t('deploy.reset')} variant="ghost" style={{ flex: 1 }} onPress={() => setAlloc({})} />
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md, paddingTop: space.md }}>
        <LinearGradient pointerEvents="none" colors={['transparent', colors.bg]} style={StyleSheet.absoluteFill} />
        <Button
          title={`${t('deploy.confirm', { n: used })}${willCapture > 0 ? `  ·  ${willCapture} 🚩` : ''}`}
          size="lg"
          icon="flash"
          loading={busy}
          disabled={used === 0}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );
}
