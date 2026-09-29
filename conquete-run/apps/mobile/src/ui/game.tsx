import { factionById, rankForLevel, type RankId } from '@conquete/core';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { getLocale } from '@/i18n';
import { colors, radius, space } from './theme';

const RANK_IMAGES: Record<RankId, number> = {
  debutant: require('@/assets/images/ranks/debutant.png'),
  jogger: require('@/assets/images/ranks/jogger.png'),
  coureur: require('@/assets/images/ranks/coureur.png'),
  athlete: require('@/assets/images/ranks/athlete.png'),
  champion: require('@/assets/images/ranks/champion.png'),
  maitre: require('@/assets/images/ranks/maitre.png'),
};

export function RankBadge({ level, size = 72 }: { level: number; size?: number }) {
  const rank = rankForLevel(level);
  return (
    <View style={{ alignItems: 'center', gap: space.xs }}>
      <Image
        source={RANK_IMAGES[rank.id]}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: rank.color }}
        contentFit="cover"
        accessibilityLabel={rank.name[getLocale()]}
      />
      <Text style={{ color: rank.color, fontWeight: '800' }}>{rank.name[getLocale()]}</Text>
    </View>
  );
}

export function FactionBadge({ factionId, size = 'md' }: { factionId: number | null | undefined; size?: 'sm' | 'md' }) {
  const f = factionById(factionId);
  const pad = size === 'sm' ? 2 : 6;
  return (
    <View
      style={{
        backgroundColor: f?.color ?? colors.wild,
        borderRadius: radius.pill,
        paddingHorizontal: pad * 2,
        paddingVertical: pad,
        alignSelf: 'flex-start',
      }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size === 'sm' ? 11 : 14 }}>
        {f ? f.name[getLocale()] : '—'}
      </Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.accent }: { value: number; color?: string }) {
  return (
    <View style={{ height: 8, backgroundColor: colors.surfaceHigh, borderRadius: 4, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}
