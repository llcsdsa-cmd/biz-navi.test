// ===================================================
// storage.js — クラウド保存エンジン
// 対応: Google Drive / Dropbox / OneDrive / WebDAV + ローカル
// ===================================================

const STORAGE_KEY_SETTINGS = 'kaikei_storage_settings';

const DEFAULT_STORAGE_SETTINGS = {
  primary:        'local',
  backup:         'none',
  autoBackup:     true,
  backupInterval: 'daily',
  lastBackup:     null,
  gdrive:   { connected: false, clientId: '', clientSecret: '', folderId: '', folderName: '' },
  dropbox:  { connected: false, token: '', appKey: '',  path: '/青色会計' },
  onedrive: { connected: false, token: '', clientId: '', folderId: '' },
  webdav:   { connected: false, url: '',  username: '', password: '' },
};

let storageSettings = (() => {
  try {
    return { ...DEFAULT_STORAGE_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}') };
  } catch { return { ...DEFAULT_STORAGE_SETTINGS }; }
})();

function saveStorageSettings() {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(storageSettings));
}

// ===== まとめてデータを保存 =====
async function saveAllData(data) {
  const payload = JSON.stringify(data);

  // ローカルは常に保存（フォールバック）
  localStorage.setItem('kaikei_entries',  JSON.stringify(data.entries     || []));
  localStorage.setItem('kaikei_tax',      JSON.stringify(data.taxSettings || {}));
  localStorage.setItem('kaikei_dencho',   JSON.stringify(data.dencho      || []));
  localStorage.setItem('kaikei_budget',   JSON.stringify(data.budget      || {}));

  let primaryOk = true;
  let backupOk  = false;

  if (storageSettings.primary !== 'local') {
    primaryOk = await uploadToCloud(storageSettings.primary, payload, 'kaikei_data.json');
  }

  if (storageSettings.backup !== 'none' && storageSettings.backup !== storageSettings.primary) {
    if (shouldRunBackup()) {
      const ts = new Date().toISOString().slice(0, 10);
      backupOk = await uploadToCloud(storageSettings.backup, payload, `kaikei_backup_${ts}.json`);
      if (backupOk) {
        storageSettings.lastBackup = new Date().toISOString();
        saveStorageSettings();
      }
    }
  }

  return { primaryOk, backupOk };
}

function shouldRunBackup() {
  if (!storageSettings.autoBackup || !storageSettings.lastBackup) return true;
  const diff = Date.now() - new Date(storageSettings.lastBackup).getTime();
  if (storageSettings.backupInterval === 'save')   return true;
  if (storageSettings.backupInterval === 'daily')  return diff > 86400000;
  if (storageSettings.backupInterval === 'weekly') return diff > 604800000;
  return false;
}

// ===== アップロード dispatcher =====
async function uploadToCloud(provider, payload, filename) {
  try {
    if (provider === 'gdrive')   return await uploadGDrive(payload, filename);
    if (provider === 'dropbox')  return await uploadDropbox(payload, filename);
    if (provider === 'onedrive') return await uploadOneDrive(payload, filename);
    if (provider === 'webdav')   return await uploadWebDAV(payload, filename);
  } catch (e) {
    console.warn(`[Storage] ${provider} failed:`, e.message);
  }
  return false;
}

// ===== Google Drive =====
async function uploadGDrive(payload, filename) {
  const cfg = storageSettings.gdrive;
  if (!cfg.connected || !cfg.token) throw new Error('Google Drive未接続');
  const meta = JSON.stringify({ name: filename, mimeType: 'application/json', parents: cfg.folderId ? [cfg.folderId] : [] });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file',     new Blob([payload], { type: 'application/json' }));
  // 既存ファイル検索
  const sr = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D'${filename}'+and+trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: `Bearer ${cfg.token}` } }
  );
  const sd = await sr.json();
  const existId = sd.files?.[0]?.id;
  const method = existId ? 'PATCH' : 'POST';
  const url = existId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${cfg.token}` }, body: form });
  if (!res.ok) throw new Error(`GDrive ${res.status}`);
  return true;
}

async function loadGDrive() {
  const cfg = storageSettings.gdrive;
  if (!cfg.connected || !cfg.token) return null;
  const sr = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D'kaikei_data.json'+and+trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: `Bearer ${cfg.token}` } }
  );
  const sd = await sr.json();
  const id = sd.files?.[0]?.id;
  if (!id) return null;
  const fr = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { Authorization: `Bearer ${cfg.token}` } });
  return fr.ok ? await fr.json() : null;
}

function connectGDrive() {
  const clientId = storageSettings.gdrive.clientId;
  if (!clientId) { showSettingsError('gdrive', 'Client IDを入力してください'); return; }
  const state = btoa(JSON.stringify({ provider: 'gdrive', ts: Date.now() }));
  sessionStorage.setItem('oauth_state', state);
  const base = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: location.href.split('#')[0],
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.file',
    state,
  });
  location.href = `${base}?${params}`;
}

// ===== Dropbox =====
async function uploadDropbox(payload, filename) {
  const cfg = storageSettings.dropbox;
  if (!cfg.connected || !cfg.token) throw new Error('Dropbox未接続');
  const path = `${(cfg.path || '/青色会計').replace(/\/$/, '')}/${filename}`;
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false }),
      'Content-Type': 'application/octet-stream',
    },
    body: payload,
  });
  if (!res.ok) throw new Error(`Dropbox ${res.status}`);
  return true;
}

async function loadDropbox() {
  const cfg = storageSettings.dropbox;
  if (!cfg.connected || !cfg.token) return null;
  const path = `${(cfg.path || '/青色会計').replace(/\/$/, '')}/kaikei_data.json`;
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Dropbox-API-Arg': JSON.stringify({ path }) },
  });
  return res.ok ? await res.json() : null;
}

function connectDropbox() {
  const appKey = storageSettings.dropbox.appKey;
  if (!appKey) { showSettingsError('dropbox', 'App Keyを入力してください'); return; }
  const state = btoa(JSON.stringify({ provider: 'dropbox', ts: Date.now() }));
  sessionStorage.setItem('oauth_state', state);
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'token',
    redirect_uri: location.href.split('#')[0],
    state,
  });
  location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
}

// ===== OneDrive =====
async function uploadOneDrive(payload, filename) {
  const cfg = storageSettings.onedrive;
  if (!cfg.connected || !cfg.token) throw new Error('OneDrive未接続');
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/青色会計/${encodeURIComponent(filename)}:/content`,
    { method: 'PUT', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: payload }
  );
  if (!res.ok) throw new Error(`OneDrive ${res.status}`);
  return true;
}

