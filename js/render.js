'use strict';
// ============================================================
//  ワールド描画 (480x270 の低解像度バッファに描いて 2 倍拡大)
// ============================================================
// パーツ画像(種類 k = 0..2 → その試合での伝説マシンの色)
function partImg(V, k) { const id = V.legendOrder ? V.legendOrder[k] : LEGEND_IDS[k]; return GFX.partCol[Math.max(0, LEGEND_IDS.indexOf(id))]; }
const Render = {
  cam: { x: 0, y: 0, zoom: 1, tx: 0, ty: 0 }, meId: 0, follow: 0,
  init(main) {
    this.main = main; this.ctx = main.getContext('2d');
    this.wc = mkCanvas(LW, LH); this.w = this.wc.getContext('2d');
    this.ctx.imageSmoothingEnabled = false; this.w.imageSmoothingEnabled = false;
    // 宇宙背景: 星雲 + 3層の星(視差スクロールで疾走感)
    const r = RNG(4242);
    this.neb = mkCanvas(512, 512); { const x = this.neb.getContext('2d'); x.fillStyle = '#05051a'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 14; i++) { const cx = r() * 512, cy = r() * 512, rad = 60 + r() * 140, col = r.pick(['80,40,180', '30,90,200', '160,40,140', '20,140,160', '60,30,120']);
        for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad); g.addColorStop(0, `rgba(${col},.35)`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(cx + ox - rad, cy + oy - rad, rad * 2, rad * 2); } } }
    this.starL = [[.12, 90, ['#5a5a9a', '#7a6ab0']], [.3, 55, ['#a0a0e0', '#8ad0ff']], [.55, 28, ['#ffffff', '#fff3b0', '#ffb0e0']]].map(([p, n, cols], li) => {
      const c = mkCanvas(256, 256), x = c.getContext('2d'); for (let i = 0; i < n; i++) { x.fillStyle = r.pick(cols); const s = li === 2 && r() < .3 ? 2 : 1; x.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), s, s); if (li === 2 && r() < .15) { x.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), 1, 3); } } return { p, c };
    });
  },
  drawSpace(c, time) {
    const w = this.w, tile = (img, size, p) => { const ox = -((c.x * p) % size + size) % size, oy = -((c.y * p) % size + size) % size; for (let y = oy; y < LH; y += size) for (let x = ox; x < LW; x += size) w.drawImage(img, Math.round(x), Math.round(y)); };
    tile(this.neb, 512, .06);
    for (const L of this.starL) tile(L.c, 256, L.p);
  },
  // ワールド座標 → メインキャンバス座標
  sx(x) { return ((x - this.cam.x) * this.cam.zoom + LW / 2) * SCALE; },
  sy(y) { return ((y - this.cam.y) * this.cam.zoom + LH / 2) * SCALE; },
  onScreen(x, y, m = 20) { const c = this.cam, hw = LW / 2 / c.zoom + m, hh = LH / 2 / c.zoom + m; return Math.abs(x - c.x) < hw && Math.abs(y - c.y) < hh; },

  updateCam(V, dt) {
    const me = V.players[this.meId]; let tgt = me;
    if (me && (me.out || (V.phase === 'battle' && me.dead > 0))) { // 観戦
      let f = V.players[this.follow]; if (!f || f.out) { f = V.players.find(p => !p.out); if (f) this.follow = f.id; }
      tgt = f || me;
    }
    const c = this.cam;
    let zoom = 1; if (me && me.arw && !me.out) zoom = .5;
    if (V.phase === 'roulette' || V.phase === 'result') zoom = 1;
    c.kick = Math.max(0, (c.kick || 0) - dt * 1.2); // 爆発時のズームパンチ
    c.base = lerp(c.base || 1, zoom, Math.min(1, dt * 4)); c.zoom = c.base * (1 + c.kick);
    if (tgt) {
      const lead = 0.25; const tx = tgt.x + (tgt.vx || 0) * lead, ty = tgt.y + (tgt.vy || 0) * lead;
      if (c.snap) { c.x = tx; c.y = ty; c.snap = false; }
      c.x = lerp(c.x, tx, Math.min(1, dt * 7)); c.y = lerp(c.y, ty, Math.min(1, dt * 7));
    }
    const hw = LW / 2 / c.zoom, hh = LH / 2 / c.zoom, M = V.map;
    if (M.w > hw * 2) c.x = clamp(c.x, hw, M.w - hw); else c.x = M.w / 2;
    if (M.h > hh * 2) c.y = clamp(c.y, hh, M.h - hh); else c.y = M.h / 2;
  },

  draw(V, time) {
    const w = this.w, c = this.cam, z = c.zoom;
    let shx = 0, shy = 0; if (FX.shake > 0) { shx = (Math.random() - .5) * FX.shake; shy = (Math.random() - .5) * FX.shake; }
    const ox = Math.round(LW / 2 - c.x * z + shx), oy = Math.round(LH / 2 - c.y * z + shy);
    w.setTransform(1, 0, 0, 1, 0, 0); this.drawSpace(c, time);
    w.setTransform(z, 0, 0, z, ox, oy);
    const hw = LW / 2 / z, hh = LH / 2 / z, X0 = c.x - hw - 32, Y0 = c.y - hh - 32, X1 = c.x + hw + 32, Y1 = c.y + hh + 32;
    this.drawTiles(V, X0, Y0, X1, Y1, time);
    this.drawGroundLayer(V, time);
    // ---- エンティティ ----
    for (const wp of V.warps) this.drawWarp(wp, time);
    for (const m of V.meteors) this.drawMeteorShadow(m);
    for (const k of V.pickups) if (k.x > X0 && k.x < X1 && k.y > Y0 && k.y < Y1) this.drawPickup(V, k, time);
    for (const ch of V.chests) if (ch.x > X0 && ch.x < X1 && ch.y > Y0 && ch.y < Y1) this.drawChest(ch, time);
    for (const m of V.machines) if (m.x > X0 && m.x < X1 && m.y > Y0 && m.y < Y1) this.drawFreeMachine(m, time);
    for (const e of V.enemies) if (e.x > X0 && e.x < X1 && e.y > Y0 && e.y < Y1) this.drawEnemy(e, time);
    for (const wl of V.wilds) if (wl.x > X0 && wl.x < X1 && wl.y > Y0 && wl.y < Y1) this.drawWild(wl, time);
    for (const p of V.players) if (!p.out && p.x > X0 && p.x < X1 && p.y > Y0 && p.y < Y1) this.drawPlayer(V, p, time);
    if (V.fish) this.drawFish(V.fish, time);
    if (V.boss) this.drawBoss(V.boss, time);
    for (const b of V.balls) this.drawBall(b);
    this.drawBullets(V, X0, Y0, X1, Y1, time);
    FxObjs.draw(w);
    Particles.draw(w, X0, Y0, X1, Y1);
    for (const m of V.meteors) this.drawMeteor(m, time);
    for (const p of V.players) if (p.arw && !p.out && p.dead <= 0) this.drawArrowWarn(p, time);
    this.drawOverlayBounds(V, time);
    w.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.wc, 0, 0, W, H);
  },

  drawTiles(V, X0, Y0, X1, Y1, time) {
    const w = this.w, M = V.map;
    const tx0 = Math.max(-2, Math.floor(X0 / TILE)), ty0 = Math.max(-2, Math.floor(Y0 / TILE)), tx1 = Math.min(M.tw + 1, Math.ceil(X1 / TILE)), ty1 = Math.min(M.th + 1, Math.ceil(Y1 / TILE));
    const over = M.over, grow = Math.min(1, M.overT);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = M.get(tx, ty), arr = TILES[t]; if (!arr) continue;
      const v = arr.length > 1 ? ((tx * 73856093) ^ (ty * 19349663)) >>> 0 : 0;
      w.drawImage(arr[v % arr.length], tx * TILE, ty * TILE);
      if (t === 8 && ((tx + ty + Math.floor(time * 3)) % 5 === 0)) { w.fillStyle = '#ffe14d60'; w.fillRect(tx * TILE + 3, ty * TILE + 6, 8, 2); }
    }
    if (over) {
      for (let ty = Math.max(0, ty0); ty <= Math.min(M.th - 1, ty1); ty++) for (let tx = Math.max(0, tx0); tx <= Math.min(M.tw - 1, tx1); tx++) {
        if (!over[ty * M.tw + tx]) continue;
        if (grow >= 1) w.drawImage(GFX.flowerWall, tx * TILE, ty * TILE);
        else { const s = Math.max(1, Math.round(16 * grow)); w.drawImage(GFX.flowerWall, tx * TILE + 8 - s / 2, ty * TILE + 8 - s / 2, s, s); }
      }
    }
  },
  drawGroundLayer(V, time) {
    const w = this.w;
    // モンスターラッシュのエリア
    const ev = V.evt && V.evt.cur;
    if (ev && ev.type === 'rush' && ev.region !== undefined) {
      const rx = ev.region % 3, ry = Math.floor(ev.region / 3), M = V.map;
      w.fillStyle = `rgba(255,60,60,${.08 + Math.sin(time * 4) * .04})`; w.fillRect(M.w * rx / 3, M.h * ry / 3, M.w / 3, M.h / 3);
      w.strokeStyle = '#ff4d4d'; w.lineWidth = 2; w.setLineDash([6, 6]); w.strokeRect(M.w * rx / 3, M.h * ry / 3, M.w / 3, M.h / 3); w.setLineDash([]);
    }
  },
  drawOverlayBounds(V, time) {
    const w = this.w, M = V.map, b = M.bnd;
    w.strokeStyle = '#0b0b18'; w.lineWidth = 4; w.strokeRect(-2, -2, M.w + 4, M.h + 4); w.strokeStyle = '#8a90a8'; w.lineWidth = 1; w.strokeRect(0, 0, M.w, M.h);
    if (b) {
      w.fillStyle = 'rgba(10,10,30,.65)';
      w.beginPath(); w.rect(-200, -200, M.w + 400, M.h + 400); w.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); w.fill('evenodd');
      w.strokeStyle = Math.floor(time * 6) % 2 ? '#ff4d4d' : '#ffe14d'; w.lineWidth = 3; w.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
    const z = V.zone;
    if (z && V.phase === 'battle') {
      w.fillStyle = 'rgba(120,20,160,.38)';
      w.beginPath(); w.rect(-400, -400, M.w + 800, M.h + 800); w.arc(z.x, z.y, Math.max(1, z.r), 0, TAU, true); w.fill('evenodd');
      w.strokeStyle = '#ff7ad9'; w.lineWidth = 3; w.beginPath(); w.arc(z.x, z.y, Math.max(1, z.r), 0, TAU); w.stroke();
      w.strokeStyle = '#ffffff80'; w.lineWidth = 1; w.beginPath(); w.arc(z.x, z.y, Math.max(1, z.r - 4), 0, TAU); w.stroke();
    }
  },
  shadow(x, y, rx, ry = rx * .45) { const w = this.w; w.fillStyle = 'rgba(0,0,20,.35)'; w.beginPath(); w.ellipse(x, y, rx, ry, 0, 0, TAU); w.fill(); },
  spr(img, x, y, a = 0, flipX = false, scale = 1) {
    const w = this.w;
    if (!a && !flipX && scale === 1) { w.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); return; }
    w.save(); w.translate(Math.round(x), Math.round(y)); if (a) w.rotate(a); if (flipX) w.scale(-1, 1); if (scale !== 1) w.scale(scale, scale);
    w.drawImage(img, -img.width / 2, -img.height / 2); w.restore();
  },

  drawPickup(V, k, time) {
    const w = this.w, bob = k.z > 0 ? 0 : Math.sin(time * 4 + k.id) * 1.2;
    if (k.life - k.t < 6 && Math.floor(time * 8) % 2) return;
    this.shadow(k.x, k.y + 5, 4, 1.6);
    let img;
    if (k.k < PK_ITEM) img = GFX.patch[k.k];
    else if (isPart(k.k)) img = partImg(V, k.k - PK_PART);
    else if (k.k === PK_KEY) img = GFX.key;
    else img = GFX.item[ITEM_KEYS[k.k - PK_ITEM]];
    if (k.k >= PK_ITEM) { w.globalAlpha = .4 + Math.sin(time * 6) * .2; w.fillStyle = isPart(k.k) || k.k === PK_KEY ? '#ffe14d' : RAR_COL[ITEMS[ITEM_KEYS[k.k - PK_ITEM]]?.rar] || '#fff'; w.beginPath(); w.arc(k.x, k.y - k.z + bob, 9, 0, TAU); w.fill(); w.globalAlpha = 1; }
    this.spr(img, k.x, k.y - k.z + bob);
  },
  drawChest(ch, time) {
    const w = this.w; let img;
    if (ch.type === 'O') img = GFX.ore[Math.floor(time * 10) % 8];
    else img = { B: GFX.chestB, A: GFX.chestA, G: GFX.chestG, L: GFX.chestL, I: GFX.chestI }[ch.type];
    this.shadow(ch.x, ch.y + img.height / 2 - 1, img.width / 2 + 1, 2.5);
    if (ch.type === 'L' || ch.type === 'O' || ch.type === 'A') { w.globalAlpha = .25 + Math.sin(time * 4) * .12; w.fillStyle = ch.type === 'L' ? '#ff3dd8' : ch.type === 'O' ? PAL[RAINBOW[Math.floor(time * 8) % 8]] : '#ffe14d'; w.beginPath(); w.arc(ch.x, ch.y, img.width * .8, 0, TAU); w.fill(); w.globalAlpha = 1; }
    const sh = ch.flash > 0 ? (Math.random() - .5) * 2 : 0;
    this.spr(ch.flash > 0 ? GFX.chestW[ch.type] : img, ch.x + sh, ch.y);
    if ((ch.type === 'A' || ch.type === 'G' || ch.type === 'O') && Math.random() < .04) Particles.add(ch.x + rnd(-8, 8), ch.y + rnd(-8, 6), 0, -10, .5, 2, C_WHITE, 1);
    if (ch.type === 'L') { this.spr(GFX.key, ch.x, ch.y - 14 + Math.sin(time * 3) * 1.5); }
    if (ch.hp < ch.mhp && ch.mhp < 1e8) this.bar(ch.x, ch.y - img.height / 2 - 4, 16, ch.hp / ch.mhp, '#ffe14d');
  },
  bar(x, y, wd, f, col) { const w = this.w; x = Math.round(x - wd / 2); y = Math.round(y); w.fillStyle = '#0b0b18'; w.fillRect(x - 1, y - 1, wd + 2, 4); w.fillStyle = '#3a3a4a'; w.fillRect(x, y, wd, 2); w.fillStyle = col; w.fillRect(x, y, Math.max(0, Math.round(wd * clamp(f, 0, 1))), 2); },
  drawFreeMachine(m, time) {
    const w = this.w, M = MACHINES[m.m]; const bob = Math.sin(time * 2.5 + m.id) * 1.5;
    const col = m.m === 0 ? '#ffffff' : M.legend ? PAL[RAINBOW[Math.floor(time * 10) % 8]] : STAT_COL[M.best];
    this.shadow(m.x, m.y + 9, 10, 3);
    w.globalAlpha = .45 + Math.sin(time * 4 + m.id) * .2; w.strokeStyle = col; w.lineWidth = 2;
    w.beginPath(); w.arc(m.x, m.y, 15 + Math.sin(time * 4) * 2, 0, TAU); w.stroke(); w.globalAlpha = 1;
    if (Math.random() < .08) Particles.add(m.x + rnd(-10, 10), m.y + rnd(-6, 8), 0, -25, .6, 2, PC(col), 1);
    this.spr(GFX.machineFree[m.m], m.x, m.y + bob - 2, m.a, false, 1.35);
  },
  drawEnemy(e, time) {
    const T = ENEMIES[e.tp], img = e.flash > 0 ? GFX.enemyW[e.tp] : GFX.enemy[e.tp];
    let bob = 0, sq = 1;
    if (T.beh === 'hop' || T.beh === 'flee') bob = -Math.abs(Math.sin(e.t * (T.beh === 'flee' ? 8 : 5))) * 4;
    else if (T.beh === 'fly') bob = -4 + Math.sin(e.t * 10) * 2;
    else bob = Math.sin(e.t * 3) * .8;
    // 敵は赤いオーラ
    const w = this.w, pul = .28 + Math.sin(time * 6 + e.id) * .1; w.globalAlpha = pul; w.fillStyle = '#ff2030'; w.beginPath(); w.arc(e.x, e.y + bob, 11, 0, TAU); w.fill(); w.globalAlpha = pul * 1.6; w.strokeStyle = '#ff4d4d'; w.lineWidth = 1; w.beginPath(); w.arc(e.x, e.y + bob, 12 + Math.sin(time * 8 + e.id) * 1.5, 0, TAU); w.stroke(); w.globalAlpha = 1;
    this.shadow(e.x, e.y + 8, 6, 2);
    this.spr(img, e.x, e.y + bob, 0, e.face < 0, 1.25);
    if (e.hp < e.mhp) this.bar(e.x, e.y - 12, 12, e.hp / e.mhp, STAT_COL[T.drop < 0 ? 1 : T.drop]);
  },
  drawWild(wl, time) {
    const w = this.w;
    if (wl.legend) { w.globalAlpha = .45; w.fillStyle = PAL[RAINBOW[Math.floor(time * 12) % 8]]; w.beginPath(); w.arc(wl.x, wl.y, 13, 0, TAU); w.fill(); w.globalAlpha = 1; }
    this.shadow(wl.x, wl.y + 7, 7, 2.5);
    this.spr(wl.flash > 0 ? GFX.machineW[wl.m] : GFX.machine[wl.m], wl.x, wl.y, wl.a);
    if (wl.stun > 0) {
      for (let i = 0; i < 3; i++) { const a = time * 4 + i * TAU / 3; w.fillStyle = '#ffe14d'; w.fillRect(Math.round(wl.x + Math.cos(a) * 9) - 1, Math.round(wl.y - 12 + Math.sin(a) * 3) - 1, 3, 3); }
    } else if (wl.mhp) this.bar(wl.x, wl.y - 13, 16, wl.hp / wl.mhp, '#3dffe0');
  },
  drawPlayer(V, p, time) {
    const w = this.w, M = MACHINES[p.m], big = M.big;
    if (p.dead > 0) { // 残骸
      if (V.phase === 'train') { if (Math.random() < .15) Particles.add(p.x + rnd(-3, 3), p.y, rnd(-5, 5), -20, 1, 3, C_SMOKE, 1); w.fillStyle = '#2a2a3a'; w.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 3, 8, 6); }
      return;
    }
    const col = PLAYER_COLS[p.col];
    // プレイヤーカラーの足元リング
    w.globalAlpha = .9; w.strokeStyle = col; w.lineWidth = 1; w.beginPath(); w.ellipse(p.x, p.y + 3, big ? 15 : 9, big ? 7 : 4, 0, 0, TAU); w.stroke(); w.globalAlpha = 1;
    this.shadow(p.x, p.y + (big ? 9 : 6), big ? 12 : 6, big ? 3.5 : 2.5);
    // 排気
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    if (spd > 50 && Math.random() < .6) { const a = p.a + Math.PI; Particles.add(p.x + Math.cos(a) * 7, p.y + Math.sin(a) * 7, Math.cos(a) * 30 + rnd(-10, 10), Math.sin(a) * 30 + rnd(-10, 10), .3, 2, p.buf && p.buf.jet > 0 ? C_YEL : (M.legend ? RAINBOW[(Math.random() * 8) | 0] : C_ORA), 3); }
    if (M.legend && Math.random() < .3) Particles.add(p.x + rnd(-6, 6), p.y + rnd(-6, 6), 0, -15, .6, 2, RAINBOW[(Math.random() * 8) | 0], 1);
    const blink = p.inv > 0 && Math.floor(time * 15) % 2;
    // 残像(疾走感)
    if (spd > 90 && !blink && ((time * 60) | 0) % 2 === 0) FxObjs.add({ type: 'ghost', img: GFX.machine[p.m], x: p.x, y: p.y, a: p.a, life: .16 });
    if (!blink) this.spr(p.flash > 0 ? GFX.machineW[p.m] : GFX.machine[p.m], p.x, p.y, p.a, false, big ? 1.65 : 1);
    // バフ
    if (p.buf) {
      if (p.buf.bar > 0) { w.globalAlpha = .35 + Math.sin(time * 10) * .15; w.fillStyle = '#8ad0ff'; w.beginPath(); w.arc(p.x, p.y, 13, 0, TAU); w.fill(); w.globalAlpha = 1; w.strokeStyle = '#ffffff'; w.beginPath(); w.arc(p.x, p.y, 13, 0, TAU); w.stroke(); }
      if (p.buf.dumb > 0 && Math.random() < .25) Particles.add(p.x + rnd(-7, 7), p.y + rnd(-5, 5), 0, -25, .5, 2, PC(STAT_COL[0]), 1);
      if (p.buf.glass > 0 && Math.random() < .25) Particles.add(p.x + rnd(-7, 7), p.y + rnd(-5, 5), 0, -25, .5, 2, PC(STAT_COL[3]), 1);
    }
    // 頭上アイコン: パーツ / 鍵
    let iy = p.y - (big ? 17 : 14);
    const pn = partsN(p);
    if (pn > 0) {
      let i = 0;
      for (let k = 0; k < 3; k++) for (let j = 0; j < p.parts[k]; j++, i++) w.drawImage(partImg(V, k), Math.round(p.x - (pn * 8) / 2 + i * 8 - 2), Math.round(iy - 10), 9, 9);
      iy -= 10;
    }
    if (p.key) this.spr(GFX.key, p.x, iy - 6 + Math.sin(time * 4));
  },
  drawBoss(b, time) {
    const w = this.w, bob = Math.sin(time * 3) * 2;
    this.shadow(b.x, b.y + 38, 38, 11);
    w.globalAlpha = .25 + Math.sin(time * 5) * .1; w.fillStyle = b.st === 'charge' ? '#ff2d2d' : '#a03dff'; w.beginPath(); w.arc(b.x, b.y, 50, 0, TAU); w.fill(); w.globalAlpha = 1;
    if (Math.random() < .5) Particles.add(b.x + rnd(-36, 36), b.y + rnd(-30, 36), 0, -30, .8, 3, Math.random() < .5 ? C_PUR : C_DARK, 1);
    const sc = b.st === 'charge' ? 1.62 : 1.5;
    this.spr(b.flash > 0 ? GFX.bossW : GFX.boss, b.x, b.y + bob, 0, (b.vx || 0) < 0, sc);
  },
  drawFish(f, time) {
    this.shadow(f.x, f.y + 30, 42, 9);
    const img = f.flash > 0 ? GFX.fishW : GFX.fish[Math.floor(time * 8) % 8];
    const left = Math.cos(f.a) < 0;
    this.spr(img, f.x, f.y + Math.sin(time * 2) * 3, 0, left, 1.4);
  },
  drawBall(b) { this.shadow(b.x, b.y + 20, 19, 6); this.spr(GFX.balls[b.kind], b.x, b.y - 3, b.rot, false, 1.55); },
  drawWarp(wp, time) {
    const w = this.w;
    for (const [x, y] of [[wp.x, wp.y], [wp.x2, wp.y2]]) {
      for (let i = 0; i < 4; i++) { const r = 14 - ((time * 14 + i * 4) % 14); w.strokeStyle = i % 2 ? '#c86bff' : '#ff7ad9'; w.globalAlpha = r / 14; w.lineWidth = 2; w.beginPath(); w.ellipse(x, y, r, r * .8, 0, 0, TAU); w.stroke(); }
      w.globalAlpha = .7; w.fillStyle = '#1a0030'; w.beginPath(); w.ellipse(x, y, 5, 4, 0, 0, TAU); w.fill(); w.globalAlpha = 1;
      if (Math.random() < .2) Particles.add(x + rnd(-12, 12), y + rnd(-10, 10), 0, 0, .5, 2, C_PUR, 2);
    }
  },
  drawMeteorShadow(m) {
    const w = this.w, k = m.t / m.fall;
    if (m.kind === 2) return;
    w.globalAlpha = .25 + k * .3; w.fillStyle = '#ff2d2d'; w.beginPath(); w.arc(m.x, m.y, m.r * k, 0, TAU); w.fill();
    w.globalAlpha = .8; w.strokeStyle = Math.floor(m.t * (m.big ? 6 : 10)) % 2 ? '#ff2d2d' : '#ffe14d'; w.lineWidth = m.big ? 3 : 1; w.beginPath(); w.arc(m.x, m.y, m.r, 0, TAU); w.stroke(); w.globalAlpha = 1;
  },
  drawMeteor(m, time) {
    const w = this.w, k = m.t / m.fall, h = (1 - k) * (m.big ? 420 : 200);
    if (m.kind === 2) { const x = m.x - h * .6, y = m.y - h; w.strokeStyle = '#fff3b0'; w.lineWidth = 2; w.beginPath(); w.moveTo(x, y); w.lineTo(x - 14, y - 22); w.stroke(); w.fillStyle = '#ffffff'; w.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); return; }
    const img = m.big ? GFX.meteorBig : GFX.meteor, x = m.x - h * .35, y = m.y - h;
    w.globalAlpha = .6; w.fillStyle = '#ff9b3d'; w.beginPath(); w.arc(x + 8, y - 12, img.width * .45, 0, TAU); w.fill(); w.globalAlpha = 1;
    if (Math.random() < (m.big ? 1 : .4)) Particles.add(x + rnd(-4, 4), y + rnd(-4, 4), 20, -40, .5, m.big ? 6 : 3, Math.random() < .5 ? C_ORA : C_SMOKE, 1);
    this.spr(img, x, y, time * 2);
  },
  drawArrowWarn(p, time) {
    const w = this.w, a = p.arw.a, lock = p.arw.t <= 0;
    w.save(); w.translate(p.x, p.y); w.rotate(a);
    const fl = Math.floor(time * (lock ? 20 : 4 + (7 - p.arw.t) * 2)) % 2;
    w.globalAlpha = lock ? .55 : (fl ? .32 : .18); w.fillStyle = lock ? '#ffffff' : '#ff2d2d'; w.fillRect(10, -16, 5000, 32);
    w.globalAlpha = .9; w.fillStyle = '#ff2d2d'; w.fillRect(10, -17, 5000, 1); w.fillRect(10, 16, 5000, 1);
    w.fillStyle = '#ffe14d'; for (let d = 30 + (time * 120) % 40; d < 3000; d += 40) { w.fillRect(d, -1, 8, 2); w.fillRect(d + 4, -3, 2, 6); }
    w.restore(); w.globalAlpha = 1;
  },
  drawBullets(V, X0, Y0, X1, Y1, time) {
    const w = this.w;
    for (const b of V.bullets) {
      if (b.x < X0 || b.x > X1 || b.y < Y0 || b.y > Y1) continue;
      const C = BULLET_COL[b.col] || BULLET_COL[0];
      const x = Math.round(b.x), y = Math.round(b.y);
      switch (b.k) {
        case 'blade': {
          w.save(); w.translate(x, y); w.rotate(b.ang); w.globalAlpha = 1 - (b.t / b.life) * .6;
          w.fillStyle = C[1]; w.beginPath(); w.arc(-6, 0, 11, -1.3, 1.3); w.arc(-10, 0, 9, 1.2, -1.2, true); w.fill();
          w.fillStyle = C[0]; w.beginPath(); w.arc(-6, 0, 10, -1, 1); w.arc(-8, 0, 9, .9, -.9, true); w.fill(); w.restore(); w.globalAlpha = 1; break;
        }
        case 'flame': { const k = b.t / b.life, r = 2 + k * 5; w.globalAlpha = 1 - k * .7; w.fillStyle = k < .3 ? '#fff6a0' : k < .6 ? '#ffb43d' : '#ff4d1a'; w.beginPath(); w.arc(x, y, r, 0, TAU); w.fill(); w.globalAlpha = 1; break; }
        case 'boom': { w.save(); w.translate(x, y); w.rotate(time * 20); w.fillStyle = '#0b0b18'; w.fillRect(-5, -2, 10, 4); w.fillRect(-2, -5, 4, 10); w.fillStyle = C[1]; w.fillRect(-4, -1, 8, 2); w.fillRect(-1, -4, 2, 8); w.restore(); break; }
        case 'home': {
          w.strokeStyle = C[1]; w.lineWidth = 2; w.beginPath(); w.moveTo(x, y); w.lineTo(x - Math.cos(b.ang) * 6, y - Math.sin(b.ang) * 6); w.stroke();
          w.fillStyle = C[0]; w.fillRect(x - 1, y - 1, 3, 3); if (Math.random() < .5) Particles.add(x - Math.cos(b.ang) * 6, y - Math.sin(b.ang) * 6, 0, 0, .25, 2, C_GRAY, 2); break;
        }
        default: {
          const r = b.r + (b.big ? 1 : 0);
          w.globalCompositeOperation = 'lighter'; w.globalAlpha = .35; w.fillStyle = C[1]; w.beginPath(); w.arc(x, y, r + 4, 0, TAU); w.fill(); w.globalAlpha = 1; w.globalCompositeOperation = 'source-over';
          if (b.tr) { w.strokeStyle = C[1]; w.lineWidth = Math.max(1, r); w.globalAlpha = .7; w.beginPath(); w.moveTo(x, y); w.lineTo(x - b.vx * .03, y - b.vy * .03); w.stroke(); w.globalAlpha = 1; }
          w.fillStyle = C[1]; if (r <= 2) { w.fillRect(x - 2, y - 2, 4, 4); w.fillStyle = C[0]; w.fillRect(x - 1, y - 1, 2, 2); }
          else { w.beginPath(); w.arc(x, y, r + 1, 0, TAU); w.fill(); w.fillStyle = C[0]; w.beginPath(); w.arc(x, y, r * .55, 0, TAU); w.fill(); }
        }
      }
    }
  },
};
