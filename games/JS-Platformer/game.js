/* =====================================================================
   NEON RUNNER — a small 2D platformer
   Vanilla JS + Canvas 2D. No dependencies, no build step.

   Features: running, double jump, coyote time, wall slide + wall jump,
             dashing (i-frames), 3 weapons, enemies (walker/flyer/shooter),
             stomping, coins, health packs, particles, screen shake,
             camera follow, parallax background, pause/win/death states.
   ===================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Canvas
  ------------------------------------------------------------------ */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let VW = 0, VH = 0;

  function resize() {
    VW = canvas.width = window.innerWidth;
    VH = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ------------------------------------------------------------------
     Tiny helpers
  ------------------------------------------------------------------ */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const aabb = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ------------------------------------------------------------------
     Sound (tiny WebAudio blips — no files needed)
  ------------------------------------------------------------------ */
  let actx = null;
  function sfx(freq, dur, type = 'square', vol = 0.045, slideTo = 0) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(actx.destination);
      o.start(t);
      o.stop(t + dur);
    } catch (e) { /* audio is optional */ }
  }

  /* ------------------------------------------------------------------
     World / level
  ------------------------------------------------------------------ */
  const TILE = 40;
  const COLS = 90;
  const ROWS = 26;
  const WW = COLS * TILE;
  const WH = ROWS * TILE;

  const EMPTY = 0, SOLID = 1, SPIKE = 2;

  let grid = [];

  function tileAt(cx, cy) {
    if (cx < 0 || cx >= COLS) return SOLID;  // invisible side walls
    if (cy < 0 || cy >= ROWS) return EMPTY;  // open sky above, open void below
    return grid[cy][cx];
  }
  const isSolid = (cx, cy) => tileAt(cx, cy) === SOLID;

  /* ------------------------------------------------------------------
     Game state
  ------------------------------------------------------------------ */
  let player, bullets, enemies, pickups, particles, floaters, goal;
  let state = 'play';           // play | dead | win | paused
  let score = 0;
  let enemiesLeft = 0;
  const cam = { x: 0, y: 0, shake: 0 };
  const keys = {};
  const mouse = { x: 0, y: 0, down: false };

  const WEAPONS = [
    { name: 'PISTOL',  color: '#ffe066', cd: 11, pellets: 1, spread: 0.02, speed: 16, dmg: 1, kick: 1.2, sfx: 720 },
    { name: 'SHOTGUN', color: '#ff9f43', cd: 34, pellets: 7, spread: 0.30, speed: 13, dmg: 1, kick: 5.0, sfx: 300 },
    { name: 'SMG',     color: '#7ef9ff', cd: 5,  pellets: 1, spread: 0.10, speed: 18, dmg: 1, kick: 0.7, sfx: 900 },
  ];

  /* ------------------------------------------------------------------
     Level construction
  ------------------------------------------------------------------ */
  function buildLevel() {
    grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
    enemies = [];
    pickups = [];
    bullets = [];
    particles = [];
    floaters = [];

    const set = (x, y, v) => {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) grid[y][x] = v;
    };
    const rect = (x, y, w, h, v = SOLID) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, v);
    };

    /* --- ground --- */
    rect(0, ROWS - 2, COLS, 2, SOLID);

    /* --- pits --- */
    // shallow spiked pits
    rect(20, ROWS - 2, 4, 1, EMPTY); rect(20, ROWS - 2, 4, 1, SPIKE);
    rect(60, ROWS - 2, 3, 1, EMPTY); rect(60, ROWS - 2, 3, 1, SPIKE);
    // bottomless pit (carve both ground rows)
    rect(38, ROWS - 2, 4, 2, EMPTY);

    /* --- floating platforms --- */
    rect(8, 21, 3, 1);
    rect(13, 19, 3, 1);
    rect(26, 20, 4, 1);
    rect(31, 17, 3, 1);
    rect(44, 20, 4, 1);
    rect(49, 16, 4, 1);
    rect(55, 13, 3, 1);
    rect(64, 19, 4, 1);
    rect(69, 16, 4, 1);
    rect(75, 20, 5, 1);
    rect(82, 21, 7, 1);           // goal platform

    /* --- mid-pit island (makes the bottomless gap forgiving) --- */
    rect(39, 21, 2, 1);

    /* --- staircases (readable, forgiving traversal) --- */
    rect(33, 23, 1, 1);
    rect(34, 22, 1, 2);
    rect(35, 21, 1, 3);
    rect(55, 23, 1, 1);
    rect(56, 22, 1, 2);
    rect(57, 21, 1, 3);

    /* --- overhead wall (wall-jump practice, doesn't block the path) --- */
    rect(72, 14, 1, 5);

    /* --- ceiling bits --- */
    rect(23, 12, 5, 1);
    rect(66, 11, 6, 1);

    /* --- pickups --- */
    const coin = (tx, ty) => pickups.push({ type: 'coin', x: tx * TILE + 12, y: ty * TILE + 12, w: 16, h: 16, t: Math.random() * 6, dead: false });
    const heal = (tx, ty) => pickups.push({ type: 'heal', x: tx * TILE + 10, y: ty * TILE + 10, w: 20, h: 20, t: Math.random() * 6, dead: false });

    const coinRows = [
      [8, 20], [9, 20], [10, 20],
      [13, 18], [14, 18], [15, 18],
      [23, 12], [24, 12], [25, 12], [26, 12], [27, 12],
      [31, 16], [32, 16],
      [39, 20], [40, 20],
      [44, 19], [45, 19], [46, 19],
      [49, 15], [50, 15], [51, 15],
      [55, 12], [56, 12],
      [64, 18], [65, 18], [66, 18],
      [69, 15], [70, 15], [71, 15],
      [75, 19], [76, 19], [77, 19], [78, 19],
    ];
    for (const [x, y] of coinRows) coin(x, y);

    heal(14, 18);
    heal(50, 15);
    heal(77, 19);

    /* --- enemies --- */
    const walker = (tx, ty) => {
      const h = 30;
      enemies.push({ type: 'walker', x: tx * TILE + 5, y: ty * TILE - h, w: 30, h, vx: -1.4, vy: 0, hp: 2, dir: -1, flash: 0, dead: false });
    };
    const flyer = (tx, ty) => enemies.push({
      type: 'flyer', x: tx * TILE, y: ty * TILE, w: 28, h: 28,
      hp: 2, baseY: ty * TILE, t: Math.random() * Math.PI * 2, flash: 0, dead: false,
    });
    const shooter = (tx, ty) => {
      const h = 34;
      enemies.push({ type: 'shooter', x: tx * TILE + 4, y: ty * TILE - h, w: 32, h, hp: 3, vy: 0, cd: 60, flash: 0, dead: false });
    };

    walker(10, 24);
    walker(28, 20);
    walker(46, 24);
    walker(66, 19);
    walker(76, 20);

    flyer(21, 20);
    flyer(39, 16);
    flyer(61, 20);
    flyer(70, 12);

    shooter(32, 17);
    shooter(56, 13);
    shooter(70, 16);

    /* --- goal flag --- */
    goal = { x: 86 * TILE, y: 21 * TILE - 64, w: 22, h: 64 };

    /* --- player --- */
    player = {
      x: 3 * TILE, y: (ROWS - 5) * TILE, w: 26, h: 38,
      vx: 0, vy: 0,
      onGround: false, coyote: 0, jumpBuf: 0, airJumps: 1,
      facing: 1, aim: 0,
      hp: 5, maxHp: 5, invuln: 0,
      dashTime: 0, dashCd: 0, dashDir: 1,
      wallL: false, wallR: false, wallSliding: false, wallLock: 0,
      weapon: 0, fireCd: 0,
    };

    score = 0;
    enemiesLeft = enemies.length;
    state = 'play';
    cam.x = 0; cam.y = 0; cam.shake = 0;
  }

  /* ------------------------------------------------------------------
     Collision resolution
  ------------------------------------------------------------------ */
  function moveX(e) {
    e.wallL = e.wallR = false;
    e.x += e.vx;

    const top = Math.floor(e.y / TILE);
    const bot = Math.ceil((e.y + e.h) / TILE) - 1;

    if (e.vx > 0) {
      const right = Math.ceil((e.x + e.w) / TILE) - 1;
      for (let cy = top; cy <= bot; cy++) {
        if (isSolid(right, cy)) { e.x = right * TILE - e.w; e.vx = 0; e.wallR = true; break; }
      }
    } else if (e.vx < 0) {
      const left = Math.floor(e.x / TILE);
      for (let cy = top; cy <= bot; cy++) {
        if (isSolid(left, cy)) { e.x = (left + 1) * TILE; e.vx = 0; e.wallL = true; break; }
      }
    }
  }

  function moveY(e) {
    e.onGround = false;
    e.y += e.vy;

    const midL = Math.floor((e.x + 4) / TILE);
    const midR = Math.floor((e.x + e.w - 5) / TILE);

    if (e.vy > 0) {
      const bot = Math.ceil((e.y + e.h) / TILE) - 1;
      for (let cx = midL; cx <= midR; cx++) {
        if (isSolid(cx, bot)) { e.y = bot * TILE - e.h; e.vy = 0; e.onGround = true; break; }
      }
    } else if (e.vy < 0) {
      const top = Math.floor(e.y / TILE);
      for (let cx = midL; cx <= midR; cx++) {
        if (isSolid(cx, top)) { e.y = (top + 1) * TILE; e.vy = 0; break; }
      }
    }
  }

  function touchesSpike(e) {
    const x0 = Math.floor(e.x / TILE), x1 = Math.ceil((e.x + e.w) / TILE) - 1;
    const y0 = Math.floor(e.y / TILE), y1 = Math.ceil((e.y + e.h) / TILE) - 1;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++)
        if (tileAt(cx, cy) === SPIKE) return true;
    return false;
  }

  /* ------------------------------------------------------------------
     Particles / effects
  ------------------------------------------------------------------ */
  function burst(x, y, n, color, spd = 5, life = 30, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(spd * 0.3, spd);
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(life * 0.6, life), maxLife: life,
        color, size: rand(size * 0.6, size), grav: 0.25,
      });
    }
  }

  function floatText(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 55 });
  }

  function shake(amount) { cam.shake = Math.min(24, cam.shake + amount); }

  /* ------------------------------------------------------------------
     Shooting
  ------------------------------------------------------------------ */
  function shoot() {
    const w = WEAPONS[player.weapon];
    if (player.fireCd > 0) return;
    player.fireCd = w.cd;

    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    const base = player.aim;

    for (let i = 0; i < w.pellets; i++) {
      const a = base + rand(-w.spread, w.spread);
      const sx = cx + Math.cos(a) * 20;
      const sy = cy + Math.sin(a) * 20;
      bullets.push({
        x: sx, y: sy, w: 7, h: 7,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        life: 70, dmg: w.dmg, friendly: true, color: w.color,
      });
    }

    // muzzle flash + recoil
    burst(cx + Math.cos(base) * 26, cy + Math.sin(base) * 26, 6, w.color, 4, 14, 3);
    player.vx -= Math.cos(base) * w.kick;
    if (!player.onGround) player.vy -= Math.sin(base) * w.kick * 0.5;
    shake(w.kick * 1.1);
    sfx(w.sfx, 0.06, 'square', 0.035, w.sfx * 0.4);
  }

  function enemyShoot(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const a = Math.atan2(py - cy, px - cx);
    const spd = 6;
    bullets.push({
      x: cx + Math.cos(a) * 18, y: cy + Math.sin(a) * 18, w: 9, h: 9,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life: 150, dmg: 1, friendly: false, color: '#ff5d5d',
    });
    sfx(220, 0.08, 'sawtooth', 0.03, 120);
  }

  /* ------------------------------------------------------------------
     Damage
  ------------------------------------------------------------------ */
  function hurtPlayer(amount, fromX) {
    if (player.invuln > 0 || player.dashTime > 0 || state !== 'play') return;
    player.hp -= amount;
    player.invuln = 90;
    player.vy = -8;
    player.vx = (player.x + player.w / 2 < fromX ? -1 : 1) * 8;
    shake(10);
    burst(player.x + player.w / 2, player.y + player.h / 2, 12, '#ff5d5d', 6, 26, 3);
    sfx(160, 0.18, 'square', 0.05, 60);

    if (player.hp <= 0) {
      player.hp = 0;
      state = 'dead';
      burst(player.x + player.w / 2, player.y + player.h / 2, 40, '#7ef9ff', 9, 50, 4);
      sfx(400, 0.5, 'sawtooth', 0.06, 60);
    }
  }

  function damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 6;
    if (e.hp <= 0) {
      e.dead = true;
      enemiesLeft--;
      score += e.type === 'shooter' ? 30 : e.type === 'flyer' ? 20 : 15;
      burst(e.x + e.w / 2, e.y + e.h / 2, 18, e.type === 'flyer' ? '#b18cff' : '#ff7b6b', 6, 34, 4);
      floatText(e.x + e.w / 2, e.y, '+' + (e.type === 'shooter' ? 30 : e.type === 'flyer' ? 20 : 15), '#ffe066');
      sfx(140, 0.12, 'square', 0.04, 70);
    } else {
      burst(e.x + e.w / 2, e.y + e.h / 2, 5, '#ffd0c0', 4, 16, 2);
      sfx(500, 0.04, 'square', 0.03, 300);
    }
  }

  /* ------------------------------------------------------------------
     Update — player
  ------------------------------------------------------------------ */
  function updatePlayer() {
    const p = player;

    p.invuln = Math.max(0, p.invuln - 1);
    p.fireCd = Math.max(0, p.fireCd - 1);
    p.dashCd = Math.max(0, p.dashCd - 1);
    p.wallLock = Math.max(0, p.wallLock - 1);
    p.coyote = Math.max(0, p.coyote - 1);
    p.jumpBuf = Math.max(0, p.jumpBuf - 1);

    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];
    const down = keys['s'] || keys['arrowdown'];
    const wantDash = keys['shift'];

    /* --- aim --- */
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    p.aim = Math.atan2(mouse.y + cam.y - cy, mouse.x + cam.x - cx);

    /* --- dash --- */
    if (wantDash && p.dashCd === 0 && p.dashTime === 0) {
      p.dashTime = 12;
      p.dashCd = 48;
      p.dashDir = left ? -1 : right ? 1 : (Math.cos(p.aim) < 0 ? -1 : 1);
      p.vy = 0;
      shake(6);
      sfx(600, 0.12, 'sine', 0.04, 1100);
      burst(cx, cy, 14, '#7ef9ff', 5, 22, 3);
    }

    if (p.dashTime > 0) {
      p.dashTime--;
      p.vx = p.dashDir * 17;
      p.vy = 0;
      particles.push({
        x: cx, y: cy, vx: rand(-1, 1), vy: rand(-1, 1),
        life: 16, maxLife: 16, color: '#7ef9ff', size: 6, grav: 0,
      });
    } else {
      /* --- horizontal movement --- */
      const accel = p.onGround ? 1.0 : 0.6;
      const maxSpd = 6.6;

      if (p.wallLock === 0) {
        if (left && !right) { p.vx -= accel; p.facing = -1; }
        else if (right && !left) { p.vx += accel; p.facing = 1; }
        else if (p.onGround) p.vx *= 0.80;
        else p.vx *= 0.92;
      }
      p.vx = clamp(p.vx, -maxSpd - 4, maxSpd + 4);
      if (Math.abs(p.vx) > maxSpd && p.wallLock === 0) p.vx = lerp(p.vx, maxSpd * Math.sign(p.vx), 0.2);

      /* --- gravity --- */
      p.vy += 0.72;
      if (down && !p.onGround) p.vy += 0.5;             // fast-fall
      if (p.vy > 17) p.vy = 17;
    }

    /* --- jumping --- */
    if (p.jumpBuf > 0 && p.wallLock === 0) {
      if (!p.onGround && (p.wallL || p.wallR)) {
        // wall jump
        const dir = p.wallL ? 1 : -1;
        p.vx = dir * 9.5;
        p.vy = -13;
        p.airJumps = 1;
        p.wallLock = 12;
        p.jumpBuf = 0;
        p.facing = dir;
        burst(p.x + (p.wallL ? 0 : p.w), p.y + p.h / 2, 10, '#9fb4cc', 4, 20, 3);
        sfx(520, 0.12, 'triangle', 0.04, 780);
      } else if (p.onGround || p.coyote > 0) {
        p.vy = -14;
        p.onGround = false;
        p.coyote = 0;
        p.jumpBuf = 0;
        p.airJumps = 1;
        burst(cx, p.y + p.h, 8, '#9fd7ff', 3, 16, 3);
        sfx(440, 0.1, 'triangle', 0.035, 700);
      } else if (p.airJumps > 0) {
        p.airJumps--;
        p.vy = -12.2;
        p.jumpBuf = 0;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          particles.push({
            x: cx + Math.cos(a) * 16, y: p.y + p.h, vx: Math.cos(a) * 3, vy: 1 + Math.sin(a) * 2,
            life: 20, maxLife: 20, color: '#7ef9ff', size: 3, grav: 0.05,
          });
        }
        sfx(660, 0.1, 'triangle', 0.035, 950);
      }
    }

    /* --- variable jump height --- */
    if (!(keys['w'] || keys[' '] || keys['arrowup']) && p.vy < -4) p.vy *= 0.62;

    /* --- wall slide --- */
    p.wallSliding = false;
    if (!p.onGround && p.vy > 0 && p.wallLock === 0) {
      if ((p.wallL && left) || (p.wallR && right)) {
        p.vy = Math.min(p.vy, 3);
        p.wallSliding = true;
        if (Math.random() < 0.4) {
          particles.push({
            x: p.wallL ? p.x : p.x + p.w, y: p.y + rand(0, p.h),
            vx: rand(-0.5, 0.5), vy: rand(-2, -0.5),
            life: 18, maxLife: 18, color: '#9fb4cc', size: 2, grav: 0,
          });
        }
      }
    }

    /* --- move & collide --- */
    moveX(p);
    moveY(p);

    if (p.onGround) {
      p.coyote = 7;
      p.airJumps = 1;
    }

    /* --- spikes --- */
    if (touchesSpike(p)) hurtPlayer(1, p.x + p.w / 2);

    /* --- shooting --- */
    if (mouse.down) shoot();

    /* --- fell out of the world --- */
    if (p.y > WH + 160) {
      p.hp = 0;
      state = 'dead';
      sfx(300, 0.5, 'sawtooth', 0.05, 60);
    }
  }

  /* ------------------------------------------------------------------
     Update — enemies
  ------------------------------------------------------------------ */
  function updateEnemies() {
    const px = player.x + player.w / 2, py = player.y + player.h / 2;

    for (const e of enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - 1);

      if (e.type === 'walker') {
        e.vx = e.dir * 1.4;
        e.vy += 0.72;
        if (e.vy > 16) e.vy = 16;
        moveX(e);
        moveY(e);
        if (e.wallL || e.wallR) e.dir *= -1;

        // turn around at a ledge
        const probeX = e.dir > 0 ? e.x + e.w + 3 : e.x - 3;
        if (e.onGround && !isSolid(Math.floor(probeX / TILE), Math.floor((e.y + e.h + 4) / TILE))) {
          e.dir *= -1;
        }
      } else if (e.type === 'flyer') {
        e.t += 0.045;
        const dx = Math.sign(px - (e.x + e.w / 2));
        if (Math.abs(px - (e.x + e.w / 2)) > 40 && Math.abs(px - (e.x + e.w / 2)) < 520) {
          e.x += dx * 1.5;
        }
        e.y = e.baseY + Math.sin(e.t) * 34;
      } else if (e.type === 'shooter') {
        e.vy += 0.72;
        if (e.vy > 16) e.vy = 16;
        moveY(e);
        const d = Math.hypot(px - (e.x + e.w / 2), py - (e.y + e.h / 2));
        e.cd--;
        if (d < 620 && e.cd <= 0) { enemyShoot(e); e.cd = 78; }
      }

      /* --- contact with player --- */
      if (aabb(e, player) && player.dashTime === 0 && player.invuln === 0) {
        const stomping = player.vy > 1 && player.y + player.h - player.vy <= e.y + 12;
        if (stomping) {
          damageEnemy(e, 2);
          player.vy = -11;
          player.airJumps = 1;
          shake(5);
        } else {
          hurtPlayer(1, e.x + e.w / 2);
        }
      }
    }

    enemies = enemies.filter((e) => !e.dead);
  }

  /* ------------------------------------------------------------------
     Update — bullets
  ------------------------------------------------------------------ */
  function updateBullets() {
    for (const b of bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      if (b.life <= 0) { b.dead = true; continue; }

      // world bounds / solid tiles
      const cx = Math.floor((b.x + b.w / 2) / TILE);
      const cy = Math.floor((b.y + b.h / 2) / TILE);
      if (isSolid(cx, cy) || b.x < -40 || b.x > WW + 40 || b.y > WH + 40 || b.y < -400) {
        b.dead = true;
        burst(b.x, b.y, 4, b.color, 3, 12, 2);
        continue;
      }

      if (b.friendly) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (aabb(b, e)) {
            damageEnemy(e, b.dmg);
            b.dead = true;
            break;
          }
        }
      } else if (player.dashTime === 0 && aabb(b, player)) {
        hurtPlayer(1, b.x);
        b.dead = true;
      }
    }
    bullets = bullets.filter((b) => !b.dead);
  }

  /* ------------------------------------------------------------------
     Update — pickups / goal
  ------------------------------------------------------------------ */
  function updatePickups() {
    for (const it of pickups) {
      if (it.dead) continue;
      it.t += 0.08;
      if (aabb(it, player)) {
        it.dead = true;
        if (it.type === 'coin') {
          score += 5;
          burst(it.x + it.w / 2, it.y + it.h / 2, 8, '#ffe066', 4, 22, 3);
          sfx(1050, 0.07, 'sine', 0.03, 1500);
        } else {
          player.hp = Math.min(player.maxHp, player.hp + 1);
          floatText(it.x, it.y, '+1 HP', '#7dff9b');
          burst(it.x + it.w / 2, it.y + it.h / 2, 14, '#7dff9b', 4, 26, 3);
          sfx(700, 0.12, 'sine', 0.04, 1200);
        }
      }
    }
    pickups = pickups.filter((i) => !i.dead);

    if (goal && aabb(goal, player) && state === 'play') {
      state = 'win';
      score += 100;
      burst(goal.x + goal.w / 2, goal.y + goal.h / 2, 60, '#ffe066', 9, 70, 4);
      sfx(660, 0.15, 'triangle', 0.05, 1320);
      setTimeout(() => sfx(880, 0.3, 'triangle', 0.05, 1760), 130);
    }
  }

  /* ------------------------------------------------------------------
     Update — particles / floaters / camera
  ------------------------------------------------------------------ */
  function updateEffects() {
    for (const p of particles) {
      p.vy += p.grav;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.life--;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const f of floaters) { f.y -= 0.7; f.life--; }
    floaters = floaters.filter((f) => f.life > 0);

    const tx = player.x + player.w / 2 - VW / 2;
    const ty = player.y + player.h / 2 - VH / 2;
    cam.x = lerp(cam.x, tx, 0.14);
    cam.y = lerp(cam.y, ty, 0.14);
    cam.x = clamp(cam.x, 0, Math.max(0, WW - VW));
    cam.y = clamp(cam.y, 0, Math.max(0, WH - VH));

    cam.shake *= 0.86;
    if (cam.shake < 0.2) cam.shake = 0;
  }

  /* ------------------------------------------------------------------
     Main update
  ------------------------------------------------------------------ */
  function update() {
    if (state !== 'play') return;
    updatePlayer();
    updateEnemies();
    updateBullets();
    updatePickups();
    updateEffects();
  }

  /* ------------------------------------------------------------------
     Rendering
  ------------------------------------------------------------------ */
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0d1526');
    g.addColorStop(0.55, '#131f38');
    g.addColorStop(1, '#1b2b4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // parallax stars
    ctx.save();
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.5) - cam.x * 0.15) % (VW + 200);
      const sy = (i * 91.7) % (VH * 0.7);
      const a = 0.15 + ((i * 37) % 100) / 250;
      ctx.fillStyle = `rgba(160,200,255,${a})`;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();

    // parallax hills
    const layers = [
      { off: 0.22, col: '#16233d', h: 240 },
      { off: 0.42, col: '#1b2c4c', h: 170 },
    ];
    for (const L of layers) {
      ctx.fillStyle = L.col;
      ctx.beginPath();
      ctx.moveTo(0, VH);
      const shift = -cam.x * L.off;
      for (let x = 0; x <= VW + 80; x += 80) {
        const wx = (x + shift) * 0.0035;
        const y = VH - L.h + Math.sin(wx) * 46 + Math.cos(wx * 2.3) * 22;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(VW, VH);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTiles() {
    const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.floor((cam.x + VW) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const r1 = Math.min(ROWS - 1, Math.floor((cam.y + VH) / TILE) + 1);

    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const t = grid[cy][cx];
        if (t === EMPTY) continue;
        const x = cx * TILE, y = cy * TILE;

        if (t === SOLID) {
          ctx.fillStyle = '#2a3f63';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#33517f';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = 'rgba(126,249,255,0.10)';
          ctx.fillRect(x, y, TILE, 2);
          if (!isSolid(cx, cy - 1)) {
            ctx.strokeStyle = 'rgba(126,249,255,0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y + 1);
            ctx.lineTo(x + TILE, y + 1);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else if (t === SPIKE) {
          ctx.fillStyle = '#ff5d5d';
          for (let i = 0; i < 4; i++) {
            const sx = x + i * (TILE / 4);
            ctx.beginPath();
            ctx.moveTo(sx, y + TILE);
            ctx.lineTo(sx + TILE / 8, y + 8);
            ctx.lineTo(sx + TILE / 4, y + TILE);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  function drawGoal() {
    if (!goal) return;
    const { x, y, w, h } = goal;
    const wave = Math.sin(performance.now() / 200) * 5;

    ctx.fillStyle = '#c9d6e6';
    ctx.fillRect(x, y, 5, h);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 4);
    ctx.lineTo(x + 5 + 44, y + 16 + wave);
    ctx.lineTo(x + 5, y + 30);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 46 + Math.sin(performance.now() / 300) * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const blink = p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0;

    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;

    // dash trail glow
    if (p.dashTime > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#7ef9ff';
      roundRect(ctx, p.x - p.dashDir * 22, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.restore();
    }

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.h + 3, p.w * 0.55, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = '#4ec9ff';
    roundRect(ctx, p.x, p.y, p.w, p.h, 8);
    ctx.fill();
    ctx.fillStyle = '#2f9fd6';
    roundRect(ctx, p.x, p.y + p.h * 0.55, p.w, p.h * 0.45, 8);
    ctx.fill();

    // visor
    ctx.fillStyle = '#0d1526';
    const ex = p.facing > 0 ? p.x + p.w - 14 : p.x + 4;
    roundRect(ctx, ex, p.y + 7, 10, 9, 3);
    ctx.fill();
    ctx.fillStyle = '#7ef9ff';
    const gx = p.facing > 0 ? p.x + p.w - 11 : p.x + 7;
    ctx.fillRect(gx, p.y + 10, 4, 3);

    // gun arm
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.aim);
    ctx.fillStyle = '#1c2536';
    roundRect(ctx, 6, -5, 24, 10, 3);
    ctx.fill();
    ctx.fillStyle = WEAPONS[p.weapon].color;
    ctx.fillRect(26, -2, 8, 4);
    ctx.restore();

    ctx.restore();
  }

  function drawEnemy(e) {
    const flash = e.flash > 0;
    ctx.save();
    if (e.type === 'walker') {
      ctx.fillStyle = flash ? '#ffffff' : '#ff7b6b';
      roundRect(ctx, e.x, e.y, e.w, e.h, 7);
      ctx.fill();
      ctx.fillStyle = '#0d1526';
      const ex = e.dir > 0 ? e.x + e.w - 13 : e.x + 5;
      ctx.fillRect(ex, e.y + 8, 8, 7);
      ctx.fillStyle = flash ? '#fff' : '#ffd0c0';
      ctx.fillRect(e.x + 4, e.y + e.h - 6, 6, 4);
      ctx.fillRect(e.x + e.w - 10, e.y + e.h - 6, 6, 4);
    } else if (e.type === 'flyer') {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const flap = Math.sin(performance.now() / 90) * 7;
      ctx.fillStyle = flash ? '#ffffff' : '#a98cff';
      ctx.beginPath();
      ctx.ellipse(cx - 18, cy, 10, 5 + flap * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 18, cy, 10, 5 + flap * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 15);
      ctx.lineTo(cx + 15, cy);
      ctx.lineTo(cx, cy + 15);
      ctx.lineTo(cx - 15, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0d1526';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5d5d';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'shooter') {
      ctx.fillStyle = flash ? '#ffffff' : '#ff9f43';
      roundRect(ctx, e.x, e.y, e.w, e.h, 6);
      ctx.fill();
      ctx.fillStyle = '#0d1526';
      ctx.fillRect(e.x + 7, e.y + 9, e.w - 14, 7);
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      const a = Math.atan2(py - (e.y + e.h / 2), px - (e.x + e.w / 2));
      ctx.save();
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      ctx.rotate(a);
      ctx.fillStyle = '#2b3440';
      roundRect(ctx, 0, -6, 24, 12, 3);
      ctx.fill();
      ctx.restore();
      if (e.cd < 20 && e.cd % 8 < 4) {
        ctx.fillStyle = '#ff5d5d';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPickups() {
    for (const it of pickups) {
      const bob = Math.sin(it.t) * 4;
      if (it.type === 'coin') {
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + it.h / 2 + bob);
        const sq = Math.abs(Math.cos(it.t * 0.9));
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 * sq + 1.5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b58a1a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 3 * sq + 1, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + it.h / 2 + bob);
        ctx.fillStyle = '#7dff9b';
        roundRect(ctx, -9, -9, 18, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#0d1526';
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
        ctx.restore();
      }
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      if (b.friendly) {
        const a = Math.atan2(b.vy, b.vx);
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      const s = p.size * (p.life / p.maxLife) + 1;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Segoe UI, sans-serif';
    for (const f of floaters) {
      ctx.globalAlpha = clamp(f.life / 55, 0, 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawHUD() {
    // hearts
    for (let i = 0; i < player.maxHp; i++) {
      const x = 22 + i * 30, y = 22;
      const full = i < player.hp;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = full ? '#ff5d7a' : 'rgba(255,93,122,0.18)';
      ctx.beginPath();
      ctx.moveTo(10, 20);
      ctx.bezierCurveTo(-6, 8, 2, -4, 10, 4);
      ctx.bezierCurveTo(18, -4, 26, 8, 10, 20);
      ctx.fill();
      ctx.restore();
    }

    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('SCORE ' + score, 22, 74);

    // weapon
    const w = WEAPONS[player.weapon];
    ctx.fillStyle = w.color;
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.fillText(w.name, 22, 100);
    for (let i = 0; i < WEAPONS.length; i++) {
      ctx.fillStyle = i === player.weapon ? WEAPONS[i].color : 'rgba(255,255,255,0.18)';
      roundRect(ctx, 20 + i * 14, 110, 10, 5, 2);
      ctx.fill();
    }

    // dash cooldown
    const ready = player.dashCd === 0;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, 22, 128, 92, 9, 4);
    ctx.fill();
    const pct = ready ? 1 : 1 - player.dashCd / 48;
    ctx.fillStyle = ready ? '#7ef9ff' : '#3d7f96';
    roundRect(ctx, 22, 128, Math.max(4, 92 * pct), 9, 4);
    ctx.fill();
    ctx.fillStyle = ready ? '#7ef9ff' : '#5a7a8a';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillText(ready ? 'DASH READY' : 'DASH', 24, 152);

    // enemies remaining
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff9f9f';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.fillText('ENEMIES ' + enemiesLeft, VW - 22, 34);
    ctx.textAlign = 'left';

    // progress bar
    const prog = clamp((player.x) / (goal.x), 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, VW / 2 - 120, 24, 240, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#4ec9ff';
    roundRect(ctx, VW / 2 - 120, 24, Math.max(6, 240 * prog), 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(VW / 2 - 120 + 240 * prog, 28, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOverlay() {
    if (state === 'play') return;
    ctx.fillStyle = 'rgba(6,10,18,0.72)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';

    if (state === 'dead') {
      ctx.fillStyle = '#ff5d7a';
      ctx.font = 'bold 64px Segoe UI, sans-serif';
      ctx.fillText('YOU DIED', VW / 2, VH / 2 - 20);
      ctx.fillStyle = '#c9d6e6';
      ctx.font = 'bold 22px Segoe UI, sans-serif';
      ctx.fillText('Score: ' + score, VW / 2, VH / 2 + 30);
      ctx.fillStyle = '#9fb4cc';
      ctx.font = '18px Segoe UI, sans-serif';
      ctx.fillText('Press  R  to try again', VW / 2, VH / 2 + 80);
    } else if (state === 'win') {
      ctx.fillStyle = '#ffe066';
      ctx.font = 'bold 64px Segoe UI, sans-serif';
      ctx.fillText('LEVEL CLEAR!', VW / 2, VH / 2 - 20);
      ctx.fillStyle = '#7dff9b';
      ctx.font = 'bold 22px Segoe UI, sans-serif';
      ctx.fillText('Final score: ' + score, VW / 2, VH / 2 + 30);
      ctx.fillStyle = '#9fb4cc';
      ctx.font = '18px Segoe UI, sans-serif';
      ctx.fillText('Press  R  to play again', VW / 2, VH / 2 + 80);
    } else if (state === 'paused') {
      ctx.fillStyle = '#4ec9ff';
      ctx.font = 'bold 56px Segoe UI, sans-serif';
      ctx.fillText('PAUSED', VW / 2, VH / 2);
      ctx.fillStyle = '#9fb4cc';
      ctx.font = '18px Segoe UI, sans-serif';
      ctx.fillText('Press  P  to resume', VW / 2, VH / 2 + 50);
    }
    ctx.textAlign = 'left';
  }

  function render() {
    drawBackground();

    ctx.save();
    const sx = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    const sy = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);

    drawTiles();
    drawGoal();
    drawPickups();

    for (const e of enemies) drawEnemy(e);

    drawBullets();
    drawPlayer();
    drawParticles();
    drawFloaters();

    ctx.restore();

    drawHUD();
    drawOverlay();
  }

  /* ------------------------------------------------------------------
     Input
  ------------------------------------------------------------------ */
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;

    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();

    if (k === 'w' || k === ' ' || k === 'arrowup') player.jumpBuf = 8;

    if (k === '1') player.weapon = 0;
    if (k === '2') player.weapon = 1;
    if (k === '3') player.weapon = 2;
    if (k === 'q') player.weapon = (player.weapon + 1) % WEAPONS.length;

    if (k === 'r') buildLevel();

    if (k === 'p' && (state === 'play' || state === 'paused')) {
      state = state === 'play' ? 'paused' : 'play';
    }
  });

  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
    if (actx && actx.state === 'suspended') actx.resume();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => {
    mouse.down = false;
    for (const k in keys) keys[k] = false;
  });

  /* ------------------------------------------------------------------
     Loop
  ------------------------------------------------------------------ */
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;

  function loop(now) {
    const dt = Math.min(100, now - last);
    last = now;
    acc += dt;

    let guard = 0;
    while (acc >= STEP && guard++ < 5) {
      update();
      acc -= STEP;
    }
    render();
    requestAnimationFrame(loop);
  }

  buildLevel();
  requestAnimationFrame(loop);
})();
