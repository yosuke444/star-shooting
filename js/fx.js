'use strict';
// ============================================================
//  エフェクト: 粒子は1つのプール(型付き配列)にまとめて一括処理
// ============================================================
const PAL = [], PALI = {};
function PC(c) { let i = PALI[c]; if (i === undefined) { i = PAL.length; PAL.push(c); PALI[c] = i; } return i; }
const RAINBOW = ['#ff4d4d', '#ff9b3d', '#ffe14d', '#5fe36a', '#3dd8ff', '#4d7cff', '#c86bff', '#ff7ad9'].map(PC);
const C_WHITE = PC('#ffffff'), C_YEL = PC('#ffe14d'), C_ORA = PC('#ff9b3d'), C_RED = PC('#ff4d4d'), C_GRAY = PC('#9a9ab0'), C_DARK = PC('#3a3a4a'), C_PINK = PC('#ff7ad9'), C_PUR = PC('#c86bff'), C_GOLD = PC('#ffcc33'), C_SMOKE = PC('#5a5a6a');

const Particles = {
  MAX: 6000, n: 0,
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
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a); const w = 90 * (1 - k * .6);
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
        case 'ghost': { const s = o.s || 1; ctx.save(); ctx.globalAlpha = (1 - k) * .45; ctx.translate(Math.round(o.x), Math.round(o.y)); ctx.rotate(o.a); ctx.drawImage(o.img, -o.img.width * s / 2, -o.img.height * s / 2, o.img.width * s, o.img.height * s); ctx.restore(); ctx.globalAlpha = 1; break; }
        case 'spark': { ctx.strokeStyle = o.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2; for (const s of o.s) { const d = o.r * (.3 + k * 1.2); ctx.beginPath(); ctx.moveTo(o.x + Math.cos(s) * d * .4, o.y + Math.sin(s) * d * .4); ctx.lineTo(o.x + Math.cos(s) * d, o.y + Math.sin(s) * d); ctx.stroke(); } ctx.globalAlpha = 1; break; }
        case 'iconBurst': { const s = 1.5 + k * 3.5; ctx.globalAlpha = 1 - k; ctx.drawImage(o.img, Math.round(o.x - o.img.width * s / 2), Math.round(o.y - o.img.height * s / 2), o.img.width * s, o.img.height * s); ctx.globalAlpha = 1; break; }
        case 'flashSpr': { ctx.globalAlpha = 1 - k; ctx.drawImage(o.img, Math.round(o.x - o.img.width / 2), Math.round(o.y - o.img.height / 2)); ctx.globalAlpha = 1; break; }
      }
    }
  },
};

