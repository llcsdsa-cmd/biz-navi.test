// ===================================================
// gdrive.js — Google Drive アプリデータフォルダ連携
// Updated: 2026-06-05
//
// 設計思想:
//   Google Identity Services (GIS) の tokenモデルを使い
//   drive.appdata スコープのアクセストークンを取得する。
//   Firebase Auth のログインとは独立して動作するが、
//   Firebase Auth でログイン済みのアカウントと同じGoogleアカウントで
//   Drive接続を行う。
//
//   - ユーザーのDriveには表示されない隠しフォルダ(appDataFolder)
//   - 意図しない削除・編集が不可能
//   - アクセストークンはメモリに保持（セキュア）
//   - トークン期限切れ時は自動的に再取得
//
// スコープ: https://www.googleapis.com/auth/drive.appdata
// ===================================================

const GDRIVE_DATA_FILE  = 'kaikei_data.json';
const GDRIVE_CLIENT_ID  = '317899973916-REPLACE_WITH_WEB_CLIENT_ID.apps.googleusercontent.com'; // ⚠️ Firebase Console > Authentication > ログイン方法 > Google > ウェブSDK構成 で確認
// ↑ Firebase ConsoleのプロジェクトのOAuthクライアントID
// （messagingSenderId + クライアントIDのサフィックス）
const GDRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.appdata';

// アクセストークンをメモリに保持
let _gdriveToken     = null;  // { token, expiresAt }
let _tokenClient     = null;  // GIS TokenClient
let _tokenResolve    = null;  // Promise resolve
let _tokenReject     = null;  // Promise reject

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _loadGISScript
 * │   Google Identity Services スクリプトを動的に読み込む
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
function _loadGISScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('GISスクリプトの読み込みに失敗しました'));
    document.head.appendChild(s);
  });
}
/* └ END : _loadGISScript ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getGDriveAccessToken
 * │   drive.appdata スコープのアクセストークンを取得する。
 * │   有効なトークンがメモリにあればそれを返す。
 * │   期限切れ・未取得の場合はGISポップアップで再取得する。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function getGDriveAccessToken() {
  // 有効なトークンがあればそのまま返す
  if (_gdriveToken && _gdriveToken.expiresAt > Date.now() + 60_000) {
    return _gdriveToken.token;
  }

  await _loadGISScript();

  return new Promise((resolve, reject) => {
    _tokenResolve = resolve;
    _tokenReject  = reject;

    if (!_tokenClient) {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope:     GDRIVE_SCOPE,
        callback:  (resp) => {
          if (resp.error) {
            _tokenReject(new Error(resp.error_description || resp.error));
            return;
          }
          _gdriveToken = {
            token:     resp.access_token,
            expiresAt: Date.now() + (resp.expires_in - 60) * 1000,
          };
          _tokenResolve(_gdriveToken.token);
        },
      });
    }

    // hint にログイン中のメールを渡すと選択画面をスキップできる
    const user  = (typeof BizNaviAuth !== 'undefined') ? BizNaviAuth.getCurrentUser() : null;
    const email = user?.email || '';
    _tokenClient.requestAccessToken({ hint: email, prompt: '' });
  });
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

  // 既存ファイルを検索
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${filename}'`)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `検索失敗: HTTP ${searchRes.status}`);
  }
  const existId = (await searchRes.json()).files?.[0]?.id;

  if (existId) {
    // 既存ファイルを上書き
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existId}?uploadType=media`,
      {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    payload,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `アップロード失敗: HTTP ${res.status}`);
    }
  } else {
    // 新規作成（multipart → appDataFolder）
    const boundary = 'bnavi_' + Date.now();
    const meta     = JSON.stringify({ name: filename, mimeType: 'application/json', parents: ['appDataFolder'] });
    const body     = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `アップロード失敗: HTTP ${res.status}`);
    }
  }

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
  try {
    const accessToken = await getGDriveAccessToken();

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${GDRIVE_DATA_FILE}'`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchRes.ok) return null;
    const fileId = (await searchRes.json()).files?.[0]?.id;
    if (!fileId) return null;

    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
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
 * │   GISポップアップでdrive.appdataスコープを許可してもらい
 * │   テストアップロードで接続確認する。
 * │   Updated: 2026-06-05
 * └──────────────────────────────────────────────────────┘ */
async function connectGDrive() {
  try {
    if (typeof showToast === 'function') showToast('Google Drive に接続中...', 'info');
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await uploadGDrive(testPayload, '_biz_navi_test.json');
    storageSettings.gdrive.connected = true;
    saveStorageSettings();
    if (typeof showToast === 'function') showToast('Google Drive に接続しました ✓', 'success');
    setTimeout(renderSettingsPage, 300);
  } catch (e) {
    if (typeof showToast === 'function') showToast(`接続失敗: ${e.message}`, 'error');
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
  _gdriveToken = null;
  storageSettings.gdrive = { connected: false };
  if (storageSettings.primary === 'gdrive') storageSettings.primary = 'local';
  if (storageSettings.backup  === 'gdrive') storageSettings.backup  = 'none';
  saveStorageSettings();
  if (typeof showToast === 'function') showToast('Google Drive の連携を解除しました', 'info');
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
    if (typeof showToast === 'function') showToast('接続テスト中...', 'info');
    const accessToken = await getGDriveAccessToken();
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof showToast === 'function') showToast(`✓ 接続OK（${data.user?.emailAddress || 'Google Drive'}）`, 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast(`接続失敗: ${e.message}`, 'error');
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
