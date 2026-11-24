'use strict';
// ============================================================
//  STAR SHOOTING - core (定数 / ユーティリティ / 入力 / 音 / スプライト)
// ============================================================
const W = 960, H = 540;          // メインキャンバス(固定解像度)
const LW = 448, LH = 252;        // ワールド描画用 低解像度バッファ (約 x2.14 で拡大)
const SCALE = W / LW;
const TAU = Math.PI * 2;
const TILE = 16;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a, r = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function RNG(seed) {
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.range = (a, b) => a + f() * (b - a);
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  return f;
}
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1); }
function shade(h, f) { const [r, g, b] = hexRGB(h); return f >= 0 ? rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbHex(r * (1 + f), g * (1 + f), b * (1 + f)); }
const FONT = '"DotGothic16", "MS Gothic", monospace';

// ------------------------------------------------------------
// 入力 (矢印 + Z + X のみ。M でミュートのみ例外)
// ------------------------------------------------------------
const IN = { L: 1, R: 2, U: 4, D: 8, Z: 16, X: 32 };
const Input = {
  mask: 0, prev: 0, typing: false, pressed: 0, latch: 0, kmask: 0, tmask: 0,
  // キーボード(kmask)とタッチ(tmask)を合成。新しく押されたボタンは取りこぼさないよう記録
  set(km, tm) { const nm = km | tm, nb = nm & ~this.mask; this.pressed |= nb; this.latch |= nb; this.kmask = km; this.tmask = tm; this.mask = nm; },
  down(b) { return ((this.mask | this.pressed) & b) !== 0; },
  hit(b) { return ((this.pressed & b) !== 0) || ((this.mask & b) !== 0 && (this.prev & b) === 0); },
  take() { const m = this.mask | this.latch; this.latch = 0; return m; }, // 短い押下も取りこぼさない(ゲーム入力用)
  endFrame() { this.prev = this.mask; this.pressed = 0; },
};
const KEYMAP = { ArrowLeft: IN.L, ArrowRight: IN.R, ArrowUp: IN.U, ArrowDown: IN.D, KeyZ: IN.Z, KeyX: IN.X };
addEventListener('keydown', e => {
  if (Input.typing) return;
  const b = KEYMAP[e.code];
  if (b) { Input.set(Input.kmask | b, Input.tmask); e.preventDefault(); }
  if (e.code === 'KeyM') Sound.toggleMute();
  Sound.unlock();
});
addEventListener('keyup', e => { const b = KEYMAP[e.code]; if (b) { Input.set(Input.kmask & ~b, Input.tmask); e.preventDefault(); } });
addEventListener('blur', () => { Input.set(0, 0); });
function maskDir(m) {
  let x = 0, y = 0;
  if (m & IN.L) x--; if (m & IN.R) x++; if (m & IN.U) y--; if (m & IN.D) y++;
  return (x || y) ? Math.atan2(y, x) : null;
}

