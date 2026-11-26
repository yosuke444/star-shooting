'use strict';
// ============================================================
//  ゲームシミュレーション (ホスト権威。CPU戦もこれ)
// ============================================================
const DT = 1 / 60;
const CPU_NAMES = ['ポチ', 'タマ', 'ジロー', 'ハヤテ', 'コメット', 'ルナ', 'ソラ', 'ミント', 'レオ', 'ナギ', 'ピコ', 'ガロ', 'ユキ', 'ベガ', 'リゲル', 'シリウス', 'ノヴァ', 'クロ', 'モモ', 'キラ', 'ジェット', 'ボルト', 'メテオ', 'アトム'];
const RESPAWN_T = 12, BATTLE_RESPAWN = 3, STATUS_TIME = 10; // STATUS_TIME: バトル前のステータス確認タイム(秒)

class SpatialGrid {
  constructor(cell) { this.c = cell; this.m = new Map(); this.pool = []; }
  clear() { for (const a of this.m.values()) { a.length = 0; this.pool.push(a); } this.m.clear(); }
  add(o) { const k = ((Math.floor(o.x / this.c) + 512) << 11) | (Math.floor(o.y / this.c) + 512); let a = this.m.get(k); if (!a) { a = this.pool.pop() || []; this.m.set(k, a); } a.push(o); }
  each(x, y, fn) {
    const cx = Math.floor(x / this.c) + 512, cy = Math.floor(y / this.c) + 512;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const a = this.m.get(((cx + i) << 11) | (cy + j)); if (a) for (let n = 0; n < a.length; n++) if (fn(a[n]) === true) return; }
  }
}

class Game {
  constructor(cfg) {
    this.cfg = cfg; this.nextId = 1; this.elapsed = 0; this.tick = 0;
    this.phase = 'train'; this.t = cfg.trainTime; this.count = 0;
    const n = cfg.n; this.mapSize = Math.round(1300 + n * 55);
    this.mapSeed = cfg.seed; this.map = genTrainingMap(cfg.seed, this.mapSize);
    this.players = []; this.bullets = []; this.enemies = []; this.pickups = []; this.chests = []; this.machines = [];
    this.pending = [];
    this.boss = null; this.fish = null; this.balls = []; this.meteors = []; this.warps = []; this.wilds = [];
    this.fxq = []; this.gfx = []; this.speedMul = 1; this.zone = null; this.arena = -1; this.rou = null; this.result = null;
    this.legend = { order: shuffle(LEGEND_IDS.slice()), spawned: [0, 0, 0], done: [false, false, false] };
    this.grid = new SpatialGrid(80);
    this.spawnT = { m: 0, e: 0, c: 0 };
    // プレイヤー生成
    const humans = cfg.humans; let cpuNames = shuffle(CPU_NAMES.slice());
    for (let i = 0; i < n; i++) {
      const h = humans[i];
      const p = this.newPlayer(i, h ? h.name : (cpuNames[i % cpuNames.length] + (i >= cpuNames.length ? Math.floor(i / cpuNames.length) + 1 : '')), !h);
      if (h) { p.peer = h.peer || null; p.local = !!h.local; }
      this.players.push(p);
    }
    const spots = [];
    for (const p of this.players) {
      let best = null, bd = -1;
      for (let k = 0; k < 12; k++) { const s = this.map.freePos(8); let md = 1e9; for (const o of spots) md = Math.min(md, d2(s.x, s.y, o.x, o.y)); if (md > bd) { bd = md; best = s; } }
      spots.push(best); p.x = best.x; p.y = best.y; p.a = Math.random() * TAU;
    }
    Events.init(this);
    // 初期配置
    for (let i = 0; i < this.machineTarget(); i++) this.spawnMachine();
    for (let i = 0; i < this.enemyTarget() / 4; i++) this.spawnEnemyGroup();
    for (let i = 0; i < this.chestTarget(); i++) this.spawnChest();
  }
  newPlayer(id, name, cpu) {
    return {
      id, name, cpu, col: id % PLAYER_COLS.length, x: 0, y: 0, vx: 0, vy: 0, a: 0, m: 0, hp: 100, st: [0, 0, 0, 0],
      ride: 0, cd: 0, items: [], buf: { jet: 0, dumb: 0, glass: 0, bar: 0 }, inv: 2, dead: 0, out: false, flash: 0,
      parts: [0, 0, 0], key: false, stars: 0, bk: 0, tv: false, arw: null, dmgAcc: 0, kills: 0, place: 0, dmgBoss: 0, notes: [], mask: 0, pmask: 0,
      xHold: -1, sa: 1, ss: 1, sd: 1, sr: 1, lastAtk: -1, mask2: 0, ai: null, slash: 0, z: false,
    };
  }
  id() { return this.nextId++; }
  // 雑魚敵の強さ: トレーニング序盤はかなり弱く、時間とともに強くなる
  enemyPow() { const k = this.phase === 'train' ? clamp(this.elapsed / this.cfg.trainTime, 0, 1) : 1; return { hp: .55 + .55 * k, dmg: .4 + .7 * k }; }
  n() { return this.players.length; }
  machineTarget() { return Math.round(3 + this.n() * .45); }
  enemyTarget() { return Math.min(170, Math.round(14 + this.n() * 2.4)); }
  chestTarget() { return Math.min(90, Math.round(8 + this.n() * 1.1)); }

  // ---------- FX ----------
  fx(type, x, y, a = 0, b = 0, c = 0) { this.fxq.push([type, Math.round(x), Math.round(y), a, b, c]); if (this.onFx) this.onFx(type, x, y, a, b, c); }
  gfxEv(...args) { this.gfx.push(args); if (this.onGfx) this.onGfx(args); }
  note(p, txt, col = '#fff', icon) { p.notes.push(icon ? [txt, col, icon] : [txt, col]); } // icon 付きは画面にドンと出る

  // ---------- ステータス ----------
  calcStats(p) {
    const M = MACHINES[p.m].mul, s = p.st;
    p.sa = M[0] * (1 + .06 * s[0]) * (p.buf.dumb > 0 ? 1.45 : 1);
    p.ss = M[1] * (1 + .035 * s[1]) * (p.buf.jet > 0 ? 1.2 : 1) * this.speedMul;
    p.sd = M[2] * (1 + .06 * s[2]);
    p.sr = M[3] * (1 + .04 * s[3]) * (p.buf.glass > 0 ? 1.5 : 1);
  }
  addStat(p, i, n = 1) { const before = p.st[i]; p.st[i] = Math.min(STAT_CAP, p.st[i] + n); return p.st[i] - before; }
  totalSt(p) { return p.st[0] + p.st[1] + p.st[2] + p.st[3]; }

