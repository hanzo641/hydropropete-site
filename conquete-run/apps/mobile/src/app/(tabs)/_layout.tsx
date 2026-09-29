import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { colors } from '@/ui/theme';

function RunButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tabs.run')}
      onPress={() => router.push('/run')}
      style={{ top: -18, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: colors.bg,
        }}>
        <Ionicons name="walk" size={32} color="#111" />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { session, profile, loading } = useAuth();
  if (!loading && !session) return <Redirect href="/sign-in" />;
  if (!loading && session && !profile) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 84 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.map'), tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} /> }}
      />
      <Tabs.Screen name="run-placeholder" options={{ title: '', tabBarButton: () => <RunButton /> }} />
      <Tabs.Screen
        name="team"
        options={{ title: t('tabs.team'), tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