// ------------------------------------------------------------
// サウンド (WebAudio で全部合成。外部ファイル無し)
// ------------------------------------------------------------
const Sound = {
  ctx: null, master: null, sfxG: null, bgmG: null, muted: false, last: {}, vol: { bgm: 0.5, sfx: 0.7 },
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      // 迫力用: コンプレッサーで音圧を上げ、爆発系は歪み(クランチ)を通す
      this.comp = this.ctx.createDynamicsCompressor(); this.comp.threshold.value = -20; this.comp.ratio.value = 5; this.comp.attack.value = .002; this.comp.release.value = .15;
      this.comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain(); this.master.connect(this.comp);
      this.sfxG = this.ctx.createGain(); this.sfxG.connect(this.master);
      this.crunch = this.ctx.createWaveShaper(); { const k = 18, n2 = 1024, cv = new Float32Array(n2); for (let i = 0; i < n2; i++) { const x = i / n2 * 2 - 1; cv[i] = (1 + k) * x / (1 + k * Math.abs(x)); } this.crunch.curve = cv; }
      this.crunch.connect(this.sfxG);
      this.bgmG = this.ctx.createGain(); this.bgmG.connect(this.master);
      const n = this.ctx.sampleRate; const buf = this.ctx.createBuffer(1, n, n); const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf; this.applyVol();
      if (this.pendingBgm) { const p = this.pendingBgm; this.pendingBgm = null; Music.play(p); }
    } catch (e) { this.ctx = null; }
  },
  applyVol() { if (!this.ctx) return; this.master.gain.value = this.muted ? 0 : 1; this.sfxG.gain.value = this.vol.sfx * 0.95; this.bgmG.gain.value = this.vol.bgm * 0.32; },
  toggleMute() { this.muted = !this.muted; this.applyVol(); },
  tone(f, dur, type = 'square', v = 0.3, slide = 0, delay = 0, dest) {
    const c = this.ctx, t = c.currentTime + delay; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, v = 0.3, freq = 1200, delay = 0, q = 1, dest) {
    const c = this.ctx, t = c.currentTime + delay; const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  // 連続取得の音: 音階が上がっていく「ぎゅいん」
  combo(n) {
    if (!this.ctx || this.muted) return;
    const sc = [0, 2, 4, 5, 7, 9, 11], k = Math.min(n, 27), semi = 12 * Math.floor(k / 7) + sc[k % 7], f = 523 * Math.pow(2, semi / 12);
    this.tone(f * .7, 0.09, 'square', 0.16, 1.45); this.tone(f, 0.16, 'square', 0.12, 1.02, 0.05); this.tone(f * 2, 0.2, 'triangle', 0.14, 1, 0.05); this.tone(f * 3, 0.12, 'sine', 0.06, 1, 0.08);
  },
  play(name, vol = 1) {
    if (!this.ctx || this.muted || vol < 0.03) return;
    const now = performance.now(); const gap = SFX_GAP[name] || 40;
    if (this.last[name] && now - this.last[name] < gap) return; this.last[name] = now;
    const f = SFX[name]; if (f) f(this, Math.min(1, vol));
  },
};
const SFX_GAP = { shot: 55, hit: 40, pick: 45, boom: 50 };
const SFX = {
  shot: (s, v) => { s.tone(1100 + Math.random() * 300, 0.07, 'square', 0.11 * v, 0.35); s.noise(0.04, 0.12 * v, 6000); },
  shotB: (s, v) => { s.tone(260, 0.16, 'sawtooth', 0.16 * v, 0.3, 0, s.crunch); s.noise(0.1, 0.2 * v, 1800); },
  hit: (s, v) => { s.noise(0.08, 0.3 * v, 5000); s.tone(420, 0.07, 'square', 0.12 * v, 0.4, 0, s.crunch); },
  hurt: (s, v) => { s.tone(180, 0.22, 'sawtooth', 0.35 * v, 0.3, 0, s.crunch); s.noise(0.2, 0.4 * v, 2000); },
  boom: (s, v) => { s.noise(0.7, 0.7 * v, 1400); s.tone(110, 0.5, 'sine', 0.7 * v, 0.25); s.tone(70, 0.4, 'sawtooth', 0.35 * v, 0.4, 0, s.crunch); },
  bigboom: (s, v) => { s.noise(1.6, 0.9 * v, 1100); s.tone(80, 1.3, 'sine', 0.9 * v, 0.25); s.tone(50, 1.2, 'sawtooth', 0.5 * v, 0.4, 0, s.crunch); s.noise(0.5, 0.6 * v, 6000, 0.05); },
  pick: (s, v) => { s.tone(990, 0.06, 'square', 0.14 * v, 1.5); s.tone(1480, 0.08, 'square', 0.12 * v, 1, 0.05); },
  whoosh: (s, v) => { s.noise(0.35, 0.35 * v, 3000, 0, 3); s.tone(300, 0.3, 'sawtooth', 0.08 * v, 3); },
  item: (s, v) => { [660, 880, 1320].forEach((f, i) => s.tone(f, 0.1, 'square', 0.1 * v, 1, i * 0.06)); },
  chest: (s, v) => { [523, 659, 784, 1047, 1319].forEach((f, i) => s.tone(f, 0.12, 'square', 0.1 * v, 1, i * 0.05)); },
  ride: (s, v) => { s.tone(200, 0.3, 'sawtooth', 0.15 * v, 4); s.tone(600, 0.2, 'square', 0.1 * v, 2, 0.15); },
  event: (s, v) => { [392, 523, 659, 784, 1047].forEach((f, i) => { s.tone(f, 0.18, 'square', 0.12 * v, 1, i * 0.09); s.tone(f / 2, 0.18, 'triangle', 0.15 * v, 1, i * 0.09); }); s.tone(1047, 0.6, 'square', 0.1 * v, 1, 0.5); },
  eventEnd: (s, v) => { [784, 659, 523].forEach((f, i) => s.tone(f, 0.15, 'triangle', 0.15 * v, 1, i * 0.1)); },
  count: (s, v) => s.tone(660, 0.12, 'square', 0.15 * v),
  go: (s, v) => { s.tone(1320, 0.5, 'square', 0.15 * v); s.tone(660, 0.5, 'triangle', 0.2 * v); },
  warn: (s, v) => { s.tone(880, 0.15, 'square', 0.12 * v); s.tone(880, 0.15, 'square', 0.12 * v, 1, 0.25); },
  slash: (s, v) => { s.noise(0.2, 0.3 * v, 5000, 0, 4); s.tone(1200, 0.15, 'sawtooth', 0.08 * v, 0.3); },
  charge: (s, v) => s.tone(200, 0.3, 'sine', 0.1 * v, 3),
  laser: (s, v) => { s.tone(1500, 0.8, 'sawtooth', 0.2 * v, 0.1); s.noise(0.8, 0.4 * v, 4000); },
  kill: (s, v) => { [523, 784, 1047, 1568].forEach((f, i) => { s.tone(f, 0.14, 'square', 0.18 * v, 1, i * 0.05); s.tone(f / 2, 0.14, 'sawtooth', 0.1 * v, 1, i * 0.05); }); s.noise(0.4, 0.4 * v, 4000); },
  move: (s, v) => s.tone(600, 0.04, 'square', 0.08 * v),
  ok: (s, v) => { s.tone(880, 0.06, 'square', 0.1 * v); s.tone(1320, 0.08, 'square', 0.1 * v, 1, 0.05); },
  back: (s, v) => s.tone(440, 0.08, 'square', 0.1 * v, 0.6),
  win: (s, v) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => s.tone(f, 0.22, 'square', 0.12 * v, 1, i * 0.13)); },
  roulette: (s, v) => s.tone(1000, 0.03, 'square', 0.06 * v),
};

