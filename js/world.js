'use strict';
// ============================================================
//  マップ (タイル / 生成 / 当たり判定)
// ============================================================
// 非固体: 0草 1濃草 2土 3道 4花 5砂 6金属床 7金属床2 8溶岩(ダメージ) 9水晶床 11星床
// 固体  : 20岩 21木 22金属壁 23水晶 24花壁 25柱 26場外(宇宙)
const SOLID = 20;
const TILE_MINI = { 0: '#3f9a3a', 1: '#2f7f30', 2: '#9a7a4a', 3: '#6a6a7a', 4: '#4faa44', 5: '#d8c88a', 6: '#4a5068', 7: '#3e4458', 8: '#ff5a1a', 9: '#5a4a8a', 11: '#6a6a9a', 20: '#7a7a8a', 21: '#1a5a22', 22: '#8a90a8', 23: '#c88aff', 24: '#ff7ad9', 25: '#a0a8c0', 26: '#0a0a1a' };
const TILES = {};
function buildTiles() {
  const mk = (fn, n = 3) => { const out = []; for (let v = 0; v < n; v++) { const c = mkCanvas(16, 16), x = c.getContext('2d'); const r = RNG(v * 977 + 13); fn(x, r, v); out.push(c); } return out; };
  const speck = (x, r, base, cols, n) => { x.fillStyle = base; x.fillRect(0, 0, 16, 16); for (let i = 0; i < n; i++) { x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, r() < .3 ? 2 : 1); } };
  TILES[0] = mk((x, r) => speck(x, r, '#3f9a3a', ['#4fb048', '#358a32', '#5cc052'], 14));
  TILES[1] = mk((x, r) => speck(x, r, '#2f7f30', ['#3a8f38', '#266a27'], 12));
  TILES[2] = mk((x, r) => speck(x, r, '#9a7a4a', ['#a8895a', '#86683c', '#b8996a'], 16));
  TILES[3] = mk((x, r, v) => { speck(x, r, '#6a6a7a', ['#74748a', '#5e5e6c'], 10); if (v === 0) { x.fillStyle = '#e8e080'; x.fillRect(6, 7, 4, 2); } });
  TILES[4] = mk((x, r) => { speck(x, r, '#3f9a3a', ['#4fb048', '#358a32'], 10); const cs = ['#ff7ad9', '#ffe14d', '#ffffff', '#ff4d6d', '#8ad0ff']; for (let i = 0; i < 3; i++) { const a = 2 + Math.floor(r() * 12), b = 2 + Math.floor(r() * 12); x.fillStyle = cs[Math.floor(r() * cs.length)]; x.fillRect(a - 1, b, 3, 1); x.fillRect(a, b - 1, 1, 3); x.fillStyle = '#ffb43d'; x.fillRect(a, b, 1, 1); } });
  TILES[5] = mk((x, r) => speck(x, r, '#d8c88a', ['#e4d69a', '#c8b878'], 12));
  TILES[6] = mk((x, r, v) => { x.fillStyle = '#4a5068'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#565c78'; x.fillRect(1, 1, 14, 1); x.fillStyle = '#383c50'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); x.fillStyle = '#6a7090'; x.fillRect(2, 2, 1, 1); x.fillRect(13, 2, 1, 1); x.fillRect(2, 13, 1, 1); x.fillRect(13, 13, 1, 1); });
  TILES[7] = mk((x, r, v) => { x.fillStyle = '#3e4458'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#4a5068'; x.fillRect(1, 1, 14, 1); x.fillStyle = '#2e3244'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); });
  TILES[8] = mk((x, r, v) => { speck(x, r, '#e8461a', ['#ff7a2e', '#ffb43d', '#c8321a'], 20); x.fillStyle = '#ffe14d'; x.fillRect(Math.floor(r() * 12), Math.floor(r() * 12), 3, 1); });
  TILES[9] = mk((x, r) => { speck(x, r, '#4a3e7a', ['#5a4a8a', '#3e3468', '#7a6ab0'], 10); });
  TILES[11] = mk((x, r, v) => { x.fillStyle = '#5a5a8a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#ffe14d'; x.fillRect(7, 3, 2, 10); x.fillRect(3, 7, 10, 2); x.fillStyle = '#fff3b0'; x.fillRect(7, 7, 2, 2); }, 1);
  const block = (top, side, hl, deco) => mk((x, r, v) => { x.fillStyle = side; x.fillRect(0, 0, 16, 16); x.fillStyle = top; x.fillRect(0, 0, 16, 12); x.fillStyle = hl; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 12); x.fillStyle = '#0b0b1860'; x.fillRect(0, 15, 16, 1); if (deco) deco(x, r, v); });
  TILES[20] = block('#8a8a9a', '#5a5a6a', '#b0b0c0', (x, r) => { x.fillStyle = '#6a6a7a'; for (let i = 0; i < 4; i++) x.fillRect(2 + Math.floor(r() * 11), 2 + Math.floor(r() * 8), 2, 1); });
  TILES[21] = mk((x, r) => { x.fillStyle = '#3f9a3a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#5a3a1a'; x.fillRect(6, 11, 4, 5); x.fillStyle = '#0b0b18'; x.beginPath(); x.arc(8, 7, 7.5, 0, TAU); x.fill(); x.fillStyle = '#1f6a2a'; x.beginPath(); x.arc(8, 7, 6.5, 0, TAU); x.fill(); x.fillStyle = '#2e8a3a'; x.beginPath(); x.arc(7, 6, 4.5, 0, TAU); x.fill(); x.fillStyle = '#5fc052'; x.fillRect(5, 3, 2, 2); });
  TILES[22] = block('#8a90a8', '#4a5068', '#c0c8e0', (x) => { x.fillStyle = '#6a7090'; x.fillRect(3, 3, 10, 6); x.fillStyle = '#9aa0c0'; x.fillRect(4, 4, 8, 1); });
  TILES[23] = block('#a06ae0', '#5a3a9a', '#e0c0ff', (x, r) => { x.fillStyle = '#ffffff'; x.fillRect(3 + Math.floor(r() * 8), 2 + Math.floor(r() * 6), 1, 3); x.fillStyle = '#d0a0ff'; x.fillRect(8, 4, 3, 4); });
  TILES[24] = [GFX.flowerWall];
  TILES[25] = block('#c0c8e0', '#6a7090', '#ffffff', (x) => { x.fillStyle = '#ffe14d'; x.fillRect(7, 5, 2, 2); });
  TILES[26] = mk((x, r) => { x.fillStyle = '#07071a'; x.fillRect(0, 0, 16, 16); if (r() < .5) { x.fillStyle = r() < .5 ? '#ffffff' : '#8a8ac0'; x.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); } }, 4);
}

class Map2D {
  constructor(tw, th) { this.tw = tw; this.th = th; this.w = tw * TILE; this.h = th * TILE; this.t = new Uint8Array(tw * th); this.over = null; this.overT = 0; this.bnd = null; this.mini = null; }
  get(tx, ty) { return (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) ? 26 : this.t[ty * this.tw + tx]; }
  set(tx, ty, v) { if (tx >= 0 && ty >= 0 && tx < this.tw && ty < this.th) this.t[ty * this.tw + tx] = v; }
  solid(x, y) {
    const b = this.bnd; if (b && (x < b.x0 || y < b.y0 || x > b.x1 || y > b.y1)) return true;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return true;
    const i = ty * this.tw + tx; return this.t[i] >= SOLID || (this.over !== null && this.over[i] !== 0);
  }
  hitBox(x, y, r) { return this.solid(x - r, y - r) || this.solid(x + r, y - r) || this.solid(x - r, y + r) || this.solid(x + r, y + r); }
  tileAt(x, y) { return this.get(Math.floor(x / TILE), Math.floor(y / TILE)); }
  // 円の移動(軸分離)。ぶつかったら true
  move(e, dx, dy, r) {
    let hit = false;
    if (dx) { const nx = e.x + dx; if (!this.hitBox(nx, e.y, r)) e.x = nx; else { hit = true; e.vx = (e.vx || 0) * -0.25; } }
    if (dy) { const ny = e.y + dy; if (!this.hitBox(e.x, ny, r)) e.y = ny; else { hit = true; e.vy = (e.vy || 0) * -0.25; } }
    return hit;
  }
  unstuck(e, r) {
    if (!this.hitBox(e.x, e.y, r)) return;
    const tx0 = Math.floor(e.x / TILE), ty0 = Math.floor(e.y / TILE);
    for (let rad = 1; rad < 30; rad++) for (let k = 0; k < rad * 8; k++) {
      const a = k / (rad * 8) * TAU, tx = tx0 + Math.round(Math.cos(a) * rad), ty = ty0 + Math.round(Math.sin(a) * rad);
      const x = tx * TILE + 8, y = ty * TILE + 8; if (!this.hitBox(x, y, r)) { e.x = x; e.y = y; return; }
    }
  }
  freePos(r, rng = Math.random, margin = 40, area) {
    for (let i = 0; i < 300; i++) {
      let x, y;
      if (area) { const a = rng() * TAU, d = Math.sqrt(rng()) * area.r; x = area.x + Math.cos(a) * d; y = area.y + Math.sin(a) * d; }
      else { const b = this.bnd || { x0: 0, y0: 0, x1: this.w, y1: this.h }; x = b.x0 + margin + rng() * (b.x1 - b.x0 - margin * 2); y = b.y0 + margin + rng() * (b.y1 - b.y0 - margin * 2); }
      if (!this.hitBox(x, y, r + 4) && this.tileAt(x, y) !== 8) return { x, y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }
  // 線分の視線チェック(粗い)
  los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 12);
    for (let i = 1; i < n; i++) if (this.solid(x0 + dx * i / n, y0 + dy * i / n)) return false;
    return true;
  }
  buildMini() {
    const c = mkCanvas(this.tw, this.th), x = c.getContext('2d'), img = x.createImageData(this.tw, this.th), d = img.data;
    const cache = {};
    for (let i = 0; i < this.t.length; i++) {
      const v = this.over && this.over[i] ? 24 : this.t[i]; const col = cache[v] || (cache[v] = hexRGB(TILE_MINI[v] || '#000'));
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0); this.mini = c;
  }
}

// ---- 値ノイズ ----
function makeNoise(rng, gw, gh) {
  const g = new Float32Array((gw + 1) * (gh + 1)); for (let i = 0; i < g.length; i++) g[i] = rng();
  return (u, v) => { // u,v in [0,1]
    const x = u * gw, y = v * gh, i = Math.min(gw - 1, Math.floor(x)), j = Math.min(gh - 1, Math.floor(y)), fx = x - i, fy = y - j;
    const s = t => t * t * (3 - 2 * t), a = g[j * (gw + 1) + i], b = g[j * (gw + 1) + i + 1], c = g[(j + 1) * (gw + 1) + i], d = g[(j + 1) * (gw + 1) + i + 1];
    return lerp(lerp(a, b, s(fx)), lerp(c, d, s(fx)), s(fy));
  };
}

// ---- トレーニングマップ ----
function genTrainingMap(seed, sizePx) {
  const rng = RNG(seed), tw = Math.ceil(sizePx / TILE), th = tw, m = new Map2D(tw, th);
  const n1 = makeNoise(rng, 8, 8), n2 = makeNoise(rng, 20, 20);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const u = tx / tw, v = ty / th, a = n1(u, v), b = n2(u, v);
    let t = a < .32 ? 1 : 0; if (a > .72) t = 5; if (a > .6 && a <= .72 && b > .55) t = 2; if (t === 0 && b > .78) t = 4;
    m.set(tx, ty, t);
  }
  // 道
  const roads = [];
  const nr = 2 + Math.floor(tw / 70);
  for (let k = 0; k < nr; k++) { roads.push(['h', Math.floor(tw * (k + 1) / (nr + 1)) + rng.int(-4, 4)]); roads.push(['v', Math.floor(tw * (k + 1) / (nr + 1)) + rng.int(-4, 4)]); }
  const isRoad = new Uint8Array(tw * th);
  for (const [d, p] of roads) for (let i = 0; i < tw; i++) for (let w = -1; w <= 1; w++) { const tx = d === 'h' ? i : p + w, ty = d === 'h' ? p + w : i; m.set(tx, ty, 3); if (tx >= 0 && ty >= 0 && tx < tw && ty < th) isRoad[ty * tw + tx] = 1; }
  const free = (tx, ty) => tx > 2 && ty > 2 && tx < tw - 3 && ty < th - 3 && !isRoad[ty * tw + tx];
  // 森
  const area = tw * th;
  for (let k = 0; k < area / 500; k++) {
    const cx = rng.int(3, tw - 4), cy = rng.int(3, th - 4), r = rng.range(1, 3.2);
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= r * r && rng() < .8 && free(cx + x, cy + y)) m.set(cx + x, cy + y, 21);
  }
  // 岩・壁
  for (let k = 0; k < area / 700; k++) {
    const cx = rng.int(3, tw - 6), cy = rng.int(3, th - 6), w = rng.int(1, 5), h = rng.int(1, 3), tt = rng() < .7 ? 20 : 22;
    const L = rng() < .4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (free(cx + x, cy + y)) m.set(cx + x, cy + y, tt);
    if (L) for (let y = 0; y < 4; y++) if (free(cx, cy + y)) m.set(cx, cy + y, tt);
  }
  // 中央広場
  const c = tw >> 1; for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = x * x + y * y; if (d <= 25) m.set(c + x, c + y, d <= 2 ? 11 : 3); }
  m.buildMini(); return m;
}

