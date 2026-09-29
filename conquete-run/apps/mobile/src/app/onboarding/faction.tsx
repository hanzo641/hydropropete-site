import { activeFactions, type Faction } from '@conquete/core';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getLocale, t } from '@/i18n';
import { currentConfig } from '@/lib/gameConfig';
import { Button, HexPattern, Screen } from '@/ui/components';
import { Emblem } from '@/ui/game';
import { hexPath } from '@/ui/hex';
import { colors, font, fonts, paletteOf, radius, space } from '@/ui/theme';

function FactionPanel({ f, selected, dimmed, onPress }: { f: Faction; selected: boolean; dimmed: boolean; onPress: (id: number) => void }) {
  const l = getLocale();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${f.name[l]} — ${f.motto[l]}`}
      onPress={() => onPress(f.id)}
      style={({ pressed }) => [
        {
          flex: selected ? 1.55 : dimmed ? 0.62 : 1,
          borderRadius: radius.xl,
          overflow: 'hidden',
          opacity: dimmed ? 0.55 : 1,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)',
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        selected ? { boxShadow: `0 0 34px ${paletteOf(f.id).glow}` } : null,
      ]}>
      <LinearGradient colors={[f.gradient[0], f.gradient[1], '#0A0D14']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}>
        <HexPattern opacity={0.1} size={40} />
      </View>
      <View style={{ position: 'absolute', right: -30, bottom: -26, opacity: 0.22 }}>
        <Emblem factionId={f.id} size={220} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, padding: space.xl, justifyContent: 'flex-end', gap: 6 }}>
        <Emblem factionId={f.id} size={selected ? 64 : 46} color="#FFFFFF" />
        <Text style={{ fontFamily: fonts.display, fontSize: selected ? 64 : 50, color: '#FFFFFF', lineHeight: selected ? 66 : 52, textTransform: 'uppercase' }}>
          {f.name[l]}
        </Text>
        <Text style={{ fontFamily: fonts.bodyHeavy, fontSize: 16, color: 'rgba(255,255,255,0.92)' }}>{f.motto[l]}</Text>
        {selected && <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' }}>{f.lore[l]}</Text>}
      </View>
    </Pressable>
  );
}

/** Le choix du camp : deux panneaux, un « VS » au milieu, et c'est pour toujours. */
export default function FactionChoice() {
  const factions = activeFactions(currentConfig().factions);
  const [selected, setSelected] = useState<number | null>(null);
  const pick = (id: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.create(320, 'easeInEaseOut', 'scaleXY'));
    setSelected(id);
  };
  const chosen = factions.find((f) => f.id === selected) ?? null;
  const go = (id: number | null) =>
    router.push({ pathname: '/onboarding/profile', params: { faction: id == null ? 'auto' : String(id) } });

  return (
    <Screen bg={false} style={{ paddingBottom: space.md }}>
      <View style={{ paddingTop: space.md, paddingBottom: space.md, gap: 2 }}>
        <Text style={font.h1}>{t('faction.title')}</Text>
        <Text style={font.small}>{t('faction.subtitle')}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {factions[0] && <FactionPanel f={factions[0]} selected={selected === factions[0].id} dimmed={selected != null && selected !== factions[0].id} onPress={pick} />}
        {/* jonction des deux camps : le « VS » est toujours à cheval sur les deux panneaux */}
        <View pointerEvents="none" style={{ height: space.md, zIndex: 10, elevation: 10, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={64} height={64} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
              <Path d={hexPath(100, 0.14, 3)} fill={colors.bg} stroke="rgba(255,255,255,0.8)" strokeWidth={4} />
            </Svg>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#FFFFFF' }}>{t('common.vs')}</Text>
          </View>
        </View>
        {factions[1] && <FactionPanel f={factions[1]} selected={selected === factions[1].id} dimmed={selected != null && selected !== factions[1].id} onPress={pick} />}
      </View>
      <View style={{ gap: space.sm, paddingTop: space.md }}>
        <Button
          title={chosen ? t('faction.join', { faction: chosen.name[getLocale()] }) : t('faction.tapToPick')}
          size="lg"
          disabled={!chosen}
          palette={paletteOf(chosen?.id)}
          onPress={() => {
            if (chosen) go(chosen.id);
          }}
        />
        <Text accessibilityRole="button" onPress={() => go(null)} style={[font.label, { textAlign: 'center', paddingVertical: space.sm }]}>
          {t('faction.auto')}
        </Text>
      </View>
    </Screen>
  );
}
