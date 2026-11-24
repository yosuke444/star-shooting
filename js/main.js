'use strict';
// ============================================================
//  メイン (シーン管理 / メニュー / ループ)
// ============================================================
const Settings = { name: 'プレイヤー', n: 8, time: 180, btime: 120, lv: 1, bgm: .5, sfx: .7, shake: true };
const TIME_OPTS = [60, 120, 180, 240, 300, 420, 600];
const BTIME_OPTS = [60, 90, 120, 180, 240, 300];
const LV_NAME = ['よわい', 'ふつう', 'つよい'];
function loadSettings() { try { Object.assign(Settings, JSON.parse(localStorage.getItem('starshoot') || '{}')); } catch (e) { } }
function saveSettings() { try { localStorage.setItem('starshoot', JSON.stringify(Settings)); } catch (e) { } }

// Game に HUD 用のゲッターを追加
Object.defineProperties(Game.prototype, {
  evtN: { get() { return this.evt.list.length; } },
  evtIdx: { get() { return this.evt.idx; } },
  evtList: { get() { return this.evt.list.map(e => e.type); } },
  legendOrder: { get() { return this.legend.order; } },
});

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let time = 0;
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px'; canvas.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', fit);
canvas.addEventListener('pointerdown', () => { window.focus(); Sound.unlock(); });

