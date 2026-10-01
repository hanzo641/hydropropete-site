import { cellCenter, factionById, type LatLng } from '@conquete/core';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GAME_MODE } from '@/backend';
import { useWar } from '@/features/war/useWar';
import { getLocale, t, timeAgo, whereIs } from '@/i18n';
import { type FeedEvent, teamOverview, type TeamOverview, zoneFeed, zoneLeaderboard, type ZoneLeaderboardRow } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Chip, Glass, Screen, SectionTitle, usePalette } from '@/ui/components';
import { Emblem, FactionBadge, FadeIn, HexAvatar, WarBar } from '@/ui/game';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { colors, font, fonts, paletteOf, space } from '@/ui/theme';

function feedText(e: FeedEvent): string {
  const faction = factionById(e.faction_id)?.name[getLocale()] ?? '?';
  const n = Number(e.payload.count ?? 1);
  switch (e.kind) {
    case 'capture':
      if (!e.actor_name) return t('war.feedCaptureAnon', { faction });
      return n > 1 ? t('war.feedCaptureMany', { actor: e.actor_name, n }) : t('war.feedCapture', { actor: e.actor_name });
    case 'region_gained':
      return t('war.feedRegionGained', { faction });
    case 'region_lost':
      return t('war.feedRegionLost', { faction });
    case 'defense':
      return t('war.feedDefense', { actor: e.actor_name ?? faction, n });
    case 'season_end':
      return e.payload.welcome ? t('war.feedWelcome', { faction }) : t('war.feedSeasonEnd', { faction });
    default:
      return '';
  }
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function War() {
  const { profile } = useAuth();
  const p = usePalette();
  const w = useWar();
  const zone = profile?.home_zone ?? '';
  const [squad, setSquad] = useState<TeamOverview | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [board, setBoard] = useState<ZoneLeaderboardRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [here, setHere] = useState<LatLng | null>(null);

  const load = useCallback(async () => {
    if (!zone) return;
    setRefreshing(true);
    const [o, f, b] = await Promise.allSettled([teamOverview(zone), zoneFeed(zone, 40), zoneLeaderboard(zone), w.reload()]);
    if (o.status === 'fulfilled') setSquad(o.value);
    if (f.status === 'fulfilled') setFeed(f.value);
    if (b.status === 'fulfilled') setBoard(b.value);
    setRefreshing(false);
    // w.reload est stable pour une zone donnée
  }, [zone]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void Location.getLastKnownPositionAsync()
        .then((pos) => pos && setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        .catch(() => undefined);
    }, [load]),
  );

  const mine = w.war?.factions.find((f) => f.faction_id === w.myFaction);
  const theirs = w.war?.factions.find((f) => f.faction_id === w.enemyFaction);
  const pe = paletteOf(w.enemyFaction);
  const frontLabel = w.war?.front && here ? whereIs(here, cellCenter(w.war.front)) : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: space.lg, paddingTop: space.lg, paddingBottom: TAB_BAR_SPACE + space.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={p.main} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={font.h1}>{t('war.title')}</Text>
          <FactionBadge factionId={profile?.faction_id} />
        </View>
        {GAME_MODE === 'local' && <Text style={[font.small, { marginTop: -space.sm }]}>{t('war.soloNote')}</Text>}

        {/* la guerre éternelle */}
        {w.myFaction && w.enemyFaction ? (
          <FadeIn>
            <Glass style={{ borderRadius: 28, padding: 0 }}>
              <LinearGradient
                colors={[`${paletteOf(w.myFaction).main}40`, 'transparent', `${pe.main}40`]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ padding: space.lg, gap: space.md }}>
                <Text style={[font.label, { textAlign: 'center', color: colors.gold }]}>{t('war.eternal')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {[w.myFaction, w.enemyFaction].map((fid, i) => {
                    const row = i === 0 ? mine : theirs;
                    return (
                      <View key={fid} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                        <Emblem factionId={fid} size={46} />
                        <Text style={{ fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: paletteOf(fid).main }}>{row?.victories ?? 0}</Text>
                        <Text style={[font.label, { fontSize: 11 }]}>{t('war.victories')}</Text>
                      </View>
                    );
                  })}
                  <Text style={{ position: 'absolute', alignSelf: 'center', left: 0, right: 0, textAlign: 'center', fontFamily: fonts.display, fontSize: 26, color: colors.textMute }}>
                    {t('common.vs')}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={[font.small, { textAlign: 'center' }]}>
                    {w.war?.season ? t('war.season', { name: w.war.season.name, n: w.seasonDaysLeft ?? 0 }) : ''}
                  </Text>
                  <WarBar left={{ factionId: w.myFaction, value: mine?.territory_days ?? 0 }} right={{ factionId: w.enemyFaction, value: theirs?.territory_days ?? 0 }} />
                  <Text style={[font.small, { textAlign: 'center', fontSize: 12 }]}>{t('war.seasonScore')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Chip text={t('war.holding', { n: mine?.hexes_zone ?? 0 })} color={paletteOf(w.myFaction).main} filled />
                  <Chip text={t('war.holding', { n: theirs?.hexes_zone ?? 0 })} color={pe.main} filled />
                </View>
              </View>
            </Glass>
          </FadeIn>
        ) : null}

        {/* front du jour */}
        <FadeIn delay={100}>
          <Glass glow={w.war?.front ? colors.gold : undefined} style={{ padding: space.lg, borderRadius: 22, flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Text style={{ fontSize: 34 }}>⚔️</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.h2, { fontSize: 19, color: colors.gold }]}>
                {t('war.frontTitle')}
                {frontLabel ? <Text style={{ color: colors.textDim, fontSize: 15 }}>{`  ·  ${frontLabel}`}</Text> : null}
              </Text>
              <Text style={font.small}>{w.war?.front ? t('war.frontBody') : t('war.frontNone')}</Text>
            </View>
          </Glass>
        </FadeIn>

        {/* le rival */}
        <FadeIn delay={180}>
          <Glass glow={w.rival ? pe.main : undefined} style={{ padding: space.lg, borderRadius: 22, flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            {w.rival ? <HexAvatar id={w.rival.avatar_id} faction={w.rival.faction_id} size={58} ring={pe.main} glow /> : <Text style={{ fontSize: 40 }}>😈</Text>}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.label, { color: pe.main }]}>{t('war.nemesisTitle')}</Text>
              {w.rival ? (
                <>
                  <Text style={[font.h2, { fontSize: 22 }]}>{w.rival.username}</Text>
                  <Text style={font.small}>{t('war.nemesisBody', { name: w.rival.username, n: w.rival.taken })}</Text>
                </>
              ) : (
                <Text style={font.small}>{t('war.nemesisNone')}</Text>
              )}
            </View>
          </Glass>
        </FadeIn>

        {/* l'escouade */}
        {squad && (
          <FadeIn delay={240}>
            <Glass style={{ padding: space.lg, borderRadius: 22, gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[font.h2, { flex: 1, fontSize: 19 }]}>{t('war.squad')}</Text>
                <Text style={font.small}>{t('war.squadStats', { hexes: squad.hexes, regions: squad.regions })}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {squad.members.slice(0, 12).map((m) => (
                  <View key={m.id} style={{ alignItems: 'center', width: 58, gap: 2 }}>
                    <HexAvatar id={m.avatar_id} faction={profile?.faction_id} size={46} ring={m.username === profile?.username ? p.main : 'rgba(255,255,255,0.2)'} />
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10.5, color: colors.textDim }} numberOfLines={1}>
                      {m.username}
                    </Text>
                  </View>
                ))}
              </View>
            </Glass>
          </FadeIn>
        )}

        <SectionTitle title={t('war.feed')} />
        <Glass style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 22 }}>
          {feed.length === 0 && <Text style={[font.small, { paddingVertical: space.md }]}>{t('war.empty')}</Text>}
          {feed.slice(0, 25).map((e, i) => {
            const c = factionById(e.faction_id)?.color ?? colors.wild;
            return (
              <View key={e.id} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <View style={{ width: 26, alignItems: 'center', paddingTop: 2 }}>
                  <Emblem factionId={e.faction_id} size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { fontSize: 14 }, e.kind === 'region_gained' || e.kind === 'season_end' ? { color: c, fontFamily: fonts.bodyBold } : null]}>{feedText(e)}</Text>
                  <Text style={[font.small, { fontSize: 11.5 }]}>{timeAgo(e.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </Glass>

        <SectionTitle title={t('war.ranking')} />
        <Glass style={{ paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: 22 }}>
          {board.length === 0 && <Text style={[font.small, { padding: space.md }]}>{t('war.empty')}</Text>}
          {board.map((r, i) => {
            const me = r.username === profile?.username;
            const fc = paletteOf(r.faction_id).main;
            return (
              <View
                key={r.user_id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingVertical: 9,
                  paddingHorizontal: space.sm,
                  borderRadius: 14,
                  backgroundColor: me ? `${p.main}22` : 'transparent',
                  borderTopWidth: i === 0 || me ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                }}>
                <Text style={{ width: 30, textAlign: 'center', fontFamily: fonts.display, fontSize: r.rank <= 3 ? 20 : 18, color: colors.textDim }}>
                  {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                </Text>
                <HexAvatar id={r.avatar_id} faction={r.faction_id} size={38} ring={fc} ringWidth={2} />
                <View style={{ flex: 1 }}>
                  <Text style={[font.bodyBold, me && { color: p.main }]} numberOfLines={1}>
                    {r.username}
                    {me ? <Text style={{ color: colors.textDim, fontFamily: fonts.body }}> · {t('war.you')}</Text> : null}
                  </Text>
                  <Text style={[font.small, { fontSize: 11.5 }]}>{t('common.territories', { n: r.captures })}</Text>
                </View>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.text }}>{r.points}</Text>
              </View>
            );
          })}
        </Glass>
      </ScrollView>
    </Screen>
  );
}
