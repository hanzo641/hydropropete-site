import { assignFaction, DEFAULT_AVATAR_ID, factionById, type LatLng, zoneAt } from '@conquete/core';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { getLocale, t, type TKey } from '@/i18n';
import { GAME_MODE, onboard, zoneFactionCounts } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentConfig } from '@/lib/gameConfig';
import { TERMS_VERSION } from '@/legal/texts';
import { Button, Checkbox, ErrorText, Field, Screen, ScreenBg, SectionTitle } from '@/ui/components';
import { FactionBadge, HexAvatar } from '@/ui/game';
import { colors, font, paletteOf, space } from '@/ui/theme';

/** Nom de guerre, avatar, terrain, consentements — puis la carte. */
export default function OnboardingProfile() {
  const params = useLocalSearchParams<{ faction?: string }>();
  const requested = params.faction && params.faction !== 'auto' ? Number(params.faction) : null;
  const palette = paletteOf(requested);
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [position, setPosition] = useState<LatLng | null>(null);
  const avatar = DEFAULT_AVATAR_ID;
  const [gps, setGps] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState<'locate' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const local = GAME_MODE === 'local';

  const year = Number(birthYear);
  const tooYoung = birthYear.length === 4 && new Date().getFullYear() - year < 15;
  const validName = /^[A-Za-z0-9_.À-ÖØ-öø-ÿ-]{3,20}$/.test(username);
  const ready = validName && position != null && (local ? terms : birthYear.length === 4 && !tooYoung && gps && terms);

  const locate = async () => {
    setError(null);
    setBusy('locate');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error(t('run.permissionDenied'));
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: local ? Location.Accuracy.Balanced : Location.Accuracy.Low }));
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!local && requested != null) {
        // en ligne : un camp surreprésenté dans la zone est fermé (équilibrage)
        const counts = await zoneFactionCounts(zoneAt(p, currentConfig().h3)).catch(() => new Map<number, number>());
        if (assignFaction(counts, requested, currentConfig().factions).locked.includes(requested)) throw new Error(t('faction.locked'));
      }
      setPosition(p);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message || t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!position) return;
    setBusy('submit');
    setError(null);
    try {
      await onboard({
        username,
        faction: requested,
        avatarId: avatar,
        locale: getLocale(),
        position,
        birthYear: local ? null : year,
        gpsConsent: local ? true : gps,
        termsVersion: TERMS_VERSION,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (e) {
      const code = (e as { code?: string; message: string }).code === '23505' ? 'username_taken' : (e as Error).message;
      const key = `onboarding.errors.${code}` as TKey;
      const msg = t(key);
      setError(msg === key ? t('common.error') : msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenBg palette={palette} />
      <Screen bg={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.xl }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: space.sm }}>
              {requested != null && factionById(requested) && <FactionBadge factionId={requested} />}
              <Text style={font.h1}>{t('onboarding.profileTitle')}</Text>
            </View>
            <Field
              label={t('onboarding.username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              placeholder="Foulée_64"
            />
            <Text style={[font.small, { marginTop: -space.sm }]}>{t('onboarding.usernameHint')}</Text>
            {!local && (
              <>
                <Field
                  label={t('onboarding.birthYear')}
                  value={birthYear}
                  onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  placeholder="1990"
                />
                {tooYoung && <ErrorText>{t('onboarding.tooYoung')}</ErrorText>}
              </>
            )}

            <SectionTitle title={t('onboarding.avatarTitle')} color={palette.main} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <HexAvatar id={avatar} faction={requested} size={92} ring={palette.main} glow />
              <Text style={[font.small, { flex: 1 }]}>{t('onboarding.avatarHint')}</Text>
            </View>

            <SectionTitle title={t('onboarding.zoneTitle')} color={palette.main} />
            <Text style={font.small}>{local ? t('onboarding.zoneHelpLocal') : t('onboarding.zoneHelp')}</Text>
            <Button
              title={position ? t('onboarding.zoneDetected') : t('onboarding.detectZone')}
              variant={position ? 'secondary' : 'primary'}
              icon={position ? 'checkmark-circle' : 'locate'}
              palette={palette}
              loading={busy === 'locate'}
              onPress={() => void locate()}
            />

            <View style={{ gap: space.md, marginTop: space.sm }}>
              {local ? (
                <Checkbox checked={terms} onChange={setTerms} label={t('onboarding.consentLocal')} palette={palette} />
              ) : (
                <>
                  <Checkbox checked={gps} onChange={setGps} label={t('onboarding.consentGps')} palette={palette} />
                  <Checkbox checked={terms} onChange={setTerms} label={t('onboarding.consentTerms')} palette={palette} />
                </>
              )}
              <Text style={[font.small, { color: palette.main }]}>
                <Text onPress={() => router.push('/legal/terms')}>{t('legal.terms')}</Text>
                <Text style={{ color: colors.textMute }}> · </Text>
                <Text onPress={() => router.push('/legal/privacy')}>{t('legal.privacy')}</Text>
              </Text>
            </View>

            <ErrorText>{error}</ErrorText>
            <Button title={t('onboarding.start')} size="lg" icon="flash" palette={palette} loading={busy === 'submit'} disabled={!ready} onPress={() => void submit()} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    </View>
  );
}
