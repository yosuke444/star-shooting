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
  { name: 'スナイパー', tpl: 'rifle', col: '#5a4dff', acc: '#ff3dd8', mul: [1.2, .85, .75, 1.6], shot: 'sniper', desc: '超遠距離・高速弾(当てにくい)' },
  { name: 'スラッシャー', tpl: 'blade', col: '#ff4d4d', acc: '#ffffff', mul: [1.45, 1.2, .9, .5], shot: 'blade', desc: '超近接・斬撃波' },
  { name: 'ホーミー', tpl: 'saucer', col: '#c86bff', acc: '#ffe0ff', mul: [.95, 1.0, .95, 1.15], shot: 'homing', desc: '追尾ミサイル(当てやすい)' },
  { name: 'ウェーブライダー', tpl: 'manta', col: '#2ec4a0', acc: '#e0fff8', mul: [1.1, 1.1, .9, 1.1], shot: 'wave', desc: 'うねる2重螺旋弾' },
  { name: 'ブーメラン', tpl: 'boomer', col: '#ffb43d', acc: '#7a3d00', mul: [1.15, 1.1, 1.0, .9], shot: 'boomer', desc: '戻ってくる貫通弾' },
  { name: 'スキャッター', tpl: 'crab', col: '#ff8a8a', acc: '#ffffff', mul: [1.25, .95, 1.1, .6], shot: 'scatter', desc: '近距離散弾' },
  { name: 'レーザーレイ', tpl: 'prism', col: '#3d9bff', acc: '#e8fbff', mul: [1.1, .9, .85, 1.35], shot: 'laser', desc: '貫通レーザー' },
  { name: 'スプレッダー', tpl: 'trident', col: '#9be03d', acc: '#2e4d00', mul: [1.1, 1.0, 1.0, .95], shot: 'spread3', desc: '3way ショット' },
  // ---- レジェンダリー (微リジェネ付き) ----
  { name: 'フェニックス', tpl: 'phoenix', col: '#ff6a00', acc: '#ffe14d', mul: [1.55, 1.55, .95, .85], shot: 'phoenix', legend: 1, desc: '伝説・近接火炎' },
  { name: 'リヴァイアサン', tpl: 'levia', col: '#2e7bff', acc: '#9ae8ff', mul: [1.55, .95, .95, 1.75], shot: 'levia', legend: 1, desc: '伝説・超射程水流' },
  { name: 'ケルベロス', tpl: 'cerb', col: '#6a3dbf', acc: '#ff4d4d', mul: [1.25, 1.05, 1.8, 1.1], shot: 'cerb', legend: 1, big: 1, desc: '伝説・鉄壁3連砲' },
];
// 性能を尖らせる: 得意はより得意に、苦手はより苦手に(ミニノーマルは全部苦手のまま)
MACHINES.forEach((M, i) => { M.mul = M.mul.map(v => i === 0 ? .75 : clamp(+(1 + (v - 1) * 1.9).toFixed(2), .35, 2.6)); });
// ゲームスピードアップ: 弾速 x1.3 / 連射 x0.85 (射程はやや伸びる)
for (const k in SHOTS) { const S = SHOTS[k]; S.spd *= 1.3; S.life *= .88; S.rate *= .85; }
// ---- バランス調整(CPU同士の対戦シミュレーション結果より) ----
// 強すぎ → 長所は残して短所をさらに短所に / 弱すぎ → 長所をさらに長所に
const BALANCE = {
  1: [1.15, 1.15, 1.15, 1.15], // スタンダード: 全部ちょっと得意を伸ばす
  2: [.81, 2.6, .43, 1],       // ジェットスター: スピードを伸ばす + 連射・弾の威力UP
  3: [1.4, .55, 2.2, .4],      // フォートレス(遅すぎたのでスピードを少し戻した): アタック・ディフェンスと砲弾威力を伸ばす(スピード・レンジ・連射は苦手のまま)
  4: [1.8, .65, .45, 2.4],     // スナイパー: スピード・ディフェンスをさらに苦手に + 一発の威力UP
  5: [1.85, 1.38, .38, .2],    // スラッシャー: ディフェンス・レンジ(斬撃の届く範囲)をさらに苦手に
  6: [.9, 1, .9, 2.4],         // ホーミー: レンジを伸ばす + 追尾性能・弾速・威力UP
  7: [1.45, 1.38, .81, 1.38],  // ウェーブライダー: 得意3つを伸ばす
  8: [1.6, 1.19, 1, .81],      // ブーメラン: アタックを伸ばす
  9: [1.48, .7, 1.19, .25],    // スキャッター: スピード・レンジをさらに苦手に
  10: [1.7, .81, .62, 1.95],   // レーザーレイ: アタック・レンジを伸ばす + ディフェンスをさらに苦手に
  11: [1.19, 1, 1, .8],        // スプレッダー: レンジをさらに苦手に
  12: [2.04, 2.04, .65, .5],   // フェニックス: ディフェンス・レンジをさらに苦手に
  13: [2.2, .8, .8, 2.6],      // リヴァイアサン: アタック・レンジを伸ばす + スピード・ディフェンスをさらに苦手に
  14: [1.65, .4, 2.3, 1.35],   // ケルベロス: 体を大きく(当たり判定も) + ディフェンスを少し下げる + アタック・レンジを伸ばす
};
for (const i in BALANCE) MACHINES[i].mul = BALANCE[i];
SHOTS.rapid.rate *= .47; SHOTS.rapid.dmg = 5.4;
SHOTS.heavy.rate *= 1.35; SHOTS.heavy.spd *= .8; SHOTS.heavy.dmg = 18;
SHOTS.sniper.dmg = 31; SHOTS.laser.dmg = 13; SHOTS.levia.dmg = 15; SHOTS.blade.r = 6;
SHOTS.homing.turn = 12; SHOTS.homing.spd *= 1.25; SHOTS.homing.dmg = 14.5;
SHOTS.cerb.spd *= .75; SHOTS.cerb.rate *= 1.4;
// ---- ステータス以外の個性(移動方法・弾) ----
const TRAITS = {
  0: ['normal', 'クセのない操作'], 1: ['normal', 'クセのない操作・2連ショット'], 2: ['slide', '超すべる! 止まりにくいが最速'],
  3: ['tank', '重戦車: 旋回が遅い・体当たりで攻撃'], 4: ['brake', 'ピタッと止まる・撃った弾が加速する'], 5: ['dash', 'Z長押しで一定間隔に突進・突進で体当たり'],
  6: ['hover', 'ふわふわ浮遊・追尾ミサイル'], 7: ['zigzag', 'ジグザグに蛇行して避ける'], 8: ['bounce', '壁でバウンドするピンボール機体'],
  9: ['recoil', '撃つと反動で下がる・弾が壁で跳ねる'], 10: ['rail', '8方向にカクッと曲がる・貫通レーザー'], 11: ['drift', '首振りしながら3way連射'],
  12: ['dash', '炎の突進! 突進で体当たり'], 13: ['swim', 'うねって泳ぐ・星の川で超加速'], 14: ['tank', '重戦車・体当たり・体が大きい'],
};
for (const i in TRAITS) { MACHINES[i].mv = TRAITS[i][0]; MACHINES[i].trait = TRAITS[i][1]; }
SHOTS.spread3.sweep = 1; SHOTS.scatter.ric = 1; SHOTS.sniper.acc = 1; // 弾の個性: 首振り / 跳弾 / 加速
MACHINES.forEach(M => { M.best = M.mul.indexOf(Math.max(...M.mul)); });
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
  arrow: { name: 'ビッグアロー', rar: 'R', icon: 'arrow', desc: '5秒チャージ→無限射程の極太ビーム。多段ヒットで大ダメージ' },
  tv: { name: '番組表', rar: 'SR', icon: 'tv', desc: 'この試合のイベント予定が見える' },
  part: { name: 'レジェンドパーツ', rar: 'SR', icon: 'part', desc: '3つ集めると伝説マシン' },
};
const ITEM_KEYS = Object.keys(ITEMS);
const N_ITEMS = ['mjet', 'mdumb', 'mglass', 'mbar', 'mbomb'];
const R_ITEMS = ['jet', 'dumb', 'glass', 'bar', 'bbomb', 'sword', 'arrow'];
const R_WEIGHT = { jet: 3, dumb: 3, glass: 3, bar: 2, bbomb: 2, sword: 2, arrow: 1 };
const RAR_COL = { N: '#8fd16a', R: '#4da6ff', SR: '#ffcc33' };
// ピックアップ種別コード: 0-3=ステータス, 10+i=アイテム, 50=パーツ, 60=鍵
const PK_ITEM = 10, PK_PART = 50, PK_KEY = 60; // パーツは 50 + 種類*3 + 部位(0=左翼 1=右翼 2=頭首)
const isPart = k => k >= PK_PART && k < PK_PART + 9;
const bits3 = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
const partsN = p => bits3(p.parts[0]) + bits3(p.parts[1]) + bits3(p.parts[2]);
const PART_NAME = ['左翼', '右翼', '頭首'];
const HP_SCALE = 2; // 内部の最大体力は 200(表示は%)

