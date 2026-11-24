'use strict';
// ============================================================
//  マップ (タイル / 生成 / 当たり判定)
// ============================================================
// 非固体: 0草 1濃草 2土 3道 4花 5砂 6金属床 7金属床2 8溶岩(ダメージ) 9水晶床 11星床
// 固体  : 20岩 21木 22金属壁 23水晶 24花壁 25柱 26場外(宇宙)
const SOLID = 20;
const TILE_MINI = { 13: '#3d7bff', 14: '#7a5aff', 15: '#ff9ccc', 16: '#3f9a3a', 18: '#d8b878', 19: '#b89a6a', 27: '#ff4d8a', 28: '#ffffff', 29: '#22222a', 30: '#ffd23f', 31: '#e8c08a', 32: '#3a3a44', 33: '#ff8ab0', 34: '#d8b070', 35: '#d89a4a', 36: '#ff9ccc', 37: '#ff9ccc', 38: '#2e8a3a', 39: '#3d9bff', 40: '#e8b82a', 0: '#0b0b26', 1: '#0e0e2e', 2: '#2e1a52', 3: '#16365a', 4: '#1c1c48', 5: '#123a48', 6: '#4a5068', 7: '#3e4458', 8: '#ff5a1a', 9: '#5a4a8a', 11: '#6a6a9a', 12: '#3a2a30', 20: '#8a7a6a', 21: '#4a5a72', 22: '#8a90a8', 23: '#c88aff', 24: '#ff7ad9', 25: '#a0a8c0', 26: '#05050f' };
const TILES = {};
function buildTiles() {
  const mk = (fn, n = 3) => { const out = []; for (let v = 0; v < n; v++) { const c = mkCanvas(16, 16), x = c.getContext('2d'); const r = RNG(v * 977 + 13); fn(x, r, v); out.push(c); } return out; };
  const speck = (x, r, base, cols, n) => { x.fillStyle = base; x.fillRect(0, 0, 16, 16); for (let i = 0; i < n; i++) { x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, r() < .3 ? 2 : 1); } };
  // 宇宙テーマ: 0/1/26 は描かない(背景の星空が見える)。2/4/5 は半透明の星雲・星屑
  TILES[0] = TILES[1] = TILES[26] = null;
  const dust = (x, r, cols, n, a) => { x.globalAlpha = a; for (let i = 0; i < n; i++) { x.fillStyle = cols[Math.floor(r() * cols.length)]; const s = r() < .3 ? 2 : 1; x.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), s, s); } x.globalAlpha = 1; };
  TILES[2] = mk((x, r) => { x.fillStyle = 'rgba(120,60,200,.16)'; x.fillRect(0, 0, 16, 16); dust(x, r, ['#c86bff', '#ff7ad9', '#8a5aff'], 10, .5); });
  TILES[3] = mk((x, r, v) => { x.fillStyle = 'rgba(30,80,150,.22)'; x.fillRect(0, 0, 16, 16); if (v === 0) { x.fillStyle = 'rgba(61,216,255,.55)'; x.fillRect(7, 7, 2, 2); } });
  TILES[4] = mk((x, r) => { const cs = ['#ffffff', '#fff3b0', '#8ad0ff', '#ffb0e0']; for (let i = 0; i < 2; i++) { const a = 2 + Math.floor(r() * 12), b = 2 + Math.floor(r() * 12); x.fillStyle = cs[Math.floor(r() * cs.length)]; x.fillRect(a - 1, b, 3, 1); x.fillRect(a, b - 1, 1, 3); } dust(x, r, cs, 4, .7); });
  TILES[5] = mk((x, r) => { x.fillStyle = 'rgba(40,180,200,.13)'; x.fillRect(0, 0, 16, 16); dust(x, r, ['#3dffe0', '#4dc3ff'], 8, .45); });
  TILES[12] = mk((x, r) => speck(x, r, '#3a2a30', ['#4a3438', '#2a1e22', '#5a3a30'], 14));
  TILES[6] = mk((x, r, v) => { x.fillStyle = '#4a5068'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#565c78'; x.fillRect(1, 1, 14, 1); x.fillStyle = '#383c50'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); x.fillStyle = '#6a7090'; x.fillRect(2, 2, 1, 1); x.fillRect(13, 2, 1, 1); x.fillRect(2, 13, 1, 1); x.fillRect(13, 13, 1, 1); });
  TILES[7] = mk((x, r, v) => { x.fillStyle = '#3e4458'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#4a5068'; x.fillRect(1, 1, 14, 1); x.fillStyle = '#2e3244'; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16); });
  TILES[8] = mk((x, r, v) => { speck(x, r, '#e8461a', ['#ff7a2e', '#ffb43d', '#c8321a'], 20); x.fillStyle = '#ffe14d'; x.fillRect(Math.floor(r() * 12), Math.floor(r() * 12), 3, 1); });
  TILES[9] = mk((x, r) => { speck(x, r, '#4a3e7a', ['#5a4a8a', '#3e3468', '#7a6ab0'], 10); });
  TILES[11] = mk((x, r, v) => { x.fillStyle = '#5a5a8a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#ffe14d'; x.fillRect(7, 3, 2, 10); x.fillRect(3, 7, 10, 2); x.fillStyle = '#fff3b0'; x.fillRect(7, 7, 2, 2); }, 1);
  const block = (top, side, hl, deco) => mk((x, r, v) => { x.fillStyle = side; x.fillRect(0, 0, 16, 16); x.fillStyle = top; x.fillRect(0, 0, 16, 12); x.fillStyle = hl; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 12); x.fillStyle = '#0b0b1860'; x.fillRect(0, 15, 16, 1); if (deco) deco(x, r, v); });
  TILES[20] = mk((x, r) => { // 小惑星
    x.fillStyle = '#3a2e28'; x.beginPath(); x.arc(8, 9, 7.6, 0, TAU); x.fill(); x.fillStyle = '#7a6a5a'; x.beginPath(); x.arc(8, 8, 7, 0, TAU); x.fill(); x.fillStyle = '#9a8a76'; x.beginPath(); x.arc(6, 6, 4, 0, TAU); x.fill();
    x.fillStyle = '#5a4a3e'; for (let i = 0; i < 3; i++) { const a = 4 + Math.floor(r() * 8), b = 5 + Math.floor(r() * 7); x.fillRect(a, b, 2, 2); } x.fillStyle = '#c8b8a0'; x.fillRect(4, 4, 2, 1); });
  TILES[21] = mk((x, r) => { // 氷の小惑星
    x.fillStyle = '#1a2230'; x.beginPath(); x.moveTo(8, 0); x.lineTo(16, 6); x.lineTo(13, 16); x.lineTo(3, 16); x.lineTo(0, 6); x.closePath(); x.fill();
    x.fillStyle = '#4a5a72'; x.beginPath(); x.moveTo(8, 1); x.lineTo(15, 6); x.lineTo(12, 15); x.lineTo(4, 15); x.lineTo(1, 6); x.closePath(); x.fill();
    x.fillStyle = '#7a8aa6'; x.beginPath(); x.moveTo(8, 2); x.lineTo(12, 6); x.lineTo(8, 9); x.lineTo(4, 6); x.closePath(); x.fill(); x.fillStyle = '#a8c8e8'; x.fillRect(7, 3, 1, 1); });
  TILES[22] = block('#8a90a8', '#4a5068', '#c0c8e0', (x) => { x.fillStyle = '#6a7090'; x.fillRect(3, 3, 10, 6); x.fillStyle = '#9aa0c0'; x.fillRect(4, 4, 8, 1); });
  TILES[23] = block('#a06ae0', '#5a3a9a', '#e0c0ff', (x, r) => { x.fillStyle = '#ffffff'; x.fillRect(3 + Math.floor(r() * 8), 2 + Math.floor(r() * 6), 1, 3); x.fillStyle = '#d0a0ff'; x.fillRect(8, 4, 3, 4); });
  TILES[24] = [GFX.flowerWall];
  TILES[25] = block('#c0c8e0', '#6a7090', '#ffffff', (x) => { x.fillStyle = '#ffe14d'; x.fillRect(7, 5, 2, 2); });
  // ---- 星の川・ハート・ランドマーク ----
  TILES[13] = TILES[14] = mk((x, r) => { x.fillStyle = 'rgba(40,90,220,.42)'; x.fillRect(0, 0, 16, 16); dust(x, r, ['#8ad0ff', '#ffffff', '#c8b0ff'], 6, .8); });
  TILES[15] = mk((x, r, v) => { x.fillStyle = (v & 1) ? '#ffb0d8' : '#ff9ccc'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#ffd0e8'; x.fillRect(0, 0, 16, 1); x.fillRect(0, 0, 1, 16); });
  TILES[16] = mk((x, r) => speck(x, r, '#3f9a3a', ['#4fb048', '#358a32', '#5cc052', '#ff7ad9'], 14));
  TILES[18] = mk((x, r) => speck(x, r, '#d8b878', ['#e4c88a', '#c8a868'], 12));
  TILES[19] = mk((x, r) => speck(x, r, '#b89a6a', ['#c8aa7a', '#a8895a'], 10));
  const solidCol = (top, side, hl, deco) => block(top, side, hl, deco);
  TILES[27] = solidCol('#ff4d8a', '#c8266a', '#ffb0d0', (x) => { x.fillStyle = '#ff8ab8'; x.fillRect(5, 4, 3, 3); x.fillRect(9, 4, 3, 3); x.fillRect(6, 6, 5, 3); x.fillRect(7, 9, 3, 1); });
  TILES[28] = solidCol('#f4f4f8', '#c0c0d0', '#ffffff');
  TILES[29] = solidCol('#2a2a34', '#14141c', '#4a4a5a');
  TILES[30] = solidCol('#ffd23f', '#d8a020', '#fff3b0');
  TILES[31] = solidCol('#e8c08a', '#c09060', '#f8dcb0');
  TILES[32] = solidCol('#3a3a44', '#22222a', '#6a6a7a');
  TILES[33] = solidCol('#ff8ab0', '#d86a90', '#ffc0d8');
  TILES[34] = solidCol('#d8b070', '#a07840', '#f0d098', (x) => { x.fillStyle = '#a07840'; x.fillRect(0, 5, 16, 1); x.fillRect(7, 0, 1, 5); x.fillRect(3, 6, 1, 6); x.fillRect(11, 6, 1, 6); });
  TILES[35] = solidCol('#d89a4a', '#a8702a', '#f0c070');
  TILES[36] = solidCol('#ff9ccc', '#e06aa0', '#ffd0e8');
  TILES[37] = solidCol('#ff9ccc', '#e06aa0', '#ffd0e8', (x, r) => { const cs = ['#ffe14d', '#4dc3ff', '#5fe36a', '#ffffff', '#c86bff']; for (let i = 0; i < 4; i++) { x.fillStyle = cs[i]; x.fillRect(2 + Math.floor(r() * 11), 2 + Math.floor(r() * 7), 2, 1); } });
  TILES[38] = mk((x) => { x.fillStyle = '#3f9a3a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#5a3a1a'; x.fillRect(6, 11, 4, 5); x.fillStyle = '#0b0b18'; x.beginPath(); x.arc(8, 7, 7.5, 0, TAU); x.fill(); x.fillStyle = '#1f6a2a'; x.beginPath(); x.arc(8, 7, 6.5, 0, TAU); x.fill(); x.fillStyle = '#2e8a3a'; x.beginPath(); x.arc(7, 6, 4.5, 0, TAU); x.fill(); x.fillStyle = '#5fc052'; x.fillRect(5, 3, 2, 2); }, 1);
  TILES[39] = mk((x, r) => { x.fillStyle = '#a0a8c0'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#3d9bff'; x.fillRect(2, 2, 12, 12); x.fillStyle = '#8ad0ff'; x.fillRect(4, 4, 3, 1); x.fillRect(9, 8, 3, 1); x.fillStyle = '#ffffff'; x.fillRect(7, 6, 2, 2); });
  TILES[40] = solidCol('#e8b82a', '#d8a020', '#fff3b0');
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
  const c = tw / 2, reserved = new Uint8Array(tw * th);
  const reserve = (tx, ty) => { if (tx >= 0 && ty >= 0 && tx < tw && ty < th) reserved[ty * tw + tx] = 1; };
  // 道
  const roads = [];
  const nr = 2 + Math.floor(tw / 70);
  for (let k = 0; k < nr; k++) { roads.push(['h', Math.floor(tw * (k + 1) / (nr + 1)) + rng.int(-4, 4)]); roads.push(['v', Math.floor(tw * (k + 1) / (nr + 1)) + rng.int(-4, 4)]); }
  for (const [d, p] of roads) for (let i = 0; i < tw; i++) for (let w = -1; w <= 1; w++) { const tx = d === 'h' ? i : p + w, ty = d === 'h' ? p + w : i; m.set(tx, ty, 3); reserve(tx, ty); }
  // 星の川 2本(内側: 時計回り / 外周: 反時計回り)。中心を囲む輪
  const r1 = tw * .24, r2 = tw * .44;
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const d = Math.hypot(tx + .5 - c, ty + .5 - c);
    if (Math.abs(d - r1) < 1.7) { m.set(tx, ty, 13); reserve(tx, ty); }
    else if (Math.abs(d - r2) < 2.2) { m.set(tx, ty, 14); reserve(tx, ty); }
  }
  // ど真ん中: 中に入れる巨大ハート
  const hs = clamp(tw * .07, 5, 10);
  for (let y = -hs * 1.3; y <= hs * 1.3; y++) for (let x = -hs * 1.4; x <= hs * 1.4; x++) {
    const X = x / hs, Y = -(y / hs) + .25, f = Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y;
    const tx = Math.floor(c + x), ty = Math.floor(c + y);
    if (f <= 0) { m.set(tx, ty, 15); reserve(tx, ty); }
  }
  for (let y = -hs * 1.3; y <= hs * 1.3; y++) for (let x = -hs * 1.4; x <= hs * 1.4; x++) {
    const tx = Math.floor(c + x), ty = Math.floor(c + y); if (m.get(tx, ty) !== 15) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => m.get(tx + a, ty + b) !== 15 && m.get(tx + a, ty + b) !== 27);
    const gate = Math.abs(tx + .5 - c) < 1.6 || Math.abs(ty + .5 - c) < 1.2; // 上下左右に入口
    if (edge && !gate) m.set(tx, ty, 27);
  }
  m.set(Math.floor(c), Math.floor(c), 11);
  // ランドマーク(同じ種類は1個ずつ)。2本の川のあいだの輪に並べる
  m.landmarks = [];
  const LM = shuffleR(['panda', 'colosseum', 'park', 'pencil', 'donut'], rng), rm = (r1 + r2) / 2, count = Math.min(LM.length, Math.max(2, Math.floor(TAU * rm / 17))), a0 = rng() * TAU;
  for (let i = 0; i < count; i++) {
    const a = a0 + i / count * TAU, lx = Math.round(c + Math.cos(a) * rm), ly = Math.round(c + Math.sin(a) * rm);
    buildLandmark(m, LM[i], lx, ly, rng, reserve);
  }
  const free = (tx, ty) => tx > 2 && ty > 2 && tx < tw - 3 && ty < th - 3 && !reserved[ty * tw + tx];
  // 小惑星帯
  const area = tw * th;
  for (let k = 0; k < area / 600; k++) {
    const cx = rng.int(3, tw - 4), cy = rng.int(3, th - 4), r = rng.range(1, 3.2);
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= r * r && rng() < .8 && free(cx + x, cy + y)) m.set(cx + x, cy + y, 21);
  }
  // 岩・壁
  for (let k = 0; k < area / 800; k++) {
    const cx = rng.int(3, tw - 6), cy = rng.int(3, th - 6), w = rng.int(1, 5), h = rng.int(1, 3), tt = rng() < .7 ? 20 : 22;
    const L = rng() < .4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (free(cx + x, cy + y)) m.set(cx + x, cy + y, tt);
    if (L) for (let y = 0; y < 4; y++) if (free(cx, cy + y)) m.set(cx, cy + y, tt);
  }
  m.cx = c * TILE; m.cy = c * TILE; m.r1 = r1 * TILE; m.r2 = r2 * TILE;
  m.buildMini(); return m;
}
function shuffleR(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// ---- ランドマーク(タイルで描く巨大オブジェ) ----
const LANDMARK_NAME = { panda: '巨大パンダ', colosseum: 'ミニ闘技場', park: 'デカ公園', pencil: '巨大えんぴつ', donut: '巨大ドーナツ' };
function buildLandmark(m, kind, cx, cy, rng, reserve) {
  const S = (x, y, t) => { const tx = cx + x, ty = cy + y; m.set(tx, ty, t); reserve(tx, ty); };
  const area = (R) => { for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) reserve(cx + x, cy + y); };
  area(8);
  if (kind === 'panda') {
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d = x * x / 36 + y * y / 30; if (d <= 1) S(x, y, 28); }
    for (const ex of [-5, 5]) for (let y = -8; y <= -5; y++) for (let x = ex - 2; x <= ex + 2; x++) if ((x - ex) ** 2 + (y + 6.5) ** 2 <= 4.5) S(x, y, 29);
    for (const ex of [-3, 3]) for (let y = -2; y <= 1; y++) for (let x = ex - 1; x <= ex + 1; x++) S(x, y, 29);
    S(-3, -1, 28); S(3, -1, 28); S(0, 2, 29); S(-1, 3, 29); S(1, 3, 29);
  } else if (kind === 'colosseum') {
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y); if (d > 7.4) continue;
      const gate = Math.abs(x) <= 1 || Math.abs(y) <= 1;
      S(x, y, d > 6.2 ? (gate ? 18 : 34) : (d < 1.2 ? 11 : 18));
    }
    for (const [x, y] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) S(x, y, 25);
  } else if (kind === 'park') {
    for (let y = -7; y <= 7; y++) for (let x = -8; x <= 8; x++) S(x, y, (x === 0 || y === 0 || Math.abs(x) === Math.abs(y)) ? 19 : 16);
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) S(x, y, 39);
    for (const [x, y] of [[-6, -5], [-4, -6], [6, -5], [5, -3], [-6, 4], [-3, 6], [6, 5], [3, 6], [-7, 0], [7, -1]]) S(x, y, 38);
  } else if (kind === 'pencil') {
    const L = 7;
    for (let x = -L; x <= L; x++) for (let y = -1; y <= 1; y++) {
      let t = 30; if (x <= -L + 1) t = 33; else if (x === -L + 2) t = 22; else if (x >= L - 2) t = 31;
      if (x >= L - 1 && Math.abs(y) === 1) continue; if (x === L && y === 0) t = 32;
      if (t === 30 && y === 0 && x % 3 === 0) t = 40; // 鉛筆の面のライン
      S(x, y, t);
    }
  } else if (kind === 'donut') {
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const d = Math.hypot(x, y); if (d > 6.3 || d < 2.2) continue;
      S(x, y, d > 5.4 || d < 3 ? 35 : (rng() < .22 ? 37 : 36));
    }
  }
  m.landmarks.push({ kind, name: LANDMARK_NAME[kind], x: (cx + .5) * TILE, y: (cy + .5) * TILE });
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
  const floor = [6, 9, 6, 12, 0][idx];
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

