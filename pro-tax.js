/**
 * pro-tax.js
 * Biz-Navi 拡張機能モジュール（有料プラン）
 *
 * 含まれる機能：
 *   A. 法人化判定アラート
 *   B. 控除・節税チェックリスト（青色申告転記サポート）
 *   C. 経費計上漏れチェック（軽貨物特化）
 *
 * 依存：app.js（entries, calcSums, fmt, showToast, navigate）
 * 分離方針：このファイルを外せば拡張機能が完全に無効化される
 */

'use strict';

// ============================================================
// 共通ユーティリティ
// ============================================================

const ProTax = {

  // ──────────────────────────────────────────────────────────
  // 設定・定数
  // ──────────────────────────────────────────────────────────
  TAX: {
    // 所得税率テーブル（2024年〜）
    incomeTaxBrackets: [
      { limit:  1_950_000, rate: 0.05, deduct:       0 },
      { limit:  3_300_000, rate: 0.10, deduct:  97_500 },
      { limit:  6_950_000, rate: 0.20, deduct: 427_500 },
      { limit:  9_000_000, rate: 0.23, deduct: 636_000 },
      { limit: 18_000_000, rate: 0.33, deduct:1_536_000 },
      { limit: 40_000_000, rate: 0.40, deduct:2_796_000 },
      { limit: Infinity,   rate: 0.45, deduct:4_796_000 },
    ],
    // 住民税（一律）
    residentTaxRate: 0.10,
    // 法人税実効税率（中小法人）
    corpEffectiveRate: 0.234, // 法人税+住民税+事業税
    // 法人化のメリットが出る目安利益額（役員報酬最適化後）
    corpAdvantageThreshold: 6_000_000,
    // 消費税課税事業者ライン
    taxableThreshold: 10_000_000,
    // 青色申告特別控除
    blueDeduction65: 650_000,
    blueDeduction10: 100_000,
    // 国民年金保険料（2024年度）
    nenkinAnnual: 214_680,
  },

  // ──────────────────────────────────────────────────────────
  // A. 法人化判定アラート
  // ──────────────────────────────────────────────────────────
  checkCorpAlert() {
    const year = new Date().getFullYear();
    const entries = window.entries || [];
    const yearEntries = entries.filter(e => e?.date?.startsWith(String(year)));
    const sums = typeof calcSums === 'function' ? calcSums(yearEntries) : null;
    if (!sums) return;

    const revenue  = sums.income  || 0;
    const expense  = sums.expense || 0;
    const profit   = revenue - expense;
    const elapsed  = (new Date().getMonth() + 1) / 12; // 年の経過率
    const annualRev    = elapsed > 0 ? Math.round(revenue / elapsed) : 0;
    const annualProfit = elapsed > 0 ? Math.round(profit  / elapsed) : 0;

    const alerts = [];

    // 消費税課税ライン（売上1,000万円）
    if (annualRev >= this.TAX.taxableThreshold * 0.80) {
      alerts.push({
        level: 'danger',
        icon: '⚠️',
        title: '課税事業者ラインに接近中',
        body: `年間売上予測 ${fmt(annualRev)} は消費税課税ライン（1,000万円）の80%を超えています。来年から課税事業者になる可能性があります。`,
        action: '税理士への相談を検討してください',
      });
    }

    // 法人化有利ライン（利益600万円）
    if (annualProfit >= this.TAX.corpAdvantageThreshold * 0.80) {
      const personalTax = this._calcPersonalTax(annualProfit);
      const corpTax     = Math.round(annualProfit * this.TAX.corpEffectiveRate);
      const saving      = personalTax - corpTax;
      alerts.push({
        level: 'warning',
        icon: '🏢',
        title: '法人化を検討するタイミングです',
        body: `年間利益予測 ${fmt(annualProfit)} では、個人事業主より法人の方が税負担が軽くなる可能性があります。`,
        detail: `個人税負担（概算）: ${fmt(personalTax)} ／ 法人税負担（概算）: ${fmt(corpTax)}\n法人化で年間 ${fmt(saving)} の節税効果が見込めます`,
        action: '税理士・司法書士にご相談ください',
      });
    }

    this._renderCorpAlertBanner(alerts);
    return alerts;
  },

  _calcPersonalTax(profit) {
    // 青色申告特別控除65万円・基礎控除48万円を考慮した簡易計算
    const taxableIncome = Math.max(0, profit - this.TAX.blueDeduction65 - 480_000);
    let tax = 0;
    for (const b of this.TAX.incomeTaxBrackets) {
      if (taxableIncome <= b.limit) {
        tax = Math.round(taxableIncome * b.rate - b.deduct);
        break;
      }
    }
    const residentTax = Math.round(taxableIncome * this.TAX.residentTaxRate);
    return tax + residentTax;
  },

  _renderCorpAlertBanner(alerts) {
    const existing = document.getElementById('pro-corp-alert');
    if (existing) existing.remove();
    if (!alerts.length) return;

    const profitCard = document.getElementById('profit-card-container');
    if (!profitCard) return;

    const colors = { danger: '#b03a2e', warning: '#e67e22', info: '#028090' };
    const bgs    = { danger: '#fff5f5', warning: '#fffbf0', info:  '#f0faf9' };

    const html = alerts.map(a => `
      <div style="
        background: ${bgs[a.level]};
        border: 1px solid ${colors[a.level]};
        border-left: 4px solid ${colors[a.level]};
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 8px;
      ">
        <div style="font-size:13px; font-weight:700; color:${colors[a.level]}; margin-bottom:4px;">
          ${a.icon} ${a.title}
        </div>
        <div style="font-size:12px; color:#334155; line-height:1.6;">${a.body}</div>
        ${a.detail ? `<div style="font-size:11px; color:#64748b; margin-top:4px; white-space:pre-line;">${a.detail}</div>` : ''}
        <div style="font-size:11px; color:${colors[a.level]}; margin-top:6px; font-weight:600;">→ ${a.action}</div>
      </div>
    `).join('');

    const wrapper = document.createElement('div');
    wrapper.id = 'pro-corp-alert';
    wrapper.style.cssText = 'margin: 0 16px 8px;';
    wrapper.innerHTML = html;
    profitCard.insertAdjacentElement('afterend', wrapper);
  },

  // ──────────────────────────────────────────────────────────
  // B. 控除・節税チェックリスト
  // ──────────────────────────────────────────────────────────
  renderDeductionPage() {
    const el = document.getElementById('pro-deduction-content');
    if (!el) return;

    const saved = JSON.parse(localStorage.getItem('pro_deductions') || '{}');
    const year  = new Date().getFullYear();
    const entries = window.entries || [];
    const yearEntries = entries.filter(e => e?.date?.startsWith(String(year)));
    const sums  = typeof calcSums === 'function' ? calcSums(yearEntries) : {};
    const profit = (sums.income || 0) - (sums.expense || 0);

    // 各控除の計算
    const nenkin    = saved.nenkin    ?? this.TAX.nenkinAnnual;
    const kokuho    = saved.kokuho    ?? 0;
    const seimei    = saved.seimei    ?? 0;
    const jishin    = saved.jishin    ?? 0;
    const iryo      = saved.iryo      ?? 0;
    const ideco     = saved.ideco     ?? 0;
    const kyosai    = saved.kyosai    ?? 0;
    const furusato  = saved.furusato  ?? 0;
    const haigusha  = saved.haigusha  ?? 0; // 配偶者控除
    const kazoku    = saved.kazoku    ?? 0; // 扶養控除

    const iryoDeduct  = Math.max(0, iryo - 100_000);
    const seimeiCap   = Math.min(seimei, 120_000);
    const jishinCap   = Math.min(jishin, 50_000);
    const furusatoDed = Math.max(0, furusato - 2_000);

    const totalDeduct = nenkin + kokuho + seimeiCap + jishinCap + iryoDeduct
                      + ideco + kyosai + furusatoDed + haigusha + kazoku
                      + this.TAX.blueDeduction65 + 480_000; // 基礎控除

    const taxableIncome = Math.max(0, profit - totalDeduct);
    const estimatedTax  = this._calcPersonalTax(Math.max(0, profit - totalDeduct + 480_000 + this.TAX.blueDeduction65));

    el.innerHTML = `
      <style>
        .ded-card { background:#fff; border:0.5px solid var(--color-border); border-radius:14px;
          box-shadow:0 2px 8px rgba(0,0,0,.06); margin:0 16px 12px; overflow:hidden; }
        .ded-head { background:var(--color-accent); color:#fff; padding:12px 16px;
          font-size:14px; font-weight:700; }
        .ded-row  { display:flex; justify-content:space-between; align-items:center;
          padding:10px 16px; border-bottom:0.5px solid var(--color-border); }
        .ded-row:last-child { border-bottom:none; }
        .ded-label { font-size:13px; color:var(--color-text); }
        .ded-sub   { font-size:10px; color:var(--color-muted); margin-top:2px; }
        .ded-val   { font-size:15px; font-weight:700; color:var(--color-income); }
        .ded-input { width:120px; padding:6px 10px; border:1px solid var(--color-border);
          border-radius:8px; font-size:13px; text-align:right; }
        .ded-tag   { font-size:10px; background:#e8f4f1; color:var(--color-income);
          border-radius:4px; padding:2px 6px; font-weight:700; }
        .ded-summary { background:var(--color-accent); color:#fff; border-radius:14px;
          margin:0 16px 12px; padding:16px; }
        .transfer-btn { width:calc(100% - 32px); margin:0 16px 16px;
          padding:14px; background:var(--color-btn-primary); color:#fff;
          border:none; border-radius:12px; font-size:15px; font-weight:700;
          cursor:pointer; }
        .transfer-btn:active { opacity:0.85; }
      </style>

      <!-- 概算所得・税額サマリー -->
      <div class="ded-summary">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span style="font-size:12px; opacity:.8;">${year}年 事業所得（概算）</span>
          <span style="font-size:18px; font-weight:700;">${fmt(profit)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <span style="font-size:12px; opacity:.8;">所得控除合計</span>
          <span style="font-size:18px; font-weight:700; color:#6ee7b7;">▲${fmt(totalDeduct)}</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,.3); padding-top:10px;
          display:flex; justify-content:space-between;">
          <span style="font-size:12px; opacity:.8;">課税所得（概算）</span>
          <span style="font-size:20px; font-weight:700;">${fmt(taxableIncome)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:8px;">
          <span style="font-size:12px; opacity:.8;">概算税額（所得税＋住民税）</span>
          <span style="font-size:20px; font-weight:700; color:#fcd34d;">${fmt(estimatedTax)}</span>
        </div>
      </div>

      <!-- 自動計上される控除 -->
      <div class="ded-card">
        <div class="ded-head">✅ 自動計上される控除</div>
        <div class="ded-row">
          <div>
            <div class="ded-label">青色申告特別控除 <span class="ded-tag">要件確認</span></div>
            <div class="ded-sub">複式簿記＋e-Tax提出で65万円控除</div>
          </div>
          <div class="ded-val">${fmt(this.TAX.blueDeduction65)}</div>
        </div>
        <div class="ded-row">
          <div>
            <div class="ded-label">基礎控除</div>
            <div class="ded-sub">所得2,400万円以下は一律48万円</div>
          </div>
          <div class="ded-val">${fmt(480_000)}</div>
        </div>
        <div class="ded-row">
          <div>
            <div class="ded-label">国民年金保険料</div>
            <div class="ded-sub">2024年度：月額17,890円×12ヶ月</div>
          </div>
          <div class="ded-val">${fmt(this.TAX.nenkinAnnual)}</div>
        </div>
      </div>

      <!-- 入力が必要な控除 -->
      <div class="ded-card">
        <div class="ded-head">📝 入力して控除額を確定させる</div>

        ${this._dedInputRow('kokuho', '国民健康保険料', '支払い済みの年間保険料', kokuho)}
        ${this._dedInputRow('seimei', '生命保険料控除', '年間支払額（上限12万円）', seimei)}
        ${this._dedInputRow('jishin', '地震保険料控除', '年間支払額（上限5万円）', jishin)}
        ${this._dedInputRow('ideco', 'iDeCo（個人型確定拠出年金）', '年間掛金（月最大68,000円）', ideco,
          ideco > 0 ? `節税効果（概算）: ${fmt(Math.round(ideco * 0.20))}` : '月1万円積立 → 年間約2万円節税')}
        ${this._dedInputRow('kyosai', '小規模企業共済', '年間掛金（月最大70,000円）', kyosai,
          kyosai > 0 ? `節税効果（概算）: ${fmt(Math.round(kyosai * 0.20))}` : '月1万円積立 → 年間約2万円節税＋退職金代わり')}
        ${this._dedInputRow('furusato', 'ふるさと納税', '年間寄付額（2,000円は自己負担）', furusato)}
        ${this._dedInputRow('haigusha', '配偶者控除', '38万円または48万円', haigusha)}
        ${this._dedInputRow('kazoku', '扶養控除', '38万〜63万円×扶養人数', kazoku)}
      </div>

      <!-- 医療費控除（10万円超） -->
      <div class="ded-card">
        <div class="ded-head">🏥 医療費控除</div>
        <div class="ded-row">
          <div>
            <div class="ded-label">年間医療費合計</div>
            <div class="ded-sub">10万円超の部分が控除対象（薬局・病院・通院交通費も含む）</div>
          </div>
          <input type="number" class="ded-input" id="ded-iryo" value="${iryo||''}"
            placeholder="0" oninput="ProTax._saveAndRefresh('iryo', this.value)">
        </div>
        ${iryo >= 100_000 ? `
        <div class="ded-row" style="background:#f0faf5;">
          <div class="ded-label" style="color:var(--color-income);">控除額</div>
          <div class="ded-val">${fmt(iryoDeduct)}</div>
        </div>` : `
        <div class="ded-row" style="background:#f8fafc;">
          <div class="ded-sub">現在 ${fmt(iryo)} ／ あと ${fmt(Math.max(0, 100_000 - iryo))} で控除が始まります</div>
        </div>`}
      </div>

      <!-- 青色申告書転記ボタン -->
      <button class="transfer-btn" onclick="ProTax.renderTransferSheet()">
        📋 青色申告書への転記シートを表示
      </button>
    `;

    this._attachDedInputListeners();
  },

  _dedInputRow(key, label, sub, val, hint) {
    return `
      <div class="ded-row">
        <div>
          <div class="ded-label">${label}</div>
          <div class="ded-sub">${sub}</div>
          ${hint ? `<div class="ded-sub" style="color:var(--color-income); margin-top:2px;">💡 ${hint}</div>` : ''}
        </div>
        <input type="number" class="ded-input" id="ded-${key}" value="${val||''}"
          placeholder="0" oninput="ProTax._saveAndRefresh('${key}', this.value)">
      </div>`;
  },

  _saveAndRefresh(key, val) {
    const saved = JSON.parse(localStorage.getItem('pro_deductions') || '{}');
    saved[key] = parseInt(val) || 0;
    localStorage.setItem('pro_deductions', JSON.stringify(saved));
    this.renderDeductionPage();
  },

  _attachDedInputListeners() {
    // フォーカス時に選択状態にする（入力しやすくする）
    document.querySelectorAll('.ded-input').forEach(el => {
      el.addEventListener('focus', () => el.select());
    });
  },

  // ──────────────────────────────────────────────────────────
  // 青色申告書 転記シート
  // ──────────────────────────────────────────────────────────
  renderTransferSheet() {
    const year   = new Date().getFullYear();
    const entries = window.entries || [];
    const yearEntries = entries.filter(e => e?.date?.startsWith(String(year)));
    const sums   = typeof calcSums === 'function' ? calcSums(yearEntries) : {};
    const saved  = JSON.parse(localStorage.getItem('pro_deductions') || '{}');

    const revenue = sums.income  || 0;
    const expense = sums.expense || 0;
    const profit  = revenue - expense;

    // 経費内訳を科目別に集計
    const expByAccount = {};
    yearEntries.forEach(e => {
      if (!e.debit) return;
      const name = e.debit.account;
      if (!name) return;
      if (!expByAccount[name]) expByAccount[name] = 0;
      expByAccount[name] += (e.kasji?.bizAmount ?? e.debit.amount ?? 0);
    });

    // 控除合計
    const nenkin   = this.TAX.nenkinAnnual;
    const kokuho   = saved.kokuho   || 0;
    const seimei   = Math.min(saved.seimei || 0, 120_000);
    const jishin   = Math.min(saved.jishin || 0, 50_000);
    const iryo     = Math.max(0, (saved.iryo || 0) - 100_000);
    const ideco    = saved.ideco    || 0;
    const kyosai   = saved.kyosai   || 0;
    const furusato = Math.max(0, (saved.furusato || 0) - 2_000);
    const haigusha = saved.haigusha || 0;
    const kazoku   = saved.kazoku   || 0;
    const socialDeduct = nenkin + kokuho;
    const totalDeduct  = socialDeduct + seimei + jishin + iryo + ideco + kyosai
                       + furusato + haigusha + kazoku
                       + this.TAX.blueDeduction65 + 480_000;
    const taxableIncome = Math.max(0, profit - totalDeduct);
    const estTax = this._calcPersonalTax(Math.max(0, profit - totalDeduct + 480_000 + this.TAX.blueDeduction65));

    // モーダル表示
    const modal = document.createElement('div');
    modal.id = 'pro-transfer-modal';
    modal.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,.5);
      z-index:9999; display:flex; align-items:flex-start;
      justify-content:center; overflow-y:auto; padding:16px;`;
    modal.innerHTML = `
      <div style="background:#fff; border-radius:16px; width:100%; max-width:520px;
        margin:auto; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.2);">
        <div style="background:var(--color-accent); color:#fff; padding:14px 16px;
          display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:15px; font-weight:700;">📋 青色申告書 転記シート（${year}年分）</span>
          <button onclick="document.getElementById('pro-transfer-modal').remove()"
            style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">✕</button>
        </div>
        <div style="padding:16px; font-size:13px; line-height:1.8;">

          <div style="background:#f0faf5; border-radius:10px; padding:12px 14px; margin-bottom:12px;
            font-size:11px; color:var(--color-income);">
            💡 この画面を見ながら確定申告書・青色申告決算書に転記してください。<br>
            数字はBiz-Naviの記録に基づく概算です。申告前に必ず確認してください。
          </div>

          <div style="font-weight:700; color:var(--color-accent); margin-bottom:6px; font-size:14px;">
            ── 青色申告決算書 第1表 ──
          </div>
          ${this._transferRow('①  売上金額', revenue)}
          ${this._transferRow('②  売上原価', 0)}
          ${Object.entries(expByAccount)
            .filter(([k]) => !['普通預金','現金','売上高','事業主借','事業主貸'].includes(k))
            .sort(([,a],[,b]) => b-a)
            .map(([name, amt]) => this._transferRow(`　　${name}`, amt, '#64748b'))
            .join('')}
          ${this._transferRow('③  経費合計', expense, '#b03a2e')}
          ${this._transferRow('④  青色申告特別控除', this.TAX.blueDeduction65, '#1a7a5e')}
          ${this._transferRowBold('⑤  所得金額（①-②-③-④）', profit - this.TAX.blueDeduction65)}

          <div style="font-weight:700; color:var(--color-accent); margin:12px 0 6px; font-size:14px;">
            ── 確定申告書 所得控除 ──
          </div>
          ${this._transferRow('社会保険料控除（国民年金）', nenkin)}
          ${kokuho ? this._transferRow('社会保険料控除（国民健康保険）', kokuho) : ''}
          ${seimei ? this._transferRow('生命保険料控除', seimei) : ''}
          ${jishin ? this._transferRow('地震保険料控除', jishin) : ''}
          ${iryo   ? this._transferRow('医療費控除', iryo) : ''}
          ${ideco  ? this._transferRow('小規模企業共済等掛金控除（iDeCo）', ideco) : ''}
          ${kyosai ? this._transferRow('小規模企業共済等掛金控除（共済）', kyosai) : ''}
          ${furusato ? this._transferRow('寄付金控除（ふるさと納税）', furusato) : ''}
          ${haigusha ? this._transferRow('配偶者控除', haigusha) : ''}
          ${kazoku   ? this._transferRow('扶養控除', kazoku) : ''}
          ${this._transferRow('基礎控除', 480_000)}
          ${this._transferRowBold('所得控除合計', totalDeduct, '#1a7a5e')}

          <div style="border-top:2px solid var(--color-accent); margin:10px 0; padding-top:10px;">
            ${this._transferRowBold('課税所得金額', taxableIncome)}
            ${this._transferRowBold('概算税額（所得税＋住民税）', estTax, '#b03a2e')}
          </div>

          <div style="font-size:10px; color:#94a3b8; margin-top:8px; line-height:1.6;">
            ※ 上記はBiz-Naviの記録に基づく参考値です。<br>
            復興特別所得税・予定納税・源泉徴収等は含まれていません。<br>
            申告前に税理士または税務署にご確認ください。
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  _transferRow(label, val, color='#1a1917') {
    if (!val && val !== 0) return '';
    return `<div style="display:flex; justify-content:space-between; padding:4px 0;
      border-bottom:0.5px solid #f1f5f9;">
      <span style="color:${color};">${label}</span>
      <span style="font-weight:600; color:${color}; font-variant-numeric:tabular-nums;">
        ${typeof fmt === 'function' ? fmt(val) : '¥'+val.toLocaleString()}
      </span></div>`;
  },

  _transferRowBold(label, val, color='#1e3a5f') {
    return `<div style="display:flex; justify-content:space-between; padding:6px 0;
      background:#f8fafc; border-radius:6px; padding:6px 8px; margin:4px 0;">
      <span style="font-weight:700; color:${color};">${label}</span>
      <span style="font-size:16px; font-weight:700; color:${color}; font-variant-numeric:tabular-nums;">
        ${typeof fmt === 'function' ? fmt(val) : '¥'+val.toLocaleString()}
      </span></div>`;
  },

  // ──────────────────────────────────────────────────────────
  // C. 経費計上漏れチェック（軽貨物特化）
  // ──────────────────────────────────────────────────────────
  checkExpenseMissing() {
    const year = new Date().getFullYear();
    const entries = window.entries || [];
    const yearEntries = entries.filter(e => e?.date?.startsWith(String(year)));
    const month = new Date().getMonth() + 1;

    // 科目別集計
    const byAccount = {};
    yearEntries.forEach(e => {
      const name = e.debit?.account;
      if (!name) return;
      if (!byAccount[name]) byAccount[name] = 0;
      byAccount[name] += e.debit.amount || 0;
    });

    const alerts = [];

    // チェックリスト（軽貨物ドライバー特化）
    const checks = [
      {
        account: '通信費',
        label: 'スマホ・通信費の按分',
        threshold: month * 2_000, // 月2,000円以上が目安
        hint: 'スマホ代の50〜80%は事業経費になります（按分）。未入力なら毎月記録を。',
      },
      {
        account: '旅費交通費',
        label: 'ETC・高速料金',
        threshold: month * 3_000,
        hint: 'ETCカードの明細から旅費交通費として計上できます。',
      },
      {
        account: '燃料費',
        label: 'ガソリン代',
        threshold: month * 15_000,
        hint: 'ガソリン代は軽貨物の主要経費です。領収書またはカード明細で記録してください。',
      },
      {
        account: '車両費',
        label: '車両メンテナンス費',
        threshold: month * 2_000,
        hint: 'オイル交換・タイヤ・車検費用は車両費として計上できます。',
      },
      {
        account: '損害保険料',
        label: '任意保険・貨物保険',
        threshold: month * 5_000,
        hint: '任意保険料・貨物保険料は損害保険料として全額経費になります。',
      },
      {
        account: '消耗品費',
        label: '作業用消耗品',
        threshold: month * 500,
        hint: '軍手・養生テープ・台車・文具等は消耗品費として計上できます。',
      },
      {
        account: '地代家賃',
        label: '自宅事務所の家賃按分',
        threshold: 0, // 0でも警告（計上している人が少ない）
        hint: '自宅で帳簿管理・ルート計画をしているなら家賃の一部（10〜20%）を経費にできます。',
        optional: true,
      },
    ];

    checks.forEach(c => {
      const actual = byAccount[c.account] || 0;
      if (c.optional && actual === 0) {
        alerts.push({ level: 'info', account: c.account, label: c.label, hint: c.hint, actual, threshold: c.threshold });
      } else if (!c.optional && actual < c.threshold) {
        alerts.push({ level: 'warning', account: c.account, label: c.label, hint: c.hint, actual, threshold: c.threshold });
      }
    });

    this._renderMissingExpenseCard(alerts);
    return alerts;
  },

  _renderMissingExpenseCard(alerts) {
    const el = document.getElementById('pro-missing-expense');
    if (!el) return;

    if (!alerts.length) {
      el.innerHTML = `
        <div style="background:#f0faf5; border-radius:12px; padding:14px 16px; margin:0 16px 12px;
          border:1px solid rgba(26,122,94,.2); font-size:13px; color:var(--color-income);">
          ✅ 経費計上漏れは検出されませんでした
        </div>`;
      return;
    }

    const rows = alerts.map(a => {
      const icon  = a.level === 'warning' ? '⚠️' : 'ℹ️';
      const color = a.level === 'warning' ? '#e67e22' : '#028090';
      const bg    = a.level === 'warning' ? '#fffbf0' : '#f0faf9';
      return `
        <div style="padding:10px 14px; border-bottom:0.5px solid var(--color-border);
          background:${bg};">
          <div style="font-size:12px; font-weight:700; color:${color}; margin-bottom:3px;">
            ${icon} ${a.label}
            ${a.actual > 0 ? `<span style="font-size:10px; color:#94a3b8;">（現在: ${fmt(a.actual)}）</span>` : ''}
          </div>
          <div style="font-size:11px; color:#475569; line-height:1.5;">${a.hint}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div style="background:#fff; border:0.5px solid var(--color-border); border-radius:14px;
        box-shadow:0 2px 8px rgba(0,0,0,.06); margin:0 16px 12px; overflow:hidden;">
        <div style="background:#e67e22; color:#fff; padding:10px 14px;
          font-size:13px; font-weight:700;">
          ⚠️ 経費計上漏れの可能性（${alerts.length}件）
        </div>
        ${rows}
        <div style="padding:8px 14px; font-size:10px; color:#94a3b8;">
          ※ 軽貨物ドライバーの経費パターンから自動検出しています
        </div>
      </div>`;
  },

  // ──────────────────────────────────────────────────────────
  // タブ切替
  // ──────────────────────────────────────────────────────────
  _switchTab(tab) {
    const panels = ['deduction', 'missing'];
    panels.forEach(p => {
      const panel = document.getElementById(`protax-panel-${p}`);
      const btn   = document.getElementById(`protax-tab-${p}`);
      if (!panel || !btn) return;
      if (p === tab) {
        panel.style.display = 'block';
        btn.style.background = 'var(--color-accent)';
        btn.style.color = '#fff';
        btn.style.fontWeight = '700';
      } else {
        panel.style.display = 'none';
        btn.style.background = '#f8fafc';
        btn.style.color = 'var(--color-muted)';
        btn.style.fontWeight = '600';
      }
    });
    // 経費漏れタブに切り替えたら描画
    if (tab === 'missing') this.checkExpenseMissing();
  },

  // ──────────────────────────────────────────────────────────
  // ページ初期化
  // ──────────────────────────────────────────────────────────
  init() {
    // ダッシュボードロード後に法人化チェック
    document.addEventListener('bizNavi:dashboardUpdated', () => {
      this.checkCorpAlert();
    });

    // 決算ページ表示時に経費漏れチェック
    document.addEventListener('bizNavi:pageChanged', (e) => {
      if (e.detail?.page === 'pro-tax') {
        this.renderDeductionPage();
        this.checkExpenseMissing();
      }
    });

    // 初回ロード時にも法人化チェック
    setTimeout(() => this.checkCorpAlert(), 1500);
  },
};

// ── DOMContentLoaded で自動初期化 ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ProTax.init();
});
