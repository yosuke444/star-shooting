'use strict';
// ============================================================
//  データ定義 (マシン / ショット / アイテム / 敵 / 色) + スプライト生成
// ============================================================
const STAT_NAME = ['アタック', 'スピード', 'ディフェンス', 'レンジ'];
const STAT_SHORT = ['ATK', 'SPD', 'DEF', 'RNG'];
const STAT_COL = ['#ff5a4d', '#4dc3ff', '#5fe36a', '#ffd23f'];
const STAT_CAP = 30;
const PLAYER_COLS = ['#ff4d6d', '#4d9bff', '#ffd23f', '#5fe36a', '#c86bff', '#ff9b3d', '#3dffe0', '#ff7ad9',
  '#b0ff3d', '#ffffff', '#ff3d3d', '#3d5bff', '#ffb0b0', '#9bffb0', '#ffe8a0', '#a0d8ff'];

// ---- ショット定義 ----
// rate:発射間隔 n:弾数 sp:拡散 spd:弾速 life:寿命(=射程) dmg:威力 r:当たり半径 k:種類
const SHOTS = {
  single: { rate: .26, n: 1, sp: 0, spd: 230, life: .55, dmg: 7, r: 2, k: 'b', col: 0 },
  twin: { rate: .24, n: 2, par: 3, sp: 0, spd: 240, life: .55, dmg: 5, r: 2, k: 'b', col: 1 },
  rapid: { rate: .09, n: 1, jit: .09, spd: 270, life: .42, dmg: 2.6, r: 1.5, k: 'b', col: 2 },
  heavy: { rate: .6, n: 1, sp: 0, spd: 150, life: .85, dmg: 15, r: 4.5, k: 'b', col: 3, big: 1 },
  sniper: { rate: .75, n: 1, sp: 0, spd: 500, life: .58, dmg: 17, r: 2, k: 'b', col: 4, trail: 1 },
  blade: { rate: .3, n: 1, sp: 0, spd: 210, life: .15, dmg: 13, r: 9, k: 'blade', col: 5, pierce: 1 },
  homing: { rate: .45, n: 1, sp: 0, spd: 175, life: 1.0, dmg: 8, r: 2.5, k: 'home', col: 6 },
  wave: { rate: .24, n: 2, sp: 0, spd: 210, life: .62, dmg: 5, r: 2.5, k: 'wave', col: 7 },
  boomer: { rate: .55, n: 1, sp: 0, spd: 270, life: 1.0, dmg: 8, r: 3.5, k: 'boom', col: 8, pierce: 1 },
  scatter: { rate: .55, n: 6, sp: .55, spd: 240, life: .3, dmg: 3.6, r: 2, k: 'b', col: 9, varSpd: 1 },
  laser: { rate: .45, n: 1, sp: 0, spd: 540, life: .4, dmg: 8, r: 2.5, k: 'b', col: 10, pierce: 1, trail: 1 },
  spread3: { rate: .3, n: 3, sp: .26, spd: 230, life: .52, dmg: 4.6, r: 2, k: 'b', col: 11 },
  phoenix: { rate: .08, n: 2, jit: .3, spd: 270, life: .27, dmg: 4.4, r: 3.5, k: 'flame', col: 12 },
  levia: { rate: .32, n: 1, sp: 0, spd: 430, life: .72, dmg: 13, r: 4, k: 'b', col: 13, pierce: 1, trail: 1, big: 1 },
  cerb: { rate: .42, n: 3, sp: .32, spd: 205, life: .62, dmg: 9, r: 3.5, k: 'b', col: 14, big: 1 },
  enemy: { rate: 1.6, n: 1, sp: 0, spd: 110, life: 1.6, dmg: 5, r: 3, k: 'b', col: 15 },
};
// 弾色 (コア, グロー)
const BULLET_COL = [['#ffffff', '#9ad0ff'], ['#ffffff', '#7dffb0'], ['#fff6a0', '#ffb43d'], ['#ffd0a0', '#ff6b3d'],
['#ffffff', '#ff3dd8'], ['#ffffff', '#ff4d4d'], ['#ffffff', '#c86bff'], ['#e0fff8', '#3dffe0'], ['#fff0c0', '#ffd23f'],
['#ffe0e0', '#ff8a8a'], ['#ffffff', '#3dd8ff'], ['#ffffff', '#b0ff3d'], ['#fff6a0', '#ff6a00'], ['#e8fbff', '#2e7bff'],
['#ffe0ff', '#a23dff'], ['#ffd6f0', '#ff4fa8'], ['#ffd0ff', '#d23dff']];

