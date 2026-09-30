import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, type TextStyle, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { hexPath } from './hex';
import { fonts } from './theme';

/**
 * Effets de jeu réutilisables (tous sur le fil natif) : gerbe d'étincelles, onde de choc,
 * tampon qui s'écrase, tremblement. Chaque effet se rejoue quand sa clé `fire` change.
 */

/** Gerbe d'étincelles hexagonales qui jaillissent du centre. */
export function Burst({ fire, color, count = 18, radius = 150, size = 12 }: { fire: number; color: string; count?: number; radius?: number; size?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + ((fire * 7 + i * 13) % 10) / 20;
        const r = radius * (0.55 + (((fire * 31 + i * 17) % 100) / 100) * 0.6);
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, s: size * (0.5 + ((i * 29) % 10) / 10), rot: (i * 47) % 360 };
      }),
    [fire, count, radius, size],
  );
  useEffect(() => {
    if (!fire) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [fire, v]);
  if (!fire) return null;
  return (
    <View pointerEvents="none" style={styles.center}>
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            opacity: v.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
            transform: [
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, s.dy] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${s.rot}deg`, `${s.rot + 220}deg`] }) },
              { scale: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.3, 1.2, 0.4] }) },
            ],
          }}>
          <Svg width={s.s} height={s.s} viewBox="0 0 100 100">
            <Path d={hexPath(100, 0.1, 2)} fill={i % 3 === 0 ? '#FFFFFF' : color} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

/** Onde de choc : anneau hexagonal qui s'élargit et s'efface. */
export function Shockwave({ fire, color, size = 260, delay = 0 }: { fire: number; color: string; size?: number; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!fire) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [fire, v, delay]);
  if (!fire) return null;
  return (
    <View pointerEvents="none" style={styles.center}>
      <Animated.View
        style={{
          position: 'absolute',
          opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] }) }],
        }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={hexPath(100, 0.14, 4)} fill="none" stroke={color} strokeWidth={4} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Tampon : le texte tombe du ciel, s'écrase avec un rebond et reste affiché. */
export function Stamp({ fire, text, color, sub, style }: { fire: number; text: string; color: string; sub?: string; style?: TextStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!fire) return;
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [fire, v]);
  if (!fire) return null;
  return (
    <View pointerEvents="none" style={styles.center}>
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) }, { rotate: '-6deg' }],
        }}>
        <Text
          style={[
            { fontFamily: fonts.display, fontSize: 62, color, textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 18, letterSpacing: 1, textTransform: 'uppercase' },
            style,
          ]}>
          {text}
        </Text>
        {sub ? (
          <Text style={{ fontFamily: fonts.label, fontSize: 20, color: '#FFFFFF', letterSpacing: 1.5, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 10 }}>{sub}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Tremblement d'écran (impact). Renvoie la valeur à brancher sur translateX. */
export function useShake(): [Animated.Value, () => void] {
  const v = useRef(new Animated.Value(0)).current;
  const shake = () => {
    v.setValue(0);
    Animated.sequence(
      [14, -12, 9, -7, 4, -2, 0].map((x) => Animated.timing(v, { toValue: x, duration: 45, easing: Easing.linear, useNativeDriver: true })),
    ).start();
  };
  return [v, shake];
}

/** Flash plein écran (couleur de faction) au moment d'un impact. */
export function Flash({ fire, color, peak = 0.55 }: { fire: number; color: string; peak?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!fire) return;
    v.setValue(peak);
    Animated.timing(v, { toValue: 0, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [fire, v, peak]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: v }]} />;
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
