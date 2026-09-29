import { factionById, troopsToCapture } from '@conquete/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { formatNumber, getLocale, t } from '@/i18n';
import { currentConfig } from '@/lib/gameConfig';
import { Chip, Glass } from '@/ui/components';
import { Emblem } from '@/ui/game';
import { colors, font, fonts, paletteOf, space } from '@/ui/theme';
import type { HexView } from './hexGeo';

/** Fiche d'un territoire touché sur la carte. */
export function HexSheet({ hex, myFaction, front, onClose }: { hex: HexView; myFaction: number | null; front: string | null; onClose: () => void }) {
  const owner = factionById(hex.owner);
  const p = paletteOf(hex.owner);
  const mine = hex.owner != null && hex.owner === myFaction;
  const need = myFaction
    ? troopsToCapture({ cell: hex.cell, region: hex.region, state: { owner: hex.owner, garrison: hex.garrison }, regionController: hex.regionFaction }, myFaction, currentConfig())
    : null;
  const region = factionById(hex.regionFaction);
  return (
    <Glass strong glow={owner ? p.main : undefined} style={{ padding: space.lg, gap: space.sm, borderRadius: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Emblem factionId={hex.owner} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[font.h2, { fontSize: 20, color: owner ? p.main : colors.text }]}>
            {owner ? t('map.owned', { faction: owner.name[getLocale()] }) : t('map.wild')}
          </Text>
          <Text style={font.small}>{hex.estimated ? t('map.estimated') : t('map.garrison')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.text, lineHeight: 42 }}>
            {hex.estimated ? '≈' : ''}
            {formatNumber(hex.garrison, hex.garrison < 10 ? 1 : 0)}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={10} style={{ marginLeft: 4, alignSelf: 'flex-start' }}>
          <Ionicons name="close" size={20} color={colors.textDim} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {mine ? (
          <Chip text={t('map.yours')} icon="shield-checkmark" color={p.main} filled />
        ) : need != null ? (
          <Chip text={t('map.toCapture', { n: need })} icon="flag" color={paletteOf(myFaction).main} filled />
        ) : null}
        {hex.region === front && <Chip text={`${t('map.front')} ×2`} emoji="⚔️" color={colors.gold} filled />}
        {region && <Chip text={t('map.regionControlled', { faction: region.name[getLocale()] })} color={region.color} />}
        {hex.contested && <Chip text={t('map.contested')} icon="flash" color={colors.danger} />}
      </View>
    </Glass>
  );
}
