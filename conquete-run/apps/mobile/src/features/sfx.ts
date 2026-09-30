import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { kv } from '@/lib/kv';

/**
 * Effets sonores du jeu. Ils se mélangent à la musique du coureur (jamais d'interruption)
 * et respectent le mode silencieux de l'iPhone. Désactivables dans le profil.
 */
const SOURCES = {
  tick0: require('../../assets/sfx/tick0.wav'),
  tick1: require('../../assets/sfx/tick1.wav'),
  tick2: require('../../assets/sfx/tick2.wav'),
  tick3: require('../../assets/sfx/tick3.wav'),
  whoosh: require('../../assets/sfx/whoosh.wav'),
  impact: require('../../assets/sfx/impact.wav'),
  capture: require('../../assets/sfx/capture.wav'),
  shield: require('../../assets/sfx/shield.wav'),
  reward: require('../../assets/sfx/reward.wav'),
  victory: require('../../assets/sfx/victory.wav'),
} as const;
export type Sfx = keyof typeof SOURCES;

const PREF = 'cr:pref:sound';
const players = new Map<string, AudioPlayer[]>();
const cursor = new Map<string, number>();
let ready = false;

export function soundEnabled(): boolean {
  return kv.getItem(PREF) !== 'off';
}

export function setSoundEnabled(on: boolean): void {
  kv.setItem(PREF, on ? 'on' : 'off');
}

function init(): void {
  if (ready) return;
  ready = true;
  void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
}

/** Plusieurs lecteurs par son court pour pouvoir les enchaîner très vite (pluie de troupes). */
function pool(name: Sfx): AudioPlayer[] {
  let list = players.get(name);
  if (!list) {
    const size = name.startsWith('tick') ? 3 : 1;
    list = Array.from({ length: size }, () => createAudioPlayer(SOURCES[name]));
    players.set(name, list);
  }
  return list;
}

/** Précharge les sons d'une scène (évite la latence du premier déclenchement). */
export function preload(names: readonly Sfx[]): void {
  if (!soundEnabled()) return;
  init();
  try {
    for (const n of names) pool(n);
  } catch {
    /* audio indisponible : le jeu continue en silence */
  }
}

export function play(name: Sfx, volume = 1): void {
  if (!soundEnabled()) return;
  init();
  try {
    const list = pool(name);
    const i = (cursor.get(name) ?? 0) % list.length;
    cursor.set(name, i + 1);
    const p = list[i]!;
    p.volume = volume;
    void p.seekTo(0);
    p.play();
  } catch {
    /* jamais bloquant */
  }
}

/** Son de pièce dont la hauteur monte avec la progression (0 → 1). */
export function tick(progress: number): void {
  const k = Math.min(3, Math.floor(progress * 4));
  play(`tick${k}` as Sfx, 0.7);
}
