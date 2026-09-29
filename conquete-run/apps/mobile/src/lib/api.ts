/**
 * Point d'entrée des écrans : délègue au backend actif (serveur ou local).
 * Les types viennent du contrat partagé (@conquete/core).
 */
import type { Allocation, OnboardingInput } from '@conquete/core';
import { backend } from '@/backend';

export type {
  DeployResultRow,
  DeployTargetRow,
  FeedEvent,
  HexRow,
  Nemesis,
  Profile,
  RunRow,
  SubmitRunResponse,
  TeamOverview,
  WarOverview,
  WeeklyProgress,
  ZoneLeaderboardRow,
} from '@conquete/core';
export { GAME_MODE } from '@/backend';
export { getGpsConsent, getPrivacySettings, invokeFunction, setGpsConsent, setPrivacyZone } from '@/backend/online';

export const getMyProfile = () => backend().getMyProfile();
export const onboard = (i: OnboardingInput) => backend().onboard(i);
export const zoneFactionCounts = (zone: string) => backend().zoneFactionCounts(zone);
export const setAvatar = (id: string) => backend().setAvatar(id);
export const setLocaleRemote = (l: 'fr' | 'en') => backend().setLocale(l);
export const hexesInBBox = (b: { south: number; west: number; north: number; east: number }) => backend().hexesInBBox(b);
export const getRun = (id: string) => backend().getRun(id);
export const myRuns = (limit = 50) => backend().myRuns(limit);
export const pendingDeployments = () => backend().pendingDeployments();
export const deployTargets = (runId: string) => backend().deployTargets(runId);
export const deployTroops = (runId: string, a: Allocation[]) => backend().deployTroops(runId, a);
export const zoneFeed = (zone: string, limit = 30) => backend().zoneFeed(zone, limit);
export const zoneLeaderboard = (zone: string) => backend().zoneLeaderboard(zone);
export const teamOverview = (zone: string) => backend().teamOverview(zone);
export const warOverview = (zone: string) => backend().warOverview(zone);
export const nemesis = () => backend().nemesis();
export const myTrophies = () => backend().myTrophies();
export const weeklyProgress = () => backend().weeklyProgress();
export const subscribeLive = (zone: string | null, cb: (w: 'hexes' | 'feed') => void) => backend().subscribe(zone, cb);
export const tickWorld = () => backend().tick();
export const exportData = () => backend().exportData();
export const deleteAccount = () => backend().deleteAccount();
