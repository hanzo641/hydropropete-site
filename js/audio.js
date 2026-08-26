/* ==========================================================================
   Écho du Royaume — moteur audio (Web Audio API, sons synthétisés, aucun
   fichier externe). Le contexte audio est créé/réveillé au premier geste
   utilisateur pour respecter les politiques de lecture automatique mobile.
   ========================================================================== */

(() => {
  "use strict";

  const MUTE_KEY = "echoRoyaumeMuted_v1";
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { /* stockage indisponible */ }

  let ctx = null;
  let masterGain = null;
  let ambient = null;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.8;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    const c = ensureCtx();
    if (c && c.state === "suspended") c.resume();
  }

  function noiseBuffer(c, duration) {
    const buffer = c.createBuffer(1, Math.max(1, Math.round(c.sampleRate * duration)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function tone({ freq, type = "sine", duration = 0.15, gain = 0.2, glideTo = null, delay = 0 }) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function noiseHit({ duration = 0.18, gain = 0.3, filterFreq = 1200, delay = 0 }) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, duration);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(masterGain);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  const SFX = {
    click: () => tone({ freq: 600, type: "sine", duration: 0.05, gain: 0.08 }),
    jump: () => tone({ freq: 420, glideTo: 680, type: "triangle", duration: 0.16, gain: 0.18 }),
    lane: () => tone({ freq: 320, glideTo: 440, type: "sine", duration: 0.07, gain: 0.09 }),
    attack: () => noiseHit({ duration: 0.12, gain: 0.16, filterFreq: 3200 }),
    hitEnemy: () => {
      noiseHit({ duration: 0.14, gain: 0.26, filterFreq: 1600 });
      tone({ freq: 180, type: "square", duration: 0.1, gain: 0.12, delay: 0.02 });
    },
    hitPlayer: () => {
      noiseHit({ duration: 0.22, gain: 0.3, filterFreq: 500 });
      tone({ freq: 130, glideTo: 70, type: "sawtooth", duration: 0.22, gain: 0.18 });
    },
    coin: () => tone({ freq: 880, glideTo: 1320, type: "square", duration: 0.09, gain: 0.13 }),
    gem: () => {
      tone({ freq: 1046, type: "triangle", duration: 0.12, gain: 0.15 });
      tone({ freq: 1568, type: "triangle", duration: 0.14, gain: 0.11, delay: 0.05 });
    },
    potion: () => tone({ freq: 520, glideTo: 780, type: "sine", duration: 0.2, gain: 0.15 }),
    shadowCharge: () => {
      tone({ freq: 220, glideTo: 90, type: "sawtooth", duration: 0.4, gain: 0.13 });
      noiseHit({ duration: 0.3, gain: 0.09, filterFreq: 800, delay: 0.05 });
    },
    shadowConsume: () => {
      noiseHit({ duration: 0.2, gain: 0.18, filterFreq: 700 });
      tone({ freq: 660, glideTo: 220, type: "sine", duration: 0.25, gain: 0.13, delay: 0.02 });
    },
    levelUp: () => {
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: "triangle", duration: 0.18, gain: 0.15, delay: i * 0.09 }));
    },
    rankUp: () => {
      [392, 523, 659, 784, 987, 1244].forEach((f, i) => tone({ freq: f, type: "triangle", duration: 0.2, gain: 0.17, delay: i * 0.07 }));
    },
    bossAppear: () => {
      tone({ freq: 80, type: "sawtooth", duration: 0.9, gain: 0.2 });
      tone({ freq: 60, type: "sine", duration: 1.1, gain: 0.16, delay: 0.1 });
    },
    bossWarn: () => tone({ freq: 900, type: "square", duration: 0.06, gain: 0.09 }),
    bossHit: () => {
      noiseHit({ duration: 0.16, gain: 0.28, filterFreq: 2000 });
      tone({ freq: 150, type: "square", duration: 0.12, gain: 0.13, delay: 0.02 });
    },
    victory: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, type: "triangle", duration: 0.22, gain: 0.17, delay: i * 0.1 })),
    defeat: () => [400, 340, 280, 200].forEach((f, i) => tone({ freq: f, type: "sawtooth", duration: 0.3, gain: 0.15, delay: i * 0.12 })),
    revive: () => tone({ freq: 300, glideTo: 900, type: "sine", duration: 0.35, gain: 0.19 }),
  };

  function play(name) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    const fn = SFX[name];
    if (fn) fn();
  }

  function startAmbient() {
    if (muted || ambient) return;
    const c = ensureCtx();
    if (!c) return;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(masterGain);
    const osc1 = c.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    const osc2 = c.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 55 * 1.5;
    osc1.connect(g);
    osc2.connect(g);
    osc1.start();
    osc2.start();
    g.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.6);
    ambient = { g, osc1, osc2 };
  }

  function stopAmbient() {
    if (!ambient || !ctx) return;
    const { g, osc1, osc2 } = ambient;
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(g.gain.value, t0);
    g.gain.linearRampToValueAtTime(0, t0 + 0.3);
    osc1.stop(t0 + 0.32);
    osc2.stop(t0 + 0.32);
    ambient = null;
  }

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem(MUTE_KEY, value ? "1" : "0"); } catch (e) { /* stockage indisponible */ }
    if (masterGain) masterGain.gain.value = value ? 0 : 0.8;
    if (value) stopAmbient();
  }

  function isMuted() {
    return muted;
  }

  window.GameAudio = { unlock, play, startAmbient, stopAmbient, setMuted, isMuted };
})();
