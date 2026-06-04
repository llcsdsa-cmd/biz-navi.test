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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderAll
 * │   ページ全体を一括再描画する司令塔
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderAll ──────────────────────────────────────────────┘ */
// ===== 画面更新司令塔（免税UI同期を追加）終わり =====

// ===== ナビゲーション =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : navigate
 * │   ページ遷移を制御する（ナビタブ・ボタンから呼ばれる）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : navigate ──────────────────────────────────────────────┘ */

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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveCustomRules
 * │   カスタム分類ルールをlocalStorageに保存
 * └──────────────────────────────────────────────────────┘ */
function saveCustomRules() {
    localStorage.setItem('bizNaviCustomRules', JSON.stringify(userCustomRules));
}
/* └ END : saveCustomRules ──────────────────────────────────────────────┘ */

// ルールを追加する共通関数
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : addCustomRule
 * │   カスタム分類ルールを追加する
 * └──────────────────────────────────────────────────────┘ */
function addCustomRule(keyword, account, wallet, memo) {
    userCustomRules.push({ keyword, account, wallet, memo });
    saveCustomRules();
}
/* └ END : addCustomRule ──────────────────────────────────────────────┘ */
  

  
  
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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateDashboard
 * │   ダッシュボード全体を更新（KPI・グラフ・バナー・カレンダー一括再描画）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateDashboard ──────────────────────────────────────────────┘ */
// ===== [2026-05-12 23:55 修正終了] =====

// ===== [2026-05-24 追加] 車検・保険通知 =====
const VEHICLE_REMINDER_KEY = 'bizNavi_vehicleReminders';

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getVehicleReminders
 * │   localStorageから車検・保険期限リストを取得
 * └──────────────────────────────────────────────────────┘ */
function getVehicleReminders() {
  try {
    return JSON.parse(localStorage.getItem(VEHICLE_REMINDER_KEY) || '[]');
  } catch { return []; }
}
/* └ END : getVehicleReminders ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveVehicleReminders
 * │   車検・保険期限リストをlocalStorageに保存
 * └──────────────────────────────────────────────────────┘ */
function saveVehicleReminders(list) {
  localStorage.setItem(VEHICLE_REMINDER_KEY, JSON.stringify(list));
}
/* └ END : saveVehicleReminders ──────────────────────────────────────────────┘ */

// 期限までの残日数を計算
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : daysUntil
 * │   指定日付までの残日数を計算して返す
 * └──────────────────────────────────────────────────────┘ */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
/* └ END : daysUntil ──────────────────────────────────────────────┘ */

// ダッシュボード用：期限アラートバナーを描画
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderVehicleAlerts
 * │   ダッシュボードに車検・保険の期限アラートバナーを描画（30日以内）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderVehicleAlerts ──────────────────────────────────────────────┘ */

// 設定ページ：車検・保険通知設定UIを描画
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderVehicleReminderSettings
 * │   設定ページの車検・保険通知設定カードを描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderVehicleReminderSettings ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : addVehicleReminder
 * │   車検・保険通知を新規追加
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : addVehicleReminder ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : deleteVehicleReminder
 * │   車検・保険通知を削除
 * └──────────────────────────────────────────────────────┘ */
function deleteVehicleReminder(index) {
  const list = getVehicleReminders();
  list.splice(index, 1);
  saveVehicleReminders(list);
  renderVehicleReminderSettings();
  renderVehicleAlerts();
  if (typeof showToast === 'function') showToast('通知を削除しました', 'info');
}
/* └ END : deleteVehicleReminder ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] 今日のアクションバナー =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderTodayActionBanner
 * │   ダッシュボード最上部の今日のアクションバナーを描画（未開始/業務中/完了）
 * └──────────────────────────────────────────────────────┘ */
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
    const elapsedMin = Math.floor((new Date() - startTime) / 60000);
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
/* └ END : renderTodayActionBanner ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] 最近の取引 描画 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderRecentEntries
 * │   ダッシュボードの「最近の取引」一覧を描画
 * └──────────────────────────────────────────────────────┘ */
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
        <button onclick="openNewEntryModal()" style="background:#6366f1;color:#fff;border:none;border-radius:12px;padding:10px 20px;font-size:0.88rem;font-weight:700;cursor:pointer;">
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
/* └ END : renderRecentEntries ──────────────────────────────────────────────┘ */



// ===== [2026-05-24 追加] カレンダーへの走行距離表示 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : injectKmToCalendar
 * │   カレンダーの各日付セルに日報の走行距離を表示
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : injectKmToCalendar ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] ワンタップ承認 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : approveEntry
 * │   指定IDの取引を「確認済み」にするワンタップ承認
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : approveEntry ──────────────────────────────────────────────┘ */


// ===== [2026-05-24 追加] ② UIモード切替（シンプルモード）=====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : applySimpleMode
 * │   シンプルモードON/OFFをUIに反映（元帳・消費税・電帳法を非表示）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : applySimpleMode ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : toggleSimpleMode
 * │   シンプルモードのON/OFFを切り替える
 * └──────────────────────────────────────────────────────┘ */
function toggleSimpleMode() {
  const current = localStorage.getItem('bizNavi_simpleMode') === '1';
  localStorage.setItem('bizNavi_simpleMode', current ? '0' : '1');
  applySimpleMode();
  renderSimpleModeSetting();
  if (typeof showToast === 'function') {
    showToast(current ? '通常モードに切り替えました' : 'シンプルモードに切り替えました', 'info');
  }
}
/* └ END : toggleSimpleMode ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderSimpleModeSetting
 * │   設定ページのシンプルモード切替カードを描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderSimpleModeSetting ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] ③ 電帳法バッジ（ナビ表示）=====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateDenchoBadge
 * │   ナビの電帳法項目に「対応済」バッジを付与
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateDenchoBadge ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderTaxPageByExemptStatus
 * │   免税/課税に応じて消費税ページ表示を切り替え（Progressive Disclosure）
 * └──────────────────────────────────────────────────────┘ */
function renderTaxPageByExemptStatus() {
  const isExempt = (typeof isExemptUser === 'function') ? isExemptUser() : false;
  const exemptView = document.getElementById('tax-exempt-view');
  const taxableView = document.getElementById('tax-taxable-view');
  if (exemptView) exemptView.style.display = isExempt ? 'block' : 'none';
  if (taxableView) taxableView.style.display = isExempt ? 'none' : 'block';
}
/* └ END : renderTaxPageByExemptStatus ──────────────────────────────────────────────┘ */

// ===== [2026-05-15 06:30 最終修正] 貸借不一致ブロック ＆ 軍師継承 ＆ 学習提案 搭載 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveEntry
 * │   取引入力フォームの値を読み取りentriesに保存（電帳法記録も連動）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : saveEntry ──────────────────────────────────────────────┘ */
// ===== [2026-05-15 06:30 最終修正] 貸借不一致ブロック ＆ 軍師継承 ＆ 学習提案 搭載 終わり =====

// ===== [2026-05-06 23:10 修正：個別IDによる償却判定とボタン文言の適正化] =====
/**
 * 固定資産台帳の描画ロジック。
 * 資産ごとのID（originalAssetId）を元に、本年度の償却処理が完了しているか判定し、
 * ボタンの表示（文言・色）を動的に切り替えます。
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderAssets
 * │   資産管理ページを描画（固定資産一覧・減価償却情報）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderAssets ──────────────────────────────────────────────┘ */
// ===== [2026-05-06 23:10 修正終了] =====


// ===== [2026-05-06 23:15 修正：個別IDによる重複排除・上書きロジックの実装] =====
/**
 * 資産個別のIDを使用して償却処理（仕訳登録）を実行する。
 * 同一資産・同一年度の償却仕訳が既に存在する場合は、古いデータを削除してから新しいデータを投入（上書き）します。
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : executeDepreciation
 * │   指定資産の減価償却を実行して取引を生成
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : executeDepreciation ──────────────────────────────────────────────┘ */
// ===== [2026-05-06 23:15 修正終了] =====


// ===== [2026-05-07 01:50 修正：ID不一致解消、データソース同期、およびデバッグログの強化] =====
/**
 * カレンダーを描画する。
 * ID名の揺れ（calendar-/cal-/calender-）を吸収し、描画状況をコンソールに出力する。
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderCalendar
 * │   月次カレンダーを描画（収支ドット・今日のマーカー表示）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderCalendar ──────────────────────────────────────────────┘ */
// ===== [2026-05-07 01:50 修正終了] =====

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : calMove
 * │   カレンダーの月送りボタン（前月/翌月）の処理
 * └──────────────────────────────────────────────────────┘ */
function calMove(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  else if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
/* └ END : calMove ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : calDayClick
 * │   カレンダーの日付タップ時の処理
 * └──────────────────────────────────────────────────────┘ */
function calDayClick(day) {
  const monthStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}`;
  document.getElementById('journal-month').value = monthStr;
  navigate('journal');
}
/* └ END : calDayClick ──────────────────────────────────────────────┘ */

// ===== 消費税・決算・CSV等（共通/補助関数） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getTaxRate
 * │   税コードから税率（0〜0.1）を返す
 * └──────────────────────────────────────────────────────┘ */
function getTaxRate(taxCode) {
  if (taxCode === 'exempt10' || taxCode === 'input10') return 0.10;
  if (taxCode === 'exempt8' || taxCode === 'input8') return 0.08;
  return 0;
}
/* └ END : getTaxRate ──────────────────────────────────────────────┘ */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : calcTaxAmount
 * │   金額と税コードから消費税額を計算して返す
 * └──────────────────────────────────────────────────────┘ */
function calcTaxAmount(amount, taxCode) {
  const rate = getTaxRate(taxCode);
  return rate === 0 ? 0 : Math.round(amount * rate / (1 + rate));
}
/* └ END : calcTaxAmount ──────────────────────────────────────────────┘ */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : fmt
 * │   金額を「¥1,234」形式の文字列にフォーマット
 * └──────────────────────────────────────────────────────┘ */
function fmt(n) { return '¥' + Math.round(n).toLocaleString('ja-JP'); }
/* └ END : fmt ──────────────────────────────────────────────┘ */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : fmtDate
 * │   日付区切りをハイフン→スラッシュに変換
 * └──────────────────────────────────────────────────────┘ */
function fmtDate(d) { return d.replace(/-/g, '/'); }
/* └ END : fmtDate ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveData
 * │   取引データをlocalStorage/クラウドに保存
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : saveData ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : deleteEntry
 * │   指定IDの取引を削除する
 * └──────────────────────────────────────────────────────┘ */
function deleteEntry(id) {
  if (!confirm('削除しますか？')) return;
  entries = entries.filter(e => e.id !== id);
  saveData();
  renderAll();
  showToast('削除しました', 'info');
}
/* └ END : deleteEntry ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showToast
 * │   画面下部にトースト通知を表示（info/success/warn/error）
 * └──────────────────────────────────────────────────────┘ */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = 'toast', 2500);
  }
}
/* └ END : showToast ──────────────────────────────────────────────┘ */


/**
 * 共通期間バー（年月）を現在のカレンダーに合わせて初期化する
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initGlobalPeriod
 * │   起動時に全ページの年月フィルターを当日に自動設定
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : initGlobalPeriod ──────────────────────────────────────────────┘ */
/**
 * 共通期間バー（年月）を現在のカレンダーに合わせて初期化する　終わり
 */

// 他のUI系初期化関数群
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initAccountSelects
 * │   勘定科目セレクトボックスに選択肢を動的に追加
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : initAccountSelects ──────────────────────────────────────────────┘ */

// --- 2026-05-03 17:20 書き換え ---
// 理由: 仕訳帳の入力初期値を、共通期間バーで選択されている年月と連動させるため
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initJournalMonth
 * │   取引記録帳の月フィルターを初期化
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : initJournalMonth ──────────────────────────────────────────────┘ */
// --- 2026-05-03 17:20 書き換え終了 ---


/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initReportYear
 * │   集計レポートの年セレクトを動的に生成
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : initReportYear ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] 全ページの年・月セレクトを当日に初期設定 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initGlobalPeriod
 * │   起動時に全ページの年月フィルターを当日に自動設定
 * └──────────────────────────────────────────────────────┘ */
function initGlobalPeriod() {
  const now   = new Date();
  const year  = String(now.getFullYear());
  const month = String(now.getMonth() + 1); // 1〜12

  // 対象となる全セレクトID
  const yearIds  = ['global-year', 'global-year-journal', 'global-year-assets'];
  const monthIds = ['global-month', 'global-month-journal', 'global-month-assets'];

  yearIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // 対応するoptionが存在すれば選択
    const opt = el.querySelector(`option[value="${year}"]`);
    if (opt) el.value = year;
  });

  monthIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const opt = el.querySelector(`option[value="${month}"]`);
    if (opt) el.value = month;
  });

  // レポートページの年も当年に設定
  const reportYearEl = document.getElementById('report-year');
  if (reportYearEl) {
    const opt = reportYearEl.querySelector(`option[value="${year}"]`);
    if (opt) reportYearEl.value = year;
  }

  // カレンダーの内部変数も当月に同期
  if (typeof calYear  !== 'undefined') window.calYear  = now.getFullYear();
  if (typeof calMonth !== 'undefined') window.calMonth = now.getMonth();
}
/* └ END : initGlobalPeriod ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initChartYearSelect
 * │   収支グラフの年選択セレクトを初期化
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : initChartYearSelect ──────────────────────────────────────────────┘ */

// 以下、詳細な描画ロジック（Journal, Ledger, Tax, Report, Charts, CSV）は
// スペースの関係上、貼り付けられた全ロジックを関数として内包し、
// renderAllから呼び出される構成を維持しています。
// ※実際のコードではここ以降に、貼り付けていただいた renderJournal 以下の全関数が続きます。

// ===== タブ切り替え制御 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : switchJournalTab
 * │   取引記録帳の未確認/確認済みタブを切り替える
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : switchJournalTab ──────────────────────────────────────────────┘ */


//===== [2026-05-03 21:15 修正] 共通期間バー対応版：renderJournal =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderJournal
 * │   取引記録帳ページを描画（未確認/確認済みタブ・期間フィルター対応）
 * └──────────────────────────────────────────────────────┘ */
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
}
/* └ END : renderJournal ──────────────────────────────────────────────┘ */
//===== [2026-05-03 21:15 修正終了] =====

// 予算表示
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderBudgetDisplay
 * │   ダッシュボードの月次予算進捗を描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderBudgetDisplay ──────────────────────────────────────────────┘ */



/* ============================================================
   関数名: initIcons
   修正日: 2026-05-03
   内容: モバイルファーストUIへの移行に伴い、ナビゲーションを5ボタン化。
         「その他」ボタンに専用の三点リーダーアイコン(more)を適用。
   ============================================================ */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : initIcons
 * │   SVGアイコンを各DOM要素に描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : initIcons ──────────────────────────────────────────────┘ */
// [END of initIcons]


/* ============================================================
   関数名: toggleMoreMenu / window.navigate ラッパー
   修正日: 2026-05-03
   内容: 「その他」メニューの開閉制御および遷移時の自動閉鎖
   ============================================================ */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : toggleMoreMenu
 * │   ナビの「その他」ポップアップメニューを開閉
 * └──────────────────────────────────────────────────────┘ */
function toggleMoreMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('more-menu-popup');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}
/* └ END : toggleMoreMenu ──────────────────────────────────────────────┘ */

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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : window.navigate
 * │   navigate のグローバル公開版（外部JSから参照可能）
 * └──────────────────────────────────────────────────────┘ */
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
    // 利用規約バージョン表示
    const vl = document.getElementById('terms-version-label');
    if (vl && typeof TERMS_VERSION !== 'undefined') {
      vl.textContent = `規約 Ver.${TERMS_VERSION}（${TERMS_DATE}）`;
    }
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
/* └ END : window.navigate ──────────────────────────────────────────────┘ */
// [END of Navigation Logic (2026-05-03)]


// その他CSVエクスポート等
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : downloadCSV
 * │   データをCSVファイルとしてダウンロードさせる汎用関数
 * └──────────────────────────────────────────────────────┘ */
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
/* └ END : downloadCSV ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : exportJournalCSV
 * │   取引記録帳のデータをCSVでダウンロード
 * └──────────────────────────────────────────────────────┘ */
function exportJournalCSV() {
  let csv = '\uFEFF日付,内容,金額,財布,金額,摘要\n';
  entries.forEach(e => { csv += `"${e.date}","${e.debit.account}",${e.debit.amount},"${e.credit.account}",${e.credit.amount},"${e.memo||''}"\n`; });
  downloadCSV(csv, '仕訳帳.csv');
}
/* └ END : exportJournalCSV ──────────────────────────────────────────────┘ */

/**
 * 仕訳モーダルを開く（新規・編集共通）
 * 日付の形式をブラウザのinput type="date"に合わせて自動変換します
 */
// ========================================================
// §6 新取引入力UI：openNewEntryModal
// 3ステップ（方向→カテゴリ→サジェスト）+ 金額入力
// 既存の saveEntry() / #modal-overlay をそのまま活用
// ========================================================

// §6 店舗名正規化：表記揺れを吸収して辞書と一致させる
// ＥＮＥＯＳ / eneos / ｴﾈｵｽ → 全て「ENEOS」に正規化
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : normalizeStoreName
 * │   店舗名の表記揺れを吸収して正規化（全角→半角・大文字統一）
 * └──────────────────────────────────────────────────────┘ */
function normalizeStoreName(name) {
  if (!name) return '';
  let s = name.trim();
  // 全角英数字→半角
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
  // 半角カナ→全角カナ
  const h2z = {
    'ｦ':'ヲ','ｧ':'ァ','ｨ':'ィ','ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ',
    'ｬ':'ャ','ｭ':'ュ','ｮ':'ョ','ｯ':'ッ','ｰ':'ー',
    'ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ',
    'ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
    'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ',
    'ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
    'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
    'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
    'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ',
    'ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
    'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
    'ﾜ':'ワ','ﾝ':'ン'
  };
  s = s.replace(/[ｦ-ﾟ]/g, c => h2z[c] || c);
  // 英字を大文字に統一・余白を圧縮
  s = s.toUpperCase().replace(/\s+/g, ' ').trim();
  return s;
}
/* └ END : normalizeStoreName ──────────────────────────────────────────────┘ */

// カテゴリ定義
const ENTRY_CATEGORIES = {
  expense: [
    { id: 'car',   icon: '🚗', label: '車関連' },
    { id: 'food',  icon: '🍱', label: '食事' },
    { id: 'work',  icon: '📦', label: '業務' },
    { id: 'tel',   icon: '📱', label: '通信' },
    { id: 'other', icon: '📝', label: 'その他' },
  ],
  income: [
    { id: 'delivery', icon: '🚐', label: '配送売上' },
    { id: 'subsidy',  icon: '🏛️', label: '補助金等' },
    { id: 'goods',    icon: '📦', label: '物販収益' },
    { id: 'more',     icon: '＋', label: 'もっと見る' },
  ],
};

// サジェスト定義（カテゴリID→候補リスト）
const ENTRY_SUGGESTIONS = {
  // 支出
  car: [
    { icon: '⛽', label: 'ガソリン',    debit: '燃料費',    tax: 'input10' },
    { icon: '🛣️', label: '高速・ETC',  debit: '旅費交通費', tax: 'input10' },
    { icon: '🅿️', label: '駐車場',     debit: '旅費交通費', tax: 'input10' },
    { icon: '🔧', label: '車検',        debit: '車両費',    tax: 'input10' },
    { icon: '🛞', label: 'タイヤ・部品', debit: '車両費',   tax: 'input10' },
    { icon: '🚿', label: '洗車',        debit: '車両費',    tax: 'input10' },
    { icon: '🚗', label: '車購入',      debit: '車両費',    tax: 'input10', assetCheck: true },
  ],
  food: [
    { icon: '🌙', label: '深夜の夜食',       debit: '福利厚生費', tax: 'input10' },
    { icon: '🥤', label: '熱中症対策の飲み物', debit: '福利厚生費', tax: 'input10' },
    { icon: '☕', label: '打ち合わせ飲食',    debit: '会議費',    tax: 'input10' },
  ],
  work: [
    { icon: '📦', label: '荷造り用品',   debit: '消耗品費', tax: 'input10' },
    { icon: '✏️', label: '事務用品',     debit: '消耗品費', tax: 'input10' },
    { icon: '🧤', label: '軍手・安全用品', debit: '消耗品費', tax: 'input10' },
    { icon: '🤝', label: '会議費',       debit: '会議費',   tax: 'input10' },
  ],
  tel: [
    { icon: '📱', label: 'スマホ代', debit: '通信費', tax: 'input10' },
    { icon: '📡', label: 'Wi-Fi',   debit: '通信費', tax: 'input10' },
  ],
  other: [],
  // 収入
  delivery: [
    { icon: '🚐', label: '配送売上', credit: '売上高', tax: 'exempt10' },
  ],
  subsidy: [
    { icon: '🏛️', label: '補助金',  credit: '雑収入', tax: 'non' },
    { icon: '💴', label: '助成金',  credit: '雑収入', tax: 'non' },
  ],
  goods: [
    { icon: '📦', label: '物品販売', credit: '売上高', tax: 'exempt10' },
  ],
  income_more: [
    { icon: '🔧', label: '作業収入', credit: '売上高',  tax: 'exempt10' },
    { icon: '💡', label: '紹介料',   credit: '雑収入',  tax: 'exempt10' },
    { icon: '🏠', label: '副業収入', credit: '雑収入',  tax: 'exempt10' },
    { icon: '🎁', label: '謝礼金',   credit: '雑収入',  tax: 'non' },
  ],
};

// 支払方法 → 貸方科目のマッピング
const PAYMENT_METHODS = [
  { label: '現金',           account: '現金' },
  { label: 'クレジットカード', account: '未払金' },
  { label: 'デビットカード', account: '普通預金' },
  { label: '銀行振込',       account: '普通預金' },
  { label: 'Suica・IC',     account: '現金' },
  { label: 'PayPay等',      account: '現金' },
];

// ---- メイン関数 ----
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openNewEntryModal
 * │   【§6】新3ステップ取引入力モーダルを開く（STEP1:方向→STEP2:カテゴリ→STEP3:候補→STEP4:金額）
 * └──────────────────────────────────────────────────────┘ */
function openNewEntryModal() {
  const existing = document.getElementById('new-entry-modal');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'new-entry-modal';
  el.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.55);
    z-index:10000;display:flex;align-items:flex-end;justify-content:center;
  `;

  el.innerHTML = `
    <div id="new-entry-sheet"
      style="background:var(--color-surface,#fff);width:100%;max-width:520px;
             border-radius:20px 20px 0 0;padding:0 0 36px;
             box-shadow:0 -4px 24px rgba(0,0,0,0.18);
             max-height:92vh;overflow-y:auto;overflow-x:hidden;">

      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:18px 20px 12px;border-bottom:1px solid var(--color-border,#e2e8f0);
                  position:sticky;top:0;background:var(--color-surface,#fff);z-index:1;">
        <div>
          <div id="ne-step-label"
            style="font-size:0.72rem;color:var(--color-accent,#6366f1);font-weight:700;
                   letter-spacing:0.06em;margin-bottom:2px;">STEP 1 / 4</div>
          <div id="ne-step-title"
            style="font-size:1rem;font-weight:700;color:var(--color-text,#1e293b);">
            お金の方向を選んでください
          </div>
        </div>
        <button onclick="document.getElementById('new-entry-modal').remove()"
          style="background:none;border:none;font-size:1.4rem;
                 color:var(--color-muted,#64748b);cursor:pointer;padding:4px 8px;">✕</button>
      </div>

      <!-- プログレスバー -->
      <div style="height:3px;background:var(--color-border,#e2e8f0);">
        <div id="ne-progress"
          style="height:100%;background:var(--color-accent,#6366f1);
                 transition:width 0.3s;width:25%;"></div>
      </div>

      <!-- コンテンツエリア -->
      <div id="ne-content" style="padding:20px 16px 0;"></div>
    </div>
  `;

  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });

  // STEP1を描画
  _neRenderStep1();
}
/* └ END : openNewEntryModal ──────────────────────────────────────────────┘ */

