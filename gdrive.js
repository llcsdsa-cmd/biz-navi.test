// ===================================================
// gdrive.js — Google Drive アプリデータフォルダ連携
// Updated: 2026-06-10
//
// 【設計方針】GIS（Google Identity Services）を完全廃止。
//   Firebase Auth の signInWithPopup で取得した
//   OAuthCredential.accessToken のみを使用する。
//   → ユーザーは「Gmailでログイン」1回だけで全て完結。
//   → GISポップアップ・client ID 設定は一切不要。
//
//   トークン更新が必要な場合は Firebase Auth の
//   currentUser.getIdToken() ではなく、再ログインで対応。
//   （drive.appdata スコープは Firebase Auth で取得済み）
//
// スコープ: https://www.googleapis.com/auth/drive.appdata
// ===================================================

const GDRIVE_DATA_FILE = 'kaikei_data.json';

// Firebase Auth ログイン時に取得したアクセストークンをメモリ保持
// { token: string, expiresAt: number }
let _gdriveToken = null;

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : setGDriveTokenFromFirebase
 * │   Firebase Auth signInWithPopup 成功時に呼ぶ。
 * │   credential.accessToken を Drive API 用トークンとして保持する。
 * │   Google OAuth トークンの有効期限は通常 3600 秒（1時間）。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function setGDriveTokenFromFirebase(accessToken) {
  if (!accessToken) return;
  _gdriveToken = {
    token:     accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55分（余裕を持って）
  };
  console.log('[GDrive] Firebase Auth トークンをセットしました');
}
/* └ END : setGDriveTokenFromFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getGDriveAccessToken
 * │   メモリ上の有効なトークンを返す。
 * │   未取得・期限切れの場合は Error を throw する
 * │   （GISは使わない。再ログインを促す）。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function getGDriveAccessToken() {
  if (_gdriveToken && _gdriveToken.expiresAt > Date.now()) {
    return _gdriveToken.token;
  }
  // トークン切れ → 再ログインが必要
  throw new Error('NEED_REAUTH');
}
/* └ END : getGDriveAccessToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _driveRequest
 * │   Drive API への fetch ラッパー。
 * │   NEED_REAUTH エラー時は再ログイントーストを表示する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function _driveRequest(url, options = {}) {
  let token;
  try {
    token = getGDriveAccessToken();
  } catch (e) {
    if (e.message === 'NEED_REAUTH') {
      if (typeof showToast === 'function') {
        showToast('セッションが切れました。再度ログインしてください。', 'error');
      }
      if (typeof BizNaviAuth !== 'undefined') {
        setTimeout(() => BizNaviAuth.renderAuthSection(), 500);
      }
    }
    throw e;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Drive API エラー: HTTP ${res.status}`);
  }
  return res;
}
/* └ END : _driveRequest ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDriveWithToken
 * │   Firebase Auth ログイン完了後に auth.js から呼ばれる。
 * │   テストアップロードで Drive API への疎通を確認し、
 * │   storageSettings.gdrive.connected = true にする。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDriveWithToken(accessToken) {
  try {
    // トークンをメモリにセット
    setGDriveTokenFromFirebase(accessToken);

    // テストアップロードで Drive API 疎通確認
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await _uploadFileToDrive(testPayload, '_biz_navi_test.json');

    // 接続成功 → 設定を更新
    if (typeof storageSettings !== 'undefined') {
      storageSettings.gdrive = {
        ...(storageSettings.gdrive || {}),
        connected: true,
        // clientId など GIS 関連フィールドは使わないため除去
      };
      if (!storageSettings.backup || storageSettings.backup === 'none') {
        storageSettings.backup = 'gdrive';
      }
      if (typeof saveStorageSettings === 'function') saveStorageSettings();
    }

    if (typeof showToast === 'function') {
      showToast('Google Drive バックアップが有効になりました ✓', 'success');
    }
    // UI 更新
    setTimeout(() => {
      if (typeof BizNaviAuth !== 'undefined') BizNaviAuth.renderAuthSection();
      if (typeof renderProviderCards === 'function') renderProviderCards();
    }, 300);

    console.log('[GDrive] Drive 接続完了');
    return true;
  } catch (e) {
    console.warn('[GDrive] connectGDriveWithToken 失敗:', e.message);
    // ログイン自体は成功しているので静かに失敗（手動ボタンが残る）
    return false;
  }
}
/* └ END : connectGDriveWithToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDrive
 * │   設定画面の「接続する」ボタンから呼ばれる。
 * │   ログイン済みであればトークンは既にメモリにあるため
 * │   そのままテストアップロードで接続確認する。
 * │   未ログインの場合は signInWithGoogle() を呼ぶ。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDrive() {
  // 未ログインなら先にログイン（= Drive接続も自動完了）
  if (typeof BizNaviAuth !== 'undefined' && !BizNaviAuth.getCurrentUser()) {
    await BizNaviAuth.signInWithGoogle();
    return;
  }

  // ログイン済みだがトークンが切れている場合
  try {
    getGDriveAccessToken();
  } catch (e) {
    // 再ログイン → Drive自動接続まで完了する
    if (typeof BizNaviAuth !== 'undefined') {
      await BizNaviAuth.signInWithGoogle();
    }
    return;
  }

  // トークン有効 → テストアップロードで接続確認
  try {
    if (typeof showToast === 'function') showToast('Google Drive に接続中...', 'info');
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await _uploadFileToDrive(testPayload, '_biz_navi_test.json');

    if (typeof storageSettings !== 'undefined') {
      storageSettings.gdrive = { ...(storageSettings.gdrive || {}), connected: true };
      if (!storageSettings.backup || storageSettings.backup === 'none') {
        storageSettings.backup = 'gdrive';
      }
      if (typeof saveStorageSettings === 'function') saveStorageSettings();
    }

    if (typeof showToast === 'function') showToast('Google Drive に接続しました ✓', 'success');
    if (typeof BizNaviAuth !== 'undefined') BizNaviAuth.renderAuthSection();
    if (typeof renderProviderCards === 'function') setTimeout(renderProviderCards, 300);
  } catch (e) {
    if (typeof showToast === 'function') showToast(`接続失敗: ${e.message}`, 'error');
  }
}
/* └ END : connectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : disconnectGDrive
 * │   Google Drive の接続を切断する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function disconnectGDrive() {
  if (!confirm('Google Drive のバックアップ連携を解除しますか？\n（Drive のデータは削除されません）')) return;
  _gdriveToken = null;
  if (typeof storageSettings !== 'undefined') {
    storageSettings.gdrive = { connected: false };
    if (storageSettings.primary === 'gdrive') storageSettings.primary = 'local';
    if (storageSettings.backup  === 'gdrive') storageSettings.backup  = 'none';
    if (typeof saveStorageSettings === 'function') saveStorageSettings();
  }
  if (typeof showToast === 'function') showToast('Google Drive の連携を解除しました', 'info');
  if (typeof BizNaviAuth !== 'undefined') BizNaviAuth.renderAuthSection();
  if (typeof renderSettingsPage === 'function') renderSettingsPage();
}
/* └ END : disconnectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _uploadFileToDrive
 * │   appDataFolder に JSON ファイルをアップロードする内部関数。
 * │   同名ファイルが存在する場合は上書き（重複防止）。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function _uploadFileToDrive(payload, filename) {
  // 既存ファイルを検索
  const searchRes = await _driveRequest(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${filename}'`)}&fields=files(id)`
  );
  const existId = (await searchRes.json()).files?.[0]?.id;

  const token = getGDriveAccessToken();

  if (existId) {
    // 上書き
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: payload,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `アップロード失敗: HTTP ${res.status}`);
    }
  } else {
    // 新規作成（multipart）
    const boundary = 'bnavi_' + Date.now();
    const meta = JSON.stringify({ name: filename, mimeType: 'application/json', parents: ['appDataFolder'] });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
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
  return true;
}
/* └ END : _uploadFileToDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : uploadGDrive
 * │   外部から呼ばれるアップロード関数（storage.js から使用）。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function uploadGDrive(payload, filename) {
  await _uploadFileToDrive(payload, filename || GDRIVE_DATA_FILE);
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
 * │   appDataFolder から JSON データをダウンロードする。
 * │   ファイルが存在しない場合は null を返す。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function loadGDrive() {
  try {
    const searchRes = await _driveRequest(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${GDRIVE_DATA_FILE}'`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`
    );
    const fileId = (await searchRes.json()).files?.[0]?.id;
    if (!fileId) return null;

    const token = getGDriveAccessToken();
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
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
 * │ ▶ START : testAndShowGDriveStatus
 * │   接続テストを実行してトーストで結果を表示する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function testAndShowGDriveStatus() {
  try {
    if (typeof showToast === 'function') showToast('接続テスト中...', 'info');
    const res = await _driveRequest('https://www.googleapis.com/drive/v3/about?fields=user');
    const data = await res.json();
    if (typeof showToast === 'function') {
      showToast(`✓ 接続OK（${data.user?.emailAddress || 'Google Drive'}）`, 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(`接続失敗: ${e.message}`, 'error');
  }
}
/* └ END : testAndShowGDriveStatus ──────────────────────────────────────────────┘ */
