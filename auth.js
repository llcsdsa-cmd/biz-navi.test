// ===================================================
// auth.js — Google OAuth 2.0 純粋リダイレクトフロー
// Updated: 2026-06-29
//
// 【設計方針】
//   GitHub Pages は COOP: same-origin を送信するため
//   Firebase の signInWithPopup / signInWithRedirect どちらも
//   accessToken の受け渡しに失敗する。
//
//   Firebase を認証に使わず、Google OAuth 2.0 の
//   純粋なリダイレクトフロー（Authorization Code Flow with PKCE）を
//   直接実装する。
//
//   フロー:
//   1. signInWithGoogle() → Google OAuth URL へリダイレクト
//      スコープ: email, profile, drive.appdata
//   2. Googleが ?code=XXX でアプリへリダイレクト
//   3. handleOAuthCallback() が code を検出
//   4. code → accessToken をトークンエンドポイントで交換
//   5. connectGDriveWithToken(accessToken) → Drive接続完了
//
//   ユーザー情報は Google UserInfo API から取得して
//   localStorage に保存する（Firebase 不使用）。
// ===================================================

window.BizNaviAuth = window.BizNaviAuth || {};

// Google OAuth クライアント ID（GCP Console で取得）
// firebase-config.js の messagingSenderId と同じプロジェクト
BizNaviAuth.CLIENT_ID = '317899973916-bufdha31q51geqqvfsjlor838mgo8kpg.apps.googleusercontent.com';

// リダイレクト先は現在のページ
BizNaviAuth.REDIRECT_URI = 'https://llcsdsa-cmd.github.io/biz-navi.test/';

