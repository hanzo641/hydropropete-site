import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GAME_MODE } from '@/backend';
import { dict, t } from '@/i18n';
import { Button, Chip, HexPattern, Screen } from '@/ui/components';
import { Emblem, FadeIn } from '@/ui/game';
import { hexPath } from '@/ui/hex';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors, font, fonts, radius, space } from '@/ui/theme';

/** Écran d'accueil : la promesse du jeu en 10 secondes. */
export default function Welcome() {
  const w = dict().welcome;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* les deux camps, en fond */}
      <LinearGradient colors={['rgba(255,77,46,0.28)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.55 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', 'rgba(46,125,255,0.30)']} start={{ x: 0.1, y: 0.45 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}>
        <HexPattern opacity={0.06} size={44} />
      </View>
      <Screen bg={false}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.xl, paddingVertical: space.xl }}>
          <FadeIn>
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 150 }}>
              <Svg width={150} height={150} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
                <Path d={hexPath(100, 0.12, 2)} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} />
              </Svg>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Emblem factionId={1} size={54} />
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.textDim }}>{t('common.vs')}</Text>
                <Emblem factionId={2} size={54} />
              </View>
            </View>
          </FadeIn>
          <FadeIn delay={120}>
            <View style={{ gap: space.sm }}>
              <Text style={[font.label, { color: colors.gold, textAlign: 'center' }]}>{w.kicker}</Text>
              <Text style={[font.hero, { textAlign: 'center' }]}>{w.title}</Text>
              <Text style={[font.body, { textAlign: 'center', color: colors.textDim, fontSize: 16, lineHeight: 23 }]}>{w.subtitle}</Text>
            </View>
          </FadeIn>
          <View style={{ gap: space.sm }}>
            {w.steps.map((s, i) => (
              <FadeIn key={s.title} delay={260 + i * 120}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    padding: space.md,
                    borderRadius: radius.lg,
                    backgroundColor: colors.glass,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                  <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={48} height={48} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
                      <Path d={hexPath(100, 0.16, 4)} fill="rgba(255,197,61,0.12)" stroke="rgba(255,197,61,0.6)" strokeWidth={3} />
                    </Svg>
                    <Text style={{ fontSize: s.icon === '⬡' ? 24 : 20, color: colors.gold }}>{s.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[font.h2, { fontSize: 19 }]}>{s.title}</Text>
                    <Text style={font.small}>{s.body}</Text>
                  </View>
                </View>
              </FadeIn>
            ))}
          </View>
          <FadeIn delay={700} style={{ gap: space.md }}>
            <Button title={w.cta} size="lg" icon="flag" onPress={() => router.push('/onboarding/faction')} />
            {GAME_MODE === 'local' && (
              <View style={{ alignItems: 'center' }}>
                <Chip text={t('common.solo')} icon="phone-portrait-outline" color={colors.textDim} />
              </View>
            )}
          </FadeIn>
        </ScrollView>
      </Screen>
    </View>
  );
}