// ============================================================
//  マシンの移動(ホストとクライアントの予測で共通)。移動特性 mv ごとに挙動が変わる
// ============================================================
function stepMachine(p, dir, z, dt, map, ss) {
  const M = MACHINES[p.m], mv = M.mv || 'normal';
  p.mvT = (p.mvT || 0) + dt;
  let turn = 12, grip = 7, coast = 3.5, maxS = Math.min(460, 108 * ss);
  if (mv === 'slide') { grip = 1.25; coast = .55; maxS *= 1.15; turn = 14; }      // 超すべる
  else if (mv === 'tank') { turn = 4.5; grip = 4; }                                  // 重戦車: 旋回が遅い
  else if (mv === 'brake') { grip = 18; coast = 16; }                                // ピタ止め
  else if (mv === 'hover') { grip = 2.2; coast = 1.2; }                              // ふわふわ
  else if (mv === 'drift') { grip = 3; coast = 2; }
  if (mv === 'rail') { if (dir !== null) p.a = Math.round(dir / (Math.PI / 4)) * (Math.PI / 4); }  // 8方向にカクッと曲がる
  else if (dir !== null) p.a += clamp(angDiff(p.a, dir), -turn * dt, turn * dt);
  // 星の川: 流れに乗ると超加速、逆らうと少し遅い。常にゆるく流される
  let flow = null; const t = map.tileAt(p.x, p.y);
  if ((t === 13 || t === 14) && map.cx !== undefined) { const dx = p.x - map.cx, dy = p.y - map.cy, d = Math.hypot(dx, dy) || 1, s = t === 13 ? 1 : -1; flow = [-dy / d * s, dx / d * s]; }
  let tgt = z ? maxS : dir !== null ? maxS * .62 : 0;
  if (flow && tgt > 0) { const al = Math.cos(p.a) * flow[0] + Math.sin(p.a) * flow[1]; if (al > .3) { tgt *= 1 + 1.4 * al * (mv === 'swim' ? 1.6 : 1); p.surf = .2; } else if (al < -.3) tgt *= .8; }
  if (mv === 'dash') { // 一定間隔で突進
    p.dashCd = (p.dashCd || 0) - dt; if (z && p.dashCd <= 0) { p.dashCd = .95; p.dashT = .18; }
    if (p.dashT > 0) { p.dashT -= dt; tgt = maxS * 2.6; grip = 22; }
  }
  const k = Math.min(1, dt * (tgt > 0 ? grip : coast));
  let ax = Math.cos(p.a) * tgt, ay = Math.sin(p.a) * tgt;
  if (mv === 'zigzag' && tgt > 0) { const s = Math.sin(p.mvT * 7) * tgt * .5; ax -= Math.sin(p.a) * s; ay += Math.cos(p.a) * s; }  // ジグザグ
  if (mv === 'swim' && tgt > 0) { const s = Math.sin(p.mvT * 4) * tgt * .3; ax -= Math.sin(p.a) * s; ay += Math.cos(p.a) * s; }    // うねり
  if (mv === 'hover') { ax += Math.cos(p.mvT * 3) * 16; ay += Math.sin(p.mvT * 2.3) * 16; }
  p.vx += (ax - p.vx) * k; p.vy += (ay - p.vy) * k;
  const ovx = p.vx, ovy = p.vy, fx = flow ? flow[0] * 70 * dt : 0, fy = flow ? flow[1] * 70 * dt : 0;
  const hit = map.move(p, p.vx * dt + fx, p.vy * dt + fy, M.big ? 8 : 6);
  if (mv === 'bounce' && hit) { // 壁で跳ね返る(ピンボール)
    if (p.vx !== ovx) p.vx = -ovx * 1.1; if (p.vy !== ovy) p.vy = -ovy * 1.1; p.a = Math.atan2(p.vy, p.vx); p.bounced = .15;
  }
  if (p.surf > 0) p.surf -= dt;
  return hit;
}
