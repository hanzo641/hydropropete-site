import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useAuth } from '@/lib/auth';
import { TabBar } from '@/ui/TabBar';
import { colors } from '@/ui/theme';

export default function TabsLayout() {
  const { signedIn, profile, loading } = useAuth();
  if (!loading && !signedIn) return <Redirect href="/sign-in" />;
  if (!loading && signedIn && !profile) return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="war" />
      <Tabs.Screen name="run-placeholder" />
      <Tabs.Screen name="runs" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
