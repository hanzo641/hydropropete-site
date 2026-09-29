import { isoWeek, levelFromXp, TROPHIES, weeklyChallenges } from '@conquete/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { wipeLocalData } from '@/features/run/storage';
import { formatNumber, getLocale, setLocale, t, type TKey, useLocale } from '@/i18n';
import { myTrophies, weeklyProgress } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Card, ListItem, Row, Screen, Stat } from '@/ui/components';
import { FactionBadge, ProgressBar, RankBadge } from '@/ui/game';
import { colors, font, space } from '@/ui/theme';

export default function ProfileScreen() {
  useLocale();
  const { profile, refreshProfile, signOut } = useAuth();
  const [trophies, setTrophies] = useState<string[]>([]);
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof weeklyProgress>> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      void myTrophies().then(setTrophies).catch(() => undefined);
      void weeklyProgress().then(setProgress).catch(() => undefined);
    }, [refreshProfile]),
  );

  if (!profile) return <Screen />;
  const lvl = levelFromXp(profile.xp);
  const challenges = weeklyChallenges(profile.id, isoWeek(Date.now()), profile.level);

  const toggleLanguage = async () => {
    const next = getLocale() === 'fr' ? 'en' : 'fr';
    setLocale(next);
    await supabase.from('profiles').update({ locale: next, updated_at: new Date().toISOString() }).eq('id', profile.id);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}>
        <Row>
          <RankBadge level={profile.level} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={font.h1}>{profile.username}</Text>
            <FactionBadge factionId={profile.faction_id} />
            <Text style={font.h3}>{t('profile.level', { n: lvl.level })}</Text>
            <ProgressBar value={lvl.currentXp / lvl.nextXp} />
            <Text style={font.small}>{t('profile.xp', { cur: lvl.currentXp, next: lvl.nextXp })}</Text>
          </View>
        </Row>

        <Card>
          <Text style={font.h3}>{t('profile.stats')}</Text>
          <Row>
            <Stat label={t('profile.runs')} value={String(profile.runs_count)} />
            <Stat label={t('profile.totalKm')} value={formatNumber(Number(profile.total_km), 1)} unit="km" />
          </Row>
          <Row>
            <Stat label={t('profile.totalDplus')} value={formatNumber(Number(profile.total_dplus_m))} unit="m" />
            <Stat label={t('profile.captures')} value={String(profile.captures_count)} />
          </Row>
        </Card>

        <Card>
          <Text style={font.h3}>{t('profile.challenges')}</Text>
          {challenges.map((c) => {
            const done = progress ? Number(progress[c.kind]) : 0;
            return (
              <View key={c.id} style={{ gap: space.xs, marginTop: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={font.body}>{t(`profile.challenge.${c.kind}` as TKey, { n: c.target })}</Text>
                  <Text style={font.small}>+{c.xp} XP</Text>
                </Row>
                <ProgressBar value={done / c.target} color={done >= c.target ? colors.success : colors.accent} />
              </View>
            );
          })}
        </Card>

        <Card>
          <Text style={font.h3}>
            {t('profile.trophies')} ({trophies.length}/{TROPHIES.length})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {TROPHIES.map((tr) => {
              const got = trophies.includes(tr.id);
              return (
                <Text
                  key={tr.id}
                  accessibilityLabel={`${tr.name[getLocale()]} — ${tr.description[getLocale()]}`}
                  onPress={() => Alert.alert(`${tr.icon} ${tr.name[getLocale()]}`, tr.description[getLocale()])}
                  style={{ fontSize: 30, opacity: got ? 1 : 0.2 }}>
                  {tr.icon}
                </Text>
              );
            })}
          </View>
        </Card>

        <Card>
          <ListItem icon="time-outline" title={t('profile.history')} onPress={() => router.push('/runs')} />
          <ListItem icon="shield-checkmark-outline" title={t('profile.privacy')} onPress={() => router.push('/privacy')} />
          <ListItem icon="play-circle-outline" title={t('profile.simulation')} onPress={() => router.push('/simulation')} />
          <ListItem icon="language-outline" title={t('profile.language')} subtitle={getLocale() === 'fr' ? 'Français' : 'English'} onPress={() => void toggleLanguage()} />
          <ListItem icon="document-text-outline" title={t('profile.legal')} onPress={() => router.push('/legal/notice')} />
          <ListItem
            icon="log-out-outline"
            title={t('profile.signOut')}
            onPress={() =>
              void (async () => {
                wipeLocalData();
                await signOut();
                router.replace('/sign-in');
              })()
            }
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