// STEP1：使った or もらった
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neRenderStep1
 * │   【§6 STEP1】使ったお金/もらったお金の選択画面を描画
 * └──────────────────────────────────────────────────────┘ */
function _neRenderStep1() {
  _neSetHeader('STEP 1 / 4', 'お金の方向は？', 25);
  document.getElementById('ne-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px;">
      <button onclick="_neSelectDirection('expense')"
        style="background:#fef2f2;border:2px solid #fca5a5;border-radius:16px;
               padding:28px 12px;font-size:2rem;cursor:pointer;
               display:flex;flex-direction:column;align-items:center;gap:8px;">
        <span>💸</span>
        <span style="font-size:0.95rem;font-weight:700;color:#b91c1c;">使ったお金</span>
        <span style="font-size:0.75rem;color:#ef4444;">（支出・経費）</span>
      </button>
      <button onclick="_neSelectDirection('income')"
        style="background:#f0fdf4;border:2px solid #86efac;border-radius:16px;
               padding:28px 12px;font-size:2rem;cursor:pointer;
               display:flex;flex-direction:column;align-items:center;gap:8px;">
        <span>💰</span>
        <span style="font-size:0.95rem;font-weight:700;color:#15803d;">もらったお金</span>
        <span style="font-size:0.75rem;color:#16a34a;">（売上・収入）</span>
      </button>
    </div>
  `;
}
/* └ END : _neRenderStep1 ──────────────────────────────────────────────┘ */

// STEP2：カテゴリ選択
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSelectDirection
 * │   【§6 STEP1】方向（支出/収入）を選択してSTEP2へ進む
 * └──────────────────────────────────────────────────────┘ */
function _neSelectDirection(dir) {
  window._neDir = dir;
  _neSetHeader('STEP 2 / 4', dir === 'expense' ? '何に使いましたか？' : '何の収入ですか？', 50);

  const cats = ENTRY_CATEGORIES[dir];
  document.getElementById('ne-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px;">
      ${cats.map(c => `
        <button onclick="_neSelectCategory('${c.id}')"
          style="background:var(--color-bg,#f8fafc);
                 border:1.5px solid var(--color-border,#e2e8f0);
                 border-radius:14px;padding:16px 8px;cursor:pointer;
                 display:flex;flex-direction:column;align-items:center;gap:6px;">
          <span style="font-size:1.6rem;">${c.icon}</span>
          <span style="font-size:0.82rem;font-weight:700;
                       color:var(--color-text,#1e293b);">${c.label}</span>
        </button>
      `).join('')}
    </div>
    <button onclick="_neRenderStep1()"
      style="width:100%;margin-top:14px;background:none;border:none;
             color:var(--color-muted,#64748b);font-size:0.85rem;cursor:pointer;padding:8px;">
      ← もどる
    </button>
  `;
}
/* └ END : _neSelectDirection ──────────────────────────────────────────────┘ */

// STEP3：サジェスト選択
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSelectCategory
 * │   【§6 STEP2】カテゴリ大分類を選択してSTEP3へ進む
 * └──────────────────────────────────────────────────────┘ */
function _neSelectCategory(catId) {
  window._neCatId = catId;
  const dir = window._neDir;

  // 「もっと見る」は収入その他に展開
  const key = catId === 'more' ? 'income_more' : catId;
  const suggestions = ENTRY_SUGGESTIONS[key] || [];

  const catLabel = [...ENTRY_CATEGORIES.expense, ...ENTRY_CATEGORIES.income]
    .find(c => c.id === catId)?.label || '';

  _neSetHeader('STEP 3 / 4', `${catLabel}の詳細を選んでください`, 75);

  document.getElementById('ne-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:4px;">
      ${suggestions.map((s, i) => `
        <button onclick="_neSelectSuggestion(${i})"
          data-sug-index="${i}"
          style="background:var(--color-bg,#f8fafc);
                 border:1.5px solid var(--color-border,#e2e8f0);
                 border-radius:14px;padding:14px 10px;cursor:pointer;
                 display:flex;align-items:center;gap:10px;text-align:left;">
          <span style="font-size:1.4rem;flex-shrink:0;">${s.icon}</span>
          <span style="font-size:0.88rem;font-weight:700;
                       color:var(--color-text,#1e293b);">${s.label}</span>
        </button>
      `).join('')}
      <button onclick="_neOpenDirectInput()"
        style="background:var(--color-surface,#fff);
               border:1.5px dashed var(--color-border-mid,#94a3b8);
               border-radius:14px;padding:14px 10px;cursor:pointer;
               display:flex;align-items:center;gap:10px;text-align:left;">
        <span style="font-size:1.4rem;flex-shrink:0;">✏️</span>
        <span style="font-size:0.88rem;font-weight:700;
                     color:var(--color-muted,#64748b);">直接入力</span>
      </button>
    </div>
    <button onclick="_neSelectDirection('${dir}')"
      style="width:100%;margin-top:14px;background:none;border:none;
             color:var(--color-muted,#64748b);font-size:0.85rem;cursor:pointer;padding:8px;">
      ← もどる
    </button>
  `;
}
/* └ END : _neSelectCategory ──────────────────────────────────────────────┘ */

// STEP4：金額・日付・支払方法入力
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSelectSuggestion
 * │   【§6 STEP3】サジェスト候補を選択してSTEP4へ進む
 * └──────────────────────────────────────────────────────┘ */
function _neSelectSuggestion(index) {
  const key = window._neCatId === 'more' ? 'income_more' : window._neCatId;
  const sug = ENTRY_SUGGESTIONS[key][index];
  window._neSug = sug;
  _neRenderStep4(sug.label, sug.icon);
}
/* └ END : _neSelectSuggestion ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neRenderStep4
 * │   【§6 STEP4】金額・日付・支払方法・店舗の入力画面を描画
 * └──────────────────────────────────────────────────────┘ */
function _neRenderStep4(label, icon) {
  const today = new Date().toISOString().split('T')[0];
  const dir = window._neDir;
  const sug = window._neSug;

  _neSetHeader('STEP 4 / 4', '金額と日付を入力してください', 100);

  // マイ辞書から過去の店舗名を取得
  const myDict = JSON.parse(localStorage.getItem('bizNavi_myDict') || '{}');
  const pastStores = myDict[label] || [];

  const paymentHtml = dir === 'expense' ? `
    <div style="margin-bottom:14px;">
      <label style="display:block;font-size:0.75rem;font-weight:700;
                    color:var(--color-muted,#64748b);margin-bottom:6px;">
        💳 何で払いましたか？
      </label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${PAYMENT_METHODS.map((p, i) => `
          <button onclick="_neSelectPayment(${i})"
            id="ne-pay-${i}"
            style="background:${i === 0 ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)'};
                   color:${i === 0 ? '#fff' : 'var(--color-text,#1e293b)'};
                   border:1.5px solid ${i === 0 ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                   border-radius:20px;padding:6px 14px;
                   font-size:0.8rem;font-weight:600;cursor:pointer;">
            ${p.label}
          </button>
        `).join('')}
      </div>
    </div>
  ` : '';

  const storeHtml = `
    <div style="margin-bottom:14px;">
      <label style="display:block;font-size:0.75rem;font-weight:700;
                    color:var(--color-muted,#64748b);margin-bottom:6px;">
        🏪 お店・メモ（任意）
      </label>
      ${pastStores.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          ${pastStores.slice(0, 5).map(s => `
            <button onclick="document.getElementById('ne-store').value='${s}'"
              style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;
                     border-radius:16px;padding:4px 12px;font-size:0.78rem;
                     font-weight:600;cursor:pointer;">
              ${s}
            </button>
          `).join('')}
        </div>
      ` : ''}
      <input type="text" id="ne-store"
        placeholder="例：ENEOS 平塚万田店（省略可）"
        style="width:100%;padding:10px 12px;font-size:0.9rem;
               border:1.5px solid var(--color-border-mid,#94a3b8);
               border-radius:10px;box-sizing:border-box;
               background:var(--color-surface,#fff);color:var(--color-text,#1e293b);">
    </div>
  `;

  document.getElementById('ne-content').innerHTML = `
    <!-- 選択内容サマリー -->
    <div style="background:var(--color-bg,#f8fafc);border-radius:12px;
                padding:12px 14px;margin-bottom:16px;
                display:flex;align-items:center;gap:10px;">
      <span style="font-size:1.6rem;">${icon}</span>
      <div>
        <div style="font-weight:700;font-size:0.95rem;
                    color:var(--color-text,#1e293b);">${label}</div>
        <div style="font-size:0.75rem;color:var(--color-muted,#64748b);margin-top:2px;">
          ${sug ? (sug.debit || sug.credit || '') : ''}
        </div>
      </div>
    </div>

    <!-- 金額入力 -->
    <div style="margin-bottom:14px;">
      <label style="display:block;font-size:0.75rem;font-weight:700;
                    color:var(--color-muted,#64748b);margin-bottom:6px;">
        💴 金額（税込）
      </label>
      <div style="position:relative;">
        <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);
                     font-size:1.1rem;color:var(--color-muted,#64748b);">¥</span>
        <input type="number" id="ne-amount" min="0" inputmode="numeric" pattern="[0-9]*"
          placeholder="0"
          style="width:100%;padding:14px 14px 14px 32px;font-size:1.5rem;font-weight:700;
                 border:2px solid var(--color-accent,#6366f1);border-radius:12px;
                 box-sizing:border-box;text-align:right;
                 background:var(--color-surface,#fff);color:var(--color-text,#1e293b);">
      </div>
    </div>

    <!-- 日付 -->
    <div style="margin-bottom:14px;">
      <label style="display:block;font-size:0.75rem;font-weight:700;
                    color:var(--color-muted,#64748b);margin-bottom:6px;">
        📅 日付
      </label>
      <input type="date" id="ne-date" value="${today}"
        style="width:100%;padding:10px 12px;font-size:0.95rem;
               border:1.5px solid var(--color-border-mid,#94a3b8);
               border-radius:10px;box-sizing:border-box;
               background:var(--color-surface,#fff);color:var(--color-text,#1e293b);">
    </div>

    ${paymentHtml}
    ${storeHtml}

    <!-- 車購入の資産チェック警告 -->
    ${sug?.assetCheck ? `
      <div id="ne-asset-warn" style="display:none;background:#fef3c7;border:1px solid #fde68a;
           border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:0.8rem;color:#92400e;">
        ⚠️ 30万円以上の場合は「資産管理」への登録が必要です。
        保存後に資産管理ページで登録してください。
      </div>
    ` : ''}

    <!-- 保存ボタン -->
    <button onclick="_neSaveEntry()"
      style="width:100%;background:var(--color-accent,#6366f1);color:#fff;
             border:none;border-radius:14px;padding:16px;
             font-size:1rem;font-weight:700;cursor:pointer;margin-top:4px;">
      💾 記録する
    </button>
    <button onclick="_neSelectCategory('${window._neCatId}')"
      style="width:100%;background:none;border:none;
             color:var(--color-muted,#64748b);font-size:0.85rem;
             cursor:pointer;padding:10px;">
      ← もどる
    </button>
  `;

  // 金額入力に連動して30万円チェック
  if (sug?.assetCheck) {
    document.getElementById('ne-amount').addEventListener('input', e => {
      const warn = document.getElementById('ne-asset-warn');
      if (warn) warn.style.display = parseFloat(e.target.value) >= 300000 ? 'block' : 'none';
    });
  }

  // 金額欄にフォーカス + 全角→半角変換リスナー
  setTimeout(() => {
    const amtEl = document.getElementById('ne-amount');
    if (!amtEl) return;
    amtEl.focus();
    // 全角数字を半角に変換し、数字以外の文字を除去（半角テンキー固定）
    amtEl.addEventListener('input', function() {
      const v = this.value
        .replace(/[０-９]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
        .replace(/[^0-9]/g, '');
      if (this.value !== v) this.value = v;
    });
  }, 200);

  // 支払方法の選択状態（初期は現金）
  window._nePaymentIndex = 0;
}
/* └ END : _neRenderStep4 ──────────────────────────────────────────────┘ */

// 支払方法ボタンの切替
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSelectPayment
 * │   【§6 STEP4】支払方法ボタンの選択状態を切り替える
 * └──────────────────────────────────────────────────────┘ */
function _neSelectPayment(idx) {
  window._nePaymentIndex = idx;
  PAYMENT_METHODS.forEach((_, i) => {
    const btn = document.getElementById(`ne-pay-${i}`);
    if (!btn) return;
    btn.style.background = i === idx ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)';
    btn.style.color       = i === idx ? '#fff' : 'var(--color-text,#1e293b)';
    btn.style.borderColor = i === idx ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)';
  });
}
/* └ END : _neSelectPayment ──────────────────────────────────────────────┘ */

// 直接入力モード（サジェストにない場合）
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neOpenDirectInput
 * │   【§6 STEP3】サジェストにない場合の直接入力モードでSTEP4を開く
 * └──────────────────────────────────────────────────────┘ */
function _neOpenDirectInput() {
  window._neSug = { debit: '', credit: '', tax: 'non', label: '' };
  _neSetHeader('STEP 4 / 4', '金額と日付を入力してください', 100);
  _neRenderStep4('直接入力', '✏️');
}
/* └ END : _neOpenDirectInput ──────────────────────────────────────────────┘ */

// ヘッダー更新ユーティリティ
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSetHeader
 * │   【§6 共通】ヘッダー（ステップ番号・タイトル・プログレスバー）を更新
 * └──────────────────────────────────────────────────────┘ */
function _neSetHeader(stepLabel, title, progress) {
  const el = document.getElementById('ne-step-label');
  const tl = document.getElementById('ne-step-title');
  const pb = document.getElementById('ne-progress');
  if (el) el.textContent = stepLabel;
  if (tl) tl.textContent = title;
  if (pb) pb.style.width = `${progress}%`;
}
/* └ END : _neSetHeader ──────────────────────────────────────────────┘ */

// 保存処理：既存の saveEntry() に値を流し込んで呼び出す
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSaveEntry
 * │   【§6 保存】入力値を既存フォームに流し込みsaveEntry()を呼ぶ。マイ辞書に店舗名を学習
 * └──────────────────────────────────────────────────────┘ */
function _neSaveEntry() {
  // 全角→半角変換後に整数化（1円未満四捨五入）
  const amount  = Math.round(parseFloat(document.getElementById('ne-amount')?.value) || 0);
  const date    = document.getElementById('ne-date')?.value || '';
  const store   = document.getElementById('ne-store')?.value.trim() || '';
  const dir     = window._neDir;
  const sug     = window._neSug || {};
  const payIdx  = window._nePaymentIndex ?? 0;

  if (amount <= 0) {
    if (typeof showToast === 'function') showToast('金額を入力してください', 'warn');
    return;
  }
  if (!date) {
    if (typeof showToast === 'function') showToast('日付を入力してください', 'warn');
    return;
  }

  // 店舗名を正規化（表記揺れ吸収）
  const normalizedStore = typeof normalizeStoreName === 'function'
    ? normalizeStoreName(store) : store;
  const memo = normalizedStore || sug.label || '';

  // 既存フォームに値を流し込む
  if (dir === 'expense') {
    const payment = PAYMENT_METHODS[payIdx];
    _neSetFormValue('f-date',           date);
    _neSetFormValue('f-debit-account',  sug.debit || '消耗品費');
    _neSetFormValue('f-debit-sub',      memo);
    _neSetFormValue('f-debit-tax',      sug.tax   || 'input10');
    _neSetFormValue('f-debit-amount',   amount);
    _neSetFormValue('f-credit-account', payment.account);
    _neSetFormValue('f-credit-sub',     payment.label);
    _neSetFormValue('f-credit-tax',     'non');
    _neSetFormValue('f-credit-amount',  amount);
    _neSetFormValue('f-memo',           memo);
  } else {
    _neSetFormValue('f-date',           date);
    _neSetFormValue('f-debit-account',  '現金');
    _neSetFormValue('f-debit-sub',      '');
    _neSetFormValue('f-debit-tax',      'non');
    _neSetFormValue('f-debit-amount',   amount);
    _neSetFormValue('f-credit-account', sug.credit || '売上高');
    _neSetFormValue('f-credit-sub',     memo);
    _neSetFormValue('f-credit-tax',     sug.tax    || 'exempt10');
    _neSetFormValue('f-credit-amount',  amount);
    _neSetFormValue('f-memo',           memo);
  }
  _neSetFormValue('edit-id', ''); // 新規として保存

  // マイ辞書に店舗名を学習
  if (normalizedStore && sug.label) {
    const myDict = JSON.parse(localStorage.getItem('bizNavi_myDict') || '{}');
    if (!myDict[sug.label]) myDict[sug.label] = [];
    if (!myDict[sug.label].includes(normalizedStore)) {
      myDict[sug.label].unshift(normalizedStore);
      if (myDict[sug.label].length > 10) myDict[sug.label].pop();
    }
    localStorage.setItem('bizNavi_myDict', JSON.stringify(myDict));
  }

  // 新モーダルを閉じてsaveEntry()を呼ぶ
  document.getElementById('new-entry-modal')?.remove();
  if (typeof saveEntry === 'function') saveEntry();

  // Undoトースト：5秒間「↩️ 取り消す」を表示
  // saveEntry()がentriesにpushした直後なので末尾IDが保存済みエントリのID
  const _undoEntryId = (typeof entries !== 'undefined' && entries.length > 0)
    ? entries[entries.length - 1].id : null;
  _neShowUndoToast(_undoEntryId, amount, window._neSug?.label || '');
}
/* └ END : _neSaveEntry ──────────────────────────────────────────────┘ */
// フォームへの値設定ユーティリティ
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neSetFormValue
 * │   【§6 共通】指定IDのフォーム要素に値をセットするユーティリティ
 * └──────────────────────────────────────────────────────┘ */
function _neSetFormValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
  // selectの場合は存在するoptionだけセット
  if (el.tagName === 'SELECT') {
    const exists = [...el.options].some(o => o.value === String(value));
    if (exists) el.value = value;
  }
}
/* └ END : _neSetFormValue ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _neShowUndoToast
 * │   【§6 Undo】登録直後に5秒間「↩️ 取り消す」トーストを表示。
 * │   タップ時は訂正ログを残さず物理削除し入力値を画面に復元する。
 * └──────────────────────────────────────────────────────┘ */
function _neShowUndoToast(savedEntryId, savedAmount, savedLabel) {
  // 既存のUndoトーストがあれば除去
  const prev = document.getElementById('ne-undo-toast');
  if (prev) { prev.remove(); clearTimeout(prev._timer); }

  // saveEntry()が push した最後のエントリのIDを確定
  // （edit-idが空の新規保存時はentriesの末尾IDを参照）
  const entryId = savedEntryId || (typeof entries !== 'undefined' && entries.length > 0
    ? entries[entries.length - 1].id : null);

  if (!entryId) return; // IDが取れなければUndoは提供しない

  const toast = document.createElement('div');
  toast.id = 'ne-undo-toast';
  toast.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:#1e293b',
    'color:#fff',
    'border-radius:24px',
    'padding:12px 20px',
    'display:flex',
    'align-items:center',
    'gap:14px',
    'font-size:0.88rem',
    'font-weight:600',
    'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'z-index:99999',
    'white-space:nowrap',
    'animation:ne-toast-in 0.25s ease',
  ].join(';');

  // アニメーション用スタイル（1回だけ挿入）
  if (!document.getElementById('ne-undo-toast-style')) {
    const style = document.createElement('style');
    style.id = 'ne-undo-toast-style';
    style.textContent = [
      '@keyframes ne-toast-in {',
      '  from { opacity:0; transform:translateX(-50%) translateY(12px); }',
      '  to   { opacity:1; transform:translateX(-50%) translateY(0); }',
      '}',
      '@keyframes ne-toast-out {',
      '  from { opacity:1; transform:translateX(-50%) translateY(0); }',
      '  to   { opacity:0; transform:translateX(-50%) translateY(12px); }',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  // カウントダウンバー
  const bar = document.createElement('div');
  bar.style.cssText = [
    'position:absolute',
    'bottom:0',
    'left:0',
    'height:3px',
    'width:100%',
    'background:#6366f1',
    'border-radius:0 0 24px 24px',
    'transition:width 5s linear',
  ].join(';');
  toast.appendChild(bar);

  // テキスト
  const label = document.createElement('span');
  label.textContent = '✅ 記録しました';
  toast.appendChild(label);

  // Undoボタン
  const btn = document.createElement('button');
  btn.textContent = '↩️ 取り消す';
  btn.style.cssText = [
    'background:#6366f1',
    'color:#fff',
    'border:none',
    'border-radius:16px',
    'padding:6px 14px',
    'font-size:0.82rem',
    'font-weight:700',
    'cursor:pointer',
    'flex-shrink:0',
  ].join(';');

  btn.addEventListener('click', function() {
    clearTimeout(toast._timer);
    toast.remove();
    // 物理削除：entriesから該当IDを除去し訂正ログを残さない
    if (typeof entries !== 'undefined') {
      const idx = entries.findIndex(function(e) { return e.id === entryId; });
      if (idx >= 0) {
        entries.splice(idx, 1);
        if (typeof saveData === 'function') saveData();
        setTimeout(function() {
          if (typeof renderJournal === 'function') renderJournal();
          if (typeof updateDashboard === 'function') updateDashboard();
        }, 50);
        if (typeof showToast === 'function') showToast('記録を取り消しました', 'info');
      }
    }
  });
  toast.appendChild(btn);
  document.body.appendChild(toast);

  // カウントダウンバーのアニメーション開始
  requestAnimationFrame(function() {
    bar.style.width = '0%';
  });

  // 5秒後に自動消去
  toast._timer = setTimeout(function() {
    toast.style.animation = 'ne-toast-out 0.25s ease forwards';
    setTimeout(function() { toast.remove(); }, 260);
  }, 5000);
}
/* └ END : _neShowUndoToast ──────────────────────────────────────────────┘ */

// ===== openEntryModal の旧実装（編集時に使用） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openEntryModal
 * │   取引の編集モーダルを開く（編集専用・新規はopenNewEntryModal）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : openEntryModal ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : closeEntryModal
 * │   取引編集モーダルを閉じる
 * └──────────────────────────────────────────────────────┘ */
function closeEntryModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}
/* └ END : closeEntryModal ──────────────────────────────────────────────┘ */

// ===== 仕訳帳のカード表示（詳細版：新旧データ・タブ対応） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : entryCard
 * │   取引1件分のカードHTMLを生成して返す
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : entryCard ──────────────────────────────────────────────┘ */
// ===== 仕訳帳のカード表示（詳細版：新旧データ・タブ対応）終わり =====

// ===== [2026-05-04 00:05 修正：元帳比較ロジック最終強化版] =====
/**
 * 共通バーの値に基づき、日付文字列を分解して厳密に比較する。
 * これにより「5月を選択したのに4月のデータが残る」という表示の不整合を解消する。
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderLedger
 * │   総勘定元帳ページを描画（科目別明細・残高表示）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderLedger ──────────────────────────────────────────────┘ */
// ===== [2026-05-04 00:05 修正終了] =====

// ===== 税計算をリアルタイムで行う関数（修正版）=====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : calcTax
 * │   消費税の課税売上・仮受税額・仮払税額を集計
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : calcTax ──────────────────────────────────────────────┘ */
// ===== 税計算をリアルタイムで行う関数（修正版）終わり =====


// ===== 消費税計算（修正版） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderTax
 * │   消費税管理ページを描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderTax ──────────────────────────────────────────────┘ */
// ===== 消費税計算（修正版）終わり =====

// ===== 決算報告 (P/L & B/S) 修正版 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderReport
 * │   集計・レポートページを描画（損益集計・科目別内訳）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderReport ──────────────────────────────────────────────┘ */
// ===== 決算報告 (P/L & B/S) 修正版 終わり=====


// ===== CSVエクスポート・共通処理 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : exportJournalCSV
 * │   取引記録帳のデータをCSVでダウンロード
 * └──────────────────────────────────────────────────────┘ */
function exportJournalCSV() {
  let csv = '\uFEFF日付,内容,金額,財布,金額,摘要,按分率\n';
  entries.forEach(e => {
    csv += `"${e.date}","${e.debit.account}",${e.debit.amount},"${e.credit.account}",${e.credit.amount},"${e.memo||''}",${e.kasji ? e.kasji.rate : ''}\n`;
  });
  downloadCSV(csv, '仕訳帳.csv');
}
/* └ END : exportJournalCSV ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : downloadCSV
 * │   データをCSVファイルとしてダウンロードさせる汎用関数
 * └──────────────────────────────────────────────────────┘ */
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
/* └ END : downloadCSV ──────────────────────────────────────────────┘ */


// ===== [2026-05-14 16:15 修正] グラフエンジン (取引先マスタ・predicted_sub完全同期版) =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderDashboardCharts
 * │   月次収支グラフ・累積利益折れ線をChart.jsで描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderDashboardCharts ──────────────────────────────────────────────┘ */
// ===== [2026-05-14 16:15 修正] グラフエンジン 終わり =====


// ===== Toast通知 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showToast
 * │   画面下部にトースト通知を表示（info/success/warn/error）
 * └──────────────────────────────────────────────────────┘ */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = 'toast', 2500);
  }
}
/* └ END : showToast ──────────────────────────────────────────────┘ */
// ===== 家事按分の連動処理 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : toggleKasji
 * │   車両経費の仕事割合設定の表示/非表示を切り替える
 * └──────────────────────────────────────────────────────┘ */
function toggleKasji() {
  const enabled = document.getElementById('f-kasji-enabled').checked;
  const detail = document.getElementById('kasji-detail');
  if (detail) detail.style.display = enabled ? 'block' : 'none';
  updateKasjiPreview();
}
/* └ END : toggleKasji ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateKasjiPreview
 * │   仕事割合の設定値に応じて経費計算プレビューを更新
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateKasjiPreview ──────────────────────────────────────────────┘ */

// ===== 科目種別判定（正攻法：文字列のみを返す） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getAccountType
 * │   勘定科目名から「収入」「支出」「その他」を返す
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : getAccountType ──────────────────────────────────────────────┘ */
// ===== 科目種別判定 終わり =====

// ===== 科目変更時の初期値セット（免税事業者ガード付き修正版） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : onAccountChange
 * │   勘定科目セレクト変更時に税区分・金額を自動補完
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : onAccountChange ──────────────────────────────────────────────┘ */
// ===== 科目変更時の初期値セット（免税事業者ガード付き修正版） 終わり =====


// ===== 電子帳簿保存法 検索クリア =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : clearDenchoSearch
 * │   電帳法ページの検索フィールドをクリアして全件表示に戻す
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : clearDenchoSearch ──────────────────────────────────────────────┘ */

// ===== 消費税設定の読み込み（エラー解消用） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadTaxSettings
 * │   localStorageから消費税設定を読み込んでUIに反映
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : loadTaxSettings ──────────────────────────────────────────────┘ */

// ===== 消費税設定の保存 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveTaxSettings
 * │   消費税設定をlocalStorageに保存
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : saveTaxSettings ──────────────────────────────────────────────┘ */
// ===== 消費税設定の保存ここまで =====


// ===== [2026-05-16 修正] Super Cleaner搭載：全自動仕訳 & 財布判別インポート =====
// ============================================================
// データ保護・復旧導線（§ データ保護）
// ============================================================

// 全データをJSONで書き出し
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : exportAllDataJSON
 * │   全データ（取引・日報・設定・マイ辞書）をJSONファイルで書き出す
 * └──────────────────────────────────────────────────────┘ */
function exportAllDataJSON() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const filename = `biznavi_backup_${stamp}.json`;

  const data = {
    version:    '1.0',
    exportedAt: now.toISOString(),
    entries:    entries || [],
    dailyLogs:  dailyLogs || [],
    assets:     (typeof assets !== 'undefined') ? assets : [],
    taxSettings:(typeof taxSettings !== 'undefined') ? taxSettings : {},
    settings:   JSON.parse(localStorage.getItem('bizNaviSettings') || '{}'),
    vehicleReminders: JSON.parse(localStorage.getItem('bizNavi_vehicleReminders') || '[]'),
    myDict:     JSON.parse(localStorage.getItem('bizNavi_myDict') || '{}'),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  if (typeof showToast === 'function') {
    showToast(`📤 バックアップを保存しました（${filename}）`, 'success');
  }
}
/* └ END : exportAllDataJSON ──────────────────────────────────────────────┘ */

// JSONからデータを復元
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : importAllDataJSON
 * │   JSONバックアップから全データを復元する（保存日時・件数を確認してから実行）
 * └──────────────────────────────────────────────────────┘ */
function importAllDataJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // バージョン確認
      if (!data.exportedAt && !data.entries) {
        if (typeof showToast === 'function') showToast('このファイルはBiz-Naviのバックアップではありません', 'error');
        return;
      }

      // 確認ダイアログ
      const exportDate = data.exportedAt
        ? new Date(data.exportedAt).toLocaleString('ja-JP')
        : '不明';
      const entryCount = (data.entries || []).length;
      const logCount   = (data.dailyLogs || []).length;

      if (!confirm(
        `バックアップを復元します。\n\n` +
        `保存日時：${exportDate}\n` +
        `取引件数：${entryCount}件\n` +
        `日報件数：${logCount}件\n\n` +
        `現在のデータは上書きされます。\n続けますか？`
      )) return;

      // 復元
      if (data.entries)    { window.entries   = data.entries;   localStorage.setItem('kaikei_entries', JSON.stringify(data.entries)); }
      if (data.dailyLogs)  { window.dailyLogs = data.dailyLogs; saveDailyLogsToStorage(); }
      if (data.settings)   localStorage.setItem('bizNaviSettings',        JSON.stringify(data.settings));
      if (data.vehicleReminders) localStorage.setItem('bizNavi_vehicleReminders', JSON.stringify(data.vehicleReminders));
      if (data.myDict)     localStorage.setItem('bizNavi_myDict',          JSON.stringify(data.myDict));

      // 画面更新
      if (typeof updateDashboard === 'function') updateDashboard();
      if (typeof renderJournal   === 'function') renderJournal();
      if (typeof renderDailyPage === 'function') renderDailyPage();

      if (typeof showToast === 'function') {
        showToast(`📥 復元完了：取引${entryCount}件・日報${logCount}件`, 'success');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('ファイルの読み込みに失敗しました', 'error');
      console.error('Restore error:', err);
    }
  };
  reader.readAsText(file, 'UTF-8');
}
/* └ END : importAllDataJSON ──────────────────────────────────────────────┘ */

// 全データ削除（確認2段階）
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : clearAllDataWithConfirm
 * │   2段階確認の上で全データを削除する（Danger Zone）
 * └──────────────────────────────────────────────────────┘ */
function clearAllDataWithConfirm() {
  if (!confirm(
    '⚠️ 全てのデータを削除します。\n\n' +
    '取引・日報・設定が全て消えます。\n' +
    'この操作は取り消せません。\n\n' +
    '先にバックアップを取りましたか？'
  )) return;

  if (!confirm('本当に削除しますか？\n（この確認が最後です）')) return;

  // データクリア
  window.entries   = [];
  window.dailyLogs = [];
  localStorage.setItem('kaikei_entries', '[]');
  saveDailyLogsToStorage();
  localStorage.removeItem('bizNavi_vehicleReminders');
  localStorage.removeItem('bizNavi_myDict');
  localStorage.removeItem('bizNavi_setup_done');
  localStorage.removeItem('bizNavi_agreed');

  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof renderJournal   === 'function') renderJournal();
  if (typeof renderDailyPage === 'function') renderDailyPage();
  if (typeof showToast === 'function') showToast('🗑️ 全データを削除しました', 'info');
}
/* └ END : clearAllDataWithConfirm ──────────────────────────────────────────────┘ */

// ============================================================
// サンプルデータ（UI確認用・1ヶ月分の配送業務デモデータ）
// ============================================================
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadSampleData
 * │   UI確認用の1ヶ月分サンプルデータを追加する（取引17件・日報20日分）
 * └──────────────────────────────────────────────────────┘ */
function loadSampleData() {
  if (!confirm(
    '1ヶ月分のサンプルデータを追加します。\n' +
    '（既存のデータは消えません。追加されます）\n\n続けますか？'
  )) return;

  const today    = new Date();
  const y        = today.getFullYear();
  const m        = today.getMonth(); // 0-indexed
  const makeDate = (day) => `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  // --- サンプル取引 ---
  const sampleEntries = [
    // 売上（配送）
    { day:  2, debit:'現金',    credit:'売上高',   amount:52000, content:'配送売上（アマフレ）', memo:'2月分委託費' },
    { day: 16, debit:'現金',    credit:'売上高',   amount:48500, content:'配送売上（PickGo）',   memo:'上旬分' },
    { day: 28, debit:'現金',    credit:'売上高',   amount:24000, content:'配送売上（スポット）', memo:'週末案件' },
    // 燃料費
    { day:  3, debit:'燃料費',  credit:'現金',     amount: 6820, content:'ガソリン代',            memo:'ENEOS 平塚万田店' },
    { day: 10, debit:'燃料費',  credit:'現金',     amount: 7140, content:'ガソリン代',            memo:'ENEOS 平塚万田店' },
    { day: 18, debit:'燃料費',  credit:'現金',     amount: 6530, content:'ガソリン代',            memo:'ENEOS 茅ヶ崎店' },
    { day: 25, debit:'燃料費',  credit:'現金',     amount: 7200, content:'ガソリン代',            memo:'ENEOS 平塚万田店' },
    // 高速・ETC
    { day:  5, debit:'旅費交通費', credit:'未払金', amount:  970, content:'高速代（ETC）',         memo:'新湘南バイパス' },
    { day: 12, debit:'旅費交通費', credit:'未払金', amount: 1240, content:'高速代（ETC）',         memo:'厚木IC往復' },
    { day: 20, debit:'旅費交通費', credit:'未払金', amount:  860, content:'高速代（ETC）',         memo:'新湘南バイパス' },
    // 駐車場
    { day:  7, debit:'旅費交通費', credit:'現金',   amount:  300, content:'駐車場代',              memo:'コインパーク' },
    { day: 14, debit:'旅費交通費', credit:'現金',   amount:  400, content:'駐車場代',              memo:'タイムズ' },
    // 消耗品・業務
    { day:  8, debit:'消耗品費',  credit:'現金',    amount: 1980, content:'軍手・梱包テープ',      memo:'コーナン' },
    { day: 22, debit:'消耗品費',  credit:'現金',    amount: 1320, content:'養生テープ・マジック',  memo:'ダイソー' },
    // 通信費
    { day:  1, debit:'通信費',    credit:'未払金',  amount: 3080, content:'スマホ代（仕事用）',   memo:'楽天モバイル' },
    // 食事（深夜）
    { day: 15, debit:'福利厚生費', credit:'現金',   amount:  680, content:'深夜の夜食',            memo:'ファミリーマート' },
    { day: 23, debit:'福利厚生費', credit:'現金',   amount:  520, content:'熱中症対策の飲み物',   memo:'自販機' },
  ];

  const newEntries = sampleEntries.map((s, i) => ({
    id:          `sample_${Date.now()}_${i}`,
    date:        makeDate(Math.min(s.day, 28)),
    debitAcc:    s.debit,
    debitAmt:    s.amount,
    debitTax:    s.credit === '売上高' ? 'exempt10' : 'input10',
    creditAcc:   s.credit,
    creditAmt:   s.amount,
    creditTax:   'non',
    content:     s.content,
    memo:        s.memo || '',
    manually_saved: true,
    status:      'completed',
    source:      'sample'
  }));

  // --- サンプル日報 ---
  const sampleLogs = [
    { day: 2,  startOdo: 32100.0, endOdo: 32284.5, deliveries: 52, memo: 'アマフレ 横浜南エリア' },
    { day: 3,  startOdo: 32284.5, endOdo: 32461.2, deliveries: 48, memo: 'アマフレ 横浜南エリア' },
    { day: 5,  startOdo: 32461.2, endOdo: 32638.7, deliveries: 51, memo: 'PickGo 藤沢' },
    { day: 6,  startOdo: 32638.7, endOdo: 32799.3, deliveries: 45, memo: 'アマフレ 茅ヶ崎' },
    { day: 8,  startOdo: 32799.3, endOdo: 32968.1, deliveries: 53, memo: 'アマフレ 平塚' },
    { day: 9,  startOdo: 32968.1, endOdo: 33142.6, deliveries: 49, memo: 'PickGo 藤沢' },
    { day:10,  startOdo: 33142.6, endOdo: 33318.4, deliveries: 55, memo: 'アマフレ 横浜南エリア' },
    { day:12,  startOdo: 33318.4, endOdo: 33487.9, deliveries: 47, memo: 'スポット 相模原' },
    { day:13,  startOdo: 33487.9, endOdo: 33661.2, deliveries: 50, memo: 'アマフレ 平塚' },
    { day:15,  startOdo: 33661.2, endOdo: 33831.8, deliveries: 52, memo: 'アマフレ 茅ヶ崎・深夜便' },
    { day:16,  startOdo: 33831.8, endOdo: 34008.5, deliveries: 48, memo: 'PickGo 藤沢' },
    { day:17,  startOdo: 34008.5, endOdo: 34179.3, deliveries: 46, memo: 'アマフレ 横浜南エリア' },
    { day:19,  startOdo: 34179.3, endOdo: 34351.7, deliveries: 54, memo: 'アマフレ 平塚' },
    { day:20,  startOdo: 34351.7, endOdo: 34524.2, deliveries: 51, memo: 'PickGo 鎌倉' },
    { day:22,  startOdo: 34524.2, endOdo: 34697.8, deliveries: 49, memo: 'アマフレ 茅ヶ崎' },
    { day:23,  startOdo: 34697.8, endOdo: 34869.1, deliveries: 52, memo: 'アマフレ 平塚' },
    { day:24,  startOdo: 34869.1, endOdo: 35041.6, deliveries: 50, memo: 'PickGo 藤沢' },
    { day:26,  startOdo: 35041.6, endOdo: 35214.3, deliveries: 48, memo: 'アマフレ 横浜南エリア' },
    { day:27,  startOdo: 35214.3, endOdo: 35388.9, deliveries: 53, memo: 'アマフレ 平塚・茅ヶ崎' },
    { day:28,  startOdo: 35388.9, endOdo: 35561.4, deliveries: 55, memo: 'スポット 横浜中央' },
  ].map((l, i) => {
    const dist      = Math.round((l.endOdo - l.startOdo) * 100) / 100;
    const unitPrice = 220;
    const sales     = l.deliveries * unitPrice;
    const startH    = 8;
    const endH      = startH + Math.round(dist / 30 * 10) / 10;
    const elapsedMin= Math.round((endH - startH) * 60);
    const startTime = new Date(`${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(l.day,28)).padStart(2,'0')}T${String(startH).padStart(2,'0')}:00:00`);
    return {
      id:          `slog_${Date.now()}_${i}`,
      date:        makeDate(Math.min(l.day, 28)),
      startOdo:    Math.round(l.startOdo * 100) / 100,
      endOdo:      Math.round(l.endOdo   * 100) / 100,
      distance:    dist,
      deliveries:  l.deliveries,
      unitPrice,
      sales,
      startTime:   startTime.toISOString(),
      endTime:     new Date(startTime.getTime() + elapsedMin * 60000).toISOString(),
      memo:        l.memo,
      status:      'completed',
      source:      'sample'
    };
  });

  // データに追加
  entries   = [...(entries   || []), ...newEntries];
  dailyLogs = [...(dailyLogs || []), ...sampleLogs];
  if (typeof saveData               === 'function') saveData();
  if (typeof saveDailyLogsToStorage === 'function') saveDailyLogsToStorage();

  // 画面更新
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof renderJournal   === 'function') renderJournal();
  if (typeof renderDailyPage === 'function') renderDailyPage();
  if (typeof renderCalendar  === 'function') renderCalendar();

  if (typeof showToast === 'function') {
    showToast(
      `🎯 サンプルデータを追加しました（取引${newEntries.length}件・日報${sampleLogs.length}日分）`,
      'success'
    );
  }
}
/* └ END : loadSampleData ──────────────────────────────────────────────┘ */

// ============================================================（PRiMPO廃止・Python廃止後の新実装）
// 銀行明細・カードCSVを列マッピングで取り込む
// ============================================================

// csv-file input のonchange から呼ばれる
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : importPrimpoCSV
 * │   【§6】csv-file inputのonchangeハンドラ。CSV→列マッピングUI / 画像→証拠保存 に振り分ける
 * └──────────────────────────────────────────────────────┘ */
async function importPrimpoCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  // input をリセット（同じファイルを再選択できるように）
  event.target.value = '';

  // CSVか画像かで分岐
  if (file.type.startsWith('image/')) {
    // 写真保存モード（証拠画像・OCRなし）
    _saveReceiptImage(file);
    return;
  }

  // CSVの場合：汎用インポートモーダルを開く
  _openCsvImportModal(file);
}
/* └ END : importPrimpoCSV ──────────────────────────────────────────────┘ */

// 証拠画像として保存（OCRなし・電帳法対応）
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _saveReceiptImage
 * │   【§6】領収書画像をSHA-256ハッシュ付きで端末内に保存（OCRなし・電帳法証拠用）
 * └──────────────────────────────────────────────────────┘ */
function _saveReceiptImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const now     = new Date();
    const id      = `img_${Date.now()}`;

    // SHA-256ハッシュを付与（電帳法対応）
    const encoder = new TextEncoder();
    const data    = encoder.encode(dataUrl);
    crypto.subtle.digest('SHA-256', data).then(buf => {
      const hashArray = Array.from(new Uint8Array(buf));
      const hashHex   = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const imgRecord = {
        id,
        timestamp: now.toISOString(),
        filename:  file.name,
        size:      file.size,
        dataUrl,
        sha256:    hashHex,
        type:      'receipt_image'
      };

      const imgs = JSON.parse(localStorage.getItem('bizNavi_receiptImages') || '[]');
      imgs.push(imgRecord);
      localStorage.setItem('bizNavi_receiptImages', JSON.stringify(imgs));

      if (typeof showToast === 'function') {
        showToast('📷 領収書画像を保存しました（証拠画像として記録）', 'success');
      }
    });
  };
  reader.readAsDataURL(file);
}
/* └ END : _saveReceiptImage ──────────────────────────────────────────────┘ */

// 汎用CSVインポートモーダル（列マッピングUI）
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _openCsvImportModal
 * │   【§6】CSVを読み込んで列マッピングUIモーダルを開く
 * └──────────────────────────────────────────────────────┘ */
function _openCsvImportModal(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text  = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      if (typeof showToast === 'function') showToast('CSVのデータが空です', 'warn');
      return;
    }

    // ヘッダー行を自動探索（1〜5行目で試す）
    let headerIdx = 0;
    const dateLike  = /日付|date|日時|取引日/i;
    const amountLike = /金額|amount|出金|入金|金額\(円\)/i;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (dateLike.test(lines[i]) || amountLike.test(lines[i])) {
        headerIdx = i;
        break;
      }
    }

    const headers  = lines[headerIdx].split(',').map(h => h.replace(/"/g, '').trim());
    const preview  = lines.slice(headerIdx + 1, headerIdx + 4); // プレビュー3行

    const existing = document.getElementById('csv-import-modal');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'csv-import-modal';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.6);
      z-index:10001;display:flex;align-items:flex-end;justify-content:center;`;

    const opts = ['（使用しない）', ...headers]
      .map((h, i) => `<option value="${i === 0 ? '' : headers[i-1]}">${h}</option>`)
      .join('');

    const autoDate   = headers.find(h => dateLike.test(h))   || '';
    const autoAmount = headers.find(h => amountLike.test(h)) || '';
    const autoMemo   = headers.find(h => /摘要|内容|memo|店舗|名称/i.test(h)) || '';

    el.innerHTML = `
      <div style="background:var(--color-surface,#fff);width:100%;max-width:520px;
                  border-radius:20px 20px 0 0;padding:22px 18px 36px;
                  max-height:90vh;overflow-y:auto;box-shadow:0 -4px 24px rgba(0,0,0,0.2);">
        <div style="font-weight:700;font-size:1rem;color:var(--color-text);margin-bottom:4px;">
          📂 CSVを取り込む
        </div>
        <div style="font-size:0.78rem;color:var(--color-muted);margin-bottom:16px;">
          「日付」「金額」「内容」の列を選んでください
        </div>

        ${[
          { id:'csv-col-date',   label:'📅 日付の列',   auto: autoDate },
          { id:'csv-col-amount', label:'💴 金額の列',   auto: autoAmount },
          { id:'csv-col-memo',   label:'📝 内容の列（任意）', auto: autoMemo },
        ].map(f => `
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:0.75rem;font-weight:700;
                          color:var(--color-muted);margin-bottom:5px;">${f.label}</label>
            <select id="${f.id}"
              style="width:100%;padding:10px;border-radius:10px;font-size:0.9rem;
                     border:1.5px solid var(--color-border-mid);
                     background:var(--color-surface);color:var(--color-text);
                     box-sizing:border-box;">
              ${['（使用しない）', ...headers].map(h =>
                `<option value="${h === '（使用しない）' ? '' : h}"
                  ${h === f.auto ? 'selected' : ''}>${h}</option>`
              ).join('')}
            </select>
          </div>
        `).join('')}

        <div style="background:var(--color-bg);border-radius:10px;padding:10px 12px;
                    margin-bottom:16px;overflow-x:auto;">
          <div style="font-size:0.72rem;color:var(--color-muted);margin-bottom:6px;font-weight:700;">
            プレビュー（最初の3件）
          </div>
          <div style="font-size:0.75rem;color:var(--color-text);line-height:1.8;">
            ${preview.map(l => `<div style="border-bottom:1px solid var(--color-border);padding:2px 0;">
              ${l.split(',').map(c => `<span style="padding:0 6px;">${c.replace(/"/g,'')}</span>`).join('')}
            </div>`).join('')}
          </div>
        </div>

        <button onclick="_executeCsvImport(${JSON.stringify(lines).replace(/</g,'\u003c')}, ${headerIdx})"
          style="width:100%;background:var(--color-accent,#6366f1);color:#fff;border:none;
                 border-radius:14px;padding:14px;font-size:0.95rem;font-weight:700;cursor:pointer;
                 margin-bottom:10px;">
          📥 取り込む
        </button>
        <button onclick="document.getElementById('csv-import-modal').remove()"
          style="width:100%;background:none;border:none;color:var(--color-muted);
                 font-size:0.85rem;cursor:pointer;padding:8px;">
          キャンセル
        </button>
      </div>`;

    document.body.appendChild(el);
    el.addEventListener('click', ev => { if (ev.target === el) el.remove(); });

    // lines をモーダルに紐付け
    el._csvLines   = lines;
    el._headerIdx  = headerIdx;
    el._headers    = headers;
  };
  reader.readAsText(file, 'UTF-8');
}
/* └ END : _openCsvImportModal ──────────────────────────────────────────────┘ */

