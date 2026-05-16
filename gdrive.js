// ===================================================
// gdrive.js — Google Drive 連携モジュール
//
// 実装仕様:
//   - OAuth 2.0 Authorization Code Flow + PKCE
//     （Implicit Flowは2019年以降Google非推奨のため不使用）
//   - アクセストークン有効期限1時間 → 自動リフレッシュ
//   - 専用フォルダ「青色会計」を自動作成・管理
//   - ファイルは上書き保存（重複作成しない）
//
// Google Cloud Console 設定:
//   1. https://console.cloud.google.com/ でプロジェクト作成
//   2. 「APIとサービス」→「ライブラリ」→ Google Drive API を有効化
//   3. 「APIとサービス」→「認証情報」→「OAuthクライアントID」を作成
//      アプリケーションの種類: ウェブアプリケーション
//      承認済みのリダイレクトURI: https://<あなたのGitHub Pages URL>/
//   4. クライアントIDとクライアントシークレットをコピー
// ===================================================

const GDRIVE_FOLDER_NAME = '青色会計';
const GDRIVE_DATA_FILE   = 'kaikei_data.json';
const GDRIVE_TOKEN_KEY   = 'kaikei_gdrive_token';

// ===== PKCE ユーティリティ =====
async function generatePKCE() {
  // code_verifier: 43〜128文字のランダム文字列
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // code_challenge: SHA-256(verifier) をBase64URL encode
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return { verifier, challenge };
}

// ===== OAuth 認証フロー開始 =====
async function connectGDrive() {
  const clientId = storageSettings.gdrive.clientId;
  const clientSecret = storageSettings.gdrive.clientSecret;

  if (!clientId || !clientSecret) {
    showGDriveError('Client ID と Client Secret を両方入力してください');
    return;
  }

  // PKCE生成
  const { verifier, challenge } = await generatePKCE();

  // stateトークン（CSRF対策）
  const state = btoa(JSON.stringify({ provider: 'gdrive', ts: Date.now() }));

  // セッションに保存（コールバック後に使用）
  sessionStorage.setItem('gdrive_verifier', verifier);
  sessionStorage.setItem('gdrive_state',    state);
  sessionStorage.setItem('gdrive_clientId', clientId);
  sessionStorage.setItem('gdrive_clientSecret', clientSecret);

  const redirectUri = location.origin + location.pathname;

  const params = new URLSearchParams({
    client_id:             clientId,
    redirect_uri:          redirectUri,
    response_type:         'code',
    scope:                 'https://www.googleapis.com/auth/drive.file',
    state:                 state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    access_type:           'offline',   // refresh_token を取得するために必要
    prompt:                'consent',   // 毎回同意画面を表示（refresh_token再取得のため）
  });

  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ===== OAuth コールバック処理（URLの ?code= を検出）=====
async function handleGDriveCallback() {
  const urlParams = new URLSearchParams(location.search);
  const code  = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (!code) return false;

  // エラーチェック
  if (error) {
    showToast(`Google認証エラー: ${error}`, 'error');
    history.replaceState(null, '', location.pathname);
    return false;
  }

  // state検証（CSRF対策）
  const savedState = sessionStorage.getItem('gdrive_state');
  if (state !== savedState) {
    showToast('認証エラー: stateが一致しません', 'error');
    history.replaceState(null, '', location.pathname);
    return false;
  }

  const verifier    = sessionStorage.getItem('gdrive_verifier');
  const clientId    = sessionStorage.getItem('gdrive_clientId');
  const clientSecret = sessionStorage.getItem('gdrive_clientSecret');
  const redirectUri = location.origin + location.pathname;

  // URLをクリーン（コードをURLから除去）
  history.replaceState(null, '', location.pathname);

  // セッション情報をクリア
  sessionStorage.removeItem('gdrive_verifier');
  sessionStorage.removeItem('gdrive_state');
  sessionStorage.removeItem('gdrive_clientId');
  sessionStorage.removeItem('gdrive_clientSecret');

  showToast('Google Drive に接続中...', 'info');

  // ===== code → token 交換 =====
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json();
      throw new Error(err.error_description || err.error || `HTTP ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    // {access_token, refresh_token, expires_in, token_type}

    // トークンを保存
    saveGDriveToken({
      accessToken:  tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt:    Date.now() + (tokenData.expires_in * 1000),
      clientId,
      clientSecret,
    });

    // 設定に反映
    storageSettings.gdrive.connected    = true;
    storageSettings.gdrive.clientId     = clientId;
    storageSettings.gdrive.clientSecret = clientSecret;
    saveStorageSettings();

    // 専用フォルダを作成/取得
    const folderId = await ensureGDriveFolder();
    if (folderId) {
      storageSettings.gdrive.folderId   = folderId;
      storageSettings.gdrive.folderName = GDRIVE_FOLDER_NAME;
      saveStorageSettings();
    }

    showToast('Google Drive に接続しました ✓', 'success');
    setTimeout(renderSettingsPage, 100);
    return true;

  } catch (e) {
    console.error('[GDrive] token exchange failed:', e);
    showToast(`接続失敗: ${e.message}`, 'error');
    showGDriveError(`トークン取得失敗: ${e.message}`);
    return false;
  }
}

// ===== トークン保存・読み込み =====
function saveGDriveToken(tokenObj) {
  localStorage.setItem(GDRIVE_TOKEN_KEY, JSON.stringify(tokenObj));
}

function loadGDriveToken() {
  try {
    return JSON.parse(localStorage.getItem(GDRIVE_TOKEN_KEY) || 'null');
  } catch { return null; }
}

// ===== アクセストークン取得（期限切れなら自動リフレッシュ）=====
async function getGDriveAccessToken() {
  const token = loadGDriveToken();
  if (!token) throw new Error('Google Driveトークンがありません。再接続してください');

  // 有効期限を5分前にチェック（余裕を持たせる）
  const isExpired = Date.now() >= (token.expiresAt - 5 * 60 * 1000);

  if (!isExpired) {
    return token.accessToken;
  }

  // ===== リフレッシュトークンで再取得 =====
  if (!token.refreshToken) {
    // refresh_tokenがない場合は再認証が必要
    storageSettings.gdrive.connected = false;
    saveStorageSettings();
    throw new Error('セッションが期限切れです。設定ページから再接続してください');
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     token.clientId,
        client_secret: token.clientSecret,
        refresh_token: token.refreshToken,
        grant_type:    'refresh_token',
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error_description || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // 新しいアクセストークンを保存（refreshTokenは変わらないことが多い）
    saveGDriveToken({
      ...token,
      accessToken: data.access_token,
      expiresAt:   Date.now() + (data.expires_in * 1000),
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    });

    console.log('[GDrive] トークンを自動更新しました');
    return data.access_token;

  } catch (e) {
    storageSettings.gdrive.connected = false;
    saveStorageSettings();
    throw new Error(`トークン更新失敗: ${e.message} — 設定ページから再接続してください`);
  }
}

// ===== 専用フォルダの作成/取得 =====
async function ensureGDriveFolder() {
  try {
    const accessToken = await getGDriveAccessToken();

    // 既存フォルダを検索
    const q = encodeURIComponent(
      `name='${GDRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files?.length > 0) {
      console.log('[GDrive] 既存フォルダを使用:', searchData.files[0].id);
      return searchData.files[0].id;
    }

    // フォルダを新規作成
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name:     GDRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    const folder = await createRes.json();
    console.log('[GDrive] フォルダを作成:', folder.id);
    return folder.id;

  } catch (e) {
    console.warn('[GDrive] フォルダ作成失敗:', e.message);
    return null;
  }
}

