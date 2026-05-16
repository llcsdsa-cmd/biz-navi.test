// ===================================================
// settings.js — 設定ページUI・ロジック
// ===================================================

function renderSettingsPage() {
  renderExemptSettingNEW(); // ← ここを NEW に変更！
  renderStorageStatus();
  renderProviderCards();
  renderBackupSettings();
  renderDataManagement();
  renderImportAutoMapping();
}


// ===== 保存先ステータスバー =====
function renderStorageStatus() {
  const el = document.getElementById('storage-status-bar');
  if (!el) return;
  const p = storageSettings.primary;
  const b = storageSettings.backup;
  const pConnected = p === 'local' || storageSettings[p]?.connected;
  const bConnected = b === 'none'  || storageSettings[b]?.connected;

  el.innerHTML = `
    <div class="status-item ${pConnected ? 'ok' : 'warn'}">
      <span class="status-dot"></span>
      <div>
        <div class="status-label">メイン保存先</div>
        <div class="status-val">${providerIcon(p)} ${providerLabel(p)}</div>
      </div>
    </div>
    <div class="status-divider"></div>
    <div class="status-item ${bConnected ? 'ok' : 'warn'}">
      <span class="status-dot"></span>
      <div>
        <div class="status-label">バックアップ先</div>
        <div class="status-val">${providerIcon(b)} ${providerLabel(b)}</div>
      </div>
    </div>
    <div class="status-divider"></div>
    <div class="status-item">
      <span class="status-dot ok"></span>
      <div>
        <div class="status-label">最終バックアップ</div>
        <div class="status-val">${storageSettings.lastBackup ? storageSettings.lastBackup.slice(0,10) : '未実施'}</div>
      </div>
    </div>`;
}

