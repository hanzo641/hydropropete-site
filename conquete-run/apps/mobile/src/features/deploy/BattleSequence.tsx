import { type BBox, cellCenter, factionById, WILD_COLOR } from '@conquete/core';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { type FlyTarget, HexMap } from '@/features/map/HexMap';
import { play, preload } from '@/features/sfx';
import { formatNumber, t } from '@/i18n';
import type { DeployResultRow } from '@/lib/api';
import { Glass } from '@/ui/components';
import { Emblem } from '@/ui/game';
import { Burst, Flash, Shockwave, Stamp, useShake } from '@/ui/fx';
import { hexPath } from '@/ui/hex';
import { colors, fonts, paletteOf } from '@/ui/theme';

type Phase = 'fly' | 'volley' | 'impact' | 'outcome' | 'final';

/** Nombre qui glisse d'une valeur à une autre (garnison qui fond sous l'assaut). */
function useTween(from: number, to: number, duration: number, key: number): number {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration, key]);
  return v;
}

/** Salve de troupes qui s'abat du ciel sur la case visée. */
function Volley({ fire, color, troops }: { fire: number; color: string; troops: number }) {
  const n = Math.min(14, Math.max(4, troops));
  const vals = useMemo(() => Array.from({ length: n }, () => new Animated.Value(0)), [n, fire]);
  useEffect(() => {
    if (!fire) return;
    Animated.stagger(
      32,
      vals.map((v) => Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [fire, vals]);
  if (!fire) return null;
  return (
    <View pointerEvents="none" style={styles.center}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            opacity: v.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [((i * 53) % 120) - 60, ((i * 17) % 30) - 15] }) },
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-460 - ((i * 41) % 120), 0] }) },
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.6] }) },
            ],
          }}>
          <Svg width={22} height={22} viewBox="0 0 100 100">
            <Path d={hexPath(100, 0.14, 3)} fill={color} stroke="#FFFFFF" strokeWidth={7} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * La bataille, case par case, sur la vraie carte : la caméra plonge sur chaque territoire
 * visé, les troupes s'abattent, la garnison fond, puis la case bascule (couleur et relief).
 * Les prises passent en dernier pour finir en apothéose.
 */