// --- 小さなチップチューン BGM シーケンサ ---
const Music = {
  cur: null, timer: null, step: 0, next: 0,
  SONGS: {
    title: { bpm: 112, prog: [0, -4, -2, 3], key: 57, arp: [0, 7, 12, 7, 3, 7, 12, 15], drum: 'x.h.x.h.' },
    train: { bpm: 138, prog: [0, 5, 3, 7], key: 55, arp: [0, 12, 7, 12, 4, 12, 7, 16], drum: 'x.h.s.h.' },
    battle: { bpm: 160, prog: [0, -2, -4, -5], key: 52, arp: [0, 3, 7, 12, 7, 3, 10, 7], drum: 'x.hxs.hh' },
    result: { bpm: 100, prog: [0, 5, 7, 5], key: 60, arp: [0, 4, 7, 12, 16, 12, 7, 4], drum: 'x...h...' },
  },
  play(name) {
    if (this.cur === name) return; this.stop(); this.cur = name;
    if (!Sound.ctx) { Sound.pendingBgm = name; return; }
    this.step = 0; this.next = Sound.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 60);
  },
  stop() { clearInterval(this.timer); this.timer = null; this.cur = null; },
  tick() {
    const s = Sound, c = s.ctx, song = this.SONGS[this.cur]; if (!c || !song) return;
    const spb = 60 / song.bpm / 2; // 8分
    while (this.next < c.currentTime + 0.25) {
      const st = this.step, bar = Math.floor(st / 16) % song.prog.length, root = song.key + song.prog[bar];
      const dt = this.next - c.currentTime; const f = n => 440 * Math.pow(2, (n - 69) / 12);
      if (st % 2 === 0) s.tone(f(root - 24), spb * 1.8, 'triangle', 0.35, 1, dt, s.bgmG);
      const a = song.arp[st % song.arp.length]; s.tone(f(root + a), spb * 0.9, 'square', 0.07, 1, dt, s.bgmG);
      if (st % 16 === 0 || st % 16 === 10) s.tone(f(root + 12 + song.arp[(st >> 1) % 8]), spb * 3, 'square', 0.05, 1, dt, s.bgmG);
      const dch = song.drum[st % song.drum.length];
      if (dch === 'x') { s.tone(150, 0.12, 'sine', 0.5, 0.3, dt, s.bgmG); }
      else if (dch === 's') { s.noise(0.1, 0.18, 2500, dt, 1, s.bgmG); }
      else if (dch === 'h') { s.noise(0.03, 0.08, 8000, dt, 1, s.bgmG); }
      this.step++; this.next += spb;
    }
  },
};

