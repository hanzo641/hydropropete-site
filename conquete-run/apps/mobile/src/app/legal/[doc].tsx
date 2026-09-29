import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { LEGAL } from '@/legal/texts';
import { getLocale } from '@/i18n';
import { Screen } from '@/ui/components';
import { font, space } from '@/ui/theme';

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: 'privacy' | 'terms' | 'notice' }>();
  const d = LEGAL[getLocale()][doc] ?? LEGAL[getLocale()].notice;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}>
        <Text style={font.h1}>{d.title}</Text>
        <Text style={[font.body, { lineHeight: 22 }]}>{d.body}</Text>
      </ScrollView>
    </Screen>
  );
}
