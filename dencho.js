// ===================================================
// 電子帳簿保存法（電帳法）対応モジュール
// 対応法令：電子帳簿保存法（令和5年度改正対応）
// ===================================================

// ----- 電帳法レコード管理 -----
let dencho = JSON.parse(localStorage.getItem('kaikei_dencho') || '[]');
// dencho[] の各レコード構造:
// {
//   id          : string  — ユニークID（エントリIDと紐付け）
//   entryId     : string  — 仕訳帳エントリID
//   importedAt  : number  — 取込日時（Unix ms）
//   inputDeadline: string — 入力期限（取引日から2ヶ月以内）
//   withinDeadline: bool  — 入力期限内フラグ
//   source      : string  — 'primpo' | 'manual'
//   fileName    : string  — 元ファイル名
//   fileSize    : number  — ファイルサイズ（bytes）
//   resolution  : string  — 'dpi200+'（スキャン解像度基準）
//   colorDepth  : string  — '24bit'（階調基準）
//   hashSHA256  : string  — ファイルハッシュ（改ざん検知用）
//   txDate      : string  — 取引年月日
//   txPartner   : string  — 取引先
//   txAmount    : number  — 取引金額（税込）
//   txAmountEx  : number  — 取引金額（税抜）
//   txTax       : number  — 消費税額
//   txTaxRate   : string  — 税率区分
//   txCategory  : string  — 取引種別
//   txMemo      : string  — 内容・摘要
//   correctionLog: []    — 変更履歴（修正・削除の記録）
//   verified    : bool    — 確認済みフラグ
// }

function saveDencho() {
  localStorage.setItem('kaikei_dencho', JSON.stringify(dencho));
}

// ----- ハッシュ生成（簡易版：Web Crypto API使用） -----
async function sha256hex(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // フォールバック（簡易チェックサム）
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(8, '0') + '-fallback';
  }
}

// ----- 入力期限計算（取引月の翌々月末） -----
function calcInputDeadline(txDateStr) {
  const d = new Date(txDateStr);
  // 取引月 + 2ヶ月後の末日
  const deadline = new Date(d.getFullYear(), d.getMonth() + 3, 0);
  return deadline.toISOString().slice(0, 10);
}

// ----- PRiMPO CSVから電帳法レコード生成 -----
async function createDenchoRecord(entry, rawCsvRow, fileName, fileSize) {
  const hash = await sha256hex(rawCsvRow + entry.id);
  const deadline = calcInputDeadline(entry.date);
  const now = new Date();
  const withinDeadline = new Date(deadline) >= now;

  // 金額（税抜・税額）
  const taxAmt = (entry.debit.taxAmount || 0) + (entry.credit.taxAmount || 0);
  const totalAmt = entry.debit.amount || entry.credit.amount || 0;
  const taxRate = entry.debit.taxCode !== 'non' ? entry.debit.taxCode :
                  entry.credit.taxCode !== 'non' ? entry.credit.taxCode : 'non';

  const record = {
    id: 'denc_' + entry.id,
    entryId: entry.id,
    importedAt: Date.now(),
    importedAtISO: new Date().toISOString(),
    inputDeadline: deadline,
    withinDeadline,
    source: 'primpo',
    fileName: fileName || 'unknown.csv',
    fileSize: fileSize || 0,
    resolution: 'dpi200+',   // PRiMPO規定（200dpi以上）
    colorDepth: '24bit',      // PRiMPO規定（カラー24bit）
    hashSHA256: hash,
    txDate: entry.date,
    txPartner: entry.memo ? entry.memo.replace('（PRiMPO）', '').trim() : '',
    txAmount: totalAmt,
    txAmountEx: totalAmt - taxAmt,
    txTax: taxAmt,
    txTaxRate: taxRate,
    txCategory: getAccountType(entry.credit.account) === 'income' ? '収入' : '支出',
    txMemo: entry.memo || '',
    correctionLog: [],
    verified: false,
  };
  return record;
}

// ----- 変更履歴を記録 -----
function logCorrection(denchoId, changeType, before, after, reason) {
  const rec = dencho.find(r => r.id === denchoId);
  if (!rec) return;
  rec.correctionLog.push({
    at: new Date().toISOString(),
    type: changeType,  // 'edit' | 'delete' | 'verify'
    before: JSON.stringify(before),
    after: JSON.stringify(after),
    reason: reason || '',
  });
  saveDencho();
}

