import { avatarById, factionById, rankForLevel } from '@conquete/core';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { getLocale } from '@/i18n';
import { hexPath } from './hex';
import { alpha, colors, fonts, paletteOf, radius, space } from './theme';

/** Emblèmes des factions (vectoriels, viewBox 100 × 100). */
const EMBLEMS = {
  flame: {
    outer:
      'M50 4 C54 20 70 30 76 46 C82 62 78 80 66 90 C58 97 42 97 34 90 C22 80 18 64 24 50 C28 41 35 36 38 27 C42 36 44 42 50 45 C48 33 46 18 50 4 Z',
    inner: 'M50 52 C55 60 62 66 62 76 C62 85 56 91 50 91 C44 91 38 85 38 77 C38 69 45 63 50 52 Z',
  },
  wave: {
    outer:
      'M4 70 C14 70 20 62 26 52 C34 38 46 26 62 25 C78 24 92 35 94 50 C95 60 88 68 79 66 C71 64 69 55 75 50 C68 45 57 49 53 60 C49 71 55 82 67 85 C77 87 88 84 96 78 L96 96 L4 96 Z',
    inner: 'M4 84 C16 84 24 78 32 72 C38 67 44 66 48 70 C44 76 46 86 56 92 L4 96 Z',
  },
  leaf: {
    outer: 'M50 6 C74 20 86 42 80 66 C75 84 62 94 50 96 C38 94 25 84 20 66 C14 42 26 20 50 6 Z',
    inner: 'M50 20 L50 90 M50 44 L66 32 M50 60 L34 48 M50 74 L64 64',
  },
  sun: {
    outer: 'M50 22 A28 28 0 1 1 49.9 22 Z',
    inner: 'M50 2 L54 16 L46 16 Z M98 50 L84 54 L84 46 Z M50 98 L46 84 L54 84 Z M2 50 L16 46 L16 54 Z',
  },
} as const;

export function Emblem({ factionId, size = 28, color }: { factionId: number | null | undefined; size?: number; color?: string }) {
  const f = factionById(factionId);
  if (!f) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={hexPath(100, 0.14, 8)} fill="none" stroke={color ?? colors.wild} strokeWidth={8} />
      </Svg>
    );
  }
  const e = EMBLEMS[f.emblem];
  const id = `em-${f.id}-${size}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color ?? f.gradient[0]} />
          <Stop offset="1" stopColor={color ?? f.gradient[1]} />
        </SvgGradient>
      </Defs>
      <Path d={e.outer} fill={`url(#${id})`} />
      {f.emblem === 'leaf' ? (
        <Path d={e.inner} stroke="rgba(255,255,255,0.7)" strokeWidth={4} fill="none" />
      ) : (
        <Path d={e.inner} fill="rgba(255,255,255,0.55)" />
      )}
    </Svg>
  );
}

/** Avatar dans un hexagone, liseré de la couleur du rang (ou de la faction). */
export function HexAvatar({
  id,
  size = 56,
  ring,
  ringWidth,
  glow,
}: {
  id: string | null | undefined;
  size?: number;
  ring?: string;
  ringWidth?: number;
  glow?: boolean;
}) {
  const a = avatarById(id);
  const sw = ringWidth ?? Math.max(2, size / 18);
  const clip = `hexclip-${size}`;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a.name[getLocale()]}
      style={[{ width: size, height: size }, glow && ring ? { boxShadow: `0 0 ${size / 3}px ${alpha(ring, 0.55)}`, borderRadius: size / 2 } : null]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={clip}>
            <Path d={hexPath(100, 0.14, 3)} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clip})`}>
          <Path d="M0 0 H100 V100 H0 Z" fill={a.bg} />
          {a.shapes.map((sh, i) => (
            <Path key={i} d={sh.d} fill={sh.fill} fillOpacity={sh.opacity ?? 1} transform="translate(8 8) scale(0.84)" />
          ))}
        </G>
        <Path d={hexPath(100, 0.14, 3)} fill="none" stroke={ring ?? 'rgba(255,255,255,0.25)'} strokeWidth={(sw * 100) / size} />
      </Svg>
    </View>
  );
}

/** Compat : ancien avatar rond (listes). */
export function Avatar({ id, size = 48, ringColor }: { id: string | null | undefined; size?: number; ringColor?: string }) {
  return <HexAvatar id={id} size={size} ring={ringColor} />;
}

/** Avatar hexagonal cerclé de la couleur du rang, avec le nom du rang. */
export function RankBadge({ level, avatarId, size = 84 }: { level: number; avatarId: string | null | undefined; size?: number }) {
  const rank = rankForLevel(level);
  return (
    <View style={{ alignItems: 'center', gap: space.xs }}>
      <HexAvatar id={avatarId} size={size} ring={rank.color} glow />
      <Text style={{ color: rank.color, fontFamily: fonts.label, fontSize: 14, letterSpacing: 1.4, textTransform: 'uppercase' }}>
        {rank.name[getLocale()]}
      </Text>
    </View>
  );
}

export function FactionBadge({ factionId, size = 'md' }: { factionId: number | null | undefined; size?: 'sm' | 'md' }) {
  const f = factionById(factionId);
  const p = paletteOf(factionId);
  const sm = size === 'sm';
  return (
    <View style={{ borderRadius: radius.pill, overflow: 'hidden', alignSelf: 'flex-start' }}>
      <LinearGradient
        colors={f ? p.gradient : [colors.surfaceHigh, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: sm ? 8 : 12, paddingVertical: sm ? 2 : 5 }}>
        <Emblem factionId={factionId} size={sm ? 12 : 16} color="#FFFFFF" />
        <Text style={{ color: '#fff', fontFamily: fonts.label, fontSize: sm ? 12 : 15, letterSpacing: 1, textTransform: 'uppercase' }}>
          {f ? f.name[getLocale()] : '—'}
        </Text>
      </LinearGradient>
    </View>
  );
}

export function ProgressBar({ value, color, height = 8, gradient }: { value: number; color?: string; height?: number; gradient?: [string, string] }) {
  const v = Math.max(0, Math.min(1, value));
  const g = gradient ?? [color ?? colors.gold, color ?? colors.gold];
  return (
    <View style={{ height, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: height / 2, overflow: 'hidden' }}>
      <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${v * 100}%`, height: '100%', borderRadius: height / 2 }} />
    </View>
  );
}