// ===== プロバイダカード =====
function renderProviderCards() {
  const el = document.getElementById('provider-cards');
  if (!el) return;

  const providers = [
    { id: 'local',    label: 'ローカル（このデバイス）', icon: '📱', desc: 'オフライン動作・設定不要', color: '#64748b' },
    { id: 'gdrive',   label: 'Google Drive',            icon: '🟡', desc: 'Googleアカウントで安全に同期', color: '#eab308' },
    { id: 'dropbox',  label: 'Dropbox',                 icon: '🔵', desc: 'Dropboxフォルダへ自動保存', color: '#3b82f6' },
    { id: 'onedrive', label: 'OneDrive',                icon: '🔷', desc: 'Microsoftクラウドへ同期', color: '#6366f1' },
    { id: 'webdav',   label: 'WebDAV',                  icon: '🌐', desc: 'Nextcloud等の自前サーバー', color: '#10b981' },
  ];

  el.innerHTML = providers.map(p => {
    const cfg = storageSettings[p.id] || {};
    const isPrimary = storageSettings.primary === p.id;
    const isBackup  = storageSettings.backup  === p.id;
    const connected = p.id === 'local' || cfg.connected;
    const badge = connected
      ? '<span class="provider-badge connected-badge">接続済</span>'
      : '<span class="provider-badge disconnected-badge">未接続</span>';

    return `
    <div class="provider-card ${isPrimary ? 'is-primary' : ''}" style="--provider-color:${p.color}">
      <div class="provider-card-head">
        <span class="provider-icon">${p.icon}</span>
        <div class="provider-info">
          <div class="provider-name">${p.label}</div>
          <div class="provider-desc">${p.desc}</div>
        </div>
        ${badge}
      </div>

      ${p.id === 'local' ? '' : renderProviderConfig(p.id, cfg)}

      <div class="provider-actions">
        <button class="prov-btn ${isPrimary ? 'prov-primary-active' : 'prov-primary-btn'}"
          onclick="setPrimary('${p.id}')" ${!connected ? 'disabled' : ''}>
          ${isPrimary ? '✓ メイン保存先' : 'メイン保存先にする'}
        </button>
        <button class="prov-btn ${isBackup ? 'prov-backup-active' : 'prov-backup-btn'}"
          onclick="setBackup('${p.id}')" ${!connected || isPrimary ? 'disabled' : ''}>
          ${isBackup ? '✓ バックアップ中' : 'バックアップ先'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderProviderConfig(id, cfg) {
  if (id === 'gdrive') {
    const token = loadGDriveToken();
    const connectedEmail = token ? '接続済み' : '';
    const tokenExpiry = token
      ? (new Date(token.expiresAt) > new Date()
          ? `トークン有効期限: ${new Date(token.expiresAt).toLocaleString('ja-JP')}`
          : '⚠ トークン期限切れ（次回保存時に自動更新）')
      : '';

    return `
    <div class="provider-config">
      ${cfg.connected ? `
        <div class="gdrive-connected-info">
          <div class="connected-row">
            <span class="connected-check">✓</span>
            <span class="connected-label">Google Drive に接続中</span>
          </div>
          ${storageSettings.gdrive.folderName
            ? `<div class="connected-detail">保存先フォルダ: 📁 ${storageSettings.gdrive.folderName}</div>`
            : ''}
          ${tokenExpiry ? `<div class="connected-detail">${tokenExpiry}</div>` : ''}
          <div class="provider-actions" style="margin-top:8px">
            <button class="prov-btn prov-connect-btn" onclick="testAndShowGDriveStatus()">接続テスト</button>
            <button class="prov-btn prov-disconnect-btn" onclick="disconnectGDrive()">切断</button>
          </div>
        </div>
      ` : `
        <div class="gdrive-setup-guide">
          <div class="guide-step">
            <div class="guide-step-num">1</div>
            <div class="guide-step-body">
              <div class="guide-step-title">Google Cloud Consoleでプロジェクト作成</div>
              <a class="guide-link" href="https://console.cloud.google.com/" target="_blank">
                console.cloud.google.com を開く →
              </a>
            </div>
          </div>
          <div class="guide-step">
            <div class="guide-step-num">2</div>
            <div class="guide-step-body">
              <div class="guide-step-title">Google Drive API を有効化</div>
              <div class="guide-step-sub">APIとサービス → ライブラリ → "Google Drive API"</div>
            </div>
          </div>
          <div class="guide-step">
            <div class="guide-step-num">3</div>
            <div class="guide-step-body">
              <div class="guide-step-title">OAuth クライアントID を作成</div>
              <div class="guide-step-sub">認証情報 → OAuthクライアントID → ウェブアプリケーション</div>
              <div class="guide-step-sub">リダイレクトURI: <code class="uri-code">${location.origin + location.pathname}</code></div>
            </div>
          </div>
          <div class="guide-step">
            <div class="guide-step-num">4</div>
            <div class="guide-step-body">
              <div class="guide-step-title">クライアントID・シークレットを入力</div>
            </div>
          </div>
        </div>
        <div class="prov-input-group">
          <label class="prov-input-label">クライアントID</label>
          <input class="prov-input" type="text"
            placeholder="例: 123456789-abc...apps.googleusercontent.com"
            value="${cfg.clientId || ''}"
            oninput="storageSettings.gdrive.clientId=this.value;saveStorageSettings()">
        </div>
        <div class="prov-input-group">
          <label class="prov-input-label">クライアントシークレット</label>
          <input class="prov-input" type="password"
            placeholder="例: GOCSPX-..."
            value="${cfg.clientSecret || ''}"
            oninput="storageSettings.gdrive.clientSecret=this.value;saveStorageSettings()">
        </div>
        <div class="prov-error" id="settings-error-gdrive" style="display:none"></div>
        <button class="prov-btn prov-connect-btn" onclick="connectGDrive()">
          🟡 Google アカウントでログイン
        </button>
      `}
    </div>`;
  }

  if (id === 'dropbox') return `
    <div class="provider-config">
      <input class="prov-input" type="text" placeholder="App Key（Dropbox Developers）"
        value="${cfg.appKey || ''}" oninput="storageSettings.dropbox.appKey=this.value;saveStorageSettings()">
      <input class="prov-input" type="text" placeholder="保存フォルダパス（例: /青色会計）"
        value="${cfg.path || '/青色会計'}" oninput="storageSettings.dropbox.path=this.value;saveStorageSettings()">
      <div class="prov-error" id="settings-error-dropbox"></div>
      ${cfg.connected
        ? `<button class="prov-btn prov-disconnect-btn" onclick="disconnectProvider('dropbox')">切断</button>`
        : `<button class="prov-btn prov-connect-btn" onclick="connectDropbox()">🔵 Dropbox でログイン</button>`}
    </div>`;

  if (id === 'onedrive') return `
    <div class="provider-config">
      <input class="prov-input" type="text" placeholder="Client ID（Azure App Registration）"
        value="${cfg.clientId || ''}" oninput="storageSettings.onedrive.clientId=this.value;saveStorageSettings()">
      <div class="prov-error" id="settings-error-onedrive"></div>
      ${cfg.connected
        ? `<button class="prov-btn prov-disconnect-btn" onclick="disconnectProvider('onedrive')">切断</button>`
        : `<button class="prov-btn prov-connect-btn" onclick="connectOneDrive()">🔷 Microsoft でログイン</button>`}
    </div>`;

  if (id === 'webdav') return `
    <div class="provider-config">
      <input class="prov-input" type="url" placeholder="WebDAV URL（例: https://your.server.com/dav）"
        value="${cfg.url || ''}" oninput="storageSettings.webdav.url=this.value;saveStorageSettings()">
      <div class="prov-row-2">
        <input class="prov-input" type="text" placeholder="ユーザー名"
          value="${cfg.username || ''}" oninput="storageSettings.webdav.username=this.value;saveStorageSettings()">
        <input class="prov-input" type="password" placeholder="パスワード"
          value="${cfg.password || ''}" oninput="storageSettings.webdav.password=this.value;saveStorageSettings()">
      </div>
      <div class="prov-error" id="settings-error-webdav"></div>
      <button class="prov-btn prov-connect-btn" onclick="testWebDAV()">🌐 接続テスト</button>
    </div>`;

  return '';
}

function renderBackupSettings() {
  const el = document.getElementById('backup-settings-body');
  if (!el) return;
  el.innerHTML = `
    <div class="setting-row">
      <label class="setting-label">自動バックアップ</label>
      <label class="toggle-switch">
        <input type="checkbox" ${storageSettings.autoBackup ? 'checked' : ''}
          onchange="storageSettings.autoBackup=this.checked;saveStorageSettings();renderBackupSettings()">
        <span class="toggle-slider"></span>
      </label>
    </div>
    ${storageSettings.autoBackup ? `
    <div class="setting-row">
      <label class="setting-label">バックアップ頻度</label>
      <select class="setting-select" onchange="storageSettings.backupInterval=this.value;saveStorageSettings()">
        <option value="save"   ${storageSettings.backupInterval==='save'   ?'selected':''}>保存のたびに</option>
        <option value="daily"  ${storageSettings.backupInterval==='daily'  ?'selected':''}>毎日</option>
        <option value="weekly" ${storageSettings.backupInterval==='weekly' ?'selected':''}>週1回</option>
      </select>
    </div>` : ''}
    <button class="prov-btn prov-connect-btn" onclick="manualBackup()" style="margin-top:8px">
      今すぐバックアップ
    </button>`;
}

// ========================================================
// 関数：データ管理画面（設定）の描画（アイコン失踪問題・完全解決版）
// ========================================================
function renderDataManagement() {
  const el = document.getElementById('data-management-body');
  if (!el) return;

  const total = (entries || []).length;
  const dSize = JSON.stringify({ 
    entries, 
    taxSettings, 
    dencho, 
    budget: JSON.parse(localStorage.getItem('kaikei_budget') || '{}') 
  }).length;

  // 1. HTML構造の生成（アイコン用の枠をID指定で準備）
  el.innerHTML = `
    <div class="data-stat-row">
      <div class="data-stat"><span class="ds-num">${total}</span><span class="ds-label">仕訳件数</span></div>
      <div class="data-stat"><span class="ds-num">${(dSize / 1024).toFixed(1)}KB</span><span class="ds-label">データサイズ</span></div>
      <div class="data-stat"><span class="ds-num">${(dencho || []).length}</span><span class="ds-label">電帳法記録</span></div>
    </div>
    <div class="data-actions" style="display: flex; flex-direction: column; gap: 10px;">
      <button class="export-btn" onclick="exportFullBackup()" style="display: flex; align-items: center; justify-content: center; min-height: 44px;">
        <span id="final-icon-backup" style="width:24px; height:24px; margin-right:8px; display: flex; align-items: center; justify-content: center;"></span>
        <span>全データ書き出し（JSON）</span>
      </button>
      
      <button class="export-btn" onclick="document.getElementById('restore-file').click()" style="display: flex; align-items: center; justify-content: center; min-height: 44px;">
        <span id="final-icon-restore" style="width:24px; height:24px; margin-right:8px; display: flex; align-items: center; justify-content: center;"></span>
        <span>バックアップから復元</span>
      </button>
      
      <input type="file" id="restore-file" accept=".json" style="display:none" onchange="restoreFromFile(event)">
      
      <button class="export-btn danger-btn" onclick="confirmClearData()" 
        style="min-height: 44px; display: flex; align-items: center; justify-content: center; width: 100%;">
        データを全削除
      </button>
  </div>`;

  // 2. 本物のアイコンを注入（一度だけでOK）
  // 描画後、DOMが安定するのをわずかに待ってから実行します
  setTimeout(() => {
    const bIcon = document.getElementById('final-icon-backup');
    const rIcon = document.getElementById('final-icon-restore');
    
    // app.js の干渉を止めたので、この1回きりの注入でもう消えません
    if (bIcon && typeof icon === 'function') {
      bIcon.innerHTML = icon('backupIcon', 'btn-svg');
    }
    if (rIcon && typeof icon === 'function') {
      rIcon.innerHTML = icon('restore', 'btn-svg');
    }
    
    console.log('Icon restoration complete. The long battle has ended!');
  }, 50); 

} // end function renderDataManagement



function renderImportAutoMapping() {
  const el = document.getElementById('import-mapping-body');
  if (!el) return;

  const mapping = JSON.parse(localStorage.getItem('kaikei_import_mapping') || JSON.stringify({
    incomeAccount:  '売上高',
    expenseAccount: '消耗品費',
    bankAccount:    '普通預金',
    defaultTaxCode: 'non',
    autoJournal:    true,
  }));

  el.innerHTML = `
    <div class="map-notice">PRiMPO CSV取込時に自動で設定される勘定科目・税区分を指定します</div>
    <div class="setting-row">
      <label class="setting-label">自動仕訳</label>
      <label class="toggle-switch">
        <input type="checkbox" id="map-auto" ${mapping.autoJournal ? 'checked' : ''}
          onchange="saveImportMapping()">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <label class="setting-label">収入デフォルト科目</label>
      <select class="setting-select" id="map-income" onchange="saveImportMapping()">
        ${getIncomeOptions(mapping.incomeAccount)}
      </select>
    </div>
    <div class="setting-row">
      <label class="setting-label">支出デフォルト科目</label>
      <select class="setting-select" id="map-expense" onchange="saveImportMapping()">
        ${getExpenseOptions(mapping.expenseAccount)}
      </select>
    </div>
    <div class="setting-row">
      <label class="setting-label">預金科目</label>
      <select class="setting-select" id="map-bank" onchange="saveImportMapping()">
        ${getBankOptions(mapping.bankAccount)}
      </select>
    </div>
    <div class="setting-row">
      <label class="setting-label">デフォルト税区分</label>
      <select class="setting-select" id="map-tax" onchange="saveImportMapping()">
        <option value="non"      ${mapping.defaultTaxCode==='non'      ?'selected':''}>対象外</option>
        <option value="exempt10" ${mapping.defaultTaxCode==='exempt10' ?'selected':''}>課税売上10%</option>
        <option value="input10"  ${mapping.defaultTaxCode==='input10'  ?'selected':''}>課税仕入10%</option>
        <option value="free"     ${mapping.defaultTaxCode==='free'     ?'selected':''}>非課税</option>
      </select>
    </div>`;
}

function getIncomeOptions(selected) {
  return ACCOUNTS.income.items.map(a =>
    `<option value="${a.name}" ${a.name===selected?'selected':''}>${a.name}</option>`).join('');
}
function getExpenseOptions(selected) {
  return ACCOUNTS.expenses.items.map(a =>
    `<option value="${a.name}" ${a.name===selected?'selected':''}>${a.name}</option>`).join('');
}
function getBankOptions(selected) {
  return ACCOUNTS.assets.items.filter(a => ['普通預金','当座預金','現金'].includes(a.name)).map(a =>
    `<option value="${a.name}" ${a.name===selected?'selected':''}>${a.name}</option>`).join('');
}

function saveImportMapping() {
  const mapping = {
    incomeAccount:  document.getElementById('map-income')?.value  || '売上高',
    expenseAccount: document.getElementById('map-expense')?.value || '消耗品費',
    bankAccount:    document.getElementById('map-bank')?.value    || '普通預金',
    defaultTaxCode: document.getElementById('map-tax')?.value     || 'non',
    autoJournal:    document.getElementById('map-auto')?.checked  ?? true,
  };
  localStorage.setItem('kaikei_import_mapping', JSON.stringify(mapping));
  showToast('インポート設定を保存しました', 'success');
}

// ===== Google Drive 接続テスト表示 =====
async function testAndShowGDriveStatus() {
  showToast('接続テスト中...', 'info');
  const result = await testGDriveConnection();
  if (result.ok) {
    showToast(`接続OK: ${result.email || 'Google Drive'}`, 'success');
  } else {
    showToast(`接続失敗: ${result.error}`, 'error');
    showGDriveError(result.error);
  }
}

// ===== プロバイダ操作 =====
function setPrimary(id) {
  if (id !== 'local' && !storageSettings[id]?.connected) { showToast('先に接続してください', 'error'); return; }
  storageSettings.primary = id;
  if (storageSettings.backup === id) storageSettings.backup = 'none';
  saveStorageSettings();
  renderSettingsPage();
  showToast(`${providerLabel(id)} をメイン保存先に設定しました`, 'success');
}

function setBackup(id) {
  if (id === storageSettings.primary) return;
  if (id !== 'local' && !storageSettings[id]?.connected) { showToast('先に接続してください', 'error'); return; }
  storageSettings.backup = storageSettings.backup === id ? 'none' : id;
  saveStorageSettings();
  renderSettingsPage();
  const msg = storageSettings.backup === id ? `${providerLabel(id)} をバックアップ先に設定しました` : 'バックアップ先を解除しました';
  showToast(msg, 'success');
}

function disconnectProvider(id) {
  if (!confirm(`${providerLabel(id)} の接続を切断しますか？`)) return;
  if (storageSettings[id]) { storageSettings[id].token = ''; storageSettings[id].connected = false; }
  if (storageSettings.primary === id) storageSettings.primary = 'local';
  if (storageSettings.backup  === id) storageSettings.backup  = 'none';
  saveStorageSettings();
  renderSettingsPage();
  showToast(`${providerLabel(id)} を切断しました`, 'info');
}

// ===== バックアップ操作 =====
async function manualBackup() {
  showToast('バックアップ中...', 'info');
  const data = getCurrentData();
  const { primaryOk, backupOk } = await saveAllData(data);
  const ts = new Date().toISOString().slice(0, 10);
  storageSettings.lastBackup = new Date().toISOString();
  saveStorageSettings();
  renderSettingsPage();
  showToast(primaryOk ? `バックアップ完了（${ts}）` : 'バックアップ失敗', primaryOk ? 'success' : 'error');
}

function getCurrentData() {
  return {
    entries,
    taxSettings,
    dencho,
    budget: JSON.parse(localStorage.getItem('kaikei_budget') || '{}'),
    exportedAt: new Date().toISOString(),
    version: '2.0',
  };
}

function exportFullBackup() {
  const data = getCurrentData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `kaikei_full_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('バックアップファイルを書き出しました', 'success');
}

function restoreFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!confirm('現在のデータを上書きして復元しますか？')) { event.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.entries)     { entries = data.entries; localStorage.setItem('kaikei_entries', JSON.stringify(entries)); }
      if (data.taxSettings) { taxSettings = data.taxSettings; localStorage.setItem('kaikei_tax', JSON.stringify(taxSettings)); }
      if (data.dencho)      { dencho = data.dencho; localStorage.setItem('kaikei_dencho', JSON.stringify(dencho)); }
      if (data.budget)      localStorage.setItem('kaikei_budget', JSON.stringify(data.budget));
      renderAll();
      renderSettingsPage();
      showToast('復元が完了しました', 'success');
    } catch (e) {
      showToast('復元失敗: ファイルが無効です', 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}


function confirmClearData() {
  if (!confirm('全データを削除します。この操作は元に戻せません。本当に削除しますか？')) return;
  if (!confirm('最終確認：本当に削除してよいですか？（資産台帳データも完全に削除されます）')) return;

  // 1. ローカルストレージの全キーを削除
  const keys = [
    'kaikei_entries', 
    'kaikei_tax', 
    'kaikei_dencho', 
    'kaikei_budget', 
    'kaikei_assets' // 資産データ
  ];
  keys.forEach(k => localStorage.removeItem(k));

  // 2. メモリ上の変数をリセット
  entries = []; 
  taxSettings = { method: 'exempt', industry: '0.5' }; 
  dencho = [];
  if (typeof assets !== 'undefined') assets = [];

  // 3. UIの整合性をとるためにリロード
  // これにより、ダッシュボードや資産帳の表示が完全にクリアされます
  alert('すべてのデータを削除しました。システムを再起動します。');
  location.reload();
}


/* -------------------------------------------------------------------------- */
/* 2026-05-12 修正: 免税事業者設定カードの拡張（診断表示およびウィザード導線の追加）
/* -------------------------------------------------------------------------- */
function renderExemptSettingNEW() {
  const container = document.getElementById('import-mapping-body');
  if (!container) return;

  const existingCard = document.getElementById('exempt-tax-card');
  if (existingCard) existingCard.remove();

  // ユーザー設定の取得（開業日 openingDate を含む）
  const settings = JSON.parse(localStorage.getItem('userSettings')) || { 
    isExempt: false,
    openingDate: ''
  };

  // 開業日から診断メッセージを生成
  let diagnosisHtml = '';
  if (settings.openingDate) {
    const periods = calculateTaxPeriods(settings.openingDate);
    diagnosisHtml = `
      <div style="margin: 0 16px 16px 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd; display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 1.1rem;">✨</span>
        <div>
          <p style="font-size: 0.75rem; color: #0369a1; margin: 0; font-weight: bold;">免税期間の診断結果</p>
          <p style="font-size: 0.85rem; font-weight: bold; color: #0c4a6e; margin: 2px 0 0 0;">${periods.displayLimit}まで免税予定</p>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="section-card" id="exempt-tax-card" style="margin-bottom: 24px;">
      <div class="section-head">
        <span class="section-title-row">
          <span class="sec-icon" style="background: #3b82f6;"></span>基本税務設定
        </span>
      </div>
      <div class="section-body" style="padding-bottom: 8px !important;">
        <div class="setting-row" style="display: flex; align-items: center; padding: 16px 16px 12px 16px;">
          <div style="flex: 1;">
            <span class="setting-label" style="display: block; font-weight: bold;">免税事業者モード</span>
            <span class="setting-desc" style="font-size: 0.85rem; color: #64748b; line-height: 1.4; display: block; margin-top: 4px;">ONにすると、仕訳の税区分を「対象外」に固定します。</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="settings-is-exempt" ${settings.isExempt ? 'checked' : ''} onchange="toggleExemptSetting()">
            <span class="toggle-slider"></span>
          </label>
        </div>

        ${diagnosisHtml}

        <div style="padding: 0 16px 16px 16px;">
          <button onclick="openWizard()" style="width: 100%; padding: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.2s;">
            <span style="font-size: 1rem;">📅</span> 開業日を設定（ウィザード起動）
          </button>
        </div>
      </div>
    </div>
  `;
  
  const importCard = container.closest('.section-card');
  if (importCard) {
    importCard.insertAdjacentHTML('beforebegin', html);
  }
}
/* -------------------------------------------------------------------------- */

// 免税期間の簡易計算ロジック
function calculateTaxPeriods(openingDateStr) {
  if (!openingDateStr) return null;
  const openDate = new Date(openingDateStr);
  const startYear = openDate.getFullYear();
  return {
    displayLimit: `${startYear + 1}年12月31日`
  };
}


/* ========================================================================== */
/* 2026-05-12 実装: 本格マルチステップ・ウィザード（戦略的オンボーディング）
/* ========================================================================== */

let wizardStep = 1;

/**
 * ウィザードの起動
 */
function openWizard() {
  wizardStep = 1;
  renderWizard();
}

/**
 * ウィザード画面の描画
 */
function renderWizard() {
  const oldModal = document.getElementById('wizard-modal');
  if (oldModal) oldModal.remove();

  const settings = JSON.parse(localStorage.getItem('userSettings')) || {};

  const modalHtml = `
    <div id="wizard-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(8px);">
      <div id="wizard-card" style="background: white; width: 92%; max-width: 480px; border-radius: 28px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: relative; overflow: hidden;">
        <div style="display: flex; gap: 8px; margin-bottom: 24px; justify-content: center;">
          ${[1, 2, 3, 4].map(i => `<div style="width: 40px; height: 6px; border-radius: 3px; background: ${i <= wizardStep ? '#334155' : '#e2e8f0'}; transition: 0.3s;"></div>`).join('')}
        </div>
        
        ${getStepContent(settings)}
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // ステップ1の場合、リアルタイム診断を初期実行
  if (wizardStep === 1) updateWizardDiagnosis();
}

/**
 * 各ステップのコンテンツ生成
 */
function getStepContent(settings) {
  switch (wizardStep) {
    case 1: // 税務診断
      return `
        <div style="text-align: center;">
          <span style="font-size: 3rem;">📅</span>
          <h2 style="margin: 16px 0 8px 0; font-size: 1.4rem; color: #1e293b;">免税期間を診断する</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 24px;">開業日を基準に、消費税を払わなくて良い<br>「ボーナス期間」を算出します。</p>
          
          <div style="text-align: left; margin-bottom: 20px;">
            <label style="display: block; font-size: 0.8rem; font-weight: bold; color: #475569; margin-bottom: 8px;">開業届上の開業日</label>
            <input type="date" id="wizard-opening-date" value="${settings.openingDate || ''}" 
                   onchange="updateWizardDiagnosis()" 
                   style="width: 100%; padding: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; outline: none; transition: border-color 0.2s;">
          </div>
          <div id="wizard-diagnosis-result"></div>
          
          <button onclick="saveWizardStep1()" style="width: 100%; padding: 16px; background: #334155; color: white; border-radius: 14px; font-weight: 600; border: none; margin-top: 20px; cursor: pointer;">次へ進む</button>
        </div>
      `;

    case 2: // 車両・日報設定
      return `
        <div style="text-align: center;">
          <span style="font-size: 3rem;">🚗</span>
          <h2 style="margin: 16px 0 8px 0; font-size: 1.4rem; color: #1e293b;">税務調査に負けない記録</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 24px;">日々の走行距離から「仕事用」の割合を<br>自動計算し、強力なエビデンスを作ります。</p>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 16px; text-align: left; margin-bottom: 24px;">
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="wizard-use-mileage" ${settings.useMileageLog ? 'checked' : ''} style="width: 20px; height: 20px;">
              <div>
                <span style="font-weight: bold; color: #1e293b; display: block;">日報から家事按分を自動計算</span>
                <span style="font-size: 0.75rem; color: #64748b;">(推奨) 走行距離ベースで正確な比率を算出します</span>
              </div>
            </label>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button onclick="wizardStep=1; renderWizard();" style="flex: 1; padding: 14px; background: #f1f5f9; color: #475569; border-radius: 12px; border: none; font-weight: 600; cursor: pointer;">戻る</button>
            <button onclick="saveWizardStep2()" style="flex: 2; padding: 14px; background: #334155; color: white; border-radius: 12px; border: none; font-weight: 600; cursor: pointer;">次へ進む</button>
          </div>
        </div>
      `;

    case 3: // データ保護宣言
      return `
        <div style="text-align: center;">
          <span style="font-size: 3rem;">🔒</span>
          <h2 style="margin: 16px 0 8px 0; font-size: 1.4rem; color: #1e293b;">データは開発者に渡りません</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 24px;">プライバシー保護への私たちの約束です。</p>
          
          <ul style="text-align: left; font-size: 0.85rem; color: #475569; background: #ecfdf5; padding: 20px 20px 20px 40px; border-radius: 16px; line-height: 1.6; border: 1px solid #a7f3d0;">
            <li>売上や経費、取引先は一切抜き取りません。</li>
            <li>データはあなた自身のGoogleドライブに保存。</li>
            <li>開発者を含む第三者は閲覧不能な仕組みです。</li>
          </ul>
          
          <div style="margin-top: 24px; display: flex; gap: 12px;">
            <button onclick="wizardStep=2; renderWizard();" style="flex: 1; padding: 14px; background: #f1f5f9; color: #475569; border-radius: 12px; border: none; font-weight: 600; cursor: pointer;">戻る</button>
            <button onclick="wizardStep=4; renderWizard();" style="flex: 2; padding: 14px; background: #059669; color: white; border-radius: 12px; border: none; font-weight: 600; cursor: pointer;">同意して次へ</button>
          </div>
        </div>
      `;

    case 4: // 完了
      return `
        <div style="text-align: center;">
          <span style="font-size: 3rem;">✨</span>
          <h2 style="margin: 16px 0 8px 0; font-size: 1.4rem; color: #1e293b;">準備が整いました！</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 24px;">あなた専用の会計ナビゲーションを<br>お楽しみください。</p>
          
          <button onclick="closeWizard()" style="width: 100%; padding: 16px; background: #059669; color: white; border-radius: 14px; font-weight: 600; border: none; cursor: pointer;">はじめる</button>
        </div>
      `;
  }
}

/**
 * ステップ1の保存
 */
function saveWizardStep1() {
  const dateVal = document.getElementById('wizard-opening-date').value;
  if (!dateVal) { alert("開業日を入力してください"); return; }
  
  let settings = JSON.parse(localStorage.getItem('userSettings')) || {};
  settings.openingDate = dateVal;
  localStorage.setItem('userSettings', JSON.stringify(settings));
  
  wizardStep = 2;
  renderWizard();
}

/**
 * ステップ2の保存
 */
function saveWizardStep2() {
  const useMileage = document.getElementById('wizard-use-mileage').checked;
  
  let settings = JSON.parse(localStorage.getItem('userSettings')) || {};
  settings.useMileageLog = useMileage;
  localStorage.setItem('userSettings', JSON.stringify(settings));
  
  wizardStep = 3;
  renderWizard();
}

/**
 * 免税期間の計算ロジック（本格版）
 */
function calculateTaxPeriods(openingDateStr) {
  if (!openingDateStr) return { displayLimit: '未設定' };
  const openDate = new Date(openingDateStr);
  const startYear = openDate.getFullYear();
  // 免税期間の簡易ルール（2年前の売上が1000万以下なら免税。開業年は原則免税）
  // ここでは分かりやすく「開業年の翌年末まで」をボーナス期間として表示
  return {
    displayLimit: `${startYear + 1}年12月31日`
  };
}

/**
 * リアルタイム診断（ウィザード内）
 */
function updateWizardDiagnosis() {
  const dateInput = document.getElementById('wizard-opening-date');
  const resultArea = document.getElementById('wizard-diagnosis-result');
  if (!dateInput || !dateInput.value) {
    resultArea.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 0.8rem; border: 2px dashed #e2e8f0; padding: 16px; border-radius: 12px;">日付を選択すると免税期間を算出します</p>';
    return;
  }
  const periods = calculateTaxPeriods(dateInput.value);
  resultArea.innerHTML = `
    <div style="background: #f0f9ff; padding: 16px; border-radius: 12px; border: 1px solid #bae6fd; text-align: left;">
      <p style="font-size: 0.75rem; color: #0369a1; margin: 0; font-weight: bold;">診断結果</p>
      <p style="font-size: 1rem; font-weight: bold; color: #0c4a6e; margin: 4px 0;">${periods.displayLimit}まで免税予定</p>
      <p style="font-size: 0.7rem; color: #0284c7; margin: 0;">※消費税分の手残りを最大化しましょう！</p>
    </div>
  `;
}

/**
 * ウィザードを閉じる・終了処理
 */
function closeWizard() {
  const modal = document.getElementById('wizard-modal');
  if (modal) modal.remove();
  
  // 設定画面のUIを最新状態に更新（診断メッセージなどを出すため）
  renderExemptSettingNEW();
  if (typeof updateExemptUI === 'function') updateExemptUI();
}





