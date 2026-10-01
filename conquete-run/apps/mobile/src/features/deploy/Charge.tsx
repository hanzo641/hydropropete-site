import { hash01 } from '@conquete/core';
import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Soldier } from '@/ui/Soldier';
import { type SoldierTier, squadSize } from '@/ui/soldierArt';

/**
 * L'assaut en soldats, au centre de l'écran (= la case visée) : les défenseurs tiennent la
 * case, tes soldats chargent depuis le bas de l'écran ; à l'impact, les défenseurs tombent
 * (tous si la case est prise, en proportion des pertes sinon). En renfort, tes soldats
 * rejoignent la garnison.
 */
export function Charge({
  charge,
  impact,
  outcome,
  myFaction,
  myTier,
  troops,
  defender,
}: {
  /** horodatages qui déclenchent chaque temps (0 = pas encore) */
  charge: number;
  impact: number;
  outcome: number;
  myFaction: number;
  myTier: SoldierTier;
  troops: number;
  defender: { cell: string; owner: number | null; before: number; after: number; result: 'captured' | 'reinforced' | 'damaged' };
}) {
  const friendly = defender.owner === myFaction;
  const defTier: SoldierTier = defender.owner == null ? 0 : friendly ? myTier : ((1 + Math.floor(hash01(`${defender.cell}:def`) * 5)) as SoldierTier);
  const nDef = Math.max(1, squadSize(defender.before));
  const falling = defender.result === 'captured' ? nDef : defender.result === 'damaged' ? Math.max(1, Math.round((nDef * (defender.before - defender.after)) / Math.max(1, defender.before))) : 0;
  const nAtk = Math.min(7, Math.max(3, troops));

  const atk = useMemo(() => Array.from({ length: nAtk }, () => new Animated.Value(0)), [nAtk, defender.cell]);
  const leave = useMemo(() => new Animated.Value(0), [defender.cell]);
  const fall = useMemo(() => Array.from({ length: nDef }, () => new Animated.Value(0)), [nDef, defender.cell]);
  const appear = useMemo(() => new Animated.Value(0), [defender.cell]);

  // les défenseurs se montrent une fois la caméra posée sur la case
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 260, delay: 520, useNativeDriver: true }).start();
  }, [appear]);

  useEffect(() => {
    if (!charge) return;
    atk.forEach((v) => v.setValue(0));
    leave.setValue(0);
    Animated.stagger(
      34,
      atk.map((v) => Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [charge, atk, leave]);

  useEffect(() => {
    if (!impact || falling === 0) return;
    Animated.stagger(
      Math.max(40, 300 / falling),
      fall.slice(0, falling).map((v) => Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true })),
    ).start();
  }, [impact, fall, falling]);

  useEffect(() => {
    if (!outcome) return;
    Animated.timing(leave, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [outcome, leave]);

  // défenseurs en V sur la case, le capitaine devant
  const defSlots = [
    { x: 0, y: 16, z: 5 },
    { x: -46, y: 0, z: 3 },
    { x: 46, y: 0, z: 3 },
    { x: -23, y: -16, z: 1 },
    { x: 23, y: -16, z: 1 },
  ];

  return (
    <View pointerEvents="none" style={styles.center}>
      {defSlots.slice(0, nDef).map((s, i) => {
        const v = fall[i]!;
        return (
          <Animated.View
            key={`d${i}`}
            style={{
              position: 'absolute',
              zIndex: s.z,
              opacity: Animated.multiply(appear, v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] })),
              transform: [
                { translateX: s.x },
                { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [s.y - 40, s.y - 20] }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', i % 2 ? '-88deg' : '88deg'] }) },
              ],
            }}>
            <Soldier faction={defender.owner} tier={defTier} captain={i === 0} size={76} />
          </Animated.View>
        );
      })}
      {charge > 0 &&
        atk.map((v, i) => {
          const fromX = ((i * 71) % 260) - 130;
          const toX = (i - (nAtk - 1) / 2) * 28;
          const toY = friendly ? 46 - (i % 2) * 18 : 64 - (i % 2) * 16;
          return (
            <Animated.View
              key={`a${i}`}
              style={{
                position: 'absolute',
                zIndex: 10 + i,
                opacity: Animated.multiply(
                  v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
                  leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                ),
                transform: [
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [fromX, toX] }) },
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [420 + (i % 3) * 40, toY] }) },
                  // course : le soldat tangue en avançant
                  { rotate: v.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: ['-8deg', '8deg', '-8deg', '8deg', '-6deg', '0deg'] }) },
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.5, 0.9] }) },
                ],
              }}>
              <Soldier faction={myFaction} tier={myTier} captain={i === 0} size={72} />
            </Animated.View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