// ===== ファイルアップロード（上書き対応）=====
async function uploadGDrive(payload, filename) {
  const accessToken = await getGDriveAccessToken();
  const cfg = storageSettings.gdrive;
  const folderId = cfg.folderId || await ensureGDriveFolder();

  // 既存ファイルを検索
  const parentQ = folderId ? `+'${folderId}'+in+parents+and+` : '';
  const q = encodeURIComponent(
    `${folderId ? `'${folderId}' in parents and ` : ''}name='${filename}' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  const existId = searchData.files?.[0]?.id;

  if (existId) {
    // === 既存ファイルを上書き（PATCH）===
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
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
  } else {
    // === 新規作成（multipart upload）===
    const meta = JSON.stringify({
      name:     filename,
      mimeType: 'application/json',
      parents:  folderId ? [folderId] : [],
    });
    const boundary = 'kaikei_boundary_' + Date.now();
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
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
  }

  return true;
}

// ===== ファイルダウンロード =====
async function loadGDrive() {
  const cfg = storageSettings.gdrive;
  if (!cfg.connected) return null;

  try {
    const accessToken = await getGDriveAccessToken();
    const folderId = cfg.folderId;

    const q = encodeURIComponent(
      `${folderId ? `'${folderId}' in parents and ` : ''}name='${GDRIVE_DATA_FILE}' and trashed=false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime+desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    const fileId = searchData.files?.[0]?.id;
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

// ===== 接続テスト =====
async function testGDriveConnection() {
  try {
    const accessToken = await getGDriveAccessToken();
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, email: data.user?.emailAddress };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ===== 切断 =====
function disconnectGDrive() {
  localStorage.removeItem(GDRIVE_TOKEN_KEY);
  storageSettings.gdrive = {
    connected: false, token: '',
    clientId: storageSettings.gdrive.clientId,
    clientSecret: storageSettings.gdrive.clientSecret,
    folderId: '', folderName: '',
  };
  if (storageSettings.primary === 'gdrive') storageSettings.primary = 'local';
  if (storageSettings.backup  === 'gdrive') storageSettings.backup  = 'none';
  saveStorageSettings();
  showToast('Google Drive を切断しました', 'info');
  renderSettingsPage();
}

// ===== エラー表示 =====
function showGDriveError(msg) {
  const el = document.getElementById('settings-error-gdrive');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  console.error('[GDrive]', msg);
}
