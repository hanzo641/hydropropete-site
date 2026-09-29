import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Mask, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useAuth } from '@/lib/auth';
import { hexPath } from './hex';
import { alpha, colors, font, fonts, type Palette, paletteOf, radius, space } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Palette de la faction du joueur (toute l'interface s'y accorde). */
export function usePalette(): Palette {
  const { profile } = useAuth();
  return paletteOf(profile?.faction_id);
}

/** Motif discret d'hexagones (en-tête des écrans) ; `fade` l'estompe vers le bas. */
export function HexPattern({ color = '#FFFFFF', opacity = 0.05, size = 36, fade }: { color?: string; opacity?: number; size?: number; fade?: boolean }) {
  const w = size * 0.866;
  const d = hexPath(size, 0.1, 2);
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgGradient id="hexfade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </SvgGradient>
        <Mask id="hexmask">
          <Rect width="100%" height="100%" fill="url(#hexfade)" />
        </Mask>
        <Pattern id="hexes" width={w} height={size * 1.5} patternUnits="userSpaceOnUse">
          <Path d={d} transform={`translate(${(w - size) / 2}, 0)`} stroke={color} strokeOpacity={opacity} strokeWidth={1} fill="none" />
          <Path d={d} transform={`translate(${(w - size) / 2 - w / 2}, ${size * 0.75})`} stroke={color} strokeOpacity={opacity} strokeWidth={1} fill="none" />
          <Path d={d} transform={`translate(${(w - size) / 2 + w / 2}, ${size * 0.75})`} stroke={color} strokeOpacity={opacity} strokeWidth={1} fill="none" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#hexes)" mask={fade ? 'url(#hexmask)' : undefined} />
    </Svg>
  );
}

/** Fond des écrans : noir bleuté, halo de la couleur de faction en haut, motif hexagonal. */
export function ScreenBg({ palette }: { palette?: Palette }) {
  const own = usePalette();
  const p = palette ?? own;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      <LinearGradient colors={[alpha(p.main, 0.22), alpha(p.main, 0.05), 'transparent']} locations={[0, 0.35, 0.7]} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}>
        <HexPattern color={p.main} opacity={0.09} fade />
      </View>
    </View>
  );
}

