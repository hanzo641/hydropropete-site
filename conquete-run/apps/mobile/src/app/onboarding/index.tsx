import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Text, useWindowDimensions, View } from 'react-native';
import { dict, t } from '@/i18n';
import { Button, Screen } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

const ICONS = ['🏃', '🗺️', '⚔️', '🛡️'];

/** Les règles en 4 écrans. */
export default function OnboardingRules() {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const rules = dict().onboarding.rules;
  const next = () => {
    if (page < rules.length - 1) {
      list.current?.scrollToIndex({ index: page + 1 });
      setPage(page + 1);
    } else router.push('/onboarding/profile');
  };
  return (
    <Screen padded={false}>
      <FlatList
        ref={list}
        data={rules}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <View style={{ width, padding: space.xl, justifyContent: 'center', gap: space.lg }}>
            <Text style={{ fontSize: 72, textAlign: 'center' }}>{ICONS[index]}</Text>
            <Text style={[font.h1, { textAlign: 'center' }]}>{item.title}</Text>
            <Text style={[font.body, { textAlign: 'center', color: colors.textDim, fontSize: 17, lineHeight: 24 }]}>{item.body}</Text>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginBottom: space.lg }}>
        {rules.map((_, i) => (
          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.accent : colors.border }} />
        ))}
      </View>
      <View style={{ padding: space.lg }}>
        <Button title={t('common.continue')} onPress={next} />
      </View>
    </Screen>
  );
}
