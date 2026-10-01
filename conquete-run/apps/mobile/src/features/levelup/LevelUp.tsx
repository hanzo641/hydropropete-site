import { avatarById, avatarForLevel, RANKS, rankForLevel } from '@conquete/core';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { play, preload } from '@/features/sfx';
import { getLocale, t } from '@/i18n';
import { setAvatar } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { kv } from '@/lib/kv';
import { Button } from '@/ui/components';
import { Burst, Shockwave } from '@/ui/fx';
import { hexPath } from '@/ui/hex';
import { outfitName, Soldier } from '@/ui/Soldier';
import { tierForLevel } from '@/ui/soldierArt';
import { alpha, colors, fonts, paletteOf } from '@/ui/theme';

/**
 * Pop-up « Niveau supérieur » : rayons qui tournent, badge qui s'écrase, gerbes d'or,
 * et la nouvelle tenue à équiper quand un rang est franchi. Affiché une fois par niveau
 * (dernier niveau vu gardé sur le téléphone) : en fin de course après le butin, ou dès que
 * le profil monte de niveau ailleurs (défis…).
 */

const SEEN = 'cr:levelSeen';
type Listener = (to: number) => void;
const listeners = new Set<Listener>();

function seenLevel(): number | null {
  const v = kv.getItem(SEEN);
  return v == null ? null : Number(v);
}

/** Demande l'affichage (fin de course : après l'animation du butin). */
export function showLevelUp(to: number): void {
  for (const l of listeners) l(to);
}

/** Écrans qui déclenchent eux-mêmes le pop-up au bon moment (pas de détection automatique). */
const MANUAL_ROUTES = ['/summary', '/run', '/deploy'];

export function LevelUpHost() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [shown, setShown] = useState<{ from: number; to: number } | null>(null);

  const open = (to: number) => {
    const from = seenLevel() ?? to - 1;
    if (to <= from) return;
    kv.setItem(SEEN, String(to));
    setShown({ from, to });
  };

  useEffect(() => {
    listeners.add(open);
    return () => {
      listeners.delete(open);
    };
  });

  // détection automatique (hors écrans de course, qui la déclenchent eux-mêmes)
  const level = profile?.level ?? null;
  useEffect(() => {
    if (level == null) return;
    const seen = seenLevel();
    if (seen == null) {
      kv.setItem(SEEN, String(level)); // première ouverture : rien à fêter
      return;
    }
    if (level > seen && !MANUAL_ROUTES.some((r) => pathname.startsWith(r))) open(level);
  }, [level, pathname]);

  if (!shown || !profile) return null;
  return <LevelUpModal from={shown.from} to={shown.to} faction={profile.faction_id} avatarId={profile.avatar_id} onClose={() => setShown(null)} />;
}

/** Rayons de lumière qui tournent derrière le badge. */
function Rays({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const n = 14;
  const d = Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n / 1.4;
    return `M200 200 L${200 + Math.cos(a0) * 220} ${200 + Math.sin(a0) * 220} L${200 + Math.cos(a1) * 220} ${200 + Math.sin(a1) * 220} Z`;
  }).join(' ');
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: 400, height: 400, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={400} height={400} viewBox="0 0 400 400">
        <Path d={d} fill={color} opacity={0.16} />
      </Svg>
    </Animated.View>
  );
}