// ---- 雑魚敵 ----
const ENEMIES_BASE = [
  { name: 'ツノスライム', spr: 'slime', hp: 22, spd: 34, drop: 0, r: 6, touch: 2.5, beh: 'hop' },
  { name: 'ハヤブサ', spr: 'bird', hp: 14, spd: 70, drop: 1, r: 6, touch: 2, beh: 'fly' },
  { name: 'カメタンク', spr: 'turtle', hp: 46, spd: 18, drop: 2, r: 7, touch: 3, beh: 'walk' },
  { name: 'メダマン', spr: 'eye', hp: 18, spd: 28, drop: 3, r: 6, touch: 2, beh: 'shoot' },
  { name: 'スピードラビット', spr: 'rabbit', hp: 12, spd: 120, drop: -1, r: 6, touch: 3, beh: 'flee' },
];
const ENEMIES = ENEMIES_BASE.map(e => Object.assign({}, e, { spd: e.spd * .85 })); // 足は遅め

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
  rifle: { m: 1, rows: ['....dd.........', '...dbbd........', '..dbhhbd.......', 'edbbhcchbbbd...', 'ebbbhccchbbbaaa'] },
  manta: { m: 1, rows: ['dd.............', '.ddd...........', '..dbbd.........', '..dbbbbd.......', '...dbhhbbd.....', '....dbhccbbd...', '....ebhcccbbba.'] },
  crab: { m: 1, rows: ['......aaa....', '.....a...a...', '...ddbbd..a..', '..dbbbbbd....', 'edbhhhbbbd...', 'ebbhccbbbbaa.', 'ebbhcccbbbbb.'] },
  prism: { m: 1, rows: ['......d......', '.....dhd.....', '....dhhbd....', '...dhbbbbd...', '..ehbbccbbd..', '.ehbbcccbbbd.', 'ehbbbcccbbbba'] },
  boomer: { m: 1, rows: ['aa...........', 'daa..........', '.dbb.........', '..dbb........', '...dbbh......', '...edbhcch...', '....ebhcccbba'] },
  trident: { m: 1, rows: ['........aaaa.', '......dbb....', '.....dbb.....', '..eddbbbhaaaa', '..ebbbhcc....', '..ebbhcccbbba'] },
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

