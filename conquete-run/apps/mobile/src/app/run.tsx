import { addDays, formatDuration, formatPace, localDay, streakBonus } from '@conquete/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { HexMap } from '@/features/map/HexMap';
import { requestPermissions } from '@/features/run/locationTask';
import * as session from '@/features/run/session';
import { formatNumber, t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { currentConfig } from '@/lib/gameConfig';
import { Button, Chip, Glass, Screen, ScreenBg, usePalette } from '@/ui/components';
import { FadeIn, usePulse } from '@/ui/game';
import { hexPath } from '@/ui/hex';
import { HoldButton } from '@/ui/HoldButton';
import { colors, font, fonts, space } from '@/ui/theme';

/** Troupes estimées en direct (le calcul officiel est refait à la validation). */
function liveTroops(distanceM: number, dplusM: number, streak: { days: number; lastDay: string | null }): { troops: number; bonus: number } {
  const cfg = currentConfig();
  const base = (distanceM / 1000) * cfg.troops.perKm + (dplusM / 100) * cfg.troops.perDplus100m;
  const today = localDay(Date.now(), -new Date().getTimezoneOffset());
  const days = streak.lastDay === today ? streak.days : streak.lastDay && addDays(streak.lastDay, 1) === today ? streak.days + 1 : 1;
  const bonus = distanceM >= cfg.streak.minKm * 1000 ? streakBonus(days, cfg.streak) : 0;
  return { troops: Math.floor(base * (1 + bonus) + 1e-9), bonus };
}

function GpsHex({ state, acc }: { state: 'searching' | 'weak' | 'ready'; acc: number | null }) {
  const p = usePalette();
  const pulse = usePulse(state !== 'ready', 1300);
  const color = state === 'ready' ? colors.success : state === 'weak' ? colors.gold : colors.textMute;
  return (
    <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] }) }}>
        <Svg width={230} height={230} viewBox="0 0 100 100">
          <Defs>
            <SvgGradient id="gpsg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={state === 'ready' ? p.gradient[0] : color} />
              <Stop offset="1" stopColor={state === 'ready' ? p.gradient[1] : color} />
            </SvgGradient>
          </Defs>
          <Path d={hexPath(100, 0.14, 4)} fill="rgba(255,255,255,0.02)" stroke="url(#gpsg)" strokeWidth={3} />
          <Path d={hexPath(100, 0.14, 14)} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={1.2} />
        </Svg>
      </Animated.View>
      <Text style={{ fontFamily: fonts.display, fontSize: 64, color: colors.text, lineHeight: 68 }}>{acc != null ? `${Math.round(acc)}` : '…'}</Text>
      <Text style={[font.label, { color }]}>{acc != null ? 'm · GPS' : 'GPS'}</Text>
    </View>
  );
}

