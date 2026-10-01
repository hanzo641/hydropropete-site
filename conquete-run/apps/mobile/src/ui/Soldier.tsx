import { RANKS } from '@conquete/core';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getLocale, t, type TKey } from '@/i18n';
import { soldierSvg, type SoldierTier, tierForLevel } from './soldierArt';
import { colors, font, fonts, space } from './theme';

/** Un soldat (même dessin que sur la carte). Taille = hauteur en points. */
export function Soldier({ faction, tier, captain = false, size = 64 }: { faction: number | null; tier: SoldierTier; captain?: boolean; size?: number }) {
  const xml = useMemo(() => soldierSvg(faction, tier, captain), [faction, tier, captain]);
  return <SvgXml xml={xml} width={(size * 64) / 80} height={size} />;
}

export function outfitName(tier: SoldierTier): string {
  return t(`soldiers.outfit.t${tier}` as TKey);
}

/** Les six tenues, débloquées au fil des rangs (profil). */
export function OutfitShowcase({ faction, level }: { faction: number | null; level: number }) {
  const current = tierForLevel(level);
  const next = (RANKS as readonly (typeof RANKS)[number][])[current];
  return (
    <View style={{ gap: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.md }}>
        {RANKS.map((r, i) => {
          const tier = (i + 1) as SoldierTier;
          const unlocked = tier <= current;
          return (
            <View
              key={r.id}
              style={{
                width: 84,
                alignItems: 'center',
                paddingVertical: space.sm,
                borderRadius: 16,
                borderWidth: tier === current ? 2 : 1,
                borderColor: tier === current ? colors.gold : colors.border,
                backgroundColor: tier === current ? 'rgba(255,197,61,0.08)' : 'rgba(255,255,255,0.03)',
                opacity: unlocked ? 1 : 0.45,
              }}>
              <View style={unlocked ? undefined : { opacity: 0.35 }}>
                <Soldier faction={faction} tier={tier} captain={tier === current} size={70} />
              </View>
              <Text style={{ fontFamily: fonts.label, fontSize: 12, color: unlocked ? colors.text : colors.textDim, marginTop: 4 }} numberOfLines={1}>
                {outfitName(tier)}
              </Text>
              <Text style={{ fontFamily: fonts.label, fontSize: 11, color: unlocked ? r.color : colors.textDim }}>{unlocked ? r.name[getLocale()] : `🔒 ${t('profile.level', { n: r.minLevel })}`}</Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={font.small}>{next ? t('soldiers.next', { n: next.minLevel }) : t('soldiers.max')}</Text>
    </View>
  );
}