// ---- マシン ----  mul: [ATK,SPD,DEF,RNG] 倍率 (1 以上=得意 / 1 未満=苦手)
const MACHINES = [
  { name: 'ミニノーマル', tpl: 'mini', col: '#cfd3e6', acc: '#ff6b6b', mul: [.8, .8, .8, .8], shot: 'single', desc: 'はじまりのマシン。全部苦手' },
  { name: 'スタンダード', tpl: 'wing', col: '#4d7cff', acc: '#ffd23f', mul: [1.05, 1.05, 1.05, 1.05], shot: 'twin', desc: 'バランス型・2連ショット' },
  { name: 'ジェットスター', tpl: 'dart', col: '#3dd8ff', acc: '#ffffff', mul: [.9, 1.45, .7, 1.0], shot: 'rapid', desc: '超高速・連射' },
  { name: 'フォートレス', tpl: 'tank', col: '#7a8a5a', acc: '#ffb43d', mul: [1.1, .7, 1.55, .9], shot: 'heavy', desc: '鉄壁・重砲弾' },
  { name: 'スナイパー', tpl: 'dart', col: '#5a4dff', acc: '#ff3dd8', mul: [1.2, .85, .75, 1.6], shot: 'sniper', desc: '超遠距離・高速弾(当てにくい)' },
  { name: 'スラッシャー', tpl: 'blade', col: '#ff4d4d', acc: '#ffffff', mul: [1.45, 1.2, .9, .5], shot: 'blade', desc: '超近接・斬撃波' },
  { name: 'ホーミー', tpl: 'saucer', col: '#c86bff', acc: '#ffe0ff', mul: [.95, 1.0, .95, 1.15], shot: 'homing', desc: '追尾ミサイル(当てやすい)' },
  { name: 'ウェーブライダー', tpl: 'wing', col: '#2ec4a0', acc: '#e0fff8', mul: [1.1, 1.1, .9, 1.1], shot: 'wave', desc: 'うねる2重螺旋弾' },
  { name: 'ブーメラン', tpl: 'blade', col: '#ffb43d', acc: '#7a3d00', mul: [1.15, 1.1, 1.0, .9], shot: 'boomer', desc: '戻ってくる貫通弾' },
  { name: 'スキャッター', tpl: 'tank', col: '#ff8a8a', acc: '#ffffff', mul: [1.25, .95, 1.1, .6], shot: 'scatter', desc: '近距離散弾' },
  { name: 'レーザーレイ', tpl: 'saucer', col: '#3d9bff', acc: '#e8fbff', mul: [1.1, .9, .85, 1.35], shot: 'laser', desc: '貫通レーザー' },
  { name: 'スプレッダー', tpl: 'mini', col: '#9be03d', acc: '#2e4d00', mul: [1.1, 1.0, 1.0, .95], shot: 'spread3', desc: '3way ショット' },
  // ---- レジェンダリー (微リジェネ付き) ----
  { name: 'フェニックス', tpl: 'phoenix', col: '#ff6a00', acc: '#ffe14d', mul: [1.55, 1.55, .95, .85], shot: 'phoenix', legend: 1, desc: '伝説・近接火炎' },
  { name: 'リヴァイアサン', tpl: 'levia', col: '#2e7bff', acc: '#9ae8ff', mul: [1.55, .95, .95, 1.75], shot: 'levia', legend: 1, desc: '伝説・超射程水流' },
  { name: 'ケルベロス', tpl: 'cerb', col: '#6a3dbf', acc: '#ff4d4d', mul: [1.25, 1.05, 1.8, 1.1], shot: 'cerb', legend: 1, big: 1, desc: '伝説・鉄壁3連砲' },
];
const LEGEND_IDS = [12, 13, 14];
const NORMAL_SPAWN = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11];