// ===== 電帳法ページ レンダリング =====
function renderDencho() {
  renderDenchoSearch();
}

// ----- 検索フィルタ適用 -----
function getDenchoFiltered() {
  const q        = (document.getElementById('ds-keyword')?.value || '').trim().toLowerCase();
  const dateFrom = document.getElementById('ds-date-from')?.value || '';
  const dateTo   = document.getElementById('ds-date-to')?.value || '';
  const amtMin   = parseFloat(document.getElementById('ds-amt-min')?.value) || 0;
  const amtMax   = parseFloat(document.getElementById('ds-amt-max')?.value) || Infinity;
  const cat      = document.getElementById('ds-category')?.value || 'all';
  const taxRate  = document.getElementById('ds-taxrate')?.value || 'all';
  const verified = document.getElementById('ds-verified')?.value || 'all';
  const deadline = document.getElementById('ds-deadline')?.value || 'all';

  return dencho.filter(r => {
    if (q && !(
      r.txPartner.toLowerCase().includes(q) ||
      r.txMemo.toLowerCase().includes(q) ||
      r.fileName.toLowerCase().includes(q)
    )) return false;
    if (dateFrom && r.txDate < dateFrom) return false;
    if (dateTo   && r.txDate > dateTo)   return false;
    if (r.txAmount < amtMin || r.txAmount > amtMax) return false;
    if (cat !== 'all' && r.txCategory !== cat)  return false;
    if (taxRate !== 'all' && r.txTaxRate !== taxRate) return false;
    if (verified === 'yes' && !r.verified) return false;
    if (verified === 'no'  &&  r.verified) return false;
    if (deadline === 'over' && r.withinDeadline) return false;
    if (deadline === 'ok'   && !r.withinDeadline) return false;
    return true;
  });
}

function renderDenchoSearch() {
  const filtered = getDenchoFiltered();
  const el = document.getElementById('dencho-list');
  if (!el) return;

  // 統計バー更新
  const total     = dencho.length;
  const verified  = dencho.filter(r => r.verified).length;
  const overdue   = dencho.filter(r => !r.withinDeadline).length;
  const unverified = total - verified;

  const statEl = document.getElementById('dencho-stat');
  if (statEl) {
    statEl.innerHTML = `
      <div class="dencho-stat-item">
        <span class="ds-num">${total}</span>
        <span class="ds-label">総件数</span>
      </div>
      <div class="dencho-stat-item verified">
        <span class="ds-num">${verified}</span>
        <span class="ds-label">確認済</span>
      </div>
      <div class="dencho-stat-item unverified">
        <span class="ds-num">${unverified}</span>
        <span class="ds-label">未確認</span>
      </div>
      <div class="dencho-stat-item ${overdue > 0 ? 'overdue' : ''}">
        <span class="ds-num">${overdue}</span>
        <span class="ds-label">期限超過</span>
      </div>`;
  }

  if (filtered.length === 0) {
    el.innerHTML = '<div class="empty-msg">該当する電帳法レコードがありません</div>';
    return;
  }

  el.innerHTML = filtered.map(r => denchoCard(r)).join('');
}

function denchoCard(r) {
  const overdue = !r.withinDeadline;
  const deadlineClass = overdue ? 'deadline-over' : 'deadline-ok';
  const verifiedBadge = r.verified
    ? '<span class="dencho-badge verified-badge">✓ 確認済</span>'
    : '<span class="dencho-badge unverified-badge">未確認</span>';
  const sourceBadge = '<span class="dencho-badge primpo-badge">PRiMPO</span>';
  const overdueTag = overdue
    ? '<span class="dencho-badge overdue-badge">⚠ 期限超過</span>' : '';
  const taxLabel = {
    exempt10: '課税売上10%', exempt8: '課税売上8%',
    input10: '課税仕入10%', input8: '課税仕入8%',
    free: '非課税', non: '対象外'
  }[r.txTaxRate] || r.txTaxRate;

  return `
  <div class="dencho-card ${r.verified ? 'is-verified' : ''}">
    <div class="dencho-card-head">
      <div class="dencho-date">${r.txDate.replace(/-/g,'/')}</div>
      <div class="dencho-badges">${verifiedBadge}${sourceBadge}${overdueTag}</div>
      <button class="icon-btn" onclick="openDenchoDetail('${r.id}')">詳細</button>
    </div>
    <div class="dencho-card-body">
      <div class="dencho-partner">${r.txPartner || r.txMemo || '—'}</div>
      <div class="dencho-amount ${r.txCategory === '収入' ? 'income-color' : 'expense-color'}">
        ${r.txCategory === '収入' ? '+' : '-'}${fmt(r.txAmount)}
      </div>
    </div>
    <div class="dencho-card-meta">
      <span class="meta-item">📄 ${r.fileName}</span>
      <span class="meta-item">税: ${taxLabel}</span>
      <span class="meta-item ${deadlineClass}">入力期限: ${r.inputDeadline}</span>
    </div>
    <div class="dencho-hash">SHA256: ${r.hashSHA256.slice(0, 32)}...</div>
    <div class="dencho-card-actions">
      <button class="dencho-action-btn ${r.verified ? 'unverify-btn' : 'verify-btn'}"
        onclick="toggleVerify('${r.id}')">
        ${r.verified ? '確認取消' : '✓ 確認する'}
      </button>
      ${r.correctionLog.length > 0
        ? `<button class="dencho-action-btn log-btn" onclick="showLog('${r.id}')">変更履歴(${r.correctionLog.length})</button>`
        : ''}
    </div>
  </div>`;
}

