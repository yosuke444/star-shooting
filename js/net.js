'use strict';
// ============================================================
//  オンライン (WebRTC P2P / PeerJS)。ホストが権威サーバー役
//  ※ PeerJS の公開シグナリングサーバーは「最初の接続の仲介」にだけ使い、
//    ゲームのデータは端末同士で直接やりとりする。
// ============================================================
const PEER_PREFIX = 'starshoot-v1-';
const PEER_URLS = ['https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
const KCODE = { b: 0, blade: 1, flame: 2, home: 3, wave: 4, boom: 5 }, KNAME = ['b', 'blade', 'flame', 'home', 'wave', 'boom'];
const CHEST_T = 'BAGOLI';
const AOI_X = 340, AOI_Y = 230;

function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    let i = 0;
    const tryNext = () => {
      if (i >= PEER_URLS.length) { rej(new Error('PeerJS を読み込めませんでした(ネット接続を確認してください)')); return; }
      const s = document.createElement('script'); s.src = PEER_URLS[i++]; s.onload = () => res(); s.onerror = () => { s.remove(); tryNext(); };
      document.head.appendChild(s);
    };
    tryNext();
  });
}
const r1 = v => Math.round(v);

const Net = {
  role: null, peer: null, conns: [], conn: null, code: '', status: '', lobby: [], err: '', seq: 0, fxBuf: [], gfxBuf: [], lastIn: 0, lastMask: -1, onEvent: null,
  reset() {
    try { if (this.conn) this.conn.close(); } catch (e) { }
    for (const c of this.conns) try { c.close(); } catch (e) { }
    try { if (this.peer) this.peer.destroy(); } catch (e) { }
    this.role = null; this.peer = null; this.conns = []; this.conn = null; this.code = ''; this.status = ''; this.lobby = []; this.err = ''; this.fxBuf = []; this.gfxBuf = [];
  },
  emit(ev, data) { if (this.onEvent) this.onEvent(ev, data); },

  // ---------------- ホスト ----------------
  async host(name) {
    this.reset(); this.role = 'host'; this.status = 'シグナリングサーバーに接続中…';
    if (window.NO_ONLINE) { this.err = 'このページではフレンド戦は使えません(index.html 版で遊んでください)'; this.status = ''; this.emit('error'); return; }
    try { await loadPeerJS(); } catch (e) { this.err = e.message; this.status = ''; this.emit('error'); return; }
    const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    this.code = code;
    const peer = this.peer = new Peer(PEER_PREFIX + code, Object.assign({ debug: 0 }, window.PEER_OPTS || {}));
    peer.on('open', () => { this.status = 'ルーム作成完了! コードを友達に伝えよう'; this.emit('lobby'); });
    peer.on('error', e => { if (e.type === 'unavailable-id') { this.host(name); return; } this.err = '接続エラー: ' + e.type; this.emit('error'); });
    peer.on('connection', conn => {
      conn.on('open', () => { });
      conn.on('data', d => this.hostRecv(conn, d));
      conn.on('close', () => this.hostDrop(conn));
      conn.on('error', () => this.hostDrop(conn));
    });
  },
  hostRecv(conn, d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'hello') {
      if (this.game && this.game.phase !== 'result') { conn.send({ t: 'kick', reason: '試合中のため参加できません' }); setTimeout(() => conn.close(), 300); return; }
      if (this.conns.length >= 63) { conn.send({ t: 'kick', reason: '満員です' }); return; }
      conn.pname = String(d.name || 'ゲスト').slice(0, 10); this.conns.push(conn); this.sendLobby(); this.emit('lobby');
    } else if (d.t === 'in') { conn.seen = performance.now(); conn.follow = d.f; if (conn.pid !== undefined && this.game) { const p = this.game.players[conn.pid]; if (p && !p.cpu) { p.mask = d.m | 0; p.latch = (p.latch | 0) | p.mask; } } }
  },
  hostDrop(conn) {
    const i = this.conns.indexOf(conn); if (i < 0) return; this.conns.splice(i, 1);
    if (this.game && conn.pid !== undefined) { const p = this.game.players[conn.pid]; if (p) { p.cpu = true; p.mask = 0; p.ai = null; p.name += '(CPU)'; } }
    this.sendLobby(); this.emit('lobby');
  },
  sendLobby() { const list = this.lobbyNames(); for (const c of this.conns) try { c.send({ t: 'lobby', list, cfg: this.cfg }); } catch (e) { } },
  lobbyNames() { return [Settings.name + ' (ホスト)'].concat(this.conns.map(c => c.pname)); },
  startHost(game) {
    this.game = game; this.seq = 0; this.fxBuf = []; this.gfxBuf = [];
    const names = game.players.map(p => p.name);
    for (const c of this.conns) c.seen = performance.now();
    for (const c of this.conns) try { c.send({ t: 'start', you: c.pid, names, seed: game.mapSeed, size: game.mapSize, cfg: game.cfg.pub }); } catch (e) { }
  },
  // 毎tick呼ぶ: FX を溜めて 3tick ごとにスナップショット送信(20Hz)
  hostTick(game) {
    if (this.role !== 'host') return;
    for (const f of game.fxq) this.fxBuf.push(f); game.fxq.length = 0;
    for (const f of game.gfx) this.gfxBuf.push(f); game.gfx.length = 0;
    if (game.tick % 60 === 0) { const now = performance.now(); for (const c of this.conns.slice()) if (c.pid !== undefined && c.seen && now - c.seen > 10000) { try { c.close(); } catch (e) { } this.hostDrop(c); } }
    if (game.tick % 3 !== 0) return;
    if (this.conns.length) {
      const common = this.common(game);
      for (const c of this.conns) { if (c.pid === undefined || !c.open) continue; if (!c.seen) c.seen = performance.now(); try { c.send(this.snap(game, c.pid, common, c.follow)); } catch (e) { } }
    }
    this.fxBuf.length = 0; this.gfxBuf.length = 0; this.seq++;
  },
  common(g) {
    const P = g.players.map(p => {
      const b = p.buf, fl = (p.dead > 0 ? 1 : 0) | (p.out ? 2 : 0) | (p.inv > 0 ? 4 : 0) | (p.flash > 0 ? 8 : 0) | (p.key ? 16 : 0) | (b.bar > 0 ? 32 : 0) | (b.jet > 0 ? 64 : 0) | (b.dumb > 0 ? 128 : 0) | (b.glass > 0 ? 256 : 0) | (g.bombCharging(p) ? 512 : 0);
      return [r1(p.x), r1(p.y), r1((p.aim ?? p.a) * 100), p.m, Math.ceil(p.hp), fl, p.parts[0] | (p.parts[1] << 3) | (p.parts[2] << 6), r1(p.vx), r1(p.vy), r1(p.dead * 10), p.arw ? r1(p.arw.a * 100) : null, p.arw ? r1(p.arw.t * 10) : 0, p.stars, p.bk];
    });
    const c = g.evt && g.evt.cur;
    return {
      ph: g.phase, T: r1(g.t * 10), cnt: r1(g.count * 10), bt: r1((g.battleT || 0) * 10), P,
      C: g.chests.map(ch => [ch.id, CHEST_T.indexOf(ch.type), r1(ch.x), r1(ch.y), ch.mhp > 1e8 ? 100 : Math.ceil(ch.hp / ch.mhp * 100), ch.flash > 0 ? 1 : 0]),
      M: g.machines.map(m => [m.id, r1(m.x), r1(m.y), m.m, r1(m.a * 100)]),
      W: g.wilds.map(w => [w.id, r1(w.x), r1(w.y), w.m, r1(w.a * 100), r1(w.stun * 10), w.legend ? 1 : 0, Math.ceil(w.hp / w.mhp * 100), w.flash > 0 ? 1 : 0]),
      bo: g.boss ? [r1(g.boss.x), r1(g.boss.y), r1(g.boss.hp), r1(g.boss.mhp), g.boss.st === 'charge' ? 1 : 0, g.boss.flash > 0 ? 1 : 0, r1(g.boss.vx)] : null,
      fi: g.fish ? [r1(g.fish.x), r1(g.fish.y), r1(g.fish.hp), r1(g.fish.mhp), r1(g.fish.a * 100), g.fish.flash > 0 ? 1 : 0] : null,
      ba: g.balls.map(b => [r1(b.x), r1(b.y), b.kind, r1(b.rot * 10), r1(b.vx), r1(b.vy)]),
      me: g.meteors.map(m => [m.id, r1(m.x), r1(m.y), r1(m.t * 100), r1(m.fall * 100), m.r, m.big, m.kind]),
      wa: g.warps.map(w => [w.id, r1(w.x), r1(w.y), w.hue]),
      ev: c ? { ty: c.type, t: r1(c.t * 10), d: r1(c.dur), mk: c.marks, rg: c.region, sd: c.seed, st: r1(c.st) } : null,
      wn: g.warns.map(w => [['mbomb', 'bbomb', 'sword'].indexOf(w.k), r1(w.x), r1(w.y), r1(w.a * 100), r1(w.t * 100)]),
      ei: g.evt.idx, en: g.evt.list.length, lo: g.legend.order,
      bnd: g.map.bnd ? [r1(g.map.bnd.x0), r1(g.map.bnd.y0), r1(g.map.bnd.x1), r1(g.map.bnd.y1)] : null,
      zo: g.zone ? [r1(g.zone.x), r1(g.zone.y), r1(g.zone.r)] : null,
      ar: g.arena, as: g.arenaSeed, rou: g.rou ? [g.rou.sel, r1(g.rou.t * 100), g.rou.dur] : null, res: g.result,
      G: this.gfxBuf.slice(),
    };
  },
  snap(g, pid, common, follow) {
    const p = g.players[pid], f = p.out && g.players[follow] ? g.players[follow] : p, cx = f.x, cy = f.y, wide = p.arw ? 2.2 : 1;
    const inA = (x, y, m = 0) => Math.abs(x - cx) < AOI_X * wide + m && Math.abs(y - cy) < AOI_Y * wide + m;
    const B = []; for (const b of g.bullets) if (inA(b.x, b.y, 30)) {
      let vx = b.vx, vy = b.vy; if (b.k === 'boom') { const f = Math.cos(b.t / b.life * Math.PI); vx *= f; vy *= f; }
      B.push(r1(b.x), r1(b.y), r1(vx), r1(vy), KCODE[b.k], b.col, r1(b.r * 10) + (b.big ? 1000 : 0) + (b.tr ? 2000 : 0), r1(b.t * 100), r1(b.life * 100), b.ph);
    }
    const E = []; for (const e of g.enemies) if (inA(e.x, e.y, 20)) E.push(e.id, e.tp, r1(e.x), r1(e.y), Math.ceil(e.hp / e.mhp * 100), e.flash > 0 ? 1 : 0, e.face);
    const K = []; for (const k of g.pickups) if (inA(k.x, k.y, 20) || k.k >= PK_PART) K.push(k.id, r1(k.x), r1(k.y), r1(k.z), k.k, Math.min(999, r1((k.life - k.t) * 10)));
    const F = []; for (const f of this.fxBuf) if (FAR_FX[f[0]] || inA(f[1], f[2], 120) || (f[0] === 'mag' && f[3] === pid) || ((f[0] === 'hurt' || f[0] === 'ride' || f[0] === 'spawn') && f[3] === pid) || (f[0] === 'pick' && f[4] === pid)) F.push(f);
    const me = { st: p.st, it: p.items.map(i => [i.k, i.n]), no: p.notes.splice(0), ss: Math.round(p.ss * 100) / 100, bf: [r1(p.buf.jet * 10), r1(p.buf.dumb * 10), r1(p.buf.glass * 10), r1(p.buf.bar * 10)], tv: p.tv ? g.evt.list.map(e => e.type) : null, pl: p.place };
    return { t: 's', q: this.seq, c: common, B, E, K, F, me };
  },
  broadcast(msg) { for (const c of this.conns) try { c.send(msg); } catch (e) { } },

  // ---------------- クライアント ----------------
  async join(code, name) {
    this.reset(); this.role = 'client'; this.status = '接続中…';
    if (window.NO_ONLINE) { this.err = 'このページではフレンド戦は使えません(index.html 版で遊んでください)'; this.emit('error'); return; }
    try { await loadPeerJS(); } catch (e) { this.err = e.message; this.emit('error'); return; }
    const peer = this.peer = new Peer(Object.assign({ debug: 0 }, window.PEER_OPTS || {}));
    peer.on('error', e => { this.err = e.type === 'peer-unavailable' ? 'ルームが見つかりません(コードを確認してください)' : '接続エラー: ' + e.type; this.emit('error'); });
    peer.on('open', () => {
      const conn = this.conn = peer.connect(PEER_PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
      conn.on('open', () => { this.status = 'ホストに接続しました! 開始を待っています'; conn.send({ t: 'hello', name }); this.emit('lobby'); });
      conn.on('data', d => this.clientRecv(d));
      conn.on('close', () => { this.err = 'ホストとの接続が切れました'; this.emit('disconnect'); });
    });
  },
  clientRecv(d) {
    if (!d || typeof d !== 'object') return;
    switch (d.t) {
      case 'lobby': this.lobby = d.list; this.cfg = d.cfg; this.emit('lobby'); break;
      case 'kick': this.err = d.reason; this.emit('error'); break;
      case 'start': this.emit('start', d); break;
      case 's': if (this.view && d.q >= (this.view.lastQ || 0) - 1) this.view.apply(d); break;
      case 'end': this.emit('end'); break;
    }
  },
  sendInput(mask, now, follow) {
    if (!this.conn || !this.conn.open) return;
    if (mask !== this.lastMask || now - this.lastIn > 100) { this.lastMask = mask; this.lastIn = now; try { this.conn.send({ t: 'in', m: mask, f: follow }); } catch (e) { } }
  },
};
// host の接続を開始時に ID 割り当て(Game 生成前に呼ぶ)
function assignPeerIds() { Net.conns.forEach((c, i) => { c.pid = i + 1; }); }