// ---- アイテム ----
const ITEMS = {
  mjet: { name: 'ミニジェット', rar: 'N', icon: 'jet', dur: 5, desc: '少しの間スピードUP' },
  mdumb: { name: 'ミニダンベル', rar: 'N', icon: 'dumb', dur: 5, desc: '少しの間アタックUP' },
  mglass: { name: 'ミニメガネ', rar: 'N', icon: 'glass', dur: 5, desc: '少しの間レンジUP' },
  mbar: { name: 'ミニバリア', rar: 'N', icon: 'bar', dur: 2.5, desc: '少しの間無敵' },
  mbomb: { name: 'ミニボム', rar: 'N', icon: 'bomb', desc: 'その場で小爆発' },
  jet: { name: 'ジェット', rar: 'R', icon: 'jet', dur: 9, desc: '一定時間スピードUP' },
  dumb: { name: 'ダンベル', rar: 'R', icon: 'dumb', dur: 9, desc: '一定時間アタックUP' },
  glass: { name: 'メガネ', rar: 'R', icon: 'glass', dur: 9, desc: '一定時間レンジUP' },
  bar: { name: 'バリア', rar: 'R', icon: 'bar', dur: 6, desc: '一定時間無敵' },
  bbomb: { name: 'ビッグボム', rar: 'R', icon: 'bomb', desc: '周囲を大爆発' },
  sword: { name: 'ビッグソード', rar: 'R', icon: 'sword', uses: 3, desc: '前方を斬る(3回)' },
  arrow: { name: 'ビッグアロー', rar: 'R', icon: 'arrow', desc: '7秒チャージ→無限射程の巨大矢' },
  tv: { name: '番組表', rar: 'SR', icon: 'tv', desc: 'この試合のイベント予定が見える' },
  part: { name: 'レジェンドパーツ', rar: 'SR', icon: 'part', desc: '3つ集めると伝説マシン' },
};
const ITEM_KEYS = Object.keys(ITEMS);
const N_ITEMS = ['mjet', 'mdumb', 'mglass', 'mbar', 'mbomb'];
const R_ITEMS = ['jet', 'dumb', 'glass', 'bar', 'bbomb', 'sword', 'arrow'];
const R_WEIGHT = { jet: 3, dumb: 3, glass: 3, bar: 2, bbomb: 2, sword: 2, arrow: 1 };
const RAR_COL = { N: '#8fd16a', R: '#4da6ff', SR: '#ffcc33' };
// ピックアップ種別コード: 0-3=ステータス, 10+i=アイテム, 50=パーツ, 60=鍵
const PK_ITEM = 10, PK_PART = 50, PK_KEY = 60; // パーツは 50+種類(0..2)
const isPart = k => k >= PK_PART && k < PK_PART + 3;
const partsN = p => p.parts[0] + p.parts[1] + p.parts[2];

// ---- 雑魚敵 ----
const ENEMIES = [
  { name: 'ツノスライム', spr: 'slime', hp: 22, spd: 34, drop: 0, r: 6, touch: 4, beh: 'hop' },
  { name: 'ハヤブサ', spr: 'bird', hp: 14, spd: 70, drop: 1, r: 6, touch: 3, beh: 'fly' },
  { name: 'カメタンク', spr: 'turtle', hp: 46, spd: 18, drop: 2, r: 7, touch: 5, beh: 'walk' },
  { name: 'メダマン', spr: 'eye', hp: 18, spd: 28, drop: 3, r: 6, touch: 3, beh: 'shoot' },
  { name: 'スピードラビット', spr: 'rabbit', hp: 12, spd: 120, drop: -1, r: 6, touch: 3, beh: 'flee' },
];

