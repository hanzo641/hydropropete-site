import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/ui/theme';

/** Aiguillage : (connexion en ligne) → recrutement → jeu. */
export default function Index() {
  const { loading, signedIn, profile } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (!signedIn) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
