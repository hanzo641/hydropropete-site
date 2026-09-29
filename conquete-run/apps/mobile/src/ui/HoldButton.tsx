import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from './theme';

/** Bouton à maintenir (fin de course) : la jauge se remplit, relâcher annule. */
export function HoldButton({
  label,
  hint,
  onComplete,
  duration = 900,
  gradient = ['#FF6B7A', '#D91E3A'],
}: {
  label: string;
  hint?: string;
  onComplete: () => void;
  duration?: number;
  gradient?: [string, string];
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    anim.current = Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true });
    anim.current.start(({ finished }) => {
      if (finished) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete();
      }
    });
  };
  const cancel = () => {
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPressIn={start}
      onPressOut={cancel}
      style={{ height: 60, borderRadius: radius.md, overflow: 'hidden', backgroundColor: 'rgba(217,30,58,0.22)', borderWidth: 1, borderColor: 'rgba(255,107,122,0.55)' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleX: progress }], transformOrigin: 'left' }]}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Ionicons name="stop" size={18} color={colors.text} />
        <Text style={{ color: colors.text, fontFamily: fonts.label, fontSize: 19, letterSpacing: 1.4, textTransform: 'uppercase' }}>{label}</Text>
        {hint ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: fonts.body, fontSize: 12 }}>· {hint}</Text> : null}
      </View>
    </Pressable>
  );
}
