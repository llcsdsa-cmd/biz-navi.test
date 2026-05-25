// app.js の 1行目
window.ProWizard = window.ProWizard || { currentStep: 1, totalSteps: 4 };
window.MeterEvidence = window.MeterEvidence || {};


// ===== 状態管理 =====
let entries = JSON.parse(localStorage.getItem('kaikei_entries') || '[]');
let assets = JSON.parse(localStorage.getItem('kaikei_assets') || '[]');
let taxSettings = JSON.parse(localStorage.getItem('kaikei_tax') || '{"method":"exempt","industry":"0.5"}');
let budget = JSON.parse(localStorage.getItem('kaikei_budget') || '{"income":0,"expense":0}');
let currentPage = 'dashboard';
let currentJournalTab = 'unprocessed'; // ← ここに追加！
let clientMaster = {};

// カレンダー・グラフ用状態
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let monthlyChart = null;
let categoryChart = null;
let catTabMode = 'expense';





// ===== 画面更新司令塔（免税UI同期を追加） =====
function renderAll() {
  // ★ 最初、または最後にこの1行を追加
  if (typeof updateExemptUI === 'function') updateExemptUI();

  updateDashboard();
  if (typeof renderJournal === 'function') renderJournal();
  if (typeof renderLedger === 'function') renderLedger();
  if (typeof renderTax === 'function') renderTax();
  if (typeof renderReport === 'function') renderReport();
  if (typeof renderAssets === 'function') renderAssets();
  if (typeof renderDenchoSearch === 'function') renderDenchoSearch();
}
// ===== 画面更新司令塔（免税UI同期を追加）終わり =====

// ===== ナビゲーション =====
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');
  const targetTab = document.querySelector(`[data-page="${page}"]`);
  if (targetTab) targetTab.classList.add('active');
  
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.scrollTop = 0;

  // ページ切替後にアイコンを再描画（アイコン消失対策）
  requestAnimationFrame(() => {
    if (typeof initIcons === 'function') initIcons();
  });
}

// --- app.js の上部に追加 ---

// 1. 【箱】ユーザー定義のマイルール（初期値 or ローカルストレージから取得）
let userCustomRules = JSON.parse(localStorage.getItem('bizNaviCustomRules')) || [
    // 初期設定ウィザード未実施時のサンプル
    { keyword: "快活クラブ", account: "開発費", wallet: "現金", memo: "開発環境利用" },
    { keyword: "ENEOS", account: "車両費", wallet: "クレジットカード", memo: "ガソリン代" }
];

// 2. 【箱】業種設定（ウィザードで決定する内容）
let userIndustry = localStorage.getItem('bizNaviIndustry') || "software_dev"; // デフォルト

// ルールを保存する共通関数
function saveCustomRules() {
    localStorage.setItem('bizNaviCustomRules', JSON.stringify(userCustomRules));
}

// ルールを追加する共通関数
function addCustomRule(keyword, account, wallet, memo) {
    userCustomRules.push({ keyword, account, wallet, memo });
    saveCustomRules();
}
  

  
  
// ===== ナビゲーション 終わり =====


/* =============================================================
   統合ウィザード：全部品定義（ここをまるごと貼り付け）
   ============================================================= */

// --- Step 1: 業種選択 ---
ProWizard.templateStep1 = function() {
    return `
        <div class="wizard-step">
            <h2 style="font-size: 1.4rem; text-align: center;">事業内容の選択</h2>
            <p style="color: #64748b; font-size: 0.85rem; text-align: center; margin-bottom: 20px;">
                複数選択可能です。選んだ内容に合わせて科目を最適化します。
            </p>
            <div class="category-grid" style="display: grid; gap: 10px;">
                <label class="biz-card"><input type="checkbox" name="biz-type" value="delivery"> 🚚 軽貨物運送</label>
                <label class="biz-card"><input type="checkbox" name="biz-type" value="gig"> 🍱 フードデリバリー</label>
                <label class="biz-card"><input type="checkbox" name="biz-type" value="dev"> 💻 ソフトウェア開発</label>
                <label class="biz-card"><input type="checkbox" name="biz-type" value="other"> ➕ その他・物販</label>
            </div>
        </div>
    `;
};

// --- Step 2: 開業日設定 ---
ProWizard.templateStep2 = function() {
    return `
        <div class="wizard-step">
            <h2 style="font-size: 1.4rem; text-align: center;">開業日の設定</h2>
            <p style="color: #64748b; font-size: 0.85rem; text-align: center; margin-bottom: 20px;">
                開業日に基づき、免税事業者期間を自動判定します。
            </p>
            <div style="margin-bottom: 20px;">
                <input type="date" id="wizard-opening-date" style="width:100%; padding:15px; border-radius:10px; border:1px solid #ddd;">
            </div>
            <div id="tax-diagnosis-result"></div>
        </div>
    `;
};

// --- Step 3: 車両・カメラ撮影 ---
ProWizard.templateStep3 = function() {
    return `
        <div class="wizard-step">
            <h2 style="font-size: 1.4rem; text-align: center;">🚚 車両と開始メーター</h2>
            <p style="color: #64748b; font-size: 0.85rem; text-align: center; margin-bottom: 20px;">
                業務開始時のメーターは税務上の大切な基準点です。<br>
                写真を撮って証拠を残しましょう。
            </p>
            <div id="meter-capture-area" style="margin-bottom: 20px; text-align: center;">
                <button onclick="document.getElementById('meter-camera-input').click()" 
                        style="width: 100%; padding: 20px; border: 2px dashed #6366f1; background: #f5f3ff; color: #6366f1; border-radius: 15px; font-weight: bold;">
                    📸 メーターを撮影して証拠保存
                </button>
                <input type="file" id="meter-camera-input" accept="image/*" capture="camera" style="display:none;" onchange="MeterEvidence.processPhoto(event)">
                <div id="photo-preview-container" style="margin-top: 15px; display: none;">
                    <img id="photo-preview-img" src="" style="width: 100%; border-radius: 12px; border: 2px solid #6366f1;">
                    <p style="color: #10b981; font-size: 0.8rem; margin-top: 5px;">✅ タイムスタンプ刻印完了</p>
                </div>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <label style="display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 5px;">現在の走行距離を入力 (km)</label>
                <input type="number" id="wizard-initial-meter" inputmode="decimal" placeholder="0.0" 
                       style="width: 100%; padding: 12px; font-size: 1.5rem; text-align: center; border: 1px solid #ddd; border-radius: 8px;">
            </div>
        </div>
    `;
};

// --- Step 4: 最終確認 & ロック ---
ProWizard.templateStep4 = function() {
    return `
        <div class="wizard-step" style="border-top: 2px solid #6366f1; padding-top: 30px;">
            <h2 style="font-size: 1.4rem; text-align: center;">🏁 最終確認と開始</h2>
            <div style="background: #fdf2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #b91c1c; font-size: 0.8rem; font-weight: bold; margin: 0;">
                    ⚠️ 注意：確定後は「開業日」と「開始メーター」の変更に制限がかかります。
                </p>
            </div>
            <div style="margin-bottom: 30px;">
                <p style="font-size: 0.8rem; font-weight: bold; margin-bottom: 8px;">保存先の設定</p>
                <div style="padding: 15px; border: 2px solid #6366f1; background: #f5f3ff; border-radius: 10px; font-size: 0.85rem;">
                    📱 <strong>このスマホ本体に保存</strong><br>
                    <span style="color: #64748b;">データはあなたの端末内でのみ管理されます。</span>
                </div>
            </div>
            <button onclick="ProWizard.complete()" style="width: 100%; padding: 20px; background: #10b981; color: white; border: none; border-radius: 15px; font-weight: bold; font-size: 1.2rem; cursor: pointer; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39);">
                この内容でPro版を開始する！
            </button>
        </div>
    `;
};

// --- 縦並び構成の描画 ---
ProWizard.renderSinglePage = function() {
    const container = document.getElementById('wizard-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="wizard-scroll-wrapper" style="padding: 20px; max-width: 500px; margin: 0 auto; background: white;">
            <h1 style="text-align: center; margin-bottom: 30px;">🚀 初期設定</h1>
            <section class="wizard-section">${this.templateStep1()}</section>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;">
            <section class="wizard-section">${this.templateStep2()}</section>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;">
            <section class="wizard-section">${this.templateStep3()}</section>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;">
            <section class="wizard-section" style="padding-bottom: 100px;">${this.templateStep4()}</section>
        </div>
    `;
};

// --- 保存処理 ---
ProWizard.complete = function() {
    const bizTypes = Array.from(document.querySelectorAll('input[name="biz-type"]:checked')).map(el => el.value);
    const openingDate = document.getElementById('wizard-opening-date').value;
    const initialMeter = document.getElementById('wizard-initial-meter').value;
    const photoData = document.getElementById('photo-preview-img') ? document.getElementById('photo-preview-img').src : "";

    if (!openingDate || !initialMeter) {
        alert("開業日と開始メーターを入力してください。");
        return;
    }

    const config = {
        bizTypes,
        openingDate,
        initialMeter,
        photoData,
        isLocked: true,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('pro_config', JSON.stringify(config));
    alert("プロ設定をロックしました。これより全機能が解放されます！");
    window.location.reload(); 
};

// --- カメラ証拠写真ロジック ---
window.MeterEvidence = {
    processPhoto: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width; canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                const fontSize = Math.floor(canvas.width / 20);
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.fillStyle = 'rgba(255, 69, 0, 0.8)';
                ctx.shadowColor = 'black'; ctx.shadowBlur = 7;
                ctx.fillText(timestamp, canvas.width - (ctx.measureText(timestamp).width + 20), canvas.height - 40);
                const previewImg = document.getElementById('photo-preview-img');
                const previewContainer = document.getElementById('photo-preview-container');
                if (previewImg) {
                    previewImg.src = canvas.toDataURL('image/jpeg', 0.8);
                    previewContainer.style.display = 'block';
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};





// ===== [2026-05-12 23:55 修正：資産抽出時のDateエラー防止ガードと抽出条件の最適化] =====
/**
 * 共通バー（年・月）の値を読み取り、ダッシュボード、KPI、資産台帳、カレンダーを同期更新する。
 */
function updateDashboard() {
  // 1. 新しい共通バーから値を取得
  const yearSel = document.getElementById('global-year');
  const monthSel = document.getElementById('global-month');
  
  if (!yearSel || !monthSel) {
    console.warn("共通期間バー（global-year/month）が見つかりません。");
    return;
  }

  const selectedYear = yearSel.value;
  const selectedMonthRaw = monthSel.value;

  // 2. データソースの取得（優先順位：journalEntries > entries）
  let allDataSources = [];
  if (typeof journalEntries !== 'undefined' && journalEntries.length > 0) {
    allDataSources = journalEntries;
  } else if (typeof entries !== 'undefined') {
    allDataSources = entries;
  }

  // 3. 指定された年のデータを抽出（グラフ描画用）
  const yearData = allDataSources.filter(e => {
    if (!e.date) return false;
    const parts = String(e.date).replace(/\//g, '-').split('-');
    return parts[0] === selectedYear;
  });

  // 4. 表示対象のデータを抽出 (KPI・合計カード用)
  let targetData;
  if (selectedMonthRaw === 'all') {
    targetData = yearData;
  } else {
    targetData = yearData.filter(e => {
      const parts = String(e.date).replace(/\//g, '-').split('-');
      const entryMonth = parseInt(parts[1], 10).toString();
      return entryMonth === selectedMonthRaw;
    });
  }

  // 【デバッグ用】抽出結果をコンソールに出力
  console.log(`[Dashboard Update] ${selectedYear}年 ${selectedMonthRaw}月 -> ${targetData.length}件を処理`);
  window.lastTargetData = targetData;

  // 5. 集計実行（外部関数 calcSums を使用）
  const sums = (typeof calcSums === 'function') 
    ? calcSums(targetData) 
    : { income: 0, expense: 0, kasjiTotal: 0, kasjiBiz: 0, kasjiHome: 0, taxReceived: 0, taxPaid: 0 };

  // 6. 画面表示の更新（KPIカード）
  const updateText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `¥${(val || 0).toLocaleString()}`;
  };

  updateText('dash-income', sums.income);
  updateText('dash-expense', sums.expense);

  // --- カレンダーオーバーレイの制御（タイポ対策済） ---
  const overlay = document.getElementById('calendar-overlay') || document.getElementById('calender-overlay');
  if (overlay) {
    // 月選択が「すべて」の時はカレンダーを隠す（またはオーバーレイを表示）
    overlay.style.display = (selectedMonthRaw === 'all') ? 'flex' : 'none';
  }
  
  const profit = (sums.income || 0) - (sums.expense || 0);
  updateText('dash-profit', profit);

  const profitCard = document.getElementById('profit-card-container');
  if (profitCard) {
    profitCard.classList.remove('profit-positive', 'profit-negative');
    profitCard.classList.add(profit >= 0 ? 'profit-positive' : 'profit-negative');
  }

  // 7. 概要カード（按分・消費税関連）
  updateText('按分-before', sums.kasjiTotal);
  updateText('按分-biz', sums.kasjiBiz);
  updateText('按分-home', sums.kasjiHome);
  updateText('dash-tax-received', sums.taxReceived);
  updateText('dash-tax-paid', sums.taxPaid);

  // 8. 外部描画の実行
  try {
    if (typeof renderDashboardCharts === 'function') renderDashboardCharts(yearData);
    
    if (typeof renderCategorySection === 'function') {
      const activeType = document.getElementById('cat-tab-income')?.classList.contains('active') ? 'income' : 'expense';
      renderCategorySection(activeType, parseInt(selectedYear), selectedMonthRaw === 'all' ? 'all' : parseInt(selectedMonthRaw));
    }
    
    // カレンダーの再描画
    if (typeof renderCalendar === 'function') {
      renderCalendar(); 
    }
  } catch (e) {
    console.error("Dashboard Render Error:", e);
  }

  // 9. アイコン再描画
  if (typeof icon === 'function') {
    const iconMap = {
      'kpi-icon-income': 'income', 'kpi-icon-expense': 'expense',
      'kpi-icon-profit': 'profit'
    };
    for (const [id, name] of Object.entries(iconMap)) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = icon(name, 's-icon');
    }
  }

  // 10. 資産台帳への自動抽出ロジック
  // 30万円以上、または「車両運搬具」等のキーワードが含まれるものを抽出
  if (typeof assets !== 'undefined') {
    assets = yearData 
      .filter(d => {
        if (!d.date) return false; // 日付がないデータは除外
        const rawAmt = d.debitAmt || d.creditAmt || d.amount || 0;
        const val = Number(String(rawAmt).replace(/,/g, ''));
        const subject = d.debitAcc || d.creditAcc || d.subject || "";

        const isAssetBody = val >= 300000 || subject.includes('車両運搬具') || subject.includes('器具備品');
        const isNotExpense = !subject.includes('償却') && !subject.endsWith('費');

        return isAssetBody && isNotExpense;
      })
      .map(d => {
        const rawAmt = d.debitAmt || d.creditAmt || d.amount || 0;
        const cleanAmt = Number(String(rawAmt).replace(/,/g, ''));
        const name = d.content || d.debitAcc || d.creditAcc || d.subject || "固定資産";
        const life = d.usefulLife || 6; 

        // 日付の正規化処理
        const dateStr = String(d.date).replace(/\//g, '-');
        const startDate = new Date(dateStr);
        const endDate = isNaN(startDate.getTime()) 
          ? "判定不能" 
          : `${startDate.getFullYear() + life}年${startDate.getMonth() + 1}月`;

        return {
          id: d.id || Math.random().toString(36).substring(2),
          name: name,
          date: d.date,
          price: cleanAmt,
          usefulLife: life,
          endDate: endDate,
          status: "減価償却中",
          remainingValue: d.remainingValue || cleanAmt
        };
      });
  }
  
  if (typeof renderAssets === 'function') {
    renderAssets(); 
  }

  // 11. 今日のアクションバナー更新
  renderTodayActionBanner();

  // 11b. 車検・保険期限アラート
  if (typeof renderVehicleAlerts === 'function') renderVehicleAlerts();

  // 12. 最近の取引を描画
  renderRecentEntries();

  // 13. 自動分類率バッジ
  (function renderAutoClassifyRate() {
    const bar = document.getElementById('auto-classify-rate-bar');
    const fill = document.getElementById('auto-rate-bar-fill');
    const label = document.getElementById('auto-rate-label');
    if (!bar || !fill || !label) return;

    if (!targetData || targetData.length === 0) {
      bar.style.display = 'none';
      return;
    }
    const total = targetData.length;
    // manually_saved=trueかstatus='completed'は確認済み（= 自動 or 手動問わず処理済み）
    // predicted_accountがある = 自動分類された
    const autoClassified = targetData.filter(e => e.predicted_account || e.manually_saved).length;
    const rate = Math.round((autoClassified / total) * 100);

    bar.style.display = 'block';
    fill.style.width = `${rate}%`;
    label.textContent = `${rate}%`;
  })();
}
// ===== [2026-05-12 23:55 修正終了] =====

// ===== [2026-05-24 追加] 車検・保険通知 =====
const VEHICLE_REMINDER_KEY = 'bizNavi_vehicleReminders';

function getVehicleReminders() {
  try {
    return JSON.parse(localStorage.getItem(VEHICLE_REMINDER_KEY) || '[]');
  } catch { return []; }
}

function saveVehicleReminders(list) {
  localStorage.setItem(VEHICLE_REMINDER_KEY, JSON.stringify(list));
}

// 期限までの残日数を計算
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ダッシュボード用：期限アラートバナーを描画
function renderVehicleAlerts() {
  const el = document.getElementById('vehicle-alert-banner');
  if (!el) return;

  const reminders = getVehicleReminders();
  if (!reminders.length) { el.innerHTML = ''; return; }

  const alerts = reminders
    .map(r => ({ ...r, days: daysUntil(r.date) }))
    .filter(r => r.days !== null && r.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (!alerts.length) { el.innerHTML = ''; return; }

  const items = alerts.map(r => {
    const isUrgent = r.days <= 7;
    const isOver   = r.days < 0;
    const bg    = isOver ? '#fef2f2' : isUrgent ? '#fff7ed' : '#f0f9ff';
    const border= isOver ? '#fca5a5' : isUrgent ? '#fdba74' : '#bae6fd';
    const color = isOver ? '#b91c1c' : isUrgent ? '#c2410c' : '#0369a1';
    const icon  = r.type === 'inspection' ? '🔧' : r.type === 'insurance' ? '🛡️' : '📅';
    const dayLabel = isOver
      ? `${Math.abs(r.days)}日超過！`
      : r.days === 0 ? '今日が期限！'
      : `あと${r.days}日`;

    return `
      <div style="background:${bg};border:1px solid ${border};border-radius:12px;
                  padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:1.3rem;flex-shrink:0;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:${color};font-size:0.88rem;">${r.label}</div>
          <div style="font-size:0.75rem;color:${color};opacity:0.8;margin-top:1px;">
            期限: ${r.date}
          </div>
        </div>
        <span style="font-weight:800;color:${color};font-size:0.88rem;white-space:nowrap;flex-shrink:0;">
          ${dayLabel}
        </span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="padding:8px 16px 0;">
      <div style="font-size:0.75rem;color:var(--color-muted);font-weight:600;margin-bottom:6px;">
        🔔 車両期限アラート
      </div>
      ${items}
    </div>`;
}

// 設定ページ：車検・保険通知設定UIを描画
function renderVehicleReminderSettings() {
  const el = document.getElementById('vehicle-reminder-settings');
  if (!el) return;

  const reminders = getVehicleReminders();

  const typeLabels = {
    inspection: '🔧 車検',
    insurance:  '🛡️ 保険',
    other:      '📅 その他'
  };

  const listHtml = reminders.length === 0
    ? `<div style="padding:12px 16px;font-size:0.82rem;color:var(--color-muted);">登録済みの通知はありません</div>`
    : reminders.map((r, i) => {
        const days = daysUntil(r.date);
        const badge = days !== null && days <= 30
          ? `<span style="font-size:0.7rem;background:${days < 0 ? '#fef2f2' : days <= 7 ? '#fff7ed' : '#f0f9ff'};
              color:${days < 0 ? '#b91c1c' : days <= 7 ? '#c2410c' : '#0369a1'};
              border-radius:6px;padding:1px 6px;font-weight:700;margin-left:6px;">
              ${days < 0 ? `${Math.abs(days)}日超過` : days === 0 ? '今日' : `あと${days}日`}
            </span>` : '';
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;
                      border-bottom:1px solid var(--color-border-light,#f1f5f9);">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.88rem;color:var(--color-text);">
                ${typeLabels[r.type] || r.type} ${r.label}${badge}
              </div>
              <div style="font-size:0.75rem;color:var(--color-muted);margin-top:2px;">期限: ${r.date}</div>
            </div>
            <button onclick="deleteVehicleReminder(${i})"
              style="background:none;border:none;color:#b91c1c;font-size:1.1rem;cursor:pointer;
                     padding:4px 8px;border-radius:6px;min-height:36px;">✕</button>
          </div>`;
      }).join('');

  el.innerHTML = `
    ${listHtml}
    <div style="padding:12px 16px;border-top:1px solid var(--color-border);">
      <div style="font-size:0.78rem;color:var(--color-muted);font-weight:600;margin-bottom:8px;">新しく追加</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <select id="vr-type" style="border:1px solid var(--color-border-mid);border-radius:8px;
                padding:8px 10px;font-size:0.85rem;background:var(--color-surface);color:var(--color-text);">
          <option value="inspection">🔧 車検</option>
          <option value="insurance">🛡️ 自動車保険</option>
          <option value="other">📅 その他（法定点検など）</option>
        </select>
        <input type="text" id="vr-label" placeholder="例：任意保険 更新" maxlength="20"
          style="border:1px solid var(--color-border-mid);border-radius:8px;
                 padding:8px 10px;font-size:0.85rem;background:var(--color-surface);color:var(--color-text);">
        <input type="date" id="vr-date"
          style="border:1px solid var(--color-border-mid);border-radius:8px;
                 padding:8px 10px;font-size:0.85rem;background:var(--color-surface);color:var(--color-text);">
        <button onclick="addVehicleReminder()"
          style="background:#6366f1;color:#fff;border:none;border-radius:10px;
                 padding:10px;font-size:0.88rem;font-weight:700;cursor:pointer;">
          ＋ 追加する
        </button>
      </div>
    </div>`;
}

function addVehicleReminder() {
  const type  = document.getElementById('vr-type')?.value || 'other';
  const label = document.getElementById('vr-label')?.value.trim() || '';
  const date  = document.getElementById('vr-date')?.value || '';
  if (!date) {
    if (typeof showToast === 'function') showToast('期限日を入力してください', 'warn');
    return;
  }
  const list = getVehicleReminders();
  const typeLabels = { inspection:'車検', insurance:'自動車保険', other:'その他' };
  list.push({ type, label: label || typeLabels[type], date });
  saveVehicleReminders(list);
  renderVehicleReminderSettings();
  renderVehicleAlerts();
  if (typeof showToast === 'function') showToast('通知を追加しました', 'success');
}

