import { cellCenter, factionById, type LatLng } from '@conquete/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HexMap, type FlyTarget } from '@/features/map/HexMap';
import { HexSheet } from '@/features/map/HexSheet';
import type { HexView } from '@/features/map/hexGeo';
import { dismissWarReport, useWarReport } from '@/features/war/report';
import { useWar } from '@/features/war/useWar';
import { getLocale, t } from '@/i18n';
import { Button, Chip, Glass, IconButton, usePalette } from '@/ui/components';
import { FadeIn, StreakBadge, usePulse, WarBar } from '@/ui/game';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { colors, font, fonts, paletteOf, space } from '@/ui/theme';
import { Animated } from 'react-native';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const w = useWar();
  const report = useWarReport();
  const [center, setCenter] = useState<LatLng | null>(null);
  const [selected, setSelected] = useState<HexView | null>(null);
  const [is3d, setIs3d] = useState(true);
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const pulse = usePulse(w.troops > 0, 1600);

  useEffect(() => {
    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  const recenter = async () => {
    const pos = await Location.getLastKnownPositionAsync();
    if (pos) setFly({ center: { lat: pos.coords.latitude, lng: pos.coords.longitude }, zoom: 14, key: Date.now() });
  };
  const goFront = () => {
    if (!w.war?.front) return;
    void Haptics.selectionAsync();
    setFly({ center: cellCenter(w.war.front), zoom: 13.4, key: Date.now() });
  };

  const me = w.war?.factions.find((f) => f.faction_id === w.myFaction);
  const enemy = w.war?.factions.find((f) => f.faction_id === w.enemyFaction);
  const enemyName = factionById(w.enemyFaction)?.name[getLocale()] ?? '';
  const hoursLeft = w.troopsDeadline ? Math.max(1, Math.round((w.troopsDeadline - Date.now()) / 3_600_000)) : null;
  // au-dessus de la barre d'onglets et du bouton « Courir » qui dépasse
  const bottomBase = TAB_BAR_SPACE + 22 + insets.bottom * 0.5;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {center ? (
        <HexMap
          center={center}
          pitch={is3d ? 52 : 0}
          front={w.war?.front ?? null}
          selected={selected?.cell ?? null}
          onSelectHex={(h) => {
            if (h) void Haptics.selectionAsync();
            setSelected(h);
          }}
          flyTo={fly}
          zoom={13}
          attributionBottom={TAB_BAR_SPACE + 12}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={font.small}>{t('common.loading')}</Text>
        </View>
      )}

      {/* voile haut pour la lisibilité du HUD */}
      <LinearGradient pointerEvents="none" colors={['rgba(6,8,12,0.92)', 'rgba(6,8,12,0.5)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 170 }} />

      {/* HUD : la guerre en un coup d'œil */}
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, gap: space.sm }}>
        <Glass style={{ padding: space.md, borderRadius: 22, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text style={[font.label, { flex: 1, color: colors.text }]} numberOfLines={1}>
              {w.war?.season?.name ?? t('common.appName')}
              {w.seasonDaysLeft != null ? <Text style={{ color: colors.textDim }}>{`  ·  ${t('map.seasonEnds', { n: w.seasonDaysLeft })}`}</Text> : null}
            </Text>
            <StreakBadge days={w.streak} atRisk={w.streakRisk} size="sm" />
          </View>
          {w.myFaction && w.enemyFaction ? (
            <WarBar left={{ factionId: w.myFaction, value: me?.hexes_zone ?? 0 }} right={{ factionId: w.enemyFaction, value: enemy?.hexes_zone ?? 0 }} height={10} />
          ) : null}
        </Glass>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {w.war?.front ? <Chip text={`${t('map.front')} · ${t('map.frontBody')}`} emoji="⚔️" color={colors.gold} filled onPress={goFront} /> : null}
        </View>
        {w.streakRisk && (
          <FadeIn>
            <Glass glow="#FF7A2E" style={{ paddingHorizontal: space.md, paddingVertical: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={[font.bodyBold, { flex: 1, fontSize: 14 }]}>{t('map.streakRisk')}</Text>
            </Glass>
          </FadeIn>
        )}
      </View>

      {/* commandes */}
      <View style={{ position: 'absolute', right: space.md, top: insets.top + 196, gap: space.sm }}>
        <IconButton icon="navigate" label={t('map.recenter')} onPress={() => void recenter()} />
        <IconButton icon="cube-outline" label={t('map.view3d')} active={is3d} onPress={() => setIs3d((v) => !v)} />
      </View>

      {/* bas de l'écran : fiche de territoire, rapport d'absence, troupes à déployer */}
      <View style={{ position: 'absolute', left: space.md, right: space.md, bottom: bottomBase, gap: space.sm }} pointerEvents="box-none">
        {selected ? (
          <FadeIn from={24}>
            <HexSheet hex={selected} myFaction={w.myFaction} front={w.war?.front ?? null} onClose={() => setSelected(null)} />
          </FadeIn>
        ) : report ? (
          <FadeIn from={24}>
            <Glass strong glow={paletteOf(w.enemyFaction).main} style={{ padding: space.lg, gap: space.sm, borderRadius: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[font.h2, { flex: 1, fontSize: 20 }]}>{t('map.reportTitle')}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={dismissWarReport} hitSlop={10}>
                  <Ionicons name="close" size={20} color={colors.textDim} />
                </Pressable>
              </View>
              {report.enemyCaptures > 0 && (
                <Text style={[font.bodyBold, { color: paletteOf(w.enemyFaction).main }]}>⚔️ {t('map.reportEnemy', { faction: enemyName, n: report.enemyCaptures })}</Text>
              )}
              {report.allyCaptures > 0 && <Text style={[font.bodyBold, { color: p.main }]}>🛡️ {t('map.reportAlly', { n: report.allyCaptures })}</Text>}
              <Button
                title={t('map.reportCta')}
                icon="flash"
                onPress={() => {
                  dismissWarReport();
                  router.push('/run');
                }}
              />
            </Glass>
          </FadeIn>
        ) : null}
        {w.troops > 0 && !selected && (
          <Animated.View style={{ alignSelf: 'center', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const first = w.pending[0];
                if (first) router.push(`/deploy/${first.id}`);
              }}
              style={({ pressed }) => ({ borderRadius: 999, overflow: 'hidden', boxShadow: `0 6px 24px ${p.glow}`, opacity: pressed ? 0.85 : 1 })}>
              <LinearGradient colors={p.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: 13 }}>
                <Ionicons name="flag" size={18} color={p.on} />
                <Text style={{ color: p.on, fontFamily: fonts.label, fontSize: 17, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {t('map.pendingTroops', { n: w.troops })}
                </Text>
                {hoursLeft != null && hoursLeft <= 24 && (
                  <Text style={{ color: p.on, fontFamily: fonts.body, fontSize: 12, opacity: 0.85 }}>{t('map.expires', { h: hoursLeft })}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
