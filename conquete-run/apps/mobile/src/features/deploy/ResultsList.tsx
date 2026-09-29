import { factionById, WILD_COLOR } from '@conquete/core';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { formatNumber, t } from '@/i18n';
import type { DeployResultRow } from '@/lib/api';
import { colors, font, radius, space } from '@/ui/theme';

/** Résultat des attaques, révélé case par case (animation échelonnée). */
export function ResultsList({ results }: { results: DeployResultRow[] }) {
  const anims = useRef(results.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      350,
      anims.map((a) => Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 6 })),
    ).start();
  }, [anims]);
  return (
    <View style={{ gap: space.sm }}>
      {results.map((r, i) => {
        const before = factionById(r.before_owner)?.color ?? WILD_COLOR;
        const after = factionById(r.after_owner)?.color ?? WILD_COLOR;
        const title = r.outcome === 'captured' ? t('deploy.captured') : r.outcome === 'reinforced' ? t('deploy.reinforced') : t('deploy.damaged');
        const a = anims[i]!;
        return (
          <Animated.View
            key={r.h3}
            style={{
              opacity: a,
              transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: space.md,
              borderLeftWidth: 6,
              borderLeftColor: after,
              gap: space.xs,
            }}>
            <Text style={[font.h3, r.outcome === 'captured' && { color: colors.accent }]}>
              {r.outcome === 'captured' ? '🚩 ' : r.outcome === 'reinforced' ? '🛡️ ' : '⚔️ '}
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: before }} />
              <Text style={font.small}>{formatNumber(Number(r.before_garrison), 1)}</Text>
              <Text style={font.small}>→</Text>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: after }} />
              <Text style={font.body}>{formatNumber(Number(r.after_garrison), 1)}</Text>
              <Text style={[font.small, { marginLeft: 'auto' }]}>
                {t('common.troops', { n: r.troops })}
                {Number(r.effective) > r.troops ? ' (+10 %)' : ''}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
