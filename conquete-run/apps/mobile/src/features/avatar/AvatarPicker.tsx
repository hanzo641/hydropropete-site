import { AVATARS } from '@conquete/core';
import { Pressable, Text, View } from 'react-native';
import { getLocale, t } from '@/i18n';
import { HexAvatar } from '@/ui/game';
import { colors, fonts, space } from '@/ui/theme';

/** Les tenues de soldat (avatars) ; celles d'un rang supérieur au joueur sont verrouillées. */
export function AvatarPicker({
  value,
  level,
  faction,
  onChange,
  accent = colors.gold,
  onlyUnlocked,
}: {
  value: string;
  level: number;
  faction: number | null;
  onChange: (id: string) => void;
  accent?: string;
  onlyUnlocked?: boolean;
}) {
  const list = onlyUnlocked ? AVATARS.filter((a) => a.unlockLevel <= level) : AVATARS;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' }}>
      {list.map((a) => {
        const locked = level < a.unlockLevel;
        const selected = a.id === value;
        return (
          <Pressable
            key={a.id}
            disabled={locked}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: locked }}
            accessibilityLabel={`${a.name[getLocale()]}${locked ? ` — ${t('avatar.locked', { n: a.unlockLevel })}` : ''}`}
            onPress={() => onChange(a.id)}
            style={({ pressed }) => ({ alignItems: 'center', gap: 4, width: 96, transform: [{ scale: pressed ? 0.94 : selected ? 1.06 : 1 }] })}>
            <View style={{ opacity: locked ? 0.28 : 1 }}>
              <HexAvatar id={a.id} faction={faction} size={84} ring={selected ? accent : undefined} ringWidth={selected ? 3.5 : 1.5} glow={selected} />
            </View>
            <Text
              style={{ color: selected ? accent : locked ? colors.textMute : colors.textDim, fontFamily: fonts.label, fontSize: 13, letterSpacing: 0.6 }}
              numberOfLines={1}>
              {locked ? `🔒 ${t('avatar.locked', { n: a.unlockLevel })}` : a.name[getLocale()]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