// ---- 文字入力(名前・ルームコードのみ) ----
const TextEntry = {
  open(label, value, max, cb, upper) {
    const box = document.getElementById('entry'), inp = document.getElementById('entryInput'), lab = document.getElementById('entryLabel');
    lab.textContent = label; inp.value = value; inp.maxLength = max; box.style.display = 'flex'; Input.typing = true; Input.set(0, 0); Touch.release();
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
    const done = ok => { box.style.display = 'none'; Input.typing = false; inp.onkeydown = null; Input.set(0, 0); Input.prev = Input.pressed = Input.latch = 0; if (ok) cb(upper ? inp.value.toUpperCase().trim() : inp.value.trim()); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
    document.getElementById('entryOk').onclick = () => done(true);
  },
};

// ---- キーリピート付きの入力 ----
const Rep = { t: {}, hit(b, dt) { if (Input.hit(b)) { this.t[b] = 0; return true; } if (Input.down(b)) { this.t[b] = (this.t[b] || 0) + dt; if (this.t[b] > .38) { this.t[b] -= .055; return true; } } return false; } };

// ============================================================
const Scene = { cur: 'title', sel: 0, page: 0, game: null, view: null, msg: '', paused: false };
function go(s) { Scene.cur = s; Scene.sel = 0; Scene.page = 0; Scene.msg = ''; if (s === 'title') Music.play('title'); }

// ---- タイトル ----
const STARS = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 3 + .5 }));
const FLYERS = Array.from({ length: 6 }, (_, i) => ({ x: Math.random() * W, y: 300 + i * 40, m: i % 12, s: 60 + Math.random() * 80 }));
function drawStarfield(dt) {
  ctx.fillStyle = '#07071a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * .35, 20, W / 2, H * .35, 600); g.addColorStop(0, '#2a1a5a'); g.addColorStop(1, '#07071a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const s of STARS) { s.x -= s.z * 20 * dt; if (s.x < 0) s.x += W; ctx.fillStyle = s.z > 2.5 ? '#ffffff' : s.z > 1.5 ? '#a0a0ff' : '#5a5a9a'; const sz = s.z > 2.5 ? 3 : 2; ctx.fillRect(Math.round(s.x), Math.round(s.y), sz, sz); }
}
function drawLogo(y) {
  const bob = Math.sin(time * 2) * 4;
  ctx.save(); ctx.translate(W / 2, y + bob);
  for (let i = 6; i > 0; i--) txt(ctx, 'STAR SHOOTING', i * 1.2, i * 1.2, 78, '#3a1a6a', 'center', 0);
  ctx.font = `78px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 10; ctx.strokeStyle = '#0b0b18'; ctx.strokeText('STAR SHOOTING', 0, 0);
  const gr = ctx.createLinearGradient(0, -36, 0, 36); gr.addColorStop(0, '#fff6a0'); gr.addColorStop(.5, '#ffcc33'); gr.addColorStop(1, '#ff6a2e'); ctx.fillStyle = gr; ctx.fillText('STAR SHOOTING', 0, 0);
  ctx.restore();
  // キラキラ
  for (let i = 0; i < 5; i++) { const a = time * 1.5 + i * 1.3, x = W / 2 + Math.cos(a) * 300, yy = y + Math.sin(a * 1.7) * 40 + bob, s = (Math.sin(time * 6 + i) + 1) * 4 + 2; ctx.fillStyle = '#fff'; ctx.fillRect(x - s / 2, yy - 1, s, 2); ctx.fillRect(x - 1, yy - s / 2, 2, s); }
  txt(ctx, 'ドット絵見下ろし型シューティングバトロワ', W / 2, y + 62 + bob, 18, '#ffffff', 'center', 4);
}
function drawFlyers(dt) {
  ctx.imageSmoothingEnabled = false;
  for (const f of FLYERS) {
    f.x += f.s * dt; if (f.x > W + 60) { f.x = -60; f.m = Math.floor(Math.random() * MACHINES.length); }
    const img = GFX.machine[f.m], y = f.y + Math.sin(time * 2 + f.y) * 6;
    ctx.fillStyle = '#ff9b3d60'; for (let k = 1; k < 6; k++) ctx.fillRect(f.x - 14 - k * 10, y - 2 + Math.sin(time * 20 + k) * 2, 6, 4);
    ctx.drawImage(img, f.x - img.width * 1.5, y - img.height * 1.5, img.width * 3, img.height * 3);
  }
}
function menuList(items, x, y, sel, w = 360, gap = 46) {
  items.forEach((it, i) => {
    const on = i === sel, yy = y + i * gap;
    if (on) { panel(ctx, x - w / 2, yy - 19, w, 38, 'rgba(60,40,120,.9)', '#ffe14d'); txt(ctx, '▶', x - w / 2 + 18, yy, 18, '#ffe14d', 'center', 3); }
    else panel(ctx, x - w / 2, yy - 19, w, 38, 'rgba(20,20,50,.7)', '#3a3a6a');
    txt(ctx, it, x, yy, on ? 20 : 18, on ? '#ffffff' : '#aaa', 'center', 3);
  });
}
function menuNav(n, dt) {
  if (Rep.hit(IN.U, dt)) { Scene.sel = (Scene.sel + n - 1) % n; Sound.play('move'); }
  if (Rep.hit(IN.D, dt)) { Scene.sel = (Scene.sel + 1) % n; Sound.play('move'); }
}
function hint(s) { txt(ctx, s, W / 2, H - 20, 14, '#aaa', 'center', 3); }

const TITLE_ITEMS = ['CPU戦', 'フレンド戦: ルームを作る', 'フレンド戦: ルームに参加', 'ずかん', 'あそびかた', 'せってい'];
const Scenes = {
  title: {
    update(dt) {
      menuNav(TITLE_ITEMS.length, dt);
      if (Input.hit(IN.Z)) {
        Sound.play('ok');
        if (Scene.sel === 0) { go('setup'); Scene.mode = 'cpu'; }
        else if (Scene.sel === 1) { go('setup'); Scene.mode = 'host'; Net.onEvent = netEvent; Net.host(Settings.name); }
        else if (Scene.sel === 2) { go('join'); Scene.code = ''; Net.onEvent = netEvent; }
        else if (Scene.sel === 3) { go('zukan'); Scene.tab = 0; }
        else if (Scene.sel === 4) go('howto');
        else go('settings');
      }
    },
    draw(dt) {
      drawStarfield(dt); drawFlyers(dt); drawLogo(130);
      menuList(TITLE_ITEMS, W / 2, 250, Scene.sel, 360, 42);
      hint('↑↓: 選択   Z: 決定   X: 戻る   M: ミュート');
    },
  },
  // ---- CPU戦 / ホストの設定 ----
  setup: {
    rows() { const r = ['名前', '人数', 'トレーニング時間', 'バトル時間', 'CPUの強さ', 'スタート!']; return r; },
    update(dt) {
      const rows = this.rows(); menuNav(rows.length, dt);
      const humans = Scene.mode === 'host' ? 1 + Net.conns.length : 1;
      Settings.n = Math.max(Settings.n, Math.max(2, humans));
      const d = (Rep.hit(IN.R, dt) ? 1 : 0) - (Rep.hit(IN.L, dt) ? 1 : 0);
      if (d) {
        Sound.play('move');
        if (Scene.sel === 1) Settings.n = clamp(Settings.n + d, Math.max(2, humans), 64);
        if (Scene.sel === 2) Settings.time = TIME_OPTS[clamp(TIME_OPTS.indexOf(Settings.time) + d, 0, TIME_OPTS.length - 1)] || 180;
        if (Scene.sel === 3) Settings.btime = BTIME_OPTS[clamp(BTIME_OPTS.indexOf(Settings.btime) + d, 0, BTIME_OPTS.length - 1)] || 120;
        if (Scene.sel === 4) Settings.lv = clamp(Settings.lv + d, 0, 2);
        saveSettings(); if (Scene.mode === 'host') { Net.cfg = { n: Settings.n, time: Settings.time, bt: Settings.btime, lv: Settings.lv }; Net.sendLobby(); }
      }
      if (Input.hit(IN.Z)) {
        if (Scene.sel === 0) TextEntry.open('名前 (10文字まで)', Settings.name, 10, v => { if (v) { Settings.name = v; saveSettings(); Net.sendLobby(); } });
        else if (Scene.sel === 5) { if (Scene.mode === 'host' && !(Net.peer && Net.peer.open)) { Sound.play('back'); return; } Sound.play('ok'); startGame(); }
      }
      if (Input.hit(IN.X)) { Sound.play('back'); if (Scene.mode === 'host') Net.reset(); go('title'); }
    },
    draw(dt) {
      drawStarfield(dt);
      txt(ctx, Scene.mode === 'host' ? 'フレンド戦: ルーム' : 'CPU戦 設定', W / 2, 44, 30, '#ffe14d', 'center', 5);
      const vals = [Settings.name, Settings.n + ' 人', (Settings.time / 60) + ' 分', (Settings.btime / 60) + ' 分', LV_NAME[Settings.lv], ''];
      const rows = this.rows(), x = Scene.mode === 'host' ? 300 : W / 2;
      rows.forEach((r, i) => {
        const y = 110 + i * 56, on = i === Scene.sel;
        panel(ctx, x - 230, y - 22, 460, 44, on ? 'rgba(60,40,120,.9)' : 'rgba(20,20,50,.7)', on ? '#ffe14d' : '#3a3a6a');
        if (i === 5) { txt(ctx, Scene.mode === 'host' && !(Net.peer && Net.peer.open) ? '準備中…' : 'スタート!', x, y, 22, on ? '#ffe14d' : '#fff', 'center', 3); return; }
        txt(ctx, r, x - 210, y, 17, on ? '#fff' : '#aaa', 'left', 3);
        txt(ctx, (i > 0 && on ? '◀ ' : '') + vals[i] + (i > 0 && on ? ' ▶' : ''), x + 210, y, 19, '#ffffff', 'right', 3);
      });
      const humans = Scene.mode === 'host' ? 1 + Net.conns.length : 1;
      txt(ctx, `プレイヤー ${humans}人 + CPU ${Math.max(0, Settings.n - humans)}人  /  イベント 約${clamp(Math.floor((Settings.time - 30) / 50), 1, 9)}回`, x, 450, 15, '#8ad0ff', 'center', 3);
      if (Scene.mode === 'host') {
        panel(ctx, 560, 90, 370, 380, 'rgba(12,12,36,.85)', '#8a8ad0');
        txt(ctx, 'ルームコード', 745, 116, 16, '#aaa', 'center', 0);
        txt(ctx, Net.code ? Net.code : '----', 745, 160, 52, '#ffe14d', 'center', 6);
        txt(ctx, Net.err || Net.status, 745, 200, 12, Net.err ? '#ff4d4d' : '#8ad0ff', 'center', 0);
        txt(ctx, '参加者', 580, 230, 15, '#aaa');
        Net.lobbyNames().slice(0, 9).forEach((n, i) => txt(ctx, (i + 1) + '. ' + n, 590, 258 + i * 22, 15, PLAYER_COLS[i % PLAYER_COLS.length], 'left', 3));
        if (Net.conns.length > 8) txt(ctx, '…ほか ' + (Net.conns.length - 8) + '人', 590, 258 + 9 * 22, 14, '#aaa');
      }
      hint('↑↓: 選択   ←→: 変更   Z: 決定/名前入力   X: 戻る');
    },
  },
  // ---- 参加 ----
  join: {
    update(dt) {
      const connecting = Net.role === 'client';
      if (!connecting) {
        menuNav(3, dt);
        if (Input.hit(IN.Z)) {
          if (Scene.sel === 0) TextEntry.open('名前 (10文字まで)', Settings.name, 10, v => { if (v) { Settings.name = v; saveSettings(); } });
          else if (Scene.sel === 1) TextEntry.open('ルームコード (5文字)', Scene.code, 5, v => { Scene.code = v; }, true);
          else if (Scene.code.length === 5) { Sound.play('ok'); Net.join(Scene.code, Settings.name); } else Sound.play('back');
        }
        if (Input.hit(IN.X)) { Sound.play('back'); go('title'); }
      } else if (Input.hit(IN.X)) { Sound.play('back'); Net.reset(); }
    },
    draw(dt) {
      drawStarfield(dt);
      txt(ctx, 'フレンド戦: ルームに参加', W / 2, 44, 30, '#ffe14d', 'center', 5);
      if (Net.role !== 'client') {
        const rows = [['名前', Settings.name], ['ルームコード', Scene.code || '(Zで入力)'], ['接続する', '']];
        rows.forEach(([a, b], i) => { const y = 140 + i * 60, on = i === Scene.sel; panel(ctx, W / 2 - 230, y - 22, 460, 44, on ? 'rgba(60,40,120,.9)' : 'rgba(20,20,50,.7)', on ? '#ffe14d' : '#3a3a6a'); if (i === 2) txt(ctx, a, W / 2, y, 22, on ? '#ffe14d' : '#fff', 'center', 3); else { txt(ctx, a, W / 2 - 210, y, 17, '#aaa', 'left', 3); txt(ctx, b, W / 2 + 210, y, 20, '#fff', 'right', 3); } });
        if (Net.err) txt(ctx, Net.err, W / 2, 360, 16, '#ff4d4d', 'center', 3);
        txt(ctx, 'ホストに表示されたルームコードを入力してください', W / 2, 400, 14, '#8ad0ff', 'center', 3);
        hint('↑↓: 選択   Z: 決定/入力   X: 戻る');
      } else {
        txt(ctx, Net.err || Net.status, W / 2, 120, 18, Net.err ? '#ff4d4d' : '#8ad0ff', 'center', 3);
        if (Net.cfg) txt(ctx, `人数 ${Net.cfg.n}人 / トレーニング ${Net.cfg.time / 60}分 / バトル ${(Net.cfg.bt || 120) / 60}分 / CPU ${LV_NAME[Net.cfg.lv]}`, W / 2, 160, 16, '#fff', 'center', 3);
        panel(ctx, W / 2 - 200, 190, 400, 260, 'rgba(12,12,36,.85)');
        Net.lobby.slice(0, 10).forEach((n, i) => txt(ctx, (i + 1) + '. ' + n, W / 2 - 180, 214 + i * 23, 15, PLAYER_COLS[i % PLAYER_COLS.length], 'left', 3));
        const dots = '.'.repeat(1 + Math.floor(time * 2) % 3); txt(ctx, 'ホストの開始を待っています' + dots, W / 2, 480, 16, '#fff', 'center', 3);
        hint('X: 切断して戻る');
      }
    },
  },
  // ---- ずかん(マシン / イベント / アイテム) ----
  zukan: {
    tabs: ['マシン', 'イベント', 'アイテム'],
    list(t) { return t === 0 ? MACHINES.map((_, i) => i) : t === 1 ? EVENT_KEYS : ITEM_KEYS.filter(k => k !== 'part').concat(['part']); },
    update(dt) {
      const L = this.list(Scene.tab); menuNav(L.length, dt);
      if (Input.hit(IN.R)) { Scene.tab = (Scene.tab + 1) % 3; Scene.sel = 0; Sound.play('move'); }
      if (Input.hit(IN.L)) { Scene.tab = (Scene.tab + 2) % 3; Scene.sel = 0; Sound.play('move'); }
      if (Input.hit(IN.X) || Input.hit(IN.Z)) { Sound.play('back'); go('title'); }
    },
    draw(dt) {
      drawStarfield(dt);
      this.tabs.forEach((t, i) => { const on = i === Scene.tab, x = W / 2 + (i - 1) * 170; panel(ctx, x - 75, 14, 150, 40, on ? 'rgba(60,40,120,.9)' : 'rgba(20,20,50,.6)', on ? '#ffe14d' : '#3a3a6a'); txt(ctx, t, x, 34, 20, on ? '#ffe14d' : '#aaa', 'center', 3); });
      const L = this.list(Scene.tab), sel = Scene.sel, top = clamp(sel - 6, 0, Math.max(0, L.length - 13));
      for (let j = 0; j < Math.min(13, L.length); j++) {
        const i = top + j, it = L[i], y = 84 + j * 33, on = i === sel;
        panel(ctx, 30, y - 14, 300, 28, on ? 'rgba(60,40,120,.9)' : 'rgba(20,20,50,.5)', on ? '#ffe14d' : 'rgba(80,80,140,.4)');
        let name, col = '#fff';
        if (Scene.tab === 0) { name = MACHINES[it].name; col = MACHINES[it].legend ? '#ffe14d' : MACHINES[it].col; iconC(ctx, GFX.machine[it], 52, y, 1.5); }
        else if (Scene.tab === 1) { name = EVENT_DEFS[it].short; col = EVENT_DEFS[it].col; }
        else { name = ITEMS[it].name; col = RAR_COL[ITEMS[it].rar]; iconC(ctx, GFX.itemUI[it], 52, y, 1.6); }
        txt(ctx, name, 76, y, 16, on ? col : '#bbb', 'left', 3);
      }
      const it = L[sel], x = 380; panel(ctx, x - 20, 70, 580, 430, 'rgba(12,12,36,.75)');
      if (Scene.tab === 0) {
        const M = MACHINES[it]; ctx.save(); ctx.translate(x + 90, 190); ctx.rotate(-Math.PI / 2 + Math.sin(time * 2) * .1); const img = GFX.machine[it], s = 7; ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s); ctx.restore();
        txt(ctx, M.name, x + 200, 120, 34, M.legend ? '#ffe14d' : M.col, 'left', 5);
        if (M.legend) txt(ctx, 'LEGENDARY', x + 200, 88, 16, '#ffe14d', 'left', 3);
        txt(ctx, M.desc, x + 200, 160, 16, '#fff', 'left', 3);
        wrapText(ctx, '移動: ' + (M.trait || ''), 330, 15).forEach((l, i) => txt(ctx, l, x + 200, 196 + i * 22, 15, '#8ad0ff', 'left', 3));
        for (let i = 0; i < 4; i++) { const y = 300 + i * 42, mul = M.mul[i]; iconC(ctx, GFX.patchBig[i], x + 30, y, 2.5); txt(ctx, STAT_NAME[i], x + 60, y, 16, STAT_COL[i], 'left', 3); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x + 180, y - 8, 300, 16); ctx.fillStyle = STAT_COL[i]; ctx.fillRect(x + 180, y - 8, 300 * clamp(mul / 2.6, 0, 1), 16); txt(ctx, 'x' + mul.toFixed(2) + (mul > 1 ? ' ▲' : mul < 1 ? ' ▼' : ''), x + 490, y, 15, mul > 1 ? '#5fe36a' : mul < 1 ? '#ff6b6b' : '#fff', 'left', 3); }
        if (M.legend) txt(ctx, '左翼・右翼・頭首のパーツを3つ集めると完成', x + 10, 478, 14, '#ffe14d', 'left', 3);
      } else if (Scene.tab === 1) {
        const D = EVENT_DEFS[it]; txt(ctx, D.name, x + 10, 110, 34, D.col, 'left', 5); txt(ctx, D.major ? 'よく起きるイベント' : 'レアなイベント', x + 10, 152, 15, '#aaa', 'left', 3);
        wrapText(ctx, D.desc, 520, 18).forEach((l, i) => txt(ctx, l, x + 10, 200 + i * 30, 18, '#fff', 'left', 3));
      } else {
        const I = ITEMS[it]; iconC(ctx, GFX.itemUI[it], x + 70, 170, 7); txt(ctx, I.name, x + 160, 140, 34, RAR_COL[I.rar], 'left', 5);
        txt(ctx, { N: 'N: 拾うと自動で発動', R: 'R: 2つまで持てる。X で使う', SR: 'SR: とてもレア' }[I.rar], x + 160, 182, 15, '#aaa', 'left', 3);
        wrapText(ctx, I.desc, 520, 18).forEach((l, i) => txt(ctx, l, x + 10, 270 + i * 30, 18, '#fff', 'left', 3));
      }
      hint('←→: タブ   ↑↓: 選択   X: 戻る');
    },
  },
  howto: {
    pages: [
      ['操作方法', ['矢印キー : 移動 / 向きを変える', 'Z (押しっぱなし) : アクセル + ショット連射(近くの敵には自動で向いて撃つ)', '　→ Zを押すと向いている方向へ全速前進しながら撃つ', '　→ 矢印だけなら撃たずにゆっくり移動', 'X : マシンの近くなら乗り換え / それ以外はアイテム使用', 'X 長押し : アイテムスロットの入れ替え', 'M : ミュート    Esc : ポーズ(CPU戦)']],
      ['試合の流れ', ['① トレーニング : 制限時間内にマシンを強くしよう', '　・雑魚敵を倒す → ステータスアイテムが落ちる', '　・宝箱を壊す → ラストアタックした人が中身を総取り', '　・他のマシンに乗り換える → 乗っていた時間に応じてボーナス', '　・時々イベントが発生! 試合が大きく動く', '② バトル : ルーレットで選ばれた闘技場で制限時間まで戦う', '　・何度でも復活。やられるとデス+1、倒すとデス-1', '　・時間切れの時、デスが一番少ない人の勝ち!']],
      ['ステータスとマシン', ['アタック : ショットの威力    スピード : 移動の速さ', 'ディフェンス : 受けるダメージを減らす    レンジ : 射程', 'マシンごとに得意(▲)・苦手(▼)なステータスがある', 'マシンは回復しない → 乗り換えで全回復! マシンごとに移動方法もちがう', 'ダメージを受けるとステータスがこぼれる。撃破されると大量に散らばり、', '倒した人が一部を吸い取る。十数秒後にミニノーマルで復活']],
      ['アイテム', ['N(緑) 自動発動 : ミニジェット / ミニダンベル / ミニメガネ / ミニバリア / ミニボム', 'R(青) 2つまで所持、Xで使用 :', '　ジェット / ダンベル / メガネ / バリア / ビッグボム', '　ビッグソード(3回まで斬れる) / ビッグアロー(5秒チャージ→極太ビーム)', 'SR(金) : 番組表 = この試合のイベント予定が見える', '　レジェンドパーツ = 左翼・右翼・頭首を集めると伝説マシンに変身!', '　(パーツは攻撃されると落とすことがある)']],
      ['イベント', ['巨大モンスター / 鍵付き宝箱 / 巨大隕石 / ゴールドラッシュ', 'レインボーフィッシュ / マシン襲来 / ハイスピード', 'フラワーラビリンス / モンスターラッシュ / ビッグボール', 'スケールダウン / ワープホール / スターシャワー', '発生すると画面上に告知、矢印で場所を案内、', 'ミニマップの下に説明が出る']],
    ],
    update(dt) {
      const n = this.pages.length;
      if (Input.hit(IN.R) || Input.hit(IN.Z)) { if (Scene.page < n - 1) { Scene.page++; Sound.play('move'); } else if (Input.hit(IN.Z)) go('title'); }
      if (Input.hit(IN.L)) { Scene.page = Math.max(0, Scene.page - 1); Sound.play('move'); }
      if (Input.hit(IN.X)) { Sound.play('back'); go('title'); }
    },
    draw(dt) {
      drawStarfield(dt); const [t, lines] = this.pages[Scene.page];
      txt(ctx, 'あそびかた  ' + (Scene.page + 1) + '/' + this.pages.length, W / 2, 40, 26, '#ffe14d', 'center', 5);
      panel(ctx, 70, 80, W - 140, 380, 'rgba(12,12,36,.88)');
      txt(ctx, t, 100, 112, 24, '#8ad0ff', 'left', 4);
      lines.forEach((l, i) => txt(ctx, l, 100, 160 + i * 38, 17, '#fff', 'left', 3));
      if (Scene.page === 2) STAT_SHORT.forEach((s, i) => icon(ctx, GFX.patchBig[i], 760 + i * 40, 100, 3));
      if (Scene.page === 3) ['jet', 'dumb', 'glass', 'bar', 'bbomb', 'sword', 'arrow', 'tv', 'part'].forEach((k, i) => icon(ctx, GFX.itemUI[k], 560 + i * 38, 96, 2.6));
      hint('←→: ページ   Z: 次へ   X: 戻る');
    },
  },
  settings: {
    update(dt) {
      menuNav(4, dt);
      const d = (Rep.hit(IN.R, dt) ? 1 : 0) - (Rep.hit(IN.L, dt) ? 1 : 0);
      if (d) { if (Scene.sel === 0) Settings.bgm = clamp(Math.round((Settings.bgm + d * .1) * 10) / 10, 0, 1); if (Scene.sel === 1) Settings.sfx = clamp(Math.round((Settings.sfx + d * .1) * 10) / 10, 0, 1); if (Scene.sel === 2) Settings.shake = !Settings.shake; applyVol(); Sound.play('move'); saveSettings(); }
      if (Input.hit(IN.Z) && Scene.sel === 3 || Input.hit(IN.X)) { Sound.play('back'); go('title'); }
    },
    draw(dt) {
      drawStarfield(dt); txt(ctx, 'せってい', W / 2, 50, 30, '#ffe14d', 'center', 5);
      const rows = [['BGM 音量', Math.round(Settings.bgm * 100) + '%'], ['効果音 音量', Math.round(Settings.sfx * 100) + '%'], ['画面の揺れ', Settings.shake ? 'ON' : 'OFF'], ['もどる', '']];
      rows.forEach(([a, b], i) => { const y = 140 + i * 60, on = i === Scene.sel; panel(ctx, W / 2 - 230, y - 22, 460, 44, on ? 'rgba(60,40,120,.9)' : 'rgba(20,20,50,.7)', on ? '#ffe14d' : '#3a3a6a'); if (i === 3) txt(ctx, a, W / 2, y, 20, '#fff', 'center', 3); else { txt(ctx, a, W / 2 - 210, y, 17, '#aaa', 'left', 3); txt(ctx, (on ? '◀ ' : '') + b + (on ? ' ▶' : ''), W / 2 + 210, y, 20, '#fff', 'right', 3); } });
      hint('↑↓: 選択   ←→: 変更   X: 戻る');
    },
  },
  // ---- ゲーム(ホスト / CPU戦) ----
  game: {
    acc: 0,
    update(dt) {
      const g = Scene.game; if (!g) return;
      if (Scene.paused) { if (Input.hit(IN.Z)) { Scene.paused = false; endGame(); } if (Input.hit(IN.X)) Scene.paused = false; return; }
      const me = g.players[Render.meId];
      if (me && me.out && g.phase === 'battle' && Input.hit(IN.X)) cycleFollow(g);
      if (g.phase === 'result' && Input.hit(IN.Z) && UI.resultDone) { endGame(); return; }
      // ヒットストップ: CPU戦では本当に時間を止める(オンラインは全員が止まるので見た目だけ)
      const stopped = FX.stopT > 0 && Net.role !== 'host';
      if (!stopped) this.acc += dt; let steps = 0;
      while (this.acc >= DT && steps < 4) {
        this.acc -= DT; steps++;
        if (me && !me.out) me.mask = Input.take();
        g.update();
        for (const p of g.players) if (p.cpu) p.notes.length = 0;
        if (Net.role === 'host') Net.hostTick(g); else { g.fxq.length = 0; g.gfx.length = 0; }
      }
      if (steps >= 4) this.acc = 0;
      if (me) UI.addNotes(me.notes.splice(0));
      if (g.map.over) g.map.overT = Math.min(1, g.map.overT + dt / 1.2);
      commonUpdate(g, dt);
    },
    draw(dt) { const g = Scene.game; if (!g) return; Render.draw(g, time); UI.draw(ctx, g, time); if (Scene.paused) drawPause(); },
  },
  // ---- ゲーム(クライアント) ----
  cgame: {
    update(dt) {
      const v = Scene.view; if (!v) return;
      const me = v.players[v.you];
      const m = Input.take(); Net.sendInput(me && me.out ? 0 : m, performance.now(), Render.follow);
      if (me && me.out && v.phase === 'battle' && Input.hit(IN.X)) cycleFollow(v);
      if (FX.stopT <= 0) v.update(dt, m);
      commonUpdate(v, dt);
    },
    draw(dt) {
      const v = Scene.view; if (!v) return;
      if (!v.got) { drawStarfield(dt); txt(ctx, 'ゲーム開始を待っています…', W / 2, H / 2, 24, '#fff', 'center', 4); return; }
      Render.draw(v, time); UI.draw(ctx, v, time);
    },
  },
};
function cycleFollow(V) { const alive = V.players.filter(p => !p.out); if (!alive.length) return; const i = alive.findIndex(p => p.id === Render.follow); Render.follow = alive[(i + 1) % alive.length].id; Sound.play('move'); }
function commonUpdate(V, dt) {
  const hs = FX.stopT > 0; FX.stopT = Math.max(0, FX.stopT - dt);
  if (!hs) { Particles.update(dt); FxObjs.update(dt, V); } UI.update(dt); UI.watch(V); Render.updateCam(V, dt);
  FX.shake = Math.max(0, FX.shake - dt * 30); FX.flash = Math.max(0, FX.flash - dt); FX.hurt = Math.max(0, FX.hurt - dt);
}
function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
  txt(ctx, 'ポーズ', W / 2, H / 2 - 40, 40, '#ffe14d', 'center', 5);
  txt(ctx, Net.role === 'host' ? 'Z: 試合を終了してロビーへ   X: 続ける' : 'Z: タイトルへ戻る   X: 続ける', W / 2, H / 2 + 20, 18, '#fff', 'center', 3);
}
function onEscape() {
  if (Scene.cur === 'game') Scene.paused = !Scene.paused;
  else if (Scene.cur === 'cgame') { Net.reset(); Scene.view = null; go('title'); }
}
addEventListener('keydown', e => { if (e.code === 'Escape' && !Input.typing) onEscape(); });

function prepRun() {
  Input.latch = 0;
  Particles.n = 0; FxObjs.list = []; UI.reset(); FX.shake = FX.flash = FX.hurt = FX.stopT = 0; Render.cam.snap = true;
}
function startGame() {
  const humans = [{ name: Settings.name, local: true }];
  if (Scene.mode === 'host') { assignPeerIds(); for (const c of Net.conns) humans.push({ name: c.pname, peer: c }); }
  const n = Math.max(Settings.n, humans.length);
  const cfg = { n, trainTime: Settings.time, battleTime: Settings.btime || 120, cpuLevel: Settings.lv, seed: (Math.random() * 1e9) | 0, humans, pub: { n, time: Settings.time, lv: Settings.lv } };
  const g = new Game(cfg);
  g.onFx = (t, x, y, a, b, c) => FX.play(t, x, y, a, b, c, g);
  g.onGfx = a => UI.onGfx(a, g);
  Scene.game = g; Render.meId = 0; Render.follow = 0; prepRun();
  Render.cam.x = g.players[0].x; Render.cam.y = g.players[0].y;
  if (Scene.mode === 'host') Net.startHost(g);
  Scenes.game.acc = 0; Scene.paused = false;
  go('game'); Music.play('train');
  UI.banner('トレーニング開始!', 'TRAINING START', '#4dc3ff', true, 2.6); Sound.play('go', 1);
}
function endGame() {
  if (Net.role === 'host') { Net.broadcast({ t: 'end' }); Net.game = null; Scene.game = null; go('setup'); Scene.mode = 'host'; Net.sendLobby(); Music.play('title'); }
  else { Scene.game = null; go('title'); }
}
function netEvent(ev, d) {
  if (ev === 'start' && Net.role === 'client') {
    const v = new ClientView(d); Net.view = v; Scene.view = v; Render.meId = d.you; Render.follow = d.you; prepRun();
    go('cgame'); Music.play('train'); UI.banner('トレーニング開始!', 'TRAINING START', '#4dc3ff', true, 2.6); Sound.play('go', 1);
  }
  if (ev === 'end' && Net.role === 'client') { Scene.view = null; Net.view = null; go('join'); Music.play('title'); }
  if ((ev === 'disconnect' || ev === 'error') && Net.role === 'client' && Scene.cur === 'cgame') { Scene.view = null; Net.view = null; const err = Net.err; Net.reset(); Net.err = err; go('join'); }
}
function applyVol() { Sound.vol.bgm = Settings.bgm; Sound.vol.sfx = Settings.sfx; Sound.applyVol(); }

// ============================================================
let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now; time += dt;
  const S = Scenes[Scene.cur];
  ctx.imageSmoothingEnabled = false;
  S.update(dt); S.draw(dt);
  Touch.frame();
  Input.endFrame();
  requestAnimationFrame(frame);
}
async function boot() {
  loadSettings(); applyVol(); fit();
  ctx.fillStyle = '#07071a'; ctx.fillRect(0, 0, W, H);
  try { await Promise.race([document.fonts.load(`20px ${FONT}`), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  buildGFX(); buildTiles(); Particles.init(); Render.init(canvas); Touch.init();
  Music.play('title');
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
