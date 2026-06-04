// ===================================================
// auth.js — Firebase Auth（Google OAuth）認証管理
// Google OAuth のみ対応。データはスマホ内に保持。
// 認証はユーザー識別・クラウド同期のみに使用。
// ===================================================

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth 名前空間
 * │   Firebase Auth を使ったGoogle OAuth認証の全機能をまとめる。
 * │   - initFirebase()       : Firebase初期化
 * │   - signInWithGoogle()   : Googleでログイン
 * │   - signOut()            : ログアウト
 * │   - onAuthStateChanged() : ログイン状態監視
 * │   - getCurrentUser()     : 現在のユーザー情報取得
 * │   - renderAuthSection()  : 設定ページの認証UIを描画
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
window.BizNaviAuth = window.BizNaviAuth || {};

// ----- 内部状態 -----
BizNaviAuth._initialized = false;
BizNaviAuth._auth        = null;  // firebase.auth() インスタンス
BizNaviAuth._currentUser = null;  // 現在のユーザー or null
BizNaviAuth._listeners   = [];    // onAuthStateChanged コールバックリスト

// Firebase config の localStorage キー
const FIREBASE_CONFIG_KEY = 'bizNavi_firebaseConfig';

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.loadConfig
 * │   localStorageからFirebase設定を読み込む
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.loadConfig = function() {
  try {
    return JSON.parse(localStorage.getItem(FIREBASE_CONFIG_KEY) || 'null');
  } catch { return null; }
};
/* └ END : BizNaviAuth.loadConfig ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.saveConfig
 * │   Firebase設定をlocalStorageに保存する
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.saveConfig = function(cfg) {
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(cfg));
};
/* └ END : BizNaviAuth.saveConfig ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.initFirebase
 * │   Firebase SDKを動的に読み込み、Firebase Authを初期化する。
 * │   Firebase設定が未入力の場合は何もしない。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.initFirebase = async function() {
  if (BizNaviAuth._initialized) return true;

  const cfg = BizNaviAuth.loadConfig();
  if (!cfg || !cfg.apiKey) {
    console.log('[Auth] Firebase設定が未入力のためスキップ');
    return false;
  }

  try {
    // Firebase App SDK が未読み込みなら動的に読み込む
    if (typeof firebase === 'undefined') {
      await BizNaviAuth._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await BizNaviAuth._loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
    }

    // 重複初期化を防ぐ
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }

    BizNaviAuth._auth = firebase.auth();
    BizNaviAuth._initialized = true;

    // ログイン状態を監視
    BizNaviAuth._auth.onAuthStateChanged(user => {
      BizNaviAuth._currentUser = user;
      BizNaviAuth._listeners.forEach(fn => fn(user));
      BizNaviAuth.renderAuthSection(); // UI更新
    });

    console.log('[Auth] Firebase初期化完了');
    return true;

  } catch (e) {
    console.error('[Auth] Firebase初期化失敗:', e.message);
    return false;
  }
};
/* └ END : BizNaviAuth.initFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._loadScript
 * │   scriptタグを動的に追加してSDKを読み込む内部ヘルパー
 * │   Updated: 2026-06-05
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
 * │ ▶ START : BizNaviAuth.signInWithGoogle
 * │   Googleアカウントでポップアップログインを実行する
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInWithGoogle = async function() {
  const btn = document.getElementById('auth-signin-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'ログイン中...'; }

  try {
    const ok = await BizNaviAuth.initFirebase();
    if (!ok) {
      // Firebase未設定の場合は設定フォームを表示
      BizNaviAuth._showConfigForm();
      if (btn) { btn.disabled = false; btn.textContent = 'Gmailでログイン'; }
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    await BizNaviAuth._auth.signInWithPopup(provider);
    // onAuthStateChanged が自動でUIを更新する

  } catch (e) {
    console.error('[Auth] ログイン失敗:', e.message);
    const msg = e.code === 'auth/popup-closed-by-user'
      ? 'ログインがキャンセルされました'
      : `ログイン失敗: ${e.message}`;
    if (typeof showToast === 'function') showToast(msg, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Gmailでログイン'; }
  }
};
/* └ END : BizNaviAuth.signInWithGoogle ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signOut
 * │   ログアウト処理を実行する
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signOut = async function() {
  if (!confirm('ログアウトしますか？\n（データはこの端末に残ります）')) return;
  try {
    if (BizNaviAuth._auth) await BizNaviAuth._auth.signOut();
    BizNaviAuth._currentUser = null;
    BizNaviAuth.renderAuthSection();
    if (typeof showToast === 'function') showToast('ログアウトしました', 'info');
  } catch (e) {
    if (typeof showToast === 'function') showToast('ログアウト失敗: ' + e.message, 'error');
  }
};
/* └ END : BizNaviAuth.signOut ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.getCurrentUser
 * │   現在ログイン中のユーザー情報を返す（未ログインはnull）
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.getCurrentUser = function() {
  return BizNaviAuth._currentUser;
};
/* └ END : BizNaviAuth.getCurrentUser ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.onAuthStateChanged
 * │   ログイン状態変化時のコールバックを登録する
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.onAuthStateChanged = function(callback) {
  BizNaviAuth._listeners.push(callback);
};
/* └ END : BizNaviAuth.onAuthStateChanged ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.renderAuthSection
 * │   設定ページの「アカウント」セクションのUIを描画する。
 * │   ログイン状態・Firebase設定状況によってUIを切り替える。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.renderAuthSection = function() {
  const el = document.getElementById('auth-section-body');
  if (!el) return;

  const user    = BizNaviAuth._currentUser;
  const hasCfg  = !!(BizNaviAuth.loadConfig()?.apiKey);

  if (user) {
    // ── ログイン済み ──
    const name    = user.displayName || 'ユーザー';
    const email   = user.email || '';
    const photo   = user.photoURL || '';
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
        <button onclick="BizNaviAuth.signOut()" class="auth-signout-btn">ログアウト</button>
      </div>`;
  } else if (!hasCfg) {
    // ── Firebase未設定 ──
    el.innerHTML = `
      <div style="padding:4px 0 12px;">
        <button id="auth-signin-btn" onclick="BizNaviAuth.signInWithGoogle()" class="auth-google-btn">
          <span class="auth-google-logo">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-21 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/><path fill="#FBBC05" d="M24 46c5.7 0 10.8-1.9 14.8-5.1l-6.9-5.7C29.8 36.9 27 38 24 38c-5.8 0-10.7-3.7-12.5-9L4.6 34.8C8.1 41.3 15.5 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37l6.9 5.7C39.7 39.7 46 32.6 46 24c0-1.3-.2-2.7-.5-4z"/></svg>
          </span>
          <span class="auth-google-text">Gmailでログイン</span>
        </button>
        <div class="auth-hint">
          ログインすると、複数端末でのデータ復元や<br>クラウド同期が利用できます。
        </div>
        <button onclick="BizNaviAuth._showConfigForm()" class="auth-setup-link">
          ⚙️ Firebase設定を入力する
        </button>
      </div>`;
  } else {
    // ── Firebase設定済み・未ログイン ──
    el.innerHTML = `
      <div style="padding:4px 0 12px;">
        <button id="auth-signin-btn" onclick="BizNaviAuth.signInWithGoogle()" class="auth-google-btn">
          <span class="auth-google-logo">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-21 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/><path fill="#FBBC05" d="M24 46c5.7 0 10.8-1.9 14.8-5.1l-6.9-5.7C29.8 36.9 27 38 24 38c-5.8 0-10.7-3.7-12.5-9L4.6 34.8C8.1 41.3 15.5 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37l6.9 5.7C39.7 39.7 46 32.6 46 24c0-1.3-.2-2.7-.5-4z"/></svg>
          </span>
          <span class="auth-google-text">Gmailでログイン</span>
        </button>
        <div class="auth-hint">
          ログインすると、複数端末でのデータ復元や<br>クラウド同期が利用できます。
        </div>
        <button onclick="BizNaviAuth._showConfigForm()" class="auth-setup-link">
          ⚙️ Firebase設定を変更する
        </button>
      </div>`;
  }
};
/* └ END : BizNaviAuth.renderAuthSection ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._showConfigForm
 * │   Firebase設定入力フォームをモーダルで表示する
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._showConfigForm = function() {
  const existing = document.getElementById('firebase-config-modal');
  if (existing) existing.remove();

  const cfg = BizNaviAuth.loadConfig() || {};

  const modal = document.createElement('div');
  modal.id = 'firebase-config-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99998;display:flex;align-items:flex-end;justify-content:center;`;

  modal.innerHTML = `
    <div style="background:var(--color-surface,#fff);width:100%;max-width:520px;
                border-radius:20px 20px 0 0;max-height:90vh;
                display:flex;flex-direction:column;overflow:hidden;">
      <div style="padding:18px 20px 14px;border-bottom:1px solid var(--color-border,#e2e8f0);flex-shrink:0;
                  display:flex;align-items:center;justify-content:space-between;">
        <div style="font-weight:700;font-size:1rem;">⚙️ Firebase設定</div>
        <button onclick="document.getElementById('firebase-config-modal').remove()"
          style="background:none;border:none;font-size:1.4rem;color:var(--color-muted);cursor:pointer;">✕</button>
      </div>
      <div style="overflow-y:auto;padding:16px 20px 32px;flex:1;">
        <div style="font-size:0.78rem;color:var(--color-muted);margin-bottom:16px;line-height:1.7;">
          <a href="https://console.firebase.google.com/" target="_blank"
            style="color:var(--color-accent);text-decoration:none;">Firebase Console →</a>
          でプロジェクトを作成し、「アプリを追加」→「ウェブ」からコンフィグを取得してください。<br>
          Authentication → ログイン方法 → Google を有効化してください。
        </div>
        ${[
          ['apiKey',            'API Key',            'AIzaSy...'],
          ['authDomain',        'Auth Domain',        'your-app.firebaseapp.com'],
          ['projectId',         'Project ID',         'your-project-id'],
          ['storageBucket',     'Storage Bucket',     'your-app.appspot.com'],
          ['messagingSenderId', 'Messaging Sender ID','123456789'],
          ['appId',             'App ID',             '1:123...:web:abc...'],
        ].map(([key, label, ph]) => `
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:0.75rem;font-weight:700;
                          color:var(--color-muted);margin-bottom:4px;">${label}</label>
            <input id="fb-${key}" type="text" value="${cfg[key] || ''}"
              placeholder="${ph}"
              style="width:100%;padding:10px 12px;border:1px solid var(--color-border-mid);
                     border-radius:8px;font-size:0.82rem;box-sizing:border-box;
                     background:var(--color-bg);color:var(--color-text);">
          </div>`).join('')}
        <button onclick="BizNaviAuth._saveConfigFromForm()" 
          style="width:100%;padding:14px;background:var(--color-accent,#6366f1);color:#fff;
                 border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;margin-top:4px;">
          保存してログイン画面へ
        </button>
        <button onclick="BizNaviAuth._clearConfig()"
          style="width:100%;padding:12px;background:none;border:1px solid #fca5a5;color:#991b1b;
                 border-radius:12px;font-size:0.85rem;font-weight:600;cursor:pointer;margin-top:8px;">
          設定を削除
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};
/* └ END : BizNaviAuth._showConfigForm ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._saveConfigFromForm
 * │   Firebase設定フォームの値を読み取ってlocalStorageに保存する
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._saveConfigFromForm = function() {
  const keys = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
  const cfg  = {};
  for (const k of keys) {
    const val = document.getElementById(`fb-${k}`)?.value?.trim();
    if (!val) {
      if (typeof showToast === 'function') showToast(`${k} を入力してください`, 'error');
      return;
    }
    cfg[k] = val;
  }
  BizNaviAuth.saveConfig(cfg);
  document.getElementById('firebase-config-modal')?.remove();
  if (typeof showToast === 'function') showToast('Firebase設定を保存しました', 'success');
  BizNaviAuth._initialized = false; // 再初期化を強制
  BizNaviAuth.renderAuthSection();
};
/* └ END : BizNaviAuth._saveConfigFromForm ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._clearConfig
 * │   Firebase設定を削除してリセットする
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._clearConfig = function() {
  if (!confirm('Firebase設定を削除しますか？')) return;
  localStorage.removeItem(FIREBASE_CONFIG_KEY);
  BizNaviAuth._initialized = false;
  BizNaviAuth._currentUser = null;
  BizNaviAuth._auth        = null;
  document.getElementById('firebase-config-modal')?.remove();
  BizNaviAuth.renderAuthSection();
  if (typeof showToast === 'function') showToast('Firebase設定を削除しました', 'info');
};
/* └ END : BizNaviAuth._clearConfig ──────────────────────────────────────────────┘ */

// ── ページ読み込み時に自動初期化 ──
document.addEventListener('DOMContentLoaded', async () => {
  // Firebase設定があれば自動で初期化
  await BizNaviAuth.initFirebase();
  // 設定ページのUI描画（設定ページが既に表示されていれば更新）
  BizNaviAuth.renderAuthSection();
});
