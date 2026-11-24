'use strict';
// ============================================================
//  HUD / 演出 (メインキャンバス 960x540 にくっきり描画)
//  方針: プレイヤーは画面中央を見ている → 大事な情報・演出は中央付近にアイコンで出す。
//        枠はほぼ透明。重要な数字は大きく、それ以外は小さく薄く。
// ============================================================
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', stroke = 4, sc = '#0b0b18') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = sc; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function panel(ctx, x, y, w, h, col = 'rgba(12,12,36,.3)', border = 'rgba(138,138,208,.25)') {
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}
function icon(ctx, img, x, y, s = 2) { ctx.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s); }
function iconC(ctx, img, x, y, s = 2) { ctx.drawImage(img, Math.round(x - img.width * s / 2), Math.round(y - img.height * s / 2), img.width * s, img.height * s); }
function wrapText(ctx, s, maxW, size) {
  ctx.font = `${size}px ${FONT}`; const out = []; let line = '';
  for (const ch of s) { if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; }
  if (line) out.push(line); return out;
}
// ドクロの上に数字(デス数)
function skull(ctx, x, y, n, s = 4, col = '#fff') { iconC(ctx, GFX.skull, x, y, s); txt(ctx, '' + n, x, y + GFX.skull.height * s * .55, 10 * s * .9, col, 'center', s * 1.6); }
function rays(ctx, x, y, r0, r1, n, col, rot, alpha) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU, da = Math.PI / n * .5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a - da) * r0, y + Math.sin(a - da) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a + da) * r0, y + Math.sin(a + da) * r0); ctx.fill(); } ctx.restore(); }

// バトルの順位: デスが少ない順 → 撃破が多い順
function battleRank(V) { return V.players.slice().sort((a, b) => ((a.deaths || 0) - (b.deaths || 0)) || ((b.bk || 0) - (a.bk || 0)) || (a.id - b.id)); }
const BUFF_LIST = [['dumb', 0], ['jet', 1], ['bar', 2], ['glass', 3]];
const BUFF_MAX = { dumb: 9, jet: 9, bar: 6, glass: 9 };

