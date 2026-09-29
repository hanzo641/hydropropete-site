import { activeFactions, assignFaction, zoneAt } from '@conquete/core';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getLocale, t, type TKey } from '@/i18n';
import { completeOnboarding, setAvatar, zoneFactionCounts } from '@/lib/api';
import { AvatarPicker } from '@/features/avatar/AvatarPicker';
import { useAuth } from '@/lib/auth';
import { currentConfig, loadGameConfig } from '@/lib/gameConfig';
import { TERMS_VERSION } from '@/legal/texts';
import { Button, Checkbox, ErrorText, Field, Screen } from '@/ui/components';
import { colors, font, radius, space } from '@/ui/theme';

export default function OnboardingProfile() {
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [zone, setZone] = useState<string | null>(null);
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [faction, setFaction] = useState<number | null>(null);
  const [avatar, setAvatarId] = useState('renard');
  const [gps, setGps] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGameConfig();
  }, []);

  const cfg = currentConfig();
  const locked = zone ? assignFaction(counts, null, cfg.factions).locked : [];
  const year = Number(birthYear);
  const tooYoung = birthYear.length === 4 && new Date().getFullYear() - year < 15;
  const validName = /^[A-Za-z0-9_.À-ÖØ-öø-ÿ-]{3,20}$/.test(username);

  const detectZone = async () => {
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      setError(t('run.permissionDenied'));
      return;
    }
    // précision réduite volontairement : seule la zone (~40 km) est utile
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const z = zoneAt({ lat: pos.coords.latitude, lng: pos.coords.longitude }, cfg.h3);
    setZone(z);
    try {
      setCounts(await zoneFactionCounts(z));
    } catch {
      setCounts(new Map());
    }
  };

  const submit = async () => {
    if (!zone) return;
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding({
        username,
        faction,
        zone,
        birthYear: year,
        locale: getLocale(),
        gpsConsent: gps,
        termsVersion: TERMS_VERSION,
      });
      await setAvatar(avatar);
      await refreshProfile();
      router.replace('/(tabs)');
    } catch (e) {
      const code = (e as { code?: string; message: string }).code === '23505' ? 'username_taken' : (e as Error).message;
      const key = `onboarding.errors.${code}` as TKey;
      const msg = t(key);
      setError(msg === key ? t('common.error') : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.xl }}>
        <Text style={font.h1}>{t('onboarding.profileTitle')}</Text>
        <Field label={t('onboarding.username')} value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={20} />
        <Field
          label={t('onboarding.birthYear')}
          value={birthYear}
          onChangeText={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="1990"
        />
        {tooYoung && <ErrorText>{t('onboarding.tooYoung')}</ErrorText>}

        <Text style={font.h2}>{t('avatar.title')}</Text>
        <AvatarPicker value={avatar} level={1} onChange={setAvatarId} />

        <Text style={font.h2}>{t('onboarding.zoneTitle')}</Text>
        <Text style={font.small}>{t('onboarding.zoneHelp')}</Text>
        <Button
          title={zone ? t('onboarding.zoneDetected') : t('onboarding.detectZone')}
          variant={zone ? 'secondary' : 'primary'}
          icon="locate-outline"
          onPress={() => void detectZone()}
        />

        <Text style={font.h2}>{t('onboarding.factionTitle')}</Text>
        <View style={{ gap: space.sm }}>
          {activeFactions(cfg.factions).map((f) => {
            const isLocked = locked.includes(f.id);
            const selected = faction === f.id;
            return (
              <Pressable
                key={f.id}
                disabled={isLocked}
                onPress={() => setFaction(f.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: selected ? f.color : colors.border,
                  backgroundColor: colors.surface,
                  opacity: isLocked ? 0.4 : 1,
                }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: f.color }} />
                <Text style={[font.h3, { flex: 1 }]}>{f.name[getLocale()]}</Text>
                <Text style={font.small}>{isLocked ? t('onboarding.factionLocked') : zone ? `${counts.get(f.id) ?? 0}` : ''}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setFaction(null)}
            style={{ padding: space.md, borderRadius: radius.md, borderWidth: 2, borderColor: faction == null ? colors.accent : colors.border }}>
            <Text style={font.body}>{t('onboarding.factionAuto')}</Text>
          </Pressable>
        </View>

        <Checkbox checked={gps} onChange={setGps} label={t('onboarding.consentGps')} />
        <Checkbox checked={terms} onChange={setTerms} label={t('onboarding.consentTerms')} />
        <Text style={[font.small, { color: colors.accent }]} onPress={() => router.push('/legal/privacy')}>
          {t('legal.privacy')} · <Text onPress={() => router.push('/legal/terms')}>{t('legal.terms')}</Text>
        </Text>

        <ErrorText>{error}</ErrorText>
        <Button
          title={t('onboarding.start')}
          loading={busy}
          disabled={!validName || birthYear.length !== 4 || tooYoung || !zone || !gps || !terms}
          onPress={() => void submit()}
        />
      </ScrollView>
    </Screen>
  );
}