// ダメージ表現: 黒く焦げ、焦げ跡が付き、ひび割れが入る(スプライトの形の中だけ)
function damageSprite(src, lvl, seed) {
  const w = src.width, h = src.height, c = mkCanvas(w, h), x = c.getContext('2d'), r = RNG(seed * 131 + lvl * 17);
  x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop';
  x.fillStyle = `rgba(25,12,10,${[0, .16, .3, .46][lvl]})`; x.fillRect(0, 0, w, h);
  const area = w * h;
  for (let i = 0; i < lvl * (2 + area / 90); i++) { const s = r() < .4 ? 2 : 1; x.fillStyle = r() < .3 ? 'rgba(90,40,20,.7)' : 'rgba(8,4,4,.65)'; x.fillRect(Math.floor(r() * w), Math.floor(r() * h), s, s); }
  const n = lvl * Math.max(1, Math.round((w + h) / 14));
  for (let k = 0; k < n; k++) {
    let px = Math.floor(w * .15 + r() * w * .7), py = Math.floor(h * .15 + r() * h * .7), dx = r() < .5 ? 1 : -1, dy = r() < .5 ? 1 : -1; const len = 3 + Math.floor(r() * (w + h) / 4);
    for (let s = 0; s < len; s++) { x.fillStyle = '#100606'; x.fillRect(px, py, 1, 1); x.fillStyle = 'rgba(255,240,220,.22)'; x.fillRect(px + 1, py, 1, 1); if (r() < .5) px += dx; else py += dy; if (r() < .18) { dx = -dx; } }
  }
  x.globalCompositeOperation = 'source-over'; return c;
}
function damageSet(src, seed) { return [src, damageSprite(src, 1, seed), damageSprite(src, 2, seed), damageSprite(src, 3, seed)]; }
const dmgLvl = f => f > .7 ? 0 : f > .45 ? 1 : f > .22 ? 2 : 3;
function outlined(src, col) {
  const c = mkCanvas(src.width + 4, src.height + 4), x = c.getContext('2d'), sil = silhouette(src, col);
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, -1], [2, 1], [-1, 2], [1, -2]]) x.drawImage(sil, 2 + dx, 2 + dy);
  x.drawImage(src, 2, 2); return c;
}
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
// レインボーフィッシュ: 金魚風。色ごとにフレームを描く(緑は濁らない黄緑)
const FISH_COLS = ['#ff5a4d', '#ff9b3d', '#ffd23f', '#a8e83d', '#3dd8ff', '#4d8aff', '#b07aff', '#ff7ad9'];
function buildGoldfish(col) {
  const w = 84, h = 52, c = mkCanvas(w, h), x = c.getContext('2d'), lite = shade(col, .55), dark = shade(col, -.35);
  // 尾びれ(ふわっと大きな2枚)
  x.globalAlpha = .78; x.fillStyle = lite;
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(32, 26); x.quadraticCurveTo(14, 26 + s * 4, 2, 26 + s * 22); x.quadraticCurveTo(10, 26 + s * 8, 4, 26 + s * 3); x.quadraticCurveTo(18, 26, 32, 26); x.fill(); }
  x.strokeStyle = col; x.lineWidth = 1; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(30, 26); x.lineTo(4 + k, 6 + k * 10); x.stroke(); }
  // 背びれ
  x.fillStyle = lite; x.beginPath(); x.moveTo(36, 16); x.quadraticCurveTo(44, 2, 56, 12); x.lineTo(50, 16); x.fill();
  x.globalAlpha = 1;
  // 体
  x.fillStyle = '#0b0b18'; x.beginPath(); x.ellipse(50, 26, 22, 14.5, 0, 0, TAU); x.fill();
  const g = x.createLinearGradient(0, 12, 0, 40); g.addColorStop(0, dark); g.addColorStop(.45, col); g.addColorStop(1, lite);
  x.fillStyle = g; x.beginPath(); x.ellipse(50, 26, 21, 13.5, 0, 0, TAU); x.fill();
  // うろこ
  x.strokeStyle = 'rgba(255,255,255,.45)'; for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 4; xx++) { x.beginPath(); x.arc(38 + xx * 6 + (yy % 2) * 3, 20 + yy * 6, 3, -1.2, 1.2); x.stroke(); }
  // 胸びれ・目・口
  x.globalAlpha = .8; x.fillStyle = lite; x.beginPath(); x.ellipse(52, 36, 6, 3, .6, 0, TAU); x.fill(); x.globalAlpha = 1;
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(62, 21, 4.5, 0, TAU); x.fill(); x.fillStyle = '#0b0b18'; x.beginPath(); x.arc(63, 21, 2.4, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.fillRect(63, 19, 1, 1);
  x.fillStyle = dark; x.fillRect(70, 27, 2, 2);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(46, 18, 8, 2.5, -.2, 0, TAU); x.fill();
  return c;
}