export default function RunScreen() {
  const params = useLocalSearchParams<{ sim?: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const p = usePalette();
  const s = session.useRunSession();
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'foreground-only' | 'denied'>('unknown');
  const [, setNow] = useState(Date.now());
  const [toast, setToast] = useState(0);
  const lastLit = useRef(0);

  // Préchauffage du GPS dès l'ouverture (sauf simulation déjà préparée, ou course restaurée).
  useEffect(() => {
    if (s.phase === 'running' || (params.sim && s.phase === 'warming')) {
      setPermission('granted');
      return;
    }
    void (async () => {
      const perm = await requestPermissions();
      setPermission(perm);
      if (perm !== 'denied') await session.prepare('gps');
    })();
    // une seule fois à l'ouverture de l'écran
  }, []);

  // Chronomètre
  useEffect(() => {
    const id = setInterval(() => {
      session.tick();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // « Nouveau territoire ! »
  useEffect(() => {
    if (s.phase !== 'running') return;
    if (s.litCells.length > lastLit.current && lastLit.current > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast(Date.now());
    }
    lastLit.current = s.litCells.length;
  }, [s.litCells.length, s.phase]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(0), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const cancel = async () => {
    await session.discard();
    router.back();
  };

  const finish = async () => {
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
        <Text style={font.h1}>{t('run.permissionTitle')}</Text>
        <Text style={font.body}>{t('run.permissionDenied')}</Text>
        <Button title={t('run.permissionOpenSettings')} onPress={() => void Linking.openSettings()} />
        <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const snap = s.snapshot;
  const elapsed = s.source === 'simulation' ? (snap?.elapsedMs ?? 0) : s.startedAt ? Date.now() - s.startedAt : 0;
  const center = snap?.last ?? null;
  const live = liveTroops(snap?.distanceM ?? 0, snap?.dplusM ?? 0, { days: profile?.streak_days ?? 0, lastDay: profile?.streak_last_day ?? null });
  const running = s.phase === 'running' || s.phase === 'finished';

  const simBanner = s.simulation ? (
    <View style={{ position: 'absolute', top: insets.top + 6, alignSelf: 'center', zIndex: 5 }}>
      <Chip text={t('run.simulationBanner', { name: s.simulation.name, speed: s.simulation.speed })} icon="play-circle" color={colors.info} filled />
    </View>
  ) : null;

  if (!running) {
    const acc = s.readiness.accuracyM;
    return (
      <View style={{ flex: 1 }}>
        <ScreenBg />
        {simBanner}
        <View style={{ flex: 1, paddingTop: insets.top + 50, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.lg, justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', gap: space.lg }}>
            <GpsHex state={s.readiness.state === 'ready' ? 'ready' : s.readiness.state === 'weak' ? 'weak' : 'searching'} acc={acc} />
            <Text style={[font.h3, { textAlign: 'center', paddingHorizontal: space.lg }]}>
              {s.readiness.state === 'ready'
                ? t('run.gpsReady', { acc: Math.round(acc ?? 0) })
                : s.readiness.canStart
                  ? t('run.gpsWeakStart', { acc: Math.round(acc ?? 0) })
                  : s.readiness.state === 'weak'
                    ? t('run.gpsWeak', { acc: Math.round(acc ?? 0) })
                    : t('run.gpsSearching')}
            </Text>
            {permission === 'foreground-only' && <Text style={[font.small, { textAlign: 'center' }]}>{t('run.permissionBody')}</Text>}
          </View>
          <View style={{ alignItems: 'center', gap: space.lg }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('run.start')}
              disabled={!s.readiness.canStart}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                session.start();
              }}
              style={({ pressed }) => ({ opacity: s.readiness.canStart ? 1 : 0.35, transform: [{ scale: pressed ? 0.94 : 1 }], boxShadow: s.readiness.canStart ? `0 10px 40px ${p.glow}` : undefined, borderRadius: 80 })}>
              <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={150} height={150} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
                  <Defs>
                    <SvgGradient id="gobtn" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={p.gradient[0]} />
                      <Stop offset="1" stopColor={p.gradient[1]} />
                    </SvgGradient>
                  </Defs>
                  <Path d={hexPath(100, 0.16, 3)} fill="url(#gobtn)" stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                </Svg>
                <Text style={{ fontFamily: fonts.display, fontSize: 58, color: p.on, lineHeight: 62 }}>{t('run.go')}</Text>
              </View>
            </Pressable>
            <Text accessibilityRole="button" onPress={() => void cancel()} style={[font.label, { paddingVertical: space.sm }]}>
              {t('common.cancel')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {center && (
          <HexMap
            center={center}
            zoom={15.2}
            pitch={45}
            lit={s.litCells}
            track={s.track}
            followUser={s.source === 'gps'}
            showUser={s.source === 'gps'}
            // en simulation, la caméra suit le coureur virtuel
            flyTo={s.source === 'simulation' ? { center, zoom: 15.2, key: Math.floor(Date.now() / 3000), duration: 900 } : null}
            attributionBottom={40}
          />
        )}
        {simBanner}
        <View style={{ position: 'absolute', top: insets.top + (s.simulation ? 48 : 10), left: space.md, flexDirection: 'row', gap: space.sm }}>
          <Chip text={`${s.litCells.length} ⬡`} color={p.main} filled />
        </View>
        {toast ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 70, alignSelf: 'center' }}>
            <FadeIn key={toast} from={-10}>
              <Glass glow={p.main} style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 999 }}>
                <Text style={{ fontFamily: fonts.label, fontSize: 18, color: colors.text, letterSpacing: 1 }}>⬡ {t('run.newTerritory')}</Text>
              </Glass>
            </FadeIn>
          </View>
        ) : null}
      </View>

      <Glass strong style={{ borderRadius: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomWidth: 0, marginTop: -28, paddingTop: space.lg, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md, gap: space.md }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 72, color: colors.text, lineHeight: 74, fontVariant: ['tabular-nums'] }}>{formatDuration(elapsed)}</Text>
          <Text style={[font.label, { fontSize: 11 }]}>{t('run.time')}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 46, color: colors.text, lineHeight: 50 }}>
              {formatNumber((snap?.distanceM ?? 0) / 1000, 2)}
              <Text style={{ fontFamily: fonts.label, fontSize: 18, color: colors.textDim }}> km</Text>
            </Text>
            <Text style={[font.label, { fontSize: 11 }]}>{t('run.distance')}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 46, color: p.main, lineHeight: 50 }}>
              {live.troops}
              {live.bonus > 0 ? <Text style={{ fontSize: 18 }}> 🔥</Text> : null}
            </Text>
            <Text style={[font.label, { fontSize: 11 }]}>{t('run.troopsLive')}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[
            { label: t('run.pace'), value: `${formatPace(snap?.paceSecPerKm ?? null)}`, unit: '/km' },
            { label: t('run.dplusLive'), value: formatNumber(snap?.dplusM ?? 0), unit: 'm' },
            { label: t('run.cellsLit'), value: String(s.litCells.length), unit: '' },
          ].map((x) => (
            <View key={x.label} style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.text }}>
                {x.value}
                {x.unit ? <Text style={{ fontFamily: fonts.label, fontSize: 13, color: colors.textDim }}> {x.unit}</Text> : null}
              </Text>
              <Text style={[font.label, { fontSize: 10.5 }]}>{x.label}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('run.discard')} onPress={discard} hitSlop={6} style={{ width: 60, height: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash-outline" size={22} color={colors.textDim} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <HoldButton label={t('run.stop')} hint={t('run.holdToFinish')} onComplete={() => void finish()} />
          </View>
        </View>
      </Glass>
    </View>
  );
}
