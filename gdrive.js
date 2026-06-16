// ===================================================
// gdrive.js — Google Drive appDataFolder 連携
// Updated: 2026-06-10
//
// 【設計方針】
//   Firebase Auth signInWithPopup の credential.accessToken を
//   connectGDriveWithToken() に渡すだけで接続完了。
//   GIS / client ID / OAuth redirect は一切不要。
//
// 外部から呼ぶ関数:
//   connectGDriveWithToken(accessToken) - auth.js から呼ぶ
//   connectGDrive()                     - 「今すぐ接続」ボタン
//   disconnectGDrive()                  - 「連携解除」ボタン
//   uploadGDrive(payload, filename)     - storage.js から呼ぶ
//   loadGDrive()                        - storage.js から呼ぶ
//   resetGDriveToken()                  - auth.js signOut から呼ぶ
// ===================================================

const GDRIVE_DATA_FILE = 'kaikei_data.json';

// アクセストークンをメモリ保持 { token, expiresAt }
let _gdriveToken = null;

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : setGDriveTokenFromFirebase
 * │   Firebase Auth が返した accessToken をセットする。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function setGDriveTokenFromFirebase(accessToken) {
  if (!accessToken) return;
  _gdriveToken = {
    token:     accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  console.log('[GDrive] トークンをセット（55分有効）');
}
/* └ END : setGDriveTokenFromFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : resetGDriveToken
 * │   ログアウト時にトークンを破棄する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function resetGDriveToken() {
  _gdriveToken = null;
  console.log('[GDrive] トークンをリセット');
}
/* └ END : resetGDriveToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _getToken
 * │   有効なトークンを返す。なければ例外を投げる。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function _getToken() {
  if (_gdriveToken && _gdriveToken.expiresAt > Date.now()) {
    return _gdriveToken.token;
  }
  throw new Error('再ログインしてください（セッション切れ）');
}
/* └ END : _getToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _driveApi
 * │   Drive API fetch ラッパー。
 * │   401 / トークン切れ時は再ログイン誘導トーストを出す。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function _driveApi(url, options) {
  options = options || {};
  let token;
  try { token = _getToken(); }
  catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
    throw e;
  }
  const headers = Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {});
  const res = await fetch(url, Object.assign({}, options, { headers: headers }));
  if (!res.ok) {
    const body = await res.json().catch(function() { return {}; });
    throw new Error(body.error && body.error.message ? body.error.message : ('Drive API エラー HTTP ' + res.status));
  }
  return res;
}
/* └ END : _driveApi ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDriveWithToken
 * │   auth.js の signInWithGoogle() から呼ばれる。
 * │   accessToken をセットしてテストアップロードで疎通確認。
 * │   成功したら storageSettings.gdrive.connected = true にする。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDriveWithToken(accessToken) {
  try {
    setGDriveTokenFromFirebase(accessToken);

    // 疎通確認（テストファイルをアップロード）
    await _uploadFile(JSON.stringify({ _test: true, ts: Date.now() }), '_biz_navi_test.json');

    _markConnected();
    if (typeof showToast === 'function') showToast('Google Drive バックアップが有効になりました ✓', 'success');
    _refreshUI();
    console.log('[GDrive] 接続完了');
    return true;
  } catch (e) {
    console.warn('[GDrive] connectGDriveWithToken 失敗:', e.message);
    if (typeof showToast === 'function') showToast('Drive接続失敗: ' + e.message, 'error');
    return false;
  }
}
/* └ END : connectGDriveWithToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDrive
 * │   設定画面「今すぐ接続」ボタンから呼ばれる。
 * │   ログイン未済 or トークン切れ → signInWithGoogle() を呼ぶ
 * │   （再ログインで Drive 接続も自動完了する）。
 * │   トークン有効 → テストアップロードで接続確認。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDrive() {
  // トークン有効確認
  var hasToken = false;
  try { _getToken(); hasToken = true; } catch (_) {}

  if (!hasToken) {
    // トークンなし → Drive専用Popupでトークン取得
    if (typeof BizNaviAuth === 'undefined') {
      if (typeof showToast === 'function') showToast('先にGmailでログインしてください', 'error');
      return;
    }
    if (typeof showToast === 'function') showToast('Google Drive の権限を確認中...', 'info');
    var token = await BizNaviAuth.signInForDrive();
    if (!token) {
      if (typeof showToast === 'function') showToast('Drive接続をキャンセルしました', 'info');
      return;
    }
    setGDriveTokenFromFirebase(token);
  }

  // トークン有効 → テストアップロード
  try {
    if (typeof showToast === 'function') showToast('Google Drive に接続中...', 'info');
    await _uploadFile(JSON.stringify({ _test: true, ts: Date.now() }), '_biz_navi_test.json');
    _markConnected();
    if (typeof showToast === 'function') showToast('Google Drive に接続しました ✓', 'success');
    _refreshUI();
  } catch (e) {
    if (typeof showToast === 'function') showToast('接続失敗: ' + e.message, 'error');
  }
}
/* └ END : connectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : disconnectGDrive
 * │   「連携解除」ボタンから呼ばれる。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function disconnectGDrive() {
  if (!confirm('Google Drive のバックアップ連携を解除しますか？\n（Drive のデータは削除されません）')) return;
  resetGDriveToken();
  if (typeof storageSettings !== 'undefined') {
    storageSettings.gdrive = { connected: false };
    if (storageSettings.primary === 'gdrive') storageSettings.primary = 'local';
    if (storageSettings.backup  === 'gdrive') storageSettings.backup  = 'none';
    if (typeof saveStorageSettings === 'function') saveStorageSettings();
  }
  if (typeof showToast === 'function') showToast('Google Drive の連携を解除しました', 'info');
  _refreshUI();
}
/* └ END : disconnectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : uploadGDrive
 * │   storage.js から呼ばれる公開アップロード関数。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function uploadGDrive(payload, filename) {
  await _uploadFile(payload, filename || GDRIVE_DATA_FILE);
  if (typeof storageSettings !== 'undefined') {
    storageSettings.gdrive = storageSettings.gdrive || {};
    storageSettings.gdrive.connected = true;
    if (typeof saveStorageSettings === 'function') saveStorageSettings();
  }
  return true;
}
/* └ END : uploadGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadGDrive
 * │   storage.js から呼ばれる公開ロード関数。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function loadGDrive() {
  try {
    const token = _getToken();
    const q = encodeURIComponent("name='" + GDRIVE_DATA_FILE + "'");
    const sr = await _driveApi(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q +
      '&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc'
    );
    const fileId = (await sr.json()).files[0] && (await sr.json()).files[0].id;

    // ※ sr.json() を2回呼べないため再取得
    const sr2 = await fetch(
      'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q +
      '&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const data2 = await sr2.json();
    const fid   = data2.files && data2.files[0] ? data2.files[0].id : null;
    if (!fid) return null;

    const fr = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + fid + '?alt=media',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    return fr.ok ? await fr.json() : null;
  } catch (e) {
    console.warn('[GDrive] load failed:', e.message);
    return null;
  }
}
/* └ END : loadGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : testAndShowGDriveStatus
 * │   「接続テスト」ボタンから呼ばれる。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function testAndShowGDriveStatus() {
  try {
    if (typeof showToast === 'function') showToast('接続テスト中...', 'info');
    const res  = await _driveApi('https://www.googleapis.com/drive/v3/about?fields=user');
    const data = await res.json();
    if (typeof showToast === 'function') {
      showToast('✓ 接続OK（' + (data.user && data.user.emailAddress ? data.user.emailAddress : 'Google Drive') + '）', 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('接続失敗: ' + e.message, 'error');
  }
}
/* └ END : testAndShowGDriveStatus ──────────────────────────────────────────────┘ */

// ── 内部ヘルパー ──────────────────────────────────────

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _uploadFile
 * │   appDataFolder にファイルをアップロードする内部関数。
 * │   既存ファイルがある場合は上書き（PATCH）、なければ新規作成（multipart POST）。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function _uploadFile(payload, filename) {
  const token = _getToken();
  const q = encodeURIComponent("name='" + filename + "'");

  // 既存ファイル検索
  const sr  = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' + q + '&fields=files(id)',
    { headers: { Authorization: 'Bearer ' + token } }
  );
  if (!sr.ok) throw new Error('ファイル検索失敗 HTTP ' + sr.status);
  const srData  = await sr.json();
  const existId = srData.files && srData.files[0] ? srData.files[0].id : null;

  if (existId) {
    // 上書き
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files/' + existId + '?uploadType=media',
      {
        method:  'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body:    payload,
      }
    );
    if (!res.ok) {
      const e = await res.json().catch(function() { return {}; });
      throw new Error(e.error && e.error.message ? e.error.message : ('アップロード失敗 HTTP ' + res.status));
    }
  } else {
    // 新規作成（multipart）
    const boundary = 'bnavi_' + Date.now();
    const meta     = JSON.stringify({ name: filename, mimeType: 'application/json', parents: ['appDataFolder'] });
    const body     = '--' + boundary + '\r\n' +
                     'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                     meta + '\r\n' +
                     '--' + boundary + '\r\n' +
                     'Content-Type: application/json\r\n\r\n' +
                     payload + '\r\n' +
                     '--' + boundary + '--';
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method:  'POST',
        headers: {
          Authorization:  'Bearer ' + token,
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body: body,
      }
    );
    if (!res.ok) {
      const e = await res.json().catch(function() { return {}; });
      throw new Error(e.error && e.error.message ? e.error.message : ('アップロード失敗 HTTP ' + res.status));
    }
  }
  return true;
}
/* └ END : _uploadFile ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _markConnected
 * │   storageSettings.gdrive.connected を true にして保存する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function _markConnected() {
  if (typeof storageSettings === 'undefined') return;
  storageSettings.gdrive = storageSettings.gdrive || {};
  storageSettings.gdrive.connected = true;
  if (!storageSettings.backup || storageSettings.backup === 'none') {
    storageSettings.backup = 'gdrive';
  }
  if (typeof saveStorageSettings === 'function') saveStorageSettings();
}
/* └ END : _markConnected ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _refreshUI
 * │   Drive 接続状態変化後に UI を再描画する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function _refreshUI() {
  setTimeout(function() {
    if (typeof BizNaviAuth !== 'undefined') BizNaviAuth.renderAuthSection();
    if (typeof renderProviderCards === 'function') renderProviderCards();
  }, 150);
}
/* └ END : _refreshUI ──────────────────────────────────────────────┘ */