// CSV取込実行
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _executeCsvImport
 * │   【§6】列マッピングに従ってCSVデータを取引として取り込む
 * └──────────────────────────────────────────────────────┘ */
function _executeCsvImport(linesRaw, headerIdx) {
  const modal   = document.getElementById('csv-import-modal');
  const colDate   = document.getElementById('csv-col-date')?.value   || '';
  const colAmount = document.getElementById('csv-col-amount')?.value || '';
  const colMemo   = document.getElementById('csv-col-memo')?.value   || '';

  if (!colDate || !colAmount) {
    if (typeof showToast === 'function') showToast('日付と金額の列を選択してください', 'warn');
    return;
  }

  const lines   = typeof linesRaw === 'string' ? JSON.parse(linesRaw) : linesRaw;
  const headers = lines[headerIdx].split(',').map(h => h.replace(/"/g,'').trim());
  const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim());

  const isExempt  = typeof isExemptUser === 'function' ? isExemptUser() : false;
  let count = 0;

  dataLines.forEach((line, i) => {
    const cols = line.split(',').map(c => c.replace(/"/g,'').trim());
    const row  = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });

    const rawDate  = row[colDate]   || '';
    const rawAmt   = row[colAmount] || '0';
    const rawMemo  = colMemo ? (row[colMemo] || '') : '';

    const date   = rawDate.replace(/\//g, '-').split(' ')[0];
    const amount = Math.abs(parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) || 0);
    if (amount === 0 && !rawMemo) return;

    const taxCode = isExempt ? 'non' : 'input10';
    const entry = {
      id:       `csv_${Date.now()}_${i}`,
      date,
      debitAcc: '未確認',
      debitAmt: amount,
      debitTax: taxCode,
      creditAcc: '現金',
      creditAmt: amount,
      creditTax: 'non',
      content:  rawMemo || 'CSV取込',
      memo:     rawMemo,
      manually_saved: false,
      status:   'unprocessed',
      source:   'csv'
    };
    entries.push(entry);
    count++;
  });

  if (typeof saveData === 'function') saveData();
  if (typeof renderJournal === 'function') renderJournal();
  if (typeof updateDashboard === 'function') updateDashboard();
  modal?.remove();

  if (typeof showToast === 'function') {
    showToast(`${count}件を取り込みました。記録帳で確認・仕分けしてください`, 'success');
  }
}
/* └ END : _executeCsvImport ──────────────────────────────────────────────┘ */

// ===== 旧importPrimpoCSVWithDencho は廃止（importPrimpoCSVに統合済み） =====

// ===== データ初期化 (Danger Zone) =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : resetAllData
 * │   全データを強制リセット（旧実装・clearAllDataWithConfirmを推奨）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : resetAllData ──────────────────────────────────────────────┘ */
// ===== データ初期化 (Danger Zone) 終わり =====


// ===== ユーティリティ: 金額集計ロジック (calcSums) マージ版（堅牢性向上済み） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : calcSums
 * │   取引配列から収入・支出・科目別合計を集計して返す
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : calcSums ──────────────────────────────────────────────┘ */
// ===== ユーティリティ: 金額集計ロジック (calcSums) 終わり =====


// ===== [2026-05-03 19:45 修正] 科目別内訳：共通期間バー(global-year/month)完全同期版 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderCategorySection
 * │   科目別内訳ドーナツチャートを描画（支出/収入切替対応）
 * └──────────────────────────────────────────────────────┘ */
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
  //    ※ wrap.innerHTML でcanvasを消去しない（消去すると次回描画不能になるため）
  const EMPTY_ID = 'cat-chart-empty';
  const wrap = canvas.closest('.donut-wrap') || canvas.closest('.chart-wrap');

  // 既存のエンプティステートを除去
  const prevEmpty = wrap ? wrap.querySelector('#' + EMPTY_ID) : null;
  if (prevEmpty) prevEmpty.remove();

  if (labels.length === 0) {
    canvas.style.display = 'none';
    if (wrap) {
      const emptyDiv = document.createElement('div');
      emptyDiv.id = EMPTY_ID;
      emptyDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 16px;gap:8px;';
      emptyDiv.innerHTML = `
        <div style="font-size:2rem;">🍩</div>
        <div style="font-weight:700;color:var(--color-text);font-size:0.9rem;">集計データがありません</div>
        <div style="font-size:0.78rem;color:var(--color-muted);text-align:center;line-height:1.6;">
          この期間の${type === 'income' ? '収入' : '支出'}を<br>記録すると内訳が表示されます
        </div>`;
      wrap.appendChild(emptyDiv);
    }
    return;
  }

  // データがある場合はcanvasを再表示
  canvas.style.display = 'block';

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
/* └ END : renderCategorySection ──────────────────────────────────────────────┘ */
// ===== [2026-05-03 19:45 修正終了] =====


// ===== [2026-05-03 19:55 修正] カテゴリ別グラフのタブ切り替え：共通バー連動版 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : switchCatTab
 * │   科目別内訳の支出/収入タブを切り替える
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : switchCatTab ──────────────────────────────────────────────┘ */
// ===== [2026-05-03 19:55 修正終了] =====


// ==========================================
// 欠落関数の復旧・UI制御用部品
// ==========================================

/**
 * ① 概要タブの切り替え (収入/支出)
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : switchCatTab
 * │   科目別内訳の支出/収入タブを切り替える
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : switchCatTab ──────────────────────────────────────────────┘ */

/**
 * ③ モーダルを閉じる
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : closeModal
 * │   取引入力モーダルを閉じる（旧closeEntryModalの別名）
 * └──────────────────────────────────────────────────────┘ */
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
/* └ END : closeModal ──────────────────────────────────────────────┘ */

/**
 * ④ 「済」マーク（status）の整合性を維持するための保存
 * ※もしsaveData内でstatusを落としていた場合、ここが重要になります
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveWithStatus
 * │   ステータスを維持したまま取引を保存
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : saveWithStatus ──────────────────────────────────────────────┘ */
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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateCalendarMask
 * │   カレンダーの月フィルターに応じて表示を調整
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateCalendarMask ──────────────────────────────────────────────┘ */

/**
 * 2026-05-03 23:05 修正: 共通期間バーの変更を検知
 * 存在する描画関数のみを実行するように整理（updateCalendarMaskを削除）
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : handleGlobalPeriodChange
 * │   年月フィルター変更時に全ページを一括更新
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : handleGlobalPeriodChange ──────────────────────────────────────────────┘ */

/**
 * [2026-05-04 13:50 追加]
 * 仕訳帳などの個別ページの期間選択を、メインの期間選択(global-year/month)と同期させ、
 * 全体の表示データを更新・再描画する。
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : syncPeriodAndRefresh
 * │   期間セレクト変更を他ページに同期して再描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : syncPeriodAndRefresh ──────────────────────────────────────────────┘ */

/**
 * [2026-05-04 14:30 更新] 
 * 全ページ（概要・仕訳帳・資産台帳）の期間セレクトボックスを
 * メインの選択値(global-year/month)に強制同期する
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : syncAllPeriodSelectors
 * │   全ページの期間セレクトを同期する
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : syncAllPeriodSelectors ──────────────────────────────────────────────┘ */


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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateUsefulLife
 * │   耐用年数に応じた年間償却額プレビューを更新
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateUsefulLife ──────────────────────────────────────────────┘ */



// ======================================================
// 🚗 車両資産・詳細設定システム (2026-05-07 統合版)
// ======================================================

/**
 * 1. 詳細設定モーダルを開く
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openAssetModal
 * │   資産登録モーダルを開く（取引からの資産化も対応）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : openAssetModal ──────────────────────────────────────────────┘ */

/**
 * 2. 詳細設定モーダルを閉じる
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : closeAssetModal
 * │   資産登録モーダルを閉じる
 * └──────────────────────────────────────────────────────┘ */
function closeAssetModal() {
    const modal = document.getElementById('asset-modal');
    if (modal) modal.style.display = 'none';
}
/* └ END : closeAssetModal ──────────────────────────────────────────────┘ */

/**
 * 4. 資産台帳への保存処理
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveAssetConfig
 * │   資産情報をlocalStorageに保存
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : saveAssetConfig ──────────────────────────────────────────────┘ */


/* -------------------------------------------------------------------------- */
/* 2026-05-12 修正: 旧初期設定ウィザード関連のスクラップ（削除）とUI同期ロジックの整理
/* 内容: HTMLベースの旧ウィザード・スライダー制御を削除。新ウィザード導入の準備。
/* -------------------------------------------------------------------------- */

/**
 * 1. 免税事業者設定に基づいてUI（バッジ、ロック、スイッチ）を更新する
 * 役割: 設定画面や入力画面の税務表示を最新の状態に同期します。
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateExemptUI
 * │   免税/課税の切替に応じてUIを更新
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateExemptUI ──────────────────────────────────────────────┘ */

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

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : isExemptUser
 * │   現在のユーザーが免税事業者かどうかを返す
 * └──────────────────────────────────────────────────────┘ */
function isExemptUser() {
    const settings = JSON.parse(localStorage.getItem('userSettings'));
    return !!(settings && settings.isExempt === true);
}
/* └ END : isExemptUser ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : applyTaxLock
 * │   インボイス登録有無に応じて消費税設定のロック状態を制御
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : applyTaxLock ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : toggleExemptSetting
 * │   免税/課税の切替ボタン処理
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : toggleExemptSetting ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateExemptUI
 * │   免税/課税の切替に応じてUIを更新
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateExemptUI ──────────────────────────────────────────────┘ */

/* -------------------------------------------------------------------------- */

/* =============================================================
   【最終統合司令塔】ProWizard 本体とアプリ初期化ロジック
   ============================================================= */

// ============================================================
// ============================================================
// 利用規約・免責事項モーダル
// 本文データは terms.js の TERMS_SECTIONS を参照
// ============================================================
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openTermsModal
 * │   利用規約・免責事項モーダルを開く（terms.jsのTERMS_SECTIONSを参照）
 * └──────────────────────────────────────────────────────┘ */
function openTermsModal() {
  const existing = document.getElementById('terms-modal');
  if (existing) existing.remove();

  // terms.js が読み込まれていない場合のフォールバック
  const sections = (typeof TERMS_SECTIONS !== 'undefined')
    ? TERMS_SECTIONS
    : [{ title: '利用規約', body: '準備中です。今しばらくお待ちください。' }];
  const version = typeof TERMS_VERSION !== 'undefined' ? TERMS_VERSION : '';
  const date    = typeof TERMS_DATE    !== 'undefined' ? TERMS_DATE    : '';

  const el = document.createElement('div');
  el.id = 'terms-modal';
  el.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99997;display:flex;align-items:flex-end;justify-content:center;`;

  el.innerHTML = `
    <div style="background:var(--color-surface,#fff);width:100%;max-width:520px;
                border-radius:20px 20px 0 0;
                max-height:88vh;display:flex;flex-direction:column;">

      <!-- 固定ヘッダー -->
      <div style="padding:18px 20px 14px;border-bottom:1px solid var(--color-border,#e2e8f0);
                  flex-shrink:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:700;font-size:1rem;color:var(--color-text,#1e293b);">
              📜 Biz-Navi 利用規約・免責事項
            </div>
            ${version ? `<div style="font-size:0.72rem;color:var(--color-muted,#64748b);margin-top:2px;">
              Ver.${version}　最終更新：${date}
            </div>` : ''}
          </div>
          <button onclick="document.getElementById('terms-modal').remove()"
            style="background:none;border:none;font-size:1.4rem;
                   color:var(--color-muted,#64748b);cursor:pointer;padding:4px 8px;">✕</button>
        </div>
      </div>

      <!-- スクロールコンテンツ -->
      <div style="overflow-y:auto;padding:16px 20px 36px;flex:1;">
        ${sections.map(sec => `
          <div style="margin-bottom:24px;">
            <div style="font-weight:700;font-size:0.9rem;color:var(--color-accent,#6366f1);
                        margin-bottom:8px;padding-bottom:5px;
                        border-bottom:1px solid var(--color-border,#e2e8f0);">
              ${sec.title}
            </div>
            <div style="font-size:0.82rem;color:var(--color-text,#1e293b);
                        line-height:1.9;white-space:pre-wrap;">
${sec.body}
            </div>
          </div>
        `).join('')}

        <div style="text-align:center;margin-top:8px;">
          <button onclick="document.getElementById('terms-modal').remove()"
            style="background:var(--color-accent,#6366f1);color:#fff;border:none;
                   border-radius:14px;padding:14px 40px;font-size:0.95rem;
                   font-weight:700;cursor:pointer;">
            閉じる
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}
/* └ END : openTermsModal ──────────────────────────────────────────────┘ */

// §4 10ステップ承認ウィザード（ProWizard）
// 「日本一優しいお約束ウィザード」
// 1画面1メッセージ・進捗バー（N/10形式）
// ============================================================

window.ProWizard = window.ProWizard || {};

// ---- ステップ定義 ----
ProWizard.STEPS = [
  {
    num: 1, icon: '💴', title: '料金のお約束',
    body: `最初の<b>2ヶ月（60日間）は完全無料</b>でお使いいただけます。<br><br>
その後は<b>月額500円</b>のみ。追加課金・広告は一切ありません。<br><br>
嫌になったらいつでも<b>ノーリスクで辞められます。</b>`,
    agree: null
  },
  {
    num: 2, icon: '📱', title: 'データの場所',
    body: `売上や経費などの大切なデータは、<b>100%あなたのスマホの中だけ</b>に保存されます。<br><br>
クラウドサーバーには<b>一切送信されません。</b><br>
開発者でさえ、あなたの帳簿を覗くことはできません。`,
    agree: null
  },
  {
    num: 3, icon: '⚠️', title: '超重要：データ消失について',
    body: `データがスマホ内にしかないため、<b>スマホの紛失・故障・初期化</b>でデータが消えた場合、<b>開発者でも絶対に復元できません。</b><br><br>
<span style="background:#fef3c7;padding:2px 6px;border-radius:4px;font-weight:700;">Google DriveなどへのバックアップはYOU自身で！</span><br><br>
設定画面にバックアップ機能があります。定期的にお使いください。`,
    agree: 'データ消失のリスクを理解しました'
  },
  {
    num: 4, icon: '🐱', title: 'アドバイスの扱いについて',
    body: `アプリが「<b>そろそろ車の買い替えどき🐱</b>」などと教えてくれることがありますが、<b>あくまで参考情報です。</b><br><br>
確定的な経営判断・税務判断は、必ず<b>税理士さんにご相談ください。</b>`,
    agree: null
  },
  {
    num: 5, icon: '📝', title: '確定申告について',
    body: `Biz-Naviは、あなたの記録を<b>きれいに整頓するお手伝い</b>をするアプリです。<br><br>
<b>確定申告の最終的な責任は、すべてユーザーご自身にあります。</b><br>
本アプリは申告内容の正確性・完全性を保証しません。<br><br>
<span style="background:rgba(234,179,8,0.15);border-left:3px solid #ca8a04;padding:4px 8px;display:block;border-radius:4px;margin:6px 0;">
⚠️ 開発者はあなたのデータを閲覧しません。<br>
個別の税務アドバイスも一切提供しません。<br>
申告に不安がある場合は<b>税理士にご相談ください。</b>
</span>
整ったデータを税理士さんに渡すと、作業が格段に楽になります。`,
    agree: null
  },
  {
    num: 6, icon: '⚡', title: 'アプリの軽さへのこだわり',
    body: `外部への重い通信や行動追跡システムは<b>一切ありません。</b><br><br>
電波のない地下駐車場でも<b>爆速で動く軽さ</b>を実現しています。<br><br>
あなたの行動データは<b>Appleの公式統計のみ</b>で把握します。`,
    agree: null
  },
  {
    num: 7, icon: '👁️', title: '最終確認はあなたの目で',
    body: `入力ミスを防ぐため、金額や日付の最終確認は、<b>あなたが取引記録帳で内容を確認するとき</b>にお願いします。<br><br>
アプリが自動で分類しますが、<b>正しいかどうかの判断はあなた自身</b>が行ってください。`,
    agree: null
  },
  {
    num: 8, icon: '🚪', title: 'いつでも辞めてOK',
    body: `データを人質に取る<b>ロック機能はありません。</b><br><br>
いつでも全てのデータを<b>CSV・JSONで書き出して</b>、自由に他のツールへ引っ越せます。<br><br>
「使って良ければワンコイン払ってね」というオープンスタンスです。`,
    agree: null
  },
  {
    num: 9, icon: '⚖️', title: '損害賠償の上限について',
    body: `バグや誤動作によって損害が生じた場合でも、<b>開発者が賠償できる金額には上限があります。</b><br><br>
<span style="background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;padding:6px 10px;display:block;border-radius:4px;margin:6px 0;font-size:0.92em;">
📌 <b>損害賠償の上限額</b><br>
ユーザーが過去に支払った利用料金のうち、<br>
<b>直近12ヶ月分・総額6,000円を上限</b>とします。<br>
それを超える損害（逸失利益・間接損害等）については、<br>
開発者は一切責任を負いません。
</span>
これはアプリを無理なく開発・維持するために必要な、<b>誠実な取り決め</b>です。<br><br>
法的な全文を確認したい方は、下のボタンから開けます。<br>
<span style="color:var(--color-muted);font-size:0.85em;">（読まなくても次へ進めます）</span>`,
    extra: `<button onclick="openTermsModal()"
      style="width:100%;background:var(--color-bg);border:1px solid var(--color-border-mid);
             border-radius:10px;padding:10px;font-size:0.85rem;color:var(--color-muted);
             cursor:pointer;margin-bottom:4px;">
      📄 利用規約の全文を読む（任意）
    </button>`,
    agree: null
  },
  {
    num: 10, icon: '🚚', title: '出発進行！',
    body: `お約束を確認していただきました。<br><br>
Biz-Naviはあなたの<b>軽貨物事業の相棒</b>として、毎日の業務を全力でサポートします。<br><br>
さあ、一緒に出発しましょう！✨`,
    agree: null,
    isFinal: true
  }
];

// ---- ウィザード起動 ----
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : ProWizard.init
 * │   【§4】10ステップ承認ウィザードを初回起動時に表示
 * └──────────────────────────────────────────────────────┘ */
ProWizard.init = function() {
  // 同意済みなら何もしない
  if (localStorage.getItem('bizNavi_agreed') === '1') return;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);
    z-index:99999;display:flex;align-items:flex-end;
    justify-content:center;
  `;

  overlay.innerHTML = `
    <div id="onboarding-sheet"
      style="background:var(--color-surface,#fff);width:100%;max-width:520px;
             border-radius:20px 20px 0 0;padding:0 0 40px;
             max-height:90vh;overflow-y:auto;">
      <!-- プログレスバー -->
      <div style="height:4px;background:var(--color-border,#e2e8f0);border-radius:20px 20px 0 0;">
        <div id="ob-progress"
          style="height:100%;background:var(--color-accent,#6366f1);
                 border-radius:20px 0 0 0;transition:width 0.35s;width:10%;"></div>
      </div>
      <!-- コンテンツ -->
      <div id="ob-content" style="padding:24px 22px 0;"></div>
    </div>`;

  document.body.appendChild(overlay);
  ProWizard._currentStep = 1;
  ProWizard._renderStep(1);
};
/* └ END : ProWizard.init ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : ProWizard._renderStep
 * │   【§4】10ステップウィザードの指定ステップを描画
 * └──────────────────────────────────────────────────────┘ */
ProWizard._renderStep = function(n) {
  const step = ProWizard.STEPS[n - 1];
  if (!step) return;

  const progress = Math.round((n / 10) * 100);
  const pb = document.getElementById('ob-progress');
  if (pb) pb.style.width = `${progress}%`;

  const needsAgree = !!step.agree;
  const isFinal    = !!step.isFinal;

  document.getElementById('ob-content').innerHTML = `
    <!-- ステップカウンター -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="font-size:0.72rem;font-weight:700;color:var(--color-accent,#6366f1);
                  letter-spacing:0.06em;">${n} / 10</div>
      ${n > 1 ? `
        <button onclick="ProWizard._renderStep(${n-1})"
          style="background:none;border:none;font-size:0.82rem;
                 color:var(--color-muted,#64748b);cursor:pointer;padding:4px 8px;">
          ← もどる
        </button>` : ''}
    </div>

    <!-- アイコン・タイトル -->
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:3rem;margin-bottom:8px;">${step.icon}</div>
      <div style="font-size:1.05rem;font-weight:700;
                  color:var(--color-text,#1e293b);">${step.title}</div>
    </div>

    <!-- 本文 -->
    <div style="font-size:0.9rem;color:var(--color-text,#1e293b);
                line-height:1.8;margin-bottom:20px;
                background:var(--color-bg,#f8fafc);border-radius:14px;
                padding:16px 18px;">
      ${step.body}
    </div>

    ${step.extra || ''}

    ${needsAgree ? `
    <!-- 同意チェックボックス -->
    <label style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer;
                  background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;">
      <input type="checkbox" id="ob-check"
        style="width:20px;height:20px;cursor:pointer;accent-color:var(--color-accent,#6366f1);">
      <span style="font-size:0.85rem;font-weight:600;color:#92400e;">${step.agree}</span>
    </label>
    ` : ''}

    <!-- ボタン -->
    ${isFinal ? `
    <button onclick="ProWizard._complete()"
      style="width:100%;background:var(--color-accent,#6366f1);color:#fff;border:none;
             border-radius:14px;padding:18px;font-size:1rem;font-weight:700;cursor:pointer;
             box-shadow:0 4px 16px rgba(99,102,241,0.4);">
      🚚 お約束を守ってBiz-Naviを始める
    </button>
    ` : `
    <button id="ob-next-btn"
      onclick="ProWizard._nextStep(${n})"
      style="width:100%;background:var(--color-accent,#6366f1);color:#fff;border:none;
             border-radius:14px;padding:16px;font-size:0.95rem;font-weight:700;cursor:pointer;">
      次へ →
    </button>
    `}
  `;

  // チェックボックスがある場合はボタンの活性をリアルタイム制御
  if (needsAgree) {
    const check = document.getElementById('ob-check');
    const btn   = document.getElementById('ob-next-btn');
    if (check && btn) {
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      check.addEventListener('change', () => {
        btn.style.opacity    = check.checked ? '1' : '0.4';
        btn.style.pointerEvents = check.checked ? 'auto' : 'none';
      });
    }
  }
};
/* └ END : ProWizard._renderStep ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : ProWizard._nextStep
 * │   【§4】次のステップへ進む（同意チェックがある場合はチェック済みを確認）
 * └──────────────────────────────────────────────────────┘ */
ProWizard._nextStep = function(current) {
  const step  = ProWizard.STEPS[current - 1];
  const check = document.getElementById('ob-check');
  if (step?.agree && check && !check.checked) return; // 念のため二重チェック
  ProWizard._renderStep(current + 1);
};
/* └ END : ProWizard._nextStep ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : ProWizard._complete
 * │   【§4】全ステップ完了時の処理（同意フラグを保存してopenSetupWizardへ）
 * └──────────────────────────────────────────────────────┘ */
ProWizard._complete = function() {
  localStorage.setItem('bizNavi_agreed', '1');
  const cfg = JSON.parse(localStorage.getItem('pro_config') || '{}');
  cfg.isLocked = true;
  localStorage.setItem('pro_config', JSON.stringify(cfg));
  document.getElementById('onboarding-overlay')?.remove();

  // §5 初期設定ウィザードを続けて起動
  if (typeof openSetupWizard === 'function') {
    setTimeout(() => openSetupWizard(), 300);
  } else {
    if (typeof navigate === 'function') navigate('dashboard');
    if (typeof updateDashboard === 'function') updateDashboard();
  }
};
/* └ END : ProWizard._complete ──────────────────────────────────────────────┘ */

// ============================================================
// §5 初期設定ウィザード（4ステップ）
// 10ステップ承認完了直後に起動
// ============================================================

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openSetupWizard
 * │   【§5】初期設定4ステップウィザードを開く（10ステップ完了直後に起動）
 * └──────────────────────────────────────────────────────┘ */
function openSetupWizard() {
  // すでに設定済みなら再表示しない
  if (localStorage.getItem('bizNavi_setup_done') === '1') {
    if (typeof navigate === 'function') navigate('dashboard');
    return;
  }

  const el = document.createElement('div');
  el.id = 'setup-wizard-overlay';
  el.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.65);
    z-index:99998;display:flex;align-items:flex-end;justify-content:center;
  `;

  el.innerHTML = `
    <div style="background:var(--color-surface,#fff);width:100%;max-width:520px;
                border-radius:20px 20px 0 0;max-height:92vh;overflow-y:auto;
                padding-bottom:40px;">
      <div id="sw-content"></div>
    </div>`;

  document.body.appendChild(el);
  _swRenderStep(1);
}
/* └ END : openSetupWizard ──────────────────────────────────────────────┘ */

// ---- ステップ描画ユーティリティ ----
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swHeader
 * │   【§5 共通】ウィザードヘッダー（ステップバー・番号・タイトル）HTMLを生成
 * └──────────────────────────────────────────────────────┘ */
function _swHeader(step, total, title, subtitle) {
  return `
    <div style="padding:20px 20px 0;border-bottom:1px solid var(--color-border,#e2e8f0);
                margin-bottom:20px;position:sticky;top:0;
                background:var(--color-surface,#fff);z-index:1;padding-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${[1,2,3,4].map(i => `
          <div style="flex:1;height:4px;border-radius:4px;
                      background:${i <= step ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                      transition:background 0.3s;"></div>
        `).join('')}
      </div>
      <div style="font-size:0.72rem;color:var(--color-accent,#6366f1);font-weight:700;
                  letter-spacing:0.06em;margin-bottom:2px;">STEP ${step} / ${total}</div>
      <div style="font-size:1rem;font-weight:700;color:var(--color-text,#1e293b);">${title}</div>
      ${subtitle ? `<div style="font-size:0.8rem;color:var(--color-muted,#64748b);margin-top:3px;">${subtitle}</div>` : ''}
    </div>`;
}
/* └ END : _swHeader ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swNextBtn
 * │   【§5 共通】「次へ」ボタンHTMLを生成
 * └──────────────────────────────────────────────────────┘ */
function _swNextBtn(onclick, label = '次へ →') {
  return `<button onclick="${onclick}"
    style="width:100%;background:var(--color-accent,#6366f1);color:#fff;border:none;
           border-radius:14px;padding:15px;font-size:0.95rem;font-weight:700;cursor:pointer;">
    ${label}
  </button>`;
}
/* └ END : _swNextBtn ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swBackBtn
 * │   【§5 共通】「もどる」ボタンHTMLを生成（STEP1では非表示）
 * └──────────────────────────────────────────────────────┘ */
function _swBackBtn(step) {
  return step > 1
    ? `<button onclick="_swRenderStep(${step-1})"
        style="width:100%;background:none;border:none;color:var(--color-muted,#64748b);
               font-size:0.85rem;cursor:pointer;padding:10px;">← もどる</button>`
    : '';
}
/* └ END : _swBackBtn ──────────────────────────────────────────────┘ */

// ---- STEP1：基本＆法律（地域・開業日） ----
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swRenderStep
 * │   【§5】指定ステップを描画（4ステップ分を内包）
 * └──────────────────────────────────────────────────────┘ */
function _swRenderStep(step) {
  const el = document.getElementById('sw-content');
  if (!el) return;
  const saved = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');

  if (step === 1) {
    el.innerHTML = `
      ${_swHeader(1, 4, '基本情報を教えてください', '地域と開業日で補助金や税務を自動判定します')}
      <div style="padding:0 20px;">

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:6px;">
            📍 活動地域（都道府県）
          </label>
          <select id="sw-region"
            style="width:100%;padding:12px;font-size:0.95rem;border-radius:10px;
                   border:1.5px solid var(--color-border-mid,#94a3b8);
                   background:var(--color-surface,#fff);color:var(--color-text,#1e293b);
                   box-sizing:border-box;">
            <option value="">選択してください</option>
            ${['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
               '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
               '新潟県','富山県','石川県','福井県','山梨県','長野県',
               '岐阜県','静岡県','愛知県','三重県',
               '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
               '鳥取県','島根県','岡山県','広島県','山口県',
               '徳島県','香川県','愛媛県','高知県',
               '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']
              .map(p => `<option value="${p}" ${saved.region === p ? 'selected' : ''}>${p}</option>`)
              .join('')}
          </select>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:6px;">
            📅 開業日（わかる範囲でOK）
          </label>
          <input type="date" id="sw-opening-date"
            value="${saved.openingDate || ''}"
            max="${new Date().toISOString().split('T')[0]}"
            style="width:100%;padding:12px;font-size:0.95rem;border-radius:10px;
                   border:1.5px solid var(--color-border-mid,#94a3b8);
                   background:var(--color-surface,#fff);color:var(--color-text,#1e293b);
                   box-sizing:border-box;">
          <div style="font-size:0.75rem;color:var(--color-muted,#64748b);margin-top:5px;">
            ※ 免税期間の自動判定に使います。不明な場合は空欄でもOK。
          </div>
        </div>

        ${_swNextBtn('_swSaveStep1()')}
        ${_swBackBtn(1)}
      </div>`;

  } else if (step === 2) {
    el.innerHTML = `
      ${_swHeader(2, 4, '仕事と売上について', '自動計算・分類の精度を上げます')}
      <div style="padding:0 20px;">

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:8px;">
            🚐 メインの配送サービス
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${[
              { id:'amazonflex', label:'Amazon Flex', icon:'📦' },
              { id:'pickgo',     label:'PickGo',      icon:'🚗' },
              { id:'hacomono',   label:'ハコモノ',    icon:'📫' },
              { id:'other',      label:'その他委託',  icon:'📋' },
            ].map(s => `
              <button onclick="_swToggleDelivery('${s.id}', this)"
                id="sw-del-${s.id}"
                style="background:${saved.deliveryTypes?.includes(s.id) ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)'};
                       color:${saved.deliveryTypes?.includes(s.id) ? '#fff' : 'var(--color-text,#1e293b)'};
                       border:1.5px solid ${saved.deliveryTypes?.includes(s.id) ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                       border-radius:12px;padding:12px 8px;cursor:pointer;
                       display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:600;">
                <span>${s.icon}</span><span>${s.label}</span>
              </button>`).join('')}
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:6px;">
            💴 荷物1個あたりの単価（円）
          </label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);
                         color:var(--color-muted,#64748b);">¥</span>
            <input type="number" id="sw-unit-price" min="0" inputmode="numeric"
              value="${saved.deliveryUnitPrice || ''}"
              placeholder="例：200"
              style="width:100%;padding:12px 12px 12px 28px;font-size:1rem;font-weight:700;
                     border-radius:10px;border:1.5px solid var(--color-border-mid,#94a3b8);
                     background:var(--color-surface,#fff);box-sizing:border-box;">
          </div>
          <div style="font-size:0.75rem;color:var(--color-muted,#64748b);margin-top:5px;">
            日報で個数を入力すると売上・時給が自動計算されます
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:8px;">
            📱 スマホの回線は？
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button onclick="_swSelectPhone('dedicated', this)"
              id="sw-phone-dedicated"
              style="background:${saved.phoneType==='dedicated' ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)'};
                     color:${saved.phoneType==='dedicated' ? '#fff' : 'var(--color-text,#1e293b)'};
                     border:1.5px solid ${saved.phoneType==='dedicated' ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                     border-radius:12px;padding:14px 8px;cursor:pointer;
                     font-size:0.85rem;font-weight:600;">
              📡 仕事専用回線<br>
              <span style="font-size:0.72rem;opacity:0.8;">全額経費にできます</span>
            </button>
            <button onclick="_swSelectPhone('shared', this)"
              id="sw-phone-shared"
              style="background:${saved.phoneType==='shared' ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)'};
                     color:${saved.phoneType==='shared' ? '#fff' : 'var(--color-text,#1e293b)'};
                     border:1.5px solid ${saved.phoneType==='shared' ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                     border-radius:12px;padding:14px 8px;cursor:pointer;
                     font-size:0.85rem;font-weight:600;">
              📱 プライベート兼用<br>
              <span style="font-size:0.72rem;opacity:0.8;">仕事割合で按分します</span>
            </button>
          </div>
          <div id="sw-phone-note" style="font-size:0.78rem;margin-top:8px;padding:8px 10px;
               border-radius:8px;display:${saved.phoneType ? 'block' : 'none'};
               background:${saved.phoneType==='dedicated' ? '#f0fdf4' : '#f0f9ff'};
               color:${saved.phoneType==='dedicated' ? '#15803d' : '#0369a1'};">
            ${saved.phoneType==='dedicated'
              ? '🐱 専用回線は全額「通信費」として経費計上できます！'
              : '🐱 兼用の場合は仕事で使った割合で按分して計上するドライバーが多いようです。'}
          </div>
        </div>

        ${_swNextBtn('_swSaveStep2()')}
        ${_swBackBtn(2)}
      </div>`;

  } else if (step === 3) {
    el.innerHTML = `
      ${_swHeader(3, 4, '税金と表示モード', '経験に合わせて最適な画面にします')}
      <div style="padding:0 20px;">

        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:10px;">
            📋 確定申告の経験は？
          </label>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button onclick="_swSelectTax('beginner', this)"
              id="sw-tax-beginner"
              style="background:${saved.taxExp==='beginner' ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)'};
                     color:${saved.taxExp==='beginner' ? '#fff' : 'var(--color-text,#1e293b)'};
                     border:1.5px solid ${saved.taxExp==='beginner' ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                     border-radius:12px;padding:14px 16px;cursor:pointer;text-align:left;">
              <div style="font-weight:700;font-size:0.9rem;">😅 初めてで不安…</div>
              <div style="font-size:0.78rem;margin-top:3px;opacity:0.85;">
                シンプルモードで起動。難しい画面は全て隠します。
              </div>
            </button>
            <button onclick="_swSelectTax('experienced', this)"
              id="sw-tax-experienced"
              style="background:${saved.taxExp==='experienced' ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)'};
                     color:${saved.taxExp==='experienced' ? '#fff' : 'var(--color-text,#1e293b)'};
                     border:1.5px solid ${saved.taxExp==='experienced' ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)'};
                     border-radius:12px;padding:14px 16px;cursor:pointer;text-align:left;">
              <div style="font-weight:700;font-size:0.9rem;">👍 経験あり・全部使いたい</div>
              <div style="font-size:0.78rem;margin-top:3px;opacity:0.85;">
                元帳・消費税・電帳法など全機能を表示します。
              </div>
            </button>
          </div>
        </div>

        ${_swNextBtn('_swSaveStep3()')}
        ${_swBackBtn(3)}
      </div>`;

  } else if (step === 4) {
    el.innerHTML = `
      ${_swHeader(4, 4, '愛車の期限を登録', '車検・保険の期限切れを事前にお知らせします')}
      <div style="padding:0 20px;">

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;
                    padding:12px 14px;margin-bottom:16px;font-size:0.82rem;color:#15803d;">
          🔔 30日前からダッシュボードにアラートを自動表示します
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:6px;">
            🔧 次回車検の期限
          </label>
          <input type="date" id="sw-inspection-date"
            value="${saved.inspectionDate || ''}"
            style="width:100%;padding:12px;font-size:0.95rem;border-radius:10px;
                   border:1.5px solid var(--color-border-mid,#94a3b8);
                   background:var(--color-surface,#fff);box-sizing:border-box;">
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:0.78rem;font-weight:700;
                        color:var(--color-muted,#64748b);margin-bottom:6px;">
            🛡️ 任意保険の更新日
          </label>
          <input type="date" id="sw-insurance-date"
            value="${saved.insuranceDate || ''}"
            style="width:100%;padding:12px;font-size:0.95rem;border-radius:10px;
                   border:1.5px solid var(--color-border-mid,#94a3b8);
                   background:var(--color-surface,#fff);box-sizing:border-box;">
          <div style="font-size:0.75rem;color:var(--color-muted,#64748b);margin-top:5px;">
            ※ 不明な場合は空欄でも大丈夫です。後から設定画面で変更できます。
          </div>
        </div>

        ${_swNextBtn('_swComplete()', '🚀 設定完了！Biz-Naviを始める')}
        ${_swBackBtn(4)}
      </div>`;
  }
}
/* └ END : _swRenderStep ──────────────────────────────────────────────┘ */

// ---- 選択ヘルパー ----
window._swSelectedDelivery = [];

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swToggleDelivery
 * │   【§5 STEP2】配送種別ボタンのON/OFF状態を切り替える
 * └──────────────────────────────────────────────────────┘ */
function _swToggleDelivery(id, btn) {
  const saved = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');
  const types = saved.deliveryTypes || [];
  const idx = types.indexOf(id);
  if (idx >= 0) {
    types.splice(idx, 1);
    btn.style.background = 'var(--color-bg,#f8fafc)';
    btn.style.color = 'var(--color-text,#1e293b)';
    btn.style.borderColor = 'var(--color-border,#e2e8f0)';
  } else {
    types.push(id);
    btn.style.background = 'var(--color-accent,#6366f1)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--color-accent,#6366f1)';
  }
  saved.deliveryTypes = types;
  localStorage.setItem('bizNavi_setup_tmp', JSON.stringify(saved));
}
/* └ END : _swToggleDelivery ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swSelectPhone
 * │   【§5 STEP2】スマホ回線タイプを選択してお節介メッセージを表示
 * └──────────────────────────────────────────────────────┘ */
function _swSelectPhone(type, btn) {
  const saved = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');
  saved.phoneType = type;
  localStorage.setItem('bizNavi_setup_tmp', JSON.stringify(saved));

  ['dedicated','shared'].forEach(t => {
    const b = document.getElementById(`sw-phone-${t}`);
    if (!b) return;
    const active = t === type;
    b.style.background   = active ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)';
    b.style.color        = active ? '#fff' : 'var(--color-text,#1e293b)';
    b.style.borderColor  = active ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)';
  });
  const note = document.getElementById('sw-phone-note');
  if (note) {
    note.style.display  = 'block';
    note.style.background = type === 'dedicated' ? '#f0fdf4' : '#f0f9ff';
    note.style.color      = type === 'dedicated' ? '#15803d' : '#0369a1';
    note.textContent = type === 'dedicated'
      ? '🐱 専用回線は全額「通信費」として経費計上できます！'
      : '🐱 兼用の場合は仕事で使った割合で按分して計上するドライバーが多いようです。';
  }
}
/* └ END : _swSelectPhone ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swSelectTax
 * │   【§5 STEP3】確定申告経験を選択する
 * └──────────────────────────────────────────────────────┘ */
function _swSelectTax(type, btn) {
  const saved = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');
  saved.taxExp = type;
  localStorage.setItem('bizNavi_setup_tmp', JSON.stringify(saved));

  ['beginner','experienced'].forEach(t => {
    const b = document.getElementById(`sw-tax-${t}`);
    if (!b) return;
    const active = t === type;
    b.style.background  = active ? 'var(--color-accent,#6366f1)' : 'var(--color-bg,#f8fafc)';
    b.style.color       = active ? '#fff' : 'var(--color-text,#1e293b)';
    b.style.borderColor = active ? 'var(--color-accent,#6366f1)' : 'var(--color-border,#e2e8f0)';
  });
}
/* └ END : _swSelectTax ──────────────────────────────────────────────┘ */

// ---- ステップ保存 ----
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swSaveStep1
 * │   【§5】STEP1（地域・開業日）を一時保存してSTEP2へ
 * └──────────────────────────────────────────────────────┘ */
function _swSaveStep1() {
  const region      = document.getElementById('sw-region')?.value || '';
  const openingDate = document.getElementById('sw-opening-date')?.value || '';
  const saved = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');
  saved.region = region;
  saved.openingDate = openingDate;
  localStorage.setItem('bizNavi_setup_tmp', JSON.stringify(saved));
  _swRenderStep(2);
}
/* └ END : _swSaveStep1 ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swSaveStep2
 * │   【§5】STEP2（配送種別・単価・通信費）を一時保存してSTEP3へ
 * └──────────────────────────────────────────────────────┘ */
function _swSaveStep2() {
  const unitPrice = parseInt(document.getElementById('sw-unit-price')?.value) || 0;
  const saved = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');
  saved.deliveryUnitPrice = unitPrice;
  localStorage.setItem('bizNavi_setup_tmp', JSON.stringify(saved));
  _swRenderStep(3);
}
/* └ END : _swSaveStep2 ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swSaveStep3
 * │   【§5】STEP3（申告経験）を確認してSTEP4へ
 * └──────────────────────────────────────────────────────┘ */
function _swSaveStep3() {
  // taxExpはボタン選択でリアルタイム保存済み
  _swRenderStep(4);
}
/* └ END : _swSaveStep3 ──────────────────────────────────────────────┘ */

// ---- 完了処理 ----
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _swComplete
 * │   【§5】全設定をbizNaviSettingsに統合保存してダッシュボードへ
 * └──────────────────────────────────────────────────────┘ */
function _swComplete() {
  const tmp = JSON.parse(localStorage.getItem('bizNavi_setup_tmp') || '{}');
  const inspectionDate = document.getElementById('sw-inspection-date')?.value || '';
  const insuranceDate  = document.getElementById('sw-insurance-date')?.value  || '';

  // bizNaviSettings に統合保存
  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  settings.region             = tmp.region || '';
  settings.openingDate        = tmp.openingDate || '';
  settings.deliveryTypes      = tmp.deliveryTypes || [];
  settings.deliveryUnitPrice  = tmp.deliveryUnitPrice || 0;
  settings.phoneType          = tmp.phoneType || 'shared';
  settings.taxExp             = tmp.taxExp || 'beginner';
  localStorage.setItem('bizNaviSettings', JSON.stringify(settings));

  // 初めて選択 → シンプルモードをONにする
  if (tmp.taxExp === 'beginner') {
    localStorage.setItem('bizNavi_simpleMode', '1');
  }

  // 車検・保険を vehicleReminders に追加
  const reminders = JSON.parse(localStorage.getItem('bizNavi_vehicleReminders') || '[]');
  if (inspectionDate) {
    reminders.push({ type: 'inspection', label: '車検', date: inspectionDate });
  }
  if (insuranceDate) {
    reminders.push({ type: 'insurance', label: '任意保険', date: insuranceDate });
  }
  if (inspectionDate || insuranceDate) {
    localStorage.setItem('bizNavi_vehicleReminders', JSON.stringify(reminders));
  }

  // 設定完了フラグ
  localStorage.setItem('bizNavi_setup_done', '1');
  localStorage.removeItem('bizNavi_setup_tmp'); // 一時データを削除

  // ウィザードを閉じる
  document.getElementById('setup-wizard-overlay')?.remove();

  // ダッシュボードへ
  if (typeof applySimpleMode === 'function') applySimpleMode();
  if (typeof navigate === 'function') navigate('dashboard');
  if (typeof updateDashboard === 'function') setTimeout(updateDashboard, 300);
  if (typeof renderVehicleAlerts === 'function') renderVehicleAlerts();
  if (typeof showToast === 'function') showToast('設定が完了しました！いってらっしゃい 🚐', 'success');
}
/* └ END : _swComplete ──────────────────────────────────────────────┘ */

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
        if (typeof initIcons === 'function') {
            initIcons(); // 即時実行
            requestAnimationFrame(() => initIcons()); // DOM確定後に再実行
            setTimeout(() => { if (typeof initIcons === 'function') initIcons(); }, 150); // 150ms後に再保険
        }
        if (typeof initAccountSelects === 'function') initAccountSelects();
        if (typeof initJournalMonth === 'function') initJournalMonth();
        if (typeof initReportYear === 'function') initReportYear();
        if (typeof initChartYearSelect === 'function') initChartYearSelect();
        if (typeof initGlobalPeriod === 'function') initGlobalPeriod();
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

        // ===== 業務中バナーの経過時間を1分ごとに自動更新 =====
        if (window._bizNaviBannerTimer) clearInterval(window._bizNaviBannerTimer);
        window._bizNaviBannerTimer = setInterval(() => {
          // 業務中のときだけ更新（完了・未開始はスキップ）
          const todayLog = typeof getTodayLog === 'function' ? getTodayLog() : null;
          if (!todayLog || todayLog.status !== 'started') return;

          if (typeof renderTodayActionBanner === 'function') renderTodayActionBanner();

          // 日報ページが表示中なら日報バナーも更新
          const dailyPage = document.getElementById('page-daily');
          if (dailyPage?.classList.contains('active')) {
            if (typeof renderDailyPage === 'function') renderDailyPage();
          }
        }, 60000); // 60秒ごと
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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : loadClientMaster
 * │   取引先マスターをJSONから読み込む
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : loadClientMaster ──────────────────────────────────────────────┘ */

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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveCategoryKeywords
 * │   科目キーワード設定をlocalStorageに保存
 * └──────────────────────────────────────────────────────┘ */
function saveCategoryKeywords() {
  localStorage.setItem('categoryKeywords', JSON.stringify(categoryKeywords));
}
/* └ END : saveCategoryKeywords ──────────────────────────────────────────────┘ */
// ===== [2026-05-15 03:50 追加] 自動仕訳辞書マスタ終わり =====


/**
 * 2. 設定画面に取引先リストを表示する（グリッドカード形式）
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderClientList
 * │   設定ページの取引先マスター一覧を描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderClientList ──────────────────────────────────────────────┘ */
// ===== [2026-05-14 22:40 刷新] 終わり =====

/**
 * 3. 新しい取引先を一時保存（メモリ上）
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : addClientMaster
 * │   取引先マスターに新しい取引先を追加
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : addClientMaster ──────────────────────────────────────────────┘ */

/**
 * 4. 取引先を削除
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : deleteClientMaster
 * │   取引先マスターから指定の取引先を削除
 * └──────────────────────────────────────────────────────┘ */
function deleteClientMaster(name) {
    if (confirm(`取引先「${name}」をマスタから削除しますか？`)) {
        delete clientMaster[name];
        renderClientList();
    }
}
/* └ END : deleteClientMaster ──────────────────────────────────────────────┘ */

/**
 * 5. サーバーへ保存（擬似保存：localStorage版）
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveClientsJson
 * │   取引先マスターをJSONファイルとして保存
 * └──────────────────────────────────────────────────────┘ */
async function saveClientsJson() {
    // ブラウザに記憶させる（リロード対策）
    localStorage.setItem('kaikei_client_master', JSON.stringify(clientMaster));
    
    console.log("💾 擬似保存完了:", clientMaster);
    alert("✅ 取引先設定をブラウザに保存しました！\n次回のCSV分類からこの内容が反映されます。");
}
/* └ END : saveClientsJson ──────────────────────────────────────────────┘ */


/**
 * 6. 摘要から取引先を特定する（マスタ連動エンジン）
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : identifyClientByMaster
 * │   テキストから取引先マスターを使って勘定科目を推定
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : identifyClientByMaster ──────────────────────────────────────────────┘ */

/**
 * 自動仕訳辞書の管理画面を表示
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderCategorySettings
 * │   設定ページの科目キーワード設定UIを描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderCategorySettings ──────────────────────────────────────────────┘ */

// キーワード追加プロンプト
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : addKeywordPrompt
 * │   科目にキーワードを追加するプロンプトを表示
 * └──────────────────────────────────────────────────────┘ */
function addKeywordPrompt(account) {
  const kw = prompt(`${account} に追加するキーワードを入力してください`);
  if (kw && !categoryKeywords[account].includes(kw)) {
    categoryKeywords[account].push(kw);
    saveCategoryKeywords();
    renderCategorySettings();
    showToast("辞書を更新しました");
  }
}
/* └ END : addKeywordPrompt ──────────────────────────────────────────────┘ */

// キーワード削除
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : removeKeyword
 * │   科目からキーワードを削除
 * └──────────────────────────────────────────────────────┘ */
function removeKeyword(account, kw) {
  categoryKeywords[account] = categoryKeywords[account].filter(item => item !== kw);
  saveCategoryKeywords();
  renderCategorySettings();
}
/* └ END : removeKeyword ──────────────────────────────────────────────┘ */

// ===== [2026-05-15 07:45 修正] 矛盾検知・逆提案型学習エンジン（既存機能完全継承） =====

/**
 * ユーザーの科目修正を学習し、辞書への追加を提案する
 * 鉄板ルールとの矛盾がある場合、軍師が逆提案を行う
 * @param {string} text - インポート時の内容（店名など）
 * @param {string} newAccount - ユーザーが選択した正しい科目
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : suggestLearning
 * │   取引内容から学習提案を行う（スマートルール候補を提示）
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : suggestLearning ──────────────────────────────────────────────┘ */

/**
 * リアルタイム・ナビゲーション・エンジン
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateAdvisorWhisper
 * │   節税・補助金などのアドバイスをダッシュボードに表示
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateAdvisorWhisper ──────────────────────────────────────────────┘ */

/**
 * 🧭 スマートルールの描画（レンダリング）
 * パステル調のデザインとサイズ統一を適用
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderSmartRules
 * │   設定ページのスマートルール一覧を描画
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : renderSmartRules ──────────────────────────────────────────────┘ */
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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : addNewSmartRule
 * │   スマートルールに新しいルールを追加
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : addNewSmartRule ──────────────────────────────────────────────┘ */

/**
 * 🗑️ ルールの削除（自動保存対応）
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : deleteSmartRule
 * │   スマートルールから指定ルールを削除
 * └──────────────────────────────────────────────────────┘ */
function deleteSmartRule(index) {
    if (confirm("このルールを削除してもよろしいですか？")) {
        userCustomRules.splice(index, 1);
        renderSmartRules();
        // 削除後も即座に保存
        persistRulesSilently();
    }
}
/* └ END : deleteSmartRule ──────────────────────────────────────────────┘ */

/**
 * 💾 データのサイレント保存
 * ユーザーの邪魔をせず、バックグラウンドでローカルストレージへ保存する
 */
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : persistRulesSilently
 * │   スマートルールをlocalStorageにサイレント保存
 * └──────────────────────────────────────────────────────┘ */
function persistRulesSilently() {
    localStorage.setItem('bizNaviCustomRules', JSON.stringify(userCustomRules));
    console.log("Biz-Navi: 羅針盤に自動保存されました。");
}
/* └ END : persistRulesSilently ──────────────────────────────────────────────┘ */

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

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveDailyLogsToStorage
 * │   日報ログをlocalStorageに保存
 * └──────────────────────────────────────────────────────┘ */
function saveDailyLogsToStorage() {
  localStorage.setItem('bizNavi_dailyLogs', JSON.stringify(dailyLogs));
}
/* └ END : saveDailyLogsToStorage ──────────────────────────────────────────────┘ */

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
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getTodayLog
 * │   今日の日報ログを返す（存在しない場合はnull）
 * └──────────────────────────────────────────────────────┘ */
function getTodayLog() {
  const today = new Date().toISOString().split('T')[0];
  return dailyLogs.find(l => l.date === today) || null;
}
/* └ END : getTodayLog ──────────────────────────────────────────────┘ */

// ===== アプリ起動時チェック：当日の日報が未入力なら業務開始を促す =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : checkAndShowMorningPrompt
 * │   起動時に当日の日報が未入力なら業務開始を促す
 * └──────────────────────────────────────────────────────┘ */
function checkAndShowMorningPrompt() {
  const today = new Date().toISOString().split('T')[0];
  const lastPromptDate = localStorage.getItem('bizNavi_lastMorningPrompt');
  if (lastPromptDate === today) return; // 今日すでに表示済み

  const todayLog = getTodayLog();
  if (todayLog) return; // 今日の日報が既にある

  // 朝の業務開始モーダルを表示
  setTimeout(() => openDailyStartModal(), 800);
}
/* └ END : checkAndShowMorningPrompt ──────────────────────────────────────────────┘ */

// ===== 業務開始モーダルを開く =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openDailyStartModal
 * │   業務開始モーダルを開く（前回の終了ODOを自動プリセット）
 * └──────────────────────────────────────────────────────┘ */
function openDailyStartModal() {
  const today = new Date().toISOString().split('T')[0];
  const [y, m, d] = today.split('-');
  const dateStr = `${y}年${parseInt(m)}月${parseInt(d)}日`;

  const existing = document.getElementById('daily-start-modal');
  if (existing) existing.remove();

  // 前回の終了ODOを取得（最新の完了ログから）
  const lastLog = [...dailyLogs]
    .filter(l => l.status === 'completed' && l.endOdo != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const lastOdo = lastLog ? lastLog.endOdo : null;
  const lastDate = lastLog ? lastLog.date : null;
  const lastDateStr = lastDate
    ? (() => { const [ly,lm,ld] = lastDate.split('-'); return `${ly}年${parseInt(lm)}月${parseInt(ld)}日`; })()
    : null;

  const modal = document.createElement('div');
  modal.id = 'daily-start-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--color-surface,#fff);width:100%;max-width:520px;
                border-radius:20px 20px 0 0;padding:24px 20px 36px;
                box-shadow:0 -4px 24px rgba(0,0,0,0.15);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:2.2rem;margin-bottom:6px;">🚐</div>
        <div style="font-size:1.05rem;font-weight:700;color:var(--color-accent);">${dateStr}　業務開始</div>
      </div>

      ${lastOdo != null ? `
      <!-- 前回ODO表示 + 変化なしボタン -->
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;
                  padding:14px 16px;margin-bottom:14px;">
        <div style="font-size:0.75rem;color:#0369a1;font-weight:700;margin-bottom:6px;">
          📋 前回終了時（${lastDateStr}）のオドメーター
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="font-size:1.6rem;font-weight:800;color:#0369a1;letter-spacing:0.03em;">
            ${lastOdo.toFixed(2)} km
          </div>
          <button onclick="startWithOdo(${lastOdo})"
            style="background:#0369a1;color:#fff;border:none;border-radius:12px;
                   padding:10px 18px;font-size:0.9rem;font-weight:700;cursor:pointer;
                   white-space:nowrap;min-height:44px;">
            変化なし → 開始
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="flex:1;height:1px;background:var(--color-border);"></div>
        <div style="font-size:0.75rem;color:var(--color-muted);white-space:nowrap;">
          増えていた場合は下に入力
        </div>
        <div style="flex:1;height:1px;background:var(--color-border);"></div>
      </div>` : `
      <div style="font-size:0.82rem;color:var(--color-muted);text-align:center;margin-bottom:12px;">
        現在のオドメーターを入力してください
      </div>`}

      <!-- ODO入力欄 -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:0.78rem;font-weight:700;
                       color:var(--color-muted);margin-bottom:6px;letter-spacing:0.04em;">
          開始時オドメーター（km）
        </label>
        <input type="number" id="start-odo-input" step="0.01" min="0"
          placeholder="${lastOdo != null ? `${lastOdo.toFixed(2)} より大きい値` : '例: 12345.67'}"
          inputmode="decimal"
          style="width:100%;padding:14px;font-size:1.3rem;font-weight:700;
                 border:2px solid var(--color-border-mid);border-radius:12px;
                 text-align:center;box-sizing:border-box;
                 background:var(--color-surface);color:var(--color-text);
                 -webkit-appearance:none;">
        <div style="font-size:0.72rem;color:var(--color-muted);text-align:center;margin-top:5px;">
          小数点第2位まで入力できます
        </div>
      </div>

      <button onclick="saveDailyStart()"
        style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;
               padding:16px;font-size:1.05rem;font-weight:700;cursor:pointer;margin-bottom:10px;">
        🚀 業務開始！
      </button>
      <button onclick="document.getElementById('daily-start-modal').remove()"
        style="width:100%;background:var(--color-bg);color:var(--color-muted);
               border:none;border-radius:14px;padding:12px;font-size:0.9rem;cursor:pointer;">
        あとで入力する
      </button>
    </div>`;

  document.body.appendChild(modal);
  localStorage.setItem('bizNavi_lastMorningPrompt', today);

  // 前回ODOがない場合のみ自動フォーカス
  if (lastOdo == null) {
    setTimeout(() => {
      const inp = document.getElementById('start-odo-input');
      if (inp) inp.focus();
    }, 300);
  }
}
/* └ END : openDailyStartModal ──────────────────────────────────────────────┘ */

// 「変化なし → 開始」ボタン用：ODOをそのまま使って業務開始
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : startWithOdo
 * │   「変化なし→開始」ボタン用：指定ODOでそのまま業務開始
 * └──────────────────────────────────────────────────────┘ */
function startWithOdo(odo) {
  _commitDailyStart(odo);
}
/* └ END : startWithOdo ──────────────────────────────────────────────┘ */

// ===== 業務開始を保存 → 安全運転メッセージ =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveDailyStart
 * │   業務開始モーダルの入力値を検証して_commitDailyStart()を呼ぶ
 * └──────────────────────────────────────────────────────┘ */
function saveDailyStart() {
  const val = parseFloat(document.getElementById('start-odo-input').value);
  if (isNaN(val) || val < 0) {
    if (typeof showToast === 'function') showToast('オドメーターの値を正しく入力してください', 'warn');
    return;
  }
  _commitDailyStart(val);
}
/* └ END : saveDailyStart ──────────────────────────────────────────────┘ */

// 共通の開始コミット処理
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : _commitDailyStart
 * │   業務開始データを保存してバナーを即再描画する共通処理
 * └──────────────────────────────────────────────────────┘ */
function _commitDailyStart(odoVal) {
  const today = new Date().toISOString().split('T')[0];
  const existing = dailyLogs.findIndex(l => l.date === today);
  const logEntry = {
    id: existing >= 0 ? dailyLogs[existing].id : `dl_${Date.now()}`,
    date: today,
    startOdo: Math.round(odoVal * 100) / 100,
    endOdo: null,
    distance: null,
    deliveries: null,
    unitPrice: null,
    startTime: new Date().toISOString(),
    endTime: null,
    memo: '',
    status: 'started'
  };

  if (existing >= 0) {
    dailyLogs[existing] = logEntry;
  } else {
    dailyLogs.push(logEntry);
  }
  saveDailyLogsToStorage();

  const modal = document.getElementById('daily-start-modal');
  if (modal) modal.remove();

  // 開始直後に全バナーを即座に更新（0分経過を正しく表示）
  if (typeof renderTodayActionBanner === 'function') renderTodayActionBanner();
  if (typeof renderDailyPage === 'function') {
    const dailyPage = document.getElementById('page-daily');
    if (dailyPage?.classList.contains('active')) renderDailyPage();
  }

  showSafeDriveMessage();
}
/* └ END : _commitDailyStart ──────────────────────────────────────────────┘ */

// ===== 安全運転メッセージ表示 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showSafeDriveMessage
 * │   業務開始後に安全運転メッセージをランダム表示
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : showSafeDriveMessage ──────────────────────────────────────────────┘ */

// ===== 日報ボタン押下時：業務開始か終了かを判定 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : handleDailyButtonPress
 * │   日報FAB・＋記録ボタンから状態に応じて開始/終了フローを振り分ける
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : handleDailyButtonPress ──────────────────────────────────────────────┘ */

// ===== 業務終了確認ダイアログ =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showDailyEndConfirm
 * │   業務終了モーダルを開く（走行距離・売上・時給をリアルタイムプレビュー）
 * └──────────────────────────────────────────────────────┘ */
function showDailyEndConfirm(todayLog) {
  const existing = document.getElementById('daily-end-confirm-modal');
  if (existing) existing.remove();

  const startOdo = todayLog.startOdo;
  const startTime = todayLog.startTime ? new Date(todayLog.startTime) : null;
  const now = new Date();
  const elapsedMin = startTime ? Math.floor((now - startTime) / 60000) : null;
  const elapsedStr = elapsedMin !== null
    ? (elapsedMin >= 60 ? `${Math.floor(elapsedMin/60)}時間${elapsedMin%60}分` : `${elapsedMin}分`)
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
/* └ END : showDailyEndConfirm ──────────────────────────────────────────────┘ */

// ===== 業務終了プレビューのリアルタイム更新 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : updateEndPreview
 * │   業務終了モーダルでODO・配達数入力中にリアルタイム計算して表示
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : updateEndPreview ──────────────────────────────────────────────┘ */

// ===== 業務終了を保存（モーダルから呼び出し） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveDailyEndFromModal
 * │   業務終了モーダルの保存ボタン処理。入力値を検証してsaveDailyEnd()へ
 * └──────────────────────────────────────────────────────┘ */
function saveDailyEndFromModal() {
  const btn = document.getElementById('daily-end-save-btn');
  const logId = btn?.dataset?.logId;
  const elapsedMin = parseInt(btn?.dataset?.elapsed) || 0;
  const todayLog = dailyLogs.find(l => l.id === logId) || getTodayLog();
  if (!todayLog) { alert('日報データが見つかりません'); return; }
  saveDailyEnd(todayLog, elapsedMin);
}
/* └ END : saveDailyEndFromModal ──────────────────────────────────────────────┘ */

// ===== 業務終了を保存 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveDailyEnd
 * │   業務終了データを保存してバナー・ダッシュボードを即再描画
 * └──────────────────────────────────────────────────────┘ */
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

  // 終了直後にバナー・ダッシュボードを即再描画
  if (typeof renderTodayActionBanner === 'function') renderTodayActionBanner();
  if (typeof updateDashboard === 'function') updateDashboard();

  // 結果サマリーを表示
  showDailyEndSummary(updatedLog);
  renderDailyPage();
  renderCalendar();
}
/* └ END : saveDailyEnd ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] 当日の未入力・未確認取引を取得 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : getTodayUnprocessedEntries
 * │   今日付の未確認取引リストを返す
 * └──────────────────────────────────────────────────────┘ */
function getTodayUnprocessedEntries() {
  const today = new Date().toISOString().split('T')[0];
  return (typeof entries !== 'undefined' ? entries : []).filter(e => {
    if (!e || !e.date) return false;
    const d = String(e.date).replace(/\//g, '-').split('T')[0];
    return d === today && e.manually_saved !== true;
  });
}
/* └ END : getTodayUnprocessedEntries ──────────────────────────────────────────────┘ */

// ===== [2026-05-24 追加] 領収書確認プロンプト（帰宅時・日報入力時） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showReceiptCheckPrompt
 * │   業務終了後の領収書確認プロンプトを表示（未仕訳件数を軸に3パターン）
 * └──────────────────────────────────────────────────────┘ */
function showReceiptCheckPrompt(context = 'end') {
  const unprocessed = getTodayUnprocessedEntries();
  const count = unprocessed.length;

  const todayAll = (typeof entries !== 'undefined' ? entries : [])
    .filter(e => e?.date &&
      String(e.date).replace(/\//g, '-').split('T')[0] ===
      new Date().toISOString().split('T')[0]);
  const confirmedCount = todayAll.length - count;

  const overlay = document.createElement('div');
  overlay.id = 'receipt-check-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10002;display:flex;align-items:flex-end;justify-content:center;';

  let headerIcon, headerTitle, headerSub, previewHtml, actionHtml;

  if (count > 0) {
    headerIcon = '📋';
    headerTitle = `未確認の経費が <span style="color:#6366f1;font-size:1.1em;">${count}件</span> あります`;
    headerSub = confirmedCount > 0
      ? `確認済み ${confirmedCount}件 ／ 未確認 ${count}件`
      : '業務中に取り込まれた経費を確認してください';

    previewHtml = `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:10px 12px;margin-bottom:12px;">
        ${unprocessed.slice(0, 3).map(e => `
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.83rem;color:#0369a1;border-bottom:1px solid #e0f2fe;">
            <span>💸</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.content || e.debitAcc || '取引'}</span>
            <span style="font-weight:700;flex-shrink:0;">¥${Number(String(e.amount||e.debitAmt||0).replace(/,/g,'')).toLocaleString()}</span>
          </div>`).join('')}
        ${count > 3 ? `<div style="font-size:0.75rem;color:#64748b;margin-top:6px;text-align:right;">他 ${count-3}件...</div>` : ''}
      </div>
      <div style="font-size:0.8rem;color:#64748b;margin-bottom:12px;padding:0 2px;">
        他に本日発生した経費（領収書・レシート）はありますか？
      </div>`;

    actionHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <button onclick="document.getElementById('receipt-check-modal').remove(); document.getElementById('csv-file').click();"
          style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:10px;
                 padding:10px 4px;font-size:0.75rem;font-weight:700;cursor:pointer;min-height:52px;line-height:1.4;">
          📷<br>CSV取込
        </button>
        <button onclick="document.getElementById('receipt-check-modal').remove(); openNewEntryModal();"
          style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:10px;
                 padding:10px 4px;font-size:0.75rem;font-weight:700;cursor:pointer;min-height:52px;line-height:1.4;">
          ＋<br>手動入力
        </button>
        <button onclick="document.getElementById('receipt-check-modal').remove(); navigate('journal');"
          style="background:#6366f1;color:#fff;border:none;border-radius:10px;
                 padding:10px 4px;font-size:0.75rem;font-weight:700;cursor:pointer;min-height:52px;line-height:1.4;">
          ✓ ${count}件を<br>確認する
        </button>
      </div>
      <button onclick="document.getElementById('receipt-check-modal').remove();"
        style="width:100%;background:var(--color-bg,#f8fafc);color:var(--color-muted,#64748b);
               border:none;border-radius:10px;padding:10px;font-size:0.85rem;font-weight:600;cursor:pointer;">
        他の経費はなかった・あとで対応する
      </button>`;

  } else if (todayAll.length === 0) {
    headerIcon = '🧾';
    headerTitle = '今日の経費はありませんでしたか？';
    headerSub = '燃料費・駐車場代・高速代・ETC など\n記録し忘れがないか確認しましょう';
    previewHtml = '';
    actionHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <button onclick="document.getElementById('receipt-check-modal').remove(); document.getElementById('csv-file').click();"
          style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:12px;
                 padding:12px;font-size:0.85rem;font-weight:700;cursor:pointer;min-height:52px;">
          📷 CSV取込
        </button>
        <button onclick="document.getElementById('receipt-check-modal').remove(); openNewEntryModal();"
          style="background:#6366f1;color:#fff;border:none;border-radius:12px;
                 padding:12px;font-size:0.85rem;font-weight:700;cursor:pointer;min-height:52px;">
          ＋ 手動入力
        </button>
      </div>
      <button onclick="document.getElementById('receipt-check-modal').remove();"
        style="width:100%;background:var(--color-bg,#f8fafc);color:var(--color-muted,#64748b);
               border:none;border-radius:10px;padding:10px;font-size:0.85rem;font-weight:600;cursor:pointer;">
        経費はなかった
      </button>`;

  } else {
    headerIcon = '✅';
    headerTitle = `今日の経費 ${confirmedCount}件 確認済み`;
    headerSub = '他に本日発生した経費はありますか？';
    previewHtml = '';
    actionHtml = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <button onclick="document.getElementById('receipt-check-modal').remove(); document.getElementById('csv-file').click();"
          style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:12px;
                 padding:12px;font-size:0.85rem;font-weight:700;cursor:pointer;min-height:52px;">
          📷 CSV取込
        </button>
        <button onclick="document.getElementById('receipt-check-modal').remove(); openNewEntryModal();"
          style="background:#6366f1;color:#fff;border:none;border-radius:12px;
                 padding:12px;font-size:0.85rem;font-weight:700;cursor:pointer;min-height:52px;">
          ＋ 手動入力
        </button>
      </div>
      <button onclick="document.getElementById('receipt-check-modal').remove();"
        style="width:100%;background:var(--color-bg,#f8fafc);color:var(--color-muted,#64748b);
               border:none;border-radius:10px;padding:10px;font-size:0.85rem;font-weight:600;cursor:pointer;">
        他の経費はなかった
      </button>`;
  }

  overlay.innerHTML = `
    <div style="background:var(--color-surface,#fff);width:100%;max-width:420px;
                border-radius:20px 20px 0 0;padding:22px 18px 32px;
                box-shadow:0 -4px 30px rgba(0,0,0,0.18);">
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;">
        <div style="font-size:1.8rem;flex-shrink:0;margin-top:2px;">${headerIcon}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:var(--color-text,#1e293b);font-size:0.95rem;
                      margin-bottom:4px;line-height:1.4;">${headerTitle}</div>
          <div style="font-size:0.78rem;color:var(--color-muted,#64748b);
                      line-height:1.6;white-space:pre-line;">${headerSub}</div>
        </div>
      </div>
      ${previewHtml}
      ${actionHtml}
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
/* └ END : showReceiptCheckPrompt ──────────────────────────────────────────────┘ */

// ===== 業務終了サマリー表示 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : showDailyEndSummary
 * │   業務終了サマリー（走行距離・稼働時間・売上・時給）を表示
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : showDailyEndSummary ──────────────────────────────────────────────┘ */

// ===== 既存モーダル（編集用）=====
// ===== [2026-05-24] 日報編集モーダル（新フロー統合版） =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : openDailyEditModal
 * │   日報の編集モーダルを開く（ODO・配達数・売上・メモ対応）
 * └──────────────────────────────────────────────────────┘ */
function openDailyEditModal(editId) {
  const log = dailyLogs.find(l => l.id === editId);
  if (!log) return;

  const existing = document.getElementById('daily-edit-modal');
  if (existing) existing.remove();

  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const unitPrice = settings.deliveryUnitPrice || 0;

  const el = document.createElement('div');
  el.id = 'daily-edit-modal';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  el.innerHTML = `
    <div style="background:var(--color-surface,#fff);width:100%;max-width:520px;
                border-radius:20px 20px 0 0;padding:24px 20px 36px;
                box-shadow:0 -4px 24px rgba(0,0,0,0.18);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-weight:700;font-size:1rem;color:var(--color-text);">✏️ 日報を編集</div>
        <button onclick="document.getElementById('daily-edit-modal').remove()"
          style="background:none;border:none;font-size:1.3rem;color:var(--color-muted);cursor:pointer;padding:4px 8px;">✕</button>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:0.78rem;font-weight:700;color:var(--color-muted);margin-bottom:5px;">📅 稼働日</label>
        <input type="date" id="edit-daily-date" value="${log.date}"
          style="width:100%;padding:10px 12px;font-size:0.95rem;border:1.5px solid var(--color-border-mid);border-radius:10px;box-sizing:border-box;background:var(--color-surface);">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label style="display:block;font-size:0.78rem;font-weight:700;color:var(--color-muted);margin-bottom:5px;">🚗 開始ODO（km）</label>
          <input type="number" id="edit-start-odo" step="0.01" value="${log.startOdo ?? ''}"
            inputmode="decimal"
            style="width:100%;padding:10px 12px;font-size:1rem;font-weight:700;border:1.5px solid var(--color-border-mid);border-radius:10px;box-sizing:border-box;text-align:center;background:var(--color-surface);"
            oninput="calcEditDistance()">
        </div>
        <div>
          <label style="display:block;font-size:0.78rem;font-weight:700;color:var(--color-muted);margin-bottom:5px;">🏁 終了ODO（km）</label>
          <input type="number" id="edit-end-odo" step="0.01" value="${log.endOdo ?? ''}"
            inputmode="decimal"
            style="width:100%;padding:10px 12px;font-size:1rem;font-weight:700;border:1.5px solid var(--color-border-mid);border-radius:10px;box-sizing:border-box;text-align:center;background:var(--color-surface);"
            oninput="calcEditDistance()">
        </div>
      </div>

      <div style="background:var(--color-bg,#f8fafc);border-radius:10px;padding:10px 14px;
                  display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:0.82rem;color:var(--color-muted);">走行距離</span>
        <span id="edit-distance-val" style="font-size:1.1rem;font-weight:700;color:var(--color-accent);">-- km</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label style="display:block;font-size:0.78rem;font-weight:700;color:var(--color-muted);margin-bottom:5px;">📦 配達個数</label>
          <input type="number" id="edit-deliveries" min="0" value="${log.deliveries ?? ''}"
            inputmode="numeric"
            style="width:100%;padding:10px 12px;font-size:1rem;font-weight:700;border:1.5px solid var(--color-border-mid);border-radius:10px;box-sizing:border-box;text-align:center;background:var(--color-surface);"
            oninput="calcEditDistance()">
        </div>
        <div>
          <label style="display:block;font-size:0.78rem;font-weight:700;color:var(--color-muted);margin-bottom:5px;">💰 売上（自動計算）</label>
          <div id="edit-sales-preview"
            style="padding:10px 12px;font-size:1rem;font-weight:700;border:1.5px solid var(--color-border);
                   border-radius:10px;text-align:center;color:var(--color-income,#15803d);background:var(--color-bg);">
            ${log.sales ? `¥${log.sales.toLocaleString()}` : '--'}
          </div>
        </div>
      </div>

      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:0.78rem;font-weight:700;color:var(--color-muted);margin-bottom:5px;">📝 メモ（任意）</label>
        <input type="text" id="edit-daily-memo" value="${log.memo || ''}"
          placeholder="例: 横浜エリア中心、雨天"
          style="width:100%;padding:10px 12px;font-size:0.92rem;border:1.5px solid var(--color-border-mid);border-radius:10px;box-sizing:border-box;background:var(--color-surface);">
      </div>

      <button onclick="saveDailyEdit('${editId}')"
        style="width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;
               padding:14px;font-size:1rem;font-weight:700;cursor:pointer;">
        💾 保存する
      </button>
    </div>`;

  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  calcEditDistance();
}
/* └ END : openDailyEditModal ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : calcEditDistance
 * │   日報編集モーダルでODO・配達数から走行距離・売上をリアルタイム計算
 * └──────────────────────────────────────────────────────┘ */
function calcEditDistance() {
  const start = parseFloat(document.getElementById('edit-start-odo')?.value) || 0;
  const end   = parseFloat(document.getElementById('edit-end-odo')?.value)   || 0;
  const dist  = Math.max(0, Math.round((end - start) * 100) / 100);
  const distEl = document.getElementById('edit-distance-val');
  if (distEl) distEl.textContent = dist > 0 ? `${dist.toFixed(2)} km` : '-- km';

  const deliveries = parseInt(document.getElementById('edit-deliveries')?.value) || 0;
  const settings = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const unitPrice = settings.deliveryUnitPrice || 0;
  const sales = deliveries * unitPrice;
  const salesEl = document.getElementById('edit-sales-preview');
  if (salesEl) salesEl.textContent = sales > 0 ? `¥${sales.toLocaleString()}` : '--';
}
/* └ END : calcEditDistance ──────────────────────────────────────────────┘ */

/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveDailyEdit
 * │   日報編集モーダルの保存処理（バリデーション→localStorageへ保存）
 * └──────────────────────────────────────────────────────┘ */
function saveDailyEdit(editId) {
  const date       = document.getElementById('edit-daily-date')?.value;
  const startOdo   = parseFloat(document.getElementById('edit-start-odo')?.value);
  const endOdo     = parseFloat(document.getElementById('edit-end-odo')?.value);
  const deliveries = parseInt(document.getElementById('edit-deliveries')?.value) || 0;
  const memo       = document.getElementById('edit-daily-memo')?.value.trim() || '';

  if (!date) { if (typeof showToast === 'function') showToast('稼働日を入力してください', 'warn'); return; }
  if (isNaN(startOdo) || isNaN(endOdo)) { if (typeof showToast === 'function') showToast('オドメーターを入力してください', 'warn'); return; }
  if (endOdo < startOdo) { if (typeof showToast === 'function') showToast('終了ODOは開始ODOより大きい値にしてください', 'warn'); return; }

  const settings  = JSON.parse(localStorage.getItem('bizNaviSettings') || '{}');
  const unitPrice = settings.deliveryUnitPrice || 0;
  const distance  = Math.round((endOdo - startOdo) * 100) / 100;
  const sales     = deliveries * unitPrice;

  const idx = dailyLogs.findIndex(l => l.id === editId);
  if (idx < 0) return;

  dailyLogs[idx] = {
    ...dailyLogs[idx],
    date,
    startOdo: Math.round(startOdo * 100) / 100,
    endOdo:   Math.round(endOdo   * 100) / 100,
    distance, deliveries, unitPrice, sales, memo,
    status: 'completed'
  };

  saveDailyLogsToStorage();
  document.getElementById('daily-edit-modal')?.remove();
  renderDailyPage();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof showToast === 'function') showToast('日報を更新しました ✓', 'success');
}
/* └ END : saveDailyEdit ──────────────────────────────────────────────┘ */


// ===== 日報ページ描画 =====
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : renderDailyPage
 * │   日報ページ全体を描画（ステータスバナー・一覧カード・未確認バッジ）
 * └──────────────────────────────────────────────────────┘ */
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
      const elapsedMin = Math.floor((new Date() - startTime) / 60000);
      const elapsedStr = elapsedMin >= 60
        ? `${Math.floor(elapsedMin/60)}時間${elapsedMin%60}分`
        : `${elapsedMin}分`;
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
          <button class="icon-btn" onclick="openDailyEditModal('${log.id}')">✏️</button>
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
/* └ END : renderDailyPage ──────────────────────────────────────────────┘ */
// navigate時に日報ページを更新（既存のoriginalNavigateラッパーに委ねる）
// app.js:1099 の originalNavigate ラッパーが既にあるので二重ラップしない
document.addEventListener('bizNavi:pageChanged', (e) => {
  if (e.detail && e.detail.page === 'daily') renderDailyPage();
});

// インボイス番号の保存とバリデーション
/* ┌──────────────────────────────────────────────────────┐
 * │ ▶ START : saveInvoiceNumber
 * │   インボイス登録番号を保存してフォーマットを検証
 * └──────────────────────────────────────────────────────┘ */
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
/* └ END : saveInvoiceNumber ──────────────────────────────────────────────┘ */

//END OF FILE

