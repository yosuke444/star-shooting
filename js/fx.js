'use strict';
// ============================================================
//  エフェクト: 粒子は1つのプール(型付き配列)にまとめて一括処理
// ============================================================
const PAL = [], PALI = {};
function PC(c) { let i = PALI[c]; if (i === undefined) { i = PAL.length; PAL.push(c); PALI[c] = i; } return i; }
const RAINBOW = ['#ff4d4d', '#ff9b3d', '#ffe14d', '#5fe36a', '#3dd8ff', '#4d7cff', '#c86bff', '#ff7ad9'].map(PC);
const C_WHITE = PC('#ffffff'), C_YEL = PC('#ffe14d'), C_ORA = PC('#ff9b3d'), C_RED = PC('#ff4d4d'), C_GRAY = PC('#9a9ab0'), C_DARK = PC('#3a3a4a'), C_PINK = PC('#ff7ad9'), C_PUR = PC('#c86bff'), C_GOLD = PC('#ffcc33'), C_SMOKE = PC('#5a5a6a');

const Particles = {
  MAX: 3500, n: 0,
  init() {
    const M = this.MAX, F = () => new Float32Array(M);
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F(); this.l = F(); this.ml = F(); this.s = F(); this.dr = F(); this.gr = F(); this.c = new Uint16Array(M);
  },
  add(x, y, vx, vy, life, size, col, drag = 3, grav = 0) {
    let i = this.n; if (i >= this.MAX) i = (Math.random() * this.MAX) | 0; else this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.l[i] = life; this.ml[i] = life; this.s[i] = size; this.c[i] = col; this.dr[i] = drag; this.gr[i] = grav;
  },
  burst(x, y, n, spd, life, size, cols, drag = 3, grav = 0) {
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, v = spd * (.3 + Math.random() * .7); this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (.6 + Math.random() * .6), size * (.6 + Math.random() * .6), Array.isArray(cols) ? cols[(Math.random() * cols.length) | 0] : cols, drag, grav); }
  },
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.l[i] -= dt;
      if (this.l[i] <= 0) { // 末尾と入れ替えて削除
        const j = --this.n; this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.l[i] = this.l[j]; this.ml[i] = this.ml[j]; this.s[i] = this.s[j]; this.c[i] = this.c[j]; this.dr[i] = this.dr[j]; this.gr[i] = this.gr[j];
        continue;
      }
      const f = 1 - Math.min(1, this.dr[i] * dt);
      this.vx[i] *= f; this.vy[i] = this.vy[i] * f + this.gr[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; i++;
    }
  },
  draw(ctx, x0, y0, x1, y1) {
    let last = -1;
    for (let i = 0; i < this.n; i++) {
      const x = this.x[i], y = this.y[i]; if (x < x0 || y < y0 || x > x1 || y > y1) continue;
      const c = this.c[i]; if (c !== last) { ctx.fillStyle = PAL[c]; last = c; }
      const s = Math.max(1, Math.round(this.s[i] * Math.min(1, this.l[i] / this.ml[i] * 1.6)));
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    }
  },
};

