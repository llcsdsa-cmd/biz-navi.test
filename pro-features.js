/* ========================================================================== */
/* pro-features.js - 新日報フロー統合版                                       */
/* FABボタンを handleDailyButtonPress() に統一                                */
/* ========================================================================== */

const ProFeature = {

  /* ┌────────────────────────────────────────────────────┐
   * │ ▶ START : init
   * │   FABボタンとグローバルスタイルを初期化する
   * └────────────────────────────────────────────────────┘ */
  init: function() {
    this.injectFloatingButton();
    this.injectGlobalStyles();
  },

  /* ┌────────────────────────────────────────────────────┐
   * │ ▶ START : injectGlobalStyles
   * │   スピンボタン非表示・アニメーションCSSをhead要素に注入する
   * └────────────────────────────────────────────────────┘ */
  injectGlobalStyles: function() {
    if (document.getElementById('pro-global-styles')) return;
    const style = document.createElement('style');
    style.id = 'pro-global-styles';
    style.innerHTML = `
      /* スピンボタン非表示 */
      input[type=number]::-webkit-outer-spin-button,
      input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none; margin: 0;
      }
      input[type=number] { -moz-appearance: textfield; }

      @keyframes pro-float {
        0%, 100% { transform: translateY(0); }
        50%       { transform: translateY(-6px); }
      }
    `;
    document.head.appendChild(style);
  },

  /* ┌────────────────────────────────────────────────────┐
   * │ ▶ START : injectFloatingButton
   * │   📝日報フローティングボタン（FAB）をbody末尾に追加する
   * └────────────────────────────────────────────────────┘ */
  injectFloatingButton: function() {
    if (document.getElementById('nav-pro-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'nav-pro-btn';
    btn.style.cssText = [
      'position:fixed',
      'bottom:25px',
      'right:max(20px, calc(50vw - 240px))',
      'width:72px',
      'height:72px',
      'background:#6366f1',
      'color:white',
      'border:none',
      'border-radius:20px',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'box-shadow:0 8px 20px rgba(99,102,241,0.45)',
      'cursor:pointer',
      'z-index:9999',
      'animation:pro-float 3s ease-in-out infinite',
      'user-select:none',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');

    btn.innerHTML = `
      <span style="font-size:1.8rem;line-height:1;">📝</span>
      <span style="font-size:0.72rem;font-weight:700;margin-top:3px;letter-spacing:0.02em;">日報</span>
    `;

    // 新フローに統一
    btn.addEventListener('click', () => {
      if (typeof handleDailyButtonPress === 'function') {
        handleDailyButtonPress();
      } else if (typeof navigate === 'function') {
        navigate('daily');
      }
    });

    document.body.appendChild(btn);
  }
};

window.addEventListener('load', () => {
  setTimeout(() => ProFeature.init(), 800);
});
