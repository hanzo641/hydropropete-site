import { formatDuration, levelFromXp, streakBonus, TROPHIES } from '@conquete/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ensureNotificationPermission } from '@/features/notify';
import { rejectionText } from '@/features/run/rejection';
import * as session from '@/features/run/session';
import { getRun as getLocalRun } from '@/features/run/storage';
import { type SubmitRunResponse, uploadRun } from '@/features/run/upload';
import { refreshWar } from '@/features/war/report';
import { dict, formatNumber, getLocale, t } from '@/i18n';
import { getRun } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentConfig } from '@/lib/gameConfig';
import { kv } from '@/lib/kv';
import { Button, Card, Chip, Glass, Screen, usePalette } from '@/ui/components';
import { TroopHarvest } from '@/features/rewards/TroopHarvest';
import { FadeIn, ProgressBar, StreakBadge } from '@/ui/game';
import { Burst } from '@/ui/fx';
import { showLevelUp } from '@/features/levelup/LevelUp';
import { colors, font, fonts, space } from '@/ui/theme';

export default function Summary() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const { profile, refreshProfile } = useAuth();
  const p = usePalette();
  const levelBefore = useRef(profile?.level ?? 1);
  const [state, setState] = useState<'uploading' | 'queued' | 'done'>('uploading');
  const [res, setRes] = useState<SubmitRunResponse | null>(null);
  const [harvested, setHarvested] = useState(false);
  const [levelFx, setLevelFx] = useState(0);

  useEffect(() => {
    session.reset();
    void (async () => {
      const local = getLocalRun(localId);
      try {
        if (local?.upload_status === 'done' && local.server_run_id) {
          setRes({ run: await getRun(local.server_run_id), trophies: [], duplicate: true });
        } else {
          const r = await uploadRun(localId);
          setRes(r);
          if (r.run.status === 'validated') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setState('done');
        const fresh = await refreshProfile();
        if (fresh) void refreshWar(fresh);
        // première série : on propose les rappels (une seule fois)
        if (fresh && fresh.streak_days >= 1 && !kv.getItem('cr:pref:notifAsked')) {
          kv.setItem('cr:pref:notifAsked', '1');
          setTimeout(() => void ensureNotificationPermission(true), 2500);
        }
      } catch {
        setState('queued');
      }
    })();
    // une seule fois par course
  }, [localId]);

  const run = res?.run;
  const won = res?.trophies ?? [];
  const streakDays = profile?.streak_days ?? 0;
  const bonusPct = Math.round(streakBonus(streakDays, currentConfig().streak) * 100);
  const lvl = levelFromXp(profile?.xp ?? 0);
  const leveledUp = (profile?.level ?? 1) > levelBefore.current;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.xl }}>
        {state === 'uploading' && (
          <View style={{ alignItems: 'center', gap: space.lg, paddingTop: 120 }}>
            <ActivityIndicator color={p.main} size="large" />
            <Text style={font.h2}>{t('summary.uploading')}</Text>
          </View>
        )}
        {state === 'queued' && (
          <Card>
            <Text style={font.h2}>{t('summary.title')}</Text>
            <Text style={font.body}>{t('summary.queued')}</Text>
            <Text style={font.small}>{t('common.offline')}</Text>
          </Card>
        )}
        {run && run.status === 'rejected' && (
          <FadeIn>
            <Card glow={colors.danger}>
              <Text style={[font.h1, { color: colors.danger }]}>{t('summary.rejected')}</Text>
              <Text style={font.body}>{rejectionText(run)}</Text>
            </Card>
          </FadeIn>
        )}
        {run && run.status === 'validated' && (
          <>
            <FadeIn>
              <Text style={[font.label, { color: colors.success }]}>✓ {t('summary.title')}</Text>
              <Text style={font.hero}>{t('summary.validated')}</Text>
            </FadeIn>
            <FadeIn delay={120}>
              <Glass glow={p.main} style={{ padding: space.xl, alignItems: 'center', borderRadius: 28 }}>
                <TroopHarvest
                  total={run.troops_earned}
                  bonus={run.bonus_troops ?? 0}
                  palette={p}
                  onDone={() => {
                    setHarvested(true);
                    if (leveledUp) {
                      setTimeout(() => {
                        setLevelFx(Date.now());
                        showLevelUp(profile?.level ?? 1);
                      }, 700);
                    }
                  }}
                />
                {harvested && (
                  <FadeIn from={8}>
                    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Chip text={t('summary.xpEarned', { n: run.xp_earned })} icon="star" color={colors.gold} filled />
                    </View>
                  </FadeIn>
                )}
              </Glass>
            </FadeIn>
            <FadeIn delay={240}>
              <Glass style={{ padding: space.lg, borderRadius: 22, flexDirection: 'row' }}>
                {[
                  { v: formatNumber((run.distance_m ?? 0) / 1000, 2), u: 'km', l: t('run.distance') },
                  { v: formatDuration((run.duration_s ?? 0) * 1000), u: '', l: t('run.time') },
                  { v: formatNumber(run.dplus_m ?? 0), u: 'm', l: t('run.dplus') },
                  { v: String(run.cells.length), u: '⬡', l: t('run.cellsLit') },
                ].map((x) => (
                  <View key={x.l} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>
                      {x.v}
                      {x.u ? <Text style={{ fontFamily: fonts.label, fontSize: 13, color: colors.textDim }}> {x.u}</Text> : null}
                    </Text>
                    <Text style={[font.label, { fontSize: 10 }]}>{x.l}</Text>
                  </View>
                ))}
              </Glass>
              <Text style={[font.small, { marginTop: 6, textAlign: 'center' }]}>
                D+ : {dict().summary.dplusSource[(run.dplus_source ?? 'gps') as keyof ReturnType<typeof dict>['summary']['dplusSource']] ?? run.dplus_source}
                {run.counted_km * 1000 < (run.distance_m ?? 0) - 1 ? ` · ${t('summary.capped')}` : ''}
              </Text>
            </FadeIn>
            <FadeIn delay={360}>
              <Glass style={{ padding: space.lg, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <StreakBadge days={streakDays} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>{t('summary.streak', { n: streakDays })}</Text>
                  <Text style={font.small}>{bonusPct > 0 ? t('summary.streakBonus', { p: bonusPct }) : t('summary.streakStart')}</Text>
                </View>
              </Glass>
            </FadeIn>
            <FadeIn delay={480}>
              <Glass glow={levelFx ? colors.gold : undefined} style={{ padding: space.lg, borderRadius: 22, gap: space.sm, overflow: 'visible' }}>
                <Burst fire={levelFx} color={colors.gold} count={16} radius={120} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={[font.h3, leveledUp && { color: colors.gold }]}>
                    {leveledUp ? t('summary.levelUp', { n: lvl.level }) : t('profile.level', { n: lvl.level })}
                  </Text>
                  <Text style={font.small}>{t('profile.xp', { cur: lvl.currentXp, next: lvl.nextXp })}</Text>
                </View>
                <ProgressBar value={lvl.currentXp / lvl.nextXp} gradient={['#FFD86B', '#F59E0B']} height={10} />
              </Glass>
            </FadeIn>
            {won.length > 0 && (
              <FadeIn delay={600}>
                <Text style={[font.h2, { marginBottom: space.sm }]}>{t('summary.trophies')}</Text>
                <View style={{ gap: space.sm }}>
                  {won.map((id) => {
                    const tr = TROPHIES.find((x) => x.id === id);
                    return tr ? (
                      <Glass key={id} glow={colors.gold} style={{ padding: space.md, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                        <Text style={{ fontSize: 34 }}>{tr.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[font.h3, { color: colors.gold }]}>{tr.name[getLocale()]}</Text>
                          <Text style={font.small}>{tr.description[getLocale()]}</Text>
                        </View>
                      </Glass>
                    ) : null;
                  })}
                </View>
              </FadeIn>
            )}
            {run.season_id == null && <Text style={font.small}>{t('summary.noSeason')}</Text>}
            <FadeIn delay={700} style={{ gap: space.md }}>
              {run.troops_remaining > 0 && <Button title={t('summary.deploy')} size="lg" icon="flag" onPress={() => router.replace(`/deploy/${run.id}`)} />}
              <Button title={run.troops_remaining > 0 ? t('summary.later') : t('common.close')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
            </FadeIn>
          </>
        )}
        {(state === 'queued' || run?.status === 'rejected') && <Button title={t('common.close')} variant="ghost" onPress={() => router.replace('/(tabs)')} />}
      </ScrollView>
    </Screen>
  );
}