// 数の少ない特殊エフェクト(リング・斬撃・ビーム等)
const FxObjs = {
  list: [],
  add(o) { o.t = 0; this.list.push(o); if (this.list.length > 300) this.list.shift(); return o; },
  update(dt, V) {
    for (const o of this.list) {
      o.t += dt;
      if (o.type === 'mag') {
        const P = V.players[o.tgt]; const tx = P ? P.x : o.x, ty = P ? P.y : o.y;
        for (const b of o.orbs) { b.vx += (tx - b.x) * 22 * dt; b.vy += (ty - b.y) * 22 * dt; b.vx *= .9; b.vy *= .9; b.x += b.vx * dt; b.y += b.vy * dt; if (d2(b.x, b.y, tx, ty) < 64 && o.t > .25) b.done = true; }
        if (o.orbs.every(b => b.done) || o.t > 2) { o.t = o.life = 1; if (o.tgt === Render.meId) Sound.play('item', .8); Particles.burst(tx, ty, 8, 60, .4, 2, C_YEL); }
      }
    }
    this.list = this.list.filter(o => o.t < o.life);
  },
  draw(ctx) {
    for (const o of this.list) {
      const k = o.t / o.life;
      switch (o.type) {
        case 'ring': {
          const r = lerp(o.r0, o.r1, 1 - Math.pow(1 - k, 2)); ctx.strokeStyle = o.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = Math.max(1, o.w * (1 - k));
          ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'disc': { ctx.fillStyle = o.col; ctx.globalAlpha = (1 - k) * .8; ctx.beginPath(); ctx.arc(o.x, o.y, lerp(o.r0, o.r1, k), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break; }
        case 'slash': {
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 58, -1.2, 1.2); ctx.arc(-14, 0, 50, 1.1, -1.1, true); ctx.fill();
          ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(0, 0, 62, -1.25 + k, 1.25 - k); ctx.arc(0, 0, 56, 1.2 - k, -1.2 + k, true); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1; break;
        }
        case 'beam': {
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); const w = 34 * (1 - k * .7);
          ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffcc33'; ctx.fillRect(0, -w / 2, 6000, w);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -w / 4, 6000, w / 2); ctx.restore(); ctx.globalAlpha = 1; break;
        }
        case 'warnLine': {
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); ctx.globalAlpha = .5 * (1 - k) * (Math.floor(o.t * 16) % 2 ? 1 : .5); ctx.fillStyle = '#ff2d2d'; ctx.fillRect(0, -16, 240, 32); ctx.restore(); ctx.globalAlpha = 1; break;
        }
        case 'mag': {
          for (const b of o.orbs) if (!b.done) { ctx.fillStyle = o.cols[b.i % o.cols.length]; ctx.fillRect(Math.round(b.x - 2), Math.round(b.y - 2), 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 2, 2); }
          break;
        }
        case 'flashSpr': { ctx.globalAlpha = 1 - k; ctx.drawImage(o.img, Math.round(o.x - o.img.width / 2), Math.round(o.y - o.img.height / 2)); ctx.globalAlpha = 1; break; }
      }
    }
  },
};