export function LevelUpModal({
  from,
  to,
  faction,
  avatarId,
  onClose,
}: {
  from: number;
  to: number;
  faction: number | null;
  avatarId: string;
  onClose: () => void;
}) {
  const { refreshProfile } = useAuth();
  const p = paletteOf(faction);
  const rank = rankForLevel(to);
  const rankUp = rank.id !== rankForLevel(from).id;
  const outfit = avatarForLevel(to);
  const newOutfit = rankUp && avatarById(avatarId).id !== outfit.id;
  const [fx, setFx] = useState(0);
  const [busy, setBusy] = useState(false);
  const bg = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    preload(['reward', 'victory', 'capture']);
    Animated.timing(bg, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    const t1 = setTimeout(() => {
      Animated.spring(badge, { toValue: 1, friction: 4.5, tension: 120, useNativeDriver: true }).start();
      setFx(Date.now());
      play(rankUp ? 'victory' : 'reward');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 220);
    const t2 = setTimeout(() => {
      Animated.spring(reveal, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
      if (rankUp) {
        play('capture');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const equip = async () => {
    setBusy(true);
    try {
      await setAvatar(outfit.id);
      await refreshProfile();
    } catch {
      /* hors ligne : on garde l'ancienne tenue */
    }
    setBusy(false);
    onClose();
  };

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bg }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,8,12,0.96)' }]} />
        <LinearGradient colors={['transparent', alpha(p.main, 0.3), 'transparent']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.center}>
        <Rays color={colors.gold} />
        <Shockwave fire={fx} color={colors.gold} size={300} />
        <Burst fire={fx} color={colors.gold} count={26} radius={200} size={14} />
        <Burst fire={fx ? fx + 1 : 0} color={p.main} count={16} radius={150} />

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: badge.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }],
          }}>
          <Text style={styles.kicker}>{t('levelUp.kicker')}</Text>
          <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Svg width={170} height={170} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id="lvl" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFE58A" />
                  <Stop offset="1" stopColor="#E7A21A" />
                </SvgGradient>
              </Defs>
              <Path d={hexPath(100, 0.14, 4)} fill="url(#lvl)" stroke="#FFF6D6" strokeWidth={3} />
              <Path d={hexPath(100, 0.14, 13)} fill="none" stroke="rgba(120,70,0,0.35)" strokeWidth={2} />
            </Svg>
            <Text style={styles.levelLabel}>{t('levelUp.level')}</Text>
            <Text style={styles.levelNum}>{to}</Text>
          </View>
          <Text style={[styles.rank, { color: rank.color }]}>{rankUp ? t('levelUp.newRank', { rank: rank.name[getLocale()] }) : rank.name[getLocale()]}</Text>
        </Animated.View>

        {newOutfit ? (
          <Animated.View
            style={{
              alignItems: 'center',
              marginTop: 14,
              opacity: reveal,
              transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            }}>
            <Soldier faction={faction} tier={tierForLevel(to)} captain size={150} />
            <Text style={styles.outfit}>{t('levelUp.newOutfit', { name: outfitName(tierForLevel(to)) })}</Text>
            <Text style={styles.sub}>{t('levelUp.newOutfitBody')}</Text>
          </Animated.View>
        ) : (
          <Animated.View style={{ marginTop: 18, opacity: reveal }}>
            <Text style={styles.sub}>{nextRankLevel(to) ? t('levelUp.keepGoing', { n: nextRankLevel(to) ?? to }) : t('soldiers.max')}</Text>
          </Animated.View>
        )}

        <Animated.View style={{ alignSelf: 'stretch', marginTop: 26, gap: 10, opacity: reveal, paddingHorizontal: 28 }}>
          {newOutfit ? (
            <>
              <Button title={t('levelUp.equip')} icon="shield-checkmark" loading={busy} onPress={() => void equip()} />
              <Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ fontFamily: fonts.label, fontSize: 15, color: colors.textDim, letterSpacing: 1.2, textTransform: 'uppercase' }}>{t('levelUp.later')}</Text>
              </Pressable>
            </>
          ) : (
            <Button title={t('levelUp.continue')} onPress={onClose} />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function nextRankLevel(level: number): number | null {
  return RANKS.find((r) => r.minLevel > level)?.minLevel ?? null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.label, fontSize: 18, color: colors.gold, letterSpacing: 4, textTransform: 'uppercase' },
  levelLabel: { fontFamily: fonts.label, fontSize: 15, color: '#5A3A00', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 },
  levelNum: { fontFamily: fonts.display, fontSize: 76, lineHeight: 80, color: '#2A1A00' },
  rank: { fontFamily: fonts.display, fontSize: 30, marginTop: 8, textTransform: 'uppercase', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 12 },
  outfit: { fontFamily: fonts.display, fontSize: 26, color: colors.text, marginTop: 6, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.textDim, textAlign: 'center', paddingHorizontal: 36, marginTop: 4 },
});
