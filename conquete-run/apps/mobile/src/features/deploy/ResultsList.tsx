import { factionById, WILD_COLOR } from '@conquete/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { formatNumber, t } from '@/i18n';
import type { DeployResultRow } from '@/lib/api';
import { Glass } from '@/ui/components';
import { Emblem } from '@/ui/game';
import { colors, font, fonts, space } from '@/ui/theme';

/** Résultat des attaques, révélé case par case (animation échelonnée). */
export function ResultsList({ results }: { results: DeployResultRow[] }) {
  const anims = useRef(results.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      260,
      anims.map((a) => Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 })),
    ).start();
  }, [anims]);
  return (
    <View style={{ gap: space.sm }}>
      {results.map((r, i) => {
        const before = factionById(r.before_owner)?.color ?? WILD_COLOR;
        const after = factionById(r.after_owner)?.color ?? WILD_COLOR;
        const captured = r.outcome === 'captured';
        const title = captured ? t('deploy.captured') : r.outcome === 'reinforced' ? t('deploy.reinforced') : t('deploy.damaged');
        const a = anims[i]!;
        return (
          <Animated.View
            key={r.h3}
            style={{
              opacity: a,
              transform: [
                { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
              ],
            }}>
            <Glass glow={captured ? after : undefined} style={{ padding: space.md, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ width: 44, alignItems: 'center' }}>
                {captured ? (
                  <Emblem factionId={r.after_owner} size={34} />
                ) : (
                  <Ionicons name={r.outcome === 'reinforced' ? 'shield-checkmark' : 'flash'} size={28} color={r.outcome === 'reinforced' ? after : colors.textDim} />
                )}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[font.h3, captured && { color: after, fontFamily: fonts.label, fontSize: 20, letterSpacing: 1, textTransform: 'uppercase' }]}>{title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: before }} />
                  <Text style={font.small}>{formatNumber(Number(r.before_garrison), 1)}</Text>
                  <Ionicons name="arrow-forward" size={12} color={colors.textMute} />
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: after }} />
                  <Text style={[font.bodyBold, { fontSize: 14 }]}>{formatNumber(Number(r.after_garrison), 1)}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>
                {r.troops}
                <Text style={{ fontFamily: fonts.label, fontSize: 12, color: colors.textDim }}>{Number(r.effective) > r.troops ? ' +10%' : ''}</Text>
              </Text>
            </Glass>
          </Animated.View>
        );
      })}
    </View>
  );
}