// ============================================================
//  スプライト
// ============================================================
const GFX = {};
const MTPL = {
  mini: { m: 1, rows: ['....dddd.....', '..ddbbbbdd...', '.dbbhhhbbbd..', 'ebbhhccbbbbd.', 'ebbhcccbbbbba', 'ebbhcccbbbbba'] },
  dart: { m: 1, rows: ['aa...........', '.ddb.........', '..dbbh.......', '..dbbbhh.....', 'edbbbbbhhh...', 'ebbbbccchhhh.', 'ebbbbcccbbbba'] },
  wing: { m: 1, rows: ['...ddd.......', '...daad......', '....dbbd.....', '....dbbbd....', '..edbhhbbd...', '..ebbhcchbbd.', '..ebbhcccbbba'] },
  tank: { m: 1, rows: ['ddddddddd....', 'daaaaaaad....', 'dbbbbbbbbd...', 'ebbhhhhbbbd..', 'ebbhccchbbbbb', 'ebbhcccchbbbb', 'ebbhcccchbaaa'] },
  saucer: { m: 1, rows: ['.....ddd.....', '...ddaaadd...', '..dabbbbbad..', '.dabbhhhbbad.', '.abbhcccbbba.', 'dabhcccccbbad', 'abbhcccccbbba'] },
  blade: { m: 1, rows: ['....aaa......', '.....aad.....', '....dbbad....', '...dbbbbad...', '..edbhhbbbd..', '.eebbhccbbbd.', '.eebbhcccbbaa'] },
  phoenix: { m: 1, rows: ['aa...............', '.aae.............', '..aaee...........', '...aabbe.........', '....abbbbh.......', '...eabbbbbhh.....', '..eeabbhhccbhh...', '.eeeabbhcccbbbbd.', 'eeeeabbhcccbbbbbw'] },
  levia: { m: 1, rows: ['.......ddd.......', '......daaad......', '.....dabbbad.....', 'aa..dabbbbbad....', '.aadbbbhhhbbbd...', '..abbbhhccchbbbd.', 'eabbbbhcccccbbbbw'] },
  cerb: { m: 1, rows: ['........ddd......', '.......dbbbhd....', '...ddddbbbbbwa...', '..dbbbbbbbbbd....', '.edbbhhhhbbbbd...', 'eebbhhccchbbbbhd.', 'eebbhhcccchbbbbwa'] },
};
const ENEMY_ART = {
  slime: { rows: ['.....a......', '....aa......', '...dddd.....', '..ddbbbbdd..', '.dbhhbbbbbd.', '.dbhwbbwbbd.', 'dbbbkbbkbbbd', 'dbbbbbbbbbbd', 'dbbbbaabbbbd', '.dddddddddd.'], pal: { b: '#ff5a4d', h: '#ffb0a0', d: '#a8221a', w: '#fff', k: '#111', a: '#ffe14d' } },
  bird: { rows: ['d..........d', 'bd........db', 'bbd..dd..dbb', '.bbdbbbbdbb.', '..bbhwwhbb..', '...bbkkbb...', '....baab....', '.....aa.....'], pal: { b: '#4dc3ff', h: '#c0ecff', d: '#1a5a9a', w: '#fff', k: '#111', a: '#ffb43d' } },
  turtle: { rows: ['....dddd....', '...dhhhhd...', '.adhbhhbhda.', '.dhbbhhbbhd.', '.dhhhbbhhhd.', '.adhbhhbhda.', '...dhhhhd...', '....dbbd....', '.....kk.....'], pal: { b: '#2e8a3a', h: '#5fe36a', d: '#1a4d22', a: '#c8b080', k: '#c8b080' } },
  eye: { rows: ['...dddddd...', '..dbbbbbbd..', '.dbhwwwwbbd.', 'dbhwwkkwwbbd', 'dbhwwkkwwbbd', '.dbwwwwwbbd.', '..dbbbbbbd..', '...dabbad...', '....a..a....'], pal: { b: '#ffd23f', h: '#fff3b0', d: '#a87a00', w: '#fff', k: '#5a1a8a', a: '#ff8a3d' } },
  rabbit: { rows: ['..dd....dd..', '..dh....hd..', '..dh....hd..', '..dhd..dhd..', '..dbbddbbd..', '.dbbbbbbbbd.', '.dbkbbbbkbd.', '.dbbbaabbbd.', '..dbbbbbbd..', '...dddddd...'], pal: { b: '#ffffff', h: '#ffb0d8', d: '#c0c0d8', k: '#ff3d6d', a: '#ff7ad9' } },
};
const PATCH_SYM = [
  ['......w', '.....w.', '....w..', 'w..w...', '.ww....', '.ww....', 'w..w...'],
  ['w..w...', '.w..w..', '..w..w.', '...w..w', '..w..w.', '.w..w..', 'w..w...'],
  ['wwwwwww', 'w.....w', 'w..w..w', 'w.www.w', '.w.w.w.', '..w.w..', '...w...'],
  ['..www..', '.w.w.w.', 'w..w..w', 'wwwwwww', 'w..w..w', '.w.w.w.', '..www..'],
];
const ICON_SYM = {
  jet: ['...w...', '..www..', '..www..', '..www..', '.wwwww.', 'w.w.w.w', '..a.a..'],
  dumb: ['.......', 'w.....w', 'ww...ww', 'wwwwwww', 'ww...ww', 'w.....w', '.......'],
  glass: ['.......', '.......', 'www.www', 'w.www.w', 'www.www', '.......', '.......'],
  bar: ['..www..', '.w...w.', 'w..w..w', 'w.www.w', 'w..w..w', '.w...w.', '..www..'],
  bomb: ['....aw.', '...a...', '..www..', '.wwwww.', '.wwwww.', '.wwwww.', '..www..'],
  sword: ['......w', '.....ww', '....ww.', 'a..ww..', '.aww...', '.aa....', 'a..a...'],
  arrow: ['wwww...', 'ww.....', 'w.w....', 'w..w...', '....w..', '.....w.', '......w'],
  tv: ['a.....a', '.a...a.', 'wwwwwww', 'w.....w', 'w.www.w', 'w.....w', 'wwwwwww'],
  part: ['...w...', '..www..', 'wwwwwww', '.wwwww.', '..www..', '.ww.ww.', 'w.....w'],
};

