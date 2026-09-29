import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GAME_MODE } from '@/backend';
import { setLocale } from '@/i18n';
import { getMyProfile, type Profile } from './api';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  loading: boolean;
  /** connecté : compte Supabase en ligne, toujours vrai en mode local (pas de compte) */
  signedIn: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      if (p?.locale) setLocale(p.locale);
      return p;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (GAME_MODE === 'local') {
      void refreshProfile().then(() => setLoading(false));
      return;
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refreshProfile();
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) void refreshProfile();
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    if (GAME_MODE === 'online') await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ loading, signedIn: GAME_MODE === 'local' || session != null, session, profile, refreshProfile, signOut }),
    [loading, session, profile, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider manquant');
  return ctx;
}

/** Apple : connexion native, jeton transmis à Supabase. */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });
  if (!credential.identityToken) throw new Error('apple_no_token');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) throw error;
}

/** Google : OAuth dans le navigateur système (PKCE), retour par le schéma de l'app. */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('oauth_no_url');
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return;
  const code = /[?&]code=([^&#]+)/.exec(res.url)?.[1];
  if (!code) throw new Error(/[?&#]error_description=([^&#]+)/.exec(res.url)?.[1] ?? 'oauth_no_code');
  const { error: e2 } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(code));
  if (e2) throw e2;
}

/** E-mail : code à usage unique à 6 chiffres (pas de lien magique à configurer). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}
