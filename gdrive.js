// ===================================================
// gdrive.js — Google Drive アプリデータフォルダ連携
// Updated: 2026-06-05
//
// 設計思想:
//   Firebase Auth（Google OAuth）で取得したアクセストークンを使い
//   Google Drive の「アプリデータフォルダ」へバックアップする。
//   - ユーザーのDriveには表示されない隠しフォルダ
//   - 意図しない削除・編集が不可能
//   - Client ID / Secret の入力不要（Firebase Authと統合）
//   - ユーザーは「Gmailでログイン」するだけで自動的に使用可能
//
// スコープ: https://www.googleapis.com/auth/drive.appdata
// ===================================================

const GDRIVE_DATA_FILE = 'kaikei_data.json';

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getGDriveAccessToken
 * │   Firebase Auth のGoogleクレデンシャルから
 * │   drive.appdata スコープのアクセストークンを取得する。
 * │   未ログイン・スコープ不足の場合は再認証を促す。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function getGDriveAccessToken() {
  const user = BizNaviAuth.getCurrentUser();
  if (!user) {
    throw new Error('Gmailでログインしてからバックアップしてください');
  }

  // Firebase Auth の Google プロバイダからアクセストークンを取得
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.appdata');

  try {
    // 既存セッションからトークンを取得（ポップアップなし）
    const result = await firebase.auth().currentUser.getIdTokenResult();
    // Google OAuth アクセストークンは credential から取得
    const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(
      await firebase.auth().signInWithCredential(
        firebase.auth.GoogleAuthProvider.credential(null, result.token)
      )
    );
    if (credential?.accessToken) return credential.accessToken;
  } catch (_) {}

  // トークンが取れない場合は再ログイン（drive.appdataスコープを追加して）
  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) throw new Error('アクセストークンを取得できませんでした');
    return credential.accessToken;
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user') {
      throw new Error('ログインがキャンセルされました');
    }
    throw new Error(`認証失敗: ${e.message}`);
  }
}
/* └ END : getGDriveAccessToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : uploadGDrive
 * │   アプリデータフォルダにJSONデータをアップロードする。
 * │   同名ファイルが存在する場合は上書き（重複作成しない）。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function uploadGDrive(payload, filename) {
  const accessToken = await getGDriveAccessToken();

  // 既存ファイルを検索（appDataFolderスコープ）
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${filename}'`)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `検索失敗: HTTP ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const existId = searchData.files?.[0]?.id;

  if (existId) {
    // 既存ファイルを上書き（PATCH）
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existId}?uploadType=media`,
      {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `アップロード失敗: HTTP ${res.status}`);
    }
  } else {
    // 新規作成（multipart upload → appDataFolder）
    const meta = JSON.stringify({
      name:     filename,
      mimeType: 'application/json',
      parents:  ['appDataFolder'],
    });
    const boundary = 'bnavi_' + Date.now();
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      meta,
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      payload,
      `--${boundary}--`,
    ].join('\r\n');

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `アップロード失敗: HTTP ${res.status}`);
    }
  }

  // 接続状態を更新
  storageSettings.gdrive.connected = true;
  saveStorageSettings();
  return true;
}
/* └ END : uploadGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadGDrive
 * │   アプリデータフォルダからJSONデータをダウンロードする。
 * │   ファイルが存在しない場合はnullを返す。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function loadGDrive() {
  const user = BizNaviAuth.getCurrentUser();
  if (!user) return null;

  try {
    const accessToken = await getGDriveAccessToken();

    // appDataFolderからファイルを検索
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${GDRIVE_DATA_FILE}'`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id;
    if (!fileId) return null;

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&spaces=appDataFolder`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!fileRes.ok) return null;
    return await fileRes.json();

  } catch (e) {
    console.warn('[GDrive] load failed:', e.message);
    return null;
  }
}
/* └ END : loadGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDrive
 * │   Google Driveへの接続を開始する。
 * │   Firebase Authでログイン済みなら即テスト接続。
 * │   未ログインなら認証フローを起動する。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function connectGDrive() {
  const user = BizNaviAuth.getCurrentUser();
  if (!user) {
    if (typeof showToast === 'function') {
      showToast('まずGmailでログインしてください', 'error');
    }
    // 設定ページのアカウントセクションへスクロール
    document.getElementById('auth-section-body')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  try {
    showToast('Google Drive に接続中...', 'info');
    // テストアップロードで接続確認
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await uploadGDrive(testPayload, '_biz_navi_test.json');

    storageSettings.gdrive.connected = true;
    saveStorageSettings();
    showToast('Google Drive に接続しました ✓', 'success');
    setTimeout(renderSettingsPage, 300);
  } catch (e) {
    showToast(`接続失敗: ${e.message}`, 'error');
  }
}
/* └ END : connectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : disconnectGDrive
 * │   Google Driveの接続を切断する。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
function disconnectGDrive() {
  if (!confirm('Google Drive のバックアップ連携を解除しますか？\n（Driveのデータは削除されません）')) return;
  storageSettings.gdrive = { connected: false };
  if (storageSettings.primary === 'gdrive') storageSettings.primary = 'local';
  if (storageSettings.backup  === 'gdrive') storageSettings.backup  = 'none';
  saveStorageSettings();
  showToast('Google Drive の連携を解除しました', 'info');
  renderSettingsPage();
}
/* └ END : disconnectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : testAndShowGDriveStatus
 * │   接続テストを実行してトースト通知で結果を表示する。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function testAndShowGDriveStatus() {
  try {
    showToast('接続テスト中...', 'info');
    const accessToken = await getGDriveAccessToken();
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    showToast(`✓ 接続OK（${data.user?.emailAddress || 'Google Drive'}）`, 'success');
  } catch (e) {
    showToast(`接続失敗: ${e.message}`, 'error');
  }
}
/* └ END : testAndShowGDriveStatus ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showGDriveError
 * │   設定ページのエラー表示エレメントにメッセージを出す
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
function showGDriveError(msg) {
  const el = document.getElementById('settings-error-gdrive');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  console.error('[GDrive]', msg);
}
/* └ END : showGDriveError ──────────────────────────────────────────────┘ */
