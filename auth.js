// ===================================================
// auth.js — Firebase Auth（Google OAuth）認証管理
// Updated: 2026-06-10
//
// フロー:
//   1. DOMContentLoaded → initFirebase()
//   2. Firebase初期化完了 → onAuthStateChanged 登録
//   3. ログイン済みなら即UI更新、未ログインならボタン表示
//   4. ログインボタン押下 → signInWithGoogle()
//   5. signInWithPopup 成功 → credential.accessToken取得
//   6. connectGDriveWithToken() → Drive接続完了
// ===================================================

window.BizNaviAuth = window.BizNaviAuth || {};

BizNaviAuth._initialized = false;
BizNaviAuth._auth        = null;
BizNaviAuth._currentUser = null;
BizNaviAuth._listeners   = [];

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._loadScript
 * │   scriptタグを動的に追加してSDKを読み込む内部ヘルパー
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._loadScript = function(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(s);
  });
};
/* └ END : BizNaviAuth._loadScript ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.initFirebase
 * │   Firebase SDKを動的に読み込み、Auth を初期化する。
 * │   window.FIREBASE_CONFIG が正しく設定されていれば動作する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.initFirebase = async function() {
  if (BizNaviAuth._initialized) return true;

  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    console.error('[Auth] FIREBASE_CONFIG が未設定です');
    BizNaviAuth._renderError('設定エラー: Firebase未設定');
    return false;
  }

  try {
    if (typeof firebase === 'undefined') {
      await BizNaviAuth._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await BizNaviAuth._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }

    BizNaviAuth._auth = firebase.auth();
    BizNaviAuth._initialized = true;

    // ── onAuthStateChanged: ログイン状態変化をすべてここで捌く ──
    BizNaviAuth._auth.onAuthStateChanged(user => {
      BizNaviAuth._currentUser = user;
      BizNaviAuth._listeners.forEach(fn => fn(user));
      BizNaviAuth.renderAuthSection();
      if (typeof renderProviderCards === 'function') renderProviderCards();

      if (user) {
        console.log('[Auth] ログイン済み:', user.email);
        // Drive未接続かつトークンがメモリにある場合は自動接続を試みる
        if (typeof _gdriveToken !== 'undefined' && _gdriveToken &&
            typeof storageSettings !== 'undefined' &&
            !(storageSettings.gdrive || {}).connected) {
          if (typeof connectGDriveWithToken === 'function') {
            connectGDriveWithToken(_gdriveToken.token).catch(() => {});
          }
        }
      }
    });

    console.log('[Auth] Firebase初期化完了');
    return true;

  } catch (e) {
    console.error('[Auth] Firebase初期化失敗:', e.message);
    BizNaviAuth._renderError('読み込み失敗。再読み込みしてください。');
    return false;
  }
};
/* └ END : BizNaviAuth.initFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._renderError
 * │   auth-section-body にエラーメッセージを表示する
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._renderError = function(msg) {
  const el = document.getElementById('auth-section-body');
  if (!el) return;
  el.innerHTML = `<div style="padding:12px;color:var(--color-danger,#ef4444);font-size:0.85rem;">⚠️ ${msg}</div>`;
};
/* └ END : BizNaviAuth._renderError ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signInWithGoogle
 * │   Googleアカウントでポップアップログインを実行する。
 * │   ログイン成功後、credential.accessToken で Drive接続も完了する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInWithGoogle = async function() {
  // ボタンをローディング状態に
  const el = document.getElementById('auth-section-body');
  if (el) {
    el.innerHTML = `
      <div class="auth-loading">
        <div class="auth-loading-spinner"></div>
        <span>Googleアカウントを確認中...</span>
      </div>`;
  }

  try {
    const ok = await BizNaviAuth.initFirebase();
    if (!ok) {
      BizNaviAuth.renderAuthSection();
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.addScope('https://www.googleapis.com/auth/drive.appdata');

    const result = await BizNaviAuth._auth.signInWithPopup(provider);

    // credential.accessToken を Drive接続に直接使う
    const accessToken = result.credential?.accessToken;
    if (accessToken && typeof connectGDriveWithToken === 'function') {
      // UI更新は connectGDriveWithToken 内で行われる
      await connectGDriveWithToken(accessToken);
    }

    // onAuthStateChanged が renderAuthSection() を呼ぶので
    // ここでは showToast だけ
    if (typeof showToast === 'function') showToast('ログインしました ✓', 'success');

  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      if (typeof showToast === 'function') showToast('ログインがキャンセルされました', 'info');
    } else {
      console.error('[Auth] ログイン失敗:', e);
      if (typeof showToast === 'function') showToast(`ログイン失敗: ${e.message}`, 'error');
    }
    BizNaviAuth.renderAuthSection(); // ボタンを戻す
  }
};
/* └ END : BizNaviAuth.signInWithGoogle ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signOut
 * │   ログアウトし、Drive接続トークンもリセットする。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signOut = async function() {
  if (!confirm('ログアウトしますか？\n（データはこの端末に残ります）')) return;
  try {
    // Driveトークンをリセット
    if (typeof _gdriveToken !== 'undefined') {
      // gdrive.jsのモジュールスコープ変数を直接触れないためnullにする
      window._gdriveTokenExternal = null;
    }
    if (BizNaviAuth._auth) await BizNaviAuth._auth.signOut();
    BizNaviAuth._currentUser = null;
    // Drive接続状態もリセット
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

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.getCurrentUser
 * │   現在ログイン中のユーザーを返す（未ログインはnull）
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.getCurrentUser = function() {
  return BizNaviAuth._currentUser;
};
/* └ END : BizNaviAuth.getCurrentUser ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.onAuthStateChanged
 * │   ログイン状態変化時のコールバックを登録する
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.onAuthStateChanged = function(callback) {
  BizNaviAuth._listeners.push(callback);
};
/* └ END : BizNaviAuth.onAuthStateChanged ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.renderAuthSection
 * │   設定ページの「アカウント」セクションを描画する。
 * │
 * │   ① 未ログイン → Gmailでログインボタン
 * │   ② ログイン済み + Drive接続済み → 緑バッジ（完了状態）
 * │   ③ ログイン済み + Drive未接続   → 黄バッジ + 接続ボタン
 * │
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.renderAuthSection = function() {
  const el = document.getElementById('auth-section-body');
  if (!el) return;

  const user = BizNaviAuth._currentUser;

  if (!user) {
    // ── 未ログイン ──
    el.innerHTML = `
      <div style="padding:8px 0 12px;">
        <button id="auth-signin-btn" onclick="BizNaviAuth.signInWithGoogle()" class="auth-google-btn">
          <span class="auth-google-logo">
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-21 0-1.3-.2-2.7-.5-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 46c5.7 0 10.8-1.9 14.8-5.1l-6.9-5.7C29.8 36.9 27 38 24 38c-5.8 0-10.7-3.7-12.5-9L4.6 34.8C8.1 41.3 15.5 46 24 46z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37l6.9 5.7C39.7 39.7 46 32.6 46 24c0-1.3-.2-2.7-.5-4z"/>
            </svg>
          </span>
          <span class="auth-google-text">Gmailでログイン</span>
        </button>
        <div class="auth-hint">
          ログインするだけで <b>Google Drive 自動バックアップ</b>が有効になります。
        </div>
      </div>`;
    return;
  }

  // ── ログイン済み ──
  const name  = user.displayName || 'ユーザー';
  const email = user.email || '';
  const photo = user.photoURL || '';
  const driveConnected = (typeof storageSettings !== 'undefined')
    && !!(storageSettings.gdrive || {}).connected;

  el.innerHTML = `
    <div class="auth-user-card">
      <div class="auth-user-row">
        ${photo
          ? `<img src="${photo}" class="auth-avatar" referrerpolicy="no-referrer" alt="avatar">`
          : `<div class="auth-avatar auth-avatar-placeholder">👤</div>`}
        <div class="auth-user-info">
          <div class="auth-user-name">${name}</div>
          <div class="auth-user-email">${email}</div>
          <div class="auth-user-badge">✓ Google でログイン中</div>
        </div>
      </div>
      ${driveConnected
        ? `<div class="auth-drive-status auth-drive-ok">
             ☁️ Google Drive バックアップ <b>接続済み</b>
           </div>`
        : `<div class="auth-drive-status auth-drive-pending">
             <span>⚠️ Google Drive 未接続</span>
             <button class="auth-drive-connect-btn" onclick="connectGDrive()">今すぐ接続</button>
           </div>`}
      <button onclick="BizNaviAuth.signOut()" class="auth-signout-btn">ログアウト</button>
    </div>`;
};
/* └ END : BizNaviAuth.renderAuthSection ──────────────────────────────────────────────┘ */

// ── ページ読み込み時に自動初期化 ──
// DOMContentLoaded 後に Firebase初期化 → onAuthStateChanged → renderAuthSection の順で動く
document.addEventListener('DOMContentLoaded', () => {
  BizNaviAuth.initFirebase();
  // initFirebase は非同期だが、onAuthStateChanged が完了前に
  // renderAuthSection を呼んでも user=null なのでボタンが表示される
  // → onAuthStateChanged 発火後に正しい状態に上書きされる
});