const FAR_FX = { event: 1, go: 1, warn: 1, legend: 1, megaImpact: 1, bossDie: 1, beam: 1, arrowStart: 1 };
// ---- FX イベントの再生 (ホスト/クライアント共通) ----
const FX = {
  shake: 0, flash: 0, flashCol: '#fff', hurt: 0,
  vol(x, y) { const c = Render.cam; const d = Math.sqrt(d2(x, y, c.x, c.y)); return clamp(1.15 - d / 380, 0, 1); },
  near(x, y) { return this.vol(x, y) > 0; },
  addShake(v) { if (Settings.shake) this.shake = Math.max(this.shake, v); },
  play(type, x, y, a, b, c, V) {
    const me = Render.meId, v = this.vol(x, y);
    if (v === 0 && !FAR_FX[type] && !(a === me && (type === 'hurt' || type === 'mag' || type === 'ride' || type === 'spawn'))) return; // 画面外の演出は省略
    switch (type) {
      case 'shot': if (v > .2) Sound.play(a ? 'shotB' : 'shot', v * .7); break;
      case 'spark': if (v) Particles.burst(x, y, 3, 50, .2, 1.5, PC(BULLET_COL[a][1])); break;
      case 'hit': if (v) { Particles.burst(x, y, 4, 70, .25, 2, [C_WHITE, PC(BULLET_COL[a] ? BULLET_COL[a][1] : '#fff')]); Sound.play('hit', v * .6); } break;
      case 'hurt': if (a === me) { Sound.play('hurt', 1); this.addShake(Math.min(6, 2 + b / 6)); this.hurt = .35; } if (v) Particles.burst(x, y, 5, 60, .3, 2, C_RED); break;
      case 'death': {
        Particles.burst(x, y, 40, 160, .8, 3, [C_WHITE, C_YEL, C_ORA, C_RED]); Particles.burst(x, y, 14, 100, 1.2, 3, [PC(MACHINES[a].col), C_SMOKE], 2);
        FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 46, w: 4, col: '#fff3b0', life: .45 }); FxObjs.add({ type: 'disc', x, y, r0: 20, r1: 4, col: '#ffffff', life: .2 });
        Sound.play('boom', Math.max(v, b === me ? 1 : 0)); if (v > .5) this.addShake(5); break;
      }
      case 'pop': if (v) { Particles.burst(x, y, 14, 90, .5, 2.5, [PC(ENEMY_ART[ENEMIES[a].spr].pal.b), C_WHITE]); FxObjs.add({ type: 'ring', x, y, r0: 2, r1: 18, w: 2, col: '#ffffff', life: .3 }); Sound.play('boom', v * .4); } break;
      case 'pick': if (v) { const col = a < PK_ITEM ? PC(STAT_COL[a]) : C_YEL; Particles.burst(x, y, 6, 50, .4, 2, [col, C_WHITE]); if (b === me) Sound.play(a < PK_ITEM ? 'pick' : 'item', 1); } break;
      case 'mag': { const n = Math.min(24, b * 2 + 2); const orbs = []; for (let i = 0; i < n; i++) { const an = Math.random() * TAU, s = rnd(80, 200); orbs.push({ x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, i }); } FxObjs.add({ type: 'mag', x, y, tgt: a, orbs, cols: STAT_COL.concat(['#ffe14d']), life: 3 }); break; }
      case 'chest': { const big = a === 1 || a === 3 || a === 4; Particles.burst(x, y, big ? 40 : 20, big ? 160 : 110, .7, 2.5, [C_GOLD, C_YEL, C_WHITE].concat(a === 3 ? RAINBOW : [])); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: big ? 60 : 30, w: 3, col: '#ffe14d', life: .5 }); Sound.play('chest', Math.max(v, .1)); break; }
      case 'mexp': Particles.burst(x, y, 30, 140, .7, 3, [PC(MACHINES[a].col), C_WHITE, C_ORA, C_SMOKE]); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 40, w: 3, col: '#ffffff', life: .4 }); Sound.play('boom', v * .8); break;
      case 'ride': FxObjs.add({ type: 'ring', x, y, r0: 30, r1: 6, w: 3, col: MACHINES[a].col, life: .4 }); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 36, w: 2, col: '#ffffff', life: .5 }); Particles.burst(x, y, 16, 80, .6, 2, [PC(MACHINES[a].col), C_YEL, C_WHITE]); if (b === me) Sound.play('ride', 1); break;
      case 'spawn': FxObjs.add({ type: 'ring', x, y, r0: 40, r1: 4, w: 3, col: '#ffffff', life: .5 }); Particles.burst(x, y, 12, 60, .5, 2, C_WHITE); if (a === me) Sound.play('ride', 1); break;
      case 'buff': { const col = STAT_COL[a]; FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 28, w: 3, col, life: .5 }); Particles.burst(x, y, 12, 70, .5, 2, PC(col), 2, -40); Sound.play('item', v); break; }
      case 'use': Sound.play('item', v); break;
      case 'slash': FxObjs.add({ type: 'slash', x, y, a: a / 100, life: .25 }); Sound.play('slash', Math.max(v, .2)); if (v > .3) this.addShake(3); break;
      case 'bomb': case 'bigbomb': {
        const big = type === 'bigbomb';
        FxObjs.add({ type: 'disc', x, y, r0: a * .3, r1: a, col: '#ffe0a0', life: .25 }); FxObjs.add({ type: 'ring', x, y, r0: a * .2, r1: a, w: 6, col: '#ff9b3d', life: .45 });
        Particles.burst(x, y, big ? 70 : 30, a * 2.2, .8, 3.5, [C_WHITE, C_YEL, C_ORA, C_RED, C_SMOKE], 2.5);
        Sound.play(big ? 'bigboom' : 'boom', Math.max(v, .15)); if (v > .3) this.addShake(big ? 9 : 5); if (big && v > .5) { this.flash = .25; this.flashCol = '#fff3d0'; }
        break;
      }
      case 'beam': { const an = a / 1000; FxObjs.add({ type: 'beam', x, y, a: an, life: .7 }); for (let i = 0; i < 60; i++) { const d = i * 18; Particles.add(x + Math.cos(an) * d, y + Math.sin(an) * d, rnd(-60, 60), rnd(-60, 60), rnd(.4, .9), 3, i % 2 ? C_YEL : C_WHITE); } Sound.play('laser', 1); this.addShake(8); this.flash = .2; this.flashCol = '#fff8c0'; break; }
      case 'arrowStart': Sound.play('charge', 1); Sound.play('warn', .8); break;
      case 'legend': FxObjs.add({ type: 'ring', x, y, r0: 6, r1: 90, w: 6, col: MACHINES[a].col, life: .9 }); Particles.burst(x, y, 80, 220, 1.4, 3, RAINBOW, 1.6); Sound.play('win', 1); this.flash = .3; this.flashCol = '#ffffff'; break;
      case 'event': Sound.play('event', 1); break;
      case 'go': Sound.play('go', 1); break;
      case 'warn': Sound.play('warn', 1); break;
      case 'bossIn': FxObjs.add({ type: 'ring', x, y, r0: 10, r1: 120, w: 8, col: '#c86bff', life: 1 }); Particles.burst(x, y, 60, 200, 1.2, 4, [C_PUR, C_SMOKE, C_WHITE], 2); Sound.play('bigboom', .9); this.addShake(6); break;
      case 'bossOut': Particles.burst(x, y, 50, 150, 1, 4, [C_PUR, C_SMOKE]); Sound.play('boom', .8); break;
      case 'bossDie': for (let i = 0; i < 4; i++) FxObjs.add({ type: 'ring', x, y, r0: 10 + i * 10, r1: 140 + i * 30, w: 7, col: ['#ffffff', '#ffe14d', '#ff9b3d', '#c86bff'][i], life: .8 + i * .2 }); Particles.burst(x, y, 160, 300, 1.6, 4, [C_WHITE, C_YEL, C_ORA, C_PUR].concat(RAINBOW), 1.5); Sound.play('bigboom', 1); this.addShake(12); this.flash = .35; this.flashCol = '#ffffff'; break;
      case 'roar': FxObjs.add({ type: 'ring', x, y, r0: 20, r1: 80, w: 4, col: '#c86bff', life: .5 }); Sound.play('shotB', v); break;
      case 'warnLine': FxObjs.add({ type: 'warnLine', x, y, a: a / 1000, life: .55 }); if (v) Sound.play('warn', v * .7); break;
      case 'impact': if (v) { FxObjs.add({ type: 'disc', x, y, r0: a, r1: a * .3, col: '#ffd0a0', life: .2 }); FxObjs.add({ type: 'ring', x, y, r0: 6, r1: a * 1.2, w: 4, col: '#ff9b3d', life: .4 }); Particles.burst(x, y, 24, 160, .9, 3, [C_ORA, C_RED, C_SMOKE, C_DARK], 2.5); Sound.play('boom', v); if (v > .6) this.addShake(4); } break;
      case 'megaImpact': FxObjs.add({ type: 'disc', x, y, r0: a * 1.1, r1: a * .2, col: '#fff3d0', life: .5 }); for (let i = 0; i < 3; i++) FxObjs.add({ type: 'ring', x, y, r0: 10, r1: a * (1.2 + i * .4), w: 10, col: ['#ffffff', '#ff9b3d', '#ff4d4d'][i], life: .8 + i * .3 }); Particles.burst(x, y, 220, 420, 1.8, 5, [C_WHITE, C_YEL, C_ORA, C_RED, C_SMOKE, C_DARK], 1.5); Sound.play('bigboom', 1); this.addShake(16); this.flash = .5; this.flashCol = '#fff3d0'; break;
      case 'starLand': if (v) { Particles.burst(x, y, 10, 80, .5, 2, [C_YEL, C_WHITE]); FxObjs.add({ type: 'ring', x, y, r0: 2, r1: 16, w: 2, col: '#fff3b0', life: .3 }); Sound.play('pick', v * .4); } break;
      case 'vanish': if (v) Particles.burst(x, y, 16, 60, .7, 3, [C_WHITE, C_GRAY], 2, -20); break;
      case 'stun': Particles.burst(x, y, 16, 70, .8, 2, [C_YEL, C_WHITE]); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 26, w: 2, col: '#ffe14d', life: .4 }); Sound.play('kill', v); break;
      case 'rainbow': if (v) for (let i = 0; i < 2; i++) Particles.add(x + rnd(-6, 6), y + rnd(-6, 6), rnd(-20, 20), rnd(-20, 20), rnd(.4, .9), 3, RAINBOW[(Math.random() * 8) | 0], 2); break;
      case 'dust': if (v) Particles.add(x + rnd(-4, 4), y + rnd(-4, 4), rnd(-10, 10), rnd(-10, 10), .5, 3, C_GRAY, 2); break;
      case 'flowerPop': if (v) { Particles.burst(x, y, 14, 70, .8, 2, [C_PINK, C_WHITE, C_YEL], 2, 20); Sound.play('pick', v * .5); } break;
      case 'bounce': if (v) { Particles.burst(x, y, 6, 60, .3, 2, C_WHITE); Sound.play('hit', v * .5); } break;
      case 'warp': FxObjs.add({ type: 'ring', x, y, r0: 24, r1: 2, w: 3, col: '#c86bff', life: .35 }); Particles.burst(x, y, 14, 90, .5, 2, [C_PUR, C_WHITE, C_PINK]); Sound.play('ride', v * .7); break;
    }
  },
};
