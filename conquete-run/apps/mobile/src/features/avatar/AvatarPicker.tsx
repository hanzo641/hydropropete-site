import { AVATARS } from '@conquete/core';
import { Pressable, Text, View } from 'react-native';
import { getLocale, t } from '@/i18n';
import { Avatar } from '@/ui/game';
import { colors, radius, space } from '@/ui/theme';

/** Grille d'avatars ; ceux d'un niveau supérieur au joueur sont grisés avec le niveau requis. */
export function AvatarPicker({ value, level, onChange }: { value: string; level: number; onChange: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' }}>
      {AVATARS.map((a) => {
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
            style={{
              alignItems: 'center',
              gap: space.xs,
              padding: space.xs,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: selected ? colors.accent : 'transparent',
              width: 84,
            }}>
            <View style={{ opacity: locked ? 0.3 : 1 }}>
              <Avatar id={a.id} size={64} />
            </View>
            <Text style={{ color: locked ? colors.textDim : colors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
              {locked ? `🔒 ${t('avatar.locked', { n: a.unlockLevel })}` : a.name[getLocale()]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
