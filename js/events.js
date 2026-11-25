'use strict';
// ============================================================
//  イベント (トレーニング中に数回発生)
// ============================================================
const REGION_NAME = ['左上', '上', '右上', '左', '真ん中', '右', '左下', '下', '右下'];
const EVENT_DEFS = {
  boss: { name: '巨大モンスター襲来!', short: '巨大モンスター', col: '#c86bff', major: 1, w: 10, dur: 90, desc: 'ギガベヒモス出現! 撃破でアイテムとステータスが散らばる。ダメージ上位3名とラストアタックはボーナス!' },
  keys: { name: '鍵付き宝箱出現!', short: '鍵付き宝箱', col: '#ffe14d', major: 1, w: 8, dur: 70, desc: '3つの鍵と3つの鍵付き宝箱が出現! 鍵を持って宝箱に触れると開く。鍵は相手を撃破すると奪える!' },
  meteor: { name: '巨大隕石襲来!', short: '巨大隕石', col: '#ff6a2e', major: 1, w: 9, dur: 32, desc: '隕石が大量落下! 赤い警告円から逃げろ! 落下跡にはステータスが…最後に超巨大隕石が落ちる!' },
  gold: { name: 'ゴールドラッシュ!', short: 'ゴールドラッシュ', col: '#ffcc33', major: 1, w: 9, dur: 50, desc: '金色宝箱が大量出現! 壊しやすいが中身は少なめ。虹色の金鉱石は大当たり!' },
  fish: { name: 'レインボーフィッシュ!', short: 'レインボーフィッシュ', col: '#ff7ad9', major: 0, w: 4, dur: 60, desc: '虹色の金魚が虹の軌跡を残して泳ぐ! 倒せないが、攻撃するほどアイテムとステータスがこぼれる!' },
  wild: { name: 'マシン襲来!', short: 'マシン襲来', col: '#3dffe0', major: 0, w: 4, dur: 50, desc: '野生マシンが暴走中! 撃つと鈍り、スタンしたら近づいて X で乗れる! 虹色の伝説マシンも1台…!' },
  speed: { name: 'ハイスピード!', short: 'ハイスピード', col: '#4dc3ff', major: 1, w: 9, dur: 30, desc: '全員の移動速度が超アップ! スピードラビットも大発生! いろんなステータスを落とすぞ' },
  maze: { name: 'フラワーラビリンス!', short: 'フラワーラビリンス', col: '#ff7ad9', major: 0, w: 4, dur: 45, desc: 'マップが花の迷路に! 曲がり角にステータスやアイテムが次々出現。走り回れ!' },
  rush: { name: 'モンスターラッシュ!', short: 'モンスターラッシュ', col: '#ff4d4d', major: 1, w: 10, dur: 40, desc: 'エリアに雑魚敵が大量発生!' },
  ball: { name: 'ビッグボール!', short: 'ビッグボール', col: '#ff9b3d', major: 0, w: 5, dur: 40, desc: '巨大ボールが跳ね回る! 当たるとダメージ。宝箱や敵は一撃で壊れてアイテムを落とす!' },
  shrink: { name: 'スケールダウン!', short: 'スケールダウン', col: '#a0a8c0', major: 0, w: 4, dur: 35, desc: 'マップが一時的に狭くなる! 大混戦に備えろ!' },
  warp: { name: 'ワープホール!', short: 'ワープホール', col: '#b07aff', major: 0, w: 4, dur: 45, desc: 'ワープホールが大量出現! 入るとランダムな別のホールへワープ。初めて通るホールではステータスボーナス!' },
  star: { name: 'スターシャワー!', short: 'スターシャワー', col: '#fff3b0', major: 1, w: 8, dur: 22, desc: 'ステータスの流れ星がマップ中に降り注ぐ! 拾い放題!' },
};
const EVENT_KEYS = Object.keys(EVENT_DEFS);