async function loadOneDrive() {
  const cfg = storageSettings.onedrive;
  if (!cfg.connected || !cfg.token) return null;
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/青色会計/kaikei_data.json:/content`,
    { headers: { Authorization: `Bearer ${cfg.token}` } }
  );
  return res.ok ? await res.json() : null;
}

function connectOneDrive() {
  const clientId = storageSettings.onedrive.clientId;
  if (!clientId) { showSettingsError('onedrive', 'Client IDを入力してください'); return; }
  const state = btoa(JSON.stringify({ provider: 'onedrive', ts: Date.now() }));
  sessionStorage.setItem('oauth_state', state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: location.href.split('#')[0],
    scope: 'files.readwrite offline_access',
    state,
  });
  location.href = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`;
}

// ===== WebDAV =====
async function uploadWebDAV(payload, filename) {
  const cfg = storageSettings.webdav;
  if (!cfg.connected || !cfg.url) throw new Error('WebDAV未設定');
  const url = `${cfg.url.replace(/\/$/, '')}/${filename}`;
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.username) headers['Authorization'] = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);
  const res = await fetch(url, { method: 'PUT', headers, body: payload });
  if (!res.ok) throw new Error(`WebDAV ${res.status}`);
  return true;
}

async function testWebDAV() {
  try {
    await uploadWebDAV('{"test":true}', '.kaikei_test');
    storageSettings.webdav.connected = true;
    saveStorageSettings();
    showToast('WebDAV 接続成功', 'success');
    renderSettingsPage();
  } catch (e) {
    showSettingsError('webdav', '接続失敗: ' + e.message);
  }
}

// ===== OAuth コールバック（起動時に呼ぶ）=====
async function handleOAuthCallback() {
  // Google Drive: Authorization Code Flow (?code=...)
  if (location.search.includes('code=') && location.search.includes('state=')) {
    await handleGDriveCallback();
    return;
  }
  // その他プロバイダ: Implicit Flow (#access_token=...)
  if (!location.hash.includes('access_token=')) return;
  const params   = new URLSearchParams(location.hash.replace('#', ''));
  const token    = params.get('access_token');
  if (!token) return;
  let provider = '';
  try { provider = JSON.parse(atob(params.get('state') || '')).provider; } catch {}
  if (!provider || provider === 'gdrive') return;
  storageSettings[provider] = storageSettings[provider] || {};
  storageSettings[provider].token     = token;
  storageSettings[provider].connected = true;
  saveStorageSettings();
  history.replaceState(null, '', location.pathname);
  showToast(`${providerLabel(provider)} に接続しました`, 'success');
  setTimeout(renderSettingsPage, 100);
}

// ===== クラウドからロード =====
async function loadFromCloud() {
  const p = storageSettings.primary;
  if (p === 'gdrive')   return await loadGDrive();
  if (p === 'dropbox')  return await loadDropbox();
  if (p === 'onedrive') return await loadOneDrive();
  return null;
}

// ===== ユーティリティ =====
function providerLabel(p) {
  return { gdrive:'Google Drive', dropbox:'Dropbox', onedrive:'OneDrive', webdav:'WebDAV', local:'ローカル', none:'なし' }[p] || p;
}

function providerIcon(p) {
  const icons = {
    gdrive:   '🟡',
    dropbox:  '🔵',
    onedrive: '🔷',
    webdav:   '🌐',
    local:    '📱',
    none:     '—',
  };
  return icons[p] || '☁️';
}

function showSettingsError(section, msg) {
  const el = document.getElementById(`settings-error-${section}`);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