// ============================================================
//  クライアント側のビュー(スナップショットを補間して描画用に保持)
// ============================================================
class ClientView {
  constructor(d) {
    this.you = d.you; this.mapSeed = d.seed; this.map = genTrainingMap(d.seed, d.size); this.phase = 'train';
    this.players = d.names.map((name, id) => ({ id, name, col: id % PLAYER_COLS.length, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, a: 0, m: 0, hp: 100, dead: 0, out: false, inv: 0, flash: 0, parts: [0, 0, 0], key: false, arw: null, buf: { jet: 0, dumb: 0, glass: 0, bar: 0 }, st: [0, 0, 0, 0], items: [], init: false }));
    this.warns = []; this.bullets = []; this.enemies = []; this.pickups = []; this.chests = []; this.machines = []; this.wilds = []; this.balls = []; this.meteors = []; this.warps = [];
    this.boss = null; this.fish = null; this.evt = { cur: null }; this.zone = null; this.t = 0; this.count = 0; this.arena = -1; this.rou = null; this.result = null;
    this.maps = { E: new Map(), K: new Map(), C: new Map(), M: new Map(), W: new Map() };
    this.lastQ = 0; this.mazeSeed = null; this.ss = 1; this.got = false;
  }
  sync(store, ids, mk) { const out = [], seen = new Map(); for (const id of ids) { let o = store.get(id); if (!o) o = mk(id); seen.set(id, o); out.push(o); } store.clear(); for (const [k, v] of seen) store.set(k, v); return out; }
  apply(d) {
    this.lastQ = d.q; const c = d.c; this.got = true;
    const prevPhase = this.phase;
    this.phase = c.ph; this.t = c.T / 10; this.count = c.cnt / 10; this.battleT = c.bt / 10;
    if (c.ph === 'battle' && (this.arena !== c.ar || prevPhase !== 'battle')) { this.arena = c.ar; this.map = genArena(c.ar, c.as, this.players.length); this.bullets = []; }
    this.rou = c.rou ? { sel: c.rou[0], t: c.rou[1] / 100, dur: c.rou[2] } : null; this.result = c.res;
    c.P.forEach((a, i) => {
      const p = this.players[i]; if (!p) return;
      const jump = d2(p.tx, p.ty, a[0], a[1]) > 60 * 60 || !p.init;
      p.tx = a[0]; p.ty = a[1]; p.tvx = a[7]; p.tvy = a[8]; if (jump) { p.x = a[0]; p.y = a[1]; p.init = true; }
      if (i !== this.you || !p.pred) p.ta = a[2] / 100;
      p.m = a[3]; p.hp = a[4]; const fl = a[5];
      p.dead = fl & 1 ? Math.max(.01, a[9] / 10) : 0; p.out = !!(fl & 2); p.inv = fl & 4 ? 1 : 0; p.flash = fl & 8 ? .1 : 0; p.key = !!(fl & 16);
      p.buf.bar = fl & 32 ? 1 : 0; p.buf.jet = fl & 64 ? 1 : 0; p.buf.dumb = fl & 128 ? 1 : 0; p.buf.glass = fl & 256 ? 1 : 0; p.charging = !!(fl & 512);
      p.parts = [a[6] & 7, (a[6] >> 3) & 7, (a[6] >> 6) & 7]; p.aimT = a[2] / 100; p.svx = a[7]; p.svy = a[8];
      p.arw = a[10] !== null && a[10] !== undefined ? { a: a[10] / 100, t: a[11] / 10 } : null; p.stars = a[12]; p.bk = a[13];
    });
    // 自分
    const me = this.players[this.you], m = d.me;
    me.st = m.st; me.items = m.it.map(([k, n]) => ({ k, n })); this.ss = m.ss; me.tv = !!m.tv; this.evtList = m.tv; me.place = m.pl;
    me.buf = { jet: m.bf[0] / 10, dumb: m.bf[1] / 10, glass: m.bf[2] / 10, bar: m.bf[3] / 10 };
    if (m.no && m.no.length) UI.addNotes(m.no);
    // 弾
    const B = d.B, bl = [];
    for (let i = 0; i < B.length; i += 10) { const rr = B[i + 6]; bl.push({ x: B[i], y: B[i + 1], vx: B[i + 2], vy: B[i + 3], k: KNAME[B[i + 4]], col: B[i + 5], r: (rr % 1000) / 10, big: rr % 2000 >= 1000 ? 1 : 0, tr: rr >= 2000 ? 1 : 0, t: B[i + 7] / 100, life: B[i + 8] / 100, ph: B[i + 9], ang: Math.atan2(B[i + 3], B[i + 2]) }); }
    this.bullets = bl;
    // 敵
    const E = d.E, eids = []; for (let i = 0; i < E.length; i += 7) eids.push(E[i]);
    this.enemies = this.sync(this.maps.E, eids, id => ({ id, init: false, t: Math.random() * 3 }));
    for (let i = 0, j = 0; i < E.length; i += 7, j++) { const e = this.enemies[j]; e.tp = E[i + 1]; e.tx = E[i + 2]; e.ty = E[i + 3]; if (!e.init) { e.x = e.tx; e.y = e.ty; e.init = true; } e.hp = E[i + 4]; e.mhp = 100; e.flash = E[i + 5] ? .1 : 0; e.face = E[i + 6]; }
    const K = d.K, kids = []; for (let i = 0; i < K.length; i += 6) kids.push(K[i]);
    this.pickups = this.sync(this.maps.K, kids, id => ({ id, init: false, t: 0 }));
    for (let i = 0, j = 0; i < K.length; i += 6, j++) { const k = this.pickups[j]; k.tx = K[i + 1]; k.ty = K[i + 2]; if (!k.init) { k.x = k.tx; k.y = k.ty; k.init = true; } k.z = K[i + 3]; k.k = K[i + 4]; k.life = K[i + 5] / 10; k.t = 0; }
    this.chests = this.sync(this.maps.C, c.C.map(a => a[0]), id => ({ id }));
    c.C.forEach((a, j) => { const o = this.chests[j]; o.type = CHEST_T[a[1]]; o.x = a[2]; o.y = a[3]; o.hp = a[4]; o.mhp = o.type === 'L' ? 1e9 : 100; if (o.type === 'L') o.hp = 1e9; o.flash = a[5] ? .1 : 0; });
    this.machines = this.sync(this.maps.M, c.M.map(a => a[0]), id => ({ id }));
    c.M.forEach((a, j) => { const o = this.machines[j]; o.x = a[1]; o.y = a[2]; o.m = a[3]; o.a = a[4] / 100; });
    this.wilds = this.sync(this.maps.W, c.W.map(a => a[0]), id => ({ id, init: false }));
    c.W.forEach((a, j) => { const o = this.wilds[j]; o.tx = a[1]; o.ty = a[2]; if (!o.init) { o.x = o.tx; o.y = o.ty; o.init = true; } o.m = a[3]; o.a = a[4] / 100; o.stun = a[5] / 10; o.legend = !!a[6]; o.hp = a[7]; o.mhp = 100; o.flash = a[8] ? .1 : 0; });
    this.boss = c.bo ? Object.assign(this.boss || { x: c.bo[0], y: c.bo[1] }, { tx: c.bo[0], ty: c.bo[1], hp: c.bo[2], mhp: c.bo[3], st: c.bo[4] ? 'charge' : 'walk', flash: c.bo[5] ? .14 : 0, vx: c.bo[6] }) : null;
    this.fish = c.fi ? Object.assign(this.fish || { x: c.fi[0], y: c.fi[1] }, { tx: c.fi[0], ty: c.fi[1], hp: c.fi[2], mhp: c.fi[3], a: c.fi[4] / 100, flash: c.fi[5] ? .14 : 0 }) : null;
    this.balls = c.ba.map(a => ({ x: a[0], y: a[1], kind: a[2], rot: a[3] / 10, vx: a[4], vy: a[5] }));
    this.meteors = c.me.map(a => ({ id: a[0], x: a[1], y: a[2], t: a[3] / 100, fall: a[4] / 100, r: a[5], big: a[6], kind: a[7] }));
    this.warps = c.wa.map(a => ({ id: a[0], x: a[1], y: a[2], hue: a[3] }));
    this.evt.cur = c.ev ? { type: c.ev.ty, t: c.ev.t / 10, dur: c.ev.d, marks: c.ev.mk, region: c.ev.rg, seed: c.ev.sd, st: c.ev.st } : null;
    this.evtIdx = c.ei; this.evtN = c.en; this.legendOrder = c.lo;
    // 迷路
    const ms = this.evt.cur && this.evt.cur.type === 'maze' ? this.evt.cur.seed : null;
    if (ms !== this.mazeSeed && this.phase === 'train') { this.mazeSeed = ms; if (ms) { this.map.over = genLabyrinth(this.map, ms).over; this.map.overT = 0; } else this.map.over = null; this.map.buildMini(); }
    this.map.bnd = c.bnd ? { x0: c.bnd[0], y0: c.bnd[1], x1: c.bnd[2], y1: c.bnd[3] } : null;
    this.warns = (c.wn || []).map(a => ({ k: ['mbomb', 'bbomb', 'sword'][a[0]], x: a[1], y: a[2], a: a[3] / 100, t: a[4] / 100 }));
    this.zone = c.zo ? { x: c.zo[0], y: c.zo[1], r: c.zo[2] } : null;
    for (const f of d.F) FX.play(f[0], f[1], f[2], f[3], f[4], f[5], this);
    for (const g of c.G) UI.onGfx(g, this);
  }
  // 毎フレーム: 補間 + 自機の予測
  update(dt, mask) {
    const k = 1 - Math.exp(-dt * 14);
    for (const p of this.players) {
      if (p.id === this.you && !p.dead && !p.out && this.phase !== 'roulette' && this.phase !== 'result' && !p.arw) { this.predict(p, dt, mask); p.aim = (p.aim ?? p.a) + angDiff(p.aim ?? p.a, p.aimT ?? p.a) * k; continue; }
      p.pred = false;
      p.tx += (p.tvx || 0) * dt; p.ty += (p.tvy || 0) * dt;
      p.x = lerp(p.x, p.tx, k); p.y = lerp(p.y, p.ty, k); p.a += angDiff(p.a, p.ta ?? p.a) * k; p.vx = p.svx; p.vy = p.svy; p.aim = p.a;
      if (p.arw) p.a = p.arw.a;
    }
    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt; }
    for (const e of this.enemies) { e.x = lerp(e.x, e.tx, k); e.y = lerp(e.y, e.ty, k); e.t += dt; }
    for (const p of this.pickups) { p.x = lerp(p.x, p.tx, k); p.y = lerp(p.y, p.ty, k); }
    for (const w of this.wilds) { w.x = lerp(w.x, w.tx, k); w.y = lerp(w.y, w.ty, k); }
    for (const b of this.balls) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const m of this.meteors) m.t += dt;
    if (this.boss) { this.boss.x = lerp(this.boss.x, this.boss.tx, k); this.boss.y = lerp(this.boss.y, this.boss.ty, k); }
    if (this.fish) { this.fish.x = lerp(this.fish.x, this.fish.tx, k); this.fish.y = lerp(this.fish.y, this.fish.ty, k); }
    if (this.rou) this.rou.t += dt;
    if (this.map.over) this.map.overT = Math.min(1, this.map.overT + dt / 1.2);
  }
  predict(p, dt, mask) {
    p.pred = true;
    const frozen = this.phase === 'battle' && this.count > 0; const m = frozen ? 0 : mask;
    const lock = p.charging, dir = lock ? null : maskDir(m), z = !lock && (m & IN.Z) !== 0; // ボムのチャージ中は動けない
    stepMachine(p, dir, z, dt, this.map, this.ss);
    // サーバー位置へ徐々に寄せる
    p.tx += (p.tvx || 0) * dt; p.ty += (p.tvy || 0) * dt;
    const dd = d2(p.x, p.y, p.tx, p.ty);
    if (dd > 56 * 56) { p.x = p.tx; p.y = p.ty; p.vx = p.svx; p.vy = p.svy; }
    else { p.x = lerp(p.x, p.tx, .06); p.y = lerp(p.y, p.ty, .06); }
  }
}