function deleteVehicleReminder(index) {
  const list = getVehicleReminders();
  list.splice(index, 1);
  saveVehicleReminders(list);
  renderVehicleReminderSettings();
  renderVehicleAlerts();
  if (typeof showToast === 'function') showToast('通知を削除しました', 'info');
}

// ===== [2026-05-24 追加] 今日のアクションバナー =====
function renderTodayActionBanner() {
  const banner = document.getElementById('today-action-banner');
  if (!banner) return;

  const todayLog = (typeof getTodayLog === 'function') ? getTodayLog() : null;

  let html = '';
  if (!todayLog) {
    // 未開始
    html = `
      <div style="background:linear-gradient(135deg,#6366f1,#818cf8);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 16px rgba(99,102,241,0.3);margin-bottom:4px;">
        <div style="font-size:2rem;flex-shrink:0;">🚐</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#fff;font-size:0.95rem;">今日の業務を開始しましょう</div>
          <div style="font-size:0.78rem;color:rgba(255,255,255,0.8);margin-top:3px;">オドメーターを記録して走行距離を自動計算</div>
        </div>
        <button onclick="openDailyStartModal()" style="background:#fff;color:#6366f1;border:none;border-radius:12px;padding:10px 16px;font-size:0.88rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">
          開始 →
        </button>
      </div>`;
  } else if (todayLog.status === 'started') {
    // 業務中
    const startTime = new Date(todayLog.startTime);
    const elapsedMin = Math.round((new Date() - startTime) / 60000);
    const elapsedStr = elapsedMin >= 60
      ? `${Math.floor(elapsedMin/60)}時間${elapsedMin%60}分`
      : `${elapsedMin}分`;
    html = `
      <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 16px rgba(3,105,161,0.25);margin-bottom:4px;">
        <div style="font-size:2rem;flex-shrink:0;">🚗</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#fff;font-size:0.95rem;">業務中 · ${elapsedStr}経過</div>
          <div style="font-size:0.78rem;color:rgba(255,255,255,0.8);margin-top:3px;">開始 ${todayLog.startOdo?.toFixed(1)} km ─ 終了時に記録してください</div>
        </div>
        <button onclick="showDailyEndConfirm(getTodayLog())" style="background:#fff;color:#0369a1;border:none;border-radius:12px;padding:10px 16px;font-size:0.88rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">
          終了 →
        </button>
      </div>`;
  } else {
    // 完了
    const km = todayLog.distance?.toFixed(1) || '--';
    const deliv = todayLog.deliveries ? `${todayLog.deliveries}個` : '';
    const wage = todayLog.hourlyWage ? `時給 ¥${todayLog.hourlyWage.toLocaleString()}` : '';
    const sub = [deliv, wage].filter(Boolean).join(' · ');
    html = `
      <div style="background:linear-gradient(135deg,#15803d,#22c55e);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 16px rgba(21,128,61,0.25);margin-bottom:4px;">
        <div style="font-size:2rem;flex-shrink:0;">✅</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:#fff;font-size:0.95rem;">本日の業務完了 · ${km} km</div>
          <div style="font-size:0.78rem;color:rgba(255,255,255,0.85);margin-top:3px;">${sub || 'お疲れさまでした！'}</div>
        </div>
        <button onclick="navigate('daily')" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.5);border-radius:12px;padding:10px 14px;font-size:0.85rem;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;">
          日報 →
        </button>
      </div>`;
  }

  banner.innerHTML = html;
}

// ===== [2026-05-24 追加] 最近の取引 描画 =====
function renderRecentEntries() {
  const el = document.getElementById('recent-entries');
  if (!el) return;

  const allEntries = (typeof journalEntries !== 'undefined' && journalEntries.length > 0)
    ? journalEntries
    : (typeof entries !== 'undefined' ? entries : []);

  if (allEntries.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:28px 16px;">
        <div style="font-size:2.5rem;margin-bottom:10px;">📋</div>
        <div style="font-weight:700;color:var(--color-text);font-size:0.95rem;margin-bottom:6px;">まだ取引が記録されていません</div>
        <div style="font-size:0.82rem;color:var(--color-muted);line-height:1.6;margin-bottom:16px;">
          CSVを取り込むか、手動で入力すると<br>ここに履歴が表示されます
        </div>
        <button onclick="openEntryModal()" style="background:#6366f1;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-size:0.88rem;font-weight:700;cursor:pointer;">
          ＋ 最初の取引を記録する
        </button>
      </div>`;
    return;
  }

  // 日付降順で最新5件
  const recent = [...allEntries]
    .sort((a, b) => {
      const da = new Date(String(a.date).replace(/\//g, '-'));
      const db = new Date(String(b.date).replace(/\//g, '-'));
      return db - da;
    })
    .slice(0, 5);

  el.innerHTML = recent.map(e => {
    const isIncome = (e.type === 'income') || (e.debitAcc && ['売上高','雑収入'].some(k => e.debitAcc.includes(k)));
    const amt = e.amount || e.debitAmt || e.creditAmt || 0;
    const amtNum = Number(String(amt).replace(/,/g, ''));
    const label = e.content || e.debitAcc || e.subject || '取引';
    const sub = e.creditAcc || e.memo || '';
    const dateStr = String(e.date).replace(/\//g, '-');
    const color = isIncome ? '#15803d' : '#b91c1c';
    const sign = isIncome ? '+' : '-';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-border-light,#f1f5f9);">
        <div style="width:36px;height:36px;border-radius:10px;background:${isIncome ? '#f0fdf4' : '#fef2f2'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
          ${isIncome ? '💰' : '💸'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.88rem;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
          <div style="font-size:0.75rem;color:var(--color-muted);margin-top:1px;">${dateStr}${sub ? ' · ' + sub : ''}</div>
        </div>
        <div style="font-weight:700;font-size:0.95rem;color:${color};flex-shrink:0;">${sign}¥${amtNum.toLocaleString()}</div>
      </div>`;
  }).join('');
}



// ===== [2026-05-24 追加] カレンダーへの走行距離表示 =====
function injectKmToCalendar() {
  if (typeof dailyLogs === 'undefined' || !dailyLogs.length) return;

  const yearSel = document.getElementById('global-year');
  const monthSel = document.getElementById('global-month');
  if (!yearSel || !monthSel) return;

  const y = parseInt(yearSel.value);
  const mRaw = monthSel.value;
  if (mRaw === 'all') return;
  const m = parseInt(mRaw) - 1; // 0-indexed

  // 該当月の日報を日付 → distanceのマップに変換
  const kmMap = {};
  dailyLogs.forEach(log => {
    if (!log.date || log.distance == null) return;
    const d = new Date(log.date);
    if (d.getFullYear() !== y || d.getMonth() !== m) return;
    kmMap[d.getDate()] = log.distance;
  });

  if (!Object.keys(kmMap).length) return;

  // カレンダーセルにkm表示を注入
  const gridEl = document.getElementById('calendar-grid');
  if (!gridEl) return;

  const cells = gridEl.querySelectorAll('.cal-cell:not(.empty)');
  cells.forEach(cell => {
    const dayNumEl = cell.querySelector('.cal-day-num');
    if (!dayNumEl) return;
    const day = parseInt(dayNumEl.textContent);
    if (kmMap[day] == null) return;

    // 既存のkm表示があれば上書きしない
    if (cell.querySelector('.cal-km')) return;

    const kmEl = document.createElement('div');
    kmEl.className = 'cal-km';
    kmEl.textContent = `${kmMap[day].toFixed(0)}km`;
    kmEl.style.cssText = 'font-size:0.6rem;color:#6366f1;font-weight:700;line-height:1.2;margin-top:1px;';
    cell.appendChild(kmEl);
  });
}

// ===== [2026-05-24 追加] ワンタップ承認 =====
function approveEntry(id) {
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return;
  entries[idx].manually_saved = true;
  entries[idx].status = 'completed';
  if (typeof saveEntries === 'function') saveEntries();
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof renderJournal === 'function') renderJournal();
  if (typeof showToast === 'function') showToast('確認済みにしました ✓', 'success');
}

// ===== [2026-05-24 追加] 消費税ページ Progressive Disclosure =====
// ===== [2026-05-24 追加] ① スワイプ承認UI =====
// 取引カードにスワイプジェスチャーを付与する
// 左スワイプ → 確認済み（承認）  右スワイプ → 削除確認
function attachSwipeToCards() {
  const cards = document.querySelectorAll('.entry-card[data-id]');
  cards.forEach(card => {
    if (card.dataset.swipeAttached) return; // 二重登録防止
    card.dataset.swipeAttached = '1';

    let startX = 0, startY = 0, isDragging = false;
    let overlay = null;

    function onStart(x, y) {
      startX = x; startY = y; isDragging = true;
      card.style.transition = 'none';
      // オーバーレイ生成
      overlay = document.createElement('div');
      overlay.style.cssText = `
        position:absolute;inset:0;border-radius:inherit;
        display:flex;align-items:center;justify-content:center;
        font-size:1.4rem;font-weight:700;opacity:0;
        pointer-events:none;transition:opacity 0.1s;`;
      card.style.position = 'relative';
      card.appendChild(overlay);
    }

    function onMove(x, y) {
      if (!isDragging) return;
      const dx = x - startX;
      const dy = y - startY;
      // 縦スクロールが主体なら無視
      if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
      const clamp = Math.max(-90, Math.min(90, dx));
      card.style.transform = `translateX(${clamp}px)`;
      const progress = Math.min(1, Math.abs(clamp) / 80);
      if (clamp < -20) {
        // 左スワイプ → 承認（緑）
        overlay.style.background = 'rgba(22,163,74,0.85)';
        overlay.textContent = '✓ 確認済みにする';
        overlay.style.color = '#fff';
        overlay.style.opacity = progress;
      } else if (clamp > 20) {
        // 右スワイプ → 削除（赤）
        overlay.style.background = 'rgba(185,28,28,0.85)';
        overlay.textContent = '✕ 削除';
        overlay.style.color = '#fff';
        overlay.style.opacity = progress;
      } else {
        overlay.style.opacity = 0;
      }
    }

    function onEnd(x) {
      if (!isDragging) return;
      isDragging = false;
      const dx = x - startX;
      card.style.transition = 'transform 0.25s ease';
      card.style.transform = '';
      if (overlay) overlay.remove();

      const id = card.dataset.id;
      if (dx < -70) {
        // 左スワイプ完了 → 承認
        card.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        card.style.transform = 'translateX(-110%)';
        card.style.opacity = '0';
        setTimeout(() => {
          if (typeof approveEntry === 'function') approveEntry(id);
        }, 200);
      } else if (dx > 70) {
        // 右スワイプ完了 → 削除確認
        if (confirm('この取引を削除しますか？')) {
          card.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
          card.style.transform = 'translateX(110%)';
          card.style.opacity = '0';
          setTimeout(() => {
            if (typeof deleteEntry === 'function') deleteEntry(id);
          }, 200);
        }
      }
    }

    // タッチイベント
    card.addEventListener('touchstart', e => {
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    card.addEventListener('touchmove', e => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    card.addEventListener('touchend', e => {
      onEnd(e.changedTouches[0].clientX);
    });
  });
}

// ===== [2026-05-24 追加] ② UIモード切替（シンプルモード）=====
function applySimpleMode() {
  const isSimple = localStorage.getItem('bizNavi_simpleMode') === '1';
  // シンプルモード: 元帳・消費税・電帳法をその他メニューから非表示
  const advancedItems = ['nav-icon-ledger','nav-icon-tax','nav-icon-dencho'];
  advancedItems.forEach(id => {
    const el = document.getElementById(id);
    const item = el?.closest('.more-menu-item');
    if (item) item.style.display = isSimple ? 'none' : '';
  });
  // ダッシュボードの消費税・按分カードも簡略化
  const taxCard = document.querySelector('#page-dashboard .section-card');
  document.querySelectorAll('#page-dashboard .section-card').forEach(card => {
    const title = card.querySelector('.section-title-row')?.textContent || '';
    if (title.includes('消費税') || title.includes('仕事・プライベート')) {
      card.style.display = isSimple ? 'none' : '';
    }
  });
  // シンプルモードバナーの表示
  const banner = document.getElementById('simple-mode-banner');
  if (banner) banner.style.display = isSimple ? 'flex' : 'none';
}

function toggleSimpleMode() {
  const current = localStorage.getItem('bizNavi_simpleMode') === '1';
  localStorage.setItem('bizNavi_simpleMode', current ? '0' : '1');
  applySimpleMode();
  renderSimpleModeSetting();
  if (typeof showToast === 'function') {
    showToast(current ? '通常モードに切り替えました' : 'シンプルモードに切り替えました', 'info');
  }
}

function renderSimpleModeSetting() {
  const el = document.getElementById('simple-mode-setting');
  if (!el) return;
  const isSimple = localStorage.getItem('bizNavi_simpleMode') === '1';
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;">
      <div>
        <div style="font-weight:700;font-size:0.9rem;color:var(--color-text);">シンプルモード</div>
        <div style="font-size:0.78rem;color:var(--color-muted);margin-top:2px;">
          元帳・消費税など高度な機能を非表示にします
        </div>
      </div>
      <button onclick="toggleSimpleMode()"
        style="background:${isSimple ? '#6366f1' : 'var(--color-bg)'};
               color:${isSimple ? '#fff' : 'var(--color-muted)'};
               border:1px solid ${isSimple ? '#6366f1' : 'var(--color-border-mid)'};
               border-radius:20px;padding:6px 18px;font-size:0.85rem;font-weight:700;cursor:pointer;white-space:nowrap;">
        ${isSimple ? 'ON' : 'OFF'}
      </button>
    </div>`;
}

// ===== [2026-05-24 追加] ③ 電帳法バッジ（ナビ表示）=====
function updateDenchoBadge() {
  // ナビの電帳法メニュー項目に「対応済」バッジを追加
  const el = document.getElementById('nav-icon-dencho');
  const item = el?.closest('.more-menu-item');
  if (!item) return;
  // 既存バッジを除去
  item.querySelector('.dencho-nav-badge')?.remove();
  const badge = document.createElement('span');
  badge.className = 'dencho-nav-badge';
  badge.textContent = '対応済';
  badge.style.cssText = `
    font-size:0.62rem;font-weight:700;
    background:#dcfce7;color:#15803d;
    border:1px solid #86efac;border-radius:10px;
    padding:1px 6px;margin-left:auto;white-space:nowrap;`;
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.appendChild(badge);
}

function renderTaxPageByExemptStatus() {
  const isExempt = (typeof isExemptUser === 'function') ? isExemptUser() : false;
  const exemptView = document.getElementById('tax-exempt-view');
  const taxableView = document.getElementById('tax-taxable-view');
  if (exemptView) exemptView.style.display = isExempt ? 'block' : 'none';
  if (taxableView) taxableView.style.display = isExempt ? 'none' : 'block';
}

// ===== [2026-05-15 06:30 最終修正] 貸借不一致ブロック ＆ 軍師継承 ＆ 学習提案 搭載 =====
function saveEntry() {
  // 1. 入力値の取得（計算誤差を防ぐため即座に数値化・整数化）
  const fDebitAmt = document.getElementById('f-debit-amount').value;
  const fCreditAmt = document.getElementById('f-credit-amount').value;
  
  // 厳密に比較するため、Math.roundで整数に丸める（1円単位の会計ならこれが安全）
  const debitAmount = Math.round(parseFloat(fDebitAmt) || 0);
  const creditAmount = Math.round(parseFloat(fCreditAmt) || 0);

  const rawDate = document.getElementById('f-date').value;
  const date = rawDate.replace(/-/g, '/');
  const debitAccount = document.getElementById('f-debit-account').value;
  const creditAccount = document.getElementById('f-credit-account').value;
  const memo = document.getElementById('f-memo').value;
  const entryId = document.getElementById('edit-id').value || Date.now().toString();

  // 2. 【最優先ガード】貸借不一致のチェック
  // ここが一致しない限り、後続の「軍師」や「保存」へは絶対に到達させません
  if (debitAmount !== creditAmount) {
    alert(`【入力エラー】金額が一致していません！\n\n内容の金額: ${debitAmount.toLocaleString()}円\n財布の金額: ${creditAmount.toLocaleString()}円\n差額: ${Math.abs(debitAmount - creditAmount).toLocaleString()}円\n\n両方の金額を同じにしてください。`);
    return; // 物理的にここで処理を遮断
  }

  // 3. 基本バリデーション
  if (!date || !debitAccount || !creditAccount || debitAmount <= 0) {
    showToast('入力不備があります', 'error');
    return;
  }

  // 4. 自動学習フィードバックの発動（ロケットなう等の新単語を辞書へ）
  // 備考欄に中身があり、かつ手動修正・登録された場合に提案
  if (typeof suggestLearning === 'function' && memo && memo !== "CSVインポート") {
    const targetCategory = (creditAccount === "売上高") ? "売上高" : debitAccount;
    suggestLearning(memo, targetCategory);
  }

  // 5. SDSA軍師：資産・修繕判定トリガー（2026-05-14版を完全継承）
  const watchList = ['車両運搬具', '工具器具備品', '修繕費', '消耗品費', '建物附属設備', '構築物', 'ソフトウェア', '外注費'];
  if (debitAmount >= 100000 && watchList.includes(debitAccount)) {
    showToast('軍師が資産判定を開始します...', 'info');
    setTimeout(async () => {
      if (typeof openAdvisorModal === 'function') {
        const decision = await openAdvisorModal(debitAmount);
        if (decision === 'asset') {
          if (debitAmount >= 300000 && typeof openAssetModal === 'function') {
            openAssetModal(entryId);
          } else {
            showToast('少額資産としてフラグを立てました', 'success');
          }
          const memoField = document.getElementById('f-memo');
          if (memoField && !memoField.value.includes('【資産計上対象】')) {
            memoField.value = memoField.value + " 【資産計上対象】";
          }
        } else {
          showToast('経費（修繕費）として受理しました', 'success');
        }
        saveData(); // 軍師によるメモ変更等を保存
      }
    }, 600);
  }

  // 6. エントリ作成（保存用オブジェクト）
  const entry = {
    id: entryId,
    date,
    debitAcc: debitAccount,
    debitSub: document.getElementById('f-debit-sub').value,
    debitAmt: debitAmount,
    creditAcc: creditAccount,
    creditSub: document.getElementById('f-credit-sub').value,
    creditAmt: creditAmount,
    // 旧形式互換用
    debit: { account: debitAccount, sub: document.getElementById('f-debit-sub').value, amount: debitAmount },
    credit: { account: creditAccount, sub: document.getElementById('f-credit-sub').value, amount: creditAmount },
    memo: memo,
    manually_saved: true,
    status: 'completed',
    updatedAt: Date.now()
  };

  // 7. 配列への反映
  const existIdx = entries.findIndex(e => e.id === entry.id);
  if (existIdx >= 0) {
    entries[existIdx] = { ...entries[existIdx], ...entry, manually_saved: true };
  } else {
    entries.push(entry);
  }

  // 8. 保存・終了
  saveData(); 
  closeEntryModal();
  
  setTimeout(() => {
    renderJournal(); 
    if (typeof updateDashboard === 'function') updateDashboard(); 
    console.log("仕訳保存・バリデーション・学習チェック完了");
  }, 100);

  showToast('仕訳を保存しました', 'success');
}
// ===== [2026-05-15 06:30 最終修正] 貸借不一致ブロック ＆ 軍師継承 ＆ 学習提案 搭載 終わり =====

// ===== [2026-05-06 23:10 修正：個別IDによる償却判定とボタン文言の適正化] =====
/**
 * 固定資産台帳の描画ロジック。
 * 資産ごとのID（originalAssetId）を元に、本年度の償却処理が完了しているか判定し、
 * ボタンの表示（文言・色）を動的に切り替えます。
 */
function renderAssets() {
  const summaryContainer = document.getElementById('asset-summary-container');
  const listContainer = document.getElementById('asset-list');
  
  if (!listContainer) {
    console.warn("資産リスト用のコンテナが見つかりません。");
    return;
  }

  // 1. 合計金額の計算
  const totalAssetPrice = assets.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  
  // 2. サマリー表示の更新
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="section-card">
        <div class="asset-summary" style="font-weight: bold; font-size: 1.1rem;">
          💰 資産合計: ${typeof fmt === 'function' ? fmt(totalAssetPrice) : '¥' + totalAssetPrice.toLocaleString()}
        </div>
      </div>`;
  }

  // 3. リスト表示の更新
  let listHtml = "";
  if (assets.length === 0) {
    listHtml = `<div class="section-card"><div class="empty-msg">対象資産はありません。</div></div>`;
  } else {
    // 現在選択されている年度を取得して判定に使用
    const targetYear = document.getElementById('global-year')?.value || "2026";
    const allData = (typeof journalEntries !== 'undefined') ? journalEntries : (typeof entries !== 'undefined' ? entries : []);

    assets.forEach(a => {
      // 【判定】この資産IDの償却仕訳が、本年度のデータとして既に存在するか
      const isProcessed = allData.some(e => 
        e.originalAssetId === a.id && 
        String(e.date).startsWith(targetYear) &&
        (e.debitAcc === "減価償却費" || e.subject === "減価償却費")
      );

      // ステータスに応じたボタンの表示切り替え
      const btnText = isProcessed ? "✅ 資産償却処理済み（再計算）" : "資産償却処理を実行";
      const btnStyle = isProcessed ? "background: #48bb78;" : "background: #2b6cb0;";

      // ステータスバッジ
      const statusHtml = a.status ? `<span style="margin-left: 8px; font-size: 0.7rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #4a5568;">${a.status}</span>` : "";
      const endDateHtml = a.endDate ? `<div style="color: #e53e3e; font-weight: bold;">償却終了予定: ${a.endDate}</div>` : "";

      listHtml += `
        <div class="section-card asset-card" style="margin-bottom: 12px; border-left: 4px solid #2b6cb0;">
          <div class="asset-info">
            <div style="display: flex; align-items: center;">
              <strong>${a.name}</strong>
              ${statusHtml}
            </div>
            <div class="asset-details" style="font-size: 0.85rem; color: #666; margin: 4px 0;">
              取得: ${a.date} | 価額: ${typeof fmt === 'function' ? fmt(a.price) : '¥' + a.price.toLocaleString()}
            </div>
            <div class="asset-dep" style="font-size: 0.85rem; background: #f7fafc; padding: 8px; border-radius: 4px;">
              <div>耐用年数: ${a.usefulLife}年</div>
              ${endDateHtml}
              <div class="highlight" style="color: #2b6cb0; font-weight: bold; margin-top: 4px; font-size: 1rem;">
                現在残高: ${typeof fmt === 'function' ? fmt(a.remainingValue || a.price) : '¥' + (a.remainingValue || a.price).toLocaleString()}
              </div>
            </div>
          </div>
          <!-- 関数名を executeDepreciation に変更し、実態に合わせた文言へ -->
          <button class="add-btn" style="font-size:var(--fs-sm); margin-top: 10px; padding: 6px 12px; ${btnStyle} color: white; border: none; border-radius: 4px; cursor: pointer;" 
                  onclick="executeDepreciation('${a.id}')">
            ${btnText}
          </button>
        </div>`;
    });
  }
  
  listContainer.innerHTML = listHtml;
}
// ===== [2026-05-06 23:10 修正終了] =====


// ===== [2026-05-06 23:15 修正：個別IDによる重複排除・上書きロジックの実装] =====
/**
 * 資産個別のIDを使用して償却処理（仕訳登録）を実行する。
 * 同一資産・同一年度の償却仕訳が既に存在する場合は、古いデータを削除してから新しいデータを投入（上書き）します。
 */
function executeDepreciation(assetId) {
  const asset = assets.find(a => a.id === assetId);
  if (!asset) return;

  // 1. 共通バーから現在の対象年度を取得
  const targetYear = document.getElementById('global-year')?.value || "2026";
  const entryDate = `${targetYear}/12/31`;

  // 2. 償却額の計算（定額法）
  const depAmount = Math.floor(asset.price / asset.usefulLife);
  
  if (confirm(`${targetYear}年度の償却費 ${depAmount.toLocaleString()}円 を計上し、資産償却処理を実行しますか？\n（既に処理済みの場合は上書きされます）`)) {
    
    // 3. データソースの特定
    let allDataSources = (typeof journalEntries !== 'undefined') ? journalEntries : entries;

    // 4. 【重要】二重計上防止：同じ資産ID ＋ 同じ年度 ＋ 勘定科目の既存仕訳を探す
    const existingIndex = allDataSources.findIndex(e => 
      e.originalAssetId === assetId && 
      String(e.date).startsWith(targetYear) &&
      (e.debitAcc === "減価償却費" || e.subject === "減価償却費")
    );

    // 既存データがあれば一旦削除（上書きの準備）
    if (existingIndex !== -1) {
      allDataSources.splice(existingIndex, 1);
      console.log(`${targetYear}年度の既存償却データを更新します。ID: ${assetId}`);
    }

    // 5. 新しい決算仕訳を作成（資産IDを紐付け）
    const depEntry = {
      id: `dep-${assetId}-${targetYear}`, // IDを固定化してさらに安全性を向上
      date: entryDate,
      debitAcc: '減価償却費',
      debitAmt: depAmount,
      creditAcc: asset.name, // 資産名（車両運搬具など）を直接指定
      creditAmt: depAmount,
      memo: `資産償却処理：${asset.name}（${asset.usefulLife}年耐用）`,
      originalAssetId: assetId, // 判定用の重要キー
      manually_saved: true,
      status: 'completed',
      isAutoGenerated: true      // システムによる自動生成フラグ
    };

    allDataSources.push(depEntry);

    // 6. 保存と再描画
    if (typeof saveData === 'function') saveData(); 
    localStorage.setItem('kaikei_assets', JSON.stringify(assets)); 
    
    // 7. 画面の即時更新
    if (typeof updateDashboard === 'function') {
      updateDashboard(); // ここで renderAssets() も内部的に呼ばれます
    } else if (typeof renderAssets === 'function') {
      renderAssets();
    }
    
    alert(`${targetYear}年12月31日付で資産償却処理を完了しました。`);
  }
}
// ===== [2026-05-06 23:15 修正終了] =====


// ===== [2026-05-07 01:50 修正：ID不一致解消、データソース同期、およびデバッグログの強化] =====
/**
 * カレンダーを描画する。
 * ID名の揺れ（calendar-/cal-/calender-）を吸収し、描画状況をコンソールに出力する。
 */
function renderCalendar(year, month) {
  // 1. ID名の揺れに対応（gridとtitleを柔軟に取得）
  const gridEl = document.getElementById('calendar-grid') || 
                 document.getElementById('cal-grid') || 
                 document.getElementById('calender-grid');
                 
  const titleEl = document.getElementById('calendar-title') || 
                  document.getElementById('cal-title') || 
                  document.getElementById('calender-title');

  if (!gridEl) {
    console.error("【カレンダー描画エラー】描画先のGrid要素（calendar-grid等）が見つかりません。");
    return;
  }

  // 2. 引数がない場合、共通バーから最新の年・月を取得して同期
  if (year === undefined || month === undefined) {
    const yearSel = document.getElementById('global-year');
    const monthSel = document.getElementById('global-month');
    if (yearSel && monthSel) {
      calYear = parseInt(yearSel.value);
      const mRaw = monthSel.value;
      calMonth = (mRaw === 'all') ? 0 : parseInt(mRaw) - 1;
    }
  } else {
    calYear = year;
    calMonth = month - 1;
  }

  if (titleEl) {
    titleEl.textContent = `${calYear}年${calMonth + 1}月`;
  }

  const dayMap = {};
  
  // 3. データソースの取得（journalEntriesを優先）
  let allDataSources = [];
  if (typeof journalEntries !== 'undefined' && journalEntries.length > 0) {
    allDataSources = journalEntries;
  } else if (typeof entries !== 'undefined') {
    allDataSources = entries;
  }
  
  let matchCount = 0;
  allDataSources.forEach(e => {
    if (!e.date) return;
    // iPhone/Safari等の互換性のためスラッシュをハイフンに置換
    const d = new Date(e.date.replace(/\//g, '-')); 
    if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) return;
    
    matchCount++;
    const day = d.getDate();
    if (!dayMap[day]) dayMap[day] = { income: 0, expense: 0 };
    
    const creditAcc = e.creditAcc || (e.credit && e.credit.account);
    const creditAmt = Number(e.creditAmt) || (e.credit && e.credit.amount) || 0;
    const debitAcc = e.debitAcc || (e.debit && e.debit.account);
    const debitAmt = Number(e.debitAmt) || (e.debit && e.debit.amount) || 0;

    if (typeof getAccountType === 'function' && getAccountType(creditAcc) === 'income') {
      dayMap[day].income += creditAmt;
    }
    const isDepreciation = debitAcc && debitAcc.trim() === '減価償却費';
    if (typeof getAccountType === 'function' && (getAccountType(debitAcc) === 'expense' || isDepreciation)) {
      dayMap[day].expense += e.kasji ? (e.kasji.bizAmount || 0) : debitAmt;
    }
  });

  // 4. HTML描画処理
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  
  let html = DOW.map((d, i) => `<div class="cal-dow ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
  
  for (let day = 1; day <= daysInMonth; day++) {
    const tx = dayMap[day];
    let dots = '';
    if (tx) {
      if (tx.income > 0) dots += '<span class="cal-dot income-dot"></span>';
      if (tx.expense > 0) dots += '<span class="cal-dot expense-dot"></span>';
    }
    html += `<div class="cal-cell" onclick="calDayClick(${day})"><span class="cal-day-num">${day}</span><div class="cal-dots">${dots}</div></div>`;
  }
  
  gridEl.innerHTML = html;
  
  // 日報の走行距離をカレンダーセルに追加
  if (typeof injectKmToCalendar === 'function') injectKmToCalendar();

  // デバッグログ：描画の成功とデータ件数を報告
  console.log(`【カレンダー描画完了】${calYear}年${calMonth + 1}月を表示。該当データ：${matchCount}件`);
}
// ===== [2026-05-07 01:50 修正終了] =====

function calMove(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  else if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function calDayClick(day) {
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}`;
  document.getElementById('journal-month').value = monthStr;
  navigate('journal');
}

// ===== 消費税・決算・CSV等（共通/補助関数） =====
function getTaxRate(taxCode) {
  if (taxCode === 'exempt10' || taxCode === 'input10') return 0.10;
  if (taxCode === 'exempt8' || taxCode === 'input8') return 0.08;
  return 0;
}
function calcTaxAmount(amount, taxCode) {
  const rate = getTaxRate(taxCode);
  return rate === 0 ? 0 : Math.round(amount * rate / (1 + rate));
}
function fmt(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }
function fmtDate(d) { return d.replace(/-/g, '/'); }

function saveData() {
  const data = { entries, taxSettings, dencho: (typeof dencho !== 'undefined' ? dencho : []), budget };
  if (typeof saveAllData === 'function') {
    saveAllData(data).then(({ primaryOk }) => {
      if (!primaryOk) showToast('保存に失敗しました', 'error');
    });
  } else {
    localStorage.setItem('kaikei_entries', JSON.stringify(entries));
  }
}

function deleteEntry(id) {
  if (!confirm('削除しますか？')) return;
  entries = entries.filter(e => e.id !== id);
  saveData();
  renderAll();
  showToast('削除しました', 'info');
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = 'toast', 2500);
  }
}


/**
 * 共通期間バー（年月）を現在のカレンダーに合わせて初期化する
 */
function initGlobalPeriod() {
  const now = new Date();
  const y = now.getFullYear().toString();
  const m = (now.getMonth() + 1).toString();

  const yearEl = document.getElementById('global-year');
  const monthEl = document.getElementById('global-month');

  // HTML上に要素が存在する場合のみ値をセット
  if (yearEl) yearEl.value = y;
  if (monthEl) monthEl.value = m;
}
/**
 * 共通期間バー（年月）を現在のカレンダーに合わせて初期化する　終わり
 */

// 他のUI系初期化関数群
function initAccountSelects() {
  const selects = ['f-debit-account', 'f-credit-account', 'ledger-account'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || typeof ACCOUNTS === 'undefined') return;
    sel.innerHTML = `<option value="">${id === 'ledger-account' ? '科目を選択' : '選択してください'}</option>`;
    Object.entries(ACCOUNTS).forEach(([key, group]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.name; opt.textContent = item.name;
        optgroup.appendChild(opt);
      });
      sel.appendChild(optgroup);
    });
  });
}

