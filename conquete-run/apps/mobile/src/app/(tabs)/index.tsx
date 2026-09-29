import { factionById, type LatLng } from '@conquete/core';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HexMap } from '@/features/map/HexMap';
import { getLocale, t } from '@/i18n';
import { type FactionScoreRow, pendingDeployments, type RunRow, zoneFactionScores } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { loadGameConfig, type Season } from '@/lib/gameConfig';
import { colors, font, radius, space } from '@/ui/theme';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [center, setCenter] = useState<LatLng | null>(null);
  const [scores, setScores] = useState<FactionScoreRow[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [pending, setPending] = useState<RunRow[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGameConfig().then(({ season: s }) => setSeason(s));
      if (profile?.home_zone) void zoneFactionScores(profile.home_zone).then(setScores).catch(() => setScores([]));
      void pendingDeployments().then(setPending).catch(() => setPending([]));
    }, [profile?.home_zone]),
  );

  const troops = pending.reduce((s, r) => s + r.troops_remaining, 0);
  const total = scores.reduce((s, r) => s + Number(r.territory_days), 0) || 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {center && <HexMap center={center} />}
      {!center && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={font.small}>{t('common.loading')}</Text>
        </View>
      )}
      {/* Classement de la saison de ma zone, en surimpression */}
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, backgroundColor: colors.surface + 'EE', borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
        <Text style={font.h3}>{season ? `${t('map.leaderboard')} · ${season.name}` : t('map.noSeason')}</Text>
        <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surfaceHigh }}>
          {scores.map((s) => (
            <View key={s.faction_id} style={{ flex: Number(s.territory_days) / total, backgroundColor: factionById(s.faction_id)?.color }} />
          ))}
        </View>
        {expanded &&
          scores.map((s) => (
            <View key={s.faction_id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: factionById(s.faction_id)?.color, fontWeight: '700' }}>{factionById(s.faction_id)?.name[getLocale()]}</Text>
              <Text style={font.small}>
                {s.hexes_now} · {Number(s.territory_days)} pts
              </Text>
            </View>
          ))}
      </Pressable>
      {troops > 0 && (
        <Pressable
          onPress={() => router.push(`/deploy/${pending[0]!.id}`)}
          style={{ position: 'absolute', bottom: space.lg, alignSelf: 'center', backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.xl, paddingVertical: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Ionicons name="flag" size={18} color="#111" />
          <Text style={{ color: '#111', fontWeight: '800' }}>{t('map.pendingTroops', { n: troops })}</Text>
        </Pressable>
      )}
    </View>
  );
}