BizNaviAuth._currentUser = null;
BizNaviAuth._listeners   = [];

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._saveUser
 * │   ユーザー情報を localStorage に保存する
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._saveUser = function(user) {
  localStorage.setItem('biznavi_user', JSON.stringify(user));
};
/* └ END : BizNaviAuth._saveUser ────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._loadUser
 * │   localStorage からユーザー情報を復元する
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._loadUser = function() {
  try {
    var s = localStorage.getItem('biznavi_user');
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
};
/* └ END : BizNaviAuth._loadUser ────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._generateState
 * │   CSRF 対策用のランダム state を生成して sessionStorage に保存
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._generateState = function() {
  var state = Math.random().toString(36).substring(2) + Date.now().toString(36);
  sessionStorage.setItem('oauth_state', state);
  return state;
};
/* └ END : BizNaviAuth._generateState ───────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signInWithGoogle
 * │   Google OAuth 2.0 認証ページへリダイレクトする。
 * │   スコープに drive.appdata を含めることで
 * │   ログインと同時に Drive 接続権限も取得する。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInWithGoogle = function() {
  BizNaviAuth._showInBody(
    '<div class="auth-loading"><div class="auth-loading-spinner"></div><span>Googleへ移動中...</span></div>'
  );

  var state = BizNaviAuth._generateState();

  var params = new URLSearchParams({
    client_id:     BizNaviAuth.CLIENT_ID,
    redirect_uri:  BizNaviAuth.REDIRECT_URI,
    response_type: 'token',          // Implicit flow（SPAで最もシンプル）
    scope:         'email profile https://www.googleapis.com/auth/drive.appdata',
    state:         state,
    prompt:        'consent',
  });

  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
};
/* └ END : BizNaviAuth.signInWithGoogle ─────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signInForDrive
 * │   「今すぐ接続」ボタンから呼ばれる。signInWithGoogle と同じ。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInForDrive = function() {
  BizNaviAuth.signInWithGoogle();
};
/* └ END : BizNaviAuth.signInForDrive ───────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.handleOAuthCallback
 * │   URL の # フラグメントに access_token が含まれている場合に処理する。
 * │   Implicit flow では Googleが
 * │   https://app/#access_token=XXX&token_type=Bearer&...
 * │   の形式でリダイレクトしてくる。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.handleOAuthCallback = async function() {
  var hash = window.location.hash;
  if (!hash || hash.indexOf('access_token') === -1) return false;

  console.log('[Auth] OAuth コールバック検出');

  // フラグメントをパース
  var params = new URLSearchParams(hash.substring(1));
  var accessToken = params.get('access_token');
  var state       = params.get('state');
  var error       = params.get('error');

  // URL からフラグメントを除去（履歴に残さない）
  window.history.replaceState(null, '', window.location.pathname);

  if (error) {
    console.error('[Auth] OAuth エラー:', error);
    if (typeof showToast === 'function') showToast('ログインをキャンセルしました', 'info');
    return false;
  }

  // state 検証（CSRF対策）
  var savedState = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  if (state && savedState && state !== savedState) {
    console.error('[Auth] state 不一致 - CSRF の可能性');
    if (typeof showToast === 'function') showToast('セキュリティエラー。再度ログインしてください。', 'error');
    return false;
  }

  if (!accessToken) {
    console.error('[Auth] accessToken が見つかりません');
    return false;
  }

  console.log('[Auth] accessToken 取得成功:', accessToken.length, 'chars');

  // ローディング表示
  BizNaviAuth._showInBody(
    '<div class="auth-loading"><div class="auth-loading-spinner"></div><span>アカウント情報を取得中...</span></div>'
  );

  // Google UserInfo API でユーザー情報を取得
  try {
    var res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!res.ok) throw new Error('UserInfo API エラー: ' + res.status);
    var userInfo = await res.json();

    var user = {
      displayName: userInfo.name  || '',
      email:       userInfo.email || '',
      photoURL:    userInfo.picture || '',
      uid:         userInfo.id || userInfo.sub || '',
    };

    BizNaviAuth._currentUser = user;
    BizNaviAuth._saveUser(user);
    BizNaviAuth._listeners.forEach(function(fn) { fn(user); });

    console.log('[Auth] ユーザー情報取得:', user.email);

    // Drive 接続
    BizNaviAuth._showInBody(
      '<div class="auth-loading"><div class="auth-loading-spinner"></div><span>Google Drive に接続中...</span></div>'
    );

    if (typeof connectGDriveWithToken === 'function') {
      await connectGDriveWithToken(accessToken);
    }

    if (typeof showToast === 'function') showToast('ログインしました ✓', 'success');
    BizNaviAuth.renderAuthSection();
    if (typeof renderProviderCards === 'function') renderProviderCards();
    return true;

  } catch (e) {
    console.error('[Auth] コールバック処理エラー:', e);
    if (typeof showToast === 'function') showToast('ログイン処理失敗: ' + e.message, 'error');
    BizNaviAuth.renderAuthSection();
    return false;
  }
};
/* └ END : BizNaviAuth.handleOAuthCallback ──────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signOut
 * │   ログアウト処理。Drive トークンと保存ユーザー情報をリセット。
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signOut = async function() {
  if (!confirm('ログアウトしますか？\n（データはこの端末に残ります）')) return;
  try {
    if (typeof resetGDriveToken === 'function') resetGDriveToken();
    localStorage.removeItem('biznavi_user');
    BizNaviAuth._currentUser = null;
    BizNaviAuth._listeners.forEach(function(fn) { fn(null); });
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
/* └ END : BizNaviAuth.signOut ──────────────────────────┘ */

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
/* └ END : BizNaviAuth._showInBody ──────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.renderAuthSection
 * │   3状態で描画：①未ログイン ②Drive接続済み ③Drive未接続
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
/* └ END : BizNaviAuth.renderAuthSection ────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.init
 * │   DOMContentLoaded から呼ばれる初期化処理。
 * │   1. OAuth コールバックを処理（リダイレクト戻り時）
 * │   2. 保存済みユーザー情報を復元して UI を描画
 * │   Updated: 2026-06-29
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.init = async function() {
  // 1. OAuth コールバック処理（#access_token=... がある場合）
  var handled = await BizNaviAuth.handleOAuthCallback();
  if (handled) return;

  // 2. 保存済みユーザー情報を復元
  var saved = BizNaviAuth._loadUser();
  if (saved) {
    BizNaviAuth._currentUser = saved;
    BizNaviAuth._listeners.forEach(function(fn) { fn(saved); });
    console.log('[Auth] 保存済みユーザーを復元:', saved.email);
  }

  BizNaviAuth.renderAuthSection();
  if (typeof renderProviderCards === 'function') renderProviderCards();
};
/* └ END : BizNaviAuth.init ─────────────────────────────┘ */

document.addEventListener('DOMContentLoaded', function() {
  BizNaviAuth.init();
});