const Events = {
  init(g) {
    const T = g.cfg.trainTime, n = clamp(Math.floor((T - 30) / 50), 1, 9);
    const pool = EVENT_KEYS.slice(), chosen = [];
    const wpick = (arr) => { const tot = arr.reduce((a, k) => a + EVENT_DEFS[k].w, 0); let r = Math.random() * tot; for (const k of arr) { r -= EVENT_DEFS[k].w; if (r <= 0) return k; } return arr[arr.length - 1]; };
    for (let i = 0; i < n; i++) { const k = wpick(pool); chosen.push(k); pool.splice(pool.indexOf(k), 1); }
    if (chosen.every(k => EVENT_DEFS[k].major)) { // 必ず1つはメジャーでないイベントを混ぜる
      const minor = EVENT_KEYS.filter(k => !EVENT_DEFS[k].major && !chosen.includes(k));
      chosen[rndi(0, chosen.length - 1)] = wpick(minor);
    }
    shuffle(chosen);
    const slot = (T - 38) / n;
    g.evt = { list: chosen.map((type, i) => ({ type, at: 20 + i * slot + Math.random() * slot * .12, dur: Math.min(EVENT_DEFS[type].dur, Math.max(18, slot * .82)) })), idx: 0, cur: null };
  },
  update(g, dt) {
    const E = g.evt;
    if (!E.cur && E.idx < E.list.length && g.elapsed >= E.list[E.idx].at) { this.start(g, E.list[E.idx]); E.idx++; }
    const c = E.cur;
    if (c) {
      c.t -= dt; c.el += dt;
      const fn = this['u_' + c.type]; if (fn) fn.call(this, g, c, dt);
      if ((c.el | 0) !== ((c.el - dt) | 0)) this.marks(g, c);
      if (c.t <= 0 || c.done) this.end(g);
    }
    this.updateSpecials(g, dt);
  },
  start(g, ent) {
    const c = { type: ent.type, t: ent.dur, dur: ent.dur, el: 0, marks: [], st: g.elapsed };
    g.evt.cur = c;
    const fn = this['s_' + c.type]; if (fn) fn.call(this, g, c);
    this.marks(g, c);
    g.fx('event', 0, 0);
  },
  end(g) {
    const c = g.evt.cur; if (!c) return;
    const fn = this['e_' + c.type]; if (fn) fn.call(this, g, c);
    g.evt.cur = null; g.evt.last = c.type; g.evt.lastT = g.elapsed;
  },
  endAll(g) { this.end(g); g.boss = null; g.fish = null; g.balls = []; g.meteors = []; g.warps = []; g.wilds = []; g.speedMul = 1; g.map.over = null; g.map.bnd = null; },
  marks(g, c) {
    const M = [];
    switch (c.type) {
      case 'boss': if (g.boss) M.push([g.boss.x, g.boss.y]); break;
      case 'fish': if (g.fish) M.push([g.fish.x, g.fish.y]); break;
      case 'keys': for (const ch of g.chests) if (ch.type === 'L') M.push([ch.x, ch.y]); for (const k of g.pickups) if (k.k === PK_KEY) M.push([k.x, k.y]); for (const p of g.players) if (p.key) M.push([p.x, p.y]); break;
      case 'meteor': for (const m of g.meteors) if (m.big) M.push([m.x, m.y]); break;
      case 'gold': for (const ch of g.chests) if (ch.type === 'O') M.push([ch.x, ch.y]); break;
      case 'wild': for (const w of g.wilds) if (w.legend) M.push([w.x, w.y]); for (const w of g.wilds) if (!w.legend && M.length < 6) M.push([w.x, w.y]); break;
      case 'rush': M.push([c.x, c.y]); break;
      case 'ball': for (const b of g.balls) M.push([b.x, b.y]); break;
      case 'warp': for (const w of g.warps) { M.push([w.x, w.y]); } break;
    }
    c.marks = M.map(([x, y]) => [Math.round(x), Math.round(y)]);
  },

  // ---------- 巨大モンスター ----------
  s_boss(g, c) {
    const pos = g.spawnPos(30, 260), mhp = 2000 + g.n() * 170;
    g.boss = { id: g.id(), x: pos.x, y: pos.y, vx: 0, vy: 0, hp: mhp, mhp, a: 0, st: 'walk', stT: 2, flash: 0, dmgBy: {}, last: -1, atk: 0 };
    g.fx('bossIn', pos.x, pos.y);
  },
  u_boss(g, c, dt) { if (!g.boss) c.done = true; },
  e_boss(g, c) { if (g.boss) { g.fx('bossOut', g.boss.x, g.boss.y); g.boss = null; } },
  damageBoss(g, b, dmg, src) {
    if (b.hp <= 0) return; b.hp -= dmg; b.flash = .12;
    if (src >= 0) { b.dmgBy[src] = (b.dmgBy[src] || 0) + dmg; b.last = src; }
    if (b.hp <= 0) {
      g.fx('bossDie', b.x, b.y);
      g.scatter(b.x, b.y, g.makeLoot(14, 1, 1, .5, .2).concat([g.rollItem(true), g.rollItem(true), g.rollItem(false)]), 170);
      const rank = Object.entries(b.dmgBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => +e[0]);
      const rewards = [[6, 1], [4, 1], [3, 0]];
      rank.forEach((id, i) => { const p = g.players[id]; if (p && !p.out && p.dead <= 0) { g.give(p, g.makeLoot(rewards[i][0], 0, rewards[i][1]), b.x, b.y); g.note(p, 'ダメージ' + (i + 1) + '位ボーナス!', '#ffe14d'); } });
      const L = g.players[b.last]; if (L && !L.out && L.dead <= 0) { g.give(L, g.makeLoot(4, 0, 1), b.x, b.y); g.note(L, 'ラストアタックボーナス!', '#ffe14d'); }
      g.gfxEv('bossDown', b.last, rank);
      g.boss = null;
    }
  },
  updateBoss(g, b, dt) {
    b.flash = Math.max(0, b.flash - dt); b.stT -= dt; b.a += dt;
    let tg = null, bd = 520 * 520;
    for (const p of g.players) if (!p.out && p.dead <= 0) { const d = d2(p.x, p.y, b.x, b.y); if (d < bd) { bd = d; tg = p; } }
    const ta = tg ? Math.atan2(tg.y - b.y, tg.x - b.x) : b.a * .3;
    if (b.st === 'walk') {
      b.vx = lerp(b.vx, Math.cos(ta) * 55, .03); b.vy = lerp(b.vy, Math.sin(ta) * 55, .03);
      if (b.stT <= 0 && tg) {
        const r = Math.random(); b.atk++;
        if (r < .3) { for (let k = 0; k < 2; k++) for (let i = 0; i < 32; i++) { const a = i / 32 * TAU + b.atk * .2 + k * .1; g.enemyShot(b.x, b.y, a, 130 + k * 50, 7, -2, 16, 4, 3); } g.fx('roar', b.x, b.y); b.stT = 1.4; }
        else if (r < .5) { b.st = 'spiral'; b.burst = 24; b.stT = .05; g.fx('roar', b.x, b.y); }
        else if (r < .75) { b.st = 'burst'; b.burst = 6; b.stT = .15; }
        else { b.st = 'charge'; b.stT = 1.0; b.ca = ta; g.fx('warnLine', b.x, b.y, Math.round(ta * 1000)); }
      }
    } else if (b.st === 'burst') {
      b.vx *= .9; b.vy *= .9;
      if (b.stT <= 0) { for (let i = -2; i <= 2; i++) g.enemyShot(b.x, b.y, ta + i * .16, 170, 6, -2, 16, 4, 2.5); b.burst--; b.stT = .18; if (b.burst <= 0) { b.st = 'walk'; b.stT = 1.3; } }
    } else if (b.st === 'spiral') { // 渦巻き弾幕
      b.vx *= .9; b.vy *= .9;
      if (b.stT <= 0) { for (let k = 0; k < 4; k++) g.enemyShot(b.x, b.y, b.burst * .35 + k * TAU / 4, 150, 6, -2, 16, 4, 3); b.burst--; b.stT = .07; if (b.burst <= 0) { b.st = 'walk'; b.stT = 1.3; } }
    } else if (b.st === 'charge') {
      if (b.stT > .55) { b.vx *= .85; b.vy *= .85; } else { b.vx = Math.cos(b.ca) * 360; b.vy = Math.sin(b.ca) * 360; if ((g.tick & 1) === 0) g.fx('dust', b.x, b.y); }
      if (b.stT <= 0) { b.st = 'walk'; b.stT = 1.5; }
    }
    b.x = clamp(b.x + b.vx * dt, 40, g.map.w - 40); b.y = clamp(b.y + b.vy * dt, 40, g.map.h - 40);
    for (const p of g.players) if (!p.out && p.dead <= 0 && d2(p.x, p.y, b.x, b.y) < 46 * 46 && !(p.bossCd > g.elapsed)) {
      p.bossCd = g.elapsed + .8; g.damagePlayer(p, b.st === 'charge' ? 16 : 8, -2);
      const a = Math.atan2(p.y - b.y, p.x - b.x); p.vx = Math.cos(a) * 260; p.vy = Math.sin(a) * 260;
    }
  },

  // ---------- 鍵付き宝箱 ----------
  s_keys(g, c) {
    for (let i = 0; i < 3; i++) g.spawnChest('L', g.spawnPos(12, 200));
    for (let i = 0; i < 3; i++) { const p = g.spawnPos(8, 200); g.pickups.push({ id: g.id(), x: p.x, y: p.y, z: 0, vz: 0, vx: 0, vy: 0, k: PK_KEY, t: 1, life: 1e9 }); }
  },
  u_keys(g, c) { if (!g.chests.some(ch => ch.type === 'L')) c.done = true; },
  e_keys(g, c) {
    for (const ch of g.chests) if (ch.type === 'L') { g.fx('vanish', ch.x, ch.y); ch.hp = 0; }
    g.chests = g.chests.filter(ch => ch.hp > 0);
    g.pickups = g.pickups.filter(k => k.k !== PK_KEY); for (const p of g.players) p.key = false;
  },

  // ---------- 隕石 / スターシャワー ----------
  s_meteor(g, c) { c.spawn = 0; c.bigDone = false; },
  u_meteor(g, c, dt) {
    c.spawn -= dt;
    if (c.t > 7 && c.spawn <= 0) {
      c.spawn = .16 * (1750 * 1750) / (g.map.w * g.map.h);
      let x, y; const alive = g.players.filter(p => !p.out && p.dead <= 0);
      if (Math.random() < .5 && alive.length) { const p = pick(alive); x = p.x + rnd(-120, 120); y = p.y + rnd(-90, 90); }
      else { x = rnd(30, g.map.w - 30); y = rnd(30, g.map.h - 30); }
      g.meteors.push({ id: g.id(), x, y, t: 0, fall: 1.5, r: 44, big: 0, kind: 0 });
    }
    if (!c.bigDone && c.t <= 7) {
      c.bigDone = true; const alive = g.players.filter(p => !p.out && p.dead <= 0);
      let x = g.map.w / 2, y = g.map.h / 2; if (alive.length) { x = 0; y = 0; for (const p of alive) { x += p.x; y += p.y; } x /= alive.length; y /= alive.length; x += rnd(-200, 200); y += rnd(-200, 200); }
      g.meteors.push({ id: g.id(), x: clamp(x, 100, g.map.w - 100), y: clamp(y, 100, g.map.h - 100), t: 0, fall: 5.5, r: 240, big: 1, kind: 1 });
      g.fx('warn', 0, 0);
    }
    if (c.bigDone && !g.meteors.some(m => m.big) && c.t < 1) c.done = true;
  },
  s_star(g, c) { c.spawn = 0; },
  u_star(g, c, dt) {
    c.spawn -= dt;
    if (c.spawn <= 0 && c.t > 1.2) { c.spawn = c.dur / (g.n() * 4); const pos = g.map.freePos(6); g.meteors.push({ id: g.id(), x: pos.x, y: pos.y, t: 0, fall: 1.1, r: 0, big: 0, kind: 2 }); }
  },
  landMeteor(g, m) {
    if (m.kind === 2) { g.fx('starLand', m.x, m.y); g.scatter(m.x, m.y, Math.random() < .3 ? [rndi(0, 3), rndi(0, 3)] : [rndi(0, 3)], 40); return; }
    g.fx(m.big ? 'megaImpact' : 'impact', m.x, m.y, m.r);
    const dmg = m.big ? 60 : 22;
    g.forTargets(m.x, m.y, m.r, (o, kind) => g.hit(o, kind, kind === 1 ? dmg : dmg * 3, -1, m.x, m.y));
    if (m.big) g.scatter(m.x, m.y, g.makeLoot(18, 1, 1, .4, .15).concat([g.rollItem(true), g.rollItem(false)]), 220);
    else if (Math.random() < .12) g.scatter(m.x, m.y, [rndi(0, 3)], 30);
  },

  // ---------- ゴールドラッシュ ----------
  s_gold(g, c) {
    const n = Math.min(100, 16 + Math.round(g.n() * 1.4));
    for (let i = 0; i < n; i++) g.spawnChest('G', g.map.freePos(8));
    for (let i = 0; i < 3; i++) g.spawnChest('O', g.spawnPos(14, 160));
  },
  e_gold(g) { for (const ch of g.chests) if (ch.type === 'G' || ch.type === 'O') { ch.hp = 0; g.fx('vanish', ch.x, ch.y); } g.chests = g.chests.filter(ch => ch.hp > 0); },

  // ---------- レインボーフィッシュ ----------
  s_fish(g, c) {
    const side = rndi(0, 3), W2 = g.map.w, H2 = g.map.h, m = 60;
    const pts = [[m, rnd(m, H2 - m)], [W2 - m, rnd(m, H2 - m)], [rnd(m, W2 - m), m], [rnd(m, W2 - m), H2 - m]];
    const s = pts[side], e = pts[side ^ 1];
    const mhp = 3000 + g.n() * 200;
    g.fish = { id: g.id(), x: s[0], y: s[1], sx: s[0], sy: s[1], ex: e[0], ey: e[1], hp: mhp, mhp, acc: 0, flash: 0, a: Math.atan2(e[1] - s[1], e[0] - s[0]), t: 0, dur: c.dur - 2 };
  },
  u_fish(g, c) { if (!g.fish) c.done = true; },
  e_fish(g) { if (g.fish) { g.fx('vanish', g.fish.x, g.fish.y); g.fish = null; } },
  damageFish(g, f, dmg, src) {
    // 体力の概念なし: ダメージが一定たまるたびにアイテム・ステータスがこぼれる
    f.acc += dmg; f.flash = .12;
    const step = f.mhp * .012;
    while (f.acc >= step) { f.acc -= step; g.scatter(f.x, f.y, [Math.random() < .15 ? g.rollItem(Math.random() < .25) : rndi(0, 3)], 120); }
  },

  // ---------- マシン襲来 ----------
  s_wild(g, c) {
    const n = Math.min(36, 9 + Math.round(g.n() / 2.2));
    for (let i = 0; i < n; i++) {
      const legend = i === 0, m = legend ? pick(LEGEND_IDS) : pick(NORMAL_SPAWN), pos = g.map.freePos(8), mhp = legend ? 170 : 60;
      g.wilds.push({ id: g.id(), m, x: pos.x, y: pos.y, vx: 0, vy: 0, a: Math.random() * TAU, hp: mhp, mhp, stun: 0, legend, spd: legend ? 420 : 290, turn: 0, taken: false, flash: 0 });
    }
  },
  u_wild(g, c) { if (!g.wilds.length) c.done = true; },
  e_wild(g) { for (const w of g.wilds) g.fx('vanish', w.x, w.y); g.wilds = []; },
  damageWild(g, w, dmg, src) {
    if (w.stun > 0 || w.taken) return; w.hp -= dmg; w.flash = .14;
    if (w.hp <= 0) { w.stun = 8; w.hp = 0; g.fx('stun', w.x, w.y); }
  },
  boardWild(g, p, w) {
    w.taken = true; g.wilds.splice(g.wilds.indexOf(w), 1);
    g.board(p, { x: w.x, y: w.y, m: w.m });
    if (w.legend) g.gfxEv('legend', p.id, w.m);
  },
  updateWild(g, w, dt) {
    w.flash = Math.max(0, w.flash - dt);
    if (w.stun > 0) { w.stun -= dt; w.vx *= .9; w.vy *= .9; if (w.stun <= 0) w.hp = w.mhp; g.map.move(w, w.vx * dt, w.vy * dt, 7); return; }
    w.turn -= dt;
    if (w.turn <= 0) { w.turn = rnd(.6, 1.8); w.ta = w.a + rnd(-1.6, 1.6); }
    w.a += clamp(angDiff(w.a, w.ta), -4 * dt, 4 * dt);
    const s = w.spd * (.3 + .7 * w.hp / w.mhp) * (g.speedMul > 1 ? 1.3 : 1);
    w.vx = lerp(w.vx, Math.cos(w.a) * s, .1); w.vy = lerp(w.vy, Math.sin(w.a) * s, .1);
    if (g.map.move(w, w.vx * dt, w.vy * dt, 7)) { w.a += Math.PI + rnd(-.6, .6); w.ta = w.a; }
    if ((g.tick & 3) === 0) g.fx(w.legend ? 'rainbow' : 'dust', w.x, w.y);
    for (const p of g.players) if (!p.out && p.dead <= 0 && d2(p.x, p.y, w.x, w.y) < 14 * 14 && !(p.wildCd > g.elapsed)) {
      p.wildCd = g.elapsed + .8; g.damagePlayer(p, w.legend ? 14 : 8, -1); const a = Math.atan2(p.y - w.y, p.x - w.x); p.vx = Math.cos(a) * 200; p.vy = Math.sin(a) * 200;
    }
  },

  // ---------- ハイスピード ----------
  s_speed(g, c) { g.speedMul = 2.0; c.spawn = 0; for (let i = 0; i < 7 + g.n() / 4; i++) g.spawnEnemyGroup(null, [4], rndi(4, 6)); },
  u_speed(g, c, dt) { c.spawn -= dt; if (c.spawn <= 0) { c.spawn = 2.5; if (g.enemies.length < g.enemyTarget() + 40) g.spawnEnemyGroup(null, [4], rndi(3, 5)); } },
  e_speed(g) { g.speedMul = 1; },

  // ---------- フラワーラビリンス ----------
  s_maze(g, c) {
    c.seed = (Math.random() * 1e9) | 0; const L = genLabyrinth(g.map, c.seed);
    g.map.over = L.over; g.map.overT = 0; g.map.buildMini(); c.corners = L.corners; c.spawn = 1;
    for (const p of g.players) g.map.unstuck(p, 7);
    for (const e of g.enemies) g.map.unstuck(e, 6); for (const ch of g.chests) g.map.unstuck(ch, 9); for (const m of g.machines) g.map.unstuck(m, 8); for (const k of g.pickups) g.map.unstuck(k, 2);
  },
  u_maze(g, c, dt) {
    c.spawn -= dt;
    if (c.spawn <= 0) {
      c.spawn = Math.max(.4, 2.4 - g.n() * .02);
      const cn = pick(c.corners); if (cn) { const pos = { x: cn.x, y: cn.y }; g.map.unstuck(pos, 4); const codes = [rndi(0, 3)]; if (Math.random() < .4) codes.push(rndi(0, 3)); if (Math.random() < .2) codes.push(g.rollItem(Math.random() < .3)); g.fx('flowerPop', pos.x, pos.y); g.scatter(pos.x, pos.y, codes, 40, 'maze'); }
    }
  },
  e_maze(g) { g.map.over = null; g.map.buildMini(); let n = 0; g.pickups = g.pickups.filter(k => { if (k.tag !== 'maze') return true; if (n++ % 3 === 0) g.fx('vanish', k.x, k.y); return false; }); }, // 残ったアイテムは消える(急いで集めよう)

  // ---------- モンスターラッシュ ----------
  s_rush(g, c) {
    c.region = rndi(0, 8); const rx = c.region % 3, ry = Math.floor(c.region / 3);
    c.area = { x0: g.map.w * rx / 3, y0: g.map.h * ry / 3, x1: g.map.w * (rx + 1) / 3, y1: g.map.h * (ry + 1) / 3 };
    c.x = (c.area.x0 + c.area.x1) / 2; c.y = (c.area.y0 + c.area.y1) / 2; c.spawn = 0; c.made = 0;
    for (let i = 0; i < 7 + g.n() / 5; i++) this.rushGroup(g, c); /* ラッシュは控えめに */
  },
  rushGroup(g, c) {
    const A = c.area; let pos;
    for (let i = 0; i < 30; i++) { pos = { x: rnd(A.x0 + 30, A.x1 - 30), y: rnd(A.y0 + 30, A.y1 - 30) }; if (!g.map.hitBox(pos.x, pos.y, 10)) break; }
    g.spawnEnemyGroup(pos, [rndi(0, 3), rndi(0, 3)], rndi(3, 5)); c.made++;
  },
  u_rush(g, c, dt) { c.spawn -= dt; if (c.spawn <= 0) { c.spawn = 1.3; if (g.enemies.length < g.enemyTarget() + 70) this.rushGroup(g, c); } },

  // ---------- ビッグボール ----------
  s_ball(g, c) {
    const n = Math.min(16, 6 + Math.round(g.n() / 6));
    for (let i = 0; i < n; i++) { const pos = g.spawnPos(16, 150), a = Math.random() * TAU, s = rnd(220, 290); g.balls.push({ id: g.id(), x: pos.x, y: pos.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, kind: i % 3, rot: 0 }); }
  },
  e_ball(g) { for (const b of g.balls) g.fx('vanish', b.x, b.y); g.balls = []; },
  updateBall(g, b, dt) {
    const r = 20; b.rot += Math.hypot(b.vx, b.vy) * dt / r * (b.vx >= 0 ? 1 : -1);
    const nx = b.x + b.vx * dt; if (g.map.hitBox(nx, b.y, r - 6)) { b.vx = -b.vx; g.fx('bounce', b.x, b.y); } else b.x = nx;
    const ny = b.y + b.vy * dt; if (g.map.hitBox(b.x, ny, r - 6)) { b.vy = -b.vy; g.fx('bounce', b.x, b.y); } else b.y = ny;
    g.map.unstuck(b, r - 6);
    for (const p of g.players) if (!p.out && p.dead <= 0 && d2(p.x, p.y, b.x, b.y) < (r + 6) ** 2 && !(p.ballCd > g.elapsed)) {
      p.ballCd = g.elapsed + 1; g.damagePlayer(p, 16, -1); const a = Math.atan2(p.y - b.y, p.x - b.x); p.vx = Math.cos(a) * 300; p.vy = Math.sin(a) * 300; g.fx('bounce', b.x, b.y);
    }
    for (const e of g.enemies) if (e.hp > 0 && d2(e.x, e.y, b.x, b.y) < (r + 6) ** 2) g.damageEnemy(e, 999, -1);
    for (const ch of g.chests) if (ch.hp > 0 && ch.type !== 'L' && d2(ch.x, ch.y, b.x, b.y) < (r + 9) ** 2) { ch.hp = 0; g.openChest(ch, -1); }
  },

  // ---------- スケールダウン ----------
  s_shrink(g, c) {
    c.k = 0; const W2 = g.map.w, H2 = g.map.h, f = .3;
    c.full = { x0: 0, y0: 0, x1: W2, y1: H2 }; c.small = { x0: W2 * f, y0: H2 * f, x1: W2 * (1 - f), y1: H2 * (1 - f) };
    g.map.bnd = Object.assign({}, c.full);
    for (let i = 0; i < 3; i++) g.spawnChest('A', g.map.freePos(10, Math.random, 40, { x: W2 / 2, y: H2 / 2, r: W2 * .18 }));
  },
  u_shrink(g, c, dt) {
    const target = c.t > 3 ? 1 : 0; c.k = clamp(c.k + (target ? dt : -dt) / 3, 0, 1);
    const b = g.map.bnd, F = c.full, S = c.small, e = c.k * c.k * (3 - 2 * c.k);
    b.x0 = lerp(F.x0, S.x0, e); b.y0 = lerp(F.y0, S.y0, e); b.x1 = lerp(F.x1, S.x1, e); b.y1 = lerp(F.y1, S.y1, e);
    const push = (o, r) => { const ox = o.x, oy = o.y; o.x = clamp(o.x, b.x0 + r + 2, b.x1 - r - 2); o.y = clamp(o.y, b.y0 + r + 2, b.y1 - r - 2); if (ox !== o.x || oy !== o.y) g.map.unstuck(o, r); };
    for (const p of g.players) if (!p.out) push(p, 7);
    for (const en of g.enemies) push(en, 6); for (const ch of g.chests) push(ch, 9); for (const m of g.machines) push(m, 7); for (const w of g.wilds) push(w, 7);
    for (const bl of g.bullets) if (bl.x < b.x0 || bl.x > b.x1 || bl.y < b.y0 || bl.y > b.y1) bl.t = bl.life;
  },
  e_shrink(g) { g.map.bnd = null; },

  // ---------- ワープホール ----------
  s_warp(g, c) {
    const n = Math.min(30, 12 + Math.round(g.n() / 3)); // 大量のワープホール。入るとランダムな別のホールへ
    for (let i = 0; i < n; i++) { const a = g.map.freePos(16); g.warps.push({ id: g.id(), x: a.x, y: a.y, hue: i % 6, used: {} }); }
  },
  e_warp(g) { for (const w of g.warps) g.fx('vanish', w.x, w.y); g.warps = []; },
  updateWarp(g, w, dt) {
    for (const p of g.players) {
      if (p.out || p.dead > 0 || p.warpCd > g.elapsed) continue;
      if (d2(p.x, p.y, w.x, w.y) < 15 * 15) {
        const others = g.warps.filter(o => o !== w), to = pick(others); if (!to) continue;
        g.fx('warp', p.x, p.y); p.x = to.x + Math.cos(p.a) * 22; p.y = to.y + Math.sin(p.a) * 22; g.map.unstuck(p, 7); p.warpCd = g.elapsed + 1.2; g.fx('warp', p.x, p.y);
        if (!w.used[p.id]) { w.used[p.id] = 1; const k = rndi(0, 3); g.addStat(p, k); g.note(p, STAT_NAME[k] + ' UP!', STAT_COL[k], 's' + k); }
      }
    }
  },

  // ---------- 常時更新 ----------
  updateSpecials(g, dt) {
    if (g.boss) this.updateBoss(g, g.boss, dt);
    if (g.fish) {
      const f = g.fish; f.t += dt; f.flash = Math.max(0, f.flash - dt); const k = Math.min(1, f.t / f.dur);
      f.x = lerp(f.sx, f.ex, k) + Math.sin(f.t * .8) * 30 * Math.sin(f.a + 1.57); f.y = lerp(f.sy, f.ey, k) + Math.sin(f.t * .8) * 30 * Math.cos(f.a);
      if ((g.tick & 7) === 0) g.fx('rainbow', f.x - Math.cos(f.a) * 30, f.y - Math.sin(f.a) * 30);
      if (k >= 1) { g.fx('vanish', f.x, f.y); g.fish = null; }
    }
    for (const w of g.wilds) this.updateWild(g, w, dt);
    for (const b of g.balls) this.updateBall(g, b, dt);
    for (const w of g.warps) this.updateWarp(g, w, dt);
    if (g.meteors.length) {
      for (const m of g.meteors) { m.t += dt; if (m.t >= m.fall) { m.done = true; this.landMeteor(g, m); } }
      g.meteors = g.meteors.filter(m => !m.done);
    }
  },
};