// ---- 闘技場 ----
const ARENAS = [
  { name: 'スターコロシアム', col: '#ffe14d', desc: '柱だけのシンプルな円形闘技場' },
  { name: 'クリスタルガーデン', col: '#c88aff', desc: '水晶の林が視界と弾をさえぎる' },
  { name: 'クロスフォート', col: '#8ad0ff', desc: '十字の砦。角を使った撃ち合い' },
  { name: 'マグマバレー', col: '#ff6a2e', desc: '溶岩に入るとダメージ!' },
  { name: 'フラワーパーク', col: '#ff7ad9', desc: '花垣の輪が何重にも並ぶ' },
];
function arenaRadius(n) { return Math.round(260 + n * 16); }
function genArena(idx, seed, n) {
  const rng = RNG(seed), R = arenaRadius(n), tw = Math.ceil(R * 2 / TILE) + 6, m = new Map2D(tw, tw);
  const cx = m.w / 2, cy = m.h / 2, Rt = R / TILE, ctile = tw / 2;
  const floor = [6, 9, 6, 2, 0][idx];
  for (let ty = 0; ty < tw; ty++) for (let tx = 0; tx < tw; tx++) {
    const dx = tx + .5 - ctile, dy = ty + .5 - ctile, dd = Math.sqrt(dx * dx + dy * dy);
    let t = dd > Rt ? 26 : dd > Rt - 1 ? 22 : floor;
    if (t === 6 && ((tx + ty) & 1)) t = 7;
    if (idx === 4 && t === 0 && ((tx * 7 + ty * 3) % 11 === 0)) t = 4;
    m.set(tx, ty, t);
  }
  const put = (fx, fy, t, rad = 0) => { const tx = Math.floor(fx), ty = Math.floor(fy); for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const cur = m.get(tx + x, ty + y); if (cur < SOLID) m.set(tx + x, ty + y, t); } };
  const clearC = 3;
  if (idx === 0) {
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; put(ctile + Math.cos(a) * Rt * .55, ctile + Math.sin(a) * Rt * .55, 25, 1); }
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + .3; put(ctile + Math.cos(a) * Rt * .28, ctile + Math.sin(a) * Rt * .28, 25, 0); }
    put(ctile, ctile, 11, 0);
  } else if (idx === 1) {
    const nc = Math.floor(Rt * Rt / 30);
    for (let k = 0; k < nc; k++) { const a = rng() * TAU, d = Math.sqrt(rng()) * (Rt - 3); if (d < clearC) continue; const x = ctile + Math.cos(a) * d, y = ctile + Math.sin(a) * d; put(x, y, 23, 0); if (rng() < .5) put(x + 1, y, 23, 0); if (rng() < .4) put(x, y + 1, 23, 0); }
  } else if (idx === 2) {
    const L = Rt * .45, g = 3;
    for (let q = 0; q < 4; q++) {
      const sx = q & 1 ? 1 : -1, sy = q & 2 ? 1 : -1;
      for (let i = g; i < L; i++) { put(ctile + sx * i, ctile + sy * g, 22); put(ctile + sx * g, ctile + sy * i, 22); }
      for (let i = 0; i < 4; i++) put(ctile + sx * Rt * .62, ctile + sy * (Rt * .25 + i), 22);
    }
    put(ctile, ctile, 25, 0);
  } else if (idx === 3) {
    const np = Math.floor(Rt * Rt / 90);
    for (let k = 0; k < np; k++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * (Rt - 4); if (d < clearC + 1) continue; const x = ctile + Math.cos(a) * d, y = ctile + Math.sin(a) * d, r = rng.range(1.2, 2.6);
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= r * r && m.get(Math.floor(x + xx), Math.floor(y + yy)) < SOLID) m.set(Math.floor(x + xx), Math.floor(y + yy), 8);
    }
    for (let k = 0; k < np; k++) { const a = rng() * TAU, d = Math.sqrt(rng()) * (Rt - 3); if (d < clearC) continue; put(ctile + Math.cos(a) * d, ctile + Math.sin(a) * d, 20, rng() < .3 ? 1 : 0); }
  } else if (idx === 4) {
    for (let ring = 1; ring <= 3; ring++) {
      const rr = Rt * ring / 4, gaps = 3 + ring, off = rng() * TAU, steps = Math.ceil(rr * TAU * 1.5);
      for (let s = 0; s < steps; s++) { const a = s / steps * TAU; const ga = ((a - off) % (TAU / gaps) + TAU / gaps) % (TAU / gaps); if (ga < .5 / ring + .15) continue; put(ctile + Math.cos(a) * rr, ctile + Math.sin(a) * rr, 24); }
    }
  }
  m.cx = cx; m.cy = cy; m.R = R; m.buildMini(); return m;
}