// ------------------------------------------------------------
// ドット絵スプライト生成
// ------------------------------------------------------------
// rows: 文字列配列, pal: 文字->色。自動で黒アウトラインを付ける。mirror=true なら上半分を下へ鏡写し
function pixArt(rows, pal, mirror = false, outline = '#0b0b18') {
  if (mirror) { const b = rows.slice(0, -1).reverse(); rows = rows.concat(b); }
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = mkCanvas(w + 2, h + 2), x = c.getContext('2d');
  const filled = (i, j) => j >= 0 && j < h && i >= 0 && i < w && rows[j][i] && rows[j][i] !== '.';
  if (outline) {
    x.fillStyle = outline;
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      if (filled(i, j)) continue;
      if (filled(i - 1, j) || filled(i + 1, j) || filled(i, j - 1) || filled(i, j + 1)) x.fillRect(i + 1, j + 1, 1, 1);
    }
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i]; if (!ch || ch === '.') continue;
    x.fillStyle = pal[ch] || '#f0f'; x.fillRect(i + 1, j + 1, 1, 1);
  }
  return c;
}
// 白抜きシルエット(被弾フラッシュ用)
function silhouette(src, col = '#fff') {
  const c = mkCanvas(src.width, src.height), x = c.getContext('2d');
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return c;
}
// 色相回転フレーム(ctx.filter 非対応ブラウザでも動くよう手計算)
function hueFrames(src, n) {
  const out = [], sx = src.getContext('2d'), base = sx.getImageData(0, 0, src.width, src.height);
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n, cA = Math.cos(a), sA = Math.sin(a);
    const m = [0.213 + cA * 0.787 - sA * 0.213, 0.715 - cA * 0.715 - sA * 0.715, 0.072 - cA * 0.072 + sA * 0.928,
      0.213 - cA * 0.213 + sA * 0.143, 0.715 + cA * 0.285 + sA * 0.140, 0.072 - cA * 0.072 - sA * 0.283,
      0.213 - cA * 0.213 - sA * 0.787, 0.715 - cA * 0.715 + sA * 0.715, 0.072 + cA * 0.928 + sA * 0.072];
    const c = mkCanvas(src.width, src.height), x = c.getContext('2d'), img = x.createImageData(src.width, src.height), d = img.data, b = base.data;
    for (let k = 0; k < d.length; k += 4) {
      const r = b[k], g = b[k + 1], bl = b[k + 2];
      d[k] = m[0] * r + m[1] * g + m[2] * bl; d[k + 1] = m[3] * r + m[4] * g + m[5] * bl; d[k + 2] = m[6] * r + m[7] * g + m[8] * bl; d[k + 3] = b[k + 3];
    }
    x.putImageData(img, 0, 0); out.push(c);
  }
  return out;
}
