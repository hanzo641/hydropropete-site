import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { play, preload, tick } from '@/features/sfx';
import { t } from '@/i18n';
import { Burst, Shockwave } from '@/ui/fx';
import { hexPath } from '@/ui/hex';
import { colors, fonts, type Palette } from '@/ui/theme';

const MAX_TOKENS = 24;
const FIRE = '#FF8A3D';

interface Token {
  x: number;
  y: number;
  bonus: boolean;
  v: Animated.Value;
}

/**
 * Le butin tombe : chaque troupe gagnée jaillit du bas de la carte et vole dans le compteur,
 * de plus en plus vite, avec une note qui monte. Les troupes bonus de la série arrivent en
 * dernier, couleur braise. Explosion finale quand tout est encaissé.
 */
export function TroopHarvest({ total, bonus, palette, onDone }: { total: number; bonus: number; palette: Palette; onDone?: () => void }) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(0);
  const [bonusOn, setBonusOn] = useState(false);
  const punch = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const [tokens] = useState<Token[]>(() => {
    const n = Math.min(MAX_TOKENS, total);
    const nBonus = total > 0 ? Math.min(n - 1, Math.round((bonus / total) * n)) : 0;
    return Array.from({ length: n }, (_, i) => ({
      x: Math.round(Math.sin(i * 2.4) * 120),
      y: 120 + ((i * 37) % 40),
      bonus: i >= n - nBonus,
      v: new Animated.Value(0),
    }));
  });

  useEffect(() => {
    preload(['tick0', 'tick1', 'tick2', 'tick3', 'reward']);
    if (tokens.length === 0) {
      setDone(1);
      onDone?.();
      return;
    }
    const per = total / tokens.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 450;
    let arrived = 0;
    tokens.forEach((tok, i) => {
      timers.push(
        setTimeout(() => {
          if (tok.bonus) setBonusOn(true);
          Animated.timing(tok.v, { toValue: 1, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
            arrived++;
            setCount(Math.min(total, Math.round(arrived * per)));
            punch.setValue(1.22);
            Animated.spring(punch, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }).start();
            tick(arrived / tokens.length);
            void Haptics.impactAsync(arrived % 4 === 0 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
            if (arrived === tokens.length) {
              setCount(total);
              setTimeout(() => {
                setDone(Date.now());
                play('reward');
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Animated.sequence([
                  Animated.timing(glow, { toValue: 1, duration: 180, useNativeDriver: true }),
                  Animated.timing(glow, { toValue: 0.35, duration: 900, useNativeDriver: true }),
                ]).start();
                punch.setValue(1.45);
                Animated.spring(punch, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }).start();
                onDone?.();
              }, 160);
            }
          });
        }, at),
      );
      at += Math.max(55, 210 * Math.pow(0.91, i));
    });
    return () => timers.forEach(clearTimeout);
    // une seule pluie par écran
  }, []);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 250, overflow: 'visible' }}>
      <Burst fire={done} color={palette.main} count={22} radius={170} size={14} />
      <Shockwave fire={done} color={palette.main} size={230} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 230, height: 230, opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }] }}>
        <Svg width={230} height={230} viewBox="0 0 100 100">
          <Path d={hexPath(100, 0.14, 4)} fill={palette.main} fillOpacity={0.18} stroke={palette.main} strokeOpacity={0.6} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
      {tokens.map((tok, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            opacity: tok.v.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: tok.v.interpolate({ inputRange: [0, 1], outputRange: [tok.x, 0] }) },
              { translateY: tok.v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [tok.y, tok.y - 40, 0] }) },
              { scale: tok.v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.2, 1.1, 0.5] }) },
              { rotate: tok.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 180}deg`] }) },
            ],
          }}>
          <Svg width={26} height={26} viewBox="0 0 100 100">
            <Path d={hexPath(100, 0.14, 3)} fill={tok.bonus ? FIRE : palette.main} stroke="#FFFFFF" strokeWidth={6} />
          </Svg>
        </Animated.View>
      ))}
      <Animated.Text
        style={{
          fontFamily: fonts.display,
          fontSize: 112,
          lineHeight: 118,
          color: palette.main,
          textShadowColor: palette.glow,
          textShadowRadius: 26,
          fontVariant: ['tabular-nums'],
          transform: [{ scale: punch }],
        }}>
        +{count}
      </Animated.Text>
      <Text style={{ fontFamily: fonts.label, fontSize: 15, letterSpacing: 1.6, color: colors.text, textTransform: 'uppercase' }}>{t('summary.troopsLabel')}</Text>
      {bonus > 0 && bonusOn ? (
        <Text style={{ position: 'absolute', top: 6, right: 8, fontFamily: fonts.label, fontSize: 16, color: FIRE, letterSpacing: 1 }}>
          🔥 +{bonus} {t('summary.streakShort')}
        </Text>
      ) : null}
    </View>
  );
}