function buildMachineSprite(mi) {
  const M = MACHINES[mi], t = MTPL[M.tpl];
  const pal = { b: M.col, h: shade(M.col, .45), d: shade(M.col, -.45), c: '#bff6ff', a: M.acc, e: '#ff9b3d', w: '#ffffff' };
  return pixArt(t.rows, pal, t.m);
}
function plateIcon(sym, bg, fg = '#fff', size = 11, acc = '#ffe14d') {
  const c = mkCanvas(size + 2, size + 2), x = c.getContext('2d');
  x.fillStyle = '#0b0b18'; x.fillRect(1, 0, size, size + 2); x.fillRect(0, 1, size + 2, size);
  x.fillStyle = bg; x.fillRect(1, 1, size, size); x.fillStyle = shade(bg, .4); x.fillRect(1, 1, size, 1); x.fillStyle = shade(bg, -.35); x.fillRect(1, size, size, 1);
  const off = Math.floor((size + 2 - 7) / 2);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) { const ch = sym[j][i]; if (ch === '.') continue; x.fillStyle = ch === 'a' ? acc : fg; x.fillRect(off + i, off + j, 1, 1); }
  return c;
}
function buildChest(w, h, body, band, trim, gem, fancy) {
  const c = mkCanvas(w + 2, h + 2), x = c.getContext('2d');
  x.fillStyle = '#0b0b18'; x.fillRect(0, 1, w + 2, h); x.fillRect(1, 0, w, h + 2);
  x.fillStyle = body; x.fillRect(1, 1, w, h);
  x.fillStyle = shade(body, .3); x.fillRect(1, 1, w, Math.floor(h * .35));
  x.fillStyle = shade(body, -.3); x.fillRect(1, h, w, 1);
  x.fillStyle = band; x.fillRect(1, Math.floor(h * .38), w, 2); x.fillRect(2, 1, 2, h); x.fillRect(w - 3, 1, 2, h);
  x.fillStyle = trim; x.fillRect(Math.floor(w / 2) - 1, Math.floor(h * .3), 3, 4);
  if (fancy) { x.fillStyle = gem; x.fillRect(Math.floor(w / 2), Math.floor(h * .3) + 1, 1, 2); x.fillRect(5, 3, 2, 2); x.fillRect(w - 6, 3, 2, 2); x.fillStyle = '#fff'; x.fillRect(5, 3, 1, 1); x.fillRect(w - 6, 3, 1, 1); x.fillStyle = trim; x.fillRect(1, 1, w, 1); x.fillRect(1, h, w, 1); }
  return c;
}
function buildCircle(r, fill, deco) {
  const s = r * 2 + 2, c = mkCanvas(s, s), x = c.getContext('2d');
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const dx = i - r - .5 + .5, dy = j - r - .5 + .5, dd = Math.sqrt(dx * dx + dy * dy);
    if (dd <= r + .5) { x.fillStyle = dd > r - .7 ? '#0b0b18' : (deco ? deco(dx, dy, dd) : fill); x.fillRect(i, j, 1, 1); }
  }
  return c;
}
function buildBoss() {
  const s = 56, c = mkCanvas(s, s), x = c.getContext('2d');
  const body = '#7a3dbf', dark = '#3d1a6a', lite = '#b07aff';
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const dx = i - s / 2, dy = j - s / 2 - 2, e = (dx * dx) / (24 * 24) + (dy * dy) / (21 * 21);
    if (e <= 1) { x.fillStyle = e > .9 ? '#0b0b18' : (dy < -8 && e < .6 ? lite : (e > .75 ? dark : body)); x.fillRect(i, j, 1, 1); }
  }
  // 角
  x.fillStyle = '#0b0b18'; for (let k = 0; k < 10; k++) { x.fillRect(8 + k, 10 - k, 3, 2); x.fillRect(s - 11 - k, 10 - k, 3, 2); }
  x.fillStyle = '#ffe0a0'; for (let k = 0; k < 9; k++) { x.fillRect(9 + k, 10 - k, 1, 1); x.fillRect(s - 10 - k, 10 - k, 1, 1); }
  // 目
  [[18, 22], [32, 22]].forEach(([ex, ey]) => { x.fillStyle = '#0b0b18'; x.fillRect(ex - 1, ey - 1, 8, 7); x.fillStyle = '#fff'; x.fillRect(ex, ey, 6, 5); x.fillStyle = '#ff2d2d'; x.fillRect(ex + 2, ey + 1, 3, 3); });
  // 口
  x.fillStyle = '#0b0b18'; x.fillRect(16, 34, 24, 6); x.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { x.fillRect(17 + k * 4, 34, 2, 3); x.fillRect(19 + k * 4, 38, 2, 2); }
  // 腕
  x.fillStyle = dark; x.fillRect(2, 30, 6, 10); x.fillRect(s - 8, 30, 6, 10);
  return c;
}
function buildFish() {
  const w = 76, h = 40, c = mkCanvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = i - 34, dy = j - h / 2; let inside = (dx * dx) / (30 * 30) + (dy * dy) / (17 * 17) <= 1;
    const tail = i < 12 && Math.abs(dy) < (12 - i) * 1.4 + 2 && Math.abs(dy) > (12 - i) * .5 - 3;
    if (inside || tail) {
      const hue = ((i * 7 + j * 3) % 360);
      const edge = !((dx - 1) * (dx - 1) / 900 + dy * dy / 289 <= .86) && inside;
      x.fillStyle = edge ? '#0b0b18' : `hsl(${hue},90%,${55 + ((i + j) % 4 === 0 ? 15 : 0)}%)`; x.fillRect(i, j, 1, 1);
    }
  }
  x.fillStyle = '#fff'; x.fillRect(52, 13, 6, 6); x.fillStyle = '#111'; x.fillRect(54, 14, 3, 4);
  x.fillStyle = '#ffffff88'; for (let k = 0; k < 6; k++) x.fillRect(20 + k * 5, 10 + (k % 2) * 3, 2, 2);
  return c;
}

