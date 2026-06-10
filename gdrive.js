// ===================================================
// gdrive.js — Google Drive アプリデータフォルダ連携
// Updated: 2026-06-10
//
// 設計思想:
//   Firebase Auth のGmailログイン時に取得したアクセストークンを
//   そのままDrive接続に使う（2回目のポップアップ不要）。
//   drive.appdata スコープはFirebase Auth時に同時要求される。
//
//   - ユーザーのDriveには表示されない隠しフォルダ(appDataFolder)
//   - 意図しない削除・編集が不可能
//   - アクセストークンはメモリに保持（セキュア）
//   - トークン期限切れ時はGISで再取得
//
// スコープ: https://www.googleapis.com/auth/drive.appdata
// ===================================================

const GDRIVE_DATA_FILE  = 'kaikei_data.json';
const GDRIVE_CLIENT_ID  = '317899973916-bufdha31q51geqqvfsjlor838mgo8kpg.apps.googleusercontent.com';
const GDRIVE_SCOPE      = 'https://www.googleapis.com/auth/drive.appdata';

// アクセストークンをメモリに保持
let _gdriveToken     = null;  // { token, expiresAt }
let _tokenClient     = null;  // GIS TokenClient
let _tokenResolve    = null;  // Promise resolve
let _tokenReject     = null;  // Promise reject

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _loadGISScript
 * │   Google Identity Services スクリプトを動的に読み込む
 * │   Updated: 2026-06-10
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
 * │ ▶ START : setGDriveTokenFromFirebase
 * │   Firebase Auth ログイン時に取得したアクセストークンを
 * │   GDriveトークンとしてセットする（ポップアップ不要）。
 * │   expires_in が不明なため55分（デフォルト）で設定する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function setGDriveTokenFromFirebase(accessToken) {
  if (!accessToken) return;
  _gdriveToken = {
    token:     accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55分
  };
  console.log('[GDrive] Firebase AuthトークンをDriveトークンとして設定しました');
}
/* └ END : setGDriveTokenFromFirebase ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getGDriveAccessToken
 * │   drive.appdata スコープのアクセストークンを取得する。
 * │   有効なトークンがメモリにあればそれを返す。
 * │   期限切れ・未取得の場合はGISポップアップで再取得する。
 * │   Updated: 2026-06-10
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

    const user  = (typeof BizNaviAuth !== 'undefined') ? BizNaviAuth.getCurrentUser() : null;
    const email = user?.email || '';
    _tokenClient.requestAccessToken({ hint: email, prompt: '' });
  });
}
/* └ END : getGDriveAccessToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDriveWithToken
 * │   Firebase Auth ログイン時のアクセストークンを使って
 * │   Google Drive接続を完了させる（ポップアップ不要）。
 * │   ログイン直後に auth.js から呼ばれる。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDriveWithToken(accessToken) {
  try {
    // トークンをセット
    setGDriveTokenFromFirebase(accessToken);

    // テストアップロードで接続確認
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await uploadGDrive(testPayload, '_biz_navi_test.json');

    storageSettings.gdrive = storageSettings.gdrive || {};
    storageSettings.gdrive.connected = true;

    // バックアップ先をGoogle Driveに自動設定（未設定の場合）
    if (!storageSettings.backup || storageSettings.backup === 'none') {
      storageSettings.backup = 'gdrive';
    }

    saveStorageSettings();

    if (typeof showToast === 'function') showToast('Google Drive バックアップが有効になりました ✓', 'success');
    if (typeof renderProviderCards === 'function') setTimeout(renderProviderCards, 300);
    if (typeof BizNaviAuth !== 'undefined') setTimeout(BizNaviAuth.renderAuthSection, 300);

    console.log('[GDrive] Firebase AuthトークンでDrive接続完了');
    return true;
  } catch (e) {
    console.warn('[GDrive] connectGDriveWithToken失敗:', e.message);
    // 失敗してもログイン自体は成功しているので静かに失敗
    // ユーザーは手動で「接続する」ボタンを押せる
    return false;
  }
}
/* └ END : connectGDriveWithToken ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : connectGDriveAuto
 * │   onAuthStateChanged から呼ばれるサイレント自動接続。
 * │   GISのprompt:''でポップアップなしのトークン取得を試みる。
 * │   ポップアップが必要な場合は失敗し、手動ボタンに委ねる。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDriveAuto(email) {
  try {
    await _loadGISScript();

    // prompt:'' でサイレント取得を試みる（キャッシュされたセッションがあれば成功）
    const token = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);

      if (!_tokenClient) {
        _tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GDRIVE_CLIENT_ID,
          scope:     GDRIVE_SCOPE,
          callback:  (resp) => {
            clearTimeout(timeout);
            if (resp.error) { reject(new Error(resp.error)); return; }
            _gdriveToken = {
              token:     resp.access_token,
              expiresAt: Date.now() + (resp.expires_in - 60) * 1000,
            };
            resolve(_gdriveToken.token);
          },
        });
      } else {
        // 既存clientのcallbackを上書き
        _tokenClient.callback = (resp) => {
          clearTimeout(timeout);
          if (resp.error) { reject(new Error(resp.error)); return; }
          _gdriveToken = {
            token:     resp.access_token,
            expiresAt: Date.now() + (resp.expires_in - 60) * 1000,
          };
          resolve(_gdriveToken.token);
        };
      }

      _tokenClient.requestAccessToken({ hint: email || '', prompt: '' });
    });

    // テストアップロード
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await uploadGDrive(testPayload, '_biz_navi_test.json');

    storageSettings.gdrive = storageSettings.gdrive || {};
    storageSettings.gdrive.connected = true;
    if (!storageSettings.backup || storageSettings.backup === 'none') {
      storageSettings.backup = 'gdrive';
    }
    saveStorageSettings();

    if (typeof showToast === 'function') showToast('Google Drive バックアップが有効になりました ✓', 'success');
    if (typeof renderProviderCards === 'function') setTimeout(renderProviderCards, 300);
    if (typeof BizNaviAuth !== 'undefined') setTimeout(BizNaviAuth.renderAuthSection, 300);

    console.log('[GDrive] サイレント自動接続完了');
  } catch (e) {
    // サイレント失敗（ポップアップが必要な場合はここに来る）
    console.log('[GDrive] サイレント自動接続スキップ（手動接続が必要）:', e.message);
  }
}
/* └ END : connectGDriveAuto ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : uploadGDrive
 * │   アプリデータフォルダにJSONデータをアップロードする。
 * │   同名ファイルが存在する場合は上書き（重複作成しない）。
 * │   Updated: 2026-06-10
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

  storageSettings.gdrive = storageSettings.gdrive || {};
  storageSettings.gdrive.connected = true;
  saveStorageSettings();
  return true;
}
/* └ END : uploadGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadGDrive
 * │   アプリデータフォルダからJSONデータをダウンロードする。
 * │   ファイルが存在しない場合はnullを返す。
 * │   Updated: 2026-06-10
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
 * │   Google Driveへの手動接続ボタンから呼ばれる。
 * │   GISポップアップでdrive.appdataスコープを許可してもらい
 * │   テストアップロードで接続確認する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
async function connectGDrive() {
  try {
    if (typeof showToast === 'function') showToast('Google Drive に接続中...', 'info');
    const testPayload = JSON.stringify({ _test: true, ts: Date.now() });
    await uploadGDrive(testPayload, '_biz_navi_test.json');
    storageSettings.gdrive = storageSettings.gdrive || {};
    storageSettings.gdrive.connected = true;
    if (!storageSettings.backup || storageSettings.backup === 'none') {
      storageSettings.backup = 'gdrive';
    }
    saveStorageSettings();
    if (typeof showToast === 'function') showToast('Google Drive に接続しました ✓', 'success');
    if (typeof BizNaviAuth !== 'undefined') BizNaviAuth.renderAuthSection();
    setTimeout(renderSettingsPage, 300);
  } catch (e) {
    if (typeof showToast === 'function') showToast(`接続失敗: ${e.message}`, 'error');
  }
}
/* └ END : connectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : disconnectGDrive
 * │   Google Driveの接続を切断する。
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function disconnectGDrive() {
  if (!confirm('Google Drive のバックアップ連携を解除しますか？\n（Driveのデータは削除されません）')) return;
  _gdriveToken = null;
  storageSettings.gdrive = { connected: false };
  if (storageSettings.primary === 'gdrive') storageSettings.primary = 'local';
  if (storageSettings.backup  === 'gdrive') storageSettings.backup  = 'none';
  saveStorageSettings();
  if (typeof showToast === 'function') showToast('Google Drive の連携を解除しました', 'info');
  if (typeof BizNaviAuth !== 'undefined') BizNaviAuth.renderAuthSection();
  renderSettingsPage();
}
/* └ END : disconnectGDrive ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : testAndShowGDriveStatus
 * │   接続テストを実行してトースト通知で結果を表示する。
 * │   Updated: 2026-06-10
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
 * │   Updated: 2026-06-10
 * └──────────────────────────────────────────────────────┘ */
function showGDriveError(msg) {
  const el = document.getElementById('settings-error-gdrive');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  console.error('[GDrive]', msg);
}
/* └ END : showGDriveError ──────────────────────────────────────────────┘ */
