import { DEFAULT_AVATAR_ID } from '@conquete/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { AvatarPicker } from '@/features/avatar/AvatarPicker';
import { t } from '@/i18n';
import { setAvatar } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Screen } from '@/ui/components';
import { font, space } from '@/ui/theme';

export default function AvatarScreen() {
  const { profile, refreshProfile } = useAuth();
  const [value, setValue] = useState(profile?.avatar_id ?? DEFAULT_AVATAR_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return <Screen />;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setAvatar(value);
      await refreshProfile();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingVertical: space.lg }}>
        <Text style={font.h1}>{t('avatar.title')}</Text>
        <Text style={font.small}>{t('avatar.help')}</Text>
        <AvatarPicker value={value} level={profile.level} faction={profile.faction_id} onChange={setValue} />
        <ErrorText>{error}</ErrorText>
        <Button title={t('avatar.save')} loading={busy} disabled={value === profile.avatar_id} onPress={() => void save()} />
      </ScrollView>
    </Screen>
  );
}
