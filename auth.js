// ===================================================
// auth.js — Firebase Auth（Google OAuth）認証管理
// Updated: 2026-06-29
//
// 【設計方針】
//   GitHub Pages は COOP: same-origin ヘッダーを送信するため
//   signInWithPopup では accessToken が null になる。
//   signInWithRedirect を使い、リダイレクト完了後に
//   getRedirectResult() で accessToken を取得し、
//   そのまま connectGDriveWithToken() を呼ぶことで
//   「Gmailでログイン」1タップで Drive 接続まで完結させる。
// ===================================================

window.BizNaviAuth = window.BizNaviAuth || {};

BizNaviAuth._initialized = false;
BizNaviAuth._auth        = null;
BizNaviAuth._currentUser = null;
BizNaviAuth._listeners   = [];

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._loadScript
 * │   外部スクリプトを動的に読み込むユーティリティ
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._loadScript = function(src) {
  return new Promise(function(resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = function() { reject(new Error('Script load failed: ' + src)); };
    document.head.appendChild(s);
  });
};
/* └ END : BizNaviAuth._loadScript ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.initFirebase
 * │   Firebase SDK を読み込み Auth を初期化する。
 * │   初期化完了後に _handleRedirectResult() を呼び、
 * │   リダイレクトログイン後の accessToken を処理する。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.initFirebase = async function() {
  if (BizNaviAuth._initialized) return true;

  var cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    console.error('[Auth] FIREBASE_CONFIG が未設定です');
    BizNaviAuth._showInBody('<div style="padding:12px;color:#ef4444;font-size:0.85rem;">⚠️ Firebase未設定</div>');
    return false;
  }

  try {
    if (typeof firebase === 'undefined') {
      await BizNaviAuth._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await BizNaviAuth._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);

    BizNaviAuth._auth = firebase.auth();
    BizNaviAuth._initialized = true;
    console.log('[Auth] Firebase初期化完了');

    // onAuthStateChanged でログイン状態を監視
    BizNaviAuth._auth.onAuthStateChanged(function(user) {
      BizNaviAuth._currentUser = user;
      BizNaviAuth._listeners.forEach(function(fn) { fn(user); });
      BizNaviAuth.renderAuthSection();
      if (typeof renderProviderCards === 'function') renderProviderCards();
    });

    // リダイレクトログイン後の accessToken 処理
    await BizNaviAuth._handleRedirectResult();

    return true;
  } catch (e) {
    console.error('[Auth] Firebase初期化失敗:', e);
    BizNaviAuth._showInBody('<div style="padding:12px;color:#ef4444;font-size:0.85rem;">⚠️ 読み込み失敗。再読み込みしてください。</div>');
    return false;
  }
};
/* └ END : BizNaviAuth.initFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._handleRedirectResult
 * │   signInWithRedirect 完了後にページが読み込まれたとき
 * │   getRedirectResult() で accessToken を取得し、
 * │   そのまま connectGDriveWithToken() を呼んで Drive 接続を完結させる。
 * │   リダイレクト後でない通常起動時は result が null なので何もしない。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._handleRedirectResult = async function() {
  try {
    var result = await BizNaviAuth._auth.getRedirectResult();
    if (!result || !result.user) {
      console.log('[Auth] リダイレクト結果なし（通常起動）');
      return;
    }

    console.log('[Auth] リダイレクトログイン成功:', result.user.email);

    // accessToken を取得（リダイレクト方式では確実に取れる）
    var accessToken = null;

    var credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken) {
      accessToken = credential.accessToken;
      console.log('[Auth] credentialFromResult でaccessToken取得');
    }
    if (!accessToken && result._tokenResponse && result._tokenResponse.oauthAccessToken) {
      accessToken = result._tokenResponse.oauthAccessToken;
      console.log('[Auth] _tokenResponse.oauthAccessToken でaccessToken取得');
    }

    console.log('[Auth] accessToken:', accessToken ? '取得成功(' + accessToken.length + 'chars)' : 'null');

    if (accessToken && typeof connectGDriveWithToken === 'function') {
      // Drive接続中スピナーを表示
      BizNaviAuth._showInBody(
        '<div class="auth-loading"><div class="auth-loading-spinner"></div><span>Google Drive に接続中...</span></div>'
      );
      var ok = await connectGDriveWithToken(accessToken);
      if (ok) {
        if (typeof showToast === 'function') showToast('Google Drive バックアップが有効になりました ✓', 'success');
      }
    } else if (!accessToken) {
      console.warn('[Auth] accessToken を取得できませんでした');
      if (typeof showToast === 'function') showToast('ログインしました（Drive接続は「今すぐ接続」から）', 'info');
    }

    if (typeof showToast === 'function') showToast('ログインしました ✓', 'success');

  } catch (e) {
    console.error('[Auth] getRedirectResult エラー:', e.code, e.message);
    // エラーでも UI はリセットする（onAuthStateChanged が処理する）
  }
};
/* └ END : BizNaviAuth._handleRedirectResult ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signInWithGoogle
 * │   「Gmailでログイン」ボタンから呼ばれる。
 * │   signInWithRedirect でGoogle認証ページへ遷移させる。
 * │   戻ってきたら _handleRedirectResult() が Drive 接続まで完結させる。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInWithGoogle = async function() {
  BizNaviAuth._showInBody(
    '<div class="auth-loading"><div class="auth-loading-spinner"></div><span>Googleログインへ移動中...</span></div>'
  );

  try {
    var ok = await BizNaviAuth.initFirebase();
    if (!ok) { BizNaviAuth.renderAuthSection(); return; }

    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.addScope('https://www.googleapis.com/auth/drive.appdata');
    // prompt:'consent' で drive.appdata スコープを毎回明示的に要求
    provider.setCustomParameters({ prompt: 'consent', access_type: 'online' });

    // リダイレクト方式（COOPに影響されない）
    await BizNaviAuth._auth.signInWithRedirect(provider);
    // ↑ この後ページがGoogleへ遷移するため、以下のコードは実行されない

  } catch (e) {
    console.error('[Auth] signInWithRedirect 失敗:', e.code, e.message);
    if (typeof showToast === 'function') showToast('ログイン失敗: ' + e.message, 'error');
    BizNaviAuth.renderAuthSection();
  }
};
/* └ END : BizNaviAuth.signInWithGoogle ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signInForDrive
 * │   「今すぐ接続」ボタンから呼ばれる Drive 接続専用フロー。
 * │   既ログイン済みの場合も signInWithRedirect で再取得。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInForDrive = async function() {
  try {
    var ok = await BizNaviAuth.initFirebase();
    if (!ok) return;

    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.appdata');
    provider.setCustomParameters({ prompt: 'consent', access_type: 'online' });

    await BizNaviAuth._auth.signInWithRedirect(provider);
    // Googleへ遷移。戻ってきたら _handleRedirectResult が処理する。

  } catch (e) {
    console.error('[Auth] signInForDrive 失敗:', e.code);
    if (typeof showToast === 'function') showToast('Drive接続失敗: ' + e.message, 'error');
  }
};
/* └ END : BizNaviAuth.signInForDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signOut
 * │   ログアウト処理。Drive トークンもリセットする。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signOut = async function() {
  if (!confirm('ログアウトしますか？\n（データはこの端末に残ります）')) return;
  try {
    if (typeof resetGDriveToken === 'function') resetGDriveToken();
    if (BizNaviAuth._auth) await BizNaviAuth._auth.signOut();
    BizNaviAuth._currentUser = null;
    if (typeof storageSettings !== 'undefined') {
      storageSettings.gdrive = { connected: false };
      if (typeof saveStorageSettings === 'function') saveStorageSettings();
    }
    BizNaviAuth.renderAuthSection();
    if (typeof renderProviderCards === 'function') renderProviderCards();
    if (typeof showToast === 'function') showToast('ログアウトしました', 'info');
  } catch (e) {
    if (typeof showToast === 'function') showToast('ログアウト失敗: ' + e.message, 'error');
  }
};
/* └ END : BizNaviAuth.signOut ──────────────────────────────────────────────┘ */

