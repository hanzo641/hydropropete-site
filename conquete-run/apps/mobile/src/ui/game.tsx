import { avatarById, factionById, rankForLevel } from '@conquete/core';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getLocale } from '@/i18n';
import { colors, radius, space } from './theme';

/** Avatar de jeu (vectoriel, voir packages/core/src/game/avatars.ts). */
export function Avatar({ id, size = 48, ringColor }: { id: string | null | undefined; size?: number; ringColor?: string }) {
  const a = avatarById(id);
  const ring = ringColor ? Math.max(2, size / 24) : 0;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a.name[getLocale()]}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: ringColor, overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={50} fill={a.bg} />
        {a.shapes.map((sh, i) => (
          <Path key={i} d={sh.d} fill={sh.fill} fillOpacity={sh.opacity ?? 1} />
        ))}
      </Svg>
    </View>
  );
}

/** Avatar du joueur entouré de la couleur de son rang, avec le nom du rang. */
export function RankBadge({ level, avatarId, size = 72 }: { level: number; avatarId: string | null | undefined; size?: number }) {
  const rank = rankForLevel(level);
  return (
    <View style={{ alignItems: 'center', gap: space.xs }}>
      <Avatar id={avatarId} size={size} ringColor={rank.color} />
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