function buildGFX() {
  GFX.machine = MACHINES.map((_, i) => buildMachineSprite(i));
  GFX.machineW = GFX.machine.map(s => silhouette(s));
  // マップに落ちているマシン: 得意ステータスの色でふちどり(ミニノーマルは白)
  GFX.machineFree = GFX.machine.map((s, i) => outlined(s, i === 0 ? '#ffffff' : MACHINES[i].legend ? '#ffe14d' : STAT_COL[MACHINES[i].best]));
  GFX.enemy = ENEMIES.map(e => pixArt(ENEMY_ART[e.spr].rows, ENEMY_ART[e.spr].pal));
  GFX.enemyW = GFX.enemy.map(s => silhouette(s));
  // HPが減った時のボロボロ版(0=無傷 1=傷 2=ひび 3=ボロボロ)
  GFX.machineD = GFX.machine.map((s, i) => damageSet(s, i + 1));
  GFX.enemyD = GFX.enemy.map((s, i) => damageSet(s, i + 50));
  GFX.patch = PATCH_SYM.map((s, i) => plateIcon(s, STAT_COL[i], '#fff', 9));
  GFX.patchBig = PATCH_SYM.map((s, i) => plateIcon(s, STAT_COL[i], '#fff', 11));
  GFX.item = {}; GFX.itemUI = {};
  for (const k of ITEM_KEYS) {
    const it = ITEMS[k]; const sc = { jet: 1, dumb: 0, glass: 3, bar: 2 }[it.icon]; // 強化アイテムはステータスの色
    const bg = sc !== undefined ? shade(STAT_COL[sc], -.25) : it.rar === 'N' ? '#3d8a3a' : it.rar === 'R' ? '#2e5ad8' : '#c88a00';
    GFX.item[k] = plateIcon(ICON_SYM[it.icon], bg, '#fff', it.rar === 'N' ? 9 : 11);
    GFX.itemUI[k] = plateIcon(ICON_SYM[it.icon], bg, '#fff', 11);
  }
  GFX.partCol = LEGEND_IDS.map(id => plateIcon(ICON_SYM.part, MACHINES[id].col, '#fff', 11, '#fff'));
  // 伝説マシンを上向きにして 左翼 / 右翼 / 頭首 に分割(同じ大きさのキャンバスに部位だけ残す)
  GFX.legendUp = []; GFX.legendPieces = []; GFX.pieceIcon = [];
  LEGEND_IDS.forEach((id, li) => {
    const src = GFX.machine[id], w = src.width, h = src.height, up = mkCanvas(h, w), ux = up.getContext('2d');
    ux.translate(0, w); ux.rotate(-Math.PI / 2); ux.drawImage(src, 0, 0); GFX.legendUp[li] = up;
    const pieces = [0, 1, 2].map(piece => {
      const c = mkCanvas(h, w), x = c.getContext('2d'); x.drawImage(up, 0, 0);
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000';
      const headH = Math.round(w * .42); // 上側 42% が頭首、残りを左右に分ける
      if (piece === 2) x.fillRect(0, 0, h, headH); else if (piece === 0) x.fillRect(0, headH, Math.floor(h / 2), w); else x.fillRect(Math.floor(h / 2), headH, h, w);
      return c;
    });
    GFX.legendPieces[li] = pieces;
    GFX.pieceIcon[li] = pieces.map(pc => { // 拾う時のアイコン(部位だけを切り抜き、光る台座付き)
      const d = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data; let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
      for (let y = 0; y < pc.height; y++) for (let x = 0; x < pc.width; x++) if (d[(y * pc.width + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, S = Math.max(bw, bh) + 6, c = mkCanvas(S, S), x = c.getContext('2d');
      x.fillStyle = '#0b0b18'; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, TAU); x.fill(); x.fillStyle = MACHINES[id].col; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, TAU); x.fill();
      x.fillStyle = shade(MACHINES[id].col, -.4); x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 2.5, 0, TAU); x.fill();
      x.drawImage(pc, x0, y0, bw, bh, Math.floor((S - bw) / 2), Math.floor((S - bh) / 2), bw, bh); return c;
    });
  });
  GFX.skull = pixArt(['.wwwwwww.', 'wwwwwwwww', 'wkkwwwkkw', 'wkkwwwkkw', 'wwwwkwwww', '.wwwwwww.', '..wkwkw..'], { w: '#f4f4f8', k: '#0b0b18' });
  GFX.crown = pixArt(['y...y...y', 'yy.yyy.yy', 'yyyyyyyyy', 'yrryyybyy', 'yyyyyyyyy'], { y: '#ffd23f', r: '#ff4d6d', b: '#4dc3ff' });
  GFX.clock = pixArt(['..www..', '.wkwkw.', 'wkkwkkw', 'wkkwwww', 'wkkkkkw', '.wkkkw.', '..www..'], { w: '#ffffff', k: '#3a3a6a' });
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
  GFX.boss = buildBoss(); GFX.bossW = silhouette(GFX.boss); GFX.bossD = damageSet(GFX.boss, 90);
  GFX.fish = FISH_COLS.map(buildGoldfish); GFX.fishW = silhouette(GFX.fish[0]); GFX.fishD = GFX.fish.map(s => damageSet(s, 91));
  GFX.chestD = { B: damageSet(GFX.chestB, 70), A: damageSet(GFX.chestA, 71), G: damageSet(GFX.chestG, 72), L: [GFX.chestL, GFX.chestL, GFX.chestL, GFX.chestL], I: damageSet(GFX.chestI, 73) };
  GFX.oreD = GFX.ore.map(s => damageSet(s, 74));
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
