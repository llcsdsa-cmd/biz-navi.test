// ===================================================
// auth.js — Firebase Auth（Google OAuth）認証管理
// Updated: 2026-06-09
//
// Firebase設定は firebase-config.js に記載します（.gitignore済み）。
// firebase-config.js が存在しない場合はログイン機能が無効になります。
//
// ログインフロー:
//   Gmailでログイン → Firebase Auth認証 → Google Drive自動接続
//   （1回の操作で認証＋バックアップ設定が完了）
// ===================================================

/* ┌──────────────────────────────────────────────────────┐
 * │ Firebase設定参照
 * │ firebase-config.js で window.FIREBASE_CONFIG を定義してください。
 * │ このファイルはGitHubに上がりません（.gitignore対象）。
 * │ Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */

// firebase-config.js が読み込まれているか確認
const _firebaseConfigured = (
  typeof window.FIREBASE_CONFIG !== "undefined" &&
  window.FIREBASE_CONFIG.apiKey &&
  window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY"
);

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth 名前空間
 * │   Firebase Auth を使ったGoogle OAuth認証の全機能をまとめる。
 * │   ユーザーが操作するのは「Gmailでログイン」ボタンのみ。
 * │   ログイン完了後、Google Driveへの接続を自動で行う。
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
window.BizNaviAuth = window.BizNaviAuth || {};

BizNaviAuth._initialized = false;
BizNaviAuth._auth        = null;   // firebase.auth() インスタンス
BizNaviAuth._currentUser = null;   // 現在のユーザー or null
BizNaviAuth._listeners   = [];     // onAuthStateChanged コールバックリスト

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.initFirebase
 * │   Firebase SDKを動的に読み込み、Firebase Authを初期化する。
 * │   firebase-config.js が未設定の場合は何もしない。
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.initFirebase = async function() {
  if (BizNaviAuth._initialized) return true;
  if (!_firebaseConfigured) {
    console.log("[Auth] Firebase設定が未入力（firebase-config.js を作成してください）");
    return false;
  }

  try {
    if (typeof firebase === "undefined") {
      await BizNaviAuth._loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
      await BizNaviAuth._loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }

    BizNaviAuth._auth = firebase.auth();
    BizNaviAuth._initialized = true;

    // ログイン状態を監視してUIを自動更新 + Drive自動接続
    BizNaviAuth._auth.onAuthStateChanged(user => {
      BizNaviAuth._currentUser = user;
      BizNaviAuth._listeners.forEach(fn => fn(user));
      BizNaviAuth.renderAuthSection();
      if (typeof renderProviderCards === "function") renderProviderCards();

      // ログイン済み かつ Drive未接続の場合は自動接続を試みる
      if (user) {
        BizNaviAuth._autoConnectGDrive(user);
      }
    });

    console.log("[Auth] Firebase初期化完了");
    return true;

  } catch (e) {
    console.error("[Auth] Firebase初期化失敗:", e.message);
    return false;
  }
};
/* └ END : BizNaviAuth.initFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._loadScript
 * │   scriptタグを動的に追加してSDKを読み込む内部ヘルパー
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._loadScript = function(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(s);
  });
};
/* └ END : BizNaviAuth._loadScript ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth._autoConnectGDrive
 * │   ログイン済みユーザーのGoogle Driveに自動接続する。
 * │   既に接続済みの場合はスキップ。
 * │   GISトークン取得はサイレントで試み、失敗してもエラーを出さない。
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth._autoConnectGDrive = async function(user) {
  try {
    // storageSettings が存在しない場合はスキップ
    if (typeof storageSettings === "undefined") return;

    // 既にDrive接続済みならスキップ
    const gCfg = storageSettings.gdrive || {};
    if (gCfg.connected) return;

    // connectGDriveAuto が利用可能であれば呼ぶ
    if (typeof connectGDriveAuto === "function") {
      await connectGDriveAuto(user.email);
    }
  } catch (e) {
    // 自動接続失敗はサイレントに（手動ボタンが残っているため問題なし）
    console.log("[Auth] Drive自動接続スキップ:", e.message);
  }
};
/* └ END : BizNaviAuth._autoConnectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signInWithGoogle
 * │   Googleアカウントでポップアップログインを実行する。
 * │   ログイン成功後、Google Drive接続を自動で実行する。
 * │   Firebase未設定時はトーストで開発者向けメッセージを表示。
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signInWithGoogle = async function() {
  const btn = document.getElementById("auth-signin-btn");
  const btnText = btn ? btn.querySelector(".auth-google-text") : null;
  if (btn) {
    btn.disabled = true;
    if (btnText) btnText.textContent = "ログイン中...";
  }

  try {
    const ok = await BizNaviAuth.initFirebase();
    if (!ok) {
      if (typeof showToast === "function") showToast("Firebase設定が必要です（firebase-config.js）", "error");
      if (btn) {
        btn.disabled = false;
        if (btnText) btnText.textContent = "Gmailでログイン";
      }
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    // drive.appdataスコープもFirebase Auth時に同時要求
    provider.addScope("https://www.googleapis.com/auth/drive.appdata");

    const result = await BizNaviAuth._auth.signInWithPopup(provider);

    // ── ログイン成功 ──
    // Firebase AuthのCredentialからアクセストークンを取得してDriveにも使う
    const credential = result.credential;
    const accessToken = credential ? credential.accessToken : null;

    if (accessToken) {
      // Drive接続にそのままトークンを使う（2回目のポップアップ不要）
      if (typeof connectGDriveWithToken === "function") {
        if (btnText) btnText.textContent = "Drive接続中...";
        await connectGDriveWithToken(accessToken);
      }
    }

    if (typeof showToast === "function") showToast("ログインしました ✓", "success");

  } catch (e) {
    const msg = e.code === "auth/popup-closed-by-user"
      ? "ログインがキャンセルされました"
      : `ログイン失敗: ${e.message}`;
    if (typeof showToast === "function") showToast(msg, "error");
    if (btn) {
      btn.disabled = false;
      if (btnText) btnText.textContent = "Gmailでログイン";
    }
  }
};
/* └ END : BizNaviAuth.signInWithGoogle ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.signOut
 * │   ログアウト処理を実行する。Drive接続もリセット。
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.signOut = async function() {
  if (!confirm("ログアウトしますか？\n（データはこの端末に残ります）")) return;
  try {
    if (BizNaviAuth._auth) await BizNaviAuth._auth.signOut();
    BizNaviAuth._currentUser = null;
    BizNaviAuth.renderAuthSection();
    if (typeof showToast === "function") showToast("ログアウトしました", "info");
  } catch (e) {
    if (typeof showToast === "function") showToast("ログアウト失敗: " + e.message, "error");
  }
};
/* └ END : BizNaviAuth.signOut ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.getCurrentUser
 * │   現在ログイン中のユーザー情報を返す（未ログインはnull）
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.getCurrentUser = function() {
  return BizNaviAuth._currentUser;
};
/* └ END : BizNaviAuth.getCurrentUser ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.onAuthStateChanged
 * │   ログイン状態変化時のコールバックを登録する
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.onAuthStateChanged = function(callback) {
  BizNaviAuth._listeners.push(callback);
};
/* └ END : BizNaviAuth.onAuthStateChanged ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : BizNaviAuth.renderAuthSection
 * │   設定ページの「アカウント」セクションのUIを描画する。
 * │   2状態のみ：① 未ログイン（Gmailでログインボタン）
 * │              ② ログイン済み（アバター・名前・メール・ログアウト）
 * │   Updated: 2026-06-09
 * └──────────────────────────────────────────────────────┘ */
