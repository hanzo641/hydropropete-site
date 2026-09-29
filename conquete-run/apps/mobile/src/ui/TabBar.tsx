import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { t, type TKey } from '@/i18n';
import { Glass, usePalette } from './components';
import { usePulse } from './game';
import { hexPath } from './hex';
import { colors, fonts } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { icon: IconName; iconOn: IconName; label: TKey }> = {
  index: { icon: 'map-outline', iconOn: 'map', label: 'tabs.map' },
  war: { icon: 'flame-outline', iconOn: 'flame', label: 'tabs.war' },
  runs: { icon: 'stats-chart-outline', iconOn: 'stats-chart', label: 'tabs.runs' },
  profile: { icon: 'person-outline', iconOn: 'person', label: 'tabs.profile' },
};

export const TAB_BAR_SPACE = 104;

function RunButton() {
  const p = usePalette();
  const pulse = usePulse(true, 2200);
  const size = 78;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tabs.run')}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        router.push('/run');
      }}
      style={({ pressed }) => ({ marginTop: -34, alignItems: 'center', transform: [{ scale: pressed ? 0.93 : 1 }] })}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={hexPath(100, 0.16, 3)} fill="none" stroke={p.main} strokeWidth={5} />
        </Svg>
      </Animated.View>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 22px ${p.glow}`, borderRadius: size / 2 }}>
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
          <Defs>
            <SvgGradient id="runbtn" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={p.gradient[0]} />
              <Stop offset="1" stopColor={p.gradient[1]} />
            </SvgGradient>
          </Defs>
          <Path d={hexPath(100, 0.16, 3)} fill="url(#runbtn)" stroke="rgba(255,255,255,0.55)" strokeWidth={2.5} />
        </Svg>
        <Ionicons name="walk" size={32} color={p.on} />
      </View>
      <Text style={{ fontFamily: fonts.label, fontSize: 12, letterSpacing: 1.2, color: p.main, marginTop: 3, textTransform: 'uppercase' }}>
        {t('tabs.run')}
      </Text>
    </Pressable>
  );
}

/** Barre d'onglets flottante, vitrée, avec le gros bouton hexagonal « Courir » au centre. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const p = usePalette();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: 12 }}>
      <Glass strong style={{ borderRadius: 26, height: 66, overflow: 'visible' }}>
        <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 20, borderRadius: 26 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {state.routes.map((route, index) => {
            if (route.name === 'run-placeholder') {
              return (
                <View key={route.key} style={{ flex: 1.2, alignItems: 'center' }}>
                  <RunButton />
                </View>
              );
            }
            const cfg = TABS[route.name];
            if (!cfg) return null;
            const focused = state.index === index;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={t(cfg.label)}
                onPress={() => {
                  const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !e.defaultPrevented) {
                    void Haptics.selectionAsync();
                    navigation.navigate(route.name);
                  }
                }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' }}>
                {focused && <View style={{ position: 'absolute', top: 6, width: 18, height: 3, borderRadius: 2, backgroundColor: p.main, boxShadow: `0 0 8px ${p.glow}` }} />}
                <Ionicons name={focused ? cfg.iconOn : cfg.icon} size={22} color={focused ? p.main : colors.textDim} />
                <Text style={{ fontFamily: fonts.label, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: focused ? colors.text : colors.textMute }}>
                  {t(cfg.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
