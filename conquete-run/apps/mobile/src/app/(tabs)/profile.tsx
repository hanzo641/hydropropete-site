import { isoWeek, levelFromXp, TROPHIES, weeklyChallenges } from '@conquete/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from 'react-native';
import { GAME_MODE } from '@/backend';
import { ensureNotificationPermission, remindersEnabled, setRemindersEnabled } from '@/features/notify';
import { play, setSoundEnabled, soundEnabled } from '@/features/sfx';
import { wipeLocalData } from '@/features/run/storage';
import { refreshWar } from '@/features/war/report';
import { useWar } from '@/features/war/useWar';
import { formatNumber, getLocale, setLocale, t, type TKey, useLocale } from '@/i18n';
import { deleteAccount, myTrophies, setLocaleRemote, weeklyProgress } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Glass, ListItem, Screen, SectionTitle, usePalette } from '@/ui/components';
import { FactionBadge, FadeIn, ProgressBar, RankBadge, StreakBadge } from '@/ui/game';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { colors, font, fonts, space } from '@/ui/theme';

function Tile({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <Glass style={{ flexBasis: '31%', flexGrow: 1, padding: space.md, borderRadius: 18, alignItems: 'flex-start', gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 28, color: color ?? colors.text }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={{ fontFamily: fonts.label, fontSize: 13, color: colors.textDim }}> {unit}</Text> : null}
      </Text>
      <Text style={[font.label, { fontSize: 10.5 }]} numberOfLines={1}>
        {label}
      </Text>
    </Glass>
  );
}