// ---- フラワーラビリンス(行き止まり無しの迷路) ----
function genLabyrinth(map, seed) {
  const rng = RNG(seed), cell = 8, cw = Math.floor(map.tw / cell), ch = Math.floor(map.th / cell);
  const over = new Uint8Array(map.tw * map.th);
  // 各セルの右壁/下壁
  const right = new Uint8Array(cw * ch).fill(1), down = new Uint8Array(cw * ch).fill(1), seen = new Uint8Array(cw * ch);
  const stack = [[rng.int(0, cw - 1), rng.int(0, ch - 1)]]; seen[stack[0][1] * cw + stack[0][0]] = 1;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1]; const nb = [];
    if (x > 0 && !seen[y * cw + x - 1]) nb.push([x - 1, y, 'l']); if (x < cw - 1 && !seen[y * cw + x + 1]) nb.push([x + 1, y, 'r']);
    if (y > 0 && !seen[(y - 1) * cw + x]) nb.push([x, y - 1, 'u']); if (y < ch - 1 && !seen[(y + 1) * cw + x]) nb.push([x, y + 1, 'd']);
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, d] = nb[Math.floor(rng() * nb.length)];
    if (d === 'l') right[y * cw + x - 1] = 0; else if (d === 'r') right[y * cw + x] = 0; else if (d === 'u') down[(y - 1) * cw + x] = 0; else down[y * cw + x] = 0;
    seen[ny * cw + nx] = 1; stack.push([nx, ny]);
  }
  // 行き止まり除去(ブレイド化) + ループ追加
  const walls = (x, y) => { let n = 0; if (x === 0 || right[y * cw + x - 1]) n++; if (x === cw - 1 || right[y * cw + x]) n++; if (y === 0 || down[(y - 1) * cw + x]) n++; if (y === ch - 1 || down[y * cw + x]) n++; return n; };
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (walls(x, y) >= 3 || rng() < .12) {
      const opts = []; if (x > 0 && right[y * cw + x - 1]) opts.push(() => right[y * cw + x - 1] = 0); if (x < cw - 1 && right[y * cw + x]) opts.push(() => right[y * cw + x] = 0);
      if (y > 0 && down[(y - 1) * cw + x]) opts.push(() => down[(y - 1) * cw + x] = 0); if (y < ch - 1 && down[y * cw + x]) opts.push(() => down[y * cw + x] = 0);
      if (opts.length) opts[Math.floor(rng() * opts.length)]();
    }
  }
  const corners = [];
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const bx = x * cell, by = y * cell;
    if (x < cw - 1 && right[y * cw + x]) for (let k = 0; k <= cell; k++) { const tx = bx + cell, ty = by + k; if (map.get(tx, ty) < SOLID) over[ty * map.tw + tx] = 1; }
    if (y < ch - 1 && down[y * cw + x]) for (let k = 0; k <= cell; k++) { const tx = bx + k, ty = by + cell; if (map.get(tx, ty) < SOLID) over[ty * map.tw + tx] = 1; }
    if (walls(x, y) >= 2) corners.push({ x: (bx + cell / 2) * TILE, y: (by + cell / 2) * TILE });
  }
  return { over, corners };
}