BizNaviAuth.getCurrentUser     = function() { return BizNaviAuth._currentUser; };
BizNaviAuth.onAuthStateChanged = function(cb) { BizNaviAuth._listeners.push(cb); };

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._showInBody
 * │   auth-section-body に HTML をセットするユーティリティ
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._showInBody = function(html) {
  var el = document.getElementById('auth-section-body');
  if (el) el.innerHTML = html;
};
/* └ END : BizNaviAuth._showInBody ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.renderAuthSection
 * │   3状態で描画：①未ログイン ②ログイン済み+Drive接続済み ③ログイン済み+Drive未接続
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.renderAuthSection = function() {
  var el = document.getElementById('auth-section-body');
  if (!el) return;
  var user = BizNaviAuth._currentUser;

  if (!user) {
    el.innerHTML =
      '<div style="padding:8px 0 12px;">' +
        '<button id="auth-signin-btn" onclick="BizNaviAuth.signInWithGoogle()" class="auth-google-btn">' +
          '<span class="auth-google-logo">' +
            '<svg width="20" height="20" viewBox="0 0 48 48">' +
              '<path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-21 0-1.3-.2-2.7-.5-4z"/>' +
              '<path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>' +
              '<path fill="#FBBC05" d="M24 46c5.7 0 10.8-1.9 14.8-5.1l-6.9-5.7C29.8 36.9 27 38 24 38c-5.8 0-10.7-3.7-12.5-9L4.6 34.8C8.1 41.3 15.5 46 24 46z"/>' +
              '<path fill="#EA4335" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37l6.9 5.7C39.7 39.7 46 32.6 46 24c0-1.3-.2-2.7-.5-4z"/>' +
            '</svg>' +
          '</span>' +
          '<span class="auth-google-text">Gmailでログイン</span>' +
        '</button>' +
        '<div class="auth-hint">ログインするだけで <b>Google Drive 自動バックアップ</b>が有効になります。</div>' +
      '</div>';
    return;
  }

  var name    = user.displayName || 'ユーザー';
  var email   = user.email || '';
  var photo   = user.photoURL || '';
  var driveOk = (typeof storageSettings !== 'undefined') && !!(storageSettings.gdrive || {}).connected;

  var avatarHtml = photo
    ? '<img src="' + photo + '" class="auth-avatar" referrerpolicy="no-referrer" alt="avatar">'
    : '<div class="auth-avatar auth-avatar-placeholder">👤</div>';

  var driveHtml = driveOk
    ? '<div class="auth-drive-status auth-drive-ok">☁️ Google Drive バックアップ <b>接続済み</b></div>'
    : '<div class="auth-drive-status auth-drive-pending">' +
        '<span>⚠️ Google Drive 未接続</span>' +
        '<button class="auth-drive-connect-btn" onclick="BizNaviAuth.signInForDrive()">今すぐ接続</button>' +
      '</div>';

  el.innerHTML =
    '<div class="auth-user-card">' +
      '<div class="auth-user-row">' +
        avatarHtml +
        '<div class="auth-user-info">' +
          '<div class="auth-user-name">' + name + '</div>' +
          '<div class="auth-user-email">' + email + '</div>' +
          '<div class="auth-user-badge">✓ Google でログイン中</div>' +
        '</div>' +
      '</div>' +
      driveHtml +
      '<button onclick="BizNaviAuth.signOut()" class="auth-signout-btn">ログアウト</button>' +
    '</div>';
};
/* └ END : BizNaviAuth.renderAuthSection ──────────────────────────────────────────────┘ */

document.addEventListener('DOMContentLoaded', function() {
  BizNaviAuth.initFirebase();
});