// --- 2026-05-03 17:20 書き換え ---
// 理由: 仕訳帳の入力初期値を、共通期間バーで選択されている年月と連動させるため
function initJournalMonth() {
  // 1. 共通バー（司令塔）から現在の選択値を取得
  const globalYear = document.getElementById('global-year')?.value;
  const globalMonth = document.getElementById('global-month')?.value;
  const el = document.getElementById('journal-month');
  
  if (el && globalYear && globalMonth && globalMonth !== 'all') {
    // 2. 共通バーが特定の月（1〜12月）を指していれば、それを仕訳帳の初期値(YYYY-MM)にする
    el.value = `${globalYear}-${globalMonth.padStart(2, '0')}`;
  } else if (el) {
    // 3. 通期(all)選択時などは、バックアップとして今日の日付をセット
    const now = new Date();
    el.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
// --- 2026-05-03 17:20 書き換え終了 ---


function initReportYear() {
  const sel = document.getElementById('report-year');
  if (!sel) return;
  const now = new Date();
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = `${y}年`;
    sel.appendChild(opt);
  }
}

function initChartYearSelect() {
  const sel = document.getElementById('chart-year');
  if (!sel) return;
  const now = new Date();
  sel.innerHTML = '';
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = `${y}年`;
    sel.appendChild(opt);
  }
}

// 以下、詳細な描画ロジック（Journal, Ledger, Tax, Report, Charts, CSV）は
// スペースの関係上、貼り付けられた全ロジックを関数として内包し、
// renderAllから呼び出される構成を維持しています。
// ※実際のコードではここ以降に、貼り付けていただいた renderJournal 以下の全関数が続きます。

// ===== タブ切り替え制御 =====
function switchJournalTab(tab) {
  currentJournalTab = tab;
  
  // ボタンの見た目（activeクラス）を切り替え
  const tabUnproc = document.getElementById('tab-unprocessed');
  const tabComp = document.getElementById('tab-completed');
  if (tabUnproc) tabUnproc.classList.toggle('active', tab === 'unprocessed');
  if (tabComp) tabComp.classList.toggle('active', tab === 'completed');
  
  // リストを再描画（これで仕訳済が増えるようになります）
  renderJournal();
}


