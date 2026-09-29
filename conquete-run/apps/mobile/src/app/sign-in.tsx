import * as AppleAuthentication from 'expo-apple-authentication';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { t } from '@/i18n';
import { sendEmailCode, signInWithApple, signInWithGoogle, verifyEmailCode } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button, ErrorText, Field, Screen } from '@/ui/components';
import { colors, font, space } from '@/ui/theme';

export default function SignIn() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'choose' | 'email' | 'code'>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (fn: () => Promise<void>, next?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      next?.();
    } catch (e) {
      const msg = (e as { code?: string; message?: string }).code === 'ERR_REQUEST_CANCELED' ? null : (e as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };
  const done = () => router.replace('/');

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: space.lg, paddingVertical: space.xxl }}>
          <Text style={[font.h1, { fontSize: 36 }]}>{t('common.appName')}</Text>
          <Text style={font.h2}>{t('auth.title')}</Text>
          <Text style={[font.body, { color: colors.textDim }]}>{t('auth.subtitle')}</Text>
          {!isSupabaseConfigured && (
            <ErrorText>EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY manquants (voir .env.example).</ErrorText>
          )}
          <View style={{ gap: space.md, marginTop: space.xl }}>
            {step === 'choose' && (
              <>
                {appleAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={12}
                    style={{ height: 52 }}
                    onPress={() => void run(signInWithApple, done)}
                  />
                )}
                <Button title={t('auth.google')} icon="logo-google" variant="secondary" loading={busy} onPress={() => void run(signInWithGoogle, done)} />
                <Button title={t('auth.email')} icon="mail-outline" variant="ghost" onPress={() => setStep('email')} />
              </>
            )}
            {step === 'email' && (
              <>
                <Field
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <Button title={t('auth.sendCode')} loading={busy} disabled={!/.+@.+\..+/.test(email)} onPress={() => void run(() => sendEmailCode(email.trim()), () => setStep('code'))} />
                <Button title={t('common.back')} variant="ghost" onPress={() => setStep('choose')} />
              </>
            )}
            {step === 'code' && (
              <>
                <Text style={font.small}>{t('auth.codeSent', { email })}</Text>
                <Field
                  label={t('auth.codePlaceholder')}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                />
                <Button title={t('auth.verify')} loading={busy} disabled={code.length !== 6} onPress={() => void run(() => verifyEmailCode(email.trim(), code), done)} />
                <Button title={t('common.back')} variant="ghost" onPress={() => setStep('email')} />
              </>
            )}
            <ErrorText>{error}</ErrorText>
          </View>
          <Text style={[font.small, { textAlign: 'center' }]}>
            {t('auth.legal')}{' '}
            <Link href="/legal/terms" style={{ color: colors.accent }}>
              {t('legal.terms')}
            </Link>{' '}
            ·{' '}
            <Link href="/legal/privacy" style={{ color: colors.accent }}>
              {t('legal.privacy')}
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