export default function ProfileScreen() {
  useLocale();
  const { profile, refreshProfile, signOut } = useAuth();
  const p = usePalette();
  const w = useWar();
  const [trophies, setTrophies] = useState<string[]>([]);
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof weeklyProgress>> | null>(null);
  const [reminders, setReminders] = useState(remindersEnabled());
  const [sound, setSound] = useState(soundEnabled());
  const { width } = useWindowDimensions();
  const trophySize = Math.floor((Math.min(width, 520) - space.lg * 2 - space.sm * 3) / 4);

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
    await setLocaleRemote(next).catch(() => undefined);
  };

  const toggleReminders = async (on: boolean) => {
    if (on && !(await ensureNotificationPermission(true))) return;
    setRemindersEnabled(on);
    setReminders(on);
    void refreshWar(profile);
  };

  const restartLocal = () =>
    Alert.alert(t('profile.resetLocal'), t('profile.resetLocalConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.resetLocal'),
        style: 'destructive',
        onPress: () =>
          void (async () => {
            await deleteAccount();
            wipeLocalData();
            await signOut();
            router.replace('/onboarding');
          })(),
      },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingTop: space.lg, paddingBottom: TAB_BAR_SPACE + space.xl }}>
        <FadeIn>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('profile.avatar')} onPress={() => router.push('/avatar')}>
              <RankBadge level={profile.level} avatarId={profile.avatar_id} size={96} />
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={font.h1} numberOfLines={1} adjustsFontSizeToFit>
                {profile.username}
              </Text>
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <FactionBadge factionId={profile.faction_id} />
                <StreakBadge days={w.streak} atRisk={w.streakRisk} size="sm" />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={[font.h3, { color: colors.gold }]}>{t('profile.level', { n: lvl.level })}</Text>
                <Text style={[font.small, { fontSize: 12 }]}>{t('profile.xp', { cur: lvl.currentXp, next: lvl.nextXp })}</Text>
              </View>
              <ProgressBar value={lvl.currentXp / lvl.nextXp} gradient={['#FFD86B', '#F59E0B']} />
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={80}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Tile label={t('profile.runs')} value={String(profile.runs_count)} />
            <Tile label={t('profile.totalKm')} value={formatNumber(Number(profile.total_km), 1)} unit="km" />
            <Tile label={t('profile.totalDplus')} value={formatNumber(Number(profile.total_dplus_m))} unit="m" />
            <Tile label={t('profile.captures')} value={String(profile.captures_count)} color={p.main} />
            <Tile label={t('profile.streak')} value={`${w.streak}`} unit="🔥" />
            <Tile label={t('profile.explored')} value={String(profile.distinct_cells)} unit="⬡" />
          </View>
        </FadeIn>

        <SectionTitle title={t('profile.challenges')} />
        <Glass style={{ padding: space.lg, borderRadius: 22, gap: space.md }}>
          {challenges.map((c) => {
            const done = progress ? Number(progress[c.kind]) : 0;
            const ok = done >= c.target;
            return (
              <View key={c.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[font.bodyBold, ok && { color: colors.success }]}>
                    {ok ? '✓ ' : ''}
                    {t(`profile.challenge.${c.kind}` as TKey, { n: c.target })}
                  </Text>
                  <Text style={{ fontFamily: fonts.label, color: colors.gold, fontSize: 14 }}>+{c.xp} XP</Text>
                </View>
                <ProgressBar value={done / c.target} gradient={ok ? [colors.success, '#16A34A'] : p.gradient} />
              </View>
            );
          })}
        </Glass>

        <SectionTitle
          title={t('profile.trophies')}
          right={
            <Text style={font.small}>
              {trophies.length}/{TROPHIES.length}
            </Text>
          }
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {TROPHIES.map((tr) => {
            const got = trophies.includes(tr.id);
            return (
              <Pressable
                key={tr.id}
                accessibilityLabel={`${tr.name[getLocale()]} — ${tr.description[getLocale()]}`}
                onPress={() => Alert.alert(`${tr.icon} ${tr.name[getLocale()]}`, tr.description[getLocale()])}
                style={{ width: trophySize }}>
                <Glass glow={got ? colors.gold : undefined} style={{ height: trophySize, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 30, opacity: got ? 1 : 0.18 }}>{tr.icon}</Text>
                  {!got && <Text style={{ position: 'absolute', bottom: 6, fontSize: 11 }}>🔒</Text>}
                </Glass>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title={t('profile.settings')} />
        <Glass style={{ paddingHorizontal: space.lg, borderRadius: 22 }}>
          <ListItem icon="happy-outline" title={t('profile.avatar')} onPress={() => router.push('/avatar')} />
          <ListItem
            icon="notifications-outline"
            title={t('profile.reminders')}
            subtitle={reminders ? t('profile.remindersOn') : t('profile.remindersOff')}
            right={<Switch value={reminders} onValueChange={(v) => void toggleReminders(v)} trackColor={{ true: p.main, false: colors.surfaceHigh }} thumbColor="#FFFFFF" />}
          />
          <ListItem
            icon="volume-high-outline"
            title={t('profile.sound')}
            subtitle={sound ? t('profile.remindersOn') : t('profile.remindersOff')}
            right={
              <Switch
                value={sound}
                onValueChange={(v) => {
                  setSoundEnabled(v);
                  setSound(v);
                  if (v) play('capture');
                }}
                trackColor={{ true: p.main, false: colors.surfaceHigh }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <ListItem icon="language-outline" title={t('profile.language')} subtitle={getLocale() === 'fr' ? 'Français' : 'English'} onPress={() => void toggleLanguage()} />
          <ListItem icon="play-circle-outline" title={t('profile.simulation')} onPress={() => router.push('/simulation')} />
          <ListItem icon="shield-checkmark-outline" title={t('profile.privacy')} onPress={() => router.push('/privacy')} />
          <ListItem icon="document-text-outline" title={t('profile.legal')} onPress={() => router.push('/legal/notice')} />
          {GAME_MODE === 'local' ? (
            <ListItem icon="refresh-outline" title={t('profile.resetLocal')} danger onPress={restartLocal} />
          ) : (
            <ListItem
              icon="log-out-outline"
              title={t('profile.signOut')}
              danger
              onPress={() =>
                void (async () => {
                  wipeLocalData();
                  await signOut();
                  router.replace('/sign-in');
                })()
              }
            />
          )}
        </Glass>
      </ScrollView>
    </Screen>
  );
}
