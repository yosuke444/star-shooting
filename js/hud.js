'use strict';
// ============================================================
//  HUD / 演出 (メインキャンバス 960x540 にくっきり描画)
// ============================================================
function txt(ctx, s, x, y, size, col = '#fff', align = 'left', stroke = 4, sc = '#0b0b18') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = sc; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function panel(ctx, x, y, w, h, col = 'rgba(12,12,36,.78)', border = '#5a5a9a') {
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = '#ffffff30'; ctx.fillRect(x + 2, y + 2, w - 4, 1);
}
function icon(ctx, img, x, y, s = 2) { ctx.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s); }
function wrapText(ctx, s, maxW, size) {
  ctx.font = `${size}px ${FONT}`; const out = []; let line = '';
  for (const ch of s) { if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; }
  if (line) out.push(line); return out;
}

// バトルの順位: デスが少ない順 → 撃破が多い順
function battleRank(V) { return V.players.slice().sort((a, b) => ((a.deaths || 0) - (b.deaths || 0)) || ((b.bk || 0) - (a.bk || 0)) || (a.id - b.id)); }
const UI = {
  banners: [], feed: [], floats: [], prevEvt: null, prevPhase: null, sparks: [],
  reset() { this.popQ = []; this.pops = []; this.dmgs = []; this.killPop = null; this.combo = 0; this.banners = []; this.feed = []; this.floats = []; this.prevEvt = null; this.prevPhase = null; this.sparks = []; this.lastRou = -1; },
  banner(txt, sub, col, big = true, life = 3) { this.banners = []; this.banners.push({ txt, sub, col, big, t: 0, life }); for (let i = 0; i < (big ? 120 : 30); i++) { const a = Math.random() * TAU, s = rnd(100, big ? 600 : 300); this.sparks.push({ x: W / 2 + rnd(-200, 200), y: (big ? 150 : 125) + rnd(-30, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, t: 0, life: rnd(.6, 1.6), col: pick(['#fff', '#ffe14d', col, col]), s: rnd(3, 7) }); } },
  addFeed(s, col = '#fff', mine = false) { this.feed.unshift({ s, col, t: 0, mine }); if (this.feed.length > 6) this.feed.pop(); },
  name(V, id) { const p = V.players[id]; return p ? p.name : '???'; },

  // 状態の変化から演出を出す(ホスト・クライアント共通)
  watch(V) {
    const c = V.evt && V.evt.cur, key = c ? c.type + '@' + Math.round(c.st || 0) : null;
    if (key !== this.prevEvt) {
      if (this.prevEvt) { const t = this.prevEvt.split('@')[0]; this.banner(EVENT_DEFS[t].short + ' 終了!', 'EVENT CLEAR', EVENT_DEFS[t].col, false, 2.2); Sound.play('eventEnd', 1); }
      if (c) { const D = EVENT_DEFS[c.type]; this.banner(D.name, c.type === 'rush' && c.region !== undefined ? REGION_NAME[c.region] + 'エリアで発生!' : 'EVENT!', D.col, true, 3.2); FX.flash = .15; FX.flashCol = D.col; }
      this.prevEvt = key;
    }
    if (V.phase !== this.prevPhase) {
      if (V.phase === 'roulette') { this.banner('トレーニング終了!', 'TIME UP', '#ff4d6d', true, 2); Sound.play('go', 1); }
      if (V.phase === 'battle') { this.banner(ARENAS[V.arena].name, 'BATTLE STAGE', ARENAS[V.arena].col, false, 3.5); Music.play('battle'); Render.cam.snap = true; }
      if (V.phase === 'result') Music.play('result');
      this.prevPhase = V.phase;
    }
  },
  onGfx(a, V) {
    const me = Render.meId;
    switch (a[0]) {
      case 'kill': {
        const [, k, v] = a; const mine = k === me || v === me;
        if (k >= 0) this.addFeed(this.name(V, k) + ' ▶ ' + this.name(V, v), PLAYER_COLS[V.players[k]?.col ?? 0], mine);
        else this.addFeed(this.name(V, v) + ' が力尽きた', '#aaa', mine);
        if (k === me) { Sound.play('kill', 1); this.killPop = { t: 0, name: this.name(V, v) }; FX.stop(.12); FX.kick(.12); }
        break;
      }
      case 'legend': this.banner(this.name(V, a[1]) + ' が ' + MACHINES[a[2]].name + ' に!', 'LEGENDARY MACHINE', MACHINES[a[2]].col, true, 3.2); break;
      case 'bossDown': this.banner('ギガベヒモス撃破!', a[1] >= 0 ? 'ラストアタック: ' + this.name(V, a[1]) : 'DEFEATED', '#c86bff', true, 3); break;
      case 'fishDown': this.banner('レインボーフィッシュ撃破!', a[1] >= 0 ? 'ラストアタック: ' + this.name(V, a[1]) : '', '#ff7ad9', true, 3); break;
      case 'key': this.addFeed(this.name(V, a[1]) + ' が鍵をゲット', '#ffe14d', a[1] === me); break;
      case 'unlock': this.addFeed(this.name(V, a[1]) + ' が鍵付き宝箱をオープン!', '#ffe14d', a[1] === me); break;
      case 'arrow': if (a[1] !== me) { this.addFeed('!! ' + this.name(V, a[1]) + ' がビッグアローをチャージ中 !!', '#ff4d4d', false); Sound.play('warn', .8); } break;
      case 'timeup': this.banner('タイムアップ!', 'TIME UP', '#ff4d6d', true, 2.5); Sound.play('go', 1); break;
      case 'winner': this.banner(this.name(V, a[1]) + ' の優勝!', 'WINNER', '#ffe14d', true, 2.6); Sound.play('win', 1); break;
    }
  },
  addNotes(notes) { for (const [s, col, ic] of notes) { if (ic) { this.popQ.push({ s, col, ic }); continue; } this.floats.push({ s, col, t: 0 }); if (this.floats.length > 6) this.floats.shift(); } },
  // 取得ポップ(連続で取ると音階が上がる)
  popQ: [], pops: [], combo: 0, comboT: 0, popT: 0, dmgs: [], killPop: null,
  dmgNum(x, y, v, col, big) { this.dmgs.push({ x: x + rnd(-6, 6), y, v: Math.round(v), col, big, t: 0 }); if (this.dmgs.length > 40) this.dmgs.shift(); },
  popIcon(V, ic) { const c = ic[0], r = ic.slice(1); if (c === 's') return GFX.patchBig[+r]; if (c === 'k') return GFX.key; if (c === 'p') return partImg(V, +r); return GFX.itemUI[r] || GFX.itemUI.tv; },
  update(dt) {
    this.popT -= dt; this.comboT -= dt;
    if (this.popQ.length && this.popT <= 0) {
      const p = this.popQ.shift(); this.combo = this.comboT > 0 ? this.combo + 1 : 0; this.comboT = .9; p.t = 0; p.n = this.combo; this.pops.push(p); if (this.pops.length > 5) this.pops.shift();
      Sound.combo(this.combo); this.popT = .065;
    }
    for (const p of this.pops) p.t += dt; this.pops = this.pops.filter(p => p.t < 1);
    for (const d of this.dmgs) d.t += dt; this.dmgs = this.dmgs.filter(d => d.t < .8);
    if (this.killPop) { this.killPop.t += dt; if (this.killPop.t > 1.4) this.killPop = null; }
    for (const b of this.banners) b.t += dt; this.banners = this.banners.filter(b => b.t < b.life);
    for (const f of this.feed) f.t += dt; this.feed = this.feed.filter(f => f.t < 7);
    for (const f of this.floats) f.t += dt; this.floats = this.floats.filter(f => f.t < 1.8);
    for (const s of this.sparks) { s.t += dt; s.vy += 300 * dt; s.x += s.vx * dt; s.y += s.vy * dt; } this.sparks = this.sparks.filter(s => s.t < s.life);
  },

  // ------------------------------------------------------------
  draw(ctx, V, time) {
    const me = V.players[Render.meId];
    if (V.phase === 'roulette') { this.drawRoulette(ctx, V, time); this.drawBanners(ctx, time); return; }
    if (V.phase === 'result') { this.drawResult(ctx, V, time); return; }
    this.drawSpeedLines(ctx, V, time);
    this.drawTags(ctx, V, time);
    this.drawMarkers(ctx, V, time);
    this.drawDmgs(ctx);
    this.drawFloats(ctx, V);
    this.drawPops(ctx, V, time);
    // 画面フラッシュ / 被弾
    if (FX.hurt > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,30,30,${FX.hurt})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    this.drawEdgeGlow(ctx, time);
    if (FX.flash > 0) { ctx.globalAlpha = Math.min(.6, FX.flash); ctx.fillStyle = FX.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // HUD は全体的に大きく(角を基準に拡大)
    const S = (ax, ay, s, fn) => { ctx.save(); ctx.translate(ax, ay); ctx.scale(s, s); ctx.translate(-ax, -ay); fn(); ctx.restore(); };
    S(0, 0, 1.3, () => this.drawTopLeft(ctx, V, time));
    S(W, 0, 1.2, () => { this.drawMinimap(ctx, V, time); this.drawEventPanel(ctx, V, time); if (V.phase === 'battle') this.drawBoard(ctx, V, time); });
    this.drawBossBar(ctx, V, time);
    if (me) { S(0, H, 1.3, () => this.drawMachinePanel(ctx, V, me, time)); S(W, H, 1.3, () => { if (Touch.on) ctx.translate(-200, 0); this.drawItems(ctx, V, me, time); }); /* スマホは Z/X ボタンと重ならない位置へ */ S(0, 0, 1.2, () => this.drawTV(ctx, V, me)); }
    S(0, 0, 1.2, () => this.drawFeed(ctx));
    this.drawCenter(ctx, V, me, time);
    this.drawKillPop(ctx, time);
    this.drawBanners(ctx, time);
  },
  // イベント発生時、画面のふちをイベント色で光らせる(中央は邪魔しない)
  drawEdgeGlow(ctx, time) {
    const b = this.banners.find(b => b.big && b.t < 2.6); if (!b) return;
    const a = (1 - b.t / 2.6) * (.55 + Math.sin(time * 14) * .15), e = 70, [r, g, bl] = hexRGB(b.col);
    const c0 = `rgba(${r},${g},${bl},${a})`, c1 = `rgba(${r},${g},${bl},0)`;
    const grad = (x0, y0, x1, y1) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
    ctx.fillStyle = grad(0, 0, 0, e); ctx.fillRect(0, 0, W, e); ctx.fillStyle = grad(0, H, 0, H - e); ctx.fillRect(0, H - e, W, e);
    ctx.fillStyle = grad(0, 0, e, 0); ctx.fillRect(0, 0, e, H); ctx.fillStyle = grad(W, 0, W - e, 0); ctx.fillRect(W - e, 0, e, H);
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
  drawPops(ctx, V, time) {
    const n = this.pops.length; if (!n) return;
    this.pops.forEach((p, i) => {
      const newest = i === n - 1, age = n - 1 - i, k = p.t;
      const pop = k < .12 ? .4 + k / .12 * .9 : k < .22 ? 1.3 - (k - .12) * 3 : 1; // ぼよん
      const s = (newest ? 1 : .62 - age * .06) * pop, y = H / 2 - 120 - age * 46 - k * 14, x = W / 2;
      ctx.globalAlpha = k > .75 ? (1 - k) / .25 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      if (newest) { ctx.globalAlpha *= .5; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(-110, 0, 40 + Math.sin(time * 20) * 4, 0, TAU); ctx.fill(); ctx.globalAlpha = k > .75 ? (1 - k) / .25 : 1; }
      const img = this.popIcon(V, p.ic), sc = 5; ctx.drawImage(img, -110 - img.width * sc / 2, -img.height * sc / 2, img.width * sc, img.height * sc);
      txt(ctx, p.s, -70, 0, 34, p.col, 'left', 7);
      if (p.n >= 1) { ctx.font = `34px ${FONT}`; const tw = ctx.measureText(p.s).width; txt(ctx, '×' + (p.n + 1), -70 + tw + 36, -4, 26 + Math.min(20, p.n * 2), p.n >= 8 ? PAL[RAINBOW[Math.floor(time * 20) % 8]] : '#ffe14d', 'center', 5); }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  },
  drawKillPop(ctx, time) {
    const K = this.killPop; if (!K) return;
    const t = K.t, s = t < .15 ? 2.6 - t / .15 * 1.6 : 1; ctx.globalAlpha = t > 1.1 ? (1.4 - t) / .3 : 1;
    ctx.save(); ctx.translate(W / 2, H / 2 + 70); ctx.rotate(-.06); ctx.scale(s, s);
    txt(ctx, '撃破!!', 0, 0, 64, '#ff4d6d', 'center', 10); txt(ctx, K.name, 0, 46, 22, '#ffffff', 'center', 5);
    ctx.restore(); ctx.globalAlpha = 1;
  },

  // バトル中の順位表(デスが少ない順)
  drawBoard(ctx, V, time) {
    const R = battleRank(V), me = V.players[Render.meId], x = W - 196, y = 196, w = 186, show = R.slice(0, 4);
    if (me && !show.includes(me)) show.push(me);
    panel(ctx, x, y, w, 28 + show.length * 18, 'rgba(12,12,36,.8)', '#ff7ad9');
    txt(ctx, 'デスが少ない人の勝ち', x + 8, y + 14, 12, '#ff7ad9', 'left', 0);
    show.forEach((p, i) => { const yy = y + 32 + i * 18, mine = p === me; if (mine) { ctx.fillStyle = 'rgba(255,225,77,.18)'; ctx.fillRect(x + 3, yy - 9, w - 6, 18); } txt(ctx, (R.indexOf(p) + 1) + '. ' + p.name, x + 8, yy, 13, PLAYER_COLS[p.col], 'left', 3); txt(ctx, 'D' + (p.deaths || 0), x + w - 8, yy, 13, '#fff', 'right', 3); });
  },

  drawTags(ctx, V, time) {
    const me = V.players[Render.meId];
    for (const p of V.players) {
      if (p.out || !Render.onScreen(p.x, p.y)) continue;
      const x = Render.sx(p.x), y = Render.sy(p.y) - 34 * Render.cam.zoom;
      if (p.dead > 0) { if (V.phase === 'train') txt(ctx, Math.ceil(p.dead) + '', x, y + 20, 16, '#aaa', 'center', 3); continue; }
      if (p.id === Render.meId) { const b = Math.sin(time * 6) * 3; ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(x - 7, y - 6 + b); ctx.lineTo(x + 7, y - 6 + b); ctx.lineTo(x, y + 3 + b); ctx.fill(); ctx.strokeStyle = '#0b0b18'; ctx.lineWidth = 2; ctx.stroke(); continue; }
      txt(ctx, p.name + (V.phase === 'battle' ? '  D' + (p.deaths || 0) : ''), x, y - 8, 16, PLAYER_COLS[p.col], 'center', 4);
      const bw = 44; ctx.fillStyle = '#0b0b18'; ctx.fillRect(x - bw / 2 - 1, y + 2, bw + 2, 6); ctx.fillStyle = p.hp > 50 ? '#5fe36a' : p.hp > 25 ? '#ffd23f' : '#ff4d4d'; ctx.fillRect(x - bw / 2, y + 3, bw * clamp(p.hp / 100, 0, 1), 4);
    }
    // 乗り換えガイド
    if (me && !me.out && me.dead <= 0 && V.phase === 'train') {
      let best = null, bd = 60 * 60;
      for (const m of V.machines) { const d = d2(m.x, m.y, me.x, me.y); if (d < bd) { bd = d; best = m; } }
      for (const w of V.wilds) if (w.stun > 0) { const d = d2(w.x, w.y, me.x, me.y); if (d < bd) { bd = d; best = w; } }
      if (best) {
        const M = MACHINES[best.m], x = Render.sx(best.x), y = Render.sy(best.y) - 34; const near = bd < 22 * 22;
        txt(ctx, M.name, x, y - 14, 14, M.legend ? '#ffe14d' : M.col, 'center', 3);
        txt(ctx, M.desc, x, y + 2, 11, '#ddd', 'center', 3);
        if (near) { const s = 1 + Math.sin(time * 10) * .08; ctx.save(); ctx.translate(x, y - 34); ctx.scale(s, s); panel(ctx, -48, -13, 96, 26, '#ffe14d', '#0b0b18'); txt(ctx, 'X で乗る!', 0, 0, 15, '#0b0b18', 'center', 0); ctx.restore(); }
      }
      // 鍵付き宝箱ガイド
      if (me.key) for (const c of V.chests) if (c.type === 'L' && Render.onScreen(c.x, c.y)) txt(ctx, '触れて開ける!', Render.sx(c.x), Render.sy(c.y) - 44, 13, '#ffe14d', 'center', 3);
    }
    for (const w of V.wilds) if (w.stun > 0 && Render.onScreen(w.x, w.y)) txt(ctx, 'スタン中! 乗れる!', Render.sx(w.x), Render.sy(w.y) + 26, 12, '#ffe14d', 'center', 3);
    for (const m of V.meteors) if (m.big && Render.onScreen(m.x, m.y, 200)) { const r = Math.max(0, m.fall - m.t); txt(ctx, '超巨大隕石 ' + r.toFixed(1), Render.sx(m.x), Render.sy(m.y), 28, '#ff4d4d', 'center', 5); }
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
      if (!i) { const dist = Math.round(Math.sqrt(d2(m[0], m[1], cam.x, cam.y)) / 10); txt(ctx, dist + 'm', ax - Math.cos(a) * 30, ay - Math.sin(a) * 30, 13, D.col, 'center', 3); }
    });
  },
  drawFloats(ctx, V) {
    const me = V.players[Render.meId]; if (!me) return;
    const x = Render.sx(me.x), y = Render.sy(me.y) - 50;
    this.floats.forEach((f, i) => { const k = f.t / 1.8; ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1; txt(ctx, f.s, x, y - (this.floats.length - 1 - i) * 24 - f.t * 22, 20, f.col, 'center', 5); });
    ctx.globalAlpha = 1;
  },

  drawTopLeft(ctx, V, time) {
    panel(ctx, 10, 10, 210, 70);
    if (V.phase === 'train') {
      txt(ctx, 'TRAINING', 22, 26, 14, '#8ad0ff');
      const urgent = V.t < 10 && Math.floor(time * 4) % 2;
      txt(ctx, fmtTime(V.t), 22, 56, 34, urgent ? '#ff4d4d' : '#ffffff');
      const total = V.evtN || 0, done = V.evtIdx || 0;
      txt(ctx, 'EVENT ' + done + '/' + total, 210, 26, 13, '#ffe14d', 'right');
    } else if (V.phase === 'battle') {
      txt(ctx, 'BATTLE', 22, 26, 14, '#ff7ad9');
      const urgent = V.t < 10 && Math.floor(time * 4) % 2;
      txt(ctx, fmtTime(V.t), 22, 56, 34, urgent ? '#ff4d4d' : '#ffffff');
      const me = V.players[Render.meId];
      if (me) { const rank = battleRank(V).indexOf(me) + 1; txt(ctx, rank + '位', 210, 30, 18, '#ffe14d', 'right', 3); txt(ctx, 'デス ' + (me.deaths || 0), 210, 58, 18, '#ff9b9b', 'right', 3); }
    }
  },
  drawFeed(ctx) {
    let y = 96;
    for (const f of this.feed) {
      ctx.globalAlpha = f.t > 6 ? 7 - f.t : 1;
      ctx.font = `14px ${FONT}`; const w = ctx.measureText(f.s).width + 16;
      ctx.fillStyle = f.mine ? 'rgba(80,60,0,.7)' : 'rgba(10,10,30,.6)'; ctx.fillRect(10, y - 11, w, 22);
      txt(ctx, f.s, 18, y, 14, f.col, 'left', 3); y += 25;
    }
    ctx.globalAlpha = 1;
  },
  drawMinimap(ctx, V, time) {
    const S = 176, x0 = W - S - 10, y0 = 10, M = V.map; if (!M.mini) return;
    panel(ctx, x0 - 4, y0 - 4, S + 8, S + 8, 'rgba(8,8,24,.85)', '#8a8ad0');
    const sc = Math.min(S / M.w, S / M.h), ox = x0 + (S - M.w * sc) / 2, oy = y0 + (S - M.h * sc) / 2;
    ctx.globalAlpha = .9; ctx.drawImage(M.mini, ox, oy, M.w * sc, M.h * sc); ctx.globalAlpha = 1;
    const P = (x, y) => [ox + x * sc, oy + y * sc];
    const dot = (x, y, s, col, outline) => { const [a, b] = P(x, y); if (outline) { ctx.fillStyle = '#0b0b18'; ctx.fillRect(Math.round(a - s / 2) - 1, Math.round(b - s / 2) - 1, s + 2, s + 2); } ctx.fillStyle = col; ctx.fillRect(Math.round(a - s / 2), Math.round(b - s / 2), s, s); };
    if (M.bnd) { const [a, b] = P(M.bnd.x0, M.bnd.y0), [c, d] = P(M.bnd.x1, M.bnd.y1); ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 2; ctx.strokeRect(a, b, c - a, d - b); }
    if (V.zone && V.phase === 'battle') { const [a, b] = P(V.zone.x, V.zone.y); ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, Math.max(1, V.zone.r * sc), 0, TAU); ctx.stroke(); }
    const ev = V.evt && V.evt.cur;
    if (ev && ev.type === 'rush' && ev.region !== undefined) { const rx = ev.region % 3, ry = Math.floor(ev.region / 3); const [a, b] = P(M.w * rx / 3, M.h * ry / 3); ctx.fillStyle = `rgba(255,60,60,${.25 + Math.sin(time * 6) * .1})`; ctx.fillRect(a, b, M.w / 3 * sc, M.h / 3 * sc); }
    for (const m of V.machines) dot(m.x, m.y, 3, MACHINES[m.m].col);
    for (const c of V.chests) {
      const s = { B: 3, A: 5, G: 3, O: 6, L: 6, I: 4 }[c.type], col = { B: '#c08a4a', A: '#ff4d4d', G: '#ffcc33', O: PAL[RAINBOW[Math.floor(time * 8) % 8]], L: '#ff3dd8', I: '#4da6ff' }[c.type];
      dot(c.x, c.y, s, col, c.type !== 'G' && c.type !== 'B');
    }
    for (const k of V.pickups) if (isPart(k.k) || k.k === PK_KEY) dot(k.x, k.y, 5, k.k === PK_KEY ? '#ffe14d' : '#ffffff', true);
    for (const w of V.wilds) dot(w.x, w.y, w.legend ? 6 : 3, w.legend ? PAL[RAINBOW[Math.floor(time * 10) % 8]] : '#3dffe0', w.legend);
    for (const wp of V.warps) { dot(wp.x, wp.y, 4, '#c86bff', true); dot(wp.x2, wp.y2, 4, '#c86bff', true); }
    for (const b of V.balls) dot(b.x, b.y, 4, '#ff9b3d', true);
    for (const m of V.meteors) if (m.big) { const [a, b] = P(m.x, m.y); ctx.strokeStyle = Math.floor(time * 8) % 2 ? '#ff2d2d' : '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, m.r * sc, 0, TAU); ctx.stroke(); }
    if (V.boss) dot(V.boss.x, V.boss.y, 9, '#c86bff', true);
    if (V.fish) dot(V.fish.x, V.fish.y, 9, PAL[RAINBOW[Math.floor(time * 10) % 8]], true);
    if (ev && ev.marks) for (const m of ev.marks) { const [a, b] = P(m[0], m[1]); ctx.strokeStyle = EVENT_DEFS[ev.type].col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a, b, 5 + (time * 10) % 6, 0, TAU); ctx.stroke(); }
    // ビッグアローの射線
    for (const p of V.players) if (p.arw && !p.out) { const [a, b] = P(p.x, p.y); ctx.strokeStyle = 'rgba(255,45,45,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a + Math.cos(p.arw.a) * 400, b + Math.sin(p.arw.a) * 400); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
    for (const p of V.players) {
      if (p.out || p.id === Render.meId) continue;
      dot(p.x, p.y, p.dead > 0 ? 3 : 4, p.dead > 0 ? '#666' : PLAYER_COLS[p.col], true);
      if (partsN(p) > 0 || p.key) { const [a, b] = P(p.x, p.y); txt(ctx, p.key ? '鍵' : 'P' + partsN(p), a, b - 9, 10, p.key ? '#ffe14d' : '#fff', 'center', 3); }
    }
    ctx.restore();
    const me = V.players[Render.meId];
    if (me && !me.out) {
      const [a, b] = P(me.x, me.y); ctx.save(); ctx.translate(a, b); ctx.rotate(me.a);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0b0b18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-3, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
      const cam = Render.cam, hw = LW / 2 / cam.zoom, hh = LH / 2 / cam.zoom; const [c1, d1] = P(cam.x - hw, cam.y - hh); ctx.strokeStyle = '#ffffff60'; ctx.lineWidth = 1; ctx.strokeRect(c1, d1, hw * 2 * sc, hh * 2 * sc);
    }
  },
  drawEventPanel(ctx, V, time) {
    const c = V.evt && V.evt.cur; if (!c) return;
    const D = EVENT_DEFS[c.type], x = W - 196, y = 200, w = 186;
    let desc = D.desc; if (c.type === 'rush' && c.region !== undefined) desc = REGION_NAME[c.region] + 'エリアに雑魚敵が大量発生! 倒してステータスを稼げ!';
    const lines = wrapText(ctx, desc, w - 16, 12);
    const h = 52 + lines.length * 16;
    panel(ctx, x, y, w, h, 'rgba(12,12,36,.8)', D.col);
    ctx.fillStyle = D.col; ctx.fillRect(x + 2, y + 2, w - 4, 22);
    txt(ctx, 'EVENT', x + 8, y + 13, 12, '#0b0b18', 'left', 0); txt(ctx, fmtTime(c.t), x + w - 8, y + 13, 14, '#0b0b18', 'right', 0);
    txt(ctx, D.short, x + 8, y + 36, 15, D.col, 'left', 3);
    lines.forEach((l, i) => txt(ctx, l, x + 8, y + 56 + i * 16, 12, '#e8e8ff', 'left', 0));
    ctx.fillStyle = '#ffffff30'; ctx.fillRect(x + 2, y + h - 5, w - 4, 3); ctx.fillStyle = D.col; ctx.fillRect(x + 2, y + h - 5, (w - 4) * clamp(c.t / c.dur, 0, 1), 3);
  },
  drawBossBar(ctx, V, time) {
    const B = V.boss || V.fish; if (!B) return;
    const name = V.boss ? 'ギガベヒモス' : 'レインボーフィッシュ', col = V.boss ? '#c86bff' : PAL[RAINBOW[Math.floor(time * 6) % 8]];
    const w = 420, x = W / 2 - w / 2, y = 16;
    panel(ctx, x - 6, y - 4, w + 12, 38, 'rgba(12,12,36,.8)', col);
    txt(ctx, name, x + 4, y + 8, 14, col, 'left', 3);
    txt(ctx, Math.ceil(B.hp / B.mhp * 100) + '%', x + w - 4, y + 8, 13, '#fff', 'right', 3);
    ctx.fillStyle = '#0b0b18'; ctx.fillRect(x, y + 18, w, 12); ctx.fillStyle = '#3a1a3a'; ctx.fillRect(x + 1, y + 19, w - 2, 10);
    const f = clamp(B.hp / B.mhp, 0, 1); ctx.fillStyle = col; ctx.fillRect(x + 1, y + 19, (w - 2) * f, 10); ctx.fillStyle = '#ffffff50'; ctx.fillRect(x + 1, y + 19, (w - 2) * f, 3);
  },
  drawMachinePanel(ctx, V, me, time) {
    const M = MACHINES[me.m], x = 10, y = H - 132, w = 330, h = 122;
    panel(ctx, x, y, w, h, 'rgba(12,12,36,.82)', M.legend ? PAL[RAINBOW[Math.floor(time * 6) % 8]] : '#5a5a9a');
    // マシンアイコン
    ctx.fillStyle = '#0b0b2a'; ctx.fillRect(x + 8, y + 8, 52, 52);
    ctx.save(); ctx.translate(x + 34, y + 34); ctx.rotate(-Math.PI / 2); ctx.imageSmoothingEnabled = false; const s = M.big ? 2.4 : 3; const img = GFX.machine[me.m]; ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); ctx.restore();
    txt(ctx, M.name, x + 70, y + 18, 18, M.legend ? '#ffe14d' : M.col, 'left', 3);
    txt(ctx, M.desc, x + 70, y + 37, 11, '#bbb', 'left', 0);
    // HP
    const hp = clamp(me.hp, 0, 100), hy = y + 50;
    txt(ctx, 'HP', x + 70, hy + 6, 14, '#fff', 'left', 3);
    ctx.fillStyle = '#0b0b18'; ctx.fillRect(x + 96, hy - 2, 222, 16); ctx.fillStyle = '#3a1a1a'; ctx.fillRect(x + 98, hy, 218, 12);
    ctx.fillStyle = hp > 50 ? '#5fe36a' : hp > 25 ? '#ffd23f' : (Math.floor(time * 6) % 2 ? '#ff4d4d' : '#ff9b9b'); ctx.fillRect(x + 98, hy, 218 * hp / 100, 12); ctx.fillStyle = '#ffffff50'; ctx.fillRect(x + 98, hy, 218 * hp / 100, 3);
    txt(ctx, Math.ceil(hp) + '%', x + 207, hy + 6, 12, '#fff', 'center', 3);
    // ステータス
    const st = me.st || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const sx = x + 8 + i * 80, sy = y + 76;
      ctx.fillStyle = '#0b0b2a'; ctx.fillRect(sx, sy, 76, 38);
      icon(ctx, GFX.patchBig[i], sx + 3, sy + 4, 2);
      txt(ctx, STAT_SHORT[i], sx + 34, sy + 10, 11, STAT_COL[i], 'left', 0);
      txt(ctx, '' + st[i], sx + 34, sy + 27, 18, '#fff', 'left', 3);
      const mul = M.mul[i]; const mk = mul > 1.001 ? '▲' : mul < .999 ? '▼' : '';
      txt(ctx, mk, sx + 70, sy + 10, 11, mul > 1 ? '#5fe36a' : '#ff6b6b', 'right', 0);
      if (me.buf && ((i === 0 && me.buf.dumb > 0) || (i === 1 && me.buf.jet > 0) || (i === 3 && me.buf.glass > 0))) { ctx.strokeStyle = STAT_COL[i]; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, 74, 36); }
    }
    // パーツ
    let px = x;
    for (let k = 0; k < 3; k++) {
      if (!me.parts[k] || !V.legendOrder) continue;
      const L = MACHINES[V.legendOrder[k]]; panel(ctx, px, y - 58, 150, 52, 'rgba(12,12,36,.82)', L.col);
      txt(ctx, L.name + 'のパーツ', px + 8, y - 44, 12, L.col, 'left', 3);
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = i < me.parts[k] ? 1 : .25; icon(ctx, partImg(V, k), px + 8 + i * 30, y - 34, 2); }
      ctx.globalAlpha = 1; px += 158;
    }
    if (me.key) { panel(ctx, px, y - 58, 96, 52, 'rgba(12,12,36,.82)', '#ffe14d'); icon(ctx, GFX.key, px + 10, y - 42, 3); txt(ctx, '鍵', px + 62, y - 33, 16, '#ffe14d', 'center', 3); }
  },
  drawItems(ctx, V, me, time) {
    const items = me.items || [], x0 = W - 190, y0 = H - 110;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 86 : 60, x = i === 0 ? x0 + 94 : x0 + 26, y = i === 0 ? y0 + 8 : y0 + 34;
      panel(ctx, x, y, s, s, 'rgba(12,12,36,.82)', i === 0 && items[0] ? RAR_COL.R : '#5a5a9a');
      const it = items[i];
      if (it) {
        const img = GFX.itemUI[it.k], sc = i === 0 ? 5 : 3.4; ctx.drawImage(img, x + s / 2 - img.width * sc / 2, y + s / 2 - img.height * sc / 2 - 4, img.width * sc, img.height * sc);
        txt(ctx, ITEMS[it.k].name, x + s / 2, y + s - 10, i === 0 ? 12 : 10, '#fff', 'center', 3);
        if (it.k === 'sword') txt(ctx, '×' + it.n, x + s - 8, y + 12, 14, '#ffe14d', 'right', 3);
      } else txt(ctx, '空き', x + s / 2, y + s / 2, 12, '#666', 'center', 0);
    }
    txt(ctx, 'X', x0 + 104, y0 + 18, 16, '#ffe14d', 'center', 3);
    txt(ctx, items.length > 1 ? 'X長押しで入れ替え' : '', x0 + 120, y0 - 6, 11, '#aaa', 'center', 3);
    // バフ表示
    if (me.buf) { let bx = W - 200; const show = [['jet', 1, 'SPD'], ['dumb', 0, 'ATK'], ['glass', 3, 'RNG'], ['bar', 2, '無敵']]; for (const [k, ci, lbl] of show) if (me.buf[k] > 0) { panel(ctx, bx - 70, H - 150, 66, 24, 'rgba(12,12,36,.82)', STAT_COL[ci]); txt(ctx, lbl + ' ' + me.buf[k].toFixed(1), bx - 37, H - 138, 12, STAT_COL[ci], 'center', 0); bx -= 72; } }
  },
  drawTV(ctx, V, me) {
    if (!me.tv || !V.evtList) return;
    const x = 10, y = 262, w = 200, L = V.evtList;
    panel(ctx, x, y, w, 30 + L.length * 20, 'rgba(12,12,36,.8)', RAR_COL.SR);
    txt(ctx, '番組表', x + 10, y + 14, 14, RAR_COL.SR, 'left', 3);
    L.forEach((t, i) => { const done = i < (V.evtIdx || 0) - (V.evt.cur ? 1 : 0), cur = V.evt.cur && i === V.evtIdx - 1; txt(ctx, (cur ? '▶ ' : done ? '✓ ' : (i + 1) + '. ') + EVENT_DEFS[t].short, x + 12, y + 36 + i * 20, 13, cur ? EVENT_DEFS[t].col : done ? '#666' : '#fff', 'left', 0); });
  },
  drawCenter(ctx, V, me, time) {
    // 開始カウントダウン
    if (V.phase === 'battle' && V.count > 0) {
      const n = Math.ceil(V.count - .5); const k = (V.count - .5) % 1;
      if (n >= 1) { ctx.save(); ctx.translate(W / 2, H / 2 - 40); const s = 1 + (1 - k) * .5; ctx.scale(s, s); txt(ctx, '' + n, 0, 0, 90, '#ffe14d', 'center', 8); ctx.restore(); }
      else txt(ctx, 'GO!', W / 2, H / 2 - 40, 90, '#ff4d6d', 'center', 8);
    } else if (V.phase === 'battle' && V.battleT < 1.2 && V.battleT > 0) { ctx.globalAlpha = 1 - V.battleT / 1.2; txt(ctx, 'GO!', W / 2, H / 2 - 40, 90 + V.battleT * 40, '#ff4d6d', 'center', 8); ctx.globalAlpha = 1; }
    if ((V.phase === 'train' || (V.phase === 'battle' && V.count <= 0)) && V.t < 10 && V.t > 0) { const n = Math.ceil(V.t), k = V.t % 1; ctx.globalAlpha = .35 + k * .4; txt(ctx, '' + n, W / 2, 120, 70 + k * 20, '#ff4d6d', 'center', 6); ctx.globalAlpha = 1; }
    if (!me) return;
    if (me.dead > 0 && (V.phase === 'train' || V.phase === 'battle')) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H / 2 - 60, W, 120);
      txt(ctx, V.phase === 'battle' ? '撃破された! デス +1' : '撃破された!', W / 2, H / 2 - 22, 36, '#ff4d4d', 'center', 5);
      txt(ctx, Math.ceil(me.dead) + (V.phase === 'battle' ? ' 秒後に復活' : ' 秒後にミニノーマルで復活'), W / 2, H / 2 + 22, 20, '#fff', 'center', 4);
    }
    if (me.out && V.phase === 'battle') {
      const f = V.players[Render.follow];
      panel(ctx, W / 2 - 170, H - 64, 340, 50);
      txt(ctx, '観戦中: ' + (f ? f.name : ''), W / 2, H - 48, 16, '#fff', 'center', 3); txt(ctx, 'X: 観戦相手を切り替え / 順位 ' + (me.place || '-') + '位', W / 2, H - 28, 12, '#aaa', 'center', 0);
    }
    if (me.arw && !me.out) {
      const t = me.arw.t;
      panel(ctx, W / 2 - 150, H - 96, 300, 56, 'rgba(40,0,0,.8)', '#ff4d4d');
      txt(ctx, t > 0 ? 'ビッグアロー チャージ ' + t.toFixed(1) : '発射!!', W / 2, H - 80, 20, '#ffe14d', 'center', 3);
      txt(ctx, '矢印キーで狙いを調整', W / 2, H - 56, 12, '#fff', 'center', 0);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(W / 2 - 140, H - 46, 280 * (1 - clamp(t / 7, 0, 1)), 4);
    }
    // ゾーン外警告
    if (V.zone && V.phase === 'battle' && !me.out && d2(me.x, me.y, V.zone.x, V.zone.y) > V.zone.r ** 2 && Math.floor(time * 4) % 2) txt(ctx, '安全地帯の外! ダメージを受けている!', W / 2, 110, 20, '#ff7ad9', 'center', 4);
  },
  drawBanners(ctx, time) {
    for (const s of this.sparks) { ctx.globalAlpha = 1 - s.t / s.life; const z = s.s || 4; ctx.fillStyle = s.col; ctx.fillRect(s.x - z / 2, s.y - z / 2, z, z); } ctx.globalAlpha = 1;
    for (const b of this.banners) {
      const t = b.t, L = b.life, inK = Math.min(1, t / .25), outK = t > L - .4 ? (L - t) / .4 : 1;
      const y = b.big ? 150 : 125, h = b.big ? 112 : 60;
      ctx.save(); ctx.globalAlpha = Math.max(0, outK) * .95;
      // リボン
      const rw = W * inK; ctx.fillStyle = 'rgba(10,10,30,.75)'; ctx.fillRect(W / 2 - rw / 2, y - h / 2, rw, h);
      ctx.fillStyle = b.col; ctx.fillRect(W / 2 - rw / 2, y - h / 2, rw, 4); ctx.fillRect(W / 2 - rw / 2, y + h / 2 - 4, rw, 4);
      if (b.big) { ctx.globalAlpha *= .25; ctx.fillStyle = b.col; for (let i = -2; i < 22; i++) { const sx = i * 52 + (t * 220) % 52; ctx.beginPath(); ctx.moveTo(sx, y - h / 2 + 4); ctx.lineTo(sx + 22, y - h / 2 + 4); ctx.lineTo(sx - 8, y + h / 2 - 4); ctx.lineTo(sx - 30, y + h / 2 - 4); ctx.fill(); } ctx.globalAlpha = Math.max(0, outK) * .95; }
      // テキスト
      const slide = (1 - Math.min(1, t / .35)); const tx = W / 2 + slide * 400 - (t > L - .4 ? (1 - outK) * 300 : 0);
      const sc = b.big ? 1 + Math.max(0, .2 - t) * 2 : 1;
      ctx.translate(tx, y); ctx.scale(sc, sc);
      if (b.sub) txt(ctx, b.sub, 0, b.big ? -36 : -16, b.big ? 20 : 14, b.col, 'center', 4);
      if (b.big && t < .5) { ctx.globalAlpha *= (.5 - t) * 2; txt(ctx, b.txt, 0, 12, 58 * (1 + t * 1.5), b.col, 'center', 0); ctx.globalAlpha = Math.max(0, outK) * .95; }
      txt(ctx, b.txt, 0, b.big ? 12 : 8, b.big ? 58 : 30, '#ffffff', 'center', 8, '#0b0b18');
      ctx.restore();
    }
  },
  drawRoulette(ctx, V, time) {
    const R = V.rou; if (!R) return;
    ctx.fillStyle = 'rgba(6,6,20,.86)'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { const sx = (i * 97 + time * (50 + i % 5 * 30)) % W, sy = (i * 53) % H; ctx.fillStyle = i % 3 ? '#ffffff60' : '#ffe14d80'; ctx.fillRect(sx, sy, 2, 2); }
    txt(ctx, 'STAGE ROULETTE', W / 2, 70, 40, '#ffe14d', 'center', 6);
    txt(ctx, 'バトルステージ抽選中!', W / 2, 110, 18, '#fff', 'center', 3);
    const N = ARENAS.length, total = N * 5 + R.sel, spinT = 3.4;
    const k = Math.min(1, R.t / spinT), e = 1 - Math.pow(1 - k, 3), pos = e * total;
    const cur = Math.round(pos) % N; if (cur !== this.lastRou && k < 1) { Sound.play('roulette', 1); this.lastRou = cur; }
    const cy = 290;
    const stopped = R.t >= spinT;
    for (let i = -2; i <= 2; i++) {
      if (stopped && i) continue;
      const idx = ((Math.round(pos) + i) % N + N) % N, off = (Math.round(pos) - pos + i) * 64, A = ARENAS[idx];
      const a = 1 - Math.abs(off) / 160; if (a <= 0) continue; ctx.globalAlpha = a;
      const isSel = i === 0;
      panel(ctx, W / 2 - 230, cy + off - 26, 460, 52, isSel ? 'rgba(40,30,80,.95)' : 'rgba(20,20,50,.8)', isSel ? A.col : '#3a3a6a');
      txt(ctx, A.name, W / 2, cy + off, isSel ? 30 : 22, isSel ? A.col : '#aaa', 'center', 4);
    }
    ctx.globalAlpha = 1;
    if (R.t >= spinT) {
      const A = ARENAS[R.sel], f = Math.min(1, (R.t - spinT) / .3);
      if (this.lastRou !== 'done') { this.lastRou = 'done'; Sound.play('chest', 1); FX.flash = .3; FX.flashCol = A.col; }
      ctx.strokeStyle = A.col; ctx.lineWidth = 4; ctx.strokeRect(W / 2 - 240 - f * 10, cy - 32 - f * 6, 480 + f * 20, 64 + f * 12);
      txt(ctx, A.desc, W / 2, cy + 70, 18, '#fff', 'center', 3);
      txt(ctx, '全員全回復! 何度でも復活! デスが一番少ない人の勝ち!', W / 2, cy + 110, 16, '#ffe14d', 'center', 3);
    }
  },
  drawResult(ctx, V, time) {
    ctx.fillStyle = 'rgba(6,6,20,.88)'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { const x = (i * 131 + Math.sin(time + i) * 30) % W, y = (time * (60 + i % 7 * 20) + i * 41) % H; ctx.fillStyle = ['#ff4d6d', '#ffe14d', '#4dc3ff', '#5fe36a', '#c86bff'][i % 5]; ctx.fillRect(x, y, 6, 3); }
    txt(ctx, 'RESULT', W / 2, 46, 40, '#ffe14d', 'center', 6);
    const R = V.result; if (!R) return;
    const [wid, , wk, wst, wm, wd] = R[0]; const wp = V.players[wid];
    panel(ctx, 60, 90, 360, 330, 'rgba(30,24,60,.9)', '#ffe14d');
    txt(ctx, '★ WINNER ★', 240, 120, 24, '#ffe14d', 'center', 4);
    ctx.save(); ctx.translate(240, 220); ctx.rotate(-Math.PI / 2 + Math.sin(time * 2) * .1); const img = GFX.machine[wm], s = 7; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); ctx.restore();
    txt(ctx, wp ? wp.name : '', 240, 318, 32, wp ? PLAYER_COLS[wp.col] : '#fff', 'center', 5);
    txt(ctx, MACHINES[wm].name, 240, 352, 16, MACHINES[wm].col, 'center', 3);
    txt(ctx, 'デス ' + wd + '   撃破 ' + wk + '   ステータス合計 ' + wst, 240, 384, 14, '#fff', 'center', 3);
    panel(ctx, 450, 90, 450, 400, 'rgba(12,12,36,.9)');
    txt(ctx, '順位', 470, 112, 14, '#aaa'); txt(ctx, '名前', 530, 112, 14, '#aaa'); txt(ctx, 'デス', 760, 112, 14, '#aaa', 'center'); txt(ctx, '撃破', 820, 112, 14, '#aaa', 'center'); txt(ctx, 'ステ', 872, 112, 14, '#aaa', 'center');
    let shown = R.slice(0, 14); const mi = R.findIndex(r => r[0] === Render.meId); if (mi >= 14) shown = R.slice(0, 13).concat([R[mi]]);
    shown.forEach((r, i) => {
      const p = V.players[r[0]], y = 140 + i * 25, mine = r[0] === Render.meId;
      if (mine) { ctx.fillStyle = 'rgba(255,225,77,.18)'; ctx.fillRect(456, y - 11, 438, 22); }
      txt(ctx, r[1] + '位', 470, y, 15, r[1] === 1 ? '#ffe14d' : r[1] <= 3 ? '#ffb43d' : '#fff', 'left', 3);
      txt(ctx, (p ? p.name : '?') + (mine ? ' (YOU)' : ''), 530, y, 15, p ? PLAYER_COLS[p.col] : '#fff', 'left', 3);
      txt(ctx, '' + r[5], 760, y, 15, '#ff9b9b', 'center', 3); txt(ctx, '' + r[2], 820, y, 15, '#fff', 'center', 3); txt(ctx, '' + r[3], 872, y, 15, '#fff', 'center', 3);
    });
    const blink = Math.floor(time * 2) % 2;
    if (blink) txt(ctx, Net.role === 'client' ? 'ホストの操作を待っています…' : 'Z: タイトルへ戻る', W / 2, H - 24, 18, '#fff', 'center', 3);
  },
};
