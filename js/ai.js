'use strict';
// ============================================================
//  CPU の思考
// ============================================================
const AI_LV = [ // よわい / ふつう / つよい
  { err: .38, think: .45, aggro: .5, lead: 0, dodge: .2 },
  { err: .17, think: .3, aggro: 1, lead: .6, dodge: .6 },
  { err: .06, think: .2, aggro: 1.5, lead: 1, dodge: 1 },
];
const mValue = m => MACHINES[m].mul.reduce((a, b) => a + b, 0) + (MACHINES[m].legend ? 2 : 0);

const AI = {
  think(g, p, dt) {
    let A = p.ai;
    if (!A) A = p.ai = { t: Math.random() * .3, goal: null, lx: p.x, ly: p.y, stuckT: 0, unstuck: 0, uDir: 0, xState: 0, L: AI_LV[g.cfg.cpuLevel ?? 1], wx: 0, wy: 0, wT: 0, strafe: Math.random() < .5 ? 1 : -1 };
    p.mask = 0; p.aiDir = null;
    if (p.dead > 0 || p.out) { A.goal = null; return; }
    if (A.xState === 1) { A.xState = 0; } // ボタンを離す
    A.t -= dt; if (A.t <= 0) { A.t = A.L.think * (.7 + Math.random() * .6); this.decide(g, p, A); }
    this.act(g, p, A, dt);
  },
  pressX(p, A) { if (A.xState === 0) { p.mask |= IN.X; A.xState = 1; } },

  decide(g, p, A) {
    let best = null, bs = 0;
    const battle = g.phase === 'battle';
    const caution = battle ? 1 : .25 + .75 * p.hp / 100; // 体力が減ったら戦いを避ける
    const consider = (type, ref, x, y, val) => { const d = Math.sqrt(d2(x, y, p.x, p.y)); const s = val * (type === 'atk' ? caution : 1) / (1 + d / 160); if (s > bs) { bs = s; best = { type, ref, x, y }; } };
    const myV = mValue(p.m);
    if (!battle) {
      for (const m of g.machines) {
        const d = d2(m.x, m.y, p.x, p.y); if (d > (p.hp < 50 ? 900 : 480) ** 2) continue;
        let v = 0; const mv = mValue(m.m);
        if (p.m === 0) v = 4; else if (mv > myV + .2) v = 1.2 + (mv - myV); if (p.hp < 50) v = Math.max(v, 5 - p.hp / 25); if (p.ride > 40) v = Math.max(v, 1.4);
        if (v > 0) consider('ride', m, m.x, m.y, v);
      }
      for (const w of g.wilds) {
        if (w.stun > 0) consider('ride', w, w.x, w.y, w.legend ? 7 : 2.5);
        else if (d2(w.x, w.y, p.x, p.y) < 300 * 300) consider('atk', w, w.x, w.y, w.legend ? 3 : 1.2);
      }
      for (const e of g.enemies) if (d2(e.x, e.y, p.x, p.y) < 300 * 300) consider('atk', e, e.x, e.y, .9);
      for (const c of g.chests) {
        if (c.type === 'L') { if (p.key) consider('go', c, c.x, c.y, 9); continue; }
        if (d2(c.x, c.y, p.x, p.y) < 420 * 420) consider('atk', c, c.x, c.y, { B: 1.3, A: 2.2, G: 1.1, O: 3.2, I: 1 }[c.type]);
      }
      if (g.boss) consider('atk', g.boss, g.boss.x, g.boss.y, 2.6 * A.L.aggro + 1);
      if (g.fish) consider('atk', g.fish, g.fish.x, g.fish.y, 3.2);
      for (const w of g.warps) if (Math.random() < .3) consider('go', null, w.x, w.y, .8);
    } else {
      for (const c of g.chests) consider('atk', c, c.x, c.y, 2);
      const z = g.zone; if (z && d2(p.x, p.y, z.x, z.y) > (z.r * .82) ** 2) { best = { type: 'go', ref: null, x: z.x, y: z.y }; bs = 99; }
    }
    for (const k of g.pickups) {
      const d = d2(k.x, k.y, p.x, p.y); if (d > 280 * 280) continue;
      let v = k.k < PK_ITEM ? 1.1 : isPart(k.k) ? 6 : k.k === PK_KEY ? (p.key ? 0 : 5) : (p.items.length < 2 || ITEMS[ITEM_KEYS[k.k - PK_ITEM]].rar !== 'R' ? 1.6 : 0);
      if (v) consider('go', k, k.x, k.y, v);
    }
    for (const q of g.players) {
      if (q === p || q.out || q.dead > 0) continue; const d = d2(q.x, q.y, p.x, p.y);
      if (battle) { consider('atk', q, q.x, q.y, 3 + (100 - q.hp) / 40); continue; }
      if (d > 260 * 260) continue;
      let v = A.L.aggro * (.35 + (p.hp - q.hp) / 120 + (partsN(q) ? 2 : 0) + (q.key ? 3 : 0)) * (p.hp < 40 ? .3 : 1);
      if (v > 0) consider('atk', q, q.x, q.y, v);
    }
    if (!best) {
      A.wT -= .3; if (A.wT <= 0 || d2(A.wx, A.wy, p.x, p.y) < 40 * 40) { const pos = g.map.freePos(8); A.wx = pos.x; A.wy = pos.y; A.wT = 6; }
      const c = g.evt && g.evt.cur; if (c && c.marks && c.marks.length && Math.random() < .5) { const m = c.marks[0]; A.wx = m[0]; A.wy = m[1]; }
      if (c && c.type === 'rush' && c.x) { A.wx = c.x; A.wy = c.y; }
      best = { type: 'go', ref: null, x: A.wx, y: A.wy };
    }
    A.goal = best;
  },

  steer(g, p, ang) {
    const look = 26;
    const free = a => !g.map.hitBox(p.x + Math.cos(a) * look, p.y + Math.sin(a) * look, 6);
    if (free(ang)) return ang;
    for (const o of [.6, -.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5]) if (free(ang + o)) return ang + o;
    return ang + Math.PI;
  },

  act(g, p, A, dt) {
    const G = A.goal; if (!G) return;
    // 目標の位置を更新(動く相手)
    let ref = G.ref;
    if (ref) {
      const gone = (ref.hp !== undefined && ref.hp <= 0 && ref.stun === undefined) || ref.out || ref.dead > 0 || (ref.k !== undefined && !g.pickups.includes(ref)) || (ref.taken);
      if (gone || (G.type === 'ride' && ref.m !== undefined && ref.stun === undefined && !g.machines.includes(ref))) { A.goal = null; A.t = 0; return; }
      G.x = ref.x; G.y = ref.y;
    }
    const dx = G.x - p.x, dy = G.y - p.y, dist = Math.hypot(dx, dy); let ang = Math.atan2(dy, dx);
    // スタック検出
    A.stuckT += dt; if (A.stuckT > .8) { const mv = d2(p.x, p.y, A.lx, A.ly); A.lx = p.x; A.ly = p.y; A.stuckT = 0; if (mv < 15 * 15 && dist > 30) { A.unstuck = .6; A.uDir = Math.random() * TAU; } }
    // 隕石の回避
    for (const m of g.meteors) if (m.kind !== 2 && m.t > m.fall * .3 && d2(m.x, m.y, p.x, p.y) < (m.r + 14) ** 2 && Math.random() < A.L.dodge + .2) { p.aiDir = Math.atan2(p.y - m.y, p.x - m.x); p.mask |= IN.Z; return; }
    // ビッグアロー チャージ中は狙いを合わせる
    if (p.arw) { if (ref) p.aiDir = Math.atan2(ref.y - p.y, ref.x - p.x) + (Math.random() - .5) * A.L.err; return; }
    if (A.unstuck > 0) { A.unstuck -= dt; p.aiDir = A.uDir; return; }
    const isPlayer = ref && ref.st !== undefined && ref.items !== undefined;
    if (G.type === 'go' || G.type === 'ride') {
      p.aiDir = this.steer(g, p, ang);
      if (dist > 70) p.mask |= IN.Z;
      if (G.type === 'ride' && dist < 17 && g.phase === 'train') this.pressX(p, A);
    } else if (G.type === 'atk') {
      const S = SHOTS[MACHINES[p.m].shot]; const range = S.spd * S.life * p.sr * (S.k === 'boom' ? .5 : 1);
      // 偏差撃ち
      let ax = G.x, ay = G.y;
      if (ref && ref.vx !== undefined && A.L.lead) { const tt = dist / S.spd * A.L.lead; ax += ref.vx * tt; ay += ref.vy * tt; }
      let aim = Math.atan2(ay - p.y, ax - p.x) + (Math.sin(g.elapsed * 2 + p.id) * A.L.err);
      const los = dist < 60 || g.map.los(p.x, p.y, G.x, G.y);
      if (!los) { p.aiDir = this.steer(g, p, ang); p.mask |= IN.Z; }
      else if (dist > range * .9) { p.aiDir = this.steer(g, p, aim); p.mask |= IN.Z; }
      else if (isPlayer && dist < range * .35 && S.k !== 'blade' && S.k !== 'flame') {
        p.aiDir = aim + A.strafe * 1.9; if (Math.random() < .02) A.strafe *= -1;
      } else {
        p.aiDir = aim; const off = Math.abs(angDiff(p.a, aim));
        if (off < .35) p.mask |= IN.Z;
        else if (isPlayer) p.aiDir = aim + A.strafe * .3;
      }
      // アイテム使用
      if (p.items.length && Math.random() < .08) {
        const k = p.items[0].k;
        let use = false;
        if (k === 'bar') use = p.hp < 40 && dist < 150;
        else if (k === 'bbomb') use = dist < 70;
        else if (k === 'sword') use = dist < 45 && Math.abs(angDiff(p.a, ang)) < 1;
        else if (k === 'dumb' || k === 'glass') use = isPlayer || ref === g.boss || ref === g.fish;
        else if (k === 'jet') use = dist > 220;
        else if (k === 'arrow') use = (isPlayer && dist > 160) || ref === g.boss || ref === g.fish;
        if (use) this.pressX(p, A);
        else if (p.items.length > 1 && Math.random() < .1) { /* 使えない時は温存 */ }
      }
    }
    // 遠い時はジェット
    if (p.items.length && p.items[0].k === 'jet' && dist > 400 && Math.random() < .02) this.pressX(p, A);
    if (p.items.length && p.items[0].k === 'bar' && p.hp < 25 && Math.random() < .05) this.pressX(p, A);
  },
};