const FAR_FX = { event: 1, go: 1, warn: 1, legend: 1, megaImpact: 1, bossDie: 1, beam: 1, arrowStart: 1 };
// ---- FX イベントの再生 (ホスト/クライアント共通) ----
const FX = {
  shake: 0, flash: 0, flashCol: '#fff', hurt: 0, stopT: 0,
  vol(x, y) { const c = Render.cam; const d = Math.sqrt(d2(x, y, c.x, c.y)); return clamp(1.15 - d / 380, 0, 1); },
  near(x, y) { return this.vol(x, y) > 0; },
  addShake(v) { if (Settings.shake) this.shake = Math.max(this.shake, v); },
  stop(t) { this.stopT = Math.max(this.stopT, t); },          // ヒットストップ
  kick(z) { Render.cam.kick = Math.max(Render.cam.kick || 0, z); }, // ズームパンチ
  boom(x, y, r, cols, n, big) { // 豪快な爆発の共通処理
    FxObjs.add({ type: 'disc', x, y, r0: r * .9, r1: r * .2, col: '#ffffff', life: .14 });
    FxObjs.add({ type: 'ring', x, y, r0: r * .2, r1: r * 1.5, w: big ? 10 : 6, col: '#fff3b0', life: .4 });
    FxObjs.add({ type: 'ring', x, y, r0: r * .1, r1: r * 2.2, w: big ? 6 : 3, col: '#ff9b3d', life: .6 });
    FxObjs.add({ type: 'spark', x, y, r: r * 2, col: '#fff6a0', s: Array.from({ length: big ? 16 : 10 }, () => Math.random() * TAU), life: .3 });
    Particles.burst(x, y, n, r * 7, .9, 4, cols, 2.6);
    Particles.burst(x, y, n >> 1, r * 3, 1.6, 6, [C_SMOKE, C_DARK, C_GRAY], 1.5, -15);
  },
  play(type, x, y, a, b, c, V) {
    const me = Render.meId, v = this.vol(x, y);
    if (v === 0 && !FAR_FX[type] && !(a === me && (type === 'hurt' || type === 'mag' || type === 'ride' || type === 'spawn'))) return; // 画面外の演出は省略
    switch (type) {
      case 'shot': {
        if (v > .2) Sound.play(a ? 'shotB' : 'shot', v * .8);
        if (b !== undefined && v) { const an = b / 100, mx = x + Math.cos(an) * 9, my = y + Math.sin(an) * 9; Particles.add(mx, my, Math.cos(an) * 60, Math.sin(an) * 60, .08, a ? 7 : 5, C_WHITE, 8); for (let i = 0; i < 3; i++) Particles.add(mx, my, Math.cos(an + rnd(-.6, .6)) * rnd(80, 180), Math.sin(an + rnd(-.6, .6)) * rnd(80, 180), .14, 2, C_YEL, 6); }
        break;
      }
      case 'spark': if (v) Particles.burst(x, y, 6, 90, .25, 2, [PC(BULLET_COL[a][1]), C_WHITE]); break;
      case 'hit': if (v) { // 弾が何かに命中: その弾の色で小さく爆発
        const cc = BULLET_COL[a] ? BULLET_COL[a][1] : '#fff', col = PC(cc), big = b >= 12;
        FxObjs.add({ type: 'disc', x, y, r0: big ? 14 : 10, r1: 2, col: '#ffffff', life: .09 });
        FxObjs.add({ type: 'disc', x, y, r0: 4, r1: big ? 16 : 11, col: cc, life: .16 });
        FxObjs.add({ type: 'ring', x, y, r0: 3, r1: big ? 26 : 18, w: 3, col: cc, life: .22 });
        FxObjs.add({ type: 'spark', x, y, r: big ? 22 : 15, col: '#ffffff', s: [0, 1, 2, 3, 4].map(() => Math.random() * TAU), life: .16 });
        Particles.burst(x, y, big ? 16 : 10, 170, .35, 2.5, [C_WHITE, col, C_YEL]);
        Sound.play('hit', v * .9);
        if (c === me && b) { UI.dmgNum(x, y, b, '#fff6a0', b >= 15); this.stop(b >= 15 ? .05 : .018); this.addShake(b >= 15 ? 4 : 1.5); }
        else if (v > .7) this.addShake(.8);
      } break;
      case 'hurt': if (a === me) { Sound.play('hurt', 1); this.addShake(Math.min(16, 6 + b / 2)); this.hurt = .5; this.stop(Math.min(.12, .04 + b / 200)); UI.dmgNum(x, y, b, '#ff4d4d', true); } else if (v > .5) this.addShake(2); if (v) Particles.burst(x, y, 10, 90, .35, 2.5, [C_RED, C_WHITE]); break;
      case 'death': {
        this.boom(x, y, 22, [C_WHITE, C_YEL, C_ORA, C_RED, PC(MACHINES[a].col)], 90, true);
        Particles.burst(x, y, 24, 220, 1.4, 4, [PC(MACHINES[a].col), C_DARK], 1.2);
        Sound.play('bigboom', Math.max(v, b === me ? 1 : 0));
        if (v > .3) { this.addShake(12); this.stop(.12); this.kick(.12); this.flash = .18; this.flashCol = '#fff3d0'; }
        break;
      }
      case 'pop': if (v) { const col = PC(ENEMY_ART[ENEMIES[a].spr].pal.b); this.boom(x, y, 11, [col, C_WHITE, C_YEL, C_RED], 36, false); Sound.play('boom', v * .8); this.addShake(5); this.stop(.05); } break;
      case 'pick': if (v) { const col = a < PK_ITEM ? PC(STAT_COL[a]) : C_YEL; Particles.burst(x, y, 12, 90, .45, 2.5, [col, C_WHITE]); FxObjs.add({ type: 'ring', x, y, r0: 2, r1: 16, w: 2, col: a < PK_ITEM ? STAT_COL[a] : '#ffe14d', life: .25 }); } break;
      case 'mag': { const n = Math.min(30, b * 3 + 3); const orbs = []; for (let i = 0; i < n; i++) { const an = Math.random() * TAU, s = rnd(120, 280); orbs.push({ x, y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, i }); } FxObjs.add({ type: 'mag', x, y, tgt: a, orbs, cols: STAT_COL.concat(['#ffe14d']), life: 3 }); break; }
      case 'chest': { const big = a === 1 || a === 3 || a === 4; this.boom(x, y, big ? 26 : 14, [C_GOLD, C_YEL, C_WHITE].concat(a === 3 ? RAINBOW : []), big ? 110 : 50, big); Particles.burst(x, y, big ? 40 : 18, 260, 1, 3, RAINBOW, 2, 60); Sound.play('chest', Math.max(v, .1)); Sound.play('boom', v * .6); if (v > .4) { this.addShake(big ? 10 : 5); this.stop(big ? .1 : .05); this.kick(big ? .1 : .05); } break; }
      case 'mexp': this.boom(x, y, 18, [PC(MACHINES[a].col), C_WHITE, C_ORA, C_YEL], 70, true); Sound.play('bigboom', v * .9); if (v > .4) { this.addShake(9); this.stop(.08); this.kick(.08); } break;
      case 'rideBonus': { for (let i = 0; i < 3; i++) FxObjs.add({ type: 'ring', x, y, r0: 6, r1: 70 + i * 30, w: 6, col: STAT_COL[i], life: .6 + i * .15 }); for (let i = 0; i < 40 + a * 12; i++) { const an = Math.random() * TAU, s = rnd(80, 300); Particles.add(x, y, Math.cos(an) * s, Math.sin(an) * s - 60, rnd(.6, 1.3), 4, PC(STAT_COL[i % 4]), 1.6, 120); } if (b === me) { Sound.play('chest', 1); this.stop(.12); this.flash = .25; this.flashCol = '#fff3b0'; } break; }
      case 'ram': if (v) { FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 34, w: 4, col: '#ffffff', life: .25 }); Particles.burst(x, y, 16, 160, .4, 3, [C_WHITE, C_ORA, PC(MACHINES[a].col)]); Sound.play('boom', v * .7); this.addShake(6); this.stop(.05); } break;
      case 'ride': if (b === me) UI.nameCard(a); FxObjs.add({ type: 'ring', x, y, r0: 50, r1: 6, w: 4, col: MACHINES[a].col, life: .4 }); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 60, w: 3, col: '#ffffff', life: .5 }); Particles.burst(x, y, 40, 160, .8, 3, [PC(MACHINES[a].col), C_YEL, C_WHITE]); if (b === me) { Sound.play('ride', 1); this.flash = .15; this.flashCol = MACHINES[a].col; } break;
      case 'spawn': FxObjs.add({ type: 'ring', x, y, r0: 60, r1: 4, w: 4, col: '#ffffff', life: .5 }); Particles.burst(x, y, 24, 100, .6, 3, C_WHITE); if (a === me) Sound.play('ride', 1); break;
      case 'buff': { const col = STAT_COL[a]; FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 44, w: 4, col, life: .5 }); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 28, w: 2, col: '#ffffff', life: .3 }); Particles.burst(x, y, 28, 120, .7, 3, [PC(col), C_WHITE], 2, -60); Sound.play('item', v); Sound.play('whoosh', v * .8); break; }
      case 'use': { // アイテムを使った: マシンを中心にアイコンが弾ける
        const key = ITEM_KEYS[a], it = ITEMS[key], sc = { jet: 1, dumb: 0, glass: 3, bar: 2 }[it.icon], col = sc !== undefined ? STAT_COL[sc] : RAR_COL[it.rar];
        FxObjs.add({ type: 'iconBurst', img: GFX.itemUI[key], x, y, life: .5 }); FxObjs.add({ type: 'ring', x, y, r0: 6, r1: 60, w: 5, col, life: .45 }); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 36, w: 3, col: '#ffffff', life: .3 });
        Particles.burst(x, y, 36, 220, .7, 3, [PC(col), C_WHITE], 2); Sound.play('item', Math.max(v, b === me ? 1 : 0)); if (b === me) { this.stop(.05); this.addShake(4); }
        break;
      }
      case 'slash': FxObjs.add({ type: 'slash', x, y, a: a / 100, life: .25 }); Particles.burst(x + Math.cos(a / 100) * 40, y + Math.sin(a / 100) * 40, 30, 200, .4, 3, [C_WHITE, C_RED, C_YEL]); Sound.play('slash', Math.max(v, .2)); if (v > .3) { this.addShake(7); this.stop(.06); this.kick(.06); } break;
      case 'bomb': case 'bigbomb': {
        const big = type === 'bigbomb';
        this.boom(x, y, a * .55, [C_WHITE, C_YEL, C_ORA, C_RED], big ? 200 : 80, big);
        FxObjs.add({ type: 'disc', x, y, r0: a * .3, r1: a, col: '#ffe0a0', life: .3 }); FxObjs.add({ type: 'ring', x, y, r0: a * .2, r1: a * 1.2, w: 10, col: '#ff9b3d', life: .5 });
        Sound.play(big ? 'bigboom' : 'boom', Math.max(v, .15)); if (v > .3) { this.addShake(big ? 18 : 9); this.stop(big ? .15 : .07); this.kick(big ? .18 : .08); } if (big && v > .5) { this.flash = .35; this.flashCol = '#fff3d0'; }
        break;
      }
      case 'beam': { const an = a / 1000; FxObjs.add({ type: 'beam', x, y, a: an, life: .9 }); for (let i = 0; i < 120; i++) { const d = i * 14; Particles.add(x + Math.cos(an) * d, y + Math.sin(an) * d, rnd(-140, 140), rnd(-140, 140), rnd(.4, 1.1), 4, i % 3 ? C_YEL : C_WHITE, 2); } Sound.play('laser', 1); Sound.play('bigboom', .8); this.addShake(18); this.stop(.15); this.kick(.15); this.flash = .35; this.flashCol = '#fff8c0'; break; }
      case 'warnItem': if (v) { Sound.play('warn', Math.max(v, a === me ? 1 : 0)); FxObjs.add({ type: 'ring', x, y, r0: 60, r1: 10, w: 3, col: '#ff2d2d', life: .3 }); } break;
      case 'arrowStart': Sound.play('charge', 1); Sound.play('warn', .8); break;
      case 'legend': for (let i = 0; i < 3; i++) FxObjs.add({ type: 'ring', x, y, r0: 6, r1: 120 + i * 40, w: 8, col: [MACHINES[a].col, '#ffffff', '#ffe14d'][i], life: .9 + i * .2 }); Particles.burst(x, y, 200, 320, 1.6, 4, RAINBOW, 1.4); Sound.play('win', 1); Sound.play('bigboom', .7); this.flash = .45; this.flashCol = '#ffffff'; this.stop(.2); this.kick(.2); this.addShake(12); break;
      case 'event': Sound.play('event', 1); Sound.play('bigboom', .5); this.addShake(14); this.kick(.12); break;
      case 'go': Sound.play('go', 1); this.addShake(10); this.kick(.12); break;
      case 'warn': Sound.play('warn', 1); break;
      case 'bossIn': this.boom(x, y, 50, [C_PUR, C_WHITE, C_DARK], 160, true); FxObjs.add({ type: 'ring', x, y, r0: 10, r1: 220, w: 12, col: '#c86bff', life: 1.2 }); Sound.play('bigboom', 1); this.addShake(16); this.kick(.15); break;
      case 'bossOut': Particles.burst(x, y, 80, 200, 1.2, 5, [C_PUR, C_SMOKE]); Sound.play('boom', .8); break;
      case 'bossDie': for (let i = 0; i < 5; i++) FxObjs.add({ type: 'ring', x, y, r0: 10 + i * 10, r1: 200 + i * 50, w: 12, col: ['#ffffff', '#ffe14d', '#ff9b3d', '#c86bff', '#ff4d6d'][i], life: .8 + i * .25 }); this.boom(x, y, 60, [C_WHITE, C_YEL, C_ORA, C_PUR].concat(RAINBOW), 300, true); Sound.play('bigboom', 1); Sound.play('win', .6); this.addShake(24); this.flash = .6; this.flashCol = '#ffffff'; this.stop(.35); this.kick(.25); break;
      case 'roar': FxObjs.add({ type: 'ring', x, y, r0: 30, r1: 140, w: 6, col: '#c86bff', life: .5 }); Sound.play('shotB', v); if (v > .4) this.addShake(6); break;
      case 'warnLine': FxObjs.add({ type: 'warnLine', x, y, a: a / 1000, life: .55 }); if (v) Sound.play('warn', v * .7); break;
      case 'impact': if (v) { this.boom(x, y, a * .6, [C_ORA, C_RED, C_YEL, C_WHITE], 50, false); Sound.play('boom', v); if (v > .5) { this.addShake(8); this.stop(.04); } } break;
      case 'megaImpact': FxObjs.add({ type: 'disc', x, y, r0: a * 1.2, r1: a * .2, col: '#fff3d0', life: .6 }); for (let i = 0; i < 4; i++) FxObjs.add({ type: 'ring', x, y, r0: 10, r1: a * (1.2 + i * .4), w: 14, col: ['#ffffff', '#ff9b3d', '#ff4d4d', '#ffe14d'][i], life: .8 + i * .3 }); this.boom(x, y, a * .4, [C_WHITE, C_YEL, C_ORA, C_RED], 400, true); Sound.play('bigboom', 1); this.addShake(30); this.flash = .7; this.flashCol = '#fff3d0'; this.stop(.3); this.kick(.3); break;
      case 'starLand': if (v) { Particles.burst(x, y, 18, 120, .6, 3, [C_YEL, C_WHITE]); FxObjs.add({ type: 'ring', x, y, r0: 2, r1: 24, w: 3, col: '#fff3b0', life: .35 }); Sound.play('pick', v * .5); } break;
      case 'vanish': if (v) Particles.burst(x, y, 30, 90, .9, 4, [C_WHITE, C_GRAY], 2, -20); break;
      case 'stun': Particles.burst(x, y, 30, 120, .9, 3, [C_YEL, C_WHITE]); FxObjs.add({ type: 'ring', x, y, r0: 4, r1: 40, w: 3, col: '#ffe14d', life: .4 }); Sound.play('kill', v); if (v > .4) this.stop(.06); break;
      case 'rainbow': if (v) for (let i = 0; i < 3; i++) Particles.add(x + rnd(-8, 8), y + rnd(-8, 8), rnd(-30, 30), rnd(-30, 30), rnd(.5, 1), 4, RAINBOW[(Math.random() * 8) | 0], 2); break;
      case 'dust': if (v) Particles.add(x + rnd(-4, 4), y + rnd(-4, 4), rnd(-10, 10), rnd(-10, 10), .5, 4, C_GRAY, 2); break;
      case 'flowerPop': if (v) { Particles.burst(x, y, 24, 110, .9, 3, [C_PINK, C_WHITE, C_YEL], 2, 20); Sound.play('pick', v * .6); } break;
      case 'bounce': if (v) { Particles.burst(x, y, 14, 120, .35, 3, C_WHITE); Sound.play('boom', v * .5); if (v > .5) this.addShake(4); } break;
      case 'warp': FxObjs.add({ type: 'ring', x, y, r0: 36, r1: 2, w: 4, col: '#c86bff', life: .35 }); Particles.burst(x, y, 30, 140, .6, 3, [C_PUR, C_WHITE, C_PINK]); Sound.play('whoosh', v); break;
    }
  },
};