/**
 * La barre de guerre : les deux factions poussent l'une contre l'autre ; la jonction
 * lumineuse montre qui gagne du terrain.
 */
export function WarBar({
  left,
  right,
  height = 14,
  showLabels = true,
}: {
  left: { factionId: number; value: number };
  right: { factionId: number; value: number };
  height?: number;
  showLabels?: boolean;
}) {
  const total = left.value + right.value;
  const share = total > 0 ? left.value / total : 0.5;
  const pl = paletteOf(left.factionId);
  const pr = paletteOf(right.factionId);
  const pct = Math.round(share * 100);
  return (
    <View style={{ gap: 6 }}>
      {showLabels && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Emblem factionId={left.factionId} size={18} />
            <Text style={{ color: pl.main, fontFamily: fonts.display, fontSize: 22 }}>{pct} %</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: pr.main, fontFamily: fonts.display, fontSize: 22 }}>{100 - pct} %</Text>
            <Emblem factionId={right.factionId} size={18} />
          </View>
        </View>
      )}
      <View style={{ height, borderRadius: height / 2, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.surfaceHigh }}>
        <LinearGradient colors={[pl.gradient[1], pl.gradient[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: Math.max(0.02, share) }} />
        <View style={{ width: 3, backgroundColor: '#FFFFFF', boxShadow: '0 0 10px rgba(255,255,255,0.9)' }} />
        <LinearGradient colors={[pr.gradient[0], pr.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: Math.max(0.02, 1 - share) }} />
      </View>
    </View>
  );
}

/** Nombre qui défile jusqu'à sa valeur (fin de course, butin). */
export function CountUp({
  value,
  duration = 1200,
  delay = 0,
  style,
  format = (n: number) => String(Math.round(n)),
  prefix = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  delay?: number;
  style?: object;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const k = Math.min(1, (ts - start) / duration);
        const eased = 1 - Math.pow(1 - k, 3);
        setShown(value * eased);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);
  return (
    <Text style={style}>
      {prefix}
      {format(shown)}
      {suffix}
    </Text>
  );
}

/** Pulsation continue (halo du bouton de course, série en danger…). */
export function usePulse(active = true, period = 1400): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, period, v]);
  return v;
}

/** Apparition (fondu + montée), échelonnable. */
export function FadeIn({ children, delay = 0, style, from = 16 }: { children: React.ReactNode; delay?: number; style?: ViewStyle; from?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [delay, v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Pastille de série 🔥 (grise à 0, dorée active, pulsante si elle s'éteint ce soir). */
export function StreakBadge({ days, atRisk, size = 'md' }: { days: number; atRisk?: boolean; size?: 'sm' | 'md' }) {
  const pulse = usePulse(!!atRisk, 1200);
  const on = days > 0;
  const sm = size === 'sm';
  return (
    <Animated.View
      style={{
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        borderRadius: radius.pill,
        overflow: 'hidden',
        boxShadow: on ? '0 0 14px rgba(255,138,61,0.45)' : undefined,
      }}>
      <LinearGradient
        colors={on ? ['#FFB547', '#FF5A1F'] : [colors.surfaceHigh, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: sm ? 8 : 12, height: sm ? 26 : 32 }}>
        <Text style={{ fontSize: sm ? 13 : 16 }}>🔥</Text>
        <Text style={{ color: on ? '#1A0A00' : colors.textDim, fontFamily: fonts.display, fontSize: sm ? 17 : 21 }}>{days}</Text>
      </LinearGradient>
    </Animated.View>
  );
}
