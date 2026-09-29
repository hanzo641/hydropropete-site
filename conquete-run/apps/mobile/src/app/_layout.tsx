// La tâche de localisation doit être définie à la racine du bundle, avant tout écran.
import '@/features/run/locationTask';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { restoreIfNeeded } from '@/features/run/session';
import { flushUploads } from '@/features/run/upload';
import { useLocale } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { loadGameConfig } from '@/lib/gameConfig';
import { colors } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, primary: colors.accent, text: colors.text, border: colors.border },
};

function Boot() {
  const { loading, session } = useAuth();
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  useEffect(() => {
    if (!session) return;
    void loadGameConfig().then(() => restoreIfNeeded());
    void flushUploads();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void flushUploads();
    });
    return () => sub.remove();
  }, [session]);
  return null;
}

export default function RootLayout() {
  useLocale(); // re-rendu au changement de langue
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <Boot />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/profile" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="run" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="summary/[localId]" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="deploy/[runId]" options={{ headerShown: false }} />
          <Stack.Screen name="runs" options={{ title: '' }} />
          <Stack.Screen name="privacy" options={{ title: '' }} />
          <Stack.Screen name="simulation" options={{ title: '' }} />
          <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