// ----- 詳細モーダル -----
function openDenchoDetail(id) {
  const r = dencho.find(d => d.id === id);
  if (!r) return;
  const entry = entries.find(e => e.id === r.entryId);
  const modal = document.getElementById('dencho-modal');
  const body  = document.getElementById('dencho-modal-body');
  if (!modal || !body) return;

  const taxLabel = {
    exempt10: '課税売上（10%）', exempt8: '課税売上（8%軽減）',
    input10: '課税仕入（10%）', input8: '課税仕入（8%軽減）',
    free: '非課税', non: '対象外'
  }[r.txTaxRate] || r.txTaxRate;

  body.innerHTML = `
    <div class="detail-section">
      <div class="detail-title">基本情報</div>
      <div class="detail-row"><span>取引年月日</span><strong>${r.txDate}</strong></div>
      <div class="detail-row"><span>取引先・内容</span><strong>${r.txPartner || r.txMemo || '—'}</strong></div>
      <div class="detail-row"><span>取引金額（税込）</span><strong>${fmt(r.txAmount)}</strong></div>
      <div class="detail-row"><span>取引金額（税抜）</span><strong>${fmt(r.txAmountEx)}</strong></div>
      <div class="detail-row"><span>消費税額</span><strong>${fmt(r.txTax)}</strong></div>
      <div class="detail-row"><span>税区分</span><strong>${taxLabel}</strong></div>
      <div class="detail-row"><span>収支区分</span><strong>${r.txCategory}</strong></div>
    </div>
    <div class="detail-section">
      <div class="detail-title">電帳法保存要件</div>
      <div class="detail-row"><span>取込日時</span><strong>${r.importedAtISO}</strong></div>
      <div class="detail-row"><span>入力期限</span>
        <strong class="${r.withinDeadline ? 'deadline-ok' : 'deadline-over'}">
          ${r.inputDeadline}${r.withinDeadline ? ' ✓' : ' ⚠ 超過'}
        </strong>
      </div>
      <div class="detail-row"><span>データソース</span><strong>PRiMPO（スキャナ保存）</strong></div>
      <div class="detail-row"><span>元ファイル名</span><strong>${r.fileName}</strong></div>
      <div class="detail-row"><span>ファイルサイズ</span><strong>${r.fileSize ? (r.fileSize / 1024).toFixed(1) + ' KB' : '—'}</strong></div>
      <div class="detail-row"><span>解像度基準</span><strong>${r.resolution}（200dpi以上）</strong></div>
      <div class="detail-row"><span>階調基準</span><strong>${r.colorDepth}（カラー）</strong></div>
      <div class="detail-row"><span>確認状態</span><strong>${r.verified ? '✓ 確認済' : '未確認'}</strong></div>
    </div>
    <div class="detail-section">
      <div class="detail-title">真実性確保（改ざん防止）</div>
      <div class="detail-hash">
        <div class="hash-label">SHA-256ハッシュ値</div>
        <div class="hash-val">${r.hashSHA256}</div>
      </div>
    </div>
    ${r.correctionLog.length > 0 ? `
    <div class="detail-section">
      <div class="detail-title">変更履歴（${r.correctionLog.length}件）</div>
      ${r.correctionLog.map(l => `
        <div class="log-row">
          <div class="log-at">${l.at} — ${l.type}</div>
          <div class="log-reason">${l.reason || '理由なし'}</div>
        </div>`).join('')}
    </div>` : ''}
    ${entry ? `
    <div class="detail-section">
      <div class="detail-title">連携仕訳エントリ</div>
      <div class="detail-row"><span>借方 (支出・費用 / Debit)</span><strong>${entry.debit.account} ${fmt(entry.debit.amount)}</strong></div>
      <div class="detail-row"><span>貸方 (収入・資産の減少 / Credit)</span><strong>${entry.credit.account} ${fmt(entry.credit.amount)}</strong></div>
    </div>` : ''}`;

  modal.style.display = 'flex';
}

