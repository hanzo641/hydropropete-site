// La tâche de localisation doit être définie à la racine du bundle, avant tout écran.
import '@/features/run/locationTask';
// une importation par graisse : seules ces polices sont embarquées dans l'app
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { BarlowCondensed_800ExtraBold_Italic } from '@expo-google-fonts/barlow-condensed/800ExtraBold_Italic';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { restoreIfNeeded } from '@/features/run/session';
import { flushUploads } from '@/features/run/upload';
import { refreshWar } from '@/features/war/report';
import { useLocale } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { loadGameConfig } from '@/lib/gameConfig';
import { colors, fonts } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.gold, text: colors.text, border: colors.border },
};

function Boot({ fontsReady }: { fontsReady: boolean }) {
  const { loading, signedIn, profile, refreshProfile } = useAuth();
  useEffect(() => {
    if (!loading && fontsReady) void SplashScreen.hideAsync();
  }, [loading, fontsReady]);
  useEffect(() => {
    if (!signedIn || !profile) return;
    const wake = () => {
      void loadGameConfig()
        .then(() => restoreIfNeeded())
        .then(() => flushUploads())
        .then(() => refreshWar(profile))
        .then(() => refreshProfile());
    };
    wake();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') wake();
    });
    return () => sub.remove();
    // on ne relance qu'au changement de joueur (pas à chaque rafraîchissement du profil)
  }, [signedIn, profile?.id]);
  return null;
}

export default function RootLayout() {
  useLocale(); // re-rendu au changement de langue
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    BarlowCondensed_800ExtraBold_Italic,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const fontsReady = fontsLoaded || fontError != null;
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <Boot fontsReady={fontsReady} />
        <StatusBar style="light" />
        {fontsReady && (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.label },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade_from_bottom',
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/faction" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding/profile" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="run" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="summary/[localId]" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="deploy/[runId]" options={{ headerShown: false }} />
            <Stack.Screen name="privacy" options={{ title: '' }} />
            <Stack.Screen name="simulation" options={{ title: '' }} />
            <Stack.Screen name="avatar" options={{ title: '', presentation: 'modal' }} />
            <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
          </Stack>
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}