export function Screen({
  children,
  padded = true,
  style,
  edges,
  bg = true,
}: {
  children?: ReactNode;
  padded?: boolean;
  style?: ViewStyle;
  edges?: Edge[];
  bg?: boolean;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {bg && <ScreenBg />}
      <SafeAreaView edges={edges} style={[{ flex: 1 }, padded && { paddingHorizontal: space.lg }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/** Surface vitrée (vrai flou sur iOS, verre fumé sur Android où la carte ne se floute pas). */
export function Glass({
  children,
  style,
  glow,
  strong,
  intensity = 40,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  glow?: string;
  strong?: boolean;
  intensity?: number;
}) {
  const flat = StyleSheet.flatten(style) ?? {};
  const r = (flat.borderRadius as number | undefined) ?? radius.lg;
  return (
    <View
      style={[
        {
          borderRadius: r,
          borderWidth: 1,
          borderColor: glow ? alpha(glow, 0.55) : colors.border,
          overflow: 'hidden',
          backgroundColor: Platform.OS === 'ios' ? 'rgba(12,16,24,0.45)' : strong ? colors.glassStrong : colors.glass,
        },
        glow ? { boxShadow: `0 0 18px ${alpha(glow, 0.35)}` } : null,
        style,
      ]}>
      {Platform.OS === 'ios' && <BlurView tint="dark" intensity={intensity} style={StyleSheet.absoluteFill} />}
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

export function Card({ children, style, glow }: { children: ReactNode; style?: ViewStyle; glow?: string }) {
  return (
    <Glass glow={glow} style={[{ padding: space.lg, gap: space.sm, borderRadius: radius.lg }, style ?? {}]}>
      {children}
    </Glass>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  onLongPress,
  delayLongPress,
  size = 'md',
  palette,
}: {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: ViewStyle;
  size?: 'md' | 'lg';
  palette?: Palette;
}) {
  const own = usePalette();
  const p = palette ?? own;
  const grad: [string, string] | null =
    variant === 'primary' ? p.gradient : variant === 'danger' ? ['#FF6B7A', '#D91E3A'] : null;
  const fg = variant === 'primary' ? p.on : colors.text;
  const h = size === 'lg' ? 62 : 54;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          minHeight: h,
          borderRadius: radius.md,
          overflow: 'hidden',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        grad && !disabled ? { boxShadow: `0 8px 24px ${variant === 'danger' ? 'rgba(217,30,58,0.45)' : p.glow}` } : null,
        variant === 'secondary' && { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.borderStrong },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.borderStrong },
        style,
      ]}>
      {grad && <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
      {grad && (
        <LinearGradient
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl }}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={size === 'lg' ? 22 : 19} color={fg} />}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ color: fg, fontFamily: fonts.label, fontSize: size === 'lg' ? 21 : 18, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  active,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  active?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Glass glow={active ? p.main : undefined} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={size * 0.46} color={active ? p.main : colors.text} />
      </Glass>
    </Pressable>
  );
}

export function Stat({ label, value, unit, big, color, align = 'center' }: { label: string; value: string; unit?: string; big?: boolean; color?: string; align?: 'center' | 'flex-start' }) {
  return (
    <View style={{ alignItems: align, flex: 1 }}>
      <Text style={[font.stat, { fontSize: big ? 46 : 30, lineHeight: big ? 50 : 34 }, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.label, fontSize: big ? 18 : 14, color: colors.textDim, letterSpacing: 0.5 }}> {unit}</Text> : null}
      </Text>
      <Text style={[font.label, { fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, right, color }: { title: string; right?: ReactNode; color?: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
      <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: color ?? p.main }} />
      <Text style={[font.h2, { fontSize: 20, flex: 1 }]}>{title}</Text>
      {right}
    </View>
  );
}

export function Chip({
  text,
  icon,
  emoji,
  color,
  filled,
  onPress,
  style,
}: {
  text: string;
  icon?: IconName;
  emoji?: string;
  color?: string;
  filled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const c = color ?? colors.text;
  const inner = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          height: 32,
          borderRadius: radius.pill,
          backgroundColor: filled ? alpha(c.startsWith('#') ? c : '#FFFFFF', 0.18) : colors.glass,
          borderWidth: 1,
          borderColor: filled && c.startsWith('#') ? alpha(c, 0.5) : colors.border,
        },
        style,
      ]}>
      {emoji ? <Text style={{ fontSize: 14 }}>{emoji}</Text> : null}
      {icon ? <Ionicons name={icon} size={15} color={c} /> : null}
      <Text style={{ color: c, fontFamily: fonts.label, fontSize: 15, letterSpacing: 0.8 }}>{text}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={font.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMute} style={[styles.input, style as TextStyle]} {...rest} />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md }, style]}>{children}</View>;
}

export function Checkbox({ checked, onChange, label, palette }: { checked: boolean; onChange: (v: boolean) => void; label: string; palette?: Palette }) {
  const own = usePalette();
  const p = palette ?? own;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: checked ? p.main : colors.borderStrong,
          backgroundColor: checked ? p.main : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}>
        {checked && <Ionicons name="checkmark" size={17} color={p.on} />}
      </View>
      <Text style={[font.body, { flex: 1, fontSize: 14, color: colors.textDim }]}>{label}</Text>
    </Pressable>
  );
}

export function ListItem({
  title,
  subtitle,
  icon,
  onPress,
  right,
  leading,
  danger,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  icon?: IconName;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.6 }]}>
      {leading}
      {icon && (
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[font.bodyBold, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMute} /> : null)}
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={{ color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 14 }}>{children}</Text> : null;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.xs }} />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 54,
    color: colors.text,
    fontSize: 17,
    fontFamily: fonts.bodyBold,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