export function BattleSequence({ results, faction, bbox, onDone }: { results: DeployResultRow[]; faction: number; bbox: BBox | null; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const p = paletteOf(faction);
  const order = useMemo(() => [...results].sort((a, b) => Number(a.outcome === 'captured') - Number(b.outcome === 'captured')), [results]);
  const captures = results.filter((r) => r.outcome === 'captured').length;
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('fly');
  const [fx, setFx] = useState({ volley: 0, impact: 0, outcome: 0, final: 0 });
  const [overrides, setOverrides] = useState<Map<string, { owner: number | null; garrison: number }>>(
    () => new Map(results.map((r) => [r.h3, { owner: r.before_owner, garrison: Number(r.before_garrison) }])),
  );
  const [shakeX, shake] = useShake();
  const doneRef = useRef(false);
  const cur = order[Math.min(i, order.length - 1)]!;
  const first = order[0]!;
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    preload(['whoosh', 'impact', 'capture', 'shield', 'victory']);
  }, []);

  // la chorégraphie d'une case
  useEffect(() => {
    if (phase === 'final') return;
    const r = order[i];
    if (!r) return;
    const captured = r.outcome === 'captured';
    // les deux premiers assauts prennent leur temps, les suivants s'enchaînent plus vite
    const f = i >= 2 ? 0.72 : 1;
    const timers = [
      setTimeout(() => {
        setPhase('volley');
        setFx((f) => ({ ...f, volley: Date.now() }));
        play('whoosh', 0.8);
      }, 950 * f),
      setTimeout(() => {
        setPhase('impact');
        setFx((f) => ({ ...f, impact: Date.now() }));
        shake();
        play('impact');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 1360 * f),
      setTimeout(() => {
        setPhase('outcome');
        setFx((f) => ({ ...f, outcome: Date.now() }));
        setOverrides((m) => new Map(m).set(r.h3, { owner: r.after_owner, garrison: Number(r.after_garrison) }));
        if (captured) {
          play('capture');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (r.outcome === 'reinforced') {
          play('shield', 0.9);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }, 1950 * f),
      setTimeout(
        () => {
          if (i + 1 < order.length) {
            setI(i + 1);
            setPhase('fly');
          } else {
            setPhase('final');
            setFx((f) => ({ ...f, final: Date.now() }));
            play(captures > 0 ? 'victory' : 'reward');
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
        (captured ? 3100 : 2700) * f,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [i, phase === 'final']);

  useEffect(() => {
    if (phase !== 'final') return;
    const id = setTimeout(finish, 2600);
    return () => clearTimeout(id);
  }, [phase]);

  const flyTo: FlyTarget | null = useMemo(() => {
    if (phase === 'final' && bbox) {
      return { center: { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 }, zoom: 13.9, key: -1, duration: 1400 };
    }
    return { center: cellCenter(cur.h3), zoom: 14.5, key: i + 1, duration: i >= 2 ? 650 : 850 };
  }, [phase === 'final', i]);

  const captured = cur.outcome === 'captured';
  const before = Number(cur.before_garrison);
  const after = Number(cur.after_garrison);
  const target = phase === 'impact' || phase === 'outcome' ? (captured ? 0 : after) : before;
  const garrison = useTween(before, target, phase === 'impact' ? 550 : 1, i * 10 + (phase === 'impact' ? 1 : 0));
  const shown = phase === 'outcome' ? after : garrison;
  const ownerColor = factionById(phase === 'outcome' ? cur.after_owner : cur.before_owner)?.color ?? WILD_COLOR;
  const stampText = captured ? t('battle.taken') : cur.outcome === 'reinforced' ? t('battle.reinforced') : t('battle.weakened');
  const stampColor = captured ? p.main : cur.outcome === 'reinforced' ? p.gradient[0] : '#FFFFFF';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: shakeX }] }}>
        <HexMap
          center={cellCenter(first.h3)}
          zoom={14.5}
          pitch={55}
          lit={results.map((r) => r.h3)}
          overrides={overrides}
          flyTo={flyTo}
          showUser={false}
          attributionBottom={insets.bottom + 90}
        />
        {/* effets au centre de l'écran = sur la case visée */}
        <Volley fire={fx.volley} color={p.main} troops={cur.troops} />
        <Shockwave fire={fx.impact} color="#FFFFFF" size={240} />
        {phase !== 'final' && (
          <>
            <Burst fire={phase === 'outcome' && cur.outcome !== 'damaged' ? fx.outcome : 0} color={captured ? p.main : p.gradient[0]} count={captured ? 26 : 14} radius={captured ? 200 : 130} />
            <Shockwave fire={captured && phase === 'outcome' ? fx.outcome : 0} color={p.main} size={320} delay={60} />
            {phase === 'outcome' && <Stamp fire={fx.outcome} text={stampText} color={stampColor} sub={captured ? `+${formatNumber(after, 1)} ⛨` : undefined} />}
          </>
        )}
        {phase === 'final' && (
          <>
            <Burst fire={fx.final} color={p.main} count={30} radius={230} size={16} />
            <Burst fire={fx.final + 1} color={colors.gold} count={18} radius={160} />
            <Stamp
              fire={fx.final}
              text={captures > 0 ? t('battle.victory') : t('battle.over')}
              color={captures > 0 ? colors.gold : colors.text}
              sub={captures > 0 ? t('battle.victorySub', { n: captures }) : undefined}
            />
          </>
        )}
      </Animated.View>
      <Flash fire={fx.impact} color="#FFFFFF" peak={0.35} />
      <Flash fire={captured ? fx.outcome : 0} color={p.main} peak={0.45} />

      {/* voiles haut et bas */}
      <LinearGradient pointerEvents="none" colors={['rgba(6,8,12,0.9)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 130 }} />
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(6,8,12,0.92)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: insets.bottom + 170 }} />

      {/* en-tête : progression de l'assaut */}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, gap: 8 }}>
        <Text style={{ fontFamily: fonts.label, color: colors.gold, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
          {phase === 'final' ? t('battle.report') : t('battle.progress', { i: i + 1, n: order.length })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {order.map((r, k) => {
            const doneStep = k < i || (k === i && (phase === 'outcome' || phase === 'final'));
            const c = doneStep ? (r.outcome === 'captured' ? p.main : r.outcome === 'reinforced' ? p.gradient[0] : colors.textDim) : 'rgba(255,255,255,0.15)';
            return <View key={r.h3} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c }} />;
          })}
        </View>
      </View>

      {/* bas : la cible, la garnison qui fond, les troupes engagées */}
      {phase !== 'final' && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16 }}>
          <Glass strong glow={ownerColor} style={{ borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Emblem factionId={phase === 'outcome' ? cur.after_owner : cur.before_owner} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.label, fontSize: 13, color: colors.textDim, letterSpacing: 1.4, textTransform: 'uppercase' }}>{t('map.garrison')}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: ownerColor, fontVariant: ['tabular-nums'] }}>{formatNumber(Math.max(0, shown), 1)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: fonts.label, fontSize: 13, color: colors.textDim, letterSpacing: 1.4, textTransform: 'uppercase' }}>{t('battle.troops')}</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: p.main }}>⚔ {cur.troops}</Text>
            </View>
          </Glass>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('battle.skip')}
        onPress={finish}
        hitSlop={10}
        style={{ position: 'absolute', top: insets.top + 6, right: 16 }}>
        <Text style={{ fontFamily: fonts.label, fontSize: 15, color: colors.textDim, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t('battle.skip')} ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