function closeDenchoModal() {
  document.getElementById('dencho-modal').style.display = 'none';
}

// ----- 確認フラグ切替 -----
function toggleVerify(id) {
  const r = dencho.find(d => d.id === id);
  if (!r) return;
  const prev = r.verified;
  r.verified = !prev;
  logCorrection(id, 'verify', { verified: prev }, { verified: r.verified }, r.verified ? '確認処理' : '確認取消');
  saveDencho();
  renderDenchoSearch();
  showToast(r.verified ? '確認済みにしました' : '確認を取り消しました', 'success');
}

function showLog(id) {
  openDenchoDetail(id);
}

// ----- 電帳法エクスポート（国税庁準拠） -----
function exportDenchoCSV() {
  const filtered = getDenchoFiltered();
  const cols = [
    '管理番号','取引年月日','取引先','取引内容','税込金額','税抜金額',
    '消費税額','税率区分','収支区分','確認状態','入力期限内',
    '取込日時','元ファイル名','解像度基準','階調基準',
    'SHA256ハッシュ','仕訳ID','変更回数'
  ];
  let csv = '\uFEFF' + cols.join(',') + '\n';
  filtered.forEach(r => {
    const taxLabel = {
      exempt10:'課税売上10%', exempt8:'課税売上8%軽減',
      input10:'課税仕入10%', input8:'課税仕入8%軽減',
      free:'非課税', non:'対象外'
    }[r.txTaxRate] || r.txTaxRate;
    csv += [
      `"${r.id}"`,
      `"${r.txDate}"`,
      `"${r.txPartner}"`,
      `"${r.txMemo}"`,
      r.txAmount,
      r.txAmountEx,
      r.txTax,
      `"${taxLabel}"`,
      `"${r.txCategory}"`,
      `"${r.verified ? '確認済' : '未確認'}"`,
      `"${r.withinDeadline ? '期限内' : '期限超過'}"`,
      `"${r.importedAtISO}"`,
      `"${r.fileName}"`,
      `"${r.resolution}"`,
      `"${r.colorDepth}"`,
      `"${r.hashSHA256}"`,
      `"${r.entryId}"`,
      r.correctionLog.length,
    ].join(',') + '\n';
  });
  downloadCSV(csv, `電帳法_スキャナ保存台帳_${new Date().toISOString().slice(0,10)}.csv`);
  showToast('電帳法CSVをエクスポートしました', 'success');
}

