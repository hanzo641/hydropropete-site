import { factionById } from '@conquete/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatDate, getLocale, t } from '@/i18n';
import {
  type FactionScoreRow,
  type FeedEvent,
  teamOverview,
  zoneFactionScores,
  zoneFeed,
  zoneLeaderboard,
  type ZoneLeaderboardRow,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Card, ListItem, Row, Screen, Stat } from '@/ui/components';
import { Avatar, FactionBadge } from '@/ui/game';
import { colors, font, space } from '@/ui/theme';

function feedText(e: FeedEvent): string {
  const faction = factionById(e.faction_id)?.name[getLocale()] ?? '?';
  const n = Number(e.payload.count ?? 1);
  switch (e.kind) {
    case 'capture':
      if (!e.actor_name) return t('team.feedCaptureAnon', { faction });
      return n > 1 ? t('team.feedCaptureMany', { actor: e.actor_name, n }) : t('team.feedCapture', { actor: e.actor_name });
    case 'region_gained':
      return t('team.feedRegionGained', { faction });
    case 'region_lost':
      return t('team.feedRegionLost', { faction });
    case 'defense':
      return t('team.feedDefense', { actor: e.actor_name ?? faction, n });
    default:
      return '';
  }
}

export default function Team() {
  const { profile } = useAuth();
  const zone = profile?.home_zone ?? '';
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof teamOverview>> | null>(null);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [board, setBoard] = useState<ZoneLeaderboardRow[]>([]);
  const [world, setWorld] = useState<FactionScoreRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!zone) return;
    setRefreshing(true);
    const [o, f, b, w] = await Promise.allSettled([teamOverview(zone), zoneFeed(zone), zoneLeaderboard(zone), zoneFactionScores(null)]);
    if (o.status === 'fulfilled') setOverview(o.value);
    if (f.status === 'fulfilled') setFeed(f.value);
    if (b.status === 'fulfilled') setBoard(b.value);
    if (w.status === 'fulfilled') setWorld(w.value);
    setRefreshing(false);
  }, [zone]);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Fil en direct
      const channel = supabase
        .channel(`feed-${zone}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `zone=eq.${zone}` }, (p) =>
          setFeed((prev) => [p.new as FeedEvent, ...prev].slice(0, 50)),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [load, zone]),
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={colors.accent} />}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={font.h1}>{t('team.title')}</Text>
          <FactionBadge factionId={profile?.faction_id} />
        </Row>
        <Card>
          <Row>
            <Stat label={t('team.territories')} value={String(overview?.hexes ?? 0)} />
            <Stat label={t('team.regions')} value={String(overview?.regions ?? 0)} />
            <Stat label={t('team.members')} value={String(overview?.members.length ?? 0)} />
          </Row>
        </Card>

        <Text style={font.h2}>{t('team.feed')}</Text>
        <Card>
          {feed.length === 0 && <Text style={font.small}>{t('team.empty')}</Text>}
          {feed.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', paddingVertical: space.xs }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: factionById(e.faction_id)?.color ?? colors.wild }} />
              <View style={{ flex: 1 }}>
                <Text style={font.body}>{feedText(e)}</Text>
                <Text style={font.small}>{formatDate(e.created_at)}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Text style={font.h2}>{t('team.ranking')}</Text>
        <Card>
          {board.length === 0 && <Text style={font.small}>{t('team.empty')}</Text>}
          {board.map((r) => (
            <ListItem
              key={r.user_id}
              title={`${r.rank}. ${r.username}`}
              leading={<Avatar id={r.avatar_id} size={36} />}
              subtitle={t('common.territories', { n: r.captures })}
              right={
                <Row>
                  <FactionBadge factionId={r.faction_id} size="sm" />
                  <Text style={[font.h3, { minWidth: 48, textAlign: 'right' }]}>{r.points}</Text>
                </Row>
              }
            />
          ))}
        </Card>

        <Text style={font.h2}>{t('team.members')}</Text>
        <Card>
          {(overview?.members ?? []).map((m) => (
            <ListItem key={m.id} leading={<Avatar id={m.avatar_id} size={36} />} title={m.username} subtitle={t('profile.level', { n: m.level })} />
          ))}
        </Card>

        <Text style={font.h2}>{t('team.factions')}</Text>
        <Card>
          {world.map((w) => (
            <Row key={w.faction_id} style={{ justifyContent: 'space-between' }}>
              <FactionBadge factionId={w.faction_id} size="sm" />
              <Text style={font.body}>
                {w.hexes_now} · {Number(w.territory_days)} pts
              </Text>
            </Row>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}
