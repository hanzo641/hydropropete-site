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
    save.xp += amount;
    let leveledUp = false;
    while (save.xp >= xpToNext(save.level)) {
      save.xp -= xpToNext(save.level);
      save.level += 1;
      leveledUp = true;
      run.hp = Math.min(run.maxHp, run.hp + run.maxHp * 0.25);
      showToast(`Niveau ${save.level} !`);
    }
    return leveledUp;
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

  function newRun() {
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
      revivesLeft: save.upgrades.revive,
      invulnT: 0,
      runTimeSec: 0,
      combo: 0,
    };
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
    const difficulty = Math.min(1, run.distance / 1400);
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

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnWave();
      const difficulty = Math.min(1, run.distance / 1400);
      spawnTimer = 1.05 - difficulty * 0.55 + Math.random() * 0.25;
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
    for (const p of particles) { p.t += dt; p.y -= p.vy * dt; p.x += p.vx * dt; }
    particles = particles.filter((p) => p.t < p.life);

    if (run.hp <= 0) {
      endRun();
    }
  }

  function resolveContact(e) {
    const def = TYPES[e.type];
    if (def.kind === "hazard") {
      if (!run.isJumping) damagePlayer(18);
      e.dead = true;
    } else if (def.kind === "enemy") {
      if (run.isAttacking) {
        e.dead = true;
        e.collected = true;
        run.combo += 1;
        const goldGain = 4 + Math.min(run.combo, 10);
        const xpGain = 6;
        run.gold += goldGain;
        run.xpGained += xpGain;
        grantXp(xpGain);
        popParticle(e.lane, `+${goldGain}💰`, "#f4c542");
      } else if (!run.isJumping) {
        damagePlayer(14);
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
    if (run.hp <= 0 && run.revivesLeft > 0) {
      run.revivesLeft -= 1;
      run.hp = run.maxHp * 0.5;
      run.invulnT = 1200;
      showToast("Résurrection !");
    }
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
    drawBackground();
    drawEntities();
    drawPlayer();
    drawParticles();
  }

  let bgScroll = 0;

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#241a4a");
    grad.addColorStop(1, "#0e0a24");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Voies (léger effet de perspective)
    bgScroll = (bgScroll + (run ? run.speed : 80) * 0.016) % 60;
    ctx.strokeStyle = "rgba(244,197,66,0.18)";
    ctx.lineWidth = 2;
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = (W / LANE_COUNT) * i;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -bgScroll;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Décor latéral (torches simplifiées) qui défile
    const decoSpacing = 220;
    const offset = (bgScroll * 3.4) % decoSpacing;
    for (let y = -decoSpacing + offset; y < H; y += decoSpacing) {
      drawTorch(14, y);
      drawTorch(W - 14, y);
    }
  }

  function drawTorch(x, y) {
    ctx.fillStyle = "#5c4a2e";
    ctx.fillRect(x - 3, y, 6, 26);
    ctx.beginPath();
    ctx.fillStyle = "rgba(244,142,66,0.9)";
    ctx.ellipse(x, y - 6, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
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
    switch (type) {
      case "rock": {
        ctx.fillStyle = "#6b6b76";
        ctx.beginPath();
        ctx.moveTo(-22, 18); ctx.lineTo(-14, -14); ctx.lineTo(6, -20);
        ctx.lineTo(22, -2); ctx.lineTo(16, 18);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(6, -20); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
        break;
      }
      case "goblin": {
        ctx.fillStyle = "#3f8f4a";
        ctx.beginPath(); ctx.ellipse(0, -6, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2f6e39";
        ctx.fillRect(-10, 6, 20, 18);
        ctx.fillStyle = "#1c1c22";
        ctx.beginPath(); ctx.arc(-5, -8, 2.4, 0, Math.PI * 2); ctx.arc(5, -8, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#caa15a"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(11, 4); ctx.lineTo(24, -10); ctx.stroke();
        break;
      }
      case "coin": {
        ctx.fillStyle = "#f4c542";
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.arc(-3, -3, 3.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "gem": {
        ctx.fillStyle = "#a978ff";
        ctx.beginPath();
        ctx.moveTo(0, -13); ctx.lineTo(11, -1); ctx.lineTo(0, 13); ctx.lineTo(-11, -1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(4, -1); ctx.lineTo(0, 3); ctx.lineTo(-4,-1); ctx.closePath(); ctx.fill();
        break;
      }
      case "potion": {
        ctx.fillStyle = "#e8536b";
        ctx.beginPath(); ctx.ellipse(0, 4, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#c23a50";
        ctx.fillRect(-4, -14, 8, 10);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.ellipse(-3, 2, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
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

    // jambes
    ctx.strokeStyle = "#3b2f66";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, 10); ctx.lineTo(-6 - runCycle * 6, 26);
    ctx.moveTo(6, 10); ctx.lineTo(6 + runCycle * 6, 26);
    ctx.stroke();

    // torse
    ctx.fillStyle = "#7c5cff";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-11, -14, 22, 26, 8) : ctx.rect(-11, -14, 22, 26);
    ctx.fill();

    // tête
    ctx.fillStyle = "#f2d3a8";
    ctx.beginPath();
    ctx.arc(0, -24, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c4a2e";
    ctx.beginPath();
    ctx.arc(0, -29, 9, Math.PI, 0);
    ctx.fill();

    // épée
    ctx.save();
    let swordAngle = -0.5;
    if (run.isAttacking) {
      const t = Math.min(1, run.attackT / ATTACK_WINDOW);
      swordAngle = -0.5 + Math.sin(t * Math.PI) * 2.3;
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
      ctx.fillStyle = p.color;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
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
    hudLevel.textContent = `Nv. ${save.level}`;
    hudDistance.textContent = `${Math.floor(run.distance)} m`;
    hudGold.textContent = `💰 ${run.gold}`;
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
    how: document.getElementById("howScreen"),
    pause: document.getElementById("pauseScreen"),
    gameover: document.getElementById("gameOverScreen"),
  };
  const hud = document.getElementById("hud");
  const controls = document.getElementById("controls");

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    if (name && screens[name]) screens[name].classList.remove("hidden");
  }

  function refreshMenu() {
    document.getElementById("menuLevel").textContent = `Nv. ${save.level}`;
    document.getElementById("menuBest").textContent = `${Math.floor(save.bestDistance)} m`;
    document.getElementById("menuGold").textContent = `💰 ${save.totalGold}`;
  }

  function goMenu() {
    gameState = "menu";
    hud.classList.add("hidden");
    controls.classList.add("hidden");
    refreshMenu();
    showScreen("menu");
  }

  function startRun() {
    run = newRun();
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

  function renderShop() {
    document.getElementById("shopGold").textContent = save.totalGold;
    const list = document.getElementById("shopList");
    list.innerHTML = "";
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

  document.getElementById("playBtn").addEventListener("click", startRun);
  document.getElementById("shopBtn").addEventListener("click", () => { renderShop(); showScreen("shop"); });
  document.getElementById("shopBackBtn").addEventListener("click", goMenu);
  document.getElementById("howBtn").addEventListener("click", () => showScreen("how"));
  document.getElementById("howBackBtn").addEventListener("click", goMenu);
  document.getElementById("pauseBtn").addEventListener("click", togglePause);
  document.getElementById("resumeBtn").addEventListener("click", togglePause);
  document.getElementById("quitBtn").addEventListener("click", () => { gameState = "menu"; goMenu(); });
  document.getElementById("retryBtn").addEventListener("click", startRun);
  document.getElementById("menuBtn").addEventListener("click", goMenu);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameState === "playing") togglePause();
  });

  goMenu();
})();
