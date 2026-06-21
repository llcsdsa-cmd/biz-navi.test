// ===================================================
// gdrive.js — Google Drive appDataFolder 連携
// Updated: 2026-06-10
// ===================================================

const GDRIVE_DATA_FILE = 'kaikei_data.json';
let _gdriveToken = null;

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : setGDriveTokenFromFirebase
 * │   Firebase Auth の accessToken をセットする
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function setGDriveTokenFromFirebase(accessToken) {
  if (!accessToken) return;
  _gdriveToken = { token: accessToken, expiresAt: Date.now() + 55 * 60 * 1000 };
  console.log('[GDrive] トークンをセット（55分有効）');
}
/* └ END : setGDriveTokenFromFirebase ────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : resetGDriveToken
 * │   ログアウト時にトークンを破棄する
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function resetGDriveToken() {
  _gdriveToken = null;
  console.log('[GDrive] トークンをリセット');
}
/* └ END : resetGDriveToken ──────────────────────────────┘ */

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
/* └ END : _getToken ─────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDriveWithToken
 * │   auth.js の signInWithGoogle() から呼ばれる。
 * │   accessToken をセットしてテストアップロードで疎通確認。
 * │   成功・失敗どちらでも必ず renderAuthSection() を呼ぶ。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDriveWithToken(accessToken) {
  try {
    setGDriveTokenFromFirebase(accessToken);

    // Drive API に about を問い合わせて疎通確認（アップロードより軽量）
    var aboutRes = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );

    if (!aboutRes.ok) {
      var errBody = await aboutRes.json().catch(function() { return {}; });
      throw new Error(errBody.error && errBody.error.message
        ? errBody.error.message
        : 'Drive API エラー HTTP ' + aboutRes.status);
    }

    var aboutData = await aboutRes.json();
    console.log('[GDrive] 疎通確認OK:', aboutData.user && aboutData.user.emailAddress);

    _markConnected();
    if (typeof showToast === 'function') showToast('Google Drive バックアップが有効になりました ✓', 'success');
    console.log('[GDrive] 接続完了');
    return true;

  } catch (e) {
    console.warn('[GDrive] connectGDriveWithToken 失敗:', e.message);
    if (typeof showToast === 'function') showToast('Drive接続失敗: ' + e.message, 'error');
    return false;
  } finally {
    // 成功・失敗どちらでも必ずUIを更新してスピナーを消す
    _refreshUI();
  }
}
/* └ END : connectGDriveWithToken ────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDrive
 * │   「今すぐ接続」ボタンから呼ばれる。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDrive() {
  var hasToken = false;
  try { _getToken(); hasToken = true; } catch (_) {}

  if (!hasToken) {
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

  try {
    if (typeof showToast === 'function') showToast('Google Drive に接続中...', 'info');
    var tk = _getToken();
    var res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: 'Bearer ' + tk } }
    );
    if (!res.ok) throw new Error('Drive API エラー HTTP ' + res.status);
    _markConnected();
    if (typeof showToast === 'function') showToast('Google Drive に接続しました ✓', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('接続失敗: ' + e.message, 'error');
  } finally {
    _refreshUI();
  }
}
/* └ END : connectGDrive ─────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : disconnectGDrive
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
/* └ END : disconnectGDrive ──────────────────────────────┘ */

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
/* └ END : uploadGDrive ──────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadGDrive
 * │   storage.js から呼ばれる公開ロード関数。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function loadGDrive() {
  try {
    var token = _getToken();
    var fname = GDRIVE_DATA_FILE;
    // Drive API のクエリ: シングルクォートをエスケープ
    var q = "name='" + fname.replace(/'/g, "\\'") + "'";
    var url = 'https://www.googleapis.com/drive/v3/files'
      + '?spaces=appDataFolder'
      + '&q=' + encodeURIComponent(q)
      + '&fields=files(id,modifiedTime)'
      + '&orderBy=modifiedTime+desc';

    var sr = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!sr.ok) return null;
    var srData = await sr.json();
    var fid = srData.files && srData.files[0] ? srData.files[0].id : null;
    if (!fid) return null;

    var fr = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + fid + '?alt=media',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    return fr.ok ? await fr.json() : null;
  } catch (e) {
    console.warn('[GDrive] load failed:', e.message);
    return null;
  }
}
/* └ END : loadGDrive ────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : testAndShowGDriveStatus
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function testAndShowGDriveStatus() {
  try {
    if (typeof showToast === 'function') showToast('接続テスト中...', 'info');
    var token = _getToken();
    var res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    if (typeof showToast === 'function') {
      showToast('✓ 接続OK（' + (data.user && data.user.emailAddress ? data.user.emailAddress : 'Google Drive') + '）', 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('接続失敗: ' + e.message, 'error');
  }
}
/* └ END : testAndShowGDriveStatus ───────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _uploadFile
 * │   appDataFolder にファイルをアップロードする。
 * │   既存ファイルがある場合は上書き（PATCH）、なければ新規（multipart POST）。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function _uploadFile(payload, filename) {
  var token = _getToken();
  // Drive API クエリのシングルクォートをエスケープ
  var q = "name='" + filename.replace(/'/g, "\\'") + "'";
  var searchUrl = 'https://www.googleapis.com/drive/v3/files'
    + '?spaces=appDataFolder'
    + '&q=' + encodeURIComponent(q)
    + '&fields=files(id)';

  var sr = await fetch(searchUrl, { headers: { Authorization: 'Bearer ' + token } });
  if (!sr.ok) throw new Error('ファイル検索失敗 HTTP ' + sr.status);
  var srData = await sr.json();
  var existId = srData.files && srData.files[0] ? srData.files[0].id : null;

  if (existId) {
    var res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files/' + existId + '?uploadType=media',
      {
        method:  'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body:    payload,
      }
    );
    if (!res.ok) {
      var e = await res.json().catch(function() { return {}; });
      throw new Error(e.error && e.error.message ? e.error.message : 'アップロード失敗 HTTP ' + res.status);
    }
  } else {
    var boundary = 'bnavi_' + Date.now();
    var meta = JSON.stringify({ name: filename, mimeType: 'application/json', parents: ['appDataFolder'] });
    var body = '--' + boundary + '\r\n'
      + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
      + meta + '\r\n'
      + '--' + boundary + '\r\n'
      + 'Content-Type: application/json\r\n\r\n'
      + payload + '\r\n'
      + '--' + boundary + '--';
    var res2 = await fetch(
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
    if (!res2.ok) {
      var e2 = await res2.json().catch(function() { return {}; });
      throw new Error(e2.error && e2.error.message ? e2.error.message : 'アップロード失敗 HTTP ' + res2.status);
    }
  }
  return true;
}
/* └ END : _uploadFile ───────────────────────────────────┘ */

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
/* └ END : _markConnected ────────────────────────────────┘ */

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
/* └ END : _refreshUI ────────────────────────────────────┘ */