function buildGFX() {
  GFX.machine = MACHINES.map((_, i) => buildMachineSprite(i));
  GFX.machineW = GFX.machine.map(s => silhouette(s));
  GFX.enemy = ENEMIES.map(e => pixArt(ENEMY_ART[e.spr].rows, ENEMY_ART[e.spr].pal));
  GFX.enemyW = GFX.enemy.map(s => silhouette(s));
  GFX.patch = PATCH_SYM.map((s, i) => plateIcon(s, STAT_COL[i], '#fff', 9));
  GFX.patchBig = PATCH_SYM.map((s, i) => plateIcon(s, STAT_COL[i], '#fff', 11));
  GFX.item = {}; GFX.itemUI = {};
  for (const k of ITEM_KEYS) {
    const it = ITEMS[k]; const bg = it.rar === 'N' ? '#3d8a3a' : it.rar === 'R' ? '#2e5ad8' : '#c88a00';
    GFX.item[k] = plateIcon(ICON_SYM[it.icon], bg, '#fff', it.rar === 'N' ? 9 : 11);
    GFX.itemUI[k] = plateIcon(ICON_SYM[it.icon], bg, '#fff', 11);
  }
  GFX.partCol = LEGEND_IDS.map(id => plateIcon(ICON_SYM.part, MACHINES[id].col, '#fff', 11, '#fff'));
  GFX.key = pixArt(['.yy......', 'y..yyyyyy', 'y..y..y.y', '.yy......'], { y: '#ffe14d' });
  GFX.chestB = buildChest(14, 11, '#8a5a2e', '#5a5a6a', '#c8c8d8', '#fff', false);
  GFX.chestA = buildChest(18, 14, '#c8323a', '#ffcc33', '#ffe14d', '#3dffe0', true);
  GFX.chestG = buildChest(12, 10, '#ffcc33', '#fff3b0', '#ffffff', '#ff4d4d', true);
  GFX.chestL = buildChest(20, 15, '#4d2a8a', '#c0c0d8', '#ffe14d', '#ff3dd8', true);
  GFX.chestI = buildChest(14, 11, '#2e5ad8', '#ffffff', '#ffe14d', '#3dffe0', true);
  const ore = pixArt(['....dd....', '...dhhd...', '..dhwhbd..', '.dhwhbbbd.', 'dhhhbbbbbd', 'dbhbbbbdbd', '.dbbbbddd.', '..dbbdd...', '...ddd....'], { d: '#a03dff', h: '#ffd0ff', w: '#fff', b: '#ff6ad8' });
  const oreBig = mkCanvas(ore.width * 2, ore.height * 2); { const x = oreBig.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(ore, 0, 0, oreBig.width, oreBig.height); }
  GFX.ore = hueFrames(oreBig, 8);
  GFX.chestW = { B: silhouette(GFX.chestB), A: silhouette(GFX.chestA), G: silhouette(GFX.chestG), L: silhouette(GFX.chestL), I: silhouette(GFX.chestI), O: silhouette(oreBig) };
  GFX.boss = buildBoss(); GFX.bossW = silhouette(GFX.boss);
  GFX.fish = hueFrames(buildFish(), 8); GFX.fishW = silhouette(GFX.fish[0]);
  GFX.balls = [
    buildCircle(13, '#ff8a2e', (dx, dy) => (Math.abs(dx) < .7 || Math.abs(dy) < .7 || Math.abs(Math.abs(dx) - 8 + dy * dy / 40) < .7) ? '#3a1a00' : (dx < -3 && dy < -3 ? '#ffb070' : '#ff8a2e')),
    buildCircle(12, '#f4f4f4', (dx, dy) => (Math.abs(Math.abs(dx) - 8 - dy * dy / 60) < .8 && (Math.round(dy) % 2 === 0)) ? '#e0283a' : (dx < -3 && dy < -3 ? '#ffffff' : '#e6e6e6')),
    buildCircle(13, '#ffffff', (dx, dy) => { const a = Math.atan2(dy, dx), r = Math.hypot(dx, dy); const pent = r < 4 || (r > 8 && r < 11.5 && Math.cos(a * 5) > .55); return pent ? '#1a1a2a' : (dx < -3 && dy < -3 ? '#ffffff' : '#e8e8e8'); }),
  ];
  GFX.meteor = buildCircle(7, '#6a4a3a', (dx, dy) => (dx + dy < -4 ? '#a07a5a' : ((dx * 3 + dy * 5) % 7 > 5 ? '#3a2a20' : '#6a4a3a')));
  GFX.meteorBig = buildCircle(30, '#6a4a3a', (dx, dy) => (dx + dy < -16 ? '#a07a5a' : ((Math.floor(dx / 4) * 3 + Math.floor(dy / 4) * 5) % 5 === 0 ? '#3a2a20' : '#6a4a3a')));
  GFX.flowerWall = buildFlowerWall();
}
function buildFlowerWall() {
  const c = mkCanvas(16, 16), x = c.getContext('2d');
  x.fillStyle = '#1f6a2a'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#2e8a3a';
  for (let i = 0; i < 16; i += 4) for (let j = 0; j < 16; j += 4) x.fillRect(i + 1, j + 1, 3, 2);
  const cols = ['#ff7ad9', '#ffe14d', '#ffffff', '#ff4d6d'];
  [[3, 3], [11, 4], [6, 10], [13, 12], [2, 13]].forEach(([a, b], k) => { x.fillStyle = cols[k % 4]; x.fillRect(a - 1, b, 3, 1); x.fillRect(a, b - 1, 1, 3); x.fillStyle = '#ffb43d'; x.fillRect(a, b, 1, 1); });
  x.fillStyle = '#0b0b1880'; x.fillRect(0, 15, 16, 1);
  return c;
}