BizNaviAuth.renderAuthSection = function() {
  const el = document.getElementById("auth-section-body");
  if (!el) return;

  const user = BizNaviAuth._currentUser;

  if (user) {
    const name  = user.displayName || "ユーザー";
    const email = user.email || "";
    const photo = user.photoURL || "";
    // Drive接続状態を確認
    const driveConnected = (typeof storageSettings !== "undefined")
      && (storageSettings.gdrive || {}).connected;

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
        <div class="auth-drive-status ${driveConnected ? 'auth-drive-ok' : 'auth-drive-pending'}">
          ${driveConnected
            ? `☁️ Google Drive バックアップ: <b>接続済み</b>`
            : `<span style="color:var(--color-warning)">⚠️ Google Drive 未接続</span>
               <button class="auth-drive-connect-btn" onclick="connectGDrive()">今すぐ接続</button>`}
        </div>
        <button onclick="BizNaviAuth.signOut()" class="auth-signout-btn">ログアウト</button>
      </div>`;
  } else {
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
          ログインするだけで<b>Google Driveへの自動バックアップ</b>が有効になります。<br>
          複数端末でのデータ復元にも対応します。
        </div>
      </div>`;
  }
};
/* └ END : BizNaviAuth.renderAuthSection ──────────────────────────────────────────────┘ */

// ── ページ読み込み時に自動初期化 ──
document.addEventListener("DOMContentLoaded", async () => {
  await BizNaviAuth.initFirebase();
  BizNaviAuth.renderAuthSection();
});
