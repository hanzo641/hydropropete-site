import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { colors, radius, space } from '@/ui/theme';

/**
 * Jauge de déploiement : on GLISSE le doigt le long de la jauge pour y envoyer des troupes
 * (0 à max). Boutons −/+ pour l'accessibilité et l'ajustement fin.
 */
export function DragGauge({
  value,
  max,
  color,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  max: number;
  color: string;
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
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Pressable accessibilityLabel="−" onPress={() => onChange(Math.max(0, value - 1))} hitSlop={8}>
        <Text style={{ color: colors.text, fontSize: 22, width: 22, textAlign: 'center' }}>−</Text>
      </Pressable>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max, now: value }}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(0, value - 1));
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onLayout={(e) => (width.current = Math.max(1, e.nativeEvent.layout.width))}
        style={{ flex: 1, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden', justifyContent: 'center' }}
        {...responder.panHandlers}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, backgroundColor: color }} />
        <Text style={{ textAlign: 'center', color: colors.text, fontWeight: '800', fontSize: 16 }}>{value}</Text>
      </View>
      <Pressable accessibilityLabel="+" onPress={() => onChange(Math.min(max, value + 1))} hitSlop={8}>
        <Text style={{ color: colors.text, fontSize: 22, width: 22, textAlign: 'center' }}>+</Text>
      </Pressable>
    </View>
  );
}