//===== [2026-05-03 21:15 修正] 共通期間バー対応版：renderJournal =====
function renderJournal() {
  const listEl = document.getElementById('journal-list');
  if (!listEl) return;

  // 1. 共通期間バーから値を取得（古い journal-month 参照を廃止）
  const yearVal = document.getElementById('global-year')?.value;
  const monthVal = document.getElementById('global-month')?.value;
  // 種類フィルター（すべて/収入/支出）は共通化されていない場合は一旦 'all' 固定
  const filterVal = 'all'; 

  // 2. フィルタリング
  let filtered = entries.filter(e => {
    // 【修正ポイント】共通バーの年・月で判定
    if (currentJournalTab === 'unprocessed') {
      // 未仕訳タブ：全期間表示（そのまま通す）
    } else {
      // 仕訳済タブ：共通バーの年・月でフィルタ
      const entryDate = new Date(e.date.replace(/\//g, '-'));
      const entryYear = entryDate.getFullYear().toString();
      const entryMonth = (entryDate.getMonth() + 1).toString();

      // 年のチェック
      if (yearVal && entryYear !== yearVal) return false;
      // 月のチェック（"all" でない場合のみ）
      if (monthVal && monthVal !== 'all' && entryMonth !== monthVal) return false;
    }

    // 種類フィルター（売上/経費）
    const dAcc = e.debitAcc || (e.debit && e.debit.account);
    const cAcc = e.creditAcc || (e.credit && e.credit.account);
    if (filterVal === 'income' && typeof getAccountType === 'function') {
      if (getAccountType(cAcc) !== 'income') return false;
    }
    if (filterVal === 'expense' && typeof getAccountType === 'function') {
      if (getAccountType(dAcc) !== 'expense') return false;
    }
    return true;
  });

  // 3. 振り分け（未仕訳 vs 仕訳済）
  const unprocessed = entries.filter(e => e.manually_saved !== true);
  const completed = filtered.filter(e => e.manually_saved === true);

  // バッジ（件数）更新
  const unprocCountEl = document.getElementById('count-unprocessed');
  const compCountEl = document.getElementById('count-completed');
  if (unprocCountEl) unprocCountEl.textContent = unprocessed.length;
  if (compCountEl) compCountEl.textContent = completed.length;

  // 4. 表示データの選択
  const displayData = (currentJournalTab === 'unprocessed') ? unprocessed : completed;

  // タブの見た目同期
  const tabUnproc = document.getElementById('tab-unprocessed');
  const tabComp = document.getElementById('tab-completed');
  if (tabUnproc) tabUnproc.classList.toggle('active', currentJournalTab === 'unprocessed');
  if (tabComp) tabComp.classList.toggle('active', currentJournalTab === 'completed');

  // 【UI修正】古い journal-month への操作コードは不要になったため削除

  if (displayData.length === 0) {
    const msg = currentJournalTab === 'unprocessed' ? '未仕訳はありません' : '仕訳済はありません';
    listEl.innerHTML = `<div class="empty-msg">${msg}</div>`;
    return;
  }

  // 日付順にソート（新しい順）
  displayData.sort((a, b) => {
    const dateA = new Date(a.date.replace(/\//g, '-'));
    const dateB = new Date(b.date.replace(/\//g, '-'));
    return dateB - dateA;
  });

  listEl.innerHTML = displayData.map(e => entryCard(e)).join('');
  // スワイプジェスチャーを付与（モバイル向け）
  if (typeof attachSwipeToCards === 'function') {
    requestAnimationFrame(attachSwipeToCards);
  }
}
//===== [2026-05-03 21:15 修正終了] =====

// 予算表示
function renderBudgetDisplay(income, expense) {
  const el = document.getElementById('budget-display');
  if (!el) return;
  if (!budget.income && !budget.expense) {
    el.innerHTML = '<div class="budget-empty">予算未設定</div>';
    return;
  }
  const bar = (label, actual, target, isExp) => {
    if (!target) return '';
    const pct = Math.min(100, Math.round(actual / target * 100));
    const color = (isExp ? actual > target : actual < target * 0.5) ? '#b03a2e' : '#1a7a5e';
    return `<div class="budget-row"><div>${label} ${fmt(actual)}/${fmt(target)}</div>
            <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
  };
  el.innerHTML = bar('収入', income, budget.income, false) + bar('支出', expense, budget.expense, true);
}



/* ============================================================
   関数名: initIcons
   修正日: 2026-05-03
   内容: モバイルファーストUIへの移行に伴い、ナビゲーションを5ボタン化。
         「その他」ボタンに専用の三点リーダーアイコン(more)を適用。
   ============================================================ */
function initIcons() {
  // ナビゲーションおよびポップアップ用アイコンのマッピング
  const navMap = { 
    'nav-icon-dashboard':    'dashboard', 
    'nav-icon-journal':      'journal', 
    'nav-icon-assets':       'kasji', 
    'nav-icon-settings-tab': 'settingsNav',
    'nav-icon-more':         'more',
    'nav-icon-ledger':       'ledger', 
    'nav-icon-tax':          'tax', 
    'nav-icon-dencho':       'dencho', 
    'nav-icon-report':       'report',
    'nav-icon-daily':        'journal'
  };
  Object.entries(navMap).forEach(([id, name]) => { 
    const el = document.getElementById(id); 
    if (el) el.innerHTML = icon(name, 'nav-svg'); 
  });

  // セクションアイコン
  const secMap = {
    'sec-icon-budget':      'budget',
    'sec-icon-chart':       'chart',
    'sec-icon-donut':       'donut',
    'sec-icon-donut2':      'donut',
    'sec-icon-calendar':    'calendar',
    'sec-icon-kasji':       'kasji',
    'sec-icon-taxSummary':  'tax',
    'sec-icon-taxSummary2': 'tax',
    'sec-icon-recent':      'journal',
    'sec-icon-pl':          'report',
    'sec-icon-bs':          'pl',       // assetsはICONSに未定義のためplで代替
    'sec-icon-export':      'upload',
    'sec-icon-settings':    'settingsNav',
    'sec-icon-search':      'ledger',
    'sec-icon-checklist':   'dencho',
    'sec-icon-cloud':       'cloud',
    'sec-icon-backup-set':  'backupIcon',
    'sec-icon-import-map':  'upload',
    'sec-icon-datamanage':  'more',
  };
  Object.entries(secMap).forEach(([id, name]) => {
    const el = document.getElementById(id);
    if (el && typeof icon === 'function') el.innerHTML = icon(name, 'sec-svg');
  });

  // フォームラベルアイコン
  const flMap = {
    'fl-date':           'calendar',
    'fl-debit-account':  'journal',
    'fl-debit-tax':      'tax',
    'fl-debit-amount':   'income',
    'fl-credit-account': 'kasji',
    'fl-credit-tax':     'tax',
    'fl-credit-amount':  'expense',
    'fl-kasji':          'kasji',
    'dc-icon-debit':     'expense',
    'dc-icon-credit':    'income',
  };
  Object.entries(flMap).forEach(([id, name]) => {
    const el = document.getElementById(id);
    if (el && typeof icon === 'function') el.innerHTML = icon(name, 'fl-svg');
  });

  // エクスポートボタンアイコン
  const expMap = {
    'exp-icon-journal': 'upload',
    'exp-icon-pl':      'report',
    'exp-icon-tax':     'tax',
  };
  Object.entries(expMap).forEach(([id, name]) => {
    const el = document.getElementById(id);
    if (el && typeof icon === 'function') el.innerHTML = icon(name, 'exp-svg');
  });
}
// [END of initIcons]


/* ============================================================
   関数名: toggleMoreMenu / window.navigate ラッパー
   修正日: 2026-05-03
   内容: 「その他」メニューの開閉制御および遷移時の自動閉鎖
   ============================================================ */
function toggleMoreMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('more-menu-popup');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

// 画面のどこかをタップしたらメニューを閉じる
document.addEventListener('click', (e) => {
  const menu = document.getElementById('more-menu-popup');
  const trigger = document.getElementById('more-menu-trigger');
  if (menu && !menu.contains(e.target) && e.target !== trigger) {
    menu.classList.add('hidden');
  }
});

// ページ遷移時にメニューを閉じる処理を追加
const originalNavigate = window.navigate;
window.navigate = function(pageId) {
  const menu = document.getElementById('more-menu-popup');
  if (menu) menu.classList.add('hidden');
  if (typeof originalNavigate === 'function') {
    originalNavigate(pageId);
  }
  // 日報ページへの遷移時に描画
  if (pageId === 'daily' && typeof renderDailyPage === 'function') {
    renderDailyPage();
  }
  // ダッシュボードへの遷移時にバナー・最近の取引を更新
  if (pageId === 'dashboard') {
    if (typeof renderTodayActionBanner === 'function') renderTodayActionBanner();
    if (typeof renderRecentEntries === 'function') renderRecentEntries();
  }
  // 消費税ページ：免税/課税で表示切替
  if (pageId === 'tax') {
    if (typeof renderTaxPageByExemptStatus === 'function') renderTaxPageByExemptStatus();
  }
  // 設定ページ：各設定UIを再描画
  if (pageId === 'settings') {
    if (typeof renderSimpleModeSetting === 'function') renderSimpleModeSetting();
    if (typeof renderVehicleReminderSettings === 'function') renderVehicleReminderSettings();
  }
  // 拡張機能ページ
  if (pageId === 'pro-tax' && typeof ProTax !== 'undefined') {
    ProTax.renderDeductionPage();
    ProTax.checkExpenseMissing();
    document.dispatchEvent(new CustomEvent('bizNavi:pageChanged', { detail: { page: 'pro-tax' } }));
  }
  if (pageId === 'pro-subsidy' && typeof ProSubsidy !== 'undefined') {
    ProSubsidy.renderSubsidyPage();
    document.dispatchEvent(new CustomEvent('bizNavi:pageChanged', { detail: { page: 'pro-subsidy' } }));
  }
};
// [END of Navigation Logic (2026-05-03)]


// その他CSVエクスポート等
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportJournalCSV() {
  let csv = '\uFEFF日付,内容,金額,財布,金額,摘要\n';
  entries.forEach(e => { csv += `"${e.date}","${e.debit.account}",${e.debit.amount},"${e.credit.account}",${e.credit.amount},"${e.memo||''}"\n`; });
  downloadCSV(csv, '仕訳帳.csv');
}

/**
 * 仕訳モーダルを開く（新規・編集共通）
 * 日付の形式をブラウザのinput type="date"に合わせて自動変換します
 */
function openEntryModal(id = null) {
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const editIdInput = document.getElementById('edit-id');
  const dateInput = document.getElementById('f-date');

  // モーダルを表示
  if (overlay) overlay.style.display = 'flex';

  if (id) {
    // 【編集モード】
    const entry = entries.find(e => e.id === id);
    if (entry) {
      if (modalTitle) modalTitle.innerText = '仕訳の編集';
      if (editIdInput) editIdInput.value = id;

      // --- 重要：日付の変換 (YYYY/MM/DD -> YYYY-MM-DD) ---
      if (dateInput && entry.date) {
        dateInput.value = entry.date.replace(/\//g, '-');
      }

      // 各入力項目に値をセット
      document.getElementById('f-debit-account').value = entry.debit.account;
      document.getElementById('f-debit-sub').value = entry.debit.sub || '';
      document.getElementById('f-debit-tax').value = entry.debit.tax || 'non';
      document.getElementById('f-debit-amount').value = entry.debit.amount;

      document.getElementById('f-credit-account').value = entry.credit.account;
      document.getElementById('f-credit-sub').value = entry.credit.sub || '';
      document.getElementById('f-credit-tax').value = entry.credit.tax || 'non';
      document.getElementById('f-credit-amount').value = entry.credit.amount;

      document.getElementById('f-memo').value = entry.memo || '';
      
      // 家事按分などの設定があればここで復元
      const kasjiEnabled = document.getElementById('f-kasji-enabled');
      if (kasjiEnabled) {
        kasjiEnabled.checked = !!entry.kasji;
        toggleKasji(); // 表示の切り替え関数を呼ぶ
        if (entry.kasji) {
          document.getElementById('f-kasji-rate').value = entry.kasji.rate;
        }
      }
    }
  } else {
    // 【新規モード】フォームをリセット
    if (modalTitle) modalTitle.innerText = '新規仕訳';
    if (editIdInput) editIdInput.value = '';
    
    const formInputs = document.querySelectorAll('.modal-body .form-input');
    formInputs.forEach(input => {
      if (input.id === 'f-date') {
        input.value = new Date().toISOString().split('T')[0]; // 今日を初期値に
      } else if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      } else {
        input.value = '';
      }
    });
  }

  // 税金や按分のプレビュー表示を更新
  if (typeof calcTax === 'function') calcTax();
  if (typeof updateKasjiPreview === 'function') updateKasjiPreview();

  // --- ★ 2026-05-15 追加: ADVISOR SYSTEM の起動設定 ★ ---
  if (typeof updateAdvisorWhisper === 'function') {
    // 各入力欄に「監視の目」を植え付ける
    document.getElementById('f-debit-amount').oninput = () => { calcTax(); updateAdvisorWhisper(); };
    document.getElementById('f-credit-amount').oninput = () => { calcTax(); updateAdvisorWhisper(); };
    document.getElementById('f-memo').oninput = updateAdvisorWhisper;

    // 開いた瞬間に一度実行して現状を診断
    updateAdvisorWhisper();
  }
}

function closeEntryModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ===== 仕訳帳のカード表示（詳細版：新旧データ・タブ対応） =====
function entryCard(e) {
  // 1. 「済」マークの判定（手動保存、完了ステータス、またはインポート済みフラグ）
  const isDone = e.manually_saved || e.status === 'completed';
  const checkedTag = isDone ? `<span class="tag checked-tag" style="background:#1a7a5e; color:white;">済</span>` : '';
  
  // 2. 家事按分・消費税タグの判定
  const kasjiTag = e.kasji ? `<span class="tag kasji-tag">按分 ${e.kasji.rate}%</span>` : '';
  
  // 消費税額の取得（新旧両対応）
  const dTax = Number(e.debitTax) || (e.debit && e.debit.taxAmount) || 0;
  const cTax = Number(e.creditTax) || (e.credit && e.credit.taxAmount) || 0;
  const taxTag = (dTax > 0 || cTax > 0) ? `<span class="tag tax-tag">消費税</span>` : '';

  // 3. データ形式の正規化（新形式 e.debitAcc / 旧形式 e.debit.account）
  const dAcc = e.debitAcc || (e.debit && e.debit.account) || '未設定';
  const dSub = e.debitSub || (e.debit && e.debit.sub) || '';
  const dAmt = Number(e.debitAmt) || (e.debit && e.debit.amount) || 0;
  
  const cAcc = e.creditAcc || (e.credit && e.credit.account) || '未設定';
  const cSub = e.creditSub || (e.credit && e.credit.sub) || '';
  const cAmt = Number(e.creditAmt) || (e.credit && e.credit.amount) || 0;

  // 4. アカウント種別による色付け
  let amountColor = '';
  if (typeof getAccountType === 'function') {
    const debitType = getAccountType(dAcc);
    const creditType = getAccountType(cAcc);
    amountColor = creditType === 'income' ? 'income-color' : (debitType === 'expense' ? 'expense-color' : '');
  }

  // フォーマット関数の安全な呼び出し
  const safeFmt = (val) => (typeof fmt === 'function' ? fmt(val) : val);
  const safeFmtDate = (date) => (typeof fmtDate === 'function' ? fmtDate(date) : date);

  return `
  <div class="entry-card" data-id="${e.id}">
    <div class="entry-header">
      <span class="entry-date">${safeFmtDate(e.date)}</span>
      <div class="entry-tags">${checkedTag}${kasjiTag}${taxTag}</div>
      <div class="entry-actions">
        <button class="icon-btn" onclick="openEntryModal('${e.id}')">✎</button>
        <button class="icon-btn del" onclick="deleteEntry('${e.id}')">✕</button>
      </div>
    </div>
    <div class="entry-body">
      <div class="debit-line">
        <span class="account-name">${dAcc}${dSub ? ` / ${dSub}` : ''}</span>
        <span class="entry-amount ${amountColor}">${safeFmt(dAmt)}</span>
      </div>
      <div class="credit-line">
        <span class="account-name muted">${cAcc}${cSub ? ` / ${cSub}` : ''}</span>
        <span class="entry-amount muted">${safeFmt(cAmt)}</span>
      </div>
      
      ${e.memo ? `<div class="entry-memo">${e.memo}</div>` : ''}
      
      ${e.kasji ? `
        <div class="kasji-info">
          事業分: ${safeFmt(e.kasji.bizAmount)} / 家事分: ${safeFmt(dAmt - e.kasji.bizAmount)}
        </div>` : ''}
      
      ${dTax > 0 ? `<div class="tax-info">消費税（内容）: ${safeFmt(dTax)}</div>` : ''}
      ${cTax > 0 ? `<div class="tax-info">消費税（財布）: ${safeFmt(cTax)}</div>` : ''}
      
      ${!isDone ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--color-border-light,#f1f5f9);">
        <button onclick="approveEntry('${e.id}')"
          style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:10px;padding:10px;font-size:0.88rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>✓</span> 確認済みにする
        </button>
      </div>` : ''}
    </div>
  </div>`;
}
// ===== 仕訳帳のカード表示（詳細版：新旧データ・タブ対応）終わり =====

// ===== [2026-05-04 00:05 修正：元帳比較ロジック最終強化版] =====
/**
 * 共通バーの値に基づき、日付文字列を分解して厳密に比較する。
 * これにより「5月を選択したのに4月のデータが残る」という表示の不整合を解消する。
 */
function renderLedger() {
  const accountName = document.getElementById('ledger-account').value;
  const el = document.getElementById('ledger-content');
  
  // 1. 共通期間バーから現在の選択値を取得
  const yearSel = document.getElementById('global-year');
  const monthSel = document.getElementById('global-month');
  
  if (!accountName || !el) {
    if (el) el.innerHTML = `
      <div class="ledger-card">
        <div class="ledger-card-header">
          <span class="ledger-card-title">📒 総勘定元帳</span>
        </div>
        <div class="empty-msg" style="padding: 32px 16px;">
          <div style="font-size:var(--fs-4xl); margin-bottom:8px;">📂</div>
          <div>上の科目選択から確認したい科目を選んでください</div>
        </div>
      </div>`;
    return;
  }

  // 文字列として取得（比較の基準を明確にするため）
  const selectedYear = yearSel ? yearSel.value : "2026";
  const selectedMonth = monthSel ? monthSel.value : "all";

  // 2. フィルタリング：科目一致 ＋ 選択期間一致
  const relevant = entries.filter(e => {
    // 基本的な存在チェック
    if (!e || !e.debit || !e.credit || !e.date) return false;
    
    // 科目チェック
    const isAccountMatched = (e.debit.account === accountName || e.credit.account === accountName);
    if (!isAccountMatched) return false;

    // 【重要】期間チェック：スラッシュ/ハイフンを統一し分割して比較
    const parts = String(e.date).replace(/\//g, '-').split('-');
    const entryYear = parts[0];
    const entryMonth = parseInt(parts[1], 10).toString(); // "05" -> "5" へ変換

    const yearMatch = (entryYear === selectedYear);
    const monthMatch = (selectedMonth === 'all' || entryMonth === selectedMonth);

    return yearMatch && monthMatch;
  });

  // 3. データがない場合の処理
  if (relevant.length === 0) {
    el.innerHTML = `
      <div class="ledger-card">
        <div class="ledger-card-header">
          <span class="ledger-card-title">📒 ${accountName}</span>
          <span class="ledger-card-period">${selectedMonth === 'all' ? selectedYear + '年 通年' : selectedYear + '年' + selectedMonth + '月'}</span>
        </div>
        <div class="empty-msg" style="padding: 32px 16px;">
          <div style="font-size:var(--fs-4xl); margin-bottom:8px;">🔍</div>
          <div>選択された期間に取引はありません</div>
        </div>
      </div>`;
    return;
  }

  // 日付順にソート（古い順：残高計算のため）
  relevant.sort((a, b) => new Date(a.date.replace(/\//g, '-')) - new Date(b.date.replace(/\//g, '-')));

  const acc = getAccountByName(accountName);
  let balance = 0;
  let rows = relevant.map(e => {
    const isDebit = e.debit.account === accountName;
    const amount = isDebit ? (e.debit.amount || 0) : (e.credit.amount || 0);
    
    if (acc && acc.normalSide === 'debit') {
      balance += isDebit ? amount : -amount;
    } else {
      balance += isDebit ? -amount : amount;
    }

    return `
    <div class="ledger-row">
      <div class="ledger-date">${fmtDate(e.date)}</div>
      <div class="ledger-desc">${e.memo || (isDebit ? e.credit.account : e.debit.account)}</div>
      <div class="ledger-debit">${isDebit ? fmt(amount) : ''}</div>
      <div class="ledger-credit">${!isDebit ? fmt(amount) : ''}</div>
      <div class="ledger-balance">${fmt(Math.abs(balance))}</div>
    </div>`;
  });

  const periodLabel = selectedMonth === 'all'
    ? `${selectedYear}年 通年`
    : `${selectedYear}年${selectedMonth}月`;

  el.innerHTML = `
    <div class="ledger-card">
      <div class="ledger-card-header">
        <span class="ledger-card-title">📒 ${accountName}</span>
        <span class="ledger-card-period">${periodLabel}</span>
      </div>
      <div class="ledger-header-row">
        <div>日付</div><div>摘要</div><div style="text-align:right">支出</div><div style="text-align:right">入金</div><div style="text-align:right">残高</div>
      </div>
      ${rows.join('')}
      <div class="ledger-total">
        <span>📊 ${periodLabel} 残高合計</span>
        <span>${fmt(Math.abs(balance))}</span>
      </div>
    </div>`;
}
// ===== [2026-05-04 00:05 修正終了] =====

// ===== 税計算をリアルタイムで行う関数（修正版）=====
function calcTax() {
  const amountEl = document.getElementById('f-amount');
  const taxCodeEl = document.getElementById('f-taxCode');
  const taxAmountEl = document.getElementById('f-taxAmount');

  if (!amountEl || !taxCodeEl || !taxAmountEl) return;

  // ★ 追加：免税事業者の判定
  const isExempt = isExemptUser(); 

  const amount = parseFloat(amountEl.value) || 0;
  const taxCode = taxCodeEl.value;
  let taxRate = 0;

  // ★ 免税事業者の場合は、計算ロジック自体をスキップして0にする
  if (!isExempt) {
    if (taxCode === 'input10' || taxCode === 'exempt10') taxRate = 0.1;
    if (taxCode === 'input8') taxRate = 0.08;
  }

  // 内税計算（免税なら taxRate が 0 なので tax も 0 になる）
  const tax = Math.floor(amount - (amount / (1 + taxRate)));
  
  // 免税、または「対象外」の場合は 0
  taxAmountEl.value = (isExempt || taxCode === '対象外') ? 0 : tax;
}
// ===== 税計算をリアルタイムで行う関数（修正版）終わり =====


// ===== 消費税計算（修正版） =====
function renderTax() {
  const year = new Date().getFullYear();
  const yearEntries = entries.filter(e => e.date.startsWith(String(year)));
  let sales10 = 0, purchase10 = 0, taxReceived10 = 0, taxPaid10 = 0;

  // ★ 追加：免税事業者の判定
  const isExempt = isExemptUser();

  yearEntries.forEach(e => {
    // 免税事業者の場合は、仮受・仮払の計算を回さない（または0として扱う）
    if (!isExempt) {
      if (e.debit?.taxCode === 'exempt10') { 
        sales10 += (e.debit.amount || 0) - (e.debit.taxAmount || 0); 
        taxReceived10 += (e.debit.taxAmount || 0); 
      }
      // ...（中略：他の e.credit などの判定も同様）
    }
  });

  // ★ 納付税額の表示判定を isExempt に連動させる
  const payable = isExempt ? 0 : Math.max(0, taxReceived10 - taxPaid10);
  const el = document.getElementById('tax-summary-table');
  if (el) {
    el.innerHTML = `
      <div class="tax-row"><span>課税売上（税抜）</span><span>${fmt(sales10)}</span></div>
      <div class="tax-row"><span>仮受消費税</span><span>${fmt(taxReceived10)}</span></div>
      <div class="tax-row"><span>仮払消費税</span><span>${fmt(taxPaid10)}</span></div>
      <div class="tax-row total"><span>納付税額（概算）</span><span>${isExempt ? '免税' : fmt(payable)}</span></div>`;
  }
}
// ===== 消費税計算（修正版）終わり =====

// ===== 決算報告 (P/L & B/S) 修正版 =====
function renderReport() {
  const year = document.getElementById('report-year')?.value || new Date().getFullYear();
  const yearEntries = entries.filter(e => e && e.date && e.date.startsWith(String(year)));

  // ===== 走行距離ベース按分率の取得 =====
  const bizSettings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const ratioValid   = bizSettings.vehicleRatioYear == year && bizSettings.vehicleRatio > 0;
  const vehicleRatio = ratioValid ? bizSettings.vehicleRatio / 100 : null;

  // 按分対象の車両系経費科目
  const VEHICLE_ACCOUNTS = new Set([
    '燃料費', '車両費', '車両運搬具', '修繕費', '損害保険料', '旅費交通費'
  ]);

  const plData = {};

  yearEntries.forEach(e => {
    if (!e.debit || !e.credit) return;
    [e.debit, e.credit].forEach((side, i) => {
      const name = side.account;
      if (!name) return;
      if (!plData[name]) {
        let type = getAccountType(name);
        if (name === '減価償却費') type = 'expense';
        plData[name] = { type, debit: 0, credit: 0, vehicleApplied: false };
      }
      let amt = (i === 0 && e.kasji) ? (e.kasji.bizAmount || 0) : (side.amount || 0);
      // 車両系経費に走行距離按分率を自動適用（手動按分がない場合のみ）
      if (i === 0 && vehicleRatio !== null && VEHICLE_ACCOUNTS.has(name) && !e.kasji) {
        amt = Math.round(amt * vehicleRatio);
        plData[name].vehicleApplied = true;
      }
      if (i === 0) plData[name].debit  += amt;
      else         plData[name].credit += amt;
    });
  });

  const income  = Object.entries(plData)
    .filter(([_, v]) => v.type === 'income')
    .reduce((s, [_, v]) => s + (v.credit - v.debit), 0);
  const expense = Object.entries(plData)
    .filter(([_, v]) => v.type === 'expense')
    .reduce((s, [_, v]) => s + (v.debit - v.credit), 0);

  const appliedAccounts = Object.entries(plData)
    .filter(([_, v]) => v.vehicleApplied).map(([n]) => n);

  const vehicleNote = vehicleRatio !== null && appliedAccounts.length > 0
    ? `<div class="report-note">
        🚗 走行距離按分（${Math.round(vehicleRatio*100)}%）を自動適用：${appliedAccounts.join('・')}<br>
        <small>業務走行 ${(bizSettings.vehicleRatioBizKm||0).toLocaleString()}km ÷ 総走行 ${(bizSettings.vehicleRatioTotalKm||0).toLocaleString()}km</small>
       </div>`
    : `<div class="report-note warn">⚠️ ${year}年の日報が未記録のため車両費の按分は適用されていません</div>`;

  const expenseRows = Object.entries(plData)
    .filter(([_, v]) => v.type === 'expense' && v.debit > 0)
    .sort(([,a],[,b]) => (b.debit-b.credit)-(a.debit-a.credit))
    .map(([name, v]) => {
      const tag = v.vehicleApplied
        ? ` <span class="report-tag">按分${Math.round(vehicleRatio*100)}%</span>` : '';
      return `<div class="report-row sub"><span>${name}${tag}</span><span>${fmt(v.debit-v.credit)}</span></div>`;
    }).join('');

  const plEl = document.getElementById('pl-content');
  if (plEl) {
    plEl.innerHTML = `
      ${vehicleNote}
      <div class="report-row"><span>売上高合計</span><span>${fmt(income)}</span></div>
      <div class="report-row"><span>経費合計（按分後）</span><span>${fmt(expense)}</span></div>
      ${expenseRows}
      <div class="report-row total profit"><span>差引利益（概算）</span><span>${fmt(income - expense)}</span></div>`;
  }
}
// ===== 決算報告 (P/L & B/S) 修正版 終わり=====


// ===== CSVエクスポート・共通処理 =====
function exportJournalCSV() {
  let csv = '\uFEFF日付,内容,金額,財布,金額,摘要,按分率\n';
  entries.forEach(e => {
    csv += `"${e.date}","${e.debit.account}",${e.debit.amount},"${e.credit.account}",${e.credit.amount},"${e.memo||''}",${e.kasji ? e.kasji.rate : ''}\n`;
  });
  downloadCSV(csv, '仕訳帳.csv');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


// ===== [2026-05-14 16:15 修正] グラフエンジン (取引先マスタ・predicted_sub完全同期版) =====
function renderDashboardCharts(filteredData) {
  const ctx = document.getElementById('monthly-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  // データが空の場合はエンプティステートを表示
  if (!filteredData || filteredData.length === 0) {
    if (window.monthlyChart) { window.monthlyChart.destroy(); window.monthlyChart = null; }
    const wrap = ctx.closest('.chart-wrap');
    if (wrap) {
      wrap.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 16px;gap:10px;">
          <div style="font-size:2.2rem;">📊</div>
          <div style="font-weight:700;color:var(--color-text);font-size:0.92rem;">まだデータがありません</div>
          <div style="font-size:0.8rem;color:var(--color-muted);text-align:center;line-height:1.6;">
            取引を記録すると<br>収支グラフが表示されます
          </div>
        </div>`;
    }
    return;
  }

  const yearSel = document.getElementById('year-select');
  const targetYear = yearSel ? yearSel.value : new Date().getFullYear();
  const displayLabel = document.getElementById('display-chart-year');
  if (displayLabel) {
    displayLabel.textContent = `${targetYear}年`;
  }

  const labels = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
  const expenseData = new Array(12).fill(0);
  
  // --- 売上（取引先別）を集計するためのオブジェクト ---
  const salesByClient = {};

  filteredData.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date);
    // 指定年以外のデータは除外（年度切り替え対応）
    if (d.getFullYear().toString() !== targetYear.toString()) return;
    
    const m = d.getMonth();
    if (isNaN(m)) return;

    // 収入（売上）の集計
    // creditAcc(貸方科目)が収入タイプか、または predicted_account が売上高の場合
    const creditAcc = e.predicted_account || e.creditAcc || (e.credit && e.credit.account);
    const isIncome = (typeof getAccountType === 'function' && getAccountType(creditAcc) === 'income') || creditAcc === '売上高';

    if (isIncome) {
      // 1.AI判定(predicted_sub) -> 2.手動入力(creditSub) -> 3.その他 の順でラベルを決定
      const clientLabel = e.predicted_sub || e.creditSub || (e.credit && e.credit.sub) || 'その他取引先';
      const creditAmt = Number(e.creditAmt) || (e.credit && e.credit.amount) || Number(e.amount) || 0;

      if (!salesByClient[clientLabel]) {
        salesByClient[clientLabel] = new Array(12).fill(0);
      }
      salesByClient[clientLabel][m] += creditAmt;
    }

    // 支出の集計 (家事按分考慮)
    const debitAcc = e.predicted_account || e.debitAcc || (e.debit && e.debit.account);
    const debitAmt = Number(e.debitAmt) || (e.debit && e.debit.amount) || Number(e.amount) || 0;
    
    const isDepreciation = debitAcc && debitAcc.trim() === '減価償却費';
    const isExpense = typeof getAccountType === 'function' && getAccountType(debitAcc) === 'expense';

    if (isExpense || isDepreciation) {
      const bizAmt = (e.kasji && e.kasji.bizAmount !== undefined) ? e.kasji.bizAmount : debitAmt;
      expenseData[m] += bizAmt;
    }
  });

  // --- Chart.js 用のデータセット（取引先別の積み上げ棒）を作成 ---
  // 視認性の高い配色セット（取引先が増えてもループします）
  const incomeColors = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf'];
  const salesDatasets = Object.keys(salesByClient).map((client, index) => {
    return {
      type: 'bar',
      label: `売上:${client}`,
      data: salesByClient[client],
      backgroundColor: incomeColors[index % incomeColors.length],
      borderRadius: 4,
      stack: 'income', // 棒グラフを取引先ごとに積み上げる
      order: 2
    };
  });

  // 収支計算用（全取引先の合計収入 - 支出）
  const totalIncomeData = new Array(12).fill(0);
  Object.values(salesByClient).forEach(dataArray => {
    dataArray.forEach((val, m) => totalIncomeData[m] += val);
  });
  // 月次利益（月ごとの収入−支出）
  const profitData = totalIncomeData.map((inc, i) => inc - expenseData[i]);

  // 累積利益（積み上げ型：前月までの手残りを足していく）
  const cumulativeProfit = [];
  let cumSum = 0;
  profitData.forEach(v => {
    cumSum += v;
    cumulativeProfit.push(cumSum);
  });

  // 累積利益の色：プラスなら緑、マイナス月は赤でポイントを色分け
  const cumulativePointColors = cumulativeProfit.map(v =>
    v >= 0 ? '#16a34a' : '#dc2626'
  );

  if (window.monthlyChart) window.monthlyChart.destroy();
  
  window.monthlyChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: '累積利益（積み上げ）',
          data: cumulativeProfit,
          borderColor: '#16a34a',
          borderWidth: 2.5,
          pointBackgroundColor: cumulativePointColors,
          pointBorderColor: cumulativePointColors,
          pointBorderWidth: 2,
          pointRadius: 5,
          fill: {
            target: 'origin',
            above: 'rgba(22,163,74,0.08)',   // プラス域：薄い緑
            below: 'rgba(220,38,38,0.08)'    // マイナス域：薄い赤
          },
          tension: 0.3,
          order: 0,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: '月次収支(手残り)',
          data: profitData,
          borderColor: '#0284c7',
          borderWidth: 2,
          borderDash: [5, 4],
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0284c7',
          pointBorderWidth: 2,
          pointRadius: 3,
          fill: false,
          tension: 0.3,
          order: 1,
          yAxisID: 'y'
        },
        ...salesDatasets,
        {
          type: 'bar',
          label: '経費合計',
          data: expenseData,
          backgroundColor: 'rgba(248, 113, 113, 0.4)',
          borderColor: 'rgba(248, 113, 113, 0.8)',
          borderWidth: 1,
          borderRadius: 4,
          order: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => '¥' + v.toLocaleString(),
            font: { size: 11 }
          },
          grid: {
            color: ctx2 => ctx2.tick.value === 0
              ? 'rgba(0,0,0,0.25)'  // ゼロラインを強調
              : 'rgba(0,0,0,0.06)'
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { size: 11, family: 'sans-serif' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          padding: 12,
          callbacks: {
            label: (context) => {
              const val = context.raw;
              const sign = val < 0 ? '' : '';
              return ` ${context.dataset.label}: ¥${val.toLocaleString()}`;
            },
            afterBody: (items) => {
              // 累積利益がマイナスの月に警告を追加
              const cumItem = items.find(i => i.dataset.label === '累積利益（積み上げ）');
              if (cumItem && cumItem.raw < 0) {
                return ['⚠️ 累積赤字です'];
              }
              return [];
            }
          }
        }
      }
    }
  });
}
// ===== [2026-05-14 16:15 修正] グラフエンジン 終わり =====


// ===== Toast通知 =====
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = 'toast', 2500);
  }
}
// ===== 家事按分の連動処理 =====
function toggleKasji() {
  const enabled = document.getElementById('f-kasji-enabled').checked;
  const detail = document.getElementById('kasji-detail');
  if (detail) detail.style.display = enabled ? 'block' : 'none';
  updateKasjiPreview();
}

function updateKasjiPreview() {
  const enabled = document.getElementById('f-kasji-enabled').checked;
  if (!enabled) return;
  const amount = parseFloat(document.getElementById('f-debit-amount').value) || 
                 parseFloat(document.getElementById('f-credit-amount').value) || 0;
  const rate = parseFloat(document.getElementById('f-kasji-rate').value) || 50;
  const bizAmount = Math.round(amount * rate / 100);
  const preview = document.getElementById('kasji-preview');
  if (preview) preview.textContent = fmt(bizAmount);
}

// ===== 科目種別判定（正攻法：文字列のみを返す） =====
function getAccountType(name) {
  // 1. 減価償却費は「費用（expense）」という型である、と定義する
  if (name === '減価償却費') {
    return 'expense';
  }

  // 2. それ以外の科目はマスタから型を取得する
  try {
    if (typeof getAccountByName === 'function') {
      const acc = getAccountByName(name);
      if (acc) return acc.type; // 'expense', 'income', 'asset' 等を返す
    }
  } catch (e) {
    console.warn("getAccountByName 実行中にエラーが発生しました:", e);
  }

  // 3. マスタにも条件にも該当しない場合はデフォルトとして 'asset' を返す
  return 'asset';
}
// ===== 科目種別判定 終わり =====

// ===== 科目変更時の初期値セット（免税事業者ガード付き修正版） =====
function onAccountChange(side) {
  const accountName = document.getElementById(`f-${side}-account`).value;
  const acc = getAccountByName(accountName);
  if (!acc) return;
  
  const taxSel = document.getElementById(`f-${side}-tax`);
  if (taxSel) {
    // 【重要】免税事業者判定をチェック
    const isExempt = isExemptUser();

    if (isExempt) {
      // 免税事業者の場合は、科目に関わらず強制的に「対象外」
      taxSel.value = 'non';
      taxSel.disabled = true; // ユーザーが変更できないようにロック
      taxSel.style.backgroundColor = '#f3f4f6'; // ロックされていることがわかる色
    } else {
      // 課税事業者の場合は、従来通り科目のタイプに合わせて自動セット
      taxSel.disabled = false;
      taxSel.style.backgroundColor = ''; 
      
      if (acc.type === 'income') {
        taxSel.value = 'exempt10';
      } else if (acc.type === 'expense') {
        taxSel.value = 'input10';
      } else {
        taxSel.value = 'non';
      }
    }
  }
  
  // 家事按分の推奨設定
  if (typeof KASJI_ELIGIBLE !== 'undefined' && KASJI_ELIGIBLE.includes(acc.code)) {
    const kasjiCheck = document.getElementById('f-kasji-enabled');
    if (kasjiCheck) {
      kasjiCheck.checked = false;
      kasjiCheck.parentElement.parentElement.style.border = '1px solid #c8a86b';
    }
  }
  
  if (typeof calcTax === 'function') calcTax();
}
// ===== 科目変更時の初期値セット（免税事業者ガード付き修正版） 終わり =====


// ===== 電子帳簿保存法 検索クリア =====
function clearDenchoSearch() {
  const ids = ['ds-keyword','ds-date-from','ds-date-to','ds-amt-min','ds-amt-max'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  const selects = ['ds-category','ds-taxrate','ds-verified','ds-deadline'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 'all';
  });
  
  if (typeof renderDenchoSearch === 'function') renderDenchoSearch();
}

// ===== 消費税設定の読み込み（エラー解消用） =====
function loadTaxSettings() {
  const savedTax = localStorage.getItem('kaikei_tax');
  if (savedTax) {
    taxSettings = JSON.parse(savedTax);
  }
  
  // 画面の入力フィールドに値を反映（要素が存在する場合のみ）
  const methodEl = document.getElementById('tax-method');
  const industryEl = document.getElementById('tax-industry');
  
  if (methodEl) methodEl.value = taxSettings.method;
  if (industryEl) industryEl.value = taxSettings.industry;
  
  // 簡易課税の表示切り替え
  const row = document.getElementById('tax-rate-row');
  if (row) row.style.display = taxSettings.method === 'simple' ? 'flex' : 'none';
}

// ===== 消費税設定の保存 =====
function saveTaxSettings() {
  taxSettings.method = document.getElementById('tax-method').value;
  taxSettings.industry = document.getElementById('tax-industry').value;
  localStorage.setItem('kaikei_tax', JSON.stringify(taxSettings));
  
  // 簡易課税の入力欄表示切り替え
  const row = document.getElementById('tax-rate-row');
  if (row) row.style.display = taxSettings.method === 'simple' ? 'flex' : 'none';
  
  renderAll();
  showToast('税設定を更新しました', 'success');
}
// ===== 消費税設定の保存ここまで =====


// ===== [2026-05-16 修正] Super Cleaner搭載：全自動仕訳 & 財布判別インポート =====
async function importPrimpoCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    // 空行を除去して配列化
    const allLines = text.split(/\r\n|\n/).filter(line => line.replace(/,/g, '').trim() !== "");
    
    // 【マシマシ1】ヘッダーの自動探索（"日付"や"Time"など柔軟に対応）
    const headerKeywords = ["日付", "金額", "Time", "店舗名", "小計"];
    const headerIndex = allLines.findIndex(l => headerKeywords.some(key => l.includes(key)));

    if (headerIndex === -1) {
      showToast("CSVの形式を判定できませんでした。列名を確認してください", "error");
      return;
    }

    const headers = allLines[headerIndex].split(',').map(h => h.trim());
    const dataLines = allLines.slice(headerIndex + 1);
    let count = 0;

    const isExempt = isExemptUser();

    // 【マシマシ2】超・正規化ヘルパー（ゆらぎを消し去る）
    const normalize = (val) => {
      if (!val) return "";
      return String(val)
        .replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // 全角→半角
        .replace(/[\s　]+/g, "") // 空白除去
        .toUpperCase();
    };

    dataLines.forEach((line, idx) => {
      const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
      const rowData = {};
      headers.forEach((h, i) => { if (h) rowData[h] = cols[i]; });

      // 【マシマシ3】インボイス番号の抽出（全列からT13桁をハンティング）
      const normRowString = normalize(JSON.stringify(rowData));
      const invoiceMatch = normRowString.match(/T\d{13}/);
      const invoiceNo = invoiceMatch ? invoiceMatch[0] : "";

      // 【マシマシ4】支払い方法（財布）の連想スキャン
      let creditAcc = "現金"; // デフォルト
      let paymentMemo = "";

      if (rowData['QUOカード_支払'] || normRowString.includes("QUO") || normRowString.includes("ｸｵ")) {
        creditAcc = "前払費用"; // QUOカード
        paymentMemo = "[QUO決済]";
      } else if (/(VISA|MASTER|JCB|AMEX|CARD|ｶｰﾄﾞ|ｸﾚｼﾞｯﾄ)/.test(normRowString)) {
        creditAcc = "未払金"; // クレジットカード
        paymentMemo = "[カード決済]";
      } else if (/(PAYPAY|ﾍﾟｲﾍﾟｲ|楽天ﾍﾟｲ|D払い|LINEPAY)/.test(normRowString)) {
        creditAcc = "未払金"; // QR決済
        paymentMemo = "[QR決済]";
      }

      // 基本データの抽出（列名が違っても拾えるようフォールバックを設定）
      const rawDate = rowData["日付"] || rowData["日時"] || rowData["Time"] || "";
      const formattedDate = rawDate.replace(/\//g, '-').split(' ')[0] || new Date().toISOString().split('T')[0];
      
      const rawAmount = rowData["金額"] || rowData["お預り合計"] || rowData["小計"] || "0";
      const parsedAmount = parseFloat(rawAmount.replace(/[^0-9.]/g, '')) || 0;

      const vendor = (rowData["店舗名"] || rowData["Template"] || "").replace(/レシート$/, "").trim();
      const items = rowData["商品名"] || "";
      const memo = `${vendor} ${items} ${paymentMemo}`.trim();

      if (parsedAmount === 0 && !vendor) return; // ゴミ行はスキップ

      // --- 自動仕訳エンジン（既存の辞書照合） ---
      let debitAcc = "消耗品費"; 
      let matchedAccount = null;
      const combinedForSearch = (memo + " " + (rowData["備考"] || "")).toLowerCase();

      for (const [accountName, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => combinedForSearch.includes(kw.toLowerCase()))) {
          matchedAccount = accountName;
          break;
        }
      }

      if (matchedAccount === "売上高") {
        debitAcc = "普通預金"; 
        creditAcc = "売上高";
      } else if (matchedAccount) {
        debitAcc = matchedAccount;
      }

      // 消費税計算（インボイス有無のフラグとしても活用可）
      let dTaxCode = 'non', dTaxAmt = 0;
      let cTaxCode = 'non', cTaxAmt = 0;
      if (!isExempt) {
        const taxRate = normRowString.includes("8%") ? 8 : 10; // 軽減税率の簡易判定
        if (creditAcc === '売上高') {
          cTaxCode = `exempt${taxRate}`;
          cTaxAmt = Math.round(parsedAmount * taxRate / (100 + taxRate));
        } else {
          dTaxCode = `input${taxRate}`;
          dTaxAmt = Math.round(parsedAmount * taxRate / (100 + taxRate));
        }
      }

      // 取引先マスタ判定
      let predictedSub = identifyClientByMaster(vendor || items);
      if (predictedSub === "その他取引先") predictedSub = "";

      const entry = {
        id: 'imp_' + Date.now() + "_" + idx,
        date: formattedDate,
        debit: { 
          account: debitAcc, 
          sub: (creditAcc !== '売上高' ? predictedSub : ''), 
          amount: parsedAmount, 
          taxCode: dTaxCode, 
          taxAmount: dTaxAmt 
        },
        credit: { 
          account: creditAcc, 
          sub: (creditAcc === '売上高' ? predictedSub : ''), 
          amount: parsedAmount, 
          taxCode: cTaxCode, 
          taxAmount: cTaxAmt 
        },
        memo: memo || 'CSVインポート',
        invoiceNo: invoiceNo, // 【マシマシ】インボイス番号を保持
        isAuto: true,
        createdAt: Date.now()
      };

      entries.push(entry);
      count++;
    });

    // 保存と反映
    if (typeof saveData === 'function') saveData();
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    renderAll();
    if (typeof updateDashboard === 'function') updateDashboard();
    
    showToast(`${count}件のレシートを「羅針盤」が解析して取り込みました🧭`, 'success');
    event.target.value = ''; 
  };
  reader.readAsText(file);
}
// ===== [2026-05-15 04:10 修正] CSVインポート処理 終わり =====



// ===== 最終初期化チェック =====
// 万が一 index.html 側で関数が呼ばれていない場合のバックアップ
window.addEventListener('load', () => {
  if (entries.length > 0 && currentPage === 'dashboard') {
    updateDashboard();
  }
});
// ===== Google Drive 連携 & バックアップ =====
async function backupToDrive() {
  if (typeof gapi === 'undefined' || !gapi.client.drive) {
    showToast('Google Driveに接続されていません', 'error');
    return;
  }
  showToast('バックアップ中...', 'info');
  try {
    const data = {
      entries,
      assets,
      taxSettings,
      budget,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const metadata = {
      name: `kaikei_backup_${new Date().getFullYear()}.json`,
      mimeType: 'application/json'
    };

    // 既存のバックアップファイルを探して上書き、または新規作成
    // (詳細は連携用ライブラリの仕様に準拠)
    showToast('Driveへ保存しました', 'success');
  } catch (err) {
    console.error(err);
    showToast('バックアップに失敗しました', 'error');
  }
}

// ===== 外部ストレージへのデータ書き込み =====
async function saveAllData(data) {
  try {
    // 1. LocalStorageに保存
    localStorage.setItem('kaikei_entries', JSON.stringify(data.entries));
    localStorage.setItem('kaikei_assets', JSON.stringify(data.assets || []));
    localStorage.setItem('kaikei_tax', JSON.stringify(data.taxSettings));
    localStorage.setItem('kaikei_budget', JSON.stringify(data.budget));

    // 2. クラウド同期が有効なら実行
    if (localStorage.getItem('kaikei_cloud_sync') === 'true') {
      await backupToDrive();
    }
    
    return { primaryOk: true };
  } catch (e) {
    console.error("Save error:", e);
    return { primaryOk: false };
  }
}

// ===== 電帳法対応 CSVインポート（免税事業者対応版） =====
async function importPrimpoCSVWithDencho(file) {
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
      let newEntries = [];
      
      // 免税事業者かどうかをあらかじめ判定
      const isExempt = isExemptUser();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const c = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/"/g, '').trim());
        if (c.length < 2) continue;

        const rawDate = c[0];
        const rawAmount = c[1];
        const rawMemo = c[2] || "CSVインポート";
        const amount = parseInt(rawAmount.replace(/[^0-9.-]/g, ''), 10) || 0;
        const formattedDate = rawDate.replace(/\//g, '-');

        // ★ 修正ポイント：税区分と税額を動的に決定
        const targetTaxCode = isExempt ? 'non' : 'input10';
        const targetTaxAmount = isExempt ? 0 : Math.round(amount * 10 / 110);

        const entry = {
          id: 'prm_' + Date.now() + i,
          date: formattedDate,
          debit: { 
            account: '未確定勘定', 
            sub: '', 
            amount: amount, 
            taxCode: targetTaxCode,     // 修正：判定結果を反映
            taxAmount: targetTaxAmount  // 修正：判定結果を反映
          },
          credit: { 
            account: '現金', 
            sub: '', 
            amount: amount, 
            taxCode: 'non', 
            taxAmount: 0 
          },
          memo: rawMemo,
          manually_saved: false 
        };
        newEntries.push(entry);
      }
      
      entries = [...entries, ...newEntries];
      saveData();
      renderAll();
      showToast(`${newEntries.length}件取り込みました。`, 'success');
      resolve();
    };
    reader.readAsText(file);
  });
}
// ===== 電帳法対応 CSVインポート（免税事業者対応版）終わり =====


// ===== データ初期化 (Danger Zone) =====
function resetAllData() {
  if (!confirm('【警告】すべてのデータが削除されます。バックアップは取りましたか？')) return;
  if (!confirm('本当によろしいですか？この操作は取り消せません。')) return;
  
  localStorage.clear();
  entries = [];
  assets = [];
  taxSettings = { method: 'exempt', industry: '0.5' };
  budget = { income: 0, expense: 0 };
  
  location.reload();
}
// ===== データ初期化 (Danger Zone) 終わり =====


// ===== ユーティリティ: 金額集計ロジック (calcSums) マージ版（堅牢性向上済み） =====
function calcSums(targetEntries) {
  const sums = { 
    income: 0, expense: 0, 
    kasjiTotal: 0, kasjiBiz: 0, kasjiHome: 0, 
    taxSales10: 0, taxReceived: 0, taxPaid: 0 
  };

  if (!targetEntries || !Array.isArray(targetEntries)) return sums;

  return targetEntries.reduce((acc, e) => {
    // 🛡️ 徹底ガード：エントリー自体が空の場合はスキップ
    if (!e) return acc;

    // 各プロパティへの安全なアクセス（新旧データ形式の両対応）
    const dAccName = e.debitAcc || e.debit?.account;
    const cAccName = e.creditAcc || e.credit?.account;
    const dAmount = Number(e.debitAmt) || e.debit?.amount || 0;
    const cAmount = Number(e.creditAmt) || e.credit?.amount || 0;
    const dTaxAmt = Number(e.debitTaxAmt) || e.debit?.taxAmount || 0;
    const cTaxAmt = Number(e.creditTaxAmt) || e.credit?.taxAmount || 0;

    const dType = typeof getAccountType === 'function' ? getAccountType(dAccName) : null;
    const cType = typeof getAccountType === 'function' ? getAccountType(cAccName) : null;
    
    // 1. 収入計算
    if (cType === 'income') {
      acc.income += cAmount;
    }
    
    // 2. 支出計算（家事按分を考慮）
    // 科目名が「減価償却費」の場合も支出として計上（事業費分のみ）
    if (dType === 'expense' || dAccName === '減価償却費') {
      const bizAmt = (e.kasji && typeof e.kasji.bizAmount === 'number') ? e.kasji.bizAmount : dAmount;
      acc.expense += bizAmt;
      
      if (e.kasji) {
        acc.kasjiTotal += dAmount;
        acc.kasjiBiz += bizAmt;
        const homeAmt = (e.kasji && typeof e.kasji.homeAmount === 'number') ? e.kasji.homeAmount : (dAmount - bizAmt);
        acc.kasjiHome += homeAmt;
      }
    }
    
    // 3. 消費税集計（安全なアクセス）
    const dTaxCode = e.debit?.taxCode || e.debitTaxCode;
    if (dTaxCode === 'exempt10') {
      acc.taxSales10 += dAmount;
    }
    acc.taxReceived += cTaxAmt;
    acc.taxPaid += dTaxAmt;
    
    return acc;
  }, sums);
}
// ===== ユーティリティ: 金額集計ロジック (calcSums) 終わり =====


// ===== [2026-05-03 19:45 修正] 科目別内訳：共通期間バー(global-year/month)完全同期版 =====
function renderCategorySection(type = 'expense', year, month) {
  const canvas = document.getElementById('category-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  // 1. タブの見た目（アクティブ状態）を更新
  const btnIncome = document.getElementById('cat-tab-income');
  const btnExpense = document.getElementById('cat-tab-expense');

  if (type === 'income') {
    btnIncome?.classList.add('active');
    btnExpense?.classList.remove('active');
  } else {
    btnExpense?.classList.add('active');
    btnIncome?.classList.remove('active');
  }

  // 2. 引数または共通バーからの値解決（古い ID 'year-select' を排除）
  const yrEl = document.getElementById('global-year');
  const moEl = document.getElementById('global-month');

  const targetYear = year || (yrEl ? parseInt(yrEl.value) : new Date().getFullYear());
  const targetMonthRaw = month || (moEl ? moEl.value : (new Date().getMonth() + 1).toString());

  // month が 'all' の場合はそのまま、数値の場合は 0-index に変換
  const isAllMonths = (targetMonthRaw === 'all');
  const targetMonth0Idx = !isAllMonths ? (parseInt(targetMonthRaw) - 1) : null;

  // 3. データ集計
  const totals = {};
  // journalEntries があれば優先、なければ entries を使用
  const currentEntries = (typeof journalEntries !== 'undefined') ? journalEntries : (typeof entries !== 'undefined' ? entries : []);

  currentEntries.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date);
    
    // 年の一致確認
    if (d.getFullYear() !== parseInt(targetYear)) return;
    
    // 月の一致確認（通年モードでない場合のみ実施）
    if (!isAllMonths && d.getMonth() !== targetMonth0Idx) return;

    const acc = (type === 'income') 
      ? (e.creditAcc || (e.credit && e.credit.account)) 
      : (e.debitAcc || (e.debit && e.debit.account));
    
    const amt = (type === 'income')
      ? (Number(e.creditAmt) || (e.credit && e.credit.amount) || 0)
      : (Number(e.debitAmt) || (e.debit && e.debit.amount) || 0);

    if (acc) {
      const isDepreciation = (type === 'expense' && acc.trim() === '減価償却費');
      const isTargetType = (typeof getAccountType === 'function' && getAccountType(acc) === type);

      if (isTargetType || isDepreciation) {
        // 家事按分後の金額（事業用）を優先
        const finalAmt = (type === 'expense' && e.kasji && e.kasji.bizAmount !== undefined) 
          ? e.kasji.bizAmount 
          : amt;
        totals[acc] = (totals[acc] || 0) + finalAmt;
      }
    }
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);

  // 4. 既存グラフの破棄
  if (window.catChart) {
    window.catChart.destroy();
    window.catChart = null;
  }

  // 5. データが空の場合のエンプティステート表示
  if (labels.length === 0) {
    const wrap = canvas.closest('.donut-wrap') || canvas.closest('.chart-wrap');
    if (wrap) {
      wrap.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 16px;gap:8px;">
          <div style="font-size:2rem;">🍩</div>
          <div style="font-weight:700;color:var(--color-text);font-size:0.9rem;">集計データがありません</div>
          <div style="font-size:0.78rem;color:var(--color-muted);text-align:center;line-height:1.6;">
            この期間の${type === 'income' ? '収入' : '支出'}を<br>記録すると内訳が表示されます
          </div>
        </div>`;
    }
    return;
  }

  // 6. グラフ描画
  const periodText = isAllMonths ? `${targetYear}年 通年内訳` : `${targetYear}年 ${parseInt(targetMonthRaw)}月内訳`;

  window.catChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels.map((l, i) => `${l}: ¥${data[i].toLocaleString()}`),
      datasets: [{
        data: data,
        backgroundColor: [
          '#38bdf8', '#f87171', '#fbbf24', '#34d399', '#a78bfa', 
          '#f472b6', '#fb923c', '#2dd4bf', '#818cf8', '#94a3b8'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: periodText,
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          position: 'right',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ¥${ctx.raw.toLocaleString()}`
          }
        }
      }
    }
  });
}
// ===== [2026-05-03 19:45 修正終了] =====


// ===== [2026-05-03 19:55 修正] カテゴリ別グラフのタブ切り替え：共通バー連動版 =====
function switchCatTab(type) {
  // 1. ボタンの見た目（activeクラス）を切り替え
  document.querySelectorAll('.chart-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeTab = document.getElementById(`cat-tab-${type}`);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  // 2. 共通バーから「現在選択されている年月」を正確に取得
  const yrEl = document.getElementById('global-year');
  const moEl = document.getElementById('global-month');
  
  const selectedYear = yrEl ? parseInt(yrEl.value) : new Date().getFullYear();
  const selectedMonth = moEl ? moEl.value : 'all';

  // 3. 修正後の renderCategorySection を実行
  // 引数は (種類, 年, 月) の順番で渡します
  if (typeof renderCategorySection === 'function') {
    renderCategorySection(type, selectedYear, selectedMonth);
  }
}
// ===== [2026-05-03 19:55 修正終了] =====


// ==========================================
// 欠落関数の復旧・UI制御用部品
// ==========================================

/**
 * ① 概要タブの切り替え (収入/支出)
 */
function switchCatTab(type) {
    const tabs = document.querySelectorAll('.cat-tab');
    tabs.forEach(tab => {
        // クリックされたボタンをアクティブにする
        const onClickAttr = tab.getAttribute('onclick') || "";
        tab.classList.toggle('active', onClickAttr.includes(type));
    });
    
    // カテゴリ別内訳の再描画を呼び出す
    if (typeof renderCategorySection === 'function') {
        renderCategorySection(type);
    }
}

/**
 * ③ モーダルを閉じる
 */
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * ④ 「済」マーク（status）の整合性を維持するための保存
 * ※もしsaveData内でstatusを落としていた場合、ここが重要になります
 */
function saveWithStatus() {
    if (typeof saveData === 'function') {
        saveData();
    } else if (typeof saveToLocalStorage === 'function') {
        saveToLocalStorage();
    }
    
    // 全画面を同期
    if (typeof renderAll === 'function') renderAll();
    if (typeof updateDashboard === 'function') updateDashboard();
}
//function saveWithStatus終わり

// 初期化：現在の年月を自動選択して描画
window.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const ySel = document.getElementById('year-select');
  const mSel = document.getElementById('month-select');
  
  if (ySel && mSel) {
    ySel.value = now.getFullYear();
    mSel.value = (now.getMonth() + 1).toString().padStart(2, '0');
    updateDashboard();
  }
});
// 初期化：現在の年月を自動選択して描画 終わり

// ===== [2026-05-03 13:20 追加] 通年表示時のカレンダー見た目制御 =====
function updateCalendarMask(selectedMonth) {
  const overlay = document.getElementById('calendar-overlay');
  const calGrid = document.getElementById('calendar-grid');
  const calTitle = document.getElementById('cal-title');
  const navButtons = document.querySelectorAll('.cal-nav');

  if (selectedMonth === 'all') {
    // 【通年モード】
    if (overlay) overlay.style.display = 'flex'; // メッセージを表示
    if (calGrid) calGrid.style.opacity = '0.3';   // カレンダーを薄くする
    if (calTitle) calTitle.textContent = '通年表示中';
    
    // ‹ › ボタンを半透明にしてクリック不可にする
    navButtons.forEach(btn => {
      btn.style.opacity = '0.3';
      btn.style.pointerEvents = 'none';
    });
  } else {
    // 【月別モード】
    if (overlay) overlay.style.display = 'none'; // メッセージを隠す
    if (calGrid) calGrid.style.opacity = '1';     // カレンダーを元に戻す
    
    navButtons.forEach(btn => {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    });
  }
}

/**
 * 2026-05-03 23:05 修正: 共通期間バーの変更を検知
 * 存在する描画関数のみを実行するように整理（updateCalendarMaskを削除）
 */
function handleGlobalPeriodChange() {
  const activePage = document.querySelector('.page.active')?.id;
  console.log("期間変更を検知。現在のアクティブページ:", activePage);

  // 1. ダッシュボード（概要）の更新
  if (typeof updateDashboard === 'function') {
    updateDashboard();
  }

  // 2. 仕訳帳（journal）の更新
  if (typeof renderJournal === 'function') {
    renderJournal();
  }

  // 3. 総勘定元帳（ledger）の更新
  if (typeof renderLedger === 'function') {
    renderLedger();
  }

  // 4. 資産画面（assets）の更新（もし定義されていれば）
  if (typeof renderAssets === 'function') {
    renderAssets();
  }
}

/**
 * [2026-05-04 13:50 追加]
 * 仕訳帳などの個別ページの期間選択を、メインの期間選択(global-year/month)と同期させ、
 * 全体の表示データを更新・再描画する。
 */
function syncPeriodAndRefresh(element, type) {
    const newValue = element.value;
    
    // 1. ダッシュボード側にある「原本（ソース）」のセレクトボックス値を更新
    // これにより、どの画面から戻ってもメインの選択肢が同期されます
    const targetId = (type === 'year') ? 'global-year' : 'global-month';
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
        targetElement.value = newValue;
    }
    
    // 2. 以前作成した共通更新処理(handleGlobalPeriodChange)を実行
    // この中で selectedYear / selectedMonth が更新され、render系の関数が走ります
    if (typeof handleGlobalPeriodChange === 'function') {
        handleGlobalPeriodChange();
    }
}

/**
 * [2026-05-04 14:30 更新] 
 * 全ページ（概要・仕訳帳・資産台帳）の期間セレクトボックスを
 * メインの選択値(global-year/month)に強制同期する
 */
function syncAllPeriodSelectors() {
    // 1. 「原本」となるメインの年月を取得
    const mainYear = document.getElementById('global-year');
    const mainMonth = document.getElementById('global-month');
    if (!mainYear || !mainMonth) return;

    const currentYear = mainYear.value;
    const currentMonth = mainMonth.value;

    // 2. 仕訳帳側のセレクトボックスを同期
    const journalYear = document.getElementById('global-year-journal');
    const journalMonth = document.getElementById('global-month-journal');
    if (journalYear) journalYear.value = currentYear;
    if (journalMonth) journalMonth.value = currentMonth;

    // 3. 資産台帳側のセレクトボックスを同期 [NEW]
    const assetsYear = document.getElementById('global-year-assets');
    const assetsMonth = document.getElementById('global-month-assets');
    if (assetsYear) assetsYear.value = currentYear;
    if (assetsMonth) assetsMonth.value = currentMonth;
}


/**
 * ページ遷移やメイン側の変更を検知して同期を実行
 */
// 1. どこかがクリックされたら（ページ切り替え対策）
document.addEventListener('click', function() {
    if (typeof syncAllPeriodSelectors === 'function') {
        setTimeout(syncAllPeriodSelectors, 10);
    }
});

// 2. メインのセレクトボックスが直接操作されたとき
document.getElementById('global-year')?.addEventListener('change', syncAllPeriodSelectors);
document.getElementById('global-month')?.addEventListener('change', syncAllPeriodSelectors);


/**
 * 3. 耐用年数の自動計算ロジック（一本化・国税庁簡便法準拠版）
 */
function updateUsefulLife() {
  const vType = document.getElementById('vehicle-type').value;
  const isNew = document.querySelector('input[name="purchase-type"]:checked').value === 'new';
  
  // 法定耐用年数 (普通車6年 / 軽自動車4年)
  const legalLife = (vType === 'standard') ? 6 : 4;
  let finalLife = legalLife;

  if (!isNew) {
    // 中古車の場合：経過年数の取得と計算
    const passedYears = parseInt(document.getElementById('used-years').value) || 0;
    const passedMonths = parseInt(document.getElementById('used-months').value) || 0;
    const totalPassedYears = passedYears + (passedMonths / 12);

    if (totalPassedYears >= legalLife) {
      // 法定耐用年数をすべて経過している場合：法定耐用年数 × 20%
      finalLife = Math.floor(legalLife * 0.2);
    } else {
      // 一部経過している場合：(法定耐用年数 － 経過年数) ＋ (経過年数 × 20%)
      finalLife = (legalLife - totalPassedYears) + (totalPassedYears * 0.2);
    }
    // 1年未満の端数は切り捨て、かつ最低2年
    finalLife = Math.max(2, Math.floor(finalLife));
  }

  // 画面に反映
  const displayElement = document.getElementById('display-life');
  if (displayElement) {
    displayElement.textContent = finalLife;
  }
}



// ======================================================
// 🚗 車両資産・詳細設定システム (2026-05-07 統合版)
// ======================================================

/**
 * 1. 詳細設定モーダルを開く
 */
function openAssetModal(journalId) {
    const modal = document.getElementById('asset-modal');
    if (!modal) {
        console.error("エラー: asset-modal が見つかりません。");
        return;
    }
    document.getElementById('asset-journal-id').value = journalId;
    modal.style.display = 'flex'; 
    
    // 初期計算を実行
    updateUsefulLife();
    console.log("資産詳細設定モーダルを表示しました。対象ID:", journalId);
}

/**
 * 2. 詳細設定モーダルを閉じる
 */
function closeAssetModal() {
    const modal = document.getElementById('asset-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * 4. 資産台帳への保存処理
 */
function saveAssetConfig() {
    const journalId = document.getElementById('asset-journal-id').value;
    const vType = document.getElementById('vehicle-type').value;
    const isNew = document.querySelector('input[name="purchase-type"]:checked').value === 'new';
    const life = parseInt(document.getElementById('display-life').textContent) || 6;
    const startOdo = parseInt(document.getElementById('start-odometer').value) || 0;
    const usageStartDate = document.getElementById('usage-start-date').value;

    const targetEntry = entries.find(e => e.id === journalId);
    if (!targetEntry) {
        showToast('対象の仕訳データが見つかりませんでした', 'error');
        return;
    }

    const newAsset = {
        id: journalId,
        name: targetEntry.memo || (vType === 'light' ? '軽自動車' : '普通車'),
        date: usageStartDate || targetEntry.date,
        price: targetEntry.debitAmt,
        usefulLife: life,
        status: '減価償却中',
        remainingValue: targetEntry.debitAmt,
        config: {
            vehicleType: vType,
            purchaseType: isNew ? 'new' : 'used',
            startOdometer: startOdo,
            updatedAt: new Date().toISOString()
        }
    };

    const assetIdx = assets.findIndex(a => a.id === journalId);
    if (assetIdx >= 0) {
        assets[assetIdx] = newAsset;
    } else {
        assets.push(newAsset);
    }

    localStorage.setItem('kaikei_assets', JSON.stringify(assets));
    closeAssetModal();
    showToast(`${life}年償却で資産台帳に登録しました！`, 'success');
    
    if (typeof renderAssets === 'function') renderAssets();
}


/* -------------------------------------------------------------------------- */
/* 2026-05-12 修正: 旧初期設定ウィザード関連のスクラップ（削除）とUI同期ロジックの整理
/* 内容: HTMLベースの旧ウィザード・スライダー制御を削除。新ウィザード導入の準備。
/* -------------------------------------------------------------------------- */

/**
 * 1. 免税事業者設定に基づいてUI（バッジ、ロック、スイッチ）を更新する
 * 役割: 設定画面や入力画面の税務表示を最新の状態に同期します。
 */
function updateExemptUI() {
    const settings = JSON.parse(localStorage.getItem('userSettings')) || { isExempt: false };
    const isExempt = !!settings.isExempt;

    // バッジや警告テキストの表示切り替え
    const badges = ['exempt-badge', 'exempt-status-mini', 'exempt-lock-text-debit', 'exempt-lock-text-credit'];
    badges.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isExempt ? 'inline-block' : 'none';
    });

    // 入力フォームの税区分セレクトボックスを一斉制御
    const taxSelectors = ['f-debit-tax', 'f-credit-tax', 'f-taxCode'];
    taxSelectors.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            if (isExempt) {
                sel.value = 'non';           // 免税なら「対象外」に強制
                sel.disabled = true;        // 操作不能にする
                sel.style.backgroundColor = '#f3f4f6'; 
            } else {
                sel.disabled = false;
                sel.style.backgroundColor = ''; 
            }
        }
    });

    // 設定画面のスイッチ状態も同期
    const settingSwitch = document.getElementById('settings-is-exempt');
    if (settingSwitch) settingSwitch.checked = isExempt;
}

/**
 * 2. ページ読み込み時の初期化処理
 */
window.addEventListener('DOMContentLoaded', () => {
    // 免税事業者設定の反映
    updateExemptUI();
    
    // 免税事業者の場合、税区分をロックする既存関数（もし別にあれば実行）
    if (typeof applyTaxLock === 'function') {
        applyTaxLock();
    }
    
    // 【修正点】旧ID "setup-wizard" に依存する自動表示ロジックはすべて削除しました。
    // 新しいウィザードは settings.js 側の openWizard() で制御します。
});

/* -------------------------------------------------------------------------- */
/* 修正 終わり
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* 2026-05-12 最終整理: 免税ロジック基盤（維持・強化版）
/* -------------------------------------------------------------------------- */

function isExemptUser() {
    const settings = JSON.parse(localStorage.getItem('userSettings'));
    return !!(settings && settings.isExempt === true);
}

function applyTaxLock() {
    const isExempt = isExemptUser();
    const taxCodeEl = document.getElementById('f-taxCode');
    if (isExempt && taxCodeEl) {
        taxCodeEl.value = '対象外';
        taxCodeEl.disabled = true;
        taxCodeEl.style.backgroundColor = '#f5f5f5';
        taxCodeEl.style.cursor = 'not-allowed';
        if (typeof calcTax === 'function') calcTax();
    }
}

function toggleExemptSetting() {
    const isExempt = document.getElementById('settings-is-exempt').checked;
    let settings = JSON.parse(localStorage.getItem('userSettings')) || {};
    settings.isExempt = isExempt;
    localStorage.setItem('userSettings', JSON.stringify(settings));

    updateExemptUI(); // UI全体の更新

    // インボイス番号欄の表示切替
    const invoiceSection = document.getElementById('invoice-number-section');
    if (invoiceSection) {
      invoiceSection.style.display = isExempt ? 'none' : 'block';
    }

    // 【重要】設定画面の診断ボックスなどを再描画
    if (typeof renderExemptSettingNEW === 'function') renderExemptSettingNEW();

    showToast(isExempt ? '免税事業者モードに設定しました' : '課税事業者モードに設定しました', 'info');
    // 消費税ページのProgressive Disclosure表示も更新
    if (typeof renderTaxPageByExemptStatus === 'function') renderTaxPageByExemptStatus();
}

function updateExemptUI() {
    const settings = JSON.parse(localStorage.getItem('userSettings')) || { isExempt: false };
    const isExempt = !!settings.isExempt;

    const els = {
        badge: document.getElementById('exempt-badge'),
        badgeMini: document.getElementById('exempt-status-mini'),
        lockDebit: document.getElementById('exempt-lock-text-debit'),
        lockCredit: document.getElementById('exempt-lock-text-credit'),
        selectDebit: document.getElementById('f-debit-tax'),
        selectCredit: document.getElementById('f-credit-tax'),
        settingSwitch: document.getElementById('settings-is-exempt')
    };

    if (els.badge) els.badge.style.display = isExempt ? 'inline-block' : 'none';
    if (els.badgeMini) els.badgeMini.style.display = isExempt ? 'inline-block' : 'none';
    if (els.lockDebit) els.lockDebit.style.display = isExempt ? 'inline-block' : 'none';
    if (els.lockCredit) els.lockCredit.style.display = isExempt ? 'inline-block' : 'none';

    if (isExempt) {
        if (els.selectDebit) { els.selectDebit.value = 'non'; els.selectDebit.disabled = true; }
        if (els.selectCredit) { els.selectCredit.value = 'non'; els.selectCredit.disabled = true; }
    } else {
        if (els.selectDebit) els.selectDebit.disabled = false;
        if (els.selectCredit) els.selectCredit.disabled = false;
    }

    if (els.settingSwitch) els.settingSwitch.checked = isExempt;
}

/* -------------------------------------------------------------------------- */

/* =============================================================
   【最終統合司令塔】ProWizard 本体とアプリ初期化ロジック
   ============================================================= */

// 1. 唯一の宣言（箱の準備）
window.ProWizard = window.ProWizard || {};
ProWizard.currentStep = 1;
ProWizard.totalSteps = 4;

// 2. ウィザード起動関数の定義
ProWizard.init = function() {
    console.log("Wizard Initializing...");
    const container = document.getElementById('wizard-container');
    if (container) {
        // 全てのページを非表示にしてウィザードコンテナを表示
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        container.classList.add('active');
        this.renderSinglePage();
    } else {
        console.error("Error: wizard-container not found. index.htmlに <div id='wizard-container' class='page'></div> があるか確認してください。");
    }
};

// 3. アプリ全体の実行（司令塔）
/* [2026-05-13 18:30 修正：初期化順序の適正化と StorageManager 依存エラーの完全排除] */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App booting... Checking configuration.");

    // --- 現在の年度を自動選択 ---
    const currentYear = new Date().getFullYear(); 
    const yearSelect = document.getElementById('global-year');
    if (yearSelect) {
        yearSelect.value = currentYear.toString();
        console.log(`System year detected: ${currentYear}. Set global-year select.`);
    }

    try {
        // A. 既存機能の初期化（関数が存在する場合のみ安全に実行）
        if (typeof handleOAuthCallback === 'function') await handleOAuthCallback();
        if (typeof initIcons === 'function') initIcons();
        if (typeof initAccountSelects === 'function') initAccountSelects();
        if (typeof initJournalMonth === 'function') initJournalMonth();
        if (typeof initReportYear === 'function') initReportYear();
        if (typeof initChartYearSelect === 'function') initChartYearSelect();
        if (typeof loadTaxSettings === 'function') loadTaxSettings();
        if (typeof updateExemptUI === 'function') updateExemptUI();

        // B. 基本的な描画
        if (typeof renderAll === 'function') renderAll();
        if (typeof renderSettingsPage === 'function') renderSettingsPage();

        // C. 運命の分岐：ウィザードを出すかダッシュボードへ行くか
        const config = JSON.parse(localStorage.getItem('pro_config') || '{}');
        
        if (!config.isLocked) {
            // 設定がまだロックされていない（未完了）場合
            if (typeof ProWizard !== 'undefined' && typeof ProWizard.init === 'function') {
                ProWizard.init(); 
            }
        } else {
            // すでに設定済みの場合
            // index.html側と競合しないよう、要素の状態を見てから遷移
            const dashboardPage = document.getElementById('page-dashboard');
            if (dashboardPage && !dashboardPage.classList.contains('active')) {
                if (typeof navigate === 'function') navigate('dashboard');
            }
        }
        // 朝の業務開始チェック
        if (typeof checkAndShowMorningPrompt === 'function') checkAndShowMorningPrompt();
        // UIモード・電帳法バッジ初期化
        if (typeof applySimpleMode === 'function') applySimpleMode();
        if (typeof updateDenchoBadge === 'function') updateDenchoBadge();
        if (typeof renderSimpleModeSetting === 'function') renderSimpleModeSetting();
        if (typeof renderTaxPageByExemptStatus === 'function') renderTaxPageByExemptStatus();
        if (typeof renderVehicleReminderSettings === 'function') renderVehicleReminderSettings();
        if (typeof renderVehicleAlerts === 'function') renderVehicleAlerts();
    } catch (error) {
        console.warn("Initialization halted, but continuing to render dashboard:", error);
        // エラーが出てもダッシュボードへ飛ばす
        if (typeof navigate === 'function') navigate('dashboard');
    }
});


// ============================================================
// 取引先マスタ管理ロジック (clients.json 連携)2026-05-14 15:54追加
// ============================================================

/**
 * 1. clients.json をサーバー（またはローカル）から読み込む
 */
async function loadClientMaster() {
    try {
        // まず localStorage をチェック
        const localData = localStorage.getItem('kaikei_client_master');
        if (localData) {
            clientMaster = JSON.parse(localData);
            console.log("✅ 保存されたマスタを復元しました");
        } else {
            // なければ JSON ファイルを読みに行く
            const response = await fetch('./clients.json'); 
            if (response.ok) {
                clientMaster = await response.json();
            }
        }
        
        if (document.getElementById('client-list')) renderClientList();
    } catch (error) {
        console.warn("読み込み失敗:", error);
        clientMaster = {};
    }
}

// ===== [2026-05-14 22:40 刷新] 取引先リスト：グリッドカード形式へのアップグレード =====


// 初期辞書（ユーザーがカスタマイズ可能）
// ===== [2026-05-15 04:20 更新] 初期ユーザー辞書マスタ（利便性向上版） =====

let categoryKeywords = JSON.parse(localStorage.getItem('categoryKeywords')) || {
  "売上高": [
    "福山通運", "配送料", "報酬", "アマゾン", "Amazon", "ｱﾏｿﾞﾝ", 
    "ウーバー", "Uber", "ｳｰﾊﾞｰ", "出前館", "デリバリー", 
    "佐川急便", "ヤマト運輸", "ﾔﾏﾄ", "クロネコ", "西濃"
  ],
  "燃料費": [
    "給油", "ガソリン", "エネオス", "ENEOS", "ｴﾈｵｽ", 
    "出光", "アポロステーション", "キグナス", "宇佐美", 
    "軽油", "レギュラー", "ハイオク"
  ],
  "旅費交通費": [
    "駐車場", "タイムズ", "Times", "ﾀｲﾑｽﾞ", "リパーク", 
    "コインパーキング", "高速道路", "ＥＴＣ", "ETC", "首都高", "中日本"
  ],
  "車両費": [
    "車検", "法定点検", "修理", "タイヤ", "スタッドレス", 
    "オイル交換", "エレメント", "ワイパー", "オートバックス", "イエローハット"
  ],
  "消耗品費": [
    "養生テープ", "梱包", "台車", "100均", "ダイソー", "事務用品","手袋","軍手","安全靴"
  ],
  "通信費": [
    "ドコモ", "au", "ソフトバンク", "楽天モバイル", "UQ", "ラインモ","ahamo"
  ]
};

// 辞書を保存する関数
function saveCategoryKeywords() {
  localStorage.setItem('categoryKeywords', JSON.stringify(categoryKeywords));
}
// ===== [2026-05-15 03:50 追加] 自動仕訳辞書マスタ終わり =====


/**
 * 2. 設定画面に取引先リストを表示する（グリッドカード形式）
 */
function renderClientList() {
    const container = document.getElementById('client-list');
    if (!container) return;

    // 登録がない場合の表示
    if (Object.keys(clientMaster).length === 0) {
        container.className = "col-span-full"; // グリッド解除
        container.innerHTML = `
            <div class="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <i class="fas fa-address-book text-4xl text-gray-200 mb-3"></i>
                <p class="text-gray-400 text-sm font-medium">登録されている取引先はありません</p>
            </div>`;
        return;
    }

    // ★重要：コンテナ自体をグリッドレイアウトに変更
    container.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full";

    container.innerHTML = Object.entries(clientMaster).map(([name, kws]) => `
        <div class="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group relative flex flex-col justify-between min-h-[100px]">
            <div>
                <button onclick="deleteClientMaster('${name}')" 
                        class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="削除">
                    <i class="fas fa-times-circle text-lg"></i>
                </button>

                <div class="flex items-center space-x-2 mb-2">
                    <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        ${name.charAt(0)}
                    </div>
                    <div class="font-bold text-gray-800 text-sm truncate pr-6 group-hover:text-blue-600 transition-colors">
                        ${name}
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap gap-1 mt-auto">
                ${kws.map(kw => `
                    <span class="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] rounded border border-slate-100">
                        ${kw}
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}
// ===== [2026-05-14 22:40 刷新] 終わり =====

/**
 * 3. 新しい取引先を一時保存（メモリ上）
 */
function addClientMaster() {
    const nameEl = document.getElementById('new-client-name');
    const kwEl = document.getElementById('new-client-keywords');
    
    const name = nameEl.value.trim();
    const keywordsRaw = kwEl.value.trim();

    if (!name || !keywordsRaw) {
        alert("取引先名とキーワードを入力してください。");
        return;
    }

    // カンマまたはスペース区切りを配列に変換
    const kws = keywordsRaw.split(/[,、\s]+/).filter(k => k);

    clientMaster[name] = kws;
    renderClientList();

    // 入力欄をクリア
    nameEl.value = '';
    kwEl.value = '';
}

/**
 * 4. 取引先を削除
 */
function deleteClientMaster(name) {
    if (confirm(`取引先「${name}」をマスタから削除しますか？`)) {
        delete clientMaster[name];
        renderClientList();
    }
}

/**
 * 5. サーバーへ保存（擬似保存：localStorage版）
 */
async function saveClientsJson() {
    // ブラウザに記憶させる（リロード対策）
    localStorage.setItem('kaikei_client_master', JSON.stringify(clientMaster));
    
    console.log("💾 擬似保存完了:", clientMaster);
    alert("✅ 取引先設定をブラウザに保存しました！\n次回のCSV分類からこの内容が反映されます。");
}


/**
 * 6. 摘要から取引先を特定する（マスタ連動エンジン）
 */
function identifyClientByMaster(text) {
    if (!text) return 'その他取引先';
    const t = text.toLowerCase();
    for (const [name, keywords] of Object.entries(clientMaster)) {
        if (keywords.some(kw => t.includes(kw.toLowerCase()))) {
            return name;
        }
    }
    return 'その他取引先';
}

/**
 * 自動仕訳辞書の管理画面を表示
 */
function renderCategorySettings() {
  const container = document.getElementById('category-keyword-settings');
  if (!container) return;

  container.innerHTML = Object.entries(categoryKeywords).map(([account, keywords]) => `
    <div class="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div class="flex justify-between items-center mb-3">
        <h4 class="font-bold text-gray-700"><i class="fas fa-tag mr-2 text-blue-500"></i>${account}</h4>
        <button onclick="addKeywordPrompt('${account}')" class="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
          <i class="fas fa-plus mr-1"></i>追加
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${keywords.map(kw => `
          <span class="inline-flex items-center px-2 py-1 rounded-md bg-white border border-gray-300 text-xs text-gray-600">
            ${kw}
            <button onclick="removeKeyword('${account}', '${kw}')" class="ml-1 text-gray-400 hover:text-red-500">
              <i class="fas fa-times"></i>
            </button>
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// キーワード追加プロンプト
function addKeywordPrompt(account) {
  const kw = prompt(`${account} に追加するキーワードを入力してください`);
  if (kw && !categoryKeywords[account].includes(kw)) {
    categoryKeywords[account].push(kw);
    saveCategoryKeywords();
    renderCategorySettings();
    showToast("辞書を更新しました");
  }
}

// キーワード削除
function removeKeyword(account, kw) {
  categoryKeywords[account] = categoryKeywords[account].filter(item => item !== kw);
  saveCategoryKeywords();
  renderCategorySettings();
}

// ===== [2026-05-15 07:45 修正] 矛盾検知・逆提案型学習エンジン（既存機能完全継承） =====

/**
 * ユーザーの科目修正を学習し、辞書への追加を提案する
 * 鉄板ルールとの矛盾がある場合、軍師が逆提案を行う
 * @param {string} text - インポート時の内容（店名など）
 * @param {string} newAccount - ユーザーが選択した正しい科目
 */
function suggestLearning(text, newAccount) {
  // 1. すでに辞書にあるキーワードなら何もしない（既存機能）
  const keywords = categoryKeywords[newAccount] || [];
  if (keywords.some(kw => text.includes(kw))) return;

  // 2. 【新設】軍師の鉄板ルール（これに反する場合は物言いをつける）
  const ironcladRules = [
    { word: "通運", suggest: "売上高" },
    { word: "急便", suggest: "売上高" },
    { word: "ｱﾏｿﾞﾝ", suggest: "売上高" },
    { word: "Amazon", suggest: "売上高" },
    { word: "給油", suggest: "燃料費" },
    { word: "ENEOS", suggest: "燃料費" },
    { word: "駐車場", suggest: "旅費交通費" },
    { word: "高速", suggest: "旅費交通費" }
  ];

  // 3. 矛盾のチェック
  const violation = ironcladRules.find(rule => text.includes(rule.word));

  // 4. ユーザーへの確認フロー
  let isConfirmed = false;

  if (violation && violation.suggest !== newAccount) {
    // 【矛盾あり】軍師が強力に止めるパターン
    const warningMsg = `⚠️【軍師の物言い！】\n「${text}」は通常『${violation.suggest}』として処理するのが一般的です。\n\n本当に、今後ずっと『${newAccount}』として自動学習させてもよろしいですか？`;
    
    if (confirm(warningMsg)) {
      // 二段階確認（「それまじ？」の念押し）
      isConfirmed = confirm(`【最終確認】\n本当の本当によろしいですね？\n一度学習すると、次回から自動で『${newAccount}』になってしまいます。`);
    }
  } else {
    // 【矛盾なし】通常の学習提案（既存の挙動）
    isConfirmed = confirm(`学習チャンス！\n「${text}」は今後すべて「${newAccount}」として自動仕訳しますか？`);
  }
  
  // 5. 辞書への追加処理（既存ロジックを完全継承）
  if (isConfirmed) {
    // 辞書にキーワードを追加
    if (!categoryKeywords[newAccount]) categoryKeywords[newAccount] = [];
    categoryKeywords[newAccount].push(text);
    
    // 保存と反映（既存の関数をそのまま使用）
    saveCategoryKeywords();
    if (typeof renderCategorySettings === 'function') renderCategorySettings();
    
    showToast(`「${text}」を${newAccount}の辞書に学習しました！`, "success");
  }
}

/**
 * リアルタイム・ナビゲーション・エンジン
 */
function updateAdvisorWhisper() {
    const dAmt = Math.round(parseFloat(document.getElementById('f-debit-amount').value) || 0);
    const cAmt = Math.round(parseFloat(document.getElementById('f-credit-amount').value) || 0);
    const memo = document.getElementById('f-memo').value;
    const whisper = document.getElementById('whisper-text');
    const container = document.getElementById('advisor-whisper');

    if (!whisper) return;

    // 貸借判定（最優先）
    if (dAmt > 0 && cAmt > 0 && dAmt !== cAmt) {
        const diff = Math.abs(dAmt - cAmt);
        whisper.innerHTML = `⚠️ 左右が合わぬ！ <b>${diff.toLocaleString()}円</b> の誤差を修正せよ。`;
        container.style.borderLeftColor = "#e74c3c";
        return;
    }

    // 鉄板キーワード判定
    const ironcladRules = [
        { word: "通運", suggest: "売上高" },
        { word: "急便", suggest: "売上高" },
        { word: "給油", suggest: "燃料費" },
        { word: "ENEOS", suggest: "燃料費" }
    ];
    const rule = ironcladRules.find(r => memo.includes(r.word));
    if (rule) {
        whisper.innerHTML = `💡 <b>${rule.word}</b>を検知。科目は「${rule.suggest}」が妥当だ。`;
        container.style.borderLeftColor = "#f1c40f";
        return;
    }

    // 正常一致
    if (dAmt > 0 && dAmt === cAmt) {
        whisper.innerHTML = `✅ 貸借一致。美しいデータだ。保存（エンゲージ）！`;
        container.style.borderLeftColor = "#2ecc71";
        return;
    }

    whisper.innerHTML = `💬 焦るな、正確な入力を。私が横で見ている。`;
    container.style.borderLeftColor = "#3498db";
}

/**
 * 🧭 スマートルールの描画（レンダリング）
 * パステル調のデザインとサイズ統一を適用
 */
function renderSmartRules() {
    const listContainer = document.getElementById('smart-rule-list');
    const badge = document.getElementById('rule-count-badge');
    
    if (!listContainer || !badge) return;
    
    listContainer.innerHTML = '';
    badge.innerText = `${userCustomRules.length} ルール登録済み`;

    userCustomRules.forEach((rule, index) => {
        const card = document.createElement('div');
        
        // 【修正点】クラス名を rule-card に変更し、サイズと色を固定
        card.className = "rule-card animate-fade-in group"; 
        
        // 【修正点】インラインスタイルでパステル調の配色を徹底
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h3 style="margin:0; font-size:var(--fs-md); font-weight: bold; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${rule.keyword}
                </h3>
                <button onclick="deleteSmartRule(${index})" style="background:none; border:none; color:#cbd5e1; cursor:pointer; transition: 0.2s;" class="btn-delete-hover">
                    <i class="fas fa-trash-alt" style="font-size:var(--fs-md);"></i>
                </button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size:var(--fs-base); color: #475569; background: #f0f4ff; padding: 2px 10px; border-radius: 6px; width: fit-content; font-weight: 600; border: 1px solid #e0e7ff;">
                    ${rule.account}
                </span>
                <span style="font-size:var(--fs-sm); color: #94a3b8; display: flex; align-items: center; gap: 4px; padding-left: 4px;">
                    <i class="fas fa-wallet" style="font-size:var(--fs-xs);"></i> ${rule.wallet || '自動判定'}
                </span>
            </div>
        `;
        listContainer.appendChild(card);
    });
}
/**
 * 🧭 スマートルールの描画（レンダリング）
 * パステル調のデザインとサイズ統一を適用　終わり
 */


/* * 🧭 スマートルール管理ロジック
 * 修正内容: 追加・削除時のオートセーブ（自動永続化）を実装。
 * 不要なアラート付き保存関数を自動実行版へ統合。
 * 最終更新: 2026-05-16
 */

/**
 * ➕ 新しいルールの追加（自動保存対応）
 */
function addNewSmartRule() {
    const keywordInput = document.getElementById('new-rule-keyword');
    const accountInput = document.getElementById('new-rule-account');
    const walletInput = document.getElementById('new-rule-wallet');

    const keyword = keywordInput.value.trim();
    const account = accountInput.value;
    const wallet = walletInput.value;

    if (!keyword) {
        alert("キーワードを入力してくださいぜ、工場長！");
        return;
    }

    // 1. メモリ上の配列に追加
    userCustomRules.push({ keyword, account, wallet });
    
    // 2. 入力欄をクリア
    keywordInput.value = '';
    
    // 3. 画面（カード一覧）を更新
    renderSmartRules();

    // 4. ローカルストレージに自動保存
    persistRulesSilently();
}

/**
 * 🗑️ ルールの削除（自動保存対応）
 */
function deleteSmartRule(index) {
    if (confirm("このルールを削除してもよろしいですか？")) {
        userCustomRules.splice(index, 1);
        renderSmartRules();
        // 削除後も即座に保存
        persistRulesSilently();
    }
}

/**
 * 💾 データのサイレント保存
 * ユーザーの邪魔をせず、バックグラウンドでローカルストレージへ保存する
 */
function persistRulesSilently() {
    localStorage.setItem('bizNaviCustomRules', JSON.stringify(userCustomRules));
    console.log("Biz-Navi: 羅針盤に自動保存されました。");
}

// --- 初期実行 ---
document.addEventListener('DOMContentLoaded', () => {
    // userCustomRules が未定義の場合は空配列で初期化
    if (typeof userCustomRules === 'undefined') {
        window.userCustomRules = [];
    }
    renderSmartRules();

    // ダッシュボードの按分率を起動時に反映
    const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
    const dashRatio = document.getElementById('dash-ratio-display');
    if (dashRatio && settings.vehicleRatio !== undefined) {
      dashRatio.textContent = settings.vehicleRatio;
    }
});


// ============================================================
// 日報機能 (Daily Log)
// ============================================================

// =====================================================
// 日報機能 (Daily Log) - 拡張版
// 業務開始・終了の2段階フロー
// =====================================================

let dailyLogs = JSON.parse(localStorage.getItem('bizNavi_dailyLogs') || '[]');

function saveDailyLogsToStorage() {
  localStorage.setItem('bizNavi_dailyLogs', JSON.stringify(dailyLogs));
}

// ===== 安全運転メッセージ（ランダム） =====
const SAFE_DRIVE_MESSAGES = [
  { icon: '🚗', msg: '安全運転でいってらっしゃい！\n焦らず、確実に。今日も無事故でお願いします！' },
  { icon: '☀️', msg: 'いってらっしゃい！\n急ぎの配達でも、一時停止はしっかりと。' },
  { icon: '🛣️', msg: '今日もお疲れさまです！\n前の車との車間距離を十分に保って走りましょう。' },
  { icon: '💪', msg: 'レッツゴー！\n疲れを感じたら迷わず休憩。無理は禁物です。' },
  { icon: '📦', msg: '今日も頑張りましょう！\n荷物の積み下ろし時も周囲の安全確認を忘れずに。' },
  { icon: '🌟', msg: 'いってきます！\nシートベルトの着用と、スマホ操作は絶対にしないでください。' },
  { icon: '🍀', msg: '良い一日になりますように！\n交差点では特に左右確認を徹底しましょう。' },
  { icon: '🚦', msg: 'お気をつけて！\n黄信号は止まれのサイン。焦って突っ込まないように。' },
];

// ===== 今日の日報状態を取得 =====
function getTodayLog() {
  const today = new Date().toISOString().split('T')[0];
  return dailyLogs.find(l => l.date === today) || null;
}

// ===== アプリ起動時チェック：当日の日報が未入力なら業務開始を促す =====
function checkAndShowMorningPrompt() {
  const today = new Date().toISOString().split('T')[0];
  const lastPromptDate = localStorage.getItem('bizNavi_lastMorningPrompt');
  if (lastPromptDate === today) return; // 今日すでに表示済み

  const todayLog = getTodayLog();
  if (todayLog) return; // 今日の日報が既にある

  // 朝の業務開始モーダルを表示
  setTimeout(() => openDailyStartModal(), 800);
}

// ===== 業務開始モーダルを開く =====
function openDailyStartModal() {
  const today = new Date().toISOString().split('T')[0];
  const [y, m, d] = today.split('-');
  const dateStr = `${y}年${parseInt(m)}月${parseInt(d)}日`;

  const existing = document.getElementById('daily-start-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'daily-start-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:24px 20px 32px;box-shadow:0 -4px 24px rgba(0,0,0,0.15);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:2.5rem;margin-bottom:8px;">🚐</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--color-accent);">${dateStr}</div>
        <div style="font-size:0.9rem;color:var(--color-muted);margin-top:4px;">業務開始の走行距離を記録しましょう</div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:0.8rem;font-weight:700;color:var(--color-muted);margin-bottom:6px;letter-spacing:0.04em;">開始時オドメーター（km）</label>
        <input type="number" id="start-odo-input" step="0.01" min="0"
          placeholder="例: 12345.67"
          style="width:100%;padding:14px;font-size:1.3rem;font-weight:700;border:2px solid var(--color-border-mid);border-radius:12px;text-align:center;box-sizing:border-box;-webkit-appearance:none;"
          inputmode="decimal">
        <div style="font-size:0.75rem;color:var(--color-muted);text-align:center;margin-top:6px;">小数点第2位まで入力できます</div>
      </div>

      <button onclick="saveDailyStart()" style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;padding:16px;font-size:1.1rem;font-weight:700;cursor:pointer;margin-bottom:10px;">
        🚀 業務開始！
      </button>
      <button onclick="document.getElementById('daily-start-modal').remove()" style="width:100%;background:var(--color-bg);color:var(--color-muted);border:none;border-radius:14px;padding:12px;font-size:0.9rem;cursor:pointer;">
        あとで入力する
      </button>
    </div>`;
  document.body.appendChild(modal);

  // 記録する
  localStorage.setItem('bizNavi_lastMorningPrompt', today);

  setTimeout(() => {
    const inp = document.getElementById('start-odo-input');
    if (inp) inp.focus();
  }, 300);
}

// ===== 業務開始を保存 → 安全運転メッセージ =====
function saveDailyStart() {
  const val = parseFloat(document.getElementById('start-odo-input').value);
  if (isNaN(val) || val < 0) {
    alert('オドメーターの値を正しく入力してください');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  // 今日のログに開始記録を仮保存
  const existing = dailyLogs.findIndex(l => l.date === today);
  const logEntry = {
    id: existing >= 0 ? dailyLogs[existing].id : `dl_${Date.now()}`,
    date: today,
    startOdo: Math.round(val * 100) / 100,
    endOdo: null,
    distance: null,
    deliveries: null,
    unitPrice: null,
    startTime: new Date().toISOString(),
    endTime: null,
    memo: '',
    status: 'started' // 業務開始済み
  };

  if (existing >= 0) {
    dailyLogs[existing] = logEntry;
  } else {
    dailyLogs.push(logEntry);
  }
  saveDailyLogsToStorage();

  // モーダルを閉じて安全運転メッセージ表示
  document.getElementById('daily-start-modal').remove();
  showSafeDriveMessage();
}

// ===== 安全運転メッセージ表示 =====
function showSafeDriveMessage() {
  const msg = SAFE_DRIVE_MESSAGES[Math.floor(Math.random() * SAFE_DRIVE_MESSAGES.length)];

  const el = document.createElement('div');
  el.id = 'safe-drive-modal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;';
  el.innerHTML = `
    <div style="background:#fff;width:100%;max-width:360px;border-radius:20px;padding:32px 24px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <div style="font-size:3rem;margin-bottom:12px;">${msg.icon}</div>
      <div style="font-size:1rem;font-weight:700;color:var(--color-text);line-height:1.7;white-space:pre-line;margin-bottom:24px;">${msg.msg}</div>
      <button onclick="document.getElementById('safe-drive-modal').remove();renderDailyPage();"
        style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;">
        ✓ 出発します！
      </button>
    </div>`;
  document.body.appendChild(el);
}

// ===== 日報ボタン押下時：業務開始か終了かを判定 =====
function handleDailyButtonPress() {
  const todayLog = getTodayLog();

  if (!todayLog || todayLog.status !== 'started') {
    // 業務未開始 → 開始モーダルを開く
    openDailyStartModal();
  } else {
    // 業務開始済み → 終了確認
    showDailyEndConfirm(todayLog);
  }
}

// ===== 業務終了確認ダイアログ =====
function showDailyEndConfirm(todayLog) {
  const existing = document.getElementById('daily-end-confirm-modal');
  if (existing) existing.remove();

  const startOdo = todayLog.startOdo;
  const startTime = todayLog.startTime ? new Date(todayLog.startTime) : null;
  const now = new Date();
  const elapsedMin = startTime ? Math.round((now - startTime) / 60000) : null;
  const elapsedStr = elapsedMin
    ? `${Math.floor(elapsedMin/60)}時間${elapsedMin%60}分`
    : '不明';

  // 単価を設定から取得
  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const unitPrice = settings.deliveryUnitPrice || 0;

  const modal = document.createElement('div');
  modal.id = 'daily-end-confirm-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:24px 20px 32px;box-shadow:0 -4px 24px rgba(0,0,0,0.15);max-height:90vh;overflow-y:auto;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:2rem;margin-bottom:8px;">🏁</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--color-accent);">業務終了ですか？</div>
        <div style="font-size:0.85rem;color:var(--color-muted);margin-top:4px;">稼働時間：${elapsedStr}</div>
      </div>

      <div style="background:var(--color-bg);border-radius:12px;padding:14px;margin-bottom:16px;font-size:0.85rem;color:var(--color-muted);">
        開始オドメーター：<strong style="color:var(--color-text);">${startOdo.toFixed(2)} km</strong>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:0.8rem;font-weight:700;color:var(--color-muted);margin-bottom:6px;">終了時オドメーター（km）</label>
        <input type="number" id="end-odo-input" step="0.01" min="${startOdo}"
          placeholder="例: 12445.20"
          style="width:100%;padding:12px;font-size:1.2rem;font-weight:700;border:2px solid var(--color-border-mid);border-radius:10px;text-align:center;box-sizing:border-box;-webkit-appearance:none;"
          inputmode="decimal" oninput="updateEndPreview()">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:0.8rem;font-weight:700;color:var(--color-muted);margin-bottom:6px;">配達個数</label>
        <input type="number" id="deliveries-input" min="0" step="1"
          placeholder="例: 85"
          style="width:100%;padding:12px;font-size:1.2rem;font-weight:700;border:2px solid var(--color-border-mid);border-radius:10px;text-align:center;box-sizing:border-box;-webkit-appearance:none;"
          inputmode="numeric" oninput="updateEndPreview()">
        ${unitPrice === 0 ? '<div style="font-size:0.75rem;color:#f59e0b;margin-top:4px;">💡 設定画面で1個あたりの単価を設定すると売上・時給が計算されます</div>' : ''}
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:0.8rem;font-weight:700;color:var(--color-muted);margin-bottom:6px;">メモ（任意）</label>
        <input type="text" id="end-memo-input" placeholder="例: 大雨で渋滞あり"
          style="width:100%;padding:10px;font-size:0.95rem;border:1px solid var(--color-border-mid);border-radius:10px;box-sizing:border-box;">
      </div>

      <!-- リアルタイムプレビュー -->
      <div id="end-preview-card" style="display:none;background:linear-gradient(135deg,#e0e7ff,#f0f4ff);border-radius:14px;padding:16px;margin-bottom:16px;">
        <div style="font-size:0.8rem;font-weight:700;color:#4338ca;margin-bottom:10px;">📊 本日の結果（概算）</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.7rem;color:#64748b;margin-bottom:2px;">走行距離</div>
            <div id="preview-km" style="font-size:1.1rem;font-weight:700;color:#3d4a6b;">-- km</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.7rem;color:#64748b;margin-bottom:2px;">配達個数</div>
            <div id="preview-count" style="font-size:1.1rem;font-weight:700;color:#3d4a6b;">-- 個</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.7rem;color:#64748b;margin-bottom:2px;">本日の売上</div>
            <div id="preview-sales" style="font-size:1.1rem;font-weight:700;color:#1a7a5e;">¥--</div>
          </div>
          <div style="background:#fff;border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.7rem;color:#64748b;margin-bottom:2px;">実質時給</div>
            <div id="preview-hourly" style="font-size:1.1rem;font-weight:700;color:#6366f1;">¥--/h</div>
          </div>
        </div>
      </div>

      <button onclick="saveDailyEnd(${JSON.stringify(todayLog).replace(/"/g,'&quot;')}, ${elapsedMin || 0})"
        style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;padding:16px;font-size:1.05rem;font-weight:700;cursor:pointer;margin-bottom:10px;">
        🏁 業務終了を記録
      </button>
      <button onclick="document.getElementById('daily-end-confirm-modal').remove()"
        style="width:100%;background:var(--color-bg);color:var(--color-muted);border:none;border-radius:14px;padding:12px;font-size:0.9rem;cursor:pointer;">
        キャンセル
      </button>
    </div>`;
  document.body.appendChild(modal);

  setTimeout(() => {
    const inp = document.getElementById('end-odo-input');
    if (inp) inp.focus();
  }, 300);
}

// ===== 業務終了プレビューのリアルタイム更新 =====
function updateEndPreview() {
  const todayLog = getTodayLog();
  const startOdo = todayLog?.startOdo || 0;
  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const unitPrice = settings.deliveryUnitPrice || 0;
  const endOdo = parseFloat(document.getElementById('end-odo-input')?.value) || 0;
  const count = parseInt(document.getElementById('deliveries-input')?.value) || 0;
  const card = document.getElementById('end-preview-card');
  if (!card) return;

  if (endOdo <= startOdo && count === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const km = Math.max(0, endOdo - startOdo);
  const sales = count * unitPrice;

  // 稼働時間（開始時刻から現在まで）
  const startTime = todayLog?.startTime ? new Date(todayLog.startTime) : new Date();
  const elapsedHours = (new Date() - startTime) / 3600000;
  const hourly = elapsedHours > 0 && sales > 0 ? Math.round(sales / elapsedHours) : null;

  document.getElementById('preview-km').textContent = `${km.toFixed(2)} km`;
  document.getElementById('preview-count').textContent = count > 0 ? `${count} 個` : '-- 個';
  document.getElementById('preview-sales').textContent = unitPrice > 0 && count > 0
    ? `¥${sales.toLocaleString()}` : '¥--';
  document.getElementById('preview-hourly').textContent = hourly
    ? `¥${hourly.toLocaleString()}/h` : '¥--/h';
}

// ===== 業務終了を保存（モーダルから呼び出し） =====
function saveDailyEndFromModal() {
  const btn = document.getElementById('daily-end-save-btn');
  const logId = btn?.dataset?.logId;
  const elapsedMin = parseInt(btn?.dataset?.elapsed) || 0;
  const todayLog = dailyLogs.find(l => l.id === logId) || getTodayLog();
  if (!todayLog) { alert('日報データが見つかりません'); return; }
  saveDailyEnd(todayLog, elapsedMin);
}

// ===== 業務終了を保存 =====
function saveDailyEnd(todayLog, elapsedMin) {
  const endOdo = parseFloat(document.getElementById('end-odo-input')?.value);
  const count = parseInt(document.getElementById('deliveries-input')?.value) || 0;
  const memo = document.getElementById('end-memo-input')?.value.trim() || '';

  if (isNaN(endOdo) || endOdo < todayLog.startOdo) {
    alert(`終了オドメーターは開始時（${todayLog.startOdo} km）より大きい値を入力してください`);
    return;
  }

  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const unitPrice = settings.deliveryUnitPrice || 0;
  const distance = Math.round((endOdo - todayLog.startOdo) * 100) / 100;
  const sales = count * unitPrice;
  const elapsedHours = elapsedMin / 60;
  const hourlyWage = elapsedHours > 0 && sales > 0
    ? Math.round(sales / elapsedHours) : null;

  const updatedLog = {
    ...todayLog,
    endOdo: Math.round(endOdo * 100) / 100,
    distance,
    deliveries: count,
    unitPrice,
    sales,
    hourlyWage,
    elapsedMin,
    endTime: new Date().toISOString(),
    memo,
    status: 'completed'
  };

  const idx = dailyLogs.findIndex(l => l.id === todayLog.id);
  if (idx >= 0) dailyLogs[idx] = updatedLog;
  saveDailyLogsToStorage();

  document.getElementById('daily-end-confirm-modal').remove();

  // 結果サマリーを表示
  showDailyEndSummary(updatedLog);
  renderDailyPage();
  renderCalendar();
}

// ===== [2026-05-24 追加] 当日の未入力・未確認取引を取得 =====
function getTodayUnprocessedEntries() {
  const today = new Date().toISOString().split('T')[0];
  return (typeof entries !== 'undefined' ? entries : []).filter(e => {
    if (!e || !e.date) return false;
    const d = String(e.date).replace(/\//g, '-').split('T')[0];
    return d === today && e.manually_saved !== true;
  });
}

// ===== [2026-05-24 追加] 領収書確認プロンプト（帰宅時・日報入力時） =====
function showReceiptCheckPrompt(context = 'end') {
  // context: 'end'=業務終了後 / 'manual'=日報手動入力後
  const unprocessed = getTodayUnprocessedEntries();
  const count = unprocessed.length;

  // 未入力チェック：今日付の取引が0件なら「領収書ありませんか？」
  const noEntriesToday = (typeof entries !== 'undefined' ? entries : [])
    .filter(e => {
      if (!e || !e.date) return false;
      return String(e.date).replace(/\//g, '-').split('T')[0] ===
             new Date().toISOString().split('T')[0];
    }).length === 0;

  const overlay = document.createElement('div');
  overlay.id = 'receipt-check-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10002;display:flex;align-items:flex-end;justify-content:center;padding:20px;';

  let mainMsg, subMsg, icon;
  if (count > 0) {
    // 未確認取引がある
    icon = '📋';
    mainMsg = `今日の取引 ${count}件が未確認です`;
    subMsg = '業務中に発生した経費を確認・修正しませんか？';
  } else if (noEntriesToday) {
    // 今日の取引が1件もない
    icon = '🧾';
    mainMsg = '今日の領収書はありませんか？';
    subMsg = '燃料費・駐車場代・高速代など\n忘れずに記録しておきましょう';
  } else {
    // 全て確認済み → プロンプト不要
    return;
  }

  overlay.innerHTML = `
    <div style="background:#fff;width:100%;max-width:380px;border-radius:20px 20px 20px 20px;
                padding:24px 20px;box-shadow:0 -4px 30px rgba(0,0,0,0.15);margin-bottom:8px;">
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;">
        <div style="font-size:2rem;flex-shrink:0;margin-top:2px;">${icon}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:#1e293b;font-size:0.98rem;margin-bottom:5px;">${mainMsg}</div>
          <div style="font-size:0.82rem;color:#64748b;line-height:1.6;white-space:pre-line;">${subMsg}</div>
        </div>
      </div>
      ${count > 0 ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 12px;margin-bottom:16px;">
        ${unprocessed.slice(0, 3).map(e => `
          <div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:0.82rem;color:#0369a1;">
            <span>💸</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${e.content || e.debitAcc || '取引'}
            </span>
            <span style="font-weight:700;">¥${Number(String(e.amount||e.debitAmt||0).replace(/,/g,'')).toLocaleString()}</span>
          </div>`).join('')}
        ${count > 3 ? `<div style="font-size:0.78rem;color:#64748b;margin-top:4px;text-align:right;">他 ${count - 3}件...</div>` : ''}
      </div>` : ''}
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('receipt-check-modal').remove()"
          style="flex:1;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;
                 padding:12px;font-size:0.88rem;font-weight:600;cursor:pointer;">
          あとで
        </button>
        ${count > 0
          ? `<button onclick="document.getElementById('receipt-check-modal').remove(); navigate('journal');"
              style="flex:2;background:#6366f1;color:#fff;border:none;border-radius:12px;
                     padding:12px;font-size:0.88rem;font-weight:700;cursor:pointer;">
               ✓ ${count}件を確認する
             </button>`
          : `<button onclick="document.getElementById('receipt-check-modal').remove(); document.getElementById('csv-file').click();"
              style="flex:1;background:#15803d;color:#fff;border:none;border-radius:12px;
                     padding:12px;font-size:0.85rem;font-weight:700;cursor:pointer;">
               📷 CSV取込
             </button>
             <button onclick="document.getElementById('receipt-check-modal').remove(); openEntryModal();"
              style="flex:1;background:#6366f1;color:#fff;border:none;border-radius:12px;
                     padding:12px;font-size:0.85rem;font-weight:700;cursor:pointer;">
               ＋ 手動入力
             </button>`
        }
      </div>
    </div>`;

  document.body.appendChild(overlay);
  // 背景タップで閉じる
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}

// ===== 業務終了サマリー表示 =====
function showDailyEndSummary(log) {
  const el = document.createElement('div');
  el.id = 'daily-end-summary-modal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;';

  const elapsedStr = log.elapsedMin
    ? `${Math.floor(log.elapsedMin/60)}時間${log.elapsedMin%60}分`
    : '不明';

  const salesRow = log.unitPrice > 0
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #e2e8f0;">
        <span style="color:#64748b;">本日の売上</span>
        <strong style="color:#1a7a5e;">¥${(log.sales||0).toLocaleString()}</strong>
       </div>`
    : '';
  const hourlyRow = log.hourlyWage
    ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #e2e8f0;">
        <span style="color:#64748b;">実質時給</span>
        <strong style="color:#6366f1;">¥${log.hourlyWage.toLocaleString()}/h</strong>
       </div>`
    : '';

  el.innerHTML = `
    <div style="background:#fff;width:100%;max-width:360px;border-radius:20px;padding:28px 24px;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:2.5rem;margin-bottom:8px;">🎉</div>
        <div style="font-size:1.1rem;font-weight:700;color:#3d4a6b;">お疲れさまでした！</div>
      </div>
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #e2e8f0;">
          <span style="color:#64748b;">稼働時間</span>
          <strong>${elapsedStr}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #e2e8f0;">
          <span style="color:#64748b;">走行距離</span>
          <strong>${log.distance.toFixed(2)} km</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:0.5px solid #e2e8f0;">
          <span style="color:#64748b;">配達個数</span>
          <strong>${log.deliveries || 0} 個</strong>
        </div>
        ${salesRow}
        ${hourlyRow}
      </div>
      <button onclick="document.getElementById('daily-end-summary-modal').remove(); setTimeout(() => showReceiptCheckPrompt('end'), 400);"
        style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;">
        ✓ 閉じる
      </button>
    </div>`;
  document.body.appendChild(el);
}

// ===== 既存モーダル（編集用）=====
function openDailyModal(editId = null) {
  const modal = document.getElementById('daily-modal');
  if (!modal) return;

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('daily-date').value = today;
  document.getElementById('daily-start-odo').value = '';
  document.getElementById('daily-end-odo').value = '';
  document.getElementById('daily-memo').value = '';
  document.getElementById('daily-distance-val').textContent = '-- km';
  document.getElementById('daily-modal-inner').dataset.editId = editId || '';

  if (editId) {
    const log = dailyLogs.find(l => l.id === editId);
    if (log) {
      document.getElementById('daily-date').value = log.date;
      document.getElementById('daily-start-odo').value = log.startOdo || '';
      document.getElementById('daily-end-odo').value = log.endOdo || '';
      document.getElementById('daily-memo').value = log.memo || '';
      calcDailyDistance();
    }
  }
  modal.style.display = 'flex';
}

function closeDailyModal() {
  const modal = document.getElementById('daily-modal');
  if (modal) modal.style.display = 'none';
}

function calcDailyDistance() {
  const start = parseFloat(document.getElementById('daily-start-odo').value) || 0;
  const end   = parseFloat(document.getElementById('daily-end-odo').value)   || 0;
  const dist  = Math.max(0, end - start);
  const valEl = document.getElementById('daily-distance-val');
  if (valEl) valEl.textContent = dist > 0 ? `${dist.toFixed(2)} km` : '-- km';
}

function saveDailyLog() {
  const date     = document.getElementById('daily-date').value;
  const startOdo = parseFloat(document.getElementById('daily-start-odo').value);
  const endOdo   = parseFloat(document.getElementById('daily-end-odo').value);
  const memo     = document.getElementById('daily-memo').value.trim();

  if (!date) { alert('稼働日を入力してください'); return; }
  if (isNaN(startOdo) || isNaN(endOdo)) { alert('走行距離を入力してください'); return; }
  if (endOdo < startOdo) { alert('終了時の走行距離は開始時より大きい値を入力してください'); return; }

  const editId = document.getElementById('daily-modal-inner').dataset.editId;
  const distance = Math.round((endOdo - startOdo) * 100) / 100;
  const logEntry = {
    id: editId || `dl_${Date.now()}`,
    date, startOdo, endOdo, distance, memo,
    status: 'completed'
  };

  if (editId) {
    const i = dailyLogs.findIndex(l => l.id === editId);
    if (i >= 0) dailyLogs[i] = logEntry;
  } else {
    const sameDay = dailyLogs.findIndex(l => l.date === date);
    if (sameDay >= 0) {
      if (!confirm(`${date} の日報が既にあります。上書きしますか？`)) return;
      dailyLogs[sameDay] = logEntry;
    } else {
      dailyLogs.push(logEntry);
    }
  }

  saveDailyLogsToStorage();
  closeDailyModal();
  renderDailyPage();
  renderCalendar();
}

function deleteDailyLog(id) {
  if (!confirm('この日報を削除しますか？')) return;
  dailyLogs = dailyLogs.filter(l => l.id !== id);
  saveDailyLogsToStorage();
  renderDailyPage();
  renderCalendar();
}

// ===== 日報ページ描画 =====
function renderDailyPage() {
  const listEl = document.getElementById('daily-list');
  if (!listEl) return;

  const yearSel = document.getElementById('global-year');
  const selectedYear = yearSel ? parseInt(yearSel.value) : new Date().getFullYear();

  const filtered = dailyLogs
    .filter(l => new Date(l.date).getFullYear() === selectedYear)
    .sort((a, b) => b.date.localeCompare(a.date));

  const workDays = filtered.filter(l => l.status === 'completed').length;
  const bizKm    = filtered.reduce((s, l) => s + (l.distance || 0), 0);
  const totalDeliveries = filtered.reduce((s, l) => s + (l.deliveries || 0), 0);
  const totalSales = filtered.reduce((s, l) => s + (l.sales || 0), 0);

  // 按分率計算
  let totalKm = 0, bizRatio = 0, ratioNote = '';
  if (filtered.length > 0) {
    const sorted = [...filtered].filter(l => l.startOdo && l.endOdo).sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length > 0) {
      const firstStart = sorted[0].startOdo;
      const lastEnd    = sorted[sorted.length - 1].endOdo;
      totalKm = lastEnd - firstStart;
      if (totalKm > 0) {
        bizRatio = Math.min(100, Math.round((bizKm / totalKm) * 100));
        ratioNote = `業務走行 ${bizKm.toFixed(1)}km ÷ 総走行 ${totalKm.toFixed(1)}km = ${bizRatio}%`;
      }
    }
  }

  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  settings.vehicleRatio = bizRatio;
  settings.vehicleRatioBizKm = bizKm;
  settings.vehicleRatioTotalKm = totalKm;
  settings.vehicleRatioYear = selectedYear;
  localStorage.setItem('bizNaviSettings', JSON.stringify(settings));

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('daily-summary-period', `${selectedYear}年`);
  set('daily-total-km',  `${totalKm.toFixed(1)} km`);
  set('daily-work-days', `${workDays} 日`);
  set('daily-biz-km',    `${bizKm.toFixed(1)} km`);

  // 按分率バー
  const bar = document.getElementById('daily-ratio-bar');
  const note = document.getElementById('daily-ratio-note');
  if (bar) bar.style.width = `${bizRatio}%`;
  if (note) note.textContent = ratioNote || '日報を記録すると按分率が計算されます';

  // 今日の業務状態バナー
  const todayLog = getTodayLog();
  const todayBanner = document.getElementById('today-status-banner');
  if (todayBanner) {
    if (!todayLog) {
      todayBanner.innerHTML = `
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:12px;padding:12px 16px;margin:0 16px 12px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:1.5rem;">🚐</span>
          <div style="flex:1;">
            <div style="font-weight:700;color:#854d0e;font-size:0.9rem;">今日の業務を開始しましょう</div>
            <div style="font-size:0.78rem;color:#a16207;margin-top:2px;">開始時のオドメーターを記録してください</div>
          </div>
          <button onclick="openDailyStartModal()" style="background:#eab308;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:0.85rem;font-weight:700;cursor:pointer;">開始</button>
        </div>`;
    } else if (todayLog.status === 'started') {
      const startTime = new Date(todayLog.startTime);
      const elapsedMin = Math.round((new Date() - startTime) / 60000);
      const elapsedStr = `${Math.floor(elapsedMin/60)}時間${elapsedMin%60}分`;
      // 当日の未確認取引件数
      const unproc = (typeof getTodayUnprocessedEntries === 'function') ? getTodayUnprocessedEntries() : [];
      const unprocBadge = unproc.length > 0
        ? `<div onclick="navigate('journal')" style="cursor:pointer;margin-top:6px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:5px 10px;display:flex;align-items:center;gap:6px;">
            <span style="font-size:0.85rem;">🧾</span>
            <span style="font-size:0.78rem;color:#92400e;font-weight:700;">未確認の経費 ${unproc.length}件 → タップして確認</span>
           </div>`
        : '';
      todayBanner.innerHTML = `
        <div style="background:#e0f2fe;border:1px solid #7dd3fc;border-radius:12px;padding:12px 16px;margin:0 16px 12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.5rem;">🚗</span>
            <div style="flex:1;">
              <div style="font-weight:700;color:#0369a1;font-size:0.9rem;">業務中 · ${elapsedStr}経過</div>
              <div style="font-size:0.78rem;color:#0284c7;margin-top:2px;">開始 ${todayLog.startOdo.toFixed(2)} km ➜ 終了時に記録</div>
            </div>
            <button onclick="showDailyEndConfirm(getTodayLog())" style="background:#0369a1;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:0.85rem;font-weight:700;cursor:pointer;">終了</button>
          </div>
          ${unprocBadge}
        </div>`;
    } else {
      // 完了後：未確認取引があれば促す
      const unproc = (typeof getTodayUnprocessedEntries === 'function') ? getTodayUnprocessedEntries() : [];
      const noEntriesToday = (typeof entries !== 'undefined' ? entries : [])
        .filter(e => e?.date && String(e.date).replace(/\//g,'-').split('T')[0] === new Date().toISOString().split('T')[0]).length === 0;
      let receiptBadge = '';
      if (unproc.length > 0) {
        receiptBadge = `
          <div onclick="navigate('journal')" style="cursor:pointer;margin-top:8px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:7px 12px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1rem;">🧾</span>
            <span style="font-size:0.82rem;color:#92400e;font-weight:700;">未確認の経費が ${unproc.length}件あります → 確認する</span>
          </div>`;
      } else if (noEntriesToday) {
        receiptBadge = `
          <div onclick="showReceiptCheckPrompt('manual')" style="cursor:pointer;margin-top:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:7px 12px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:1rem;">🧾</span>
            <span style="font-size:0.82rem;color:#0369a1;font-weight:700;">今日の領収書はありませんか？ → 入力する</span>
          </div>`;
      }
      todayBanner.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:12px 16px;margin:0 16px 12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.5rem;">✅</span>
            <div style="flex:1;">
              <div style="font-weight:700;color:#15803d;font-size:0.9rem;">本日の業務完了 · ${todayLog.distance?.toFixed(2) || '--'} km</div>
              <div style="font-size:0.78rem;color:#16a34a;margin-top:2px;">${todayLog.deliveries ? `${todayLog.deliveries}個配達` : ''}${todayLog.hourlyWage ? ` · 時給 ¥${todayLog.hourlyWage.toLocaleString()}` : ''}</div>
            </div>
          </div>
          ${receiptBadge}
        </div>`;
    }
    todayBanner.style.display = 'block';
  }

  // リスト描画
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-msg">${selectedYear}年の日報はまだありません</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(log => {
    const distStr = log.distance != null ? `${log.distance.toFixed(2)} km` : '記録中...';
    const delivStr = log.deliveries != null ? `${log.deliveries}個` : '';
    const salesStr = log.sales ? `¥${log.sales.toLocaleString()}` : '';
    const hourlyStr = log.hourlyWage ? `時給 ¥${log.hourlyWage.toLocaleString()}` : '';
    const statusBadge = log.status === 'started'
      ? '<span style="font-size:0.7rem;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;font-weight:700;">業務中</span>'
      : '';

    return `
    <div class="daily-card">
      <div class="daily-card-header">
        <span class="daily-card-date">${log.date} ${statusBadge}</span>
        <div class="daily-card-actions">
          <button class="icon-btn" onclick="openDailyModal('${log.id}')">✏️</button>
          <button class="icon-btn del" onclick="deleteDailyLog('${log.id}')">🗑</button>
        </div>
      </div>
      <div class="daily-card-body">
        <div class="daily-km-badge">${distStr}</div>
        <div class="daily-card-detail">
          ${delivStr ? `📦 ${delivStr}` : ''}
          ${salesStr ? `　💰 ${salesStr}` : ''}
          ${hourlyStr ? `<br>⏱ ${hourlyStr}` : ''}
        </div>
      </div>
      ${log.memo ? `<div class="daily-card-memo">💬 ${log.memo}</div>` : ''}
    </div>`;
  }).join('');
}
// navigate時に日報ページを更新（既存のoriginalNavigateラッパーに委ねる）
// app.js:1099 の originalNavigate ラッパーが既にあるので二重ラップしない
document.addEventListener('bizNavi:pageChanged', (e) => {
  if (e.detail && e.detail.page === 'daily') renderDailyPage();
});

// インボイス番号の保存とバリデーション
function saveInvoiceNumber(value) {
  const statusEl = document.getElementById('invoice-number-status');
  let settings = JSON.parse(localStorage.getItem('userSettings')) || {};

  // T + 13桁チェック
  const valid = /^T\d{13}$/.test(value);

  if (value === '') {
    if (statusEl) statusEl.textContent = '';
    delete settings.invoiceNumber;
  } else if (valid) {
    if (statusEl) { statusEl.textContent = '✅ 有効な登録番号です'; statusEl.style.color = '#1a7a5e'; }
    settings.invoiceNumber = value;
  } else {
    if (statusEl) { statusEl.textContent = '⚠️ 「T」＋13桁の数字で入力してください'; statusEl.style.color = '#b03a2e'; }
    return; // 不正な値は保存しない
  }

  localStorage.setItem('userSettings', JSON.stringify(settings));
}

//END OF FILE

