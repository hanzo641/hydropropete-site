/* ==========================================================================
   Le Système — match-3 RPG mobile (Canvas 2D, vanilla JS, sans dépendance)
   ========================================================================== */

(() => {
  "use strict";

  function sfx(name) {
    if (window.GameAudio) window.GameAudio.play(name);
  }

  /* ------------------------------------------------------------------ */
  /* Constantes de jeu                                                   */
  /* ------------------------------------------------------------------ */

  const ROWS = 8;
  const COLS = 7;
  const TILE_TYPES = ["rune", "gold", "ember", "sap", "shadow", "crystal"];
  const SAVE_KEY = "echoRoyaumeSave_v1";
  const SHADOW_THRESHOLD = 5; // tuiles d'Ombre alignées avant que l'Armée d'Ombres se lève
  const FLOOR_BASE_MOVES = 22;

  function floorGoal(n) { return 50 + (n - 1) * 20; }
  function floorMoves(n) { return Math.max(14, FLOOR_BASE_MOVES - Math.floor((n - 1) / 3)); }

  const SWAP_MS = 180;
  const NUDGE_MS = 200;
  const POP_MS = 200;
  const FALL_MS = 260;

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
    { rank: "E", label: "Faille de Rang E", minLevel: 1,  moves: 16, strikeEvery: 4, bossHp: 14, bossDamage: 14, keyCost: 1, rewardGold: 40,  rewardXp: 60 },
    { rank: "D", label: "Faille de Rang D", minLevel: 10, moves: 17, strikeEvery: 4, bossHp: 20, bossDamage: 18, keyCost: 1, rewardGold: 90,  rewardXp: 120 },
    { rank: "C", label: "Faille de Rang C", minLevel: 20, moves: 18, strikeEvery: 3, bossHp: 28, bossDamage: 22, keyCost: 1, rewardGold: 160, rewardXp: 200 },
    { rank: "B", label: "Faille de Rang B", minLevel: 30, moves: 19, strikeEvery: 3, bossHp: 36, bossDamage: 28, keyCost: 2, rewardGold: 280, rewardXp: 320 },
    { rank: "A", label: "Faille de Rang A", minLevel: 40, moves: 20, strikeEvery: 3, bossHp: 46, bossDamage: 34, keyCost: 2, rewardGold: 450, rewardXp: 500 },
    { rank: "S", label: "Faille de Rang S", minLevel: 50, moves: 22, strikeEvery: 2, bossHp: 58, bossDamage: 42, keyCost: 3, rewardGold: 750, rewardXp: 820 },
  ];

  const UPGRADES = {
    hp: {
      label: "Cœur Ancien",
      desc: (lvl) => `+${lvl * 15} PV max`,
      max: 6,
      baseCost: 40,
      costGrowth: 1.5,
    },
    power: {
      label: "Gantelet du Chasseur",
      desc: (lvl) => `+${lvl} dégât par Braise alignée`,
      max: 5,
      baseCost: 55,
      costGrowth: 1.6,
    },
    moves: {
      label: "Sablier de Faille",
      desc: (lvl) => `+${lvl * 2} coups de départ`,
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
      bestCombo: 0,
      currentFloor: 1,
      upgrades: { hp: 0, power: 0, moves: 0, revive: 0 },
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
      const rankChanged = newRank !== prevRank;
      showToast(rankChanged ? `RANG ${newRank} ATTEINT !` : `Niveau ${save.level} !`);
      sfx(rankChanged ? "rankUp" : "levelUp");
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
    return 100 + save.upgrades.hp * 15;
  }

  /* ------------------------------------------------------------------ */
  /* Canvas & redimensionnement                                          */
  /* ------------------------------------------------------------------ */

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  let tileSize = 0, boardX = 0, boardY = 0, boardPixelW = 0, boardPixelH = 0;

  function layoutBoard() {
    const topGap = H * 0.24;
    const bottomGap = H * 0.05;
    const availW = W * 0.94;
    const availH = H - topGap - bottomGap;
    tileSize = Math.max(1, Math.floor(Math.min(availW / COLS, availH / ROWS)));
    boardPixelW = tileSize * COLS;
    boardPixelH = tileSize * ROWS;
    boardX = (W - boardPixelW) / 2;
    boardY = topGap;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layoutBoard();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 50));
  resize();

  function cellCenter(r, c) {
    return { x: boardX + c * tileSize + tileSize / 2, y: boardY + r * tileSize + tileSize / 2 };
  }

  function pixelToCell(x, y) {
    if (x < boardX || y < boardY || x >= boardX + boardPixelW || y >= boardY + boardPixelH) return null;
    const c = Math.floor((x - boardX) / tileSize);
    const r = Math.floor((y - boardY) / tileSize);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return { r, c };
  }

  function areAdjacent(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ------------------------------------------------------------------ */
  /* État de la partie en cours                                          */
  /* ------------------------------------------------------------------ */

  let run = null;
  let grid = [];
  let selected = null;
  let usingKeyboard = false;
  let cursor = { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) };
  let busy = false;
  let phase = "idle"; // idle | swap | nudge | pop | fall
  let phaseT = 0;
  let phaseData = null;
  let cascadeLevel = 1;
  let particles = [];
  let runTimer = 0;
  let lastFrame = 0;
  let gameState = "menu"; // menu | playing | paused | gameover
  let animRAF = null;
  let shakeTime = 0;
  let shakeMag = 0;
  let bgScroll = 0;
  let ambientT = 0;

  function triggerShake(mag, dur) {
    shakeMag = mag;
    shakeTime = dur;
  }

  function newRun(dungeonTier) {
    const movesTotal = (dungeonTier ? dungeonTier.moves : floorMoves(save.currentFloor)) + save.upgrades.moves * 2;
    return {
      mode: dungeonTier ? "dungeon" : "floor",
      tier: dungeonTier || null,
      floor: dungeonTier ? null : save.currentFloor,
      goalGold: dungeonTier ? null : floorGoal(save.currentFloor),
      maxHp: maxHpFromSave(),
      hp: maxHpFromSave(),
      gold: 0,
      xpGained: 0,
      movesLeft: movesTotal,
      movesTotal,
      bestCombo: 0,
      shadowArmy: 0,
      shadowChargeReady: false,
      revivesLeft: save.upgrades.revive,
      boss: dungeonTier ? {
        hp: dungeonTier.bossHp,
        maxHp: dungeonTier.bossHp,
        damage: dungeonTier.bossDamage,
        strikeEvery: dungeonTier.strikeEvery,
        movesSinceStrike: 0,
        hitFlash: 0,
      } : null,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Plateau : génération, correspondances, gravité                      */
  /* ------------------------------------------------------------------ */

  function randomType() { return TILE_TYPES[(Math.random() * TILE_TYPES.length) | 0]; }

  function swapCells(g, a, b) {
    const tmp = g[a.r][a.c];
    g[a.r][a.c] = g[b.r][b.c];
    g[b.r][b.c] = tmp;
  }

  function findMatches(g) {
    const flagged = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (let r = 0; r < ROWS; r++) {
      let count = 1;
      for (let c = 1; c <= COLS; c++) {
        const sameAsPrev = c < COLS && g[r][c].type === g[r][c - 1].type;
        if (sameAsPrev) { count++; }
        else {
          if (count >= 3) for (let k = c - count; k < c; k++) flagged[r][k] = true;
          count = 1;
        }
      }
    }

    for (let c = 0; c < COLS; c++) {
      let count = 1;
      for (let r = 1; r <= ROWS; r++) {
        const sameAsPrev = r < ROWS && g[r][c].type === g[r - 1][c].type;
        if (sameAsPrev) { count++; }
        else {
          if (count >= 3) for (let k = r - count; k < r; k++) flagged[k][c] = true;
          count = 1;
        }
      }
    }

    const cells = [];
    const typeCounts = {};
    const cellsByType = {};
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (flagged[r][c]) {
          cells.push({ r, c });
          const t = g[r][c].type;
          typeCounts[t] = (typeCounts[t] || 0) + 1;
          (cellsByType[t] = cellsByType[t] || []).push({ r, c });
        }
      }
    }
    return { total: cells.length, cells, typeCounts, cellsByType };
  }

  function hasAnyMove(g) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c + 1 < COLS) {
          swapCells(g, { r, c }, { r, c: c + 1 });
          const m = findMatches(g).total > 0;
          swapCells(g, { r, c }, { r, c: c + 1 });
          if (m) return true;
        }
        if (r + 1 < ROWS) {
          swapCells(g, { r, c }, { r: r + 1, c });
          const m = findMatches(g).total > 0;
          swapCells(g, { r, c }, { r: r + 1, c });
          if (m) return true;
        }
      }
    }
    return false;
  }

  function generateBoard() {
    let g;
    do {
      g = [];
      for (let r = 0; r < ROWS; r++) {
        g.push([]);
        for (let c = 0; c < COLS; c++) {
          let t;
          do { t = randomType(); }
          while (
            (c >= 2 && g[r][c - 1].type === t && g[r][c - 2].type === t) ||
            (r >= 2 && g[r - 1][c].type === t && g[r - 2][c].type === t)
          );
          g[r].push({ type: t, fallOffset: 0, fallStart: 0, popping: false });
        }
      }
    } while (!hasAnyMove(g));
    return g;
  }

  function computeGravity() {
    for (let c = 0; c < COLS; c++) {
      const survivors = [];
      for (let r = 0; r < ROWS; r++) if (grid[r][c]) survivors.push({ type: grid[r][c].type, fromRow: r });
      const missing = ROWS - survivors.length;
      const newCol = [];
      for (let r = 0; r < ROWS; r++) {
        if (r < missing) {
          const off = -(missing - r) * tileSize;
          newCol.push({ type: randomType(), fallOffset: off, fallStart: off, popping: false });
        } else {
          const s = survivors[r - missing];
          const off = (s.fromRow - r) * tileSize;
          newCol.push({ type: s.type, fallOffset: off, fallStart: off, popping: false });
        }
      }
      for (let r = 0; r < ROWS; r++) grid[r][c] = newCol[r];
    }
  }

  /* ------------------------------------------------------------------ */
  /* Particules                                                           */
  /* ------------------------------------------------------------------ */

  function spawnSparksAt(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 100;
      particles.push({
        kind: "spark", x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        t: 0, life: 0.3 + Math.random() * 0.2,
        color, size: 1.5 + Math.random() * 2,
      });
    }
  }

  function popTextAt(x, y, text, color) {
    particles.push({ x, y, vx: 0, vy: 42, t: 0, life: 0.7, text, color });
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.t += dt;
      if (p.kind === "spark") {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt;
      } else {
        p.y -= p.vy * dt; p.x += p.vx * dt;
      }
    }
    particles = particles.filter((p) => p.t < p.life);
  }

  /* ------------------------------------------------------------------ */
  /* Armée d'Ombres / dégâts                                             */
  /* ------------------------------------------------------------------ */

  function maybeChargeShadow() {
    if (run.shadowArmy > 0 && run.shadowArmy % SHADOW_THRESHOLD === 0 && !run.shadowChargeReady) {
      run.shadowChargeReady = true;
      showToast("Ombres, debout !");
      sfx("shadowCharge");
    }
  }

  function damagePlayer(amount) {
    run.hp = Math.max(0, run.hp - amount);
    if (run.hp <= 0 && run.revivesLeft > 0) {
      run.revivesLeft -= 1;
      run.hp = Math.max(1, Math.round(run.maxHp * 0.5));
      showToast("Résurrection !");
      sfx("revive");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Récompenses de correspondance                                       */
  /* ------------------------------------------------------------------ */

  function applyMatchRewards(matched, level) {
    const mult = 1 + (level - 1) * 0.5;
    const emberDmgPerTile = 1 + save.upgrades.power;

    Object.keys(matched.typeCounts).forEach((type) => {
      const n = matched.typeCounts[type];
      if (n <= 0) return;
      const cells = matched.cellsByType[type];
      const cx = cells.reduce((s, c) => s + cellCenter(c.r, c.c).x, 0) / cells.length;
      const cy = cells.reduce((s, c) => s + cellCenter(c.r, c.c).y, 0) / cells.length;

      if (type === "gold") {
        const g = Math.max(1, Math.round(n * 2 * mult));
        run.gold += g;
        popTextAt(cx, cy, `+${g}💰`, "#f4c542");
        spawnSparksAt(cx, cy, "#f4c542", 4 + n);
        sfx("coin");
      } else if (type === "rune") {
        const xp = Math.max(1, Math.round(n * 3 * mult));
        run.xpGained += xp;
        grantXp(xp);
        popTextAt(cx, cy, `+${xp} XP`, "#4fd6ff");
        spawnSparksAt(cx, cy, "#4fd6ff", 4 + n);
        sfx("rune");
      } else if (type === "sap") {
        const heal = Math.max(1, Math.round(n * 4 * mult));
        run.hp = Math.min(run.maxHp, run.hp + heal);
        popTextAt(cx, cy, "+PV", "#4ade80");
        spawnSparksAt(cx, cy, "#4ade80", 4 + n);
        sfx("potion");
      } else if (type === "shadow") {
        run.shadowArmy += n;
        popTextAt(cx, cy, "🖤", "#8b7cff");
        spawnSparksAt(cx, cy, "#8b7cff", 4 + n);
        maybeChargeShadow();
      } else if (type === "ember") {
        if (run.mode === "dungeon" && run.boss) {
          const dmg = Math.max(1, Math.round(n * emberDmgPerTile * mult));
          run.boss.hp -= dmg;
          run.boss.hitFlash = 0.15;
          const bp = bossPos();
          popTextAt(bp.x, bp.y, `-${dmg}`, "#ff6b81");
          spawnSparksAt(bp.x, bp.y, "#ff4d6d", 6 + n);
          triggerShake(3, 0.08);
        } else {
          const g = Math.max(1, Math.round(n * 1.5 * mult));
          run.gold += g;
          popTextAt(cx, cy, `+${g}💰`, "#ff6a3d");
          spawnSparksAt(cx, cy, "#ff6a3d", 4 + n);
        }
        sfx("attack");
      } else if (type === "crystal") {
        const g = Math.max(1, Math.round(n * mult));
        const xp = Math.max(1, Math.round(n * mult));
        run.gold += g;
        run.xpGained += xp;
        grantXp(xp);
        popTextAt(cx, cy, "✦", "#ff9ecb");
        spawnSparksAt(cx, cy, "#ff9ecb", 4 + n);
        sfx("gem");
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Machine à états des coups (échange, pop, chute, cascade)            */
  /* ------------------------------------------------------------------ */

  function beginPhase(name, data) {
    phase = name;
    phaseT = 0;
    phaseData = data;
  }

  function trySwap(a, b) {
    if (busy) return;
    busy = true;
    const typeA = grid[a.r][a.c].type;
    const typeB = grid[b.r][b.c].type;
    swapCells(grid, a, b);
    const matched = findMatches(grid);
    if (matched.total > 0) {
      run.movesLeft -= 1;
      if (run.mode === "dungeon" && run.boss) run.boss.movesSinceStrike += 1;
      beginPhase("swap", {
        floaters: [
          { type: typeA, from: a, to: b },
          { type: typeB, from: b, to: a },
        ],
        matched,
      });
    } else {
      swapCells(grid, a, b);
      sfx("click");
      beginPhase("nudge", {
        floaters: [
          { type: typeA, from: a, to: b },
          { type: typeB, from: b, to: a },
        ],
      });
    }
  }

  function handleCellTap(cell) {
    if (busy) return;
    if (!selected) { selected = cell; sfx("click"); return; }
    if (selected.r === cell.r && selected.c === cell.c) { selected = null; return; }
    if (areAdjacent(selected, cell)) {
      const a = selected;
      selected = null;
      trySwap(a, cell);
    } else {
      selected = cell;
      sfx("click");
    }
  }

  function processCascadeStep(matched) {
    applyMatchRewards(matched, cascadeLevel);
    if (cascadeLevel >= 2) showToast(`Combo x${cascadeLevel} !`);
    matched.cells.forEach(({ r, c }) => { grid[r][c].popping = true; });
    beginPhase("pop", { cells: matched.cells });
  }

  function onSwapAnimDone() {
    processCascadeStep(phaseData.matched);
  }

  function onNudgeDone() {
    busy = false;
    phase = "idle";
  }

  function onPopDone() {
    for (const { r, c } of phaseData.cells) grid[r][c] = null;
    computeGravity();
    beginPhase("fall", {});
  }

  function onFallDone() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        grid[r][c].fallOffset = 0;
        grid[r][c].fallStart = 0;
      }
    }
    const matched = findMatches(grid);
    if (matched.total > 0) {
      cascadeLevel += 1;
      run.bestCombo = Math.max(run.bestCombo, cascadeLevel - 1);
      processCascadeStep(matched);
    } else {
      settleTurn();
    }
  }

  function settleTurn() {
    busy = false;
    phase = "idle";
    cascadeLevel = 1;

    if (run.mode === "dungeon" && run.boss) {
      if (run.boss.hp <= 0) { finishDungeon(true); return; }

      if (run.boss.movesSinceStrike >= run.boss.strikeEvery) {
        run.boss.movesSinceStrike = 0;
        if (run.shadowChargeReady) {
          run.shadowChargeReady = false;
          showToast("Les Ombres interceptent le coup !");
          sfx("shadowConsume");
          const bp = bossPos();
          spawnSparksAt(bp.x, bp.y, "#8b7cff", 14);
        } else {
          sfx("hitPlayer");
          triggerShake(6, 0.15);
          damagePlayer(run.boss.damage);
        }
      }
      if (run.hp <= 0) { finishDungeon(false); return; }
    }

    if (run.mode === "floor" && run.goalGold != null && run.gold >= run.goalGold) {
      finishFloor(true);
      return;
    }

    if (run.movesLeft <= 0) {
      if (run.mode === "dungeon") finishDungeon(false);
      else finishFloor(false);
      return;
    }

    if (!hasAnyMove(grid)) {
      grid = generateBoard();
      showToast("Le Système remélange la Faille...");
    }
  }

  function update(dt) {
    ambientT += 0.016;
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    updateParticles(dt);

    if (phase === "idle") return;
    phaseT += dt * 1000;

    if (phase === "swap") {
      if (phaseT >= SWAP_MS) onSwapAnimDone();
    } else if (phase === "nudge") {
      if (phaseT >= NUDGE_MS) onNudgeDone();
    } else if (phase === "pop") {
      if (phaseT >= POP_MS) onPopDone();
    } else if (phase === "fall") {
      const p = Math.min(1, phaseT / FALL_MS);
      const e = easeOutCubic(p);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = grid[r][c];
          if (cell && cell.fallStart) cell.fallOffset = cell.fallStart * (1 - e);
        }
      }
      if (phaseT >= FALL_MS) onFallDone();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                                */
  /* ------------------------------------------------------------------ */

  function bossPos() {
    return { x: boardX + boardPixelW / 2, y: boardY - 60 };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeTime > 0) {
      ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
    }
    drawBackground();
    if (run && run.mode === "dungeon" && run.boss) drawBoss();
    drawBoard();
    drawParticles();
    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a1240");
    grad.addColorStop(0.55, "#130d30");
    grad.addColorStop(1, "#08061a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const pulse = 0.5 + Math.sin(ambientT * 1.4) * 0.5;
    const vanishY = H * 0.1;
    const halo = ctx.createRadialGradient(W / 2, vanishY, 0, W / 2, vanishY, W * 0.55);
    halo.addColorStop(0, `rgba(79, 214, 255, ${0.16 + pulse * 0.07})`);
    halo.addColorStop(1, "rgba(79, 214, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

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

    bgScroll = (bgScroll + 0.35) % 220;
    const decoSpacing = 220;
    const offset = bgScroll;
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

  const motes = Array.from({ length: 26 }, () => ({
    xf: Math.random(),
    yf: Math.random(),
    size: 1 + Math.random() * 2,
    speed: 8 + Math.random() * 18,
    phase: Math.random() * Math.PI * 2,
  }));

  function drawBoss() {
    const boss = run.boss;
    const { x, y } = bossPos();
    const ratio = boss.movesSinceStrike / boss.strikeEvery;
    const warning = ratio >= 0.66;
    const warnRatio = Math.max(0, Math.min(1, (ratio - 0.66) / 0.34));
    const pulse = 0.5 + Math.sin(ambientT * 5) * 0.5;

    ctx.save();
    ctx.translate(x, y);

    if (warning) {
      const ringR = 58 - warnRatio * 30;
      ctx.strokeStyle = `rgba(255, 77, 109, ${0.3 + warnRatio * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 34, ringR, ringR * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(74, 16, 48, ${0.35 + pulse * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(0, -6, 46, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1c0714";
    for (const sx of [-22, -10, 10, 22]) {
      ctx.beginPath();
      ctx.moveTo(sx, -34);
      ctx.lineTo(sx - 5, -12);
      ctx.lineTo(sx + 5, -12);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = boss.hitFlash > 0 ? "#ffb0bd" : "#3a0c26";
    ctx.beginPath();
    ctx.ellipse(0, -10, 32, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boss.hitFlash > 0 ? "#ffcdd6" : "#2c0a1e";
    ctx.beginPath();
    ctx.moveTo(-26, 16); ctx.lineTo(26, 16); ctx.lineTo(20, 44); ctx.lineTo(-20, 44);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 120, 150, ${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -24); ctx.lineTo(-4, -6); ctx.lineTo(-10, 10);
    ctx.moveTo(-4, -6); ctx.lineTo(8, 2);
    ctx.stroke();

    ctx.save();
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = 10 + pulse * 8;
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(-12, -18, 5.5, 0, Math.PI * 2);
    ctx.arc(12, -18, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - 0.03);

    ctx.restore();
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawCellBg(r, c) {
    const x = boardX + c * tileSize, y = boardY + r * tileSize;
    const pad = 2;
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRectPath(x + pad, y + pad, tileSize - pad * 2, tileSize - pad * 2, 8);
    ctx.fill();
    ctx.stroke();
  }

  function drawTileIcon(type, cx, cy, size, scale) {
    scale = scale || 1;
    const s = size * 0.36 * scale;
    ctx.save();
    ctx.translate(cx, cy);
    switch (type) {
      case "gold": {
        ctx.save(); ctx.shadowColor = "#f4c542"; ctx.shadowBlur = 8;
        ctx.fillStyle = "#f4c542"; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.strokeStyle = "rgba(180,130,20,0.6)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.3, s * 0.28, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "crystal": {
        ctx.save(); ctx.shadowColor = "#ff9ecb"; ctx.shadowBlur = 9;
        ctx.fillStyle = "#ff9ecb";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.15); ctx.lineTo(s, -s * 0.1); ctx.lineTo(0, s * 1.15); ctx.lineTo(-s, -s * 0.1);
        ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.15); ctx.lineTo(s * 0.35, -s * 0.1); ctx.lineTo(0, s * 0.25); ctx.lineTo(-s * 0.35, -s * 0.1);
        ctx.closePath(); ctx.fill();
        break;
      }
      case "ember": {
        ctx.save(); ctx.shadowColor = "#ff6a3d"; ctx.shadowBlur = 9;
        ctx.fillStyle = "#ff6a3d";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.2);
        ctx.quadraticCurveTo(s * 0.9, -s * 0.2, s * 0.5, s * 0.8);
        ctx.quadraticCurveTo(0, s * 1.25, -s * 0.5, s * 0.8);
        ctx.quadraticCurveTo(-s * 0.9, -s * 0.2, 0, -s * 1.2);
        ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = "rgba(255,220,150,0.85)";
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.quadraticCurveTo(s * 0.35, s * 0.1, s * 0.15, s * 0.55);
        ctx.quadraticCurveTo(0, s * 0.7, -s * 0.15, s * 0.55);
        ctx.quadraticCurveTo(-s * 0.35, s * 0.1, 0, -s * 0.5);
        ctx.closePath(); ctx.fill();
        break;
      }
      case "sap": {
        ctx.save(); ctx.shadowColor = "#4ade80"; ctx.shadowBlur = 7;
        ctx.fillStyle = "#4ade80";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.2);
        ctx.quadraticCurveTo(s * 0.9, -s * 0.1, 0, s * 1.15);
        ctx.quadraticCurveTo(-s * 0.9, -s * 0.1, 0, -s * 1.2);
        ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.lineTo(0, s * 0.9); ctx.stroke();
        break;
      }
      case "shadow": {
        ctx.fillStyle = "rgba(139,124,255,0.28)";
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 1.05, s * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#241a3a";
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, s * 0.6); ctx.lineTo(-s * 0.75, -s * 0.2); ctx.lineTo(-s * 0.3, -s * 1.0);
        ctx.lineTo(s * 0.3, -s * 1.0); ctx.lineTo(s * 0.75, -s * 0.2); ctx.lineTo(s * 0.7, s * 0.6);
        ctx.lineTo(s * 0.35, s * 1.05); ctx.lineTo(-s * 0.35, s * 1.05); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.shadowColor = "#ff4d6d"; ctx.shadowBlur = 6;
        ctx.fillStyle = "#8b7cff";
        ctx.beginPath();
        ctx.arc(-s * 0.28, -s * 0.15, s * 0.16, 0, Math.PI * 2);
        ctx.arc(s * 0.28, -s * 0.15, s * 0.16, 0, Math.PI * 2);
        ctx.fill(); ctx.restore();
        break;
      }
      case "rune": {
        ctx.save(); ctx.shadowColor = "#4fd6ff"; ctx.shadowBlur = 9;
        ctx.fillStyle = "#4fd6ff";
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.2); ctx.lineTo(s * 0.32, -s * 0.3); ctx.lineTo(s * 1.2, 0);
        ctx.lineTo(s * 0.32, s * 0.3); ctx.lineTo(0, s * 1.2); ctx.lineTo(-s * 0.32, s * 0.3);
        ctx.lineTo(-s * 1.2, 0); ctx.lineTo(-s * 0.32, -s * 0.3); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  function drawTile(r, c, cell) {
    if (!cell) return;
    const { x, y } = cellCenter(r, c);
    let scale = 1, alpha = 1;
    if (cell.popping) {
      const p = Math.min(1, phaseT / POP_MS);
      scale = 1 - p;
      alpha = 1 - p;
    }
    const dy = cell.fallOffset || 0;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawTileIcon(cell.type, x, y + dy, tileSize, scale);
    ctx.restore();
  }

  function drawSelection(cell, dim) {
    const { x, y } = cellCenter(cell.r, cell.c);
    const pulse = 0.5 + Math.sin(ambientT * 6) * 0.5;
    ctx.save();
    ctx.strokeStyle = dim ? "rgba(79,214,255,0.35)" : `rgba(79,214,255,${0.6 + pulse * 0.4})`;
    ctx.lineWidth = dim ? 2 : 3;
    const s = tileSize * 0.86;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    ctx.restore();
  }

  function drawBoard() {
    if (!run || !grid.length) return;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawCellBg(r, c);

    const floating = (phase === "swap" || phase === "nudge") ? phaseData.floaters : null;
    const skip = new Set();
    if (floating) floating.forEach((f) => skip.add(`${f.from.r},${f.from.c}`));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (skip.has(`${r},${c}`)) continue;
        drawTile(r, c, grid[r][c]);
      }
    }

    if (floating) {
      const duration = phase === "swap" ? SWAP_MS : NUDGE_MS;
      const p = Math.min(1, phaseT / duration);
      const e = easeOutCubic(p);
      floating.forEach((f) => {
        const from = cellCenter(f.from.r, f.from.c);
        const to = cellCenter(f.to.r, f.to.c);
        let x, y;
        if (phase === "swap") {
          x = lerp(from.x, to.x, e); y = lerp(from.y, to.y, e);
        } else {
          const bump = Math.sin(p * Math.PI) * 0.32;
          x = lerp(from.x, to.x, bump); y = lerp(from.y, to.y, bump);
        }
        drawTileIcon(f.type, x, y, tileSize, 1);
      });
    }

    if (selected) drawSelection(selected, false);
    else if (usingKeyboard) drawSelection(cursor, true);
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
    dt = Math.min(dt, 0.05);

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
  const hudMoves = document.getElementById("hudMoves");
  const hudGold = document.getElementById("hudGold");

  function updateHud() {
    if (!run) return;
    hpFill.style.width = `${Math.max(0, (run.hp / run.maxHp) * 100)}%`;
    xpFill.style.width = `${Math.min(100, (save.xp / xpToNext(save.level)) * 100)}%`;
    hudLevel.textContent = run.mode === "floor"
      ? `Étage ${run.floor} · Rang ${rankForLevel(save.level)}`
      : `Rang ${rankForLevel(save.level)} · Nv ${save.level}`;
    hudMoves.textContent = `🎯 ${run.movesLeft}/${run.movesTotal}`;
    hudGold.textContent = run.goalGold != null ? `💰 ${run.gold}/${run.goalGold}` : `💰 ${run.gold}`;

    const bossBarEl = document.getElementById("bossBar");
    if (run.mode === "dungeon" && run.boss) {
      bossBarEl.classList.remove("hidden");
      document.getElementById("bossFill").style.width = `${Math.max(0, (run.boss.hp / run.boss.maxHp) * 100)}%`;
      const left = Math.max(0, run.boss.strikeEvery - run.boss.movesSinceStrike);
      document.getElementById("bossStrikeInfo").textContent = `Prochain coup dans ${left} coup(s)`;
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
    floorwin: document.getElementById("floorWinScreen"),
  };
  const hud = document.getElementById("hud");

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    if (name && screens[name]) screens[name].classList.remove("hidden");
  }

  function refreshMenu() {
    ensureDailyQuest();

    document.getElementById("menuLevel").textContent = `Rang ${rankForLevel(save.level)} · Nv ${save.level}`;
    document.getElementById("menuBest").textContent = `×${save.bestCombo}`;
    document.getElementById("menuGold").textContent = `💰 ${save.totalGold}`;
    document.getElementById("menuKeys").textContent = `🔑 ${save.dungeonKeys}`;
    document.getElementById("playBtn").textContent = `Jouer — Étage ${save.currentFloor}`;

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
        <small>${unlocked ? `${tier.moves + save.upgrades.moves * 2} coups · Coût : ${tier.keyCost} 🔑` : `Débloquée au Rang ${tier.rank} (Nv ${tier.minLevel})`}</small>
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

  /* ------------------------------------------------------------------ */
  /* Cycle de partie                                                      */
  /* ------------------------------------------------------------------ */

  function goMenu() {
    gameState = "menu";
    hud.classList.add("hidden");
    window.GameAudio && window.GameAudio.stopAmbient();
    refreshMenu();
    showScreen("menu");
  }

  function startRun(dungeonTier) {
    run = newRun(dungeonTier);
    grid = generateBoard();
    selected = null;
    cursor = { r: Math.floor(ROWS / 2), c: Math.floor(COLS / 2) };
    phase = "idle"; phaseT = 0; phaseData = null; busy = false; cascadeLevel = 1;
    particles = [];
    gameState = "playing";
    hud.classList.remove("hidden");
    showScreen(null);
    lastFrame = 0;
    animRAF = requestAnimationFrame(loop);
    window.GameAudio && window.GameAudio.startAmbient();
    if (dungeonTier) {
      showToast("Un Gardien de Faille apparaît !");
      sfx("bossAppear");
    }
    updateHud();
  }

  function togglePause() {
    if (gameState === "playing") {
      gameState = "paused";
      showScreen("pause");
      window.GameAudio && window.GameAudio.stopAmbient();
    } else if (gameState === "paused") {
      gameState = "playing";
      showScreen(null);
      lastFrame = 0;
      animRAF = requestAnimationFrame(loop);
      window.GameAudio && window.GameAudio.startAmbient();
    }
  }

  function finishFloor(victory) {
    if (gameState !== "playing") return;
    gameState = "gameover";
    save.totalGold += run.gold;
    save.bestCombo = Math.max(save.bestCombo, run.bestCombo);
    if (victory) save.currentFloor += 1;
    persist();
    window.GameAudio && window.GameAudio.stopAmbient();
    sfx(victory ? "victory" : "defeat");

    if (victory) {
      document.getElementById("floorWinNumber").textContent = `${run.floor}`;
      document.getElementById("floorWinGoal").textContent = `${run.goalGold}`;
      document.getElementById("floorWinGold").textContent = `${run.gold}`;
      document.getElementById("floorWinXp").textContent = `${run.xpGained}`;
      hud.classList.add("hidden");
      showScreen("floorwin");
    } else {
      document.getElementById("resDistance").textContent = `×${run.bestCombo}`;
      document.getElementById("resGold").textContent = `${run.gold}`;
      document.getElementById("resXp").textContent = `${run.xpGained}`;
      document.getElementById("resBest").textContent = `×${save.bestCombo}`;
      document.getElementById("gameOverMsg").textContent =
        `Objectif : ${run.goalGold} 💰 — tu en as récolté ${run.gold}. Retente ta chance !`;
      hud.classList.add("hidden");
      showScreen("gameover");
    }
  }

  function finishDungeon(victory) {
    if (gameState !== "playing") return;
    gameState = "gameover";

    const tier = run.tier;
    const goldTotal = run.gold + (victory ? tier.rewardGold : 0);
    const xpTotal = run.xpGained + (victory ? tier.rewardXp : 0);

    save.totalGold += run.gold + (victory ? tier.rewardGold : 0);
    save.bestCombo = Math.max(save.bestCombo, run.bestCombo);
    if (victory) grantXp(tier.rewardXp);
    persist();
    window.GameAudio && window.GameAudio.stopAmbient();
    sfx(victory ? "victory" : "defeat");

    document.getElementById("dungeonResultTitle").textContent = victory
      ? `Faille de Rang ${tier.rank} conquise !`
      : "La Faille se referme...";
    document.getElementById("dungeonResultMsg").textContent = victory
      ? "Le Gardien est vaincu. Ton butin est sécurisé."
      : "Tu n'as pas vaincu le Gardien à temps. Reviens plus fort.";
    document.getElementById("dungeonResGold").textContent = `${goldTotal}`;
    document.getElementById("dungeonResXp").textContent = `${xpTotal}`;

    hud.classList.add("hidden");
    showScreen("dungeonresult");
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
  /* Entrées : tactile / souris / clavier                                 */
  /* ------------------------------------------------------------------ */

  const SWIPE_THRESHOLD = 18; // px avant qu'un geste soit considéré comme un glissement
  let dragStartCell = null;
  let dragStartPoint = null;
  let dragHandled = false;

  canvas.addEventListener("pointerdown", (e) => {
    if (gameState !== "playing" || busy) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cell = pixelToCell(x, y);
    if (!cell) return;
    usingKeyboard = false;
    dragStartCell = cell;
    dragStartPoint = { x, y };
    dragHandled = false;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (gameState !== "playing" || busy || !dragStartCell || dragHandled) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const dx = x - dragStartPoint.x;
    const dy = y - dragStartPoint.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

    const target = Math.abs(dx) > Math.abs(dy)
      ? { r: dragStartCell.r, c: dragStartCell.c + (dx > 0 ? 1 : -1) }
      : { r: dragStartCell.r + (dy > 0 ? 1 : -1), c: dragStartCell.c };

    if (target.r >= 0 && target.r < ROWS && target.c >= 0 && target.c < COLS) {
      dragHandled = true;
      selected = null;
      trySwap(dragStartCell, target);
    }
  });

  canvas.addEventListener("pointerup", () => {
    if (dragStartCell && !dragHandled) handleCellTap(dragStartCell);
    dragStartCell = null;
    dragStartPoint = null;
  });

  window.addEventListener("keydown", (e) => {
    if (gameState === "playing" && !busy) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        usingKeyboard = true;
        if (e.key === "ArrowLeft") cursor = { ...cursor, c: Math.max(0, cursor.c - 1) };
        else if (e.key === "ArrowRight") cursor = { ...cursor, c: Math.min(COLS - 1, cursor.c + 1) };
        else if (e.key === "ArrowUp") cursor = { ...cursor, r: Math.max(0, cursor.r - 1) };
        else if (e.key === "ArrowDown") cursor = { ...cursor, r: Math.min(ROWS - 1, cursor.r + 1) };
      } else if (e.key === " " || e.key === "Enter") {
        usingKeyboard = true;
        handleCellTap({ ...cursor });
      }
    }
    if (e.key === "Escape") togglePause();
  });

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
  document.getElementById("floorNextBtn").addEventListener("click", () => startRun());
  document.getElementById("floorMenuBtn").addEventListener("click", goMenu);

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

  /* ------------------------------------------------------------------ */
  /* Audio : déverrouillage, mute, clics de menu                         */
  /* ------------------------------------------------------------------ */

  document.addEventListener("pointerdown", () => window.GameAudio && window.GameAudio.unlock(), { once: true });

  function updateMuteButtons() {
    const m = !!(window.GameAudio && window.GameAudio.isMuted());
    const icon = m ? "🔇" : "🔊";
    document.getElementById("muteBtn").textContent = icon;
    document.getElementById("muteBtnHud").textContent = icon;
  }

  function toggleMute() {
    if (!window.GameAudio) return;
    window.GameAudio.setMuted(!window.GameAudio.isMuted());
    updateMuteButtons();
    if (!window.GameAudio.isMuted() && gameState === "playing") window.GameAudio.startAmbient();
  }

  document.getElementById("muteBtn").addEventListener("click", toggleMute);
  document.getElementById("muteBtnHud").addEventListener("click", toggleMute);
  updateMuteButtons();

  document.getElementById("app").addEventListener("click", (e) => {
    if (!e.target.closest("button")) return;
    if (e.target.closest("#hud, #muteBtn")) return;
    sfx("click");
  });

  goMenu();
})();