const UI = {
  banners: [], feed: [], floats: [], prevEvt: null, prevPhase: null, sparks: [],
  reset() {
    this.popQ = []; this.pops = []; this.dmgs = []; this.killPop = null; this.combo = 0; this.banners = []; this.feed = []; this.floats = []; this.prevEvt = null; this.prevPhase = null; this.sparks = [];
    this.lastRou = -1; this.resultDone = false; this.card = null; this.ko = null; this.legendShow = null; this.timeAnn = {}; this.pinchT = 0; this.prevSt = null; this.bump = [0, 0, 0, 0]; this.resStart = null; this.resStep = -1; this.flyers = [];
  },
  // 画面ど真ん中に出すカットイン
  banner(txt, sub, col, big = true, life = 3) {
    this.banners = []; this.banners.push({ txt, sub, col, big, t: 0, life });
    for (let i = 0; i < (big ? 140 : 40); i++) { const a = Math.random() * TAU, s = rnd(120, big ? 700 : 350); this.sparks.push({ x: W / 2 + rnd(-200, 200), y: H / 2 + rnd(-30, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, life: rnd(.6, 1.6), col: pick(['#fff', '#ffe14d', col, col]), s: rnd(3, 8) }); }
  },
  addFeed(s, col = '#fff', mine = false) { this.feed.unshift({ s, col, t: 0, mine }); if (this.feed.length > 5) this.feed.pop(); },
  name(V, id) { const p = V.players[id]; return p ? p.name : '???'; },

  // 状態の変化から演出を出す(ホスト・クライアント共通)
  watch(V) {
    const c = V.evt && V.evt.cur, key = c ? c.type + '@' + Math.round(c.st || 0) : null;
    if (key !== this.prevEvt) {
      if (this.prevEvt) { const t = this.prevEvt.split('@')[0]; this.banner(EVENT_DEFS[t].short + ' 終了!', 'EVENT CLEAR', EVENT_DEFS[t].col, false, 1.8); Sound.play('eventEnd', 1); }
      if (c) { const D = EVENT_DEFS[c.type]; this.banner(D.name, c.type === 'rush' && c.region !== undefined ? REGION_NAME[c.region] + 'エリアで発生!' : 'EVENT!', D.col, true, 2.6); FX.flash = .2; FX.flashCol = D.col; }
      this.prevEvt = key;
    }
    if (V.phase !== this.prevPhase) {
      if (V.phase === 'roulette') { this.banner('トレーニング終了!', 'TIME UP', '#ff4d6d', true, 2); Sound.play('go', 1); }
      if (V.phase === 'battle') { this.banner(ARENAS[V.arena].name, 'BATTLE STAGE', ARENAS[V.arena].col, false, 2.2); Music.play('battle'); Render.cam.snap = true; this.timeAnn = {}; }
      if (V.phase === 'result') { Music.stop(); this.resStart = null; this.resStep = -1; }
      this.prevPhase = V.phase;
    }
    // 残り時間の告知(2分・1分・30秒)
    if ((V.phase === 'train' || (V.phase === 'battle' && V.count <= 0)) && V.t > 0) {
      for (const s of [120, 60, 30]) if (V.t <= s && V.t > s - 1.5 && !this.timeAnn[V.phase + s]) { this.timeAnn[V.phase + s] = 1; this.banner(s >= 60 ? '残り ' + (s / 60) + '分' : '残り ' + s + '秒', 'TIME', s === 30 ? '#ff4d6d' : '#ffe14d', false, 1.6); Sound.play('warn', 1); }
    }
    // ステータスが増えたら数字をはずませる
    const me = V.players[Render.meId];
    if (me && me.st) { if (this.prevSt) for (let i = 0; i < 4; i++) if (me.st[i] > this.prevSt[i]) this.bump[i] = .45; this.prevSt = me.st.slice(); }
  },
  onGfx(a, V) {
    const me = Render.meId;
    switch (a[0]) {
      case 'kill': {
        const [, k, v] = a; const mine = k === me || v === me;
        if (k >= 0) this.addFeed(this.name(V, k) + ' ▶ ' + this.name(V, v), PLAYER_COLS[V.players[k]?.col ?? 0], mine);
        else this.addFeed(this.name(V, v) + ' が力尽きた', '#aaa', mine);
        if (mine && k >= 0) this.startKO(V, k, v); // スマブラ風の撃破演出
        else if (v === me) { FX.stop(.25); }
        break;
      }
      case 'legend': this.startLegend(V, a[1], a[2]); break;
      case 'bossDown': this.banner('ギガベヒモス撃破!', a[1] >= 0 ? 'ラストアタック: ' + this.name(V, a[1]) : 'DEFEATED', '#c86bff', true, 2.6); break;
      case 'key': this.addFeed(this.name(V, a[1]) + ' が鍵をゲット', '#ffe14d', a[1] === me); break;
      case 'unlock': this.addFeed(this.name(V, a[1]) + ' が鍵付き宝箱をオープン!', '#ffe14d', a[1] === me); break;
      case 'arrow': if (a[1] !== me) { this.addFeed('!! ' + this.name(V, a[1]) + ' がビッグアローをチャージ中', '#ff4d4d', false); Sound.play('warn', .8); } break;
      case 'timeup': this.banner('タイムアップ!', 'TIME UP', '#ff4d6d', true, 2.4); Sound.play('go', 1); break;
    }
  },
  // ---- 撃破演出: 倒した側と倒された側だけを、倒した側のマシン色の背景で大写し ----
  startKO(V, k, v) {
    this.ko = { t: 0, k, v, col: MACHINES[V.players[k].m].col, life: 1.3 };
    FX.stop(.45); FX.kick(.3); FX.addShake(14); Sound.play('kill', 1); Sound.play('bigboom', 1);
  },
  // ---- 伝説マシン完成: カットイン + 全員の視点を移す + 機体ごとの専用演出 ----
  startLegend(V, pid, mid) {
    this.legendShow = { t: 0, pid, mid, life: 3.2 }; Render.forceId = pid; Render.forceT = 3.2;
    Sound.play('win', 1); Sound.play('bigboom', .8); FX.flash = .5; FX.flashCol = '#ffffff';
  },
  // 乗り換え時の機体紹介カード(画面いっぱい)
  nameCard(m) { this.card = { m, t: 0, life: 1.9 }; },
  addNotes(notes) {
    for (const [s, col, ic] of notes) {
      if (ic) { this.popQ.push({ col, ic }); continue; }
      if (s) { this.floats.push({ s, col, t: 0 }); if (this.floats.length > 3) this.floats.shift(); }
    }
  },
  // 取得ポップ(画面中央にアイコンを順番に。連続で取ると音階が上がる)
  popQ: [], pops: [], combo: 0, comboT: 0, popT: 0, dmgs: [], killPop: null, bump: [0, 0, 0, 0], flyers: [],
  dmgNum(x, y, v, col, big) { this.dmgs.push({ x: x + rnd(-6, 6), y, v: Math.round(v), col, big, t: 0 }); if (this.dmgs.length > 40) this.dmgs.shift(); },
  popIcon(V, ic) {
    const c = ic[0], r = ic.slice(1);
    if (c === 's') return GFX.patchBig[+r]; if (c === 'k') return GFX.key; if (c === 'p') return partImg(V, +r); if (c === 'x') return GFX.skull;
    return GFX.itemUI[r] || GFX.itemUI.tv;
  },
  update(dt) {
    this.popT -= dt; this.comboT -= dt;
    if (this.popQ.length && this.popT <= 0) {
      const p = this.popQ.shift(); this.combo = this.comboT > 0 ? this.combo + 1 : 0; this.comboT = .9; p.t = 0;
      p.life = this.popQ.length > 3 ? .32 : this.popQ.length ? .45 : .75; // たくさん取った時は1個あたり短く
      this.pops.push(p); if (this.pops.length > 4) this.pops.shift();
      Sound.combo(this.combo); this.popT = p.life * .55;
      if (p.ic[0] === 's') this.flyers.push({ i: +p.ic[1], t: 0 });
    }
    for (const p of this.pops) p.t += dt; this.pops = this.pops.filter(p => p.t < p.life);
    for (const f of this.flyers) f.t += dt; this.flyers = this.flyers.filter(f => f.t < .5);
    for (let i = 0; i < 4; i++) this.bump[i] = Math.max(0, this.bump[i] - dt);
    for (const d of this.dmgs) d.t += dt; this.dmgs = this.dmgs.filter(d => d.t < .8);
    for (const k of ['card', 'ko', 'legendShow']) if (this[k]) { this[k].t += dt; if (this[k].t > this[k].life) this[k] = null; }
    for (const b of this.banners) b.t += dt; this.banners = this.banners.filter(b => b.t < b.life);
    for (const f of this.feed) f.t += dt; this.feed = this.feed.filter(f => f.t < 6);
    for (const f of this.floats) f.t += dt; this.floats = this.floats.filter(f => f.t < 1.4);
    for (const s of this.sparks) { s.t += dt; s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt; } this.sparks = this.sparks.filter(s => s.t < s.life);
    this.pinchT -= dt;
  },

  // ------------------------------------------------------------
  draw(ctx, V, time) {
    const me = V.players[Render.meId];
    if (V.phase === 'roulette') { this.drawRoulette(ctx, V, time); this.drawBanners(ctx, time); return; }
    if (V.phase === 'result') { this.drawResult(ctx, V, time); return; }
    if (this.ko) { this.drawKO(ctx, V, time); this.drawBanners(ctx, time); return; }
    this.drawSpeedLines(ctx, V, time);
    this.drawBuffEdges(ctx, me, time);
    this.drawMinimap(ctx, V, time);
    this.drawLandmarks(ctx, V);
    this.drawTags(ctx, V, time);
    this.drawRings(ctx, V, me, time);
    this.drawMarkers(ctx, V, time);
    this.drawDmgs(ctx);
    this.drawFloats(ctx, V);
    if (FX.hurt > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,30,30,${FX.hurt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    this.drawEdgeGlow(ctx, time);
    if (FX.flash > 0) { ctx.globalAlpha = Math.min(.6, FX.flash); ctx.fillStyle = FX.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.feedY = V.phase === 'battle' ? 160 : 82;
    this.drawTopLeft(ctx, V, time);
    this.drawEventPanel(ctx, V, time);
    this.drawFeed(ctx);
    this.drawBossBar(ctx, V, time);
    if (me) { this.drawStatPanel(ctx, V, me, time); this.drawItems(ctx, V, me, time); this.drawTV(ctx, V, me); this.drawPinch(ctx, V, me, time); }
    this.drawCenter(ctx, V, me, time);
    this.drawPops(ctx, V, time);
    this.drawCard(ctx, time);
    this.drawLegendShow(ctx, V, time);
    this.drawBanners(ctx, time);
  },
  // イベント発生時、画面のふちをイベント色で光らせる
  drawEdgeGlow(ctx, time) {
    const b = this.banners.find(b => b.big && b.t < 2.4); if (!b) return;
    this.edge(ctx, b.col, (1 - b.t / 2.4) * (.55 + Math.sin(time * 14) * .15), 80);
  },
  edge(ctx, col, a, e) {
    const [r, g, bl] = hexRGB(col), c0 = `rgba(${r},${g},${bl},${a})`, c1 = `rgba(${r},${g},${bl},0)`;
    const grad = (x0, y0, x1, y1) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
    ctx.fillStyle = grad(0, 0, 0, e); ctx.fillRect(0, 0, W, e); ctx.fillStyle = grad(0, H, 0, H - e); ctx.fillRect(0, H - e, W, e);
    ctx.fillStyle = grad(0, 0, e, 0); ctx.fillRect(0, 0, e, H); ctx.fillStyle = grad(W, 0, W - e, 0); ctx.fillRect(W - e, 0, e, H);
  },
  // 強化アイテム使用中: 画面の端からその色がにじむ
  drawBuffEdges(ctx, me, time) {
    if (!me || !me.buf) return;
    for (const [k, si] of BUFF_LIST) if (me.buf[k] > 0) this.edge(ctx, STAT_COL[si], .22 + Math.sin(time * 6 + si) * .07, 46);
  },

  // スピード線(疾走感)
  drawSpeedLines(ctx, V, time) {
    const me = V.players[Render.meId]; if (!me || me.out || me.dead > 0) return;
    const sp = Math.hypot(me.vx || 0, me.vy || 0); if (sp < 120) return;
    const a = Math.atan2(me.vy, me.vx), k = Math.min(1, (sp - 120) / 200), n = 10 + Math.floor(k * 22);
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const side = Math.random() * TAU, rr = rnd(260, 560), x = W / 2 + Math.cos(side) * rr, y = H / 2 + Math.sin(side) * rr * .6, L = rnd(40, 130) * (.5 + k);
      ctx.globalAlpha = rnd(.08, .3) * (.4 + k); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * L, y - Math.sin(a) * L); ctx.stroke();
    }
    ctx.restore();
  },
  drawDmgs(ctx) {
    for (const d of this.dmgs) {
      const k = d.t / .8, x = Render.sx(d.x), y = Render.sy(d.y) - 20 - k * 40, s = d.t < .1 ? 1 + (.1 - d.t) * 8 : 1;
      ctx.globalAlpha = k > .6 ? (1 - k) / .4 : 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); txt(ctx, '' + d.v, 0, 0, d.big ? 30 : 20, d.col, 'center', 5); ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
  // 取得アイコン: 画面中央にドン → 小さくなってステータス欄へ飛ぶ
  drawPops(ctx, V, time) {
    for (const p of this.pops) {
      const k = p.t / p.life, cx = W / 2, cy = H / 2 - 10;
      const pop = k < .25 ? .3 + k / .25 * 1.1 : k < .4 ? 1.4 - (k - .25) * 2.6 : 1, out = k > .7 ? (1 - k) / .3 : 1;
      ctx.save(); ctx.globalAlpha = out;
      const [r, g, b] = hexRGB(p.col);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130); gr.addColorStop(0, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); ctx.fillStyle = gr; ctx.fillRect(cx - 130, cy - 130, 260, 260);
      rays(ctx, cx, cy, 30, 120 * pop, 12, p.col, time * 2, .35 * out);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.globalAlpha = (1 - k) * out; ctx.beginPath(); ctx.arc(cx, cy, 30 + k * 90, 0, TAU); ctx.stroke(); ctx.globalAlpha = out;
      const img = this.popIcon(V, p.ic), sc = 7 * pop; ctx.drawImage(img, cx - img.width * sc / 2, cy - img.height * sc / 2, img.width * sc, img.height * sc);
      ctx.restore();
    }
    // ステータス欄へ飛んでいく
    for (const f of this.flyers) { const k = f.t / .5, e = k * k, x = lerp(W / 2, 46 + f.i * 64, e), y = lerp(H / 2 - 10, H - 38, e); ctx.globalAlpha = 1 - k * .5; iconC(ctx, GFX.patchBig[f.i], x, y, 4 - k * 2); ctx.globalAlpha = 1; }
  },
  // 撃破演出(背景を倒した側の色にして、二人だけを大写し)
  drawKO(ctx, V, time) {
    const K = this.ko, k = K.t / K.life, A = V.players[K.k], B = V.players[K.v]; if (!A || !B) return;
    ctx.save(); ctx.globalAlpha = k < .1 ? k / .1 : k > .8 ? (1 - k) / .2 : 1;
    ctx.fillStyle = K.col; ctx.fillRect(0, 0, W, H);
    const ax = Render.sx(A.x), ay = Render.sy(A.y), bx = Render.sx(B.x), by = Render.sy(B.y);
    rays(ctx, bx, by, 40, 900, 28, '#ffffff', time * .8, .25);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + time; ctx.fillRect(bx + Math.cos(a) * 300, by + Math.sin(a) * 300, 40, 3); }
    { const s = k < .12 ? 3 - k / .12 * 2 : 1; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.08); ctx.scale(s, s); ctx.globalAlpha *= .9; txt(ctx, 'BREAK!!', 0, 0, 110, '#ffffff', 'center', 12, '#0b0b18'); ctx.restore(); }
    const dr = (p, x, y, s, rot) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const img = GFX.machine[p.m]; ctx.drawImage(GFX.machineW[p.m], -img.width * s / 2 - 3, -img.height * s / 2 - 3, img.width * s + 6, img.height * s + 6); ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); ctx.restore(); };
    dr(A, ax, ay, 5.5, A.aim ?? A.a); dr(B, bx, by, 5.5, (B.aim ?? B.a) + K.t * 12);
    rays(ctx, bx, by, 10, 90 + k * 60, 10, '#fff6a0', -time * 3, .9 * (1 - k));
    txt(ctx, A.name, ax, ay - 70, 26, '#ffffff', 'center', 6); txt(ctx, B.name, bx, by + 70, 22, '#ffffff', 'center', 5);
    ctx.restore();
  },
  // 伝説マシン完成カットイン
  drawLegendShow(ctx, V, time) {
    const L = this.legendShow; if (!L) return;
    const t = L.t, M = MACHINES[L.mid], p = V.players[L.pid], k = t / L.life;
    // 機体ごとの専用演出(最初の 2 秒)
    if (p && t < 2.2 && Math.random() < .9) {
      if (L.mid === 12) for (let i = 0; i < 6; i++) { const a = time * 6 + i; Particles.add(p.x + Math.cos(a) * 30 * (1 + t), p.y + Math.sin(a) * 30 * (1 + t), rnd(-40, 40), -80, .8, 5, Math.random() < .5 ? C_ORA : C_YEL, 1); }
      else if (L.mid === 13) { if (Math.random() < .25) FxObjs.add({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: 120, w: 5, col: '#3d9bff', life: .8 }); for (let i = 0; i < 4; i++) { const a = -time * 5 + i * 1.6; Particles.add(p.x + Math.cos(a) * 50, p.y + Math.sin(a) * 50, Math.cos(a + 1.6) * 80, Math.sin(a + 1.6) * 80, .7, 4, PC('#9ae8ff'), 1); } }
      else { if (Math.floor(t * 3) !== Math.floor((t - .016) * 3)) { FxObjs.add({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: 160, w: 10, col: '#a03dff', life: .7 }); FX.addShake(10); Sound.play('bigboom', .6); } }
    }
    ctx.save();
    const inK = Math.min(1, t / .3), out = k > .85 ? (1 - k) / .15 : 1; ctx.globalAlpha = out;
    // 斜めの帯
    ctx.translate(W / 2, H / 2); ctx.rotate(-.12);
    const bw = W * 1.4 * inK; ctx.fillStyle = 'rgba(10,8,24,.85)'; ctx.fillRect(-bw / 2, -95, bw, 190);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = PAL[RAINBOW[(i + Math.floor(time * 10)) % 8]]; ctx.fillRect(-bw / 2, -95 + i * 2, bw, 2); ctx.fillRect(-bw / 2, 81 + i * 2, bw, 2); }
    const img = GFX.legendUp[LEGEND_IDS.indexOf(L.mid)], s = 9, sx = -260 + (1 - Math.min(1, t / .45)) * -500;
    rays(ctx, sx, 0, 40, 200, 16, M.col, time * 2, .5);
    ctx.drawImage(img, sx - img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
    const ts = t < .5 ? 1.6 - t / .5 * .6 : 1; ctx.translate(130, 0); ctx.scale(ts, ts);
    txt(ctx, 'LEGENDARY!!', 0, -48, 30, '#ffe14d', 'center', 6);
    txt(ctx, M.name, 0, 12, 70, M.col, 'center', 10, '#ffffff');
    txt(ctx, (p ? p.name : '') + ' が完成させた!', 0, 66, 22, '#ffffff', 'center', 5);
    ctx.restore();
  },
  // 乗り換え時の機体紹介カード
  drawCard(ctx, time) {
    const C = this.card; if (!C) return;
    const M = MACHINES[C.m], t = C.t, k = t / C.life, inK = Math.min(1, t / .18), out = k > .78 ? (1 - k) / .22 : 1;
    ctx.save(); ctx.globalAlpha = out;
    const h = 220 * inK; ctx.fillStyle = 'rgba(8,8,24,.82)'; ctx.fillRect(0, H / 2 - h / 2, W, h);
    ctx.fillStyle = M.col; ctx.fillRect(0, H / 2 - h / 2, W, 5); ctx.fillRect(0, H / 2 + h / 2 - 5, W, 5);
    ctx.globalAlpha = out * .18; ctx.fillStyle = M.col; for (let i = -2; i < 22; i++) { const x = i * 60 + (t * 300) % 60; ctx.beginPath(); ctx.moveTo(x, H / 2 - h / 2); ctx.lineTo(x + 26, H / 2 - h / 2); ctx.lineTo(x - 14, H / 2 + h / 2); ctx.lineTo(x - 40, H / 2 + h / 2); ctx.fill(); } ctx.globalAlpha = out;
    const sx = 230 - (1 - Math.min(1, t / .25)) * 400, img = GFX.machine[C.m], s = M.legend ? 7 : 8;
    rays(ctx, sx, H / 2, 30, 130, 12, M.col, time * 2, .35 * out);
    ctx.save(); ctx.translate(sx, H / 2); ctx.rotate(-Math.PI / 2 + Math.sin(time * 3) * .1); ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); ctx.restore();
    const ts = t < .3 ? 1.5 - t / .3 * .5 : 1; ctx.save(); ctx.translate(600, H / 2 - 40); ctx.scale(ts, ts); txt(ctx, M.name, 0, 0, 64, M.legend ? '#ffe14d' : M.col, 'center', 10, '#ffffff'); ctx.restore();
    txt(ctx, M.trait || M.desc, 600, H / 2 + 22, 20, '#ffffff', 'center', 4);
    // 得意・苦手をアイコンで
    for (let i = 0; i < 4; i++) { const x = 480 + i * 82, y = H / 2 + 66, mul = M.mul[i]; iconC(ctx, GFX.patchBig[i], x, y, 2.4); ctx.fillStyle = '#0b0b18'; ctx.fillRect(x + 18, y - 8, 36, 16); ctx.fillStyle = STAT_COL[i]; ctx.fillRect(x + 19, y - 7, 34 * clamp(mul / 2.6, 0, 1), 14); txt(ctx, mul > 1 ? '▲' : mul < 1 ? '▼' : '', x + 36, y, 12, mul > 1 ? '#5fe36a' : '#ff6b6b', 'center', 3); }
    ctx.restore();
  },

  drawTags(ctx, V, time) {
    const me = V.players[Render.meId];
    for (const p of V.players) {
      if (p.out || !Render.onScreen(p.x, p.y) || p.id === Render.meId) continue;
      const x = Render.sx(p.x), y = Render.sy(p.y) - 30 * Render.cam.zoom;
      if (p.dead > 0) continue;
      ctx.globalAlpha = .85; txt(ctx, p.name, x, y - 8, 13, PLAYER_COLS[p.col], 'center', 3);
      if (V.phase === 'battle') { ctx.globalAlpha = .9; skull(ctx, x - 34, y - 8, p.deaths || 0, 1.4); }
      const bw = 40; ctx.fillStyle = '#0b0b18'; ctx.fillRect(x - bw / 2 - 1, y + 2, bw + 2, 5); ctx.fillStyle = p.hp > 50 ? '#5fe36a' : p.hp > 25 ? '#ffd23f' : '#ff4d4d'; ctx.fillRect(x - bw / 2, y + 3, bw * clamp(p.hp / 100, 0, 1), 3);
      ctx.globalAlpha = 1;
    }
    if (me && !me.out && me.dead <= 0 && V.phase === 'train') {
      let best = null, bd = 60 * 60;
      for (const m of V.machines) { const d = d2(m.x, m.y, me.x, me.y); if (d < bd) { bd = d; best = m; } }
      for (const w of V.wilds) if (w.stun > 0) { const d = d2(w.x, w.y, me.x, me.y); if (d < bd) { bd = d; best = w; } }
      if (best) {
        const M = MACHINES[best.m], x = Render.sx(best.x), y = Render.sy(best.y) - 34, near = bd < 22 * 22;
        txt(ctx, M.name, x, y - 12, 15, M.legend ? '#ffe14d' : M.col, 'center', 4);
        if (near) { const s = 1 + Math.sin(time * 10) * .1; ctx.save(); ctx.translate(x, y - 34); ctx.scale(s, s); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); txt(ctx, 'X', 0, 1, 20, '#0b0b18', 'center', 0); ctx.restore(); }
      }
    }
    for (const m of V.meteors) if (m.big && Render.onScreen(m.x, m.y, 200)) { const r = Math.max(0, m.fall - m.t); txt(ctx, r.toFixed(1), Render.sx(m.x), Render.sy(m.y), 40, '#ff4d4d', 'center', 6); }
  },
  // 名所の名前
  drawLandmarks(ctx, V) {
    const L = V.map.landmarks; if (!L || V.phase !== 'train') return;
    for (const l of L) if (Render.onScreen(l.x, l.y, 60)) { ctx.globalAlpha = .55; txt(ctx, l.name, Render.sx(l.x), Render.sy(l.y) - 140 * Render.cam.zoom, 16, '#ffffff', 'center', 3); ctx.globalAlpha = 1; }
  },
  // 自機の周り: HP リング + 強化アイテムの残り時間リング
  drawRings(ctx, V, me, time) {
    if (!me || me.out || me.dead > 0) return;
    const x = Render.sx(me.x), y = Render.sy(me.y), z = Render.cam.zoom, R = 34 * z * (MACHINES[me.m].big ? 1.3 : 1);
    const hp = clamp(me.hp / 100, 0, 1), col = hp > .5 ? '#5fe36a' : hp > .25 ? '#ffd23f' : '#ff4d4d';
    ctx.lineCap = 'round';
    ctx.globalAlpha = .35; ctx.strokeStyle = '#0b0b18'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, R, Math.PI * .7, Math.PI * 2.3); ctx.stroke();
    ctx.globalAlpha = hp < .25 ? .6 + Math.sin(time * 14) * .4 : .8; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, R, Math.PI * .7, Math.PI * .7 + Math.PI * 1.6 * hp); ctx.stroke();
    let rr = R + 8;
    if (me.buf) for (const [k, si] of BUFF_LIST) if (me.buf[k] > 0) {
      const f = clamp(me.buf[k] / BUFF_MAX[k], 0, 1); ctx.globalAlpha = .85; ctx.strokeStyle = STAT_COL[si]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke(); rr += 7;
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  },
  // ピンチ警告(体力・狙われている・隕石・安全地帯の外)
  drawPinch(ctx, V, me, time) {
    if (me.out || me.dead > 0) return;
    let pinch = null;
    if (me.hp < 25) pinch = 'hp';
    for (const p of V.players) if (p !== me && p.arw && !p.out) { const ca = Math.cos(p.arw.a), sa = Math.sin(p.arw.a), dx = me.x - p.x, dy = me.y - p.y; if (dx * ca + dy * sa > 0 && Math.abs(-dx * sa + dy * ca) < 40) pinch = 'arrow'; }
    for (const m of V.meteors) if (m.kind !== 2 && d2(m.x, m.y, me.x, me.y) < (m.r + 8) ** 2) pinch = 'meteor';
    if (V.zone && V.phase === 'battle' && d2(me.x, me.y, V.zone.x, V.zone.y) > V.zone.r ** 2) pinch = 'zone';
    if (!pinch) return;
    if (this.pinchT <= 0) { Sound.play('warn', .9); this.pinchT = 1.1; }
    const on = Math.floor(time * 6) % 2, y = H / 2 + 70;
    this.edge(ctx, '#ff2d2d', .25 + (on ? .15 : 0), 60);
    if (on) { const s = 1 + Math.sin(time * 12) * .06; ctx.save(); ctx.translate(W / 2, y); ctx.scale(s, s); txt(ctx, 'ピンチ!', 0, 0, 34, '#ff4d4d', 'center', 7, '#ffffff'); ctx.restore(); }
    const ic = { hp: '♥', arrow: '➤', meteor: '☄', zone: '◎' }[pinch]; txt(ctx, ic, W / 2 - 92, y, 30, '#ffe14d', 'center', 5);
  },

  // イベント位置の矢印
  drawMarkers(ctx, V, time) {
    const c = V.evt && V.evt.cur; if (!c || !c.marks || !c.marks.length) return;
    const D = EVENT_DEFS[c.type], cam = Render.cam;
    const list = c.marks.slice().sort((a, b) => d2(a[0], a[1], cam.x, cam.y) - d2(b[0], b[1], cam.x, cam.y)).slice(0, 3);
    list.forEach((m, i) => {
      const sx = Render.sx(m[0]), sy = Render.sy(m[1]);
      const inset = 46, onS = sx > inset && sx < W - inset && sy > inset && sy < H - inset;
      const pulse = 1 + Math.sin(time * 6 + i) * .15;
      if (onS) {
        const me = V.players[Render.meId]; if (me && d2(me.x, me.y, m[0], m[1]) < 70 * 70) return;
        const y = sy - 50 + Math.sin(time * 5) * 5; ctx.fillStyle = D.col; ctx.strokeStyle = '#0b0b18'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sx - 10, y - 10); ctx.lineTo(sx + 10, y - 10); ctx.lineTo(sx, y + 4); ctx.closePath(); ctx.stroke(); ctx.fill();
        return;
      }
      const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy, a = Math.atan2(dy, dx);
      const k = Math.min((W / 2 - inset) / Math.abs(dx || 1e-6), (H / 2 - inset) / Math.abs(dy || 1e-6));
      const ax = cx + dx * k, ay = cy + dy * k;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.scale(pulse * (i ? 1 : 1.4), pulse * (i ? 1 : 1.4));
      ctx.fillStyle = D.col; ctx.strokeStyle = '#0b0b18'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-8, -16); ctx.lineTo(-2, 0); ctx.lineTo(-8, 16); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    });
  },
  drawFloats(ctx, V) {
    const me = V.players[Render.meId]; if (!me) return;
    const x = Render.sx(me.x), y = Render.sy(me.y) - 56;
    this.floats.forEach((f, i) => { const k = f.t / 1.4; ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1; txt(ctx, f.s, x, y - (this.floats.length - 1 - i) * 20 - f.t * 16, 16, f.col, 'center', 4); });
    ctx.globalAlpha = 1;
  },

  // 左上: 残り時間(大) / バトルはデス数と順位
  drawTopLeft(ctx, V, time) {
    const urgent = V.t < 10 && Math.floor(time * 4) % 2;
    iconC(ctx, GFX.clock, 26, 30, 3);
    txt(ctx, fmtTime(V.t), 48, 32, 40, urgent ? '#ff4d4d' : '#ffffff', 'left', 6);
    if (V.phase === 'train') {
      const total = V.evtN || 0, done = V.evtIdx || 0;
      for (let i = 0; i < total; i++) { ctx.fillStyle = i < done ? '#ffe14d' : 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(54 + i * 14, 62, 4.5, 0, TAU); ctx.fill(); }
    } else if (V.phase === 'battle') {
      const me = V.players[Render.meId];
      if (me) {
        skull(ctx, 210, 30, me.deaths || 0, 4.2, (me.deaths || 0) > 0 ? '#ff9b9b' : '#9bffb0');
        const rank = battleRank(V).indexOf(me) + 1; iconC(ctx, GFX.crown, 280, 18, 3); txt(ctx, rank + '', 280, 46, 30, rank === 1 ? '#ffe14d' : '#ffffff', 'center', 5);
      }
      this.drawBoard(ctx, V, time);
    }
  },
  // バトル中の順位(上位だけ小さく)
  drawBoard(ctx, V, time) {
    const R = battleRank(V), me = V.players[Render.meId], show = R.slice(0, 3);
    if (me && !show.includes(me)) show.push(me);
    show.forEach((p, i) => { const y = 84 + i * 20; ctx.globalAlpha = p === me ? 1 : .7; txt(ctx, (R.indexOf(p) + 1) + '', 16, y, 14, '#ffe14d', 'left', 3); txt(ctx, p.name, 36, y, 14, PLAYER_COLS[p.col], 'left', 3); skull(ctx, 160, y, p.deaths || 0, 1.5); });
    ctx.globalAlpha = 1;
  },
  drawFeed(ctx) {
    let y = this.feedY + 8;
    for (const f of this.feed) {
      ctx.globalAlpha = (f.t > 5 ? 6 - f.t : 1) * (f.mine ? .95 : .55);
      txt(ctx, f.s, 12, y, 12, f.col, 'left', 3); y += 17;
    }
    ctx.globalAlpha = 1;
  },
  // ミニマップ: 画面の真ん中に半透明で重ねる
  drawMinimap(ctx, V, time) {
    const M = V.map; if (!M.mini || V.phase === 'roulette') return;
    const S = 230, sc = Math.min(S / M.w, S / M.h), ox = W / 2 - M.w * sc / 2, oy = H / 2 - M.h * sc / 2;
    ctx.globalAlpha = .16; ctx.drawImage(M.mini, ox, oy, M.w * sc, M.h * sc); ctx.globalAlpha = 1;
    const P = (x, y) => [ox + x * sc, oy + y * sc];
    const dot = (x, y, s, col, a = .75) => { const [px, py] = P(x, y); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), s, s); };
    if (M.bnd) { const [a, b] = P(M.bnd.x0, M.bnd.y0), [c, d] = P(M.bnd.x1, M.bnd.y1); ctx.globalAlpha = .6; ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.strokeRect(a, b, c - a, d - b); }
    if (V.zone && V.phase === 'battle') { const [a, b] = P(V.zone.x, V.zone.y); ctx.globalAlpha = .6; ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, Math.max(1, V.zone.r * sc), 0, TAU); ctx.stroke(); }
    const ev = V.evt && V.evt.cur;
    if (ev && ev.type === 'rush' && ev.region !== undefined) { const rx = ev.region % 3, ry = Math.floor(ev.region / 3); const [a, b] = P(M.w * rx / 3, M.h * ry / 3); ctx.globalAlpha = .2 + Math.sin(time * 6) * .08; ctx.fillStyle = '#ff3c3c'; ctx.fillRect(a, b, M.w / 3 * sc, M.h / 3 * sc); }
    for (const m of V.machines) dot(m.x, m.y, 3, m.m === 0 ? '#fff' : MACHINES[m.m].legend ? '#ffe14d' : STAT_COL[MACHINES[m.m].best], .6);
    for (const c of V.chests) dot(c.x, c.y, { B: 2, A: 4, G: 2, O: 5, L: 5, I: 3 }[c.type], { B: '#c08a4a', A: '#ff4d4d', G: '#ffcc33', O: PAL[RAINBOW[Math.floor(time * 8) % 8]], L: '#ff3dd8', I: '#4da6ff' }[c.type], .6);
    for (const k of V.pickups) if (isPart(k.k) || k.k === PK_KEY) dot(k.x, k.y, 4, k.k === PK_KEY ? '#ffe14d' : '#ffffff', .9);
    for (const w of V.wilds) dot(w.x, w.y, w.legend ? 5 : 3, w.legend ? PAL[RAINBOW[Math.floor(time * 10) % 8]] : '#3dffe0');
    for (const wp of V.warps) dot(wp.x, wp.y, 3, '#c86bff');
    for (const b of V.balls) dot(b.x, b.y, 4, '#ff9b3d');
    for (const m of V.meteors) if (m.big) { const [a, b] = P(m.x, m.y); ctx.globalAlpha = .8; ctx.strokeStyle = Math.floor(time * 8) % 2 ? '#ff2d2d' : '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, m.r * sc, 0, TAU); ctx.stroke(); }
    if (V.boss) dot(V.boss.x, V.boss.y, 8, '#c86bff', .9);
    if (V.fish) dot(V.fish.x, V.fish.y, 8, PAL[RAINBOW[Math.floor(time * 10) % 8]], .9);
    if (ev && ev.marks) for (const m of ev.marks) { const [a, b] = P(m[0], m[1]); ctx.globalAlpha = .8; ctx.strokeStyle = EVENT_DEFS[ev.type].col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, 4 + (time * 10) % 6, 0, TAU); ctx.stroke(); }
    for (const p of V.players) if (p.arw && !p.out) { const [a, b] = P(p.x, p.y); ctx.globalAlpha = .8; ctx.strokeStyle = '#ff2d2d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a + Math.cos(p.arw.a) * 400, b + Math.sin(p.arw.a) * 400); ctx.stroke(); }
    for (const p of V.players) { if (p.out || p.id === Render.meId || p.dead > 0) continue; dot(p.x, p.y, partsN(p) ? 6 : 4, partsN(p) ? '#ffffff' : PLAYER_COLS[p.col], .85); }
    const me = V.players[Render.meId];
    if (me && !me.out) { const [a, b] = P(me.x, me.y); ctx.globalAlpha = .95; ctx.save(); ctx.translate(a, b); ctx.rotate(me.a); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-3, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = 1;
  },
  drawEventPanel(ctx, V, time) {
    const c = V.evt && V.evt.cur; if (!c) return;
    const D = EVENT_DEFS[c.type], x = 10, y = this.feedY, w = 230;
    let desc = D.desc; if (c.type === 'rush' && c.region !== undefined) desc = REGION_NAME[c.region] + 'エリアに雑魚敵が大量発生!';
    const lines = wrapText(ctx, desc, w - 12, 11);
    ctx.fillStyle = D.col; ctx.fillRect(x, y, 4, 34 + lines.length * 14);
    txt(ctx, D.short, x + 12, y + 10, 15, D.col, 'left', 3); txt(ctx, fmtTime(c.t), x + w, y + 10, 14, '#fff', 'right', 3);
    ctx.globalAlpha = .7; lines.forEach((l, i) => txt(ctx, l, x + 12, y + 28 + i * 14, 11, '#e8e8ff', 'left', 2)); ctx.globalAlpha = 1;
    this.feedY = y + 40 + lines.length * 14;
  },
  drawBossBar(ctx, V, time) {
    const B = V.boss; if (!B) return; // 金魚は体力が無いのでバー無し
    const w = 400, x = W / 2 - w / 2, y = 14;
    txt(ctx, 'ギガベヒモス', W / 2, y, 14, '#c86bff', 'center', 3);
    ctx.fillStyle = 'rgba(11,11,24,.6)'; ctx.fillRect(x, y + 10, w, 10);
    const f = clamp(B.hp / B.mhp, 0, 1); ctx.fillStyle = '#c86bff'; ctx.fillRect(x, y + 10, w * f, 10); ctx.fillStyle = '#ffffff50'; ctx.fillRect(x, y + 10, w * f, 3);
  },
  // 左下: ステータス(アイコン+数字を大きく)、機体名は小さく
  drawStatPanel(ctx, V, me, time) {
    const M = MACHINES[me.m], st = me.st || [0, 0, 0, 0], y = H - 38;
    ctx.globalAlpha = .6; txt(ctx, M.name, 14, H - 78, 14, M.legend ? '#ffe14d' : M.col, 'left', 3); ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const x = 14 + i * 64, b = this.bump[i], s = 1 + b * 1.2;
      iconC(ctx, GFX.patchBig[i], x + 12, y, 2.4 * s);
      txt(ctx, '' + st[i], x + 32, y + 2, 26 * (1 + b * .8), b > 0 ? STAT_COL[i] : '#ffffff', 'left', 5);
      const mul = M.mul[i]; if (mul > 1.001 || mul < .999) txt(ctx, mul > 1 ? '▲' : '▼', x + 12, y - 22, 10, mul > 1 ? '#5fe36a' : '#ff6b6b', 'center', 3);
      if (me.buf && ((i === 0 && me.buf.dumb > 0) || (i === 1 && me.buf.jet > 0) || (i === 3 && me.buf.glass > 0) || (i === 2 && me.buf.bar > 0))) { ctx.strokeStyle = STAT_COL[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 12, y, 20 + Math.sin(time * 10) * 2, 0, TAU); ctx.stroke(); }
    }
    // HP(大きく)
    const hp = clamp(me.hp, 0, 100), col = hp > 50 ? '#5fe36a' : hp > 25 ? '#ffd23f' : '#ff4d4d';
    txt(ctx, Math.ceil(hp) + '%', 270, y + 2, 30, col, 'left', 6);
    if (me.key) iconC(ctx, GFX.key, 370, y, 3);
    // レジェンドパーツ: 完成形のシルエットに集めた部位をはめて表示
    let px = 14;
    for (let k = 0; k < 3; k++) {
      if (!me.parts[k] || !V.legendOrder) continue; const li = LEGEND_IDS.indexOf(V.legendOrder[k]), up = GFX.legendUp[li], s = 3;
      ctx.globalAlpha = .25; ctx.drawImage(up, px, H - 160, up.width * s, up.height * s); ctx.globalAlpha = 1;
      for (let i = 0; i < 3; i++) if (me.parts[k] & (1 << i)) ctx.drawImage(GFX.legendPieces[li][i], px, H - 160, up.width * s, up.height * s);
      px += up.width * s + 10;
    }
  },
  // 右上: アイテム(大きく。アイコンが枠からはみ出す)
  drawItems(ctx, V, me, time) {
    const items = me.items || [];
    const slot = (i, cx, cy, s) => {
      ctx.fillStyle = 'rgba(12,12,36,.35)'; ctx.fillRect(cx - s / 2, cy - s / 2, s, s); ctx.strokeStyle = items[i] ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = 2; ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      const it = items[i]; if (!it) return;
      const img = GFX.itemUI[it.k], sc = s / img.width * 1.25 * (i === 0 ? 1 + Math.sin(time * 4) * .04 : 1);
      ctx.drawImage(img, cx - img.width * sc / 2, cy - img.height * sc / 2, img.width * sc, img.height * sc);
      if (it.k === 'sword') txt(ctx, '×' + it.n, cx + s / 2, cy + s / 2 - 4, 18, '#ffe14d', 'right', 4);
    };
    slot(0, W - 66, 62, 84); slot(1, W - 150, 42, 46);
    txt(ctx, 'X', W - 106, 100, 18, '#ffe14d', 'center', 4);
  },
  drawTV(ctx, V, me) {
    if (!me.tv || !V.evtList) return;
    const x = W - 180, y = 120, L = V.evtList;
    ctx.globalAlpha = .8; txt(ctx, '番組表', x, y, 13, RAR_COL.SR, 'left', 3);
    L.forEach((t, i) => { const done = i < (V.evtIdx || 0) - (V.evt.cur ? 1 : 0), cur = V.evt.cur && i === V.evtIdx - 1; txt(ctx, (cur ? '▶ ' : done ? '✓ ' : (i + 1) + '. ') + EVENT_DEFS[t].short, x, y + 18 + i * 16, 12, cur ? EVENT_DEFS[t].col : done ? '#666' : '#fff', 'left', 3); });
    ctx.globalAlpha = 1;
  },
  drawCenter(ctx, V, me, time) {
    // 開始カウントダウン(ど真ん中)
    if (V.phase === 'battle' && V.count > 0) {
      const n = Math.ceil(V.count - .5); const k = (V.count - .5) % 1;
      if (n >= 1) { ctx.save(); ctx.translate(W / 2, H / 2); const s = 1 + (1 - k) * .6; ctx.scale(s, s); txt(ctx, '' + n, 0, 0, 120, '#ffe14d', 'center', 10); ctx.restore(); }
      else txt(ctx, 'GO!', W / 2, H / 2, 120, '#ff4d6d', 'center', 10);
    } else if (V.phase === 'battle' && V.battleT < 1.2 && V.battleT > 0) { ctx.globalAlpha = 1 - V.battleT / 1.2; txt(ctx, 'GO!', W / 2, H / 2, 120 + V.battleT * 60, '#ff4d6d', 'center', 10); ctx.globalAlpha = 1; }
    // 残り10秒はど真ん中にカウント
    if ((V.phase === 'train' || (V.phase === 'battle' && V.count <= 0)) && V.t < 10 && V.t > 0) {
      const n = Math.ceil(V.t), k = V.t % 1; ctx.globalAlpha = .25 + k * .45; txt(ctx, '' + n, W / 2, H / 2, 140 + (1 - k) * 40, '#ff4d6d', 'center', 8); ctx.globalAlpha = 1;
      if (Math.ceil(V.t) !== this.lastCount) { this.lastCount = Math.ceil(V.t); Sound.play('count', 1); }
    }
    if (!me) return;
    if (me.dead > 0 && (V.phase === 'train' || V.phase === 'battle')) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H / 2 - 70, W, 140);
      skull(ctx, W / 2 - 120, H / 2, V.phase === 'battle' ? '+1' : '', 7, '#ff4d4d');
      txt(ctx, Math.ceil(me.dead) + '', W / 2 + 40, H / 2, 80, '#ffffff', 'center', 8);
      ctx.globalAlpha = .7; txt(ctx, V.phase === 'battle' ? '秒後に復活' : '秒後にミニノーマルで復活', W / 2 + 40, H / 2 + 52, 16, '#fff', 'center', 3); ctx.globalAlpha = 1;
    }
    if (me.arw && !me.out) {
      const t = me.arw.t, f = 1 - clamp(t / 5, 0, 1), y = H / 2 + 80;
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
      txt(ctx, t > 0 ? t.toFixed(1) : '!!', W / 2, y, 28, '#ffe14d', 'center', 5);
    }
  },
  // ど真ん中のカットイン
  drawBanners(ctx, time) {
    for (const s of this.sparks) { ctx.globalAlpha = 1 - s.t / s.life; const z = s.s || 4; ctx.fillStyle = s.col; ctx.fillRect(s.x - z / 2, s.y - z / 2, z, z); } ctx.globalAlpha = 1;
    for (const b of this.banners) {
      const t = b.t, L = b.life, inK = Math.min(1, t / .2), outK = t > L - .35 ? (L - t) / .35 : 1;
      const y = H / 2, h = b.big ? 140 : 76;
      ctx.save(); ctx.globalAlpha = Math.max(0, outK) * .95;
      const rh = h * inK; ctx.fillStyle = 'rgba(10,10,30,.72)'; ctx.fillRect(0, y - rh / 2, W, rh);
      ctx.fillStyle = b.col; ctx.fillRect(0, y - rh / 2, W, 5); ctx.fillRect(0, y + rh / 2 - 5, W, 5);
      if (b.big) { ctx.globalAlpha *= .25; ctx.fillStyle = b.col; for (let i = -2; i < 22; i++) { const sx = i * 52 + (t * 260) % 52; ctx.beginPath(); ctx.moveTo(sx, y - rh / 2 + 5); ctx.lineTo(sx + 22, y - rh / 2 + 5); ctx.lineTo(sx - 8, y + rh / 2 - 5); ctx.lineTo(sx - 30, y + rh / 2 - 5); ctx.fill(); } ctx.globalAlpha = Math.max(0, outK) * .95; }
      const slide = (1 - Math.min(1, t / .3)); const tx = W / 2 + slide * 500 - (t > L - .35 ? (1 - outK) * 400 : 0);
      const sc = b.big ? 1 + Math.max(0, .25 - t) * 2.4 : 1 + Math.max(0, .15 - t) * 2;
      ctx.translate(tx, y); ctx.scale(sc, sc);
      if (b.sub) txt(ctx, b.sub, 0, b.big ? -44 : -22, b.big ? 22 : 15, b.col, 'center', 4);
      if (b.big && t < .5) { ctx.globalAlpha *= (.5 - t) * 2; txt(ctx, b.txt, 0, 14, 72 * (1 + t * 1.5), b.col, 'center', 0); ctx.globalAlpha = Math.max(0, outK) * .95; }
      txt(ctx, b.txt, 0, b.big ? 14 : 8, b.big ? 72 : 40, '#ffffff', 'center', 9, '#0b0b18');
      ctx.restore();
    }
  },
  drawRoulette(ctx, V, time) {
    const R = V.rou; if (!R) return;
    ctx.fillStyle = 'rgba(6,6,20,.86)'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const sx = (i * 97 + time * (50 + i % 5 * 30)) % W, sy = (i * 53) % H; ctx.fillStyle = i % 3 ? '#ffffff60' : '#ffe14d80'; ctx.fillRect(sx, sy, 2, 2); }
    txt(ctx, 'STAGE ROULETTE', W / 2, 70, 40, '#ffe14d', 'center', 6);
    const N = ARENAS.length, total = N * 5 + R.sel, spinT = 3.4;
    const k = Math.min(1, R.t / spinT), e = 1 - Math.pow(1 - k, 3), pos = e * total;
    const cur = Math.round(pos) % N; if (cur !== this.lastRou && k < 1) { Sound.play('roulette', 1); this.lastRou = cur; }
    const cy = H / 2, stopped = R.t >= spinT;
    for (let i = -2; i <= 2; i++) {
      if (stopped && i) continue;
      const idx = ((Math.round(pos) + i) % N + N) % N, off = (Math.round(pos) - pos + i) * 64, A = ARENAS[idx];
      const a = 1 - Math.abs(off) / 160; if (a <= 0) continue; ctx.globalAlpha = a;
      const isSel = i === 0;
      panel(ctx, W / 2 - 230, cy + off - 26, 460, 52, isSel ? 'rgba(40,30,80,.95)' : 'rgba(20,20,50,.8)', isSel ? A.col : '#3a3a6a');
      txt(ctx, A.name, W / 2, cy + off, isSel ? 30 : 22, isSel ? A.col : '#aaa', 'center', 4);
    }
    ctx.globalAlpha = 1;
    if (stopped) {
      const A = ARENAS[R.sel], f = Math.min(1, (R.t - spinT) / .3);
      if (this.lastRou !== 'done') { this.lastRou = 'done'; Sound.play('chest', 1); FX.flash = .3; FX.flashCol = A.col; }
      ctx.strokeStyle = A.col; ctx.lineWidth = 4; ctx.strokeRect(W / 2 - 240 - f * 10, cy - 32 - f * 6, 480 + f * 20, 64 + f * 12);
      txt(ctx, A.desc, W / 2, cy + 70, 18, '#fff', 'center', 3);
      txt(ctx, '何度でも復活! デスが一番少ない人の勝ち!', W / 2, cy + 108, 18, '#ffe14d', 'center', 4);
    }
  },

  // ============================================================
  //  リザルト: 下から2番目の人から順に発表 → 最後に1位と最下位を同時発表
  // ============================================================
  drawResult(ctx, V, time) {
    const R = V.result; if (!R) return;
    if (this.resStart === null) this.resStart = time;
    const T = time - this.resStart, n = R.length;
    const intro = 1.6, step = clamp(7 / Math.max(1, n - 2), .22, .8), mids = Math.max(0, n - 2), finalT = intro + mids * step + 1.8;
    // 演出の段階が進んだら音を鳴らす
    const stepNow = T < intro ? -1 : T < intro + mids * step ? Math.floor((T - intro) / step) : T < finalT ? mids : mids + 1;
    if (stepNow !== this.resStep) {
      if (stepNow >= 0 && stepNow < mids) Sound.combo(Math.min(20, stepNow));
      if (stepNow === mids && mids >= 0) { for (let i = 0; i < 12; i++) setTimeout(() => Sound.play('hit', 1), i * 120); }
      if (stepNow === mids + 1) { Sound.play('win', 1); Sound.play('bigboom', 1); FX.flash = .6; FX.flashCol = '#ffffff'; Music.play('result'); }
      this.resStep = stepNow;
    }
    // 背景: 回る光線 + 左右から振れるスポットライト
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0a3a'); bg.addColorStop(1, '#07071a'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    rays(ctx, 280, H / 2, 0, 1100, 22, '#5a3aaa', time * .25, .35);
    for (const [sx, ph] of [[80, 0], [480, 2]]) { const a = Math.PI / 2 + Math.sin(time * 1.3 + ph) * .5; ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(sx, -10); ctx.lineTo(sx + Math.cos(a - .18) * 700, -10 + Math.sin(a - .18) * 700); ctx.lineTo(sx + Math.cos(a + .18) * 700, -10 + Math.sin(a + .18) * 700); ctx.fill(); ctx.restore(); }
    // 発表済みリスト(右側: 下の順位から積み上がる)
    const revealed = [];
    for (let i = 0; i < mids; i++) if (T >= intro + i * step) revealed.push(n - 2 - i); // 順位インデックス(0 が 1位)
    const fin = T >= finalT;
    const rowH = 34, x0 = 560, listN = Math.min(revealed.length, 13), base = H - 30;
    for (let j = 0; j < listN; j++) {
      const ri = revealed[revealed.length - 1 - j], r = R[ri], p = V.players[r[0]], y = base - (j + (fin ? 1 : 0)) * rowH - 16;
      const age = T - (intro + (n - 2 - ri) * step), sl = Math.max(0, 1 - age / .22) ** 2 * 400, mine = r[0] === Render.meId;
      ctx.globalAlpha = Math.min(1, age / .12);
      ctx.fillStyle = mine ? 'rgba(255,225,77,.3)' : 'rgba(255,255,255,.08)'; ctx.fillRect(x0 + sl, y - 15, 390, 30);
      ctx.fillStyle = p ? PLAYER_COLS[p.col] : '#fff'; ctx.fillRect(x0 + sl, y - 15, 5, 30);
      if (age < .3) { ctx.fillStyle = `rgba(255,255,255,${.6 * (1 - age / .3)})`; ctx.fillRect(x0 + sl, y - 15, 390, 30); }
      txt(ctx, r[1] + '位', x0 + 14 + sl, y, 20, '#fff', 'left', 4);
      txt(ctx, (p ? p.name : '?') + (mine ? ' (YOU)' : ''), x0 + 80 + sl, y, 20, p ? PLAYER_COLS[p.col] : '#fff', 'left', 4);
      skull(ctx, x0 + 320 + sl, y - 2, r[5], 1.9); txt(ctx, '撃破' + r[2], x0 + 344 + sl, y, 12, '#ccc', 'left', 3);
    }
    ctx.globalAlpha = 1;
    if (!fin) {
      // いま発表された人を大写し
      const last = revealed[revealed.length - 1];
      if (last !== undefined && stepNow < mids) {
        const r = R[last], p = V.players[r[0]], age = T - (intro + (n - 2 - last) * step), s = age < .15 ? .4 + age / .15 * .8 : 1.2 - Math.min(.2, (age - .15));
        ctx.save(); ctx.translate(280, H / 2 - 10); ctx.scale(s, s);
        rays(ctx, 0, 0, 30, 220, 14, p ? PLAYER_COLS[p.col] : '#fff', time, .3);
        ctx.save(); ctx.rotate(-Math.PI / 2); const img = GFX.machine[r[4]], sc = 6; ctx.drawImage(img, -img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc); ctx.restore();
        txt(ctx, r[1] + '位', 0, -100, 40, '#ffffff', 'center', 7); txt(ctx, p ? p.name : '', 0, 90, 40, p ? PLAYER_COLS[p.col] : '#fff', 'center', 8);
        ctx.restore();
      } else {
        // ドラムロール中
        const big = stepNow >= mids, s = 1 + Math.sin(time * (big ? 16 : 6)) * (big ? .08 : .04) + (big ? (T - (intro + mids * step)) * .15 : 0);
        if (big) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) { const a = time * 7 + i * TAU / 6; ctx.fillStyle = PAL[RAINBOW[i]]; ctx.beginPath(); ctx.arc(280 + Math.cos(a) * 190, H / 2 + Math.sin(a) * 80, 8, 0, TAU); ctx.fill(); } }
        ctx.save(); ctx.translate(280, H / 2); ctx.scale(s, s); txt(ctx, T < intro ? '結果発表!' : '1位と最下位は…!?', 0, 0, T < intro ? 72 : 44, '#ffe14d', 'center', 10); ctx.restore();
      }
      return;
    }
    // ---- フィナーレ: 1位(大きく)と最下位(しょんぼり)を同時に ----
    const fk = T - finalT, pop = fk < .3 ? .3 + fk / .3 * .9 : fk < .45 ? 1.2 - (fk - .3) * 1.3 : 1;
    const W1 = R[0], P1 = V.players[W1[0]], L1 = R[n - 1], PL = V.players[L1[0]];
    // 1位
    ctx.save(); ctx.translate(280, 250); ctx.scale(pop, pop);
    rays(ctx, 0, 0, 40, 330, 18, '#ffe14d', time, .45);
    const gr = ctx.createRadialGradient(0, 0, 10, 0, 0, 200); gr.addColorStop(0, 'rgba(255,225,77,.5)'); gr.addColorStop(1, 'rgba(255,225,77,0)'); ctx.fillStyle = gr; ctx.fillRect(-200, -200, 400, 400);
    iconC(ctx, GFX.crown, 0, -118, 6);
    ctx.save(); ctx.rotate(-Math.PI / 2 + Math.sin(time * 3) * .12); const img = GFX.machine[W1[4]], s = 8; ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); ctx.restore();
    txt(ctx, 'WINNER', 0, 92, 28, '#ffe14d', 'center', 6);
    txt(ctx, P1 ? P1.name : '', 0, 136, 46, P1 ? PLAYER_COLS[P1.col] : '#fff', 'center', 9, '#ffffff');
    skull(ctx, -40, 182, W1[5], 2.4); txt(ctx, '撃破 ' + W1[2], 20, 182, 18, '#fff', 'left', 4);
    ctx.restore();
    // 最下位
    if (n > 1) {
      const lx = 750, ly = 110 + (fin ? 0 : 0); ctx.save(); ctx.translate(lx, ly); ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(40,40,70,.7)'; ctx.fillRect(-170, -70, 340, 140);
      ctx.fillStyle = '#5a5a7a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-40 + i * 40, -78, 26, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#8ad0ff'; for (let i = 0; i < 10; i++) { const rx = -80 + i * 18, ry = -50 + ((time * 120 + i * 37) % 70); ctx.fillRect(rx, ry, 2, 8); }
      const img2 = GFX.machine[L1[4]]; ctx.save(); ctx.translate(-110, 10); ctx.rotate(Math.PI / 2 + .3); ctx.globalAlpha = .8; ctx.drawImage(img2, -img2.width * 2.5, -img2.height * 2.5, img2.width * 5, img2.height * 5); ctx.restore();
      txt(ctx, '最下位…', 30, -26, 22, '#8a8ab0', 'center', 4); txt(ctx, PL ? PL.name : '', 30, 10, 28, PL ? PLAYER_COLS[PL.col] : '#fff', 'center', 5); skull(ctx, 30, 48, L1[5], 1.8);
      ctx.restore();
    }
    // 紙吹雪・花火
    for (let i = 0; i < 90; i++) { const x = (i * 131 + Math.sin(time + i) * 40) % 520, y = (fk * (90 + i % 7 * 30) + i * 41) % H; ctx.fillStyle = ['#ff4d6d', '#ffe14d', '#4dc3ff', '#5fe36a', '#c86bff', '#ffffff'][i % 6]; ctx.save(); ctx.translate(x + 20, y); ctx.rotate(time * 3 + i); ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    if (fk < 4 && Math.floor(fk * 3) !== Math.floor((fk - .016) * 3)) { const fx = rnd(80, 480), fy = rnd(60, 300); this.fireworks = this.fireworks || []; this.fireworks.push({ x: fx, y: fy, t: 0, col: pick(['#ff4d6d', '#ffe14d', '#4dc3ff', '#5fe36a', '#c86bff']) }); Sound.play('boom', .4); }
    if (this.fireworks) { for (const f of this.fireworks) { f.t += 1 / 60; const r = f.t * 160; ctx.globalAlpha = Math.max(0, 1 - f.t / 1.2); ctx.fillStyle = f.col; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; ctx.fillRect(f.x + Math.cos(a) * r - 2, f.y + Math.sin(a) * r + f.t * f.t * 40 - 2, 4, 4); } } this.fireworks = this.fireworks.filter(f => f.t < 1.2); ctx.globalAlpha = 1; }
    const blink = Math.floor(time * 2) % 2;
    this.resultDone = fk > 1.5;
    if (blink && fk > 1.5) txt(ctx, Net.role === 'client' ? 'ホストの操作を待っています…' : 'Z: タイトルへ戻る', W / 2, H - 16, 16, '#fff', 'center', 3);
  },
};
