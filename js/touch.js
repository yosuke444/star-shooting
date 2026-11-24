'use strict';
// ============================================================
//  スマホ・タブレット用のタッチ操作
//  左半分: どこを触ってもそこがスティックの中心になる(矢印キーの代わり)
//  右下: Z ボタン(押しっぱなしでアクセル+ショット) / X ボタン(乗り換え・アイテム、長押しで入れ替え)
//  メニューもスティック上下で選択、Z で決定、X で戻る
// ============================================================
const Touch = {
  on: false, stick: null, zId: null, xId: null, dirBits: 0, el: {},
  init() {
    const coarse = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!coarse) return;
    this.on = true;
    const css = document.createElement('style');
    css.textContent = `
      html, body { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; overscroll-behavior: none; }
      #touch { position: fixed; inset: 0; z-index: 5; pointer-events: none; font-family: "DotGothic16", monospace; }
      #touch .pad { position: absolute; top: 0; bottom: 0; left: 0; width: 55%; pointer-events: auto; }
      #touch .btn { position: absolute; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto;
        color: #fff; border: 3px solid rgba(255,255,255,.55); text-shadow: 0 2px 0 #0b0b18; box-shadow: 0 4px 0 rgba(0,0,0,.35); opacity: .62; }
      #touch .btn b { font-size: 30px; line-height: 1; } #touch .btn small { font-size: 11px; margin-top: 2px; }
      #touch .btn.on { opacity: .95; transform: scale(.93); }
      #touch .z { width: 96px; height: 96px; right: calc(18px + env(safe-area-inset-right, 0px)); bottom: calc(22px + env(safe-area-inset-bottom, 0px)); background: rgba(255,77,109,.55); }
      #touch .x { width: 72px; height: 72px; right: calc(128px + env(safe-area-inset-right, 0px)); bottom: calc(70px + env(safe-area-inset-bottom, 0px)); background: rgba(77,155,255,.55); }
      #touch .small { position: absolute; top: calc(8px + env(safe-area-inset-top, 0px)); width: 44px; height: 44px; border-radius: 10px; pointer-events: auto; display: flex; align-items: center; justify-content: center;
        background: rgba(12,12,36,.6); color: #fff; border: 2px solid rgba(255,255,255,.4); font-size: 18px; opacity: .7; }
      #touch .pause { left: 50%; transform: translateX(-50%); }
      #touch .full { right: calc(50% - 80px); }
      #touch .base { position: absolute; width: 130px; height: 130px; margin: -65px 0 0 -65px; border-radius: 50%; border: 3px solid rgba(255,255,255,.45); background: rgba(255,255,255,.08); display: none; }
      #touch .knob { position: absolute; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%; background: rgba(255,225,77,.7); border: 3px solid rgba(255,255,255,.8); display: none; }
      #touch .hint { position: absolute; left: calc(24px + env(safe-area-inset-left, 0px)); bottom: calc(20px + env(safe-area-inset-bottom, 0px)); color: rgba(255,255,255,.55); font-size: 13px; }
      #rotate { position: fixed; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; flex-direction: column; gap: 14px; background: rgba(7,7,26,.94); color: #fff; font-family: "DotGothic16", monospace; font-size: 20px; text-align: center; padding: 24px; }
      #rotate .ph { width: 54px; height: 90px; border: 4px solid #ffe14d; border-radius: 10px; animation: rot 2s ease-in-out infinite; }
      @keyframes rot { 0%, 30% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }
      @media (orientation: portrait) { #rotate { display: flex; } }
    `;
    document.head.appendChild(css);
    const root = document.createElement('div'); root.id = 'touch';
    root.innerHTML = '<div class="pad"></div><div class="base"></div><div class="knob"></div><div class="hint">ここを触ってスティック</div>' +
      '<div class="btn x"><b>X</b><small>アクション</small></div><div class="btn z"><b>Z</b><small>ショット</small></div>' +
      '<div class="small pause">II</div><div class="small full">⛶</div>';
    document.body.appendChild(root);
    const rot = document.createElement('div'); rot.id = 'rotate';
    rot.innerHTML = '<div class="ph"></div><div>スマホを横向きにして遊んでね</div>';
    document.body.appendChild(rot);
    const q = s => root.querySelector(s);
    this.el = { root, pad: q('.pad'), base: q('.base'), knob: q('.knob'), hint: q('.hint'), z: q('.z'), x: q('.x'), pause: q('.pause'), full: q('.full') };
    const E = this.el, opt = { passive: false };
    const unlock = () => Sound.unlock();
    // スティック
    E.pad.addEventListener('pointerdown', e => {
      e.preventDefault(); unlock(); if (this.stick) return;
      try { E.pad.setPointerCapture(e.pointerId); } catch (_) { }
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      E.base.style.left = E.knob.style.left = e.clientX + 'px'; E.base.style.top = E.knob.style.top = e.clientY + 'px';
      E.base.style.display = E.knob.style.display = 'block'; E.hint.style.display = 'none';
    }, opt);
    E.pad.addEventListener('pointermove', e => {
      const s = this.stick; if (!s || s.id !== e.pointerId) return; e.preventDefault();
      let dx = e.clientX - s.x, dy = e.clientY - s.y; const d = Math.hypot(dx, dy), R = 52;
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      E.knob.style.left = (s.x + dx) + 'px'; E.knob.style.top = (s.y + dy) + 'px';
      let b = 0;
      if (d > 14) { const a = Math.atan2(dy, dx), c = Math.cos(a), sn = Math.sin(a); if (c > .38) b |= IN.R; if (c < -.38) b |= IN.L; if (sn > .38) b |= IN.D; if (sn < -.38) b |= IN.U; }
      this.dirBits = b; this.apply();
    }, opt);
    const endStick = e => { const s = this.stick; if (!s || s.id !== e.pointerId) return; this.stick = null; this.dirBits = 0; E.base.style.display = E.knob.style.display = 'none'; this.apply(); };
    E.pad.addEventListener('pointerup', endStick); E.pad.addEventListener('pointercancel', endStick);
    // ボタン
    const btn = (el, key) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); unlock(); try { el.setPointerCapture(e.pointerId); } catch (_) { } this[key] = e.pointerId; el.classList.add('on'); this.apply(); }, opt);
      const up = e => { if (this[key] !== e.pointerId) return; this[key] = null; el.classList.remove('on'); this.apply(); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    btn(E.z, 'zId'); btn(E.x, 'xId');
    E.pause.addEventListener('pointerdown', e => { e.preventDefault(); unlock(); onEscape(); }, opt);
    const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!fsOk) E.full.style.display = 'none';
    E.full.addEventListener('pointerdown', e => {
      e.preventDefault(); unlock(); const d = document.documentElement;
      try { if (document.fullscreenElement) document.exitFullscreen(); else (d.requestFullscreen || d.webkitRequestFullscreen).call(d).catch?.(() => { }); } catch (_) { }
    }, opt);
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('contextmenu', e => e.preventDefault());
  },
  apply() { if (Input.typing) return; Input.set(Input.kmask, this.dirBits | (this.zId !== null ? IN.Z : 0) | (this.xId !== null ? IN.X : 0)); },
  release() { this.stick = null; this.zId = this.xId = null; this.dirBits = 0; if (this.on) { this.el.base.style.display = this.el.knob.style.display = 'none'; this.el.z.classList.remove('on'); this.el.x.classList.remove('on'); } },
  frame() {
    if (!this.on) return;
    const show = !Input.typing, inGame = Scene.cur === 'game';
    this.el.root.style.display = show ? 'block' : 'none';
    this.el.pause.style.display = inGame ? 'flex' : 'none';
  },
};