  // ---------- スポーン ----------
  farFromPlayers(pos, dist) { for (const p of this.players) if (!p.out && d2(p.x, p.y, pos.x, pos.y) < dist * dist) return false; return true; }
  spawnPos(r, dist = 180, area) { let pos; for (let i = 0; i < 20; i++) { pos = this.map.freePos(r, Math.random, 40, area); if (this.farFromPlayers(pos, dist)) return pos; } return pos; }
  spawnMachine(m, pos) {
    if (m === undefined) m = pick(NORMAL_SPAWN);
    pos = pos || this.spawnPos(8, 140);
    this.machines.push({ id: this.id(), x: pos.x, y: pos.y, m, a: Math.random() * TAU, t: 0 });
    if (this.machines.length > 120) this.machines.shift();
  }
  spawnEnemyGroup(pos, types, cnt) {
    pos = pos || this.spawnPos(8, 220);
    if (!types) { types = [rndi(0, 3)]; if (Math.random() < .4) types.push(rndi(0, 3)); }
    cnt = cnt || rndi(2, 4); // 1グループは小さめ
    for (let i = 0; i < cnt; i++) {
      const tp = pick(types), a = Math.random() * TAU, d = rnd(5, 40);
      const e = { id: this.id(), tp, x: pos.x + Math.cos(a) * d, y: pos.y + Math.sin(a) * d, vx: 0, vy: 0, hp: ENEMIES[tp].hp * this.enemyPow().hp, mhp: ENEMIES[tp].hp * this.enemyPow().hp, pw: this.enemyPow().dmg, t: Math.random() * 3, cd: 0, flash: 0, tgt: null, thk: 0, dir: Math.random() * TAU, face: 1 };
      this.map.unstuck(e, 6); this.enemies.push(e);
    }
  }
  spawnChest(type, pos) {
    type = type || (Math.random() < .25 ? 'A' : 'B');
    pos = pos || this.spawnPos(10, 160);
    const hp = { B: 60, A: 170, G: 24, O: 300, L: 1e9, I: 35 }[type];
    const c = { id: this.id(), type, x: pos.x, y: pos.y, hp, mhp: hp, flash: 0, last: -1, t: 0 };
    this.chests.push(c); return c;
  }
  // ---------- ピックアップ ----------
  // 出現できるパーツの種類: 1種類目が3つ出終わると2種類目、2種類目が完成すると3種類目
  // 出現するパーツの種類: 未完成の種類から選ぶ。出始めた種類(完成まで)はとても出やすい
  partKind() { const L = this.legend, c = []; for (let k = 0; k < 3; k++) if (!L.done[k] && L.spawned[k] < 3) c.push(k); if (!c.length) return -1; const w = c.map(k => L.spawned[k] > 0 ? 5 : 1), tot = w.reduce((a, b) => a + b); let r = Math.random() * tot; for (let i = 0; i < c.length; i++) { r -= w[i]; if (r <= 0) return c[i]; } return c[0]; }
  partBoost() { const L = this.legend; return L.spawned.some((s, k) => s > 0 && s < 3 && !L.done[k]) ? 4.5 : 1.8; }
  rollItem(rare) {
    if (rare) { const tot = Object.values(R_WEIGHT).reduce((a, b) => a + b, 0); let r = Math.random() * tot; for (const k of R_ITEMS) { r -= R_WEIGHT[k]; if (r <= 0) return PK_ITEM + ITEM_KEYS.indexOf(k); } }
    return PK_ITEM + ITEM_KEYS.indexOf(pick(N_ITEMS));
  }
  tvAvail() { return this.phase === 'train' && this.evt.idx < this.evt.list.length; }
  // 中身リストを作る: s=ステータス数, nP/rP=アイテム確率, part/tv 確率
  makeLoot(s, nP, rP, partP = 0, tvP = 0) {
    const out = [];
    for (let i = 0; i < s; i++) out.push(rndi(0, 3));
    if (Math.random() < nP) out.push(this.rollItem(false));
    if (Math.random() < rP) out.push(this.rollItem(true));
    const pk = this.partKind(); if (partP && pk >= 0 && Math.random() < partP * this.partBoost()) { const piece = this.legend.spawned[pk]++; out.push(PK_PART + pk * 3 + piece); }
    if (tvP && Math.random() < tvP && this.tvAvail()) out.push(PK_ITEM + ITEM_KEYS.indexOf('tv'));
    return out;
  }
  scatter(x, y, codes, spd = 90, tag) {
    for (const k of codes) {
      const a = Math.random() * TAU, v = rnd(spd * .55, spd * 1.45); // 派手に飛び散る
      const pk = { id: this.id(), x, y, z: 0, vz: rnd(110, 190), vx: Math.cos(a) * v, vy: Math.sin(a) * v, k, t: 0, life: k < PK_ITEM ? 50 : (k >= PK_PART ? 1e9 : 70), tag };
      this.pickups.push(pk);
    }
    if (this.pickups.length > 520) { // 古いステータスから消す
      let rm = this.pickups.length - 520; this.pickups = this.pickups.filter(p => { if (rm > 0 && p.k < PK_ITEM && p.t > 3) { rm--; return false; } return true; });
    }
  }
  // 直接付与(ラストアタック総取り・マグネット)
  give(p, codes, fromX, fromY) {
    const left = [];
    for (const k of codes) if (!this.applyPickup(p, k)) left.push(k);
    if (codes.length) this.fx('mag', fromX, fromY, p.id, codes.length);
    if (left.length) this.scatter(p.x, p.y, left, 50);
  }
  applyPickup(p, k) {
    if (k < PK_ITEM) { const g = this.addStat(p, k); this.note(p, STAT_NAME[k] + ' UP!', STAT_COL[k], 's' + k); return true; }
    if (isPart(k)) { this.gainPart(p, Math.floor((k - PK_PART) / 3), (k - PK_PART) % 3); return true; }
    if (k === PK_KEY) { if (p.key) return false; p.key = true; this.note(p, '鍵をゲット!', '#ffe14d', 'k'); this.gfxEv('key', p.id); return true; }
    const key = ITEM_KEYS[k - PK_ITEM], it = ITEMS[key];
    if (it.rar === 'N') { this.activate(p, key); this.fx('use', p.x, p.y, ITEM_KEYS.indexOf(key), p.id); this.note(p, it.name + '!', RAR_COL.N, 'i' + key); return true; }
    if (key === 'tv') { p.tv = true; this.note(p, '番組表ゲット!', RAR_COL.SR, 'itv'); return true; }
    if (p.items.length >= 2) return false;
    p.items.push({ k: key, n: it.uses || 1 }); this.note(p, it.name + ' ゲット!', RAR_COL.R, 'i' + key); return true;
  }
  gainPart(p, k, piece) {
    const L = this.legend; if (L.done[k]) return;
    p.parts[k] |= 1 << piece; const mid = L.order[k];
    this.note(p, MACHINES[mid].name + ' ' + PART_NAME[piece], MACHINES[mid].col, 'p' + (k * 3 + piece) + ':' + p.parts[k]); // 取った時点の集まり具合も渡す
    if (p.parts[k] === 7) {
      L.done[k] = true;
      for (const q of this.players) q.parts[k] = 0;
      this.pickups = this.pickups.filter(pk => !(isPart(pk.k) && Math.floor((pk.k - PK_PART) / 3) === k));
      this.fx('legend', p.x, p.y, mid); this.fx('mexp', p.x, p.y, p.m);
      p.m = mid; p.hp = 100; p.ride = 0; p.inv = Math.max(p.inv, 3.5);
      this.gfxEv('legend', p.id, mid);
    }
  }
  // ---------- ダメージ系アイテムの予告(1秒後に発動。予告は全員に見える) ----------
  // ビッグボムは 1.5 秒、その他は 1 秒。ソードの向きは使った瞬間で固定
  warnAttack(p, kind) { const T = kind === 'bbomb' ? 1.5 : 1; this.pending.push({ kind, own: p.id, t: T, T, a: p.aim ?? p.a }); this.fx('warnItem', p.x, p.y, p.id); }
  bombCharging(p) { return this.pending.some(w => w.own === p.id && w.kind !== 'sword'); }
  get warns() { const out = []; for (const w of this.pending) { const o = this.players[w.own]; if (o) out.push({ k: w.kind, x: o.x, y: o.y, a: w.a, t: w.t / w.T }); } return out; }
  updatePending(dt) {
    if (!this.pending.length) return;
    const frozen = this.phase === 'battle' && (this.count > 0 || this.over);
    this.pending = this.pending.filter(w => {
      const p = this.players[w.own]; if (!p || p.out || p.dead > 0) return false; // 本人がやられたら不発
      if (frozen) return true; w.t -= dt; if (w.t > 0) return true;
      if (w.kind === 'mbomb') this.explode(p.x, p.y, 62, 26 * p.sa, p.id, 0);
      else if (w.kind === 'bbomb') this.explode(p.x, p.y, 115, 66 * p.sa, p.id, 1);
      else {
        const aim = w.a, dmg = 62 * p.sa; p.slash = .25; this.fx('slash', p.x, p.y, Math.round(aim * 100));
        this.forTargets(p.x, p.y, 78, (o, kind) => {
          if (kind === 1 && o.id === p.id) return; const a = Math.atan2(o.y - p.y, o.x - p.x);
          if (Math.abs(angDiff(aim, a)) < 1.25 || d2(o.x, o.y, p.x, p.y) < 18 * 18) this.hit(o, kind, dmg, p.id, p.x, p.y, 3);
        });
      }
      return false;
    });
  }
  // ---------- アイテム使用 ----------
  activate(p, key) {
    const it = ITEMS[key];
    switch (key) {
      case 'mjet': case 'jet': p.buf.jet = Math.max(p.buf.jet, it.dur); this.fx('buff', p.x, p.y, 1); break;
      case 'mdumb': case 'dumb': p.buf.dumb = Math.max(p.buf.dumb, it.dur); this.fx('buff', p.x, p.y, 0); break;
      case 'mglass': case 'glass': p.buf.glass = Math.max(p.buf.glass, it.dur); this.fx('buff', p.x, p.y, 3); break;
      case 'mbar': case 'bar': p.buf.bar = Math.max(p.buf.bar, it.dur); this.fx('buff', p.x, p.y, 2); break;
      case 'mbomb': case 'bbomb': this.warnAttack(p, key); break; // 1秒予告してから爆発
    }
  }
  useItem(p) {
    const it = p.items[0]; if (!it) return;
    if (it.k === 'sword') {
      if (this.pending.some(w => w.own === p.id && w.kind === 'sword')) return; // 予告中は次を振れない
      it.n--; this.warnAttack(p, 'sword');
      if (it.n <= 0) p.items.shift();
      return;
    }
    p.items.shift();
    if (it.k === 'arrow') { p.arw = { t: 5, a: p.a, lock: 1 }; this.fx('arrowStart', p.x, p.y, p.id); this.gfxEv('arrow', p.id); return; }
    this.activate(p, it.k); this.fx('use', p.x, p.y, ITEM_KEYS.indexOf(it.k), p.id);
  }
  explode(x, y, r, dmg, src, big) {
    this.fx(big ? 'bigbomb' : 'bomb', x, y, r);
    this.forTargets(x, y, r, (o, kind) => { if (kind === 1 && o.id === src) return; this.hit(o, kind, dmg, src, x, y, big ? 2 : 1); });
  }
  // ビッグアロー: 太い光線が 0.6 秒残って 6 回ヒット(防御特化以外はほぼ確殺)
  fireArrow(p, first) {
    const B = p.beam, ca = Math.cos(B.a), sa = Math.sin(B.a), half = 40, dmg = 68 * p.sa;
    if (first) this.fx('beam', B.x, B.y, Math.round(B.a * 1000));
    const test = (o, r) => { const dx = o.x - B.x, dy = o.y - B.y, along = dx * ca + dy * sa; if (along < 0) return false; const perp = Math.abs(-dx * sa + dy * ca); return perp < half + r; };
    for (const q of this.players) if (q !== p && !q.out && q.dead <= 0 && test(q, 7)) this.hit(q, 1, dmg, p.id, B.x, B.y, 4);
    for (const e of this.enemies) if (test(e, 6)) this.hit(e, 2, dmg, p.id, B.x, B.y);
    for (const c of this.chests) if (test(c, 9)) this.hit(c, 3, dmg, p.id, B.x, B.y);
    if (this.boss && test(this.boss, 38)) this.hit(this.boss, 4, dmg, p.id, B.x, B.y);
    if (this.fish && test(this.fish, 42)) this.hit(this.fish, 5, dmg, p.id, B.x, B.y);
    for (const w of this.wilds) if (test(w, 8)) this.hit(w, 6, dmg, p.id, B.x, B.y);
  }
  // 範囲内の全ターゲットに対して
  forTargets(x, y, r, fn) {
    const R2 = (rr) => (r + rr) * (r + rr);
    for (const q of this.players) if (!q.out && q.dead <= 0 && d2(q.x, q.y, x, y) < R2(7)) fn(q, 1);
    for (const e of this.enemies) if (d2(e.x, e.y, x, y) < R2(6)) fn(e, 2);
    for (const c of this.chests) if (d2(c.x, c.y, x, y) < R2(9)) fn(c, 3);
    if (this.boss && d2(this.boss.x, this.boss.y, x, y) < R2(38)) fn(this.boss, 4);
    if (this.fish && d2(this.fish.x, this.fish.y, x, y) < R2(42)) fn(this.fish, 5);
    for (const w of this.wilds) if (d2(w.x, w.y, x, y) < R2(8)) fn(w, 6);
  }
  // ---------- ダメージ ----------
  // cause: 0=ショット 1=ミニボム 2=ビッグボム 3=ビッグソード 4=ビッグアロー 5=体当たり(撃破演出で決め手を見せる)
  hit(o, kind, dmg, src, sx, sy, cause = 0) {
    switch (kind) {
      case 1: this.damagePlayer(o, dmg, src, false, cause, sx, sy); break;
      case 2: this.damageEnemy(o, dmg, src); break;
      case 3: this.damageChest(o, dmg, src); break;
      case 4: Events.damageBoss(this, o, dmg, src); break;
      case 5: Events.damageFish(this, o, dmg, src); break;
      case 6: Events.damageWild(this, o, dmg, src); break;
    }
  }
  damagePlayer(p, raw, src, trueDmg, cause = 0, sx = 0, sy = 0) {
    if (p.dead > 0 || p.out || p.inv > 0 || p.buf.bar > 0) return;
    if (this.phase === 'battle' && (this.count > 0 || this.over)) return;
    if (this.phase !== 'train' && this.phase !== 'battle') return;
    const d = trueDmg ? raw : raw / p.sd / HP_SCALE;
    p.hp -= d; p.flash = .14; if (src >= 0) { p.lastAtk = src; p.lastAtkT = this.elapsed; p.lastCause = [cause, Math.round(sx), Math.round(sy)]; }
    if (d > 1.5) this.fx('hurt', p.x, p.y, p.id, Math.min(99, Math.round(d)));
    if (this.phase === 'train') { p.dmgAcc += d; while (p.dmgAcc >= 25) { p.dmgAcc -= 25; this.shed(p, 1); } }
    if (partsN(p) > 0 && Math.random() < d / 55) { const held = []; for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) if (p.parts[k] & (1 << i)) held.push([k, i]); const [k, i] = pick(held); p.parts[k] &= ~(1 << i); this.scatter(p.x, p.y, [PK_PART + k * 3 + i], 80); this.note(p, 'パーツを落とした!', '#ff4d4d', 'x'); }
    if (p.hp <= 0) {
      let killer = src;
      if (killer < 0 && p.lastAtk >= 0 && this.elapsed - p.lastAtkT < 5) killer = p.lastAtk;
      this.killPlayer(p, killer);
    }
  }
  shed(p, n) {
    const out = [];
    for (let i = 0; i < n; i++) { const have = [0, 1, 2, 3].filter(k => p.st[k] > 0); if (!have.length) break; const k = pick(have); p.st[k]--; out.push(k); }
    if (out.length) this.scatter(p.x, p.y, out, 70);
    return out;
  }
  killPlayer(p, killerId) {
    const K = killerId >= 0 ? this.players[killerId] : null;
    p.hp = 0; this.fx('death', p.x, p.y, p.m, p.id);
    const lc = p.lastCause && this.elapsed - p.lastAtkT < .6 ? p.lastCause : [0, 0, 0];
    this.gfxEv('kill', K && K !== p ? K.id : -1, p.id, lc[0], lc[1], lc[2]);
    if (K && K !== p) { K.kills++; this.note(K, p.name + ' を撃破!', '#ffe14d'); }
    // パーツ・鍵・アイテムは確定ドロップ
    const drops = [];
    for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) if (p.parts[k] & (1 << i)) drops.push(PK_PART + k * 3 + i); p.parts = [0, 0, 0];
    if (p.key) { drops.push(PK_KEY); p.key = false; }
    for (const it of p.items) drops.push(PK_ITEM + ITEM_KEYS.indexOf(it.k)); p.items = [];
    p.arw = null; p.beam = null; p.buf.jet = p.buf.dumb = p.buf.glass = p.buf.bar = 0;
    if (this.phase === 'train') {
      const tot = this.totalSt(p), lose = Math.ceil(tot * .35); // 1ブレイクは重い
      const removed = [];
      for (let i = 0; i < lose; i++) { const have = [0, 1, 2, 3].filter(k => p.st[k] > 0); if (!have.length) break; const k = pick(have); p.st[k]--; removed.push(k); }
      const gain = K && K !== p ? Math.floor(removed.length / 2) : 0; // どんなに遠くても半分は倒した人へ
      if (gain) this.give(K, removed.splice(0, gain), p.x, p.y);
      this.scatter(p.x, p.y, removed.concat(drops), 200);
      p.dead = RESPAWN_T; p.dmgAcc = 0;
      this.note(p, '撃破された… ' + RESPAWN_T + '秒後に復活', '#ff4d4d');
    } else {
      // バトル: 無限復活。倒すと★+1、やられると★-1(星が一番多い人の勝ち)
      this.scatter(p.x, p.y, drops, 90);
      p.stars--; p.dead = BATTLE_RESPAWN;
      if (K && K !== p) { K.stars++; K.bk++; this.note(K, '★ +1', '#ffe14d'); }
    }
  }
  damageEnemy(e, dmg, src) {
    if (e.hp <= 0) return;
    e.hp -= dmg; e.flash = .14; if (src >= 0) e.aggro = src;
    if (e.hp <= 0) {
      const T = ENEMIES[e.tp]; this.fx('pop', e.x, e.y, e.tp);
      const st = T.drop < 0 ? rndi(0, 3) : T.drop; const codes = Math.random() < .5 ? [st] : []; /* ステータスは出すぎないよう 6 割 */
      if (Math.random() < .05) codes.push(this.rollItem(false));
      // 倒した人(どんなに遠くても)がドロップの半分を受け取る
      const P = src >= 0 ? this.players[src] : null;
      if (P && !P.out) { const n = Math.floor((codes.length + 1) / 2); this.give(P, codes.splice(0, n), e.x, e.y); }
      if (codes.length) this.scatter(e.x, e.y, codes, 80);
    }
  }
  damageChest(c, dmg, src) {
    if (c.hp <= 0 || c.type === 'L') return;
    c.hp -= dmg; c.flash = .14; if (src >= 0) c.last = src;
    if (c.hp <= 0) this.openChest(c, c.last);
  }
  openChest(c, who) {
    const P = who >= 0 ? this.players[who] : null;
    let loot;
    switch (c.type) {
      case 'B': loot = this.makeLoot(Math.random() < .7 ? 1 : 2, .3, .12, .01, .02); break;
      case 'A': loot = this.makeLoot(rndi(2, 3), .55, .5, .07, .07); break;
      case 'G': loot = this.makeLoot(Math.random() < .7 ? 1 : 0, .15, .03); break;
      case 'O': loot = this.makeLoot(rndi(6, 8), .8, .9, .35, .1); loot.push(this.rollItem(true)); break;
      case 'L': loot = this.makeLoot(rndi(5, 7), 1, 1, .3, .15); loot.push(this.rollItem(true)); break;
      case 'I': loot = [this.rollItem(true)]; if (Math.random() < .5) loot.push(this.rollItem(false)); break;
    }
    this.fx('chest', c.x, c.y, 'BAGOLI'.indexOf(c.type));
    if ((c.type === 'O' || c.type === 'L') || !P || P.dead > 0 || P.out) this.scatter(c.x, c.y, loot, c.type === 'O' || c.type === 'L' ? 230 : 150);
    else { this.give(P, loot, c.x, c.y); this.note(P, '宝箱 総取り!', '#ffe14d'); }
    c.hp = 0;
  }

  // ---------- マシン乗り換え ----------
  board(p, fm, wild) {
    const M = MACHINES[p.m], gain = Math.min(4, Math.floor(p.ride / 18));
    const got = [0, 0, 0, 0];
    for (let i = 0; i < gain; i++) { const w = M.mul.map(v => v * v * v); let r = Math.random() * w.reduce((a, b) => a + b); let k = 0; while ((r -= w[k]) > 0) k++; got[k] += this.addStat(p, k); }
    this.fx('mexp', p.x, p.y, p.m);
    if (gain) this.note(p, '乗り換えボーナス!', '#ffe14d', 'b'); // 機体紹介の帯が消えてから出る(UI 側で待つ)
    for (let k = 0; k < 4; k++) for (let j = 0; j < got[k]; j++) this.note(p, '', STAT_COL[k], 's' + k);
    if (gain) this.fx('rideBonus', p.x, p.y, gain, p.id);
    p.x = fm.x; p.y = fm.y; p.m = fm.m; p.hp = 100; p.ride = 0; p.inv = Math.max(p.inv, .6); p.vx = p.vy = 0;
    this.map.unstuck(p, 7);
    this.fx('ride', p.x, p.y, p.m, p.id);
    this.note(p, MACHINES[p.m].name + ' に乗った!', MACHINES[p.m].col);
  }
  nearMachine(p) {
    let best = null, bd = 22 * 22;
    for (const m of this.machines) { const d = d2(m.x, m.y, p.x, p.y); if (d < bd) { bd = d; best = m; } }
    for (const w of this.wilds) if (w.stun > 0 && !w.taken) { const d = d2(w.x, w.y, p.x, p.y); if (d < 26 * 26 && d < bd + 200) { bd = d; best = w; } }
    return best;
  }

  autoTarget(p) {
    const S = SHOTS[MACHINES[p.m].shot], range = clamp(S.spd * S.life * p.sr * (S.k === 'boom' ? .5 : 1) * .95, 70, 300), R2 = range * range;
    let best = null, bs = 1e18;
    const cons = (o, w) => { const d = d2(o.x, o.y, p.x, p.y); if (d < R2 && d * w < bs) { bs = d * w; best = o; } };
    for (const q of this.players) if (q !== p && !q.out && q.dead <= 0) cons(q, .5);
    for (const e of this.enemies) cons(e, 1);
    for (const c of this.chests) if (c.type !== 'L') cons(c, 1.4);
    for (const w of this.wilds) if (!w.taken && w.stun <= 0) cons(w, 1);
    if (this.boss) cons(this.boss, .7);
    if (this.fish) cons(this.fish, .9);
    return best;
  }
  // ---------- 発射 ----------
  fire(p) {
    const S = SHOTS[MACHINES[p.m].shot];
    p.cd = S.rate;
    const big = MACHINES[p.m].big ? 9 : 6;
    const M = MACHINES[p.m], base = (p.aim ?? p.a) + (S.sweep ? Math.sin(this.elapsed * 7) * .5 : 0); // スプレッダーは首振り撃ち
    if (M.mv === 'recoil') { p.vx -= Math.cos(base) * 150; p.vy -= Math.sin(base) * 150; } // スキャッターは反動で下がる
    for (let i = 0; i < S.n; i++) {
      let a = base;
      if (S.n > 1 && S.sp) a += (i / (S.n - 1) - .5) * S.sp * 2;
      if (S.jit) a += rnd(-S.jit, S.jit);
      const spd = S.spd * (S.varSpd ? rnd(.75, 1.1) : 1);
      let ox = 0, oy = 0; if (S.par) { const off = (i - (S.n - 1) / 2) * S.par * 2; ox = -Math.sin(a) * off; oy = Math.cos(a) * off; }
      const x = p.x + Math.cos(a) * big + ox, y = p.y + Math.sin(a) * big + oy;
      this.bullets.push({ x, y, bx: x, by: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, ang: a, spd, t: 0, life: S.life * p.sr, dmg: S.dmg * p.sa, r: S.r, k: S.k, col: S.col, own: p.id, pierce: S.pierce ? [] : null, ph: i, big: S.big || 0, tr: S.trail || 0, turn: S.turn, ric: S.ric || 0, acc: S.acc || 0 });
    }
    this.fx('shot', p.x, p.y, S.big ? 1 : 0, Math.round(base * 100));
  }
  enemyShot(x, y, a, spd, dmg, own, col = 15, r = 3, life = 1.6) {
    this.bullets.push({ x, y, bx: x, by: y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, ang: a, spd, t: 0, life, dmg, r, k: 'b', col, own, pierce: null, ph: 0, big: r > 3 ? 1 : 0, tr: 0 });
  }

  // ============================================================
  //  更新
  // ============================================================
  update() {
    const dt = DT; this.tick++; this.elapsed += dt;
    if (this.phase === 'train') {
      this.t -= dt;
      if (this.t <= 0) { this.startTrainEnd(); return; }
      Events.update(this, dt);
      this.spawnLoop(dt);
    } else if (this.phase === 'trainEnd') { // タイムアップ演出中は世界ごと止める
      this.endT -= dt; if (this.endT <= 0) this.startStatus();
      return;
    } else if (this.phase === 'status') { // ステータス確認タイム(時間が来たら自動でステージ抽選へ)
      this.t -= dt; if (this.t <= 0) this.startRoulette();
      return;
    } else if (this.phase === 'roulette') {
      this.rou.t += dt; if (this.rou.t >= this.rou.dur) this.startBattle(this.rou.sel);
      return;
    } else if (this.phase === 'battle') {
      if (this.count > 0) { this.count -= dt; if (this.count <= 0) this.fx('go', 0, 0); }
      else if (!this.over) { this.updateZone(dt); this.t -= dt; if (this.t <= 0) { this.t = 0; this.over = true; this.endT = 4.6; this.bullets.length = 0; this.gfxEv('timeup'); } }
      else { this.endT -= dt; if (this.endT <= 0) { this.finish(); return; } }
    } else if (this.phase === 'result') { this.t -= dt; return; }

    // AI / 入力
    for (const p of this.players) {
      if (p.cpu) AI.think(this, p, dt);
    }
    this.calcAll();
    this.grid.clear();
    for (const p of this.players) if (!p.out && p.dead <= 0) { p._k = 1; this.grid.add(p); }
    for (const e of this.enemies) { e._k = 2; this.grid.add(e); }
    for (const c of this.chests) { c._k = 3; this.grid.add(c); }
    for (const w of this.wilds) { w._k = 6; this.grid.add(w); }
    for (const p of this.players) this.updatePlayer(p, dt);
    this.updatePending(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    for (const c of this.chests) { c.flash = Math.max(0, c.flash - dt); c.t += dt; }
    if (this.chests.some(c => c.hp <= 0)) this.chests = this.chests.filter(c => c.hp > 0);
    for (const m of this.machines) m.t += dt;
  }
  calcAll() { for (const p of this.players) this.calcStats(p); }
  spawnLoop(dt) {
    const s = this.spawnT;
    s.m -= dt; if (s.m <= 0) { s.m = 3; if (this.machines.length < this.machineTarget()) this.spawnMachine(); }
    s.e -= dt; if (s.e <= 0) { s.e = 1.3; /* 小さいグループを少し多めに */ if (this.enemies.length < this.enemyTarget()) this.spawnEnemyGroup(); }
    s.c -= dt; if (s.c <= 0) { s.c = 5; if (this.chests.filter(c => c.type === 'A' || c.type === 'B').length < this.chestTarget()) this.spawnChest(); }
  }

  updatePlayer(p, dt) {
    if (p.out) return;
    p.flash = Math.max(0, p.flash - dt); p.slash = Math.max(0, p.slash - dt);
    if (p.dead > 0) {
      p.dead -= dt;
      if (p.dead <= 0 && this.phase === 'battle') { // 安全地帯の中のランダムな場所に、同じマシンで復活
        const z = this.zone, pos = this.map.freePos(8, Math.random, 40, { x: z.x, y: z.y, r: Math.max(30, z.r * .8) });
        p.x = pos.x; p.y = pos.y; p.hp = 100; p.inv = 2.5; p.vx = p.vy = 0; this.map.unstuck(p, 7); this.fx('spawn', p.x, p.y, p.id);
      }
      if (p.dead <= 0 && this.phase === 'train') { p.m = 0; p.hp = 100; p.ride = 0; p.inv = 2.5; p.vx = p.vy = 0; this.map.unstuck(p, 7); this.fx('spawn', p.x, p.y, p.id); }
      p.pmask = p.mask; return;
    }
    p.inv = Math.max(0, p.inv - dt); p.cd -= dt; p.ride += dt;
    if (p.beam) { p.beam.t += dt; if (p.beam.t >= .1) { p.beam.t = 0; this.fireArrow(p); if (--p.beam.n <= 0) p.beam = null; } }
    for (const k in p.buf) p.buf[k] = Math.max(0, p.buf[k] - dt);
    if (MACHINES[p.m].legend && p.hp < 100) p.hp = Math.min(100, p.hp + 1.5 / HP_SCALE * dt); // 伝説マシンの回復: 実数で毎秒 1.5
    const frozen = this.phase === 'battle' && (this.count > 0 || this.over);
    const m = frozen ? 0 : (p.mask | (p.latch | 0)), pm = p.pmask; p.pmask = m; p.latch = 0;
    const dir = frozen ? null : p.cpu ? p.aiDir : maskDir(m); // カウントダウン中は CPU も動けない
    const z = (m & IN.Z) !== 0; p.z = z;
    const xHit = (m & IN.X) && !(pm & IN.X), xUp = !(m & IN.X) && (pm & IN.X);
    const r = MACHINES[p.m].big ? 8 : 6;
    // ボムのチャージ中・ビッグアローのチャージ中は動けない
    if (p.arw || this.bombCharging(p)) {
      p.vx *= .85; p.vy *= .85; this.map.move(p, p.vx * dt, p.vy * dt, r);
      if (!p.arw) return; // ボムのチャージ中
      if (p.arw.t > 0) {
        p.arw.t -= dt; if (dir !== null) p.arw.a += clamp(angDiff(p.arw.a, dir), -1.3 * dt, 1.3 * dt);
        p.a = p.arw.a;
      } else { p.arw.lock -= dt; if (p.arw.lock <= 0) { p.beam = { a: p.arw.a, x: p.x, y: p.y, n: 6, t: 0 }; this.fireArrow(p, true); p.beam.n--; p.arw = null; } }
      return;
    }
    // 向き・移動
    stepMachine(p, dir, z, dt, this.map, p.ss);
    if (this.map.hitBox(p.x, p.y, r)) this.map.unstuck(p, r); // 万一壁に埋まったら押し出す
    // オートエイム: 近くの敵・宝箱・プレイヤーに自動で向く(移動方向とは別)
    if ((this.tick + p.id) % 4 === 0) p.aimTg = this.autoTarget(p);
    const at = p.aimTg; p.aim = at && (at.hp > 0 || at.stun !== undefined) && !at.out && !(at.dead > 0) ? Math.atan2(at.y - p.y, at.x - p.x) : p.a;
    // 床・ゾーン
    if (this.phase === 'battle' && this.map.tileAt(p.x, p.y) === 8) this.damagePlayer(p, 10 * dt, -1, true);
    if (this.zone && this.count <= 0 && d2(p.x, p.y, this.zone.x, this.zone.y) > this.zone.r * this.zone.r) this.damagePlayer(p, 9 * dt, -1, true);
    // ショット
    if (z && p.cd <= 0 && !frozen) this.fire(p);
    // X: 乗り換え > アイテム(タップ=使用 / 長押し=入れ替え)
    if (xHit) {
      const fm = this.phase === 'train' ? this.nearMachine(p) : null;
      if (fm) { if (fm.stun !== undefined) Events.boardWild(this, p, fm); else { this.machines.splice(this.machines.indexOf(fm), 1); this.board(p, fm); } p.xHold = -1; }
      else p.xHold = 0;
    }
    if (p.xHold >= 0) {
      if (m & IN.X) { p.xHold += dt; if (p.xHold > .35) { if (p.items.length > 1) { p.items.push(p.items.shift()); this.note(p, 'アイテム入れ替え', '#8ad0ff'); } p.xHold = -1; } }
      else if (xUp) { p.xHold = -1; this.useItem(p); }
    }
    // 他プレイヤーとの押し合い
    // 体当たり(重戦車・突進中)は当たった相手と雑魚にダメージ
    const mv = MACHINES[p.m].mv, ram = (mv === 'tank' || (mv === 'dash' && p.dashT > 0)) && Math.hypot(p.vx, p.vy) > 55, rr = MACHINES[p.m].big ? 18 : 14;
    this.grid.each(p.x, p.y, o => {
      if (o._k === 1 && o !== p) { const dd = d2(o.x, o.y, p.x, p.y); if (dd < 144 && dd > .01) { const d = Math.sqrt(dd), push = (12 - d) * .5; p.x -= (o.x - p.x) / d * push; p.y -= (o.y - p.y) / d * push; } }
      if (ram && (o._k === 1 || o._k === 2) && o !== p && !(o.ramT > this.elapsed) && d2(o.x, o.y, p.x, p.y) < rr * rr) { o.ramT = this.elapsed + .5; this.hit(o, o._k, (mv === 'tank' ? 16 : 8) * p.sa, p.id, p.x, p.y, 5); this.fx('ram', o.x, o.y, p.m); const a = Math.atan2(o.y - p.y, o.x - p.x); o.vx = Math.cos(a) * 240; o.vy = Math.sin(a) * 240; }
    });
    // 鍵付き宝箱
    if (p.key) for (const c of this.chests) if (c.type === 'L' && d2(c.x, c.y, p.x, p.y) < 22 * 22) { p.key = false; this.openChest(c, p.id); this.gfxEv('unlock', p.id); break; }
  }

  updateBullets(dt) {
    const B = this.bullets, map = this.map;
    let w = 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i]; b.t += dt; let alive = b.t < b.life;
      if (alive) {
        if (b.k === 'home') {
          if ((this.tick + i) % 6 === 0) b.tg = this.findHomeTarget(b);
          if (b.tg) { const ta = Math.atan2(b.tg.y - b.y, b.tg.x - b.x); b.ang += clamp(angDiff(b.ang, ta), -(b.turn || 4.5) * dt, (b.turn || 4.5) * dt); b.vx = Math.cos(b.ang) * b.spd; b.vy = Math.sin(b.ang) * b.spd; }
          b.x += b.vx * dt; b.y += b.vy * dt;
        } else if (b.k === 'wave') {
          b.bx += b.vx * dt; b.by += b.vy * dt; const off = Math.sin(b.t * 16) * 9 * (b.ph ? 1 : -1);
          b.x = b.bx - Math.sin(b.ang) * off; b.y = b.by + Math.cos(b.ang) * off;
        } else if (b.k === 'boom') {
          const f = Math.cos(b.t / b.life * Math.PI); b.x += b.vx * f * dt; b.y += b.vy * f * dt;
          if (b.t > b.life * .5 && b.own >= 0) { const o = this.players[b.own]; if (o && d2(o.x, o.y, b.x, b.y) < 100) alive = false; }
        } else { if (b.acc && b.t < .3) { const f = 1 + 2.2 * dt; b.vx *= f; b.vy *= f; } b.x += b.vx * dt; b.y += b.vy * dt; }
        if (alive && b.k !== 'boom' && map.solid(b.x, b.y)) {
          if (b.ric > 0) { b.ric--; b.x -= b.vx * dt; b.y -= b.vy * dt; if (map.solid(b.x + b.vx * dt, b.y)) b.vx = -b.vx; else b.vy = -b.vy; b.ang = Math.atan2(b.vy, b.vx); this.fx('spark', b.x, b.y, b.col); } // 跳弾
          else { alive = false; this.fx('spark', b.x, b.y, b.col); }
        }
        if (alive && b.k === 'boom' && map.solid(b.x, b.y)) { b.vx *= -1; b.vy *= -1; }
      }
      if (alive) alive = this.bulletHits(b);
      if (alive) B[w++] = b;
    }
    B.length = w;
  }
  findHomeTarget(b) {
    let best = null, bd = 230 * 230;
    for (const p of this.players) if (p.id !== b.own && !p.out && p.dead <= 0) { const d = d2(p.x, p.y, b.x, b.y); if (d < bd) { bd = d; best = p; } }
    for (const e of this.enemies) { const d = d2(e.x, e.y, b.x, b.y); if (d < bd) { bd = d; best = e; } }
    if (this.boss) { const d = d2(this.boss.x, this.boss.y, b.x, b.y); if (d < bd * 2) best = this.boss; }
    return best;
  }
  bulletHits(b) {
    let alive = true; const own = b.own, ext = b.k === 'blade' ? b.r : b.r;
    const tryHit = (o, kind, r) => {
      if (kind === 1 && (o.id === own || o.dead > 0 || o.out)) return false;
      if (own < 0 && kind !== 1) return false; // 敵弾はプレイヤーのみ
      if (kind === 6 && o.taken) return false;
      const rr = r + ext; if (d2(o.x, o.y, b.x, b.y) > rr * rr) return false;
      if (b.pierce) { const key = kind * 100000 + (o.id || 0); if (b.pierce.includes(key)) return false; b.pierce.push(key); }
      this.hit(o, kind, b.dmg, own, b.x, b.y);
      this.fx('hit', b.x, b.y, b.col, Math.round(b.dmg), own);
      if (!b.pierce) { alive = false; return true; }
      return false;
    };
    this.grid.each(b.x, b.y, o => tryHit(o, o._k, o._k === 1 ? (MACHINES[o.m].big ? 19 : 8) : o._k === 3 ? (o.type === 'O' ? 12 : o.type === 'A' || o.type === 'L' ? 9 : 7) : o._k === 6 ? 8 : 6));
    if (alive && own >= 0) {
      if (this.boss) tryHit(this.boss, 4, 38);
      if (alive && this.fish) tryHit(this.fish, 5, 42);
    }
    return alive;
  }

  updateEnemies(dt) {
    const map = this.map;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const T = ENEMIES[e.tp]; e.t += dt; e.cd = Math.max(0, e.cd - dt); e.flash = Math.max(0, e.flash - dt); e.thk -= dt;
      if (e.thk <= 0) { // ターゲット探索
        e.thk = .5 + Math.random() * .3; e.tgt = null; let bd = (T.beh === 'flee' ? 130 : 190) ** 2;
        this.grid.each(e.x, e.y, o => { if (o._k === 1) { const d = d2(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; e.tgt = o; } } });
        if (!e.tgt && e.aggro >= 0 && e.aggro !== undefined) { const p = this.players[e.aggro]; if (p && !p.out && p.dead <= 0 && d2(p.x, p.y, e.x, e.y) < 300 * 300) e.tgt = p; }
        if (!e.tgt && Math.random() < .3) e.dir = Math.random() * TAU;
      }
      const tg = e.tgt && e.tgt.dead <= 0 && !e.tgt.out ? e.tgt : null;
      const ta = tg ? Math.atan2(tg.y - e.y, tg.x - e.x) : e.dir; const dist = tg ? Math.sqrt(d2(tg.x, tg.y, e.x, e.y)) : 999;
      let spd = T.spd * (this.speedMul > 1 ? 1.4 : 1), ax = 0, ay = 0;
      switch (T.beh) {
        case 'hop': if ((e.t % 1.1) < dt) { const a = ta + rnd(-.4, .4); e.vx = Math.cos(a) * spd * 2.4; e.vy = Math.sin(a) * spd * 2.4; } e.vx *= .95; e.vy *= .95; break;
        case 'fly': { const a = tg ? ta + Math.sin(e.t * 3) * 1.2 : e.dir + Math.sin(e.t) * .8; e.vx = lerp(e.vx, Math.cos(a) * spd, .08); e.vy = lerp(e.vy, Math.sin(a) * spd, .08); } break;
        case 'walk': e.vx = lerp(e.vx, Math.cos(ta) * spd, .05); e.vy = lerp(e.vy, Math.sin(ta) * spd, .05); break;
        case 'shoot': {
          const want = tg ? (dist > 120 ? 1 : dist < 80 ? -1 : 0) : .5; const a = tg ? ta : e.dir;
          e.vx = lerp(e.vx, Math.cos(a) * spd * want + Math.cos(a + 1.57) * spd * .5 * Math.sin(e.t), .05); e.vy = lerp(e.vy, Math.sin(a) * spd * want + Math.sin(a + 1.57) * spd * .5 * Math.sin(e.t), .05);
          if (tg && dist < 170 && e.cd <= 0) { e.cd = 2.8 + Math.random() * 1.6; this.enemyShot(e.x, e.y, ta, 72, 2.2 * (e.pw || 1), -1, 15, 2, 2.2); }
        } break;
        case 'flee': { const a = tg ? ta + Math.PI + Math.sin(e.t * 4) * .6 : e.dir; if ((e.t % .5) < dt) { e.vx = Math.cos(a) * spd; e.vy = Math.sin(a) * spd; } e.vx *= .97; e.vy *= .97; } break;
      }
      if (Math.abs(e.vx) > 1) e.face = e.vx > 0 ? 1 : -1;
      if (map.move(e, e.vx * dt, e.vy * dt, 5)) e.dir = Math.random() * TAU;
      // 接触ダメージ
      if (tg && e.cd <= 0 && dist < T.r + 7 && T.beh !== 'flee') { this.damagePlayer(tg, T.touch * (e.pw || 1), -1); e.cd = .9; e.vx = -Math.cos(ta) * 80; e.vy = -Math.sin(ta) * 80; }
    }
    if (this.enemies.some(e => e.hp <= 0)) this.enemies = this.enemies.filter(e => e.hp > 0);
  }

  updatePickups(dt) {
    const P = this.pickups, map = this.map; let w = 0;
    for (let i = 0; i < P.length; i++) {
      const k = P[i]; k.t += dt;
      if (k.vx || k.vy || k.z > 0) {
        k.vz -= 320 * dt; k.z = Math.max(0, k.z + k.vz * dt); if (k.z === 0) k.vz = 0;
        const f = Math.pow(.04, dt); k.vx *= f; k.vy *= f; if (Math.abs(k.vx) < 2 && Math.abs(k.vy) < 2) { k.vx = k.vy = 0; }
        map.move(k, k.vx * dt, k.vy * dt, 2);
        const b = map.bnd; if (b) { k.x = clamp(k.x, b.x0 + 8, b.x1 - 8); k.y = clamp(k.y, b.y0 + 8, b.y1 - 8); }
      }
      let keep = k.t < k.life;
      if (keep && k.t > .3 && (this.tick + i) % 3 === 0) { // 近くのプレイヤーに吸い寄せ(拾いやすく爽快に)
        let tg = null; this.grid.each(k.x, k.y, o => { if (o._k === 1 && d2(o.x, o.y, k.x, k.y) < 48 * 48) { tg = o; return true; } });
        if (tg) { const a = Math.atan2(tg.y - k.y, tg.x - k.x); k.vx = Math.cos(a) * 300; k.vy = Math.sin(a) * 300; }
      }
      if (keep && k.t > .35) {
        let got = null;
        this.grid.each(k.x, k.y, o => { if (o._k === 1 && d2(o.x, o.y, k.x, k.y) < 13 * 13) { got = o; return true; } });
        if (got && this.applyPickup(got, k.k)) { keep = false; this.fx('pick', k.x, k.y, k.k, got.id); }
      }
      if (keep) P[w++] = k;
    }
    P.length = w;
  }

  // ============================================================
  //  フェーズ遷移
  // ============================================================
  startTrainEnd() {
    Events.endAll(this);
    this.phase = 'trainEnd'; this.t = 0; this.endT = 4.4; this.bullets.length = 0; this.pending = [];
    this.gfxEv('phase', 'trainEnd');
  }
  startStatus() {
    this.phase = 'status'; this.t = STATUS_TIME;
    this.gfxEv('phase', 'status');
  }
  startRoulette() {
    Events.endAll(this);
    this.phase = 'roulette'; this.t = 0;
    const sel = rndi(0, ARENAS.length - 1);
    this.rou = { sel, t: 0, dur: 5.2, seed: (Math.random() * 1e9) | 0 };
    this.bullets.length = 0;
    this.gfxEv('phase', 'roulette');
  }
  startBattle(idx) {
    const n = this.n();
    this.arena = idx; this.arenaSeed = this.rou.seed;
    this.map = genArena(idx, this.arenaSeed, n);
    this.phase = 'battle'; this.count = 3.5; this.battleT = 0; this.t = this.cfg.battleTime || 120; this.over = false; this.endT = 0;
    this.enemies = []; this.pickups = []; this.chests = []; this.machines = []; this.bullets = []; this.pending = [];
    this.boss = this.fish = null; this.balls = []; this.meteors = []; this.warps = []; this.wilds = []; this.speedMul = 1;
    const R = this.map.R; this.zone = { x: this.map.cx, y: this.map.cy, r: R + 20, r0: R + 20 };
    const order = shuffle(this.players.slice());
    order.forEach((p, i) => {
      const a = i / n * TAU, d = R * (n > 24 && i % 2 ? .5 : .72);
      p.x = this.map.cx + Math.cos(a) * d; p.y = this.map.cy + Math.sin(a) * d; p.a = a + Math.PI; p.vx = p.vy = 0;
      p.hp = 100; p.dead = 0; p.out = false; p.inv = 0; p.arw = null; p.key = false; p.place = 0; p.flash = 0; p.stars = 0; p.bk = 0;
      for (const k in p.buf) p.buf[k] = 0;
      this.map.unstuck(p, 7);
    });
    this.itemT = 3;
    this.gfxEv('phase', 'battle', idx);
  }
  updateZone(dt) {
    this.battleT += dt; const z = this.zone, R = z.r0, t = this.battleT;
    // 安全地帯はバトル時間の7割をかけて 40% まで縮む(0 にはしない)
    const total = this.cfg.battleTime || 120, shrinkStart = 8, shrinkDur = Math.max(10, total * .7 - shrinkStart);
    z.r = t > shrinkStart ? lerp(R, R * .4, Math.min(1, (t - shrinkStart) / shrinkDur)) : R;
    this.itemT -= dt;
    if (this.itemT <= 0) { this.itemT = 5; if (this.chests.length < 3 + Math.floor(this.n() / 3)) this.spawnChest('I', this.map.freePos(10, Math.random, 40, { x: z.x, y: z.y, r: Math.max(20, z.r * .8) })); }
  }
  // 順位: 星が多い順 → 同じならバトルでの撃破数が多い順
  ranking() { return this.players.slice().sort((a, b) => (b.stars - a.stars) || (b.bk - a.bk) || (a.id - b.id)); }
  finish() {
    this.phase = 'result'; this.t = 0;
    const ranked = this.ranking(); ranked.forEach((p, i) => p.place = i + 1);
    this.result = ranked.map(p => [p.id, p.place, p.bk, this.totalSt(p), p.m, p.stars]);
    this.gfxEv('phase', 'result');
  }
}
