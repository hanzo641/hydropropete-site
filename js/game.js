/* ==========================================================================
   Écho du Royaume — runner RPG mobile (Canvas 2D, vanilla JS, sans dépendance)
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Constantes de jeu                                                   */
  /* ------------------------------------------------------------------ */

  const LANE_COUNT = 3;
  const BASE_HP = 100;
  const BASE_SPEED = 260;          // pixels / seconde (monde), avant multiplicateurs
  const MAX_SPEED = 620;
  const SPEED_RAMP_PER_SEC = 6;    // vitesse gagnée par seconde de course
  const DISTANCE_SCALE = 0.12;     // conversion vitesse (px/s) -> "mètres" affichés
  const JUMP_DURATION = 550;       // ms
  const ATTACK_WINDOW = 260;       // ms pendant lesquels l'attaque touche
  const ATTACK_COOLDOWN = 380;     // ms
  const LANE_SWITCH_MS = 160;
  const CONTACT_ZONE = [0.82, 1.0]; // progression (0=spawn,1=joueur) où la collision se résout
  const SAVE_KEY = "echoRoyaumeSave_v1";
  const SHADOW_THRESHOLD = 5; // monstres vaincus avant que l'Armée d'Ombres se lève

  const RANKS = [
    { code: "E", min: 1 },
    { code: "D", min: 10 },
    { code: "C", min: 20 },
    { code: "B", min: 30 },
    { code: "A", min: 40 },
    { code: "S", min: 50 },
  ];

  function rankForLevel(level) {
    let current = RANKS[0].code;
    for (const r of RANKS) if (level >= r.min) current = r.code;
    return current;
  }

  const DUNGEON_TIERS = [
    { rank: "E", label: "Faille de Rang E", minLevel: 1,  lengthM: 500,  hazardMult: 1.0, spawnMult: 1.0, bossHp: 3,  bossDamage: 12, keyCost: 1, rewardGold: 40,  rewardXp: 60 },
    { rank: "D", label: "Faille de Rang D", minLevel: 10, lengthM: 750,  hazardMult: 1.3, spawnMult: 1.15, bossHp: 4,  bossDamage: 16, keyCost: 1, rewardGold: 90,  rewardXp: 120 },
    { rank: "C", label: "Faille de Rang C", minLevel: 20, lengthM: 1000, hazardMult: 1.6, spawnMult: 1.3, bossHp: 5,  bossDamage: 20, keyCost: 1, rewardGold: 160, rewardXp: 200 },
    { rank: "B", label: "Faille de Rang B", minLevel: 30, lengthM: 1300, hazardMult: 2.0, spawnMult: 1.45, bossHp: 6,  bossDamage: 26, keyCost: 2, rewardGold: 280, rewardXp: 320 },
    { rank: "A", label: "Faille de Rang A", minLevel: 40, lengthM: 1600, hazardMult: 2.4, spawnMult: 1.6, bossHp: 8,  bossDamage: 32, keyCost: 2, rewardGold: 450, rewardXp: 500 },
    { rank: "S", label: "Faille de Rang S", minLevel: 50, lengthM: 2000, hazardMult: 3.0, spawnMult: 1.8, bossHp: 10, bossDamage: 40, keyCost: 3, rewardGold: 750, rewardXp: 820 },
  ];

  const UPGRADES = {
    hp: {
      label: "Cœur Ancien",
      desc: (lvl) => `+${lvl * 15} PV max`,
      max: 6,
      baseCost: 40,
      costGrowth: 1.5,
    },
    magnet: {
      label: "Amulette d'Attraction",
      desc: (lvl) => lvl === 0 ? "Attire l'or des voies voisines" : `Rayon d'attraction : ${lvl} voie(s)`,
      max: 2,
      baseCost: 60,
      costGrowth: 1.8,
    },
    speed: {
      label: "Bottes de Vitesse",
      desc: (lvl) => `Vitesse de départ +${lvl * 8}%`,
      max: 5,
      baseCost: 50,
      costGrowth: 1.6,
    },
    revive: {
      label: "Anneau de Résurrection",
      desc: (lvl) => `${lvl} résurrection(s) avec 50% PV par run`,
      max: 3,
      baseCost: 120,
      costGrowth: 2.0,
    },
  };

  /* ------------------------------------------------------------------ */
  /* Sauvegarde / progression permanente                                 */
  /* ------------------------------------------------------------------ */

  function defaultSave() {
    return {
      level: 1,
      xp: 0,
      totalGold: 0,
      bestDistance: 0,
      upgrades: { hp: 0, magnet: 0, speed: 0, revive: 0 },
      stravaLastActivityId: null,
      realDistanceKm: 0,
      dungeonKeys: 0,
      dailyQuest: null,
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultSave(), parsed, {
        upgrades: Object.assign(defaultSave().upgrades, parsed.upgrades || {}),
      });
    } catch (e) {
      return defaultSave();
    }
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) { /* stockage indisponible : progression non persistée */ }
  }

  let save = loadSave();

  function xpToNext(level) {
    return 40 + level * 30;
  }

  function grantXp(amount) {
    const prevRank = rankForLevel(save.level);
    save.xp += amount;
    let leveledUp = false;
    while (save.xp >= xpToNext(save.level)) {
      save.xp -= xpToNext(save.level);
      save.level += 1;
      leveledUp = true;
      if (run) run.hp = Math.min(run.maxHp, run.hp + run.maxHp * 0.25);
    }
    if (leveledUp) {
      const newRank = rankForLevel(save.level);
      showToast(newRank !== prevRank ? `RANG ${newRank} ATTEINT !` : `Niveau ${save.level} !`);
    }
    return leveledUp;
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function questTargetForLevel(level) {
    return Math.min(10, 3 + Math.floor(level / 3));
  }

  function ensureDailyQuest() {
    const today = todayStr();
    if (!save.dailyQuest || save.dailyQuest.date !== today) {
      save.dailyQuest = { date: today, targetKm: questTargetForLevel(save.level), progressKm: 0, completed: false };
      persist();
    }
  }

  function upgradeCost(key) {
    const u = UPGRADES[key];
    const lvl = save.upgrades[key];
    if (lvl >= u.max) return null;
    return Math.round(u.baseCost * Math.pow(u.costGrowth, lvl));
  }

  function maxHpFromSave() {
    return BASE_HP + save.upgrades.hp * 15;
  }

  /* ------------------------------------------------------------------ */
  /* Canvas & redimensionnement                                          */
  /* ------------------------------------------------------------------ */

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 50));
  resize();

  function laneX(i) {
    const laneW = W / LANE_COUNT;
    return laneW * i + laneW / 2;
  }

  const PLAYER_Y_FRAC = 0.82; // position verticale fixe du joueur à l'écran

  /* ------------------------------------------------------------------ */
  /* État de la partie en cours                                          */
  /* ------------------------------------------------------------------ */

  let run = null;
  let entities = [];
  let entityId = 0;
  let particles = [];
  let spawnTimer = 0;
  let runTimer = 0;
  let lastFrame = 0;
  let gameState = "menu"; // menu | playing | paused | gameover
  let animRAF = null;
  let shakeTime = 0;
  let shakeMag = 0;

  function triggerShake(mag, dur) {
    shakeMag = mag;
    shakeTime = dur;
  }

  function spawnSparks(lane, color, count, atBoss) {
    const x = laneX(lane);
    const y = atBoss ? H * PLAYER_Y_FRAC - 130 : H * PLAYER_Y_FRAC - 20;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 110;
      particles.push({
        kind: "spark",
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        t: 0,
        life: 0.3 + Math.random() * 0.2,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  const motes = Array.from({ length: 26 }, () => ({
    xf: Math.random(),
    yf: Math.random(),
    size: 1 + Math.random() * 2,
    speed: 8 + Math.random() * 18,
    phase: Math.random() * Math.PI * 2,
  }));

  function newRun(dungeonTier) {
    const speedBonus = 1 + save.upgrades.speed * 0.08;
    return {
      lane: 1,
      targetLane: 1,
      laneAnimFrom: 1,
      laneAnimT: 1,
      x: laneX(1),
      maxHp: maxHpFromSave(),
      hp: maxHpFromSave(),
      distance: 0,
      speed: BASE_SPEED * speedBonus,
      speedMult: speedBonus,
      gold: 0,
      xpGained: 0,
      isJumping: false,
      jumpT: 0,
      isAttacking: false,
      attackT: 0,
      attackCooldown: 0,
      attackResolvedThisSwing: false,
      revivesLeft: save.upgrades.revive,
      invulnT: 0,
      runTimeSec: 0,
      combo: 0,
      shadowArmy: 0,
      shadowChargeReady: false,
      mode: dungeonTier ? "dungeon" : "endless",
      tier: dungeonTier || null,
      bossPhase: false,
      bossResolved: false,
      boss: null,
    };
  }

  function hazardMultiplier() {
    return run && run.mode === "dungeon" && run.tier ? run.tier.hazardMult : 1;
  }

  /* ------------------------------------------------------------------ */
  /* Entités (obstacles / ennemis / collectibles)                        */
  /* ------------------------------------------------------------------ */

  const TYPES = {
    rock:   { kind: "hazard", w: 46, h: 40 },
    goblin: { kind: "enemy",  w: 42, h: 54 },
    coin:   { kind: "pickup", w: 22, h: 22 },
    gem:    { kind: "pickup", w: 24, h: 24 },
    potion: { kind: "pickup", w: 24, h: 30 },
  };

  function spawnWave() {
    if (run.mode === "dungeon" && run.bossPhase) return;
    const difficulty = Math.min(1, run.distance / (run.mode === "dungeon" ? run.tier.lengthM * 0.8 : 1400));
    const lanes = [0, 1, 2];
    const pattern = Math.random();

    function add(lane, type) {
      entities.push({
        id: entityId++,
        lane,
        type,
        progress: 0,
        dead: false,
        collected: false,
      });
    }

    if (pattern < 0.30) {
      // rocher sur une voie
      add(lanes[(Math.random() * 3) | 0], "rock");
    } else if (pattern < 0.55) {
      // gobelin sur une voie
      add(lanes[(Math.random() * 3) | 0], "goblin");
    } else if (pattern < 0.62 && difficulty > 0.15) {
      // double obstacle : deux voies bloquées, une libre
      const free = (Math.random() * 3) | 0;
      lanes.forEach((l) => { if (l !== free) add(l, Math.random() < 0.5 ? "rock" : "goblin"); });
    } else if (pattern < 0.66) {
      add((Math.random() * 3) | 0, "potion");
    } else if (pattern < 0.7) {
      add((Math.random() * 3) | 0, "gem");
    } else {
      // ligne de pièces sur une voie
      const l = (Math.random() * 3) | 0;
      add(l, "coin");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Entrées : tactile, souris, clavier                                  */
  /* ------------------------------------------------------------------ */

  function moveLane(delta) {
    if (gameState !== "playing") return;
    const next = Math.max(0, Math.min(LANE_COUNT - 1, run.lane + delta));
    if (next === run.lane) return;
    run.laneAnimFrom = run.x;
    run.lane = next;
    run.laneAnimT = 0;
  }

  function doJump() {
    if (gameState !== "playing" || run.isJumping) return;
    run.isJumping = true;
    run.jumpT = 0;
  }

  function doAttack() {
    if (gameState !== "playing" || run.attackCooldown > 0) return;
    run.isAttacking = true;
    run.attackT = 0;
    run.attackCooldown = ATTACK_COOLDOWN;
    run.attackResolvedThisSwing = false;
  }

  let touchStartX = 0, touchStartY = 0, touchActive = false;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX; touchStartY = t.clientY; touchActive = true;
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    if (!touchActive) return;
    touchActive = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const THRESH = 28;
    if (Math.max(adx, ady) < THRESH) return; // tap simple ignoré
    if (adx > ady) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      doJump();
    } else {
      doAttack();
    }
  }, { passive: true });

  document.getElementById("btnLeft").addEventListener("click", () => moveLane(-1));
  document.getElementById("btnRight").addEventListener("click", () => moveLane(1));
  document.getElementById("btnJump").addEventListener("click", doJump);
  document.getElementById("btnAttack").addEventListener("click", doAttack);

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowLeft") moveLane(-1);
    else if (e.key === "ArrowRight") moveLane(1);
    else if (e.key === "ArrowUp" || e.key === " ") doJump();
    else if (e.key === "ArrowDown" || e.key === "x" || e.key === "X") doAttack();
    else if (e.key === "Escape") togglePause();
  });

  /* ------------------------------------------------------------------ */
  /* Boucle de mise à jour                                               */
  /* ------------------------------------------------------------------ */

  function update(dt) {
    // dt en secondes
    run.runTimeSec += dt;
    run.speed = Math.min(MAX_SPEED, BASE_SPEED + run.runTimeSec * SPEED_RAMP_PER_SEC) * run.speedMult;
    run.distance += run.speed * dt * DISTANCE_SCALE;

    // Lane tween
    if (run.laneAnimT < 1) {
      run.laneAnimT = Math.min(1, run.laneAnimT + dt / (LANE_SWITCH_MS / 1000));
      const target = laneX(run.lane);
      run.x = run.laneAnimFrom + (target - run.laneAnimFrom) * easeOutCubic(run.laneAnimT);
    } else {
      run.x = laneX(run.lane);
    }

    // Jump
    if (run.isJumping) {
      run.jumpT += dt * 1000;
      if (run.jumpT >= JUMP_DURATION) { run.isJumping = false; run.jumpT = 0; }
    }

    // Attack
    if (run.isAttacking) {
      run.attackT += dt * 1000;
      if (run.attackT >= ATTACK_WINDOW) { run.isAttacking = false; }
    }
    if (run.attackCooldown > 0) run.attackCooldown = Math.max(0, run.attackCooldown - dt * 1000);
    if (run.invulnT > 0) run.invulnT = Math.max(0, run.invulnT - dt * 1000);

    // Progression vers le Gardien de Faille (mode donjon)
    if (run.mode === "dungeon" && !run.bossPhase && !run.bossResolved && run.distance >= run.tier.lengthM) {
      startBossPhase();
    }

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0 && !(run.mode === "dungeon" && run.bossPhase)) {
      spawnWave();
      const difficulty = Math.min(1, run.distance / (run.mode === "dungeon" ? run.tier.lengthM * 0.8 : 1400));
      const spawnMult = run.mode === "dungeon" ? run.tier.spawnMult : 1;
      spawnTimer = (1.05 - difficulty * 0.55 + Math.random() * 0.25) / spawnMult;
    }

    // Combat de Gardien de Faille
    if (run.mode === "dungeon" && run.bossPhase && run.boss) {
      const boss = run.boss;
      boss.timeLeft -= dt;
      boss.strikeTimer -= dt;
      if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);

      if (boss.strikeTimer <= 0) {
        boss.strikeTimer = boss.strikeInterval;
        if (boss.lane === run.lane) damagePlayer(run.tier.bossDamage);
      }

      if (run.isAttacking && !run.attackResolvedThisSwing && boss.lane === run.lane) {
        run.attackResolvedThisSwing = true;
        boss.hp -= 1;
        boss.hitFlash = 0.15;
        popParticle(boss.lane, "-1", "#ff6b81");
        spawnSparks(boss.lane, "#ff4d6d", 9, true);
        triggerShake(4, 0.1);
        if (boss.hp <= 0) finishDungeon(true);
      }

      if (run.bossPhase && boss.timeLeft <= 0) finishDungeon(false);
    }

    // Progress des entités + collisions
    const speedNorm = run.speed / BASE_SPEED;
    for (const e of entities) {
      if (e.dead) continue;
      e.progress += dt * 0.62 * speedNorm;

      const inContact = e.progress >= CONTACT_ZONE[0] && e.progress <= CONTACT_ZONE[1] + 0.08;
      const sameLane = e.lane === run.lane;
      const magnetHit = TYPES[e.type].kind === "pickup" && Math.abs(e.lane - run.lane) <= save.upgrades.magnet;

      if (inContact && (sameLane || magnetHit) && !e.collected) {
        resolveContact(e);
      }
      if (e.progress > 1.15) e.dead = true;
    }
    entities = entities.filter((e) => !e.dead);

    // Particules
    for (const p of particles) {
      p.t += dt;
      if (p.kind === "spark") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 240 * dt;
      } else {
        p.y -= p.vy * dt;
        p.x += p.vx * dt;
      }
    }
    particles = particles.filter((p) => p.t < p.life);

    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);

    if (run.hp <= 0) {
      if (run.mode === "dungeon") {
        finishDungeon(false);
      } else {
        endRun();
      }
    }
  }

  function startBossPhase() {
    run.bossPhase = true;
    entities = [];
    run.boss = {
      lane: run.lane,
      hp: run.tier.bossHp,
      maxHp: run.tier.bossHp,
      strikeTimer: 1.6,
      strikeInterval: 1.6,
      timeLeft: 14,
      hitFlash: 0,
    };
    showToast("Un Gardien de Faille apparaît !");
  }

  function finishDungeon(victory) {
    if (gameState !== "playing") return;
    gameState = "gameover";
    run.bossPhase = false;
    run.bossResolved = true;

    const tier = run.tier;
    const goldTotal = run.gold + (victory ? tier.rewardGold : 0);
    const xpTotal = run.xpGained + (victory ? tier.rewardXp : 0);

    save.totalGold += run.gold + (victory ? tier.rewardGold : 0);
    if (victory) grantXp(tier.rewardXp);
    persist();

    document.getElementById("dungeonResultTitle").textContent = victory
      ? `Faille de Rang ${tier.rank} conquise !`
      : "La Faille se referme...";
    document.getElementById("dungeonResultMsg").textContent = victory
      ? "Le Gardien est vaincu. Ton butin est sécurisé."
      : "Tu n'as pas tenu assez longtemps. Reviens plus fort.";
    document.getElementById("dungeonResGold").textContent = `${goldTotal}`;
    document.getElementById("dungeonResXp").textContent = `${xpTotal}`;

    hud.classList.add("hidden");
    controls.classList.add("hidden");
    showScreen("dungeonresult");
  }

  function resolveContact(e) {
    const def = TYPES[e.type];
    if (def.kind === "hazard") {
      if (run.shadowChargeReady) {
        consumeShadowCharge(e);
      } else if (!run.isJumping) {
        damagePlayer(18 * hazardMultiplier());
      }
      e.dead = true;
    } else if (def.kind === "enemy") {
      if (run.isAttacking) {
        e.dead = true;
        e.collected = true;
        run.combo += 1;
        run.shadowArmy += 1;
        maybeChargeShadow();
        const goldGain = 4 + Math.min(run.combo, 10);
        const xpGain = 6;
        run.gold += goldGain;
        run.xpGained += xpGain;
        grantXp(xpGain);
        popParticle(e.lane, `+${goldGain}💰`, "#f4c542");
        spawnSparks(e.lane, "#ff6b81", 7);
      } else if (run.shadowChargeReady) {
        consumeShadowCharge(e);
        e.dead = true;
      } else if (!run.isJumping) {
        damagePlayer(14 * hazardMultiplier());
        run.combo = 0;
        e.dead = true;
      } else {
        e.dead = true; // sauté par-dessus
      }
    } else if (def.kind === "pickup") {
      e.dead = true;
      e.collected = true;
      if (e.type === "coin") {
        run.gold += 2;
        popParticle(e.lane, "+2💰", "#f4c542");
      } else if (e.type === "gem") {
        run.gold += 12;
        popParticle(e.lane, "+12💰", "#b39bff");
      } else if (e.type === "potion") {
        run.hp = Math.min(run.maxHp, run.hp + run.maxHp * 0.3);
        popParticle(e.lane, "+PV", "#4ade80");
      }
    }
  }

  function damagePlayer(amount) {
    if (run.invulnT > 0) return;
    run.hp -= amount;
    run.invulnT = 500;
    triggerShake(7, 0.18);
    if (run.hp <= 0 && run.revivesLeft > 0) {
      run.revivesLeft -= 1;
      run.hp = run.maxHp * 0.5;
      run.invulnT = 1200;
      showToast("Résurrection !");
    }
  }

  function maybeChargeShadow() {
    if (run.shadowArmy > 0 && run.shadowArmy % SHADOW_THRESHOLD === 0 && !run.shadowChargeReady) {
      run.shadowChargeReady = true;
      showToast("Ombres, debout !");
    }
  }

  function consumeShadowCharge(e) {
    run.shadowChargeReady = false;
    popParticle(e.lane, "🖤 Ombre", "#8b7cff");
    spawnSparks(e.lane, "#8b7cff", 10);
  }

  function popParticle(lane, text, color) {
    particles.push({
      x: laneX(lane), y: H * PLAYER_Y_FRAC - 30,
      vx: 0, vy: 45, t: 0, life: 0.7, text, color,
    });
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                                */
  /* ------------------------------------------------------------------ */

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeTime > 0) {
      ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }
    drawBackground();
    if (run && run.mode === "dungeon" && run.bossPhase && run.boss) {
      drawBoss();
    } else {
      drawEntities();
    }
    drawPlayer();
    drawParticles();
    ctx.restore();
  }

  function drawBoss() {
    const boss = run.boss;
    const x = laneX(boss.lane);
    const y = H * PLAYER_Y_FRAC - 130;
    const warnRatio = 1 - Math.min(1, boss.strikeTimer / 0.6);
    const warning = boss.strikeTimer < 0.6;
    const pulse = 0.5 + Math.sin(ambientT * 5) * 0.5;

    ctx.save();
    ctx.translate(x, y);

    // Anneau de télégraphe au sol : se resserre à mesure que l'attaque approche
    if (warning) {
      const ringR = 58 - warnRatio * 30;
      ctx.strokeStyle = `rgba(255, 77, 109, ${0.3 + warnRatio * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 34, ringR, ringR * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Aura sombre
    ctx.fillStyle = `rgba(74, 16, 48, ${0.35 + pulse * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(0, -6, 46, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Épines dorsales
    ctx.fillStyle = "#1c0714";
    for (const sx of [-22, -10, 10, 22]) {
      ctx.beginPath();
      ctx.moveTo(sx, -34);
      ctx.lineTo(sx - 5, -12);
      ctx.lineTo(sx + 5, -12);
      ctx.closePath();
      ctx.fill();
    }

    // Corps
    ctx.fillStyle = boss.hitFlash > 0 ? "#ffb0bd" : "#3a0c26";
    ctx.beginPath();
    ctx.ellipse(0, -10, 32, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boss.hitFlash > 0 ? "#ffcdd6" : "#2c0a1e";
    ctx.beginPath();
    ctx.moveTo(-26, 16); ctx.lineTo(26, 16); ctx.lineTo(20, 44); ctx.lineTo(-20, 44);
    ctx.closePath();
    ctx.fill();

    // Fêlures lumineuses
    ctx.strokeStyle = `rgba(255, 120, 150, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -24); ctx.lineTo(-4, -6); ctx.lineTo(-10, 10);
    ctx.moveTo(-4, -6); ctx.lineTo(8, 2);
    ctx.stroke();

    // Cœur / yeux luisants
    ctx.save();
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = 10 + pulse * 8;
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(-12, -18, 5.5, 0, Math.PI * 2);
    ctx.arc(12, -18, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  let bgScroll = 0;
  let ambientT = 0;

  function drawBackground() {
    ambientT += 0.016;

    // Ciel de la Faille : dégradé profond + halo pulsant au point de fuite
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a1240");
    grad.addColorStop(0.55, "#130d30");
    grad.addColorStop(1, "#08061a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const pulse = 0.5 + Math.sin(ambientT * 1.4) * 0.5;
    const vanishY = H * 0.12;
    const halo = ctx.createRadialGradient(W / 2, vanishY, 0, W / 2, vanishY, W * 0.55);
    halo.addColorStop(0, `rgba(79, 214, 255, ${0.16 + pulse * 0.07})`);
    halo.addColorStop(1, "rgba(79, 214, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    // Motes ambiantes (poussière d'énergie de la Faille)
    ctx.save();
    for (const m of motes) {
      const x = m.xf * W;
      const y = ((m.yf * H - ambientT * m.speed) % H + H) % H;
      const flicker = 0.4 + 0.6 * Math.abs(Math.sin(ambientT * 2 + m.phase));
      ctx.globalAlpha = flicker * 0.5;
      ctx.fillStyle = "#8fdcff";
      ctx.beginPath();
      ctx.arc(x, y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Voies lumineuses (double trait : halo + trait net)
    bgScroll = (bgScroll + (run ? run.speed : 80) * 0.016) % 60;
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = (W / LANE_COUNT) * i;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -bgScroll;

      ctx.strokeStyle = "rgba(79, 214, 255, 0.15)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      ctx.strokeStyle = "rgba(180, 235, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Éclats de Faille en bordure, qui défilent et pulsent
    const decoSpacing = 220;
    const offset = (bgScroll * 3.4) % decoSpacing;
    for (let y = -decoSpacing + offset; y < H; y += decoSpacing) {
      drawRiftShard(14, y, 1);
      drawRiftShard(W - 14, y, -1);
    }
  }

  function drawRiftShard(x, y, dir) {
    const bob = Math.sin(ambientT * 2 + x) * 3;
    const glow = 0.5 + Math.sin(ambientT * 3 + x) * 0.5;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(dir * 0.15);
    ctx.shadowColor = "#4fd6ff";
    ctx.shadowBlur = 8 + glow * 6;
    ctx.fillStyle = `rgba(79, 214, 255, ${0.55 + glow * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(5, -2);
    ctx.lineTo(3, 12);
    ctx.lineTo(-4, 6);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function scaleForProgress(p) {
    return 0.35 + p * 0.85;
  }
  function yForProgress(p) {
    const playerY = H * PLAYER_Y_FRAC;
    return H * 0.14 + (playerY - H * 0.14) * p;
  }

  function drawEntities() {
    const sorted = [...entities].sort((a, b) => a.progress - b.progress);
    for (const e of sorted) {
      const s = scaleForProgress(e.progress);
      const x = laneX(e.lane);
      const y = yForProgress(e.progress);
      ctx.save();
      ctx.globalAlpha = Math.min(1, 0.35 + e.progress);
      ctx.translate(x, y);
      ctx.scale(s, s);
      drawEntitySprite(e.type);
      ctx.restore();
    }
  }

  function drawEntitySprite(type) {
    const glow = 0.5 + Math.sin(ambientT * 4) * 0.5;
    switch (type) {
      case "rock": {
        // Éclat de Faille : cristal sombre fissuré, lumière cyan qui filtre des fêlures
        ctx.save();
        ctx.shadowColor = "#4fd6ff";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#241a3a";
        ctx.beginPath();
        ctx.moveTo(-22, 18); ctx.lineTo(-15, -16); ctx.lineTo(4, -22);
        ctx.lineTo(23, -3); ctx.lineTo(15, 19); ctx.lineTo(-4, 24);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath(); ctx.moveTo(-15, -16); ctx.lineTo(4, -22); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill();

        ctx.strokeStyle = `rgba(79, 214, 255, ${0.55 + glow * 0.4})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-8, -10); ctx.lineTo(2, 2); ctx.lineTo(-3, 14);
        ctx.moveTo(2, 2); ctx.lineTo(12, 8);
        ctx.stroke();
        break;
      }
      case "goblin": {
        // Monstre de Faille : silhouette d'ombre, yeux luisants
        ctx.save();
        ctx.fillStyle = "rgba(139, 30, 60, 0.35)";
        ctx.beginPath(); ctx.ellipse(0, 2, 22, 24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        const bob = Math.sin(ambientT * 6) * 1.5;
        ctx.fillStyle = "#1c1226";
        ctx.beginPath();
        ctx.moveTo(-13, 10 + bob); ctx.lineTo(-15, -8 + bob); ctx.lineTo(-6, -20 + bob);
        ctx.lineTo(0, -14 + bob); ctx.lineTo(6, -20 + bob); ctx.lineTo(15, -8 + bob);
        ctx.lineTo(13, 10 + bob); ctx.lineTo(8, 22 + bob); ctx.lineTo(-8, 22 + bob);
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(255, 77, 109, ${0.7 + glow * 0.3})`;
        ctx.beginPath(); ctx.arc(-5, -4 + bob, 2.6, 0, Math.PI * 2); ctx.arc(5, -4 + bob, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case "coin": {
        ctx.save();
        ctx.shadowColor = "#f4c542";
        ctx.shadowBlur = 8 + glow * 4;
        ctx.fillStyle = "#f4c542";
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(180,130,20,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.arc(-3, -3, 3.2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "gem": {
        ctx.save();
        ctx.shadowColor = "#a978ff";
        ctx.shadowBlur = 10 + glow * 5;
        ctx.fillStyle = "#a978ff";
        ctx.beginPath();
        ctx.moveTo(0, -13); ctx.lineTo(11, -1); ctx.lineTo(0, 13); ctx.lineTo(-11, -1);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(4, -1); ctx.lineTo(0, 3); ctx.lineTo(-4,-1); ctx.closePath(); ctx.fill();
        break;
      }
      case "potion": {
        ctx.save();
        ctx.shadowColor = "#4ade80";
        ctx.shadowBlur = 7 + glow * 4;
        ctx.fillStyle = "#e8536b";
        ctx.beginPath(); ctx.ellipse(0, 4, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#c23a50";
        ctx.fillRect(-4, -14, 8, 10);
        ctx.fillStyle = `rgba(126, 240, 170, ${0.5 + glow * 0.4})`;
        ctx.beginPath(); ctx.ellipse(0, 4, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.ellipse(-3, 1, 2, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
  }

  function drawPlayer() {
    const jumpOffset = run.isJumping
      ? -Math.sin(Math.min(1, run.jumpT / JUMP_DURATION) * Math.PI) * 46
      : 0;
    const y = H * PLAYER_Y_FRAC + jumpOffset;
    const x = run.x;
    const runCycle = Math.sin(runTimer * 12);
    const flicker = run.invulnT > 0 && Math.floor(runTimer * 20) % 2 === 0;
    const attackT = run.isAttacking ? Math.min(1, run.attackT / ATTACK_WINDOW) : 0;

    ctx.save();
    ctx.globalAlpha = flicker ? 0.35 : 1;
    ctx.translate(x, y);

    // ombre au sol
    ctx.globalAlpha *= run.isJumping ? 0.25 : 0.4;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 26, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = flicker ? 0.35 : 1;

    // Aura de l'Armée d'Ombres (prête à se lever)
    if (run.shadowChargeReady) {
      const auraPulse = 0.5 + Math.sin(ambientT * 6) * 0.5;
      ctx.save();
      ctx.globalAlpha *= 0.5 + auraPulse * 0.3;
      ctx.shadowColor = "#8b7cff";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "#8b7cff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -6, 26 + auraPulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // cape (flotte derrière, à contre-mouvement des jambes)
    ctx.fillStyle = "#241a4a";
    ctx.beginPath();
    ctx.moveTo(-9, -12);
    ctx.lineTo(-16 - runCycle * 4, 20);
    ctx.lineTo(0, 14);
    ctx.lineTo(16 + runCycle * 4, 20);
    ctx.lineTo(9, -12);
    ctx.closePath();
    ctx.fill();

    // jambes
    ctx.strokeStyle = "#3b2f66";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, 10); ctx.lineTo(-6 - runCycle * 6, 26);
    ctx.moveTo(6, 10); ctx.lineTo(6 + runCycle * 6, 26);
    ctx.stroke();

    // bras (contre-balance la course)
    ctx.strokeStyle = "#241a4a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-9, -8); ctx.lineTo(-9 + runCycle * 5, 8);
    ctx.stroke();

    // torse
    ctx.fillStyle = "#7c5cff";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-11, -14, 22, 26, 8) : ctx.rect(-11, -14, 22, 26);
    ctx.fill();

    // capuche + tête
    ctx.fillStyle = "#f2d3a8";
    ctx.beginPath();
    ctx.arc(0, -24, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2c2450";
    ctx.beginPath();
    ctx.arc(0, -27, 10, Math.PI, 0);
    ctx.fill();

    // yeux luisants (chasseur éveillé par le Système)
    ctx.save();
    ctx.shadowColor = "#4fd6ff";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#4fd6ff";
    ctx.beginPath();
    ctx.arc(-3.2, -24, 1.4, 0, Math.PI * 2);
    ctx.arc(3.2, -24, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // traînée de lame pendant l'attaque
    if (run.isAttacking) {
      ctx.save();
      ctx.globalAlpha *= (1 - attackT) * 0.7;
      ctx.strokeStyle = "#bfe9ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(13, -4, 24, -1.6 + attackT * 2.3, -0.5 + attackT * 2.3);
      ctx.stroke();
      ctx.restore();
    }

    // épée
    ctx.save();
    let swordAngle = -0.5;
    if (run.isAttacking) {
      swordAngle = -0.5 + Math.sin(attackT * Math.PI) * 2.3;
    }
    ctx.translate(13, -4);
    ctx.rotate(swordAngle);
    ctx.fillStyle = "#d8d8e0";
    ctx.fillRect(0, -2, 22, 4);
    ctx.fillStyle = "#caa15a";
    ctx.fillRect(-4, -4, 5, 8);
    ctx.restore();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      if (p.kind === "spark") {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boucle principale                                                    */
  /* ------------------------------------------------------------------ */

  function loop(ts) {
    if (gameState !== "playing") return;
    if (!lastFrame) lastFrame = ts;
    let dt = (ts - lastFrame) / 1000;
    lastFrame = ts;
    dt = Math.min(dt, 0.05); // évite les gros sauts si l'onglet perd le focus

    runTimer += dt;
    update(dt);
    draw();
    updateHud();

    animRAF = requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                  */
  /* ------------------------------------------------------------------ */

  const hpFill = document.getElementById("hpFill");
  const xpFill = document.getElementById("xpFill");
  const hudLevel = document.getElementById("hudLevel");
  const hudDistance = document.getElementById("hudDistance");
  const hudGold = document.getElementById("hudGold");

  function updateHud() {
    hpFill.style.width = `${Math.max(0, (run.hp / run.maxHp) * 100)}%`;
    xpFill.style.width = `${Math.min(100, (save.xp / xpToNext(save.level)) * 100)}%`;
    hudLevel.textContent = `Rang ${rankForLevel(save.level)} · Nv ${save.level}`;
    hudDistance.textContent = run.mode === "dungeon" ? `${Math.floor(run.distance)} / ${run.tier.lengthM} m` : `${Math.floor(run.distance)} m`;
    hudGold.textContent = `💰 ${run.gold}`;

    const dungeonProgress = document.getElementById("dungeonProgress");
    if (run.mode === "dungeon" && !run.bossPhase) {
      dungeonProgress.classList.remove("hidden");
      document.getElementById("dungeonFill").style.width = `${Math.min(100, (run.distance / run.tier.lengthM) * 100)}%`;
    } else {
      dungeonProgress.classList.add("hidden");
    }

    const bossBarEl = document.getElementById("bossBar");
    if (run.mode === "dungeon" && run.bossPhase && run.boss) {
      bossBarEl.classList.remove("hidden");
      document.getElementById("bossFill").style.width = `${Math.max(0, (run.boss.hp / run.boss.maxHp) * 100)}%`;
    } else {
      bossBarEl.classList.add("hidden");
    }
  }

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    void el.offsetWidth;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 1100);
  }

  /* ------------------------------------------------------------------ */
  /* Écrans / navigation                                                  */
  /* ------------------------------------------------------------------ */

  const screens = {
    menu: document.getElementById("menuScreen"),
    shop: document.getElementById("shopScreen"),
    dungeon: document.getElementById("dungeonScreen"),
    how: document.getElementById("howScreen"),
    pause: document.getElementById("pauseScreen"),
    gameover: document.getElementById("gameOverScreen"),
    dungeonresult: document.getElementById("dungeonResultScreen"),
  };
  const hud = document.getElementById("hud");
  const controls = document.getElementById("controls");

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    if (name && screens[name]) screens[name].classList.remove("hidden");
  }

  function refreshMenu() {
    ensureDailyQuest();

    document.getElementById("menuLevel").textContent = `Rang ${rankForLevel(save.level)} · Nv ${save.level}`;
    document.getElementById("menuBest").textContent = `${Math.floor(save.bestDistance)} m`;
    document.getElementById("menuGold").textContent = `💰 ${save.totalGold}`;
    document.getElementById("menuKeys").textContent = `🔑 ${save.dungeonKeys}`;

    const q = save.dailyQuest;
    document.getElementById("questDesc").textContent = q.completed
      ? "Quête complétée aujourd'hui !"
      : `Cours ${q.targetKm} km aujourd'hui`;
    document.getElementById("questFill").style.width = `${Math.min(100, (q.progressKm / q.targetKm) * 100)}%`;
    document.getElementById("questStatus").textContent = `${q.progressKm.toFixed(1)} / ${q.targetKm} km${q.completed ? " ✓" : ""}`;

    const connected = !!(window.StravaSync && window.StravaSync.isConnected());
    document.getElementById("stravaDisconnected").classList.toggle("hidden", connected);
    document.getElementById("stravaConnected").classList.toggle("hidden", !connected);
    document.getElementById("stravaRealDistance").textContent = `Distance réelle parcourue : ${save.realDistanceKm.toFixed(1)} km`;

    const athleteEl = document.getElementById("stravaAthleteName");
    const athlete = connected && window.StravaSync.currentAthlete();
    if (athlete && athlete.firstname) {
      athleteEl.textContent = `Connecté : ${athlete.firstname}`;
      athleteEl.classList.remove("hidden");
    } else {
      athleteEl.classList.add("hidden");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Failles (donjons)                                                    */
  /* ------------------------------------------------------------------ */

  function renderDungeonScreen() {
    document.getElementById("dungeonKeysCount").textContent = save.dungeonKeys;
    const list = document.getElementById("dungeonList");
    list.innerHTML = "";
    DUNGEON_TIERS.forEach((tier) => {
      const unlocked = save.level >= tier.minLevel;
      const hasKey = save.dungeonKeys >= tier.keyCost;

      const card = document.createElement("div");
      card.className = `dungeon-card rank-${tier.rank}`;

      const info = document.createElement("div");
      info.className = "dungeon-info";
      info.innerHTML = `
        <strong>${tier.label}</strong>
        <small>${unlocked ? `${tier.lengthM} m · Coût : ${tier.keyCost} 🔑` : `Débloquée au Rang ${tier.rank} (Nv ${tier.minLevel})`}</small>
        <small class="dungeon-reward">Récompense : +${tier.rewardGold} 💰 · +${tier.rewardXp} XP</small>
      `;

      const btn = document.createElement("button");
      btn.className = "shop-buy";
      if (!unlocked) {
        btn.textContent = "Verrouillée";
        btn.disabled = true;
      } else if (!hasKey) {
        btn.textContent = "Pas de clé";
        btn.disabled = true;
      } else {
        btn.textContent = "Entrer";
        btn.addEventListener("click", () => enterDungeon(tier));
      }

      card.appendChild(info);
      card.appendChild(btn);
      list.appendChild(card);
    });
  }

  function enterDungeon(tier) {
    if (save.dungeonKeys < tier.keyCost || save.level < tier.minLevel) return;
    save.dungeonKeys -= tier.keyCost;
    persist();
    startRun(tier);
  }

  /* ------------------------------------------------------------------ */
  /* Synchronisation Strava                                              */
  /* ------------------------------------------------------------------ */

  function showStravaMsg(text) {
    const msg = document.getElementById("stravaMsg");
    msg.textContent = text;
    msg.classList.remove("hidden");
  }

  async function handleStravaSync() {
    if (!window.StravaSync) return;
    const btn = document.getElementById("stravaSyncBtn");
    const prevLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Récupération…";
    document.getElementById("stravaMsg").classList.add("hidden");

    try {
      const activity = await window.StravaSync.fetchLatestRun();
      if (!activity) {
        showStravaMsg("Aucune course récente trouvée sur ton compte Strava.");
        return;
      }
      if (save.stravaLastActivityId === activity.id) {
        showStravaMsg("Cette course a déjà été comptabilisée.");
        return;
      }

      const distanceKm = activity.distance / 1000;
      const paceMinPerKm = distanceKm > 0 ? (activity.moving_time / 60) / distanceKm : Infinity;
      const fastBonus = paceMinPerKm < 6 ? 1.3 : 1;
      const xpGain = Math.max(1, Math.round(distanceKm * 15 * fastBonus));
      const goldGain = Math.max(1, Math.round(distanceKm * 6 * fastBonus));

      save.stravaLastActivityId = activity.id;
      save.realDistanceKm += distanceKm;
      save.totalGold += goldGain;
      grantXp(xpGain);

      ensureDailyQuest();
      let questMsg = "";
      if (!save.dailyQuest.completed) {
        save.dailyQuest.progressKm += distanceKm;
        if (save.dailyQuest.progressKm >= save.dailyQuest.targetKm) {
          save.dailyQuest.completed = true;
          save.dungeonKeys += 1;
          questMsg = " Quête du Système complétée : +1 🔑 Clé de Faille !";
        }
      }

      persist();
      refreshMenu();

      showStravaMsg(
        `« ${activity.name || "Course"} » (${distanceKm.toFixed(1)} km) : +${xpGain} XP, +${goldGain} 💰` +
        (fastBonus > 1 ? " — bonus vitesse !" : "") + questMsg
      );
    } catch (e) {
      showStravaMsg(e.message || "Erreur lors de la synchronisation Strava.");
    } finally {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  }

  function goMenu() {
    gameState = "menu";
    hud.classList.add("hidden");
    controls.classList.add("hidden");
    refreshMenu();
    showScreen("menu");
  }

  function startRun(dungeonTier) {
    run = newRun(dungeonTier);
    entities = [];
    particles = [];
    spawnTimer = 0.4;
    runTimer = 0;
    lastFrame = 0;
    gameState = "playing";
    hud.classList.remove("hidden");
    controls.classList.remove("hidden");
    showScreen(null);
    animRAF = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (gameState === "playing") {
      gameState = "paused";
      showScreen("pause");
    } else if (gameState === "paused") {
      gameState = "playing";
      showScreen(null);
      lastFrame = 0;
      animRAF = requestAnimationFrame(loop);
    }
  }

  function endRun() {
    if (gameState !== "playing") return;
    gameState = "gameover";
    save.totalGold += run.gold;
    save.bestDistance = Math.max(save.bestDistance, run.distance);
    persist();

    document.getElementById("resDistance").textContent = `${Math.floor(run.distance)} m`;
    document.getElementById("resGold").textContent = `${run.gold}`;
    document.getElementById("resXp").textContent = `${run.xpGained}`;
    document.getElementById("resBest").textContent = `${Math.floor(save.bestDistance)} m`;

    hud.classList.add("hidden");
    controls.classList.add("hidden");
    showScreen("gameover");
  }

  /* ------------------------------------------------------------------ */
  /* Boutique                                                             */
  /* ------------------------------------------------------------------ */

  const DUNGEON_KEY_COST = 70;

  function renderShop() {
    document.getElementById("shopGold").textContent = save.totalGold;
    const list = document.getElementById("shopList");
    list.innerHTML = "";

    const keyItem = document.createElement("div");
    keyItem.className = "shop-item";
    keyItem.innerHTML = `
      <div class="shop-item-info">
        <strong>Clé de Faille</strong>
        <small>Ouvre l'accès à une Faille (tu en as ${save.dungeonKeys})</small>
      </div>
    `;
    const keyBtn = document.createElement("button");
    keyBtn.className = "shop-buy";
    keyBtn.textContent = `${DUNGEON_KEY_COST} 💰`;
    keyBtn.disabled = save.totalGold < DUNGEON_KEY_COST;
    keyBtn.addEventListener("click", () => {
      if (save.totalGold < DUNGEON_KEY_COST) return;
      save.totalGold -= DUNGEON_KEY_COST;
      save.dungeonKeys += 1;
      persist();
      renderShop();
    });
    keyItem.appendChild(keyBtn);
    list.appendChild(keyItem);

    Object.keys(UPGRADES).forEach((key) => {
      const u = UPGRADES[key];
      const lvl = save.upgrades[key];
      const cost = upgradeCost(key);
      const item = document.createElement("div");
      item.className = "shop-item";

      const info = document.createElement("div");
      info.className = "shop-item-info";
      info.innerHTML = `<strong>${u.label} (Nv ${lvl}/${u.max})</strong><small>${u.desc(lvl)}</small>`;

      const btn = document.createElement("button");
      btn.className = "shop-buy";
      if (cost === null) {
        btn.textContent = "Max";
        btn.classList.add("maxed");
        btn.disabled = true;
      } else {
        btn.textContent = `${cost} 💰`;
        btn.disabled = save.totalGold < cost;
        btn.addEventListener("click", () => {
          if (save.totalGold < cost) return;
          save.totalGold -= cost;
          save.upgrades[key] += 1;
          persist();
          renderShop();
        });
      }

      item.appendChild(info);
      item.appendChild(btn);
      list.appendChild(item);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Câblage des boutons                                                  */
  /* ------------------------------------------------------------------ */

  document.getElementById("playBtn").addEventListener("click", () => startRun());
  document.getElementById("shopBtn").addEventListener("click", () => { renderShop(); showScreen("shop"); });
  document.getElementById("shopBackBtn").addEventListener("click", goMenu);
  document.getElementById("dungeonBtn").addEventListener("click", () => { renderDungeonScreen(); showScreen("dungeon"); });
  document.getElementById("dungeonBackBtn").addEventListener("click", goMenu);
  document.getElementById("howBtn").addEventListener("click", () => showScreen("how"));
  document.getElementById("howBackBtn").addEventListener("click", goMenu);
  document.getElementById("pauseBtn").addEventListener("click", togglePause);
  document.getElementById("resumeBtn").addEventListener("click", togglePause);
  document.getElementById("quitBtn").addEventListener("click", () => { gameState = "menu"; goMenu(); });
  document.getElementById("retryBtn").addEventListener("click", () => startRun());
  document.getElementById("menuBtn").addEventListener("click", goMenu);
  document.getElementById("dungeonRetryBtn").addEventListener("click", () => { renderDungeonScreen(); showScreen("dungeon"); });
  document.getElementById("dungeonMenuBtn").addEventListener("click", goMenu);

  document.getElementById("stravaConnectBtn").addEventListener("click", () => window.StravaSync && window.StravaSync.connect());
  document.getElementById("stravaSyncBtn").addEventListener("click", handleStravaSync);
  document.getElementById("stravaDisconnectBtn").addEventListener("click", () => {
    if (window.StravaSync) window.StravaSync.disconnect();
    document.getElementById("stravaMsg").classList.add("hidden");
    refreshMenu();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameState === "playing") togglePause();
  });

  goMenu();
})();