// ===== PRiMPOインポート拡張版（電帳法レコード生成付き・日付バグ修正版） =====
async function importPrimpoCSVWithDencho(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let imported = 0;
      const newRecords = [];

      if (lines.length === 0) {
        showToast('CSVファイルの中身が空です', 'error');
        resolve(0);
        return;
      }

      // 1行目、または2行目から「日付」や「金額」が書かれている見出し行を探す
      let headerIdx = 0;
      let headerCols = [];
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        let cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.some(c => c.includes('日')) && cols.some(c => c.includes('金額') || c.includes('価格'))) {
          headerIdx = i;
          headerCols = cols;
          break;
        }
      }

      if (headerCols.length === 0) {
        headerCols = lines[0].split(',').map(c => c.replace(/^"|"$/g, '').trim());
      }

      let dateIdx = headerCols.findIndex(c => c.includes('日'));
      let descIdx = headerCols.findIndex(c => c.includes('内容') || c.includes('摘要') || c.includes('品名') || c.includes('店舗') || c.includes('備考'));
      let amtIdx = headerCols.findIndex(c => c.includes('金額') || c.includes('価格'));

      if (dateIdx < 0) dateIdx = headerCols.findIndex(c => c !== "") || 1;
      if (descIdx < 0) descIdx = dateIdx + 1;
      if (amtIdx < 0) amtIdx = descIdx + 1;

      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 2) continue;

        let rawDate = cols[dateIdx] || "";
        let desc = cols[descIdx] || 'PRiMPO取込';
        let rawAmtStr = cols[amtIdx] || "0";
        
        if (rawDate.includes('日')) continue;

        // ★修正ポイント：日付のフォーマットを「YYYY-MM-DD」に強制変換する
        let date = new Date().toISOString().slice(0, 10); // デフォルトは今日の日付
        if (rawDate) {
          // 「2026/04/20」や「2026.04.20」を「2026-04-20」に変換
          let normalizedDate = rawDate.replace(/\//g, '-').replace(/\./g, '-');
          
          // 正しい日付の形になっているかチェック
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalizedDate)) {
            const parts = normalizedDate.split('-');
            // 月と日を必ず2桁（04など）に揃える
            const yyyy = parts[0];
            const mm = parts[1].padStart(2, '0');
            const dd = parts[2].padStart(2, '0');
            date = `${yyyy}-${mm}-${dd}`;
          }
        }

        rawAmtStr = rawAmtStr.replace(/,/g, '').replace(/¥/g, '').replace(/￥/g, '');
        const rawAmt = parseFloat(rawAmtStr);
        if (isNaN(rawAmt)) continue; 
        
        const amount = Math.abs(rawAmt);
        const isIncome = false; 

        // 軽貨物ドライバー用のキーワード簡易自動分類
        let predictedAccount = "消耗品費";
        const text_n = desc.toLowerCase();
        
        // ★ 1. まず金額が10万円以上で「車」関連のキーワードがあるかを最優先でチェック
        if (amount >= 100000 && (text_n.includes('車') || text_n.includes('カー') || text_n.includes('軽バン'))) {
          predictedAccount = "車両運搬具";
        }
        // ★ 2. 通常のキーワード判定（金額に関わらず振り分け）
        else if (text_n.includes('月極') || text_n.includes('家賃') || text_n.includes('地代')) {
          predictedAccount = "地代家賃";
        } else if (text_n.includes('ガソリン') || text_n.includes('レギュラー') || text_n.includes('軽油') || text_n.includes('エネオス') || text_n.includes('出光')) {
          predictedAccount = "燃料費";
        } else if (text_n.includes('高速') || text_n.includes('ネクスコ') || text_n.includes('タイムズ') || text_n.includes('パーキング') || text_n.includes('etc')) {
          predictedAccount = "旅費交通費";
        } else if (text_n.includes('洗車') || text_n.includes('オイル') || text_n.includes('タイヤ') || text_n.includes('オートバックス') || text_n.includes('イエローハット')) {
          predictedAccount = "車両費";
        } else if (text_n.includes('台車') || text_n.includes('テープ') || text_n.includes('梱包') || text_n.includes('ダンボール')) {
          predictedAccount = "荷造運賃";
        } else if (text_n.includes('手数料') || text_n.includes('振込') || text_n.includes('atm') || text_n.includes('システム利用') || text_n.includes('サービス料')) {
          predictedAccount = "支払手数料";
        }
        
        const entry = {
          id: Date.now().toString() + '_' + i,
          date,
          debit: {
            account: isIncome ? '普通預金' : predictedAccount,
            sub: '', amount,
            taxCode: 'non', taxAmount: 0,
          },
          credit: {
            account: isIncome ? '売上高' : '普通預金',
            sub: '', amount,
            taxCode: 'non', taxAmount: 0,
          },
          memo: desc + '（PRiMPO）',
          kasji: null,
          createdAt: Date.now(),
        };
        entries.push(entry);

        const denchoRec = await createDenchoRecord(entry, line, file.name, file.size);
        newRecords.push(denchoRec);
        imported++;
      }

      entries.sort((a, b) => a.date.localeCompare(b.date));
      dencho.push(...newRecords);
      
      if (typeof saveData === 'function') saveData();
      if (typeof saveDencho === 'function') saveDencho();
      if (typeof renderAll === 'function') renderAll();
      if (typeof renderDencho === 'function') renderDencho();

      const notice = document.getElementById('import-notice');
      if (notice) {
        notice.textContent = `${imported}件をPRiMPOから取り込みました。電帳法台帳に登録済み。`;
        notice.style.display = 'block';
      }
      showToast(`${imported}件インポート・電帳法登録完了`, 'success');
      resolve(imported);
    };
    reader.readAsText(file, 'UTF-8');
  });
}
