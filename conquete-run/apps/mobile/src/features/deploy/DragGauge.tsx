import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '@/ui/theme';

/**
 * Jauge de déploiement : on GLISSE le doigt le long de la jauge pour y envoyer des troupes
 * (0 à max). Boutons −/+ pour l'accessibilité et l'ajustement fin.
 */
export function DragGauge({
  value,
  max,
  gradient,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  max: number;
  gradient: [string, string];
  onChange: (v: number) => void;
  accessibilityLabel: string;
}) {
  const width = useRef(1);
  const latest = useRef({ max, onChange });
  latest.current = { max, onChange };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
        onPanResponderMove: (e) => set(e.nativeEvent.locationX),
      }),
    [],
  );
  function set(x: number) {
    const { max: m, onChange: cb } = latest.current;
    cb(Math.max(0, Math.min(m, Math.round((x / width.current) * m))));
  }

  const pct = max > 0 ? value / max : 0;
  const step = (d: number) => onChange(Math.max(0, Math.min(max, value + d)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel="−" onPress={() => step(-1)} hitSlop={8} style={btn}>
        <Text style={btnText}>−</Text>
      </Pressable>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max, now: value }}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') step(1);
          if (e.nativeEvent.actionName === 'decrement') step(-1);
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onLayout={(e) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
        style={{ flex: 1, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border, overflow: 'hidden', justifyContent: 'center' }}
        {...responder.panHandlers}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%` }} />
        <Text style={{ textAlign: 'center', color: colors.text, fontFamily: fonts.display, fontSize: 22 }}>{value}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="+" onPress={() => step(1)} hitSlop={8} style={btn}>
        <Text style={btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const btn = { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' } as const;
const btnText = { color: colors.text, fontSize: 22, fontFamily: fonts.bodyBold, lineHeight: 26 } as const;
